/*
H21.5, R-c (dev/design/unification/RECORD-GUARDS.md section 3.4) -- STATUS LIVES ON THE BOARD, AND A RULING'S PROVENANCE IN ITS OWN
FIELDS. Four checks, each failing on a planted case and passing on its control, over a fixture tree.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MOVED_BY } from '../tools/layers.mjs';
import { scratchFolder } from '@apnex/test-harness';   // H26-19 as amended: removed when this file ends, however it ends

const SCANNER = path.resolve(import.meta.dirname, '../tools/scan-designs.mjs');
const MARKER = '## Rulings recorded from 2026-10-11 -- each a structured block';
const RULING = ['**H9.9 -- a thing ruled -- 2026-10-11.**\\', 'Director: "yes, build it"\\', 'Shown: dev/design/X.md@abc1234\\', 'Recorder: the proposer recommended it.\\', 'Affects: dev/design/unification/A.md'].join('\n');

/*
RESTATED at H26.7's second verification (R2-3): the scanner refuses a record that does not hold the ruling tools/layers.mjs MOVED_BY
names, so each tree's decisions end with that ruling, its Affects: a file citing it -- unless a case states its own (`move: false`).
*/
const MOVE_RULING = [`**${MOVED_BY} -- the plugins moved -- 2026-10-21.**\\`, 'Director: "approved"\\', 'Shown: tools/layers.mjs@abc1234\\', 'Recorder: the move.\\', 'Affects: MOVE.md'].join('\n');
function tree({ index = '| `A.md` | a | Delta; H1.1. |', files = ['A.md'], title = '# A thing (DELTA, proposed)', banner = true, decisions = `old text\n\n${MARKER}\n\n${RULING}\n`, move = true } = {}) {
	const dir = scratchFolder('draw-designs-');
	if (move) { decisions = `${decisions}\n${MOVE_RULING}\n`; fs.writeFileSync(path.join(dir, 'MOVE.md'), `absorbing ${MOVED_BY}\n`); }
	const u = path.join(dir, 'dev/design/unification');
	fs.mkdirSync(u, { recursive: true });
	fs.writeFileSync(path.join(u, 'README.md'), `| File | What it is | Standing |\n|---|---|---|\n${index}\n`);
	for (const f of files) fs.writeFileSync(path.join(u, f), `${title}\n\n${banner ? "AMENDED 2026-10-11: this title's status is as written; the standing is its board item's.\n" : ''}\nbody, absorbing H9.9\n`);
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

test('H21.6 ABSORBED: a ruling block names what it affects; each named document exists and cites the ruling', () => {
	assert.equal(scan(tree()).status, 0, 'A.md cites H9.9 -- the control');
	let r = scan(tree({ decisions: `${MARKER}\n\n${RULING.replace(/\\\nAffects: .*/, '')}\n` }));
	assert.equal(r.status, 1);
	assert.match(r.stdout, /H9\.9: no `Affects:` line/);
	r = scan(tree({ decisions: `${MARKER}\n\n${RULING.replace('A.md', 'Missing.md')}\n` }));
	assert.equal(r.status, 1);
	assert.match(r.stdout, /Affects names dev\/design\/unification\/Missing\.md, which does not exist/);
	r = scan(tree({ decisions: `${MARKER}\n\n${RULING.replace('H9.9 --', 'H9.8 --')}\n` }));
	assert.equal(r.status, 1, 'the affected document does not cite the ruling');
	assert.match(r.stdout, /which does not cite H9\.8/);
	// REVIEW 2: every id in a head is checked, and a longer id does not stand in for a shorter one
	r = scan(tree({ decisions: `${MARKER}\n\n${RULING.replace('H9.9 --', 'H9.9, X7 --')}\n` }));
	assert.equal(r.status, 1, 'the second id in the head is cited nowhere');
	assert.match(r.stdout, /which does not cite X7/);
	r = scan(tree({ decisions: `${MARKER}\n\n${RULING.replace('H9.9 --', 'H9.9.1 --')}\n` }));
	assert.equal(r.status, 1, 'H9.9 in the document is not H9.9.1');
	assert.match(r.stdout, /which does not cite H9\.9\.1/);
});


/*
H26.7 (H26-7) -- A RULING KEEPS THE PATHS IT WAS WRITTEN WITH (RU2), AND ITS AFFECTED DOCUMENT IS READ WHERE IT IS NOW. The plugins
moved under plugins/; a ruling's `Affects:` naming `network/network.css` names the file now at `plugins/network/network.css`. The check
reads the path through tools/layers.mjs MOVED -- a key ending in `/` names every path under it -- so the moved file must still exist and
still cite the ruling. A path at its own place is read there; a path neither present nor moved still fails.
*/
test('H26.7 ABSORBED: a path a ruling names that moved is read at its new place, which must exist and cite the ruling', () => {
	const RULED = RULING.replace('Affects: dev/design/unification/A.md', 'Affects: dev/design/unification/A.md, network/x.css, engine/kinds.mjs');
	const moved = (cite = { 'plugins/network/x.css': '/* H9.9 */\n', 'plugins/simulation/kinds.mjs': '// H9.9\n' }) => {
		const dir = tree({ decisions: `${MARKER}\n\n${RULED}\n` });
		for (const [f, text] of Object.entries(cite)) { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
		return dir;
	};
	let r = scan(moved());
	assert.equal(r.status, 0, `a moved folder's file and a moved file, each citing the ruling at its new place -- the control:\n${r.stdout}`);
	r = scan(moved({ 'plugins/network/x.css': '/* nothing */\n', 'plugins/simulation/kinds.mjs': '// H9.9\n' }));
	assert.equal(r.status, 1, 'the new place must still cite the ruling');
	assert.match(r.stdout, /Affects names network\/x\.css, which does not cite H9\.9/);
	r = scan(moved({ 'plugins/network/x.css': '/* H9.9 */\n' }));
	assert.equal(r.status, 1, 'a moved path whose new place is gone');
	assert.match(r.stdout, /Affects names engine\/kinds\.mjs, which does not exist/);
	r = scan(moved({ 'network/x.css': '/* H9.9 */\n', 'plugins/simulation/kinds.mjs': '// H9.9\n' }));
	assert.equal(r.status, 0, 'a path present at its own place is read there');
});

/*
H26.7 (the verifier's V7) -- ONLY A RULING RECORDED BEFORE THE MOVE'S OWN MAY NAME A MOVED PATH'S OLD PLACE. Those were written
while the path lived; a ruling recorded at or after H26-7 (tools/layers.mjs MOVED_BY) was written after the move and names where a
file is, so an old place there fails as any missing path.
*/
test('H26.7 ABSORBED: a ruling after the move\'s own naming an old place fails; one before it is read at the new place', () => {
	const block = (id, affects) => RULING.replace('H9.9 --', `${id} --`).replace('Affects: dev/design/unification/A.md', `Affects: ${affects}`);
	const run = (later, own = 'plugins/network/x.css') => {
		const dir = tree({ decisions: `${MARKER}\n\n${block('H9.9', 'network/x.css')}\n\n${block('H26-7', own)}\n\n${block('H9.10', later)}\n`, move: false });
		fs.mkdirSync(path.join(dir, 'plugins/network'), { recursive: true });
		fs.writeFileSync(path.join(dir, 'plugins/network/x.css'), '/* H9.9, H26-7 and H9.10 */\n');
		return scan(dir);
	};
	let r = run('plugins/network/x.css');
	assert.equal(r.status, 0, `the control: the earlier ruling read at the new place, the later one naming it\n${r.stdout}`);
	r = run('network/x.css');
	assert.equal(r.status, 1, 'a ruling after the move naming the old place');
	assert.match(r.stdout, /H9\.10: Affects names network\/x\.css, which does not exist/);
	assert.doesNotMatch(r.stdout, /H9\.9: Affects/, 'the ruling before it still reads the new place');
	r = run('plugins/network/x.css', 'network/x.css');
	assert.equal(r.status, 1, 'nor is the move\'s own ruling before itself');
	assert.match(r.stdout, /H26-7: Affects names network\/x\.css, which does not exist/);
});

/*
H26.7's second verification (R2-3) -- THE CUT-OFF MUST BE FOUND. ABSORBED reads an old place for the rulings before the one
tools/layers.mjs MOVED_BY names, by that ruling's position; with MOVED non-empty and no ruling heading naming it, the cut-off is
nowhere, so the record is refused rather than every ruling read as recorded before the move.
*/
test('H26.7 (R2-3): with MOVED non-empty, a record holding no ruling heading MOVED_BY names is refused', () => {
	assert.equal(scan(tree()).status, 0, 'the control: the record holds it');
	let r = scan(tree({ move: false }));
	assert.equal(r.status, 1);
	assert.match(r.stdout, new RegExp(`dev/DECISIONS\\.md holds no ruling heading ${MOVED_BY}, which tools/layers\\.mjs MOVED_BY names`));
	r = scan(tree({ move: false, decisions: `${MARKER}\n\n${RULING}\n\nThe plugins moved under ${MOVED_BY}.\n` }));
	assert.equal(r.status, 1, 'a mention in a paragraph is no ruling heading');
	r = scan(tree({ move: false, decisions: `${MARKER}\n\n${RULING.replace('H9.9 --', `H9.9, ${MOVED_BY} --`).replace('A.md', 'B.md')}\n`, files: ['A.md', 'B.md'], index: '| `A.md` | a | Delta; H1.1. |\n| `B.md` | b | Delta; H1.1. |' }));
	assert.match(r.stdout, /B\.md, which does not cite H26-7/, 'a heading naming it among other ids is the ruling: its Affects: is held to cite it');
	assert.doesNotMatch(r.stdout, /holds no ruling heading/, 'and it is found');
});

