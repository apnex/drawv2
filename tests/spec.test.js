/*
GR10 — `docs/spec/SCOPE.md` never asserts the opposite of the running wire.

This is the check that did not exist. CS1 and CS3 each reversed a locked decision without
amending SCOPE.md, and nothing failed: the file went unchanged from genesis through four
milestones while the wire moved underneath it (recorded as deviation X6). A rule with no
mechanization is a hope, so here it is.

The strong assertion is not a token grep — it is DERIVED: the command vocabulary is read out of
`server/protocol.js`'s own dispatch and compared against what SCOPE.md documents. Adding a `case`
without documenting it fails; documenting a command that no longer exists fails. That is what
would have caught `apply` and `push`.
*/

import { test } from 'node:test';
import { inventory } from '../tools/routes.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scope = fs.readFileSync('docs/spec/SCOPE.md', 'utf8');
const protocol = fs.readFileSync('server/protocol.js', 'utf8');

// the wire-protocol section: from its heading to the next top-level one
function section(heading) {
	const start = scope.indexOf(`## ${heading}`);
	assert.notEqual(start, -1, `SCOPE.md has no "## ${heading}" section`);
	const rest = scope.slice(start + 3);
	const end = rest.indexOf('\n## ');
	return end === -1 ? rest : rest.slice(0, end);
}

// the live reference: a section up to its first dated amendment. The amendment is the record of
// what changed and legitimately names dead commands; the reference is what a reader copies.
function reference(heading) {
	const body = section(heading);
	const amended = body.indexOf('*(Amended');
	return amended === -1 ? body : body.slice(0, amended);
}

// every `case 'x':` the session dispatches, minus the reply-side names
function dispatched() {
	const body = protocol.slice(protocol.indexOf('dispatch(cmd, body)'));
	return [...body.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]);
}

test('GR10: every command the server dispatches is documented in SCOPE.md', () => {
	const wire = reference('Wire protocol (one websocket) - as shipped');
	const missing = dispatched().filter((cmd) => !wire.includes(`\`${cmd}`) && !wire.includes(`"${cmd}"`));
	assert.deepEqual(missing, [], `undocumented ws commands: ${missing.join(', ')}`);
});

