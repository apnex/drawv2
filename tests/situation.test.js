/*
H12.6 — the situation as a value.

Two properties carry the weight. It must be SERIALISABLE, because the survey settled that behaviour
runs on both peers and a value that cannot cross a process boundary forecloses that. And it must be
DERIVED, never told -- a waypoint's role is read from the links that touch it, so a situation cannot
disagree with the document it describes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situationOf, oneSelected, onEndpoint, inReadView, onSpawner } from '../engine/index.mjs';

// the small accessor the situation asks its questions through -- the browser hands it a live model,
// the server a stored document, and neither has to become the other
const accessOf = (entities, links = []) => ({
	get: (kind, id) => entities[id] || null,
	linksTouching: (id) => links.filter((l) => l.src === id || l.dst === id || (l.via || []).includes(id)),
});

const WP = 'waypoint-aaaaaa', WP2 = 'waypoint-bbbbbb', ND = 'node-cccccc';
const entities = { [WP]: { id: WP, x: 0, y: 0 }, [WP2]: { id: WP2, x: 40, y: 0 }, [ND]: { id: ND, x: 80, y: 0 } };
const openLink = { id: 'link-dddddd', src: WP, dst: WP2 };

test('H12.6: a situation SERIALISES -- it survives a round trip through JSON unchanged', () => {
	const s = situationOf(accessOf(entities, [openLink]), { mode: 'run', targetId: WP, selection: [WP, ND] }, 1234);
	assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'a value that cannot cross a boundary forecloses the server');
});

test('H12.6: it carries NO methods and no live references -- inert by construction', () => {
	const s = situationOf(accessOf(entities, [openLink]), { targetId: WP });
	const walk = (v) => {
		assert.notEqual(typeof v, 'function', 'a method would not serialise');
		if (v && typeof v === 'object') Object.values(v).forEach(walk);
	};
	walk(s);
});

test('H12.6: the target role is DERIVED from the links, not told', () => {
	const s = situationOf(accessOf(entities, [openLink]), { targetId: WP });
	assert.equal(s.target.role, 'endpoint', 'src of an open link terminates it');
	// the same waypoint, threaded as a bend instead, is a bend -- nothing about the situation changed
	const bent = situationOf(accessOf(entities, [{ id: 'link-eeeeee', src: ND, dst: WP2, via: [WP] }]), { targetId: WP });
	assert.equal(bent.target.role, 'bend');
});

test('H12.6: a CLOSED route has no ends, so nothing on it reads as an endpoint', () => {
	const ring = { id: 'link-ffffff', src: WP, dst: WP, closed: true };
	const s = situationOf(accessOf(entities, [ring]), { targetId: WP });
	assert.equal(s.target.role, 'bend');
	assert.equal(onEndpoint(s), false, 'a ring cannot be armed, and this is why');
});

test('H12.6: an unreferenced waypoint is a bend, and a missing target is null', () => {
	assert.equal(situationOf(accessOf(entities, []), { targetId: WP }).target.role, 'bend');
	assert.equal(situationOf(accessOf(entities, []), { targetId: 'waypoint-999999' }).target, null);
	assert.equal(situationOf(accessOf(entities, []), {}).target, null, 'on nothing is a real answer');
});

test('H12.6: `spawning` reports whether the endpoint is on, not how it is configured', () => {
	const armed = { ...entities, [WP]: { ...entities[WP], spawn: { interval: 1000, speed: 100, kind: 'packet', since: Date.now() } } };
	const s = situationOf(accessOf(armed, [openLink]), { targetId: WP });
	assert.equal(s.target.spawning, true);
	assert.equal(typeof s.target.spawning, 'boolean', 'the numbers belong to whoever runs them');
	assert.equal(situationOf(accessOf(entities, [openLink]), { targetId: WP }).target.spawning, false);
});

test('H12.6: the selection is described, and equal selections compare equal', () => {
	const a = situationOf(accessOf(entities), { selection: [WP, ND] });
	const b = situationOf(accessOf(entities), { selection: [WP, ND] });
	assert.deepEqual(a.selection, b.selection);
	assert.deepEqual(a.selection.kinds, ['node', 'waypoint'], 'kinds are sorted so the value is stable');
	assert.equal(a.selection.size, 2);
	// a duplicated kind is not a duplicated entry
	assert.deepEqual(situationOf(accessOf(entities), { selection: [WP, WP2] }).selection.kinds, ['waypoint']);
});

test('H12.6: defaults are the safe ones -- view mode, not read-only, nothing selected', () => {
	const s = situationOf(accessOf(entities), {});
	assert.equal(s.mode, 'view');
	assert.equal(s.readOnly, false);
	assert.equal(s.selection.size, 0);
	assert.equal(inReadView(s), false, 'nothing is in read view by accident');
});

test('H12.6: the predicates name the question, so no caller re-derives it', () => {
	const armed = { ...entities, [WP]: { ...entities[WP], spawn: { interval: 1000, speed: 100, kind: 'packet', since: Date.now() } } };
	const s = situationOf(accessOf(armed, [openLink]), { mode: 'run', targetId: WP, selection: [WP] });
	assert.equal(inReadView(s), true);
	assert.equal(onEndpoint(s), true);
	assert.equal(onSpawner(s), true);
	assert.equal(oneSelected(s, 'waypoint'), true);
	assert.equal(oneSelected(s, 'node'), false);
	// and a node target is not an endpoint however it is dressed
	assert.equal(onEndpoint(situationOf(accessOf(entities, [openLink]), { targetId: ND })), false);
});

test('H12.6: it runs where there is no DOM -- this test IS the proof', () => {
	assert.equal(typeof globalThis.document, 'undefined');
	assert.ok(situationOf(accessOf(entities, [openLink]), { targetId: WP }).target);
});
