/*
C-e, step nine (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5: a plugin's edits are data) -- RUN MODE'S SPAWNER AND
TOWER ARE THE SIMULATION'S.

In run mode a press on an endpoint arms or disarms it as a spawner, and a press on open ground places a tower. The two rows are
the simulation plugin's (`plugins/simulation/spawn-runs.mjs`), handed to Input with the product's run-mode rows by the product page alone --
the lab passes none, as ruled (H17-D7) -- and they act through the host's generic verbs: the spawn set, its clearing a put
without the key, the tower made where the cell is free. `toggleSpawn` left the builders, and `toggleSpawnHere` and
`placeTowerHere` left Input. Nothing a user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { makeWaypoint } from '../plugins/devices/make-node.mjs';
import { makeLink } from '../plugins/network/link-queries.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// RESTATED at H26.8's picks move: the waypoint's element the harness's renderer drew, read by item -- a stand-in answered `.waypoint`
const onWaypoint = (h, id) => h.at(id);

test('C-e: in run mode a press on an endpoint arms it as a spawner, stamped from the agreed clock, and again disarms it -- the state under test', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		const w = makeWaypoint(h.model, { x: 240, y: 0 }); h.model.put('node', w);
		h.model.put('link', makeLink(h.model, a.id, w.id));
		h.renderer.setMode('run');
		h.capture.onDown(pointer(240, 0, { target: onWaypoint(h, w.id) })); h.capture.onUp(pointer(240, 0, { target: onWaypoint(h, w.id) }));
		const spawn = h.model.get('node', w.id).spawn;
		assert.deepEqual({ interval: spawn?.interval, speed: spawn?.speed, kind: spawn?.kind, stamped: typeof spawn?.since }, { interval: 900, speed: 1.4, kind: 'packet', stamped: 'number' });
		assert.equal(h.commits.at(-1).label, 'spawn');
		h.capture.onDown(pointer(240, 0, { target: onWaypoint(h, w.id) })); h.capture.onUp(pointer(240, 0, { target: onWaypoint(h, w.id) }));
		assert.equal('spawn' in h.model.get('node', w.id), false, 'disarmed: the key gone');
		assert.equal(h.commits.at(-1).label, 'stop spawning');
	} finally { h.restore(); }
});

test('C-e: in run mode a press on open ground places a load balancer there, unselected; on a taken cell, nothing -- the state under test', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		h.renderer.setMode('run');
		h.capture.onDown(pointer(242, 118)); h.capture.onUp(pointer(242, 118));
		const towers = h.model.all('node').filter((n) => n.type === 'loadbalancer');
		assert.deepEqual(towers.map((n) => [n.x, n.y]), [[240, 120]], 'on the snapped cell');
		assert.equal(h.commits.at(-1).label, 'create node');
		assert.deepEqual(h.selection.list(), [a.id], 'the selection untouched');
		const sent = h.commits.length;
		h.capture.onDown(pointer(240, 120)); h.capture.onUp(pointer(240, 120));
		assert.equal(h.model.all('node').filter((n) => n.type === 'loadbalancer').length, 1, 'a taken cell places nothing');
		// and sends nothing: the planner would refuse a second anchor on the cell, but the row asks first (measured: without the
		// check a request goes out and is refused)
		assert.equal(h.commits.length, sent, 'nothing sent');
	} finally { h.restore(); }
});

test('C-e: the canvas holds no spawner or tower of its own', () => {
	assert.doesNotMatch(code('app/src/commands.js'), /export function toggleSpawn/);
	assert.doesNotMatch(code('app/src/input.js'), /toggleSpawnHere|placeTowerHere|'loadbalancer'/);
	assert.doesNotMatch(code('app/src/run-mode.js'), /run: 'toggleSpawnHere'|run: 'placeTowerHere'/);
});
