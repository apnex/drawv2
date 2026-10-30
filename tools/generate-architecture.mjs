#!/usr/bin/env node
/*
generate-architecture -- the current architecture's structure, derived from the code and no other (H21.6, U2; mission-kit AR1).

AR1 forbids a hand-authored current projection: a hand-written statement of where a system is drifts from it, and the re-audit
measured how far (`dev/design/unification/UNIFICATION-AUDIT.md`). So the structural sections of docs/ARCHITECTURE.md are read from
what the code declares about itself, and the gate fails when the document no longer says what the code does:

  layers         tools/layers.mjs -- each layer's duty (LAYER_DUTY) and what it may import (ALLOWED)
  parts          tools/layers.mjs PARTS -- the anchored core's parts, the modules each is made of, the imports between them read
                 from the code, and each import the target's consumes do not allow with the backlog row carrying it
  kinds          product/kinds.mjs composed with the network's rows, as the store composes them -- each kind's owner, its
                 collection, what it opts into, the fields other plugins contribute to it, the entities every document holds
  canvas         product/canvas.mjs -- each part, and the part keys it brings to the page
  compositions   which product modules compose the kinds and the canvas parts
  doors          server/routes.mjs (REST), server/protocol.js (the websocket's commands), cli/verbs.mjs (the CLI's verbs)
  exceptions     tools/layers.mjs RATCHET_REASONS -- each decoupling ratchet still held, its reason and its trigger
  gate           package.json -- the steps `npm run gate` runs
  alignment      tools/layers.mjs ALIGNMENT and MISSION_KIT -- each part mapped to the mission-kit component or candidate it
                 would take, with its standing as read, rendered into the target's register (H21.9, A-0)
  components     tools/layers.mjs COMPONENTS -- each part's components beside its consumes: in the target those it composes, in the
                 current document those its modules import today (H26.1)

Regions are delimited `<!-- BEGIN GENERATED: architecture-<name> ... -->` and `<!-- END GENERATED: architecture-<name> -->`; the
prose around them is authored. No line numbers and no counts that move with every test, so the document changes when the
structure does, not with every commit.

Usage: node tools/generate-architecture.mjs [--check] [--doc <path>]
  --check  exit non-zero, naming each region, when a region differs from what the code declares
  --doc    the document to write or check (default docs/ARCHITECTURE.md)
  --target-doc  the target document holding the parts table (default docs/ARCHITECTURE-TARGET.md)
  --parts  a JSON parts declaration in place of tools/layers.mjs PARTS (tests)
  --alignment  a JSON alignment register in place of tools/layers.mjs ALIGNMENT (tests)
  --components  a JSON components declaration in place of tools/layers.mjs COMPONENTS (tests)
*/

import fs from 'node:fs';
import path from 'node:path';
import { LAYER_DUTY, ALLOWED, LAYER, RATCHETS, RATCHET_REASONS, PARTS as DECLARED_PARTS, KIND_MAY_CONSUME, NOT_PARTS,
	ALIGNMENT as DECLARED_ALIGNMENT, MISSION_KIT, MISSION_KIT_READ, COPIES, SCANNER_ROOTS, COMPONENTS as DECLARED_COMPONENTS } from './layers.mjs';
import { readRows } from './records.mjs';
import { productKinds } from '../product/kinds.mjs';
import { NETWORK_ROWS } from '../plugins/network/kinds.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { ROUTES } from '../server/routes.mjs';
import { VERBS } from '../cli/verbs.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const DOC = path.resolve(arg('--doc') ?? path.join(ROOT, 'docs/ARCHITECTURE.md'));
const TARGET = path.resolve(arg('--target-doc') ?? path.join(ROOT, 'docs/ARCHITECTURE-TARGET.md'));
const CHECK = process.argv.includes('--check');
// --parts <json>: a parts declaration in place of tools/layers.mjs's, so a test can drive the part rules
const PARTS = arg('--parts') ? JSON.parse(fs.readFileSync(arg('--parts'), 'utf8')) : DECLARED_PARTS;
// --alignment <json>: an alignment register in place of tools/layers.mjs's, so a test can drive its rules
const ALIGNMENT = arg('--alignment') ? JSON.parse(fs.readFileSync(arg('--alignment'), 'utf8')) : DECLARED_ALIGNMENT;
// --components <json>: a components declaration in place of tools/layers.mjs's, so a test can drive its rules (H26.1)
const COMPONENTS = arg('--components') ? JSON.parse(fs.readFileSync(arg('--components'), 'utf8')) : DECLARED_COMPONENTS;
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const cell = (v) => String(v).replace(/\|/g, '\\|');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const list = (xs) => (xs.length ? xs.map((x) => `\`${x}\``).join(', ') : '--');

