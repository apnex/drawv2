#!/usr/bin/env node
/*
scan-skips -- B250 (F-SKIP): a skipped test is a test that did not run, and in CI that must fail the gate.

The browser suites -- the product page (tests/browser.test.js), the lab's behaviour matrix (tests/lab-browser.test.js)
and the route oracle -- skip with a reason when no Chrome is on PATH. That is right on a machine that cannot run them
and wrong as the record: if CI's image lost Chrome, the lab's whole evidence base would stop running and the run would
still be green, reporting `# skipped 84` to nobody. Nothing asserted the count; the second H17 M7 pass read it by hand.

`npm test` writes a TAP record beside its console output (package.json). This reads it: every test that skipped or is
marked todo is named, with its reason. Under CI (`CI` set, as GitHub Actions sets it) any such test fails the gate.
Locally it warns and passes, because a developer machine is not the record, and the pre-push hook should not refuse a
push for a browser the machine lacks while CI holds the line.

Usage: node tools/scan-skips.mjs [record.tap] [--strict]
*/
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// every skipped or todo test in a TAP record: `ok 3 - name # SKIP reason`, at any nesting depth
export function skipsIn(tap) {
	const out = [];
	for (const line of tap.split('\n')) {
		const m = line.match(/^\s*(?:not )?ok \d+ - (.*?) # (SKIP|TODO)\b ?(.*)$/i);
		if (m) out.push({ name: m[1].trim(), kind: m[2].toUpperCase(), reason: m[3].trim() });
	}
	return out;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
	const args = process.argv.slice(2);
	const strict = args.includes('--strict') || !!process.env.CI;
	const file = path.resolve(root, args.find((a) => !a.startsWith('--')) ?? '.test-results.tap');
	if (!fs.existsSync(file)) {
		console.error(`scan-skips: FAIL -- no test record at ${path.relative(root, file)}; run \`npm test\`, which writes it`);
		process.exit(1);
	}
	const skips = skipsIn(fs.readFileSync(file, 'utf8'));
	if (!skips.length) {
		console.log('scan-skips: PASS -- every test ran: none skipped, none todo');
		process.exit(0);
	}
	const by = new Map();
	for (const s of skips) by.set(s.reason || '(no reason)', [...(by.get(s.reason || '(no reason)') ?? []), s]);
	for (const [reason, list] of by) {
		console.log(`  ${list.length} ${list[0].kind === 'TODO' ? 'todo' : 'skipped'} -- ${reason}`);
		for (const s of list.slice(0, 5)) console.log(`      ${s.name}`);
		if (list.length > 5) console.log(`      ... and ${list.length - 5} more`);
	}
	if (strict) {
		console.error(`scan-skips: FAIL -- ${skips.length} test(s) did not run. In CI a skip is a test that silently stopped proving anything (B250).`);
		process.exit(1);
	}
	console.log(`scan-skips: WARN -- ${skips.length} test(s) did not run on this machine; CI fails on any (B250)`);
}
