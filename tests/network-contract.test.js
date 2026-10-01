/*
ONE network interface -- step T1 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md, F9).

The incubating network plugin reached the product through SEVEN separate hooks: four on the Model (`resolvePath`,
`routedThrough`, `linkDown`, `blockedBy`) and three on the planner (`alsoReferenced`, `keepsOrphan`, `isStranded`).
Each was added correctly for its day, and together they let a composition pass some and forget others -- a Model that
draws links along routes but says none is down, a planner that shelters pipe anchors but never removes a stranded
link. Nothing said which hooks belonged together, because nothing declared them as one thing.

T1 declares them as one: a `network` object. The Model reads four of its methods and the planner three, each method
named as the question it answers -- the Model's under the Model's own method names, so `model.isLinkDown(link)` is
`network.isLinkDown(link, model)`. The plugin builds the object once (`network/network.mjs`) and the lab hands the
same object to both.

AMENDED by PL-3 (dev/design/planner/PLANNER-SYSTEM.md): the planner no longer reads the network's methods. The four it
read became conditions inside the network's own LINK TENANT, `network.links`, which a composition hands the planner
as `{ links }` -- one slot, so production's classic tenant and the network's are never both composed (PD-2).

These tests hold the two guardrails the audit set:
  - PRODUCTION UNCHANGED. With no network, the Model and the planner behave exactly as before (held beside each
    interface in tests/path-injection.test.js and tests/sweep-references.test.js).
  - NO SILENT HALF-PLUGIN. A network missing a method its consumer reads is an error at construction, not a quiet
    fall-back to production's answer for that one question -- and so is a caller still using a retired hook name,
    which would otherwise be ignored and leave the plugin half-composed.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/model.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { commit, plan } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { createPipeSet } from '../network/pipeset.mjs';
import { createNetwork } from '../network/network.mjs';

const MODEL_READS = ['pathOf', 'linksRoutedThrough', 'isLinkDown', 'blockersOf', 'declaresNoTransit'];
const RETIRED_PLANNER_HOOKS = ['alsoReferenced', 'keepsOrphan', 'isStranded', 'joinsAt'];
const complete = () => Object.fromEntries(MODEL_READS.map((k) => [k, () => undefined]));
const without = (name) => { const n = complete(); delete n[name]; return n; };

const request = { label: 'add', ops: [{ op: 'put', kind: 'node', entity: { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' } }] };
const board = () => { const m = new Model(); attachRelations(m, { cellOf }); return { m, log: new Log() }; };

test('the Model reads the network under its OWN method names', () => {
	for (const name of MODEL_READS) assert.equal(typeof Model.prototype[name], 'function', `Model.${name} is the question network.${name} answers`);
});

test('a network missing any method the Model reads is refused at construction, naming it', () => {
	for (const name of MODEL_READS) {
		assert.throws(() => new Model({ network: without(name) }), new RegExp(name), `a network with no ${name} must not fall back to production's answer`);
	}
});

test('a network member that is not a function is refused, not called later', () => {
	assert.throws(() => new Model({ network: { ...complete(), isLinkDown: true } }), /isLinkDown/);
});

test('the Model needs only its own five', () => {
	const modelOnly = Object.fromEntries(MODEL_READS.map((k) => [k, () => undefined]));
	assert.ok(new Model({ network: modelOnly }));
});

test('the retired Model hooks are refused, so an old composition cannot half-plug the network', () => {
	for (const old of ['resolvePath', 'routedThrough', 'linkDown', 'blockedBy']) {
		assert.throws(() => new Model({ [old]: () => null }), /network/, `${old} is retired, and must say what replaced it`);
	}
	assert.throws(() => new Model({ netwrok: complete() }), /netwrok/, 'a misspelt option is an error, not an ignored key');
});

test('no network is production: new Model({ network: null }) is new Model()', () => {
	assert.equal(new Model({ network: null }).network, null);
	assert.equal(new Model().network, null);
});

test('a malformed link tenant is refused by plan() and commit(), saying what is wrong, and nothing is written', () => {
	const run = (row) => ({ owner: 'bad', reactions: [row] });
	for (const [links, says] of [
		[{ reactions: [] }, /owner, reactions/],
		[run({ id: 'x', phase: 'later', run: () => {} }), /phase of clear, follow, stranded, sweep, join/],
		[run({ id: 'x', phase: 'sweep' }), /a reaction is/],
		[{ owner: 'twice', reactions: [{ id: 'group-trim', phase: 'clear', run: () => {} }] }, /two reactions are named group-trim/],
	]) {
		const { m, log } = board();
		assert.throws(() => commit(m, log, request, 'lab', 'lab', { links }), says);
		assert.throws(() => plan(m, request.ops, { links }), says);
		assert.equal(m.all('node').length, 0, 'and nothing was written');
	}
});

test('commit() checks the composition before it judges the request, so a composition error is never hidden by a refusal', () => {
	const { m, log } = board();
	assert.throws(() => commit(m, log, { ...request, expect: 99 }, 'lab', 'lab', { links: { reactions: [] } }), /owner, reactions/);
});

test('the retired planner hooks, and the retired network option, are refused by plan() and commit()', () => {
	for (const old of RETIRED_PLANNER_HOOKS) {
		const { m, log } = board();
		assert.throws(() => commit(m, log, request, 'lab', 'lab', { [old]: () => null }), /unknown option/, `${old} as a bare option is retired`);
		assert.throws(() => plan(m, request.ops, { [old]: () => null }), /unknown option/);
	}
	const { m, log } = board();
	assert.throws(() => commit(m, log, request, 'lab', 'lab', { network: createNetwork(createPipeSet()) }), /retired.*links: network\.links/);
	assert.throws(() => plan(m, request.ops, { network: createNetwork(createPipeSet()) }), /retired/);
});

test('the plugin builds ONE object: the Model reads it, and the planner takes its link tenant', () => {
	const pipes = createPipeSet();
	const network = createNetwork(pipes, () => 0);
	for (const name of MODEL_READS) assert.equal(typeof network[name], 'function', `network.${name}`);
	for (const old of RETIRED_PLANNER_HOOKS) assert.equal(network[old], undefined, `network.${old} is retired: the tenant holds it`);
	const m = new Model({ network });
	assert.equal(m.network, network, 'the Model holds the object it was given, not a copy of some of it');
	assert.equal(network.links.owner, 'network links');
	assert.deepEqual(network.links.reactions.map((r) => r.phase), ['clear', 'clear', 'stranded', 'sweep', 'join']);
	const { m: authority, log } = board();
	assert.equal(commit(authority, log, request, 'lab', 'lab', { links: network.links }).ok, true, 'and the planner accepts its tenant');
});

/*
A PINNED LINK LIVES AND DIES WITH ITS PINS -- ruled 2026-09-30, widening "a link that loses a pin with no other way is
deleted whole" (2026-09-29): "a deliberate pin is a link's intent, and if that intent is removed, the link no longer
serves its purpose". The network tenant's stranded pass deletes a link whose pin the edit deleted, whatever ways remain
-- a free one, one another link holds, or none.
*/
test('the network strands every link that lost a pin, whatever ways remain', () => {
	const pipes = createPipeSet();
	pipes.lay('node-00000a', 'node-00000b', 'hand');   // a way, and a free one
	const network = createNetwork(pipes, () => 0);
	const { m, log } = board();
	assert.equal(commit(m, log, { label: 'setup', ops: [
		{ op: 'put', kind: 'node', entity: { id: 'node-00000a', name: 'A', type: 'router', x: 0, y: 0, shape: 'circle' } },
		{ op: 'put', kind: 'node', entity: { id: 'node-00000b', name: 'B', type: 'router', x: 240, y: 0, shape: 'circle' } },
		{ op: 'put', kind: 'waypoint', entity: { id: 'waypoint-00000c', name: 'p', x: 120, y: 120 } },
		{ op: 'put', kind: 'link', entity: { id: 'link-000001', name: 'l', src: 'node-00000a', dst: 'node-00000b', via: ['waypoint-00000c'] } }] }, 'lab', 'lab').ok, true);
	const r = commit(m, log, { label: 'del', ops: [{ op: 'del', kind: 'waypoint', id: 'waypoint-00000c' }] }, 'lab', 'lab', { links: network.links });
	assert.equal(r.ok, true);
	assert.equal(m.get('link', 'link-000001'), undefined, 'the free way does not save it: its pin was its intent');
});

