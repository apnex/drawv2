#!/usr/bin/env node
/*
chrome-profile -- H26-19 (B434). What a headless Chrome leaves outside its profile, and the debugging port it was given.

THE LOCK FOLDER. Chrome started with `--user-data-dir=<profile>` makes a folder of its own directly in its temporary folder --
`.com.google.Chrome.XXXXXX`, or without the leading dot on newer builds -- and links `<profile>/SingletonSocket` to the socket in it.
Stopping Chrome does not remove it: measured 2026-10-31, Chrome 136 stopped by SIGTERM left the folder and the link, and the
recorder counted 4,077 of these folders in the gates' temporary folders, 25 from one gate run, because draw's harnesses removed the
profile and never the folder outside it. So the folder is read from the link -- before the profile goes, since the link is the only
record of which folder is whose -- and removed only when its name is Chrome's and it sits directly in the temporary folder, so a
link pointing anywhere else removes nothing (the components' driver, input-capture `removeSingleton`, does the same).

THE DEBUGGING PORT. `--remote-debugging-port=0` lets the system give Chrome a free port, which Chrome writes to the first line of
`<profile>/DevToolsActivePort` -- 152 ms after launch, measured. A port chosen from a range (B434) can be held by any other program,
another Chrome among them, and the harness then fails to start or drives the wrong browser.
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The name of Chrome's singleton lock folder, with or without the leading dot. */
export const CHROME_LOCK_FOLDER_NAME = /^\.?com\.google\.Chrome\.[A-Za-z0-9]{6}$/;

/** Removes a folder tree, retrying while a process that was just stopped finishes closing its files; never throws. */
export function removeScratchTree(target) {
	try { fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); return true; } catch { return false; }
}

/** The Chrome lock folder a profile's SingletonSocket link names, or null unless it is Chrome's and directly in `tmpdir`. */
export function chromeLockFolderOf(profileDir, tmpdir = os.tmpdir()) {
	let folder;
	try { folder = path.dirname(fs.readlinkSync(path.join(profileDir, 'SingletonSocket'))); } catch { return null; }
	if (path.dirname(folder) !== path.resolve(tmpdir) || !CHROME_LOCK_FOLDER_NAME.test(path.basename(folder))) return null;
	return folder;
}

/** Removes the Chrome lock folder named by the profile's link (see chromeLockFolderOf); answers the folder removed, or null. */
export function removeChromeLockFolder(profileDir, tmpdir = os.tmpdir()) {
	const folder = chromeLockFolderOf(profileDir, tmpdir);
	return folder && removeScratchTree(folder) ? folder : null;
}

/**
 * The debugging port Chrome was given, read from the first line of `<profile>/DevToolsActivePort`, waiting up to `waitMs`.
 * `exited()` answering true stops the wait at once: a Chrome that died writes no port.
 */
export async function readDevToolsActivePort(profileDir, { waitMs = 20000, exited = () => false } = {}) {
	const file = path.join(profileDir, 'DevToolsActivePort');
	const until = Date.now() + waitMs;
	while (Date.now() < until) {
		if (exited()) throw new Error(`readDevToolsActivePort: Chrome exited before it wrote ${file}`);
		try { const port = Number(fs.readFileSync(file, 'utf8').split('\n')[0]); if (port > 0) return port; } catch { /* not yet written */ }
		await new Promise((r) => setTimeout(r, 50));
	}
	throw new Error(`readDevToolsActivePort: Chrome wrote no port to ${file} within ${waitMs} ms`);
}
