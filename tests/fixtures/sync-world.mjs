/*
THE SYNC WORLD -- a real server (Store + protocol Session + Hub) and N real tabs (Model + Changes + Sync), joined by per-tab
queues that a scheduler drains one message at a time. H19.13 (U-a; dev/design/unification/SYNC-HARDENING.md): the lab's K1
attack harness, kept in the private lab-design archive since 2026-09-28, ported into the repository and onto the composition
production runs since the cutover -- each tab's Model draws with the network and its Changes preview every commit with the
planner, as the product page composes them (app/src/compose-canvas.js, network/page.mjs).


Oracles (all computed from the harness's OWN bookkeeping, never from Sync.pendingOps):
- SHADOW: whenever a tab is not mid-gesture, holds nothing deferred and is not waiting on a resync it
  asked for, it must equal  S(last message it processed) + every request of its own not yet answered, in
  order, each PLANNED on S as the planner would (U-a): the page previews every commit with the planner, so
  a request is applied as its plan, not as written. S is the server document captured at the moment the
  server SENT that message. The oracle reads the planner -- the edits' specification -- never Sync or
  Changes, the code under test.
- REGRESSION: every field its own unanswered ops set shows the value the latest of them set.
- SNAPBACK: during a drag, each dragged entity shows the drag preview after every inbound message.
- DIVERGE: at quiescence each tab equals the server.
- INVALID (U-a): at quiescence the server's document is valid.
- ROUTE (U-a): at quiescence each tab draws every link along the route the server's document gives it, and
  down where the server's is down -- a tab equal to the server in its entities but not in what it draws
  would show a person something the server does not hold.
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Model } from '../../model/model.mjs';
import { applyOps } from '../../model/ops.mjs';
import { Changes, applyAnswer } from '../../app/src/changes.js';
import { Sync } from '../../app/src/sync.js';
import * as commands from '../../app/src/commands.js';
import { Session } from '../../server/protocol.js';
import { Hub } from '../../server/hub.js';
import { OWNER, openStore } from './app.mjs';
import { createPageNetwork } from '../../network/page.mjs';
import { plan } from '../../planner/txn.mjs';
import { validateDoc } from '../../planner/validate.js';
import { productKinds } from '../../product/kinds.mjs';
import { NETWORK_ROWS } from '../../network/kinds.mjs';
import { linkReading, readModel } from '../../network/read-model.mjs';
import { createTransit } from '../../network/transit.mjs';
import { pipeEntity } from '../../network/pipe-kind.mjs';

let NOW = 1_700_000_000_000;
const realNow = Date.now;
Date.now = () => NOW;
export const clock = { advance(ms) { NOW += ms; }, now: () => NOW, real: realNow };

/*
Per-tab localStorage. A browser gives each origin one store; the second writer here stands for another
browser, so each tab gets its own. `enter(t)` selects whose store the global resolves to, and every
harness entry point into a tab calls it. `storage: false` leaves localStorage undefined (Node's default),
which is what tests/b242-reconcile.test.js runs under.
*/
let CURRENT = null;
export function installStorage() {
	globalThis.localStorage = {
		getItem: (k) => (CURRENT.storage.has(k) ? CURRENT.storage.get(k) : null),
		setItem: (k, v) => { CURRENT.storage.set(k, String(v)); },
		removeItem: (k) => { CURRENT.storage.delete(k); },
	};
}
export const enter = (t) => { CURRENT = t; };

/*
The code under test, imported by literal path (the layer scanner judges every edge, L2) -- the K1 harness loaded it from a
root so one copy could run against two trees; in the repository it runs against the repository.
*/
export async function loadCode() {
	return {
		Model, Changes, Sync, commands, Session, Hub, OWNER, openStore, applyOps,
		// the page's composition (U-a): the network a tab draws with, the kinds it holds, and the planner its preview runs
		createPageNetwork, plan, validateDoc, applyAnswer, KINDS: productKinds(...NETWORK_ROWS),
		linkReading, readModel, createTransit, pipeEntity,
	};
}

