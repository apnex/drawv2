// GR5 — the differential oracle.
//
// server/txn.mjs#plan replaces the single-op planMutation that lived in server/store.js. The old
// implementation is deleted; this asserts the new one agrees with it, over randomly generated
// documents and mutations, before the reference is only reachable through git history.
//
// The reference is frozen at tests/fixtures/plan-reference.mjs. Seeded, so a failure reproduces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { plan } from '../server/txn.mjs';
import { applyOps } from '../model/ops.mjs';
import { planMutation } from './fixtures/plan-reference.mjs';

// xorshift — deterministic, no dependency
function rng(seed) {
	let x = seed || 1;
	return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; };
}

const hex = (n) => n.toString(16).padStart(6, '0').slice(-6);
const pick = (r, xs) => xs[Math.floor(r() * xs.length) % xs.length];
const coord = (r, ext) => Math.round((r() * 2 - 1) * ext / 60) * 60;

// A random but structurally valid document: nodes, waypoints, links (some routed via waypoints),
// zones, and groups drawn from the live nodes.
function makeDoc(r, i) {
	const nodes = Array.from({ length: 2 + Math.floor(r() * 5) }, (_, k) =>
		({ id: `node-${hex(i * 100 + k)}`, name: `n${k}`, type: pick(r, ['host', 'router', 'server']), shape: 'circle', x: coord(r, 900), y: coord(r, 480) }));
	const waypoints = Array.from({ length: Math.floor(r() * 3) }, (_, k) =>
		({ id: `waypoint-${hex(i * 100 + 50 + k)}`, x: coord(r, 900), y: coord(r, 480) }));
	const links = [];
	for (let k = 0; k < 1 + Math.floor(r() * 3); k++) {
		const a = pick(r, nodes), b = pick(r, nodes);
		if (a.id === b.id) continue;
		const via = waypoints.length && r() > 0.5 ? [pick(r, waypoints).id] : undefined;
		links.push({ id: `link-${hex(i * 100 + 70 + k)}`, src: a.id, dst: b.id, ...(via ? { via } : {}) });
	}
	const groups = [];
	if (nodes.length >= 2 && r() > 0.4) {
		const members = nodes.slice(0, 2 + Math.floor(r() * (nodes.length - 2))).map((n) => n.id);
		groups.push({ id: `group-${hex(i * 100 + 90)}`, name: 'g', members });
	}
	return { meta: { id: `diagram-${hex(i)}`, name: 'd', slides: { url: '', presentationId: '', pageId: '' } },
		nodes, waypoints, links, zones: [], groups };
}

// A random mutation in the OLD wire vocabulary, plus its equivalent in the new op vocabulary.
function makeMutation(r, doc) {
	const kinds = ['node', 'waypoint', 'link', 'zone', 'group'];

	// ~20% deliberately invalid: a corpus in which nothing is ever rejected cannot prove the two
	// planners agree on REJECTION, only on acceptance.
	if (r() < 0.2) {
		const bad = Math.floor(r() * 4);
		if (bad === 0) {           // set on an entity that does not exist
			const id = `node-${hex(800000 + Math.floor(r() * 1000))}`;
			return [{ action: 'set', kind: 'node', entity: { id, x: 60 } }, { op: 'set', kind: 'node', id, patch: { id, x: 60 } }];
		}
		if (bad === 1) {           // out-of-surface coordinate
			const e = { id: `node-${hex(810000 + Math.floor(r() * 1000))}`, name: 'x', type: 'host', shape: 'circle', x: 99999, y: 0 };
			return [{ action: 'put', kind: 'node', entity: e }, { op: 'put', kind: 'node', entity: e }];
		}
		if (bad === 2) {           // unknown field
			const e = { id: `node-${hex(820000 + Math.floor(r() * 1000))}`, name: 'x', type: 'host', shape: 'circle', x: 0, y: 0, bogus: 1 };
			return [{ action: 'put', kind: 'node', entity: e }, { op: 'put', kind: 'node', entity: e }];
		}
		const e = { id: `link-${hex(830000 + Math.floor(r() * 1000))}`, src: 'node-ffffff', dst: 'node-fffffe' };
		return [{ action: 'put', kind: 'link', entity: e }, { op: 'put', kind: 'link', entity: e }];   // dangling endpoints
	}

	const action = pick(r, ['put', 'set', 'del']);
	if (action === 'del') {
		const pool = kinds.flatMap((k) => (doc[`${k}s`] || []).map((e) => [k, e.id]));
		if (!pool.length) return null;
		const [kind, id] = pick(r, pool);
		return [{ action: 'del', kind, entity: { id } }, { op: 'del', kind, id }];
	}
	if (action === 'set') {
		const pool = [...doc.nodes, ...doc.waypoints].map((e) => [e.id.split('-')[0], e]);
		if (!pool.length) return null;
		const [kind, e] = pick(r, pool);
		const patch = { id: e.id, x: coord(r, 900), y: coord(r, 480) };
		return [{ action: 'set', kind, entity: patch }, { op: 'set', kind, id: e.id, patch }];
	}
	// ~15%: re-put an entity that is ALREADY in the document, byte for byte. CS6 taught plan() to
	// narrow this to zero ops (X8) and the frozen oracle does not — so without this case the ONE
	// planner behaviour CS6 changed sits outside the differential, and GR5 goes green while blind
	// to it. The corpus has to reach the change, or the guardrail is decoration.
	if (r() < 0.15) {
		const pool = [...doc.nodes, ...doc.waypoints, ...doc.links, ...doc.groups];
		if (pool.length) {
			const e = pick(r, pool);
			const kind = e.id.split('-')[0];
			const same = JSON.parse(JSON.stringify(e));
			return [{ action: 'put', kind, entity: same }, { op: 'put', kind, entity: same }, 'identical-put'];
		}
	}
	const id = `node-${hex(900000 + Math.floor(r() * 9000))}`;
	const entity = { id, name: 'new', type: 'host', shape: 'circle', x: coord(r, 900), y: coord(r, 480) };
	return [{ action: 'put', kind: 'node', entity }, { op: 'put', kind: 'node', entity }];
}

