/*
H26-19 -- A FOLDER A TEST MAKES IS REMOVED WHEN ITS FILE ENDS, in one place.

One gate run left 208 of draw's test folders in its temporary folder: 11 of the test files made a folder per test -- a data folder and
a home for each server they booted, a copy of a document a scan rewrites -- and removed some of them in a `finally`, or none. Nothing
failed, so the folders piled up by the thousand. tools/run-tests.mjs now fails a run that leaves one; this is how a test does not.

`scratchDir(prefix)` makes `<temporary folder>/<prefix>XXXXXX` and answers it; every folder made through it is removed by an `after`
hook this module registers on the importing file, when that file's tests have run. Registered on import, at the file's top level,
so it is the file's hook and not a test's. A test that must see a folder gone sooner removes it itself, as before.
*/
import { after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scratchDirs = [];
after(() => { for (const d of scratchDirs) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

/** Makes a folder in the temporary folder, removed when the importing test file ends. */
export function scratchDir(prefix) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	scratchDirs.push(dir);
	return dir;
}
