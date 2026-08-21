#!/usr/bin/env node
/*
scan-board — GR14. The executable form of the BOARD↔BACKLOG contract (docs/BOARD.md).

Two registers, deliberately different in kind: `docs/BACKLOG.md` is the durable record
(append-and-close, evidenced, nothing deleted), `docs/BOARD.md` is the mutable plan (reorderable,
rescored, cleared when an arc ends). That split is the point — and it is also the failure mode.
A mutable file is where a deferral goes to die: the axiom review of 2026-08-19 found three findings
that existed ONLY in conversation or ONLY in the board, which is A14 Insight Depreciation and a
breach of BACKLOG's own "a row is required whenever a design decision defers work".

The contract has five rules. Three of them are decidable from the text, so they are checked here
rather than by a human re-reading both files on every commit:

  R1  every `B` row cited on the board exists in the BACKLOG
  R2  every `Closes H<n>` in the BACKLOG names a milestone that exists on the board
  R3  a board item marked DONE has a CLOSED BACKLOG row, and vice versa — this is contract rule 2
      ("closing a board item closes its B row in the same commit"), the one that silently rots
      first because closing two files is two actions and only one of them is satisfying

Rules 4 (dropped items keep a trigger) and 5 (a fix ships with a test proven red) are judgement,
not text, and are deliberately NOT faked here — a check that cannot decide is worse than none.

Usage: node tools/scan-board.mjs
*/

import fs from 'node:fs';

// `--root <dir>` so the rules can be driven over fixtures. Without it the only way to prove R5
// and R6 FAIL correctly is to corrupt the real board, and a check whose failure path is untested
// is what B77 and B78 both were.
const rootArg = process.argv.indexOf('--root');
const DIR = rootArg > -1 ? `${process.argv[rootArg + 1]}/` : '';
const BOARD = `${DIR}docs/BOARD.md`;
const BACKLOG = `${DIR}docs/BACKLOG.md`;

const board = fs.readFileSync(BOARD, 'utf8');
const backlog = fs.readFileSync(BACKLOG, 'utf8');

// ---- BACKLOG: a row is a table line whose first cell is **Bnn**; its LAST cell is the disposition
const rows = new Map();   // id -> { closes: 'H1' | null, closed: bool }
for (const line of backlog.split('\n')) {
	const m = /^\|\s*\*\*(B\d+)\*\*\s*\|/.exec(line);
	if (!m) continue;
	const cells = line.split('|').map((c) => c.trim());
	const disposition = cells[cells.length - 2] || '';
	/*
	Anchored and bold-prefixed, both learned from this scanner's own first run, which produced two
	findings and both were false:
	  - a loose /\bCLOSED\b/i matched the literal `closed` inside B30's "carry `via`/`closed`";
	  - a loose /\bH(\d)/ matched the PROSE "…it is B19, closing H4" in B7, reading a cross-reference
	    as a milestone promise.
	The register's actual convention is that a disposition OPENS with its verdict in bold —
	`**H3.** …`, `**CLOSED H1.1** …`, `**Closed CS1** …`, `**Open. REVIVAL TRIGGER…** …`. Matching
	the convention instead of the keyword is what makes the two distinguishable.
	*/
	const verdict = /^\s*\*\*(CLOSED|Closed)?\s*(H\d+)?/.exec(disposition) || [];
	rows.set(m[1], { closes: verdict[2] || null, closed: !!verdict[1] });
}

