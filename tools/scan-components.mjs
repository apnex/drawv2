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
-- `zonegrid` -- cannot be split without a dictionary, and is not caught. A word a component genuinely needs is allowed by name in its
own decision record, never by loosening this match; whether a component holds draw's policy is the independent verifier's question.

The installed packages are draw's @apnex/ dependencies (tools/components.mjs); one draw depends on with no dist/ to read fails, rather
than passing for want of anything to check.

A SOURCE MAP IS JSON (F1, H26.1's verification). Read as raw text, its escapes glued `\n` and `\t` onto the word after them -- `\tlink`
read as `tlink` -- and the first word of every inlined source line was missed. A `.map` file is parsed: each `sourcesContent` entry is
read line by line as the source it is, its findings named by the field and the source's own line (`#/sourcesContent/0:2`), and every
other string in the map -- `file`, `sourceRoot`, `sources`, `names`, any field a tool adds -- as text; `mappings` is positions in
base64, not text, and is not read. A map that is not JSON fails, rather than passing for want of anything read.

Usage: node tools/scan-components.mjs [--root <dir>]
  --root  the tree whose package.json and node_modules are read (a test's copy); the default is this repository
*/
import fs from 'node:fs';
import path from 'node:path';
import { componentNames, filesUnder } from './components.mjs';

// draw's vocabulary (SNAP-GRID.md section 7.2): the words no component may hold. Ordinary words -- group, route, draw, mouse, key,
// bend -- are on no list
const DRAW_WORDS = ['node', 'link', 'zone', 'pipe', 'waypoint', 'device', 'diagram', 'anchor', 'glyph', 'spawner', 'transit', 'layout', 'junction', 'drawv2'];

const argOf = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = argOf('--root') ? path.resolve(argOf('--root')) : path.resolve(import.meta.dirname, '..');
const LISTED = new Set(DRAW_WORDS);

// a run split at case changes, underscores, hyphens, and letters against digits, lower-cased
const splitWords = (run) => run.split(/[_-]+/).filter(Boolean).flatMap((piece) => piece
	.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])/).filter(Boolean).map((w) => w.toLowerCase()));
const candidates = (line) => (line.match(/[A-Za-z0-9_-]+/g) ?? []).flatMap((run) => [...new Set([run.toLowerCase(), run.toLowerCase().replace(/[_-]+/g, ''), ...splitWords(run)])]);
const listed = (w) => (LISTED.has(w) ? w : w.endsWith('s') && LISTED.has(w.slice(0, -1)) ? w.slice(0, -1) : w.endsWith('es') && LISTED.has(w.slice(0, -2)) ? w.slice(0, -2) : null);

const problems = [], findings = [];
let names = [], files = 0;
const scan = (where, text) => text.split('\n').forEach((line, i) => {
	for (const word of candidates(line)) { const w = listed(word); if (w) findings.push(`${where}:${i + 1}  "${word}" (draw: ${w})`); }
});
// every string in a parsed map, by its JSON pointer, but `mappings` -- base64 positions, which a run of letters only seems to spell
const stringsOf = (value, pointer = '') => (typeof value === 'string' ? [[pointer, value]]
	: value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => (pointer === '' && k === 'mappings' ? [] : stringsOf(v, `${pointer}/${k}`))) : []);
try { names = componentNames(ROOT); } catch (e) { problems.push(`package.json could not be read: ${e.message}`); }
for (const name of names) {
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
for (const p of problems) console.log(`  \u2717 ${p}`);
for (const f of findings) console.log(`  ${f}`);
if (problems.length || findings.length) {
	console.log(`scan-components: FAIL -- ${findings.length} word(s) of draw's vocabulary${problems.length ? `, ${problems.length} component(s) unread` : ''} -- a release that leaks draw's words never reaches draw's pages (SNAP-GRID.md section 7.2)`);
	process.exit(1);
}
console.log(`scan-components: PASS -- ${names.length} component(s), ${files} file(s) of dist/, no word of draw's vocabulary`);
