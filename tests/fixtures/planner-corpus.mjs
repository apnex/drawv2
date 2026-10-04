/*
THE PLANNER CORPUS -- stage PL-1 of the planner as a sovereign system (dev/design/planner/PLANNER-SYSTEM.md, section 9).

The safety net the restructuring stands on. Stages PL-2 to PL-5 move the inverses, the passes, placement and the kind
tables out of `planner/txn.mjs` and change NO outcome; this holds every outcome, so a change nobody wrote a test for
still fails. Each case is one request planned against one board, in the one composition there is:

  network     the network plugin's object (`createNetwork`), with transit, over a model holding its pipes as entities of the
              network's `pipe` kind -- what the lab runs, and the server since S-b (H18.12)

AMENDED 2026-10-03 (S-b): the `production` composition -- no network, the classic link tenant -- is retired with that
tenant, under the cutover ruling ("Full cutover ... No legacy", 2026-09-30). Its 1,045 cases planned boards the network
cases plan too, under rules production no longer runs; they are deleted, and the network cases are unchanged.

and records exactly what `plan()` answers: accepted with its ops and inverse, or refused with its error and opIndex.

TWO SOURCES OF CASES.
  named       one or more per rule the planner holds, written by hand so a failure names the rule
  generated   seeded random boards (nodes, waypoints, links through them, groups, pipes, transit) and multi-op
              requests over them -- the widened differential, which must REACH the stranded pass, the orphan sweep
              and the join (measured by tests/planner-corpus.test.js, not assumed)

The frozen pre-CS1 oracle of tests/diff-plan.test.js is single-op and has none of those passes, so it cannot judge
them; the oracle here is the planner's own answer as it stood when the corpus was written.

THE GOLDEN FILE is `tests/fixtures/planner-corpus.json`, written from the planner as it stood at `2ebb619` (PL-0) and compared by `tests/planner-corpus.test.js`. Each entry holds
a digest of the case's input (so a changed generator is told apart from a changed planner) and the result. It changes
only with a behaviour change the director ruled, in the commit that makes it:

	node tests/fixtures/planner-corpus.mjs --write
*/
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { cellOf } from '../../kernel/geometry.mjs';
import { applyOps } from '../../model/ops.mjs';
import { plan } from '../../planner/txn.mjs';
import { resolveAnchor } from '../../server/anchor.mjs';
import { validateMutation } from '../../planner/validate.js';
import { createNetwork } from '../../network/network.mjs';
import { createTransit } from '../../network/transit.mjs';
import { productKinds } from '../../planner/kinds.mjs';
import { PIPE_ROW, pipeEntity } from '../../network/pipe-kind.mjs';
import { NETWORK_ROWS } from '../../network/kinds.mjs';   // the network's kind and the field it contributes (S-a)
import { bareAnchor } from '../../model/anchors.mjs';

const GOLDEN = new URL('./planner-corpus.json', import.meta.url);
const P = 60;

// ---- vocabulary: short ids, so a case reads as a board ----

const hex = (n) => n.toString(16).padStart(6, '0');
const N = (i) => `node-${hex(0xa00 + i)}`;
const W = (i) => `node-${hex(0xb00 + i)}`;   // a waypoint: a node with no type (F-c); its hex range stays apart from the nodes'
const L = (i) => `link-${hex(0xc00 + i)}`;
const G = (i) => `group-${hex(0xd00 + i)}`;
const node = (i, x, y) => ({ id: N(i), name: `n${i}`, type: 'router', x: x * P, y: y * P, shape: 'circle' });
const way = (i, x, y) => ({ id: W(i), name: `w${i}`, x: x * P, y: y * P });   // `pinned` retired at S-d (H18.14)
const link = (i, src, dst, via) => ({ id: L(i), name: `l${i}`, src, dst, ...(via ? { via } : {}) });
const group = (i, members) => ({ id: G(i), name: `g${i}`, members });
const put = (kind, entity) => ({ op: 'put', kind, entity });
const set = (kind, id, patch) => ({ op: 'set', kind, id, patch });
const del = (kind, id) => ({ op: 'del', kind, id });

// a link's anchors in order, for laying the pipes it runs over
const routeOf = (l) => [l.src, ...(l.via || []), l.dst];

