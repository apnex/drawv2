/*
C-e, step ten (H19.33; dev/design/unification/CANVAS-PLUGINS.md section 3: "a kind's description ... whether select-all takes
it") -- WHAT THE READOUT SAYS OF A SELECTED KIND, AND WHAT CTRL+A TAKES, ARE EACH PLUGIN'S TO DECLARE.

A part declares how its kind reads on the selection line (`describe`) and whether select-all takes it (`selectAll`, ranked so
Ctrl+A selects in the order it did: devices, zones, links); the readout's multi-selection footprint is each placed kind's size
(C-c), and the help's Ctrl+A line is phrased from the parts that declare one. Nothing a user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, key, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { helpSections } from '../app/src/help.js';
import { Readout } from '../app/src/readout.js';
import { Selection } from '../app/src/selection.js';
import { makeWaypoint } from '../devices/make-node.mjs';
import { makeZone } from '../zones/make-zone.mjs';
import { makeLink } from '../network/link-queries.mjs';
import { makeGroup } from '../groups/make-group.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const keyLines = (h) => helpSections(h.input.bindings()).find((s) => s.title === 'keys').lines;
const board = (h) => {
	const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
	const w = makeWaypoint(h.model, { x: 120, y: 120 }); h.model.put('node', w);
	const l = makeLink(h.model, a.id, b.id); h.model.put('link', l);
	const z = makeZone(h.model, { x: 330, y: 330, w: 120, h: 60 }); h.model.put('zone', z);
	const g = makeGroup(h.model, [a.id, b.id]); h.model.put('group', g);
	return { a, b, w, l, z, g };
};

test('C-e: Ctrl+A selects the devices, then the zones, then the links -- no waypoint, no group; the help says so -- the state under test', () => {
	const h = makeInput();
	try {
		const { a, b, l, z } = board(h);
		h.capture.onKeyDown(key('a', { ctrlKey: true }));
		assert.deepEqual(h.selection.list(), [a.id, b.id, z.id, l.id]);
		assert.equal(keyLines(h).find((x) => x.inputs[0] === 'Ctrl+A').label, 'select every node, zone and link');
	} finally { h.restore(); }
});

test('C-e: without the zones plugin Ctrl+A takes no zone, and its help line names none', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'zones') });
	try {
		const { a, b, l } = board(h);
		h.capture.onKeyDown(key('a', { ctrlKey: true }));
		assert.deepEqual(h.selection.list(), [a.id, b.id, l.id]);
		assert.equal(keyLines(h).find((x) => x.inputs[0] === 'Ctrl+A').label, 'select every node and link');
	} finally { h.restore(); }
});

test('C-e: the selection line reads a device, a zone and a link as each plugin describes them, and a wide device\'s footprint -- the state under test', () => {
	const h = makeInput();
	try {
		const { l, z } = board(h);
		const [a] = seedNodes(h.model, [[480, 240]]);   // ungrouped: selecting a grouped device selects its group
		const sel = new Selection(h.model);
		const r = new Readout({ model: h.model, selection: sel, elements: [], parts: PRODUCT_CANVAS });
		sel.set([a.id]); assert.match(r.selectionText(), /^\S+ \[?480, ?240\]?/, 'a device: its name and place');
		sel.set([z.id]); assert.match(r.selectionText(), /120/, 'a zone: its size too');
		sel.set([l.id]); assert.match(r.selectionText(), /<->/, 'a link: its ends and its direction');
		h.model.set('node', a.id, { span: { cols: 3, rows: 1 } });
		sel.set([a.id, z.id]);
		assert.match(r.selectionText(), /^2 selected \[?330, ?240\]? – \[?600, ?390\]?/, 'two selected, the box reaching the wide device\'s third cell (480 + 120)');
		const none = new Readout({ model: h.model, selection: sel, elements: [], parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'zones') });
		sel.set([z.id]);
		assert.equal(none.selectionText(), z.id, 'without the zones plugin a zone reads as its id');
	} finally { h.restore(); }
});

test('C-e: the canvas holds no select-all list or per-kind description of its own', () => {
	assert.doesNotMatch(code('app/src/input.js'), /onSelectAll\(\) \{\s*this\.selection\.set\(\[\s*\.\.\.typedNodes/);
	assert.doesNotMatch(code('app/src/readout.js'), /isTypedEntity|kind === 'zone'|kind === 'link'|kind === 'node'|linkMarker/);
});
