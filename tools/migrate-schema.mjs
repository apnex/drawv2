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
       schema     `meta.schema` is 2
     Every other field of every entity, the selection and the meta identity must be equal.
  4. every log keeps its version and, for a schema 1 source, holds no record (P-6); the document's version is its log's.

Prints what each step changed, and exits 1 on any difference. The backup stays where it is and is never copied into the
repository.

Usage:  node tools/migrate-schema.mjs --data <dir>
*/

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateFormatBatch, MIGRATION_STEPS, MIGRATION_TARGET } from '../server/migrate.mjs';
import { parse } from '../server/docfile.mjs';

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
	const link = (l0) => {
		const l = { ...l0, src: to(l0.src), dst: to(l0.dst), ...(Array.isArray(l0.via) ? { via: l0.via.map(to) } : {}) };
		const { flow, direction, ...rest } = l;
		const said = direction ?? (flow === true ? 'forward' : flow === false ? 'reverse' : undefined);   // F1
		return said === undefined ? rest : { ...rest, direction: said };
	};
	// P-10: the waypoints join the nodes, through the map
	const anchors = [...(doc.nodes || []), ...(doc.waypoints || []).map((w) => ({ ...w, id: to(w.id) }))];
	return JSON.stringify(sorted({
		id: doc.meta?.id, name: doc.meta?.name,
		nodes: byId(anchors), links: byId(doc.links).map(link),
		zones: byId(doc.zones), groups: byId(doc.groups).map((g) => ({ ...g, members: (g.members || []).map(to) })),
		selection: [...(doc.selection || [])].map(to).sort(),
		reveal: doc.reveal ? { ...doc.reveal, beats: (doc.reveal.beats || []).map((b) => ({ ...b, ids: (b.ids || []).map(to) })) } : null,
	}));
}

/*
Each source waypoint's id in the migrated document: the node with no type carrying its name and place. Found, not computed --
so the dry run checks the migration's renumbering instead of repeating it.
*/
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
	let records = 0, directions = 0;
	for (const f of files) {
		const { doc, log } = parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
		sources.set(doc.meta.id, { doc, log });
		for (const s of migrateFormatBatch(doc, log).steps) ran[s]++;
		if (doc.meta?.schema !== MIGRATION_TARGET) records += log?.records?.length ?? 0;
		directions += (doc.links || []).filter((l) => typeof l.flow === 'boolean').length;
	}

	const { Store } = await import('../server/store.js');
	const store = new Store(staging, { flushMs: 3_600_000, authz: false });
	await store.init();
	const problems = [];
	let renumbered = 0, waypointsLeft = 0, nodes = 0;
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
		if (canonical(loaded) !== canonical(doc, map)) problems.push(`${id}: an entity changed beyond the ruled changes`);
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
	for (const p of problems) say(`  ✗ ${p}`);
	say(problems.length ? `  FAIL -- ${problems.length} difference(s)` : '  PASS -- every diagram boots, and nothing changed that was not ruled');
	return { files: files.length, booted: store.diagrams.size, ran, directions, records, nodes, renumbered, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const data = flag('data');
	if (!data) { console.error('usage: node tools/migrate-schema.mjs --data <dir>'); process.exit(2); }
	const { problems } = await dryRun(path.resolve(data));
	process.exit(problems.length ? 1 : 0);
}
