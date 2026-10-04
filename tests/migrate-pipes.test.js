// H18.14 (S-d) -- the migration's last three steps: a shared leg split (P-4), every stored link's pipes (F2, P-3), and
// `pinned` dropped (P-5 corrected). dev/design/unification/SERVER-COMPOSES-NETWORK.md, stage S-d.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateFormatBatch } from '../server/migrate.mjs';
import { validateDoc } from './fixtures/composed.mjs';   // the network's kinds, as the store validates (S-e)
import { pipeProblems } from '../tools/migrate-schema.mjs';
import { Model, plan } from './fixtures/composed.mjs';

const node = (hex, x, y, more = {}) => ({ id: `node-${hex}`, name: `n${hex}`, type: 'host', shape: 'circle', x, y, ...more });
const way = (hex, x, y, more = {}) => ({ id: `waypoint-${hex}`, name: `w${hex}`, x, y, ...more });
const doc1 = (parts) => ({ meta: { id: 'diagram-d1d1d1', name: 'd', version: 1, schema: 1 }, nodes: [], waypoints: [], links: [], zones: [], groups: [], selection: [], ...parts });
const keyOf = (p) => `${p.a}|${p.b}`;

// a plain link, a bent link, and a ring through three waypoints -- what the estate holds
const estateLike = () => doc1({
	nodes: [node('000001', 0, 0), node('000002', 600, 0), node('000003', 0, 360)],
	waypoints: [way('0000a1', 300, 120, { pinned: true }), way('0000b1', -600, 240), way('0000b2', -300, 240), way('0000b3', -300, 480, { pinned: false })],
	links: [
		{ id: 'link-000001', name: 'plain', src: 'node-000001', dst: 'node-000002' },
		{ id: 'link-000002', name: 'bent', src: 'node-000001', dst: 'node-000003', via: ['waypoint-0000a1'] },
		{ id: 'link-000003', name: 'ring', src: 'waypoint-0000b1', dst: 'waypoint-0000b3', via: ['waypoint-0000b2'], closed: true },
	],
});

// ---- pipes ----

test('S-d: every stored link gets one link pipe per leg, a plain link and a ring\'s closing leg included', () => {
	const { doc, steps } = migrateFormatBatch(estateLike(), null);
	assert.ok(steps.includes('pipes'));
	assert.deepEqual(doc.pipes.map(keyOf).sort(), [
		'node-000001|node-000002',       // the plain link: drawn under a rule that needed no pipe, so it gets its leg
		'node-000001|node-0000a1',       // the bent link's two legs, a node's id now a waypoint's (F-c)
		'node-000003|node-0000a1',
		'node-0000b1|node-0000b2',       // the ring's three, the closing leg b3 -> b1 among them (F-f)
		'node-0000b1|node-0000b3',
		'node-0000b2|node-0000b3',
	].sort());
	for (const p of doc.pipes) assert.equal(p.laid, 'link', `${p.id} is laid with a link, so it is swept once none needs it`);
	assert.equal(doc.pipes.find((p) => p.a === 'node-000003').id, 'pipe-000003-0000a1', 'the id its ends make, lower hex first');
	assert.equal(validateDoc(doc), null, 'and the result is a valid schema 2 document');
});

test('S-d: after the migration, every link is up under the network, along exactly its stored stops', () => {
	const { doc } = migrateFormatBatch(estateLike(), null);
	const m = new Model(); m.load(doc);
	for (const l of m.all('link')) assert.equal(m.isLinkDown(l), false, `${l.name} is up`);
	assert.deepEqual(pipeProblems(doc).problems, []);
});

test('S-d: two links over one leg lay ONE pipe for it -- the pipe is the pair (SD7)', () => {
	const src = doc1({ nodes: [node('000001', 0, 0), node('000002', 600, 0)], links: [
		{ id: 'link-000001', name: 'a', src: 'node-000001', dst: 'node-000002', order: 1 },
	] });
	assert.equal(migrateFormatBatch(src, null).doc.pipes.length, 1);
});