// The two planners emit the same ops in different shapes ({action,kind,entity|id|patch} vs
// {op,kind,entity|id|patch}). Normalise to compare the DECISION, not the encoding.
const norm = (ops) => ops.map((o) => {
	const kind = o.kind, act = o.action || o.op;
	if (act === 'del') return `del ${kind} ${o.id}`;
	if (act === 'set') return `set ${kind} ${o.id} ${JSON.stringify(Object.fromEntries(Object.entries(o.patch).filter(([k]) => k !== 'id').sort()))}`;
	return `put ${kind} ${JSON.stringify(Object.entries(o.entity).sort())}`;
});

test('GR5: plan() agrees with the frozen planMutation over 1000 seeded random mutations', () => {
	const r = rng(20260818);
	let compared = 0, rejectedBoth = 0, narrowedPuts = 0, collisionDroppedLinks = 0, invariantRefusals = 0;

	for (let i = 1; i <= 1000; i++) {
		const doc = makeDoc(r, i);
		const model = new Model();
		model.load(doc);
		const pair = makeMutation(r, doc);
		if (!pair) continue;
		const [legacy, modern, note] = pair;

		const before = JSON.stringify(model.toJSON());
		const a = planMutation(model, legacy);
		const b = plan(model, [modern]);
		assert.equal(JSON.stringify(model.toJSON()), before, `iteration ${i}: planning mutated the model`);

		/*
		The FOURTH deliberate divergence (B81): plan() enforces a document invariant the frozen
		oracle never had -- at most one straight link between a pair -- so it REFUSES a put or set
		the oracle accepted. The corpus reaches this freely because its generator predates the rule.

		Bounded structurally rather than by trusting the message: the refused op must be one that
		would leave a straight link on a pair that already carries one. A refusal for any other
		reason, or on any other shape, is still a real disagreement and still fails.
		*/
		if (a.ok && !b.ok && /straight links between/.test(b.error || '')) {
			const ent = modern.entity || model.get('link', modern.id);
			const patched = modern.op === 'set' ? { ...ent, ...modern.patch } : ent;
			assert.equal(modern.kind, 'link', `iteration ${i}: the invariant fired on a non-link op`);
			assert.ok(!patched.via || patched.via.length === 0,
				`iteration ${i}: the invariant fired on an op that does not produce a straight link`);
			const key = (l) => (l.src < l.dst ? `${l.src}|${l.dst}` : `${l.dst}|${l.src}`);
			assert.ok(model.all('link').some((x) => x.id !== patched.id && (!x.via || !x.via.length)
				&& key(x) === key(patched)), `iteration ${i}: no existing straight link to collide with`);
			invariantRefusals++;
			continue;
		}
		/*
		The FIFTH deliberate divergence (B112): plan() enforces one occupant per anchor and the
		frozen oracle never had it, so it REFUSES a put or set the oracle accepted. The corpus
		reaches this freely -- its generator places nodes without consulting occupancy, which is a
		fair description of how the defect reached production in the first place.

		Bounded structurally rather than by trusting the message, exactly as the fourth is: the
		refused op must actually land a node or waypoint where another already sits. A refusal for
		any other reason, or on any other shape, is still a real disagreement.
		*/
		if (a.ok && !b.ok && /occupy the same anchor/.test(b.error || '')) {
			const ent = modern.entity || model.get(modern.kind, modern.id);
			const patched = modern.op === 'set' ? { ...ent, ...modern.patch } : ent;
			assert.ok(['node', 'waypoint'].includes(modern.kind),
				`iteration ${i}: the occupancy invariant fired on a ${modern.kind} op`);
			const others = [...model.all('node'), ...model.all('waypoint')];
			assert.ok(others.some((o2) => o2.id !== patched.id && o2.x === patched.x && o2.y === patched.y),
				`iteration ${i}: nothing already occupies (${patched.x},${patched.y})`);
			invariantRefusals++;
			continue;
		}
		if (!a.ok || !b.ok) {
			assert.equal(a.ok, b.ok, `iteration ${i}: acceptance disagrees — legacy ${a.error}, modern ${b.error}`);
			rejectedBoth++;
			continue;
		}
		// The one deliberate divergence: plan() narrows a `set` to the keys that actually change,
		// so a value-identical set is an empty plan where planMutation emitted a redundant op.
		// plan() narrows a `set` to the keys that actually change; planMutation emitted the patch
		// whole. Narrow the reference the same way so the comparison is about the DECISION.
		const narrowLegacy = a.ops.map((o) => {
			if (o.action !== 'set') return o;
			const cur = model.get(o.kind, o.id) || {};
			const patch = Object.fromEntries(Object.entries(o.patch).filter(([k, v]) => k !== 'id' && cur[k] !== v));
			return Object.keys(patch).length ? { ...o, patch } : null;
		}).filter(Boolean);
		/*
		The SECOND deliberate divergence (X8, new at CS6): plan() narrows a put whose entity is
		already present unchanged to zero ops; the frozen oracle emits the redundant put.

		The oracle is NOT edited to match — that is the whole point of freezing it. The divergence
		is named, bounded and asserted instead: the modern plan must be EMPTY, the legacy plan must
		be exactly the one redundant put, and the group-steal case is excluded (a put that also
		steals members is not a no-op and must not narrow).
		*/
		if (note === 'identical-put' && b.ops.length === 0) {
			assert.equal(a.ops.length, 1, `iteration ${i}: the oracle should emit exactly the redundant put`);
			assert.equal(a.ops[0].action, 'put');
			narrowedPuts++;
			continue;
		}
		/*
		The THIRD deliberate divergence (B81, new at H10.10): deleting a waypoint that is a link's
		only bend leaves that link straight, and a pair carries only one straight link. Where the
		strip would produce a colliding duplicate, plan() DELETES the link; the frozen oracle
		strips it to `via: []` and leaves the collision in the document.

		Named and bounded rather than smoothed over, and not by re-deriving the rule here -- that
		would let the test agree with itself. The assertion is structural: wherever the two differ,
		the modern op must be a `del` of a link the oracle merely `set`, and the document must
		already hold a straight link on that pair, which is the only circumstance the rule fires
		in. Anything else is a real divergence and still fails.
		*/
		const legacyById = new Map(narrowLegacy.filter((o) => o.kind === 'link').map((o) => [o.id, o]));
		const straightPair = (l) => {
			const key = l.src < l.dst ? `${l.src}|${l.dst}` : `${l.dst}|${l.src}`;
			return model.all('link').some((x) => x.id !== l.id && (!x.via || !x.via.length)
				&& (x.src < x.dst ? `${x.src}|${x.dst}` : `${x.dst}|${x.src}`) === key);
		};
		const collisionDels = b.ops.filter((o) => {
			if (o.op !== 'del' || o.kind !== 'link') return false;
			const was = legacyById.get(o.id);
			if (!was || was.action !== 'set' || !was.patch || was.patch.via?.length !== 0) return false;
			const live = model.get('link', o.id);
			return !!live && straightPair(live);
		});
		if (collisionDels.length) {
			const ids = new Set(collisionDels.map((o) => o.id));
			collisionDroppedLinks += ids.size;
			assert.deepEqual(
				norm(b.ops.filter((o) => !(o.kind === 'link' && ids.has(o.id)))),
				norm(narrowLegacy.filter((o) => !(o.kind === 'link' && ids.has(o.id)))),
				`iteration ${i}: divergence beyond the B81 collision rule`,
			);
			compared++;
			continue;
		}
		assert.deepEqual(norm(b.ops), norm(narrowLegacy), `iteration ${i}: op lists diverge for ${JSON.stringify(modern)}`);
		compared++;
	}
	assert.ok(compared > 500, `expected a healthy sample, compared ${compared}`);
	assert.ok(rejectedBoth > 0, 'the corpus should exercise rejection too');
	assert.ok(narrowedPuts > 20, `the corpus must REACH the CS6 narrowing, hit it ${narrowedPuts} times`);
	assert.ok(invariantRefusals > 0,
		`the corpus must REACH the B81 invariant, hit it ${invariantRefusals} times — a divergence nothing exercises is not proven`);
});

