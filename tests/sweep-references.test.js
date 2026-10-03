/*
The planner's orphan sweep takes EXTRA references by injection -- the second interface the network
incubator forces into a product module.

The sweep removes a waypoint that a link referenced before a transaction and none references after
(planner/txn.mjs). That is right for today's document, where only links reference anchors. The
incubating network plugin adds PIPES, which reference anchors too -- and they live in the lab's
session, not the document, so the real planner cannot see them.

MEASURED before this was written, through the real planner: an anchor that is a PIN of one link and a
GUIDE for another is swept when the pinning link is deleted, and the guided link's route breaks. A
guide-only anchor is safe, because it was never referenced and the sweep leaves what arrived
unreferenced alone.

So the orphan sweep is a REACTION its link tenant declares (PL-3, model/link-reactions.mjs), built with
`linkTenant({ alsoReferenced, keepsOrphan })`: `alsoReferenced(model) -> ids` names what else references an anchor.
They began as hooks the planner asked a `network` object; since PL-3 the network brings its own tenant and the planner
asks nothing. Production passes nothing and must sweep exactly as before -- the first test holds that, because the
sweep is where a casual change does the most damage: it deletes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { commit, undo } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { linkTenant } from '../model/link-reactions.mjs';

const P = 60;
const nd = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, type: 'router', x: x * P, y: y * P, shape: 'circle' } });
const wp = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, x: x * P, y: y * P } });
const lk = (id, s, d, via) => ({ op: 'put', kind: 'link', entity: { id, name: id, src: s, dst: d, ...(via ? { via } : {}) } });
const W = 'node-00000f';
// a link tenant built like production's -- the rule B162/B216 stated here -- so each test changes only the condition it
// is about; `stranded` adds the network's stranded pass, and `onStranded` hears what it emits
const net = ({ alsoReferenced = null, keepsOrphan = (w, { wasBendOnly }) => !!w.pinned || !wasBendOnly, stranded = false, onStranded = null } = {}) => {
	const t = linkTenant({ owner: 'test links', stranded, alsoReferenced, keepsOrphan, says: {} });
	if (onStranded) t.reactions = t.reactions.map((r) => (r.phase !== 'stranded' ? r : { ...r, run: (ctx, emit) => r.run(ctx, (ops) => { onStranded(ops, ctx); emit(ops); }) }));
	return { links: t };
};

// the SHARED anchor: a pin of link-a, and (in the lab) a guide for link-b over pipes
function shared() {
	const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
	const ok = commit(m, log, { label: 'setup', ops: [nd('node-00000a', -6, 0), nd('node-00000b', 6, 0), nd('node-00000c', 0, -4),
		nd('node-00000d', 0, 4), wp(W, 0, 0), lk('link-00000a', 'node-00000a', 'node-00000b', [W]), lk('link-00000b', 'node-00000c', 'node-00000d')] }, 'lab', 'lab');
	assert.equal(ok.ok, true, `setup refused: ${ok.error}`);
	return { m, log };
}
const deletePin = ({ m, log }, opts) => commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'link', id: 'link-00000a' }] }, 'lab', 'lab', opts);

test('production is unchanged: with no extra references, the orphaned pin is swept exactly as before', () => {
	const b = shared();
	assert.equal(deletePin(b).ok, true);
	assert.equal(b.m.get('node', W), undefined, 'today\'s sweep removes a bend its last link released');
});

test('an anchor something else references survives the sweep', () => {
	const b = shared();
	assert.equal(deletePin(b, net({ alsoReferenced: () => [W] })).ok, true);
	assert.ok(b.m.get('node', W), 'the pipes still reference it, so it is structure, not debris');
});

test('the extra references are asked of the model, and an unrelated anchor is still swept', () => {
	const b = shared();
	const seen = [];
	deletePin(b, net({ alsoReferenced: (model) => { seen.push(model); return ['node-000999']; } }));
	assert.ok(seen.length > 0 && seen.every((x) => typeof x.all === 'function'), 'the provider must be handed a model to read');
	assert.equal(b.m.get('node', W), undefined, 'naming a DIFFERENT anchor must not shelter this one');
});

/*
WHICH ORPHANS SURVIVE is the plugin's to say -- ruled 2026-09-29.

Production keeps an orphaned anchor if the author pinned it (B162) or it was a link's END (B216). The
director ruled that in the network model "deliberate" means HELD BY THE PIPES LAID WITH g: anchors made
with w go when their last link goes -- ends and a pinned start included -- unless a pipe laid by hand
holds them. In the lab's plugin now; production at promotion, since production has no pipes and no g,
and there B162 and B216 are the only protection an author's anchor has.

So the rule is the tenant's, `linkTenant({ keepsOrphan(waypoint, { wasBendOnly }) })`, and production's tenant states
production's. The first test is the one that matters most: absent, production sweeps exactly as ruled.
*/
function ended() {
	// a link from a PINNED anchor, through a bend, to an unpinned END anchor
	const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
	const ok = commit(m, log, { label: 'setup', ops: [
		{ op: 'put', kind: 'node', entity: { id: 'node-0000a1', name: 's', x: -360, y: 0, pinned: true } },
		wp('node-0000b2', 0, -2), wp('node-0000c3', 6, 0),
		lk('link-0000d4', 'node-0000a1', 'node-0000c3', ['node-0000b2'])] }, 'lab', 'lab');
	assert.equal(ok.ok, true, `setup refused: ${ok.error}`);
	return { m, log };
}
const deleteIt = ({ m, log }, opts) => commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'link', id: 'link-0000d4' }] }, 'lab', 'lab', opts);
const left = (m) => m.all('node').filter((n) => !n.type).map((w) => w.id).sort();

