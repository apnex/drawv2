#!/usr/bin/env node
/*
migrate-version — CS5. THE ONE IRREVERSIBLE STEP IN THE ARC (gate X4).

What it does, per diagram file:

  meta.rev    -> DELETED     a render counter. It incremented on every model emit, so dragging a
                             node across the canvas advanced it ~60 times per gesture and it read
                             11052 on a diagram with 24 nodes. It never described a transaction.
  meta.grid   -> DELETED     'center' on every live file; its last reader is `draw status`.
  meta.version -> ADDED      seeded from the file's OWN persisted log.version (0 when the file
                             predates the log). From here it is minted by the server, once per
                             accepted transaction, and it is the number `expect` compares.
  meta.schema  -> ADDED      1. The generation discriminator `grid` was accidentally serving.

Why it cannot be a `jq` one-liner:

  1. The 17 files are UNTRACKED (.gitignore: diagrams/*.json). `git checkout` restores nothing.
  2. The pre-CS5 binary cannot read the post-CS5 files — `version`/`schema` fail the old meta
     whitelist, the file is skipped, and the store reseeds when it empties. The rollback is
     `diagrams.bak`, and nothing else.
  3. A live server would silently revert every migrated file: SIGTERM runs flushAll() from memory.
  4. A count-only check passes a transform that mangled every coordinate.

So: health-port interlock, the store's own filename regex, a dry run into a temp copy that BOOTS
A REAL STORE and compares every entity, and only then the swap. `diagrams.bak` is never deleted by
this script — it is the rollback, retained until CS6 closes.

Usage:  node tools/migrate-version.mjs [--data <dir>] [--port <n>] [--dry-run]
*/

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// the store's own regex (server/store.js), NOT a glob: a glob would sweep up hand-made files
// that the store itself would never load, and migrate them into a shape nothing reads.
const FILE = /^diagram-[0-9a-f]{6}\.json$/;

// ---- the pure transform ----

/*
Returns the migrated document VALUE. Never touches disk, never mutates its input — so the dry run
and the real run transform identically by construction, rather than by two code paths agreeing.

`log` is the file's own persisted log block (null when the file predates CS2). version comes from
there and nowhere else: meta.rev is a render counter and seeding from it would fabricate a
transaction history that never happened.
*/
export function migrateDoc(doc, log) {
	const { rev, grid, ...meta } = doc.meta || {};
	const persisted = Number.isInteger(log?.version) ? log.version : 0;
	// a log whose top record sits above the recorded version would re-mint a live seq (Log.from
	// makes the same correction on load) — take the high-water mark, not the smaller number
	const top = Array.isArray(log?.records) && log.records.length
		? log.records[log.records.length - 1]?.seq ?? 0 : 0;
	return {
		...doc,
		meta: {
			id: meta.id,
			name: meta.name,
			version: Math.max(persisted, Number.isInteger(top) ? top : 0),
			schema: 1,
			slides: {
				url: meta.slides?.url ?? '',
				presentationId: meta.slides?.presentationId ?? '',
				pageId: meta.slides?.pageId ?? '',
			},
		},
	};
}

/*
The comparison the gate actually rests on.

Canonical form of everything the migration must NOT touch: every entity of every kind, the
selection, and the meta fields that carry identity. Object keys are sorted recursively so a
reserialization that reorders keys does not read as a change, and collections are sorted by id
so a load that reorders them does not either.
*/
export function invariant(doc) {
	const canon = (v) => {
		if (Array.isArray(v)) return v.map(canon);
		if (v && typeof v === 'object') {
			return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
		}
		return v;
	};
	const byId = (list) => [...(list || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
	return JSON.stringify(canon({
		id: doc.meta?.id,
		name: doc.meta?.name,
		slides: doc.meta?.slides ?? {},
		nodes: byId(doc.nodes), waypoints: byId(doc.waypoints), links: byId(doc.links),
		zones: byId(doc.zones), groups: byId(doc.groups),
		selection: [...(doc.selection || [])].sort(),
	}));
}

// ---- the driver ----

const flag = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);
const die = (msg) => { console.error(`\n  ✗ ${msg}\n`); process.exit(1); };

// 1. A live server would revert every migrated file on its next debounce tick or SIGTERM flush,
//    from a memory image of the OLD shape. There is no writer interlock, so this is the interlock.
async function refuseIfServing(port) {
	try {
		const res = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(1500) });
		if (res.ok) {
			const body = await res.json().catch(() => ({}));
			die(`a server is answering /health on port ${port} (${body.diagrams} diagram(s)).\n`
				+ `    Stop it first — its next flush would overwrite every migrated file from memory.`);
		}
	} catch { /* nothing listening: this is the state we require */ }
}

