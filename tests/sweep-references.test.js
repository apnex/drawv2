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

So `commit()` and `plan()` accept `alsoReferenced(model) -> ids`. Production passes nothing and must
sweep exactly as before -- the first test holds that, because the sweep is where a casual change does
the most damage: it deletes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { commit } from '../server/txn.mjs';
import { Log } from '../server/log.mjs';

const P = 60;
const nd = (id, x, y) => ({ op: 'put', kind: 'node', entity: { id, name: id, type: 'router', x: x * P, y: y * P, shape: 'circle' } });
const wp = (id, x, y) => ({ op: 'put', kind: 'waypoint', entity: { id, name: id, x: x * P, y: y * P } });
const lk = (id, s, d, via) => ({ op: 'put', kind: 'link', entity: { id, name: id, src: s, dst: d, ...(via ? { via } : {}) } });
const W = 'waypoint-00000f';

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
	assert.equal(deletePin(b, { alsoReferenced: () => [W] }).ok, true);
	assert.ok(b.m.get('waypoint', W), 'the pipes still reference it, so it is structure, not debris');
});

test('the extra references are asked of the model, and an unrelated anchor is still swept', () => {
	const b = shared();
	const seen = [];
	deletePin(b, { alsoReferenced: (model) => { seen.push(model); return ['waypoint-000999']; } });
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

So the planner takes the rule by injection, `keepsOrphan(waypoint, { wasBendOnly })`, defaulting to
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
	assert.equal(deleteIt(b, { keepsOrphan: () => false }).ok, true);
	assert.deepEqual(left(b.m), [], 'the pinned start and the end go with the link: only links and hand pipes keep an anchor');
});

test('the rule is told whether the orphan was only ever a bend, and sees the waypoint itself', () => {
	const b = ended();
	const asked = [];
	deleteIt(b, { keepsOrphan: (w, info) => { asked.push([w.id, info.wasBendOnly]); return false; } });
	assert.deepEqual(asked.sort(), [['waypoint-0000a1', false], ['waypoint-0000b2', true], ['waypoint-0000c3', false]]);
});
