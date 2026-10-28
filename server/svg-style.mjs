/*
H25.2 (B366; D3 as amended, dev/DECISIONS.md H25-2): THE PAGE'S RULES, WRITTEN ONTO WHAT THE EXPORT DRAWS.

The export carried two copies of the page's styling (KERNEL_CSS, EXPORT_CSS) and wrote colours of its own; they drifted (B361).
Its first H25.2 build shipped the page's drawing sheets as a <style> instead, and an independent verifier found three faults in it:
pasted inline into another page the rules restyled that page, the file took the page's cursors and selection rules, and renderers
that skip CSS custom properties lost the lines, zones and ground. So the rules are APPLIED here, at export time, and their result
written as each element's presentation attributes: the file carries no stylesheet, asks no CSS of a renderer, can restyle nothing
around it, and states no look the page's sheets do not state.

  drawingRules()                    every rule of every sheet the page loads but its chrome, colour tokens written in, parsed
  styleMarkup(markup, rules, inh.)  each element of markup written as text given its drawn properties as attributes -- the
                                    export's drawing as the file holds it, the shared defs and glyph art, the favicon
  nodeContext(rules)                the custom properties a device's group gives what it draws (the glyph art and frames drawn
                                    through `<use>` take them from there, as on the page)

A browser's cascade, reduced to what these sheets hold: compounds of a tag, an id, classes and attribute tests, joined by a
descendant step or an adjacent-sibling step; ordered by specificity, then source order; an element's own inline style kept, since
it beats any rule, and its custom properties beat theirs; custom properties inherited down the tree and `var()` resolved through
them. A pseudo-class of the pointer or focus never matches a still picture. What this cannot carry faithfully is refused rather than
shipped wrong: any other pseudo-class, a `>` or `~` step, `!important`, an at-rule, a `:root` property that is not a colour token, a
transform with CSS units, a drawing property it does not know, a `var()` with no value, and markup its reader cannot read.
AMENDED H26.8's trace move (B422; dev/design/components/NATIVE-SHAPES.md section 5): one at-rule is read, `@keyframes <name> { ... }`, and
left out, with the animation properties beside `transition` -- what runs over time, which a still picture leaves out. Its braces are
counted outside strings, a string's escapes honoured, and a block or string left open is refused, naming the sheet; a vendor variant, a
block with no name and every other at-rule stay refused.
*/
import fs from 'node:fs';
import { PAGE_STYLESHEETS, CHROME_STYLESHEETS } from '../product/canvas.mjs';

// what a rule may set that draws -- written as an attribute -- and what only acts on a pointer or over time, which a picture leaves out
const DRAWN = new Set(['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
	'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'display', 'visibility', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
	'dominant-baseline', 'letter-spacing', 'transform', 'rx', 'ry']);
const INTERACTIVE = new Set(['cursor', 'pointer-events', 'user-select', '-webkit-user-select', 'transition', 'touch-action',
	'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-fill-mode', 'animation-delay',
	'animation-iteration-count', 'animation-direction', 'animation-play-state']);   // H26.8: the reveal's trace, declared
// the pseudo-classes a still picture is never in; any other (`:first-child`, `:not()`) could match one, and is refused
const POINTER = new Set(['hover', 'active', 'focus', 'focus-visible', 'focus-within', 'visited']);

