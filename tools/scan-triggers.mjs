#!/usr/bin/env node
/*
scan-triggers -- G1 and G2 of H21.5 (dev/design/unification/RECORD-GUARDS.md sections 3.1 and 3.2). A held row's revival
trigger, read and evaluated where a machine can decide it, and the board's Held column generated from the rows.

The re-audit counted eight triggers that fired with nobody noticing -- a trigger is a sentence, and nothing re-reads a sentence.
Measured against the 28 held rows, a third carry a decidable half; the rest are judgement, and are left judgement.

  THE CURRENT TRIGGER  the text after a row's last `REVIVAL TRIGGER now:`, else after its last `REVIVAL TRIGGER:` before any
                       `Was:` -- the label matched without regard to case, with an optional parenthetical before its colon --
                       ending at the next `AMENDED`, `CORRECTED`, `Was:` or `WHEN:`. It must be the last clause of its cell,
                       with nothing after it but its `WHEN`: a note appended after a trigger restates the trigger
                       (`AMENDED <date>: REVIVAL TRIGGER now: <prose>`), so the current one is never in doubt.
  WHEN                 `` WHEN: `<expression>` ``, predicates joined by `and` (binding tighter) and `or`:
                         row B<n> planned                  a board item not DONE or DROPPED cites the row
                         absent <path>                     the path is not in `git ls-files`
                         count /<regex>/ in <glob> >= <n>  matching lines across the tracked files the glob names
                       the glob a git pathspec with glob magic (`*` stops at `/`, `**` does not); a pipe written `\x7c`

Fails the gate on: a held row with no current trigger (RU3); a current trigger that is not the last clause; a malformed
expression; a Held trigger cell that differs from its row's trigger (G2); a milestone newly marked DONE -- against the merge base
with origin/main, else HEAD -- while any trigger has fired. Prints, every run: each fired trigger; and at a milestone's close,
every held trigger, so the judgement ones are re-read.

An expression that cannot be evaluated -- a row that does not exist, a glob that names no file -- counts as FIRED, never as a
pass and never as a failure: a moved file shows itself without failing an unrelated commit.

Usage: node tools/scan-triggers.mjs [--root <dir>] [--write]
  --root   the repository to read (a git work tree), so the rules can be driven over a fixture repository
  --write  rewrite the Held table's trigger column from the rows, then check
*/

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { splitCells, readRows, readItems, heldRows } from './records.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = arg('--root') ?? '.';
const WRITE = process.argv.includes('--write');
const BOARD = path.join(ROOT, 'dev/BOARD.md');
const BACKLOG = path.join(ROOT, 'dev/BACKLOG.md');
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

let bad = 0;
const fail = (msg) => { console.log(`  \u2717 ${msg}`); bad++; };

