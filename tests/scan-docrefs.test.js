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
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { scratchFolder } from '@apnex/test-harness';   // H26-19 as amended: removed when this file ends, however it ends

const SCANNER = path.resolve(import.meta.dirname, '../tools/scan-docrefs.mjs');

// a repository holding `files` (path -> text), every file tracked
function repo(files) {
	const dir = scratchFolder('draw-docrefs-');
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

/*
H26.7 (the verifier's V3) -- A MOVED PATH IS ALLOWED IN A RECORD ALONE. A record (a file under dev/) keeps the paths it was written
with (RU2), so it may cite a path that moved when its new place is in the repository (tools/layers.mjs MOVED). The move's first
build allowed each moved path with a `*:` entry, which exempted every file: a live document citing `network/view.mjs` passed.
*/
test('H26.7: a record may cite a moved path whose new place exists; a live document or code file citing it fails', () => {
	let r = scan({ ...BASE, 'dev/R.md': '# R\n\nWritten when the view was `network/view.mjs`, and `engine/kinds.mjs` the kinds.\n',
		'plugins/simulation/kinds.mjs': 'export const k = 1;\n' });
	assert.equal(r.status, 0, `the control: a record citing a moved folder's file and a moved file\n${r.stdout}`);
	assert.match(r.stdout, /allowed\s+network\/view\.mjs\n\s+\S+ moved to plugins\/network\/view\.mjs at H26\.7/);
	assert.match(r.stdout, /allowed\s+engine\/kinds\.mjs\n\s+\S+ moved to plugins\/simulation\/kinds\.mjs at H26\.7/);
	r = scan({ ...BASE, 'docs/L.md': '# L\n\nThe view is `network/view.mjs`.\n' });
	assert.equal(r.status, 1, `the verifier's case: a live document citing the old place\n${r.stdout}`);
	assert.match(r.stdout, /docs\/L\.md\n\s+BROKEN\s+network\/view\.mjs/);
	r = scan({ ...BASE, 'README.md': '# R\n\nSee `network/view.mjs`.\n' });
	assert.equal(r.status, 1, 'the README is live');
	r = scan({ ...BASE, 'server/app.js': '// see network/view.mjs\nexport const a = 1;\n' });
	assert.equal(r.status, 1, 'so is code');
	assert.match(r.stdout, /server\/app\.js\n\s+BROKEN\s+network\/view\.mjs/);
	r = scan({ ...BASE, 'dev/R.md': '# R\n\nWritten when `network/gone.mjs` lived.\n' });
	assert.equal(r.status, 1, 'a record citing a moved path whose new place is not in the repository: nothing is there to have moved to');
	assert.match(r.stdout, /BROKEN\s+network\/gone\.mjs/);
});
