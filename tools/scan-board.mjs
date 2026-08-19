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

const BOARD = 'docs/BOARD.md';
const BACKLOG = 'docs/BACKLOG.md';

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
	const verdict = /^\s*\*\*(CLOSED|Closed)?\s*(H\d)?/.exec(disposition) || [];
	rows.set(m[1], { closes: verdict[2] || null, closed: !!verdict[1] });
}

// ---- BOARD: milestone headings, and the item rows that cite a B row
const milestones = new Set([...board.matchAll(/^##\s+(H\d)\b/gm)].map((m) => m[1]));
const cited = new Set();
const items = [];         // { h, ids: [Bnn], done: bool }
for (const line of board.split('\n')) {
	const m = /^\|\s*(H\d\.\d+)\s*\|/.exec(line);
	const ids = [...line.matchAll(/\*\*(B\d+)\*\*/g)].map((x) => x[1]);
	ids.forEach((id) => cited.add(id));
	if (m && ids.length) items.push({ h: m[1], ids, done: /`DONE`/.test(line) });
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
