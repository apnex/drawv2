/*
C-e, step four (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5: a plugin's edits are data, the canvas's generic builders
build every command) -- THE ZONE KEYS ARE THE ZONES PLUGIN'S.

`z` wraps the selection in a zone: a key row the zones plugin brings, which asks the canvas for the selection's bounds -- by
what each placed kind says its size is (C-c) -- and makes the zone through the host. Shift+arrows steps the size of a lone
selected entity: a key every placed plugin may answer, so the canvas keeps the one row and each part declares its step (a
zone grows a cell, a device's span a cell), and the help line is phrased from the parts that declare one. The builders left
app/src/commands.js (`wrapSelection`, `resizeZoneStep`, `resizeNodeStep`, `resizeNodeSpan`).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, key, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { helpSections } from '../app/src/help.js';
import { makeWaypoint } from '../devices/make-node.mjs';
import { makeZone } from '../zones/make-zone.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const keyLines = (h) => helpSections(h.input.bindings()).find((s) => s.title === 'keys').lines;
const box = (z) => z && { x: z.x, y: z.y, w: z.w, h: z.h };
const arrow = (k) => key(k, { shiftKey: true });

test('C-e: z wraps a device and a waypoint in a zone, selected, and says its size -- the state under test', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		const w = makeWaypoint(h.model, { x: 120, y: 60 }); h.model.put('node', w);
		h.selection.set([d.id, w.id]);
		h.capture.onKeyDown(key('z'));
		const [z] = h.model.all('zone');
		assert.deepEqual(box(z), { x: -30, y: -30, w: 180, h: 120 });
		assert.deepEqual(h.selection.list(), [z.id]);
		assert.equal(h.called('readout.flash'), true);
	} finally { h.restore(); }
});

// B319 -- `z` fitted the zone to a device's origin cell alone: a wide device's other cells sat outside the zone it was wrapped in
test('B319: z wraps a wide device whole -- every cell it spans inside the zone', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		h.model.set('node', d.id, { span: { cols: 3, rows: 2 } });
		h.selection.set([d.id]);
		h.capture.onKeyDown(key('z'));
		assert.deepEqual(box(h.model.all('zone')[0]), { x: -30, y: -30, w: 180, h: 120 });
	} finally { h.restore(); }
});

test('C-e: Shift+arrow grows a lone zone a cell and a lone device\'s span a cell; a waypoint or a mixed selection, nothing -- the state under test', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		const w = makeWaypoint(h.model, { x: 240, y: 240 }); h.model.put('node', w);
		const z = makeZone(h.model, { x: 150, y: 150, w: 120, h: 120 }); h.model.put('zone', z);
		h.selection.set([z.id]); h.capture.onKeyDown(arrow('ArrowRight'));
		assert.equal(h.model.get('zone', z.id).w, 180, 'the zone a cell wider');
		h.selection.set([d.id]); h.capture.onKeyDown(arrow('ArrowDown'));
		assert.deepEqual(h.model.get('node', d.id).span, { cols: 1, rows: 2 }, 'the device a cell taller');
		// the model, not the commit count: a step is amended, and amends coalesce before they are sent
		h.selection.set([w.id]); h.capture.onKeyDown(arrow('ArrowRight'));
		assert.equal(h.model.get('node', w.id).span, undefined, 'a waypoint has no size to step');
		h.selection.set([z.id, d.id]); h.capture.onKeyDown(arrow('ArrowRight'));
		assert.deepEqual([h.model.get('zone', z.id).w, h.model.get('node', d.id).span], [180, { cols: 1, rows: 2 }], 'a mixed selection steps nothing');
	} finally { h.restore(); }
});

test('C-e: the help says Shift+arrow resizes a zone or grows a node -- as it did -- and says only what the parts present step', () => {
	const full = makeInput();
	try {
		assert.equal(keyLines(full).find((l) => l.inputs[0] === 'Shift+arrow keys').label, 'resize the selected zone, or grow the selected node');
	} finally { full.restore(); }
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'zones') });
	try {
		assert.equal(keyLines(h).find((l) => l.inputs[0] === 'Shift+arrow keys').label, 'grow the selected node');
		assert.equal(keyLines(h).some((l) => l.inputs[0] === 'z'), false, 'no zone key');
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		h.selection.set([d.id]);
		h.capture.onKeyDown(key('z'));
		assert.equal(h.model.all('zone').length, 0, 'z makes nothing');
	} finally { h.restore(); }
});

test('C-e: the canvas holds no zone key or size step of its own', () => {
	assert.doesNotMatch(code('app/src/commands.js'), /wrapSelection|resizeZoneStep|resizeNodeStep|resizeNodeSpan|makeZone/);
	assert.doesNotMatch(code('app/src/input.js'), /wrapInZone|onWrapKey|resizeZoneStep|resizeNodeStep/);
	assert.doesNotMatch(code('app/src/keymap.js'), /id: 'wrap'/);
});
