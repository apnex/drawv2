/*
The read-only display surface -- the readout -- over routed links. B29 / H3.5.

The readout resolved a link's endpoints with `get('node')` and went blind the moment an anchor was
a waypoint, printing `? <-> ?`.

The data view had the same defect and a sharper one -- it reported `dist(src, dst)`, the
straight-line distance, ignoring every bend. Those two tests left with the feature: the X-ray was
deleted rather than fixed again, because it was never properly useful. The threaded-length rule it
was measured against lives on in `Model#pathOf`, which `tests/model.test.js` holds and which the
`draw link path` route now exposes.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { Selection } from '../app/src/selection.js';
import { Readout } from '../app/src/readout.js';
import { installDom } from './fixtures/client-harness.mjs';

// a right-angle route: (0,0) → bend (60,60) → (120,0). Straight-line 120; threaded 2·√7200 ≈ 169.7.
function routed() {
	const m = new Model();
	const a = m.makeNode('host', { x: 0, y: 0 });
	const b = m.makeNode('host', { x: 120, y: 0 });
	const w = m.makeWaypoint({ x: 60, y: 60 });
	[['node', a], ['node', b], ['waypoint', w]].forEach(([k, e]) => m.put(k, e));
	const link = { ...m.makeLink(a.id, b.id), via: [w.id] };
	m.put('link', link);
	return { m, a, b, w, link };
}

test('readout: a link between two nodes names both', () => {
	const { m, a, b } = routed();
	const sel = new Selection(m);
	const r = new Readout({ model: m, selection: sel, elements: [] });
	const l = m.makeLink(a.id, b.id);
	m.put('link', l);
	sel.set([l.id]);
	/*
	B229 -- the bar was a hardcoded arrow and is now the DECLARED DIRECTION, so this asserted a
	character that no longer appears. The property it was protecting is unchanged: a selected link
	names both of its ends. What it must not do again is pin the separator, which said the same
	thing whichever way the link flowed.
	*/
	assert.match(r.selectionText(), /<->/, 'an undeclared link is symmetric, and says so');
	assert.ok(!r.selectionText().includes('?'), 'both ends resolved');

	m.put('link', { ...m.get('link', l.id), flow: true });
	assert.match(r.selectionText(), />>>/, 'and a declared one says which way');
});

test('B29: readout names a WAYPOINT endpoint instead of printing `?`', () => {
	const { m, a, w } = routed();
	const sel = new Selection(m);
	const r = new Readout({ model: m, selection: sel, elements: [] });
	const l = m.makeLink(a.id, w.id);
	m.put('link', l);
	sel.set([l.id]);
	const text = r.selectionText();
	assert.ok(!text.includes('?'), `a waypoint is a live anchor, not an unknown: got "${text}"`);
});



/*
B40 — one owner for the content-region arithmetic.

The two renderers stay (different duties: live addressable elements for editing vs a complete
document for `/d/:id.svg`), but the socket-grid union, the alignment mapping, the padding and the
greedy wrap were byte-identical in both. They agreed on the day they were written; nothing would
have failed on the day they stopped.

The invariant worth pinning is not "the function exists" — it is that both renderers place text at
the SAME coordinates. That is what the copy silently threatened and what a shared owner guarantees.
*/

import { contentLayout, renderContentRegion } from '../kernel/index.mjs';

const REGIONS = [
	{ at: [0, 0], cols: 1, rows: 1, content: 'text', value: 'hi' },
	{ at: [0, 0], cols: 3, rows: 2, content: 'text', value: 'the quick brown fox jumps over the lazy dog', align: 'left' },
	{ at: [1, 2], cols: 2, rows: 3, content: 'text', value: 'wrap me across several lines please', align: 'right' },
	{ at: [0, 0], cols: 2, rows: 1, content: 'text', value: '', align: 'center' },
	{ at: [0, 0], cols: 4, rows: 4, content: 'text', value: 'x '.repeat(60), fill: '#ff0000' },
];

test('B40: the kernel renderer emits text at exactly the coordinates contentLayout computes', () => {
	for (const r of REGIONS) {
		const layout = contentLayout(r);
		const svg = renderContentRegion(r);
		const ys = [...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
		assert.equal(ys.length, layout.lines.length, `line count for ${JSON.stringify(r.value).slice(0, 30)}`);
		ys.forEach((p, i) => {
			assert.equal(p.x, layout.tx, 'x follows the shared alignment');
			assert.equal(p.y, layout.lines[i].y, 'y follows the shared wrap');
		});
	}
});

test('B40: the wrap is deterministic and centred on the box', () => {
	const l = contentLayout({ at: [0, 0], cols: 3, rows: 3, content: 'text', value: 'alpha beta gamma delta epsilon zeta' });
	assert.ok(l.lines.length > 1, 'it wrapped');
	const ys = l.lines.map((x) => x.y);
	const mid = (ys[0] + ys[ys.length - 1]) / 2;
	assert.equal(mid, l.cy, 'the block is centred on the region, however many lines it has');
	/*
	UNIFORM, not 18. The line height was pinned at the value it had for size 15, so H15.18 making
	it a ratio of the size broke this for a change that was correct. What B40 protects is that the
	lines are evenly spaced and the block is centred -- the spacing is whatever the size implies.
	*/
	const gaps = ys.slice(1).map((y, i) => y - ys[i]);
	assert.ok(gaps.length > 0, 'it wrapped, so there are gaps to compare');
	// compared with a tolerance: the spacing is now DERIVED from the size, so the gaps differ in
	// the last floating-point place. An exact comparison would fail on arithmetic rather than on
	// the property, which is that the lines are evenly spaced.
	for (const g of gaps) assert.ok(Math.abs(g - gaps[0]) < 1e-9, 'uniform line height, whatever the size sets it to');
	assert.ok(gaps[0] > l.size, 'and the lines are spaced wider than the glyphs are tall');
});

test('B40: an empty region still yields one placed line, so no caller re-implements rows<=1', () => {
	const l = contentLayout({ at: [0, 0], cols: 1, rows: 1, content: 'text', value: null });
	assert.deepEqual(l.lines, [{ text: '', y: l.cy }]);
});