// ---- a folder's modules, for the parts and the lab
const walk = (dir, skip = []) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
	const p = `${dir}/${d.name}`;
	if (skip.some((s) => p.startsWith(s))) return [];
	return d.isDirectory() ? walk(p, skip) : /\.m?js$/.test(d.name) ? [p] : [];
});
const missingDuty = Object.keys(ALLOWED).filter((l) => !LAYER_DUTY[l]);
const layers = table(['Layer', 'Duty', 'May import'],
	// no module counts: they move whenever a module is added, and the parts table already names every module
	Object.keys(ALLOWED).map((l) => [`\`${l}\``, LAYER_DUTY[l] ?? '(none declared)', ['tools', 'tests'].includes(l) ? 'any layer' : list(ALLOWED[l].filter((x) => x !== l))]));

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

// ---- exceptions: the decoupling ratchets' records, and the copy measures' findings (H25.7, B365)
const exceptions = table(['Ratchet', 'Where', 'Count', 'Why it holds', 'Ends when'],
	Object.entries(RATCHET_REASONS).flatMap(([rule, entries]) => Object.entries(entries).map(([key, e]) => [rule, `\`${key}\``, RATCHETS[rule]?.[key] ?? 0, e.reason, e.trigger])));
const copiesRecord = JSON.parse(read('tools/copies-record.json'));
const copies = table(['Measure', 'Standing', 'Findings'],
	Object.entries(copiesRecord).map(([measure, items]) => [
		measure,
		items.length,
		items.length
			? items.map((item) => {
				const ex = COPIES.exceptions[measure]?.[item];
				return `\`${item}\`${ex ? ` (${ex.cites.join(', ')}; ends when ${ex.trigger})` : ''}`;
			}).join('; ')
			: '--',
	]));

// ---- the gate
// `npm test` shown as what it runs, its reporters left out (H26-19: the suite runs through tools/run-tests.mjs)
const scripts = JSON.parse(read('package.json')).scripts;
const steps = scripts.gate.split(/\s*&&\s*/).map((s) => (s === 'npm test' ? scripts.test.replace(/ --test-reporter(?:-destination)?=\S+/g, '') : s));
const gate = table(['#', 'Step'], steps.map((s, i) => [i + 1, `\`${s}\``]));