// ---- BOARD: milestone headings, and the item rows that cite a B row
const milestones = new Set([...board.matchAll(/^##\s+(H\d+)\b/gm)].map((m) => m[1]));
const cited = new Set();
const items = [];         // { h, ids: [Bnn], done: bool } -- CITING rows only, for R1/R3
const allRows = [];       // EVERY item row, for R5/R6 (B77)
for (const line of board.split('\n')) {
	const m = /^\|\s*(H\d+\.\d+)\s*\|/.exec(line);
	const ids = [...line.matchAll(/\*\*(B\d+)\*\*/g)].map((x) => x[1]);
	ids.forEach((id) => cited.add(id));
	if (m) {
		// The board carries two conventions and both are legitimate. H0-H5 and H7-H10 put the state
		// in a trailing Status column; H6's table is `# | Stage | Risk | Proof` and prefixes the
		// Stage cell instead. Requiring the last cell would have forced a rewrite of a milestone
		// that closed months ago, so the rule is that a row DECLARES a state, and the last token
		// wins where a row somehow carries two.
		const tokens = [...line.matchAll(/`(DONE|TODO|WIP|BLOCKED)`/g)].map((x) => x[1]);
		allRows.push({ h: m[1], state: tokens.length ? tokens[tokens.length - 1] : null, line });
		if (ids.length) items.push({ h: m[1], ids, done: /`DONE`/.test(line) });
	}
}
// citations outside item tables (the ledger, the held list, prose) still count for R1
for (const x of board.matchAll(/\*\*(B\d+)\*\*/g)) cited.add(x[1]);

let bad = 0;
const fail = (msg) => { console.log(`  \u2717 ${msg}`); bad++; };

// R1 — no board item points at a row that does not exist
for (const id of [...cited].sort()) {
	if (!rows.has(id)) fail(`${BOARD} cites ${id}, which has no row in ${BACKLOG}`);
}

// R2 — no BACKLOG row promises a milestone the board does not have
for (const [id, r] of rows) {
	if (r.closes && !milestones.has(r.closes)) {
		fail(`${BACKLOG} ${id} closes at ${r.closes}, which is not a milestone in ${BOARD}`);
	}
}

/*
R4 — a milestone marked DONE has no unfinished items.

R3 compares each item against its row, which is why it stayed silent while H3 read DONE with three
TODO items under it: every individual pair AGREED (item TODO, row open). Agreement is not
completion. The heading is the thing a reader trusts at a glance, so it is the thing most worth
checking, and it was the one thing nothing checked.
*/
const milestoneState = {};
for (const m of board.matchAll(/^##\s+(H\d+)[^\n]*?`(\w+)`/gm)) milestoneState[m[1]] = m[2];

/*
R5 — every item row declares a state, in the last cell (B77).

R4 read `items`, which holds only rows that cite a B row, so an uncited row was invisible to it.
H2.3 had FOUR cells where the table has five, its state column held prose, and R4 could not see
that either: the row cites nothing, so it was never in the list R4 iterates. A row with no state
is not a neutral omission -- R6 below has to count it as something, and a reader takes the absence
as whatever the surrounding rows imply.
*/
for (const r of allRows) {
	if (!r.state) fail(`${BOARD} ${r.h} declares no state in its last cell — DONE, TODO, WIP or BLOCKED`);
}

/*
R6 — a milestone heading agrees with the states beneath it (B77).

R4 checked one direction over a subset: a DONE heading with an open CITING item. It could not see
the case that actually shipped, which was H9 reading `TODO` above thirteen DONE items for most of
a session. The heading is what a reader takes first, so a milestone that has largely landed while
announcing it has not started is the most misleading state the board can be in.

Both directions, over every row rather than the citing ones:
  DONE  every item done          -- nothing left, or the heading lies
  TODO  no item done             -- work has begun, so the heading is stale
  WIP   at least one of each     -- otherwise it is TODO or DONE and should say so
*/
const perMilestone = {};
for (const r of allRows) {
	const h = r.h.split('.')[0];
	(perMilestone[h] ||= { done: 0, open: 0 })[r.state === 'DONE' ? 'done' : 'open']++;
}
for (const [h, n] of Object.entries(perMilestone)) {
	const st = milestoneState[h];
	if (!st) continue;
	if (st === 'DONE' && n.open) fail(`${BOARD} ${h} is marked DONE with ${n.open} item(s) still open — a heading a reader trusts must be true`);
	if (st === 'TODO' && n.done) fail(`${BOARD} ${h} is marked TODO with ${n.done} item(s) already DONE — the heading is stale`);
	if (st === 'WIP' && !n.done) fail(`${BOARD} ${h} is marked WIP with nothing DONE — it is TODO`);
	if (st === 'WIP' && !n.open) fail(`${BOARD} ${h} is marked WIP with nothing open — it is DONE`);
}

// R3 — DONE and CLOSED move together (contract rule 2)
for (const it of items) {
	for (const id of it.ids) {
		const r = rows.get(id);
		if (!r) continue;                                  // already reported by R1
		// Only rows that PROMISE a milestone are bound by rule 2. A board item may legitimately
		// touch a row without closing it — H0.2 amended B7's text, and B7 stays open on its
		// revival trigger. Demanding closure there was this scanner's second false positive.
		if (!r.closes) continue;
		if (it.done && !r.closed) {
			fail(`${BOARD} ${it.h} is DONE but ${BACKLOG} ${id} is not marked CLOSED — rule 2 says they move in the same commit`);
		}
		if (!it.done && r.closed) {
			fail(`${BACKLOG} ${id} is CLOSED but ${BOARD} ${it.h} is not marked DONE — the plan still shows work that the record says is finished`);
		}
	}
}

// The broken-scan floor. A scan that matches nothing is a false green: the tables were reformatted,
// the heading style changed, or a rename made the patterns stale. These registers HAVE rows — and
// this floor is the reason GR12 and GR5 were hollow for a whole arc (X13).
if (rows.size === 0) fail(`no BACKLOG rows matched at all — the scan is broken, not the register empty`);
if (cited.size === 0) fail(`no board citations matched at all — the scan is broken, not the board empty`);
if (milestones.size === 0) fail(`no board milestones matched at all — the scan is broken`);

console.log(`  scan-board: ${rows.size} row(s), ${cited.size} citation(s), ${milestones.size} milestone(s), ${items.length} item(s)`);
if (bad) {
	console.log(`\n  FAIL — ${bad} BOARD/BACKLOG contract violation(s). The plan and the record disagree.\n`);
	process.exit(1);
}
console.log('  PASS — every citation resolves; every milestone exists; DONE and CLOSED agree\n');
