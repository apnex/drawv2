#!/usr/bin/env node
/*
H25.0 (B365) -- THE MEASURES OF A COPIED FACT: a fact stated in two places, which nothing keeps the same.

H22 closed the unification against a count of imports a part makes that the target does not allow. Two modules holding the
same fact without importing each other are invisible to that count, and the published SVG's copied order of layers and copied
label rules drifted from the page unseen until the director looked (B361). These are the measures that see a copy; the scanner
that runs them over the tree, and holds each count to its record, is tools/scan-copies.mjs.

  copiedStyleRules        the same property of the same elements set in two stylesheets
  foreignStyleRules       a stylesheet setting the look of a class only plugins draw, none of them the stylesheet's owner
  stylesDrawnByNoPart     a class a stylesheet styles that no part is seen putting on an element -- dead, or a blind spot here
  copiedLines             lines of one page or stylesheet that another repeats, five in a row or more
  modulesNoEntryReaches   a module in a product folder that no production entry imports -- kept only for the tests

Each is a pure function of the text it is handed, so tests/scan-copies.test.js can plant a copy and watch it caught.
*/
import { withoutRegions } from './regions.mjs';   // H25.4: a generated region left out by its exact markers

// a class name as the tree writes them: lower case, digits, single hyphens
const CLASS_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const wordsOf = (s) => s.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ').split(/\s+/).filter((w) => CLASS_NAME.test(w));

