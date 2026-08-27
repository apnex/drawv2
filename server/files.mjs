/*
Files -- the Store's persistence surface, and the whole of it.

`D19` injected `writeDoc` so a test could fail or observe a flush. That covered the write and
nothing else: boot listed and read through `fs` directly, and delete called `rmSync` three times
(B55). Three of the four operations bypassed the seam, so a non-filesystem backend could not be
supplied by injection at all -- which is what a GCS deployment needs.

Four verbs, and they take NAMES rather than paths. That is the load-bearing detail: an object store
has keys, not directories, so a seam that passed `path.join(dir, file)` around would push filesystem
shape into a place that has none. The implementation owns where a name lives.

  list()             -> Promise<string[]>   every document name currently stored
  read(name)         -> Promise<string>     utf8 text, rejects if absent
  write(name, text)  -> Promise<void>       atomic: a reader sees the old text or the new, never a splice
  remove(name, tags?) -> Promise<void>      idempotent; `tags` are small strings kept BESIDE the bytes, so a
                                            deleted object can still say whose it was

And two that only some backends can answer (B109):

  recoverable()      -> Promise<entry[] | null>   what is inside the delete window; NULL if there is no window
  restore(name, gen) -> Promise<void>             bring one back

`tags` exist because of what a soft-deleted object will NOT tell you. GCS keeps a deleted object's
METADATA and refuses its DATA -- a read with `softDeleted=true&alt=media` answers 400, verified
against the live bucket -- so a recycle bin cannot open a document to find out whose it was.

They are written on the way OUT rather than on every write, and that placement is deliberate. The
write path carries the compare-and-swap that makes concurrent writers loud (B6), and moving it to a
multipart upload to attach metadata would put the system's most load-bearing call at risk for a
field only a deletion ever reads. A delete is rare, already does two round trips, and is the exact
moment the store still knows whose diagram it is.

`null` is not `[]`, and the difference is the whole point. An empty array says "nothing is
recoverable right now"; null says "this backend has no recycle bin at all", which is true of a
filesystem and false of a bucket with soft-delete configured. Collapsing them would let the product
tell a person their work is unrecoverable when the real answer is that nobody looked.

Every verb is ASYNC, including the filesystem one that has no need to be (B59). The seam shipped
synchronous, which quietly excluded the backend it was built for: there is no synchronous HTTP, so
`read(name) -> string` is unsatisfiable over GCS. A seam whose contract only the incumbent can meet
is not a seam. The filesystem implementation stays `*Sync` underneath because that is genuinely the
cheapest correct thing on a local disk -- what changed is the CONTRACT, not its cost here.

What this deliberately does NOT cover is `examples/`. That corpus is read-only content baked into
the image, and it is read straight from disk in every deployment -- only the mutable store moves.
*/

import fs from 'node:fs';
import path from 'node:path';

/*
The filesystem implementation, and the default.

Atomicity is write-then-rename, because `rename(2)` is atomic within a filesystem: a reader either
sees the old inode or the new one. That is exactly the property an object store provides for free on
a single PUT, and exactly the property a `gcsfuse` mount does NOT provide, since it emulates rename
as copy-then-delete -- which is why the cloud backend is an adapter rather than a mount (DEPLOY.md).
*/
export function fsFiles(dir) {
	fs.mkdirSync(dir, { recursive: true });
	const at = (name) => path.join(dir, name);
	return {
		async list() {
			return fs.readdirSync(dir);
		},
		async read(name) {
			return fs.readFileSync(at(name), 'utf8');
		},
		async write(name, text) {
			const file = at(name);
			const tmp = `${file}.tmp`;
			fs.writeFileSync(tmp, text);
			fs.renameSync(tmp, file);
		},
		// `tags` are accepted and dropped: there is no window for them to survive into
		async remove(name) {
			// `force` makes absence success rather than an error, which is what idempotent means
			// here: delete is called on a best-effort basis and must not throw on a second attempt.
			fs.rmSync(at(name), { force: true });
			// the write-then-rename above can leave this behind if the process died between the two
			fs.rmSync(`${at(name)}.tmp`, { force: true });
		},
		/*
		A filesystem has no delete window, and says so rather than pretending it is empty.

		`rmSync` is final here. Answering `[]` would be a claim that nothing is recoverable, which
		reads as reassurance; `null` is the honest answer -- there is nowhere for a deleted document
		to be. The product can then say "not on this deployment" instead of "nothing to restore".
		*/
		async recoverable() { return null; },
		async restore() { throw new Error('this backend has no delete window: a removed file is gone'); },
	};
}

