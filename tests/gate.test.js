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
		write(rows('| H1.1 | a | **B1** | S1 | `DONE` |', '| H1.2 | b | feature | S1 | `TODO` |').replace('`WIP`', '`DONE`'));
		r = run();
		assert.equal(r.code, 1);
		assert.match(r.out, /marked DONE with 1 item\(s\) still open/);

		// and WIP must mean what it says, in both directions
		write(rows('| H1.1 | a | **B1** | S1 | `TODO` |'));
		assert.match(run().out, /marked WIP with nothing DONE/);
		write(rows('| H1.1 | a | **B1** | S1 | `DONE` |'));
		assert.match(run().out, /marked WIP with nothing open/);

		// the compliant case passes, so the rules are not simply always red
		write(rows('| H1.1 | a | **B1** | S1 | `DONE` |', '| H1.2 | b | feature | S1 | `TODO` |'));
		r = run();
		assert.equal(r.code, 0, 'a mixed WIP milestone with stated items is clean');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
GR14/B122+B123 -- the two directions the contract claimed and the scanner did not check.

B122 is the worst instance yet of this project's recurring shape: a check whose scope is narrower
than its stated claim. The verdict parser anchored on a BOLD keyword -- `**CLOSED H1.1**` -- and the
register drifted to plain `CLOSED -- H9.6` at B61 and plain `FIXED -- H9.30` at B100. Measured when
this was written: 51 of 121 dispositions read as closed to a human and as open to the scanner, so R2
and R3 skipped every row of H9 and H10, the two largest arcs in the project. Nothing went red. The
summary kept printing `121 row(s)`, which is a correct count of a quantity the rules did not consume.

B123 is the missing direction. R1 asked whether a board item points at a real row; nothing asked
whether a real row reached the plan, although contract rule 3 states that obligation in words. Three
rows were open and on neither list, and one of them (B117) had already shipped.

