#!/usr/bin/env node
/*
lab-matrix -- the lab behaviour matrix's generator and its gate.

THE MATRIX is every gesture the lab offers, applied to every board state where the rules decide
something different: what should happen, the ruling it follows, and whether the lab does it. The
director asked for it on 2026-09-29, "such that we can refine and iterate on behaviours in a deliberate
fashion" -- so a behaviour is stated in one place, and changing it is an edit to one row.

ONE MASTER, ONE GENERATED VIEW (mission-kit P3). The master is
`dev/design/unification/BEHAVIOUR-MATRIX.json`. Its readable view, `BEHAVIOUR-MATRIX.md`, holds a
hand-written charter and blocks GENERATED from the master, which this writes and checks. Two
hand-maintained copies drift -- always -- so there is one place to edit and the other is a function of
it, compared field by field rather than checked for existence.

WHAT THIS HOLDS, and what it does not:
  - the SHAPE of every row, and the vocabulary its state and gesture must come from (here)
  - that the generated view is exactly what the master produces (here, `--check`, in the gate)
  - that each row DOES what it says -- not here: `tests/lab-browser.test.js` runs every row in real
    Chrome with real input, and owns the step and check vocabulary, since it is the one that executes it

Usage: node tools/lab-matrix.mjs --check | --write
*/

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const MASTER = path.join(root, 'dev/design/unification/BEHAVIOUR-MATRIX.json');
const VIEW = path.join(root, 'dev/design/unification/BEHAVIOUR-MATRIX.md');

const STANDING = ['ruled', 'reading', 'open'];
const BUILT = ['yes', 'todo'];
const ID = /^[A-Z]+-\d\d$/;
const ASCII = /^[\x20-\x7e]*$/;   // S13: typeable characters only, so the generated view passes the style gate too

/*
Every way a matrix can be malformed, as a list of sentences -- empty when it is sound.

The rules follow from what each field MEANS. An open row is a question, so it carries the question, a
proposal and what happens today, and no checks, since nothing has been ruled to check. A ruled or read
row carries checks and says whether they are built. A `todo` row says what happens today, because that
is what the director is deciding against; a built one does not, because what happens is then the intent.
*/
function problems(m) {
	const out = [];
	const text = (where, v) => {
		if (typeof v !== 'string' || !v.trim()) out.push(`${where}: missing`);
		else if (!ASCII.test(v)) out.push(`${where}: not plain ASCII (S13)`);
	};
	for (const key of ['states', 'gestures', 'invariants']) {
		if (!m[key] || typeof m[key] !== 'object' || !Object.keys(m[key]).length) out.push(`${key}: missing or empty`);
	}
	if (out.length) return out;
	for (const [name, s] of Object.entries(m.states)) {
		text(`state ${name}: about`, s.about);
		if (typeof s.board !== 'string') out.push(`state ${name}: board must be a seed name, or "" for a blank board`);
		if (!Array.isArray(s.setup)) out.push(`state ${name}: setup must be a list of steps`);
		if (!s.expect || typeof s.expect !== 'object') out.push(`state ${name}: checks that the board is in this state are required`);
	}
	for (const [name, about] of Object.entries(m.gestures)) text(`gesture ${name}`, about);
	for (const [id, about] of Object.entries(m.invariants)) text(`invariant ${id}`, about);
	const na = new Set((m.notApplicable ?? []).map(([s, g]) => `${s}|${g}`));
	for (const key of na) {
		const [s, g] = key.split('|');
		if (!m.states[s] || !m.gestures[g]) out.push(`notApplicable ${s} x ${g}: names no declared state or gesture`);
	}

	const seen = new Set();
	for (const r of m.rows ?? []) {
		const at = `row ${r.id ?? '(no id)'}`;
		if (!ID.test(r.id ?? '')) out.push(`${at}: id must look like DEL-01`);
		if (seen.has(r.id)) out.push(`${at}: id used twice`);
		seen.add(r.id);
		if (!m.states[r.state]) out.push(`${at}: state "${r.state}" is not declared`);
		if (!m.gestures[r.gesture]) out.push(`${at}: gesture "${r.gesture}" is not declared`);
		if (na.has(`${r.state}|${r.gesture}`)) out.push(`${at}: ${r.state} x ${r.gesture} is declared not applicable`);
		if (!Array.isArray(r.steps) || !r.steps.length) out.push(`${at}: steps that perform the gesture are required`);
		text(`${at}: does`, r.does);
		text(`${at}: rule`, r.rule);
		if (!STANDING.includes(r.standing)) out.push(`${at}: standing must be one of ${STANDING.join(', ')}`);
		if (r.standing === 'open') {
			for (const f of ['question', 'proposal', 'today']) text(`${at}: ${f}`, r[f]);
			if ('expect' in r || 'built' in r || 'intent' in r) out.push(`${at}: an open row has no intent, checks or build status -- nothing is ruled yet`);
		} else {
			text(`${at}: intent`, r.intent);
			if (!r.expect || typeof r.expect !== 'object' || !Object.keys(r.expect).length) out.push(`${at}: checks are required`);
			if (!BUILT.includes(r.built)) out.push(`${at}: built must be one of ${BUILT.join(', ')}`);
			if (r.built === 'todo') text(`${at}: today`, r.today);
			if (r.built === 'yes' && 'today' in r) out.push(`${at}: a built row has no "today" -- what happens is its intent`);
			for (const f of ['question', 'proposal']) if (f in r) out.push(`${at}: "${f}" belongs to an open row`);
		}
	}
	if (!seen.size) out.push('rows: none');
	return out;
}

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const status = (r) => (r.standing === 'open' ? 'OPEN' : `${r.standing}, ${r.built === 'yes' ? 'built' : 'TODO'}`);
const mark = (r) => (r.standing === 'open' ? ' (open)' : r.built === 'todo' ? ' (todo)' : r.standing === 'reading' ? ' (reading)' : '');

