#!/usr/bin/env node
/*
scan-twins — H5/C2. Two functions must not own the same arithmetic.

A3 *Law of One* and the "one definition site per symbol" rule: shared logic gets one home and is
imported, never copied. The failure this catches is silent — two copies agree on the day they are
written and drift on some later day, and nothing fails at the moment of divergence.

WHY SET-SIMILARITY AND NOT A CONTIGUOUS-WINDOW SCAN. A 6-line sliding-window duplicate detector over
this tree finds *nothing* — measured, zero hits. The duplication here is INTERLEAVED: the shared
arithmetic is spread through emission code that legitimately differs (live DOM vs an SVG string), so
no contiguous run repeats. Only comparing functions as SETS of normalised lines finds it. That is a
property of this codebase, not a general truth, and it is why the obvious detector was the wrong one.

Calibration: across 203 functions this reports exactly ONE pair above the threshold. The tree is not
full of copy-paste; it has one genuine shared-arithmetic pair (B40). A rising count is the signal.

Usage: node tools/scan-twins.mjs [--verbose]
*/

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['kernel', 'engine', 'model', 'app/src', 'server'];
const EXT = /\.(js|mjs)$/;
const THRESHOLD = 0.25;      // Jaccard over normalised, comment-free lines
const MIN_LINES = 6;         // below this, similarity is noise

// a top-level function/const, or a class method at exactly one tab with its brace on the same line
const DECL = /^(?:export\s+)?(?:async\s+)?(?:function|const)\s+(\w+)|^\t([a-zA-Z#]\w*)\s*\([^)]*\)\s*\{\s*$/;
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'do', 'try']);

// pair -> why the shared lines are permitted to stay. Reviewed at each milestone close.
const ALLOW = {
	// Empty, and that is the point: the tree's one twin (B40) was extracted at H5.6 rather than
	// excused. An ALLOW entry is a standing exception, so it should be rare and it should shrink.
};

function walk(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (EXT.test(e.name)) out.push(p);
	}
	return out;
}

// functions as sets of normalised lines: comments stripped, whitespace removed, trivia dropped
function functionsOf(file) {
	const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	const out = [];
	let name = null, lines = [];
	const flush = () => { if (name && lines.length >= MIN_LINES) out.push({ name, lines: new Set(lines) }); };
	for (const raw of text.split('\n')) {
		const decl = raw.match(DECL);
		// `if (`, `for (`, `while (` and friends look exactly like a one-tab method declaration.
		// Treating them as one splits a function mid-body: `contentDom` captured 8 lines instead of
		// 26 and its known twin scored 23%, just under the threshold, so the scanner reported a
		// clean tree while the one real duplicate sat in front of it. Found by injecting a copy and
		// watching nothing happen (X13) — a scanner that cannot be shown to bite is not a scanner.
		if (decl && !KEYWORDS.has(decl[1] || decl[2])) { flush(); name = decl[1] || decl[2]; lines = []; }
		const norm = raw.replace(/\/\/.*/, '').replace(/\s+/g, '');
		if (name && norm.length > 10) lines.push(norm);
	}
	flush();
	return out;
}

const files = ROOTS.flatMap((r) => walk(r));
const all = files.flatMap((f) => functionsOf(f).map((fn) => ({ file: f, ...fn })));

const pairs = [];
for (let i = 0; i < all.length; i++) {
	for (let j = i + 1; j < all.length; j++) {
		const a = all[i], b = all[j];
		if (a.file === b.file) continue;                       // within a file, sharing is local and visible
		let shared = 0;
		for (const l of a.lines) if (b.lines.has(l)) shared++;
		const jac = shared / (a.lines.size + b.lines.size - shared);
		if (jac >= THRESHOLD) {
			const key = [`${a.file}:${a.name}`, `${b.file}:${b.name}`].sort().join(' <-> ');
			pairs.push({ key, jac, shared });
		}
	}
}

const unlisted = pairs.filter((p) => !ALLOW[p.key]);
if (process.argv.includes('--verbose') || unlisted.length) {
	for (const p of pairs.sort((x, y) => y.jac - x.jac)) {
		console.log(`  ${ALLOW[p.key] ? 'allowed' : 'TWIN   '}  ${(p.jac * 100).toFixed(0)}% (${p.shared} shared lines)  ${p.key}`);
		if (ALLOW[p.key]) console.log(`             \u2514 ${ALLOW[p.key]}`);
	}
}

if (all.length === 0) {
	console.log('  \u2717 NO functions matched at all — the scan is broken, not the tree clean');
	process.exit(1);
}

console.log(`  scan-twins: ${all.length} function(s) compared; ${pairs.length} pair(s) \u2265${THRESHOLD * 100}%, ${Object.keys(ALLOW).length} allowed`);
if (unlisted.length) {
	console.log(`\n  FAIL — ${unlisted.length} undeclared twin(s). Extract the shared logic, or record why two owners are correct.\n`);
	process.exit(1);
}
console.log('  PASS — no undeclared shared arithmetic\n');