Driven over fixtures, for the reason the test above gives: asserting today's clean tree proves the
rules agree with today's file, not that they can tell a violation from a compliance.
*/
test('GR14/B122+B123: an unknown verdict errors, and a live row cannot be absent from the plan', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b122-'));
	fs.mkdirSync(path.join(dir, 'docs'));
	const run = () => {
		try { return { out: execFileSync('node', [path.join(root, 'tools/scan-board.mjs'), '--root', dir], { encoding: 'utf8' }), code: 0 }; }
		catch (e) { return { out: e.stdout || '', code: e.status }; }
	};
	const backlog = (...rows) => fs.writeFileSync(path.join(dir, 'docs/BACKLOG.md'), `${rows.join('\n')}\n`);
	const board = (items, held = '') => fs.writeFileSync(path.join(dir, 'docs/BOARD.md'),
		`## H1 — m · \`WIP\`\n\n| # | Item | Cites | Size | State |\n|---|---|---|---|---|\n${items}\n\n## Held\n\n| Row | Sev | Held item | Revival trigger |\n|---|---|---|---|\n${held}\n\n## Not in this arc\n`);
	const both = '| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | b | **B2** | S1 | `TODO` |';

	try {
		// R7 -- the exact drift that disabled R2 and R3: a spelling of "closed" nobody predicted.
		// The old parser answered "not closed" and said nothing; this must ERROR.
		backlog('| **B1** | a row | `[V]` | Resolved -- H1. |', '| **B2** | b row | `[V]` | OPEN |');
		board(both);
		let r = run();
		assert.equal(r.code, 1, 'an unrecognised verdict is an error, not a silent reclassification');
		assert.match(r.out, /B1 opens its disposition with a verdict this scanner does not know/);

		// and the vocabulary must not be matched at a word boundary -- `PART-CLOSED` and `WON'T DO`
		// both read as a different, shorter word if it is. This is why longest-prefix, not \b.
		backlog("| **B1** | a row | `[V]` | WON'T DO -- ruled. |", '| **B2** | b row | `[V]` | OPEN |');
		board(both);
		assert.equal(run().code, 0, "WON'T DO is one verdict, not the word WON");

		// R10 -- an unescaped pipe splits the row and hands every later rule a fragment of prose.
		// B113 lost its verdict to `|x| 840, |y| 480` and read as *480, so it cost nothing*.
		backlog('| **B1** | a row | `[V]` | CLOSED -- H1, worst case \\|x\\| 840. |', '| **B2** | b | `[V]` | OPEN |');
		board(both);
		assert.equal(run().code, 0, 'an ESCAPED pipe is fine');
		backlog('| **B1** | a row | `[V]` | CLOSED -- H1, worst case |x| 840. |', '| **B2** | b | `[V]` | OPEN |');
		board(both);
		r = run();
		assert.equal(r.code, 1);
		assert.match(r.out, /B1 splits into \d+ fields where the table declares 6/);

		// R8 -- the missing direction. B2 is open and named nowhere in the plan.
		backlog('| **B1** | a row | `[V]` | CLOSED -- H1. |', '| **B2** | b row | `[V]` | OPEN |');
		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | b | feature | S1 | `TODO` |');
		r = run();
		assert.equal(r.code, 1, 'a live row absent from the board is the defect R8 exists for');
		assert.match(r.out, /B2 is OPEN and appears nowhere/);

		// declaring it Held discharges the obligation -- that is what Held is FOR
		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | b | feature | S1 | `TODO` |', '| **B2** | S4 | b | a trigger |');
		assert.equal(run().code, 0, 'a held row is declared, not absent');

		// R9 -- the converse. A row that closes while listed as held leaves the plan advertising a
		// deferral that no longer exists, which was true of B6, B9 and B32 when this was written.
		backlog('| **B1** | a row | `[V]` | CLOSED -- H1. |', '| **B2** | b row | `[V]` | CLOSED -- H1. |');
		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | b | feature | S1 | `TODO` |', '| **B2** | S4 | b | a trigger |');
		r = run();
		assert.equal(r.code, 1);
		assert.match(r.out, /lists B2 under Held, but .* records it as CLOSED/);

		// A remainder answers a stricter form: cited is not enough, it needs an OPEN item. A
		// PART-CLOSED row cited only by the DONE item that closed the other half reads as finished.
		backlog('| **B1** | a row | `[V]` | PART-CLOSED -- H1, the cheap half. |', '| **B2** | b | `[V]` | OPEN |');
		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | b | **B2** | S1 | `TODO` |');
		r = run();
		assert.equal(r.code, 1, 'a remainder needs a plan, not merely a mention');
		assert.match(r.out, /B1 is PART-CLOSED but every .* item citing it is DONE/);

		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | the remainder | **B1** | S1 | `TODO` |\n| H1.3 | b | **B2** | S1 | `TODO` |');
		assert.equal(run().code, 0, 'a remainder with an open item is compliant');

		/*
		R11 (B128) -- an OPEN item cites a row or declares itself a feature.

		Contract rule 1 claimed every item cites a row and had never been true: two items were open
		and uncited, and a long tail of closed ones cited nothing either. R1 only checked that a
		citation which EXISTS resolves, so citing NOTHING was the one case no rule could see.

		The three exemptions matter more than the failure here. A DONE item is left alone because
		demanding a citation retroactively rewrites a record made before the rule (M4); `feature`
		is the escape a genuine non-finding declares out loud; and an empty cell must NOT read as
		either, which is the ambiguity the old wording lived in.
		*/
		backlog('| **B1** | a row | `[V]` | CLOSED -- H1. |');
		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | planned work | — | S1 | `TODO` |');
		r = run();
		assert.equal(r.code, 1, 'an open item citing nothing is what rule 1 always claimed to forbid');
		assert.match(r.out, /H1\.2 is TODO and cites no B row/);

		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | planned work | feature | S1 | `TODO` |');
		assert.equal(run().code, 0, 'a feature declares itself and is exempt');

		// M4: the same uncited item, closed, is a record and not a defect. A third open item keeps
		// the fixture's hardcoded `WIP` heading honest -- an all-DONE board trips R6 instead, and
		// reading THAT as R11 passing would have made this case vacuous.
		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | planned work | — | S1 | `DONE` |\n| H1.3 | c | feature | S1 | `TODO` |');
		assert.equal(run().code, 0, 'a DONE uncited item is history, not a finding at large');

		// and an empty cell is not a quiet `feature`
		board('| H1.1 | a | **B1** | S1 | `DONE` |\n| H1.2 | planned work |  | S1 | `WIP` |');
		assert.match(run().out, /H1\.2 is WIP and cites no B row/);
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

	/*
	H9.29: the credential surface has a consumer too, and this is the one that matters most.
	H9.5 shipped mint/revoke over REST with no UI, so "shown once" had nowhere to be shown and the
	only way to obtain a code was to craft a request by hand. A credential a person cannot get is a
	credential nobody uses.
	*/
	assert.match(html, /id="access-code-value"/, 'the page has somewhere to display the plaintext');
	assert.match(html, /id="access-code-copy"/, 'and a way to copy it');
	assert.match(main, /workspace\/codes/, 'main.js reaches the codes routes');
	assert.match(main, /body\.code/, 'and reads the plaintext out of the mint response');
	assert.match(rest, /parts\[3\] === 'codes'/, 'which the server answers');

	// the plaintext must never be rendered from the LIST — the list has no secret in it, and a UI
	// that expected one would be reading a field the server deliberately does not send
	const listRender = main.slice(main.indexOf('function renderCodes'), main.indexOf('async function sendCodes'));
	assert.doesNotMatch(listRender, /\.code\b/,
		'the code list renders ids and dates, never a secret it does not receive');
});

