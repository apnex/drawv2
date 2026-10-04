/*
THE SCHEMA 2 MIGRATION -- promotion's stored format batch, as one function (dev/design/unification/FORMAT-BATCH.md
section 5; ruled 2026-10-03, F1 to F4).

Every change to the stored format lands as one named batch, applied once to the estate (`dev/DECISIONS.md`, "One named
batch, last"). This is that batch: a list of STEPS, each keyed on the shape it repairs rather than on the schema number,
so every step is idempotent -- a repaired document passes through unchanged, and a step added by a later stage (the
pipes, at P3, by F2) repairs a document an earlier stage already stamped 2. It is the loader's own pattern
(`migrateNames`, `migrateSpawn` in server/store.js), grown into a list.

PURE. It returns a new document and log and never touches its input or the disk, so the dry run
(tools/migrate-schema.mjs) and the store transform identically by construction -- the property
tools/migrate-version.mjs was built on.

RUN ON EVERY PATH INTO THE STORE, before validation: boot, examples, `create` (an open tab from before the cutover posts
its old document), templates and restore (server/store.js `admit`). The validator accepts the current generation alone, so
a schema 1 document enters only through here.

DELETED AFTER THE CUTOVER, with the dry-run tool, under "transform once, then delete the transform"; the trigger is every
stored document, the rollback backups included, being schema 2.
*/

// The generation this migration lands documents in. STATED, not imported from model/shape.mjs: a migration repairs to the
// shape as it was ruled, not as it may later become -- the reason tools/migrate-version.mjs restates the store's file rule.
// tests/migrate.test.js holds it equal to `SCHEMA` while the two are the same generation.
export const MIGRATION_TARGET = 2;

// the collections whose items carry a drawing order, as stored (F-d)
const ORDERED = ['nodes', 'links', 'zones'];

// a link's stops as routing reads them: its ends and pins, and a ring back to its start (network/pipes.mjs, P-3) -- restated,
// since a migration reads documents by the rule as ruled
const stopsOf = (l) => [l.src, ...(Array.isArray(l.via) ? l.via : []), l.dst, ...(l.closed ? [l.src] : [])];
const pairOf = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const ageOf = (l) => (Number.isInteger(l.order) ? l.order : 0);
const byAge = (x, y) => ageOf(x) - ageOf(y) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

// every (younger link, leg index) whose leg an older link already runs, oldest first
function sharedLegs(doc) {
	const claimed = new Map(), out = [];
	for (const l of [...(doc.links || [])].filter(Boolean).sort(byAge)) {
		const stops = stopsOf(l);
		let mine = [];
		for (let i = 0; i < stops.length - 1; i++) {
			const k = pairOf(stops[i], stops[i + 1]);
			if (claimed.has(k) && claimed.get(k) !== l.id) out.push({ link: l.id, leg: i, with: claimed.get(k) });
			else mine.push(k);
		}
		for (const k of mine) claimed.set(k, l.id);
	}
	return out;
}

