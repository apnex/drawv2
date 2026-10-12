#!/usr/bin/env node
/*
generate-architecture -- the current architecture's structure, derived from the code and no other (H21.6, U2; mission-kit AR1).

AR1 forbids a hand-authored current projection: a hand-written statement of where a system is drifts from it, and the re-audit
measured how far (`dev/design/unification/UNIFICATION-AUDIT.md`). So the structural sections of docs/ARCHITECTURE.md are read from
what the code declares about itself, and the gate fails when the document no longer says what the code does:

  layers         tools/layers.mjs -- each layer's duty (LAYER_DUTY), what it may import (ALLOWED), how many modules it holds
  kinds          product/kinds.mjs composed with the network's rows, as the store composes them -- each kind's owner, its
                 collection, what it opts into, the fields other plugins contribute to it, the entities every document holds
  canvas         product/canvas.mjs -- each part, and the part keys it brings to the page
  compositions   which product modules compose the kinds and the canvas parts
  doors          server/routes.mjs (REST), server/protocol.js (the websocket's commands), cli/verbs.mjs (the CLI's verbs)
  exceptions     tools/layers.mjs RATCHET_REASONS -- each decoupling ratchet still held, its reason and its trigger
  gate           package.json -- the steps `npm run gate` runs

Regions are delimited `<!-- BEGIN GENERATED: architecture-<name> ... -->` and `<!-- END GENERATED: architecture-<name> -->`; the
prose around them is authored. No line numbers and no counts that move with every test, so the document changes when the
structure does, not with every commit.

Usage: node tools/generate-architecture.mjs [--check] [--doc <path>]
  --check  exit non-zero, naming each region, when a region differs from what the code declares
  --doc    the document to write or check (default docs/ARCHITECTURE.md)
*/

import fs from 'node:fs';
import path from 'node:path';
import { LAYER_DUTY, ALLOWED, FOLDERS, LAYER, RATCHETS, RATCHET_REASONS } from './layers.mjs';
import { productKinds } from '../product/kinds.mjs';
import { NETWORK_ROWS } from '../network/kinds.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { ROUTES } from '../server/routes.mjs';
import { VERBS } from '../cli/verbs.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const DOC = path.resolve(arg('--doc') ?? path.join(ROOT, 'docs/ARCHITECTURE.md'));
const CHECK = process.argv.includes('--check');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const cell = (v) => String(v).replace(/\|/g, '\\|');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const list = (xs) => (xs.length ? xs.map((x) => `\`${x}\``).join(', ') : '--');

// ---- layers: modules per layer, from the folders that name a layer and the lists that place a file
const walk = (dir, skip = []) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
	const p = `${dir}/${d.name}`;
	if (skip.some((s) => p.startsWith(s))) return [];
	return d.isDirectory() ? walk(p, skip) : /\.m?js$/.test(d.name) ? [p] : [];
});
const modules = Object.fromEntries(Object.keys(ALLOWED).map((l) => [l, LAYER[l]?.length ?? 0]));
for (const f of FOLDERS) if (f.layer && fs.existsSync(path.join(ROOT, f.dir))) modules[f.layer] += walk(f.dir, f.skip ?? []).length;
const missingDuty = Object.keys(ALLOWED).filter((l) => !LAYER_DUTY[l]);
const layers = table(['Layer', 'Duty', 'Modules', 'May import'],
	// tools and tests grow with every check and every test, so their counts would stale the document on most commits
	Object.keys(ALLOWED).map((l) => [`\`${l}\``, LAYER_DUTY[l] ?? '(none declared)', ['tools', 'tests'].includes(l) ? 'not counted' : modules[l], ['tools', 'tests'].includes(l) ? 'any layer' : list(ALLOWED[l].filter((x) => x !== l))]));

// ---- kinds: the server's composition
const K = productKinds(...NETWORK_ROWS);
const kinds = table(['Kind', 'Owner', 'Stored under', 'Opts into', 'Refers to', 'Fields other plugins contribute', 'Every document holds'],
	K.list.map((k) => {
		const r = K.row(k);
		const opts = [r.selectable && 'selection', r.named && 'names', r.anchor && 'the anchor', r.tenant && 'a planner tenant', r.gathers && `gathering by \`${r.gathers}\``].filter(Boolean);
		const byOwner = {};
		for (const f of Object.keys(r.fields)) { const o = K.contributed(k, f); if (o) (byOwner[o] ??= []).push(f); }
		const contributed = Object.entries(byOwner).map(([o, fs]) => `${o}: ${fs.map((f) => `\`${f}\``).join(', ')}`).join('; ') || '--';
		return [`\`${k}\``, r.owner, `\`${r.collection}\``, opts.join(', ') || '--', list(r.references ?? []), contributed, (r.always ?? []).map((e) => `\`${e.id}\``).join(', ') || '--'];
	}));

