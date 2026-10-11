#!/usr/bin/env node
/*
THE DECOUPLING EXCEPTIONS' CITATIONS RESOLVE -- G3 of H21.5 (dev/design/unification/RECORD-GUARDS.md section 3.3).

The records that let shared code name a plugin -- the canvas ratchet's and the core ratchet's, and the layer manifest's L5p and
L7k -- hold, per entry, a count, a reason, the ids the reason cites, and a trigger. The re-audit found reasons citing closed rows
and finished cuts (B308, K13d, K6, B133) long after they closed, because a reason is prose and nothing read it. This reads the
ids instead, and each must resolve:

  B<n>         a backlog row that is live (OPEN, HELD, DEFERRED, RULING-OWED, or a PART-CLOSED remainder) -- or written
               `from B<n>`, a closed row cited as the origin of a standing constraint; a B id is always a row, never a ruling
  H<n>.<m>     a board item, letters allowed after
  a ruling id  holding a digit, found in a bold paragraph of dev/DECISIONS.md in one of the two forms rulings are written in:
               at its head, in the id list before its `--` or `:` (`**D1, D2 --`, `**H17-D7:`), or at its tail, in the
               brackets after `-- ruled <date>` or `-- <date>` (`-- ruled 2026-09-27 (SD2)`); an id elsewhere -- in a held
               question, a correction -- does not count

An entry's trigger is `permanent`, a `WHEN` expression in tools/scan-triggers.mjs's vocabulary, or judgement prose.

  exceptionFaults(entries, root)  -> [message]   entries: [{ where, cites: [id], trigger }]
*/

import fs from 'node:fs';
import path from 'node:path';
import { readRows, readItems } from './records.mjs';

const RULING_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

// every ruling id the decision record holds, in the head form or the tail form
function rulingIds(decisions) {
	const ids = new Set();
	const add = (id) => { if (RULING_ID.test(id) && /\d/.test(id) && !/^B\d+$/.test(id)) ids.add(id); };
	// a list -- `D1, D2`, `SD2`, or a range `G1 to G5`, `TG-D1 to TG-D4`, `P-3 to P-10` -- each member added
	const take = (list) => {
		for (const raw of list.split(/,|\band\b/)) {
			const part = raw.trim().replace(/[.)*]+$/, '');
			const range = /^([A-Z][A-Z0-9]*-?[A-Z]*?)(\d+)\s+to\s+\1(\d+)$/.exec(part);
			if (range) for (let n = Number(range[2]); n <= Number(range[3]); n++) add(`${range[1]}${n}`);
			else add(part);
		}
	};
	for (const para of decisions.split(/\n(?=\*\*)/)) {
		if (!para.startsWith('**')) continue;
		const close = para.indexOf('**', 2);
		const bold = para.slice(2, close > 0 ? close : undefined);
		// the head: ids before the first `--` or `:` -- the whole run (`D1, D2 --`), or a list named inside it
		// (`P3's design decisions, G1 to G5, ruled as recommended --`)
		const lead = bold.split(/\s--\s/)[0];
		const own = /^([A-Z][A-Za-z0-9-]*(?:,\s*[A-Z][A-Za-z0-9-]*)*)(?::|$)/.exec(lead.trim());
		if (own) take(own[1]);
		for (const m of lead.matchAll(/\b([A-Z][A-Z0-9]*-?[A-Z]*\d+\s+to\s+[A-Z][A-Z0-9]*-?[A-Z]*\d+)\b/g)) take(m[1]);
		// the tail: the bracket after `-- ruled <date>` or `-- <date>`, its first `;`-part
		const tail = /--\s*(?:ruled\s+)?\d{4}-\d{2}-\d{2}[^(]*\(([^)]*)\)/.exec(bold);
		if (tail) take(tail[1].split(';')[0]);
	}
	return ids;
}

export function exceptionFaults(entries, root = '.') {
	const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
	const rows = readRows(read('dev/BACKLOG.md'));
	const items = new Set(readItems(read('dev/BOARD.md')).map((it) => it.h));
	const rulings = rulingIds(read('dev/DECISIONS.md'));
	const faults = [];
	for (const e of entries) {
		if (!e.trigger || !String(e.trigger).trim()) faults.push(`${e.where}: no trigger -- an exception says when it ends: \`permanent\`, a WHEN expression, or the condition in words`);
		for (const raw of e.cites ?? []) {
			const from = /^from (B\d+)$/.exec(raw);
			const id = from ? from[1] : raw;
			if (/^B\d+$/.test(id)) {
				const r = rows.get(id);
				if (!r) faults.push(`${e.where}: cites ${id}, which is not a row`);
				else if (r.kind === 'DONE' && !from) faults.push(`${e.where}: cites ${id}, which is ${r.verdict} -- cite the live work, or write \`from ${id}\` if the closed row only gave a standing rule`);
			} else if (/^H\d+\.\d+[a-z]?$/.test(id)) {
				if (!items.has(id)) faults.push(`${e.where}: cites ${id}, which is not a board item`);
			} else if (!rulings.has(id)) {
				faults.push(`${e.where}: cites ${id}, which is no row, no board item, and no ruling id in dev/DECISIONS.md`);
			}
		}
	}
	return faults;
}
