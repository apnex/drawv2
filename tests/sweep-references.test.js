/*
The planner's orphan sweep takes EXTRA references by injection -- the second interface the network
incubator forces into a product module.

The sweep removes a waypoint that a link referenced before a transaction and none references after
(server/txn.mjs). That is right for today's document, where only links reference anchors. The
incubating network plugin adds PIPES, which reference anchors too -- and they live in the lab's
session, not the document, so the real planner cannot see them.

MEASURED before this was written, through the real planner: an anchor that is a PIN of one link and a
GUIDE for another is swept when the pinning link is deleted, and the guided link's route breaks. A
guide-only anchor is safe, because it was never referenced and the sweep leaves what arrived
unreferenced alone.

So `commit()` and `plan()` accept a `network` whose `alsoReferenced(model) -> ids` names them -- one object carrying
all three of the planner's questions (RULESET-AUDIT T1; they began as three hooks). Production passes nothing and must
sweep exactly as before -- the first test holds that, because the sweep is where a casual change does
the most damage: it deletes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { commit, undo } from '../server/txn.mjs';
import { Log } from '../server/log.mjs';

const P = 60;
const nd = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, type: 'router', x: x * P, y: y * P, shape: 'circle' } });
const wp = (id, x, y) => ({ op: 'put', kind: 'waypoint', entity: { id, name: id, x: x * P, y: y * P } });
const lk = (id, s, d, via) => ({ op: 'put', kind: 'link', entity: { id, name: id, src: s, dst: d, ...(via ? { via } : {}) } });
const W = 'waypoint-00000f';
// a complete network whose answers are production's -- the rule B162/B216 stated here, since the planner keeps its own
// private -- so each test overrides only the question it is about
const net = (over = {}) => ({ network: { alsoReferenced: () => [], keepsOrphan: (w, { wasBendOnly }) => !!w.pinned || !wasBendOnly, isStranded: () => false, ...over } });

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
	assert.equal(b.m.get('waypoint', W), undefined, 'today\'s sweep removes a bend its last link released');
});

test('an anchor something else references survives the sweep', () => {
	const b = shared();
	assert.equal(deletePin(b, net({ alsoReferenced: () => [W] })).ok, true);
	assert.ok(b.m.get('waypoint', W), 'the pipes still reference it, so it is structure, not debris');
});

test('the extra references are asked of the model, and an unrelated anchor is still swept', () => {
	const b = shared();
	const seen = [];
	deletePin(b, net({ alsoReferenced: (model) => { seen.push(model); return ['waypoint-000999']; } }));
	assert.ok(seen.length > 0 && seen.every((x) => typeof x.all === 'function'), 'the provider must be handed a model to read');
	assert.equal(b.m.get('waypoint', W), undefined, 'naming a DIFFERENT anchor must not shelter this one');
});

/*
WHICH ORPHANS SURVIVE is the plugin's to say -- ruled 2026-09-29.

Production keeps an orphaned anchor if the author pinned it (B162) or it was a link's END (B216). The
director ruled that in the network model "deliberate" means HELD BY THE PIPES LAID WITH g: anchors made
with w go when their last link goes -- ends and a pinned start included -- unless a pipe laid by hand
holds them. In the lab's plugin now; production at promotion, since production has no pipes and no g,
and there B162 and B216 are the only protection an author's anchor has.

So the planner takes the rule by injection, `network.keepsOrphan(waypoint, { wasBendOnly })`, defaulting to
production's. The first test is the one that matters most: absent, production sweeps exactly as ruled.
*/
function ended() {
	// a link from a PINNED anchor, through a bend, to an unpinned END anchor
	const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
	const ok = commit(m, log, { label: 'setup', ops: [
		{ op: 'put', kind: 'waypoint', entity: { id: 'waypoint-0000a1', name: 's', x: -360, y: 0, pinned: true } },
		wp('waypoint-0000b2', 0, -2), wp('waypoint-0000c3', 6, 0),
		lk('link-0000d4', 'waypoint-0000a1', 'waypoint-0000c3', ['waypoint-0000b2'])] }, 'lab', 'lab');
	assert.equal(ok.ok, true, `setup refused: ${ok.error}`);
	return { m, log };
}
const deleteIt = ({ m, log }, opts) => commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'link', id: 'link-0000d4' }] }, 'lab', 'lab', opts);
const left = (m) => m.all('waypoint').map((w) => w.id).sort();

