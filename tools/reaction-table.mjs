#!/usr/bin/env node
/*
reaction-table -- the planner's reactions, phase by phase, generated from the tenants, and the gate that holds it.

ONE MASTER, ONE GENERATED VIEW (mission-kit P3), as tools/gesture-table.mjs is for the drag grammar. The master is the
rows the planner runs: its declared phases (`PHASES`, planner/txn.mjs) and each tenant's reactions with their `doc` --
the product's (planner/tenants.mjs) and the network plugin's (`network.links`, network/network.mjs). The readable view is
`dev/design/planner/REACTIONS.md`, whose charter is hand-written and whose tables are GENERATED here. A reaction changes
by editing its row; the table follows, and `--check` in the gate fails when the two differ. Order is meaning in the
planner (PLANNER-SYSTEM.md section 10), so the order is what this shows: the phases as declared, and within each the
rows as the core runs them -- the link tenant's, then the groups'.

Usage: node tools/reaction-table.mjs --check | --write
*/

import fs from 'node:fs';
import path from 'node:path';
import { PHASES } from '../planner/txn.mjs';
import { CLASSIC_LINKS, GROUPS } from '../planner/tenants.mjs';
import { createNetwork } from '../network/network.mjs';

const root = path.resolve(import.meta.dirname, '..');
const VIEW = path.join(root, 'dev/design/planner/REACTIONS.md');

const cell = (text) => String(text).replace(/\|/g, '\\|');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

// the rows a composition runs, in the order the core runs them: by declared phase, then link tenant before groups
// a reaction's trigger as words: what it listens to (TG-2)
const listensTo = (trigger) => [].concat(trigger).map((c) => [c.deleted && `${c.deleted.join(', ')} deleted`, c.created && `${c.created.join(', ')} created`,
	c.changed && `${c.changed.kind} ${c.changed.fields.join(', ')} changed`].filter(Boolean).join('; ')).join('; or ');
const composition = (links) => PHASES.flatMap((phase) => [links, GROUPS].flatMap((t) => t.reactions.filter((r) => r.phase === phase).map((r) => [phase, `\`${r.id}\``, t.owner, listensTo(r.trigger), r.doc])));

const BLOCKS = {
	production: () => table(['phase', 'reaction', 'tenant', 'listens to', 'what follows'], composition(CLASSIC_LINKS)),
	network: () => table(['phase', 'reaction', 'tenant', 'listens to', 'what follows'], composition(createNetwork().links)),
};

function render(current) {
	let out = current;
	for (const [name, make] of Object.entries(BLOCKS)) {
		const begin = `<!-- BEGIN GENERATED: ${name}. Run node tools/reaction-table.mjs --write; do not edit by hand. -->`;
		const end = `<!-- END GENERATED: ${name} -->`;
		const i = out.indexOf(begin), j = out.indexOf(end);
		if (i < 0 || j < i) throw new Error(`${path.relative(root, VIEW)} has no generated block '${name}'`);
		out = `${out.slice(0, i + begin.length)}\n${make()}\n${out.slice(j)}`;
	}
	return out;
}

const mode = process.argv[2];
if (mode !== '--check' && mode !== '--write') {
	console.error('usage: node tools/reaction-table.mjs --check | --write');
	process.exit(2);
}
const current = fs.readFileSync(VIEW, 'utf8');
const next = render(current);
if (mode === '--write') {
	if (next !== current) fs.writeFileSync(VIEW, next);
	console.log(`reaction-table: wrote ${path.relative(root, VIEW)}`);
} else if (next !== current) {
	console.error(`reaction-table: FAIL -- ${path.relative(root, VIEW)} differs from what the tenants declare; run node tools/reaction-table.mjs --write`);
	process.exit(1);
} else {
	console.log(`reaction-table: PASS -- ${Object.keys(BLOCKS).length} tables, and the view is exactly what the tenants declare`);
}
