/*
tools/code-split.mjs -- the record tool that measures draw's code split at a release: running code by the kind of part claiming it,
the vendored components from their releases' source maps, draw's own code by top-level statement (pure data, declarations with
predicates, logic), and the data around it. Held here on a tree of its own, a git repository built for the test: every group and row,
the three-way split on a module written to hold each case the scanner must tell apart -- with each count stated by hand, and matched by
TypeScript's parser when the tool was built -- a component counted from its map's `sourcesContent`, and `--rev` on a commit with no
components, one pinning the version installed and one pinning another.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { classify, codeLines } from '../tools/code-split.mjs';

const TOOL = path.resolve(import.meta.dirname, '../tools/code-split.mjs');

/*
The module holding every case: each line's class in its comment's column is what the counts below sum. Pure data -- a literal of plain
values, frozen, parenthesised, `let`, a string, number or template, several declarators, one with no semicolon; with predicates -- an
arrow three deep, a method, a getter; logic -- a shebang, an import, a call, `new`, a conditional, a negative number, a literal followed by
calls holding arrows, a function, `export default`, an export list. Strings, a template and a regex hold braces, `=>`, `function` and
comment markers, and a block comment does; none of it is code. A blank line inside a literal is no code line.
*/
const SHAPES = [
	'#!/usr/bin/env node',                                                       // logic
	'// a line comment, no code',
	"import { a, f, SPREAD } from './a.mjs';",                                   // logic
	'/*',
	'A block comment holding { braces }, => and function, none of it code.',
	'*/',
	"export const DATA = { n: 1, s: 'two', l: [3, -4], m: a.b, t: `t${a}`, ...SPREAD };",   // data
	'const FROZEN = Object.freeze({',                                            // data
	'\tx: 1,',                                                                   // data
	'',
	'\ty: [2, 3],',                                                              // data
	'});',                                                                       // data
	'export const DEEP = {',                                                     // declared
	'\ta: { b: [{ c: (v) => v }] },',                                            // declared
	'\tz: 1,',                                                                   // declared
	'};',                                                                        // declared
	"const BRACES = { s: '{ => function', t: `} function ${'x'} =>`, r: /\\{=>function\\}/g, u: \"/* no comment */\", w: '// nor this' };",   // data
	"const NUM = 42, WORD = 'text';",                                            // data
	'const TEXT = `multi',                                                       // data
	'line`;',                                                                    // data
	'let MUTABLE = { m: 1 };',                                                   // data
	'const PAREN = ({ p: 1 });',                                                 // data
	'const CALLED = { a: f() };',                                                // logic
	'const MADE = { m: new Map() };',                                            // logic
	'const CHOSEN = [a ? 1 : 2];',                                               // logic
	'const NEG = -1;',                                                           // logic
	'const METHOD = { m() { return 1; } };',                                     // declared
	'const GETTER = { get g() { return 1; } };',                                 // declared
	'const total = [1, 2, 3]',                                                   // logic
	'\t.map((n) => n * 2)',                                                      // logic
	'\t.reduce((p, q) => p + q, 0);',                                            // logic
	'function logic(x) {',                                                       // logic
	'\treturn x + 1;',                                                           // logic
	'}',                                                                         // logic
	'const NOSEMI = { k: 1 }',                                                   // data
	'const AFTER = { j: 2 };',                                                   // data
	'function inline() { return 1; } const SHARED = { s: 1,',                    // logic: the function's line, first
	'\tt: 2 };',                                                                 // data: SHARED's own
	'export default { d: 1 };',                                                  // logic
	'export { DATA as D, logic, total };',                                       // logic
	'',
].join('\n');
const SHAPES_SPLIT = { data: 14, declared: 6, logic: 15 };

// a component's source as its release ships it, in its map: 4 code lines, with comments and blank lines that are none
const SOURCE = ['// the component\'s source', 'export function openThing(x: number): number {', '\t/* a comment */', '\treturn x * 2;', '}', '', 'export const ANSWER = 42;', ''].join('\n');

let root, scratch;
const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), text); };
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_AUTHOR_DATE: '2026-01-02T03:04:05Z', GIT_COMMITTER_DATE: '2026-01-02T03:04:05Z' } }).trim();
const pin = (version) => {
	write('package.json', JSON.stringify({ name: 'fixture', dependencies: { '@apnex/thing': `https://example.invalid/v${version}/apnex-thing-${version}.tgz`, ws: '^8.0.0' } }, null, '\t'));
	write('package-lock.json', JSON.stringify({ packages: { 'node_modules/@apnex/thing': { version } } }, null, '\t'));
};
const commits = {};