/*
GR15/B91 -- the method half, driven over a fixture so it must tell the two cases apart.

B90 was an authorization model complete in the store and reachable from nothing, and this scanner
was green throughout, because `Store` is exported and has consumers so every method it carries
counted as reached. The repair is a SECOND rule, not the export rule applied more widely: a method
is judged on whether anything calls it at all.

That distinction is what this asserts. A class with a helper called only via `this.` must PASS --
that is an ordinary private helper, and reporting it is the 118-of-293 result that made the naive
version worthless. A method nothing calls must FAIL. Both directions, because a check that only
ever fails is as useless as one that only ever passes.
*/
test('GR15/B91: a method nothing calls is caught; one called via this. is not', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b91-'));
	const run = () => {
		try { return { out: execFileSync('node', [path.join(root, 'tools/scan-dead.mjs')], { cwd: dir, encoding: 'utf8' }), code: 0 }; }
		catch (e) { return { out: (e.stdout || '') + (e.stderr || ''), code: e.status }; }
	};
	const write = (body) => {
		fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
		fs.writeFileSync(path.join(dir, 'server/thing.mjs'), body);
		// a consumer, so the CLASS itself is not the finding — otherwise this would prove nothing.
		// It exports NOTHING: an unconsumed export here would trip the export rule and the test
		// would pass or fail for a reason that has nothing to do with methods. That happened.
		fs.writeFileSync(path.join(dir, 'server/use.mjs'),
			"import { Thing } from './thing.mjs';\nnew Thing().used();\n");
	};
	try {
		write('export class Thing {\n\tused() { return this.helper(); }\n\thelper() { return 1; }\n}\n');
		const ok = run();
		assert.equal(ok.code, 0,
			'a helper reached only through this. is a normal private helper, not a finding');

		write('export class Thing {\n\tused() { return 1; }\n\torphan() { return 2; }\n}\n');
		const bad = run();
		assert.equal(bad.code, 1, 'a method nothing calls anywhere IS a finding — this is B90"s shape');
		assert.match(bad.out, /Thing#orphan/, 'and it is named as Class#method, not just a bare name');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
H9.7 -- the prefix is rewritten once and never consulted again.

The board asked for a scanner proving every handler under /connect performs the grant check. That
premise dissolved when /connect became a rewrite rather than a second surface: there are no
handlers under /connect, so such a scanner would scan an empty set while its name claimed broad
coverage -- the defect this session has filed four times (B78, B91, B92, B96), not a fix for it.

What is worth holding is the property that makes routing a path around IAP safe: the prefix is a
DOOR, never a privilege. Any branch on it downstream would be a route that behaves differently
depending on which door it came through, and that is exactly how a load-balancer mistake turns into
a breach. One rewrite, no readers, asserted over the source because it is a claim about shape.
*/
test('H9.7/B101: the agent door is stripped at ingress and nothing below can see it', () => {
	const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
	const words = (t) => [...strip(t).matchAll(/\w*connect\w*/gi)].map((m) => m[0])
		.filter((w) => !/^(re)?connections?$/i.test(w) && !/^reconnect$/i.test(w));
	const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

	/*
	B101 moved the door from the REST router to ingress, and that made this invariant STRONGER
	rather than merely different. The old rewrite sat inside rest.js, so the router itself -- and
	everything app.js routes outside it, including `/d/<id>.svg` -- could see the prefix. That is
	precisely why the picture was unreachable through the door. Stripping at ingress means the set
	of door-blind code is now everything except the four lines that do the stripping.
	*/
	const app = read('server/app.js');
	assert.deepEqual(words(app), ['connect', 'connect'],
		'the ONLY two mentions in app.js are the two path literals in AGENT_DOOR -- even the names '
		+ 'that apply it (AGENT_DOOR, throughTheAgentDoor) do not carry the word, so a third hit is '
		+ 'either a new door entry or code branching on the prefix, and both must be looked at');
	assert.match(strip(app), /const AGENT_DOOR = \[/, 'the door is a table, so its entries can be counted');
	assert.match(strip(app), /req\.url = throughTheAgentDoor\(req\.url\);/, 'and it is applied to the URL itself');

	// every other file must be unable to tell -- authorization is on the principal alone
	for (const f of ['server/rest.js', 'server/store.js', 'server/protocol.js', 'server/identity.mjs']) {
		assert.deepEqual(words(read(f)), [],
			`${f} must not know which door a request used`);
	}

	// the strip must precede BOTH identity and routing, or something above could branch on the raw prefix
	const code = strip(app);
	const door = code.indexOf('req.url = throughTheAgentDoor');
	assert.ok(door > -1);
	assert.ok(door < code.indexOf('identify(req.headers)'), 'stripped before the principal is resolved');
	assert.ok(door < code.indexOf('handleRest('), 'stripped before anything routes');

	/*
	Not a blanket strip, and this is the assertion that matters most.

	`/connect` reaching everything by prefix removal would put each route app.js later grows behind
	the IAP-free backend the instant it was added, with nobody deciding to. Each entry is a specific
	path, so widening the door stays a deliberate act that shows up in a diff.
	*/
	const entries = [...code.matchAll(/\['(\/connect\/[^']+)',\s*'([^']+)'\]/g)].map((m) => [m[1], m[2]]);
	assert.deepEqual(entries, [['/connect/v1/', '/api/v1/'], ['/connect/d/', '/d/']],
		'the door opens onto exactly the REST surface and the picture');
	for (const [from] of entries) {
		assert.ok(from.length > '/connect/'.length,
			`${from} strips to a bare prefix, which opens the door onto everything`);
	}
});

/*
The board is written in plain hyphens.

Ruled 2026-08-26 by the director. Small, and gated for the reason the same day
produced three times over: a convention that is stated and not checked is a
convention that has already started drifting. B122 is the case in point -- the
register's disposition vocabulary changed at B61 and nothing noticed for sixty
rows, because the only thing holding it was that everyone had been writing it
the same way so far.

Scoped to BOARD.md deliberately. BACKLOG.md carries em dashes in rows written
before the ruling and M4 says a record made before a change is not rewritten to
match it, so widening this check would force exactly the retroactive edit that
rule exists to prevent.
*/
test('BOARD: no em dashes -- write `--`', () => {
	const board = fs.readFileSync(path.join(root, 'docs/BOARD.md'), 'utf8');
	const lines = board.split('\n');
	const hits = lines.map((l, i) => [i + 1, l]).filter(([, l]) => l.includes('\u2014'));
	assert.equal(hits.length, 0,
		`docs/BOARD.md uses an em dash on ${hits.length} line(s), first at :${hits[0]?.[0]} -- write "--" instead`);

	// The check must be able to fail, and the message must name a line. Asserting only that
	// today's file is clean would pass identically if `hits` were computed from the wrong string.
	const salted = ['fine --', 'not \u2014 fine'];
	assert.equal(salted.filter((l) => l.includes('\u2014')).length, 1, 'the predicate distinguishes -- from an em dash');
});

/*
And the anchors the board links to itself by must resolve.

Replacing 188 em dashes moved two heading slugs -- `#held--on-the-record...`
became `#held----on-the-record...`, because github-slugger DROPS an em dash and
KEEPS a hyphen, so one space-dash-space became four hyphens where it had been
two. Three links needed updating and nothing in the tree would have said so:
scan-docrefs resolves file paths, not fragments.
*/
test('BOARD: every in-file anchor resolves to a heading', () => {
	const board = fs.readFileSync(path.join(root, 'docs/BOARD.md'), 'utf8');
	// github-slugger: lowercase, drop everything that is not alphanumeric, space, hyphen or
	// underscore, then spaces become hyphens.
	const slug = (h) => h.trim().toLowerCase().replace(/[^0-9a-z \-_]/g, '').replace(/ /g, '-');
	const headings = new Set([...board.matchAll(/^#{2,3}\s+(.*)$/gm)].map((m) => slug(m[1])));
	assert.ok(headings.size > 5, 'headings were found at all — otherwise this passes vacuously');

	const links = [...board.matchAll(/\]\(#([a-z0-9\-_]+)\)/g)].map((m) => m[1]);
	assert.ok(links.length > 0, 'the board links to itself at all');
	const dangling = links.filter((a) => !headings.has(a));
	assert.deepEqual(dangling, [], `docs/BOARD.md links to ${dangling.length} anchor(s) with no heading`);
});

/*
B109 -- the delete-window UI is wired in an order that actually runs.

`node --check` parses a module; it does not execute it, so it cannot see a reference to a `const`
that is declared further down. The first version of this wiring called `menu.undelete` at module
load with `menu` declared three thousand characters later -- a temporal dead zone that throws on
import and takes the whole editor with it, while every syntax check stayed green.

Asserted by ORDER rather than by executing the module, because `main.js` reaches for a real DOM and
a websocket the moment it loads. Order is the property that was wrong, and it is the property this
can see.
*/
test('B109: the undelete wiring runs after the object it wires', () => {
	const src = fs.readFileSync(path.join(root, 'app/src/main.js'), 'utf8');
	const menuAt = src.indexOf('const menu = {');
	const wiringAt = src.indexOf('menu.undelete.onclick');
	assert.ok(menuAt > 0 && wiringAt > 0, 'both are present');
	assert.ok(wiringAt > menuAt,
		'the wiring touches `menu` at module load, so it must come after the declaration or the import throws');

	// and the button is hidden in the markup: its appearance IS the signal that something is
	// recoverable, so shipping it visible would make the signal meaningless
	const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
	assert.match(html, /id="diagram-undelete"[^>]*hidden/, 'the control ships hidden');
	assert.match(html, /id="undelete"[^>]*hidden/, 'and so does the panel');
});

/*
B109 -- the delete window is refreshed before it is read, and when the tab is looked at again.

Visibility used to be recomputed only when a snapshot carrying a diagram list arrived, and a delete
notifies only the people watching the deleted diagram. A tab sitting on anything else never learned
the window had changed, so the control stayed hidden until a reload -- the same shape as B94, a tab
believing something the server has since changed.

Asserted structurally, because the alternative is standing up a browser. What can be checked is that
the two refresh moments exist and that neither is a timer: polling would spend requests continuously
to be right at a moment which already announces itself.
*/
test('B109: the recycle bin refreshes on open and on regaining focus, and never polls', () => {
	const src = fs.readFileSync(path.join(root, 'app/src/main.js'), 'utf8');
	const wiring = src.slice(src.indexOf('menu.undelete.onclick'));

	assert.match(wiring.slice(0, 300), /await refreshUndelete\(\);\s*renderUndelete\(\)/,
		'opening the panel refetches BEFORE rendering, so a list is never stale when acted on');
	assert.match(src, /visibilitychange[\s\S]{0,120}refreshUndelete/,
		'and coming back to the tab rechecks, which is when a person looks');
	assert.equal(/setInterval\([^)]*refreshUndelete/.test(src), false,
		'no polling: a timer spends requests continuously to be right at a moment that announces itself');
});

/*
B125 -- scan-writers asks what an entry MUST carry, not only what it must not.

The `before` rule above asks whether an entry carries a key it should not, and nothing asked the
mirror. That asymmetry is how B87 shipped: a `del` built without the field its op needs was refused
by the browser at runtime and waved through by every static check.

Driven over fixtures, and the third case is the one that matters. The vocabulary is the ENTRY shape
from `changes.js#toOp`, not the wire shape from `model/ops.mjs` -- an entry carries `entity` on a
delete and `after` on a set, and the converter turns them into `id` and `patch`. Checking the wrong
one of those two tables flagged twenty-one healthy builders on this rule's first run.
*/
test('GR3/B125: an entry missing a key its op requires is caught, in the ENTRY vocabulary', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b125-'));
	fs.mkdirSync(path.join(dir, 'app/src'), { recursive: true });
	fs.mkdirSync(path.join(dir, 'model'), { recursive: true });
	fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
	fs.copyFileSync(path.join(root, 'model/ops.mjs'), path.join(dir, 'model/ops.mjs'));
	const write = (body) => fs.writeFileSync(path.join(dir, 'app/src/commands.js'), body);
	/*
	Asserted on THIS RULE's output, not on the scanner's exit code.

	The other rules carry broken-scan floors -- "NO model.load calls matched at all" and friends --
	which are correct on the real tree and fire on any partial fixture. Reading the exit code would
	make this test pass or fail on rules that are not its subject, which is the confusion it exists
	to prevent one layer down.
	*/
	const run = () => {
		let out;
		try { out = execFileSync('node', [path.join(root, 'tools/scan-writers.mjs'), '--root', dir], { encoding: 'utf8' }); }
		catch (e) { out = e.stdout || ''; }
		return out.split('\n').filter((l) => /entry op|missing a key their op requires/.test(l)).join('\n');
	};
	try {
		// the ENTRY shapes, as `changes.js#toOp` consumes them
		write(`export function ok(link) {
			return { label: 'x', entries: [
				{ op: 'put', kind: 'link', entity: link },
				{ op: 'del', kind: 'link', entity: link },
				{ op: 'set', kind: 'link', id: link.id, after: { via: [] } },
			] };
		}\n`);
		assert.equal(run(), '', 'healthy entries draw no complaint from this rule');

		// B87 exactly: a delete with no entity for the converter to read an id from
		write(`export function bad(link) {
			return { label: 'x', entries: [{ op: 'del', kind: 'link', id: link.id }] };
		}\n`);
		assert.match(run(), /entry op 'del' needs entity/);

		// a set with no payload: applied as undefined, silently
		write(`export function bad2(link) {
			return { label: 'x', entries: [{ op: 'set', kind: 'link', id: link.id }] };
		}\n`);
		assert.match(run(), /entry op 'set' needs after/);

		// an op the converter would throw on -- nothing static said so before
		write(`export function bad3(link) {
			return { label: 'x', entries: [{ op: 'remove', kind: 'link', entity: link }] };
		}\n`);
		assert.match(run(), /unknown entry op 'remove'/);

		// a spread carries keys this cannot see, so it must not be judged
		write(`export function spread(base, link) {
			return { label: 'x', entries: [{ ...base, op: 'del', kind: 'link' }] };
		}\n`);
		assert.equal(run(), '', 'a literal building on a spread is left alone');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
