#!/usr/bin/env node
/*
scan-components -- H26.1 (dev/design/components/SNAP-GRID.md section 7.2, guardrail G3). No word of draw's reaches draw's pages
through a component.

A component knows nothing of draw (H26-1): its own gate fails when its source holds a word of a consumer's vocabulary, in code, a
string or a comment -- an import check cannot see a word in a comment (P4). Draw's gate runs the same check, with draw's list, over
every installed component's dist/ -- each file, its declarations and its source maps' inlined sources among them -- so a release that
leaks draw's words cannot reach draw's pages. The match is the component's own (snap-grid's tools/check-vocabulary.mjs): every run of
letters, digits, underscores and hyphens is a candidate whole, lower-cased, and again with its underscores and hyphens removed, and
split at case changes, underscores, hyphens and between letters and digits, each part a candidate; a candidate matches a listed word
when it equals it, or equals it once a trailing `s` or `es` is removed. A run of lower-case letters holding a word with no break in it
-- `zonegrid` -- cannot be split without a dictionary, and is not caught. A word a component genuinely needs is allowed by name, never
by loosening this match; whether a component holds draw's policy is the independent verifier's question.

AMENDED H31-4 (dev/DECISIONS.md): THE ALLOWANCE IS HELD IN DRAW, in `VOCABULARY_ALLOWANCES` below, where it was to be named in each
component's decision record and nothing read one: per component, per word, `{ lines, term }` -- the count of distinct lines the word
was found on in that component when the allowance was made, and the component's own meaning of the word and where it comes from. A
ratchet: a count at or below `lines` passes, one below it said until the allowance is lowered (a fall written down, as draw's other
records are); a count above it fails, naming every line of that word; a word with no allowance fails as before. Draw's four extracted
components take none -- their own gates carry draw's list (H26-1) -- and an allowance for a package draw does not depend on fails, so
none outlives its consumer. The table starts empty: an entry is added, with its measured count, when draw takes the component.

The installed packages are draw's @apnex/ dependencies (tools/components.mjs); one draw depends on with no dist/ to read fails, rather
than passing for want of anything to check.

A SOURCE MAP IS JSON (F1, H26.1's verification). Read as raw text, its escapes glued `\n` and `\t` onto the word after them -- `\tlink`
read as `tlink` -- and the first word of every inlined source line was missed. A `.map` file is parsed: each `sourcesContent` entry is
read line by line as the source it is, its findings named by the field and the source's own line (`#/sourcesContent/0:2`), and every
other string in the map -- `file`, `sourceRoot`, `sources`, `names`, any field a tool adds -- as text; `mappings` is positions in
base64, not text, and is not read. A map that is not JSON fails, rather than passing for want of anything read.

Usage: node tools/scan-components.mjs [--root <dir>] [--allowances <file>]
  --root        the tree whose package.json and node_modules are read (a test's copy); the default is this repository
  --allowances  a JSON file of allowances read in place of `VOCABULARY_ALLOWANCES` (a test's copy)
*/
import fs from 'node:fs';
import path from 'node:path';
import { componentNames, filesUnder } from './components.mjs';

// draw's vocabulary (SNAP-GRID.md section 7.2): the words no component may hold. Ordinary words -- group, route, draw, mouse, key,
// bend -- are on no list
const DRAW_WORDS = ['node', 'link', 'zone', 'pipe', 'waypoint', 'device', 'diagram', 'anchor', 'glyph', 'spawner', 'transit', 'layout', 'junction', 'drawv2'];

/*
H31-4: THE ALLOWANCES -- component package name -> draw's word -> { lines, term }, `lines` the distinct lines found when it was made,
`term` the component's own meaning of the word and where it comes from (e.g. "AGP's peer, imported as a type"). Empty: an entry is
added, with its measured count, when draw takes the component.
*/
const VOCABULARY_ALLOWANCES = {};
// the components draw extracted from itself, which take no allowance: their own gates carry draw's list (H26-1)
const DRAW_EXTRACTED = ['@apnex/snap-grid', '@apnex/input-binding', '@apnex/input-capture', '@apnex/vector-scene'];

const argOf = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = argOf('--root') ? path.resolve(argOf('--root')) : path.resolve(import.meta.dirname, '..');
const LISTED = new Set(DRAW_WORDS);
const ALLOWANCES = argOf('--allowances') ? JSON.parse(fs.readFileSync(argOf('--allowances'), 'utf8')) : VOCABULARY_ALLOWANCES;

// a run split at case changes, underscores, hyphens, and letters against digits, lower-cased
const splitWords = (run) => run.split(/[_-]+/).filter(Boolean).flatMap((piece) => piece
	.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])/).filter(Boolean).map((w) => w.toLowerCase()));
