#!/usr/bin/env node
/*
code-split -- how draw's code splits, measured at one tree: a record tool for the release ledger, not a check, and no gate step.

It reads one tree -- this checkout's files, tracked and new but not ignored, or a commit's (`--rev`) -- by that tree's own manifest (tools/layers.mjs PARTS)
and prints, as Markdown:
  1. running code, in code lines (a line holding anything but comments and whitespace), by the kind of the part that claims each
     module: core; plugins; composition; hosts and doors (kinds `host`, `composition root`, `door`); and product code no part claims,
     which should be none. Tests and tools are counted apart. Product code is every .js and .mjs file outside tests/ and tools/.
  2. vendor: each @apnex component the tree's package.json depends on, counted in code lines of its source as its release ships it --
     the `sourcesContent` of the .js.map files in node_modules/@apnex/<name>/dist/ -- and its share of everything that runs.
  3. draw's own code split by top-level statement: pure data (a top-level `const`, `let` or `var` whose initialiser is an object or
     array literal of plain values, possibly wrapped in `Object.freeze` or parentheses, or a string, number or template literal),
     declarations with predicates (such a literal holding a function anywhere inside: an arrow, a `function`, a method, a getter), and
     logic (everything else, imports and exports included) -- each line counted once, by the first statement or declarator spanning
     it, a declarator's own lines its class and the rest of its statement logic. Plain values are literals, names, member reads,
     templates, spreads, unary operators and + - * /; a call (but to `freeze`), `new`, a conditional or any other operator is logic.
  4. data, not code, in non-blank lines: the diagram templates, the lab's seeds, the stylesheets, the pages' HTML; and around the
     product: test code, test fixtures (JSON), tools, records (dev/) and live docs (docs/ and the top-level Markdown).

The scanner is the tokenizer tools/scan-layers.mjs reads every module with (tools/js-tokens.mjs): comments dropped, strings, templates
and regular-expression literals single tokens, so nothing inside them reads as code; statements are split at top-level semicolons, at
the closing brace of a function, class or control statement, and at a line break where the next line begins a statement.

  node tools/code-split.mjs [--root <dir>] [--rev <commit>] [--row | --header]
      --root    the repository to measure (default: this one)
      --rev     measure that commit, extracted with git archive into a scratch folder under TMPDIR and removed after; its
                components are read from this checkout's node_modules when that commit pins the versions installed, and are none
                when it depends on none -- any other version fails, naming it: nothing is downloaded
      --row     one dated Markdown table row for a ledger -- the measured commit's date, then the figures --header names
      --header  the ledger table's header and separator rows
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { lex, isP, isId } from './js-tokens.mjs';

// ---- reading one module

// where each line starts, so a token's offsets give its lines
function lineIndex(src) {
	const starts = [0];
	for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
	return (offset) => {
		let lo = 0, hi = starts.length - 1;
		while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid - 1; }
		return lo;
	};
}

// the lines holding code: a character of some token that is not whitespace -- comments are no token; a shebang is code
function codeLinesOf(src, T, lineOf) {
	const code = new Set();
	if (src.startsWith('#!')) code.add(0);
	for (const t of T) for (let k = t.start; k < t.end; k++) if (!/\s/.test(src[k])) code.add(lineOf(k));
	return code;
}

const OPENS = new Set(['(', '[', '{']), CLOSES = new Set([')', ']', '}']);
// the bracket matching the opener at T[i], or -1
function close(T, i, last = T.length - 1) {
	let d = 0;
	for (let k = i; k <= last; k++) {
		if (T[k].type !== 'p') continue;
		if (OPENS.has(T[k].value)) d++;
		else if (CLOSES.has(T[k].value) && --d === 0) return k;
	}
	return -1;
}
// how a token moves the nesting: brackets, and a template's substitutions, whose tokens follow its head segment
const nesting = (t) => {
	if (t.type === 'p') return OPENS.has(t.value) ? 1 : CLOSES.has(t.value) ? -1 : 0;
	if (t.type === 'tpl') return t.head && !t.tail ? 1 : t.tail && !t.head ? -1 : 0;
	return 0;
};

// a statement's head opens a block it ends with -- a function, a class, a control statement
const BLOCK_HEADS = new Set(['function', 'class', 'if', 'for', 'while', 'do', 'try', 'switch']);
const CONTINUES = new Set(['else', 'catch', 'finally', 'while']);
// a line may begin a statement with one of these, so a statement before it, on an earlier line, ends there (ASI)
const STARTS = new Set(['import', 'export', 'const', 'let', 'var', 'function', 'class', 'async', 'if', 'for', 'while', 'do', 'try', 'switch', 'throw', 'return']);
const OPERATOR_WORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'await', 'yield', 'extends']);
const endsExpression = (t) => (t.type === 'id' ? !OPERATOR_WORDS.has(t.value) : t.type === 'tpl' ? !!t.tail
	: t.type === 'p' ? [')', ']', '}', '++', '--'].includes(t.value) : true);

// the top-level statements, as [first token, last token]
function statementsOf(T, lineOf) {
	const out = [];
	let start = 0, depth = 0;
	const headOf = (s) => { let k = s; while (k < T.length && isId(T[k]) && ['export', 'default', 'async'].includes(T[k].value)) k++; return T[k]; };
	for (let i = 0; i < T.length; i++) {
		depth += nesting(T[i]);
		if (depth !== 0) continue;
		const t = T[i], next = T[i + 1];
		let ends = isP(t, ';');
		if (!ends && isP(t, '}') && t.block && BLOCK_HEADS.has(headOf(start)?.value)) ends = !(next && isId(next) && CONTINUES.has(next.value));
		if (!ends && next && lineOf(next.start) > lineOf(t.end - 1) && endsExpression(t) && isId(next) && STARTS.has(next.value)) ends = true;
		if (ends) { out.push([start, i]); start = i + 1; }
	}
	if (start < T.length) out.push([start, T.length - 1]);
	return out;
}

// ---- classifying a declarator's initialiser

const BAD_OPERATORS = new Set(['==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '??', '%', '**', '&', '|', '^', '<<', '>>', '>>>', '?',
	'=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=']);
const NOT_CALLEES = new Set(['typeof', 'void', 'delete', 'await', 'return', 'new', 'in', 'of', 'instanceof', 'case', 'throw', 'yield']);
// a word used as a property name -- `{ in: 1 }`, `a.new` -- is no operator
const asName = (T, j) => isP(T[j - 1], '.') || isP(T[j - 1], '?.') || isP(T[j + 1], ':');

// a function anywhere inside: an arrow, a `function`, or a parameter list opening a body -- a method, a getter, a setter
function holdsFunction(T, a, b) {
	for (let j = a; j <= b; j++) {
		if (isP(T[j], '=>') || (isId(T[j], 'function') && !asName(T, j))) return true;
		if (isP(T[j], ')') && j < b && isP(T[j + 1], '{')) return true;
	}
	return false;
}
// plain values only: no call but to `freeze`, no `new`, no conditional, no operator but + - * / and unary ones
function plain(T, a, b) {
	for (let j = a; j <= b; j++) {
		const t = T[j];
		if (t.type === 'p' && BAD_OPERATORS.has(t.value)) return false;
		if ((isId(t, 'new') || isId(t, 'instanceof') || isId(t, 'in')) && !asName(T, j)) return false;
		if (isP(t, '(') && j > a) {
			const p = T[j - 1];
			const call = (p.type === 'id' && !NOT_CALLEES.has(p.value)) || p.type === 'str' || (p.type === 'tpl' && p.tail) || isP(p, ')') || isP(p, ']') || isP(p, '?.');
			if (call && !(p.type === 'id' && /freeze$/.test(p.value))) return false;
		}
	}
	return true;
}
// a whole template literal: its head at a, its tail at b, closing the template the head opened
function wholeTemplate(T, a, b) {
	if (T[a].type !== 'tpl' || !T[a].head) return false;
	let d = 0;
	for (let j = a; j <= b; j++) {
		if (T[j].type === 'tpl') { if (T[j].head && !T[j].tail) d++; else if (T[j].tail && !T[j].head) d--; }
		if (j === a && T[j].head && T[j].tail) return a === b;
		if (d === 0 && j < b) return false;
	}
	return d === 0;
}
// an initialiser's class: 'data', 'declared' (with predicates) or 'logic'
function initialiserClass(T, a, b) {
	for (;;) {
		if (a > b) return 'logic';
		if (isP(T[a], '(') && close(T, a, b) === b) { a++; b--; continue; }
		// a call to freeze -- `Object.freeze(x)` -- read as its first argument
		if (isP(T[b], ')')) {
			let o = b, d = 0;
			for (; o >= a; o--) { if (isP(T[o], ')')) d++; else if (isP(T[o], '(') && --d === 0) break; }
			const callee = T.slice(a, o);
			if (o > a && callee.every((t) => t.type === 'id' || isP(t, '.') || isP(t, '?.')) && /freeze$/.test(T[o - 1].value ?? '')) {
				let e = o + 1, depth = 0;
				for (; e < b; e++) { depth += nesting(T[e]); if (depth === 0 && isP(T[e], ',')) break; }
				a = o + 1; b = e - 1;
				continue;
			}
		}
		break;
	}
	if ((isP(T[a], '{') || isP(T[a], '[')) && close(T, a, b) === b) return holdsFunction(T, a, b) ? 'declared' : plain(T, a, b) ? 'data' : 'logic';
	if (a === b && (T[a].type === 'str' || (T[a].type === 'num' && !T[a].value.endsWith('n')))) return 'data';
	return wholeTemplate(T, a, b) ? 'data' : 'logic';
}

// each code line of a module, by class: { data, declared, logic }
export function classify(src) {
	const T = lex(src), lineOf = lineIndex(src), code = codeLinesOf(src, T, lineOf);
	const cls = new Map();
	const mark = (from, to, c) => { for (let l = lineOf(T[from].start); l <= lineOf(T[to].end - 1); l++) if (!cls.has(l)) cls.set(l, c); };
	for (const [s, e] of statementsOf(T, lineOf)) {
		let k = s;
		if (isId(T[k], 'export') && !(isP(T[k + 1], '{') || isP(T[k + 1], '*') || isId(T[k + 1], 'default'))) k++;
		if (k <= e && isId(T[k]) && ['const', 'let', 'var'].includes(T[k].value)) {
			const last = isP(T[e], ';') ? e - 1 : e;
			let d0 = k + 1, depth = 0;
			for (let j = k + 1; j <= last + 1; j++) {
				if (j <= last) depth += nesting(T[j]);
				if (j === last + 1 || (depth === 0 && isP(T[j], ','))) {
					const d1 = j - 1;
					if (d0 <= d1) {
						let eq = -1, dd = 0;
						for (let q = d0; q <= d1; q++) { dd += nesting(T[q]); if (dd === 0 && isP(T[q], '=')) { eq = q; break; } }
						mark(d0, d1, eq < 0 ? 'logic' : initialiserClass(T, eq + 1, d1));
					}
					d0 = j + 1;
				}
			}
		}
		mark(s, e, 'logic');
	}
	const out = { data: 0, declared: 0, logic: 0 };
	for (const l of code) out[cls.get(l) ?? 'logic']++;
	return out;
}
export const codeLines = (src) => { const T = lex(src); return codeLinesOf(src, T, lineIndex(src)).size; };
const nonBlank = (src) => src.split('\n').filter((l) => /\S/.test(l)).length;

// ---- one tree

const GROUPS = { core: 'core', plugin: 'plugins', composition: 'composition', host: 'hosts and doors', 'composition root': 'hosts and doors', door: 'hosts and doors' };
const GROUP_ORDER = ['core', 'plugins', 'composition', 'hosts and doors'];
const UNCLAIMED = 'no part claims';
const isText = (buf) => !buf.includes(0);
const read = (tree, f) => fs.readFileSync(path.join(tree, f), 'utf8');

// a component's source as its release ships it: every source of every .js.map in its dist/, once each
function componentSource(dir) {
	const sources = new Map();
	const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js.map')) maps.push(p); } };
	const maps = [];
	walk(path.join(dir, 'dist'));
	for (const m of maps.sort()) {
		const map = JSON.parse(fs.readFileSync(m, 'utf8'));
		(map.sources ?? []).forEach((s, i) => { const text = map.sourcesContent?.[i]; if (typeof text === 'string') sources.set(path.resolve(path.dirname(m), map.sourceRoot ?? '', s), text); });
	}
	return { files: sources.size, lines: [...sources.values()].reduce((n, s) => n + codeLines(s), 0) };
}

// the version a tree pins for a component: its lockfile's, or the release file's name in package.json
function pinnedVersion(tree, name, spec) {
	try { const v = JSON.parse(read(tree, 'package-lock.json')).packages?.[`node_modules/${name}`]?.version; if (v) return v; } catch { /* no lockfile */ }
	return /-(\d+\.\d+\.\d+[^/]*?)\.tgz$/.exec(spec)?.[1] ?? spec;
}

