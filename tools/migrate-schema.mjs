#!/usr/bin/env node
/*
migrate-schema -- THE DRY RUN of promotion's format batch (dev/design/unification/FORMAT-BATCH.md section 5.4; H18.3).

The migration itself is server/migrate.mjs, and the store runs it on every path a document enters by, writing each
migrated file back once. So this tool never writes a data directory. It proves, against a copy of one -- the estate's
backup, at the end of every stage of the batch -- that the store's own boot migrates every diagram and changes nothing it
was not ruled to change:

  1. every diagram file is copied to a staging directory, with whatever else the directory holds;
  2. a REAL Store boots on the copy, so the check is the path production takes, not a second one;
  3. each loaded diagram is compared with its source once the ruled changes are set aside -- stated HERE, independently of
     the migration, so a step that did more than it was ruled to do is a difference this reports:
       direction  a link's `flow`, true or false, is its `direction`, forward or reverse (F1)
       anchors    each waypoint is a node with no type, found by its name and place (names are unique, B187) rather than
                  by the migration's own id rule, so a renumbered hex is checked like any other: every reference to it
                  must follow it, and no two anchors may share a hex (P-10)
       order      every node, link and zone carries a drawing order, and within each collection the items that had none
                  take orders rising in the order the source listed them -- the stacking and ages they had (F-d)
       unpin      no node carries `pinned` (P-5 corrected)
       schema     `meta.schema` is 2
     Every other field of every entity, the selection and the meta identity must be equal.
  4. every log keeps its version and, for a schema 1 source, holds no record (P-6); the document's version is its log's.
  5. THE PIPES (F2, P-3, P-4; S-d): every stored link is up under the network's own routing, along exactly its stored
     stops, and the pipes are exactly one per distinct leg, laid as `link` -- no pipe nobody's leg needed. A shared leg the
     migration split is reported with its pieces; one it could not split is a difference, and blocks the cutover.

Prints what each step changed, and exits 1 on any difference. The backup stays where it is and is never copied into the
repository.

Usage:  node tools/migrate-schema.mjs --data <dir>
*/

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateFormatBatch, MIGRATION_STEPS, MIGRATION_TARGET } from '../server/migrate.mjs';
import { parse } from '../server/docfile.mjs';
import { Model } from '../model/model.mjs';
import { productKinds } from '../planner/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';

// the store's own filename rule, restated as tools/migrate-version.mjs does: a migration selects by the rule as it was
const FILE = /^diagram-[0-9a-f]{6}\.json$/;