const DRAWN = ['id', 'name', 'src', 'dst', 'via', 'order', 'closed'];   // a piece is open: a ring cut once is a path
function splitShared(doc, report) {
	const unsplittable = new Set();
	for (let guard = 0; guard < 1000; guard++) {
		const next = sharedLegs(doc).find((s) => !unsplittable.has(s.link));
		if (!next) return;
		const l = doc.links.find((x) => x.id === next.link);
		const stops = stopsOf(l), i = next.leg;
		// a ring has no ends: cut at the shared leg it is one open path, from the leg's far end round to its near one
		const before = l.closed ? [] : stops.slice(0, i + 1);
		const after = l.closed ? [...stops.slice(i + 1, -1), ...stops.slice(0, i + 1)] : stops.slice(i + 1);
		if (before.length < 2 && after.length < 2) {
			unsplittable.add(l.id);
			report.push({ kind: 'unsplittable', link: l.id, shares: next.with, leg: [stops[i], stops[i + 1]] });
			continue;
		}
		const declared = Object.fromEntries(Object.entries(l).filter(([k]) => !DRAWN.includes(k)));
		const top = (doc.links || []).reduce((m, x) => Math.max(m, ageOf(x)), 0);
		const names = new Set([...(doc.nodes || []), ...(doc.links || []), ...(doc.zones || []), ...(doc.groups || [])].map((e) => e?.name));
		const freshName = (base) => { let n = 2; while (names.has(`${base}-${n}`)) n++; names.add(`${base}-${n}`); return `${base}-${n}`; };
		const freshId = () => { let n = parseInt(hexOf(l.id), 16); let id; do { n = (n + 1) % 0x1000000; id = `link-${n.toString(16).padStart(6, '0')}`; } while (doc.links.some((x) => x.id === id)); return id; };
		const piece = (ss, first) => ({ ...declared, id: first ? l.id : freshId(), name: first ? l.name : freshName(l.name || 'link'), src: ss[0], dst: ss[ss.length - 1],
			...(ss.length > 2 ? { via: ss.slice(1, -1) } : {}), order: first ? l.order : top + 1 });
		/*
		A link bends only at a waypoint (F-c), and a ring's stops may be typed: opened, one can fall inside a piece. A typed
		node is where links end, so a piece is cut there too -- an open link's own pins are waypoints already, so this only
		ever cuts a ring.
		*/
		const typed = new Set((doc.nodes || []).filter((n) => n?.type).map((n) => n.id));
		const atNodes = (ss) => {
			const out = [[ss[0]]];
			for (let k = 1; k < ss.length; k++) { out[out.length - 1].push(ss[k]); if (k < ss.length - 1 && typed.has(ss[k])) out.push([ss[k]]); }
			return out;
		};
		const pieces = [];
		for (const ss of [before, after].filter((x) => x.length >= 2).flatMap(atNodes)) pieces.push(piece(ss, pieces.length === 0));
		doc.links = doc.links.flatMap((x) => (x.id === l.id ? pieces : [x]));
		report.push({ kind: 'split', link: l.id, shares: next.with, leg: [stops[i], stops[i + 1]], into: pieces.map((p) => p.id) });
	}
}

const hexOf = (id) => String(id).slice(String(id).indexOf('-') + 1);

// waypoints whose hex a node holds, or an earlier waypoint took -- id -> hex, in collection order
function clashes(doc) {
	const out = new Map();
	if (!Array.isArray(doc.waypoints)) return out;
	const seen = new Set((doc.nodes || []).map((n) => hexOf(n.id)));
	for (const w of doc.waypoints) {
		const hex = hexOf(w.id);
		if (seen.has(hex)) out.set(w.id, hex);
		seen.add(hex);
	}
	return out;
}

// every place a stored document names an anchor, rewritten through `map` (old id -> new id)
function rewriteReferences(doc, map) {
	const to = (id) => (map.has(id) ? map.get(id) : id);
	for (const l of doc.links || []) {
		if (!l) continue;
		l.src = to(l.src);
		l.dst = to(l.dst);
		if (Array.isArray(l.via)) l.via = l.via.map(to);
	}
	for (const g of doc.groups || []) if (g && Array.isArray(g.members)) g.members = g.members.map(to);
	if (Array.isArray(doc.selection)) doc.selection = doc.selection.map(to);
	for (const b of doc.reveal?.beats || []) if (b && Array.isArray(b.ids)) b.ids = b.ids.map(to);
}