test('S-d: a document that holds a pipe collection is the network\'s, and its links are not given pipes -- even an empty one', () => {
	const { doc } = migrateFormatBatch(estateLike(), null);
	doc.pipes = [];   // the author has since deleted every pipe: the links are down by the network's rule, not the migration's to repair
	const again = migrateFormatBatch(doc, null);
	assert.deepEqual(again.steps, []);
	assert.deepEqual(again.doc.pipes, []);
});

test('S-d: idempotent -- a migrated document passes through unchanged', () => {
	const once = migrateFormatBatch(estateLike(), null).doc;
	const twice = migrateFormatBatch(once, null);
	assert.deepEqual(twice.steps, []);
	assert.deepEqual(twice.doc, once);
});

// ---- unpin ----

test('S-d: `pinned` is dropped from every node that carries it, true or false (P-5 corrected)', () => {
	const { doc, steps } = migrateFormatBatch(estateLike(), null);
	assert.ok(steps.includes('unpin'));
	assert.equal(doc.nodes.some((n) => 'pinned' in n), false);
	assert.equal(doc.nodes.length, 7, 'the waypoints it was on are kept: they are a link\'s stops, or free and kept until deleted');
});

test('S-d: the node row no longer stores `pinned` -- a document or an edit carrying it is refused', () => {
	const { doc } = migrateFormatBatch(estateLike(), null);
	const pinnedDoc = structuredClone(doc); pinnedDoc.nodes.find((n) => !n.type).pinned = true;
	assert.notEqual(validateDoc(pinnedDoc), null, 'a document');
	const m = new Model(); m.load(doc);
	const r = plan(m, [{ op: 'set', kind: 'node', id: 'node-0000a1', patch: { pinned: true } }]);
	assert.equal(r.ok, false, 'an edit');
});

// ---- split (P-4) ----

// an older link a-b-c and a younger one x-b-c-y over the same leg b-c: the younger is cut at b and c
const shared = (younger = {}) => doc1({
	nodes: [node('000001', 0, 0), node('000002', 600, 0), node('000003', 0, 360), node('000004', 600, 360)],
	waypoints: [way('0000b1', 300, 120), way('0000b2', 300, 240)],
	links: [
		{ id: 'link-000001', name: 'older', src: 'node-000001', dst: 'node-000002', via: ['waypoint-0000b1', 'waypoint-0000b2'], order: 1 },
		{ id: 'link-000002', name: 'younger', src: 'node-000003', dst: 'node-000004', via: ['waypoint-0000b1', 'waypoint-0000b2'], order: 2, flow: true, ...younger },
	],
});

test('S-d: a younger link over an older one\'s leg is split at the leg\'s ends, the shared piece dropped (P-4)', () => {
	const { doc, steps, report } = migrateFormatBatch(shared(), null);
	assert.deepEqual(steps.slice(steps.indexOf('split'), steps.indexOf('split') + 2), ['split', 'pipes'], 'split before the pipes are laid');
	const older = doc.links.find((l) => l.id === 'link-000001');
	assert.deepEqual([older.src, ...older.via, older.dst], ['node-000001', 'node-0000b1', 'node-0000b2', 'node-000002'], 'the older is untouched');
	const pieces = doc.links.filter((l) => l.id !== 'link-000001');
	assert.deepEqual(pieces.map((l) => [l.src, ...(l.via || []), l.dst]), [['node-000003', 'node-0000b1'], ['node-0000b2', 'node-000004']], 'two pieces, ending at the junctions');
	assert.equal(pieces[0].id, 'link-000002', 'the first keeps its id');
	assert.equal(pieces[0].order, 2, 'and its order');
	assert.equal(pieces[1].order, 3, 'a new piece is the newest');
	assert.equal(pieces[1].name, 'younger-2', 'with a fresh name');
	assert.ok(pieces.every((l) => l.direction === 'forward'), 'both keep the link\'s declarations');
	assert.deepEqual(report, [{ kind: 'split', link: 'link-000002', shares: 'link-000001', leg: ['node-0000b1', 'node-0000b2'], into: ['link-000002', 'link-000003'] }]);
	assert.deepEqual(pipeProblems(doc).problems, [], 'and every link is up along its stops');
	assert.equal(validateDoc(doc), null);
});

