/*
Store — owns every diagram: an in-memory Model per diagram id, persisted to
<dataDir>/<id>.json with a debounced flush (prism's metabolic pulse, repurposed
as a disk-write batcher). The store is the single mutation entry point on the
server; everything is validated before it touches a model.
*/

import fs from 'node:fs';
import path from 'node:path';
import { Model, newId, NODE_EXT, ZONE_EXT } from '../model/index.mjs';
import { seedDoc } from './seed.js';
import { validateMutation, validateDoc, validateSelectionIds, validPrincipal } from './validate.js';
import crypto from 'node:crypto';
import { STD } from '../kernel/index.mjs';

// the grid's own pitch, sourced not restated -- a speed in CELLS is meaningless without it
const PITCH = STD.pitch;
import { mintCode, formatCode, hashCode } from './codes.mjs';
import { groupAfterRemoval } from '../engine/index.mjs';
import { violations } from '../model/invariants.mjs';
import { commit as txnCommit, undo as txnUndo, redo as txnRedo, plan } from './txn.mjs';
import { Log } from './log.mjs';
import { serialize, parse } from './docfile.mjs';
import { fsFiles } from './files.mjs';
import { NAME_MAX } from '../model/limits.mjs';   // truncates where validate.js rejects (B86)

const FLUSH_MS = 200;

// The store's own filename rule. ONE definition: the boot loader and the example seeder must agree
// on what counts as a diagram file, or a name one accepts and the other ignores becomes a file that
// exists but is never loaded. tools/migrate-version.mjs deliberately re-states it rather than
// importing it — a migration must select by the rule as it was, not as it may later become.
const FILE = /^diagram-[0-9a-f]{6}\.json$/;
/*
H9.4c: workspace grants live in their own object, not in any diagram.

A workspace is the SET OF DIAGRAMS OWNED BY A PRINCIPAL, so a grant naming an owner cannot live in
a diagram -- it is about all of them, including ones not created yet, which is the whole point:
per-diagram grants put a person in the loop for every diagram an agent makes.

The name deliberately does not match `FILE`, so `init()` will not try to parse it as a diagram, and
it does not collide with the Google credential files that share the data dir (`google-*.json`).
*/
const ACCESS_FILE = 'access.json';
// H9.5: the third kind of persisted thing, after diagrams and access.json. ACCESS.md called a
// second kind "the one genuinely new piece of structure"; H9.4c paid that cost, so this follows an
// established pattern. Named outside the FILE regex, like access.json, so init() will not parse it.
const CODES_FILE = 'codes.json';
/*
B98/H9.21: a bound on the STORE, which `MAX_COLLECTION` is not -- that one is per kind per diagram
and says so. No such bound was needed while creating required a person pressing a button or holding
a websocket open, because both are paced by a human. `POST /api/v1/diagrams` is not: a retry loop
around a call that looked like it failed creates diagrams as fast as the backend accepts writes.

The cost is not mainly storage. `init()` reads and validates every diagram at boot, so an unbounded
store becomes a slow boot and then a failed one, on a service running at minScale=1 where that is
an outage rather than a degradation.

Generous by intent. This is a runaway guard, not a quota: it should be invisible to any real use and
present for the case where something is looping. Configurable because the right number depends on a
deployment nobody here can see.
*/
const MAX_DIAGRAMS = Number(process.env.MAX_DIAGRAMS) || 500;

/*
B158 -- and a PER-PRINCIPAL cap, which is a different instrument from the one above.

`MAX_DIAGRAMS` is a runaway guard and says so. It is also GLOBAL, and a global counter is a shared
resource: one principal filling it locks out every other, including the owner. That does not matter
while sign-in is restricted to a domain whose members are all trusted. It matters the moment
`ALLOW_DOMAINS` widens, because `create` gates on holding an identity and nothing else -- so anyone
who can sign in can consume the ceiling everyone else depends on.

Confidentiality is NOT the exposure. Grants default-deny, so a stranger signs in and sees an empty
list. What they can do is exhaust a number, which is a denial of service against the owner's own
data rather than a leak.

ONE RULE FOR EVERYONE, with no owner exemption, ruled 2026-08-27. An exemption would need a second
concept of privilege in a file that has exactly one -- ownership of a diagram -- and the owner can
raise the number instead, which is a decision they can see rather than one baked in here.
*/
const MAX_PER_PRINCIPAL = Number(process.env.MAX_PER_PRINCIPAL) || 20;

// The document generation. `meta.grid` was accidentally serving this role — a doc without it was
// a pre-center-origin file — and dropping grid without a replacement would leave the format with
// no discriminator at all for the next migration (D8).
const SCHEMA = 1;

// rebuild meta from whitelisted fields only — never persist junk keys
/*
Rebuild meta from an allowlist, so an unknown or hostile key cannot ride in on a document.

`trusted` says the document came off our own storage rather than off the wire, and it gates
authorization only. Without it, `create {doc:{meta:{owner:...}}}` would let a caller install
itself as owner of the diagram it is creating -- the keys validate, so nothing else would stop
it. Owner and grants are established by `setOwner` and `grant`, never by presenting a document
that claims them (ACCESS.md).
*/
/*
Slides Phase 2 -- retired keys are removed BEFORE validation, not tolerated by it.

The schema is now pure: `validateDoc` refuses `meta.slides`, because the feature is gone and a
validator that still knows the name of a deleted thing is carrying it. But validation runs on the
raw file, so refusing there alone would make every document written before the purge unloadable --
including a backup taken last week. Stripping first gives both: a strict schema, and old data that
still opens once and is written back clean.

One key today. If a second is ever retired it joins this list, and the list is the whole record of
what the loader forgives.
*/
/*
B184 -- how many recent commit ids a diagram remembers, so a replay is recognised as one.

Counted rather than timed. 200 is generous against any burst a real client produces and trivial in
memory, and it states the limitation plainly: a client that reconnects more than 200 commits behind
has its replay treated as new work.
*/
const SEEN_MAX = 200;

const RETIRED_META = ['slides'];

function shedRetired(doc) {
	if (!doc || typeof doc !== 'object' || !doc.meta) return false;
	let shed = false;
	for (const key of RETIRED_META) {
		if (key in doc.meta) { delete doc.meta[key]; shed = true; }
	}
	return migrateSpawn(doc) || shed;
}

/*
B172 -- a spawner's stored shape changed twice, and old documents must still open.

The first `spawn` carried `colour` as a hex string and `speed` in PIXELS per second. Both were
wrong for the same reason: a hex per spawner meant changing the look required rewriting every
document that had one -- three repaints proved it -- and pixels contradict this tree's own rule that
positions are anchors and never pixels (B110), so a stored speed silently changes meaning if the
pitch ever moves.

Now: `kind` names a class the stylesheet owns, and `speed` is CELLS per second.

STRIPPED AND CONVERTED HERE, BEFORE VALIDATION, exactly as the retired meta key above is. The
validator is strict -- `spawn` is whole-or-absent and refuses an unknown key -- so a document
carrying the old shape would be REFUSED at load, and a refused document is SKIPPED. That is not a
migration failing loudly; it is a diagram disappearing from the list. The one already armed on
production would have been the first casualty.

Keyed on `colour` rather than on a guess about the magnitude of `speed`. A heuristic like "a value
above 20 must be pixels" would mis-convert the first person who wants a genuinely fast mover.
*/
function migrateSpawn(doc) {
	let moved = false;
	for (const w of doc.waypoints || []) {
		if (!w.spawn || typeof w.spawn !== 'object') continue;
		if (!('colour' in w.spawn)) continue;              // already the new shape
		delete w.spawn.colour;
		w.spawn.kind = 'packet';
		if (typeof w.spawn.speed === 'number') w.spawn.speed = Math.round((w.spawn.speed / PITCH) * 100) / 100;
		moved = true;
	}
	return moved;
}