before(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-split-tree-'));
	scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'code-split-scratch-'));
	git('init', '-q');
	write('.gitignore', 'node_modules/\ndiagrams/*.json\n');
	write('tools/layers.mjs', `export const PARTS = {
	base: { kind: 'core', modules: ['core/'] },
	plug: { kind: 'plugin', modules: ['plugins/p/'] },
	product: { kind: 'composition', modules: ['product/'] },
	canvas: { kind: 'host', modules: ['app/src/canvas.js'] },
	page: { kind: 'composition root', modules: ['app/src/main.js'] },
	door: { kind: 'door', modules: ['server/door.mjs'] },
};
`);
	write('tools/helper.mjs', '#!/usr/bin/env node\n// a tool\nexport const HELP = 1;\n');
	write('core/shapes.mjs', SHAPES);
	write('core/a.mjs', 'export const a = { b: 1 };\nexport const f = () => 1;\nexport const SPREAD = {};\n');   // data 1, logic 1, data 1
	write('plugins/p/p.mjs', '// a plugin\nexport const P = { at: (x) => x };\n');                               // declared 1
	write('product/compose.mjs', 'export const C = [1, 2];\n');                                                // data 1
	write('app/src/canvas.js', 'export function draw() {\n\treturn 1;\n}\n');                                   // logic 3
	write('app/src/main.js', "import { draw } from './canvas.js';\ndraw();\n");                                 // logic 2
	write('server/door.mjs', 'export const open = () => 1;\n');                                                // logic 1
	write('stray/loose.mjs', 'export const loose = 1;\n');                                                     // data 1, claimed by no part
	write('tests/a.test.js', "// a test\nimport assert from 'node:assert';\n\nassert.ok(true);\n");              // 2 code lines, 3 non-blank
	write('tests/fixtures/f.json', '{\n\t"a": 1\n}\n');                                                        // 3 non-blank
	write('templates/t.json', '{\n\n\t"nodes": []\n}\n');                                                     // 3 non-blank
	write('lab/seeds.json', '{}\n');                                                                          // 1
	write('app/style.css', '/* a sheet */\n.a { color: red; }\n\n');                                           // 2
	write('app/index.html', '<!doctype html>\n<html></html>\n');                                               // 2
	write('dev/record.md', '# a record\n\nIt says so.\n');                                                     // 2
	write('docs/guide.md', '# a guide\n');                                                                     // 1
	write('README.md', '# fixture\n\nA tree.\n');                                                              // 2
	write('diagrams/stored.json', '{ "ignored": true }\n');                                                    // a server's data, ignored: not counted
	write('package.json', JSON.stringify({ name: 'fixture', dependencies: { ws: '^8.0.0' } }, null, '\t'));
	git('add', '-A'); git('commit', '-qm', 'no components'); commits.none = git('rev-parse', 'HEAD');
	pin('0.2.0'); git('add', '-A'); git('commit', '-qm', 'thing 0.2.0'); commits.installed = git('rev-parse', 'HEAD');
	pin('0.3.0'); git('add', '-A'); git('commit', '-qm', 'thing 0.3.0'); commits.other = git('rev-parse', 'HEAD');
	pin('0.2.0');   // the working tree pins what is installed again
	// the installed component: its release's dist, a map carrying its source
	write('node_modules/@apnex/thing/package.json', JSON.stringify({ name: '@apnex/thing', version: '0.2.0' }));
	write('node_modules/@apnex/thing/dist/index.js', 'export function openThing(x) { return x * 2; }\nexport const ANSWER = 42;\n//# sourceMappingURL=index.js.map\n');
	write('node_modules/@apnex/thing/dist/index.js.map', JSON.stringify({ version: 3, file: 'index.js', sources: ['../src/index.ts'], sourcesContent: [SOURCE], mappings: '' }));
	write('node_modules/@apnex/thing/dist/index.d.ts.map', JSON.stringify({ version: 3, sources: ['../src/declared.ts'], sourcesContent: ['export declare const NOT_COUNTED: 1;\n'.repeat(50)], mappings: '' }));
});
after(() => { for (const d of [root, scratch]) fs.rmSync(d, { recursive: true, force: true }); });

