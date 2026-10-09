/*
C-f, step one (H19.34; dev/design/unification/CANVAS-PLUGINS.md; the director: "clearing the three small first") -- THE LAST SMALL
NAMES OUT OF THE CANVAS: run mode's regions, the header's counts, the hover ring.

  regions   what run mode reads under a press is read off what the parts say they draw (`drawn`, page selectors) and what a run
            press aims at (`runTargets` -- the network's waypoint); capture named the classes (`.waypoint`, `.node`, ...)
  tally     the header's counts, each part's (`tally`: a rank, a word, a count) -- devices, links, zones, in that order
  idle      the state an item shows idle under the pointer is its pick's (`idle`) -- a device's crosshair ring; the canvas named
            the class and the kind
Nothing a user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { makeZone } from '../zones/make-zone.mjs';
import { makeWaypoint } from '../devices/make-node.mjs';
import { makeLink } from '../network/link-queries.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// a target answering a selector list as a page would: any of its classes in the list
const target = (classes, id = null) => ({ tagName: 'g', id, dataset: {}, classList: { contains: (c) => classes.includes(c) },
	closest: (sel) => (sel.split(',').map((s) => s.trim().replace(/^\./, '')).some((s) => classes.includes(s)) ? { id } : null) });

test('C-f: in run mode a press on a zone places no tower; on open ground it does -- the state under test', () => {
	const h = makeInput();
	try {
		const z = makeZone(h.model, { x: 150, y: 150, w: 240, h: 180 }); h.model.put('zone', z);
		h.renderer.mode = 'run';
		const towers = () => h.model.all('node').filter((n) => n.type === 'loadbalancer').length;
		h.capture.onDown(pointer(240, 240, { target: target(['zone'], z.id) })); h.capture.onUp(pointer(240, 240));
		assert.equal(towers(), 0, 'on a zone: nothing');
		h.capture.onDown(pointer(-240, -240)); h.capture.onUp(pointer(-240, -240));
		assert.equal(towers(), 1, 'on open ground: a tower');
	} finally { h.restore(); }
});

test('C-f: without the zones plugin, a press on what it would have drawn is open ground', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'zones') });
	try {
		h.renderer.mode = 'run';
		h.capture.onDown(pointer(240, 240, { target: target(['zone'], 'zone-0c0f01') })); h.capture.onUp(pointer(240, 240));
		assert.equal(h.model.all('node').filter((n) => n.type === 'loadbalancer').length, 1);
	} finally { h.restore(); }
});

test('C-f: the header counts each part\'s items -- devices, links, zones -- and a waypoint is no device', async () => {
	const { tallyOf } = await import('../app/src/compose-canvas.js');
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
		const w = makeWaypoint(h.model, { x: 120, y: 120 }); h.model.put('node', w);
		h.model.put('link', makeLink(h.model, a.id, b.id));
		h.model.put('zone', makeZone(h.model, { x: 330, y: 330, w: 120, h: 60 }));
		assert.equal(tallyOf(PRODUCT_CANVAS, h.model), '2 nodes / 1 links / 1 zones');
		assert.equal(tallyOf(PRODUCT_CANVAS.filter((p) => p.owner !== 'zones'), h.model), '2 nodes / 1 links');
	} finally { h.restore(); }
});

test('C-f: idle over a device it shows the crosshair ring, which Ctrl drops; over a waypoint, none -- the state under test', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[0, 0]]);
		const w = makeWaypoint(h.model, { x: 240, y: 0 }); h.model.put('node', w);
		const ring = (id) => h.stateCalls('renderer.setState').filter(([x, cls]) => x === id && cls === 'linkband').map(([, , on]) => on);
		const over = (word, id, mod = {}) => pointer(0, 0, { buttons: 0, target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes(word) ? { id } : null) }, ...mod });
		h.capture.onMove(over('node', d.id));
		h.capture.onMove(over('node', d.id, { ctrlKey: true }));
		assert.deepEqual(ring(d.id), [true, false]);
		h.capture.onMove(over('waypoint', w.id));
		assert.deepEqual(ring(w.id), []);
	} finally { h.restore(); }
});

test('C-f: capture, the header and the hover name no plugin\'s kind or class', () => {
	assert.doesNotMatch(code('app/src/capture.js'), /'\.waypoint'|'\.node'|\.zone|\.group/);
	assert.doesNotMatch(code('app/src/main.js'), /typedNodes|model\.all\('link'\)|model\.all\('zone'\)/);
	assert.doesNotMatch(code('app/src/input.js'), /'linkband'|hit\.kind !== 'node'|region\?\.waypoint/);
	assert.doesNotMatch(code('app/src/overlay.js'), /'linkband'/);
});
