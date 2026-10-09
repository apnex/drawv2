/*
THE SYNC FUZZ -- a seeded randomized property run over the real Model / Changes / Sync / Store / Session / Hub (the world:
tests/fixtures/sync-world.mjs). H19.13 (U-a; dev/design/unification/SYNC-HARDENING.md): the lab's K1 fuzz, ported onto the
composition production runs and extended to the network's edits -- a pinned link laying its legs, a hand pipe laid and
removed, transit turned off and on (cuts, joins, rings), and a link landing on another's bend.

As a module: `runSeed(seed, options)` answers one run's violations and log, which tests/sync-fuzz.test.js asserts on.
From the command line, a tally over many seeds:

  node tests/fixtures/sync-fuzz.mjs [--from N] [--runs K] [--steps S] [--tabs T] [--trace SEED]
                    [--no-reconnect] [--no-drag] [--no-undo] [--no-flush] [--no-second-writer] [--no-network]
                    [--no-resync-cancel] [--shared-storage] [--no-storage] [--quiet]

`--trace SEED` prints the full event log of one run, which is the replay.
*/
// C-c (H19.31): the placed kinds, as the page composes them
import { placesOf } from '../../app/src/snap.js';
import { PRODUCT_CANVAS } from '../../product/canvas.mjs';
const PLACES = placesOf(PRODUCT_CANVAS);
import { makeLink } from '../../network/link-queries.mjs';   // K13d: the network's link queries
import { loadCode, makeWorld, clock, shape, shapeDoc, diffDocs } from './sync-world.mjs';
import path from 'node:path';
import url from 'node:url';
import { makeNode, makeWaypoint } from '../../devices/make-node.mjs';   // O-e1: the devices plugin's factories

const here = path.dirname(url.fileURLToPath(import.meta.url));
const MAIN = process.argv[1] && url.fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
const argv = MAIN ? process.argv.slice(2) : [];
let ARGV = argv;   // what `opt` reads: the command line, or a run's own flags (runSeed)
const opt = (k, d) => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : d; };
let FLAGS = new Set(argv.filter((a) => a.startsWith('--')));
const flag = (k) => FLAGS.has(k);
const FROM = Number(opt('--from', 0)), RUNS = Number(opt('--runs', 200));
let STEPS = Number(opt('--steps', 160));
let TABS = flag('--no-second-writer') ? 1 : Number(opt('--tabs', 2));
const TRACE = opt('--trace', null);
const QUIET = flag('--quiet');

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// schema 2 (U-a): a waypoint is a node with no type, and each link's legs have their pipes, so every seeded link is up
const SEED_DOC = [
	['node', { id: 'node-000001', name: 'n1', type: 'host', x: -240, y: 0 }],
	['node', { id: 'node-000002', name: 'n2', type: 'host', x: 240, y: 0 }],
	['node', { id: 'node-000003', name: 'n3', type: 'host', x: 0, y: 240 }],
	['node', { id: 'node-000004', name: 'n4', type: 'host', x: 0, y: -240 }],
	['node', { id: 'node-000005', name: 'n5', type: 'host', x: 240, y: 240 }],
	['node', { id: 'node-000006', name: 'n6', type: 'host', x: -240, y: -240 }],
	['node', { id: 'node-0000a1', name: 'w1', x: 0, y: 120 }],
	['node', { id: 'node-0000a2', name: 'w2', x: 0, y: 0 }],
	['link', { id: 'link-0000b1', name: 'l1', src: 'node-000001', dst: 'node-000002', via: ['node-0000a1'] }],
	['link', { id: 'link-0000b2', name: 'l2', src: 'node-000003', dst: 'node-0000a2' }],
	['link', { id: 'link-0000b3', name: 'l3', src: 'node-0000a2', dst: 'node-000004' }],
	['link', { id: 'link-0000b4', name: 'l4', src: 'node-000005', dst: 'node-0000a2' }],
	['group', { id: 'group-0000c1', name: 'g1', members: ['node-000003', 'node-000004', 'node-0000a1'] }],
];
// the legs' pipes, laid as a drag lays them -- built once the code is loaded (pipeEntity names each by its ends)
const SEED_PIPES = [['node-000001', 'node-0000a1'], ['node-0000a1', 'node-000002'], ['node-000003', 'node-0000a2'], ['node-0000a2', 'node-000004'], ['node-000005', 'node-0000a2']];

