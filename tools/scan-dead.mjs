#!/usr/bin/env node
/*
scan-dead — H5/C1. Every exported symbol earns its existence from a real consumer.

A3 *Earned Exposure*: a concern earns an internal boundary by being one concern; it earns promotion
to a stable, depended-upon surface only when a real consumer outside its origin needs it. An export
with no consumer is a *Speculative Surface* — versioning and comprehension cost the system does not
yet owe. A3 also calls ceremony and scaffolding defects rather than neutral cost.

The scan reports three states, because "unreferenced" is not one thing:

  DEAD        no reference anywhere but its own definition
  TEST-ONLY   referenced only from tests/ — either a deliberate seam (GR4 precedent: writeDoc, now,
              flushMs exist so crash and durability tests are runnable AT ALL) or production code
              that lost its caller. The scan cannot tell those apart; a human must.
  LIVE        referenced from production

TEST-ONLY is deliberately not a failure. Collapsing it into DEAD would delete the injection seams
the test suite is built on; collapsing it into LIVE would hide code whose last real caller is gone.

ALLOW is the durable record of every judged exception, with the reason in the file. An entry with no
reason is not an exception, it is an oversight that learned to hide.

Usage: node tools/scan-dead.mjs [--verbose]
*/

import fs from 'node:fs';
import path from 'node:path';

const PROD = ['kernel', 'engine', 'document', 'app/src', 'server', 'tools', 'cli'];
const TESTS = ['tests'];
const EXT = /\.(js|mjs)$/;

// symbol -> why it has no production consumer. Reviewed at each milestone close.
const ALLOW = {
	'kernel/fixtures.mjs:FIXTURES': 'canonical reference scenes — consumed by the spec viewer and by eye, not by code',
	'kernel/adapt.mjs:schemaToDoc': 'the inverse half of the export adapter; kept with docToSchema so the pair is one concept (import is unbuilt — B31-adjacent)',
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

const prodFiles = PROD.flatMap((r) => walk(r));
const testFiles = TESTS.flatMap((r) => walk(r));
const read = (f) => fs.readFileSync(f, 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

// every exported symbol, with the file that defines it
const exported = [];
for (const f of prodFiles) {
	const t = read(f);
	for (const m of t.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let)\s+(\w+)/gm)) exported.push([f, m[1]]);
	for (const m of t.matchAll(/^export\s*\{([^}]*)\}/gm)) {
		for (const raw of m[1].split(',')) {
			const n = raw.trim().split(/\s+as\s+/).pop().trim();
			if (n && n !== 'default') exported.push([f, n]);
		}
	}
}

// a reference is any mention outside the defining file, plus non-definition mentions inside it
const countIn = (files, sym, self) => {
	let n = 0;
	for (const f of files) {
		const body = strip(read(f));
		const hits = [...body.matchAll(new RegExp(`\\b${sym}\\b`, 'g'))].length;
		n += (f === self) ? Math.max(0, hits - 1) : hits;   // discount the definition itself
	}
	return n;
};

const findings = [];
for (const [file, sym] of exported) {
	const prod = countIn(prodFiles, sym, file);
	const test = countIn(testFiles, sym, null);
	if (prod > 0) continue;
	findings.push({ key: `${file}:${sym}`, file, sym, prod, test, state: test > 0 ? 'TEST-ONLY' : 'DEAD' });
}

const unlisted = findings.filter((f) => !ALLOW[f.key]);
const verbose = process.argv.includes('--verbose');

if (verbose || unlisted.length) {
	for (const f of findings.sort((a, b) => a.key.localeCompare(b.key))) {
		const mark = ALLOW[f.key] ? 'allowed' : f.state;
		console.log(`  ${mark.padEnd(10)} ${f.key}${f.test ? ` (tests: ${f.test})` : ''}`);
		if (ALLOW[f.key]) console.log(`             \u2514 ${ALLOW[f.key]}`);
	}
}

// A scan that matches nothing is a false green — the roots moved or the export syntax changed.
if (exported.length === 0) {
	console.log('  \u2717 NO exports matched at all — the scan is broken, not the tree clean');
	process.exit(1);
}

console.log(`  scan-dead: ${exported.length} export(s); ${findings.length} without a production consumer, ${Object.keys(ALLOW).length} allowed`);
if (unlisted.length) {
	console.log(`\n  FAIL — ${unlisted.length} export(s) with no production consumer and no recorded reason.`);
	console.log('  Each is DELETE (via COMMIT.md §7.4), KEEP (add to ALLOW with the reason), or PROMOTE (it needs a caller).\n');
	process.exit(1);
}
console.log('  PASS — every export has a production consumer or a recorded reason\n');
