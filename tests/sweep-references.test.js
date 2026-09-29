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