// X8 claims the narrowing is suppressed when the put also steals group members. A no-op that
// silently skipped the "node in at most one group" repair would reintroduce B1 through the back
// door, so the claim is asserted rather than trusted.
test('GR5/X8: an identical put that ALSO steals group members is NOT narrowed away', () => {
	const model = new Model();
	model.load({ meta: { id: 'diagram-aa0001', name: 'd', slides: { url: '', presentationId: '', pageId: '' } },
		nodes: [1, 2, 3].map((n) => ({ id: `node-aa000${n}`, name: `n${n}`, type: 'host', shape: 'circle', x: n * 60, y: 0 })),
		waypoints: [], links: [], zones: [],
		groups: [
			{ id: 'group-aa0004', name: 'a', members: ['node-aa0001', 'node-aa0002'] },
			{ id: 'group-aa0005', name: 'b', members: ['node-aa0002', 'node-aa0003'] },
		] });

	// re-put group-aa0004 EXACTLY as stored: identical, but group b still holds node-aa0002
	const same = JSON.parse(JSON.stringify(model.get('group', 'group-aa0004')));
	const p = plan(model, [{ op: 'put', kind: 'group', entity: same }]);
	assert.equal(p.ok, true);
	assert.ok(p.ops.length > 1, 'not narrowed — the steal is real work');
	assert.ok(p.ops.some((o) => o.kind === 'group' && o.id === 'group-aa0005'), 'group b is repaired');

	// and once the invariant holds, the same put IS narrowed
	applyOps(model, p.ops);
	const again = plan(model, [{ op: 'put', kind: 'group', entity: same }]);
	assert.deepEqual(again.ops, [], 'nothing left to steal, nothing to do');
});

