#!/usr/bin/env node
/*
mutate.mjs — break the code on purpose and report what no test noticed.

WHY THIS EXISTS, measured rather than assumed. Nine times in this project a test has been green and
wrong: it asserted something true about a thing other than the one that ships. Every one of the
seven that were ever caught was caught by mutation, by hand, because somebody remembered to try it.
Two more were never caught by anything.

The alternative that was considered and REJECTED was a scanner over test source, looking for tests
that assert on text rather than behaviour. It would have caught 2 of the 9 -- 22% -- at the cost of
an allow-list over 28 legitimate source reads, and it would have licensed the belief that the class
was handled while the dominant half went untouched (A11: mechanism against an unmeasured problem is
a defect, not a virtue). The measurement is in B108.

WHAT A SURVIVOR MEANS. A mutant that survives is a change to the code that no test objected to.
That is not automatically a defect -- the line may be unreachable, or genuinely not worth pinning --
but it is always a QUESTION, and the answer belongs in a comment beside the code rather than in
somebody's head. Two survivors in this tree are documented that way already, at the liveness check
in `engine/movers.mjs`.

WHAT IT IS NOT. Not a gate, deliberately, and not yet. A gate needs a survivor allow-list, and an
allow-list needs evidence about which survivors are acceptable -- evidence this tool exists to
gather. Making it a gate first would be deciding the answer before measuring. Revisit when there is
a month of output to read.

Usage:
  node tools/mutate.mjs <source-file> --tests <file...>   [--limit n] [--verbose]

  node tools/mutate.mjs engine/movers.mjs --tests tests/movers.test.js
*/

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
	if (argv[i].startsWith('--')) {
		const key = argv[i].slice(2);
		const vals = [];
		while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) vals.push(argv[++i]);
		flags[key] = vals.length ? vals : true;
	} else positional.push(argv[i]);
}
const target = positional[0];
if (!target) {
	console.error('usage: node tools/mutate.mjs <source-file> --tests <file...> [--limit n] [--verbose]');
	process.exit(2);
}
const tests = flags.tests === undefined || flags.tests === true ? null : [].concat(flags.tests);
if (!tests) {
	console.error('--tests is required: name the test file(s) that are supposed to cover this source.');
	console.error('Running the whole suite per mutant is possible and slow; scope it deliberately.');
	process.exit(2);
}

/*
The mutant catalogue.

Each entry is a narrow, meaningful edit -- the kind a tired author actually makes -- rather than
random noise. `skip` keeps a mutation out of contexts where it says nothing: flipping a comparison
inside a comment or a string produces a mutant that cannot fail and wastes a whole test run.
*/
const MUTATIONS = [
	{ name: 'comparison >= to >', find: />=/g, put: '>' },
	{ name: 'comparison <= to <', find: /<=/g, put: '<' },
	{ name: 'comparison > to >=', find: /([^-=<>!])>([^=>])/g, put: '$1>=$2' },
	{ name: 'comparison < to <=', find: /([^-=<>!])<([^=<])/g, put: '$1<=$2' },
	{ name: 'equality === to !==', find: /===/g, put: '!==' },
	{ name: 'equality !== to ===', find: /!==/g, put: '===' },
	{ name: 'logical && to ||', find: /&&/g, put: '||' },
	{ name: 'logical || to &&', find: /\|\|/g, put: '&&' },
	{ name: 'boolean true to false', find: /\btrue\b/g, put: 'false' },
	{ name: 'boolean false to true', find: /\bfalse\b/g, put: 'true' },
	{ name: 'arithmetic + to -', find: /([^+\s])\s\+\s([^+])/g, put: '$1 - $2' },
	{ name: 'arithmetic - to +', find: /([^-\s])\s-\s([^-])/g, put: '$1 + $2' },
	{ name: 'optional chain to plain', find: /\?\./g, put: '.' },
	{ name: 'nullish ?? to ||', find: /\?\?/g, put: '||' },
];