function renderInvariants(m) {
	return ['| id | after every row, whatever it checks for itself |', '|---|---|',
		...Object.entries(m.invariants).map(([id, about]) => `| ${id} | ${cell(about)} |`)].join('\n');
}

function renderGrid(m) {
	const gestures = Object.keys(m.gestures);
	const na = new Set((m.notApplicable ?? []).map(([s, g]) => `${s}|${g}`));
	const lines = [`| state \\ gesture | ${gestures.map(cell).join(' | ')} |`, `|---|${gestures.map(() => '---').join('|')}|`];
	for (const s of Object.keys(m.states)) {
		const cells = gestures.map((g) => {
			const here = m.rows.filter((r) => r.state === s && r.gesture === g);
			if (here.length) return here.map((r) => `${r.id}${mark(r)}`).join(', ');
			return na.has(`${s}|${g}`) ? 'n/a' : '.';
		});
		lines.push(`| ${cell(s)} | ${cells.join(' | ')} |`);
	}
	const count = (f) => m.rows.filter(f).length;
	// S6: one sentence per line, and a line inside a paragraph ends in a hard break, or the style tool rewrites it
	lines.push('', `${m.rows.length} rows: ${count((r) => r.built === 'yes')} built, ${count((r) => r.built === 'todo')} todo, ${count((r) => r.standing === 'open')} open.\\`,
		'A `.` is a permutation nobody has specified yet; `n/a` is one the board gives nothing to act on.', '',
		'| state | board | what it is |', '|---|---|---|',
		...Object.entries(m.states).map(([name, s]) => `| ${cell(name)} | ${s.board ? `\`?seed=${s.board}\`` : 'blank'} | ${cell(s.about)} |`), '',
		'| gesture | what the author does |', '|---|---|',
		...Object.entries(m.gestures).map(([name, about]) => `| ${cell(name)} | ${cell(about)} |`));
	return lines.join('\n');
}

function renderRows(m) {
	return ['| id | state x gesture | does | intended | rule | status |', '|---|---|---|---|---|---|',
		...m.rows.map((r) => {
			const intended = r.standing === 'open'
				? `OPEN: ${r.question} Proposed: ${r.proposal} Today: ${r.today}`
				: `${r.intent}${r.built === 'todo' ? ` Today: ${r.today}` : ''}`;
			return `| ${r.id} | ${cell(r.state)} x ${cell(r.gesture)} | ${cell(r.does)} | ${cell(intended)} | ${cell(r.rule)} | ${status(r)} |`;
		})].join('\n');
}

function renderOpen(m) {
	const open = m.rows.filter((r) => r.standing === 'open');
	if (!open.length) return 'Nothing is waiting for a ruling.';
	return ['| id | the question | proposed | today |', '|---|---|---|---|',
		...open.map((r) => `| ${r.id} | ${cell(r.question)} | ${cell(r.proposal)} | ${cell(r.today)} |`)].join('\n');
}

const BLOCKS = { invariants: renderInvariants, grid: renderGrid, rows: renderRows, open: renderOpen };

// replace one generated block, found by its markers; a view missing a marker is an error, never silently skipped
function splice(view, name, body) {
	const begin = `<!-- BEGIN GENERATED: ${name}. Run node tools/lab-matrix.mjs --write; do not edit by hand. -->`;
	const end = `<!-- END GENERATED: ${name} -->`;
	const a = view.indexOf(begin), b = view.indexOf(end);
	if (a === -1 || b === -1 || b < a) throw new Error(`${path.relative(root, VIEW)} has no generated block "${name}" -- it needs both markers:\n${begin}\n${end}`);
	return `${view.slice(0, a + begin.length)}\n${body}\n${view.slice(b)}`;
}

const mode = process.argv[2];
if (mode !== '--check' && mode !== '--write') {
	console.error('usage: node tools/lab-matrix.mjs --check | --write');
	process.exit(2);
}
const matrix = JSON.parse(fs.readFileSync(MASTER, 'utf8'));
const found = problems(matrix);
if (found.length) {
	console.error(`  lab-matrix: ${path.relative(root, MASTER)} is malformed:\n${found.map((f) => `    - ${f}`).join('\n')}`);
	process.exit(1);
}
const current = fs.readFileSync(VIEW, 'utf8');
let next = current;
for (const [name, render] of Object.entries(BLOCKS)) next = splice(next, name, render(matrix));
if (mode === '--write') {
	if (next !== current) fs.writeFileSync(VIEW, next);
	console.log(`  lab-matrix: ${path.relative(root, VIEW)} ${next === current ? 'already current' : 'regenerated'} -- ${matrix.rows.length} rows`);
} else if (next !== current) {
	console.error(`  lab-matrix: ${path.relative(root, VIEW)} is STALE against ${path.relative(root, MASTER)} -- regenerate with: node tools/lab-matrix.mjs --write`);
	process.exit(1);
} else {
	console.log(`  lab-matrix: PASS -- ${matrix.rows.length} rows, and the view is exactly what the master produces`);
}