// independent copy of changes.js toOp (4 lines), so the oracle does not read the code under test
function toOp(e) {
	if (e.op === 'put') return { op: 'put', kind: e.kind, entity: JSON.parse(JSON.stringify(e.entity)) };
	if (e.op === 'del') return { op: 'del', kind: e.kind, id: e.entity.id };
	if (e.op === 'set') return { op: 'set', kind: e.kind, id: e.id, patch: JSON.parse(JSON.stringify(e.after)) };
	if (e.op === 'meta') return { op: 'meta', patch: { ...e.patch } };
	throw new Error('toOp ' + e.op);
}

export const KINDS = ['nodes', 'links', 'pipes', 'zones', 'groups'];   // the stored collections since schema 2
// key order inside an entity is not content (a set appends a key a put would place elsewhere)
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys)
	: (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
export function shapeDoc(d0) {
	const d = sortKeys(JSON.parse(JSON.stringify(d0)));
	delete d.meta.version;
	for (const k of KINDS) d[k] = [...(d[k] || [])].sort((p, q) => p.id.localeCompare(q.id));
	d.selection = [...(d.selection || [])].sort();
	return JSON.stringify(d);
}
export const shape = (model) => shapeDoc(model.toJSON());

// entity-level diff, for readable failure lines
export function diffDocs(a0, b0, limit = 6) {
	const a = JSON.parse(a0), b = JSON.parse(b0);
	const out = [];
	for (const k of KINDS) {
		const ma = new Map(a[k].map((e) => [e.id, e])), mb = new Map(b[k].map((e) => [e.id, e]));
		for (const id of new Set([...ma.keys(), ...mb.keys()])) {
			const x = ma.get(id), y = mb.get(id);
			if (!x) { out.push(`${id}: only in B`); continue; }
			if (!y) { out.push(`${id}: only in A`); continue; }
			for (const f of new Set([...Object.keys(x), ...Object.keys(y)])) {
				if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) out.push(`${id}.${f}: A=${JSON.stringify(x[f])} B=${JSON.stringify(y[f])}`);
			}
		}
	}
	if (JSON.stringify(a.meta) !== JSON.stringify(b.meta)) out.push(`meta: A=${JSON.stringify(a.meta)} B=${JSON.stringify(b.meta)}`);
	if (JSON.stringify(a.selection) !== JSON.stringify(b.selection)) out.push(`selection: A=${JSON.stringify(a.selection)} B=${JSON.stringify(b.selection)}`);
	return out.slice(0, limit);
}

