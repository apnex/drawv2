#!/usr/bin/env node
/*
scan-docstyle - B51 / H7.4. The documentation is held to the mission-kit style rules, by machine.

Until this existed the rules were real and the enforcement was not. S6, S8, S10, S12 and S13 were
run by hand, from memory, on whichever files an author happened to think of. That is how B50 landed
in the first place: a README rewritten to miss S4, caught by a person reading it rather than by the
gate. A rule nobody runs is a preference.

The five enforcers are NOT vendored. They belong to mission-kit and duplicating them here would give
a rule with one owner two definitions that drift apart -- the twin problem S3 argues against and P3
exists to prevent. This scanner locates them and runs them; it owns no rule of its own.

RESOLUTION ORDER, and why it fails loudly rather than skipping:

  $MISSION_KIT        explicit, and what CI sets after cloning
  ~/taceng/mission-kit    the working checkout on a developer machine
  ../mission-kit      a sibling checkout, the conventional layout

A scanner that cannot find its tools EXITS NON-ZERO. Skipping with a warning is how a check becomes
decorative, which is the defect class this repo has spent the most time closing (B122, B128, B88).
If the rules cannot be checked, the gate has not passed -- it has not run.

CLONED AT HEAD, by the director's ruling, and the consequence is accepted deliberately: a change to
mission-kit can turn this repo red with no commit here. The alternative was a pinned SHA, which
trades that for rules that silently go stale. The ruling took currency over insulation, so a red
gate after an upstream change is the mechanism working, not a failure -- and the report below names
the resolved tools directory precisely so that diagnosis takes seconds.
*/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const rootArg = process.argv.indexOf('--root');
const ROOT = rootArg > -1 ? process.argv[rootArg + 1] : '.';

const CANDIDATES = [
	process.env.MISSION_KIT,
	path.join(os.homedir(), 'taceng/mission-kit'),
	path.resolve(ROOT, '../mission-kit'),
].filter(Boolean);

const kit = CANDIDATES.find((d) => fs.existsSync(path.join(d, 'tools/s13-plain-ascii.sh')));
if (!kit) {
	console.log('  \u2717 scan-docstyle: no mission-kit checkout found. Looked in:');
	for (const c of CANDIDATES) console.log(`      ${c}`);
	console.log('\n  Set MISSION_KIT, or clone https://github.com/apnex/mission-kit.git beside this repo.');
	console.log('  This does NOT skip: an unenforceable rule is the defect, not the excuse.');
	process.exit(1);
}

/*
The file set is every tracked markdown document under docs/, plus the README.

README is included because B50 WAS the README, and excluding the file that produced the row would
be the narrower-than-its-claim shape all over again. B97 rules that S4's four-journey structure does
not bind it; that is a different rule from these five, and none of them is S4.
*/
const docs = [];
const walk = (d) => {
	if (!fs.existsSync(d)) return;
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) walk(p);
		else if (e.name.endsWith('.md')) docs.push(p);
	}
};
walk(path.join(ROOT, 'docs'));
const readme = path.join(ROOT, 'README.md');
if (fs.existsSync(readme)) docs.push(readme);
docs.sort();

// One entry per rule, so a failure names the rule rather than "the style check".
const RULES = [
	['S6', ['node', path.join(kit, 'tools/s6-one-sentence-per-line.mjs'), '--check']],
	['S8', ['bash', path.join(kit, 'tools/s8-code-block-comments.sh')]],
	['S10', ['bash', path.join(kit, 'tools/s10-section-rules.sh')]],
	['S12', ['bash', path.join(kit, 'tools/s12-code-block-introducer.sh')]],
	['S13', ['bash', path.join(kit, 'tools/s13-plain-ascii.sh')]],
];

let bad = 0;
let findings = 0;
for (const [rule, [bin, ...args]] of RULES) {
	let out = '';
	try {
		out = execFileSync(bin, [...args, ...docs], { encoding: 'utf8', cwd: ROOT });
	} catch (e) {
		out = (e.stdout || '') + (e.stderr || '');
	}
	const fails = out.split('\n').filter((l) => l.includes('FAIL'));
	if (!fails.length) continue;
	bad++;
	findings += fails.length;
	console.log(`  \u2717 ${rule}: ${fails.length} finding(s)`);
	for (const f of fails.slice(0, 12)) console.log(`      ${f.trim()}`);
	if (fails.length > 12) console.log(`      ... and ${fails.length - 12} more`);
}

/*
A floor, for the reason every other scanner here has one.

If the document set is empty the five rules all pass and the scanner reports a clean tree it never
read. That is the exact failure R12 shipped with and B149 recorded: a check green by vacuity. The
tools directory is named on every run so that an upstream change -- which HEAD makes possible on any
day, by ruling -- is diagnosable from the gate output alone.
*/
if (!docs.length) {
	console.log('  \u2717 scan-docstyle: NO markdown documents found — the scan is broken, not the tree clean');
	process.exit(1);
}

console.log(`  scan-docstyle: ${docs.length} document(s) against ${RULES.length} rules (S6, S8, S10, S12, S13), tools at ${kit}`);
if (bad) {
	console.log(`\nFAIL — ${findings} finding(s) across ${bad} rule(s). These rules have ONE owner, mission-kit,`);
	console.log('and are run rather than copied. Most carry a --fix; run the named tool directly to apply it.');
	process.exit(1);
}
console.log('PASS — the documentation conforms to the mission-kit style rules it claims to follow');
