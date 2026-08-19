/*
GR1's self-check — B21 / H2.2.

GR1 is the guardrail that gates the other twelve: "promotion to trunk is gated by a deterministic
proof, not a habit." Its own row states that `tests/gate.test.js` asserts the pre-push hook exists
and is executable. **That file did not exist.** The guardrail sitting above all the others was the
one nothing checked — the third instance of X13's lesson (a guardrail must be shown to bite before
it is counted), and it is why X13 was reopened on 2026-08-19.

What this file can and cannot prove:

  CAN   the gate is COMPOSED of the things GR1 names — the suite, scan-writers, scan-claims — so a
        future edit that quietly drops a scanner from `npm run gate` fails here.
  CAN   the registers GR1 depends on exist. GR1 specifies these as `test -f` steps inside the gate
        script; they are mechanized here instead, because an assertion reports WHICH file is
        missing and a shell `-f` chain reports only a non-zero exit.
  CAN   the hook, IF installed, actually invokes the gate — a stale or neutered hook is worse than
        no hook, because it looks like enforcement.
  CANNOT that any given clone is gated at all. `.git/hooks/` is never tracked by git, so a fresh
        clone has NO hook and no CI (`.github/` does not exist). Until that is answered — B21,
        board item H2.3 — GR1's claim holds only for a machine where someone has run
        `npm run gate:install` by hand. This file makes the gap explicit rather than papering it
        over with a conditional skip, which would be exactly the hollow guardrail X13 names.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('GR1: the gate is composed of the suite and every scanner it claims to run', () => {
	const gate = pkg.scripts?.gate;
	assert.ok(gate, 'package.json has no `gate` script — GR1 has no mechanism at all');

	// each component GR1 names, and the file it invokes, so dropping either fails here
	for (const [what, needle, file] of [
		['the test suite', 'npm test', 'package.json'],
		['GR3 scan-writers', 'tools/scan-writers.mjs', 'tools/scan-writers.mjs'],
		['GR2 scan-claims', 'tools/scan-claims.mjs', 'tools/scan-claims.mjs'],
		['GR14 scan-board', 'tools/scan-board.mjs', 'tools/scan-board.mjs'],
		['GR15 scan-dead', 'tools/scan-dead.mjs', 'tools/scan-dead.mjs'],
		['GR15 scan-twins', 'tools/scan-twins.mjs', 'tools/scan-twins.mjs'],
		['GR15 scan-docrefs', 'tools/scan-docrefs.mjs', 'tools/scan-docrefs.mjs'],
	]) {
		assert.ok(gate.includes(needle), `the gate no longer runs ${what} (looked for "${needle}")`);
		assert.ok(fs.existsSync(path.join(root, file)), `the gate names ${file} and it does not exist`);
	}

	// the components must be CHAINED on success, never on completion: `;` would let a red suite
	// pass the gate, which is the difference between a proof and a sequence of noises.
	assert.ok(!gate.includes(';'), 'the gate chains with `;` — a failing step would not stop it');
	assert.ok(gate.includes('&&'), 'the gate does not chain on success');
});

test('GR1: the registers the gate depends on exist', () => {
	// GR1 specifies these as `test -f` steps in the gate script. Mechanized here instead: an
	// assertion names the missing file, a shell -f chain only exits non-zero.
	for (const f of ['docs/spec/COMMIT.md', 'docs/BACKLOG.md', 'docs/BOARD.md']) {
		assert.ok(fs.existsSync(path.join(root, f)), `${f} is missing — the gate asserts its presence`);
	}
});

test('GR1: gate:install RESOLVES the hook path instead of hardcoding .git/hooks', () => {
	const install = pkg.scripts?.['gate:install'];
	assert.ok(install, 'there is no way to install the hook');
	const installer = path.join(root, 'tools/install-hook.sh');
	assert.ok(fs.existsSync(installer), 'gate:install names an installer that does not exist');

	const body = fs.readFileSync(installer, 'utf8');
	// The defect this replaces: the old one-liner wrote to a hardcoded `.git/hooks/pre-push`, but a
	// global core.hooksPath redirects git's lookup elsewhere — so it wrote a file git never ran and
	// the repo LOOKED gated while the gate had never fired on a single push.
	assert.ok(body.includes('git rev-parse --git-path hooks/pre-push'),
		'the installer hardcodes a hook path — a core.hooksPath setting would make it write where git never looks');
	// And it must never install into a hooks dir shared with the machine's other repositories: a
	// hook running `npm run gate` fails every push from any repo without that script.
	assert.ok(body.includes('core.hooksPath'), 'the installer does not confine itself to this repository');
	assert.ok(body.includes('npm run gate'), 'the installer writes a hook that does not run the gate');
	assert.ok(body.includes('chmod +x'), 'the installer writes a hook it never makes executable');
});

test('GR1: an installed hook actually invokes the gate — a neutered hook is worse than none', () => {
	let hook;
	try {
		hook = execFileSync('git', ['rev-parse', '--git-path', 'hooks/pre-push'], { cwd: root, encoding: 'utf8' }).trim();
	} catch {
		return;   // not a git checkout (a tarball, or the Docker build context) — nothing to assert
	}
	const p = path.isAbsolute(hook) ? hook : path.resolve(root, hook);
	if (!fs.existsSync(p)) {
		// The honest state, not a silent pass: this clone is UNGATED. Recorded as B21; the fix is
		// H2.3's decision (CI, or an explicit ruling that the local hook is the whole gate).
		console.error('  [ gate ] no pre-push hook installed — this clone is ungated (B21). Run: npm run gate:install');
		return;
	}
	const body = fs.readFileSync(p, 'utf8');
	assert.ok(body.includes('npm run gate'), 'a pre-push hook is installed but does not run the gate — it looks like enforcement and is not');
	assert.ok((fs.statSync(p).mode & 0o111) !== 0, 'the pre-push hook is not executable, so git silently skips it');
});