test('production is unchanged: the bend goes, and the pinned start and the end stay (B162, B216)', () => {
	const b = ended();
	assert.equal(deleteIt(b).ok, true);
	assert.deepEqual(left(b.m), ['node-0000a1', 'node-0000c3']);
});

test('the network plugin\'s rule: with nothing but references keeping an anchor, all three go', () => {
	const b = ended();
	assert.equal(deleteIt(b, net({ keepsOrphan: () => false })).ok, true);
	assert.deepEqual(left(b.m), [], 'the pinned start and the end go with the link: only links and hand pipes keep an anchor');
});

test('the rule is told whether the orphan was only ever a bend, and sees the waypoint itself', () => {
	const b = ended();
	const asked = [];
	deleteIt(b, net({ keepsOrphan: (w, info) => { asked.push([w.id, info.wasBendOnly]); return false; } }));
	assert.deepEqual(asked.sort(), [['node-0000a1', false], ['node-0000b2', true], ['node-0000c3', false]]);
});

/*
A LINK LEFT WITH NO WAY AFTER LOSING A PIN is removed whole -- ruled 2026-09-29. Asked, for a w-chain
S-P1-P2-P3-E with P2 deleted and no other way, the director chose "Delete the whole link" over "Stay,
shown down"; with another way open it re-routes, as ruled 2026-09-26.

Widened 2026-09-30: a pinned link lives and dies with its pins, whatever ways remain. It is the network tenant's
STRANDED pass (PL-3; it was the hook `isStranded` before), which production's tenant does not have: there a link that
loses a pin keeps the rest of its intent, exactly as before, and the first test below holds that.

IN THE SAME TRANSACTION, so the orphan sweep then takes the link's w anchors, and one undo restores the
link, its pin and its anchors together.
*/
const [NA, NB, NC, ND] = ['node-0000e1', 'node-0000e2', 'node-0000e3', 'node-0000e4'];
const [WQ, WP] = ['node-0000e5', 'node-0000e6'];
const [PINNED, APART] = ['link-0000e7', 'link-0000e8'];
function pinned() {
	// A -> B pinned at Q then P; and C -> D, which touches neither
	const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
	const ok = commit(m, log, { label: 'setup', ops: [nd(NA, -6, 0), nd(NB, 6, 0), nd(NC, 0, -4), nd(ND, 0, 4),
		wp(WQ, -3, -2), wp(WP, 3, -2), lk(PINNED, NA, NB, [WQ, WP]), lk(APART, NC, ND)] }, 'lab', 'lab');
	assert.equal(ok.ok, true, `setup refused: ${ok.error}`);
	return { m, log };
}
const deleteP = ({ m, log }, opts) => commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'node', id: WP }] }, 'lab', 'lab', opts);

test('production is unchanged: a link that loses a pin keeps the rest of its intent', () => {
	const b = pinned();
	assert.equal(deleteP(b).ok, true);
	assert.deepEqual(b.m.get('link', PINNED)?.via, [WQ], 'the pin is dropped and the link stays, as it always has');
});

test('the stranded pass removes the link WHOLE in the same transaction, and one undo restores it', () => {
	const b = pinned();
	const r = deleteP(b, net({ stranded: true, keepsOrphan: () => false }));
	assert.equal(r.ok, true);
	assert.equal(b.m.get('link', PINNED), undefined, 'a link with no way after losing its pin is deleted');
	assert.equal(b.m.get('node', WQ), undefined, 'and its remaining pin, made for it alone, is swept with it');
	assert.ok(b.m.get('link', APART), 'a link the edit never touched is left alone');
	assert.equal(undo(b.m, b.log).ok, true);
	assert.deepEqual(b.m.get('link', PINNED)?.via, [WQ, WP], 'one undo restores the link with both pins');
	assert.ok(b.m.get('node', WP) && b.m.get('node', WQ), 'and both anchors');
});

