/*
H31-6 (dev/DECISIONS.md) -- moved from tests/gate.test.js into a file of its own: it reads scan-dead's source and runs it over the code,
no record, so a push of records alone cannot change its verdict, and the records gate does not run it; the full gate does.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

/*
GR15/B62 -- an export earns its existence from a consumer OUTSIDE its origin.

scan-dead's header has always said "a real consumer outside its origin"; its arithmetic discounted
one occurrence in the origin file and counted the rest, so ANY internal use satisfied the check.
Eighteen exports were passing on their own internal references, and the symbol that exposed it was
passing on four words in its own error message.

Driven over fixtures rather than the real tree: asserting the tree is clean proves the scanner
agrees with today's code, not that it can tell the two cases apart.
*/
test('GR15/B62: an internal use does not earn an export, and prose never does', () => {
	const src = fs.readFileSync(path.join(root, 'tools/scan-dead.mjs'), 'utf8');

	// the origin file is excluded outright, not discounted
	assert.ok(/if \(f === self\) continue;/.test(src),
		'the origin file must be skipped; `hits - 1` counts internal use as consumption');
	assert.ok(!/Math\.max\(0, hits - 1\)/.test(src), 'the discount arithmetic is gone');

	// strings are stripped, so a symbol named in its own error message proves nothing
	for (const quote of ["'", '"', '`']) {
		assert.ok(src.includes(`${quote}(?:[^${quote}`) || src.includes('\\`(?:[^\\`'),
			`string literals in ${quote} quotes are stripped before counting`);
	}

	// and a stale exemption is surfaced rather than sitting silently
	assert.ok(/stale-allow/.test(src),
		'an ALLOW whose finding has gone must be reported, or it covers a future regression');

	const out = execFileSync('node', ['tools/scan-dead.mjs'], { encoding: 'utf8' });
	assert.match(out, /PASS/, 'and the tree satisfies the stricter rule');
	assert.doesNotMatch(out, /stale-allow/, 'with no exemption outliving its reason');
});
