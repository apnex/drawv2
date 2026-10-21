#!/usr/bin/env node
/*
scan-designs -- G4 of H21.5 (dev/design/unification/RECORD-GUARDS.md section 3.4). Four checks on the design records and the
decision record, each decidable from the text; status lives on the board, and provenance in a ruling's own fields.

  INDEX     each entry directly in dev/design/unification/, dev/design/sim/ and dev/design/brand/ -- a file or a folder, other
            than the README.md itself -- is named in that folder's README.md (dev/design/README.md is defunct and excluded)
  BANNER    a file under dev/design/ or docs/spec/ whose first heading closes with a parenthetical holding `proposed`, `awaiting`,
            `draft` or `held` carries, within three lines below it, `AMENDED <date>: this title's status is as written; the
            standing is its board item's` -- titles are not rewritten (RU2)
  STANDING  the unification index's Standing column follows `<type>[; <board items>].`, the type one of Delta, Plan, Design,
            Register, Evidence, Descriptive, Generated, Audit -- so no cell carries a state
  RULINGS   after the marker heading in dev/DECISIONS.md, every paragraph opening in bold is a ruling block -- a bold id head,
            then `Director: "<words>"`, `Shown: <document>@<commit>`, `Recorder: <account>`, `Affects: <path>[, <path>]` -- or an
            `AMENDED` or `CORRECTED` line naming the ruling it amends; a bold paragraph of any other kind there fails
  ABSORBED  each path a ruling block's `Affects:` names exists and cites the ruling's id (H21.6; mission-kit AR4's `affects`,
            the walk AR1 asks for so a target architecture is living rather than a shape) -- a path that moved read where it is
            now (tools/layers.mjs MOVED, H26.7), since the ruling keeps the path it was written with (RU2) -- for the rulings
            recorded before the move's own (MOVED_BY) alone; a ruling written after it names where a file is

Usage: node tools/scan-designs.mjs [--root <dir>]
*/

import fs from 'node:fs';
import path from 'node:path';
import { MOVED, MOVED_BY } from './layers.mjs';
import { movedTo } from './records.mjs';

const i = process.argv.indexOf('--root');
const ROOT = i > -1 ? process.argv[i + 1] : '.';
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));
let bad = 0;
const fail = (msg) => { console.log(`  \u2717 ${msg}`); bad++; };

// ---- INDEX
for (const dir of ['dev/design/unification', 'dev/design/sim', 'dev/design/brand']) {
	if (!exists(`${dir}/README.md`)) continue;
	const index = read(`${dir}/README.md`);
	for (const entry of fs.readdirSync(path.join(ROOT, dir))) {
		if (entry === 'README.md' || entry.startsWith('.')) continue;
		if (!index.includes(entry)) fail(`${dir}/README.md does not name ${entry} -- an index that omits a member cannot be asked whether anything is missing`);
	}
}

// ---- BANNER
const walk = (dir) => (exists(dir) ? fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : d.name.endsWith('.md') ? [`${dir}/${d.name}`] : [])) : []);
const BANNER = /^AMENDED \d{4}-\d{2}-\d{2}: this title's status is as written; the standing is its board item's/;
for (const f of [...walk('dev/design'), ...walk('docs/spec')]) {
	const lines = read(f).split('\n');
	const h = lines.findIndex((l) => l.startsWith('# '));
	if (h < 0) continue;
	const paren = /\(([^()]*)\)\s*$/.exec(lines[h]);
	if (!paren || !/\b(proposed|awaiting|draft|held)\b/i.test(paren[1])) continue;
	if (!lines.slice(h + 1, h + 4).some((l) => BANNER.test(l.replace(/^>\s*/, '')))) {
		fail(`${f}: its title says "(${paren[1]})" and carries no banner -- add, within three lines: AMENDED <date>: this title's status is as written; the standing is its board item's`);
	}
}

// ---- STANDING
const TYPES = ['Delta', 'Plan', 'Design', 'Register', 'Evidence', 'Descriptive', 'Generated', 'Audit'];
// after the type, board item ids only -- `H21.5`, `H18.2, H18.10` -- so no state can ride in behind the semicolon
const STANDING = new RegExp(`^(${TYPES.join('|')})(; H\\d+\\.\\d+[a-z]?(, H\\d+\\.\\d+[a-z]?)*)?\\.$`);
if (exists('dev/design/unification/README.md')) {
	for (const line of read('dev/design/unification/README.md').split('\n')) {
		const m = /^\| `?([^`|]+?)`? \|.*\| ([^|]*) \|$/.exec(line);
		if (!m || /^(File|-+)$/.test(m[1].trim())) continue;
		if (!STANDING.test(m[2].trim())) fail(`dev/design/unification/README.md ${m[1]}: Standing "${m[2].trim()}" is not \`<type>[; <board items>].\` with a type of ${TYPES.join(', ')} -- a state there drifts from the board`);
	}
}

