#!/usr/bin/env node
/*
probe/sides.mjs -- H26.1 (dev/design/components/SNAP-GRID.md section 7.6, guardrail G8). Each side of the parity probe runs on its own
dependencies, and is shown to before anything is measured.

tools/probe/parity.mjs serves each commit from its own worktree. It linked the root's node_modules into every one, which would run a
revision pinned to one component version on another's files and answer its page's import map with a 404. So:

  ownDependencies(tree, root, install?)  -> 'linked' | 'installed'
      the root's node_modules linked into the worktree when its package-lock.json is the root's, byte for byte; otherwise the
      worktree's own installed from its own lockfile (`npm ci`, scripts off -- the hook `prepare` installs is the root's business)
  sideProblems({ name, root, pages }, get?)  -> { problems, checked }
      each page asked of the side's own server, and every address its import map names asked of the server that served the page:
      each must answer 200, and the version it names must be the one installed in `root`; a page with no import map -- a revision
      from before H26.1 -- has nothing to assert. `checked` names each component@version held.
*/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const npmCi = (dir) => execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'ignore' });
const bytes = (file) => { try { return fs.readFileSync(file); } catch { return null; } };

export function ownDependencies(tree, root, install = npmCi) {
	const mine = bytes(path.join(tree, 'package-lock.json')), theirs = bytes(path.join(root, 'package-lock.json'));
	if (mine && theirs && mine.equals(theirs)) { fs.symlinkSync(path.join(root, 'node_modules'), path.join(tree, 'node_modules')); return 'linked'; }
	install(tree);
	return 'installed';
}

const MAP = /<script\b[^>]*\btype\s*=\s*["']?importmap\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
const VENDORED = /^\/vendor\/(@apnex\/[^@/]+)@([^/]+)\//;

export async function sideProblems({ name, root, pages }, get = fetch) {
	const problems = [], checked = new Set();
	for (const page of pages) {
		const html = await (await get(page)).text();
		const maps = [...html.matchAll(MAP)];
		if (!maps.length) continue;
		if (maps.length > 1) { problems.push(`${name}: ${page} holds ${maps.length} import maps, where a page holds one`); continue; }
		let imports;
		try { imports = JSON.parse(maps[0][1]).imports ?? {}; } catch { problems.push(`${name}: ${page}'s import map is not JSON`); continue; }
		for (const url of Object.values(imports)) {
			const m = VENDORED.exec(url);
			if (!m) { problems.push(`${name}: ${page}'s import map names ${url}, which is no vendored address`); continue; }
			let installed = null;
			try { installed = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', m[1], 'package.json'), 'utf8')).version; } catch { /* none */ }
			if (installed !== m[2]) problems.push(`${name}: its page's map names ${m[1]}@${m[2]}, and ${installed ? `${m[1]}@${installed} is` : 'none is'} installed on that side`);
			const status = (await get(new URL(url, page))).status;
			if (status !== 200) problems.push(`${name}: ${url} answered ${status} from ${new URL(page).host}`);
			else if (installed === m[2]) checked.add(`${m[1]}@${m[2]}`);
		}
	}
	return { problems: [...new Set(problems)], checked: [...checked].sort() };
}
