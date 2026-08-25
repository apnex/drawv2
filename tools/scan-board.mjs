#!/usr/bin/env node
/*
scan-board — GR14. The executable form of the BOARD↔BACKLOG contract (docs/BOARD.md).

Two registers, deliberately different in kind: `docs/BACKLOG.md` is the durable record
(append-and-close, evidenced, nothing deleted), `docs/BOARD.md` is the mutable plan (reorderable,
rescored, cleared when an arc ends). That split is the point — and it is also the failure mode.
A mutable file is where a deferral goes to die: the axiom review of 2026-08-19 found three findings
that existed ONLY in conversation or ONLY in the board, which is A14 Insight Depreciation and a
breach of BACKLOG's own "a row is required whenever a design decision defers work".

The contract has five rules. Most of them are decidable from the text, so they are checked here
rather than by a human re-reading both files on every commit:

  R1  every `B` row cited on the board exists in the BACKLOG
  R2  every `Closes H<n>` in the BACKLOG names a milestone that exists on the board
  R3  a board item marked DONE has a CLOSED BACKLOG row, and vice versa — this is contract rule 2
      ("closing a board item closes its B row in the same commit"), the one that silently rots
      first because closing two files is two actions and only one of them is satisfying
  R4  a milestone marked DONE has no unfinished items
  R5  every item row declares a state
  R6  a milestone heading agrees with the states beneath it, in both directions
  R7  a disposition opens with a verdict from a closed set — an unknown opener is an ERROR
  R8  a live row is an item on the board or a declared entry under Held, never an absence
  R9  a row listed under Held is not one the register records as settled
  R10 a row has the six fields the table declares

Rules 4 (dropped items keep a trigger) and 5 (a fix ships with a test proven red) of the CONTRACT —
as distinct from R4/R5 above — are judgement, not text, and are deliberately NOT faked here: a
check that cannot decide is worse than none.

R1-R6 all read the BOARD. R7-R10 exist because nothing read the REGISTER with the same suspicion,
and B122 is what that cost: the verdict parser matched a bold-keyword convention the register
abandoned at B61, so R2 and R3 were vacuous over 51 of 121 rows — the whole of H9 and H10 — and the
summary line went on printing a correct count of a quantity the rules did not consume.

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

let bad = 0;
const fail = (msg) => { console.log(`  \u2717 ${msg}`); bad++; };

const board = fs.readFileSync(BOARD, 'utf8');
const backlog = fs.readFileSync(BACKLOG, 'utf8');

/*
---- BACKLOG: a row is a table line whose first cell is **Bnn**; its LAST cell is the disposition.

`splitCells` honours `\|`, which is the only thing markdown honours. A pipe inside a code span is
STILL a cell break in a GFM table, so the rows that carried one were mis-rendering on GitHub as
well as mis-parsing here: B113 wrote absolute-value bars as `|x| 840, |y| 480` and its disposition
read as the fragment *480, so it cost nothing*; B77 quoted `# | Stage | Risk | Proof`; B36 ended
in a stray empty cell. All four are repaired at the source rather than worked around, because a
parser that tolerates a malformed table hides the fact that the table is malformed.

Tracking code spans was the first attempt and it is worse: it cannot survive a double-backtick span
(B13's `` $` ``) or a stray backtick (B119 wrote ``verb`s`` for *verb's*), and both of those made
whole rows silently unreadable. Escapes are the rule; anything else is a guess about intent.
*/
const splitCells = (line) => line.split(/(?<!\\)\|/).map((c) => c.trim());