test('GR5: plan() emits an inverse that restores the pre-state, over the same corpus', () => {
	const r = rng(775533);
	let checked = 0;

	for (let i = 1; i <= 400; i++) {
		const doc = makeDoc(r, i);
		const model = new Model();
		model.load(doc);
		const pair = makeMutation(r, doc);
		if (!pair) continue;
		const p = plan(model, [pair[1]]);
		if (!p.ok || !p.ops.length) continue;

		// Order-insensitive by design: a put-based inverse appends a restored entity to the end of
		// its collection, so undo does not restore intra-kind ordering. The pre-CS1 client undo had
		// the identical property (app/src/commands.js applyEntry used model.put too), so this is not
		// a CS1 regression — it is recorded as B10 with the renderer draw-order consequence.
		const shape = (m) => {
			const d = m.toJSON(); delete d.meta.version;
			for (const k of ['nodes', 'waypoints', 'links', 'zones', 'groups']) {
				d[k] = [...d[k]].sort((p, q) => p.id.localeCompare(q.id));
			}
			return JSON.stringify(d);
		};
		const before = shape(model);
		applyOps(model, p.ops);
		applyOps(model, p.inverse);
		assert.equal(shape(model), before, `iteration ${i}: inverse did not restore for ${JSON.stringify(pair[1])}`);
		checked++;
	}
	assert.ok(checked > 200, `expected a healthy sample, checked ${checked}`);
});
