/*
ONE HOME FOR PAIR CAPACITY -- step T4 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md, F7).

"A pair of endpoints takes one straight link" (B72) was decided in six places: the planner's invariant, Input's release
gate and its replug gate, the network's `judgeDrag`, and the two delete cascades that strip a bend (planner/txn.mjs and
app/src/commands.js). Only the invariant asked `straightCapacity`, the function built so the limit could one day be
configured in one place; the other five each assumed a capacity of one in their own way -- a Set of pair keys, a
`some(...)`, a `find(...)`. Raising the limit would have changed what the planner accepts and nothing else, so every
other site would have refused what the planner allows.

T4 gives the five one question to ask, `pairHolders(link, among, model)` in network/link-rules.mjs (model/invariants.mjs until S-b, model/link-rules.mjs until S-e) -- the straight links
holding the pair against a link, empty when there is room -- beside the invariant and the capacity it reads. What the sites decide is unchanged: the tests of each (tests/input.test.js B72/B80,
tests/txn.test.js and tests/commands.test.js B81, tests/guide-gesture.test.js) pass unedited.

THE GUARD is the last test here. It copies the tree, raises `straightCapacity` to 2 in the copy, and drives all six
sites there: each must then admit a second straight link. It is the property T4 exists for -- one change, every site
follows -- and it fails on any site that decides the limit for itself.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeInput, pointer, seedNodes } from './fixtures/client-harness.mjs';
import { pairHolders } from '../network/link-rules.mjs';
import { makeWaypoint } from '../devices/make-node.mjs';   // O-e1: the devices plugin's factories

// admitted = no link holds the pair against it
const admits = (link, among) => pairHolders(link, among).length === 0;

const A = 'node-00000a', B = 'node-00000b', W = 'node-00000c';
const straight = (id, src, dst) => ({ id, src, dst, via: [] });

test('a link with a bend is always admitted: routed links fan out and are not limited here', () => {
	assert.equal(admits({ src: A, dst: B, via: [W] }, [straight('link-000001', A, B)]), true);
});

test('a straight link is admitted on a pair holding no straight link, and refused on one that does, in either direction', () => {
	assert.equal(admits({ src: A, dst: B, via: [] }, []), true);
	assert.equal(admits({ src: A, dst: B }, [straight('link-000001', A, B)]), false, 'no via at all is straight too');
	assert.equal(admits({ src: B, dst: A, via: [] }, [straight('link-000001', A, B)]), false, 'the pair is unordered');
});

test('only straight links on the SAME pair count against it', () => {
	const among = [{ id: 'link-000001', src: A, dst: B, via: [W] }, straight('link-000002', A, 'node-00000d')];
	assert.equal(admits({ src: A, dst: B, via: [] }, among), true, 'a routed link does not take the straight slot (B80)');
});

test('the answer NAMES the holders, so a refusal can say which link is already there', () => {
	const held = straight('link-000001', A, B);
	assert.deepEqual(pairHolders({ src: B, dst: A, via: [] }, [held, { id: 'link-000002', src: A, dst: B, via: [W] }]), [held]);
});

test('a link never counts against itself, so a replug to its own pair is judged on the others', () => {
	const self = straight('link-000001', A, B);
	assert.equal(admits({ ...self }, [self]), true);
	assert.equal(admits({ ...self }, [self, straight('link-000002', B, A)]), false);
});

/*
The REPLUG gate had no test that drove it -- its B72 rule was held only by reading. Driven here through the real
gesture: select a link, grab an end handle, release on another node.
*/
const handle = (end, x, y) => pointer(x, y, { target: { tagName: 'circle', classList: { contains: (c) => c === 'handle' }, dataset: { end }, closest: () => null } });
function replug(h, link, end, x, y) {
	h.selection.set([link.id]);
	h.capture.onDown(handle(end, ...(end === 'src' ? [h.model.get('node', link.src).x, h.model.get('node', link.src).y] : [h.model.get('node', link.dst).x, h.model.get('node', link.dst).y])));
	h.capture.onMove(pointer(x, y));
	h.capture.onUp(pointer(x, y));
}

