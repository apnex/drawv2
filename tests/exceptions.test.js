/*
H21.5, R-b (dev/design/unification/RECORD-GUARDS.md section 3.3) -- A DECOUPLING EXCEPTION'S CITATIONS RESOLVE, AND IT SAYS WHEN IT
ENDS.

The re-audit found exception reasons citing closed rows and finished cuts for weeks (B308, K13d, K6, B133). The reasons now name their
ids, and tools/exceptions.mjs resolves each against the register, the board and the decision record.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exceptionFaults } from '../tools/exceptions.mjs';

function records() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-exceptions-'));
	fs.mkdirSync(path.join(dir, 'dev'));
	fs.writeFileSync(path.join(dir, 'dev/BACKLOG.md'), [
		'| **B1** | open | `[V]` | OPEN -- held. REVIVAL TRIGGER: x. |',
		'| **B2** | closed | `[V]` | CLOSED H1.1 -- done. |',
		'| **B3** | half | `[V]` | PART-CLOSED -- the rest held. |',
	].join('\n'));
	fs.writeFileSync(path.join(dir, 'dev/BOARD.md'), '| H1.1 | a thing | **B2** | S3 | `DONE` |\n| H1.2a | another | feature | S3 | `TODO` |\n');
	fs.writeFileSync(path.join(dir, 'dev/DECISIONS.md'), [
		'**D1, D2 -- the canvas contract -- 2026-10-08 (B9; H1.1).**\\', 'The director chose.', '',
		'**One batch, last -- ruled 2026-09-27, answering a flag (SD2).**\\', 'Text.', '',
		'**Pipes belong to the network -- ruled 2026-09-27 (SD11b), amending in place.**\\', '',
		'**N5a -- the anchor keeps its name -- 2026-10-14 (H21.6).**\\', '',
		'**The planner on triggers: TG-D1 to TG-D3 ruled as recommended -- 2026-10-02 (B9).**\\', '',
		'- **SD5, whether a role is refused or cut** -- held, not asked yet.', '',
		'> **CORRECTED 2026-10-11 (H21, U0):** a fix.', '',
	].join('\n'));
	return dir;
}
const one = (cites, trigger = 'permanent') => [{ where: 'X', cites, trigger }];

test('R-b: ruling ids are read from a ruling\'s head or tail, ranges expanded; held questions and corrections are not rulings', () => {
	const dir = records();
	const resolves = (id) => exceptionFaults(one([id]), dir).length === 0;
	assert.deepEqual(['D1', 'D2', 'SD2', 'SD11b', 'N5a', 'TG-D1', 'TG-D2', 'TG-D3', 'TG-D4', 'SD5', 'U0', 'H21'].filter(resolves), ['D1', 'D2', 'SD2', 'SD11b', 'N5a', 'TG-D1', 'TG-D2', 'TG-D3']);
});

test('R-b: a live row, a board item, a ruling and a closed row cited `from` resolve -- the control', () => {
	assert.deepEqual(exceptionFaults(one(['B1', 'B3', 'H1.1', 'H1.2a', 'D2', 'SD2', 'TG-D2', 'from B2']), records()), []);
});

test('R-b: a closed row cited bare, an unknown id, a held question\'s id, a correction\'s id, and no trigger each fail, named', () => {
	const dir = records();
	assert.match(exceptionFaults(one(['B2']), dir)[0] ?? '', /cites B2, which is CLOSED -- cite the live work, or write `from B2`/);
	assert.match(exceptionFaults(one(['R3']), dir)[0] ?? '', /cites R3, which is no row, no board item, and no ruling id/);
	assert.match(exceptionFaults(one(['SD5']), dir)[0] ?? '', /cites SD5, which is no row/, 'a question held, not asked, is not a ruling');
	assert.match(exceptionFaults(one(['U0']), dir)[0] ?? '', /cites U0, which is no row/, 'an id in a correction is not a ruling');
	assert.match(exceptionFaults(one(['B9']), dir)[0] ?? '', /cites B9, which is not a row/, 'a B id is a row, never a ruling, though rulings cite it');
	assert.match(exceptionFaults(one(['H9.9']), dir)[0] ?? '', /cites H9.9, which is not a board item/);
	assert.match(exceptionFaults(one(['B1'], ''), dir)[0] ?? '', /X: no trigger/);
});
