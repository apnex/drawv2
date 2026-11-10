/*
H31-6 (dev/DECISIONS.md; amends GR1's "the same command the hook runs") -- A RECORDS-ONLY PUSH IS CHECKED BY THE RECORDS GATE; ANYTHING
ELSE, OR ANY DOUBT, BY THE FULL GATE.

One decider (tools/push-scope.mjs) answers for the pre-push hook (tools/pre-push.mjs) and for CI (.github/workflows/gate.yml): `records`
when every changed path is a record or document -- a markdown file anywhere, a file under dev/, docs/ or upstream/ but JSON data --
else `full`, and `full` for every doubt. The records gate (`npm run gate:records`) runs the records checkers and every test that reads a
record or document, a list held complete here (tools/records-gate.mjs): a test reading a record that is neither listed nor excused fails.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends
import { isRecordPath, decide, scopeBetween } from '../tools/push-scope.mjs';
import { RECORDS_GATE_EXCUSED, recordsReaders, recordsGateTests, missingFromRecordsGate } from '../tools/records-gate.mjs';

const root = path.resolve(import.meta.dirname, '..');
const A = 'a'.repeat(40), B = 'b'.repeat(40), ZERO = '0'.repeat(40);
const paths = (...ps) => ps.map((p) => (Array.isArray(p) ? { from: p[0], path: p[1] } : { path: p }));
const scope = (changes, extra = {}) => decide({ base: A, head: B, changes, ...extra });

test('H31-6: the decider over path lists -- records alone are records; one code path, a markdown file anywhere, package.json and a rename out decide', () => {
	assert.equal(scope(paths('dev/BOARD.md', 'docs/spec/API.md', 'upstream/incoming/letter.md', 'dev/design/brand/router.png')).scope, 'records', 'records and documents alone');
	const mixed = scope(paths('dev/BOARD.md', 'app/src/sync.js', 'docs/README.md'));
	assert.deepEqual([mixed.scope, mixed.why], ['full', 'app/src/sync.js is not a record or document'], 'one code path among records decides, and is named');
	assert.equal(scope(paths('app/src/NOTES.md')).scope, 'records', 'a markdown file under app/ is a document');
	assert.equal(scope(paths('package.json')).scope, 'full', 'package.json');
	assert.equal(scope(paths('dev/design/unification/BEHAVIOUR-MATRIX.json')).scope, 'full', 'JSON under dev/ is data a test reads');
	assert.equal(scope(paths('dev/design/old-note.md')).scope, 'records', 'a deleted file under dev/ is judged by its path');
	const moved = scope(paths(['docs/notes.md', 'tools/notes.mjs']));
	assert.deepEqual([moved.scope, moved.why], ['full', 'tools/notes.mjs is not a record or document (a rename, docs/notes.md to tools/notes.mjs)'], 'a rename is judged by both its paths');
	for (const p of ['.github/workflows/gate.yml', '.gitignore', 'package-lock.json', 'app/style.css', 'app/index.html', 'lab/seeds.json', 'tests/gate.test.js', 'tools/push-scope.mjs']) assert.equal(isRecordPath(p), false, p);
});

test('H31-6: every doubt is full -- no base, no head, a git error, a merge, nothing changed', () => {
	assert.match(decide({ base: '', head: B, changes: paths('dev/BOARD.md') }).why, /no base/);
	assert.match(decide({ base: ZERO, head: B, changes: paths('dev/BOARD.md') }).why, /no base/);
	assert.match(decide({ base: A, head: ZERO, changes: paths('dev/BOARD.md') }).why, /deleted/);
	assert.equal(scope(null).scope, 'full', 'git could not read the range');
	assert.match(scope(paths('dev/BOARD.md'), { merge: true }).why, /merge/);
	assert.match(scope([]).why, /no changed path/);
});

// a scratch repository, its commits made as the test says
function repo() {
	const dir = scratchFolder('draw-push-scope-');
	const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();
	git('init', '-q');
	git('symbolic-ref', 'HEAD', 'refs/heads/main');   // the branch named as any git names it, `init -b` not being in every git
	const commit = (files, message = 'c') => {
		for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); if (text === null) fs.rmSync(path.join(dir, f)); else fs.writeFileSync(path.join(dir, f), text); }
		git('add', '-A'); git('commit', '-q', '-m', message);
		return git('rev-parse', 'HEAD');
	};
	return { dir, git, commit };
}

test('H31-6: the decider over a real range -- records, code, a deletion under dev/, a rename out of docs/, a merge, a rewrite, an unknown base', () => {
	const r = repo();
	const c0 = r.commit({ 'dev/BOARD.md': '# board\n', 'docs/notes.md': 'n\n', 'app/main.js': 'x\n' });
	const c1 = r.commit({ 'dev/BOARD.md': '# board, again\n', 'README.md': 'r\n' });
	assert.equal(scopeBetween(c0, c1, { cwd: r.dir }).scope, 'records');
	const c2 = r.commit({ 'dev/BOARD.md': null });
	assert.equal(scopeBetween(c1, c2, { cwd: r.dir }).scope, 'records', 'a deletion under dev/');
	r.git('mv', 'docs/notes.md', 'tools-notes.mjs');
	r.git('commit', '-q', '-m', 'mv');
	const c3 = r.git('rev-parse', 'HEAD');
	assert.match(scopeBetween(c2, c3, { cwd: r.dir }).why, /tools-notes\.mjs is not a record or document \(a rename, docs\/notes\.md to tools-notes\.mjs\)/);
	const c4 = r.commit({ 'app/main.js': 'y\n' });
	assert.match(scopeBetween(c3, c4, { cwd: r.dir }).why, /app\/main\.js is not a record/);
	r.git('checkout', '-q', '-b', 'side', c4);
	const s1 = r.commit({ 'docs/side.md': 's\n' });
	r.git('checkout', '-q', 'main');
	const m1 = r.commit({ 'dev/other.md': 'o\n' });
	r.git('merge', '-q', '--no-edit', s1);
	const merged = r.git('rev-parse', 'HEAD');
	assert.match(scopeBetween(m1, merged, { cwd: r.dir }).why, /merge/);
	assert.match(scopeBetween(s1, m1, { cwd: r.dir }).why, /not an ancestor/, 'a range that is no ancestry -- a rewrite');
	assert.match(scopeBetween('c'.repeat(40), merged, { cwd: r.dir }).why, /could not be read/, 'a base not in the history');
	assert.match(scopeBetween(ZERO, merged, { cwd: r.dir }).why, /no base/);
});

/*
The hook: git's lines on stdin, each range decided, and the gate the decision names run -- `npm` stood in for by a script on the path,
which records what it was asked to run and exits as the gate would.
*/
test('H31-6: the pre-push script runs gate:records when every range is records, the full gate for any other range, any doubt or no range', () => {
	const r = repo();
	const c0 = r.commit({ 'dev/BOARD.md': '# b\n', 'app/main.js': 'x\n' });
	const c1 = r.commit({ 'dev/BOARD.md': '# b2\n' });
	const c2 = r.commit({ 'app/main.js': 'y\n' });
	const bin = scratchFolder('draw-push-scope-bin-'), asked = path.join(bin, 'asked');
	fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\necho "$@" >> "${asked}"\nexit 0\n`, { mode: 0o755 });
	const push = (stdin) => {
		fs.rmSync(asked, { force: true });
		const p = spawnSync(process.execPath, [path.join(root, 'tools/pre-push.mjs')], { cwd: r.dir, input: stdin, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
		assert.equal(p.status, 0, p.stdout + p.stderr);
		return fs.readFileSync(asked, 'utf8').trim();
	};
	assert.equal(push(`refs/heads/main ${c1} refs/heads/main ${c0}\n`), 'run gate:records', 'a records-only range');
	assert.equal(push(`refs/heads/main ${c2} refs/heads/main ${c0}\n`), 'run gate', 'a range holding code');
	assert.equal(push(`refs/heads/main ${c1} refs/heads/main ${c0}\nrefs/heads/x ${c2} refs/heads/x ${c1}\n`), 'run gate', 'one range of two holding code');
	assert.equal(push(`refs/heads/new ${c1} refs/heads/new ${ZERO}\n`), 'run gate', 'a new branch: no base');
	assert.equal(push(''), 'run gate', 'no range read');
});

test('H31-6: every test that reads a record or document is in the records gate, or excused by name -- and the check catches a planted one', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
	const listed = recordsGateTests(pkg);
	assert.ok(listed.length >= 10, `the records gate names its tests (${listed.length})`);
	for (const t of listed) assert.ok(fs.existsSync(path.join(root, t)), `${t} is listed and does not exist`);
	assert.deepEqual(missingFromRecordsGate(root), [], 'a test reading a record is neither in gate:records nor excused');
	const readers = recordsReaders(root).map((r) => r.test);
	for (const t of Object.keys(RECORDS_GATE_EXCUSED)) {
		assert.ok(readers.includes(t), `${t} is excused but holds no records path -- remove the excuse`);
		assert.ok(!listed.includes(t), `${t} is both excused and listed`);
	}
	const tests = fs.readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.test.js')).map((f) => path.join(root, 'tests', f));
	const dir = scratchFolder('draw-records-plant-');
	const reads = path.join(dir, 'planted.test.js'), plain = path.join(dir, 'plain.test.js');
	fs.writeFileSync(reads, "import fs from 'node:fs';\nconst board = fs.readFileSync(new URL('../dev/BOARD.md', import.meta.url), 'utf8');\n");
	fs.writeFileSync(plain, "// reads dev/BOARD.md -- in a comment, which reads nothing\nconst x = 'a board';\n");
	assert.deepEqual(missingFromRecordsGate(root, [...tests, reads, plain]).map((t) => path.basename(t)), ['planted.test.js'], 'a planted test reading a record, outside the list, is caught; one naming it in a comment is not');
});

test('H31-6: the hook\'s installer and CI decide with the one decider; the image job is skipped for a records-only push', () => {
	const installer = fs.readFileSync(path.join(root, 'tools/install-hook.sh'), 'utf8');
	assert.match(installer, /tools\/pre-push\.mjs/, 'the installed hook calls the versioned pre-push script');
	const hook = fs.readFileSync(path.join(root, 'tools/pre-push.mjs'), 'utf8');
	assert.match(hook, /scopeBetween/);
	assert.match(hook, /'gate:records' : 'gate'/, 'it runs the records gate or the full gate, by the decision');
	const wf = fs.readFileSync(path.join(root, '.github/workflows/gate.yml'), 'utf8');
	assert.match(wf, /node tools\/push-scope\.mjs/, 'CI decides with the same script');
	assert.match(wf, /fetch-depth: 0/, 'with the history to compare');
	assert.match(wf, /npm run gate:records/);
	assert.match(wf, /npm run gate\b(?!:)/);
	assert.match(wf, /\n {2}image:\n {4}needs: scope\n {4}if: needs\.scope\.outputs\.scope != 'records'/, 'the image job skipped for a records-only push');
});