test('replug: a straight link may be moved onto a pair with no straight link', () => {
	const h = makeInput();
	try {
		const [a, b, c] = seedNodes(h.model, [[0, 0], [360, 0], [0, 360]]);
		const l = h.model.makeLink(c.id, b.id); h.model.put('link', l);
		replug(h, l, 'src', a.x, a.y);
		assert.equal(h.model.get('link', l.id).src, a.id, 'the gesture reaches the gate and commits');
	} finally { h.restore(); }
});

test('replug: a straight link may NOT be moved onto a pair that already holds one (B72)', () => {
	const h = makeInput();
	try {
		const [a, b, c] = seedNodes(h.model, [[0, 0], [360, 0], [0, 360]]);
		const held = h.model.makeLink(a.id, b.id); h.model.put('link', held);
		const l = h.model.makeLink(c.id, b.id); h.model.put('link', l);
		replug(h, l, 'src', a.x, a.y);
		assert.equal(h.model.get('link', l.id).src, c.id, 'it would render on top of the one already there');
	} finally { h.restore(); }
});

test('replug: a ROUTED link may be moved onto a pair that holds a straight one', () => {
	const h = makeInput();
	try {
		const [a, b, c] = seedNodes(h.model, [[0, 0], [360, 0], [0, 360]]);
		const w = makeWaypoint(h.model, { x: 180, y: 180 }); h.model.put('node', w);
		const held = h.model.makeLink(a.id, b.id); h.model.put('link', held);
		const l = h.model.makeLink(c.id, b.id); l.via = [w.id]; h.model.put('link', l);
		replug(h, l, 'src', a.x, a.y);
		assert.equal(h.model.get('link', l.id).src, a.id, 'its bend fans it out');
	} finally { h.restore(); }
});