/*
A case: { id, compose, board: { nodes, waypoints, links, groups }, pipes?: [[a, b, laid]], off?: [anchor ids], ops }.
In the network composition every link's pipes are laid ('link') unless `pipes` is given, as the lab lays them.
*/
function named(id, compose, board, ops, extra = {}) {
	return { id, compose, board: { nodes: [], waypoints: [], links: [], groups: [], ...board }, ops, ...extra };
}

// a three-way junction at w0: n0 -> w0, w0 -> n1, w0 -> n2
const junction = () => ({
	nodes: [node(0, -4, 0), node(1, 4, 0), node(2, 0, 4)],
	waypoints: [way(0, 0, 0)],
	links: [link(0, N(0), W(0)), link(1, W(0), N(1)), link(2, W(0), N(2))],
});
// n0 -> n1 bent through w0
const bent = () => ({ nodes: [node(0, -4, 0), node(1, 4, 0)], waypoints: [way(0, 0, 2)], links: [link(0, N(0), N(1), [W(0)])] });

const NAMED = [];
for (const compose of ['network']) {
	const c = (id, board, ops, extra) => NAMED.push(named(`${compose}/${id}`, compose, board, ops, extra));
	// requested ops
	c('put-node', {}, [put('node', node(0, 0, 0))]);
	c('put-identical-is-no-op', { nodes: [node(0, 0, 0)] }, [put('node', node(0, 0, 0))]);
	c('set-moves', { nodes: [node(0, 0, 0)] }, [set('node', N(0), { x: 120 })]);
	c('set-unchanged-is-no-op', { nodes: [node(0, 0, 0)] }, [set('node', N(0), { x: 0 })]);
	c('set-introduces-key-inverse-is-put', bent(), [set('link', L(0), { direction: 'forward' })]);
	c('del-missing-is-no-op', {}, [del('node', N(9))]);
	c('meta-rename', {}, [{ op: 'meta', patch: { name: 'renamed' } }]);
	c('place-beside', { nodes: [node(0, 0, 0)] }, [{ op: 'place', kind: 'node', entity: { id: N(1), name: 'n1', type: 'router', shape: 'circle' }, at: { near: 'n0' } }]);
	// refusals, and which op
	c('refuse-set-missing', {}, [set('node', N(9), { x: 0 })]);
	c('refuse-unknown-field', {}, [put('node', { ...node(0, 0, 0), bogus: 1 })]);
	c('refuse-second-op-names-index', {}, [put('node', node(0, 0, 0)), put('link', link(0, N(0), N(8)))]);
	c('refuse-unknown-op', {}, [{ op: 'nope', kind: 'node' }]);
	c('refuse-empty-request', {}, []);
	// groups
	c('group-steals-and-trims', { nodes: [node(0, 0, 0), node(1, 2, 0), node(2, 4, 0), node(3, 6, 0)], groups: [group(0, [N(0), N(1), N(2), N(3)])] }, [put('group', group(1, [N(0), N(1)]))]);
	// a document that arrived with a node in two groups: re-putting one group unchanged still steals, so it is not narrowed
	c('group-unchanged-put-still-steals', { nodes: [node(0, 0, 0), node(1, 2, 0), node(2, 4, 0)], groups: [group(0, [N(0), N(1)]), group(1, [N(1), N(2)])] }, [put('group', group(1, [N(1), N(2)]))]);
	c('group-steal-dissolves', { nodes: [node(0, 0, 0), node(1, 2, 0), node(2, 4, 0)], groups: [group(0, [N(0), N(1)])] }, [put('group', group(1, [N(1), N(2)]))]);
	// node cascade
	c('del-node-takes-links-and-trims-group', { nodes: [node(0, 0, 0), node(1, 4, 0), node(2, 0, 4)], links: [link(0, N(0), N(1)), link(1, N(0), N(2))], groups: [group(0, [N(0), N(1), N(2)])] }, [del('node', N(0))]);
	c('del-node-dissolves-group', { nodes: [node(0, 0, 0), node(1, 4, 0)], groups: [group(0, [N(0), N(1)])] }, [del('node', N(0))]);
	// waypoint cascade
	c('del-waypoint-endpoint-link-dies', junction(), [del('node', W(0))]);
	c('del-waypoint-strips-bend', bent(), [del('node', W(0))]);
	c('del-waypoint-strip-collides-deletes', { ...bent(), links: [link(0, N(0), N(1), [W(0)]), link(1, N(0), N(1))] }, [del('node', W(0))]);
	c('del-waypoint-trims-group', { ...bent(), nodes: [node(0, -4, 0), node(1, 4, 0), node(2, 0, -4)], groups: [group(0, [W(0), N(0), N(2)])] }, [del('node', W(0))]);
	// the stranded pass: a pin deleted under a link that keeps another way
	c('stranded-pin-deleted', { nodes: [node(0, -4, 0), node(1, 4, 0)], waypoints: [way(0, 0, 2), way(1, 0, -2)], links: [link(0, N(0), N(1), [W(0), W(1)])] }, [del('node', W(0))]);
	// the sweep
	c('sweep-bend-released', bent(), [del('link', L(0))]);
	// `sweep-keeps-pinned` retired at S-d (H18.14): with `pinned` gone it was `sweep-bend-released` again
	c('sweep-terminus', { nodes: [node(0, -4, 0)], waypoints: [way(0, 4, 0)], links: [link(0, N(0), W(0))] }, [del('link', L(0))]);
	c('sweep-sheltered-by-hand-pipe', bent(), [del('link', L(0))], { pipes: [[N(0), W(0), 'hand'], [W(0), N(1), 'hand']] });
	c('sweep-trims-group', { ...bent(), nodes: [node(0, -4, 0), node(1, 4, 0), node(2, 0, -4)], groups: [group(0, [W(0), N(2)])] }, [del('link', L(0))]);
	// B244: a ring has no ends, so deleting it sweeps its src and dst too
	c('sweep-ring-takes-its-ends', { waypoints: [way(0, -2, 0), way(1, 2, 0), way(2, 0, 2)], links: [{ ...link(0, W(0), W(1), [W(2)]), closed: true }] }, [del('link', L(0))]);
	// B216 stands: two links ending at a waypoint with one declared direction pass through it (a bend on the canvas), yet the author ended them there
	c('sweep-keeps-declared-pass-through-terminus', { nodes: [node(0, -4, 0), node(1, 4, 0)], waypoints: [way(0, 0, 0)], links: [{ ...link(0, N(0), W(0)), direction: 'forward' }, { ...link(1, W(0), N(1)), direction: 'forward' }] }, [del('link', L(0)), del('link', L(1))]);
	c('sweep-ignores-preexisting-orphan', { nodes: [node(0, 0, 0)], waypoints: [way(0, 4, 4)] }, [set('node', N(0), { x: 120 })]);
	c('sweep-batch-reroutes-keeps', { ...bent(), nodes: [node(0, -4, 0), node(1, 4, 0), node(2, 0, -4)] }, [del('link', L(0)), put('link', link(1, N(0), N(2), [W(0)]))]);
	// the join
	c('join-at-junction', junction(), [del('link', L(2))]);
	c('join-both-stored-as-src', { ...junction(), links: [link(0, W(0), N(0)), link(1, W(0), N(1)), link(2, W(0), N(2))] }, [del('link', L(2))]);
	c('join-carries-flow', { ...junction(), links: [{ ...link(0, N(0), W(0)), direction: 'forward' }, { ...link(1, W(0), N(1)), direction: 'forward' }, link(2, W(0), N(2))] }, [del('link', L(2))]);
	c('join-not-on-create', { nodes: [node(0, -4, 0), node(1, 4, 0)], waypoints: [way(0, 0, 0)] }, [put('link', link(0, N(0), W(0))), put('link', link(1, W(0), N(1)))]);
	c('join-not-where-count-unchanged', junction(), [del('link', L(2)), put('link', link(3, W(0), N(2)))]);
	c('join-declined-duplicate-bend', { nodes: [node(0, -4, 0), node(1, 4, 0), node(2, 0, 4)], waypoints: [way(0, 0, 0), way(1, -2, -2)], links: [link(0, N(0), W(0), [W(1)]), link(1, W(0), N(1)), link(2, W(0), N(2)), link(3, N(0), N(1), [W(1)])] }, [del('link', L(2))]);
	// x -> w joined to w -> n1 via [x] would name x twice
	c('join-declined-self-conflict', { nodes: [node(1, 4, 0), node(2, 0, 4)], waypoints: [way(0, 0, 0), way(1, -4, 0)], links: [link(0, W(1), W(0)), link(1, W(0), N(1), [W(1)]), link(2, W(0), N(2))] }, [del('link', L(2))]);
	c('join-off-transit', junction(), [del('link', L(2))], { off: [W(0)] });
	// the invariant backstop (B81, B271)
	c('backstop-refuses-second-straight', { nodes: [node(0, 0, 0), node(1, 4, 0)], links: [link(0, N(0), N(1))] }, [put('link', link(1, N(1), N(0)))]);
	c('backstop-refuses-set-clearing-via', { ...bent(), links: [link(0, N(0), N(1), [W(0)]), link(1, N(0), N(1))] }, [set('link', L(0), { via: [] })]);
	c('backstop-transient-ends-valid', { ...bent(), links: [link(0, N(0), N(1), [W(0)]), link(1, N(0), N(1))] }, [del('link', L(1)), set('link', L(0), { via: [] })]);
	c('backstop-partial-repair', { nodes: [node(0, 0, 0), node(1, 4, 0)], links: [link(0, N(0), N(1)), link(1, N(0), N(1)), link(2, N(1), N(0))] }, [del('link', L(0))]);
	c('backstop-refuses-occupied-anchor', { nodes: [node(0, 0, 0)] }, [put('node', node(1, 0, 0))]);
}

