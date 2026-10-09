/*
C-e, step three (H19.33; dev/design/unification/CANVAS-PLUGINS.md) -- WHAT IS AT A POINT IS WHAT THE PLUGINS SAY THEIR ITEMS
COVER.

The canvas answered "what is at this point" itself: a device by its footprint (`nodeAt`), a link end as a device or else a
waypoint by its radius (`endpointAt`), what a marquee box takes (devices by footprint, waypoints by position, a link whose ends
are both taken) and whether a hovered item is still under the pointer. Each part now declares what its items cover -- `at:
[{ word, of, grabs, under, within, joins }]` -- and the canvas asks the composed list, in the parts' order: the devices plugin's
devices, the network's waypoints and links. A handle names the words it may land on (a link end, on a device). Nothing a user
sees changes: the gesture corpus holds that.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, key, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { makeWaypoint } from '../devices/make-node.mjs';
import { makeLink } from '../network/link-queries.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const on = (word, id) => ({ tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes(word) ? { id } : null) });
const board = (h) => {
	const [d] = seedNodes(h.model, [[0, 0, 'host']]);
	const w = makeWaypoint(h.model, { x: 240, y: 0 }); h.model.put('node', w);
	const l = makeLink(h.model, d.id, w.id); h.model.put('link', l);
	return { d, w, l };
};
const marquee = (h) => { h.capture.onDown(pointer(-100, -100)); h.capture.onMove(pointer(400, 100)); h.capture.onUp(pointer(400, 100)); };
const linksBetween = (h, a, b) => h.model.all('link').filter((l) => (l.src === a && l.dst === b) || (l.src === b && l.dst === a)).length;

test('C-e: a marquee takes a device by its footprint, a waypoint by its place and the link joining them -- the state under test', () => {
	const h = makeInput();
	try {
		const { d, w, l } = board(h);
		marquee(h);
		assert.deepEqual(h.selection.list().sort(), [d.id, w.id, l.id].sort());
	} finally { h.restore(); }
});

test('C-e: a link drawn from a waypoint ends on the device it is released over -- the state under test', () => {
	const h = makeInput();
	try {
		const { d } = board(h);
		const w2 = makeWaypoint(h.model, { x: 240, y: 240 }); h.model.put('node', w2);
		h.capture.onDown(pointer(240, 240, { target: on('waypoint', w2.id) }));
		h.capture.onMove(pointer(120, 120));
		h.capture.onUp(pointer(4, 4));
		assert.equal(linksBetween(h, w2.id, d.id), 1);
	} finally { h.restore(); }
});

test('C-e: without the devices plugin\'s part a marquee takes no device and a link drawn onto one does not end there', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'devices') });
	try {
		const { d, w } = board(h);
		marquee(h);
		assert.deepEqual(h.selection.list(), [w.id], 'the waypoint alone');
		const w2 = makeWaypoint(h.model, { x: 240, y: 240 }); h.model.put('node', w2);
		h.capture.onDown(pointer(240, 240, { target: on('waypoint', w2.id) }));
		h.capture.onMove(pointer(120, 120));
		h.capture.onUp(pointer(4, 4));
		assert.equal(linksBetween(h, w2.id, d.id), 0);
	} finally { h.restore(); }
});

test('C-e: without the network\'s part a marquee takes no waypoint and no link', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'network') });
	try {
		const { d } = board(h);
		marquee(h);
		assert.deepEqual(h.selection.list(), [d.id]);
	} finally { h.restore(); }
});

test('C-e: a link\'s end handle lands on a device, not on a waypoint -- the words the network\'s handle names', async () => {
	const h = makeInput();
	try {
		const [n1, n2] = seedNodes(h.model, [[360, 0], [360, 360]]);
		const w = makeWaypoint(h.model, { x: 0, y: 0 }); h.model.put('node', w);
		const l = makeLink(h.model, n2.id, n1.id); h.model.put('link', l);
		h.selection.set([l.id]);
		const end = { tagName: 'circle', classList: { contains: (c) => c === 'handle' }, dataset: { end: 'src' }, closest: () => null };
		h.capture.onDown(pointer(360, 330, { target: end }));
		h.capture.onMove(pointer(30, 0));
		h.capture.onUp(pointer(0, 0));
		assert.equal(h.model.get('link', l.id).src, n2.id, 'a waypoint is not a re-plug target');
	} finally { h.restore(); }
});

test('C-e: the canvas finds nothing at a point by a plugin\'s kind or shape of its own', () => {
	assert.doesNotMatch(code('app/src/pick.js'), /devices\/|network\/|typedNodes|bareAnchors|spanExtent/);
	assert.doesNotMatch(code('app/src/input.js'), /\bnodeAt\(|\bendpointAt\(|footprintHits|typedNodes\(this\.model\)\.forEach|bareAnchors\(this\.model\)\.forEach|this\.model\.all\('link'\)\.forEach/);
	assert.doesNotMatch(code('app/src/overlay.js'), /isTypedEntity|inFootprint/);
});

test('C-e: a hovered wide device stays hovered when a gesture ends over its far cell, and not when it ends off it', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		h.model.set('node', d.id, { span: { cols: 3, rows: 1 } });
		const endAt = (x, y) => {
			h.capture.onHover(pointer(0, 0, { target: on('node', d.id) }), true);
			h.capture.onDown(pointer(-300, -300)); h.capture.onMove(pointer(x - 10, y - 10)); h.capture.onUp(pointer(x, y));
			return h.input.overlayUi.hovered;
		};
		assert.equal(endAt(120, 0), d.id, 'over its third cell: still under the pointer');
		assert.equal(endAt(300, 0), null, 'off it: no longer');
	} finally { h.restore(); }
});
