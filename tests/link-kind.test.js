// H18.15 (S-e) -- the link is the network's kind: its row, its references and its document invariant live in network/, the
// product composes three kinds, and every production composition brings the link by composing the network (G5, B280).
// dev/design/unification/SERVER-COMPOSES-NETWORK.md, stage S-e.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Model as CoreModel } from '../model/model.mjs';
import { CORE_KINDS, composeKinds } from '../model/shape.mjs';
import { clone } from '../model/ops.mjs';
import { violations } from '../model/invariants.mjs';
import { productKinds } from '../planner/kinds.mjs';
const PRODUCT_KINDS = productKinds();   // the product's own kinds; the export went at S-f with the defaults it served
import { validateEntity as productValidateEntity } from '../planner/validate.js';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';
import { LINK_ROW } from '../network/link-kind.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { Model, KINDS, plan, validateDoc } from './fixtures/composed.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = 60;
const node = (hex, x, y) => ({ id: `node-${hex}`, name: `n${hex}`, type: 'router', shape: 'circle', x: x * P, y: y * P });
const straight = (hex, a, b) => ({ id: `link-${hex}`, name: `l${hex}`, src: `node-${a}`, dst: `node-${b}` });

// ---- who owns the link ----

test('S-e: the product composes three kinds and names no link; the network brings it, as its own', () => {
	assert.deepEqual(CORE_KINDS.list, ['node', 'zone', 'group']);
	assert.deepEqual(PRODUCT_KINDS.list, ['node', 'zone', 'group']);
	assert.equal(LINK_ROW.owner, 'the network');
	assert.ok(NETWORK_ROWS.includes(LINK_ROW), 'composing the network brings the link');
	assert.deepEqual(KINDS.list, ['node', 'zone', 'group', 'link', 'pipe'], 'the composition production runs');
	assert.equal(KINDS.row('link').owner, 'the network');
});