test('the stranded pass removes only a link that lost a pin, judging the document AFTER the edit', () => {
	const b = pinned();
	const heard = [];
	deleteP(b, net({ stranded: true, onStranded: (ops, { doc }) => heard.push(...ops.map((o) => ({ id: o.id, via: doc.get('link', o.id)?.via, pGone: !doc.get('node', WP) }))) }));
	assert.deepEqual(heard, [{ id: PINNED, via: [WQ], pGone: true }],
		'one delete, of the pinned link, with P already stripped and gone from the document it is judged in');
	assert.ok(b.m.get('link', APART), 'the link the edit never touched stays');
});

test('a link that ENDS at the deleted anchor is not the stranded pass\'s: it goes with its end regardless', () => {
	const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
	assert.equal(commit(m, log, { label: 'setup', ops: [nd(NA, -6, 0), wp(WP, 3, -2), lk(PINNED, NA, WP)] }, 'lab', 'lab').ok, true);
	const heard = [];
	commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'node', id: WP }] }, 'lab', 'lab', net({ stranded: true, onStranded: (ops) => heard.push(...ops) }));
	assert.deepEqual(heard, [], 'the cascade took it first: "if either source or dest node is deleted, link is gone with it permanently"');
	assert.equal(m.get('link', PINNED), undefined);
});

/*
B244 (H17.4, K14a) -- A RING HAS NO ENDS, so deleting one sweeps every waypoint it ran through. The sweep kept a closed
ring's `src` and `dst` as termini (B216), because it counted every link's ends as terminals; the role derivation
(kernel/network-roles.mjs) calls them bends, which is what they are on the canvas. Production composition: the classic
tenant, which keeps a link's END and sweeps a bend.
*/
test('B244: deleting a closed ring sweeps all its waypoints, its src and dst included', () => {
	const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
	const [A, B, C] = ['node-0000a1', 'node-0000b2', 'node-0000c3'];
	assert.equal(commit(m, log, { label: 'ring', ops: [wp(A, -2, 0), wp(B, 2, 0), wp(C, 0, 2),
		{ op: 'put', kind: 'link', entity: { id: 'link-0000d4', name: 'ring', src: A, dst: B, via: [C], closed: true } }] }, 'lab', 'lab').ok, true);
	assert.equal(commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'link', id: 'link-0000d4' }] }, 'lab', 'lab').ok, true);
	assert.deepEqual(left(m), [], 'no stray anchors where the ring was');
	assert.equal(undo(m, log).ok, true);
	assert.deepEqual(left(m), [A, B, C], 'and one undo puts the ring back whole');
});

/*
B244 -- THE TWINS AGREE. The sweep's `endsAt` and the kernel's `linkEndsAt` are one rule that `model/` and `kernel/` may not
share by import (C9), so the agreement is driven here, against the REAL role derivation and the REAL sweep, not a copy
in the test: for a waypoint carrying one link, the derivation calls it an endpoint exactly when the classic sweep keeps
it after that link is deleted (B216), over every shape a single link can take through it.
*/
test('B244: the sweep and the role derivation agree on where a link ends, rings included', async () => {
	const { waypointRoles } = await import('../kernel/network-roles.mjs');
	const W = 'node-0000e9', [P, Q] = ['node-0000f1', 'node-0000f2'];
	const shapes = {
		'open, ending at w': { src: P, dst: W },
		'open, starting at w': { src: W, dst: P },
		'open, threaded through w': { src: P, dst: Q, via: [W] },
		'closed, starting at w': { src: W, dst: P, via: [Q], closed: true },
		'closed, ending at w': { src: P, dst: W, via: [Q], closed: true },
		'closed, threaded through w': { src: P, dst: Q, via: [W], closed: true },
	};
	for (const [name, shape] of Object.entries(shapes)) {
		const l = { id: 'link-0000f3', name: 'l', ...shape };
		const endpoint = waypointRoles(W, [l]).includes('endpoint');
		const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
		assert.equal(commit(m, log, { label: 'set', ops: [wp(W, 0, 0), wp(P, -3, 0), wp(Q, 3, 2), { op: 'put', kind: 'link', entity: l }] }, 'lab', 'lab').ok, true, name);
		assert.equal(commit(m, log, { label: 'del', ops: [{ op: 'del', kind: 'link', id: l.id }] }, 'lab', 'lab').ok, true, name);
		assert.equal(!!m.get('node', W), endpoint, `${name}: the derivation says ${endpoint ? 'endpoint' : 'bend'}, so the sweep must ${endpoint ? 'keep' : 'take'} w`);
	}
});
