/*
RUN MODE'S SPAWNER AND TOWER, THE SIMULATION'S -- C-e, step nine (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5).

Two run-mode rows, handed to Input with the product's run-mode rows by the product page alone (app/src/run-mode.js) -- the lab
passes none, as ruled (H17-D7) -- each acting through the host's generic verbs:
  toggle-spawn   a press on an endpoint arms it as a spawner, or disarms it
  place-tower    a press on open ground places a load balancer on the node grid, where the cell is free, unselected
They were app/src/input.js `toggleSpawnHere` and `placeTowerHere`, with app/src/commands.js `toggleSpawn` (H12.7).

ASYMMETRIC ON PURPOSE, and forced by the ops vocabulary: arming ADDS a key, which a set expresses; disarming REMOVES one, which a
set cannot -- a patch of `{ spawn: undefined }` writes the key as undefined and the validator refuses the entity -- so disarming
puts the waypoint WITHOUT the field. `since` comes from the agreed clock the host gives, never the wall clock: a local instant in a
shared document would give every other peer a phase that was never theirs. RED by default, per the director, as DOCUMENT state:
a spawner's kind, not a colour, so the stylesheet owns the look.
*/

import { BARE_KIND } from '../model/anchors.mjs';
import { inReadView, onEndpoint, onOpenGround } from './situation.mjs';
import { bareAnchor } from '../devices/device-shapes.mjs';
import { makeNode } from '../devices/make-node.mjs';

// what arming or disarming a waypoint is, as data: the label, and the field set or the waypoint put without it -- always the
// defaults (the builder's overrides had no caller but a test, and went with it)
function spawnToggle(wp, now) {
	if (wp.spawn) {
		const { spawn: _gone, ...without } = wp;
		return { label: 'stop spawning', put: without };
	}
	// CELLS per second (B172): 1.4 crosses a cell in about 700 ms, which reads as travelling rather than flickering
	const spawn = { interval: 900, speed: 1.4, kind: 'packet', since: now };
	// NESTED, not spread: the patch is the waypoint's, so a bare spread would write the spawner's fields onto the waypoint
	return { label: 'spawn', set: { spawn } };
}

export const SPAWN_RUNS = [
	{ id: 'toggle-spawn', input: ['left on region:waypoint'], context: 'in run mode, on an endpoint', mutates: true, prevent: false, doc: 'arm or disarm the spawner',
		on: (e) => e.button === 0 && !!e.region?.waypoint, when: (s) => inReadView(s) && onEndpoint(s),
		run: (host, evt) => {
			evt.claimed = true;
			const id = evt.region.waypoint;
			const wp = host.ask((model) => bareAnchor(model, id));
			if (!wp) return;
			const edit = spawnToggle(wp, host.now());
			if (edit.put) host.put(edit.label, BARE_KIND, () => edit.put);
			else host.set(edit.label, BARE_KIND, id, edit.set);
		} },
	{ id: 'place-tower', input: ['left on region:ground'], context: 'in run mode, where the cell is free', mutates: true, prevent: false, doc: 'place a tower',
		on: (e) => e.button === 0 && !!e.region && !e.region.control && !e.region.overWaypoint && !e.region.entity,
		when: (s) => inReadView(s) && onOpenGround(s),
		run: (host, evt) => {
			const cell = host.snap('node', evt.at);
			if (host.ask((model) => model.occupiedAnyAt(cell))) return;   // a taken cell places nothing
			evt.claimed = true;
			host.add('node', (model) => makeNode(model, 'loadbalancer', cell));
		} },
];