/*
The steps, in order. Each is `{ id, run(doc, log) -> log | undefined, needs(doc, log) }`: `needs` says whether the shape it
repairs is present, and `run` repairs the (already copied) document in place, returning a new log when it changes the log.
*/
const STEPS = [
	/*
	P-6 -- undo history starts at the cutover. A stored inverse predates every step above, and undo replays it without
	the planner, so a record kept across the batch would restore the old shape -- `flow` here, a waypoint at F-c.

	Keyed on the generation, and on the waypoint collection a document stamped 2 before F-c may still hold -- the one step
	keyed on the document rather than on what it repairs, because nothing in a log says which shape its records were written
	in. FIRST, so it reads the document before the steps after it repair it.
	The version is kept -- the high-water mark of the recorded version and the top record's seq, as `Log.from` takes it --
	so the next commit mints the next number and a client's `expect` still means what it meant.
	*/
	{
		id: 'history',
		needs: (doc, log) => (doc.meta?.schema !== MIGRATION_TARGET || Array.isArray(doc.waypoints)) && !!log && Array.isArray(log.records) && log.records.length > 0,
		run: (doc, log) => {
			const top = log.records[log.records.length - 1]?.seq;
			const version = Math.max(Number.isInteger(log.version) ? log.version : 0, Number.isInteger(top) ? top : 0);
			return { version, cursor: 0, evicted: 0, evictedHuman: 0, records: [] };
		},
	},
	/*
	P-10 -- a waypoint becomes a node with no type, its id keeping its hex (FORMAT-BATCH.md section 5.2). Two steps, because
	the hex must be unique across nodes and waypoints before the prefix can change: 3 waypoints in the estate share theirs
	with a node, which `Model.freshId` has prevented for new ones since N-a but could not undo for old ones.

	RENUMBER: a waypoint whose hex a node already holds, or an earlier waypoint already took, gets the next free hex above
	its own -- deterministic from the document, so the dry run and the real run agree. Every reference moves with it.
	*/
	{
		id: 'renumber',
		needs: (doc) => clashes(doc).size > 0,
		run: (doc) => {
			const taken = new Set([...(doc.nodes || []), ...(doc.waypoints || [])].map((e) => hexOf(e.id)));
			const map = new Map();
			for (const [id, hex] of clashes(doc)) {
				let n = parseInt(hex, 16);
				let next;
				do { n = (n + 1) % 0x1000000; next = n.toString(16).padStart(6, '0'); } while (taken.has(next));
				taken.add(next);
				map.set(id, `waypoint-${next}`);
			}
			for (const w of doc.waypoints) if (map.has(w.id)) w.id = map.get(w.id);
			rewriteReferences(doc, map);
		},
	},
	/*
	ANCHORS: each waypoint joins the nodes after them, `waypoint-<hex>` becoming `node-<hex>`, keeping its name, place,
	`spawn` and `pinned` (dropped by the `unpin` step, S-d); the collection goes. Every
	reference is rewritten: links' ends and bends, groups' members, the stored selection, and the reveal's beats.
	*/
	{
		id: 'anchors',
		needs: (doc) => 'waypoints' in doc,
		run: (doc) => {
			const map = new Map();
			const moved = (Array.isArray(doc.waypoints) ? doc.waypoints : []).map((w) => {
				const id = `node-${hexOf(w.id)}`;
				map.set(w.id, id);
				return { ...w, id };
			});
			doc.nodes = [...(doc.nodes || []), ...moved];
			delete doc.waypoints;
			rewriteReferences(doc, map);
		},
	},
	/*
	F-d (H18.6; B249, B10, B259) -- every node, link and zone stores its drawing order. An item without one takes the next
	above the highest of its kind, in the order its collection lists it: a document that has none gets 1, 2, 3 ... in each
	collection, which is the stacking and the link ages it had, since both followed that order. Keyed on an item lacking
	one, so it also repairs a document stamped 2 before this step existed. After `anchors`, so the nodes are one collection.
	*/
	{
		id: 'order',
		needs: (doc) => ORDERED.some((k) => (doc[k] || []).some((e) => e && !Number.isInteger(e.order))),
		run: (doc) => {
			for (const k of ORDERED) {
				const list = doc[k] || [];
				let top = list.reduce((m, e) => (e && Number.isInteger(e.order) && e.order > m ? e.order : m), 0);
				for (const e of list) if (e && !Number.isInteger(e.order)) e.order = ++top;
			}
		},
	},
	/*
	P-4 (S-d, H18.14) -- A SHARED LEG IS SPLIT INTO A JUNCTION, before the pipes are laid. Pipes carry one link each (ruled
	2026-09-30), so a consecutive stop pair two stored links both run would leave the younger down. The links are taken
	oldest first (by drawing order, then id); a younger link whose leg an older one already runs is cut at that leg's ends
	where they are bends (B210: a junction is where links end), the piece along the shared leg dropped -- the older link draws
	that line -- and the pieces keep the link's declarations; the first keeps its id and order, a new piece is the newest.
	A ring is cut open there, one path round its other legs, and again at any typed node inside it. A link that is nothing but the shared leg cannot be split
	without losing it: it is left, and REPORTED, and the dry run does not pass while one exists. Keyed with the pipes step:
	a document that never held pipes.
	*/
	{
		id: 'split',
		needs: (doc) => !Array.isArray(doc.pipes) && sharedLegs(doc).length > 0,
		run: (doc, _log, report) => splitShared(doc, report),
	},
	/*
	F2, P-3 (S-d, H18.14) -- EVERY STORED LINK'S PIPES. A document written before the network has links and no pipes, and
	under the network's routing every link would come up down. One link pipe per consecutive stop pair, a ring's closing
	leg included -- plain links too, since they were drawn under a rule that needed no pipe (unlike a new plain link, G2).
	Keyed on the document never having held a pipe collection: a document the network wrote holds one, empty or not, and a
	plain link it holds without pipes is down by the network's own rule, not the migration's to repair.
	*/
	{
		id: 'pipes',
		needs: (doc) => !Array.isArray(doc.pipes),
		run: (doc) => {
			const pipes = new Map();
			for (const l of doc.links || []) {
				if (!l) continue;
				const stops = stopsOf(l);
				for (let i = 0; i < stops.length - 1; i++) {
					const [a, b] = stops[i] < stops[i + 1] ? [stops[i], stops[i + 1]] : [stops[i + 1], stops[i]];
					if (a === b) continue;
					const [lo, hi] = [hexOf(a), hexOf(b)].sort();
					const id = `pipe-${lo}-${hi}`;
					if (!pipes.has(id)) pipes.set(id, { id, a: hexOf(a) === lo ? a : b, b: hexOf(a) === lo ? b : a, laid: 'link' });
				}
			}
			doc.pipes = [...pipes.values()];
		},
	},
	/*
	P-5 corrected (S-d, H18.14) -- `pinned` is retired: the network keeps no orphan beyond what its pipes hold (ruled
	2026-09-29), so the field means nothing; dropped from every node that carries it -- 104 in the estate.
	*/
	{
		id: 'unpin',
		needs: (doc) => (doc.nodes || []).some((n) => n && 'pinned' in n),
		run: (doc) => { for (const n of doc.nodes || []) if (n && 'pinned' in n) delete n.pinned; },
	},
	/*
	F1 -- `link.flow` becomes `direction`, stored as `forward` or `reverse`, absent meaning none: the words the CLI and the
	help already used for it, and a stored value that says what it means. Frees `flow` for stored flows (SD10).

	Only a boolean is converted. A `flow` holding anything else was never a valid document, and is left for the validator
	to refuse -- a repair that guessed would turn a corrupt field into a declaration nobody made.
	*/
	{
		id: 'direction',
		needs: (doc) => (doc.links || []).some((l) => l && typeof l.flow === 'boolean' && !('direction' in l)),
		run: (doc) => {
			for (const l of doc.links || []) {
				if (!l || typeof l.flow !== 'boolean' || 'direction' in l) continue;
				l.direction = l.flow ? 'forward' : 'reverse';
				delete l.flow;
			}
		},
	},
	// the generation, stamped last, once every step before it has repaired what it keys on
	{
		id: 'schema',
		needs: (doc) => doc.meta?.schema !== MIGRATION_TARGET,
		run: (doc) => { doc.meta = { ...(doc.meta || {}), schema: MIGRATION_TARGET }; },
	},
];

/*
`migrateFormatBatch(doc, log)` -> `{ doc, log, steps }`: the migrated document, its log (the same object when no step changed it,
null when there was none), and the ids of the steps that ran, in order -- empty for a document already migrated.
*/
export function migrateFormatBatch(doc, log = null) {
	let out = structuredClone(doc);
	let outLog = log;
	const steps = [], report = [];   // what a step must say: a shared leg split, or one it could not (P-4)
	for (const step of STEPS) {
		if (!step.needs(out, outLog)) continue;
		const next = step.run(out, outLog, report);
		if (next !== undefined) outLog = next;
		steps.push(step.id);
	}
	return { doc: out, log: outLog, steps, report };
}

// the step ids, in order -- what the dry run reports against
export const MIGRATION_STEPS = STEPS.map((s) => s.id);
