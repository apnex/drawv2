#!/usr/bin/env node
/*
scan-writers — GR3. The executable form of I2: ONE writer.

Why a source scan and not a runtime assertion: an out-of-band write corrupts every stored inverse
BELOW it, and it does so silently. Undo replays inverses without revalidating — it has to, because
an inverse is derived from a pre-state that no longer exists — so a `model.put` outside the planner
produces no error at the time of corruption and no error at the time of undo. It produces a wrong
document, later, with nothing to point at. That failure has to be caught in the source or not at all.

The allow-list is by FILE AND COUNT, not by pattern. A count is what catches the case the pattern
misses: a SECOND load appearing inside a file that legitimately has one.

  model/ops.mjs      put/set/del   the sole mutation point (applyOps)
  server/store.js    load x1       Store.install — the whole-document entry
  server/txn.mjs     load x1       plan()'s scratch projection: a THROWAWAY Model that never
                                   escapes the planner, which is how "reject writes nothing"
                                   holds by purity rather than by rollback

That second load is a real second caller. The spec says "no module other than Store.install calls
model.load"; the planner does, on a Model it constructs and discards. Allow-listing it explicitly
is honest — silently having two is how an invariant becomes decorative.

Usage: node tools/scan-writers.mjs
*/

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['server', 'model'];
const EXT = /\.(js|mjs)$/;

// Receivers that are Models in this tree. `del` is Model-only (a Map deletes with `delete`), so it
// is matched on any receiver; put/set/del are matched on known Model-typed names.
const MUTATE = /\b(?:this\.)?(?:model|scratch|proj|entry\.model)\.(put|set|del)\s*\(/g;
const LOAD = /\b(?:this\.)?(?:model|scratch|proj|entry\.model)\.load\s*\(/g;

/*
B15 / A3 `Air-Gap` — nobody reaches into Store's private diagram Map.

`store.diagrams` is an implementation detail. Ten sites in protocol.js and rest.js walked into it
to read `.log` and `.dirty`, and each then re-derived the durability rule for itself — three sites,
three different spellings, only one null-guarded. That divergence IS B15: a rule with no home gets
re-remembered, and re-remembered wrong. Store now owns `log(id)` and `durableVersion(id)`.

Scanned as source because the boundary is only violated at author time and the violation is
invisible at runtime — the code works, it just re-implements a rule it does not own.
*/
const REACH = /\bdiagrams\.get\s*\(/g;

/*
H2.1 / H6 — the harness must stay a NET, not become a TAX.

Tests over the client assert at the commit boundary: "this input emits these ops". `Changes.onCommit`
is sovereign to how a gesture was produced (D4), so those assertions survive H6's decomposition
untouched — including H6.4, which rewrites onDown/onMove/onUp into a gesture table. A test reading
`input.mode` or `input.ctx` would break there, and the net built to ENABLE the refactor would become
the thing that makes it expensive. That is precisely how a harness ends up ratifying the God Object
it was written to remove.

Cheap to hold now (no test reads them), expensive to retrofit later — so it is held now.
*/
const INTERNALS = /\b(?:input|inp|h\.input)\.(mode|ctx)\b/g;
const TEST_ROOT = 'tests';

// file -> { mutate: <exact count or null for "any">, load: <exact count> }
const ALLOW = {
	'model/ops.mjs': { mutate: null, load: 0, reach: 0 },
	'server/store.js': { mutate: 0, load: 1, reach: null },   // it owns the Map
	'server/txn.mjs': { mutate: 0, load: 1, reach: 0 },
};

function walk(dir, out = []) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (EXT.test(e.name)) out.push(p);
	}
	return out;
}

// Blank out comments before matching, preserving line numbers. Without this the INTERNALS rule
// flags the comments that EXPLAIN the rule — which it did, immediately, on its first run.
const decomment = (text) => text
	.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
	.replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

const hits = (text, re) => {
	const out = [];
	for (const m of text.matchAll(re)) {
		out.push({ line: text.slice(0, m.index).split('\n').length, text: m[0] });
	}
	return out;
};

let bad = 0;
let mutations = 0;
let loads = 0;
let reaches = 0;

// the client-internals rule, scanned over tests/ only
let internals = 0;
for (const file of walk(TEST_ROOT)) {
	const h = hits(decomment(fs.readFileSync(file, 'utf8')), INTERNALS);
	if (!h.length) continue;
	internals += h.length;
	bad++;
	console.log(`  \u2717 ${file}: ${h.length} read(s) of client gesture internals — assert at the commit boundary instead`);
	h.forEach((x) => console.log(`      :${x.line}  ${x.text.trim()}`));
}

for (const file of ROOTS.flatMap((r) => walk(r))) {
	const text = fs.readFileSync(file, 'utf8');
	const allow = ALLOW[file] ?? { mutate: 0, load: 0, reach: 0 };
	const m = hits(text, MUTATE);
	const l = hits(text, LOAD);
	const r = hits(text, REACH);
	mutations += m.length;
	loads += l.length;
	reaches += r.length;

	if (allow.reach !== null && r.length !== allow.reach) {
		bad++;
		console.log(`  \u2717 ${file}: ${r.length} reach(es) into store.diagrams, allowed ${allow.reach} — use Store.log(id) / Store.durableVersion(id)`);
		r.forEach((h) => console.log(`      :${h.line}  ${h.text.trim()}`));
	}

	if (allow.mutate !== null && m.length !== allow.mutate) {
		bad++;
		console.log(`  ✗ ${file}: ${m.length} model mutation(s), allowed ${allow.mutate}`);
		m.forEach((h) => console.log(`      :${h.line}  ${h.text.trim()}`));
	}
	if (l.length !== allow.load) {
		bad++;
		console.log(`  ✗ ${file}: ${l.length} model.load call(s), allowed ${allow.load}`);
		l.forEach((h) => console.log(`      :${h.line}  ${h.text.trim()}`));
	}
}

// A scan that matched nothing is a false green — the roots moved, or a rename made the receiver
// patterns stale. The tree HAS writers; finding none means the scan is broken, not the code clean.
if (mutations === 0) {
	console.log('  ✗ NO model mutations matched at all — the scan is broken, not the tree clean');
	bad++;
}
if (loads === 0) {
	console.log('  ✗ NO model.load calls matched at all — the scan is broken, not the tree clean');
	bad++;
}

if (reaches === 0) {
	console.log('  \u2717 NO store.diagrams access matched at all — the scan is broken, not the tree clean');
	bad++;
}

console.log(`  scan-writers: ${mutations} mutation(s), ${loads} load(s), ${reaches} store-internal reach(es) across ${ROOTS.join('/')}; ${internals} client-internal read(s) in ${TEST_ROOT}/`);
if (bad) {
	console.log(`\n  FAIL — ${bad} allow-list violation(s). An out-of-band write corrupts every stored inverse below it, silently.\n`);
	process.exit(1);
}
console.log('  PASS — one writer (model/ops.mjs#applyOps); load confined to Store.install + plan(); store internals unreached\n');