// ---- the generated cases: the widened differential ----

// xorshift -- deterministic, no dependency
function rng(seed) {
	let x = seed || 1;
	return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length) % xs.length];

function genBoard(r) {
	const cells = [];
	for (let x = -6; x <= 6; x += 2) for (let y = -4; y <= 4; y += 2) cells.push([x, y]);
	const take = () => cells.splice(Math.floor(r() * cells.length) % cells.length, 1)[0];
	const nodes = Array.from({ length: 2 + Math.floor(r() * 3) }, (_, i) => node(i, ...take()));
	// the draw that once said `pinned` is still taken and discarded, so every case after it is generated as before (S-d)
	const waypoints = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, i) => { const at = take(); r(); return way(i, ...at); });
	const scratch = new Model({ kinds: WITH_PIPES });   // the link is the network's kind (S-e)
	for (const e of nodes) scratch.put('node', e);
	for (const e of waypoints) scratch.put('node', e);
	const anchors = [...nodes, ...waypoints].map((e) => e.id);
	const links = [];
	const add = (l) => {
		if (validateMutation(scratch, { action: 'put', kind: 'link', entity: l }, WITH_PIPES)) return;   // a well-formed board
		scratch.put('link', l);
		links.push(l);
	};
	/*
	Half the boards carry a JUNCTION -- three links meeting at one waypoint -- because the join fires only where a
	removal leaves exactly two, and a board of random links almost never has one (measured: two joins in 400).
	*/
	if (r() < 0.5 && anchors.length >= 4) {
		const w = pick(r, waypoints).id;
		const others = anchors.filter((id) => id !== w).sort(() => r() - 0.5).slice(0, 3);
		others.forEach((o, k) => add(r() < 0.5 ? link(0x20 + k, o, w) : link(0x20 + k, w, o)));
	}
	for (let i = 0; i < 2 + Math.floor(r() * 4); i++) {
		const src = pick(r, anchors), dst = pick(r, anchors);
		if (src === dst) continue;
		const via = waypoints.filter((w) => w.id !== src && w.id !== dst && r() < 0.4).map((w) => w.id);
		add(link(i, src, dst, via.length ? via : undefined));
	}
	const groups = [];
	if (r() < 0.35) {
		const members = [...nodes, ...waypoints].filter(() => r() < 0.5).map((e) => e.id);
		if (members.length >= 2) groups.push(group(0, members));
	}
	return { nodes, waypoints, links, groups };
}

