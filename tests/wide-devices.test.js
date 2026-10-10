/*
WD-a (H19.44; dev/design/unification/WIDE-DEVICES.md, sections 5.1 and 6; WD2 revisited, WD5) -- ONE RULE AT EVERY DOOR, AND THE
POINTER DECIDES.

A wide device is one anchor (WD1). Whether another anchor may sit on a cell it covers was refused in the browser tab alone, by an
occupancy index that keyed a wide device by every cell its span covers (B323): the planner, the server and the agent door held
only one anchor to a point (B112). The index now keys an anchor by its own cell, so every door holds B112 alone and the width
exception ends; and in the tab a gesture that places at the pointer places nothing while an item is under the pointer -- a
device's frame, a waypoint's radius -- as a click landing on it already does (WD5).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, key, seedNodes } from './fixtures/client-harness.mjs';
import { Model, plan } from './fixtures/composed.mjs';
import { makeNode, makeWaypoint } from '../devices/make-node.mjs';
import { resolveAnchor } from '../server/anchor.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// a 3x1 wide device of a type, its anchor at (0, y): its covered cells (60, y) and (120, y)
const wide = (model, type, y) => { const n = { ...makeNode(model, type, { x: 0, y }), span: { cols: 3, rows: 1 } }; model.put('node', n); return n; };
const at = (h, x, y) => h.model.all('node').filter((n) => n.x === x && n.y === y);
const onDevice = (id, x, y, mod = {}) => pointer(x, y, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id } : null) }, ...mod });
const ghost = (h) => h.stateCalls('readout.setCursor').at(-1)?.[2];

for (const type of ['host', 'text']) {
	test(`WD-a: the doors agree on a ${type} panel's covered cell -- one anchor to a point, nothing more`, () => {
		const m = new Model();
		const d = wide(m, type, 0);
		const put = (x, y) => plan(m, [{ op: 'put', kind: 'node', entity: makeWaypoint(m, { x, y }) }]);
		assert.equal(put(60, 0).ok, true, 'the planner admits an anchor on a covered cell');
		assert.equal(put(0, 0).ok, false, 'and refuses one on the device\'s own anchor point (B112)');
		m.put('zone', { id: 'zone-0c1101', name: 'z', x: 30, y: -30, w: 60, h: 60 });
		assert.deepEqual((({ x, y }) => ({ x, y }))(resolveAnchor(m, { inside: 'z' })), { x: 60, y: 0 }, 'the agent door offers it');
		assert.ok(d);
	});

	test(`WD-a: over a ${type} panel's frame the placing gestures place nothing and the ghost reads blocked; just outside it they place on the covered cell`, () => {
		const h = makeInput();
		try {
			const [src] = seedNodes(h.model, [[-240, 240]]);
			wide(h.model, type, 0);
			const run = (x, y) => {
				const before = h.model.all('node').length;
				h.tools.setHand('server');
				h.capture.onMove(pointer(x, y, { buttons: 0 }));
				const blocked = ghost(h);                             // read before anything is placed there
				h.tools.setHand(null);
				h.capture.onKeyDown(key('w'));                       // an idle w
				const afterW = h.model.all('node').length;
				h.tools.setHand('server');
				h.capture.onKeyDown(key('Enter'));                   // a stamp at the pointer
				const afterEnter = h.model.all('node').length;
				h.input.stampAt({ x, y }, 'router');                 // what a palette drop calls
				const afterDrop = h.model.all('node').length;
				h.tools.setHand(null);
				h.capture.onDown(onDevice(src.id, -240, 240));       // a link drag from a device, then a digit
				h.capture.onMove(pointer(x, y));
				h.capture.onKeyDown(key('1'));
				h.input.cancelDrag();
				return { w: afterW - before, enter: afterEnter - afterW, drop: afterDrop - afterEnter, digit: h.model.all('node').length - afterDrop, blocked };
			};
			assert.deepEqual(run(60, 0), { w: 0, enter: 0, drop: 0, digit: 0, blocked: true }, 'over the frame: nothing, the ghost blocked');
			const strip = run(60, 26);
			assert.equal(strip.blocked, false, 'outside the frame and the pick, the ghost clear');
			assert.deepEqual([strip.w, strip.enter], [1, 0], 'w places a waypoint on the covered cell; Enter then meets it there');
			assert.equal(at(h, 60, 0).length, 1, 'one anchor on the covered cell');
		} finally { h.restore(); }
	});
}

test('WD-a: Enter, a drop and a digit each place on a covered cell from just outside the frame', () => {
	for (const how of ['enter', 'drop', 'digit']) {
		const h = makeInput();
		try {
			const [src] = seedNodes(h.model, [[-240, 240]]);
			wide(h.model, 'host', 0);
			h.capture.onMove(pointer(60, 26, { buttons: 0 }));
			if (how === 'enter') { h.tools.setHand('server'); h.capture.onMove(pointer(60, 26, { buttons: 0 })); h.capture.onKeyDown(key('Enter')); }
			if (how === 'drop') h.input.stampAt({ x: 60, y: 26 }, 'router');
			if (how === 'digit') { h.capture.onDown(onDevice(src.id, -240, 240)); h.capture.onMove(pointer(60, 26)); h.capture.onKeyDown(key('1')); h.input.cancelDrag(); }
			assert.equal(at(h, 60, 0).filter((n) => n.type).length, 1, `${how}: a device on the covered cell`);
		} finally { h.restore(); }
	}
});

test('WD-a: a click with a type held on a covered cell lands on the device -- a retype for a label; a select or a retype for a host', () => {
	for (const [type, held, want] of [['text', 'host', 'retype'], ['host', 'host', 'select'], ['host', 'server', 'retype']]) {
		const h = makeInput();
		try {
			const d = wide(h.model, type, 0);
			h.tools.setHand(held);
			h.capture.onDown(onDevice(d.id, 60, 0)); h.capture.onUp(onDevice(d.id, 60, 0));
			assert.equal(h.model.all('node').length, 1, `${type} with ${held}: nothing new placed`);
			assert.equal(h.model.get('node', d.id).type, want === 'retype' ? held : type, `${type} with ${held}: ${want}`);
		} finally { h.restore(); }
	}
});

test('WD-a: the index keys an anchor by its own cell -- a covered cell is free, and the index and the scan agree', async () => {
	const { attachRelations } = await import('../engine/store.mjs');
	const { cellOf } = await import('../kernel/geometry.mjs');
	const { occupiedAt } = await import('../devices/occupancy.mjs');
	const withIndex = new Model(); attachRelations(withIndex, { cellOf });
	const scan = new Model();
	for (const m of [withIndex, scan]) wide(m, 'host', 0);
	for (const p of [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 120, y: 0 }, { x: 180, y: 0 }]) {
		assert.equal(withIndex.occupiedAnyAt(p), scan.occupiedAnyAt(p), `occupiedAnyAt parity @ ${p.x}`);
		assert.equal(occupiedAt(withIndex, p), occupiedAt(scan, p), `occupiedAt parity @ ${p.x}`);
	}
	assert.equal(withIndex.occupiedAnyAt({ x: 60, y: 0 }), false, 'a covered cell holds no anchor');
	assert.equal(withIndex.occupiedAnyAt({ x: 0, y: 0 }), true);
});

test('WD-a: nothing below the plugins reads a device\'s span', () => {
	const below = ['engine/relations.mjs', ...fs.readdirSync(new URL('../model', import.meta.url)).filter((f) => f.endsWith('.mjs')).map((f) => `model/${f}`),
		...fs.readdirSync(new URL('../planner', import.meta.url)).filter((f) => /\.m?js$/.test(f)).map((f) => `planner/${f}`)];
	for (const f of below) assert.doesNotMatch(code(f), /\.span\b/, `${f} reads span`);
});

test('WD-a: the ghost says the same after a refresh -- an undo re-reads it -- as after a move', () => {
	const h = makeInput();
	try {
		wide(h.model, 'host', 0);
		h.tools.setHand('server');
		for (const [x, y, want] of [[60, 0, true], [60, 26, false]]) {
			h.capture.onMove(pointer(x, y, { buttons: 0 }));
			assert.equal(ghost(h), want, `after the move to ${x},${y}`);
			h.capture.onKeyDown(key('z', { ctrlKey: true }));   // an undo refreshes the hand, the pointer still
			assert.equal(ghost(h), want, `after the refresh at ${x},${y}`);
		}
	} finally { h.restore(); }
});
