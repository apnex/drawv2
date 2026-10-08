/*
H12.5 — `spawn` on an endpoint waypoint: document state, whole or absent.

The field is DOCUMENT state deliberately, where a mover is not. Arming an endpoint is intent: it
should survive a reload, reach the other viewers, and be undoable like anything else a person did.
The movers it implies are none of those things, which is exactly why they are derived instead.

Both peers are checked here. `model/shape.mjs` says which optional fields a kind may carry and the
client trusts it; `planner/validate.js` refuses what arrives anyway. B86 is the standing reason those
two are tested together rather than apart -- one number, two enforcers, or the pair drifts.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntity } from './fixtures/composed.mjs';   // the composition production runs; the validator takes no default since S-f
import { CORE_KINDS } from '../model/shape.mjs';
import { KINDS } from './fixtures/composed.mjs';   // the composition production runs, the simulation's field on it (O-e2)
const OPTIONAL = CORE_KINDS.optional;   // the product's kinds (H17.22 N-a)
import { SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, SPAWN_SPEED_MAX } from '../model/limits.mjs';
import { Model } from '../model/model.mjs';

const wp = (extra) => ({ id: 'node-aaaaaa', name: 'node-aaaaaa', x: 0, y: 0, ...extra });
const armed = () => ({ interval: 1000, speed: 1.4, kind: 'packet', since: Date.now() });

test('H12.5: a waypoint may carry spawn, and the two peers agree that it may', () => {
	// RESTATED at O-e2 (H19.21): `spawn` is the simulation's field, composed onto the anchor -- the core's map holds the anchor's alone
	assert.equal(OPTIONAL.node.has('spawn'), false, 'the core\'s anchor declares no spawner');
	assert.ok(KINDS.optional.node.has('spawn'), 'the composition allows the field -- on a node with no type (F-c)');
	assert.equal(KINDS.contributed('node', 'spawn'), 'the simulation');
	assert.equal(validateEntity('node', wp({ spawn: armed() })), null, 'the server must accept it');
});

test('H12.5: absent spawn is the normal case and stays legal', () => {
	assert.equal(validateEntity('node', wp({})), null);
	assert.notEqual(validateEntity('node', wp({ pinned: true })), null, 'B162 pinned is retired (S-d, H18.14), so a node carrying it is refused');
});

test('H12.5: a spawner is WHOLE or absent -- a partial one is not a state', () => {
	for (const missing of ['interval', 'speed', 'kind', 'since']) {
		const partial = armed();
		delete partial[missing];
		assert.ok(validateEntity('node', wp({ spawn: partial })), `missing ${missing} must be refused`);
	}
});

test('H12.5: an unknown key is refused rather than ignored', () => {
	// direction in particular: it is DERIVED from which end of the link this is, and accepting a
	// stored one would create a second answer that can disagree with the link
	assert.ok(validateEntity('node', wp({ spawn: { ...armed(), direction: 'forward' } })));
	assert.ok(validateEntity('node', wp({ spawn: { ...armed(), speedd: 1 } })));
});

test('H12.5: the authored bounds come from limits, and both edges are enforced', () => {
	const at = (o) => validateEntity('node', wp({ spawn: { ...armed(), ...o } }));
	assert.equal(at({ interval: SPAWN_INTERVAL_MIN }), null, 'the floor itself is legal');
	assert.ok(at({ interval: SPAWN_INTERVAL_MIN - 1 }), 'below the floor is not');
	assert.equal(at({ interval: SPAWN_INTERVAL_MAX }), null);
	assert.ok(at({ interval: SPAWN_INTERVAL_MAX + 1 }));
	assert.equal(at({ speed: SPAWN_SPEED_MAX }), null);
	assert.ok(at({ speed: SPAWN_SPEED_MAX + 1 }));
	assert.ok(at({ speed: 0.05 }), 'below the floor -- slower than this is not motion');
	assert.ok(at({ speed: 0 }), 'a spawner that emits nothing is a mistake, not a configuration');
});

test('H12.5: `since` is bounded, because it feeds arithmetic', () => {
	const at = (since) => validateEntity('node', wp({ spawn: { ...armed(), since } }));
	assert.equal(at(Date.now()), null);
	assert.ok(at(1), 'an epoch-zero stamp is corruption, not a diagram somebody armed');
	assert.ok(at(Date.now() + 30 * 86_400_000), 'a month ahead is not clock skew');
	assert.equal(at(Date.now() + 3600_000), null, 'an hour ahead is tolerated -- clocks are imperfect');
});

test('H12.5: the colour must be a colour', () => {
	assert.ok(validateEntity('node', wp({ spawn: { ...armed(), colour: 'red' } })));
	assert.ok(validateEntity('node', wp({ spawn: { ...armed(), colour: 'javascript:x' } })));
	assert.equal(validateEntity('node', wp({ spawn: { ...armed(), kind: 'packet' } })), null);
});

test('H12.5: spawn survives a document round trip, so arming outlives a reload', () => {
	const m = new Model();
	m.put('node', wp({ spawn: armed() }));
	const back = new Model();
	back.load(JSON.parse(JSON.stringify(m.toJSON())));
	assert.deepEqual(back.get('node', 'node-aaaaaa').spawn, m.get('node', 'node-aaaaaa').spawn);
});

test('H12.5: a malformed spawn is refused whole -- nothing partial reaches the document', () => {
	for (const bad of [[], 'on', 42, null, true, { }]) {
		assert.ok(validateEntity('node', wp({ spawn: bad })), `${JSON.stringify(bad)} must be refused`);
	}
});
