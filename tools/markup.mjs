#!/usr/bin/env node
/*
markup -- H25.4 (B376). Where a page's comments are, and a stylesheet without its comments, read as a browser's tokenizer reads
them: the copied-lines measure (tools/copies.mjs) removes comments before it compares lines, and the region rule (tools/regions.mjs)
trusts a marker only when it is a whole comment. In the repository itself, tools/scan-copies.mjs also runs `markupFaults`, which
refuses any page or stylesheet holding malformed comments, unquoted attributes, inline raw-text elements or CSS escapes/urls that
only an adversarial test writes.

A PAGE (the HTML tokenizer's rules for what this needs):
  - a comment opens at `<!--` and ends at the first `-->` or `--!>`, or at once as `<!-->` or `<!--->`; unclosed, at the end;
  - `<!` that opens no comment, DOCTYPE or (in SVG or MathML) CDATA section, `<?`, and `</` before anything but an ASCII letter
    (including `</>`) are bogus or empty-close comments, to the next `>`; a CDATA section in SVG or MathML runs to `]]>` and holds
    no comment;
  - inside a tag, HTML whitespace is tab, LF, FF, CR or space; attribute states are before-name, name, after-name, before-value,
    quoted and unquoted -- a quote opens a quoted value only in before-value (after `=` following a name), and `/` marks a tag
    self-closing only outside an unquoted or before-value attribute (`<svg x=a/>` is not self-closing);
  - `<svg>` and `<math>` enter foreign content until closed or broken out of by an HTML breakout tag (`div`, `p`, `span`, etc.),
    and their HTML integration points (`foreignObject`, `desc`, `title` in SVG; `mi`, `mo`, `mn`, `ms`, `mtext`, `annotation-xml`
    in MathML) parse children in the HTML mode;
  - outside foreign content, `style`, `textarea`, `title`, `xmp`, `iframe`, `noembed`, `noframes` and `noscript` run to their
    matching `</name` followed by HTML whitespace, `/` or `>`; `script` tracks its escaped (`<!--`, closed by `-->`, `--!>`, or an
    immediate `<!--+>`) and double-escaped (`<script`) states; `plaintext` runs to the end; a `style` element's text (outside foreign content) has its stylesheet comments removed;
  - a `<` that opens no tag is text.
A STYLESHEET (the CSS tokenizer's): CRLF, CR and form feed are line feeds; outside strings and unquoted `url()`, a comment runs
from slash-star to star-slash, a backslash before a non-newline escapes a character or 1-6 hex digits (plus one optional whitespace),
and an identifier whose decoded name is `url` followed by `(` and optional whitespace and a non-quote runs to the unescaped `)`
(consuming `bad-url` remnants to `)` as well).

  htmlSpans(text)           -> { comments: [[at, end]], styles: [[at, end]] }   in order, not overlapping
  htmlWithoutComments(t)    -> text        each comment removed, each style element's text without its stylesheet comments
  cssWithoutComments(t)     -> text        line ends normalised, each comment removed
  markupFaults(file)        -> [message]   constructs the product's own pages and stylesheets never hold, refused by scan-copies
*/
const RAW = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext']);
const FOREIGN = new Set(['svg', 'math']);
const SVG_INTEGRATION = new Set(['foreignobject', 'desc', 'title']);
const MATH_INTEGRATION = new Set(['mi', 'mo', 'mn', 'ms', 'mtext', 'annotation-xml']);
const HTML_BREAKOUT = new Set([
	'b', 'big', 'blockquote', 'body', 'br', 'center', 'code', 'dd', 'div', 'dl', 'dt', 'em', 'embed', 'font',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'hr', 'i', 'img', 'li', 'listing', 'menu', 'meta', 'nobr',
	'ol', 'p', 'pre', 'ruby', 's', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'table', 'tt', 'u', 'ul', 'var',
]);
const isSpace = (c) => c === '\t' || c === '\n' || c === '\f' || c === '\r' || c === ' ';
const isEndAfterName = (c) => isSpace(c) || c === '/' || c === '>' || c === '';

function tagEnd(t, start) {
	let j = start, state = 'before-name', selfClose = false;
	while (j < t.length && t[j] !== '>') {
		const ch = t[j];
		if (state === 'before-name') {
			if (isSpace(ch)) { j++; continue; }
			if (ch === '/') { state = 'self-close'; j++; continue; }
			state = 'name'; j++; continue;
		}
		if (state === 'self-close') {
			if (ch === '>') break;
			state = 'before-name'; continue;
		}
		if (state === 'name') {
			if (isSpace(ch)) { state = 'after-name'; j++; continue; }
			if (ch === '/') { state = 'self-close'; j++; continue; }
			if (ch === '=') { state = 'before-value'; j++; continue; }
			j++; continue;
		}
		if (state === 'after-name') {
			if (isSpace(ch)) { j++; continue; }
			if (ch === '/') { state = 'self-close'; j++; continue; }
			if (ch === '=') { state = 'before-value'; j++; continue; }
			state = 'name'; j++; continue;
		}
		if (state === 'before-value') {
			if (isSpace(ch)) { j++; continue; }
			if (ch === '"' || ch === "'") { const e = t.indexOf(ch, j + 1); j = e < 0 ? t.length : e + 1; state = 'before-name'; continue; }
			state = 'unquoted'; j++; continue;
		}
		if (isSpace(ch)) state = 'before-name';
		j++;
	}
	if (state === 'self-close' && t[j] === '>') selfClose = true;
	return { end: Math.min(j + 1, t.length), selfClose };
}