const candidates = (line) => (line.match(/[A-Za-z0-9_-]+/g) ?? []).flatMap((run) => [...new Set([run.toLowerCase(), run.toLowerCase().replace(/[_-]+/g, ''), ...splitWords(run)])]);
const listed = (w) => (LISTED.has(w) ? w : w.endsWith('s') && LISTED.has(w.slice(0, -1)) ? w.slice(0, -1) : w.endsWith('es') && LISTED.has(w.slice(0, -2)) ? w.slice(0, -2) : null);

const problems = [], hits = [];
let names = [], files = 0, component = null;
const scan = (where, text) => text.split('\n').forEach((line, i) => {
	for (const word of candidates(line)) {
		const w = listed(word);
		if (w) hits.push({ component, w, at: `${where}:${i + 1}`, text: `${where}:${i + 1}  "${word}" (draw: ${w})` });
	}
});
// every string in a parsed map, by its JSON pointer, but `mappings` -- base64 positions, which a run of letters only seems to spell
const stringsOf = (value, pointer = '') => (typeof value === 'string' ? [[pointer, value]]
	: value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => (pointer === '' && k === 'mappings' ? [] : stringsOf(v, `${pointer}/${k}`))) : []);
try { names = componentNames(ROOT); } catch (e) { problems.push(`package.json could not be read: ${e.message}`); }
for (const name of names) {
	component = name;
	const dist = path.join(ROOT, 'node_modules', ...name.split('/'), 'dist');
	const all = filesUnder(dist);
	if (!all.length) { problems.push(`${name} has no dist/ to read -- run npm ci`); continue; }
	for (const f of all) {
		files++;
		const text = fs.readFileSync(path.join(dist, f), 'utf8');
		if (!f.endsWith('.map')) { scan(`${name}/dist/${f}`, text); continue; }
		let map;
		try { map = JSON.parse(text); } catch { problems.push(`${name}/dist/${f} is not JSON -- a source map's inlined sources cannot be read`); continue; }
		for (const [pointer, value] of stringsOf(map)) scan(`${name}/dist/${f}#${pointer}`, value);
	}
}
// H31-4: each allowance's own shape, and whom it may be for -- none for a component draw extracted, none for one it does not take
const allowances = [];
for (const [name, words] of Object.entries(ALLOWANCES ?? {})) {
	if (DRAW_EXTRACTED.includes(name)) { problems.push(`an allowance for ${name}, a component draw extracted from itself -- it takes none; its own gate carries draw's list (H26-1, H31-4)`); continue; }
	if (!names.includes(name)) { problems.push(`an allowance for ${name}, which draw does not depend on -- remove it, so no allowance outlives its consumer (H31-4)`); continue; }
	for (const [w, a] of Object.entries(words ?? {})) {
		const at = `the allowance for ${name} "${w}"`;
		if (!LISTED.has(w)) { problems.push(`${at} names "${w}", which is no word of draw's`); continue; }
		if (!a || typeof a !== 'object' || Object.keys(a).some((k) => k !== 'lines' && k !== 'term')) { problems.push(`${at} holds a field other than lines and term`); continue; }
		if (!Number.isInteger(a.lines) || a.lines < 1) { problems.push(`${at}: lines is not a positive whole number`); continue; }
		if (typeof a.term !== 'string' || !a.term.trim()) { problems.push(`${at} names no term of the component's own`); continue; }
		allowances.push({ name, w, lines: a.lines });
	}
}
// the hits an allowance takes, counted by distinct line: within it, passed, a fall said; above it, failed, every line of the word named
const findings = [], falls = [];
let allowed = 0;
const allowanceOf = (h) => allowances.find((a) => a.name === h.component && a.w === h.w);
for (const a of allowances) {
	const mine = hits.filter((h) => allowanceOf(h) === a);
	const lines = [...new Set(mine.map((h) => h.at))];
	if (lines.length > a.lines) {
		problems.push(`${a.name} "${a.w}": ${lines.length} line(s), allowed ${a.lines} -- RISE: the lines below, one or more not allowed`);
		findings.push(...mine.map((h) => h.text));
	} else {
		allowed += lines.length;
		if (lines.length < a.lines) falls.push(`${a.name} "${a.w}": ${lines.length} line(s), allowed ${a.lines} -- FALL: lower the allowance in this commit, so the progress is written down`);
	}
}
findings.push(...hits.filter((h) => !allowanceOf(h)).map((h) => h.text));
for (const p of problems) console.log(`  \u2717 ${p}`);
for (const f of findings) console.log(`  ${f}`);
for (const f of falls) console.log(`  \u2193 ${f}`);
if (problems.length || findings.length) {
	console.log(`scan-components: FAIL -- ${findings.length} word(s) of draw's vocabulary${problems.length ? `, ${problems.length} problem(s)` : ''} -- a release that leaks draw's words never reaches draw's pages (SNAP-GRID.md section 7.2; H31-4)`);
	process.exit(1);
}
console.log(`scan-components: PASS -- ${names.length} component(s), ${files} file(s) of dist/, no word of draw's vocabulary beyond ${allowances.length} allowance(s), ${allowed} line(s) allowed`);
