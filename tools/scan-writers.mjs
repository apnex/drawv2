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

/*
B44 — the command boundary. Every committed action must come from a builder in commands.js.

Same argument as the one-writer rule above, one level up. A hand-built command is an out-of-band
write into the HISTORY pipeline: it looks correct at the call site and is wrong only in what it
omits. Both drifts found in H6.2 were of that kind and neither was detectable by running the code —
four commands carried a dead `before` the wire discards, and two aliased the live store through a
shallow spread because `via` is COMPOSITE. commands.js STATED both rules at the top of the file the
whole time. A stated invariant with no check is a comment, and this is what makes it a rule.
*/
// A { label, entries } literal, however wrapped — including the SHORTHAND form `{ label, entries }`,
// which the first draft missed: commitRoute built its entries into a local and passed it by
// shorthand, so it read as a builder call and was not one. Verified by counting against pre-fix HEAD.
const HANDBUILT = /\blabel\s*:[\s\S]{0,140}?\bentries\s*[:,}\]]/g;
/*
`before` as a key IN A COMMAND ENTRY — an object literal that also carries `op:`.

This was blunt (any `before:` in the file at all) and the justification was that commands.js has no
legitimate use for one. That did not survive contact: H6.9 moved `nudgeSelection` here, and it builds
a local `{kind, id, before}` list because that is `clampDelta`'s parameter contract in snap.js. The
blunt rule flagged it, correctly by its own letter and wrongly by its intent.

So the rule now says what the invariant actually is: `before` inside a literal that also carries
`op:` is an entry holding a pre-state the wire discards; `before` anywhere else is a local working
value and none of this rule's business.

Brace-matched rather than pattern-matched, and that was not the first choice. A regex pairing the two
keys cannot work: an entry's `before` value is itself an object, so `[^{}]*` between the keys fails
the moment the real shape appears — verified by injecting both key orders and watching one of them
sail through. Walking out to the enclosing literal is a few more lines and is simply correct.
*/
const entriesCarryingBefore = (text) => {
	const out = [];
	for (const m of text.matchAll(/\bop\s*:/g)) {
		let i = m.index, depth = 0;
		while (i > 0 && !(text[i] === '{' && depth === 0)) {      // out to this literal's `{`
			if (text[i] === '}') depth++;
			else if (text[i] === '{') depth--;
			i--;
		}
		let j = i, d = 0;
		do {                                                       // and forward to its `}`
			if (text[j] === '{') d++;
			else if (text[j] === '}') d--;
			j++;
		} while (d > 0 && j < text.length);
		const literal = text.slice(i, j);
		if (/\bbefore\s*:/.test(literal)) {
			out.push({ line: text.slice(0, m.index).split('\n').length, text: literal.replace(/\s+/g, ' ').slice(0, 90) });
		}
	}
	return out;
};
const CLIENT_ROOT = 'app/src';
const BUILDER = 'app/src/commands.js';

/*
B45 / GR17 — the DOM stays where the DOM belongs.

A GLOBAL reach: bare `document.` or `window.`, not `this.window` (Changes' coalescing window) and not
the word in a comment. Reaching an INJECTED element is fine and common — `renderer.js` is built
entirely on an `svg` it was handed, and reads as DOM-heavy to a naive grep while being perfectly
composable. What is sealed here is the difference between the two.

Allowed by FILE and not by count, unlike the model rules above, and the difference is deliberate. A
model mutation is a discrete hazard, so each one is worth counting. Here the hazard is a LAYER losing
its purity — palette.js building its ninth element is not a new risk, whereas snap.js building its
first is. Counting main.js's churn would add friction and catch nothing.

Measured 2026-08-19: 14 of 18 client modules reach zero DOM globals, including every unit H6
extracted. Those 14 are the asset; this rule exists so a fifteenth cannot quietly become a fourth.
*/
const DOM_GLOBAL = /(?<![.\w$])(document|window)\s*\./g;
const DOM_ALLOW = new Set([
	'app/src/main.js',       // the composition root — it OWNS the page
	'app/src/painter.js',    // the DOM helper every other module goes through
	'app/src/palette.js',    // builds and owns the palette widget
	'app/src/labeledit.js',  // builds and owns the inline editor
]);

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

