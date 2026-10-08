// P5 V-d (H18.28; PL-6, ruled PD-5) -- ONE PREVIEW: the browser plans its own view with the planner the server runs, sends only
// what the author did, and keeps no copy of a planner rule. dev/design/unification/PAGE-COMPOSES-NETWORK.md, stage V-d.

import { makeLink } from '../network/link-queries.mjs';   // K13d: the network's link queries
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, record } from './fixtures/gesture-corpus.mjs';
import { Model, plan } from './fixtures/composed.mjs';
import { derivedToApply, applyAnswer } from '../app/src/changes.js';
import { applyOps } from '../model/ops.mjs';
import { makeInput, key, seedNodes } from './fixtures/client-harness.mjs';
import { makeWaypoint } from '../devices/make-node.mjs';   // O-e1: the devices plugin's factories

const entities = (m) => { const d = m.toJSON(); return JSON.stringify(['nodes', 'links', 'zones', 'groups', 'pipes'].map((k) => [...(d[k] || [])].sort((a, b) => (a.id < b.id ? -1 : 1)))); };

/*
PL6 (PLANNER-SYSTEM.md section 7) -- "for every request, the browser's optimistic result equals the server's answer". Every
gesture corpus scenario is driven through the real Input, and an AUTHORITY model plays the server: it starts from the tab's
board at the first commit and from then on is changed only by planning what the tab SENT. After each commit the tab's
preview must equal the authority's answer, entity for entity -- and the answer, reconciled against what the tab applied,
must change nothing. Compared as documents, not op lists: a waypoint `w` places live is in the tab before the commit, so the
preview plans no put for it while the server does, and the two documents agree.
*/
test('PL6: on every gesture corpus commit, the tab\'s preview equals the server\'s answer, and the answer changes nothing', () => {
	let commits = 0, refusedBoth = 0;
	const differs = [];
	for (const s of SCENARIOS) {
		let authority = null, pre = null;
		record(s, { withHarness: (h) => {
			const orig = h.history.applyLocally.bind(h.history);
			h.history.applyLocally = (ops) => { pre = h.model.toJSON(); return orig(ops); };
			h.history.onCommit((req) => {
				if (req.verb) return;
				commits++;
				if (!authority) { authority = new Model(); authority.load(pre); }
				const r = plan(authority, req.ops);
				if (!r.ok) {
					if (req.applied.length) differs.push(`${s.id} ${req.label}: the server refused what the tab showed -- ${r.error}`);
					else refusedBoth++;
					return;
				}
				applyOps(authority, r.ops);
				if (entities(h.model) !== entities(authority)) differs.push(`${s.id} ${req.label}: the preview is not the answer`);
				applyAnswer(h.model, h.selection, derivedToApply(req.applied, r.ops, []));
				if (entities(h.model) !== entities(authority)) differs.push(`${s.id} ${req.label}: reconciling the answer moved the tab off it`);
			});
		} });
	}
	assert.deepEqual(differs, []);
	assert.ok(commits >= 50, `the corpus must actually commit, it committed ${commits}`);
	assert.ok(refusedBoth >= 1, 'and some of it is refused, by the preview and the server alike -- so a refusal is compared too');
});

test('V-d: the browser keeps no copy of a planner rule -- the builders send intent, and the canvas reaches no planner primitive', async () => {
	const fs = await import('node:fs');
	const src = fs.readFileSync(new URL('../app/src/commands.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../app/src/input.js', import.meta.url), 'utf8');
	for (const rule of ['groupAfterRemoval', 'splitAtBend', 'collapseAtWaypoint', 'violations']) {
		assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), new RegExp(`\\b${rule}\\b`), `the canvas uses ${rule}, a copy of the planner's rule`);
	}
});

test('V-d: a refused preview shows nothing and still sends the intent -- the server decides', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [360, 0]]);
		h.model.put('link', makeLink(h.model, a.id, b.id));
		const before = entities(h.model);
		// a second straight link on the pair: the planner refuses it (B81)
		h.history.commit({ label: 'link', entries: [{ op: 'put', kind: 'link', entity: makeLink(h.model, b.id, a.id) }] });
		assert.equal(entities(h.model), before, 'the tab shows nothing');
		assert.deepEqual([h.soleCommit().ops.length, h.soleCommit().applied], [1, []], 'and sends the intent, with nothing applied');
	} finally { h.restore(); }
});

/*
B221 -- a deleted link painted the wrong waypoint role for one round trip: the join that follows runs in the planner, so the tab
drew two terminations and an endpoint ring until the answer came. With the preview, the join is the tab's at once.
*/
test('B221: deleting the third link at a waypoint shows the other two joined at once, before any answer', () => {
	const h = makeInput();
	try {
		const [a, b, c] = seedNodes(h.model, [[-360, 0], [360, 0], [0, 240]]);
		const w = makeWaypoint(h.model, { x: 0, y: 0 });
		h.model.put('node', w);
		const l1 = makeLink(h.model, a.id, w.id), l2 = makeLink(h.model, w.id, b.id), l3 = makeLink(h.model, c.id, w.id);
		for (const l of [l1, l2, l3]) h.model.put('link', l);
		h.selection.set([l3.id]);
		h.capture.onKeyDown(key('Delete'));
		assert.deepEqual(h.soleCommit().ops, [{ op: 'del', kind: 'link', id: l3.id }], 'the request is the delete');
		const links = h.model.all('link');
		assert.equal(links.length, 1, 'the two left at the waypoint joined in the tab, at once');
		assert.deepEqual([links[0].src, links[0].via, links[0].dst], [a.id, [w.id], b.id]);
	} finally { h.restore(); }
});