/*
Measure one tree: `files`, its tracked files; `components`, the folder its @apnex packages are read from -- its own node_modules, or for
a commit this checkout's, once each version is shown to be the one pinned.
*/
// a tree's manifest, read by a process of its own -- the tree's tools/layers.mjs, imported and its PARTS printed as JSON -- since a
// specifier no scan can read is refused here as anywhere (tools/scan-layers.mjs L2)
const PRINT_PARTS = 'const { PARTS } = await import(process.argv[1]); process.stdout.write(JSON.stringify(PARTS));';
const partsOf = (tree) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', PRINT_PARTS, pathToFileURL(path.join(tree, 'tools/layers.mjs')).href], { encoding: 'utf8' }));

function measure(tree, files, { installed, checkPins = false } = {}) {
	const PARTS = partsOf(tree);
	const claims = Object.values(PARTS).flatMap((p) => p.modules.map((m) => [m, p.kind]));
	const kindOf = (f) => (claims.find(([m]) => m === f) ?? claims.find(([m]) => m.endsWith('/') && f.startsWith(m)))?.[1] ?? null;
	const under = (dir) => (f) => f.startsWith(`${dir}/`);
	const js = (f) => /\.m?js$/.test(f), testCode = (f) => /\.(m?js|cjs|ts)$/.test(f);
	const running = Object.fromEntries([...GROUP_ORDER, UNCLAIMED].map((g) => [g, 0]));
	const split = Object.fromEntries([...GROUP_ORDER, UNCLAIMED].map((g) => [g, { data: 0, declared: 0, logic: 0 }]));
	const unclaimed = [];
	let tests = 0, tools = 0;
	for (const f of files) {
		if (!js(f) && !(under('tests')(f) && testCode(f))) continue;
		if (under('tests')(f)) { tests += codeLines(read(tree, f)); continue; }
		if (under('tools')(f)) { tools += codeLines(read(tree, f)); continue; }
		const kind = kindOf(f), group = kind ? GROUPS[kind] : UNCLAIMED;
		if (kind && !group) throw new Error(`code-split: ${f} is claimed by a part of kind ${kind}, which no group holds`);
		if (!kind) unclaimed.push(f);
		const c = classify(read(tree, f));
		for (const k in c) split[group][k] += c[k];
		running[group] += c.data + c.declared + c.logic;
	}
	// vendor: each @apnex component the tree depends on, from its release's source maps
	const pkg = JSON.parse(read(tree, 'package.json'));
	const vendor = [];
	for (const [name, spec] of Object.entries(pkg.dependencies ?? {}).filter(([n]) => n.startsWith('@apnex/')).sort()) {
		const dir = path.join(installed, 'node_modules', name);
		const have = fs.existsSync(path.join(dir, 'package.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version : null;
		const want = pinnedVersion(tree, name, spec);
		if (checkPins && have !== want) throw new Error(`code-split: the commit pins ${name} ${want}, and ${have ? `${have} is installed` : 'none is installed'} -- install it, or measure a commit pinning what is installed; nothing is downloaded`);
		if (!have) throw new Error(`code-split: ${name} is a dependency and is not installed in ${installed}`);
		vendor.push({ name, version: have, ...componentSource(dir) });
	}
	// data, not code
	const ext = (e) => (f) => f.endsWith(e);
	const sum = (pick) => { const fs_ = files.filter(pick); return { files: fs_.length, lines: fs_.reduce((n, f) => { const b = fs.readFileSync(path.join(tree, f)); return n + (isText(b) ? nonBlank(b.toString('utf8')) : 0); }, 0) }; };
	const notIn = (...dirs) => (f) => !dirs.some((d) => under(d)(f));
	const data = {
		templates: sum((f) => under('templates')(f) && ext('.json')(f)),
		seeds: sum((f) => f === 'lab/seeds.json'),
		stylesheets: sum((f) => ext('.css')(f) && notIn('dev', 'tests')(f)),
		pages: sum((f) => ext('.html')(f) && (under('app')(f) || under('lab')(f))),
		testCode: sum((f) => under('tests')(f) && testCode(f)),
		fixtures: sum((f) => under('tests')(f) && ext('.json')(f)),
		tools: sum((f) => under('tools')(f) && isText(fs.readFileSync(path.join(tree, f)))),
		records: sum((f) => under('dev')(f) && isText(fs.readFileSync(path.join(tree, f)))),
		docs: sum((f) => under('docs')(f) || (!f.includes('/') && ext('.md')(f))),
	};
	return { running, split, unclaimed, tests, tools, vendor, data };
}

// ---- reporting

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pct = (part, whole) => (whole ? `${(Math.round((part / whole) * 1000) / 10).toFixed(1)}%` : '0.0%');
const totalOf = (m) => Object.values(m.running).reduce((a, b) => a + b, 0);
const vendorTotal = (m) => m.vendor.reduce((n, v) => n + v.lines, 0);
const splitTotal = (m) => { const t = { data: 0, declared: 0, logic: 0 }; for (const g of Object.values(m.split)) for (const k in t) t[k] += g[k]; return t; };

function report(m, { label, date }) {
	const draw = totalOf(m), vendor = vendorTotal(m), t = splitTotal(m), all = t.data + t.declared + t.logic;
	const row = (cells) => `| ${cells.join(' | ')} |`;
	const out = [`# Code split -- ${label} (${date})`, '', '## 1. Running code, in code lines', '', row(['Group', 'Code lines']), row(['---', '---:'])];
	for (const g of [...GROUP_ORDER, UNCLAIMED]) out.push(row([g, fmt(m.running[g])]));
	out.push(row(['**draw, running**', `**${fmt(draw)}**`]), '', 'Counted apart:', '', row(['Around the product', 'Code lines']), row(['---', '---:']), row(['tests', fmt(m.tests)]), row(['tools', fmt(m.tools)]));
	if (m.unclaimed.length) out.push('', `Product code no part claims: ${m.unclaimed.map((f) => `\`${f}\``).join(', ')}.`);
	out.push('', '## 2. Vendor, in code lines of the source each release ships', '');
	if (!m.vendor.length) out.push('No component.');
	else {
		out.push(row(['Component', 'Version', 'Source files', 'Code lines']), row(['---', '---', '---:', '---:']));
		for (const v of m.vendor) out.push(row([`\`${v.name}\``, v.version, fmt(v.files), fmt(v.lines)]));
		out.push(row(['**total**', '', fmt(m.vendor.reduce((n, v) => n + v.files, 0)), `**${fmt(vendor)}**`]));
	}
	out.push('', `Vendor's share of everything that runs: ${pct(vendor, draw + vendor)} (${fmt(vendor)} of ${fmt(draw + vendor)} code lines).`,
		'', "## 3. Draw's own code, by top-level statement", '', row(['Group', 'Pure data', 'With predicates', 'Logic', 'Declarative share']), row(['---', '---:', '---:', '---:', '---:']));
	for (const g of [...GROUP_ORDER, ...(m.running[UNCLAIMED] ? [UNCLAIMED] : [])]) {
		const s = m.split[g];
		out.push(row([g, fmt(s.data), fmt(s.declared), fmt(s.logic), pct(s.data + s.declared, s.data + s.declared + s.logic)]));
	}
	out.push(row(['**total**', `**${fmt(t.data)}**`, `**${fmt(t.declared)}**`, `**${fmt(t.logic)}**`, `**${pct(t.data + t.declared, all)}**`]),
		'', '## 4. Data, not code, in non-blank lines', '', row(['What', 'Files', 'Non-blank lines']), row(['---', '---:', '---:']));
	const D = m.data;
	for (const [name, d] of [['diagram templates (`templates/`)', D.templates], ["the lab's seeds (`lab/seeds.json`)", D.seeds], ['stylesheets', D.stylesheets], ["the pages' HTML", D.pages]]) out.push(row([name, fmt(d.files), fmt(d.lines)]));
	out.push('', 'Around the product:', '', row(['What', 'Files', 'Non-blank lines']), row(['---', '---:', '---:']));
	for (const [name, d] of [['test code', D.testCode], ['test fixtures (JSON)', D.fixtures], ['tools (`tools/`)', D.tools], ['records (`dev/`)', D.records], ['live docs (`docs/`, top-level Markdown)', D.docs]]) out.push(row([name, fmt(d.files), fmt(d.lines)]));
	return out.join('\n');
}

