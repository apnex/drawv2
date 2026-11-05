/*
The production gate of H26.6's moves 9 to 12 (a low): the product page's Chrome tests drew their server's port from 8200 to 8499 and the
lab's from 8400 to 8599, so two files run at once could draw one port -- a gate flake. Each Chrome file's port range is its own: read
from each file's `port = <base> + (process.pid % <span>)`, the ranges pairwise disjoint.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FILES = ['browser', 'lab-browser', 'page-matrix'];
test('the gate\'s low: the Chrome test files\' server port ranges are pairwise disjoint', () => {
	const ranges = FILES.map((f) => {
		const m = fs.readFileSync(new URL(`./${f}.test.js`, import.meta.url), 'utf8').match(/\bport = (\d+) \+ \(process\.pid % (\d+)\)/);
		assert.ok(m, `tests/${f}.test.js draws its port from a range`);
		return [f, Number(m[1]), Number(m[1]) + Number(m[2]) - 1];
	});
	for (const [a, lo, hi] of ranges) for (const [b, lo2, hi2] of ranges) if (a < b) assert.ok(hi < lo2 || hi2 < lo, `${a} ${lo}..${hi} and ${b} ${lo2}..${hi2} overlap`);
	assert.deepEqual(ranges.map(([, lo, hi]) => [lo, hi]), [[8200, 8399], [8400, 8599], [8600, 8799]]);
});