// ---- the reasoning both instants share, copied from the target so it cannot drift
const targetText = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
const sectionOf = (title) => {
	const a = targetText.indexOf(`\n## ${title}\n`);
	if (a < 0) return `(the target has no section "${title}")`;
	const rest = targetText.slice(a + 1);
	const end = rest.search(/\n---\n|\n## /);
	return rest.slice(rest.indexOf('\n') + 1, end < 0 ? undefined : end).replace(/^\*\*Maturity:[^\n]*\n\n?/m, '').trim();
};
const justification = sectionOf('2. Justification chain');
// the current instance copies the chain's layers above the model; its model and its alignment are its own, authored
const chainAboveModel = justification.split('\n**Model.**')[0].trim();
const ROWS = readRows(read('dev/BACKLOG.md'));
// ---- parts: every product module in exactly one part; the imports between parts, derived; those the target does not allow
const productModules = SCANNER_ROOTS.copies.flatMap((d) => walk(d)).sort();
const partOf = new Map();
const partFaults = [];
for (const [name, p] of Object.entries(PARTS)) {
	for (const spec of p.modules) {
		const hit = spec.endsWith('/') ? productModules.filter((m) => m.startsWith(spec)) : productModules.filter((m) => m === spec);
		if (!hit.length) partFaults.push(`part ${name} names ${spec}, which is no product module`);
		for (const m of hit) {
			if (partOf.has(m)) partFaults.push(`${m} is in two parts, ${partOf.get(m)} and ${name}`);
			else partOf.set(m, name);
		}
	}
}
for (const m of productModules) if (!partOf.has(m) && !NOT_PARTS[m]) partFaults.push(`${m} is in no part -- add it to PARTS in tools/layers.mjs`);
for (const m of Object.keys(NOT_PARTS)) if (partOf.has(m)) partFaults.push(`${m} is in NOT_PARTS and in part ${partOf.get(m)}`);
// every relative specifier: `import ... from`, `export ... from`, a bare `import '...'`, `import(...)`; either quote
const importsOf = (f) => [...code(f).matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\1/g)].map((m) => path.normalize(path.join(path.dirname(f), m[2])));
for (const m of productModules) if (!NOT_PARTS[m]) for (const t of importsOf(m)) if (NOT_PARTS[t]) partFaults.push(`${m} imports ${t}, which NOT_PARTS says no product module imports`);
const edges = new Map();   // "a -> b" -> Set(importing module)
for (const m of productModules) {
	for (const t of importsOf(m)) {
		const a = partOf.get(m), b = partOf.get(t);
		if (!a || !b || a === b) continue;
		const k = `${a} -> ${b}`;
		if (!edges.has(k)) edges.set(k, new Set());
		edges.get(k).add(m);
	}
}
const importsBy = (name) => [...new Set([...edges.keys()].filter((k) => k.startsWith(`${name} -> `)).map((k) => k.split(' -> ')[1]))].sort();
// H26.1: the components a part's modules import today -- a component's package, its subpaths alike -- and those COMPONENTS lets it compose
const componentsIn = (m) => [...code(m).matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(@apnex\/[^'"/]+)(?:\/[^'"]*)?\1/g)].map((x) => x[2]);
const componentsToday = (name) => [...new Set(productModules.filter((m) => partOf.get(m) === name).flatMap(componentsIn))].sort();
const composes = (name) => Object.keys(COMPONENTS).filter((c) => COMPONENTS[c].parts?.includes(name)).sort();
const parts = table(['Part', 'Duty', 'Kind', 'Made of', 'Imports today', 'Composes today'],
	Object.entries(PARTS).map(([name, p]) => [`\`${name}\``, p.duty, p.kind, p.modules.map((m) => `\`${m}\``).join(', '), list(importsBy(name)), list(componentsToday(name))]));
const citedInChain = (id) => new RegExp(`(^|[^\\w.-])${id.replace(/[.]/g, '\\.')}(?![\\w-]|\\.\\d)`).test(justification);
// the consumes: parts that exist, within the kind's ceiling (the target's section 4.3), and no cycle
for (const [a, p] of Object.entries(PARTS)) {
	const may = KIND_MAY_CONSUME[p.kind];
	if (!may) { partFaults.push(`part ${a} has kind ${p.kind}, which KIND_MAY_CONSUME does not know`); continue; }
	if (p.consumes === '*') { if (may !== '*') partFaults.push(`part ${a} consumes any part, which only a composition root may`); continue; }
	for (const b of p.consumes) {
		if (!PARTS[b]) partFaults.push(`part ${a} consumes ${b}, which is no part`);
		else if (may !== '*' && !may.includes(PARTS[b].kind) && !p.beyondKind?.[b]) partFaults.push(`part ${a} (${p.kind}) consumes ${b} (${PARTS[b].kind}), which a ${p.kind} may not -- the target's section 4.3`);
	}
	for (const [b, id] of Object.entries(p.beyondKind ?? {})) {
		if (!p.consumes.includes(b)) partFaults.push(`PARTS.${a}.beyondKind names ${b}, which ${a} does not consume`);
		else if (may.includes(PARTS[b]?.kind)) partFaults.push(`PARTS.${a}.beyondKind names ${b}, which its kind already allows -- remove it`);
		else if (!citedInChain(id)) partFaults.push(`PARTS.${a}.beyondKind lets ${a} consume ${b} by ${id}, which the target's justification chain (section 2) does not cite`);
	}
}
const cycle = (() => {
	const state = {}, stack = [];
	const visit = (a) => {
		if (state[a] === 1) return [...stack.slice(stack.indexOf(a)), a];
		if (state[a] === 2 || PARTS[a]?.consumes === '*' || !PARTS[a]) return null;
		state[a] = 1; stack.push(a);
		for (const b of PARTS[a].consumes) { const c = visit(b); if (c) return c; }
		stack.pop(); state[a] = 2; return null;
	};
	for (const a of Object.keys(PARTS)) { const c = visit(a); if (c) return c; }
	return null;
})();
if (cycle) partFaults.push(`the consumes form a cycle: ${cycle.join(' -> ')}`);
const outside = [...edges.entries()].filter(([k]) => { const [a, b] = k.split(' -> '); const c = PARTS[a].consumes; return c !== '*' && !c.includes(b); }).sort(([a], [b]) => a.localeCompare(b));
// each import outside the consumes is carried by a live backlog row, or the gate fails (tools/exceptions.mjs resolves the row)
for (const [k] of outside) {
	const [a, b] = k.split(' -> ');
	const row = PARTS[a].carried?.[b];
	if (!row) partFaults.push(`part ${a} imports ${b}, which the target's consumes do not allow, and no backlog row carries it -- allow it in PARTS.${a}.consumes, or name the row carrying the divergence in PARTS.${a}.carried`);
	else if (!/^B\d+$/.test(row)) partFaults.push(`PARTS.${a}.carried.${b} is ${row}: a divergence is carried by a backlog row, written B<n>`);
	else if (!['LIVE', 'REMAINDER'].includes(ROWS.get(row)?.kind)) partFaults.push(`PARTS.${a}.carried.${b} cites ${row}, which is ${ROWS.get(row)?.verdict ?? 'no row'} -- a divergence is carried by a live row`);
}
for (const [a, p] of Object.entries(PARTS)) for (const b of Object.keys(p.carried ?? {})) if (!edges.has(`${a} -> ${b}`) || (p.consumes !== '*' && p.consumes.includes(b))) partFaults.push(`PARTS.${a}.carried names ${b}, but ${a} imports it no more outside its consumes -- remove it`);
const divergence = outside.length
	? table(['Part', 'Imports', 'Carried by', 'Which the target does not allow, from'], outside.map(([k, ms]) => { const [a, b] = k.split(' -> '); return [`\`${a}\``, `\`${b}\``, PARTS[a].carried?.[b] ?? '--', [...ms].sort().map((m) => `\`${m}\``).join(', ')]; }))
	: 'None: every import between parts is one the target allows.';
const targetParts = table(['Part', 'Duty', 'Kind', 'Fixed by', 'Consumes', 'Composes'],
	Object.entries(PARTS).map(([name, p]) => [`\`${name}\``, p.duty, p.kind, p.by.map((b) => (b.includes('/') ? `\`${b}\`` : b)).join(', '), p.consumes === '*' ? 'any part -- a composition root' : list(p.consumes), list(composes(name))]));

// each part's boundary cites a layer of the justification chain (AR1): every `by` id appears in the target's section 2
for (const [a, p] of Object.entries(PARTS)) {
	if (!p.by?.length) partFaults.push(`part ${a} cites nothing in the justification chain`);
	for (const id of p.by ?? []) if (!citedInChain(id)) partFaults.push(`part ${a} is fixed by ${id}, which the target's justification chain (section 2) does not cite`);
}
// the current document's run time is evidenced: each bullet cites a test the gate runs that exists
const currentText = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
const runTime = (/\n## \d+\. Run time\n([\s\S]*?)(\n---\n|$)/.exec(currentText) || [])[1] ?? '';
for (const line of runTime.split('\n').filter((l) => l.startsWith('- **'))) {
	const tests = [...line.matchAll(/`(tests\/[\w.-]+\.test\.js)`/g)].map((m) => m[1]);
	if (!tests.length) partFaults.push(`the current run time's bullet "${line.slice(0, 50)}..." cites no test proving it`);
	for (const t of tests) if (!fs.existsSync(path.join(ROOT, t))) partFaults.push(`the current run time cites ${t}, which does not exist`);
}

const REGIONS = { layers, kinds, canvas, compositions, doors, exceptions, copies, gate, parts, 'part-divergence': divergence, justification: chainAboveModel };
// ---- the alignment register (A-0): parts that exist, names MISSION_KIT holds, no entry of MISSION_KIT left unreferenced
for (const [part, a] of Object.entries(ALIGNMENT)) {
	if (!PARTS[part]) partFaults.push(`ALIGNMENT names ${part}, which is no part`);
	for (const c of a.to ?? []) if (!MISSION_KIT[c]) partFaults.push(`ALIGNMENT.${part} aligns to ${c}, which MISSION_KIT does not hold -- add its standing, read, or correct the name`);
	if (!a.to?.length) partFaults.push(`ALIGNMENT.${part} aligns to nothing`);
}
const referenced = new Set(Object.values(ALIGNMENT).flatMap((a) => a.to ?? []));
// ---- the components (H26.1): parts that exist, each aligned to the component in the register, admitted by rulings the chain cites
for (const [c, d] of Object.entries(COMPONENTS)) {
	const short = c.slice(c.indexOf('/') + 1);
	for (const part of d.parts ?? []) {
		if (!PARTS[part]) partFaults.push(`COMPONENTS.${c} lets ${part} import it, which is no part`);
		else if (!ALIGNMENT[part]?.to?.includes(short)) partFaults.push(`COMPONENTS lets ${part} import ${c}, and ALIGNMENT does not align ${part} to ${short}`);
	}
	if (!d.by?.length) partFaults.push(`COMPONENTS.${c} cites no ruling that admits it`);
	for (const id of d.by ?? []) if (!citedInChain(id)) partFaults.push(`COMPONENTS.${c} is admitted by ${id}, which the target's justification chain (section 2) does not cite`);
}
for (const c of Object.keys(MISSION_KIT)) if (!referenced.has(c)) partFaults.push(`MISSION_KIT holds ${c}, which no part aligns to -- remove it`);
const alignmentRegister = table(['Part', 'Aligns to', `Standing, read ${MISSION_KIT_READ}`, 'Composing it waits on'],
	Object.entries(ALIGNMENT).map(([part, a]) => [`\`${part}\``, list(a.to ?? []), (a.to ?? []).map((c) => `${c}: ${MISSION_KIT[c] ?? '?'}`).join('; '), a.waits ?? '--']));

const TARGET_REGIONS = { 'target-parts': targetParts, 'target-alignment': alignmentRegister };

// ---- write or check
if (missingDuty.length) { console.log(`  \u2717 tools/layers.mjs LAYER_DUTY declares no duty for ${missingDuty.join(', ')}`); process.exit(1); }
if (partFaults.length) { for (const f of partFaults) console.log(`  \u2717 ${f}`); process.exit(1); }
const stale = [];
function render(file, regions) {
	if (!fs.existsSync(file)) { console.log(`  \u2717 ${path.relative(ROOT, file)} does not exist -- its authored frame holds the generated regions`); process.exit(1); }
	let doc = fs.readFileSync(file, 'utf8');
	for (const [name, body] of Object.entries(regions)) {
		const begin = `<!-- BEGIN GENERATED: architecture-${name}. Run tools/generate-architecture.mjs; do not edit by hand. -->`;
		const end = `<!-- END GENERATED: architecture-${name} -->`;
		const a = doc.indexOf(begin), b = doc.indexOf(end);
		if (a < 0 || b < a) { console.log(`  \u2717 ${path.relative(ROOT, file)} has no region architecture-${name}`); process.exit(1); }
		const want = `\n${body}\n`;
		if (doc.slice(a + begin.length, b) !== want) { stale.push(`${path.relative(ROOT, file)} ${name}`); doc = doc.slice(0, a + begin.length) + want + doc.slice(b); }
	}
	return doc;
}
const docs = [[TARGET, render(TARGET, TARGET_REGIONS)], [DOC, render(DOC, REGIONS)]];
if (CHECK) {
	if (stale.length) {
		console.log(`  \u2717 the architecture no longer says what the code declares: ${stale.join(', ')} -- run node tools/generate-architecture.mjs`);
		process.exit(1);
	}
	console.log(`  PASS -- both architecture documents' generated regions say what the code declares; ${outside.length} import(s) between parts the target does not allow, listed`);
} else {
	for (const [file, text] of docs) if (text !== fs.readFileSync(file, 'utf8')) fs.writeFileSync(file, text);
	console.log(`  ${stale.length ? `regenerated ${stale.join(', ')}` : 'nothing stale'}`);
}
process.exit(0);