test('S-e: no core or planner module imports network/ -- the link reaches them only through a composition', () => {
	const offenders = [];
	for (const dir of ['model', 'planner']) {
		for (const f of fs.readdirSync(path.join(root, dir)).filter((x) => /\.m?js$/.test(x))) {
			const src = fs.readFileSync(path.join(root, dir, f), 'utf8');
			for (const m of src.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) if (/(^|\/)network\//.test(m[1])) offenders.push(`${dir}/${f} -> ${m[1]}`);
		}
	}
	assert.deepEqual(offenders, []);
});

test('S-e: a composition without the network has no links -- a Model refuses one, and so does the product\'s validator', () => {
	assert.throws(() => new CoreModel().put('link', straight('000001', '000001', '000002')), /link is not a kind this model was composed with/);
	assert.match(productValidateEntity('link', straight('000001', '000001', '000002'), { kinds: PRODUCT_KINDS }), /unknown kind: link/);
});

/*
S-f (H18.16) -- THE VALIDATOR TAKES NO DEFAULT. With the product's kinds as the default, a document's `links` -- a key no
composed kind owned -- passed unread: a link to nowhere was accepted. Every entry point now requires its composition.
*/
test('S-f: the validator takes no default composition -- each entry point refuses to run without one', async () => {
	const real = await import('../planner/validate.js');
	const broken = { meta: { id: 'diagram-000001', name: 'd' }, nodes: [node('000001', -4, 0)], links: [straight('000001', '000001', '00000f')] };
	assert.throws(() => real.validateDoc(broken), /validateDoc: kinds is the composition to validate against/);
	assert.throws(() => real.validateEntity('node', node('000001', 0, 0)), /validateEntity: kinds is/);
	assert.throws(() => real.validateMutation(new Model(), { action: 'put', kind: 'node', entity: node('000001', 0, 0) }), /validateMutation: kinds is/);
	assert.throws(() => real.validateSelectionIds([]), /validateSelectionIds: kinds is/);
	assert.match(real.validateDoc(broken, { kinds: KINDS }), /link dst does not exist: node-00000f/, 'and with the composition, the link is judged');
	// the core's storage half carries no checks, so it is not a composition to validate against
	assert.throws(() => real.validateDoc(broken, { kinds: CORE_KINDS }), /validateDoc: kinds is the composition to validate against, every row carrying its checks/);
});

// ---- the link row's references and invariant, through the composition ----

test('S-e: the link\'s references are its row\'s, judged through the generic access on both paths', () => {
	const doc = { meta: { id: 'diagram-000001', name: 'd' }, nodes: [node('000001', -4, 0), node('000002', 4, 0)], links: [straight('000001', '000001', '000003')] };
	assert.equal(validateDoc(doc), 'link dst does not exist: node-000003 (link-000001)', 'a document');
	const m = new Model(); for (const n of doc.nodes) m.put('node', n);
	const r = plan(m, [{ op: 'put', kind: 'link', entity: straight('000001', '000001', '000003') }]);
	assert.equal(r.ok, false);
	assert.match(r.error, /link dst does not exist: node-000003/, 'and a mutation');
});

test('S-e: a link bends only at a waypoint -- the generic access tells a typed node from a node with no type', () => {
	const doc = { meta: { id: 'diagram-000001', name: 'd' }, nodes: [node('000001', -4, 0), node('000002', 4, 0), node('000003', 0, 2)],
		links: [{ ...straight('000001', '000001', '000002'), via: ['node-000003'] }] };
	assert.equal(validateDoc(doc), 'link via waypoint does not exist: node-000003 (link-000001)', 'a router in a via is refused');
	const bent = structuredClone(doc); delete bent.nodes[2].type; delete bent.nodes[2].shape;
	assert.equal(validateDoc(bent), null, 'and a node with no type is a bend');
});

test('S-e: the straight-pair rule is the link row\'s invariant -- reported where the network is composed, absent where it is not', () => {
	const m = new Model();
	m.put('node', node('000001', -4, 0)); m.put('node', node('000002', 4, 0));
	m.put('link', straight('000001', '000001', '000002')); m.put('link', straight('000002', '000002', '000001'));
	assert.deepEqual(violations(m), ['2 straight links between node-000001 and node-000002, which may carry 1']);
	const without = productKinds();
	const bare = new CoreModel({ kinds: without }); bare.put('node', node('000001', -4, 0));
	assert.deepEqual(violations(bare), [], 'a composition without the link checks no links, and does not throw');
	// a plugin's row may hold an invariant of its own, reported beside the core's
	const PROBE = { kind: 'probe', owner: 'a test plugin', collection: 'probes', selectable: false, named: false, anchor: false,
		composite: [], optional: [], references: [], fields: { id: (v) => typeof v === 'string' }, cap: 3,
		invariants: (model, report) => { if (model.all('probe').length > 1) report('two probes', 'probes', 1); } };
	const withProbe = new CoreModel({ kinds: composeKinds([...without.list.map((k) => without.row(k)), PROBE], 't') });
	withProbe.put('probe', { id: 'p1' }); withProbe.put('probe', { id: 'p2' });
	assert.deepEqual(violations(withProbe, { facts: true }), [{ key: 'probes', measure: 1, sentence: 'two probes' }]);
});

test('S-e: the planner still refuses a second straight link on a pair -- the backstop reads the row\'s invariant', () => {
	const m = new Model();
	m.put('node', node('000001', -4, 0)); m.put('node', node('000002', 4, 0));
	m.put('link', straight('000001', '000001', '000002'));
	const r = plan(m, [{ op: 'put', kind: 'link', entity: straight('000002', '000002', '000001') }]);
	assert.equal(r.ok, false);
	assert.match(r.error, /straight link/);
});

// ---- what the core no longer needs to know ----

test('S-e: clone copies every nested value, so a plugin kind\'s nested field is never shared -- the link\'s via among them', () => {
	const link = { id: 'link-000001', src: 'node-000001', dst: 'node-000002', via: ['node-000003'] };
	const copy = clone('link', link);
	copy.via.push('node-000004');
	assert.deepEqual(link.via, ['node-000003'], 'the link\'s via is the network\'s field, and is copied');
	const probe = { id: 'p1', at: [{ x: 1 }], meta: { deep: { n: 1 } } };
	const c = clone('probe', probe);
	c.at[0].x = 2; c.meta.deep.n = 2;
	assert.deepEqual(probe, { id: 'p1', at: [{ x: 1 }], meta: { deep: { n: 1 } } }, 'a kind the core never heard of');
});

test('S-e: the relations index attaches to a model composed without links', () => {
	const m = new CoreModel();
	m.put('node', node('000001', 0, 0));
	assert.doesNotThrow(() => attachRelations(m, { cellOf }));
});
