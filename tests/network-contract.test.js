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
import { commit, plan } from '../server/txn.mjs';
import { Log } from '../server/log.mjs';
import { createPipeSet } from '../network/pipeset.mjs';
import { createNetwork } from '../network/network.mjs';

const MODEL_READS = ['pathOf', 'linksRoutedThrough', 'isLinkDown', 'blockersOf'];
const PLANNER_READS = ['alsoReferenced', 'keepsOrphan', 'isStranded'];
const complete = () => Object.fromEntries([...MODEL_READS, ...PLANNER_READS].map((k) => [k, () => undefined]));
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

test('the Model needs only its own four: the planner\'s methods are the planner\'s to check', () => {
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

test('a network missing any method the planner reads is refused by plan() and commit(), naming it', () => {
	for (const name of PLANNER_READS) {
		const { m, log } = board();
		assert.throws(() => commit(m, log, request, 'lab', 'lab', { network: without(name) }), new RegExp(name));
		assert.throws(() => plan(m, request.ops, { network: without(name) }), new RegExp(name));
		assert.equal(m.all('node').length, 0, 'and nothing was written');
	}
});

test('commit() checks the network before it judges the request, so a composition error is never hidden by a refusal', () => {
	const { m, log } = board();
	assert.throws(() => commit(m, log, { ...request, expect: 99 }, 'lab', 'lab', { network: without('isStranded') }), /isStranded/);
});

test('the retired planner hooks are refused by plan() and commit()', () => {
	for (const old of PLANNER_READS) {
		const { m, log } = board();
		assert.throws(() => commit(m, log, request, 'lab', 'lab', { [old]: () => null }), /network/, `${old} as a bare option is retired`);
		assert.throws(() => plan(m, request.ops, { [old]: () => null }), /network/);
	}
});

test('the plugin builds ONE object that satisfies both consumers', () => {
	const pipes = createPipeSet();
	const network = createNetwork(pipes, () => 0);
	for (const name of [...MODEL_READS, ...PLANNER_READS]) assert.equal(typeof network[name], 'function', `network.${name}`);
	const m = new Model({ network });
	assert.equal(m.network, network, 'the Model holds the object it was given, not a copy of some of it');
	const { m: authority, log } = board();
	assert.equal(commit(authority, log, request, 'lab', 'lab', { network }).ok, true, 'and the planner accepts the same object');
});