/*
The verdict vocabulary, as a CLOSED SET.

The previous parser anchored on a bold keyword — `^\s*\*\*(CLOSED|Closed)?\s*(H\d+)?` — and the
register stopped emboldening at B61 and started writing `FIXED` at B100. Measured at the time this
was fixed: 51 of 121 dispositions read as closed to a human and as open to the scanner, so R2 and
R3 skipped every row of the H9 and H10 arcs while the summary printed a correct row count. That
count is what sold it — right, complete, and about a different quantity than the rules consumed.

So the lesson is not "add FIXED to the alternation", which fixes today's spelling and nothing else.
It is that an unrecognised opener must be an ERROR (R7). Fail-closed: the next time the register
invents a word, the gate says so instead of quietly reclassifying a third of the file as open.

DONE      the matter is settled; the row is a record, not a plan
REMAINDER settled in part, with the rest stated in the row — still owed a place on the board
LIVE      not settled; must appear on the board or under Held (R8)
*/
const VERDICTS = new Map([
	['CLOSED', 'DONE'], ['FIXED', 'DONE'], ['RULED', 'DONE'], ['WITHDRAWN', 'DONE'],
	["WON'T DO", 'DONE'], ['DROPPED', 'DONE'],
	['PART-CLOSED', 'REMAINDER'],
	['OPEN', 'LIVE'], ['DEFERRED', 'LIVE'], ['HELD', 'LIVE'],
	// DROPPED is settled, not open: contract rule 4 permits dropping an item so long as the row
	// carries the reason as a revival trigger, which is a record and not a plan.
	['DROPPED', 'DONE'],
]);

