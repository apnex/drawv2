/*
H21.5, R-a (dev/design/unification/RECORD-GUARDS.md sections 3.1 and 3.2) -- A HELD ROW'S TRIGGER IS READ ONE WAY, ITS DECIDABLE
HALF EVALUATED, AND THE BOARD'S HELD COLUMN GENERATED FROM THE ROWS.

Driven over a fixture git repository rather than `--root` alone, because the scanner asks git which files are tracked and what
the board held at the base -- the part a fixture without git would skip (the second review's finding 13).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const SCANNER = path.resolve(import.meta.dirname, '../tools/scan-triggers.mjs');
const row = (id, disposition) => `| **${id}** | finding | \`[V]\` | ${disposition} |`;
const held = (id, trigger) => `| **${id}** | S4 | a held thing | ${trigger} |`;
const board = ({ state = 'WIP', items = [], heldRows = [] } = {}) => [
	`## H1 -- a milestone - \`${state}\``, '', '| # | Item | Cites | Sev | State |', '|---|---|---|---|---|', ...items, '',
	'## Held -- on the record, not on the board', '', '| Row | Sev | Held item | Revival trigger |', '|---|---|---|---|', ...heldRows, '',
	'## Decisions required', '',
].join('\n');
const backlog = (rows) => ['| # | Row | Evidence | Closes / Trigger |', '|---|---|---|---|', ...rows, ''].join('\n');

function repo({ boardText, backlogText, files = {} }) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-triggers-'));
	const g = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
	g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
	fs.mkdirSync(path.join(dir, 'dev'));
	fs.writeFileSync(path.join(dir, 'dev/BOARD.md'), boardText);
	fs.writeFileSync(path.join(dir, 'dev/BACKLOG.md'), backlogText);
	for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
	g('add', '-A'); g('commit', '-q', '-m', 'fixture');
	return dir;
}
const scan = (dir, ...extra) => spawnSync(process.execPath, [SCANNER, '--root', dir, ...extra], { encoding: 'utf8' });
const one = (disposition, trigger, { items = [], files = {}, rows = [] } = {}) => repo({
	boardText: board({ items, heldRows: [held('B1', trigger)] }),
	backlogText: backlog([row('B1', disposition), ...rows]),
	files,
});
const firedOf = (r) => r.stdout.split('\n').filter((l) => l.includes("'s trigger fired")).map((l) => l.trim());

test('R-a: each predicate fires when true and stays quiet when false', () => {
	const cases = [
		// [WHEN, items, files, extra rows, fires?]
		['row B2 planned', ['| H1.1 | build it | **B2** | S3 | `TODO` |'], {}, [row('B2', 'OPEN -- planned.')], true],
		['row B2 planned', ['| H1.1 | built | **B2** | S3 | `DONE` |'], {}, [row('B2', 'CLOSED H1.')], false],
		['absent src/old.mjs', [], {}, [], true],
		['absent src/old.mjs', [], { 'src/old.mjs': 'x\n' }, [], false],
		['count /judge:/ in */keys.mjs >= 2', [], { 'a/keys.mjs': 'judge: 1\n', 'b/keys.mjs': 'judge: 2\n' }, [], true],
		['count /judge:/ in */keys.mjs >= 2', [], { 'a/keys.mjs': 'judge: 1\n', 'b/deep/keys.mjs': 'judge: 2\n' }, [], false],
		['count /\\x60X\\x60 \\x7c$/ in notes.md >= 1', [], { 'notes.md': '| a | `X` |\n' }, [], true],
		['count /\\x60X\\x60 \\x7c$/ in notes.md >= 1', [], { 'notes.md': '`X` - `Y`\n' }, [], false],
		['absent here.mjs and absent gone.mjs', [], { 'here.mjs': '' }, [], false],
		['absent here.mjs or absent gone.mjs', [], { 'here.mjs': '' }, [], true],
	];
	for (const [when, items, files, rows, fires] of cases) {
		const r = scan(one(`OPEN -- HELD. REVIVAL TRIGGER: it happens. WHEN: \`${when}\``, 'it happens.', { items, files, rows }));
		assert.equal(r.status, 0, `${when}: ${r.stdout}`);
		assert.equal(firedOf(r).length, fires ? 1 : 0, `${when} should ${fires ? '' : 'not '}fire: ${r.stdout}`);
	}
});

