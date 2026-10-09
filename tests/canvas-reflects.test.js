/*
C-e, step fourteen (H19.33; dev/design/unification/CANVAS-PLUGINS.md) -- WHAT A SELECTION LIGHTS BEYOND ITSELF IS ITS PLUGIN'S TO
SAY; AND WHAT THE RENDERER DOES NOT DRAW, IT DOES NOT REMOVE.

A part declares its selection reflections (`reflects`: a class, and the ids it marks given the Model and the selection): the
network's -- a selected link's own waypoints lit, and the links blocking a selected down link (ruled 2026-09-30). The renderer
marks and unmarks them; it held both itself. And a kind the renderer draws neither by a painter nor by appearances -- the
network's pipe, which the network paints itself -- is not the renderer's to remove on a put: it did, so a pipe put again lost its
line (B322).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model as RealModel } from '../model/model.mjs';
import { KINDS } from './fixtures/composed.mjs';
import { Renderer } from '../app/src/renderer.js';
import { makeRenderer, fakeEl } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const DOWN = 'link-0c0e01', BLOCKER = 'link-0c0e02', BENT = 'link-0c0e03';
const net = { pathOf: (l, m, straight) => straight(l), linksRoutedThrough: () => [], isLinkDown: (l) => l.id === DOWN,
	blockersOf: (l) => (l.id === DOWN ? [BLOCKER] : []), declaresNoTransit: () => false, stopsAt: () => false };
const board = (parts = PRODUCT_CANVAS) => {
	const { svg, restore } = makeRenderer();
	const m = new RealModel({ kinds: KINDS, attached: { network: net } });
	const r = new Renderer(m, svg, { parts });
	const node = (id, x, y, extra = {}) => m.put('node', { id, name: id.slice(-2), x, y, ...extra });
	node('node-0c0e0a', 0, 0, { type: 'host', shape: 'circle' }); node('node-0c0e0b', 240, 0, { type: 'host', shape: 'circle' });
	node('node-0c0e0c', 0, 240, { type: 'host', shape: 'circle' }); node('node-0c0e0d', 240, 240, { type: 'host', shape: 'circle' });
	node('node-0c0e0e', 480, 0); node('node-0c0e0f', 480, 240); node('node-0c0e10', 600, 120);
	m.put('link', { id: DOWN, name: 'd', src: 'node-0c0e0a', dst: 'node-0c0e0b', order: 1 });
	m.put('link', { id: BLOCKER, name: 'b', src: 'node-0c0e0c', dst: 'node-0c0e0d', order: 2 });
	m.put('link', { id: BENT, name: 'p', src: 'node-0c0e0e', dst: 'node-0c0e0f', via: ['node-0c0e10'], order: 3 });
	const has = (id, cls) => !!svg.ownerDocument.getElementById(id)?.classList.contains(cls);
	return { m, r, svg, has, restore };
};

test('C-e: selecting a down link lights the links blocking it, and selecting elsewhere lets go -- the state under test', () => {
	const { r, has, restore } = board();
	try {
		r.reflectSelection([DOWN]);
		assert.deepEqual([has(BLOCKER, 'blocking'), has(DOWN, 'blocking')], [true, false]);
		r.reflectSelection([BENT]);
		assert.equal(has(BLOCKER, 'blocking'), false);
	} finally { restore(); }
});

test('C-e: selecting a bent link lights its own waypoints, ends and bend, and releases them -- the state under test', () => {
	const { r, has, restore } = board();
	try {
		r.reflectSelection([BENT]);
		assert.deepEqual(['node-0c0e0e', 'node-0c0e0f', 'node-0c0e10'].map((id) => has(id, 'on-selected-path')), [true, true, true]);
		assert.equal(has('node-0c0e0a', 'on-selected-path'), false, 'a device on another link: not a waypoint of this one');
		r.reflectSelection([]);
		assert.deepEqual(['node-0c0e0e', 'node-0c0e0f', 'node-0c0e10'].map((id) => has(id, 'on-selected-path')), [false, false, false]);
	} finally { restore(); }
});

test('C-e: a lit waypoint drawn afresh stays lit; a part\'s own reflection is honoured', () => {
	const probe = { owner: 'probe', reflects: [{ cls: 'probe-lit', of: (model, selected) => new Set([...selected].filter((id) => id.startsWith('node-'))) }] };
	const { m, r, has, restore } = board([...PRODUCT_CANVAS, probe]);
	try {
		r.reflectSelection([BENT, 'node-0c0e0a']);
		m.put('node', { ...m.get('node', 'node-0c0e10') });   // drawn afresh
		assert.equal(has('node-0c0e10', 'on-selected-path'), true, 'kept across a redraw');
		assert.equal(has('node-0c0e0a', 'probe-lit'), true);
		r.reflectSelection([]);
		assert.equal(has('node-0c0e0a', 'probe-lit'), false);
	} finally { restore(); }
});

// B322 -- the renderer's `draw` removed whatever element held the entity's id before drawing it, for every kind -- so a pipe, which
// the network paints itself and the renderer draws not at all, lost its line when it was put again (measured on the lab page)
test('B322: a pipe put again keeps the line the network drew for it', () => {
	const { m, svg, restore } = board();
	try {
		const pipes = fakeEl('g', 'pipes'); svg.appendChild(pipes);
		const pipe = { id: 'pipe-0c0e0a-0c0e0b', a: 'node-0c0e0a', b: 'node-0c0e0b', laid: 'hand' };
		const line = fakeEl('line'); line.setAttribute('id', pipe.id); pipes.appendChild(line);   // the network's element, as network/host.mjs draws it
		m.put('pipe', pipe);
		m.put('pipe', { ...pipe });
		assert.equal(line.parentNode, pipes, 'still where the network put it');
		assert.equal(svg.ownerDocument.getElementById(pipe.id), line);
	} finally { restore(); }
});

test('C-e: the renderer holds no selection reflection of a plugin\'s, and names no kind for it', () => {
	assert.doesNotMatch(code('app/src/renderer.js'), /reflectBlockers|reflectPathSelection|blockersOf|isLinkDown|bareAnchor|'link'|BARE_KIND|'blocking'|'on-selected-path'/);
});

// ---- the survey's last open findings (CANVAS-PLUGINS section 7) ----

test('C-e: the offline-start count counts every kind the Model holds -- a pipe too', async () => {
	const { Sync } = await import('../app/src/sync.js');
	const m = new RealModel({ kinds: KINDS, attached: { network: net } });
	m.put('pipe', { id: 'pipe-0c0e0a-0c0e0b', a: 'node-0c0e0a', b: 'node-0c0e0b', laid: 'hand' });
	assert.equal(Sync.prototype.localEntityCount.call({ model: m }), 1);
});

test('C-e: a join hands the selection to what it joined into, and the answer step and the retype rule name no kind', () => {
	assert.doesNotMatch(code('app/src/changes.js'), /'link'/);
	assert.doesNotMatch(code('app/src/releases.js'), /'waypoint'/);
	assert.doesNotMatch(code('app/src/sync.js'), /\['node', 'link', 'zone', 'group'\]/);
});
