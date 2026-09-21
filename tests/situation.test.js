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
const openLink = { id: 'link-dddddd', name: 'link-dddddd', src: WP, dst: WP2 };

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
	// B208 -- the SET. A bend is the EMPTY set rather than a named role.
	assert.deepEqual(s.target.roles, ['endpoint'], 'src of an open link terminates it');
	// the same waypoint, threaded as a bend instead, is a bend -- nothing about the situation changed
	const bent = situationOf(accessOf(entities, [{ id: 'link-eeeeee', name: 'link-eeeeee', src: ND, dst: WP2, via: [WP] }]), { targetId: WP });
	assert.deepEqual(bent.target.roles, [], 'threaded as a bend: no sub-type applies');
});

test('H12.6: a CLOSED route has no ends, so nothing on it reads as an endpoint', () => {
	const ring = { id: 'link-ffffff', name: 'link-ffffff', src: WP, dst: WP, closed: true };
	const s = situationOf(accessOf(entities, [ring]), { targetId: WP });
	assert.deepEqual(s.target.roles, [], 'a ring has no ends, so no sub-type applies');
	assert.equal(onEndpoint(s), false, 'a ring cannot be armed, and this is why');
});

test('H12.6: an unreferenced waypoint is a bend, and a missing target is null', () => {
	assert.deepEqual(situationOf(accessOf(entities, []), { targetId: WP }).target.roles, [], 'no links: no sub-type');
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

/*
B208: roles are a SET, and `onEndpoint` reads it.

The design named this as the migration hazard before it was written. `role === 'endpoint'` keeps
compiling against a set-valued field, is false for every waypoint, and would stop spawner arming
everywhere with nothing failing to build -- B201's shape, where a comparison went on working while
meaning something else.

The T is the case that proves the set was necessary rather than tidy. A waypoint one link bends
through and another terminates at holds BOTH roles; under a single value the old function returned
`bend` on sight of a via, so a T-junction would silently lose its spawner pad.
*/
test('B208: a waypoint holds every role that applies, and onEndpoint reads the set', async () => {
	const { waypointRoles } = await import('../kernel/index.mjs');

	/*
	B211 -- a junction is where links TERMINATE, and threading is invisible to it. Two links bending
	at one point is two bends, which is what it looks like. And a junction SUPERSEDES an endpoint:
	every link at one terminates there, so saying both would say nothing and would draw two layers
	where the outer is redundant.
	*/
	const cases = [
		['a bend adds no sub-type', [{ src: 'a', dst: 'b', via: ['w'] }], []],
		['TWO threaded links is two bends', [{ src: 'a', dst: 'b', via: ['w'] }, { src: 'c', dst: 'd', via: ['w'] }], []],
		['a terminus is an endpoint', [{ src: 'w', dst: 'a' }], ['endpoint']],
		['a closed ring has no ends', [{ src: 'w', dst: 'w', closed: true }], []],
		['threaded plus one terminus is still just a terminus', [{ src: 'a', dst: 'b', via: ['w'] }, { src: 'w', dst: 'c' }], ['endpoint']],
		// B214 -- TWO is never a junction. In+out is a path through, which collapses to a bend; two
		// arrivals or two departures is a terminus something else also reaches.
		['two, in and out', [{ src: 'a', dst: 'w' }, { src: 'w', dst: 'b' }], ['endpoint']],
		['two arrivals', [{ src: 'a', dst: 'w' }, { src: 'b', dst: 'w' }], ['endpoint']],
		['THREE is the smallest meet', [{ src: 'w', dst: 'a' }, { src: 'w', dst: 'b' }, { src: 'w', dst: 'c' }], ['junction']],
	];
	for (const [why, links, want] of cases) {
		assert.deepEqual(waypointRoles('w', links), want, why);
	}

	// `bend` is never a member -- it is the empty set, so ['bend','endpoint'] cannot be constructed
	for (const [, links] of cases) {
		assert.ok(!waypointRoles('w', links).includes('bend'), 'bend must be the ABSENCE of a sub-type, not a member');
	}

	/*
	The predicate, through a real situation rather than a hand-built object -- the point is that the
	field `onEndpoint` reads is the one `situationOf` populates.
	*/
	const access = {
		get: (kind, id) => (kind === 'waypoint' && id === 'waypoint-aa0001' ? { id, x: 0, y: 0 } : null),
		linksTouching: () => [
			{ id: 'link-aa0001', src: 'node-aa0001', dst: 'waypoint-aa0001' },
			{ id: 'link-aa0002', src: 'waypoint-aa0001', dst: 'node-aa0003' },
			{ id: 'link-aa0003', src: 'node-aa0002', dst: 'waypoint-aa0001' },
		],
	};
	const s = situationOf(access, { mode: 'run', readOnly: false, targetId: 'waypoint-aa0001', selection: [] }, Date.now());
	assert.deepEqual(s.target.roles, ['junction'], 'the situation carries the set the kernel derived');

	// a lone terminus still arms, and that is the predicate's job -- read from the SET, not a string
	const lone = {
		get: access.get,
		linksTouching: () => [{ id: 'link-aa0001', src: 'waypoint-aa0001', dst: 'node-aa0003' }],
	};
	const t = situationOf(lone, { mode: 'run', readOnly: false, targetId: 'waypoint-aa0001', selection: [] }, Date.now());
	assert.equal(onEndpoint(t), true,
		'a terminus must arm -- if this is false, onEndpoint is reading a string and arming is dead everywhere');
});
