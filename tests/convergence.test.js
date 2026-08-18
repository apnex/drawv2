// GR6 — convergence. A standing regression, not a one-off.
//
// Two browsers and one agent write to the same diagram. At quiescence every participant must hold
// the same document. This is the operational form of "the client and the server agree", and it is
// the only mechanized check that would catch a change applied in one place and not another.
//
// Deterministic: a seeded interleaving, so a failure reproduces exactly. Three faults are injected
// because the interesting failures are not the happy path — a dropped change, a change landing
// under a live gesture, and a writer that disconnects mid-transaction.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Model } from '../document/index.mjs';
import { Store } from '../server/store.js';
import { applyOps } from '../document/ops.mjs';
import { Changes } from '../app/src/changes.js';
import { createEntity, moveEntities, deleteSelection, createGroup } from '../app/src/commands.js';

function rng(seed) {
	let x = seed || 1;
	return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; };
}

const hex = (n) => n.toString(16).padStart(6, '0').slice(-6);
const node = (id, x, y) => ({ id, name: id, type: 'host', shape: 'circle', x, y });
const shape = (m) => {
	const d = m.toJSON();
	delete d.meta.rev;                                     // the legacy counter, gone at CS5
	for (const k of ['nodes', 'waypoints', 'links', 'zones', 'groups']) {
		d[k] = [...d[k]].sort((p, q) => p.id.localeCompare(q.id));
	}
	return JSON.stringify(d);
};

// A participant: its own Model, its own Changes boundary, wired to a shared server Store the way
// main.js wires the real one. `deliver` is the hub's fan-out, which the faults interfere with.
function participant(store, id, name, world) {
	const model = new Model();
	model.load(store.get(id).toJSON());
	const changes = new Changes(model);
	const p = { name, model, changes, version: 0, gesture: false, deferred: [], dropped: 0 };
	changes.onCommit((req) => {
		if (req.verb) return;                              // undo/redo drive the store directly here
		const res = store.commit(id, { ops: req.ops, label: req.label }, 'client', name);
		// a rejection must not leave the client's optimistic apply standing — it repairs (B3/I16)
		if (!res.ok) { p.rejected = (p.rejected || 0) + 1; world.repair(p); return; }
		if (!res.change) return;
		p.version = res.version;
		world.deliver(p, { from: res.change.from, ops: res.change.ops, version: res.version });
	});
	return p;
}

function world(store, id) {
	const peers = [];
	const w = {
		peers,
		deliver(origin, body) {
			for (const q of peers) {
				if (q === origin) continue;                // the origin already applied it locally
				if (w.drop && w.drop(q, body)) { q.dropped++; continue; }
				if (q.gesture) { q.deferred.push(body); continue; }
				w.applyTo(q, body);
			}
		},
		applyTo(q, body) {
			if (typeof body.from === 'number' && body.from < q.version - 1) return;   // stale duplicate
			applyOps(q.model, body.ops);
			q.version = body.version;
		},
		// what a client does when it notices it missed one: refetch authoritative state
		repair(q) {
			q.model.load(store.get(id).toJSON());
			q.version = store.diagrams.get(id).log.version;
			q.dropped = 0;
		},
	};
	return w;
}

function setup(seed) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-conv-'));
	const store = new Store(dir);
	store.init();
	const id = store.list()[0].id;
	const w = world(store, id);
	const a = participant(store, id, 'tab-a', w);
	const b = participant(store, id, 'tab-b', w);
	w.peers.push(a, b);
	return { dir, store, id, w, a, b, r: rng(seed) };
}

const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// A seeded stream of mixed transactions, driven through the REAL builders — a hand-rolled entry
// would skip the local projections (the delete cascade, the group member-steal) that the builders
// perform and the server re-derives, and the divergence would be the harness's, not the system's.
function drive(env, count) {
	const { store, id, a, b, r } = env;
	const writers = [a, b];
	for (let i = 0; i < count; i++) {
		const who = writers[Math.floor(r() * 2) % 2];
		const roll = r();
		const nodes = who.model.all('node');
		const coord = (e) => Math.round((r() * 2 - 1) * e / 60) * 60;

		if (roll < 0.4 || nodes.length < 3) {
			who.changes.commit(createEntity('node', node(`node-${hex(1000 + i)}`, coord(900), coord(480))));
		} else if (roll < 0.6) {
			const n = nodes[Math.floor(r() * nodes.length) % nodes.length];
			who.changes.commit(moveEntities([{ kind: 'node', id: n.id, before: { x: n.x, y: n.y }, after: { x: coord(900), y: coord(480) } }]));
		} else if (roll < 0.75) {
			const s = nodes[0], d = nodes[1];
			if (s && d && s.id !== d.id) {
				who.changes.commit(createEntity('link', { id: `link-${hex(2000 + i)}`, src: s.id, dst: d.id }));
			}
		} else if (roll < 0.85 && nodes.length >= 2) {
			who.changes.commit(createGroup(who.model, [nodes[0].id, nodes[1].id]));
		} else {
			// the cascade-heavy shape: delete a node that links and groups depend on
			const n = nodes[Math.floor(r() * nodes.length) % nodes.length];
			who.changes.commit(deleteSelection(who.model, new Set([n.id])));
		}
	}
	return store.get(id);
}