test('S-d: the OLDER link keeps the leg -- age is drawing order, not list order or id', () => {
	const src = shared(); src.links.reverse();
	src.links[0].order = 1; src.links[1].order = 2;   // link-000002 is now the older, though listed second and the higher id
	const { doc } = migrateFormatBatch(src, null);
	assert.ok(doc.links.some((l) => l.id === 'link-000002' && l.via?.length === 2), 'order 1 is still whole');
	assert.ok(!doc.links.some((l) => l.id === 'link-000001' && l.via?.length), 'and order 2 was cut');
});

test('S-d: a ring over an older link\'s leg is cut open there, one path round its other legs -- and at a typed node inside', () => {
	// the ring n4 -> b1 -> b2 -> back to n4 shares b1-b2, its middle leg: opened, it runs b2 -> n4 -> b1, and n4 is typed
	const src = shared({ src: 'node-000004', dst: 'waypoint-0000b2', via: ['waypoint-0000b1'], closed: true });
	const { doc, report } = migrateFormatBatch(src, null);
	const pieces = doc.links.filter((l) => l.id !== 'link-000001');
	assert.ok(pieces.every((l) => !('closed' in l)), 'open');
	assert.deepEqual(pieces.map((l) => [l.src, ...(l.via || []), l.dst]), [['node-0000b2', 'node-000004'], ['node-000004', 'node-0000b1']],
		'round its other legs, cut at the router a link may not bend at');
	assert.equal(report[0].kind, 'split');
	assert.deepEqual(pipeProblems(doc).problems, []);
	assert.equal(validateDoc(doc), null);
});

test('S-d: a younger link that is NOTHING BUT the shared leg is left, reported, and fails the dry run', () => {
	const src = shared({ src: 'waypoint-0000b1', dst: 'waypoint-0000b2', via: undefined });
	delete src.links[1].via;
	const { doc, report } = migrateFormatBatch(src, null);
	assert.ok(doc.links.some((l) => l.id === 'link-000002'), 'nothing is lost');
	assert.deepEqual(report, [{ kind: 'unsplittable', link: 'link-000002', shares: 'link-000001', leg: ['node-0000b1', 'node-0000b2'] }]);
	assert.deepEqual(pipeProblems(doc).problems, ['link-000002 is down'], 'the dry run names it');
});

// ---- the dry run's pipe check ----

test('S-d dry run: a link up along another way than its stored stops is a difference', () => {
	const doc = { meta: { id: 'diagram-d1d1d1', name: 'd', version: 0, schema: 2 }, nodes: [node('000001', 0, 0), node('000002', 600, 0), { ...way('0000a1', 300, 120), id: 'node-0000a1' }],
		links: [{ id: 'link-000001', name: 'plain', src: 'node-000001', dst: 'node-000002' }], zones: [], groups: [], selection: [],
		pipes: [{ id: 'pipe-000001-0000a1', a: 'node-000001', b: 'node-0000a1', laid: 'link' }, { id: 'pipe-000002-0000a1', a: 'node-000002', b: 'node-0000a1', laid: 'link' }] };
	assert.ok(pipeProblems(doc).problems.includes('link-000001 runs node-000001,node-0000a1,node-000002, not its stops node-000001,node-000002'));
});

test('S-d dry run: a pipe no leg needed, a hand pipe, or a missing pipe is a difference', () => {
	const { doc } = migrateFormatBatch(estateLike(), null);
	const extra = structuredClone(doc); extra.pipes.push({ id: 'pipe-000002-000003', a: 'node-000002', b: 'node-000003', laid: 'link' });
	assert.ok(pipeProblems(extra).problems.includes('pipe-000002-000003 is no stored link\'s leg'));
	const hand = structuredClone(doc); hand.pipes[0].laid = 'hand';
	assert.ok(pipeProblems(hand).problems.some((p) => p.endsWith('not link')));
	const short = structuredClone(doc); short.pipes = short.pipes.filter((p) => p.id !== 'pipe-000001-000002');
	assert.ok(pipeProblems(short).problems.includes('link-000001 is down'));
});
