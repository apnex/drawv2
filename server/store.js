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
import { mintCode, formatCode, hashCode } from './codes.mjs';
import { groupAfterRemoval } from '../engine/index.mjs';
import { violations } from '../model/invariants.mjs';
import { commit as txnCommit, undo as txnUndo, redo as txnRedo, plan } from './txn.mjs';
import { Log } from './log.mjs';
import { serialize, parse } from './docfile.mjs';
import { fsFiles } from './files.mjs';

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
function cleanMeta(id, meta = {}, trusted = false) {
	const slides = (meta.slides && typeof meta.slides === 'object') ? meta.slides : {};
	const str = (v) => typeof v === 'string' ? v.slice(0, 512) : '';
	const grants = {};
	if (trusted && meta.grants && typeof meta.grants === 'object' && !Array.isArray(meta.grants)) {
		for (const [principal, level] of Object.entries(meta.grants)) {
			if (level === 'read' || level === 'write') grants[str(principal)] = level;
		}
	}
	return {
		id,
		name: String(meta.name || 'untitled').slice(0, 64),
		version: Number.isInteger(meta.version) && meta.version >= 0 ? meta.version : 0,
		schema: SCHEMA,
		owner: trusted ? str(meta.owner) : '',
		grants,
		slides: { url: str(slides.url), presentationId: str(slides.presentationId), pageId: str(slides.pageId) }
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
	constructor(dataDir, { flushMs = FLUSH_MS, files = null, now = Date.now, examplesDir = null, authz = false } = {}) {
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
		this.now = now;
		this.examplesDir = examplesDir;
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
				if (file !== `${doc.meta.id}.json`) this.markDirty(doc.meta.id);
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
		if (this.diagrams.size === 0) this.seed();
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
	seed() {
		const fromExamples = this.#seedFromExamples();
		if (fromExamples) return fromExamples;
		const doc = seedDoc();
		const entry = this.install(doc.meta.id, doc);
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
	#seedFromExamples() {
		if (!this.examplesDir || !fs.existsSync(this.examplesDir)) return null;
		let first = null;
		for (const file of fs.readdirSync(this.examplesDir).filter((f) => FILE.test(f)).sort()) {
			try {
				const { doc } = parse(fs.readFileSync(path.join(this.examplesDir, file), 'utf8'));
				const err = validateDoc(doc);
				if (err) { console.warn(`[ store ] skipping example ${file}: ${err}`); continue; }
				if (this.diagrams.has(doc.meta.id)) continue;
				const entry = this.install(doc.meta.id, doc);
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
	create(name, doc = null, principal = null) {
		// checked first, so a store at the cap writes nothing and mints no id
		if (this.diagrams.size >= MAX_DIAGRAMS) {
			return { ok: false, error: `diagram limit reached (${MAX_DIAGRAMS}) -- delete something, or raise MAX_DIAGRAMS` };
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

	get(id) {
		const entry = this.diagrams.get(id);
		return entry ? entry.model : null;
	}

	// B67: the first diagram THIS PRINCIPAL may read. It previously returned whichever entry the
	// Map happened to yield, which is how an unauthenticated `hello` was handed a document.
	first(principal = null) {
		for (const entry of this.diagrams.values()) {
			if (this.canRead(entry.model.state.meta.id, principal)) return entry.model;
		}
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
		return visible.map((e) => ({
			id: e.model.state.meta.id,
			name: e.model.state.meta.name,
			version: e.model.state.meta.version
		}));
	}

	async remove(id, principal) {
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
			// the backend owns the temp artefact of its own write strategy, so this no longer
			// names a `.json.tmp` -- that was filesystem shape leaking into the caller (B55)
			await this.files.remove(entry.file);
			await this.files.remove(`${id}.json`);
		} catch (err) {
			console.warn(`[ store ] could not remove ${id}.json: ${err.message}`);
		}
		if (this.diagrams.size === 0) this.seed(); // the store never goes empty
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
		if (!this.authz) return true;
		return this.access(id, principal) !== null;
	}

	// the write predicate, public because authorization is not only about mutating the model:
	// taking the server-side write lock is a write capability held outside this class (B63), and a
	// second copy of this rule in the caller is a rule that drifts. `#mayWrite` is the same
	// question phrased as an error string, for the mutators that return one.
	canWrite(id, principal) {
		if (!this.authz) return true;
		const level = this.access(id, principal);
		return level === 'owner' || level === 'write';
	}

	#mayWrite(id, principal) {
		if (this.canWrite(id, principal)) return null;
		// 403, not 423: a lock is someone else driving and is worth retrying, this is not
		return 'forbidden: no write access to this diagram';
	}

	// THE ONE WRITE. Every writer reaches the model through here.
	commit(id, request, by = 'client', actor = null, principal) {
		const entry = this.diagrams.get(id);
		if (!entry) return { ok: false, error: 'unknown diagram' };
		const denied = this.#mayWrite(id, principal);
		if (denied) return { ok: false, error: denied, forbidden: true };
		const res = txnCommit(entry.model, entry.log, request, by, actor);
		if (res.ok && res.change) this.markDirty(id);
		return res;
	}

	undo(id, to = null, principal) {
		const entry = this.diagrams.get(id);
		if (!entry) return { ok: false, error: 'unknown diagram' };
		const denied = this.#mayWrite(id, principal);
		if (denied) return { ok: false, error: denied, forbidden: true };
		const res = txnUndo(entry.model, entry.log, to);
		if (res.ok) this.markDirty(id);
		return res;
	}

	redo(id, principal) {
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

	/*
	The Slides binding: which deck and which slide this diagram's last successful push landed on.

	STATUS, not config — the server performed the push, so the server records where it went, and
	it is not a Change: it carries no user intent, must not be undoable, and must not bump the
	version. `slides.url` (what the user pasted) IS config and travels as a `meta` op; these two
	do not.

	It had no writer at all between CS3a and CS5 — `case 'meta'` was deleted when meta became an
	op, and the browser's `meta {slides:{presentationId,pageId}}` message was silently refused as
	an unknown cmd. A binding that never persists re-targets `pages[0]` on the next push after a
	restart, which is a wrong-slide overwrite, not a missing feature.
	*/
	bindSlides(id, presentationId, pageId, principal) {
		const model = this.get(id);
		if (!model) return 'unknown diagram';
		const denied = this.#mayWrite(id, principal);
		if (denied) return denied;
		const str = (v) => (typeof v === 'string' ? v.slice(0, 512) : '');
		Object.assign(model.state.meta.slides, { presentationId: str(presentationId), pageId: str(pageId) });
		this.markDirty(id);
		return null;
	}

	// ---- persistence ----
	// total flush failures across all diagrams — surfaced by GET /health and `draw status` so a
	// backend that is silently failing to persist is visible before the next restart loses work.
	/*
	Authorization -- ACCESS.md. Owner and grants, written the way `bindSlides` writes.

	These deliberately bypass `commit()`, and the reason is sharper than consistency with the
	Slides binding. `flush()` serializes the document AND the log, so a grant routed through a
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