test('GR6: two browsers and a server converge over 200 seeded mixed transactions', () => {
	const env = setup(20260818);
	try {
		const server = drive(env, 200);
		assert.equal(shape(env.a.model), shape(server), 'tab-a agrees with the server');
		assert.equal(shape(env.b.model), shape(server), 'tab-b agrees with the server');
		assert.ok(server.all('node').length > 0, 'the corpus did real work');
	} finally { cleanup(env.dir); }
});

test('GR6 fault (i): a dropped change is DETECTED, and a repair restores convergence', () => {
	const env = setup(4242);
	try {
		drive(env, 40);
		// tab-b misses exactly one change
		let once = true;
		env.w.drop = (q) => (q === env.b && once ? (once = false, true) : false);
		env.a.changes.commit({ label: 'create', entries: [{ op: 'put', kind: 'node', entity: node('node-dd0001', 300, 300) }] });
		env.w.drop = null;

		const server = env.store.get(env.id);
		assert.notEqual(shape(env.b.model), shape(server), 'the drop really did diverge it');
		assert.equal(env.b.dropped, 1, 'and the gap is observable, not silent');

		env.w.repair(env.b);
		assert.equal(shape(env.b.model), shape(server), 'repair converges it again');
	} finally { cleanup(env.dir); }
});

test('GR6 fault (ii): a change landing under a live gesture is deferred, not applied mid-drag', () => {
	const env = setup(777);
	try {
		drive(env, 30);
		const target = env.b.model.all('node')[0];

		env.b.gesture = true;                              // tab-b starts dragging
		const beforeDrag = env.b.model.get('node', target.id).x;
		env.a.changes.commit({ label: 'move', entries: [{ op: 'set', kind: 'node', id: target.id, after: { x: 780 } }] });

		assert.equal(env.b.model.get('node', target.id).x, beforeDrag, 'the live gesture was not fought');
		assert.equal(env.b.deferred.length, 1, 'the change is held, not dropped');

		env.b.gesture = false;                             // the gesture ends
		env.b.deferred.splice(0).forEach((body) => env.w.applyTo(env.b, body));
		assert.equal(shape(env.b.model), shape(env.store.get(env.id)), 'and convergence is restored on release');
	} finally { cleanup(env.dir); }
});

test('GR6 fault (iii): a writer that disconnects mid-stream loses nothing it committed', () => {
	const env = setup(31337);
	try {
		drive(env, 30);
		// tab-b goes offline: it stops receiving, but tab-a keeps writing
		env.w.drop = (q) => q === env.b;
		for (let i = 0; i < 10; i++) {
			env.a.changes.commit({ label: 'create', entries: [{ op: 'put', kind: 'node', entity: node(`node-${hex(7000 + i)}`, 60 * i - 300, 420) }] });
		}
		env.w.drop = null;

		const server = env.store.get(env.id);
		assert.ok(env.b.dropped >= 10, 'it really was offline');
		assert.equal(shape(env.a.model), shape(server), 'the writer that stayed online is in step');

		env.w.repair(env.b);                               // reconnect = read authoritative state
		assert.equal(shape(env.b.model), shape(server), 'and the returning peer converges');
		// nothing tab-a committed was lost while its peer was away
		for (let i = 0; i < 10; i++) assert.ok(server.get('node', `node-${hex(7000 + i)}`), `change ${i} survived`);
	} finally { cleanup(env.dir); }
});

test('GR6: an agent write reaches both browsers', () => {
	const env = setup(9001);
	try {
		drive(env, 20);
		// the agent writes through the store directly, as REST does, and the hub fans it out
		const res = env.store.commit(env.id, { label: 'create', ops: [
			{ op: 'put', kind: 'node', entity: node('node-ac0001', 660, -420) },
		] }, 'server', 'agent-1');
		assert.equal(res.ok, true);
		env.w.deliver(null, { from: res.change.from, ops: res.change.ops, version: res.version });

		const server = env.store.get(env.id);
		assert.equal(shape(env.a.model), shape(server), 'tab-a saw the agent write');
		assert.equal(shape(env.b.model), shape(server), 'tab-b saw it too');
		assert.ok(env.a.model.get('node', 'node-ac0001'));
	} finally { cleanup(env.dir); }
});
