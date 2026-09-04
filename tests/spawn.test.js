/*
H12.5 — `spawn` on an endpoint waypoint: document state, whole or absent.

The field is DOCUMENT state deliberately, where a mover is not. Arming an endpoint is intent: it
should survive a reload, reach the other viewers, and be undoable like anything else a person did.
The movers it implies are none of those things, which is exactly why they are derived instead.

Both peers are checked here. `model/shape.mjs` says which optional fields a kind may carry and the
client trusts it; `server/validate.js` refuses what arrives anyway. B86 is the standing reason those
two are tested together rather than apart -- one number, two enforcers, or the pair drifts.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntity } from '../server/validate.js';
import { OPTIONAL } from '../model/shape.mjs';
import { SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, SPAWN_SPEED_MAX } from '../model/limits.mjs';
import { Model } from '../model/model.mjs';

const wp = (extra) => ({ id: 'waypoint-aaaaaa', name: 'waypoint-aaaaaa', x: 0, y: 0, ...extra });
const armed = () => ({ interval: 1000, speed: 1.4, kind: 'packet', since: Date.now() });

test('H12.5: a waypoint may carry spawn, and the two peers agree that it may', () => {
	assert.ok(OPTIONAL.waypoint.has('spawn'), 'the model must allow the field');
	assert.equal(validateEntity('waypoint', wp({ spawn: armed() })), null, 'the server must accept it');
});

test('H12.5: absent spawn is the normal case and stays legal', () => {
	assert.equal(validateEntity('waypoint', wp({})), null);
	assert.equal(validateEntity('waypoint', wp({ pinned: true })), null, 'B162 pinned is undisturbed');
});

test('H12.5: a spawner is WHOLE or absent -- a partial one is not a state', () => {
	for (const missing of ['interval', 'speed', 'kind', 'since']) {
		const partial = armed();
		delete partial[missing];
		assert.ok(validateEntity('waypoint', wp({ spawn: partial })), `missing ${missing} must be refused`);
	}
});

test('H12.5: an unknown key is refused rather than ignored', () => {
	// direction in particular: it is DERIVED from which end of the link this is, and accepting a
	// stored one would create a second answer that can disagree with the link
	assert.ok(validateEntity('waypoint', wp({ spawn: { ...armed(), direction: 'forward' } })));
	assert.ok(validateEntity('waypoint', wp({ spawn: { ...armed(), speedd: 1 } })));
});

test('H12.5: the authored bounds come from limits, and both edges are enforced', () => {
	const at = (o) => validateEntity('waypoint', wp({ spawn: { ...armed(), ...o } }));
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
	const at = (since) => validateEntity('waypoint', wp({ spawn: { ...armed(), since } }));
	assert.equal(at(Date.now()), null);
	assert.ok(at(1), 'an epoch-zero stamp is corruption, not a diagram somebody armed');
	assert.ok(at(Date.now() + 30 * 86_400_000), 'a month ahead is not clock skew');
	assert.equal(at(Date.now() + 3600_000), null, 'an hour ahead is tolerated -- clocks are imperfect');
});

test('H12.5: the colour must be a colour', () => {
	assert.ok(validateEntity('waypoint', wp({ spawn: { ...armed(), colour: 'red' } })));
	assert.ok(validateEntity('waypoint', wp({ spawn: { ...armed(), colour: 'javascript:x' } })));
	assert.equal(validateEntity('waypoint', wp({ spawn: { ...armed(), kind: 'packet' } })), null);
});

test('H12.5: spawn survives a document round trip, so arming outlives a reload', () => {
	const m = new Model();
	m.put('waypoint', wp({ spawn: armed() }));
	const back = new Model();
	back.load(JSON.parse(JSON.stringify(m.toJSON())));
	assert.deepEqual(back.get('waypoint', 'waypoint-aaaaaa').spawn, m.get('waypoint', 'waypoint-aaaaaa').spawn);
});

test('H12.5: a malformed spawn is refused whole -- nothing partial reaches the document', () => {
	for (const bad of [[], 'on', 42, null, true, { }]) {
		assert.ok(validateEntity('waypoint', wp({ spawn: bad })), `${JSON.stringify(bad)} must be refused`);
	}
});

/*
B172 -- a document written in the OLD spawn shape must still open.

This is the half that can lose data rather than merely misbehave. `spawn` is whole-or-absent and
refuses an unknown key, so a stored `colour` would be REFUSED at load -- and a refused document is
SKIPPED, which is a diagram vanishing from the list rather than an error anybody sees. The one
already armed on production would have been the first casualty.

Written against the shape a document is actually STORED in. A first version of this test used an
object keyed by id, the migration threw on it, and the fixture was wrong rather than the code --
which is why this reads the real thing rather than a hand-drawn approximation of it.
*/
test('B172: a spawner stored with `colour` and pixel speed still loads, converted', async () => {
	const { Store } = await import('../server/store.js');
	const os = await import('node:os'); const fsp = await import('node:fs'); const pathp = await import('node:path');
	const { STD } = await import('../kernel/spec.mjs');

	const dir = fsp.mkdtempSync(pathp.join(os.tmpdir(), 'draw-b172-'));
	fsp.writeFileSync(pathp.join(dir, 'diagram-aa0001.json'), JSON.stringify({
		meta: { id: 'diagram-aa0001', name: 'legacy', version: 3, schema: 1 },
		nodes: [], zones: [], groups: [],
		waypoints: [{ id: 'waypoint-aa0001', name: 'waypoint-aa0001', x: 0, y: 180,
			spawn: { interval: 700, speed: 160, colour: '#4fc3f7', since: 1788000000000 } }],
		links: [],
	}));
	try {
		const store = new Store(dir, { flushMs: 3_600_000 });
		await store.init();
		const entry = store.diagrams.get('diagram-aa0001');
		assert.ok(entry, 'the diagram LOADED -- a refused one is skipped, which is data loss');
		const wp = entry.model.all('waypoint').find((w) => w.id === 'waypoint-aa0001');
		assert.equal(wp.spawn.colour, undefined, 'the retired key is gone');
		assert.equal(wp.spawn.kind, 'packet', 'and a kind took its place');
		assert.equal(wp.spawn.speed, Math.round((160 / STD.pitch) * 100) / 100, 'pixels became cells');
		assert.equal(wp.spawn.interval, 700, 'everything else is untouched');
		assert.equal(validateEntity('waypoint', wp), null, 'and the result passes the strict schema');
	} finally { fsp.rmSync(dir, { recursive: true, force: true }); }
});
