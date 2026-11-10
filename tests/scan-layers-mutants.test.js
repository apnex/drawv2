/*
H31-6 (dev/DECISIONS.md) -- K0 M1-M7 AND THE ATTACK'S A-MUTANTS, ON COPIES OF THIS TREE: EACH LANDS AND EACH FAILS ITS RULE. Moved from
tests/scan-layers.test.js, whose header states the method, into a file of its own: these runs copy the scanned code folders, package.json
and the pages -- no record -- so a push of records alone cannot change their verdicts, and the records gate does not run them; the full
gate does. The three runs that copy the records in stay in tests/scan-layers.test.js.
*/
import { test } from 'node:test';
import fs from 'node:fs';
import { MUTANTS, CONTROLS, runMutants } from './fixtures/layer-mutants.mjs';
import { scratchFolder } from '@apnex/clean-runner';   // H26-19 as amended: removed when this file ends, however it ends

test('K0 M1-M7 and the attack\'s A-mutants (on copies of this tree): each lands and each fails its rule', async () => {
	const base = scratchFolder('k0-mutants-');
	try { await runMutants(base, [...MUTANTS, ...CONTROLS]); } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