// the tool as a command, with a TMPDIR of its own so a --rev run can be seen to leave nothing behind
const run = (...args) => spawnSync(process.execPath, [TOOL, '--root', root, ...args], { encoding: 'utf8',
	env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT')), TMPDIR: scratch } });
// a table row's cells after its name, a total's bold name and figures read plain
const rowOf = (out, name) => out.split('\n').find((l) => l.startsWith(`| ${name} |`) || l.startsWith(`| **${name}** |`))?.split('|').slice(2, -1).map((c) => c.trim().replace(/\*/g, ''));

test('code-split: each top-level statement is classed as pure data, a declaration with predicates, or logic -- the module holding every case', () => {
	assert.deepEqual(classify(SHAPES), SHAPES_SPLIT, 'the counts its lines state, by hand');
	assert.equal(codeLines(SHAPES), SHAPES_SPLIT.data + SHAPES_SPLIT.declared + SHAPES_SPLIT.logic, 'every code line classed once');
	// controls, each one change from data: an arrow makes a predicate, a call or an operator makes logic, a comment is no line
	assert.deepEqual(classify('const A = { a: 1, b: [2] };\n'), { data: 1, declared: 0, logic: 0 });
	assert.deepEqual(classify('const A = { a: 1, b: [() => 2] };\n'), { data: 0, declared: 1, logic: 0 });
	assert.deepEqual(classify('const A = { a: 1, b: [g(2)] };\n'), { data: 0, declared: 0, logic: 1 });
	assert.deepEqual(classify('const A = { a: 1, b: [x === 2] };\n'), { data: 0, declared: 0, logic: 1 });
	assert.deepEqual(classify('const A = { a: 1, b: new Thing };\n'), { data: 0, declared: 0, logic: 1 }, 'new, with no call to read as one');
	assert.deepEqual(classify('const A = [x instanceof Y, 1];\n'), { data: 0, declared: 0, logic: 1 });
	assert.deepEqual(classify('const A = { in: 1, new: 2, instanceof: 3 };\n'), { data: 1, declared: 0, logic: 0 }, 'the same words as property names are plain');
	assert.deepEqual(classify('const A = { a: 1, b: "() => g(x === 2)" };\n// const B = () => 1;\n'), { data: 1, declared: 0, logic: 0 });
	assert.deepEqual(classify('const A = Object.freeze([1, `two`, -3]);\n'), { data: 1, declared: 0, logic: 0 });
	assert.deepEqual(classify('const A = Object.freeze([1]).map(String);\n'), { data: 0, declared: 0, logic: 1 });
});

test('code-split: the report -- running code by the kind of part claiming it, tests and tools apart, and code no part claims named', () => {
	const r = run();
	assert.equal(r.status, 0, r.stderr);
	const out = r.stdout;
	assert.match(out, /^# Code split -- [0-9a-f]{7} \+ uncommitted changes \(2026-01-02\)$/m, 'the tree, its commit and its date; the working tree differs from it');
	const shapes = SHAPES_SPLIT.data + SHAPES_SPLIT.declared + SHAPES_SPLIT.logic;
	assert.deepEqual(rowOf(out, 'core'), [String(shapes + 3)], 'core: the module of cases and its import\'s module');
	assert.deepEqual([rowOf(out, 'plugins'), rowOf(out, 'composition'), rowOf(out, 'hosts and doors'), rowOf(out, 'no part claims')], [['1'], ['1'], ['6'], ['1']],
		'a plugin, the composition, a host, a composition root and a door, and a module no part claims -- the one only: the installed component\'s dist/index.js, which git ignores, is no part of the tree');
	assert.deepEqual(rowOf(out, 'draw, running'), [String(shapes + 3 + 1 + 1 + 6 + 1)]);
	assert.match(out, /Product code no part claims: `stray\/loose\.mjs`\./, 'named');
	assert.deepEqual([rowOf(out, 'tests'), rowOf(out, 'tools')], [['2'], ['10']], 'tests and tools apart, in code lines: the manifest and the helper among the tools');
});

test('code-split: vendor -- each component counted from its release\'s source map, sourcesContent alone, and its share of what runs', () => {
	const out = run().stdout;
	assert.equal(codeLines(SOURCE), 4, 'control: the source holds 4 code lines');
	assert.deepEqual(rowOf(out, '`@apnex/thing`'), ['0.2.0', '1', '4'], 'its version, one source file, its code lines -- the .d.ts map not read');
	const draw = Number(rowOf(out, 'draw, running')[0]);
	assert.match(out, new RegExp(`Vendor's share of everything that runs: ${(Math.round((4 / (draw + 4)) * 1000) / 10).toFixed(1)}% \\(4 of ${draw + 4} code lines\\)\\.`));
});

test('code-split: draw\'s own code by statement, per group and in total, with the declarative share', () => {
	const out = run().stdout;
	const s = SHAPES_SPLIT;
	assert.deepEqual(rowOf(out, 'core'), [String(s.data + s.declared + s.logic + 3)], 'section 1\'s core row, read first');
	const section = out.slice(out.indexOf('## 3.'));
	assert.deepEqual(rowOf(section, 'core'), [String(s.data + 2), String(s.declared), String(s.logic + 1), `${(Math.round(((s.data + 2 + s.declared) / (s.data + s.declared + s.logic + 3)) * 1000) / 10).toFixed(1)}%`]);
	assert.deepEqual(rowOf(section, 'plugins'), ['0', '1', '0', '100.0%']);
	assert.deepEqual(rowOf(section, 'hosts and doors'), ['0', '0', '6', '0.0%']);
	assert.deepEqual(rowOf(section, 'no part claims'), ['1', '0', '0', '100.0%'], 'shown, since a module no part claims holds code');
	assert.deepEqual(rowOf(section, 'total').slice(0, 3), [String(s.data + 2 + 1 + 1), String(s.declared + 1), String(s.logic + 1 + 6)]);
});

test('code-split: data, not code, in non-blank lines', () => {
	const out = run().stdout;
	const lines = (name) => rowOf(out, name);
	assert.deepEqual(lines('diagram templates (`templates/`)'), ['1', '3']);
	assert.deepEqual(lines('the lab\'s seeds (`lab/seeds.json`)'), ['1', '1']);
	assert.deepEqual([lines('stylesheets'), lines('the pages\' HTML')], [['1', '2'], ['1', '2']]);
	assert.deepEqual([lines('test code'), lines('test fixtures (JSON)')], [['1', '3'], ['1', '3']]);
	assert.deepEqual([lines('records (`dev/`)'), lines('live docs (`docs/`, top-level Markdown)')], [['1', '2'], ['2', '3']]);
	assert.deepEqual(lines('tools (`tools/`)'), ['2', '11'], 'non-blank lines: a comment counts here, as it does not among code lines');
});

test('code-split: --rev -- a commit with no components counts no vendor; one pinning the installed version reads it; another version fails, naming it', () => {
	const none = run('--rev', commits.none);
	assert.equal(none.status, 0, none.stderr);
	assert.match(none.stdout, new RegExp(`^# Code split -- ${commits.none.slice(0, 7)} \\(2026-01-02\\)$`, 'm'), 'the commit, not the working tree');
	assert.match(none.stdout, /No component\./);
	assert.match(none.stdout, /Vendor's share of everything that runs: 0\.0% \(0 of \d+ code lines\)\./);
	const installed = run('--rev', commits.installed);
	assert.equal(installed.status, 0, installed.stderr);
	assert.deepEqual(rowOf(installed.stdout, '`@apnex/thing`'), ['0.2.0', '1', '4'], 'read from the installed package, the version pinned');
	const other = run('--rev', commits.other);
	assert.equal(other.status, 1, 'refused');
	assert.match(other.stderr, /the commit pins @apnex\/thing 0\.3\.0, and 0\.2\.0 is installed/, 'naming the component and both versions');
	assert.deepEqual(fs.readdirSync(scratch), [], 'each --rev run removed its scratch tree');
});

test('code-split: --row is one dated row for a ledger, its cells the columns --header names', () => {
	const header = run('--header').stdout.trim().split('\n');
	const row = run('--row', '--rev', commits.none).stdout.trim();
	assert.equal(header.length, 2, 'a header and its separator');
	const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
	assert.equal(cells(row).length, cells(header[0]).length, 'a cell for each column');
	assert.deepEqual(cells(row).slice(0, 2), ['2026-01-02', commits.none.slice(0, 7)], 'the commit\'s date, then the commit');
	assert.equal(cells(row)[cells(header[0]).indexOf('Vendor')], '0', 'no vendor at a commit with no components');
	assert.equal(cells(row)[cells(header[0]).indexOf('Unclaimed')], '1');
});
