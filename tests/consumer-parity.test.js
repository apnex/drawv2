// P4 R-e (H18.23) -- EVERY PATH CONSUMER DRAWS THE ROUTE THE TAB DRAWS (PROMOTION.md section 6, P4's exit criterion; section 7,
// criterion 4 but for the product page, which is P5). One board, read through every door: the lab's tab, REST and the CLI,
// the SVG download, `draw movers`; each held to the lab's derivation. dev/design/unification/CONSUMERS-ROUTE.md, stage R-e.

import { test } from 'node:test';
import { KINDS } from './fixtures/composed.mjs';   // O-b1: a reader is handed its caller's kinds
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Model } from '../model/model.mjs';
import { productKinds } from '../product/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { createNetworkSession } from '../network/session.mjs';
import { pipeEntity } from '../network/pipe-kind.mjs';
import { readModel, linkReading } from '../network/read-model.mjs';
import { spawnersOf } from '../engine/spawners.mjs';
import { svgDocument } from '../server/svg.mjs';
import { serialize, parse } from '../server/docfile.mjs';
import { Renderer } from '../app/src/renderer.js';
import { makeRenderer } from './fixtures/client-harness.mjs';
import { makeApp } from './fixtures/app.mjs';
import { main } from '../cli/draw.mjs';

const ID = 'diagram-0c0001';
const since = Date.now() - 1000;
const spawn = { interval: 700, speed: 1.4, kind: 'packet', since };
/*
Every shape a link takes:
  routed   a -> c, plain, whose route bends up through f, a waypoint its stops never name
  held     a -> f, younger, down: its pipe is the routed link's (2026-09-30), so it is held by it
  armed    s -> a, up, with a spawner at s
  quiet    t -> c, down with no way at all, with a spawner at t
  ring     p -> q -> r -> p, closed, along its stops
and a hand pipe c - d no link runs over.
*/
const board = () => ({
	meta: { id: ID, name: 'parity', version: 0, schema: 2 },
	nodes: [
		{ id: 'node-0c00a1', name: 'a', type: 'host', shape: 'square', x: -360, y: 0, order: 1 },
		{ id: 'node-0c00a2', name: 'c', type: 'host', shape: 'square', x: 360, y: 0, order: 2 },
		{ id: 'node-0c00a3', name: 'd', type: 'host', shape: 'square', x: 360, y: 240, order: 3 },
		{ id: 'node-0c00f1', name: 'f', x: 0, y: -240, order: 4 },
		{ id: 'node-0c00e1', name: 's', x: -360, y: 240, spawn, order: 5 },
		{ id: 'node-0c00e2', name: 't', x: 120, y: 240, spawn, order: 6 },
		{ id: 'node-0c00b1', name: 'p', x: -600, y: -360, order: 7 },
		{ id: 'node-0c00b2', name: 'q', x: -360, y: -360, order: 8 },
		{ id: 'node-0c00b3', name: 'r', x: -480, y: -180, order: 9 },
	],
	links: [
		{ id: 'link-0c0001', name: 'routed', src: 'node-0c00a1', dst: 'node-0c00a2', order: 1 },
		{ id: 'link-0c0002', name: 'held', src: 'node-0c00a1', dst: 'node-0c00f1', order: 2 },
		{ id: 'link-0c0003', name: 'armed', src: 'node-0c00e1', dst: 'node-0c00a1', order: 3 },
		{ id: 'link-0c0004', name: 'quiet', src: 'node-0c00e2', dst: 'node-0c00a2', order: 4 },
		{ id: 'link-0c0005', name: 'ring', src: 'node-0c00b1', dst: 'node-0c00b3', via: ['node-0c00b2'], closed: true, order: 5 },
	],
	pipes: [
		pipeEntity('node-0c00a1', 'node-0c00f1', 'hand'), pipeEntity('node-0c00a2', 'node-0c00f1', 'hand'),
		pipeEntity('node-0c00a1', 'node-0c00e1', 'link'),
		pipeEntity('node-0c00b1', 'node-0c00b2', 'link'), pipeEntity('node-0c00b2', 'node-0c00b3', 'link'), pipeEntity('node-0c00b1', 'node-0c00b3', 'link'),
		pipeEntity('node-0c00a2', 'node-0c00a3', 'hand'),
	],
	zones: [], groups: [], selection: [],
});

// THE LAB'S TAB: a Model composed as the lab composes it (lab/src/root.js), drawing with its network session
const lab = () => {
	const m = new Model({ kinds: productKinds(...NETWORK_ROWS), network: createNetworkSession().network });
	m.load(board());
	return m;
};
const LINKS = board().links.map((l) => l.id);
// what the tab says about one link, asked of the tab itself -- not through linkReading, so the readers are held to the tab, not to themselves
const tabSays = (tab, id) => {
	const l = tab.get('link', id), down = tab.isLinkDown(l);
	return { path: tab.pathOf(l), route: down ? null : tab.network.view.of(tab).route(id), down, blockers: down ? tab.blockersOf(l) : [] };
};