/*
============================================================================================
The GCS implementation -- B6.

Raw `fetch` against the JSON API, not `@google-cloud/storage`. The SDK is 60 packages and 18MB
against 1 package and 212KB for what this needs (DEPLOY.md); four verbs over four endpoints does
not justify the dependency, and a cold start pays for every megabyte.

It is an ADAPTER rather than a `gcsfuse` mount because the mount cannot honour the contract above.
`fsFiles` gets atomicity from `rename(2)`; gcsfuse emulates rename as copy-then-delete, so a reader
CAN observe a splice. An object store gives that property for free on a single PUT, which is the
same property by a different route -- so the seam is satisfied natively and the mount is what would
have broken it.

This is what answers B6. There is no `fsync` here and none is wanted: durability stops being this
process's problem and becomes the object store's, which is the whole reason the revival trigger
named a GCS-backed deployment.

Two things are injectable because neither exists off-GCP: `fetch` and the token source. Without that
the adapter could only ever be exercised in the one environment where it is hardest to test.
*/

const GCS_API = 'https://storage.googleapis.com/storage/v1/b';
const GCS_UPLOAD = 'https://storage.googleapis.com/upload/storage/v1/b';
const METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

// 429 and 503 are GCS telling us to come back; 500/502/504 are it failing in a way that is usually
// transient. Anything else is our fault and retrying just makes the same mistake more often.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/*
The instance's own service-account token, cached until it nearly expires.

Fetched once per hour or so in practice. The 60-second margin exists because a token that expires
in flight fails the request that is carrying it, and the retry would be indistinguishable from a
real 401 -- so the margin is what keeps an expiry from being misread as a permission problem.
*/
export function metadataToken({ fetch: f = globalThis.fetch, now = Date.now } = {}) {
	let cached = null;   // { token, expiresAt }
	return async () => {
		if (cached && now() < cached.expiresAt) return cached.token;
		let res;
		try {
			res = await f(METADATA_TOKEN, { headers: { 'Metadata-Flavor': 'Google' } });
		} catch (err) {
			/*
			`fetch` reports this as "TypeError: fetch failed" with the real reason two `cause` levels
			down, so off-GCP the operator gets a wall of undici internals for what is actually a
			one-sentence configuration mistake. Name it instead.
			*/
			const cause = err?.cause?.code || err?.cause?.message || err.message;
			if (cause === 'ENOTFOUND' || cause === 'EHOSTUNREACH' || cause === 'ECONNREFUSED') {
				throw new Error(
					'BUCKET is set, which selects GCS, but the metadata server is unreachable '
					+ `(${cause} ${new URL(METADATA_TOKEN).host}) -- this process is not running on Google Cloud. `
					+ 'Unset BUCKET to persist to the local filesystem instead.');
			}
			throw new Error(`could not reach the metadata server for a token: ${cause}`);
		}
		if (!res.ok) throw new Error(`metadata server refused a token: ${res.status}`);
		const body = await res.json();
		if (!body.access_token) throw new Error('metadata server returned no access_token');
		cached = { token: body.access_token, expiresAt: now() + Math.max(0, (body.expires_in || 0) - 60) * 1000 };
		return cached.token;
	};
}