/*
Slides Phase 1: `meta.slides` is DROPPED here, which is how the estate sheds it.

This function rebuilds meta from a stored document on every load, so omitting the key means a
document loses it the first time it is read and is written back without it at the next flush. No
migration tool, no separate pass.

It must stay TOLERATED by `validateDoc` until that has happened everywhere. Validation runs on the
raw file (`:147`, `:445`) BEFORE this function sees it, so removing the key from the allow-list now
would refuse every stored diagram at boot -- which is B110's trap, avoided there by migrating first
and avoided here by stripping on read. Phase 2 removes it from the validator once nothing carries it.
*/
function cleanMeta(id, meta = {}, trusted = false) {
	const str = (v) => typeof v === 'string' ? v.slice(0, 512) : '';
	const grants = {};
	if (trusted && meta.grants && typeof meta.grants === 'object' && !Array.isArray(meta.grants)) {
		for (const [principal, level] of Object.entries(meta.grants)) {
			if (level === 'read' || level === 'write') grants[str(principal)] = level;
		}
	}
	return {
		id,
		name: String(meta.name || 'untitled').slice(0, NAME_MAX),
		version: Number.isInteger(meta.version) && meta.version >= 0 ? meta.version : 0,
		schema: SCHEMA,
		owner: trusted ? str(meta.owner) : '',
		grants,
	};
}




export class Store {
	/*
	`examplesDir` is INJECTED, never discovered. A store that went looking for a sibling directory
	would seed differently depending on where it was constructed from, which is the kind of
	implicit dependency that makes a test pass for a reason nobody chose. The composition root
	(server/server.js) decides; every other caller — including every test that is not about seeding
	— gets the single programmatic example and is unaffected by whatever ships in examples/.
	*/
	constructor(dataDir, { flushMs = FLUSH_MS, files = null, now = Date.now, onLostAuthority = null, examplesDir = null, templatesDir = null, authz = true } = {}) {
		/*
		Authorization is OFF unless asked for -- ACCESS.md.

		Filtering by grant is meaningless without an identity, and there is no identity unless IAP
		is configured, so a store that enforced unconditionally would make every local run empty.
		The dangerous combination is production WITHOUT it, and that is refused at boot in
		`server.js` rather than defaulted to here: a silent fallback to open is precisely the
		failure this whole milestone exists to prevent.
		*/
		this.authz = authz;
		// owner principal -> { grantee principal: 'read' | 'write' }. Empty until access.json says
		// otherwise; `init()` is the only thing that fills it from disk.
		this.workspace = new Map();
		// hash -> { id, agent, by, created, expires }. The plaintext is never here: it exists once, in
		// the response to the mint that made it, and nowhere afterwards.
		this.codes = new Map();
		// agent name -> { by, claimed }. Separate from `codes` because revoking every code must NOT
		// release the name -- releasing on revocation would let an attacker acquire it by waiting (B99).
		this.agents = new Map();
		this.dir = dataDir;
		this.flushMs = flushMs;
		/*
		B178 -- what to do on PROOF that another writer owns a document.

		Injected rather than reached for, because the store must not know what a session is. It
		reports the loss; whoever owns the sessions decides that means retiring them.
		*/
		this.onLostAuthority = onLostAuthority;
		this.lost = new Set();      // diagrams this instance has stopped claiming to own
		this.now = now;
		this.examplesDir = examplesDir;
		this.templatesDir = templatesDir;
		// id -> Model. Read from the image at boot, never written, listed to everyone (H9.9).
		this.templates = new Map();
		// B55 -- the WHOLE persistence surface, injectable. Was `writeDoc` alone, which left boot's
		// list and read, and delete's three removals, reaching `fs` directly: a backend that is not
		// a filesystem could not be supplied at all. Four verbs over names, never paths.
		this.files = files || fsFiles(dataDir);
		this.diagrams = new Map(); // id -> { model, log, dirty, timer, file }
	}

	async init() {
		let candidates = 0;   // the backend created its own storage when it was constructed
		const failures = [];
		// the data dir is shared with Google OAuth credential/token files:
		// only diagram-named json is ours to parse
		for (const file of await this.files.list()) {
			if (!FILE.test(file)) continue;
			candidates++;
			try {
				const { doc, log } = parse(await this.files.read(file));
				const shed = shedRetired(doc);
				const err = validateDoc(doc);
				if (err) {
					failures.push(`${file}: ${err}`);
					console.warn(`[ store ] skipping ${file}: ${err}`);
					continue;
				}
				if (this.diagrams.has(doc.meta.id)) {
					failures.push(`${file}: duplicate id ${doc.meta.id}`);
					console.warn(`[ store ] skipping ${file}: duplicate id ${doc.meta.id}`);
					continue;
				}
				if (file !== `${doc.meta.id}.json`) {
					console.warn(`[ store ] ${file}: filename does not match meta.id ${doc.meta.id}`);
				}
				// the doc's own version is the fallback: a file whose log block is absent or
				// unreadable still knows which version it is (CS5 stamps it into meta).
				this.install(doc.meta.id, doc, Log.from(log, doc.meta.version), file);
				// only the filename-canonicalisation case dirties on boot; a clean load rewrites nothing
				// a filename that does not match, or a retired key removed above: either way the file
				// on disk is not what we now hold, so write it back once (Slides Phase 2)
				if (shed || file !== `${doc.meta.id}.json`) this.markDirty(doc.meta.id);
			} catch (e) {
				failures.push(`${file}: ${e.message}`);
				console.warn(`[ store ] skipping ${file}: ${e.message}`);
			}
		}
		// D17/GR8: a data dir whose every candidate file failed is a broken deployment, not an empty
		// one. Seeding there fabricates a plausible, complete, WRONG store and answers /health 200.
		if (candidates > 0 && this.diagrams.size === 0) {
			for (const why of failures) console.error(`[ store ] ${why}`);
			throw new Error(`refusing to boot: ${candidates} diagram file(s) present, none loaded`);
		}
		/*
		H9.9: an EMPTY store is legitimate once templates exist, so the seed only runs without them.

		The seed existed because a store with nothing in it gave a client nothing to open. Templates
		are listed to every principal and forked on first write, so the listing is never empty even
		when the store is -- and seeding on top of them produced two entries called `example`, one
		real and one a template, which is worse than either alone.
		*/
		this.#loadTemplates();
		if (this.diagrams.size === 0 && this.templates.size === 0) this.seed();
		await this.#loadAccess();
		await this.#loadCodes();
		console.log(`[ store ] ${this.diagrams.size} diagram(s) in ${this.dir}`);
	}

