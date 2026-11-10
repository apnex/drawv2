#!/usr/bin/env node
/*
push-scope -- H31-6 (dev/DECISIONS.md; amends GR1's "the same command the hook runs"). WHAT A PUSH NEEDS CHECKED: `records` when every
path it changes is a record or a document, so the records gate checks it (`npm run gate:records`), and `full` for anything else or any
doubt, so the full gate does (`npm run gate`). One decider for the pre-push hook (tools/pre-push.mjs) and for CI
(.github/workflows/gate.yml), so the two cannot decide differently.

A RECORD OR DOCUMENT is any markdown file (`*.md`, anywhere), and any file under `dev/`, `docs/` or `upstream/` but a JSON file there,
which is data a test or a tool reads (`dev/design/unification/BEHAVIOUR-MATRIX.json` drives the behaviour matrix's browser runs).
Everything else -- code, tests, tools, package.json and its lockfile, workflows, `.gitignore`, CSS, HTML, JSON data, templates -- is full.

ANY DOUBT IS FULL: no base (a new branch, a first push, a run with no `before`), a deleted branch (no head), a base or head not in the
local history, a base that is not an ancestor of the head (a rewrite), a merge in the range, no changed path at all, or a git error.
A rename is judged by both its paths, so a document moved into `tools/` is full.

  isRecordPath(path)                         -> boolean
  decide({ base, head, changes, merge })     -> { scope: 'records' | 'full', why }   changes: [{ path, from? }] or null (git failed)
  scopeBetween(base, head, { cwd })          -> { scope, why }                       the range read from git, then decided

Usage: node tools/push-scope.mjs <base> <head> [--output <file>]
  prints the decision and the path that decided it; --output appends `scope=<records|full>` to a file (GitHub's step output)
*/
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const RECORD_DIRS = /^(?:dev|docs|upstream)\//;
const NO_COMMIT = /^0+$/;

export function isRecordPath(p) {
	const file = String(p).replace(/\\/g, '/').replace(/^\.\//, '');
	if (/\.md$/i.test(file)) return true;
	return RECORD_DIRS.test(file) && !/\.json$/i.test(file);
}

export function decide({ base, head, changes, merge = false }) {
	if (!base || NO_COMMIT.test(base)) return { scope: 'full', why: 'no base to compare with -- a new branch, a first push, or a run with no previous commit' };
	if (!head || NO_COMMIT.test(head)) return { scope: 'full', why: 'no head -- a branch deleted' };
	if (changes === null) return { scope: 'full', why: 'the range could not be read from git' };
	if (merge) return { scope: 'full', why: 'the range holds a merge' };
	if (!changes.length) return { scope: 'full', why: 'no changed path to judge' };
	for (const c of changes) {
		for (const p of [c.from, c.path].filter(Boolean)) if (!isRecordPath(p)) return { scope: 'full', why: `${p} is not a record or document${c.from ? ` (a rename, ${c.from} to ${c.path})` : ''}` };
	}
	return { scope: 'records', why: `every changed path is a record or document (${changes.length} change(s), the last ${changes.at(-1).path})` };
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

export function scopeBetween(base, head, { cwd = process.cwd() } = {}) {
	if (!base || NO_COMMIT.test(base) || !head || NO_COMMIT.test(head)) return decide({ base, head, changes: [] });
	let changes, merge;
	try {
		git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], cwd);
		git(['rev-parse', '--verify', '--quiet', `${head}^{commit}`], cwd);
		try { git(['merge-base', '--is-ancestor', base, head], cwd); } catch { return { scope: 'full', why: `${base} is not an ancestor of ${head} -- a rewrite, judged whole` }; }
		merge = git(['rev-list', '--merges', `${base}..${head}`], cwd).trim() !== '';
		const fields = git(['diff', '--name-status', '-M', '-z', base, head], cwd).split('\0');
		changes = [];
		for (let i = 0; i < fields.length && fields[i];) {
			const status = fields[i++];
			if (/^[RC]/.test(status)) { changes.push({ from: fields[i], path: fields[i + 1] }); i += 2; } else { changes.push({ path: fields[i] }); i += 1; }
		}
	} catch { return decide({ base, head, changes: null }); }
	return decide({ base, head, changes, merge });
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const args = process.argv.slice(2), at = args.indexOf('--output');
	const output = at > -1 ? args.splice(at, 2)[1] : null;
	const [base, head] = args;
	const { scope, why } = scopeBetween(base, head);
	console.log(`push-scope: ${scope} -- ${why}`);
	if (output) fs.appendFileSync(output, `scope=${scope}\n`);
}