// ---- the current trigger of a disposition: { prose, when, rest } or null
function currentTrigger(disposition) {
	const label = /REVIVAL TRIGGER(\s+now)?\s*(\([^)]*\))?\s*:/gi;
	const wasAt = disposition.search(/\bWas:/);
	let now = null, plain = null;
	for (const m of disposition.matchAll(label)) {
		if (m[1]) now = m;
		else if (wasAt < 0 || m.index < wasAt) plain = m;
	}
	const m = now ?? plain;
	if (!m) return null;
	const after = disposition.slice(m.index + m[0].length);
	const end = after.search(/\bAMENDED\b|\bCORRECTED\b|\bWas:|\bWHEN:/);
	const prose = (end < 0 ? after : after.slice(0, end)).trim().replace(/\*\*$/, '').trim();
	const tail = end < 0 ? '' : after.slice(end);
	const w = /^WHEN:\s*`([^`]*)`\s*$/.exec(tail.trim());
	return { prose, when: w ? w[1] : null, rest: w ? '' : tail.trim() };
}

// ---- an expression: an array of or-clauses, each an array of predicates; throws on a malformed one
function parseWhen(text) {
	const regexes = [];
	const masked = text.replace(/count \/(.*?)\/ in /g, (_, re) => { regexes.push(re); return `count \u0000${regexes.length - 1}\u0000 in `; });
	return masked.split(/\s+or\s+/).map((clause) => clause.split(/\s+and\s+/).map((p) => {
		p = p.trim();
		let m;
		if ((m = /^row (B\d+) planned$/.exec(p))) return { kind: 'planned', id: m[1], text: p };
		if ((m = /^absent (\S+)$/.exec(p))) return { kind: 'absent', path: m[1], text: p };
		if ((m = /^count \u0000(\d+)\u0000 in (\S+) >= (\d+)$/.exec(p))) {
			const source = regexes[Number(m[1])];
			return { kind: 'count', re: new RegExp(source), glob: m[2], n: Number(m[3]), text: `count /${source}/ in ${m[2]} >= ${m[3]}` };
		}
		throw new Error(`"${p.replace(/\u0000(\d+)\u0000/g, (_, i) => `/${regexes[Number(i)]}/`)}" is not a predicate -- row B<n> planned, absent <path>, count /<regex>/ in <glob> >= <n>`);
	}));
}

// ---- one predicate's value: true, false, or { unevaluable: why }
function evaluate(p, { rows, items }) {
	if (p.kind === 'planned') {
		if (!rows.has(p.id)) return { unevaluable: `${p.id} is not a row` };
		return items.some((it) => it.state !== 'DONE' && it.state !== 'DROPPED' && it.ids.includes(p.id));
	}
	if (p.kind === 'absent') return git('ls-files', '--', p.path).trim() === '';
	if (p.kind === 'count') {
		const files = git('ls-files', '-z', '--', `:(glob)${p.glob}`).split('\0').filter(Boolean);
		if (!files.length) return { unevaluable: `${p.glob} names no tracked file` };
		let n = 0;
		for (const f of files) for (const line of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) if (p.re.test(line)) n++;
		return n >= p.n;
	}
	return { unevaluable: 'unknown predicate' };
}

// an expression's value, and the predicates that made it so
function fired(expr, ctx) {
	for (const clause of expr) {
		const values = clause.map((p) => [p, evaluate(p, ctx)]);
		if (values.every(([, v]) => v === true || v?.unevaluable)) {
			return values.map(([p, v]) => (v?.unevaluable ? `${p.text} (cannot be evaluated: ${v.unevaluable})` : p.text)).join(' and ');
		}
	}
	return null;
}

// ---- the Held table, its trigger column generated from the rows (G2)
function generateHeld(boardText, rows) {
	const lines = boardText.split('\n');
	for (const h of heldRows(boardText)) {
		const t = rows.has(h.id) ? currentTrigger(rows.get(h.id).disposition) : null;
		if (!t) continue;
		const [, id, sev, label] = h.cells;
		lines[h.index] = `| ${id} | ${sev} | ${label} | ${t.prose} |`;
	}
	return lines.join('\n');
}

const milestoneStates = (text) => new Map([...text.matchAll(/^##\s+(H\d+)\b.*`(DONE|WIP|TODO|BLOCKED|DROPPED)`\s*$/gm)].map((m) => [m[1], m[2]]));

function base() {
	try { return git('merge-base', 'HEAD', 'origin/main').trim(); } catch { /* no remote */ }
	try { return git('rev-parse', 'HEAD').trim(); } catch { return null; }
}

// ---- run
{
	let board = fs.readFileSync(BOARD, 'utf8');
	const rows = readRows(fs.readFileSync(BACKLOG, 'utf8'));
	if (WRITE) {
		const next = generateHeld(board, rows);
		if (next !== board) { fs.writeFileSync(BOARD, next); console.log(`  wrote the Held trigger column of ${BOARD}`); board = next; }
	}
	const ctx = { rows, items: readItems(board) };
	const held = heldRows(board);
	const firedList = [];
	const triggers = [];
	for (const h of held) {
		const row = rows.get(h.id);
		if (!row) continue;   // scan-board's R1 reports a missing row
		const t = currentTrigger(row.disposition);
		if (!t || !t.prose) { fail(`${h.id} is held with no current trigger -- a held row carries \`REVIVAL TRIGGER: <an observable condition>\` (RU3)`); continue; }
		if (t.rest) fail(`${h.id}'s current trigger is not the last clause of its row ("${t.rest.slice(0, 60)}...") -- append \`AMENDED <date>: REVIVAL TRIGGER now: <prose>\` restating it`);
		triggers.push([h.id, t]);
		if (h.cells[h.cells.length - 2] !== t.prose || h.cells.length !== 6) {
			fail(`the Held trigger cell of ${h.id} differs from its row's current trigger -- the column is generated: node tools/scan-triggers.mjs --write`);
		}
		if (t.when !== null) {
			let expr;
			try { expr = parseWhen(t.when); } catch (e) { fail(`${h.id}'s WHEN is malformed: ${e.message}`); continue; }
			const why = fired(expr, ctx);
			if (why) firedList.push([h.id, why]);
		}
	}
	for (const [id, why] of firedList) console.log(`  ! ${id}'s trigger fired (${why}) -- re-triage it: plan the row, or hold it again with a trigger not yet true`);
	// a milestone newly DONE, against the base
	const at = base();
	let closing = [];
	if (at) {
		let before = '';
		try { before = git('show', `${at}:dev/BOARD.md`); } catch { /* the board is new */ }
		const was = milestoneStates(before), now = milestoneStates(board);
		closing = [...now].filter(([h, s]) => s === 'DONE' && was.has(h) && was.get(h) !== 'DONE').map(([h]) => h);
	}
	if (closing.length) {
		console.log(`  closing ${closing.join(', ')}: re-read every held trigger -- the judgement ones are no machine's to decide:`);
		for (const [id, t] of triggers) console.log(`    ${id}: ${t.prose}${t.when !== null ? `  [WHEN evaluated: ${firedList.some(([f]) => f === id) ? 'FIRED' : 'not fired'}]` : ''}`);
		if (firedList.length) fail(`${closing.join(', ')} closes while ${firedList.length} trigger(s) have fired (${firedList.map(([id]) => id).join(', ')}) -- re-triage them before the close`);
	}
	const machine = triggers.filter(([, t]) => t.when !== null).length;
	console.log(`  scan-triggers: ${held.length} held row(s), ${machine} with a WHEN, ${firedList.length} fired`);
	if (bad) {
		console.log(`  FAIL -- ${bad} finding(s). The trigger contract is dev/design/unification/RECORD-GUARDS.md section 3.1.`);
		process.exit(1);
	}
	console.log('  PASS -- every held row carries one current trigger, last in its row; the Held column is its rows\'; no milestone closes over a fired trigger');
}
