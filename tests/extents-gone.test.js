/*
H26.6's move 11 (dev/design/components/PAN-ZOOM.md 5.1 row 11, section 3.8, "The extents"; appendix A's move 11 rows; GR3) -- THE EDITOR'S
EXTENT GONE: a device dragged, a zone resized -- by a corner and by Shift and the arrows -- a device stamped, pasted, duplicated and wrapped
in a zone, and a waypoint placed at the pointer (`snapNode`'s cell), each 2,000 units beyond each former edge, through
draw's real Input and capture on the gesture corpus's harness (tests/fixtures/client-harness.mjs `makeInput`), whose root answers an identity
transform, so a pointer's screen point is its drawing point. Draw has no paste: its copy-and-place is the clone drag, Ctrl and a drag, which
is what "pasted" is read as here (PAN-ZOOM.md appendix B, move 11). The old frame held a device within 900 by 480 of the origin and a zone
within 930 by 510; past PZ31's bound the planner refuses, the editor clamping nothing.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, pointer, key, seedNodes, GROUND } from './fixtures/client-harness.mjs';

// each former edge, and the first lattice point at least 2,000 units beyond it: a device's on the node lattice (900 + 2,040, 480 + 2,040),
// a zone corner's on the zone lattice (930 + 2,040, 510 + 2,040)
const DEVICE = [['east', 2940, 0], ['west', -2940, 0], ['south', 0, 2520], ['north', 0, -2520]];
const ZONE = [['east', 'se', 2970, 150], ['south', 'se', 150, 2550], ['west', 'nw', -2970, -150], ['north', 'nw', -150, -2550]];
const at = (h, id) => { const n = h.model.get('node', id); return [n.x, n.y]; };
const refused = (h) => h.calls.filter((c) => c.name === 'readout.flash' && /refused|no room/.test(String(c.args[0])));

for (const [edge, x, y] of DEVICE) {
	test(`H26.6 move 11, GR3: a device dragged 2,000 units beyond the old ${edge} edge lands there`, () => {
		const h = makeInput();
		try {
			const [d] = seedNodes(h.model, [[0, 0, 'router']]);
			h.capture.onDown(pointer(0, 0, { button: 2, buttons: 2, target: h.at(d.id) }));
			h.capture.onMove(pointer(x / 2, y / 2, { button: -1, buttons: 2 }));
			h.capture.onMove(pointer(x, y, { button: -1, buttons: 2 }));
			h.capture.onUp(pointer(x, y, { button: 2, buttons: 0 }));
			assert.deepEqual([at(h, d.id), h.commits.length, refused(h)], [[x, y], 1, []], 'moved, one commit, nothing refused');
		} finally { h.restore(); }
	});

	test(`H26.6 move 11, GR3: a device stamped 2,000 units beyond the old ${edge} edge lands where it was clicked`, () => {
		const h = makeInput();
		try {
			h.tools.setHand('router');
			h.capture.onDown(pointer(x + 7, y - 9, { target: GROUND }));
			h.capture.onUp(pointer(x + 7, y - 9, { target: GROUND, buttons: 0 }));
			const made = h.model.all('node');
			assert.deepEqual([made.length, made.map((n) => [n.x, n.y])[0], refused(h)], [1, [x, y], []], 'stamped on the cell clicked, not at the old edge');
		} finally { h.restore(); }
	});

	test(`H26.6 move 11, GR3: a device pasted -- cloned by Ctrl and a drag -- 2,000 units beyond the old ${edge} edge lands there`, () => {
		const h = makeInput();
		try {
			const [d] = seedNodes(h.model, [[0, 0, 'router']]);
			h.capture.onDown(pointer(0, 0, { ctrlKey: true, target: h.at(d.id) }));
			h.capture.onMove(pointer(x / 2, y / 2, { ctrlKey: true }));
			h.capture.onMove(pointer(x, y, { ctrlKey: true }));
			h.capture.onUp(pointer(x, y, { ctrlKey: true, buttons: 0 }));
			const copy = h.model.all('node').find((n) => n.id !== d.id);
			assert.deepEqual([at(h, d.id), copy && [copy.x, copy.y], refused(h)], [[0, 0], [x, y], []], 'the original kept, the copy where it was dropped');
		} finally { h.restore(); }
	});

	test(`H26.6 move 11, GR3: a device 2,000 units beyond the old ${edge} edge duplicated (Ctrl+D) lands a cell further on`, () => {
		const h = makeInput();
		try {
			const [d] = seedNodes(h.model, [[x, y, 'router']]);
			h.selection.set([d.id]);
			h.capture.onKeyDown(key('d', { ctrlKey: true }));
			const copy = h.model.all('node').find((n) => n.id !== d.id);
			assert.deepEqual([copy && [copy.x, copy.y], refused(h)], [[x + 60, y], []], 'at the remembered pitch, one cell right -- no edge to refuse it');
		} finally { h.restore(); }
	});
}

// `z` wraps the selection in a zone on the zone lattice, which repeats every 60 units: a device past each old edge is wrapped by the zone
// it is wrapped by at the origin, moved by as much -- not the zone the old frame clamped it to
for (const [edge, x, y] of DEVICE) {
	test(`H26.6 move 11, GR3: a device 2,000 units beyond the old ${edge} edge wrapped in a zone (z) is wrapped where it is`, () => {
		const wrapped = (px, py) => {
			const h = makeInput();
			try {
				const [d] = seedNodes(h.model, [[px, py, 'router']]);
				h.selection.set([d.id]);
				h.capture.onKeyDown(key('z'));
				const zones = h.model.all('zone');
				assert.deepEqual([zones.length, refused(h)], [1, []], 'one zone made, nothing refused');
				const { x: zx, y: zy, w, h: zh } = zones[0];
				return { x: zx, y: zy, w, h: zh };
			} finally { h.restore(); }
		};
		const home = wrapped(0, 0);
		assert.deepEqual(wrapped(x, y), { ...home, x: home.x + x, y: home.y + y }, 'the origin\'s wrap, moved with the device');
	});
}

// `w` with nothing held places a waypoint on the node lattice's cell under the pointer (`snapNode`), as the hand's ghost and the readout
// name it -- the old frame pulled that cell back to its edge
for (const [edge, x, y] of DEVICE) {
	test(`H26.6 move 11, GR3: a waypoint placed by w 2,000 units beyond the old ${edge} edge lands on the cell under the pointer`, () => {
		const h = makeInput();
		try {
			h.capture.onMove(pointer(x + 7, y - 9));
			h.capture.onKeyDown(key('w'));
			const made = h.model.all('node');
			assert.deepEqual([made.length, made[0] && !made[0].type, made[0] && [made[0].x, made[0].y]], [1, true, [x, y]], 'a bare anchor on the cell under the pointer');
		} finally { h.restore(); }
	});
}

// Shift and an arrow on a lone zone grow it a cell, its NW corner fixed (ZONE_SIZE_STEP): a zone whose far corner sits on the old frame,
// 930 by 510, grown 34 cells right and 34 down, reaches 2,040 past each edge -- the old step stopped at the frame
test('H26.6 move 11, GR3: a zone grown by Shift and the arrows from the old frame\'s corner reaches 2,000 units beyond its east and south edges', () => {
	const h = makeInput();
	try {
		h.model.put('zone', { id: 'zone-0e0002', name: 'z', x: 870, y: 450, w: 60, h: 60 });
		h.selection.set(['zone-0e0002']);
		for (let i = 0; i < 34; i++) h.capture.onKeyDown(key('ArrowRight', { shiftKey: true }));
		for (let i = 0; i < 34; i++) h.capture.onKeyDown(key('ArrowDown', { shiftKey: true }));
		h.history.flush();
		const z = h.model.get('zone', 'zone-0e0002');
		assert.deepEqual([z.x, z.y, z.x + z.w, z.y + z.h, refused(h)], [870, 450, 2970, 2550, []], 'grown past the old edge, its NW corner kept');
		assert.equal(h.soleCommit().label, 'resize', 'one resize, the burst coalesced');
	} finally { h.restore(); }
});

for (const [edge, corner, x, y] of ZONE) {
	test(`H26.6 move 11, GR3: a zone resized by its ${corner} corner 2,000 units beyond the old ${edge} edge reaches there`, () => {
		const h = makeInput();
		try {
			h.model.put('zone', { id: 'zone-0e0001', name: 'z', x: -150, y: -150, w: 300, h: 300 });
			h.selection.set(['zone-0e0001']);
			const from = corner === 'se' ? [150, 150] : [-150, -150], target = { key: 'handles', where: { 'data-corner': corner } };
			h.capture.onDown(pointer(...from, { target: h.at(target) }));
			h.capture.onMove(pointer(x, y));
			h.capture.onUp(pointer(x, y, { buttons: 0 }));
			const z = h.model.get('zone', 'zone-0e0001');
			const want = corner === 'se' ? { x: -150, y: -150, w: x + 150, h: y + 150 } : { x, y, w: 150 - x, h: 150 - y };
			assert.deepEqual([{ x: z.x, y: z.y, w: z.w, h: z.h }, refused(h)], [want, []], 'its dragged corner where it was dropped, the opposite one kept');
		} finally { h.restore(); }
	});
}

// the drag held no edge before the move only by clamping; past PZ31's bound the planner refuses -- the editor clamps nothing (3.8)
test('H26.6 move 11, PZ31: a device dragged past the bound is refused by the planner, the editor clamping nothing, and stays where it was', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[999_900, 0, 'router']]);
		h.capture.onDown(pointer(999_900, 0, { button: 2, buttons: 2, target: h.at(d.id) }));
		h.capture.onMove(pointer(1_000_020, 0, { button: -1, buttons: 2 }));
		h.capture.onUp(pointer(1_000_020, 0, { button: 2, buttons: 0 }));
		assert.deepEqual(at(h, d.id), [999_900, 0], 'refused, the device where it was');
		h.capture.onDown(pointer(999_900, 0, { button: 2, buttons: 2, target: h.at(d.id) }));
		h.capture.onMove(pointer(999_960, 0, { button: -1, buttons: 2 }));
		h.capture.onUp(pointer(999_960, 0, { button: 2, buttons: 0 }));
		assert.deepEqual(at(h, d.id), [999_960, 0], 'to 999,960, within it -- the control');
	} finally { h.restore(); }
});
