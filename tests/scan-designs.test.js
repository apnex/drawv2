/*
H21.5, R-c (dev/design/unification/RECORD-GUARDS.md section 3.4) -- STATUS LIVES ON THE BOARD, AND A RULING'S PROVENANCE IN ITS OWN
FIELDS. Four checks, each failing on a planted case and passing on its control, over a fixture tree.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCANNER = path.resolve(import.meta.dirname, '../tools/scan-designs.mjs');
const MARKER = '## Rulings recorded from 2026-10-11 -- each a structured block';
const RULING = ['**H9.9 -- a thing ruled -- 2026-10-11.**\\', 'Director: "yes, build it"\\', 'Shown: dev/design/X.md@abc1234\\', 'Recorder: the proposer recommended it.'].join('\n');

function tree({ index = '| `A.md` | a | Delta; H1.1. |', files = ['A.md'], title = '# A thing (DELTA, proposed)', banner = true, decisions = `old text\n\n${MARKER}\n\n${RULING}\n` } = {}) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-designs-'));
	const u = path.join(dir, 'dev/design/unification');
	fs.mkdirSync(u, { recursive: true });
	fs.writeFileSync(path.join(u, 'README.md'), `| File | What it is | Standing |\n|---|---|---|\n${index}\n`);
	for (const f of files) fs.writeFileSync(path.join(u, f), `${title}\n\n${banner ? "AMENDED 2026-10-11: this title's status is as written; the standing is its board item's.\n" : ''}\nbody\n`);
	fs.writeFileSync(path.join(dir, 'dev/DECISIONS.md'), decisions);
	return dir;
}
const scan = (dir) => spawnSync(process.execPath, [SCANNER, '--root', dir], { encoding: 'utf8' });

test('R-c: the control passes -- an index naming its folder, a status title with its banner, a typed Standing cell, a structured ruling', () => {
	const r = scan(tree());
	assert.equal(r.status, 0, r.stdout);
});

test('R-c INDEX: a member the index does not name fails, named', () => {
	const r = scan(tree({ files: ['A.md', 'B.md'] }));
	assert.equal(r.status, 1);
	assert.match(r.stdout, /README\.md does not name B\.md/);
});

test('R-c BANNER: a status word in a title\'s closing parenthetical needs the banner; a descriptive use does not', () => {
	const r = scan(tree({ banner: false }));
	assert.equal(r.status, 1);
	assert.match(r.stdout, /A\.md: its title says "\(DELTA, proposed\)" and carries no banner/);
	assert.equal(scan(tree({ banner: false, title: '# Where each rule is held, proposed or built (DESCRIPTIVE)' })).status, 0, 'the word outside the parenthetical, and a parenthetical without one');
	assert.equal(scan(tree({ banner: false, title: '# A ledger (DELTA)' })).status, 0);
});

test('R-c STANDING: a Standing cell carrying a state fails; a type and items pass', () => {
	const r = scan(tree({ index: '| `A.md` | a | Delta, approved 2026-10-04; built. |' }));
	assert.equal(r.status, 1);
	assert.match(r.stdout, /A\.md: Standing "Delta, approved 2026-10-04; built\." is not/);
	assert.equal(scan(tree({ index: '| `A.md` | a | Evidence. |' })).status, 0);
	assert.equal(scan(tree({ index: '| `A.md` | a | Proposed. |' })).status, 1, 'a state is not a type');
	assert.equal(scan(tree({ index: '| `A.md` | a | Delta; proposed, awaiting approval. |' })).status, 1, 'nor rides in behind the semicolon (the exit check\'s finding 1)');
	assert.equal(scan(tree({ index: '| A.md | a | Proposed. |' })).status, 1, 'a row without backticks is still a row');
	assert.equal(scan(tree({ index: '| `A.md` | a | Delta; H18.2, H18.10. |' })).status, 0, 'board items after the type');
});

test('R-c RULINGS: after the marker, a bold paragraph is a ruling block with its three fields, or an amendment', () => {
	const noDirector = RULING.replace(/Director: .*\n/, '');
	let r = scan(tree({ decisions: `${MARKER}\n\n${noDirector}\n` }));
	assert.equal(r.status, 1);
	assert.match(r.stdout, /H9\.9: no `Director:` line/);
	r = scan(tree({ decisions: `${MARKER}\n\n**Scope discipline.**\\\nA caution an agent wrote.\n` }));
	assert.equal(r.status, 1, 'a bold paragraph with no id -- where B282\'s trigger was born');
	assert.match(r.stdout, /"\*\*Scope discipline\.\*\*\\" opens in bold after the marker/);
	assert.equal(scan(tree({ decisions: `${MARKER}\n\n${RULING}\n\n**AMENDED 2026-10-12:** H9.9 amended.\n` })).status, 0, 'an amendment naming its ruling is allowed');
	assert.equal(scan(tree({ decisions: `${MARKER}\n\n${RULING}\n\n**AMENDED 2026-10-12:** something changed.\n` })).status, 1, 'an amendment naming no ruling is not');
	assert.equal(scan(tree({ decisions: `**Scope discipline.**\\\nbefore the marker\n\n${MARKER}\n\n${RULING}\n` })).status, 0, 'before the marker, nothing is bound (RU2)');
	r = scan(tree({ decisions: 'no marker here\n' }));
	assert.equal(r.status, 1);
	assert.match(r.stdout, /has no marker heading/);
});