const rows = new Map();   // id -> { closes: 'H1' | null, closed: bool, live: bool, verdict }
const unparsed = [];
for (const line of backlog.split('\n')) {
	const m = /^\|\s*\*\*(B\d+)\*\*\s*\|/.exec(line);
	if (!m) continue;
	const cells = splitCells(line);
	/*
	R10 — a row has the columns the table declares: `# | Row | Evidence | Closes / Trigger`, which
	with the leading and trailing pipes is six fields. Checked before anything reads a cell, because
	every rule downstream indexes from the end and a miscounted row silently hands them the wrong
	text rather than no text (B122). An unescaped pipe is the only way this fires.
	*/
	if (cells.length !== 6) {
		fail(`${BACKLOG} ${m[1]} splits into ${cells.length} fields where the table declares 6 — an unescaped \`|\` in prose or a code span. Write it as \`\\|\``);
		continue;
	}
	const disposition = cells[cells.length - 2] || '';
	/*
	`closes` is still anchored rather than loose, which the scanner's own first run earned twice:
	  - a loose /\bCLOSED\b/i matched the literal `closed` inside B30's "carry `via`/`closed`";
	  - a loose /\bH(\d)/ matched the PROSE "…it is B19, closing H4" in B7, reading a cross-reference
	    as a milestone promise.
	A milestone is read only from the opening clause, before the first sentence ends.
	*/
	// Longest-prefix match, not a word match: the vocabulary contains a hyphen (`PART-CLOSED`) and a
	// space (`WON'T DO`), and any rule that stops at a word boundary reads those as `PART` and `WON`.
	const opener = disposition.replace(/^[\s*]+/, '').toUpperCase();
	let verdict = null;
	for (const key of VERDICTS.keys()) {
		if (!opener.startsWith(key)) continue;
		if (/[A-Z']/.test(opener[key.length] || ' ')) continue;   // OPENED must not match OPEN
		if (!verdict || key.length > verdict.length) verdict = key;
	}
	/*
	A bare `**H1**` opener is a PROMISE, not a verdict: it says where the row will close, and says
	nothing about whether it has. That is the semantic R3 was built on and `tests/gate.test.js`
	pins it, so it stays. Treating it as settled was this change's own first regression, caught by
	the B92 fixture -- which is the argument for that fixture existing.
	*/
	const bare = /^\s*\*\*(H\d+)\*\*/.exec(disposition);
	if (!verdict && !bare) unparsed.push([m[1], disposition.slice(0, 60)]);
	// An unparsed row is still a row. Dropping it made R1 report six phantom "cites a row that does
	// not exist" failures for rows plainly present, which is a scanner blaming the board for its own
	// blind spot -- the exact move B107 is about.
	const kind = verdict ? VERDICTS.get(verdict) : (bare ? 'LIVE' : 'UNKNOWN');
	const closes = (/^[^.]*?\b(H\d+)\b/.exec(disposition) || [])[1] || null;
	rows.set(m[1], { closes, closed: kind === 'DONE', live: kind === 'LIVE', remainder: kind === 'REMAINDER', verdict: verdict || (bare && bare[1]) || null });
}

// ---- BOARD: milestone headings, and the item rows that cite a B row
const milestones = new Set([...board.matchAll(/^##\s+(H\d+)\b/gm)].map((m) => m[1]));
const cited = new Set();
const items = [];         // { h, ids: [Bnn], done: bool } -- CITING rows only, for R1/R3
const allRows = [];       // EVERY item row, for R5/R6 (B77)
for (const line of board.split('\n')) {
	// B92: the letter suffix is part of the board's own convention -- H9.2a/b/c, H9.3a/b/c, H9.4b/c/d
	// are items, and a pattern ending at the digits exempted all nine from R1, R3, R5 and R6. This is
	// B78 in the same file, where a single-digit milestone class could not match H10: an id pattern
	// narrower than the board's convention exempts rows instead of erroring, so the gate stays green.
	const m = /^\|\s*(H\d+\.\d+[a-z]?)\s*\|/.exec(line);
	const ids = [...line.matchAll(/\*\*(B\d+)\*\*/g)].map((x) => x[1]);
	ids.forEach((id) => cited.add(id));
	if (m) {
		// The board carries two conventions and both are legitimate. H0-H5 and H7-H10 put the state
		// in a trailing Status column; H6's table is `# | Stage | Risk | Proof` and prefixes the
		// Stage cell instead. Requiring the last cell would have forced a rewrite of a milestone
		// that closed months ago, so the rule is that a row DECLARES a state, and the last token
		// wins where a row somehow carries two.
		const tokens = [...line.matchAll(/`(DONE|TODO|WIP|BLOCKED|DROPPED)`/g)].map((x) => x[1]);
		allRows.push({ h: m[1], state: tokens.length ? tokens[tokens.length - 1] : null, line });
		if (ids.length) items.push({ h: m[1], ids, done: /`(DONE|DROPPED)`/.test(line) });
	}
}
// citations outside item tables (the ledger, the held list, prose) still count for R1
for (const x of board.matchAll(/\*\*(B\d+)\*\*/g)) cited.add(x[1]);

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
	// DROPPED counts with DONE: both are settled, and a milestone is not WIP because it
	// contains an item somebody decided not to build.
	(perMilestone[h] ||= { done: 0, open: 0 })[r.state === 'DONE' || r.state === 'DROPPED' ? 'done' : 'open']++;
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
		// A REMAINDER row is exempt from BOTH directions and answers to R8 instead. `PART-CLOSED`
		// means an item legitimately closed while work remains, so demanding the row be CLOSED
		// would punish the one convention that records a remainder honestly (B83, B33).
		if (r.remainder) continue;
		if (it.done && !r.closed) {
			fail(`${BOARD} ${it.h} is DONE but ${BACKLOG} ${id} is not marked CLOSED — rule 2 says they move in the same commit`);
		}
		if (!it.done && r.closed) {
			fail(`${BACKLOG} ${id} is CLOSED but ${BOARD} ${it.h} is not marked DONE — the plan still shows work that the record says is finished`);
		}
	}
}

/*
R7 — every disposition opens with a verdict the scanner knows (B122).

Fail-closed, and that is the whole point of the rule. The previous parser answered "not closed" for
any spelling it did not recognise, so a vocabulary drift disabled R2 and R3 over 51 rows without
changing a single line of output. An unrecognised opener is now an error, so the next drift costs
one commit at the moment it happens instead of an arc of silent exemption.
*/
for (const [id, disposition] of unparsed) {
	fail(`${BACKLOG} ${id} opens its disposition with a verdict this scanner does not know — "${disposition}…". Use one of: ${[...VERDICTS.keys()].join(', ')}`);
}

/*
R8 — a live row is on the board, or declared Held (B123).

The mirror of R1, and the direction that was missing. R1 asks whether a board item points at a real
row; nothing asked whether a real row reached the plan. Contract rule 3 states the obligation — an
open row with a revival trigger is listed under Held "so the comparison is explicit rather than
implied by absence" — and absence is exactly what went unchecked: B108, B109 and B117 were open and
on neither list, and B117's work had already shipped while its row stayed open.

Held is read as a table under the `## Held` heading, so it is a declared list rather than a section
a reader recognises. A REMAINDER row (`PART-CLOSED`) is live for this rule: the part that closed is
recorded, the part that did not still needs somewhere to be planned.
*/
// Bounded to the FIRST table under the heading, not the whole section: the section also carries a
// `Cleared` table recording rows that stopped being held, and reading those as held inverts the
// rule -- it would report every settled row as an undischarged deferral.
const heldSection = (board.split(/^##\s+Held\b/m)[1] || '').split(/^##\s/m)[0];
const held = new Set();
let inTable = false;
for (const line of heldSection.split('\n')) {
	const row = /^\|\s*\*\*(B\d+)\*\*\s*\|/.exec(line);
	if (row) { inTable = true; held.add(row[1]); continue; }
	if (inTable && !line.trimStart().startsWith('|')) break;
}
const openItemsFor = (id) => items.filter((it) => !it.done && it.ids.includes(id));
for (const [id, r] of rows) {
	if (r.live && !cited.has(id) && !held.has(id)) {
		fail(`${BACKLOG} ${id} is ${r.verdict} and appears nowhere in ${BOARD} — a live row is an item on the board or a declared entry under Held, never an absence`);
	}
	/*
	A remainder needs an OPEN item, not merely a citation. `PART-CLOSED` states that work is left,
	so a row cited only by the DONE item that closed the other half reads, at a glance, as finished.
	This is the weaker form of the same absence R8 exists to catch.
	*/
	if (r.remainder && !held.has(id) && !openItemsFor(id).length) {
		fail(`${BACKLOG} ${id} is PART-CLOSED but every ${BOARD} item citing it is DONE — the remainder has no place in the plan`);
	}
}

/*
R9 — a Held entry is a live row.

The other half of R8. A row that closes while sitting under Held leaves the board advertising a
deferral that no longer exists, which is how B6, B9, B32 and B33 came to be listed as held work
after they were done.
*/
for (const id of held) {
	const r = rows.get(id);
	// `closed`, not `!live`: a PART-CLOSED row may legitimately sit under Held, because its
	// remainder is exactly the kind of thing that waits on a trigger.
	if (r && r.closed) fail(`${BOARD} lists ${id} under Held, but ${BACKLOG} records it as ${r.verdict} — a settled row is not a deferral`);
}

// The broken-scan floor. A scan that matches nothing is a false green: the tables were reformatted,
// the heading style changed, or a rename made the patterns stale. These registers HAVE rows — and
// this floor is the reason GR12 and GR5 were hollow for a whole arc (X13).
if (rows.size === 0) fail(`no BACKLOG rows matched at all — the scan is broken, not the register empty`);
if (cited.size === 0) fail(`no board citations matched at all — the scan is broken, not the board empty`);
if (milestones.size === 0) fail(`no board milestones matched at all — the scan is broken`);

// `items` is the CITING subset; `allRows` is every item row. Reporting the subset as "item(s)" (B92)
// made the board look smaller than it is, so both are named for what they actually count.
/*
The summary reports the CLASSIFICATION, not just the population. B122's whole disguise was a row
count that was correct, complete, and about a different quantity than the rules consumed: 121 rows
of which the scanner could act on 70, printed as `121 row(s)`. A number a reader takes as coverage
must be the number the rules actually used.
*/
const settled = [...rows.values()].filter((r) => r.closed).length;
const live = [...rows.values()].filter((r) => r.live).length;
const remainder = [...rows.values()].filter((r) => r.remainder).length;
console.log(`  scan-board: ${rows.size} row(s) — ${settled} settled, ${live} live, ${remainder} part-closed, ${held.size} held`);
console.log(`  scan-board: ${cited.size} citation(s), ${milestones.size} milestone(s), ${allRows.length} item(s), ${items.length} citing`);
if (bad) {
	console.log(`\n  FAIL — ${bad} BOARD/BACKLOG contract violation(s). The plan and the record disagree.\n`);
	process.exit(1);
}
console.log('  PASS — citations resolve, milestones exist, verdicts parse, and no live row is invisible in either file\n');
