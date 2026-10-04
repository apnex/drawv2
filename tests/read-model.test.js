// P4 R-a (H18.19) -- one read composition: a document as a Model that draws with the network, used by every reader, and
// each of the store's Models drawing with a network of its own. dev/design/unification/CONSUMERS-ROUTE.md, stage R-a.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readModel, readerNetwork } from '../network/read-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// a link from A to B whose route, over its pipes, bends up through a waypoint W its stops never name
const detour = () => ({
	meta: { id: 'diagram-000001', name: 'd', version: 0, schema: 2 },
	nodes: [
		{ id: 'node-00000a', name: 'A', type: 'host', shape: 'square', x: 0, y: 0 },
		{ id: 'node-00000b', name: 'B', type: 'host', shape: 'square', x: 360, y: 0 },
		{ id: 'node-00000c', name: 'W', x: 180, y: 240 },
	],
	links: [{ id: 'link-00000d', name: 'l', src: 'node-00000a', dst: 'node-00000b' }],
	pipes: [
		{ id: 'pipe-00000a-00000c', a: 'node-00000a', b: 'node-00000c', laid: 'hand' },
		{ id: 'pipe-00000b-00000c', a: 'node-00000b', b: 'node-00000c', laid: 'hand' },
	],
	zones: [], groups: [], selection: [],
});

test('R-a: readModel draws each link along its route over the pipes, not through its stops', () => {
	const m = readModel(detour());
	const l = m.get('link', 'link-00000d');
	assert.deepEqual(m.pathOf(l), [[0, 0], [180, 240], [360, 0]]);
	assert.equal(m.isLinkDown(l), false);
});

test('R-a: readModel says a link with no way is down, and draws it along its intent', () => {
	const doc = detour(); doc.pipes = [];
	const m = readModel(doc);
	const l = m.get('link', 'link-00000d');
	assert.equal(m.isLinkDown(l), true);
	assert.deepEqual(m.pathOf(l), [[0, 0], [360, 0]], 'its intent, straight between its ends (network/resolve.mjs)');
});

test('R-a: each reader gets a network of its own -- one per Model, since each caches one derivation per board', () => {
	assert.notEqual(readModel(detour()).network, readModel(detour()).network);
	assert.notEqual(readerNetwork(), readerNetwork());
});

/*
The guardrail (section 10): no consumer composes the network by hand. A reader uses readModel; a composition that plans --
the store and the lab -- composes the checked kinds, and the product page holds them until P5 draws with them (G1). Read by
source, as the incubator boundary is (tests/scan-layers.test.js).
*/
test('R-a: no module outside the network composes the network but the store, the lab, the product page, the reaction table and the route inventory', () => {
	// W-a (H18.31): the route inventory reads the collections the server composes, which REST serves
	const ALLOWED = ['server/store.js', 'lab/src/root.js', 'app/src/main.js', 'tools/reaction-table.mjs', 'tools/routes.mjs'];
	const found = [];
	const walk = (dir) => {
		for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
			const rel = path.join(dir, e.name);
			if (e.isDirectory()) { if (!['node_modules', '.git'].includes(e.name)) walk(rel); continue; }
			if (!/\.m?js$/.test(e.name)) continue;
			const src = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
			// a static import, or a dynamic one destructured (`const { NETWORK_ROWS } = await import(...)`)
			if (/\{[^}]*\b(NETWORK_ROWS|createNetwork)\b[^}]*\}\s*(from|=\s*await\s+import)/.test(src)) found.push(rel);
		}
	};
	for (const dir of ['app', 'server', 'cli', 'lab', 'tools', 'kernel', 'engine', 'model', 'planner']) walk(dir);
	assert.deepEqual(found.sort(), [...ALLOWED].sort());
});

test('R-a: a reader honours transit -- a route may not pass an anchor whose transit is off (TR-1)', () => {
	const doc = detour(); doc.nodes[2].transit = false;
	const m = readModel(doc);
	assert.equal(m.isLinkDown(m.get('link', 'link-00000d')), true, 'its only way passes W, whose transit is off');
});

test('R-a: a diagram the store boots from disk draws with the network, as one it creates does', async () => {
	const os = await import('node:os');
	const { Store } = await import('../server/store.js');
	const { serialize } = await import('../server/docfile.mjs');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'read-model-'));
	try {
		fs.writeFileSync(path.join(dir, 'diagram-000001.json'), serialize(detour(), null));
		const store = new Store(dir, { flushMs: 3_600_000, authz: false });
		await store.init();
		const m = store.diagrams.get('diagram-000001').model;
		assert.deepEqual(m.pathOf(m.get('link', 'link-00000d')), [[0, 0], [180, 240], [360, 0]]);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
P4 R-d (H18.22) -- a spawner on a down link emits nothing: a down link has no route, and its intent is no way for a mover. Held
through `spawnersOf`, which the page, `draw movers` and `draw combat` all derive spawners from.
*/
test('R-d: a spawner at the end of a down link emits nothing, and does again once the link heals', async () => {
	const { spawnersOf } = await import('../engine/spawners.mjs');
	const armed = (pipes) => {
		const doc = detour(); doc.pipes = pipes;
		doc.nodes.push({ id: 'node-00000e', name: 's', x: -240, y: 0, spawn: { interval: 700, speed: 1.4, kind: 'packet', since: Date.now() } });
		doc.links.push({ id: 'link-00000f', name: 'm', src: 'node-00000e', dst: 'node-00000a' });
		return spawnersOf(readModel(doc));
	};
	const heal = { id: 'pipe-00000a-00000e', a: 'node-00000a', b: 'node-00000e', laid: 'link' };
	assert.deepEqual(armed(detour().pipes).map((s) => s.id), [], 'm has no pipe, so it is down, and its spawner is quiet');
	assert.deepEqual(armed([...detour().pipes, heal]).map((s) => s.link), ['link-00000f'], 'with its pipe laid it is up, and emits');
});