const code = await loadCode();
const C = code.commands;
const SEED = [...SEED_DOC, ...SEED_PIPES.map(([a, b]) => ['pipe', code.pipeEntity(a, b, 'link')])];
// B181's rate limit is exercised by a targeted case; in the random runs it would only measure the
// harness's step rate, so it is off unless --ratelimit
if (!flag('--ratelimit')) code.Session.prototype.tooFast = () => false;
const FLUSHP = Number(opt('--flush-prob', 0.5));
if (MAIN) { console.warn = () => {}; console.error = () => {}; }

async function run(seed, trace) {
	// ids and transaction prefixes are drawn from Math.random: pinned to a sequence of the seed's own, so a run replays exactly
	// from its seed (U-a), as the gesture corpus pins it per scenario
	const realRandom = Math.random;
	Math.random = mulberry32(seed * 40503 + 11);
	try { return await runSeeded(seed, trace); } finally { Math.random = realRandom; }
}

async function runSeeded(seed, trace) {
	const rng = mulberry32(seed * 2654435761 + 7);
	const int = (n) => Math.floor(rng() * n);
	const pick = (a) => a[int(a.length)];
	const w = await makeWorld(code, { seed: SEED, tabs: TABS, gestureCancelOnLoad: !flag('--no-resync-cancel'), storage: !flag('--no-storage'), sharedStorage: flag('--shared-storage') });
	const L = w.log;
	const cell = () => ({ x: (int(15) - 7) * 60, y: (int(9) - 4) * 60 });

	function localAction(t, step) {
		w.enter(t);
		const m = t.model;
		// schema 2: a waypoint is a node with no type; every anchor moves as a node
		const all = m.all('node'), nodes = all.filter((n) => n.type), wps = all.filter((n) => !n.type), links = m.all('link'), groups = m.all('group');
		const pipes = m.all('pipe');
		const movable = all.map((n) => ['node', n.id]);
		const selectOnly = (ids) => { if (JSON.stringify(ids) !== JSON.stringify(t.sel)) { t.changes.flush(); t.sel = ids; } };
		const menu = [
			['nudge', 12], ['timer', 5], ['move', 8], ['rename', 5], ['delete', 5], ['create', 5], ['route', 4],
			['link', 3], ['group', 4], ['ungroup', 2], ['replug', 4], ['flow', 2], ['renameDoc', 1],
			...(flag('--no-undo') ? [] : [['undo', Number(opt('--undo-weight', 4))], ['redo', Number(opt('--undo-weight', 4)) / 2]]),
			...(flag('--no-drag') ? [] : (t.drag ? [['dragMove', 8], ['dragEnd', 4]] : [['dragStart', 4]])),
			// the network's edits (U-a)
			...(flag('--no-network') ? [] : [['pipe', 3], ['unpipe', 2], ['transit', 3], ['land', 2]]),
		];
		// mid-drag the pointer is held: only the drag itself and keyboard verbs on OTHER things can act
		if (t.drag) {
			const keep = new Set(['dragMove', 'dragEnd', 'rename', 'undo', 'redo', 'renameDoc', 'timer']);
			for (let k = menu.length - 1; k >= 0; k--) if (!keep.has(menu[k][0])) menu.splice(k, 1);
		}
		const total = menu.reduce((a, [, wt]) => a + wt, 0);
		let r = int(total), act = menu[0][0];
		for (const [name, wt] of menu) { if (r < wt) { act = name; break; } r -= wt; }
		let note = '';
		switch (act) {
			case 'nudge': {
				if (!movable.length) return;
				const ids = rng() < 0.6 && t.sel.length && t.sel.every((id) => m.get(id.split('-')[0], id)) ? t.sel : [pick(movable)[1]];
				selectOnly(ids);
				const [dx, dy] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
				t.changes.amend(C.nudgeSelection(m, ids, dx, dy, PLACES));   // C-c: the placed kinds note = `${ids} ${dx},${dy}`; break;
			}
			case 'timer': t.changes.flush(); break;
			case 'move': {
				if (!nodes.length) return;
				const n = pick(nodes); selectOnly([n.id]); const p = cell();
				t.changes.commit(C.moveEntities([{ kind: 'node', id: n.id, after: p }])); note = `${n.id} -> ${p.x},${p.y}`; break;
			}
			case 'rename': {
				const pool = [...nodes.map((e) => ['node', e]), ...links.map((e) => ['link', e]), ...groups.map((e) => ['group', e])];
				if (!pool.length) return;
				const [kind, e] = pick(pool); selectOnly([e.id]); const nm = 'r' + int(1000);
				t.changes.commit(C.renameEntity(kind, e.id, e.name, nm)); note = `${e.id} ${nm}`; break;
			}
			case 'delete': {
				const pool = [...nodes, ...wps, ...links, ...groups];
				if (nodes.length < 3 || !pool.length) return;
				const e = pick(pool); selectOnly([e.id]);
				t.changes.commit(C.deleteSelection(m, new Set([e.id]))); note = e.id; break;
			}
			case 'create': {
				const n = makeNode(m, 'host', cell()); selectOnly([n.id]);
				t.changes.commit(C.createEntity('node', n)); note = `${n.id} ${n.x},${n.y}`; break;
			}
			case 'route': {
				if (nodes.length < 2) return;
				const a = pick(nodes), b = pick(nodes); if (a === b) return;
				const wp = makeWaypoint(m, cell());
				const link = { ...makeLink(m, a.id, b.id), via: [wp.id] };
				selectOnly([link.id]);
				t.changes.commit(C.routeLink([wp], link)); note = `${link.id} ${a.id}->${b.id} via ${wp.id}`; break;
			}
			case 'link': {
				if (nodes.length < 2) return;
				const a = pick(nodes), b = pick(nodes); if (a === b) return;
				t.changes.commit(C.linkNodes(m, [a.id, b.id], false)); note = `${a.id}-${b.id}`; break;
			}
			case 'group': {
				const pool = [...nodes, ...wps];
				if (pool.length < 2) return;
				const ids = [...new Set([pick(pool).id, pick(pool).id, pick(pool).id])];
				selectOnly(ids);
				t.changes.commit(C.createGroup(m, ids)); note = ids.join(','); break;
			}
			case 'ungroup': { if (!groups.length) return; const g = pick(groups); t.changes.commit(C.ungroupAll(m, [g.id])); note = g.id; break; }
			case 'replug': {
				if (!links.length || nodes.length < 2) return;
				const l = pick(links), a = pick(nodes), b = pick(nodes); if (a === b) return;
				selectOnly([l.id]);
				t.changes.commit(C.replugLink(l.id, a.id, b.id)); note = `${l.id} ${a.id}->${b.id}`; break;
			}
			case 'flow': { if (!links.length) return; const l = pick(links); t.changes.commit(C.cycleDirection(l)); note = l.id; break; }
			// a hand pipe between two anchors with none, as `g` lays one
			case 'pipe': {
				if (all.length < 2) return;
				const a = pick(all), b = pick(all); if (a === b) return;
				const p = code.pipeEntity(a.id, b.id, 'hand');
				if (m.get('pipe', p.id)) return;
				t.changes.commit({ label: 'pipe', entries: [{ op: 'put', kind: 'pipe', entity: p }] }); note = p.id; break;
			}
			case 'unpipe': {
				const hand = pipes.filter((p) => p.laid === 'hand'); if (!hand.length) return;
				const p = pick(hand);
				t.changes.commit({ label: 'delete', entries: [{ op: 'del', kind: 'pipe', entity: { ...p } }] }); note = p.id; break;
			}
			// transit flipped on one anchor, as `x` does -- the planner cuts, joins, opens or closes what passes it
			case 'transit': {
				const pool = [...wps, ...nodes.filter((n) => ['router', 'firewall', 'vxlan'].includes(n.type))];
				if (!pool.length) return;
				const e = pick(pool);
				const { entries } = code.createTransit().flip([{ ...e, kind: 'node' }]);
				if (!entries.length) return;
				t.changes.commit({ label: 'transit', entries }); note = `${e.id} -> ${!(e.transit === false)}`; break;
			}
			// a new link with an end on another link's bend, which the planner cuts there (junction-cut)
			case 'land': {
				const bent = links.filter((l) => (l.via ?? []).length); if (!bent.length || !nodes.length) return;
				const l = pick(bent), at = pick(l.via), from = pick(nodes);
				if (from.id === at) return;
				const link = makeLink(m, from.id, at);
				t.changes.commit(C.createEntity('link', link)); note = `${link.id} ${from.id}->${at} on ${l.id}`; break;
			}
			case 'renameDoc': { const nm = 'doc' + int(100); t.sync.rename(nm); note = nm; break; }
			case 'undo': t.changes.undo(); break;
			case 'redo': t.changes.redo(); break;
			case 'dragStart': {
				if (!movable.length) return;
				const ids = rng() < 0.5 && t.sel.length === 1 && movable.some(([, id]) => id === t.sel[0]) ? t.sel : [pick(movable)[1]];
				selectOnly(ids);
				t.drag = { moved: ids.map((id) => { const k = id.split('-')[0]; const e = m.get(k, id); return { kind: k, id, before: { x: e.x, y: e.y }, pos: { x: e.x, y: e.y } }; }) };
				note = ids.join(','); break;
			}
			case 'dragMove': {
				const dx = (int(5) - 2) * 60, dy = (int(5) - 2) * 60;
				for (const mv of t.drag.moved) {
					mv.pos = { x: Math.max(-900, Math.min(900, mv.before.x + dx)), y: Math.max(-480, Math.min(480, mv.before.y + dy)) };
					if (m.get(mv.kind, mv.id)) m.set(mv.kind, mv.id, { ...mv.pos });   // Input.updateMove writes the model directly
				}
				note = `${dx},${dy}`; break;
			}
			case 'dragEnd': L.push(`#${step} tab${t.i} dragEnd`); w.endDrag(t, step); return;
		}
		L.push(`#${step} tab${t.i} ${act} ${note}`);
		w.check(t, 'local:' + act, step);
	}

	for (let step = 0; step < STEPS; step++) {
		clock.advance(250);
		const r = rng();
		const t = pick(w.tabs);
		if (r < 0.34) localAction(t, step);
		else if (r < 0.60) {
			if (t.up.length) { L.push(`#${step} serve tab${t.i}`); w.serve(t, { step }); }
			// the store's 200ms debounce, standing in: durability usually follows a commit closely
			if (!flag('--no-flush') && rng() < FLUSHP) await w.store.flush(w.id);
		}
		else if (r < 0.95) { if (t.down.length) { L.push(`#${step} deliver tab${t.i}`); w.deliver(t, { step }); } }
		else if (r < 0.97) { if (!flag('--no-flush')) { L.push(`#${step} store flush`); await w.store.flush(w.id); } }
		else if (r < 0.98) { if (!flag('--no-reconnect')) { w.enter(t); L.push(`#${step} reconnect tab${t.i}`); w.reconnect(t, step); } }
	}
	L.push(`#END quiesce`);
	await w.quiesce(STEPS);
	if (PLANT) PLANT(w);   // a test's planted fault, read by the oracles below (U-a)
	const conv = w.converged();
	for (const c of conv) if (!c.ok) w.violations.push({ kind: 'DIVERGE', tab: c.tab, step: STEPS, cause: 'quiescent', detail: c.diff.join(' | ') + '   (A=tab, B=server)' });
	// U-a: the server's document valid, and every converged tab drawing what the server's document draws
	const bad = w.invalid();
	if (bad) w.violations.push({ kind: 'INVALID', tab: -1, step: STEPS, cause: 'quiescent', detail: bad });
	for (const r of w.routes()) if (!r.ok && conv.find((c) => c.tab === r.tab)?.ok) w.violations.push({ kind: 'ROUTE', tab: r.tab, step: STEPS, cause: 'quiescent', detail: `drawn otherwise than the server: ${r.wrong.join(', ')}` });
	// requests the tab still believes unanswered at quiescence
	for (const t of w.tabs) {
		const open = t.units.filter((u) => u.state === 'pending' || u.state === 'window').length;
		if (open) w.violations.push({ kind: 'STUCK', tab: t.i, step: STEPS, cause: 'quiescent', detail: `${open} own units never answered` });
	}
	w.close();
	const seenKT = new Set();
	const firsts = w.violations.filter((v) => { const k = v.kind + '/' + v.tab; if (seenKT.has(k)) return false; seenKT.add(k); return true; });
	return { seed, violations: firsts, all: w.violations, breaks: w.breaks, evals: w.evals, stats: w.stats, log: L, conv };
}

