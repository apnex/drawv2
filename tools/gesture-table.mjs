#!/usr/bin/env node
/*
gesture-table -- the network plugin's gesture table, generated from its grammar, and the gate that holds it.

ONE MASTER, ONE GENERATED VIEW (mission-kit P3). The master is the data the Rules engine reads: the network's key rows
(network/keys.mjs) and its drag grammar (network/grammar.mjs). The readable view is
`dev/design/unification/GESTURES.md`, whose charter is hand-written and whose tables are GENERATED here from each row's
`id`, `doc` and result. A gesture changes by editing its row; the table follows, and `--check` in the gate fails when
the two differ. Before T3 the gestures were described by hand beside conditions in code, and nothing compared them.

Usage: node tools/gesture-table.mjs --check | --write
*/

import fs from 'node:fs';
import path from 'node:path';
import { networkInput } from '../network/keys.mjs';
import { DRAG_KINDS, LEGS } from '../network/grammar.mjs';

const root = path.resolve(import.meta.dirname, '..');
const VIEW = path.join(root, 'dev/design/unification/GESTURES.md');

const cell = (text) => String(text).replace(/\|/g, '\\|');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

const BLOCKS = {
	keys: () => table(['row', 'what it means'], networkInput(() => ({})).keys.map((r) => [`\`${r.id}\``, r.doc])),
	kinds: () => table(['row', 'when', 'makes'], DRAG_KINDS.map((r) => [`\`${r.id}\``, r.doc, r.run.makes])),
	legs: () => table(['row', 'when', 'pipe'], LEGS.map((r) => [`\`${r.id}\``, r.doc, r.run.pipe ?? 'none'])),
};

function render(current) {
	let out = current;
	for (const [name, make] of Object.entries(BLOCKS)) {
		const begin = `<!-- BEGIN GENERATED: ${name}. Run node tools/gesture-table.mjs --write; do not edit by hand. -->`;
		const end = `<!-- END GENERATED: ${name} -->`;
		const i = out.indexOf(begin), j = out.indexOf(end);
		if (i < 0 || j < i) throw new Error(`${path.relative(root, VIEW)} has no generated block '${name}'`);
		out = `${out.slice(0, i + begin.length)}\n${make()}\n${out.slice(j)}`;
	}
	return out;
}

const mode = process.argv[2];
if (mode !== '--check' && mode !== '--write') {
	console.error('usage: node tools/gesture-table.mjs --check | --write');
	process.exit(2);
}
const current = fs.readFileSync(VIEW, 'utf8');
const next = render(current);
if (mode === '--write') {
	if (next !== current) fs.writeFileSync(VIEW, next);
	console.log(`gesture-table: wrote ${path.relative(root, VIEW)}`);
} else if (next !== current) {
	console.error(`gesture-table: FAIL -- ${path.relative(root, VIEW)} differs from what the grammar produces; run node tools/gesture-table.mjs --write`);
	process.exit(1);
} else {
	console.log(`gesture-table: PASS -- ${Object.keys(BLOCKS).length} tables, and the view is exactly what the grammar produces`);
}