/*
The ruled changes, set aside so everything else can be compared exactly. A NORMALISER, not a migration: it maps the source
and the result to one canonical form, and is written from the rulings rather than from server/migrate.mjs.
*/
export function canonical(doc, idMap = new Map()) {
	const sorted = (v) => {
		if (Array.isArray(v)) return v.map(sorted);
		if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]));
		return v;
	};
	const byId = (list) => [...(list || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
	const to = (id) => idMap.get(id) ?? id;
	const unordered = (e) => { const { order, ...rest } = e; return rest; };   // F-d: checked apart, below
	const unpinned = (e) => { const { pinned, ...rest } = e; return rest; };   // P-5 corrected: retired
	const link = (l0) => {
		const l = { ...l0, src: to(l0.src), dst: to(l0.dst), ...(Array.isArray(l0.via) ? { via: l0.via.map(to) } : {}) };
		const { flow, direction, ...rest } = l;
		const said = direction ?? (flow === true ? 'forward' : flow === false ? 'reverse' : undefined);   // F1
		return said === undefined ? rest : { ...rest, direction: said };
	};
	// P-10: the waypoints join the nodes, through the map
	const anchors = [...(doc.nodes || []), ...(doc.waypoints || []).map((w) => ({ ...w, id: to(w.id) }))].map(unordered).map(unpinned);
	return JSON.stringify(sorted({
		id: doc.meta?.id, name: doc.meta?.name,
		nodes: byId(anchors), links: byId(doc.links).map(unordered).map(link),
		zones: byId(doc.zones).map(unordered), groups: byId(doc.groups).map((g) => ({ ...g, members: (g.members || []).map(to) })),
		selection: [...(doc.selection || [])].map(to).sort(),
		reveal: doc.reveal ? { ...doc.reveal, beats: (doc.reveal.beats || []).map((b) => ({ ...b, ids: (b.ids || []).map(to) })) } : null,
	}));
}

/*
Each source waypoint's id in the migrated document: the node with no type carrying its name and place. Found, not computed --
so the dry run checks the migration's renumbering instead of repeating it.
*/
/*
F-d: every item has an order, and the ones the source left without take rising orders in the order it listed them --
nodes first, then the waypoints that joined them -- so a stacking or an age is never reordered. Answers a problem or null.
*/
export function orderProblem(source, migrated, map) {
	const lists = { nodes: [...(source.nodes || []), ...(source.waypoints || []).map((w) => ({ ...w, id: map.get(w.id) ?? w.id }))], links: source.links || [], zones: source.zones || [] };
	for (const [k, list] of Object.entries(lists)) {
		const now = new Map((migrated[k] || []).map((e) => [e.id, e.order]));
		if ([...now.values()].some((o) => !Number.isInteger(o) || o < 1)) return `a ${k.slice(0, -1)} without a drawing order`;
		const given = list.filter((e) => !Number.isInteger(e.order)).map((e) => now.get(e.id));
		if (given.some((o, i) => i > 0 && !(o > given[i - 1]))) return `the ${k} were given orders out of the order they were listed in`;
		for (const e of list) if (Number.isInteger(e.order) && now.get(e.id) !== e.order) return `${e.id} changed its drawing order`;
	}
	return null;
}

/*
S-d: the migrated board under the NETWORK -- every link up, along exactly its stored stops, and every pipe one some leg
needed. Answers { problems, pipes, closing }. Read through a Model composed as the server and the lab compose it, so the
answer is the network's own, not a restatement.
*/
const KINDS = productKinds(...NETWORK_ROWS);
export function pipeProblems(migrated) {
	const network = createNetwork(createTransit());
	const model = new Model({ kinds: KINDS, network });
	model.load(migrated);
	const routes = network.view.of(model);   // the network's own derivation: each link's route as anchor ids
	const problems = [], legs = new Set();
	const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
	let closing = 0;
	for (const l of migrated.links || []) {
		const stops = [l.src, ...(l.via || []), l.dst, ...(l.closed ? [l.src] : [])];
		for (let i = 0; i < stops.length - 1; i++) legs.add(key(stops[i], stops[i + 1]));
		if (l.closed) closing++;
		if (model.isLinkDown(model.get('link', l.id))) { problems.push(`${l.id} is down`); continue; }
		const path = routes.route(l.id);
		if (!path || path.join(',') !== stops.join(',')) problems.push(`${l.id} runs ${path?.join(',')}, not its stops ${stops.join(',')}`);
	}
	const pipes = migrated.pipes || [];
	for (const p of pipes) {
		if (!legs.has(key(p.a, p.b))) problems.push(`${p.id} is no stored link's leg`);
		if (p.laid !== 'link') problems.push(`${p.id} is laid ${p.laid}, not link`);
	}
	if (new Set(pipes.map((p) => key(p.a, p.b))).size !== legs.size) problems.push(`${pipes.length} pipe(s) for ${legs.size} distinct leg(s)`);
	if ((migrated.nodes || []).some((n) => 'pinned' in n)) problems.push('a node still carries pinned');
	return { problems, pipes: pipes.length, closing };
}

export function waypointMap(source, migrated) {
	const map = new Map();
	const bare = (migrated.nodes || []).filter((n) => !n.type);
	for (const w of source.waypoints || []) {
		const hit = bare.filter((n) => n.name === w.name && n.x === w.x && n.y === w.y);
		if (hit.length === 1) map.set(w.id, hit[0].id);
	}
	return map;
}

const flag = (name) => {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
};

export async function dryRun(dataDir, { say = console.log } = {}) {
	const files = fs.readdirSync(dataDir).filter((f) => FILE.test(f)).sort();
	if (!files.length) throw new Error(`no files matching ${FILE} in ${dataDir}`);
	const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-schema-dry-'));
	for (const f of fs.readdirSync(dataDir)) {
		if (fs.statSync(path.join(dataDir, f)).isFile()) fs.copyFileSync(path.join(dataDir, f), path.join(staging, f));
	}

	// what the migration reports per step, read from the function the store calls -- counted, not trusted: step 3 checks it
	const sources = new Map();
	const ran = Object.fromEntries(MIGRATION_STEPS.map((s) => [s, 0]));
	let records = 0, directions = 0, pinned = 0;
	const reported = [];
	for (const f of files) {
		const { doc, log } = parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
		sources.set(doc.meta.id, { doc, log });
		const migrated = migrateFormatBatch(doc, log);
		for (const s of migrated.steps) ran[s]++;
		for (const r of migrated.report) reported.push({ diagram: doc.meta.id, ...r });
		pinned += [...(doc.nodes || []), ...(doc.waypoints || [])].filter((n) => n && 'pinned' in n).length;
		if (doc.meta?.schema !== MIGRATION_TARGET) records += log?.records?.length ?? 0;
		directions += (doc.links || []).filter((l) => typeof l.flow === 'boolean').length;
	}

	const { Store } = await import('../server/store.js');
	const store = new Store(staging, { flushMs: 3_600_000, authz: false });
	await store.init();
	const problems = [];
	let renumbered = 0, waypointsLeft = 0, nodes = 0, pipes = 0, closing = 0;
	const split = reported.filter((r) => r.kind === 'split');
	for (const r of reported) if (r.kind === 'unsplittable') problems.push(`${r.diagram}: ${r.link} shares the leg ${r.leg.join('-')} with ${r.shares} and cannot be split (P-4)`);
	if (store.diagrams.size !== files.length) problems.push(`booted ${store.diagrams.size} diagram(s) of ${files.length}`);
	for (const [id, { doc, log }] of sources) {
		const entry = store.diagrams.get(id);
		if (!entry) { problems.push(`${id}: did not boot`); continue; }
		const loaded = entry.model.toJSON();
		const map = waypointMap(doc, loaded);
		if (map.size !== (doc.waypoints || []).length) problems.push(`${id}: ${(doc.waypoints || []).length - map.size} waypoint(s) found as no node`);
		if ([...map].some(([was, now]) => now.slice(5) !== was.slice(9))) renumbered += [...map].filter(([was, now]) => now.slice(5) !== was.slice(9)).length;
		const hexes = (loaded.nodes || []).map((n) => n.id.slice(5));
		if (new Set(hexes).size !== hexes.length) problems.push(`${id}: two anchors share a hex`);
		if ('waypoints' in loaded) problems.push(`${id}: still holds a waypoint collection`);
		waypointsLeft += (loaded.waypoints || []).length;
		nodes += (loaded.nodes || []).length;
		// a split diagram's links are checked by the network below, not against its source: the split is the ruled change
		const splitHere = split.some((r) => r.diagram === id);
		const linkless = (d) => ({ ...d, links: [] });
		if (canonical(splitHere ? linkless(loaded) : loaded) !== canonical(splitHere ? linkless(doc) : doc, map)) problems.push(`${id}: an entity changed beyond the ruled changes`);
		const piped = pipeProblems(loaded);
		for (const p of piped.problems) problems.push(`${id}: ${p}`);
		pipes += piped.pipes; closing += piped.closing;
		const ordering = orderProblem(doc, loaded, map);
		if (ordering) problems.push(`${id}: ${ordering}`);
		if (loaded.meta.schema !== MIGRATION_TARGET) problems.push(`${id}: meta.schema is ${loaded.meta.schema}`);
		const top = log?.records?.length ? log.records[log.records.length - 1].seq : 0;
		const kept = Math.max(Number.isInteger(log?.version) ? log.version : (doc.meta.version ?? 0), top);
		if (entry.log.version !== kept) problems.push(`${id}: log version ${entry.log.version}, expected ${kept}`);
		if (doc.meta?.schema !== MIGRATION_TARGET && entry.log.records.length) problems.push(`${id}: ${entry.log.records.length} undo record(s) survived`);
		if (loaded.meta.version !== entry.log.version) problems.push(`${id}: meta.version ${loaded.meta.version} is not its log's ${entry.log.version}`);
	}
	fs.rmSync(staging, { recursive: true, force: true });

	say(`  ${files.length} diagram file(s) in ${dataDir}; ${store.diagrams.size} booted in a real store`);
	say(`  steps: ${MIGRATION_STEPS.map((s) => `${s} ${ran[s]}`).join(', ')} (diagrams each changed)`);
	say(`  ${directions} declared direction(s) renamed; ${records} undo record(s) dropped`);
	say(`  ${nodes} node(s) after, ${waypointsLeft} waypoint collection entries left; ${renumbered} waypoint(s) renumbered`);
	say(`  ${pipes} pipe(s) laid, ${closing} ring(s) with a closing leg; ${split.length} shared leg(s) split; ${pinned} pinned dropped`);
	for (const r of split) say(`  - ${r.diagram}: ${r.link} shared ${r.leg.join('-')} with ${r.shares}; now ${r.into.join(', ')}`);
	for (const p of problems) say(`  ✗ ${p}`);
	say(problems.length ? `  FAIL -- ${problems.length} difference(s)` : '  PASS -- every diagram boots, and nothing changed that was not ruled');
	return { files: files.length, booted: store.diagrams.size, ran, directions, records, nodes, renumbered, pipes, closing, split: split.length, pinned, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const data = flag('data');
	if (!data) { console.error('usage: node tools/migrate-schema.mjs --data <dir>'); process.exit(2); }
	const { problems } = await dryRun(path.resolve(data));
	process.exit(problems.length ? 1 : 0);
}
