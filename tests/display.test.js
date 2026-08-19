/*
The read-only display surfaces — the readout and the data view — over routed links. B29 / H3.5.

Both resolve a link's endpoints with `get('node')` and both therefore go blind the moment an anchor
is a waypoint: the readout prints `? ↔ ?`, the data view skips the link entirely. The data view is
wrong twice over — for the links it does show, it reports `dist(src, dst)`, the straight-line
distance, ignoring every bend in the route.

That last one is the sharpest defect in the milestone. This is a tool whose stated bar is "zero
ambiguity between intent and result — the machine states what will happen, in numbers"
(docs/spec/DESIGN.md). A confidently wrong number is worse than a missing one.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../document/index.mjs';
import { Selection } from '../app/src/selection.js';
import { Readout } from '../app/src/readout.js';
import { DataView } from '../app/src/dataview.js';
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
	assert.match(r.selectionText(), /↔/);
	assert.ok(!r.selectionText().includes('?'), 'both ends resolved');
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

test('B29: the data view reports the THREADED length of a routed link, not the straight line', () => {
	const restore = installDom();
	try {
		const { m } = routed();
		const svg = { querySelector: () => ({ appendChild: () => {}, replaceChildren: () => {} }) };
		const dv = new DataView({ model: m, svg });
		dv.active = true;                       // the overlay is Tab-toggled; off by default
		const tags = [];
		dv.tag = (x, y, text) => tags.push(text);
		dv.render();

		const threaded = Math.round(2 * Math.hypot(60, 60));   // ≈ 170
		assert.ok(tags.some((t) => t.includes(String(threaded))),
			`expected the routed length ${threaded}, got ${JSON.stringify(tags)} — 120 is the straight line, which is the bug`);
		assert.ok(!tags.some((t) => t.includes('120px') || t === '120'), 'the straight-line distance must not be reported');
	} finally { restore(); }
});

test('B29: the data view does not skip a link whose endpoint is a waypoint', () => {
	const restore = installDom();
	try {
		const { m, a, w } = routed();
		m.all('link').forEach((l) => m.del('link', l.id));
		const l = m.makeLink(a.id, w.id);
		m.put('link', l);

		const svg = { querySelector: () => ({ appendChild: () => {}, replaceChildren: () => {} }) };
		const dv = new DataView({ model: m, svg });
		dv.active = true;
		const tags = [];
		dv.tag = (x, y, text) => tags.push(text);
		dv.render();

		const len = Math.round(Math.hypot(60, 60));
		assert.ok(tags.some((t) => t.includes(String(len))), `a waypoint-ended link has a length too: ${JSON.stringify(tags)}`);
	} finally { restore(); }
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
	assert.deepEqual(ys.map((y, i) => (i ? y - ys[i - 1] : 18)), ys.map(() => 18), 'uniform line height');
});

test('B40: an empty region still yields one placed line, so no caller re-implements rows<=1', () => {
	const l = contentLayout({ at: [0, 0], cols: 1, rows: 1, content: 'text', value: null });
	assert.deepEqual(l.lines, [{ text: '', y: l.cy }]);
});
