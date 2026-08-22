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
	const m = /(\d+) milestone\(s\), (\d+) item\(s\), (\d+) citing/.exec(out);
	assert.ok(m, 'scan-board reports a milestone, item and citing count');

	const board = fs.readFileSync(new URL('../docs/BOARD.md', import.meta.url), 'utf8');
	assert.equal(Number(m[1]), [...board.matchAll(/^##\s+(H\d+)\b/gm)].length,
		'every milestone heading is counted, two digits included');

	// An item row is one that names a milestone AND cites a B row -- the scanner's own rule
	// (scan-board.mjs:61-64). Mirrored deliberately rather than approximated: an earlier version
	// of this test counted every H-numbered row, disagreed with the scanner by 24, and reported
	// the ledger table as a defect. Re-deriving a number loosely and calling the difference a bug
	// is the failure this whole row exists to catch.
	// B92 widened this to the lettered suffix, and split the two numbers apart: the summary used to
	// print the citing subset under the name "item(s)".
	const itemRows = board.split('\n').filter((l) => /^\|\s*H\d+\.\d+[a-z]?\s*\|/.test(l));
	const rows = itemRows.filter((l) => /\*\*B\d+\*\*/.test(l));
	assert.equal(Number(m[2]), itemRows.length, 'every item row is counted, H10 and lettered ids included');
	assert.equal(Number(m[3]), rows.length, 'and the citing subset is reported as the subset it is');
	assert.ok(rows.some((l) => /^\|\s*H10\./.test(l)), 'the board actually contains a two-digit item to count');
	assert.ok(itemRows.some((l) => /^\|\s*H\d+\.\d+[a-z]\s*\|/.test(l)), 'and a lettered one');
});

