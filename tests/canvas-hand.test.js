/*
C-e, step one (H19.33; dev/design/unification/CANVAS-PLUGINS.md; the director: the hand as one step) -- THE HELD DEVICE TYPE IS
THE DEVICES PLUGIN'S TO DECLARE; THE CANVAS HOLDS IT.

The canvas held a list of device types (`NODE_TYPES`), stamped a held type as a device on a free cell, told what blocks a
stamp, read a device's type for the pipette and a retyping click, and built the retype. The devices plugin declares its hand
now -- `hand: { items, place, blocked, stamp, itemOf, retype }` -- and the canvas's keys and release rules read it: a digit
holds the nth item, a click or Enter stamps the held item where it is not blocked, the pipette holds the item a device was
stamped from, and a click with another item held retypes. Nothing a user sees changes: the gesture corpus holds that.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, key, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const devices = (h) => h.model.all('node').filter((n) => n.type);
// the harness's tools stub records a toggle rather than holding (tests/fixtures/client-harness.mjs): what a digit asked to hold
const toggled = (h) => h.calls.filter((c) => c.name === 'tools.toggleHand').map((c) => c.args[0]);

test('C-e: a digit holds a type, a click stamps it, the pipette holds a device\'s type -- the state under test', () => {
	const h = makeInput();
	try {
		h.capture.onMove(pointer(240, 120, { buttons: 0 }));
		h.capture.onKeyDown(key('1'));
		assert.deepEqual(toggled(h), ['host'], 'the first item');
		h.tools.setHand('host');
		h.capture.onDown(pointer(240, 120)); h.capture.onUp(pointer(240, 120));
		assert.deepEqual(devices(h).map((n) => [n.type, n.x, n.y]), [['host', 240, 120]], 'stamped on the cell');
		const [r] = seedNodes(h.model, [[0, 0, 'router']]);
		h.capture.onMove(pointer(0, 0, { buttons: 0 }));
		h.capture.onKeyDown(key('q'));
		assert.equal(h.tools.hand, 'router', 'the pipette holds the type under the pointer');
		assert.ok(r);
	} finally { h.restore(); }
});

test('C-e: without the devices plugin\'s part a digit holds nothing and a click stamps nothing', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'devices') });
	try {
		h.capture.onMove(pointer(240, 120, { buttons: 0 }));
		h.capture.onKeyDown(key('1'));
		assert.deepEqual(toggled(h), [], 'no item to hold');
		h.tools.setHand('host');   // held anyway: no part says how it stamps
		h.capture.onDown(pointer(240, 120)); h.capture.onUp(pointer(240, 120));
		assert.equal(devices(h).length, 0);
	} finally { h.restore(); }
});

test('C-e: the canvas holds no device type list, stamp or retype of its own', () => {
	const input = code('app/src/input.js');
	assert.doesNotMatch(input, /NODE_TYPES|retypeNode|tools\.hand === 'waypoint'/);
	const blocked = input.slice(input.indexOf('\thandBlocked(snapped) {'), input.indexOf('\n\t}\n', input.indexOf('\thandBlocked(snapped) {')));
	assert.doesNotMatch(blocked, /occupied/, 'what blocks a stamp is the hand\'s rule (the link drag\'s own stops are a later step\'s)');
	const stamp = input.slice(input.indexOf('\tstampAt(pos) {'), input.indexOf('\n\t}\n', input.indexOf('\tstampAt(pos) {')));
	assert.doesNotMatch(stamp, /makeNode|makeWaypoint/);
	assert.doesNotMatch(code('app/src/tools.js'), /NODE_TYPES/);
	assert.doesNotMatch(code('app/src/palette.js'), /NODE_TYPES/);
	assert.doesNotMatch(code('app/src/commands.js'), /export function retypeNode/);
});

test('C-e: a hand brought twice is refused when Input is built', () => {
	const d = PRODUCT_CANVAS.find((p) => p.owner === 'devices');
	assert.throws(() => makeInput({ parts: [...PRODUCT_CANVAS, { owner: 'again', hand: d.hand }] }), /Input: a hand is brought by devices and by again -- one may/);
});

test('C-e: a held type clicked onto a device\'s cell sends nothing; a click on a device of the held type selects it and sends nothing', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[120, 120, 'host']]);
		h.tools.setHand('host');
		const sent = h.commits.length;
		h.capture.onMove(pointer(120, 120, { buttons: 0 }));
		h.capture.onKeyDown(key('Enter'));   // stamp at the ghost: the cell is taken
		assert.equal(h.commits.length, sent, 'a blocked stamp is not attempted');
		const onDevice = pointer(120, 120, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id: d.id } : null) } });
		h.capture.onDown(onDevice); h.capture.onUp(onDevice);
		assert.equal(h.commits.length, sent, 'the held type is its type: no retype is sent');
		assert.deepEqual(h.selection.list(), [d.id]);
	} finally { h.restore(); }
});