const COLUMNS = ['Date', 'Commit', 'Core', 'Plugins', 'Composition', 'Hosts and doors', 'Unclaimed', 'Draw running', 'Vendor', 'Vendor share',
	'Pure data', 'With predicates', 'Logic', 'Declarative share', 'Tests (code)', 'Tools (code)', 'Templates', 'Seeds', 'Stylesheets', 'Pages',
	'Test code', 'Test fixtures', 'Tools', 'Records', 'Live docs'];
const header = () => `| ${COLUMNS.join(' | ')} |\n|${COLUMNS.map((c, i) => (i < 2 ? ' --- ' : ' ---: ')).join('|')}|`;
function ledgerRow(m, { label, date }) {
	const draw = totalOf(m), vendor = vendorTotal(m), t = splitTotal(m), D = m.data;
	const cells = [date, label, ...[...GROUP_ORDER, UNCLAIMED].map((g) => fmt(m.running[g])), fmt(draw), fmt(vendor), pct(vendor, draw + vendor),
		fmt(t.data), fmt(t.declared), fmt(t.logic), pct(t.data + t.declared, t.data + t.declared + t.logic), fmt(m.tests), fmt(m.tools),
		...['templates', 'seeds', 'stylesheets', 'pages', 'testCode', 'fixtures', 'tools', 'records', 'docs'].map((k) => fmt(D[k].lines))];
	return `| ${cells.join(' | ')} |`;
}