function scriptEnd(t, from) {
	let i = from, escaped = false, double = false;
	while (i < t.length) {
		if (!escaped && t.startsWith('<!--', i)) {
			const m = /^<!--+>/.exec(t.slice(i));
			if (m) { i += m[0].length; continue; }
			escaped = true; i += 4; continue;
		}
		if (escaped && t.startsWith('-->', i)) { escaped = false; double = false; i += 3; continue; }
		if (t[i] === '<') {
			const close = t[i + 1] === '/';
			const sub = t.slice(i + (close ? 2 : 1), i + (close ? 8 : 7)).toLowerCase();
			const after = t[i + (close ? 8 : 7)] ?? '';
			if (sub === 'script' && isEndAfterName(after)) {
				if (close && !double) return { bodyEnd: i, afterTag: tagEnd(t, i + 8).end };
				if (escaped) double = !close;
			}
		}
		i++;
	}
	return { bodyEnd: t.length, afterTag: t.length };
}

function rawEnd(t, from, lower) {
	if (lower === 'plaintext') return { bodyEnd: t.length, afterTag: t.length };
	if (lower === 'script') return scriptEnd(t, from);
	const n = lower.length;
	for (let i = from; (i = t.indexOf('</', i)) >= 0; i += 2) {
		if (t.slice(i + 2, i + 2 + n).toLowerCase() === lower && isEndAfterName(t[i + 2 + n] ?? '')) {
			return { bodyEnd: i, afterTag: tagEnd(t, i + 2 + n).end };
		}
	}
	return { bodyEnd: t.length, afterTag: t.length };
}

export function htmlSpans(t) {
	const comments = [], styles = [], stack = [];
	const inForeign = () => stack.length > 0 && !stack[stack.length - 1].integration;
	let i = 0;
	while (i < t.length) {
		const lt = t.indexOf('<', i);
		if (lt < 0) break;
		if (t.startsWith('<!--', lt)) {
			let end = -1;
			if (t.startsWith('<!-->', lt)) end = lt + 5;
			else if (t.startsWith('<!--->', lt)) end = lt + 6;
			else for (let k = lt + 4; k < t.length && end < 0; k++) {
				if (t.startsWith('-->', k)) end = k + 3;
				else if (t.startsWith('--!>', k)) end = k + 4;
			}
			if (end < 0) end = t.length;
			comments.push([lt, end]); i = end; continue;
		}
		if (inForeign() && t.startsWith('<![CDATA[', lt)) { const e = t.indexOf(']]>', lt + 9); i = e < 0 ? t.length : e + 3; continue; }
		const next = t[lt + 1] ?? '';
		if (next === '!' || next === '?' || (next === '/' && !/[A-Za-z]/.test(t[lt + 2] ?? ''))) {
			if (/^<!doctype[\t\n\f\r >]/i.test(t.slice(lt, lt + 10))) { i = tagEnd(t, lt + 9).end; continue; }
			const e = t.indexOf('>', lt + 1), end = e < 0 ? t.length : e + 1;
			comments.push([lt, end]); i = end; continue;
		}
		const close = next === '/';
		const name = /^[A-Za-z][^\t\n\f\r />]*/.exec(t.slice(lt + (close ? 2 : 1)))?.[0];
		if (!name) { i = lt + 1; continue; }
		const { end, selfClose } = tagEnd(t, lt + (close ? 2 : 1) + name.length);
		const lower = name.toLowerCase();
		if (close) {
			for (let s = stack.length - 1; s >= 0; s--) {
				if (stack[s].tag === lower) { stack.length = s; break; }
			}
			i = end; continue;
		}
		if (inForeign() && HTML_BREAKOUT.has(lower)) {
			while (stack.length > 0 && !stack[stack.length - 1].integration) stack.pop();
		}
		if (!inForeign() && RAW.has(lower) && !(stack.length > 0 && lower === 'title')) {
			const { bodyEnd, afterTag } = rawEnd(t, end, lower);
			if (lower === 'style') styles.push([end, bodyEnd]);
			i = afterTag; continue;
		}
		if (FOREIGN.has(lower)) {
			if (!selfClose) stack.push({ tag: lower, ns: lower, integration: false });
			i = end; continue;
		}
		if (stack.length > 0 && !selfClose) {
			const top = stack[stack.length - 1];
			const isInt = (top.ns === 'svg' && SVG_INTEGRATION.has(lower)) || (top.ns === 'math' && MATH_INTEGRATION.has(lower));
			stack.push({ tag: lower, ns: top.ns, integration: top.integration || isInt });
		}
		i = end;
	}
	return { comments, styles };
}

