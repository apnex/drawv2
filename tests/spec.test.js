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
	const wire = reference('Wire protocol (one websocket) — as shipped');
	const missing = dispatched().filter((cmd) => !wire.includes(`\`${cmd}`) && !wire.includes(`"${cmd}"`));
	assert.deepEqual(missing, [], `undocumented ws commands: ${missing.join(', ')}`);
});

test('GR10: SCOPE.md documents no command the server has stopped answering', () => {
	// only the REFERENCE, not the amendment below it: an amendment's job is to NAME the commands
	// it retired, so scanning it would make the file permanently unfixable.
	const wire = reference('Wire protocol (one websocket) — as shipped');
	const live = new Set(dispatched());
	// what the section claims the CLIENT may send: `{cmd:"x"` and the management back-tick list
	const claimed = new Set([
		...[...wire.matchAll(/\{cmd:"([a-z]+)"/g)].map((m) => m[1]),
		...[...wire.matchAll(/`([a-z]+) \{/g)].map((m) => m[1]),
	]);
	// server→client reply names are not dispatched commands
	for (const reply of ['snapshot', 'sync', 'ack', 'change', 'error', 'diagrams', 'lock']) claimed.delete(reply);
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
	const entities = section('Entities (MVP = exactly four)');
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
});

test('GR10: every locked decision this arc reversed carries a dated amendment', () => {
	// X5 + X6: the three reversed decisions, each amended in the file's dated form
	const amendments = [...scope.matchAll(/\*\(Amended (\d{4}-\d{2}-\d{2})[^)]*\)\*/g)].map((m) => m[1]);
	assert.ok(amendments.some((d) => d.startsWith('2026-08')), 'this arc amended nothing');

	// undo/redo moved server-side; the server live-pushes changes; the wire is server-authoritative
	assert.match(section('In scope (functions)'), /undo\/redo are a SERVER capability/i);
	assert.match(section('Wire protocol (one websocket) — as shipped'), /\*\(Amended 2026-08/);
	assert.match(scope, /\*\(Amended 2026-08[^)]*\)\* — the REST verb is `\/commit`/);
});
