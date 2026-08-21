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
  CAN   that this clone is gated AT ALL. It could not until H7: `.git/hooks/` is never tracked, so
        a fresh clone had no hook, and with no remote there was no CI either — GR1's claim held
        only where someone had run `npm run gate:install` by hand. X14 accepted that and time-boxed
        it to the first push. Two things closed it: `.github/workflows/gate.yml` runs the gate on
        every push and PR, and `prepare` installs the hook during `npm install`, so a fresh clone
        arrives gated and the check below can ASSERT instead of warn.

That last part is why the flip was not the one-line change X14 predicted. Asserting alone would
have broken SCOPE.md's definition of done — fresh clone, npm install, tests pass — because the hook
does not exist until someone installs it. Making installation part of `npm install` is what makes
the assertion both true and honest.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
		['GR16 scan-wiring', 'tools/scan-wiring.mjs', 'tools/scan-wiring.mjs'],
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
	// X14 EXPIRED at the first push (H7). This was a console warning while there was no CI and no
	// remote, because failing here would have broken "fresh clone -> npm install -> tests pass".
	// `prepare` now installs the hook during npm install, so an absent hook means someone removed
	// it or the install was skipped — either way this clone is ungated and should say so loudly.
	assert.ok(fs.existsSync(p),
		`no pre-push hook at ${p} — this clone is UNGATED. \`npm install\` installs it; \`npm run gate:install\` repairs it.`);
	const body = fs.readFileSync(p, 'utf8');
	assert.ok(body.includes('npm run gate'), 'a pre-push hook is installed but does not run the gate — it looks like enforcement and is not');
	assert.ok((fs.statSync(p).mode & 0o111) !== 0, 'the pre-push hook is not executable, so git silently skips it');
});

/*
B78 -- the scanner must see every milestone, including two-digit ones.

`H\d` cannot match `H10`: `H1` consumes the first two characters and the `\b` then fails against
the `0`. So a milestone numbered ten or higher did not exist as far as GR14 was concerned, and the
gate announced this by passing. The failure mode is UNDERCOUNTING, not erroring, which is why this
asserts a number rather than an exit code -- a test that only ran the scanner would have been
green throughout the defect.
*/
test('GR14/B78: scan-board counts a two-digit milestone and its items', () => {
	const src = fs.readFileSync(new URL('../tools/scan-board.mjs', import.meta.url), 'utf8');
	const single = [...src.matchAll(/H\\d(?!\+)/g)];
	assert.equal(single.length, 0,
		`scan-board still spells a milestone H\\d in ${single.length} place(s); H10 cannot match`);

	const out = execFileSync('node', ['tools/scan-board.mjs'], { encoding: 'utf8' });
	const m = /(\d+) milestone\(s\), (\d+) item\(s\)/.exec(out);
	assert.ok(m, 'scan-board reports a milestone and item count');

	const board = fs.readFileSync(new URL('../docs/BOARD.md', import.meta.url), 'utf8');
	assert.equal(Number(m[1]), [...board.matchAll(/^##\s+(H\d+)\b/gm)].length,
		'every milestone heading is counted, two digits included');

	// An item row is one that names a milestone AND cites a B row -- the scanner's own rule
	// (scan-board.mjs:61-64). Mirrored deliberately rather than approximated: an earlier version
	// of this test counted every H-numbered row, disagreed with the scanner by 24, and reported
	// the ledger table as a defect. Re-deriving a number loosely and calling the difference a bug
	// is the failure this whole row exists to catch.
	const rows = board.split('\n').filter((l) => /^\|\s*H\d+\.\d+\s*\|/.test(l) && /\*\*B\d+\*\*/.test(l));
	assert.equal(Number(m[2]), rows.length, 'every citing item row is counted, H10 included');
	assert.ok(rows.some((l) => /^\|\s*H10\./.test(l)), 'the board actually contains a two-digit item to count');
});

/*
GR16/B70 -- the composition root is checked, and the check is proven against the real defect.

Asserting only that the scanner exits 0 would be worthless: it exits 0 on a tree with no wiring at
all. What has to hold is that it FAILS on the exact call site that shipped, so the test reproduces
B70 in a temporary copy rather than trusting the scanner's green.
*/
test('GR16/B70: scan-wiring fails on a root that computes a value and does not pass it', () => {
	assert.match(execFileSync('node', ['tools/scan-wiring.mjs'], { encoding: 'utf8' }),
		/PASS/, 'the tree as it stands is wired correctly');

	// Run the scanner against a fixture reproducing B70 exactly -- `audience` computed, mentioned
	// only inside Boolean(), never passed. Asserting the scanner's green on a correct tree proves
	// nothing about its ability to fail; only this does.
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiring-'));
	fs.mkdirSync(path.join(dir, 'server'));
	fs.writeFileSync(path.join(dir, 'server/app.js'),
		"export async function createApp({ dataDir, authz = false, audience = '', owner = '' } = {}) {}\n");
	const call = (args) => `const audience = process.env.IAP_AUDIENCE || '';\nconst owner = '';\nconst dataDir = '/d';\nconst app = await createApp({ ${args} });\n`;
	const run = () => {
		try {
			return { out: execFileSync('node', [path.join(root, 'tools/scan-wiring.mjs'), '--root', dir],
				{ encoding: 'utf8' }), code: 0 };
		} catch (e) { return { out: e.stdout || '', code: e.status }; }
	};
	try {
		fs.writeFileSync(path.join(dir, 'server/server.js'), call('dataDir, authz: Boolean(audience), owner'));
		const bad = run();
		assert.equal(bad.code, 1, 'the dropped audience is a failure, not a note');
		assert.match(bad.out, /computes `audience` but does not pass it/,
			'and the message names the parameter, or it is unactionable');

		fs.writeFileSync(path.join(dir, 'server/server.js'), call('dataDir, authz: Boolean(audience), audience, owner'));
		const good = run();
		assert.equal(good.code, 0, 'passing it clears the failure — the check is not simply always red');
		assert.match(good.out, /PASS/);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