test('R-a: a malformed expression fails the scan; an unevaluable one is reported fired and passes', () => {
	const bad = scan(one('OPEN -- HELD. REVIVAL TRIGGER: it happens. WHEN: `row B2 opened`', 'it happens.'));
	assert.equal(bad.status, 1);
	assert.match(bad.stdout, /B1's WHEN is malformed: "row B2 opened" is not a predicate/);
	for (const when of ['row B9 planned', 'count /x/ in nowhere/*.mjs >= 1']) {
		const r = scan(one(`OPEN -- HELD. REVIVAL TRIGGER: it happens. WHEN: \`${when}\``, 'it happens.'));
		assert.equal(r.status, 0, r.stdout);
		assert.match(firedOf(r)[0] ?? '', /cannot be evaluated/, `${when}: ${r.stdout}`);
	}
});

test('R-a: the current trigger -- the last `now`, else the last label before `Was:`, any case, a parenthetical allowed', () => {
	const cases = [
		['OPEN -- HELD. REVIVAL TRIGGER: old. AMENDED 2026-10-11: REVIVAL TRIGGER now: new.', 'new.'],
		['OPEN -- HELD. REVIVAL TRIGGER: current. Was: OPEN. REVIVAL TRIGGER: ancient.', null],   // history follows: not last
		// a `now` wins over a plain label written after it: the plain one is not the current trigger, so the row fails as not last
		['OPEN -- HELD. REVIVAL TRIGGER now: newer. CORRECTED 2026-10-02: REVIVAL TRIGGER: older.', null, 'older.'],
		['OPEN -- HELD. Revival trigger (DESIGN.md:9): the thing.', 'the thing.'],
	];
	for (const [disposition, prose, cell] of cases) {
		const r = scan(one(disposition, cell ?? prose ?? 'current.'));
		if (prose) assert.equal(r.status, 0, `${disposition}: ${r.stdout}`);
		else {
			assert.equal(r.status, 1);
			assert.match(r.stdout, /B1's current trigger is not the last clause of its row/);
		}
	}
});

test('R-a: a held row with no current trigger fails (RU3)', () => {
	const r = scan(one('OPEN -- HELD. Something will happen one day.', 'one day'));
	assert.equal(r.status, 1);
	assert.match(r.stdout, /B1 is held with no current trigger/);
});

test('R-a: the Held column is the rows\' -- a hand-edited cell fails, and --write regenerates it', () => {
	const dir = one('OPEN -- HELD. REVIVAL TRIGGER: the real trigger.', 'a paraphrase of it');
	const r = scan(dir);
	assert.equal(r.status, 1);
	assert.match(r.stdout, /the Held trigger cell of B1 differs from its row's current trigger/);
	assert.equal(scan(dir, '--write').status, 0);
	assert.match(fs.readFileSync(path.join(dir, 'dev/BOARD.md'), 'utf8'), /\| \*\*B1\*\* \| S4 \| a held thing \| the real trigger\. \|/);
	assert.equal(scan(dir).status, 0, 'and passes once generated -- the control');
});

test('R-a: a milestone closing while a trigger has fired fails; closing without one passes, prompting the re-read', () => {
	for (const fires of [true, false]) {
		const dir = one(`OPEN -- HELD. REVIVAL TRIGGER: it happens. WHEN: \`absent ${fires ? 'gone.mjs' : 'here.mjs'}\``, 'it happens.', { files: { 'here.mjs': '' } });
		const p = path.join(dir, 'dev/BOARD.md');
		fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('`WIP`', '`DONE`'));   // closed in the working tree, not at the base
		const r = scan(dir);
		assert.match(r.stdout, /closing H1: re-read every held trigger/, r.stdout);
		if (fires) {
			assert.equal(r.status, 1);
			assert.match(r.stdout, /H1 closes while 1 trigger\(s\) have fired \(B1\)/);
		} else assert.equal(r.status, 0, r.stdout);
	}
	const open = scan(one('OPEN -- HELD. REVIVAL TRIGGER: it happens. WHEN: `absent gone.mjs`', 'it happens.'));
	assert.equal(open.status, 0, 'a fired trigger with no milestone closing is printed, not enforced');
	assert.equal(firedOf(open).length, 1);
});