export function gcsFiles(bucket, {
	fetch: f = globalThis.fetch,
	token = metadataToken({ fetch: f }),
	retries = 4,
	backoffMs = 200,
	sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
	if (!bucket) throw new Error('gcsFiles requires a bucket name');

	/*
	Generations, remembered per object, so a write can be a compare-and-swap.

	Cloud Run is pinned to one instance, so in the intended configuration nothing else is writing
	and this never fires. That is exactly why it is here: the failure it catches is a
	misconfiguration -- a second instance, a stray local process against the same bucket -- and
	those are the cases where a last-write-wins PUT silently destroys someone's work. A 412 is
	loud, and loud is the point.
	*/
	const generations = new Map();

	async function call(url, init = {}, { retryable = true } = {}) {
		let attempt = 0;
		for (;;) {
			const res = await f(url, {
				...init,
				headers: { ...(init.headers || {}), Authorization: `Bearer ${await token()}` },
			});
			if (res.ok || !retryable || !RETRYABLE.has(res.status) || attempt >= retries) return res;
			// full jitter: a fleet retrying in lockstep is how a recoverable blip becomes an outage
			const wait = Math.random() * backoffMs * 2 ** attempt;
			attempt++;
			await sleep(wait);
		}
	}

	const objectUrl = (name) => `${GCS_API}/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}`;

	return {
		/*
		Every object name in the bucket, following pagination.

		The page loop is not optional at any realistic size: GCS caps a page at 1000 and returns a
		token, and a caller that reads only the first page loses documents silently rather than
		loudly -- the worst shape a bug can take in a boot path that decides what exists.
		*/
		async list() {
			const names = [];
			let pageToken;
			do {
				const q = new URLSearchParams({ fields: 'items(name,generation),nextPageToken' });
				if (pageToken) q.set('pageToken', pageToken);
				const res = await call(`${GCS_API}/${encodeURIComponent(bucket)}/o?${q}`);
				if (!res.ok) throw new Error(`gcs list failed: ${res.status} ${await res.text()}`);
				const body = await res.json();
				// an empty bucket omits `items` entirely rather than sending []
				for (const it of body.items || []) {
					names.push(it.name);
					generations.set(it.name, it.generation);
				}
				pageToken = body.nextPageToken;
			} while (pageToken);
			return names;
		},

		async read(name) {
			const res = await call(`${objectUrl(name)}?alt=media`);
			if (res.status === 404) throw new Error(`no such object: ${name}`);
			if (!res.ok) throw new Error(`gcs read failed for ${name}: ${res.status}`);
			const gen = res.headers.get('x-goog-generation');
			if (gen) generations.set(name, gen);
			return res.text();
		},

		/*
		A single PUT, conditional on the generation we last saw.

		`ifGenerationMatch=0` means "only if this does not exist", which is the right precondition
		for a name we have never seen: if it turns out to exist, something else created it and we
		must not overwrite it blind.
		*/
		async write(name, text) {
			const expected = generations.get(name) ?? '0';
			const q = new URLSearchParams({ uploadType: 'media', name, ifGenerationMatch: expected });
			const res = await call(`${GCS_UPLOAD}/${encodeURIComponent(bucket)}/o?${q}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: text,
			});
			if (res.status === 412) {
				// deliberately NOT self-healing. Re-reading the generation and retrying would turn a
				// detected concurrent writer into a silent overwrite, which is the exact loss the
				// precondition exists to prevent. The store counts this and /health goes degraded.
				throw new Error(`gcs write conflict for ${name}: another writer holds a newer generation (expected ${expected})`);
			}
			if (!res.ok) throw new Error(`gcs write failed for ${name}: ${res.status} ${await res.text()}`);
			const body = await res.json();
			if (body.generation) generations.set(name, body.generation);
		},

		async remove(name, tags = null) {
			/*
			Tag before deleting, so the soft-deleted generation carries who it belonged to.

			A metadata PATCH bumps the METAgeneration and leaves the data generation alone, so this
			does not disturb the compare-and-swap the write path depends on. Best-effort: failing to
			label a deletion must never stop the deletion, and an untagged entry is simply one the
			recycle bin cannot attribute.
			*/
			if (tags) {
				try {
					await call(objectUrl(name), {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ metadata: tags }),
					});
				} catch (err) {
					console.warn(`[ gcs ] could not tag ${name} before delete: ${err.message}`);
				}
			}
			const res = await call(objectUrl(name), { method: 'DELETE' });
			// absent is success -- the seam promises idempotence and delete is best-effort
			if (res.status === 404 || res.ok) { generations.delete(name); return; }
			throw new Error(`gcs remove failed for ${name}: ${res.status}`);
		},

		/*
		What is inside the soft-delete window -- B109.

		A DELETE against a bucket with soft-delete configured does not destroy the object; it keeps
		the generation, marks it, and purges it when the retention lapses. `gs://diagrams.apnex.io`
		carries 604800s, so seven days of deletions are sitting there and nothing in the product has
		ever said so -- which makes `DELETE` feel more final than it is and a mistake feel
		unrecoverable when it is not.

		`softDeleteTime` and `hardDeleteTime` both come back, and BOTH are reported. The first says
		when it went; only the second answers the question a person actually has, which is how long
		they have to decide.

		A bucket with soft-delete OFF answers 200 with no items, which is indistinguishable from a
		window that happens to be empty. That is fine and deliberately not special-cased: with no
		policy nothing can ever appear here, so "nothing recoverable" is a true statement either way.
		The `null` case is reserved for a backend with no window AT ALL, which is the filesystem.
		*/
		async recoverable() {
			const out = [];
			let pageToken;
			do {
				const q = new URLSearchParams({ softDeleted: 'true',
					fields: 'items(name,generation,softDeleteTime,hardDeleteTime,metadata),nextPageToken' });
				if (pageToken) q.set('pageToken', pageToken);
				const res = await call(`${GCS_API}/${encodeURIComponent(bucket)}/o?${q}`);
				if (!res.ok) throw new Error(`gcs recoverable failed: ${res.status} ${await res.text()}`);
				const body = await res.json();
				for (const it of body.items || []) {
					out.push({ name: it.name, generation: it.generation, tags: it.metadata || null,
						deletedAt: it.softDeleteTime || null, purgeAt: it.hardDeleteTime || null });
				}
				pageToken = body.nextPageToken;
			} while (pageToken);
			return out;
		},

		/*
		Bring one back. The generation is not optional: soft-delete keeps a specific version, and
		restoring without naming which one is a request the API cannot answer.
		*/
		async restore(name, generation) {
			if (!generation) throw new Error(`restore needs the generation of ${name}`);
			const res = await call(`${objectUrl(name)}/restore?generation=${encodeURIComponent(generation)}`,
				{ method: 'POST' });
			if (!res.ok) throw new Error(`gcs restore failed for ${name}: ${res.status} ${await res.text()}`);
			const body = await res.json().catch(() => ({}));
			if (body.generation) generations.set(name, body.generation);
		},
	};
}