// the command-boundary rule (B44), scanned over the client
let handbuilt = 0;
let builders = 0;
let domReaches = 0;
let domFree = 0;
for (const file of walk(CLIENT_ROOT)) {
	const text = decomment(fs.readFileSync(file, 'utf8'));
	const isBuilder = file.replace(/\\/g, '/') === BUILDER;
	if (isBuilder) {
		builders = (text.match(/^export function /gm) || []).length;
		const stale = entriesCarryingBefore(text);
		if (stale.length) {
			bad++;
			console.log(`  \u2717 ${file}: ${stale.length} entr(ies) carry \`before\` — changes.js drops it; the server derives the inverse`);
			stale.forEach((x) => console.log(`      :${x.line}  ${x.text.trim()}`));
		}
	}
	// the builder file is exempt from the hand-built rule ONLY — it is still held to the DOM and
	// gesture-state rules below, which an early `continue` here quietly skipped
	const h = isBuilder ? [] : hits(text, HANDBUILT);
	if (h.length) {
		handbuilt += h.length;
		bad++;
		console.log(`  \u2717 ${file}: ${h.length} hand-built command(s) — add a builder to ${BUILDER} instead`);
		h.forEach((x) => console.log(`      :${x.line}  ${x.text.trim()}`));
	}

	// GR17 — DOM globals, allowed by file
	const rel = file.replace(/\\/g, '/');
	const d = hits(text, DOM_GLOBAL);
	if (d.length) {
		if (DOM_ALLOW.has(rel)) {
			domReaches += d.length;
		} else {
			bad++;
			console.log(`  \u2717 ${rel}: ${d.length} DOM global(s) — inject the element or the host surface instead (B45)`);
			d.forEach((x) => console.log(`      :${x.line}  ${x.text.trim()}`));
		}
	} else if (!DOM_ALLOW.has(rel)) {
		domFree++;
	}

	// H6.5 — Input's gesture state is Input's. Same rule already held over tests/; the reason is the
	// same and the blast radius is larger, because a peer module reading `mode` re-creates the God
	// Object by reference. `this.mode` (renderer's view mode) and `editing.mode` are different
	// concepts and deliberately do not match.
	if (rel !== 'app/src/input.js') {
		const g = hits(text, INTERNALS);
		if (g.length) {
			bad++;
			internals += g.length;
			console.log(`  \u2717 ${rel}: ${g.length} read(s) of Input's gesture state — it is sovereign to how a gesture was produced (D4)`);
			g.forEach((x) => console.log(`      :${x.line}  ${x.text.trim()}`));
		}
	}
}
if (domReaches === 0) {
	console.log(`  \u2717 NO DOM globals matched in ${[...DOM_ALLOW].join(', ')} — the scan is broken, not the tree clean`);
	bad++;
}
if (builders === 0) {
	console.log(`  \u2717 NO builders found in ${BUILDER} — the scan is broken, not the tree clean`);
	bad++;
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

console.log(`  scan-writers: ${mutations} mutation(s), ${loads} load(s), ${reaches} store-internal reach(es) across ${ROOTS.join('/')}; ${internals} client-internal read(s) in ${TEST_ROOT}/; ${handbuilt} hand-built command(s) against ${builders} builders; ${domFree} DOM-free client module(s), ${domReaches} reach(es) in the ${DOM_ALLOW.size} that own the page`);
if (bad) {
	console.log(`\n  FAIL — ${bad} violation(s) above. This scanner holds four boundaries, and each fails silently at
  runtime rather than loudly: an out-of-band model write corrupts every stored inverse below it; a
  hand-built command omits what the builder would have supplied; a DOM global welds a module to the
  page it happens to run in; and a peer reading Input's gesture state rebuilds the God Object by
  reference. None of these throw. That is why they are caught here.\n`);
	process.exit(1);
}
console.log('  PASS — one writer (model/ops.mjs#applyOps); load confined to Store.install + plan(); store internals unreached\n');