/*
B92 -- a lettered item is an item, and the rules must reach it.

The board splits an item into H9.2a/b/c and H9.4b/c/d, and the scanner's id pattern stopped at the
digits, so nine rows -- seven of them DONE -- were exempt from R1, R3, R5 and R6 while the gate
said PASS. Counting is not enough to prove the repair: what matters is that a RULE now fires on
such a row. This builds a board whose lettered item is DONE while its B row is open, which is
exactly the R3 contract, and asserts the scanner REFUSES it.
*/
test('GR14/B92: a rule fires on a lettered item, not only on an unlettered one', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b92-'));
	fs.mkdirSync(path.join(dir, 'docs'));
	// The disposition must PROMISE a milestone or R3 skips the row by design (scan-board.mjs:161),
	// so the fixture opens with `**H1**` and is not marked CLOSED. Read from the scanner rather than
	// assumed: the first draft of this fixture said `OPEN`, R3 correctly ignored it, and the test
	// would have reported a green baseline as the repair.
	fs.writeFileSync(path.join(dir, 'docs/BACKLOG.md'), '| **B1** | a row | `[V]` | **H1** closes there |\n');
	const run = () => {
		try { return { out: execFileSync('node', [path.join(root, 'tools/scan-board.mjs'), '--root', dir], { encoding: 'utf8' }), code: 0 }; }
		catch (e) { return { out: e.stdout || '', code: e.status }; }
	};
	// a DONE item citing a B row that is not CLOSED -- the R3 contract, the rule the scanner header
	// calls the one that silently rots. The heading reads DONE so R6 agrees and R3 is alone in play.
	const write = (id) => fs.writeFileSync(path.join(dir, 'docs/BOARD.md'),
		`## H1 — m · \`DONE\`\n\n| # | Item | Cites | Size | State |\n|---|---|---|---|---|\n| ${id} | a | **B1** | S1 | \`DONE\` |\n`);
	try {
		write('H1.1');
		const plain = run();
		assert.equal(plain.code, 1, 'baseline: R3 refuses an unlettered DONE item whose B row is open');

		write('H1.1a');
		const lettered = run();
		assert.equal(lettered.code, 1,
			'and it must refuse the lettered one identically — before B92 the row was invisible, so this passed');
		assert.match(lettered.out, /H1\.1a/, 'the refusal names the lettered id, so it is genuinely parsed');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
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

/*
GR15/B62 -- an export earns its existence from a consumer OUTSIDE its origin.

scan-dead's header has always said "a real consumer outside its origin"; its arithmetic discounted
one occurrence in the origin file and counted the rest, so ANY internal use satisfied the check.
Eighteen exports were passing on their own internal references, and the symbol that exposed it was
passing on four words in its own error message.

Driven over fixtures rather than the real tree: asserting the tree is clean proves the scanner
agrees with today's code, not that it can tell the two cases apart.
*/
test('GR15/B62: an internal use does not earn an export, and prose never does', () => {
	const src = fs.readFileSync(path.join(root, 'tools/scan-dead.mjs'), 'utf8');

	// the origin file is excluded outright, not discounted
	assert.ok(/if \(f === self\) continue;/.test(src),
		'the origin file must be skipped; `hits - 1` counts internal use as consumption');
	assert.ok(!/Math\.max\(0, hits - 1\)/.test(src), 'the discount arithmetic is gone');

	// strings are stripped, so a symbol named in its own error message proves nothing
	for (const quote of ["'", '"', '`']) {
		assert.ok(src.includes(`${quote}(?:[^${quote}`) || src.includes('\\`(?:[^\\`'),
			`string literals in ${quote} quotes are stripped before counting`);
	}

	// and a stale exemption is surfaced rather than sitting silently
	assert.ok(/stale-allow/.test(src),
		'an ALLOW whose finding has gone must be reported, or it covers a future regression');

	const out = execFileSync('node', ['tools/scan-dead.mjs'], { encoding: 'utf8' });
	assert.match(out, /PASS/, 'and the tree satisfies the stricter rule');
	assert.doesNotMatch(out, /stale-allow/, 'with no exemption outliving its reason');
});

/*
GR14/B77 -- the board's content, not only its structure.

scan-board checked that citations resolve and that DONE and CLOSED agree, and passed continuously
while H9 read `TODO` above thirteen DONE items, H2.3 carried four cells where the table has five
with prose where its state belongs, and H2 read `DONE` with that item open. R4 existed and could
see none of it: it iterates only rows that cite a B row, so an uncited row was outside its reach.

Driven over fixtures. Asserting the real board is clean proves the rules agree with today's file,
not that they can tell a violation from a compliance.
*/
test('GR14/B77: a heading must agree with the states beneath it, and every item must declare one', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-'));
	fs.mkdirSync(path.join(dir, 'docs'));
	fs.writeFileSync(path.join(dir, 'docs/BACKLOG.md'), '| **B1** | a row | `[V]` | OPEN |\n');
	const write = (body) => fs.writeFileSync(path.join(dir, 'docs/BOARD.md'), body);
	const run = () => {
		try { return { out: execFileSync('node', [path.join(root, 'tools/scan-board.mjs'), '--root', dir], { encoding: 'utf8' }), code: 0 }; }
		catch (e) { return { out: e.stdout || '', code: e.status }; }
	};
	const rows = (...r) => `## H1 — m · \`WIP\`\n\n| # | Item | Cites | Size | State |\n|---|---|---|---|---|\n${r.join('\n')}\n`;
	try {
		// the shape that shipped: a heading claiming nothing has started, above finished work
		write(rows('| H1.1 | a | **B1** | S1 | `DONE` |').replace('`WIP`', '`TODO`'));
		let r = run();
		assert.equal(r.code, 1);
		assert.match(r.out, /marked TODO with 1 item\(s\) already DONE/, 'a stale heading is named');

		// H2.3's shape: a row whose state cell holds something else, and which cites nothing
		write(rows('| H1.1 | a | **B1** | S1 | `DONE` |', '| H1.2 | b | — | prose where a state goes |'));
		r = run();
		assert.equal(r.code, 1);
		assert.match(r.out, /H1\.2 declares no state/, 'an uncited stateless row is reachable now');

		// H2's shape: DONE heading over an open item
		write(rows('| H1.1 | a | **B1** | S1 | `DONE` |', '| H1.2 | b | — | S1 | `TODO` |').replace('`WIP`', '`DONE`'));
		r = run();
		assert.equal(r.code, 1);
		assert.match(r.out, /marked DONE with 1 item\(s\) still open/);

		// and WIP must mean what it says, in both directions
		write(rows('| H1.1 | a | **B1** | S1 | `TODO` |'));
		assert.match(run().out, /marked WIP with nothing DONE/);
		write(rows('| H1.1 | a | **B1** | S1 | `DONE` |'));
		assert.match(run().out, /marked WIP with nothing open/);

		// the compliant case passes, so the rules are not simply always red
		write(rows('| H1.1 | a | **B1** | S1 | `DONE` |', '| H1.2 | b | — | S1 | `TODO` |'));
		r = run();
		assert.equal(r.code, 0, 'a mixed WIP milestone with stated items is clean');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
GR1 -- every tool is invocable the way it declares.

Eight of nine carried `#!/usr/bin/env node` and not one was executable, so the shebang was
decorative: `./tools/scan-dead.mjs` failed and only `node tools/scan-dead.mjs` worked. The ninth
had no shebang at all, so the convention was not consistently absent either. Small, and worth a
check rather than a fix alone, because a mode bit is exactly the kind of thing that is lost in a
patch and noticed by nobody.
*/
test('GR1: every tool declares a shebang and is executable, so both invocations work', () => {
	const dir = path.join(root, 'tools');
	const tools = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
	assert.ok(tools.length >= 9, 'the tools directory is populated');
	for (const t of tools) {
		const p = path.join(dir, t);
		assert.match(fs.readFileSync(p, 'utf8').split('\n')[0], /^#!\/usr\/bin\/env node$/,
			`tools/${t} has no shebang, so ./tools/${t} would be run by the shell`);
		assert.ok(fs.statSync(p).mode & 0o111, `tools/${t} is not executable, so its shebang is decorative`);
	}
});

/*
H9.4d/B90 -- the surface has a consumer, asserted structurally.

B90 was an authorization model complete in the store and reachable from nothing, which survived a
whole milestone because every test drove `store.grant` directly. The REST tests in access.test.js
now drive it over HTTP, but the BROWSER consumer lives in main.js -- the composition root, which
runs on import and needs a document, so it cannot be imported here and its behaviour is not under
test. What is asserted is the weaker, still useful claim that the consumer exists and names the
same routes the server answers, so the two cannot silently drift apart into an unreachable API
again. Named as structural rather than dressed up as behavioural: the panel's conduct is not
covered, and a reader of this test should not believe otherwise.
*/
test('H9.4d: the grant surface has a browser consumer, and it calls the routes the server answers', () => {
	const root = new URL('..', import.meta.url);
	const html = fs.readFileSync(new URL('app/index.html', root), 'utf8');
	const main = fs.readFileSync(new URL('app/src/main.js', root), 'utf8');
	const rest = fs.readFileSync(new URL('server/rest.js', root), 'utf8');

	assert.match(html, /id="access"/, 'the panel exists in the page');
	assert.match(main, /grants/, 'and main.js reaches for the grant routes');
	assert.match(main, /method: 'DELETE'/, 'including revoke, not only grant');
	assert.match(main, /encodeURIComponent/,
		'the principal is encoded — it carries a colon and an @, so a raw path would be a different resource');
	assert.match(rest, /parts\[4\] === 'grants'/, 'and the server answers there');

	// the diagram half is owner-only: the server refuses everyone else, and offering a door that is
	// certain not to open is worse than offering none
	assert.match(main, /meta\.owner === principal/, 'ownership decides whether the diagram half renders');

	// H9.4c: the workspace half is NOT owner-gated, and that is load-bearing rather than a detail.
	// An agent-created diagram is owned by the agent, so gating the panel on owning what is on
	// screen would lock a person out of their own workspace at exactly the diagrams the feature
	// exists to enable.
	assert.match(main, /workspace\/grants/, 'the client reaches the workspace routes');
	assert.match(main, /method: 'GET'/,
		'and READS them — a workspace grant lives in no diagram, so unlike meta.grants it must be fetched');
	assert.match(main, /not-owner/, 'the diagram half is hidden rather than the whole panel withheld');
	assert.match(rest, /parts\[2\] === 'workspace'/, 'and the server answers there');
});