async function main() {
	const dataDir = path.resolve(flag('data', 'diagrams'));
	const port = flag('port', process.env.PORT || '8080');
	const dryOnly = has('dry-run');

	if (!fs.existsSync(dataDir)) die(`no such data directory: ${dataDir}`);
	await refuseIfServing(port);

	const files = fs.readdirSync(dataDir).filter((f) => FILE.test(f));
	if (!files.length) die(`no files matching ${FILE} in ${dataDir}`);
	console.log(`\n  ${files.length} diagram file(s) in ${dataDir}`);

	// 2. transform into a temp copy — the live directory is not touched until the dry run passes
	const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-migrate-'));
	const before = new Map();
	let already = 0;
	for (const f of files) {
		const raw = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
		const log = raw.log ?? null;
		delete raw.log;
		if ('version' in (raw.meta || {}) && !('rev' in (raw.meta || {}))) already++;
		before.set(raw.meta?.id ?? f, invariant(raw));
		const migrated = migrateDoc(raw, log);
		const out = log ? { ...migrated, log } : migrated;
		fs.writeFileSync(path.join(staging, f), JSON.stringify(out, null, '\t') + '\n');
	}
	if (already === files.length) {
		console.log('  already migrated — nothing to do\n');
		fs.rmSync(staging, { recursive: true, force: true });
		return;
	}

	// 3. boot a REAL Store against the staged copy. This is the check that a count cannot make:
	//    it proves the new binary loads every file, and that every entity survived unchanged.
	const { Store } = await import('../server/store.js');
	const probe = new Store(staging, { flushMs: 3_600_000 });
	try {
		probe.init();
	} catch (err) {
		die(`the migrated corpus does not boot: ${err.message}\n    ${dataDir} is untouched.`);
	}
	if (probe.list().length !== files.length) {
		die(`booted ${probe.list().length} diagram(s), expected ${files.length}. ${dataDir} is untouched.`);
	}
	for (const { id } of probe.list()) {
		const loaded = probe.get(id).toJSON();
		if (!before.has(id)) die(`booted an id that was not in the source: ${id}`);
		if (invariant(loaded) !== before.get(id)) {
			die(`${id}: an entity changed across the migration. ${dataDir} is untouched.\n`
				+ `    before: ${before.get(id).slice(0, 200)}\n    after:  ${invariant(loaded).slice(0, 200)}`);
		}
		// GR9's extended post-condition: the document's version and its log's version agree
		const logVersion = probe.diagrams.get(id).log.version;
		if (loaded.meta.version !== logVersion) {
			die(`${id}: meta.version ${loaded.meta.version} !== log.version ${logVersion}`);
		}
	}
	console.log(`  ✓ dry run: ${probe.list().length} diagram(s) boot, every entity deep-equal, version === log.version`);

	if (dryOnly) {
		console.log(`  dry run only — ${dataDir} untouched. Staged output: ${staging}\n`);
		return;
	}

	// 4. the backup is the ONLY rollback, so it is taken before the swap and never removed here
	const backup = `${dataDir}.bak`;
	if (fs.existsSync(backup)) {
		console.log(`  ${backup} already exists — kept as-is (an earlier run's rollback is not overwritten)`);
	} else {
		fs.mkdirSync(backup, { recursive: true });
		for (const f of fs.readdirSync(dataDir)) fs.copyFileSync(path.join(dataDir, f), path.join(backup, f));
		console.log(`  ✓ backup: ${backup}`);
	}

	// 5. swap
	for (const f of files) fs.copyFileSync(path.join(staging, f), path.join(dataDir, f));
	fs.rmSync(staging, { recursive: true, force: true });
	console.log(`  ✓ migrated ${files.length} file(s) in place`);
	console.log(`\n  ROLLBACK: cp ${backup}/*.json ${dataDir}/   (and check out the pre-CS5 binary)`);
	console.log('  Retained until CS6 closes. Do not delete it.\n');
}

// importable for tests; runs only when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) await main();