	/*
	Workspace grants, off the same backend as everything else -- H9.4c.

	ABSENT is normal and means nobody has been granted a workspace: first boot, and every
	deployment that has not used the feature. CORRUPT is a boot refusal, matching D17/GR8. The
	reasoning is the same as it is for a diagram: a file we cannot read means we do not know who may
	reach what, and serving anyway produces a plausible, complete and WRONG answer to the only
	question authorization asks. Dropping the grants instead would be quieter and worse -- agents
	would lose access with no event to point at.

	Validated on the way in for the same reason `validateDoc` is: this file is written by us, so a
	malformed entry means something upstream is broken, and inventing a reading of it would hide
	that. A level that is not read or write is not narrowed to read; it is refused.
	*/
	/*
	The read half both side files share -- H9.5. Absent is normal and answers null; unreadable is a
	boot refusal, matching D17/GR8, because a file we cannot parse means we do not know who may
	reach what or who holds which credential, and serving anyway is the plausible-complete-and-wrong
	state. The SHAPE validation is not shared: access.json and codes.json disagree about their
	contents, and a single validator covering both would be looser than either needs.
	*/
	async #readBeside(file) {
		let raw;
		try { raw = await this.files.read(file); }
		catch { return null; }                             // absent, which is the ordinary first boot
		let parsed;
		try { parsed = JSON.parse(raw); }
		catch (e) { throw new Error(`refusing to boot: ${file} is not readable JSON -- ${e.message}`); }
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error(`refusing to boot: ${file} is not an object`);
		}
		return parsed;
	}

	async #loadAccess() {
		const parsed = await this.#readBeside(ACCESS_FILE);
		if (!parsed) return;
		const loaded = new Map();
		for (const [owner, grants] of Object.entries(parsed)) {
			if (!validPrincipal(owner)) throw new Error(`refusing to boot: ${ACCESS_FILE} names an invalid owner: ${owner}`);
			if (!grants || typeof grants !== 'object' || Array.isArray(grants)) {
				throw new Error(`refusing to boot: ${ACCESS_FILE} entry for ${owner} is not an object`);
			}
			const clean = {};
			for (const [who, level] of Object.entries(grants)) {
				if (!validPrincipal(who)) throw new Error(`refusing to boot: ${ACCESS_FILE} names an invalid principal: ${who}`);
				if (level !== 'read' && level !== 'write') {
					throw new Error(`refusing to boot: ${ACCESS_FILE} gives ${who} an invalid level: ${level}`);
				}
				clean[who] = level;
			}
			loaded.set(owner, clean);
		}
		this.workspace = loaded;
		const n = [...loaded.values()].reduce((a, g) => a + Object.keys(g).length, 0);
		if (n) console.log(`[ store ] ${n} workspace grant(s) across ${loaded.size} owner(s)`);
	}

	/*
	Connection codes -- H9.5. Two maps, because they have different lifetimes.

	`codes` is hash -> record; the plaintext exists once, in the response to the mint that made it.
	`agents` is the CLAIM: which principal owns a given agent name. Kept separate so that revoking
	every code leaves the name held, since releasing it on revocation would let an attacker acquire
	somebody else's agent identity by waiting for their last code to lapse (B99).
	*/
	async #loadCodes() {
		const parsed = await this.#readBeside(CODES_FILE);
		if (!parsed) return;
		const agents = new Map();
		for (const [name, rec] of Object.entries(parsed.agents || {})) {
			if (!validPrincipal(name) || !name.startsWith('agent:')) {
				throw new Error(`refusing to boot: ${CODES_FILE} claims an invalid agent: ${name}`);
			}
			if (!rec || !validPrincipal(rec.by)) {
				throw new Error(`refusing to boot: ${CODES_FILE} claim for ${name} names no valid principal`);
			}
			agents.set(name, { by: rec.by, claimed: String(rec.claimed || '') });
		}
		const codes = new Map();
		for (const [hash, rec] of Object.entries(parsed.codes || {})) {
			if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error(`refusing to boot: ${CODES_FILE} has a malformed hash`);
			if (!rec || !agents.has(rec.agent)) {
				throw new Error(`refusing to boot: ${CODES_FILE} has a code for unclaimed agent ${rec && rec.agent}`);
			}
			codes.set(hash, { id: String(rec.id || ''), agent: rec.agent, created: String(rec.created || ''),
				expires: rec.expires ? String(rec.expires) : null });
		}
		this.agents = agents;
		this.codes = codes;
		if (codes.size) console.log(`[ store ] ${codes.size} connection code(s) for ${agents.size} agent(s)`);
	}

	async #writeCodes(agents, codes) {
		const body = { agents: {}, codes: {} };
		for (const [name, rec] of agents) body.agents[name] = rec;
		for (const [hash, rec] of codes) body.codes[hash] = rec;
		await this.files.write(CODES_FILE, `${JSON.stringify(body, null, '\t')}\n`);
		this.agents = agents;
		this.codes = codes;
	}

	/*
	Verify a presented code -- H9.6. Deferred from H9.5 deliberately: scan-dead refuses a method
	nothing calls, so it lands with the identity source that consumes it rather than before.

	Constant work regardless of how many codes exist, and no prefix or public identifier: the
	presented value is hashed and looked up. ACCESS.md considered a lookup id and rejected it as
	solving a problem this deployment does not have, and a prefix would eat the entropy budget.

	Expiry is checked here rather than swept, so a lapsed code stops working at the instant it
	lapses even if nothing has pruned it. A code whose agent lost its claim cannot occur -- the
	loader refuses that file -- but the claim is re-checked anyway, because authentication handing
	back an identity nobody owns is the failure this whole area exists to prevent.
	*/
	agentForCode(presented) {
		const rec = this.codes.get(hashCode(presented));
		if (!rec) return null;
		if (rec.expires && Date.parse(rec.expires) <= this.now()) return null;
		return this.claimantOf(rec.agent) ? rec.agent : null;
	}

	claimantOf(agent) {
		return this.agents.get(agent)?.by || null;
	}

	/*
	B100 -- who OWNS what a principal creates. An agent's work belongs to whoever authorised it.

	An agent is not a party, it is a credential held on behalf of a claimant, so what it makes is
	the claimant's. Without this, an agent-created diagram is owned by `agent:<name>` with no
	grants: the human who authorised the agent cannot list it, read it or render it, and the work
	is unreachable in a bucket they own. ACCESS.md required access in both directions and only the
	human-to-agent half was ever built.

	Ownership rather than a reciprocal grant, ruled 2026-08-23. A grant would have left the AGENT
	as owner and so in control of the diagram's access list -- the human could not have granted
	anyone else, and could not have revoked the agent from it. That is the instrument outranking
	the person who authorised it.

	Never null for an authenticated agent: `agentForCode` refuses a code whose agent has no live
	claim, so an `agent:` principal cannot reach this without one.
	*/
	ownerFor(principal) {
		if (!principal) return null;
		return this.claimantOf(principal) || principal;
	}

	// metadata only, and never the hash: a caller has no use for it and it is the lookup key
	listCodes(by) {
		return [...this.codes.values()]
			.filter((c) => this.claimantOf(c.agent) === by)
			.map(({ id, agent, created, expires }) => ({ id, agent, created, expires }));
	}

	/*
	Mint. The plaintext is returned here and never stored, which is what "shown once" means.

	The claim rule is B99: the first mint takes the name for its minter, and afterwards only that
	principal may mint against it. Without it, an agent name is global and the second person to mint
	against `agent:planner` obtains a credential authenticating as the identity the first granted
	access to -- an escalation needing no defect in any check, only the absence of this rule.
	*/
	async mintCode(agent, by, { expires = null } = {}) {
		if (!validPrincipal(agent) || !agent.startsWith('agent:')) return { ok: false, error: `not an agent identity: ${agent}` };
		if (!validPrincipal(by)) return { ok: false, error: `invalid principal: ${by}` };
		const held = this.claimantOf(agent);
		if (held && held !== by) return { ok: false, error: `${agent} is claimed by another principal`, forbidden: true };
		if (expires !== null && Number.isNaN(Date.parse(expires))) return { ok: false, error: `invalid expiry: ${expires}` };

		const plaintext = mintCode();
		const agents = new Map(this.agents);
		if (!held) agents.set(agent, { by, claimed: new Date(this.now()).toISOString() });
		const codes = new Map(this.codes);
		const id = crypto.randomUUID().slice(0, 8);
		codes.set(hashCode(plaintext), { id, agent, created: new Date(this.now()).toISOString(), expires });
		await this.#writeCodes(agents, codes);
		return { ok: true, id, agent, code: formatCode(plaintext) };
	}

	// revoking is per code, so rotation is mint-then-revoke and needs no window with no valid code
	async revokeCode(id, by) {
		const found = [...this.codes].find(([, c]) => c.id === id);
		if (!found) return 'unknown code';
		if (this.claimantOf(found[1].agent) !== by) return 'only the claimant may revoke';
		const codes = new Map(this.codes);
		codes.delete(found[0]);
		await this.#writeCodes(new Map(this.agents), codes);
		return null;
	}

	// Written whole, and BEFORE the in-memory map is replaced. A revoke that reports success while
	// the file still says otherwise would come back at the next restart, so the durable copy is the
	// one that decides: if the write fails, nothing changed and the caller is told the truth.
	async #writeAccess(next) {
		const body = {};
		for (const [owner, grants] of next) if (Object.keys(grants).length) body[owner] = grants;
		await this.files.write(ACCESS_FILE, `${JSON.stringify(body, null, '\t')}\n`);
		this.workspace = next;
	}

	workspaceGrants(owner) {
		return { ...(this.workspace.get(owner) || {}) };
	}

	/*
	A workspace is administered by the principal who owns it and by nobody else, which is why there
	is no `by` argument: the caller IS the owner. That removes the question of who may grant on
	someone else's workspace by making it unrepresentable rather than by checking for it.
	*/
	async grantOwner(owner, principal, level) {
		if (!validPrincipal(owner)) return `invalid owner: ${owner}`;
		if (!validPrincipal(principal)) return `invalid principal: ${principal}`;
		if (level !== 'read' && level !== 'write') return `invalid level: ${level}`;
		if (principal === owner) return 'the owner already has full access';
		const next = new Map(this.workspace);
		next.set(owner, { ...(next.get(owner) || {}), [principal]: level });
		await this.#writeAccess(next);
		return null;
	}

	async revokeOwner(owner, principal) {
		if (!validPrincipal(owner)) return `invalid owner: ${owner}`;
		const next = new Map(this.workspace);
		const grants = { ...(next.get(owner) || {}) };
		delete grants[principal];                          // absent is success, as with diagram revoke
		next.set(owner, grants);
		await this.#writeAccess(next);
		return null;
	}

	// first boot (or last diagram deleted): the example topology, never an empty store
	/*
	`owner` is who caused the seed -- B131.

	A seed at BOOT has no principal and stays unowned, which is correct: the composition root
	adopts it for the deployment's OWNER two lines after `init()`. A seed caused by a REMOVE does
	have one, and leaving that unowned meant deleting your last diagram reseeded a document nobody
	could read -- the store dutifully refused to be empty and the refusal was invisible to the only
	person present. The invariant was satisfied and its purpose was not.

	Ownership stays a property of creation, which is where H9.30 put it, rather than becoming a
	second adoption path that would have to be remembered at every future creation site.
	*/
	seed(owner = null) {
		const fromExamples = this.#seedFromExamples(owner);
		if (fromExamples) return fromExamples;
		const doc = seedDoc();
		const entry = this.install(doc.meta.id, doc);
		// AFTER install, never before. `install` passes no `file` for a seed, so `cleanMeta` treats
		// the document as untrusted and drops `meta.owner` -- which is H9.1 doing its job: an owner
		// may not be smuggled in through a document. The first attempt at B131 wrote `doc.meta.owner`
		// and was silently discarded, which is exactly the outcome that guard exists to produce.
		if (owner) this.setOwner(doc.meta.id, owner);
		this.markDirty(doc.meta.id);   // a seeded doc has no file yet — this is a creation, not a reload
		return entry.model;
	}

	/*
	First boot with a corpus: copy examples/ into the data dir.

	The examples are tracked in git; the data dir is not (`.gitignore:4`), because the store
	REWRITES these files on every edit and a runtime directory under version control shows a diff
	every time anyone uses the app. On Cloud Run the data dir will be a mounted bucket, so the two
	were always different things — this only names the difference.

	TOLERATE-AND-DROP, and deliberately weaker than `init`'s rule: a malformed example is skipped
	with a warning rather than refusing the boot. `init` throws because a file it cannot read is
	the USER's data and losing it silently is unacceptable; an example is shipped content, and a
	bad one is a packaging bug that must not stop a first-time user from getting a working app.
	If NONE load, this returns null and the programmatic seed takes over — the store still never
	comes up empty.
	*/
	#seedFromExamples(owner = null) {
		if (!this.examplesDir || !fs.existsSync(this.examplesDir)) return null;
		let first = null;
		for (const file of fs.readdirSync(this.examplesDir).filter((f) => FILE.test(f)).sort()) {
			try {
				const { doc } = parse(fs.readFileSync(path.join(this.examplesDir, file), 'utf8'));
				shedRetired(doc);
				const err = validateDoc(doc);
				if (err) { console.warn(`[ store ] skipping example ${file}: ${err}`); continue; }
				if (this.diagrams.has(doc.meta.id)) continue;
				const entry = this.install(doc.meta.id, doc);
				if (owner) this.setOwner(doc.meta.id, owner);   // B131, and after install -- see seed()
				this.markDirty(doc.meta.id);          // no file in the DATA dir yet — this is a creation
				first = first || entry.model;
			} catch (e) {
				console.warn(`[ store ] skipping example ${file}: ${e.message}`);
			}
		}
		if (first) console.log(`[ store ] seeded ${this.diagrams.size} example diagram(s) from ${this.examplesDir}`);
		return first;
	}

	// The ONE whole-document entry: boot and create-with-content. Not a commit — it installs a
	// document wholesale rather than deriving it from ops, so it is the single allow-listed
	// model.load caller (GR3) and it replaces the Log in the same call.
	install(id, doc, log = new Log(0), file = null) {
		const model = new Model();
		model.load(doc);
		// `file` means this document came off our own storage, which is the only source allowed to
		// carry authorization -- init() passes it, create() does not (ACCESS.md).
		model.state.meta = cleanMeta(id, doc.meta, Boolean(file));
		// B15 — a diagram READ FROM a file is durable at the version that file carries; one being
		// created has nothing on disk yet and is durable at nothing. `file` is the discriminator:
		// init() passes the filename it loaded, create() does not.
		const entry = { model, log, dirty: false, timer: null, file: file || `${id}.json`,
			flushedVersion: file ? log.version : 0 };
		/*
		B83 -- document invariants get the surface the log invariant already has.

		`install` is the one choke point every whole-document path passes: `init` off disk,
		`create({doc})` off the wire, and the example seed. Each of them ran `validateDoc`, which
		checks shape and referential integrity, and none of them ran `violations()`, so a document
		carrying a cross-entity violation was admitted in silence and mentioned nowhere.

		REPORTED, never refused. `txn.mjs` deliberately admits an already-violating document so it
		can be repaired -- refusing here would brick exactly the files that most need opening, and
		would turn a diagnostic into a denial of service against the operator's own data. This is
		the treatment GR9 already gets a few methods below: count it, name it, and let `/health`
		distinguish `corrupt` from `degraded`.
		*/
		const broken = violations(model, { groupAfterRemoval });
		if (broken.length) {
			entry.invariantFailures = broken.length;
			console.error(`[ store ] ${id} loaded with ${broken.length} invariant violation(s): ${broken.join('; ')}`);
		}
		this.diagrams.set(id, entry);
		return entry;
	}

	// Create a diagram, optionally WITH content. The content path is what a client uses when it
	// has drawn something before the server answered: `create {name, doc}`. The id is minted here
	// and `doc.meta.id` is ignored (I11) — a client cannot name, and therefore cannot target, an
	// existing diagram. That targeting was B2. Returns { ok, model } | { ok:false, error }.
	// B65: the creator is the owner. The principal comes from the authentication boundary and
	// never from `doc.meta` -- `cleanMeta`'s trusted flag (H9.1) still refuses an owner off the
	// wire, so this is the only path by which ownership is established, and it cannot be forged.
	// Trailing and defaulted, matching the H9.3a convention, but here an un-updated caller yields
	// an UNOWNED diagram rather than a refused one, which is why both return paths set it.
	/*
	How many diagrams a principal owns.

	Counted, not tracked: a stored tally is a second source of truth that goes wrong on delete,
	restore and ownership adoption, and the store is already bounded by `MAX_DIAGRAMS`, so the walk
	is over hundreds at worst.

	Read through `ownerFor`, so an agent counts against the human who authorised it. The first
	version passed a DIAGRAM ID to `ownerFor`, which takes a PRINCIPAL and resolves it to its
	claimant -- it answered null for everything and the quota never fired. The name reads as though
	it means "the owner of this thing", and it does not.
	*/
	countOwnedBy(principal) {
		const owner = this.ownerFor(principal);
		if (!owner) return 0;
		let n = 0;
		for (const entry of this.diagrams.values()) {
			if (entry.model.state.meta.owner === owner) n++;
		}
		return n;
	}

	/*
	Fork a template into a real diagram owned by the caller.

	Content only: the new diagram takes the template's entities and its name, and nothing else. It
	is a `diagram-` id because it IS one now -- a fork is ordinary work from the moment it exists,
	and giving it any lingering template-ness would mean every path had to keep asking.

	`create` does the minting, ownership and quota, so a fork counts against MAX_PER_PRINCIPAL like
	anything else. A template is not a way around a quota.
	*/
	forkTemplate(templateId, principal) {
		const model = this.templates.get(templateId);
		if (!model) return { ok: false, error: `unknown template: ${templateId}` };
		if (this.authz && !principal) return { ok: false, error: 'forbidden: no identity', forbidden: true };
		const doc = model.toJSON();
		delete doc.meta;
		const made = this.create(model.state.meta.name, doc, principal);
		if (!made.ok) return made;
		return { ok: true, id: made.model.state.meta.id };
	}

	// `maxPerPrincipal` is an override for tests and for a caller that knows better than the
	// environment; unset means the deployment's number.
	create(name, doc = null, principal = null, { maxPerPrincipal = MAX_PER_PRINCIPAL } = {}) {
		// checked first, so a store at the cap writes nothing and mints no id
		/*
		THE GLOBAL CAP IS CHECKED FIRST, and the order is a decision rather than an accident.

		The first version asked the per-principal question first, reasoning that a caller over quota
		should not be told the service is full. That is right when only the quota is exceeded and
		wrong when both are: a full store refuses everyone, including a caller well under their
		quota, so "you own too many" would name a cause that is not the operative one and point at a
		remedy that may not clear it. Checked in this order each refusal states the binding
		constraint. `tests/access.test.js` B98 caught the inversion.
		*/
		if (this.diagrams.size >= MAX_DIAGRAMS) {
			return { ok: false, error: `diagram limit reached (${MAX_DIAGRAMS}) -- delete something, or raise MAX_DIAGRAMS` };
		}
		if (principal) {
			const owned = this.countOwnedBy(principal);
			if (owned >= maxPerPrincipal) {
				return { ok: false, error: `per-principal diagram limit reached (${owned}/${maxPerPrincipal}) -- delete one of yours, or raise MAX_PER_PRINCIPAL` };
			}
		}
		const taken = Object.fromEntries([...this.diagrams.keys()].map((k) => [k, true]));
		const id = newId('diagram', taken);
		if (!name) {
			// scan existing names: map size collides after deletes
			const names = new Set([...this.diagrams.values()].map((e) => e.model.state.meta.name));
			let n = 1;
			while (names.has(`diagram-${n}`)) n++;
			name = `diagram-${n}`;
		}
		if (doc !== null) {
			if (typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, error: 'doc is not an object' };
			// Validate the document as it will be INSTALLED, not as it arrived: the minted id and
			// the server-side name are substituted first, so validation cannot pass on a value the
			// store then discards. Nothing is installed unless it passes (I1, by purity).
			const candidate = { ...doc, meta: { ...doc.meta, id, name } };
			const err = validateDoc(candidate);
			if (err) return { ok: false, error: err };
			/*
			B25 — version is minted by the LOG and is never carried in from the wire.

			Validated AS IT ARRIVED, then installed at 0. The order is the point: a MALFORMED version
			must still be rejected at the boundary (D17 — a document that cannot be told apart from a
			valid one is refused, never repaired silently), while a well-formed but client-chosen one
			is simply ignored (I11). Forcing 0 before validation would have collapsed those two into
			"silently accept anything", which is how a trust boundary stops being one.

			Without this, `create {doc:{meta:{version:999}}}` installed a model claiming 999 against a
			fresh Log at 0 — two different numbers for one document until the first commit re-stamped
			it, breaking D6's one-source-one-mirror contract.
			*/
			const entry = this.install(id, { ...candidate, meta: { ...candidate.meta, version: 0 } });
			this.#attribute(entry.model, principal);
			this.markDirty(id);
			return { ok: true, model: entry.model };
		}
		const model = new Model();
		model.state.meta.id = id;
		model.state.meta.name = name;
		this.#attribute(model, principal);
		const entry = { model, log: new Log(0), dirty: false, timer: null, file: `${id}.json` };
		this.diagrams.set(id, entry);
		this.markDirty(id);
		return { ok: true, model };
	}

	/*
	B100 -- set the owner, and keep the creator able to reach what it just made.

	Both create paths go through here so they cannot disagree; the doc-carrying one used to set
	the owner on its own line and would have been the one to miss a change.

	The agent keeps an explicit write grant on its own work. Relying on the human's workspace grant
	instead would mean an agent holding a code but no workspace grant creates a diagram and loses
	it in the same call. The grant is ordinary, so the owner can revoke it like any other -- which
	is the whole point of the human holding ownership.
	*/
	#attribute(model, principal) {
		const owner = this.ownerFor(principal);
		if (!owner) return;
		model.state.meta.owner = owner;
		if (principal !== owner) model.state.meta.grants = { ...model.state.meta.grants, [principal]: 'write' };
	}

	/*
	Templates -- read from the image at boot, never written, listed to everyone (H9.9).

	A SEPARATE MAP from `diagrams`, which is the whole safety property. Templates cannot be written,
	deleted, granted or owned, and keeping them out of `this.diagrams` means every existing path
	that walks diagrams keeps its meaning without being told about templates. The paths that DO
	serve them say so explicitly, and `template-` in the id is what makes a missed one loud.

	Failure to load one is a warning and not a boot refusal, unlike a diagram: a diagram that will
	not parse is somebody's lost work, and a template that will not parse is a packaging mistake
	that costs a menu entry. The counts are logged so the difference is visible either way.
	*/
	#loadTemplates() {
		if (!this.templatesDir || !fs.existsSync(this.templatesDir)) return;
		let bad = 0;
		for (const file of fs.readdirSync(this.templatesDir).filter((f) => f.endsWith('.json')).sort()) {
			try {
				const doc = JSON.parse(fs.readFileSync(path.join(this.templatesDir, file), 'utf8'));
				const why = validateDoc(doc);
				if (why) throw new Error(why);
				if (!String(doc.meta.id).startsWith('template-')) throw new Error('not a template id');
				const model = new Model();
				model.load(doc);
				this.templates.set(doc.meta.id, model);
			} catch (err) {
				bad++;
				console.warn(`[ store ] template ${file} skipped: ${err.message}`);
			}
		}
		console.log(`[ store ] ${this.templates.size} template(s)${bad ? `, ${bad} skipped` : ''}`);
	}

	get(id) {
		const t = this.templates.get(id);
		if (t) return t;

		const entry = this.diagrams.get(id);
		return entry ? entry.model : null;
	}

	// B67: the first diagram THIS PRINCIPAL may read. It previously returned whichever entry the
	// Map happened to yield, which is how an unauthenticated `hello` was handed a document.
	first(principal = null) {
		for (const entry of this.diagrams.values()) {
			if (this.canRead(entry.model.state.meta.id, principal)) return entry.model;
		}
		/*
		H9.9 -- and a TEMPLATE when the caller owns nothing yet, which is the whole point of them.

		This walked `diagrams` alone, so a principal with none of their own got `null`, the session
		answered "no diagrams available", and the picker came up EMPTY while four templates sat right
		there. That is exactly the person templates exist for: someone signing in for the first time
		with nothing to open.

		Only for a principal, on the same reasoning as `canRead`: a caller who has not come through
		the door is offered nothing, not even a starting point.
		*/
		// the same condition the listing uses, not a second spelling of it: with authorization off
		// there are no principals at all, and offering nothing would leave a local run empty
		if (!this.authz || principal) for (const model of this.templates.values()) return model;
		return null;
	}

	/*
	How many documents this process holds, regardless of who is asking.

	Separate from `list()` on purpose. "What may this principal see" and "how much is this process
	holding" are different questions, and health asked the first one by accident -- with
	authorization on it passed no principal, filtered everything out, and reported zero diagrams
	forever while the store was full.
	*/
	total() {
		return this.diagrams.size;
	}

	/*
	The diagrams a principal may see, which with authorization off is all of them.

	Filtering here rather than at each call site is deliberate: `list` is the surface that tells a
	caller what exists, so a missed filter does not leak a document's contents but does leak that it
	exists and what it is called. One place to be right.
	*/
	list(principal = null) {
		const visible = this.authz
			? [...this.diagrams.values()].filter((e) => this.access(e.model.state.meta.id, principal))
			: [...this.diagrams.values()];
		/*
		Templates appear BESIDE a principal's own diagrams, never shadowing them (ruled H9.9).

		Shadowing -- hiding a template once you have forked it -- reads better in a sentence and is
		the wrong shape here: it makes the listing a MERGE of two sources rather than a query, and
		every listing defect this store has had came from exactly that. B130's `store.first()` with
		no principal, B115's pushed agent list going stale against the pulled one. A redundant row
		is a smaller cost than a listing assembled from two places that must agree.

		`template: true` is what lets a caller tell them apart without parsing the id, though the id
		carries it too.
		*/
		return [
			...visible.map((e) => ({
				id: e.model.state.meta.id,
				name: e.model.state.meta.name,
				version: e.model.state.meta.version,
			})),
			// and the same rule in the listing: a caller with no principal is not offered them, or the
			// names alone leak from behind a door they have not come through
			...(!this.authz || principal ? [...this.templates.values()] : []).map((m) => ({
				id: m.state.meta.id,
				name: m.state.meta.name,
				version: m.state.meta.version,
				template: true,
			})),
		];
	}

	async remove(id, principal) {
		// a template is nobody's, so it is not yours to delete. Saying so beats 'unknown diagram',
		// which would be a lie about something the caller can plainly see in the listing.
		if (this.templates.has(id)) return 'cannot delete a template: it ships with the image';
		const entry = this.diagrams.get(id);
		if (!entry) return 'unknown diagram';
		const denied = this.#mayWrite(id, principal);
		if (denied) return denied;
		if (entry.timer) {
			clearTimeout(entry.timer);
			entry.timer = null;
		}
		this.diagrams.delete(id);
		try {
			/*
			Tagged on the way out -- B109. The store still knows whose diagram this is; the recycle
			bin later will not, because a soft-deleted object serves its metadata and refuses its
			data. This is the last moment the answer exists.
			*/
			const tags = { owner: entry.model.state.meta.owner || '', name: entry.model.state.meta.name || '' };
			// the backend owns the temp artefact of its own write strategy, so this no longer
			// names a `.json.tmp` -- that was filesystem shape leaking into the caller (B55)
			await this.files.remove(entry.file, tags);
			await this.files.remove(`${id}.json`, tags);
		} catch (err) {
			console.warn(`[ store ] could not remove ${id}.json: ${err.message}`);
		}
		// B131 reseeded so deleting your last diagram did not strand you. Templates do that job now
		// and do it better -- what you get back is a choice rather than a blank document nobody asked
		// for -- so the reseed only runs where there are no templates to fall back on.
		if (this.diagrams.size === 0 && this.templates.size === 0) this.seed(principal);
		return null;
	}

	/*
	What is inside the delete window, and who may see it -- B109.

	A deleted diagram is recoverable for as long as the backend's retention allows, and until now
	nothing in the product said so: `DELETE` felt final, and a mistake felt unrecoverable when it
	was not. The window is real -- a bucket soft-delete policy is measured in days, not moments.

	Two answers that must not be conflated. `null` means the backend has no window at all, which is
	the honest answer on a filesystem and lets the surface say "not on this deployment" instead of
	"nothing to restore". An array, possibly empty, means the window exists and this is what is in it.

	FILTERED BY OWNERSHIP, and this is the part that needs care. A recycle bin is the one surface
	where the document is gone and its grants went with it, so the store cannot ask `canRead` -- the
	answer is no for everyone. The owner is read from the deleted document itself, which means
	reading it back; with authorization off there is nothing to filter and everything shows.
	*/
	async recoverable(principal = null) {
		if (typeof this.files.recoverable !== 'function') return null;
		const found = await this.files.recoverable();
		if (found === null) return null;
		/*
		One entry per ID, the newest generation.

		Each delete mints a soft-deleted generation, and `remove` issues two (the entry's file and
		the canonical name), so a diagram created and deleted twice appears four times. Listing them
		all is not merely noisy: `restore` names an id, so duplicates make the verb ambiguous about
		which version it would bring back. The newest is the only one anybody means.
		*/
		const newest = new Map();
		for (const item of found) {
			if (!FILE.test(item.name)) continue;
			const id = item.name.replace(/\.json$/, '');
			// a diagram that has since been restored, or re-created under the same id, is not
			// "recoverable" -- it is simply here, and offering to restore it would be a lie
			if (this.diagrams.has(id)) continue;
			const prior = newest.get(id);
			if (!prior || String(item.deletedAt) > String(prior.deletedAt)) newest.set(id, item);
		}
		const out = [];
		let unattributable = 0;
		for (const [id, item] of newest) {
			/*
			Identity comes from the TAGS, not from the document.

			The first version read the deleted file to find its owner, and against the live bucket
			every read answered 400: GCS keeps a soft-deleted object's metadata and refuses its data.
			So the answer has to be written down before the delete, which `remove` now does, and read
			back from the listing here.

			An entry with no tags predates that and cannot be attributed to anyone. It is counted
			rather than shown, because a row nobody can be shown to is not a row.
			*/
			const name = item.tags?.name || null;
			const owner = item.tags?.owner || null;
			const readable = !!owner;
			if (!readable) unattributable++;
			/*
			FAIL CLOSED on an unknown owner.

			The first version skipped the ownership test when the document could not be read, which
			meant an unreadable entry was shown to everybody -- and since a deleted document takes
			its grants with it, "unreadable" is exactly the state where the check matters most. A
			recycle bin that leaks on the error path is worse than one that omits a row.
			*/
			/*
			Compared against `ownerFor`, not the raw principal.

			B100 rules that an agent's work belongs to its CLAIMANT, so a diagram created by
			`agent:planner` is owned by the human who minted its code. Comparing the tag to the
			principal therefore hid an agent's own deletions from it -- verified live: the entry was
			tagged correctly and filtered out anyway. `ownerFor` is the resolution the rest of the
			store already uses, and the recycle bin was the one place asking the question by hand.

			An entry with no owner tag predates tagging and cannot be attributed to anybody, so it
			stays out of every list and is counted instead.
			*/
			if (this.authz) {
				const mine = this.ownerFor(principal);
				if (!mine) continue;
				if (!readable || !owner || owner !== mine) continue;
			}
			out.push({ id, name, owner, generation: item.generation,
				deletedAt: item.deletedAt, purgeAt: item.purgeAt });
		}
		out.sort((a, b) => String(a.purgeAt).localeCompare(String(b.purgeAt)));
		/*
		An OBJECT, not an array with a property bolted on.

		`unattributable` has to travel so a surface can say the window holds more than it can show,
		and hanging it off the array would be a field no reader of `entries.length` would ever find.
		The shape is `null` for no window at all, or `{ entries, unattributable }` for one.
		*/
		return { entries: out, unattributable };
	}

	/*
	Bring one back, and load it, so the caller sees a diagram rather than a promise about one.
	*/
	async restore(id, principal = null) {
		if (typeof this.files.restore !== 'function') return 'this deployment has no delete window';
		if (this.diagrams.has(id)) return 'that diagram is already here';
		const window = await this.recoverable(principal);
		if (window === null) return 'this deployment has no delete window';
		const hit = window.entries.find((w) => w.id === id);
		// the filter above is the authorization: an entry a principal cannot see is one it cannot
		// name, so a wrong id and someone else's id give the same answer, which is the correct one
		if (!hit) return 'nothing recoverable by that name';
		await this.files.restore(`${id}.json`, hit.generation);
		const { doc, log } = parse(await this.files.read(`${id}.json`));
		shedRetired(doc);
		const err = validateDoc(doc);
		if (err) return `restored file is not a valid document: ${err}`;
		/*
		`Log.from`, exactly as `init` does it -- and the first version passed the parsed object
		straight through.

		`parse` returns the log BLOCK, which is data; a Store entry needs a `Log`, which has
		behaviour. Handing over the raw shape produced a diagram that installed cleanly and then
		threw `log?.canUndo is not a function` the moment anybody opened it -- so the restore
		reported success and left the store holding something unusable.

		Every restore test until now drove the filesystem backend, which refuses before it reaches
		this line. The refusals were covered and the success path was not, which is the only reason
		this shipped.
		*/
		this.install(id, doc, Log.from(log, doc.meta.version), `${id}.json`);
		return null;
	}

	// ---- mutations (validated) ----
	/*
	The one write gate -- H9.3. Returns an error string when a principal may not, else null.

	Every mutating method calls this, rather than each caller remembering to. The principal is a
	trailing parameter, so a caller that has not been updated passes `undefined` and is REFUSED
	once authorization is on. That direction is deliberate: a missed call site becomes a visible
	failure instead of a silent hole, which is the only safe way to add a gate to seven methods.

	With authorization off it always allows, because there is no identity to judge and the store is
	the single-tenant tool it has always been.
	*/
	/*
	The read predicate (B67). Reads were the half of authorization H9 never gated: writes went
	through `#mayWrite`, listing went through `list(principal)`, and the document itself went out
	to anyone who asked for it by id. The asymmetry was invisible because `snapshotBody` filters
	`diagrams` three lines below where it returns `doc`, so an unauthorized payload sat next to an
	authorized one and looked like it had been checked.

	Any level reads. `read` and `write` differ on writing, not on seeing.
	*/
	canRead(id, principal) {
		/*
		H9.9: a template is readable by every PRINCIPAL -- which is not the same as by everyone.

		The first version returned true unconditionally, on the reasoning that a template is owned by
		nobody so authorization has nothing to decide. That is true about the GRANT and false about
		the door. `/connect` is deliberately outside IAP, so an unauthenticated caller reached it,
		and `curl` with no credential returned the whole of a real network topology.

		A template is not public content. It is content offered to anyone who has got through the
		door, and getting through the door is exactly what having a principal means. Writing is a
		separate question and `commit` answers it by forking.
		*/
		if (!this.authz) return true;
		if (this.templates.has(id)) return !!principal;
		return this.access(id, principal) !== null;
	}

	// the write predicate, public because authorization is not only about mutating the model:
	// taking the server-side write lock is a write capability held outside this class (B63), and a
	// second copy of this rule in the caller is a rule that drifts. `#mayWrite` is the same
	// question phrased as an error string, for the mutators that return one.
	/*
	H9.9 -- may this caller START from here? A different question from `canWrite`.

	`canWrite` stays false for a template and that is deliberate: it is what the REST lock path
	relies on, and making it true would grant write access to something that can never be written.
	But the answer a CLIENT needs is not "may I write to this document" -- it is "may I begin
	editing", and for a template the answer is yes, with the caveat that the first edit makes the
	result yours.

	Without this the browser rendered a template read-only and refused every gesture, so the fork
	could never be triggered from the UI at all: the feature existed and was unreachable.
	*/
	mayFork(id, principal) {
		return this.templates.has(id) && (!this.authz || !!principal);
	}

	canWrite(id, principal) {
		if (!this.authz) return true;
		const level = this.access(id, principal);
		return level === 'owner' || level === 'write';
	}

	#mayWrite(id, principal) {
		/*
		B178 -- an instance that has PROVEN another writer owns this document must stop accepting
		edits for it, not merely stop trying to persist them.

		Stopping the retry was half a fix and the dangerous half was left: the instance went on
		taking commits, applying them in memory and broadcasting them to its own clients, while
		every one of them was discarded the moment the tab closed. A refusal a user can see beats
		an acceptance that silently loses their work -- I15, in the place it costs most.

		Checked BEFORE authorization because it is not about this principal. Nobody may write here,
		including the owner, and answering `forbidden` would send them to look at grants for a
		problem that has nothing to do with access.
		*/
		if (this.lost.has(id)) return 'this server no longer owns this diagram -- reload to reach the one that does';
		if (this.canWrite(id, principal)) return null;
		// 403, not 423: a lock is someone else driving and is worth retrying, this is not
		return 'forbidden: no write access to this diagram';
	}

	// THE ONE WRITE. Every writer reaches the model through here.
	/*
	H9.9 -- the first write against a template FORKS it, and the answer says so.

	A template is read-only content in the image, so a write cannot land on it. Rather than refuse,
	the write is applied to a fresh diagram seeded from the template and owned by the caller, and
	the result carries `forkedTo` so the caller can follow. Refusing would be simpler and would make
	a template a thing you look at rather than a thing you start from, which is the entire point.

	FORKED HERE, at the one write choke point, rather than at each caller. REST and the websocket
	both funnel through `commit`, so this is the only place that can see every write; doing it in
	either transport would leave the other silently writing to nowhere.
	*/
	commit(id, request, by = 'client', actor = null, principal) {
		if (this.templates.has(id)) {
			const forked = this.forkTemplate(id, principal);
			if (!forked.ok) return forked;
			const res = this.commit(forked.id, request, by, actor, principal);
			// the fork stands even if the write is then rejected: the caller asked to start from
			// this template, and handing back a rejection with no diagram would lose that intent
			return { ...res, forkedTo: forked.id };
		}
		const entry = this.diagrams.get(id);
		if (!entry) return { ok: false, error: 'unknown diagram' };
		const denied = this.#mayWrite(id, principal);
		if (denied) return { ok: false, error: denied, forbidden: true };
		/*
		B184 -- a commit this diagram has ALREADY applied is answered, not applied again.

		The outbox replays on every snapshot, which is correct: unsent work must survive a
		reconnect. What was missing is any way for either side to answer "did this already land?".
		The client renamed a commit on every attempt and the server remembered nothing, so a replay
		was indistinguishable from a new command -- it applied again, bumped the version, and the
		version bump earned another resync, which replayed again. That loop reached 130 attempts a
		second and was the P0.

		Stable ids (client half) plus this memory (server half) make the PROTOCOL idempotent, not
		merely the ops. The second attempt terminates on an acknowledgement rather than becoming a
		second transaction, so the cycle cannot form.

		Answered with the ORIGINAL version, because that is what the client is waiting to hear: it
		prunes on `durableVersion`, and a repeat that returned a fresh version would prune the wrong
		entry.

		WHAT THIS GUARANTEE DOES NOT COVER, stated here because an unstated bound is how F5 went
		wrong -- that note concluded exactly-once was unnecessary and was the direct ancestor of the
		incident this closes.

		Exactly-once holds WITHIN a server lifetime and WITHIN `SEEN_MAX` commits. This map is in
		memory, so a restart forgets it and a replay across one applies a second time. That is a
		cost, not a loop: the ops are idempotent so the document converges, the client's id is now
		stable so it earns a real acknowledgement, and the entry prunes. One extra transaction.

		Persisting it is deliberately NOT done. A restart already forces every client to resync, and
		adding durable state against a case nobody has hit would be mechanism ahead of measurement
		(A11) -- which is the habit that produced tonight.
		*/
		if (request.txnId && entry.seen?.has(request.txnId)) {
			// `has`, not a truthiness or !== undefined test: a stored version of 0 or undefined is
			// still a record that this id was applied, and an earlier draft that checked the VALUE
			// silently never fired because the value it stored was undefined.
			return { ok: true, replayed: true, version: entry.seen.get(request.txnId), change: null };
		}

		const res = txnCommit(entry.model, entry.log, request, by, actor);
		if (res.ok && request.txnId) {
			entry.seen = entry.seen || new Map();
			// `res.version` is the log's version after the commit -- `change` carries `seq`/`from`
			// and no `version` field at all, which an earlier draft assumed and stored as undefined.
			entry.seen.set(request.txnId, res.version ?? entry.model.state.meta.version);
			// bounded by COUNT rather than by time: N maps onto "how far behind may a reconnecting
			// client be" and does not drift with load. A client further behind than this has its
			// replay treated as new -- the same class of bound as LOG_MAX, ruled acceptable.
			if (entry.seen.size > SEEN_MAX) {
				const drop = entry.seen.size - SEEN_MAX;
				let n = 0;
				for (const k of entry.seen.keys()) { if (n++ >= drop) break; entry.seen.delete(k); }
			}
		}
		if (res.ok && res.change) this.markDirty(id);
		return res;
	}

	undo(id, to = null, principal) {
		if (this.templates.has(id)) return { ok: false, error: `cannot undo a template: write to it first, which forks a copy you own` };

		const entry = this.diagrams.get(id);
		if (!entry) return { ok: false, error: 'unknown diagram' };
		const denied = this.#mayWrite(id, principal);
		if (denied) return { ok: false, error: denied, forbidden: true };
		const res = txnUndo(entry.model, entry.log, to);
		if (res.ok) this.markDirty(id);
		return res;
	}

	redo(id, principal) {
		if (this.templates.has(id)) return { ok: false, error: `cannot redo a template: write to it first, which forks a copy you own` };

		const entry = this.diagrams.get(id);
		if (!entry) return { ok: false, error: 'unknown diagram' };
		const denied = this.#mayWrite(id, principal);
		if (denied) return { ok: false, error: denied, forbidden: true };
		const res = txnRedo(entry.model, entry.log);
		if (res.ok) this.markDirty(id);
		return res;
	}

	// model-state (status): set the authoritative selection (shape-validated; the Model expands-to-group,
	// reconciles-to-live, and admits only selectable kinds). The debounced flush persists it. (R2)
	setSelection(id, ids, principal) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		const denied = this.#mayWrite(id, principal);
		if (denied) return denied;
		const err = validateSelectionIds(ids);
		if (err) return err;
		model.setSelection(ids);
		this.markDirty(id);
		return null;
	}


	// ---- persistence ----
	// total flush failures across all diagrams — surfaced by GET /health and `draw status` so a
	// backend that is silently failing to persist is visible before the next restart loses work.
	/*
	Authorization -- ACCESS.md. Owner and grants, written outside the transaction.

	These deliberately bypass `commit()`, and the reason is sharper than consistency with the
	`flush()` serializes the document AND the log, so a grant routed through a
	commit would be undoable -- and undo silently restoring access for a principal just revoked is
	a security failure rather than a usability quirk. Bypassing the transaction avoids it by
	construction instead of by a rule someone has to keep remembering.

	`access(id, principal)` is the single check every caller should ask, so the rule has one home.
	It is used here to gate granting itself: only an owner may change who else may reach a diagram.
	*/
	access(id, principal) {
		const model = this.get(id);
		if (!model || !principal) return null;
		const meta = model.state.meta;
		if (meta.owner && meta.owner === principal) return 'owner';
		const level = meta.grants?.[principal];
		if (level === 'read' || level === 'write') return level;
		/*
		H9.4c -- one fallback, and it is a FALLBACK rather than a union, exactly as ACCESS.md rules.
		A grant naming this diagram wins over a grant naming its owner, so a workspace grant can be
		narrowed on a single diagram by granting a lower level there.

		That precedence has a consequence sharp enough to name here: revoking a diagram grant from
		somebody who also holds a workspace grant does NOT remove their access, it returns them to
		the workspace level. `revoke` therefore reports the level that remains, so the caller learns
		it from the response rather than from a surprise. Encoding "revoked" as "the diagram entry
		is gone" would be B80 again -- describing the mechanism instead of the permission.
		*/
		const workspace = meta.owner ? this.workspace.get(meta.owner)?.[principal] : null;
		return workspace === 'read' || workspace === 'write' ? workspace : null;
	}

	/*
	Claim every unowned diagram for a principal -- H9.10.

	The eleven diagrams already in the bucket predate ownership, so under a grant filter they would
	belong to nobody and be visible to nobody. Adoption is explicit and one-shot rather than a rule
	that unowned means public, because "visible to whoever asks" is not a default anyone should get
	by accident. Idempotent, since `setOwner` refuses a diagram that already has an owner.
	*/
	adopt(principal) {
		let claimed = 0;
		for (const id of this.diagrams.keys()) {
			if (this.setOwner(id, principal) === null) claimed++;
		}
		return claimed;
	}

	// an unowned diagram is claimable; an owned one is not, so ownership cannot be taken by asking
	setOwner(id, principal) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		if (model.state.meta.owner) return 'already owned';
		model.state.meta.owner = principal;
		this.markDirty(id);
		return null;
	}

	grant(id, principal, level, by) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		if (this.access(id, by) !== 'owner') return 'only the owner may grant';
		// H9.4d: refuse here exactly what validateDoc refuses on the way in. These writes bypass
		// commit() on purpose, so they bypass its validation too -- and an unvalidated grant does
		// not fail now, it fails at the next boot when the document will not load.
		if (!validPrincipal(principal)) return `invalid principal: ${principal}`;
		if (level !== 'read' && level !== 'write') return `invalid level: ${level}`;
		if (principal === model.state.meta.owner) return 'the owner already has full access';
		model.state.meta.grants = { ...model.state.meta.grants, [principal]: level };
		this.markDirty(id);
		return null;
	}

	revoke(id, principal, by) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		if (this.access(id, by) !== 'owner') return 'only the owner may revoke';
		// absent is success: revoking twice must not be an error, or a retry becomes a failure
		const grants = { ...model.state.meta.grants };
		delete grants[principal];
		model.state.meta.grants = grants;
		this.markDirty(id);
		return null;
	}

	flushFailures() {
		let n = 0;
		for (const entry of this.diagrams.values()) n += entry.flushFailures || 0;
		return n;
	}

	markDirty(id) {
		const entry = this.diagrams.get(id);
		if (!entry) return;
		entry.dirty = true;
		if (entry.timer) return;
		// B59 -- flush() is async now, and this caller cannot await it: it is a timer, not a
		// request. An unhandled rejection here would reach server.js's last-resort net and be
		// reported as anonymous, so the catch is explicit and names the diagram it lost.
		entry.timer = setTimeout(() => {
			entry.timer = null;
			this.flush(id).catch((err) => console.error(`[ store ] background flush failed for ${id}: ${err.message}`));
		}, this.flushMs);
		if (entry.timer.unref) entry.timer.unref();
	}

	async flush(id) {
		const entry = this.diagrams.get(id);
		if (!entry || !entry.dirty) return;
		entry.file = `${id}.json`; // canonical from first flush onward
		try {
			await this.files.write(entry.file, serialize(entry.model.toJSON(), entry.log));
			entry.dirty = false; // only after the write actually landed
			// B15 — and so is the watermark. This is the ONLY place a version becomes durable, so
			// it is recorded here, from the log that was actually just written, rather than guessed
			// downstream from `dirty`.
			entry.flushedVersion = entry.log.version;
		} catch (err) {
			// B4: the entry is still dirty but markDirty already nulled the timer, so without an
			// explicit reschedule recovery waits for the next edit or SIGTERM. Retry, and COUNT —
			// a retry that repairs the mechanism silently leaves the failure unobservable.
			entry.flushFailures = (entry.flushFailures || 0) + 1;
			console.error(`[ store ] flush failed for ${id} (${entry.flushFailures}): ${err.message}`);
			/*
			B178 -- a write CONFLICT is not a flaky disk, and must not be retried like one.

			`files.mjs` refuses to overwrite when another writer holds a newer generation, and
			says so in as many words. That refusal is PROOF: this instance is no longer
			authoritative for this document, and no number of retries will make it so. Retrying
			anyway is what produced 3203 failures against one diagram while both instances went on
			serving their own clients as though each were the only one.

			So the retry stops, the loss is reported once, and whoever owns the sessions decides
			what to tell them. Distinguished from every other flush failure by the message the
			backend raises, because a transient write error DOES deserve B4's retry -- the two need
			opposite responses and shared a path until now.
			*/
			if (/write conflict/.test(err.message)) {
				/*
				REPORTING is once; STOPPING is every time. The first version of this welded both to
				`!this.lost.has(id)`, so the second conflict fell straight through into B4's retry
				and the instance went on fighting a write it had already proved it could not win.

				Observed in production: authority lost at 00:35:03 and two sessions retired
				correctly, then conflicts 2 through 7 over the next fourteen minutes. Retiring once
				and carrying on is not retiring -- it is announcing a rule and then breaking it.
				*/
				const first = !this.lost.has(id);
				this.lost.add(id);
				if (first) {
					console.error(`[ store ] lost authority for ${id} -- another writer holds it; not retrying`);
					try { this.onLostAuthority?.(id, 'another instance is writing this diagram'); }
					catch (e) { console.error(`[ store ] onLostAuthority failed: ${e.message}`); }
				}
				return;
			}
			if (!entry.timer) {
				entry.timer = setTimeout(() => { entry.timer = null; this.flush(id).catch((e) => console.error(`[ store ] retry flush failed for ${id}: ${e.message}`)); }, this.flushMs);
				if (entry.timer.unref) entry.timer.unref();
			}
		}

		/*
		GR9, checked OUTSIDE the write's try/catch — B20.

		The ring must never hold a seq above the watermark that describes it. This used to sit
		inside the try, so a breach took B4's recovery path: counted as `flushFailures`, logged as
		"flush failed", retried by a reschedule that returned immediately at the `!entry.dirty`
		guard above. A structural breach was therefore reported once, under the wrong name, and
		never re-checked — while `/health` stayed `degraded` forever on a counter that only rises.

		It is deliberately NOT a throw and NOT a refusal to write. The breach is in the log's
		accounting, not in the user's document, and refusing to persist would trade real work for
		a bookkeeping bug (I15 cuts the other way here: fabricating success is the sin, losing data
		to a counter is not the remedy). So: write the document, then report the breach as itself —
		its own counter, its own `/health` signal, its own greppable message, and re-checked on
		every subsequent write for as long as it is true.
		*/
		if (!entry.log.records.every((r) => r.seq <= entry.log.version)) {
			entry.invariantFailures = (entry.invariantFailures || 0) + 1;
			const bad = entry.log.records.filter((r) => r.seq > entry.log.version).map((r) => r.seq);
			console.error(`[ store ] GR9 log invariant breached for ${id} (${entry.invariantFailures}): seq ${bad.join(',')} exceeds version ${entry.log.version}`);
		}
	}

	/*
	The log for a diagram, and the version of it that is actually on disk — B15 / A3 `Air-Gap`.

	These exist because ten sites outside this class reached into `store.diagrams.get(id)` to read
	`.log` and `.dirty` directly, and then each re-derived the durability rule for itself. It was
	spelled three different ways at three sites — only one of which null-guarded — which is exactly
	why it was wrong in more than one place at once. A rule with no home gets re-remembered.

	`durableVersion` is the watermark `flush()` recorded, never a guess from `dirty`. `dirty` answers
	"is anything unwritten?"; the wire needs "how far can the client prune its outbox?" (D30), and
	`version - 1` answers that only when exactly one commit is outstanding.
	*/
	log(id) {
		return this.diagrams.get(id)?.log;
	}

	durableVersion(id) {
		const entry = this.diagrams.get(id);
		if (!entry) return 0;
		return entry.flushedVersion ?? 0;
	}

	// total GR9 invariant breaches across all diagrams — surfaced by GET /health SEPARATELY from
	// flushFailures. A breach means the log mis-minted a seq; a flush failure means the disk said no.
	// One is a bug in this process, the other is the environment: same symptom, opposite remedies.
	invariantFailures() {
		let n = 0;
		for (const entry of this.diagrams.values()) n += entry.invariantFailures || 0;
		return n;
	}

	async flushAll() {
		for (const id of this.diagrams.keys()) {
			const entry = this.diagrams.get(id);
			if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
			await this.flush(id);
		}
	}
}
