/*
H12.7 — the pilot rule, and the command it commits.

The property that matters is that ONE gesture means TWO things depending on the situation: in read
view a click on an endpoint arms it, in author view the same click selects it. That is B163 stated
as a feature rather than a defect, and it is the thing the current keymap cannot express.

Tested at the command and predicate level rather than by synthesising pointer events. Simulating a
gesture through a headless DOM has cost this tree two rounds already and proved nothing either
time: the synthetic event failed to move the selection and the "correct" reading was the probe
failing, not the code. These call the decision directly.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { situationOf, inReadView, onEndpoint, onSpawner } from '../engine/index.mjs';
import { toggleSpawn } from '../app/src/commands.js';
import { validateEntity } from '../server/validate.js';
import { applyOps } from '../model/ops.mjs';

const NOW = 1_700_000_000_000;
const WP_A = 'waypoint-aaaaaa', WP_B = 'waypoint-bbbbbb', LINK = 'link-cccccc';

function doc() {
	const m = new Model();
	m.put('waypoint', { id: WP_A, x: 0, y: 0 });
	m.put('waypoint', { id: WP_B, x: 200, y: 0 });
	m.put('link', { id: LINK, src: WP_A, dst: WP_B });
	return m;
}

const sit = (m, id, mode) => situationOf({
	get: (kind, i) => m.get(kind, i),
	linksTouching: (i) => m.all('link').filter((l) => l.src === i || l.dst === i || (l.via || []).includes(i)),
}, { mode, targetId: id }, NOW);

// the rule itself, stated once here exactly as `input.js` states it
const armable = (s) => inReadView(s) && onEndpoint(s);

test('H12.7: the SAME target means different things in read view and author view', () => {
	const m = doc();
	assert.equal(armable(sit(m, WP_A, 'run')), true, 'read view: this click arms');
	assert.equal(armable(sit(m, WP_A, 'view')), false, 'author view: it does not');
	assert.equal(armable(sit(m, WP_A, 'edit')), false);
});

test('H12.7: only an ENDPOINT is armable -- a bend and a node are not', () => {
	const m = doc();
	m.put('waypoint', { id: 'waypoint-dddddd', x: 40, y: 0 });
	m.set('link', LINK, { via: ['waypoint-dddddd'] });
	assert.equal(armable(sit(m, 'waypoint-dddddd', 'run')), false, 'a bend turns a path, it does not end one');
	assert.equal(armable(sit(m, WP_A, 'run')), true, 'its endpoints still are');
});

test('H12.7: a CLOSED route cannot be armed, because a ring has no ends', () => {
	const m = new Model();
	m.put('waypoint', { id: WP_A, x: 0, y: 0 });
	m.put('link', { id: LINK, src: WP_A, dst: WP_A, closed: true });
	assert.equal(armable(sit(m, WP_A, 'run')), false);
});

test('H12.7: arming is a SET that introduces the field, and the entity stays valid', () => {
	const m = doc();
	const cmd = toggleSpawn(m, WP_A, NOW);
	assert.equal(cmd.label, 'spawn');
	assert.equal(cmd.entries.length, 1);
	assert.equal(cmd.entries[0].op, 'set');
	assert.equal(cmd.entries[0].after.spawn.since, NOW, 'the phase is the agreed instant, not a local one');
	assert.deepEqual(Object.keys(cmd.entries[0].after), ['spawn'], 'the patch touches ONE field, not four');
	applyOps(m, [{ op: 'set', kind: 'waypoint', id: WP_A, patch: cmd.entries[0].after }]);
	assert.equal(validateEntity('waypoint', m.get('waypoint', WP_A)), null, 'the server must accept what we authored');
	assert.equal(onSpawner(sit(m, WP_A, 'run')), true);
});

/*
Disarming is a PUT, and the asymmetry is forced rather than chosen.

`model.set` is `Object.assign`, so a patch of `{ spawn: undefined }` writes the key as undefined
instead of dropping it -- and the validator then refuses the entity, because `spawn` must be a whole
object. Removing a field therefore requires replacing the entity. Getting this wrong would not
throw at the author's keyboard; it would be refused later, by the server, on a write they had
already been told succeeded.
*/
test('H12.7: disarming REMOVES the field rather than blanking it', () => {
	const m = doc();
	applyOps(m, [{ op: 'set', kind: 'waypoint', id: WP_A, patch: toggleSpawn(m, WP_A, NOW).entries[0].after }]);
	const off = toggleSpawn(m, WP_A, NOW);
	assert.equal(off.label, 'stop spawning');
	assert.equal(off.entries[0].op, 'put', 'a set cannot express removal');
	assert.equal('spawn' in off.entries[0].entity, false, 'the field is GONE, not undefined');
	applyOps(m, [{ op: 'put', kind: 'waypoint', entity: off.entries[0].entity }]);
	assert.equal(m.get('waypoint', WP_A).spawn, undefined);
	assert.equal(validateEntity('waypoint', m.get('waypoint', WP_A)), null);
	assert.equal(onSpawner(sit(m, WP_A, 'run')), false);
});

test('H12.7: toggling twice returns the waypoint to exactly what it was', () => {
	const m = doc();
	const before = JSON.parse(JSON.stringify(m.get('waypoint', WP_A)));
	applyOps(m, [{ op: 'set', kind: 'waypoint', id: WP_A, patch: toggleSpawn(m, WP_A, NOW).entries[0].after }]);
	const off = toggleSpawn(m, WP_A, NOW);
	applyOps(m, [{ op: 'put', kind: 'waypoint', entity: off.entries[0].entity }]);
	assert.deepEqual(m.get('waypoint', WP_A), before);
});

test('H12.7: the built spawn passes the authored bounds it will be validated against', () => {
	const m = doc();
	const spawn = toggleSpawn(m, WP_A, NOW).entries[0].after;
	applyOps(m, [{ op: 'set', kind: 'waypoint', id: WP_A, patch: spawn }]);
	assert.equal(validateEntity('waypoint', m.get('waypoint', WP_A)), null);
	// and a caller may override, still within bounds
	const custom = toggleSpawn(doc(), WP_A, NOW, { interval: 300, speed: 400, colour: '#aed581' }).entries[0].after;
	assert.deepEqual(custom, { spawn: { interval: 300, speed: 400, colour: '#aed581', since: NOW } });
});

test('H12.7: a missing waypoint yields no command rather than a throw', () => {
	assert.equal(toggleSpawn(doc(), 'waypoint-999999', NOW), null);
});

test('H12.7: the builder never reads a wall clock -- the instant is always the caller\'s', () => {
	// a builder that stamped Date.now() would put a LOCAL instant into a shared document, and every
	// other peer would compute departures from a phase that was never theirs
	assert.doesNotMatch(toggleSpawn.toString(), /Date\.now/, 'the phase must come from the agreed clock');
});