test('R-e: the board is what it says -- one routed off its stops, one held, one with no way, one ring', () => {
	const m = lab(), get = (id) => m.get('link', id);
	assert.deepEqual(m.pathOf(get('link-0c0001')), [[-360, 0], [0, -240], [360, 0]], 'routed through f');
	assert.deepEqual([m.isLinkDown(get('link-0c0002')), m.blockersOf(get('link-0c0002'))], [true, ['link-0c0001']], 'held by the routed link');
	assert.deepEqual([m.isLinkDown(get('link-0c0004')), m.blockersOf(get('link-0c0004'))], [true, []], 'no way at all');
	assert.equal(m.isLinkDown(get('link-0c0005')), false, 'the ring is up');
});

test('R-e: the read composition answers every link as the lab\'s tab does -- path, route, down and blockers', () => {
	const tab = lab(), read = readModel(board(), KINDS);
	for (const id of LINKS) assert.deepEqual(linkReading(read, read.get('link', id)), tabSays(tab, id), id);
});

test('R-e: REST and the CLI answer every link as the lab\'s tab does', async () => {
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-')), home = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-home-'));
	fs.writeFileSync(path.join(dataDir, `${ID}.json`), serialize(board(), null));
	const app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	const run = async (...argv) => { const out = []; await main([...argv, '--host', `http://127.0.0.1:${app.port}`], { HOME: home }, (s) => out.push(s)); return out.join(''); };
	try {
		const tab = lab();
		for (const id of LINKS) {
			const answer = JSON.parse(await run('link', 'path', id, '--diagram', ID, '--json'));
			const { link, src, dst, via, ...said } = answer;
			assert.deepEqual(said, tabSays(tab, id), `${id} through REST`);
			const about = JSON.parse(await run('about', id, '--diagram', ID, '--json'));
			assert.deepEqual([about.path, about.route, about.down, about.blockers], [said.path, said.route, said.down, said.blockers], `${id} through context`);
		}
		// draw movers: the armed link emits along its route, the quiet one -- down -- not at all
		const movers = JSON.parse(await run('movers', '--diagram', ID, '--at', String(since + 5000), '--json'));
		assert.deepEqual(movers.spawners.map((s) => s.link), ['link-0c0003'], 'one spawner emits: the one on an up link');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
});

test('R-e: the download draws every link exactly as the lab\'s tab draws it, and marks the down ones', () => {
	const { svg, restore } = makeRenderer();
	let drawn;
	try {
		const tab = lab(), r = new Renderer(tab, svg);
		for (const l of tab.all('link')) r.render('link', l);
		drawn = Object.fromEntries(svg.byId['#links'].children.filter((c) => c.attrs.class === 'link').map((c) => [c.attrs.id, { d: c.attrs.d, down: 'data-down' in c.attrs }]));
	} finally { restore(); }
	const file = svgDocument(board(), KINDS);
	for (const id of LINKS) {
		const m = file.match(new RegExp(`<g id="${id}"><path d="([^"]*)"([^>]*)/>`));
		assert.ok(m, `${id} is in the download`);
		assert.deepEqual({ d: m[1], down: /data-down/.test(m[2]) }, drawn[id], `${id}: the download's line is the tab's`);
	}
});

test('R-e: movers run along the route the tab draws, and never along a down link', () => {
	const tab = lab(), prepared = spawnersOf(readModel(board(), KINDS));
	assert.deepEqual(prepared.map((s) => s.link), ['link-0c0003']);
	// armed runs s -> a: its route from its src end
	const route = tab.pathOf(tab.get('link', 'link-0c0003'));
	assert.deepEqual(prepared[0].pts, route, 'along the tab\'s path, from the armed end');
});

/*
P8 Y-b (H18.43) -- PROMOTION.md section 7, criterion 3: two peers on one document derive identical routes, including after a
reload, because link ages are stored. Each peer learns the document's collections in its own order, and one reads it back from
the stored file; every link's reading agrees with the tab's. Then the two contesting links' stored orders are swapped, ids
unchanged: the other one holds the pipe -- so what decides is the stored age, not the id or the order a peer learned things in.
*/
test('criterion 3: two peers and a reload derive the same route for every link, decided by stored ages', () => {
	const reversed = () => { const d = board(); for (const k of ['nodes', 'links', 'pipes']) d[k].reverse(); return d; };
	const peers = { reversed: readModel(reversed(), KINDS), reloaded: readModel(parse(serialize(reversed(), null)).doc, KINDS) };
	const tab = lab();
	for (const [who, peer] of Object.entries(peers)) {
		for (const id of LINKS) assert.deepEqual(linkReading(peer, peer.get('link', id)), tabSays(tab, id), `${who}: ${id} as the tab derives it`);
	}
	assert.equal(tabSays(tab, 'link-0c0002').down, true, 'held, the younger of the two contesting the pipe');
	const swapped = board();
	const [routed, held] = swapped.links;
	[routed.order, held.order] = [held.order, routed.order];
	const peer = readModel(parse(serialize(swapped, null)).doc, KINDS);
	assert.equal(linkReading(peer, peer.get('link', 'link-0c0002')).down, false, 'with the ages swapped, the other link keeps the pipe');
	assert.equal(linkReading(peer, peer.get('link', 'link-0c0001')).down, true, 'and the first is held');
});
