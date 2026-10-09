/*
C-e, step twelve (H19.33; dev/design/unification/CANVAS-PLUGINS.md) -- A PANEL'S CONTENT IS THE DEVICES PLUGIN'S.

A device's `content` -- its regions, the field only a device carries -- is read and edited through what the devices plugin
declares (`labels.content`: a region's value and alignment, and the edit that sets one), so the label editor that opens over a
region names no kind; and run mode's two panel rows -- press a panel button, edit a panel input -- are the devices plugin's
(`devices/device-panels.mjs`), handed to Input with the simulation's by the product page alone (H17-D7), acting through the
host's `emit` and `editRegion`. `setContentValue` left the builders, `fireActionHere` and `openInputHere` left Input. Nothing a
user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { LabelEditor } from '../app/src/labeledit.js';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const panel = { id: 'node-c10001', name: 'p', type: 'host', shape: 'square', x: 0, y: 0, content: [
	{ at: [0, 0], content: 'text', value: 'a' }, { at: [1, 0], content: 'text', value: 'b', input: true, align: 'right' }] };
const contentOf = (e, idx) => PRODUCT_CANVAS.map((p) => p.labels?.content).filter(Boolean).find((c) => c.valueOf(e, idx) != null) ?? null;

test('C-e: committing a panel input sets the device\'s content with that region changed, a copy, labelled "edit" -- the state under test', () => {
	const h = makeInput();
	try {
		h.model.put('node', structuredClone(panel));
		const sent = [];
		const ed = new LabelEditor({ svg: {}, model: h.model, history: { commit: (c) => sent.push(c) }, contentOf });
		ed.input = { value: 'edited', remove() {} };
		ed.editing = { mode: 'content', nodeId: panel.id, idx: 1, before: 'b' };
		ed.close(true);
		assert.equal(sent.length, 1);
		const [entry] = sent[0].entries;
		assert.deepEqual({ label: sent[0].label, op: entry.op, kind: entry.kind, id: entry.id }, { label: 'edit', op: 'set', kind: 'node', id: panel.id });
		assert.deepEqual(entry.after.content.map((r) => r.value), ['a', 'edited']);
		assert.notEqual(entry.after.content, h.model.get('node', panel.id).content, 'not the live array');
		assert.equal(h.model.get('node', panel.id).content[1].value, 'b', 'the live device untouched until the edit applies');
	} finally { h.restore(); }
});

test('C-e: an unchanged value, or a region the device no longer has, commits nothing', () => {
	const h = makeInput();
	try {
		h.model.put('node', structuredClone(panel));
		const sent = [];
		const ed = new LabelEditor({ svg: {}, model: h.model, history: { commit: (c) => sent.push(c) }, contentOf });
		for (const [value, idx] of [['b', 1], ['x', 5]]) {
			ed.input = { value, remove() {} };
			ed.editing = { mode: 'content', nodeId: panel.id, idx, before: 'b' };
			ed.close(true);
		}
		assert.equal(sent.length, 0);
	} finally { h.restore(); }
});

test('C-e: the devices plugin reads a region\'s value and alignment, and none for a region it lacks or a waypoint', () => {
	const c = PRODUCT_CANVAS.find((p) => p.owner === 'devices').labels.content;
	assert.deepEqual(c.valueOf(panel, 1), { value: 'b', align: 'right' });
	assert.deepEqual(c.valueOf(panel, 0), { value: 'a', align: 'left' });
	assert.equal(c.valueOf(panel, 2), null);
	assert.equal(c.valueOf({ id: 'node-aa0001', x: 0, y: 0 }, 0), null);
});

test('C-e: in run mode a panel button press hands the host draw:action -- the state under test', () => {
	const h = makeInput();
	try {
		h.renderer.mode = 'run';
		const hitEl = { dataset: { action: 'ping' }, closest: () => ({ id: 'node-aa0001' }) };
		h.capture.onDown(pointer(100, 100, { target: { tagName: 'rect', closest: () => hitEl } }));
		assert.deepEqual(h.dispatched.map((d) => [d.type, d.detail.action, d.detail.id]), [['draw:action', 'ping', 'node-aa0001']]);
	} finally { h.restore(); }
});

test('C-e: the canvas holds no panel row, region read or content builder of its own', () => {
	assert.doesNotMatch(code('app/src/commands.js'), /setContentValue/);
	assert.doesNotMatch(code('app/src/input.js'), /fireActionHere|openInputHere/);
	assert.doesNotMatch(code('app/src/run-mode.js'), /run: 'fireActionHere'|run: 'openInputHere'/);
	assert.doesNotMatch(code('app/src/labeledit.js'), /model\.get\('node'|node\.content/);
});