/*
THE GUARD -- raise the capacity in ONE place and every site follows.

A copy of the tree, so the real straightCapacity is never touched; the copy's own modules are driven by a script run
inside it, so nothing it loads is shared with this process.
*/
const GUARD = String.raw`
import { makeInput, pointer, seedNodes } from './tests/fixtures/client-harness.mjs';
import { Model } from './model/model.mjs';
import { violations } from './model/invariants.mjs';
import { attachRelations } from './engine/store.mjs';
import { cellOf } from './kernel/geometry.mjs';
import { commit } from './planner/txn.mjs';
import { linkTenant } from './network/link-reactions.mjs';
import { productKinds } from './planner/kinds.mjs';
import { NETWORK_ROWS } from './network/kinds.mjs';
import { createNetwork } from './network/network.mjs';
import { createTransit } from './network/transit.mjs';
// the product's kinds and the network's rows (S-e), and a network to draw with (V-e, J2) -- the strip's tenant lays no pipe
const K = productKinds(...NETWORK_ROWS);
const N = () => createNetwork(createTransit());
// the strip site, in a tenant with no stranded pass -- production's (the network's) deletes the pinned link anyway (S-b)
const STRIP = { links: linkTenant({ owner: 'the strip', keepsOrphan: () => false, says: {} }), kinds: K };
import { Log } from './planner/log.mjs';
import { deleteSelection } from './app/src/commands.js';
import { judgeDrag } from './network/guide.mjs';

const P = 60, A = 'node-00000a', B = 'node-00000b', W = 'node-00000c';
const out = {};

// the invariant: two straight links on one pair
{ const m = new Model({ kinds: K, network: N() }); m.put('node', { id: A, name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' });
  m.put('node', { id: B, name: 'B', type: 'router', x: 6 * P, y: 0, shape: 'circle' });
  m.put('link', { id: 'link-000001', name: 'l', src: A, dst: B }); m.put('link', { id: 'link-000002', name: 'm', src: B, dst: A });
  out.invariant = !violations(m).some((v) => /straight links between/.test(v)); }

// the planner's strip: deleting the only bend of a routed link on a pair that holds a straight one
{ const m = new Model({ kinds: K, network: N() }); attachRelations(m, { cellOf }); const log = new Log();
  const r0 = commit(m, log, { label: 'setup', ops: [
    { op: 'put', kind: 'node', entity: { id: A, name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' } },
    { op: 'put', kind: 'node', entity: { id: B, name: 'B', type: 'router', x: 6 * P, y: 0, shape: 'circle' } },
    { op: 'put', kind: 'node', entity: { id: W, name: 'w', x: 3 * P, y: 2 * P } },
    { op: 'put', kind: 'link', entity: { id: 'link-000001', name: 'l', src: A, dst: B } },
    { op: 'put', kind: 'link', entity: { id: 'link-000002', name: 'm', src: A, dst: B, via: [W] } }] }, 'lab', 'lab', STRIP);
  if (!r0.ok) throw new Error('setup refused: ' + r0.error);
  // the client's strip, projected over the same document
  const entries = deleteSelection(m, new Set([W])).entries;
  out.clientStrip = !entries.some((e) => e.op === 'del' && e.kind === 'link');
  commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'node', id: W }] }, 'lab', 'lab', STRIP);
  out.plannerStrip = m.all('link').length === 2; }

// the network's judgement of a plain drag on a pair that holds a straight link
{ const v = judgeDrag([{ a: A, b: B, laid: 'link' }], { src: A, dst: B, pins: [], guides: [], placed: [], stops: [A, B] }, { links: [{ id: 'link-000001', src: A, dst: B, via: [] }] });
  out.judgeDrag = !/already joins these two/.test(v.notice ?? ''); }

// Input's release gate: a second plain drag between the same two nodes
{ const h = makeInput();
  try {
    const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
    const at = (id, x, y) => pointer(x, y, { target: { tagName: 'g', classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes('node') ? { id } : null) } });
    const plain = () => { h.capture.onDown(at(a.id, 0, 0)); h.capture.onMove(at(b.id, 360, 0)); h.capture.onUp(at(b.id, 360, 0)); };
    plain(); plain();
    out.release = h.model.all('link').length === 2;
  } finally { h.restore(); } }

// Input's replug gate: a straight link moved onto a pair that holds one
{ const h = makeInput();
  try {
    const [a, b, c] = seedNodes(h.model, [[0, 0], [360, 0], [0, 360]]);
    h.model.put('link', h.model.makeLink(a.id, b.id));
    const l = h.model.makeLink(c.id, b.id); h.model.put('link', l);
    h.selection.set([l.id]);
    h.capture.onDown(pointer(c.x, c.y, { target: { tagName: 'circle', classList: { contains: (k) => k === 'handle' }, dataset: { end: 'src' }, closest: () => null } }));
    h.capture.onMove(pointer(a.x, a.y)); h.capture.onUp(pointer(a.x, a.y));
    out.replug = h.model.get('link', l.id).src === a.id;
  } finally { h.restore(); } }

console.log(JSON.stringify(out));
`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEEDLE = 'export function straightCapacity(_model, _a, _b) {\n\treturn 1;\n}';   // its own module since S-b

test('ONE HOME: raise straightCapacity to 2 in a copy, and all six sites admit a second straight link', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pair-capacity-'));
	try {
		for (const d of ['kernel', 'model', 'engine', 'app', 'server', 'planner', 'network', 'zones', 'groups', 'devices', 'tests/fixtures']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
		fs.cpSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
		const inv = path.join(dir, 'network/pair-capacity.mjs');
		const src = fs.readFileSync(inv, 'utf8');
		assert.equal(src.split(NEEDLE).length, 2, 'the guard is INVALID: straightCapacity no longer reads as it did -- re-point NEEDLE');
		fs.writeFileSync(inv, src.replace(NEEDLE, NEEDLE.replace('return 1;', 'return 2;')));
		fs.writeFileSync(path.join(dir, 'guard.mjs'), GUARD);
		const seen = JSON.parse(execFileSync(process.execPath, ['guard.mjs'], { cwd: dir, encoding: 'utf8' }).trim().split('\n').pop());
		assert.deepEqual(seen, { invariant: true, clientStrip: true, plannerStrip: true, judgeDrag: true, release: true, replug: true },
			'every site must ask the one capacity; a false names a site that decides the limit for itself');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