test('GR10: SCOPE.md documents no command the server has stopped answering', () => {
	// only the REFERENCE, not the amendment below it: an amendment's job is to NAME the commands
	// it retired, so scanning it would make the file permanently unfixable.
	const wire = reference('Wire protocol (one websocket) - as shipped');
	const live = new Set(dispatched());
	// what the section claims the CLIENT may send: `{cmd:"x"` and the management back-tick list
	const claimed = new Set([
		...[...wire.matchAll(/\{cmd:"([a-z]+)"/g)].map((m) => m[1]),
		...[...wire.matchAll(/`([a-z]+) \{/g)].map((m) => m[1]),
	]);
	// server→client reply names are not dispatched commands
	for (const reply of ['snapshot', 'sync', 'ack', 'change', 'error', 'diagrams', 'lock', 'selection']) claimed.delete(reply);
	const dead = [...claimed].filter((c) => !live.has(c));
	assert.deepEqual(dead, [], `SCOPE.md still documents commands the server refuses: ${dead.join(', ')}`);
});

test('GR10: the retired wire tokens are gone from the reference, not merely annotated', () => {
	// a wire reference is what a reader copies from — a superseded-but-still-printed line gets sent
	for (const dead of ['cmd:"push"', 'cmd:"apply"', 'body:{action:"put"']) {
		assert.equal(scope.includes(dead), false, `SCOPE.md still prints the dead wire form ${dead}`);
	}
});

test('GR10: the entity block carries the schema the server actually validates', () => {
	/*
	B165 -- this test pinned the defect it was named after.

	The heading it keyed on was `Entities (MVP = exactly four)` while the model had five, so the gate
	was actively holding a false claim in place: correcting the document broke the build.

	Worse, the title overclaimed. It checked the META whitelist only, which is why an entire entity
	kind could be missing from the block for as long as waypoints have existed without anything
	noticing. B96 is called out as the same disease a few lines below this one. The kind check below
	is the assertion the title always promised.
	*/
	const entities = section('Entities (five)');
	assert.equal(entities.includes('"rev"'), false, 'meta.rev died at CS5');
	assert.equal(entities.includes('"grid"'), false, 'meta.grid died at CS5');
	assert.match(entities, /"version"/);
	assert.match(entities, /"schema"/);

	// and the whitelist the server enforces is exactly what the block advertises
	const validate = fs.readFileSync('server/validate.js', 'utf8');
	const whitelist = validate.match(/\[([^\]]*)\]\.includes\(key\)\) return `unknown meta key/);
	assert.ok(whitelist, 'the meta whitelist moved — this assertion needs re-pointing');
	for (const key of whitelist[1].match(/'(\w+)'/g).map((k) => k.slice(1, -1))) {
		assert.ok(entities.includes(`"${key}"`), `meta.${key} is validated but not documented`);
	}

	// every kind the server validates appears in the block, DERIVED rather than listed here --
	// a hand-kept list would drift exactly as the heading did
	const fields = validate.slice(validate.indexOf('const FIELDS = {'));
	const kinds = [...fields.matchAll(/^\t(\w+): \{$/gm)].map((m) => m[1]);
	assert.ok(kinds.length >= 5, `expected the validator to declare at least five kinds, found ${kinds}`);
	for (const kind of kinds) {
		assert.ok(entities.includes(`"${kind}s"`), `${kind} is validated but absent from the entity block`);
	}
	// the heading itself is not inside the section body, so it is read from the whole document
	assert.match(scope, /## Entities \((\w+)\)/, 'the heading states how many kinds there are');
	const said = scope.match(/## Entities \((\w+)\)/)[1];
	const words = { four: 4, five: 5, six: 6, seven: 7 };
	assert.equal(words[said], kinds.length, `the heading says ${said} kinds; the validator declares ${kinds.length}`);
});

/*
H4.6 — the REST surface is DERIVED from the router, exactly as the ws vocabulary is.

Only the websocket was derived, and the gap showed: `/commit` was documented as "the transaction
vocabulary the websocket uses" while taking a legacy single-mutation shape, and README printed a
`-d '{"action":...}'` line an agent would copy and get a 422 from. A token grep would not have found
that; derivation does, which is the whole lesson of X9 (it caught B11 and B12 on its first run).
*/
const rest = fs.readFileSync('server/rest.js', 'utf8');

/*
H9.27: the target is API.md, not README. The REST surface moved because it answers a different
reader -- the README is for an operator, this is for whoever writes something that drives the API.

Worth recording that this guard did its job during the move: both of these failed the moment the
content left README, rather than passing against a file that no longer described the API. A check
naming the file it reads is what makes a relocation loud.
*/
/*
What this covers, stated because the title used to overclaim it (B96 was the same disease).

It derives PATH SEGMENTS. It does not derive method-and-path pairs, so an undocumented method on a
path that is already documented -- a new POST beside an existing GET -- is outside it. That was not
worth fixing at the available price: the router branches on method in sixteen places, several nested
inside a `parts[4]` block and meaningful only in that context, so a mechanical derivation would be a
fragile check that reads as authoritative, which is worse than a narrow one that says it is narrow.
B91 named narrowing the sentence as the legitimate alternative to widening the check; this is that.
*/
test('GR10: every REST path the server answers is documented in API.md', () => {
	/*
	B118 -- the inventory comes from tools/routes.mjs, which is the ONE derivation.

	This test used to work it out for itself, matching `parts[n] === 'x'` only, and so could not see
	`url.pathname === '/health'` or the negative `parts[2] !== 'diagrams'` that guards the whole
	diagram family. The two most-used surfaces in the product were the two it could not check, while
	its name claimed it held every REST path. scan-cli inherited the same derivation and the two
	disagreed -- two scanners deriving one truth differently, which is the twin problem.
	*/
	const readme = fs.readFileSync('docs/spec/API.md', 'utf8');
	const undocumented = inventory(rest).filter((r) => !readme.includes(`/${r}`));
	assert.deepEqual(undocumented, [],
		`REST serves these and API.md never mentions them: ${undocumented.join(', ')}`);
});

test('GR10/B118: the inventory sees all three shapes the router routes on', () => {
	// the guard for the guard: if this derivation narrows again, the coverage it feeds narrows
	// silently, and both GR10 and scan-cli would pass over whatever it stopped seeing
	const names = inventory(rest);
	assert.ok(names.includes('health'), 'a literal url.pathname route');
	assert.ok(names.includes('diagrams'), 'a NEGATIVE parts[n] !== guard');
	assert.ok(names.includes('lock'), 'a positive parts[n] === guard');
	assert.ok(names.includes('nodes'), 'a COLLECTIONS entry');
	for (const prefix of ['v1', 'api', 'connect']) {
		assert.ok(!names.includes(prefix), `${prefix} is a path prefix, not a route anyone drives`);
	}
});

test('GR10: API.md prints no REST body shape the server refuses', () => {
	const readme = fs.readFileSync('docs/spec/API.md', 'utf8');
	// /commit takes { ops: [...] }. The legacy single-mutation form is retired, so README must not
	// print it — a wire reference is what a reader copies, and a superseded line gets sent.
	assert.equal(/-d '\{"action":/.test(readme), false, 'README still prints the retired /commit shape');
	assert.match(readme, /"ops":\[/, 'README must show the shape /commit actually takes');
	// and the precondition header, which is the only way to send `expect` on a forward write
	assert.match(readme, /X-Draw-Expect/, 'expect travels as a header on forward writes and README must say so');
});

test('GR10: every locked decision this arc reversed carries a dated amendment', () => {
	// X5 + X6: the three reversed decisions, each amended in the file's dated form
	const amendments = [...scope.matchAll(/\*\(Amended (\d{4}-\d{2}-\d{2})[^)]*\)\*/g)].map((m) => m[1]);
	assert.ok(amendments.some((d) => d.startsWith('2026-08')), 'this arc amended nothing');

	// undo/redo moved server-side; the server live-pushes changes; the wire is server-authoritative
	assert.match(section('In scope (functions)'), /undo\/redo are a SERVER capability/i);
	assert.match(section('Wire protocol (one websocket) - as shipped'), /\*\(Amended 2026-08/);
	assert.match(scope, /\*\(Amended 2026-08[^)]*\)\* - the REST verb is `\/commit`/);
});

/*
B104 -- API.md states the id grammar, so API.md must state the grammar the server enforces.

A regex copied into prose is a twin, and the failure mode is silent: validate.js gains a kind, the
doc keeps the old list, and an agent written from the doc is refused for a reason the doc denies.
The check is byte-for-byte against the source of truth rather than a re-derivation, so it cannot
drift the way the sentence it guards could.
*/
test('B104: the id grammar in API.md is the one validate.js enforces', () => {
	const api = fs.readFileSync('docs/spec/API.md', 'utf8');
	const src = fs.readFileSync('server/validate.js', 'utf8');
	const live = src.match(/^const ID = \/(.+?)\/;$/m);
	assert.ok(live, 'validate.js no longer declares `const ID` -- this check has lost its subject');
	assert.ok(api.includes(live[1]),
		`API.md does not carry the enforced id grammar. validate.js has ${live[1]}`);

	// and the documented examples must actually pass it, which a hand-written sample need not
	const re = new RegExp(live[1]);
	const block = api.slice(api.indexOf('## What an id looks like'));
	const samples = (block.slice(0, block.indexOf('```', block.indexOf('```text') + 7))
		.match(/\b[a-z]+-[0-9a-f]{6}\b/g) || []);
	assert.ok(samples.length >= 6, `expected the example ids to be found, got ${samples.length}`);
	for (const s of samples) assert.ok(re.test(s), `API.md shows ${s}, which the server would refuse`);
});

/*
B77 / H9.20 (minor half) -- COMMIT.md's index must not contradict its own sections.

H9.20 asked for a general rule: a stated count must not contradict one the repo can compute. Measured
across every document, the population for that rule is almost nothing, and deliberately so. A number
here is normally a MEASUREMENT -- inside `[V, ...]` evidence, in a per-item changelog trail, or in an
audit pinned to a commit hash -- true when made and protected by M4. Re-checking those against today
would report the board's own test-count history as seven defects and be wrong seven times.

The exception is a CLAIM ABOUT NOW, and COMMIT.md's contents table is the one place the repo makes
them: each row says a section holds `X1-Xn`, which asserts that `n` is the highest `X` in the file.
Two were wrong when this was written -- the index read `GR1-GR13` against `GR18`, and `X1-X5` against
`X17` -- so the file's own front page understated its most load-bearing sections.

THE TOP, NOT THE COUNT. `GR14` has no row here (B154), so the guardrails have a gap; a range claim is
about where the ids END, and a retired id in the middle is legitimate. Counting rows instead would
fail on a fact that is not a defect.

READ FROM THE CONTENTS TABLE, not from anywhere the pattern appears. `CS1-CS4 are code-revertible` at
:613 is prose about the first four milestones, not a claim that there are four -- and there are six.
Scoping to the table is the same distinction that made R12 read a column rather than a sentence.
*/
test('B77: every range in COMMIT.md\'s contents table matches the highest id defined below it', () => {
	const src = fs.readFileSync(new URL('../docs/spec/COMMIT.md', import.meta.url), 'utf8');

	/*
	The `## Contents` TABLE ROWS, not the section.

	Reading the whole section failed on the amendment note beneath the table, which quotes the two
	ranges it corrected -- true prose, read as a live claim. Read the rows, not the surrounding
	sentences: the same distinction R12 needed when an entry's Why column explained that an item had
	left the board, and the same one that made B88's lexical form unbuildable.
	*/
	const section = (src.split(/^##\s+Contents\b/m)[1] || '').split(/^##\s/m)[0];
	const table = section.split('\n').filter((l) => l.trimStart().startsWith('|')).join('\n');
	const claims = [...table.matchAll(/\b([A-Z]{1,2})1-\1(\d+)\b/g)].map((m) => [m[1], Number(m[2])]);
	assert.ok(claims.length >= 5, 'the contents table stopped declaring ranges — this check just went vacuous');

	for (const [prefix, top] of claims) {
		// a definition is a heading (`### D1 - ...`) or a table row (`| **I1** | ...`); the sections
		// genuinely use both, and picking one style silently skips whichever section uses the other
		const ids = [
			...src.matchAll(new RegExp(`^###\\s+${prefix}(\\d+)\\b`, 'gm')),
			...src.matchAll(new RegExp(`^\\|\\s*\\*\\*${prefix}(\\d+)`, 'gm')),
		].map((m) => Number(m[1]));
		assert.ok(ids.length, `the contents table claims ${prefix}1-${prefix}${top} and no ${prefix} is defined anywhere`);
		assert.equal(Math.max(...ids), top,
			`the index says ${prefix}1-${prefix}${top} but the highest ${prefix} in the file is ${prefix}${Math.max(...ids)}`);
	}
});