/*
WHERE A CLASS IS PUT ON AN ELEMENT: markup written as text (`class="solid"`), the value given to a class key -- an element's `class`, a layer's `cls`, `className =`, an
appearance's `addClass`, a pick's `idle` state, a gesture's `preview`, a handle's `dragState` -- and the writes `classList.add` and
`.toggle`, a state set or cleared through the renderer (`setState`, `clearState`), and `setAttribute('class', ...)`. A class is
credited to the part whose module writes it there. A class only READ (`classList.contains`, `.includes('label')`), or a word
quoted under another key (a layer's `layer: 'zones'`, a layout's name), is not a class put on an element, and crediting it would
hide a copy (H25.0's adversarial review, finding 5).
*/
const CLASS_KEY = /\b(?:class|cls|addClass|idle|preview|dragState)\s*:\s*|\bclassName\s*=(?!=)\s*|setAttribute\(\s*(['"])class\1\s*,\s*/g;
const CLASS_CALL = /\bclassList\.(?:add|toggle|replace)\(|\b(?:set|clear)State\(/g;

// the index just past the string or template that opens at `i` -- a template's `${...}` skipped whole, nested strings and all
function pastLiteral(code, i) {
	const q = code[i];
	for (let j = i + 1; j < code.length; j++) {
		if (code[j] === '\\') { j++; continue; }
		if (code[j] === q) return j + 1;
		if (q === '`' && code[j] === '$' && code[j + 1] === '{') {
			let depth = 1;
			for (j += 2; j < code.length && depth; j++) {
				if (code[j] === "'" || code[j] === '"' || code[j] === '`') { j = pastLiteral(code, j) - 1; continue; }
				if (code[j] === '{') depth++; else if (code[j] === '}') depth--;
			}
			j--;
		}
	}
	return code.length;
}

// the text of one expression from `at`: to the first `,` `;` or line end at depth 0, or the bracket that closes around it --
// a call's whole argument list when `call`
function expressionAt(code, at, call = false) {
	let depth = 0, i = at;
	while (i < code.length) {
		const ch = code[i];
		if (ch === "'" || ch === '"' || ch === '`') { i = pastLiteral(code, i); continue; }
		if ('([{'.includes(ch)) depth++;
		else if (')]}'.includes(ch)) { if (depth === 0) break; depth--; }
		else if (depth === 0 && !call && (ch === ',' || ch === ';' || ch === '\n')) break;
		i++;
	}
	return code.slice(at, i);
}

// the class names an expression's literals spell: a template's static parts and the strings inside its expressions, and strings
function classesInExpression(expr) {
	const out = [];
	for (const m of expr.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
		out.push(...wordsOf(m[1]));
		for (const q of m[1].matchAll(/(['"])([^'"]*)\1/g)) out.push(...wordsOf(q[2]));
	}
	for (const m of expr.replace(/`(?:[^`\\]|\\.)*`/g, '').matchAll(/(['"])([^'"]*)\1/g)) out.push(...wordsOf(m[2]));
	return out;
}

// a source with its comments blanked to spaces, so positions and line breaks survive: block comments, and a line comment that
// opens a line or follows whitespace (a `//` inside a string such as a URL follows no whitespace and is kept)
const blankComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|\s)\/\/[^\n]*/g, (c, lead) => lead + ' '.repeat(c.length - lead.length));

/** The classes a module's source puts on elements. */
export function classesPutOnElements(source) {
	const code = blankComments(source), out = new Set();
	for (const m of code.matchAll(CLASS_KEY)) classesInExpression(expressionAt(code, m.index + m[0].length)).forEach((c) => out.add(c));
	// and markup a module writes as text -- a glyph's `<g class="solid">` -- puts its classes on the elements it makes
	for (const m of code.matchAll(/\bclass=\\?"([^"\\]*)\\?"/g)) wordsOf(m[1]).forEach((c) => out.add(c));
	for (const m of code.matchAll(CLASS_CALL)) {
		const args = expressionAt(code, m.index + m[0].length, true);
		// a state call's first argument is the entity, not a class
		const rest = m[0].includes('State') ? args.slice(expressionAt(args, 0).length) : args;
		classesInExpression(rest).forEach((c) => out.add(c));
	}
	return out;
}

/** The classes a page's markup writes on its elements: `class="..."`. */
export const classesInMarkup = (html) => new Set([...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => wordsOf(m[1])));

/** Every rule of a stylesheet as one selector and the properties it sets; at-rule blocks are left out. */
export function styleRulesOf(css) {
	const out = [];
	const text = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@[^{};]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
	for (const m of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
		const props = [...m[2].matchAll(/(--[\w-]+|[a-z-]+)\s*:/g)].map((x) => x[1]);
		for (const sel of m[1].split(',').map((s) => s.trim()).filter(Boolean)) out.push({ selector: sel, props });
	}
	return out;
}

/*
Which elements a selector sets: its SUBJECT -- the compound after the last descendant step, with any sibling steps before it
(`.link.selected+.link-head`) -- and its CONTEXT, the ancestors before that. Two rules set the same elements when their subjects
match and their contexts match, or when one has no context and the other's is one bare class: `.zone-rect` and
`.zone .zone-rect` set the same rectangles, while `.node .select-box` and `.waypoint .select-box` do not, nor
`.node.selected .select-box` and `.node .select-box`.
*/
function subjectAndContext(selector) {
	const steps = selector.replace(/\s*([+~])\s*/g, '$1').replace(/\s*>\s*/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
	return { subject: steps.pop(), context: steps.join(' ') };
}
const BARE_CLASS = /^\.[a-z][\w-]*$/;
const sameElements = (a, b) => a.subject === b.subject
	&& (a.context === b.context || (!a.context && BARE_CLASS.test(b.context)) || (!b.context && BARE_CLASS.test(a.context)));

/*
The CSS a module holds as text: each template literal holding a rule, named by the constant it is assigned to, its expressions
stood in for by a placeholder -- these measures read selectors and properties, never the values an expression fills. One rule is
enough, so splitting a stylesheet into one-rule templates hides none of it. Read from the source rather than imported, so the
scanner judges no module by running it.
*/
const CSS_RULE = /(?:^|\n)\s*[a-z#.:*][\w\-.#[\]="' :>+~,()]*\{[^{}]*?(?:--[\w-]+|[a-z-]+)\s*:[^{}]*\}/g;
export function stylesheetsInSource(source) {
	const out = [];
	const code = blankComments(source);
	for (const m of code.matchAll(/(?:const\s+(\w+)\s*=\s*)?`((?:[^`\\]|\\.)*)`/g)) {
		const css = m[2].replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, 'X');
		if ((css.match(CSS_RULE) ?? []).length < 1) continue;
		out.push({ name: m[1] ?? `template at line ${code.slice(0, m.index).split('\n').length}`, css });
	}
	return out;
}

/** The same property of the same elements set in two stylesheets: `sheets` is `[{ name, css }]`; one finding per pair of sheets. */
export function copiedStyleRules(sheets) {
	const byProperty = new Map();
	for (const s of sheets) for (const r of styleRulesOf(s.css)) for (const p of r.props) {
		const sc = subjectAndContext(r.selector), k = `${sc.subject} ${p}`;
		if (!byProperty.has(k)) byProperty.set(k, []);
		byProperty.get(k).push({ sheet: s.name, prop: p, ...sc });
	}
	const out = new Map();
	for (const rules of byProperty.values()) for (let i = 0; i < rules.length; i++) for (let j = i + 1; j < rules.length; j++) {
		const a = rules[i], b = rules[j];
		if (a.sheet === b.sheet || !sameElements(a, b)) continue;
		const shown = [a.context || b.context, a.subject].filter(Boolean).join(' ');
		const names = [a.sheet, b.sheet].sort();
		out.set(`${shown} { ${a.prop} } in ${names.join(' and ')}`, { rule: `${shown} { ${a.prop} }`, in: names });
	}
	return [...out.values()];
}

const classesIn = (selector) => [...selector.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);

/*
A stylesheet setting the look of a class that only plugins put on elements, none of them the stylesheet's owner. `drawnBy` maps a
class to the parts that draw it, `isPlugin` says which parts are plugins, and each sheet names its `owner` part. A class a host
part also draws -- the renderer's `selected`, the canvas's `hover` -- is the host's to style, wherever it lands.
*/
export function foreignStyleRules(sheets, drawnBy, isPlugin) {
	const out = [];
	for (const s of sheets) for (const r of styleRulesOf(s.css)) {
		const foreign = classesIn(r.selector).filter((c) => drawnBy.has(c) && !drawnBy.get(c).has(s.owner) && [...drawnBy.get(c)].every(isPlugin));
		if (foreign.length) out.push({ sheet: s.name, selector: r.selector, classes: foreign.map((c) => `${c} (${[...drawnBy.get(c)].sort().join(', ')})`) });
	}
	return out;
}

/*
Each class a stylesheet styles that no part is seen putting on an element, and each id it styles that no page writes and no module
quotes: a dead rule, or a blind spot of this reading -- either way a number in the gate rather than a silence.
*/
export function stylesDrawnByNoPart(sheets, drawnBy, idsWritten = null) {
	const out = new Map();
	const note = (name, sheet) => { if (!out.has(name)) out.set(name, new Set()); out.get(name).add(sheet); };
	for (const s of sheets) for (const r of styleRulesOf(s.css)) {
		for (const c of classesIn(r.selector)) if (!drawnBy.has(c)) note(`.${c}`, s.name);
		if (idsWritten) for (const m of r.selector.matchAll(/#([a-zA-Z][\w-]*)/g)) if (!idsWritten.has(m[1])) note(`#${m[1]}`, s.name);
	}
	return [...out].map(([name, names]) => ({ name, in: [...names].sort() }));
}

/*
THE LINES A FILE HOLDS, as a browser reads them: split at every line end it honours (CRLF, a lone CR, LF), each comment removed
by the file's own language -- a stylesheet's slash-star comments outside its strings, a page's HTML comments outside its tags -- so a comment put
into a copy hides none of it, and nothing that only looks like a comment in the other language hides a line; then trimmed, the
blank ones dropped. `typed` leaves out the regions the file holds exactly as their generators write them (tools/regions.mjs,
tools/page-regions.mjs); `full` keeps them.
CORRECTED at H25.4 (B376), by four verifications: a marked region was left out however it was marked, then whatever a generated
region held, then from both sides of a comparison -- so a copy typed in one page of lines the other generates matched nothing;
and comments were removed in either language from every file, and lines split at LF alone, so an HTML comment's opener inside a
stylesheet's comment or string, one in a page's attribute, or a lone CR between lines hid live copies (those two since H25.0).
*/
const withoutCssComments = (t) => t.replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\/\*[\s\S]*?(?:\*\/|$)/g, (m, str) => str ?? '');
const withoutHtmlComments = (t) => t.replace(/(<(?!!--)[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>)|<!--[\s\S]*?(?:-->|$)/g, (m, tag) => tag ?? '');
function linesOf(file) {
	const strip = file.name.endsWith('.css') ? withoutCssComments : withoutHtmlComments;
	const split = (t) => strip(t).split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
	return { name: file.name, typed: split(withoutRegions(file.text, file.regions ?? [])), full: split(file.text) };
}

/*
Lines one file repeats from another, `run` lines in a row or more, and at least `chars` characters in the run so that a few closing
tags never count. `files` is `[{ name, text, regions }]`, `regions` a page's generated regions (tools/page-regions.mjs). Each file's
typed lines are looked for in the other's every line, generated or not: a region is left out only where both sides of a match
are generated, each held to its one master by its generator. The answer gives, for each pair, the copied lines of either.
*/
export function copiedLines(files, { run = 5, chars = 80 } = {}) {
	const all = files.map(linesOf);
	const windowsOf = (lines) => { const w = new Set(); for (let i = 0; i + run <= lines.length; i++) w.add(lines.slice(i, i + run).join('\n')); return w; };
	const typedIn = (from, to) => {
		const windows = windowsOf(to.full), copied = new Set();
		for (let i = 0; i + run <= from.typed.length; i++) {
			const w = from.typed.slice(i, i + run).join('\n');
			if (w.length >= chars && windows.has(w)) for (let k = i; k < i + run; k++) copied.add(k);
		}
		return [...copied].sort((x, y) => x - y).map((k) => from.typed[k]);
	};
	const out = [];
	for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
		const lines = [...new Set([...typedIn(all[a], all[b]), ...typedIn(all[b], all[a])])];
		if (lines.length) out.push({ files: [all[a].name, all[b].name], lines });
	}
	return out;
}

// the relative modules a source imports, statically or by a literal `import()`
function importsOf(source) {
	const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
	return [...code.matchAll(/(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm)]
		.map((m) => m[1] || m[2] || m[3]).filter((s) => s.startsWith('.') || s.startsWith('/'));
}

/*
The modules in `modules` that no entry in `entries` reaches. `read(path)` answers a module's source, or null when it is no file;
`resolve(from, spec)` answers the path an import names. A module only the tests import is a second implementation or a test's
helper living among the product's code.
*/
export function modulesNoEntryReaches(entries, modules, read, resolve) {
	const reached = new Set(), stack = [...entries];
	while (stack.length) {
		const f = stack.pop();
		if (reached.has(f)) continue;
		const src = read(f);
		if (src == null) continue;
		reached.add(f);
		for (const spec of importsOf(src)) { const to = resolve(f, spec); if (to) stack.push(to); }
	}
	return modules.filter((m) => !reached.has(m));
}

/*
A RECORD THAT MAY ONLY SHRINK, INSIDE A CEILING THAT NEVER MOVES (H25.0's adversarial review, finding 4). Each measure's findings
are named, not counted, so removing one copy and adding another is two changes, not none:
  measured, not recorded     a new copy -- refused
  recorded, not measured     a copy removed -- refused until the record is lowered in the same commit (`--write` does only that)
  recorded, not in ceiling   the record holds a copy the frozen ceiling (the findings when H25 opened) never had -- refused
`measured`, `record` and `ceiling` each map a measure to its findings.
*/
export function judgeFindings(measured, record, ceiling) {
	const out = [];
	for (const k of new Set([...Object.keys(measured), ...Object.keys(record)])) {
		if (!(k in measured)) { out.push(`${k}: recorded and no longer measured -- remove it from the record`); continue; }
		if (!(k in record)) { out.push(`${k}: measured and not recorded -- add the measure to the record`); continue; }
		const m = new Set(measured[k]), r = new Set(record[k]), c = new Set(ceiling[k] ?? []);
		for (const f of m) if (!r.has(f)) out.push(`${k}: NEW COPY -- ${f}`);
		for (const f of r) if (!m.has(f)) out.push(`${k}: removed -- ${f}; lower the record in this commit (node tools/scan-copies.mjs --write)`);
		for (const f of r) if (!c.has(f)) out.push(`${k}: the record holds a copy the frozen ceiling never had -- ${f}`);
	}
	return out;
}

/*
The copies the director ruled may stand: `exceptions` maps a measure to `{ finding: { cites, trigger } }`. Answers the entries for
tools/exceptions.mjs to resolve (each ruling cited must exist, each must say when it ends), and the faults this alone can see: an
exception for a copy that is gone, which would excuse a copy that comes back.
*/
export function judgeExceptions(findings, exceptions) {
	const entries = Object.entries(exceptions).flatMap(([k, byFinding]) => Object.entries(byFinding).map(([f, e]) => ({ where: `COPIES.exceptions['${k}'] ${f}`, measure: k, finding: f, ...e })));
	return { entries, faults: entries.filter((e) => !(findings[e.measure] ?? []).includes(e.finding)).map((e) => `${e.where}: an exception for a copy that is gone -- remove it`) };
}