// ---- canvas parts
const canvas = table(['Part', 'Brings to the page'], PRODUCT_CANVAS.map((p) => [p.owner, list(Object.keys(p).filter((k) => k !== 'owner'))]));

// ---- compositions: which product modules compose the kinds and the canvas parts
const productFiles = [...LAYER.chrome ?? [], ...LAYER['server-only'] ?? [], ...LAYER.cli ?? [], ...walk('lab')].filter((f) => fs.existsSync(path.join(ROOT, f))).sort();
const compositions = table(['Module', 'Composes'], productFiles.map((f) => {
	const c = code(f);
	const what = [/productKinds\(\.\.\.NETWORK_ROWS\)/.test(c) && 'the kinds, with the network\'s', /productKinds\(\)/.test(c) && 'the product\'s kinds alone', /\bPRODUCT_CANVAS\b/.test(c) && 'the canvas parts'].filter(Boolean);
	return what.length ? [`\`${f}\``, what.join('; ')] : null;
}).filter(Boolean));

// ---- doors
const rest = table(['Route', 'Methods', 'What it answers'], ROUTES.map((r) => [`\`/api/v1/${r.path}\``, r.methods.join(', '), r.about ?? '']));
const ws = [...code('server/protocol.js').matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]);
const groups = [...new Set(VERBS.map((v) => v.group))];
const cli = table(['Group', 'Verbs'], groups.map((g) => [g, VERBS.filter((v) => v.group === g).map((v) => `\`${v.name}\``).join(', ')]));
const doors = [`**REST** -- ${ROUTES.length} routes (\`server/routes.mjs\`):`, '', rest, '',
	`**The websocket** -- ${ws.length} commands a tab sends (\`server/protocol.js\`): ${list(ws)}.`, '',
	`**The CLI** -- ${VERBS.length} verbs (\`cli/verbs.mjs\`):`, '', cli].join('\n');

// ---- exceptions: the decoupling ratchets' records
const exceptions = table(['Ratchet', 'Where', 'Count', 'Why it holds', 'Ends when'],
	Object.entries(RATCHET_REASONS).flatMap(([rule, entries]) => Object.entries(entries).map(([key, e]) => [rule, `\`${key}\``, RATCHETS[rule]?.[key] ?? 0, e.reason, e.trigger])));

// ---- the gate
const steps = JSON.parse(read('package.json')).scripts.gate.split(/\s*&&\s*/).map((s) => (s === 'npm test' ? 'node --test tests/*.test.js' : s));
const gate = table(['#', 'Step'], steps.map((s, i) => [i + 1, `\`${s}\``]));

const REGIONS = { layers, kinds, canvas, compositions, doors, exceptions, gate };

// ---- write or check
if (missingDuty.length) { console.log(`  \u2717 tools/layers.mjs LAYER_DUTY declares no duty for ${missingDuty.join(', ')}`); process.exit(1); }
if (!fs.existsSync(DOC)) { console.log(`  \u2717 ${path.relative(ROOT, DOC)} does not exist -- its authored frame holds the generated regions`); process.exit(1); }
let doc = fs.readFileSync(DOC, 'utf8');
const stale = [];
for (const [name, body] of Object.entries(REGIONS)) {
	const begin = `<!-- BEGIN GENERATED: architecture-${name}. Run tools/generate-architecture.mjs; do not edit by hand. -->`;
	const end = `<!-- END GENERATED: architecture-${name} -->`;
	const a = doc.indexOf(begin), b = doc.indexOf(end);
	if (a < 0 || b < a) { console.log(`  \u2717 ${path.relative(ROOT, DOC)} has no region architecture-${name}`); process.exit(1); }
	const now = doc.slice(a + begin.length, b);
	const want = `\n${body}\n`;
	if (now !== want) { stale.push(name); doc = doc.slice(0, a + begin.length) + want + doc.slice(b); }
}
if (CHECK) {
	if (stale.length) {
		console.log(`  \u2717 ${path.relative(ROOT, DOC)} no longer says what the code declares: ${stale.join(', ')} -- run node tools/generate-architecture.mjs`);
		process.exit(1);
	}
	console.log(`  PASS -- ${path.relative(ROOT, DOC)}'s ${Object.keys(REGIONS).length} generated regions say what the code declares`);
} else {
	if (stale.length) fs.writeFileSync(DOC, doc);
	console.log(`  ${stale.length ? `regenerated ${stale.join(', ')}` : 'nothing stale'} in ${path.relative(ROOT, DOC)}`);
}
process.exit(0);