// one compound: `rect#canvas.a.b[data-x="y"]:hover`
function compoundOf(text, selector) {
	const m = /^([a-z][a-z0-9]*)?((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]|:[\w-]+)*)$/i.exec(text);
	if (!m) throw new Error(`the export cannot match the selector "${selector}" (its part "${text}")`);
	const c = { tag: m[1]?.toLowerCase() ?? null, ids: [], classes: [], attrs: [], pseudos: [] };
	for (const p of m[2].matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:([\w-]+)/g)) {
		if (p[1]) c.ids.push(p[1]); else if (p[2]) c.classes.push(p[2]); else if (p[3]) c.attrs.push([p[3], p[4]]); else c.pseudos.push(p[5]);
	}
	const still = c.pseudos.find((p) => !POINTER.has(p));
	if (still) throw new Error(`the export cannot match the pseudo-class ":${still}" in "${selector}" -- a still picture could be in it`);
	return c;
}
// a selector, rightmost compound first, each with the step that leads to the next: ' ' an ancestor, '+' the sibling before
function selectorOf(text) {
	const parts = text.trim().replace(/\s*([+>~])\s*/g, ' $1 ').split(/\s+/);
	const steps = [];
	for (let i = parts.length - 1; i >= 0; i--) {
		// a step joins the compound already read (to its right) to the next one read (to its left)
		if (parts[i] === '+') { steps[steps.length - 1].next = '+'; continue; }
		if (parts[i] === '>' || parts[i] === '~') throw new Error(`the export does not match the step "${parts[i]}" in "${text}"`);
		steps.push({ compound: compoundOf(parts[i], text), next: ' ' });
	}
	const spec = [0, 0, 0];
	for (const { compound: c } of steps) { spec[0] += c.ids.length; spec[1] += c.classes.length + c.attrs.length + c.pseudos.length; spec[2] += c.tag ? 1 : 0; }
	return { text, steps, spec };
}

