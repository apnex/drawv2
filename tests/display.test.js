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