function genOp(r, board, i) {
	const anchors = [...board.nodes, ...board.waypoints].map((e) => e.id);
	const roll = r();
	if (roll < 0.22 && board.links.length) return del('link', pick(r, board.links).id);
	if (roll < 0.40 && board.waypoints.length) return del('node', pick(r, board.waypoints).id);
	if (roll < 0.48) return del('node', pick(r, board.nodes).id);
	if (roll < 0.60 && board.links.length) {
		const l = pick(r, board.links);
		return set('link', l.id, { via: board.waypoints.filter((w) => w.id !== l.src && w.id !== l.dst && r() < 0.4).map((w) => w.id) });
	}
	if (roll < 0.75) {
		const src = pick(r, anchors), dst = pick(r, anchors);
		const via = board.waypoints.filter((w) => w.id !== src && w.id !== dst && r() < 0.3).map((w) => w.id);
		return put('link', link(0x40 + i, src, dst, via.length ? via : undefined));
	}
	if (roll < 0.85) {
		const e = pick(r, [...board.nodes, ...board.waypoints]);
		return set(e.id.split('-')[0], e.id, { x: e.x + P * 2 * (r() < 0.5 ? -1 : 1) });
	}
	if (roll < 0.90 && board.groups.length) return del('group', board.groups[0].id);
	if (roll < 0.95) return put('group', group(1, anchors.filter(() => r() < 0.5)));
	return set('node', N(0x3f), { x: 0 });   // deliberately refused: no such node
}