// ---- the command

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const walkFiles = (dir, rel = '') => fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
	.flatMap((e) => (e.isDirectory() ? walkFiles(dir, path.join(rel, e.name)) : [path.join(rel, e.name)])).sort();

function codeSplit(argv) {
	const flag = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
	const root = path.resolve(flag('--root') ?? path.join(import.meta.dirname, '..'));
	if (argv.includes('--header')) return header();
	const rev = flag('--rev');
	let m, label, date;
	if (rev) {
		const sha = git(root, 'rev-parse', '--verify', `${rev}^{commit}`);
		label = sha.slice(0, 7); date = git(root, 'show', '-s', '--format=%cs', sha);
		const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'code-split-'));
		try {
			const tar = path.join(scratch, 'tree.tar'), tree = path.join(scratch, 'tree');
			fs.mkdirSync(tree);
			execFileSync('git', ['archive', '--format=tar', '-o', tar, sha], { cwd: root });
			execFileSync('tar', ['-xf', tar, '-C', tree]);
			m = measure(tree, walkFiles(tree), { installed: root, checkPins: true });
		} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
	} else {
		const head = git(root, 'rev-parse', '--short=7', 'HEAD');
		const dirty = git(root, 'status', '--porcelain') !== '';
		label = dirty ? `${head} + uncommitted changes` : head; date = git(root, 'show', '-s', '--format=%cs', 'HEAD');
		// the checkout's files: tracked, and new ones git does not ignore -- a server's stored diagrams, ignored, are no part of it
		const files = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter((f) => f && fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile());
		m = measure(root, files, { installed: root });
	}
	return argv.includes('--row') ? ledgerRow(m, { label, date }) : report(m, { label, date });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
	try { console.log(codeSplit(process.argv.slice(2))); } catch (e) { console.error(e.message); process.exit(1); }
}
