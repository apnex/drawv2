/*
THE SHADOW GUARD (H17.28 TG-3; PLANNER-SYSTEM.md section 14.4; TG-D2 ruled 2026-10-02: in the tests only) -- a declared
trigger can be wrong the way a scan was: it can hear too little. So every case of the planner corpus, in both compositions,
is planned twice: as composed, each transaction-phase reaction called only when its trigger hears a change and handed what
it heard; and in SHADOW, each forced to run on every transaction and handed every change. The two must answer the same.
A trigger that misses a kind of change its reaction acts on fails here, naming the case -- the guard B285 and B286 lacked.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES, composeCase } from './fixtures/planner-corpus.mjs';
import { plan, PHASES } from '../planner/txn.mjs';
import { CLASSIC_LINKS } from '../planner/tenants.mjs';
import { PRODUCT_KINDS } from '../planner/kinds.mjs';

const PER_OP = new Set(['clear', 'follow']);
// a trigger that hears every change of every kind a composition holds
const everything = (kinds) => [{ deleted: kinds.list }, { created: kinds.list },
	...kinds.list.map((kind) => ({ changed: { kind, fields: Object.keys(kinds.row(kind).fields) } }))];
// the tenant in shadow: its transaction-phase reactions hear everything and are handed every change
const shadowOf = (tenant, kinds) => ({ ...tenant, reactions: tenant.reactions.map((r) => (PER_OP.has(r.phase) ? r
	: { ...r, trigger: everything(kinds), run: (ctx, emit) => r.run({ ...ctx, matches: ctx.changes.list() }, emit) })) });

test('TG-3 shadow: every corpus case answers the same with its triggers as with every reaction hearing everything', () => {
	assert.ok(PHASES.some((p) => !PER_OP.has(p)), 'there are transaction phases to shadow');
	const differ = [];
	let planned = 0;
	for (const c of CASES) {
		const a = composeCase(c), b = composeCase(c);
		const kinds = a.options.kinds ?? PRODUCT_KINDS;
		const triggered = plan(a.model, structuredClone(c.ops), a.options);
		const shadow = plan(b.model, structuredClone(c.ops), { ...b.options, links: shadowOf(b.options.links ?? CLASSIC_LINKS, kinds) });
		planned++;
		if (JSON.stringify(triggered) !== JSON.stringify(shadow)) differ.push(c.id);
	}
	assert.equal(planned, CASES.length);
	assert.deepEqual(differ.slice(0, 8), [], `${differ.length} case(s) answer differently in shadow -- a trigger hears too little`);
});