// the network composition's kinds: the product's and the network's -- its link and its pipe (H17.22; S-e). Declared before the
// generated boards, which validate their links against it
export const WITH_PIPES = productKinds(...NETWORK_ROWS);

export const GENERATED_PER_COMPOSITION = 1000;
const GENERATED = [];
for (const compose of ['network']) {
	const r = rng(compose === 'production' ? 20261001 : 20261002);
	for (let i = 0; i < GENERATED_PER_COMPOSITION; i++) {
		const board = genBoard(r);
		const ops = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, k) => genOp(r, board, k));
		const extra = {};
		if (compose === 'network') {
			const anchors = [...board.nodes, ...board.waypoints].map((e) => e.id);
			if (r() < 0.3) extra.pipes = [...board.links.flatMap((l) => pairs(routeOf(l)).map(([a, b]) => [a, b, 'link'])), [pick(r, anchors), pick(r, anchors), 'hand']];
			extra.off = board.waypoints.filter(() => r() < 0.25).map((w) => w.id);
		}
		GENERATED.push(named(`${compose}/gen-${String(i).padStart(3, '0')}`, compose, board, ops, extra));
	}
}

function pairs(route) {
	const out = [];
	for (let i = 0; i < route.length - 1; i++) out.push([route[i], route[i + 1]]);
	return out;
}

export const CASES = [...NAMED, ...GENERATED];

// ---- running a case ----

/*
A case's pipes as entities: each pair once, a pipe laid again by hand made a hand pipe and never the reverse, and no pipe
from an anchor to itself -- the rule the session's pipe set held, which these cases were first written against.
*/
function pipesOf(c) {
	const out = new Map();
	for (const [a, b, laid] of c.pipes || c.board.links.flatMap((l) => pairs(routeOf(l)).map(([x, y]) => [x, y, 'link']))) {
		if (a === b) continue;
		const p = pipeEntity(a, b, laid), had = out.get(p.id);
		if (!had) out.set(p.id, p);
		else if (laid === 'hand') had.laid = 'hand';
	}
	return [...out.values()];
}

// a case's model and plan options, as `record` builds them -- exported for the shadow guard (tests/trigger-shadow.test.js)
export function composeCase(c) { return compose(c); }

function compose(c) {
	if (c.compose !== 'network') throw new Error(`${c.id}: the only composition is the network's (S-b)`);
	const network = true;
	const model = new Model({ kinds: WITH_PIPES });
	attachRelations(model, { cellOf });
	// a case keeps its waypoints apart to describe the board; the document holds them among the nodes (F-c)
	const { waypoints = [], ...board } = c.board;
	model.load({ meta: { id: 'diagram-000001', name: 'corpus' }, zones: [], ...board, nodes: [...(board.nodes || []), ...waypoints], ...(network ? { pipes: pipesOf(c) } : {}) });
	// placement is the server door's edge (PL-4): planned as the store plans it
	const transit = createTransit();
	// as the session hands them over: an anchor with its kind, which is what the transit table reads
	const { refused, entries } = transit.flip((c.off || []).map((id) => ({ ...model.get('node', id), kind: 'node' })));
	if (refused.length) throw new Error(`${c.id}: transit refused to turn off ${refused.map((e) => e.id)}`);
	// stored on the anchors since F-e -- part of the board the case starts from, as the session's setting was
	applyOps(model, entries.map((e) => (e.op === 'set' ? { op: 'set', kind: e.kind, id: e.id, patch: e.after } : e)));
	const plugin = createNetwork(transit);
	// counted, not changed: how many ops the network's stranded pass emitted
	const reached = { stranded: 0 };
	const links = { ...plugin.links, reactions: plugin.links.reactions.map((r) => (r.phase !== 'stranded' ? r
		: { ...r, run: (ctx, emit) => r.run(ctx, (ops) => { reached.stranded += ops.length; emit(ops); }) })) };
	return { model, options: { links, place: resolveAnchor, kinds: WITH_PIPES }, reached };
}