/*
One run, for a test (U-a): `options` -- steps, tabs, and flags as the command line spells them (`--no-reconnect`, ...); `plant`
-- a function handed the world once the run has quiesced and before the oracles read it, to plant a fault an oracle must report.
*/
export async function runSeed(seed, { steps = 160, tabs = 2, flags = [], plant = null } = {}) {
	const was = { FLAGS, STEPS, TABS, PLANT, ARGV };
	FLAGS = new Set(flags); ARGV = flags; STEPS = steps; TABS = flags.includes('--no-second-writer') ? 1 : tabs; PLANT = plant;
	try { return await run(seed, false); } finally { ({ FLAGS, STEPS, TABS, PLANT, ARGV } = was); }
}
let PLANT = null;

if (MAIN && TRACE !== null) {
	const res = await run(Number(TRACE), true);
	for (const line of res.log) console.log(line);
	console.log('--- violations');
	for (const v of res.all) console.log(`${v.kind} tab${v.tab} step${v.step} [${v.cause}] ${v.detail}`);
	console.log('--- breaks/heals');
	for (const v of res.breaks) console.log(`${v.kind} tab${v.tab} step${v.step} [${v.cause}] ${v.detail}`);
	process.exit(0);
}

if (MAIN && TRACE === null) {
const tally = {}, byCause = {}, firstSeed = {}, breaks = {}, breakSeeds = {}, evals = {}, stats = {};
let runsWithAny = 0, runsDiverged = 0;
for (let s = FROM; s < FROM + RUNS; s++) {
	const res = await run(s, false);
	const kinds = new Set(res.violations.map((v) => v.kind));
	if (kinds.size) runsWithAny++;
	if (kinds.has('DIVERGE')) runsDiverged++;
	for (const k of kinds) { tally[k] = (tally[k] || 0) + 1; firstSeed[k] = firstSeed[k] ?? s; }
	const seen = new Set();
	for (const v of res.violations) {
		const key = `${v.kind} @ ${v.cause}`;
		if (seen.has(key)) continue; seen.add(key);
		byCause[key] = (byCause[key] || 0) + 1;
	}
	for (const [k, n] of Object.entries(res.evals)) evals[k] = (evals[k] || 0) + n;
	for (const [k, n] of Object.entries(res.stats)) stats[k] = (stats[k] || 0) + n;
	for (const b of res.breaks) {
		const k = `${b.kind} @ ${b.cause}`;
		breaks[k] = (breaks[k] || 0) + 1;
		(breakSeeds[k] = breakSeeds[k] || new Set()).add(s);
	}
	if (!QUIET && kinds.size) {
		const first = {};
		for (const v of res.violations) first[v.kind] = first[v.kind] || v;
		console.log(`seed ${s}: ` + Object.values(first).map((v) => `${v.kind}(tab${v.tab} step${v.step} ${v.cause}: ${v.detail.slice(0, 160)})`).join(' ;; '));
	}
}
console.log(`\n# runs ${RUNS} (seeds ${FROM}..${FROM + RUNS - 1}), steps ${STEPS}, tabs ${TABS}, flags ${argv.filter((a) => a.startsWith('--no')).join(' ') || '-'}`);
console.log(`# runs with any violation: ${runsWithAny}; runs diverged at quiescence: ${runsDiverged}`);
console.log('# runs per violation kind:', JSON.stringify(tally), ' first seed:', JSON.stringify(firstSeed));
console.log('# runs per kind@cause:');
for (const [k, n] of Object.entries(byCause).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${k}`);
console.log('# ack coverage:', JSON.stringify(stats));
console.log('# handler runs that STARTED from a consistent tab (shadow-checked after):');
for (const [k, n] of Object.entries(evals).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(6)}  ${k}   breaks ${breaks['BREAK @ ' + k] || 0}`);
console.log('# consistency transitions (every occurrence; seeds listed up to 8):');
for (const [k, n] of Object.entries(breaks).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(5)}  ${k}   seeds ${[...breakSeeds[k]].slice(0, 8).join(',')}`);
}
