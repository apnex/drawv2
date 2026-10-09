/*
C-e, step eleven (H19.33; dev/design/unification/CANVAS-PLUGINS.md section 3: "where its label edits") -- WHERE A KIND'S NAME IS
EDITED IS ITS PLUGIN'S TO SAY.

A double-click edits what is under the pointer by what the parts say they edit there, in rank order: the devices plugin's text
box by its whole footprint (its text), then a device by its icon or the strip beneath it (its name), then the zones plugin's zone
by its box (its name). F2 renames among the selection only the kinds a part says are named -- a device, a zone; not a link or a
group. The name editor opens where the part says a kind's label sits -- under a device, centred -- or beside the entity's corner.
Nothing a user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, key, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { makeZone } from '../zones/make-zone.mjs';
import { makeTextBox } from '../devices/make-node.mjs';
import { makeLink } from '../network/link-queries.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const opened = (h) => h.stateCalls('labels.open').map(([kind, id]) => `${kind}:${id}`);
const board = (h) => {
	const [d] = seedNodes(h.model, [[0, 0]]);
	const z = makeZone(h.model, { x: 330, y: 330, w: 240, h: 180 }); h.model.put('zone', z);
	const tb = makeTextBox(h.model, { x: -240, y: -240 }, { cols: 3, rows: 2 }); h.model.put('node', tb);
	return { d, z, tb };
};

test('C-e: a double-click edits a device\'s name on its icon or the strip beneath, a zone\'s inside it, a text box\'s text anywhere on it -- the state under test', () => {
	const h = makeInput();
	try {
		const { d, z, tb } = board(h);
		h.capture.onDblClick(pointer(3, 2)); h.capture.onDblClick(pointer(10, 34)); h.capture.onDblClick(pointer(500, 480));
		assert.deepEqual(opened(h), [`node:${d.id}`, `node:${d.id}`, `zone:${z.id}`]);
		h.capture.onDblClick(pointer(-120, -180));
		assert.deepEqual(h.selection.list(), [tb.id], 'the text box, selected');
		assert.equal(opened(h).length, 3, 'its text, not a name editor');
	} finally { h.restore(); }
});

test('C-e: without the zones plugin a double-click inside a zone edits nothing; without the devices plugin, on a device nothing', () => {
	for (const [owner, at] of [['zones', [500, 480]], ['devices', [3, 2]]]) {
		const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== owner) });
		try {
			board(h);
			h.capture.onDblClick(pointer(...at));
			assert.deepEqual(opened(h), [], `without ${owner}`);
		} finally { h.restore(); }
	}
});

test('C-e: F2 renames among the selection only the named kinds -- a zone with a link selected is the zone -- the state under test', () => {
	const h = makeInput();
	try {
		const { d, z } = board(h);
		const [e] = seedNodes(h.model, [[240, 0]]);
		const l = makeLink(h.model, d.id, e.id); h.model.put('link', l);
		h.selection.set([l.id, z.id]);
		h.capture.onKeyDown(key('F2'));
		assert.deepEqual(opened(h), [`zone:${z.id}`]);
	} finally { h.restore(); }
});

test('C-e: the devices plugin says a device\'s label sits under it, centred; a waypoint\'s, the canvas default', async () => {
	const { DEVICE_LABELS } = await import('../devices/device-labels.mjs');
	const at = DEVICE_LABELS.labelAt;
	assert.deepEqual(at({ id: 'node-aa0001', type: 'host', x: 60, y: 120 }), { x: 60, y: 146, centred: true });
	assert.equal(at({ id: 'node-aa0002', x: 60, y: 120 }), null, 'a waypoint: no word from the devices plugin');
});

test('C-e: the canvas holds no double-click target, label placement or F2 filter of its own', () => {
	const input = code('app/src/input.js');
	const edit = input.slice(input.indexOf('\teditUnderPointer(evt) {'), input.indexOf('\n\t}\n', input.indexOf('\teditUnderPointer(evt) {')));
	assert.doesNotMatch(edit, /typedNodes|'zone'|'node'|content === 'text'|inFootprint/);
	assert.doesNotMatch(input, /kindOf\(id\) !== 'link' && kindOf\(id\) !== 'group'/);
	assert.doesNotMatch(code('app/src/labeledit.js'), /drawnKind|drawn === 'node'/);
});

test('C-e: a Tab rename run advances to the next entity of the same drawn kind -- a device to a device, a waypoint to a waypoint', async () => {
	const { LabelEditor } = await import('../app/src/labeledit.js');
	const { makeWaypoint } = await import('../devices/make-node.mjs');
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
		const w1 = makeWaypoint(h.model, { x: 120, y: 0 }); h.model.put('node', w1);
		const w2 = makeWaypoint(h.model, { x: 120, y: 120 }); h.model.put('node', w2);
		const DEVICE_LABELS = PRODUCT_CANVAS.find((p) => p.owner === 'devices').labels;
		const ed = new LabelEditor({ svg: {}, model: h.model, history: {}, wordOf: DEVICE_LABELS.wordOf });
		assert.equal(ed.neighbor('node', a.id, 1), b.id, 'past the waypoint between them');
		assert.equal(ed.neighbor('node', w1.id, 1), w2.id);
	} finally { h.restore(); }
});

test('C-e: a double-click on a device inside a zone edits the device\'s name -- its rank is before the zone\'s', () => {
	const h = makeInput();
	try {
		const { z } = board(h);
		const [d] = seedNodes(h.model, [[420, 420]]);   // inside the zone
		h.capture.onDblClick(pointer(421, 419));
		assert.deepEqual(opened(h), [`node:${d.id}`]);
		assert.ok(z);
	} finally { h.restore(); }
});

// B321 -- F2 renamed among the selection everything but a link and a group, so a selected pipe (selected by clicking it, a
// plugin's mark) opened a name editor with no place and no name, and a name typed into it was dropped (measured on the page)
test('B321: F2 with a pipe selected opens no name editor', async () => {
	const { pipeEntity } = await import('../network/pipe-kind.mjs');
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
		const p = pipeEntity(a.id, b.id, 'hand'); h.model.put('pipe', p);
		h.selection.set([p.id]);
		h.capture.onKeyDown(key('F2'));
		assert.deepEqual(opened(h), []);
	} finally { h.restore(); }
});