const digest = (c) => crypto.createHash('sha256').update(JSON.stringify([c.compose, c.board, c.pipes, c.off, c.ops])).digest('hex').slice(0, 16);

/*
Plans one case and answers { golden, reach }. `golden` is what the file holds: the input digest and the result.
`reach` is measured beside it and never stored: which passes fired, read off the result -- an unrequested waypoint
delete is the sweep, an unrequested `set` of a link's ends is the join -- and, for the network, off its stranded pass --
and whether undo of an accepted plan restores the board (PR8) -- every entity byte for byte, compared with each
collection sorted by id, because a restored entity is appended to its collection: B10, registered and held, whose fix is
an explicit order field rather than an ordered restore.
*/
const unordered = (doc) => JSON.stringify(Object.fromEntries(Object.entries(doc).map(([k, v]) =>
	[k, Array.isArray(v) ? [...v].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) : v])));

export function record(c) {
	const { model, options, reached } = compose(c);
	const before = JSON.stringify(model.toJSON());
	const res = plan(model, structuredClone(c.ops), options);
	if (JSON.stringify(model.toJSON()) !== before) throw new Error(`${c.id}: planning mutated the model`);
	const result = res.ok ? { ok: true, ops: res.ops, inverse: res.inverse } : { ok: false, error: res.error, opIndex: res.opIndex };
	const asked = new Set(c.ops.map((o) => `${o.op} ${o.kind} ${o.id || o.entity?.id}`));
	const reach = { ...reached, swept: 0, joined: 0, joinSkipped: 0, refused: !res.ok, undoRestores: null };
	if (res.ok) {
		for (const o of res.ops) {
			if (o.op === 'del' && o.kind === 'node' && !asked.has(`del node ${o.id}`)) reach.swept++;   // only a waypoint is ever swept
			if (o.op === 'set' && o.kind === 'link' && 'src' in o.patch && !asked.has(`set link ${o.id}`)) reach.joined++;
		}
		const scratch = new Model({ kinds: model.kinds });   // the case's kinds, so undo is judged on its pipes too
		scratch.load(JSON.parse(before));
		applyOps(scratch, res.ops);
		/*
		A join the planner SKIPPED: a waypoint a deleted link ended at, left with exactly two links where it had more.
		With no network that is the B239 validation declining the merged link; with one, TR-5 too. The design measures
		it here (section 10) because moving that validation into the refusal phase would refuse these instead.
		*/
		const touching = (m, w) => m.all('link').filter((l) => l.src === w || l.dst === w || (l.via || []).includes(w)).length;
		const ends = new Set(res.ops.filter((o) => o.op === 'del' && o.kind === 'link').flatMap((o) => { const e = model.get('link', o.id); return e ? [e.src, e.dst] : []; }));
		for (const w of ends) if (bareAnchor(scratch, w) && touching(scratch, w) === 2 && touching(model, w) > 2) reach.joinSkipped++;
		applyOps(scratch, res.inverse);
		reach.undoRestores = unordered(scratch.toJSON()) === unordered(JSON.parse(before));
	}
	return { golden: { input: digest(c), result }, reach };
}

export const readGolden = () => JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));



if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1] && process.argv[2] === '--write') {
	const golden = Object.fromEntries(CASES.map((c) => [c.id, record(c).golden]));
	fs.writeFileSync(GOLDEN, `${JSON.stringify(golden)}\n`.replace(/,"(production|network)\//g, ',\n"$1/'));
	console.log(`wrote ${CASES.length} cases to ${GOLDEN.pathname}`);
}