export async function makeWorld(code, { seed, tabs = 2, gestureCancelOnLoad = true, flushMs = 3_600_000, storage = true, sharedStorage = false } = {}) {
	if (storage) installStorage(); else delete globalThis.localStorage;
	const shared = new Map();
	const { Model, Changes, Sync, Session, Hub, OWNER, openStore, applyOps, createPageNetwork, plan, applyAnswer, KINDS: kinds } = code;
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-world-'));
	const store = await openStore(dir, { flushMs });
	const made = store.create('sync-world', null, OWNER);
	if (!made.ok) throw new Error(made.error);
	const id = made.model.state.meta.id;
	if (seed && seed.length) {
		const r = store.commit(id, { label: 'seed', ops: seed.map(([kind, entity]) => ({ op: 'put', kind, entity })) }, 'server', 'seed', OWNER);
		if (!r.ok) throw new Error('seed refused: ' + r.error);
	}
	const hub = new Hub();
	const serverDoc = () => JSON.parse(JSON.stringify(store.get(id).toJSON()));
	const log = [];                         // event trace
	const violations = [];

	const world = { store, hub, id, tabs: [], log, violations, code, dir, serverDoc };

	function connect(t) {
		const on = {};
		const ws = { readyState: 1, on: (ev, fn) => { on[ev] = fn; },
			send: (text) => t.down.push({ msg: JSON.parse(text), server: serverDoc() }) };
		t.ws = ws;
		t.session = new Session(ws, store, hub, null, OWNER);
		t.toServer = (cmd, body) => on.message(Buffer.from(JSON.stringify({ cmd, body })));
		t.closeSession = () => { ws.readyState = 3; on.close?.(); };
	}

	for (let i = 0; i < tabs; i++) {
		const t = { i, up: [], down: [], units: [], connected: true, drag: null, awaitResync: false, lastServer: null, sel: [], storage: sharedStorage ? shared : new Map() };
		enter(t);
		let receive = () => {}, status = () => {};
		const net = {
			get status() { return t.connected ? 'open' : 'closed'; },
			subscribe: (fn) => { receive = fn; }, onStatus: (fn) => { status = fn; },
			isOpen: () => t.connected,
			send: (cmd, body) => { if (!t.connected) return false; t.up.push({ cmd, body: JSON.parse(JSON.stringify(body ?? {})) }); return true; },
		};
		// the page's composition (U-a): a Model drawing with the network, Changes previewing every commit with the planner
		t.network = createPageNetwork().network;
		t.model = new Model({ network: t.network, kinds });
		const selection = { subscribe() {}, list: () => [], set() {}, has: () => false };   // the minimum Sync and applyAnswer read
		t.changes = new Changes(t.model, { coalesceMs: 3_600_000, preview: (m, ops) => plan(m, ops, { links: t.network.links, kinds }), apply: (ops) => applyAnswer(t.model, selection, ops) });
		t.sync = new Sync({ model: t.model, net, history: t.changes, selection, onState() {} });
		// wrap commit so the oracle records every locally applied unit, in order
		const realCommit = t.changes.commit.bind(t.changes);
		t.changes.commit = (command) => {
			if (command && command.entries && command.entries.length) {
				t.units.push({ ops: command.entries.map(toOp), txn: null, state: 'window', label: command.label });
			}
			return realCommit(command);
		};
		t.changes.onCommit((req) => {
			const n = t.sync.outbox.length;
			t.sync.submit(req);
			if (!req.ops) return;
			const txn = t.sync.outbox.length > n ? t.sync.outbox.at(-1).txnId : null;
			// the oldest unbound units whose op count adds up to this request are what it carries
			let need = req.ops.length;
			for (const u of t.units) {
				if (need <= 0) break;
				if (u.txn !== null || u.state !== 'window') continue;
				u.txn = txn || 'DROPPED'; u.state = txn ? 'pending' : 'dropped';
				need -= u.ops.length;
			}
			if (need !== 0) throw new Error('unit binding mismatch');
		});
		t.sync.deferInbound = () => !!t.drag;
		// mirror bindGestureDefer's third wire (sync.cancelGesture ->
		// input.cancelDrag when a gesture is live): restore the drag-start values, end, release
		t.sync.cancelGesture = () => {
			if (!t.drag) return;
			const d = t.drag;
			t.drag = null;
			for (const m of d.moved) t.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y });
			log.push(`  [tab${i}] snapshot ended the drag of ${d.moved.map((m) => m.id).join(',')} before the load`);
			t.sync.releaseDeferred();
		};
		// Input's model 'load' handler cancels a live gesture (app/src/input.js:438), and the move
		// gesture's cancel writes each moved entity back to its drag-start position (input.js:83).
		t.model.onChange((action) => {
			if (action !== 'load' || !t.drag || !gestureCancelOnLoad) return;
			const d = t.drag;
			t.drag = null;
			for (const m of d.moved) t.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y });
			log.push(`  [tab${i}] load cancelled the drag of ${d.moved.map((m) => m.id).join(',')} (restored before)`);
			t.sync.releaseDeferred();
		});
		t.receive = (m) => receive(m);
		// count B183 give-ups (Sync says "N unsent changes could not be delivered")
		{ const say = t.sync.say.bind(t.sync); t.sync.say = (text, o) => { const m = /^(\d+) unsent change/.exec(text); if (m) { world.stats['B183 changes abandoned'] = (world.stats['B183 changes abandoned'] || 0) + Number(m[1]); world.stats['B183 abandonment events'] = (world.stats['B183 abandonment events'] || 0) + 1; log.push(`  SAID tab${i}: ${text}`); } return say(text, o); }; }
		t.status = (s) => status(s);
		connect(t);
		world.tabs.push(t);
	}
	world.connect = connect;
	attach(world);

	// hydrate every tab
	for (const t of world.tabs) {
		enter(t);
		t.toServer('hello', { diagram: id });
		while (t.down.length) world.deliver(t, { quiet: true });
	}
	return world;

	// (hoisted helpers below are attached to world)
}

