#!/usr/bin/env node
/*
THE RECORDS, READ ONE WAY -- what `tools/scan-board.mjs` and `tools/scan-triggers.mjs` both read the board and the register with
(H21.5, R-a; dev/design/unification/RECORD-GUARDS.md section 3.1). Extracted from scan-board, not copied: a second copy of the
verdict list is how B122 happened -- one reader learned a new verdict word and the other went on reading a third of the register
as open.

  splitCells(line)     a table line's cells, honouring `\|`, the only escape markdown honours
  VERDICTS             the closed set of disposition openers, each to DONE, REMAINDER or LIVE
  verdictOf(text)      the verdict a disposition opens with, by longest prefix, or null
  itemStateOf(line)    a board item's state -- the last state token on its line, wherever its convention puts it
  readRows(text)       the register's rows: id -> { cells, disposition, verdict, kind }
  readItems(text)      the board's item rows: [{ h, state, ids, line }]
  heldRows(text)       the rows of the first table under `## Held`: [{ id, index, cells }], index the line's number from 0
  movedTo(path, moved) where a path a record keeps is now (tools/layers.mjs MOVED, H26.7), or the path when it never moved
*/

export const splitCells = (line) => line.split(/(?<!\\)\|/).map((c) => c.trim());

/*
DONE      the matter is settled; the row is a record, not a plan
REMAINDER settled in part, with the rest stated in the row -- still owed a place on the board
LIVE      not settled; must appear on the board or under Held
*/
export const VERDICTS = new Map([
	['CLOSED', 'DONE'], ['FIXED', 'DONE'], ['RULED', 'DONE'], ['WITHDRAWN', 'DONE'],
	["WON'T DO", 'DONE'],
	['PART-CLOSED', 'REMAINDER'],
	['OPEN', 'LIVE'], ['DEFERRED', 'LIVE'], ['HELD', 'LIVE'],
	// B153 -- a row waiting on a ruling is LIVE: the work is ready and the authority is not this agent's
	['RULING-OWED', 'LIVE'],
	// DROPPED is settled, not open: contract rule 4 permits dropping an item so long as the row carries the reason as a
	// revival trigger, which is a record and not a plan
	['DROPPED', 'DONE'],
]);

// Longest-prefix match, not a word match: the vocabulary holds a hyphen (`PART-CLOSED`) and a space (`WON'T DO`)
export function verdictOf(disposition) {
	const opener = disposition.replace(/^[\s*]+/, '').toUpperCase();
	let verdict = null;
	for (const key of VERDICTS.keys()) {
		if (!opener.startsWith(key)) continue;
		if (/[A-Z']/.test(opener[key.length] || ' ')) continue;   // OPENED must not match OPEN
		if (!verdict || key.length > verdict.length) verdict = key;
	}
	return verdict;
}

// H0-H5 and H7 on put the state in a trailing column; H6 prefixes its first cell -- the last token wins
export function itemStateOf(line) {
	const tokens = [...line.matchAll(/`(DONE|TODO|WIP|BLOCKED|DROPPED)`/g)].map((x) => x[1]);
	return tokens.length ? tokens[tokens.length - 1] : null;
}

export function readRows(text) {
	const rows = new Map();
	for (const line of text.split('\n')) {
		const m = /^\|\s*\*\*(B\d+)\*\*\s*\|/.exec(line);
		if (!m) continue;
		const cells = splitCells(line);
		const disposition = cells[cells.length - 2] || '';
		const verdict = verdictOf(disposition);
		rows.set(m[1], { cells, disposition, verdict, kind: verdict ? VERDICTS.get(verdict) : null });
	}
	return rows;
}

export function readItems(text) {
	const items = [];
	for (const line of text.split('\n')) {
		const m = /^\|\s*(H\d+\.\d+[a-z]?)\s*\|/.exec(line);
		if (!m) continue;
		items.push({ h: m[1], state: itemStateOf(line), ids: [...line.matchAll(/\*\*(B\d+)\*\*/g)].map((x) => x[1]), line });
	}
	return items;
}

// Bounded to the FIRST table under the heading: the section also carries a `Cleared` table of rows no longer held
export function heldRows(text) {
	const lines = text.split('\n');
	const start = lines.findIndex((l) => /^##\s+Held\b/.test(l));
	if (start < 0) return [];
	const out = [];
	let inTable = false;
	for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
		const row = /^\|\s*\*\*(B\d+)\*\*\s*\|/.exec(lines[i]);
		if (row) { inTable = true; out.push({ id: row[1], index: i, cells: splitCells(lines[i]) }); continue; }
		if (inTable && !lines[i].trimStart().startsWith('|')) break;
	}
	return out;
}

// H26.7: a key ending in `/` names every path under it
export const movedTo = (p, moved) => {
	const key = Object.keys(moved).find((k) => p === k || (k.endsWith('/') && p.startsWith(k)));
	return key === undefined ? p : moved[key] + p.slice(key.length);
};