// Comments and string literals are stripped to a same-length mask, so an offset found in the mask
// is an offset in real code. Mutating inside prose produces a mutant nothing can catch.
function codeMask(src) {
	let out = '', i = 0, n = src.length;
	while (i < n) {
		const c = src[i], d = src[i + 1];
		if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out += ' '; i++; } continue; }
		if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const stop = e === -1 ? n : e + 2; out += ' '.repeat(stop - i); i = stop; continue; }
		if (c === '"' || c === "'" || c === '`') {
			const q = c; out += ' '; i++;
			while (i < n && src[i] !== q) { if (src[i] === '\\') { out += '  '; i += 2; continue; } out += ' '; i++; }
			if (i < n) { out += ' '; i++; }
			continue;
		}
		out += c; i++;
	}
	return out;
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const original = fs.readFileSync(target, 'utf8');
const originalHash = sha(original);
const mask = codeMask(original);

// build the mutant list from the MASK, apply to the real source at the same offsets
const mutants = [];
for (const m of MUTATIONS) {
	for (const hit of mask.matchAll(m.find)) {
		const at = hit.index;
		const before = original.slice(0, at);
		const matched = original.slice(at, at + hit[0].length);
		const replaced = matched.replace(new RegExp(m.find.source), m.put);
		if (replaced === matched) continue;
		mutants.push({ name: m.name, at, line: before.split('\n').length,
			src: before + replaced + original.slice(at + hit[0].length) });
	}
}
mutants.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
const limit = flags.limit ? Number([].concat(flags.limit)[0]) : mutants.length;
const run = mutants.slice(0, limit);

/*
RESTORE IS STRUCTURAL, not remembered.

Doing this by hand cost this tree two corrupted files in one session: a mutation was applied, the
restore was skipped or applied to a stale backup, and edits stacked. So the original is held in
memory, written back in a `finally`, and its hash re-checked afterwards. If the hash ever fails to
match, the tool says so loudly and exits non-zero -- a silent bad restore is the one outcome worse
than finding nothing.
*/
let survived = [], killed = 0, errored = 0;
process.on('exit', () => {
	if (sha(fs.readFileSync(target, 'utf8')) !== originalHash) {
		fs.writeFileSync(target, original);
		console.error(`\n  !! ${target} was left mutated and has been restored from memory`);
	}
});

console.log(`  ${target}: ${mutants.length} mutant(s)${limit < mutants.length ? `, running ${limit}` : ''} against ${tests.join(' ')}`);
try {
	for (const [i, mut] of run.entries()) {
		fs.writeFileSync(target, mut.src);
		let caught = false, broke = false;
		try {
			execFileSync('node', ['--test', ...tests], { stdio: 'pipe', timeout: 120000 });
		} catch (e) {
			// a non-zero exit is a test failure -- the mutant was CAUGHT, which is the good case
			caught = true;
			if (/SyntaxError|Cannot find module/.test(String(e.stdout) + String(e.stderr))) broke = true;
		}
		fs.writeFileSync(target, original);
		if (broke) { errored++; continue; }          // an unparseable mutant proves nothing
		if (caught) { killed++; if (flags.verbose) console.log(`    killed   ${target}:${mut.line}  ${mut.name}`); }
		else { survived.push(mut); console.log(`    SURVIVED ${target}:${mut.line}  ${mut.name}`); }
		if (!flags.verbose && (i + 1) % 20 === 0) process.stdout.write(`    ...${i + 1}/${run.length}\n`);
	}
} finally {
	fs.writeFileSync(target, original);
}

const after = sha(fs.readFileSync(target, 'utf8'));
if (after !== originalHash) { console.error(`  RESTORE FAILED for ${target}`); process.exit(3); }

const scored = killed + survived.length;
console.log(`\n  ${killed} killed, ${survived.length} survived, ${errored} unparseable (not scored)`);
console.log(`  ${scored ? Math.round((killed / scored) * 100) : 0}% of scorable mutants were caught; ${target} restored and verified`);
if (survived.length) {
	console.log('\n  A survivor is a QUESTION, not automatically a defect. Either a test is missing, or the');
	console.log('  line is unreachable and should SAY so beside itself -- the way engine/movers.mjs does.');
}
process.exit(survived.length ? 1 : 0);
