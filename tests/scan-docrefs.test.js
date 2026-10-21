/*
H26.7 -- scan-docrefs over a fixture repository: a path a live file cites must resolve, at its old root too.

H26.7 moved every plugin under plugins/ (H26-7). The scanner read a bare path in code only under the roots scan-dead's folders
began with, so after the move `network/`, `layouts/`, `zones/`, `groups/` and `devices/` were no longer roots, and a live file citing
`network/nonexistent.mjs` passed (the verifier's mutant). The old roots are read again, taken from tools/layers.mjs MOVED.

The scanner answers from `git ls-files` in the directory it runs in, so each case is a small repository in a temporary folder.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const SCANNER = path.resolve(import.meta.dirname, '../tools/scan-docrefs.mjs');

// a repository holding `files` (path -> text), every file tracked
function repo(files) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-docrefs-'));
	for (const [f, text] of Object.entries(files)) {
		fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true });
		fs.writeFileSync(path.join(dir, f), text);
	}
	execFileSync('git', ['init', '-q'], { cwd: dir });
	execFileSync('git', ['add', '-A'], { cwd: dir });
	return dir;
}
const scan = (files) => {
	const dir = repo(files);
	try { return spawnSync(process.execPath, [SCANNER, '--verbose'], { cwd: dir, encoding: 'utf8' }); }
	finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const BASE = { 'plugins/network/view.mjs': 'export const view = 1;\n', 'docs/A.md': '# A\n\nThe view is `plugins/network/view.mjs`.\n' };

test('H26.7: a live code file citing a path under an old plugin root is read, and fails when nothing is there', () => {
	let r = scan({ ...BASE, 'server/app.js': '// see plugins/network/view.mjs\nexport const a = 1;\n' });
	assert.equal(r.status, 0, `the control: a path at its place resolves\n${r.stdout}`);
	r = scan({ ...BASE, 'server/app.js': '// see network/nonexistent.mjs\nexport const a = 1;\n' });
	assert.equal(r.status, 1, `the verifier's mutant: an old root's path that names nothing\n${r.stdout}`);
	assert.match(r.stdout, /server\/app\.js\n\s+BROKEN\s+network\/nonexistent\.mjs/);
	for (const root of ['layouts', 'zones', 'groups', 'devices']) {
		r = scan({ ...BASE, 'server/app.js': `// see ${root}/nonexistent.mjs\nexport const a = 1;\n` });
		assert.equal(r.status, 1, `${root}/ is read as a root\n${r.stdout}`);
	}
});