// ---- RULINGS
const MARKER = '## Rulings recorded from 2026-10-11 -- each a structured block';
if (exists('dev/DECISIONS.md')) {
	const text = read('dev/DECISIONS.md');
	const at = text.indexOf(MARKER);
	if (at < 0) fail(`dev/DECISIONS.md has no marker heading "${MARKER}" -- the structured form starts there`);
	else {
		const after = text.slice(at + MARKER.length);
		const paras = after.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
		// H26.7 (V7): the rulings before the move's own may name a moved path's old place. RESTATED at its second verification (R2-3):
		// the cut-off is that ruling's place, so a MOVED_BY naming no ruling heading is refused rather than read as "every ruling"
		const heads = paras.map((p) => /^\*\*([A-Z][A-Za-z0-9.-]*(?:,\s*[A-Z][A-Za-z0-9.-]*)*)\s+--\s/.exec(p.split('\n')[0].replace(/^>\s*/, ''))?.[1] ?? '');
		const moveAt = heads.findIndex((h) => h.split(',').map((x) => x.trim()).includes(MOVED_BY));
		if (Object.keys(MOVED).length && moveAt < 0) fail(`dev/DECISIONS.md holds no ruling heading ${MOVED_BY}, which tools/layers.mjs MOVED_BY names as the ruling its moves are recorded under -- the rulings before it may name a moved path's old place, so it must be found`);
		for (const [i, p] of paras.entries()) {
			const first = p.split('\n')[0].replace(/^>\s*/, '');
			if (!first.startsWith('**')) continue;
			if (/^\*\*(AMENDED|CORRECTED)\b/.test(first)) {
				if (!/\b(H\d+(\.\d+)?|[A-Z][A-Z-]*\d+)\b/.test(p)) fail(`dev/DECISIONS.md: "${first.slice(0, 70)}" amends after the marker without naming the ruling it amends`);
				continue;
			}
			const head = /^\*\*([A-Z][A-Za-z0-9.-]*(?:,\s*[A-Z][A-Za-z0-9.-]*)*)\s+--\s/.exec(first);
			const label = first.slice(0, 70);
			if (!head) { fail(`dev/DECISIONS.md: "${label}" opens in bold after the marker and is neither a ruling block (a bold id head) nor an AMENDED or CORRECTED line`); continue; }
			for (const [field, re] of [['Director', /^Director: ".+"\\?$/m], ['Shown', /^Shown: \S+@[0-9a-f]{7,}\\?$/m], ['Recorder', /^Recorder: .+$/m], ['Affects', /^Affects: .+$/m]]) {
				if (!re.test(p)) fail(`dev/DECISIONS.md ${head[1]}: no \`${field}:\` line -- a ruling block carries Director: "<words>", Shown: <document>@<commit>, Recorder: <account> and Affects: <paths>`);
			}
			const affects = /^Affects: (.+?)\\?$/m.exec(p);
			for (const f of affects ? affects[1].split(',').map((x) => x.trim().replace(/^`|`$/g, '')).filter(Boolean) : []) {
				const at = exists(f) || i >= moveAt ? f : movedTo(f, MOVED);   // H26.7: a path that moved, read where it is now
				if (!exists(at)) fail(`dev/DECISIONS.md ${head[1]}: Affects names ${f}, which does not exist`);
				else for (const id of head[1].split(',').map((x) => x.trim())) {
					// every id in the head, as a whole id: H21.5 is not cited by H21.5.1, and a sentence's full stop still ends it
					if (!new RegExp(`(^|[^\\w.-])${id.replace(/[.]/g, '\\.')}(?![\\w-]|\\.\\d)`).test(read(at))) fail(`dev/DECISIONS.md ${head[1]}: Affects names ${f}, which does not cite ${id} -- a ruling a document must absorb is cited there`);
				}
			}
		}
	}
}

if (bad) {
	console.log(`  FAIL -- ${bad} finding(s). The checks are dev/design/unification/RECORD-GUARDS.md section 3.4.`);
	process.exit(1);
}
console.log('  PASS -- every design index lists its folder; every status title carries its banner; the Standing column names types; every ruling after the marker is structured');