export function attach(world) {
	const { code, log, violations } = world;
	const { Model, applyOps, plan, KINDS: kinds, createPageNetwork } = code;
	const oracleNetwork = createPageNetwork().network;   // the oracle's own, never a tab's

	// S + the tab's own unanswered requests, each PLANNED on S in order as the page's preview plans it (U-a); a request the
	// planner refuses on S is shown as nothing, as a refused preview shows nothing (app/src/changes.js)
	world.expected = (t) => {
		const m = new Model({ network: oracleNetwork, kinds });
		m.load(t.lastServer);
		for (const u of t.units.filter((x) => x.state === 'window' || x.state === 'pending')) {
			const r = plan(m, u.ops, { links: oracleNetwork.links, kinds });
			if (r.ok) applyOps(m, r.ops);
		}
		return m;
	};

	world.pendingFields = (t) => {
		const want = new Map();
		for (const u of t.units) {
			if (u.state !== 'window' && u.state !== 'pending') continue;
			for (const o of u.ops) {
				if (o.op === 'meta') continue;
				const key = `${o.kind}\u0000${o.id ?? o.entity?.id}`;
				if (o.op === 'del') want.set(key, null);
				else if (o.op === 'put') want.set(key, { ...o.entity });
				else want.set(key, { ...(want.get(key) || {}), ...o.patch });
			}
		}
		return want;
	};

	world.enter = enter;
	world.breaks = [];
	world.stats = {};
	world.evals = {};
	world.check = (t, cause, step) => {
		if (!t.sync.hydrated || t.lastServer === null) return;
		const dragged = new Set(t.drag ? t.drag.moved.map((m) => m.id) : []);
		// SNAPBACK
		if (t.drag) {
			for (const m of t.drag.moved) {
				const e = t.model.get(m.kind, m.id);
				if (!e) continue;
				if (e.x !== m.pos.x || e.y !== m.pos.y) {
					const pend = [...world.pendingFields(t).keys()].some((k) => k.endsWith('\u0000' + m.id));
					violations.push({ kind: pend ? 'SNAPBACK-own-pending' : 'SNAPBACK', tab: t.i, step, cause,
						detail: `${m.id} shows (${e.x},${e.y}) during a drag at (${m.pos.x},${m.pos.y})` });
					m.pos = { x: e.x, y: e.y };   // report once per excursion
				}
			}
		}
		if (t.awaitResync) return;
		// REGRESSION (own pending field not showing), ignoring dragged fields
		const regressionOnly = t.awaitResume;
		for (const [key, fields] of world.pendingFields(t)) {
			const [kind, id] = key.split('\u0000');
			if (dragged.has(id)) continue;
			const e = t.model.get(kind, id);
			if (fields === null) { if (e) violations.push({ kind: 'REGRESSION', tab: t.i, step, cause, detail: `${id} present though own pending op deleted it` }); continue; }
			if (!e) continue;   // gone: a foreign or derived delete; the server will refuse the set
			for (const [f, v] of Object.entries(fields)) {
				if (JSON.stringify(e[f]) !== JSON.stringify(v)) {
					violations.push({ kind: 'REGRESSION', tab: t.i, step, cause, detail: `${id}.${f} shows ${JSON.stringify(e[f])}, own pending set ${JSON.stringify(v)}` });
				}
			}
		}
		// SHADOW (not while a reconnect's answer is outstanding: messages lost with the socket are
		// legitimately missing until `sync`/snapshot)
		if (regressionOnly || t.drag || t.sync.deferred.length || t.sync.deferredSnapshot) return;
		const want = shape(world.expected(t)), got = shape(t.model);
		const ok = want === got;
		if (t.lastOk === true) world.evals[cause] = (world.evals[cause] || 0) + 1;   // handler ran on a consistent tab
		if (!ok) {
			violations.push({ kind: 'SHADOW', tab: t.i, step, cause, detail: diffDocs(got, want).join(' | ') + '   (A=tab, B=S+pending)' });
			// BREAK: the handler that took a consistent tab to an inconsistent one (every occurrence)
			if (t.lastOk === true) world.breaks.push({ kind: 'BREAK', tab: t.i, step, cause, detail: diffDocs(got, want).join(' | ') });
			if (t.lastOk === true && process.env.DUMP_BREAK) log.push(`  DUMP tab${t.i} said=${JSON.stringify(t.sync.said?.text)} outbox=${JSON.stringify(t.sync.outbox.map((m) => [m.txnId, m.verb || m.label, !!m.answered, m.version, m.tries]))} units=${JSON.stringify(t.units.filter((u) => u.state === 'pending' || u.state === 'window').map((u) => [u.txn, u.label, u.state]))}`);
		}
		if (t.lastOk === false && ok) world.breaks.push({ kind: 'HEAL', tab: t.i, step, cause, detail: '' });
		t.lastOk = ok;
	};

	world.deliver = (t, { quiet = false, step = -1 } = {}) => {
		enter(t);
		const d = t.down.shift();
		if (!d) return null;
		const { msg, server } = d;
		const b = msg.body || {};
		// bookkeeping the oracle needs, BEFORE the tab runs (it reads nothing the tab computes)
		if (msg.cmd === 'ack' && b.acked) for (const u of t.units) if (u.txn === b.acked && u.state === 'pending') u.state = 'answered';
		if (msg.cmd === 'error' && b.txnId) {
			const inOutbox = t.sync.outbox.some((m) => m.txnId === b.txnId);
			for (const u of t.units) if (u.txn === b.txnId && u.state === 'pending') u.state = 'refused';
			if (inOutbox && b.code !== 'rate-limited') t.awaitResync = true;
		}
		const deferredChange = msg.cmd === 'change' && t.drag;
		if (msg.cmd === 'ack' && Array.isArray(b.ops)) {
			const k = b.label === 'undo' || b.label === 'redo' ? 'ack-' + b.label : 'ack';
			const pend = t.units.some((u) => (u.state === 'pending' && u.txn !== b.acked) || u.state === 'window');
			const consistentBefore = t.lastOk === true;
			world.stats[`${k} delivered`] = (world.stats[`${k} delivered`] || 0) + 1;
			if (pend) world.stats[`${k} with own ops still unanswered`] = (world.stats[`${k} with own ops still unanswered`] || 0) + 1;
			if (pend && consistentBefore) world.stats[`${k} with unanswered ops, from a consistent tab`] = (world.stats[`${k} with unanswered ops, from a consistent tab`] || 0) + 1;
		}
		t.lastServer = server;
		const cause = msg.cmd === 'ack' ? (b.label === 'undo' || b.label === 'redo' ? `ack-${b.label}` : (b.noop ? 'ack-noop' : b.replayed ? 'ack-replayed' : (b.ops ? 'ack' : 'ack-other')))
			: msg.cmd === 'change' ? (deferredChange ? 'change-deferred' : 'change') : msg.cmd;
		if (!quiet) log.push(`  [tab${t.i}] <- ${cause}${b.acked ? ' ' + b.acked : ''}${b.txnId ? ' ' + b.txnId : ''}${b.message ? ' "' + b.message + '"' : ''}${b.version !== undefined ? ' v' + b.version : ''}${b.ops ? ' ops=' + b.ops.length : ''}`);
		t.receive(msg);
		// the held snapshot sits in the one ordered queue
		const heldSnap = t.sync.deferredSnapshot ?? (t.sync.deferred || []).some((m) => m && m.cmd === 'snapshot');
		if (msg.cmd === 'snapshot' && !(t.drag && heldSnap)) { t.awaitResync = false; t.awaitResume = false; }
		if (msg.cmd === 'sync') t.awaitResume = false;
		world.check(t, cause, step);
		return msg;
	};

	world.serve = (t, { step = -1 } = {}) => {
		enter(t);
		const m = t.up.shift();
		if (!m) return null;
		log.push(`  [tab${t.i}] -> ${m.cmd}${m.body.txnId ? ' ' + m.body.txnId : ''}${m.body.label ? ' ' + m.body.label : ''}${m.body.ops ? ' ops=' + m.body.ops.length : ''}`);
		t.toServer(m.cmd, m.body);
		return m;
	};

	// Input's commitMove: drop the gone, restore the drag-start values, commit the move, then D12 release
	world.endDrag = (t, step) => {
		enter(t);
		const d = t.drag;
		if (!d) return;
		t.drag = null;
		const moved = d.moved.filter((m) => t.model.get(m.kind, m.id));
		for (const m of moved) t.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y });
		const moves = moved.filter((m) => m.pos.x !== m.before.x || m.pos.y !== m.before.y)
			.map((m) => ({ kind: m.kind, id: m.id, after: { x: m.pos.x, y: m.pos.y } }));
		if (moves.length) t.changes.commit(code.commands.moveEntities(moves));
		t.sync.releaseDeferred();
		world.check(t, 'drag-end+release', step);
	};

	world.reconnect = (t, step) => {
		enter(t);
		t.connected = false;
		const lostUp = t.up.splice(0).length, lostDown = t.down.splice(0).length;
		t.closeSession();
		world.connect(t);
		t.connected = true;
		log.push(`  [tab${t.i}] reconnect (lost ${lostUp} up, ${lostDown} down)`);
		t.awaitResume = true;
		t.status('open');
	};

	world.quiesce = async (step) => {
		for (const t of world.tabs) { enter(t); if (t.drag) world.endDrag(t, step); t.changes.flush(); }
		for (let round = 0; round < 400; round++) {
			let moved = false;
			for (const t of world.tabs) { while (t.up.length) { world.serve(t, { step }); moved = true; } }
			for (const t of world.tabs) { while (t.down.length) { world.deliver(t, { step }); moved = true; } }
			for (const t of world.tabs) { if (t.changes.window) { enter(t); t.changes.flush(); moved = true; } }
			if (!moved) break;
		}
	};

	world.converged = () => {
		const s = shapeDoc(world.serverDoc());
		return world.tabs.map((t) => ({ tab: t.i, ok: shape(t.model) === s, diff: shape(t.model) === s ? [] : diffDocs(shape(t.model), s) }));
	};

	// INVALID (U-a): the server's document, as it would be stored, passes the validator
	world.invalid = () => code.validateDoc(world.serverDoc(), { kinds });

	// ROUTE (U-a): each tab reads every link as the server's document reads it -- path, route, down -- from the network
	world.routes = () => {
		const server = code.readModel(world.serverDoc(), kinds);   // a reader is handed its caller's kinds (O-b1)
		const read = (m, l) => JSON.stringify(code.linkReading(m, l));
		return world.tabs.map((t) => {
			const wrong = server.all('link').filter((l) => { const mine = t.model.get('link', l.id); return !mine || read(t.model, mine) !== read(server, l); }).map((l) => l.id);
			return { tab: t.i, ok: !wrong.length, wrong };
		});
	};

	world.close = () => { fs.rmSync(world.dir, { recursive: true, force: true }); };
	return world;
}