test('production is unchanged: the bend goes, and the pinned start and the end stay (B162, B216)', () => {
	const b = ended();
	assert.equal(deleteIt(b).ok, true);
	assert.deepEqual(left(b.m), ['waypoint-0000a1', 'waypoint-0000c3']);
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
	assert.deepEqual(asked.sort(), [['waypoint-0000a1', false], ['waypoint-0000b2', true], ['waypoint-0000c3', false]]);
});

/*
A LINK LEFT WITH NO WAY AFTER LOSING A PIN is removed whole -- ruled 2026-09-29. Asked, for a w-chain
S-P1-P2-P3-E with P2 deleted and no other way, the director chose "Delete the whole link" over "Stay,
shown down"; with another way open it re-routes, as ruled 2026-09-26.

"No way" is a question about ROUTES OVER PIPES, which the planner cannot see -- so it is asked by
injection, `network.isStranded(link, model)`, the fourth interface the network incubator forces into a product
module. Production passes nothing: a link that loses a pin keeps the rest of its intent, exactly as
before, and the first test below holds that.

IN THE SAME TRANSACTION, so the orphan sweep then takes the link's w anchors, and one undo restores the
link, its pin and its anchors together.
*/
const [NA, NB, NC, ND] = ['node-0000e1', 'node-0000e2', 'node-0000e3', 'node-0000e4'];
const [WQ, WP] = ['waypoint-0000e5', 'waypoint-0000e6'];
const [PINNED, APART] = ['link-0000e7', 'link-0000e8'];
function pinned() {
	// A -> B pinned at Q then P; and C -> D, which touches neither
	const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
	const ok = commit(m, log, { label: 'setup', ops: [nd(NA, -6, 0), nd(NB, 6, 0), nd(NC, 0, -4), nd(ND, 0, 4),
		wp(WQ, -3, -2), wp(WP, 3, -2), lk(PINNED, NA, NB, [WQ, WP]), lk(APART, NC, ND)] }, 'lab', 'lab');
	assert.equal(ok.ok, true, `setup refused: ${ok.error}`);
	return { m, log };
}
const deleteP = ({ m, log }, opts) => commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'waypoint', id: WP }] }, 'lab', 'lab', opts);

test('production is unchanged: a link that loses a pin keeps the rest of its intent', () => {
	const b = pinned();
	assert.equal(deleteP(b).ok, true);
	assert.deepEqual(b.m.get('link', PINNED)?.via, [WQ], 'the pin is dropped and the link stays, as it always has');
});

test('an injected isStranded removes the link WHOLE in the same transaction, and one undo restores it', () => {
	const b = pinned();
	const r = deleteP(b, net({ isStranded: () => true, keepsOrphan: () => false }));
	assert.equal(r.ok, true);
	assert.equal(b.m.get('link', PINNED), undefined, 'a link with no way after losing its pin is deleted');
	assert.equal(b.m.get('waypoint', WQ), undefined, 'and its remaining pin, made for it alone, is swept with it');
	assert.ok(b.m.get('link', APART), 'a link the edit never touched is left alone');
	assert.equal(undo(b.m, b.log).ok, true);
	assert.deepEqual(b.m.get('link', PINNED)?.via, [WQ, WP], 'one undo restores the link with both pins');
	assert.ok(b.m.get('waypoint', WP) && b.m.get('waypoint', WQ), 'and both anchors');
});

test('isStranded is asked only about a link that lost a pin, and sees it as it is AFTER the edit', () => {
	const b = pinned();
	const asked = [];
	deleteP(b, net({ isStranded: (link, model) => { asked.push({ id: link.id, via: link.via, pGone: !model.get('waypoint', WP) }); return false; } }));
	assert.deepEqual(asked, [{ id: PINNED, via: [WQ], pGone: true }],
		'one question, about the pinned link, with P already stripped and gone from the model it is judged in');
	assert.deepEqual(b.m.get('link', PINNED)?.via, [WQ], 'answered "not stranded", the link re-routes on its remaining intent');
});

test('a link that ENDS at the deleted anchor is not asked: it goes with its end regardless', () => {
	const m = new Model(); attachRelations(m, { cellOf }); const log = new Log();
	assert.equal(commit(m, log, { label: 'setup', ops: [nd(NA, -6, 0), wp(WP, 3, -2), lk(PINNED, NA, WP)] }, 'lab', 'lab').ok, true);
	const asked = [];
	commit(m, log, { label: 'delete', ops: [{ op: 'del', kind: 'waypoint', id: WP }] }, 'lab', 'lab', net({ isStranded: (l) => { asked.push(l.id); return false; } }));
	assert.deepEqual(asked, [], '"if either source or dest node is deleted, link is gone with it permanently"');
	assert.equal(m.get('link', PINNED), undefined);
});
