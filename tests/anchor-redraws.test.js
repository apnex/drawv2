/*
B312, B313 -- AN ANCHOR'S CHANGE REDRAWS WHAT IT CHANGES ON THE CANVAS.

B312: moving a device redrew the links ENDING at it (`linksOf`), written when only a waypoint could be a link's bend; H19.10
(Z1) let a link be pinned through a device whose transit is on, and such a link stayed drawn along the device's old place
until something else redrew it. A device's move redraws every link naming it, end or bend, as a waypoint's does (`linksAt`).
B313: a waypoint's update re-applied only its position, so a spawner set or cleared left its `spawning` mark as it was until
the next full render. An update whose derived marks differ from what is drawn renders afresh.
Both measured in the renderer harness (the Renderer over the harness's DOM), not seen on the page.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from './fixtures/composed.mjs';
import { Renderer } from '../app/src/renderer.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { makeRenderer } from './fixtures/client-harness.mjs';
import { pathOf } from '../network/network-queries.mjs';
import { roundedPath } from '../kernel/router.mjs';
import { BEND_R } from '../kernel/spec.mjs';

const SPAWN = { interval: 1000, speed: 1, kind: 'packet', since: 1_700_000_000_000 };
const board = (fn) => {
	const { svg, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = new Renderer(m, svg, { parts: PRODUCT_CANVAS });
		m.put('node', { id: 'node-0d1001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0 });
		m.put('node', { id: 'node-0d1002', name: 'r', type: 'router', shape: 'circle', x: 120, y: 0, transit: true });
		m.put('node', { id: 'node-0d1003', name: 'b', type: 'host', shape: 'circle', x: 240, y: 0 });
		m.put('node', { id: 'node-0d1005', name: 'w', x: 120, y: 120 });
		fn({ m, r, el: (id) => svg.ownerDocument.getElementById(id) });
	} finally { restore(); }
};
// where a fresh render draws a link -- the network's path, rounded at the kernel's bend (RESTATED at C-a step four: the renderer's
// `linkPath` is the network painter's now)
const fresh = (r, m, id) => { const l = m.get('link', id), p = pathOf(m, l); return p && roundedPath(p, BEND_R, !!l.closed); };

test('B312: moving a device a link ENDS at redraws the link -- the state under test', () => board(({ m, r, el }) => {
	m.put('link', { id: 'link-0d1004', name: 'l', src: 'node-0d1001', dst: 'node-0d1002' });
	m.set('node', 'node-0d1002', { y: 60 });
	assert.equal(el('link-0d1004').getAttribute('d'), fresh(r, m, 'link-0d1004'));
}));

test('B312: moving a device a link is pinned THROUGH redraws the link along the device\'s new place', () => board(({ m, r, el }) => {
	m.put('link', { id: 'link-0d1004', name: 'l', src: 'node-0d1001', dst: 'node-0d1003', via: ['node-0d1002'] });
	const before = el('link-0d1004').getAttribute('d');
	m.set('node', 'node-0d1002', { y: 60 });
	assert.notEqual(fresh(r, m, 'link-0d1004'), before, 'the move changes where the link is drawn');
	assert.equal(el('link-0d1004').getAttribute('d'), fresh(r, m, 'link-0d1004'), 'and the canvas draws it there');
}));

test('B313: setting and clearing a waypoint\'s spawner shows and drops its spawning mark at once', () => board(({ m, el }) => {
	assert.doesNotMatch(el('node-0d1005').getAttribute('class'), /spawning/);
	m.set('node', 'node-0d1005', { spawn: SPAWN });
	assert.match(el('node-0d1005').getAttribute('class'), /\bspawning\b/, 'armed');
	m.set('node', 'node-0d1005', { spawn: undefined });   // an update, not a put -- a put renders afresh and would prove nothing
	assert.doesNotMatch(el('node-0d1005').getAttribute('class'), /spawning/, 'disarmed');
}));
