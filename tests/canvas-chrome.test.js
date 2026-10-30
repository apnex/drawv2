/*
C-f, step one (H19.34; dev/design/unification/CANVAS-PLUGINS.md; the director: "clearing the three small first") -- THE LAST SMALL
NAMES OUT OF THE CANVAS: run mode's regions, the header's counts, the hover ring.

  regions   what run mode reads under a press is read off what the parts say they draw (`drawn`, page selectors) and what a run
            press aims at (`runTargets` -- the network's waypoint); capture named the classes (`.waypoint`, `.node`, ...)
  tally     the header's counts, each part's (`tally`: a rank, a word, a count) -- devices, links, zones, in that order
  idle      the state an item shows idle under the pointer is its pick's (`idle`) -- a device's crosshair ring; the canvas named
            the class and the kind
Nothing a user sees changes.
RESTATED H26.8 (NATIVE-SHAPES.md appendix A, a:F12): a state is observed as `states.setState` and `states.clearState` -- the editing
states' calls (app/src/editing-states.js), recorded by the harness's forwarding spies with the same arguments, the renderer's until the move.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { makeZone } from '../plugins/zones/make-zone.mjs';
import { makeWaypoint } from '../plugins/devices/make-node.mjs';
import { makeLink } from '../plugins/network/link-queries.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// RESTATED at H26.8's picks move: each press lands on the element the harness's renderer drew (`h.at`), read by item, where a stand-in
// answered a selector list by its classes; and run mode is drawn (`setMode`)

test('C-f: in run mode a press on a zone places no tower; on open ground it does -- the state under test', () => {
	const h = makeInput();
	try {
		const z = makeZone(h.model, { x: 150, y: 150, w: 240, h: 180 }); h.model.put('zone', z);
		h.renderer.setMode('run');
		const towers = () => h.model.all('node').filter((n) => n.type === 'loadbalancer').length;
		h.capture.onDown(pointer(240, 240, { target: h.at({ key: z.id, where: { class: 'zone-rect' } }) })); h.capture.onUp(pointer(240, 240));
		assert.equal(towers(), 0, 'on a zone: nothing');
		h.capture.onDown(pointer(-240, -240)); h.capture.onUp(pointer(-240, -240));
		assert.equal(towers(), 1, 'on open ground: a tower');
	} finally { h.restore(); }
});

test('C-f: without the zones plugin, a press on what it would have drawn is open ground', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'zones') });
	try {
		// the zone in the document, drawn by no part: a press where it would be lands on open ground (H26.8's picks move restated it so)
		h.model.put('zone', { id: 'zone-0c0f01', name: 'z', x: 150, y: 150, w: 240, h: 180 });
		assert.throws(() => h.at('zone-0c0f01'), /drew no element/, 'precondition: no part draws it');
		h.renderer.setMode('run');
		h.capture.onDown(pointer(240, 240)); h.capture.onUp(pointer(240, 240));
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
		const ring = (id) => h.stateCalls('states.setState').filter(([x, cls]) => x === id && cls === 'linkband').map(([, , on]) => on);
		const over = (id, mod = {}) => pointer(0, 0, { buttons: 0, target: h.at(id), ...mod });
		h.capture.onMove(over(d.id));
		h.capture.onMove(over(d.id, { ctrlKey: true }));
		assert.deepEqual(ring(d.id), [true, false]);
		h.capture.onMove(over(w.id));
		assert.deepEqual(ring(w.id), []);
	} finally { h.restore(); }
});

test('C-f: capture, the header and the hover name no plugin\'s kind or class', () => {
	assert.doesNotMatch(code('app/src/capture.js'), /'\.waypoint'|'\.node'|\.zone|\.group/);
	assert.doesNotMatch(code('app/src/main.js'), /typedNodes|model\.all\('link'\)|model\.all\('zone'\)/);
	assert.doesNotMatch(code('app/src/input.js'), /'linkband'|hit\.kind !== 'node'|region\?\.waypoint/);
	assert.doesNotMatch(code('app/src/overlay.js'), /'linkband'/);
});
