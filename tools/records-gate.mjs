#!/usr/bin/env node
/*
records-gate -- H31-6 (dev/DECISIONS.md). THE RECORDS GATE'S TESTS ARE EVERY TEST THAT READS A RECORD OR DOCUMENT, held complete by a
check rather than by memory. `npm run gate:records` (package.json) runs the records checkers and a named list of tests; a push whose
every path is a record or document runs it in place of the full gate (tools/push-scope.mjs). A test that reads a record and is not in
the list would let a records-only push break it unseen, so tests/push-scope.test.js fails on one.

READS A RECORD, mechanically: the test, a module it imports by a relative path, or a tool under `tools/` it names, transitively, holds in
its code -- comments stripped -- a string that is a path the decider calls a record or document (`isRecordPath`): a markdown file, a
file under `dev/`, `docs/` or `upstream/` but JSON, or one of those folders itself. Over-inclusive by design: a test reading its own
scratch copy of a record is caught too, and is excused below by name, with why it reads no record of draw's.

  RECORDS_GATE_EXCUSED                  test -> why it holds a records path and reads no record of draw's
  recordsReaders(root, tests?)          -> [{ test, via }]   every test reading a record, and the chain that reached one
  recordsGateTests(pkg)                 -> [test]            the tests `gate:records` runs, read from its script
  missingFromRecordsGate(root, tests?)  -> [test]            a reader neither listed nor excused
*/
import fs from 'node:fs';
import path from 'node:path';
import { isRecordPath } from './push-scope.mjs';

export const RECORDS_GATE_EXCUSED = {
	'tests/code-split.test.js': 'writes its own fixture tree, `dev/record.md` among it, in a scratch folder',
	'tests/deploy-browser.test.js': 'names `dev` and `docs` to leave them out of the tree it copies',
	'tests/scan-layers-mutants.test.js': 'runs each copy\'s own tools/scan-layers.mjs over copies of the code folders, package.json and the pages -- no `dev/`, so its cites check, which reads the records, never runs; the K0 runs that copy the records in stay in tests/scan-layers.test.js',
	'tests/server.test.js': '`CONTRACT.md` is a request path asked of the vendor mount, refused, never a file read',
	'tests/static.test.js': 'writes its own `node_modules/@apnex/kit/README.md` in a scratch folder, to be refused by the vendor mount',
};

const decomment = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
const literals = (code) => [...code.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0].slice(1, -1));
// a string that is a path naming a record: no space in it; leading `../` and a template's `${...}/` set aside; a records folder alone
const recordPath = (s) => {
	if (/\s/.test(s) || !s) return false;
	const p = s.replace(/^(?:\$\{[^}]*\}\/?)+/, '').replace(/^(?:\.\.?\/)+/, '');
	return /^(?:dev|docs|upstream)\/?$/.test(p) || isRecordPath(p);
};

export function recordsReaders(root, tests = null) {
	const list = tests ?? fs.readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(root, 'tests', f));
	const cache = new Map();
	const info = (file) => {
		if (!cache.has(file)) {
			const code = decomment(fs.readFileSync(file, 'utf8'));
			const deps = [...code.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => path.resolve(path.dirname(file), m[1]))
				.concat([...code.matchAll(/['"`](?:\.\.\/)?(tools\/[\w-]+\.mjs)['"`]/g)].map((m) => path.join(root, m[1])))
				.filter((d) => /\.m?js$/.test(d) && fs.existsSync(d));
			cache.set(file, { direct: literals(code).find(recordPath) ?? null, deps });
		}
		return cache.get(file);
	};
	const via = (file, seen) => {
		if (seen.has(file)) return null;
		seen.add(file);
		const i = info(file);
		if (i.direct) return [i.direct];
		for (const d of i.deps) { const r = via(d, seen); if (r) return [path.relative(root, d), ...r]; }
		return null;
	};
	return list.map((file) => ({ test: path.relative(root, file).replace(/\\/g, '/'), via: via(file, new Set()) })).filter((r) => r.via);
}

export function recordsGateTests(pkg) {
	return [...(pkg.scripts?.['gate:records'] ?? '').matchAll(/(?:^|\s)(tests\/[\w.-]+\.test\.js)(?=\s|$)/g)].map((m) => m[1]);
}

export function missingFromRecordsGate(root, tests = null) {
	const listed = new Set(recordsGateTests(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))));
	return recordsReaders(root, tests).map((r) => r.test).filter((t) => !listed.has(t) && !Object.hasOwn(RECORDS_GATE_EXCUSED, t));
}