/*
H26.8 -- a sheet without its `@keyframes <name> { ... }` blocks, each read to its closing brace: braces counted outside strings, a
string's escapes honoured, a backslash outside one escaping the character after it. A block or a string left open is refused, naming the
sheet. Only that spelling is taken: any other at-rule -- a vendor variant, `@keyframes` with no name, `@media` -- is left in, for the
refusal that follows.
*/
const KEYFRAMES = /@keyframes\s+(-?[A-Za-z_][\w-]*)\s*\{/y;
function withoutKeyframes(css, name) {
	let out = '', i = 0;
	for (let at; (at = css.indexOf('@', i)) >= 0;) {
		KEYFRAMES.lastIndex = at;
		const head = KEYFRAMES.exec(css);
		if (!head) { out += css.slice(i, at + 1); i = at + 1; continue; }
		const open = (what) => new Error(`${name}: ${what} in @keyframes ${head[1]} is not closed -- the export refuses what it cannot read`);
		let depth = 1, j = KEYFRAMES.lastIndex;
		while (j < css.length && depth) {
			const c = css[j];
			if (c === '"' || c === "'") {
				for (j++; j < css.length && css[j] !== c; j++) {
					if (css[j] === '\\') j++;
					else if (css[j] === '\n') throw open('a string');
				}
				if (j >= css.length) throw open('a string');
			} else if (c === '\\') j++;
			else if (c === '{') depth++;
			else if (c === '}') depth--;
			j++;
		}
		if (depth) throw open('a block');
		out += css.slice(i, at);
		i = j;
	}
	return out + css.slice(i);
}

/**
Rules from stylesheets handed in as `[{ name, css }]`: each `:root` colour token read and written into every rule that names it, each
selector list split, each selector parsed. An at-rule, or a token no sheet declares, is refused -- but `@keyframes <name>`, left out (H26.8).
*/
export function rulesOfSheets(sheets) {
	const tokens = new Map(), raw = [];
	for (const { name, css: text } of sheets) {
		const css = withoutKeyframes(text.replace(/\/\*[\s\S]*?\*\//g, ''), name);   // comments first, as ever; then the animations' blocks
		if (/@[a-z]/i.test(css)) throw new Error(`${name} holds an at-rule, which the export does not apply -- teach server/svg-style.mjs, or move it`);
		for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
			const selector = m[1].trim().replace(/\s+/g, ' ');
			const decls = [...m[2].matchAll(/(--[\w-]+|[a-z-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map((d) => [d[1], d[2].trim()]);
			for (const [k, v] of decls) {
				if (/!\s*important/i.test(v)) throw new Error(`${name}: "${selector}" sets ${k} !important, which the export does not weigh`);
				if (k === 'transform' && /\d[a-z%]/i.test(v)) throw new Error(`${name}: "${selector}" sets a transform with CSS units (${v}), which an SVG attribute cannot hold`);
			}
			if (selector === ':root') {
				for (const [k, v] of decls) {
					if (!k.startsWith('--tok-')) throw new Error(`${name}: :root sets ${k}, which is not a colour token -- teach server/svg-style.mjs to inherit it`);
					tokens.set(k, v);
				}
				continue;
			}
			raw.push({ selector, decls });
		}
	}
	// each `var(--tok-...)`, fallback and all, replaced by the token: a token the page loads is always defined, so its fallback never draws
	const token = (v) => {
		let out = '', i = 0;
		for (let at; (at = v.indexOf('var(--tok-', i)) >= 0;) {
			let depth = 1, j = at + 4;
			for (; j < v.length && depth; j++) { if (v[j] === '(') depth++; else if (v[j] === ')') depth--; }
			const name = v.slice(at + 4, j - 1).split(',')[0].trim();
			if (!tokens.has(name)) throw new Error(`a drawing rule names ${name}, which no colour registry the page loads declares`);
			out += v.slice(i, at) + tokens.get(name);
			i = j;
		}
		return out + v.slice(i);
	};
	let order = 0;
	return raw.flatMap(({ selector, decls }) => selector.split(',').map((s) => ({ ...selectorOf(s), order: order++, decls: decls.map(([k, v]) => [k, token(v)]) })));
}

let parsed = null;
/** Every rule of every sheet the page loads but its chrome -- the colour registries read for their tokens. Read once. */
export function drawingRules() {
	if (parsed) return parsed;
	parsed = rulesOfSheets(PAGE_STYLESHEETS.filter((x) => !CHROME_STYLESHEETS.includes(x)).map((name) => ({ name, css: fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8') })));
	return parsed;
}

// ---- matching, over any tree whose nodes have `tag`, `attrs`, a parent and siblings
// an element's parent and the element before it -- text, and the root a markup is parsed under, are no elements
const parentOf = (n) => (n.parentNode && n.parentNode.tag && n.parentNode.tag !== '#root' ? n.parentNode : null);
const previousOf = (n) => {
	const p = n.parentNode;
	if (!p) return null;
	for (let i = p.children.indexOf(n) - 1; i >= 0; i--) if (p.children[i].tag) return p.children[i];
	return null;
};
function matchesCompound(n, c) {
	if (c.pseudos.length) return false;   // a still picture is never hovered
	if (c.tag && n.tag.toLowerCase() !== c.tag) return false;
	if (c.ids.some((id) => n.attrs.id !== id)) return false;
	const cls = (n.attrs.class ?? '').split(/\s+/);
	if (c.classes.some((k) => !cls.includes(k))) return false;
	return c.attrs.every(([k, v]) => k in n.attrs && (v === undefined || n.attrs[k] === v));
}
function matches(n, sel, i = 0) {
	if (!matchesCompound(n, sel.steps[i].compound)) return false;
	if (i === sel.steps.length - 1) return true;
	if (sel.steps[i].next === '+') { const p = previousOf(n); return !!p && matches(p, sel, i + 1); }
	for (let a = parentOf(n); a; a = parentOf(a)) if (matches(a, sel, i + 1)) return true;
	return false;
}
const bySpecificity = (a, b) => a.spec[0] - b.spec[0] || a.spec[1] - b.spec[1] || a.spec[2] - b.spec[2] || a.order - b.order;

// `var(--x, fallback)`, nested, through the custom properties in scope
function resolve(value, custom, where) {
	let out = '', i = 0;
	while (i < value.length) {
		const at = value.indexOf('var(', i);
		if (at < 0) { out += value.slice(i); break; }
		out += value.slice(i, at);
		let depth = 1, j = at + 4;
		for (; j < value.length && depth; j++) { if (value[j] === '(') depth++; else if (value[j] === ')') depth--; }
		const inner = value.slice(at + 4, j - 1), comma = inner.indexOf(',');
		const name = (comma < 0 ? inner : inner.slice(0, comma)).trim(), fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
		if (custom[name] !== undefined) out += custom[name];
		else if (fallback !== null) out += resolve(fallback, custom, where);
		else throw new Error(`${where}: var(${name}) has no value and no fallback`);
		i = j;
	}
	return out;
}

// one element's style: the drawn properties to write, and the custom properties it hands its children
function styleOf(n, rules, inherited) {
	const decls = new Map();
	for (const r of rules.filter((x) => matches(n, x)).sort(bySpecificity)) for (const [k, v] of r.decls) decls.set(k, v);
	const custom = { ...inherited };
	for (const [k, v] of decls) if (k.startsWith('--')) custom[k] = resolve(v, custom, `${n.tag}#${n.attrs.id ?? ''}.${n.attrs.class ?? ''} ${k}`);
	const own = [...(n.attrs.style ?? '').matchAll(/([\w-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]);
	for (const [k, v] of own) if (k.startsWith('--')) custom[k] = resolve(v, custom, `${n.tag} style ${k}`);   // its own beat any rule's
	const inline = new Set(own.map(([k]) => k));
	const drawn = {};
	for (const [k, v] of decls) {
		if (k.startsWith('--') || INTERACTIVE.has(k)) continue;
		if (!DRAWN.has(k)) throw new Error(`a rule sets ${k} on <${n.tag} class="${n.attrs.class ?? ''}">, which the export can neither draw nor knowingly leave out`);
		if (!inline.has(k)) drawn[k] = resolve(v, custom, `<${n.tag} class="${n.attrs.class ?? ''}"> ${k}`);   // its inline style beats any rule
	}
	return { drawn, custom };
}

/** The custom properties a device's group gives what it draws -- the scope the glyph art and frames are drawn in through `<use>`. */
export const nodeContext = (rules) => styleOf({ tag: 'g', attrs: { class: 'node' }, parentNode: null, children: [] }, rules, {}).custom;

/** The drawn style of one element standing alone -- the export's ground, drawn as the canvas is. */
export const drawnOf = (tag, attrs, rules) => styleOf({ tag, attrs, parentNode: null, children: [] }, rules, {}).drawn;

// ---- markup written as text, parsed into the same shape, styled, and written back with its own attributes in their order
// escaped as server/svg.mjs escapes what it writes, and read back the same way, so a value goes through once escaped, never twice
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const unesc = (s) => s.replace(/&(quot|lt|gt|amp|#\d+|#x[0-9a-f]+);/gi, (all, e) => ({ quot: '"', lt: '<', gt: '>', amp: '&' }[e]
	?? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))));
function parseMarkup(markup) {
	const root = { tag: '#root', attrs: {}, children: [], parentNode: null };
	let at = root;
	for (const m of markup.matchAll(/<!--[\s\S]*?-->|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|(<)|[^<]+/g)) {
		// what the export and the defs are written as, and nothing else: a declaration, CDATA, an unquoted or single-quoted value is refused
		if (m[5]) throw new Error(`the export's markup reader cannot read "${markup.slice(m.index, m.index + 40)}"`);
		if (m[1]) { at = at.parentNode; continue; }
		if (m[2]) {
			const attrs = {};
			for (const a of m[3].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = unesc(a[2]);
			const n = { tag: m[2], attrs, children: [], parentNode: at, closed: !!m[4] };   // written back in the form it came in
			at.children.push(n);
			if (!m[4]) at = n;
			continue;
		}
		at.children.push({ text: m[0], parentNode: at });
	}
	return root;
}
function writeMarkup(n) {
	if (n.text !== undefined) return n.text;
	const inner = n.children.map(writeMarkup).join('');
	if (n.tag === '#root') return inner;
	const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
	return n.closed ? `<${n.tag}${attrs}/>` : `<${n.tag}${attrs}>${inner}</${n.tag}>`;
}
/** The same, over markup written as text: each element's drawn properties written onto it. */
export function styleMarkup(markup, rules, inherited = {}) {
	const root = parseMarkup(markup);
	const walk = (n, scope) => {
		if (n.text !== undefined) return;
		const { drawn, custom } = styleOf(n, rules, scope);
		for (const [k, v] of Object.entries(drawn)) n.attrs[k] = v;
		for (const c of n.children) walk(c, custom);
	};
	for (const c of root.children) walk(c, inherited);
	return writeMarkup(root);
}