export function htmlWithoutComments(t) {
	const { comments, styles } = htmlSpans(t);
	const cuts = [...comments.map(([a, b]) => ({ a, b, put: '' })), ...styles.map(([a, b]) => ({ a, b, put: cssWithoutComments(t.slice(a, b)) }))].sort((x, y) => x.a - y.a);
	let out = '', from = 0;
	for (const c of cuts) { out += t.slice(from, c.a) + c.put; from = c.b; }
	return out + t.slice(from);
}

const isCssIdent = (c) => /[A-Za-z0-9_-]/.test(c) || c.charCodeAt(0) >= 0x80;

function readCssEscape(t, i) {
	const hex = /^[0-9a-fA-F]{1,6}/.exec(t.slice(i + 1, i + 7))?.[0];
	if (hex) {
		let next = i + 1 + hex.length;
		if (t[next] === ' ' || t[next] === '\t' || t[next] === '\n') next++;
		const cp = parseInt(hex, 16);
		return { ch: String.fromCodePoint(cp > 0 && cp <= 0x10ffff ? cp : 0xfffd), next };
	}
	return { ch: t[i + 1], next: i + 2 };
}

export function cssWithoutComments(text) {
	const t = text.replace(/\r\n|\r|\f/g, '\n');
	let out = '', i = 0;
	while (i < t.length) {
		const ch = t[i];
		if (ch === '/' && t[i + 1] === '*') { const e = t.indexOf('*/', i + 2); i = e < 0 ? t.length : e + 2; continue; }
		if (ch === '"' || ch === "'") {
			let j = i + 1;
			while (j < t.length && t[j] !== ch && t[j] !== '\n') j += t[j] === '\\' ? 2 : 1;
			const end = Math.min(t[j] === ch ? j + 1 : j, t.length);
			out += t.slice(i, end); i = end; continue;
		}
		if (isCssIdent(ch) || (ch === '\\' && t[i + 1] !== undefined && t[i + 1] !== '\n')) {
			let j = i, ident = '';
			while (j < t.length) {
				if (isCssIdent(t[j])) { ident += t[j]; j++; continue; }
				if (t[j] === '\\' && t[j + 1] !== undefined && t[j + 1] !== '\n') {
					const esc = readCssEscape(t, j);
					ident += esc.ch; j = esc.next; continue;
				}
				break;
			}
			out += t.slice(i, j); i = j;
			if (ident.toLowerCase() === 'url' && t[i] === '(') {
				let k = i + 1;
				while (k < t.length && (t[k] === ' ' || t[k] === '\t' || t[k] === '\n')) k++;
				if (k < t.length && t[k] !== '"' && t[k] !== "'" && t[k] !== ')') {
					let u = k;
					while (u < t.length && t[u] !== ')') u += t[u] === '\\' && t[u + 1] !== '\n' ? 2 : 1;
					const end = Math.min(t[u] === ')' ? u + 1 : u, t.length);
					out += t.slice(i, end); i = end;
				}
			}
			continue;
		}
		out += ch; i++;
	}
	return out;
}

export function markupFaults({ name, text }) {
	const faults = [];
	if (name.endsWith('.css')) {
		const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
		if (/\/\*|\*\//.test(stripped)) faults.push(`${name} holds an unclosed or stray stylesheet comment delimiter`);
		if (/\\|url\(/i.test(stripped)) faults.push(`${name} holds a CSS backslash escape or url() that the stylesheet grammar refuses`);
		return faults;
	}
	const withoutComments = text.replace(/<!--([\s\S]*?)-->/g, (m, body) => {
		if (body.startsWith('>') || body.startsWith('->') || body.endsWith('!')) faults.push(`${name} holds a degenerate HTML comment (${m.slice(0, 30)})`);
		return '';
	});
	if (/<!--|-->|--!>/.test(withoutComments)) faults.push(`${name} holds an unclosed or degenerate HTML comment delimiter`);
	for (const m of withoutComments.replace(/^\s*<!DOCTYPE html>\s*/i, '').matchAll(/<[^>]*>|[^<]+/g)) {
		const tok = m[0];
		if (!tok.startsWith('<')) continue;
		if (!/^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w:.-]*(?:="[^"<]*")?)*\s*\/?>$/.test(tok)) {
			faults.push(`${name} holds a tag or '<' outside the clean page grammar -- ${tok.slice(0, 60)}`);
		} else if (/^<(?:style|textarea|xmp|iframe|noembed|noframes|noscript|plaintext|foreignobject|desc|math)\b/i.test(tok)) {
			faults.push(`${name} holds an inline raw-text or foreign element (${tok.slice(0, 30)})`);
		}
	}
	return faults;
}
