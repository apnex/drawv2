#!/usr/bin/env node
/*
markup -- H25.4 (B376). Where a page's comments are, and a stylesheet without its comments, read as a browser's tokenizer reads
them: the copied-lines measure (tools/copies.mjs) removes comments before it compares lines, and the region rule (tools/regions.mjs)
trusts a marker only when it is a whole comment. Six verifications of H25.4 hid copies from cruder readings -- regular expressions
and shortcuts that disagreed with the HTML and CSS tokenizers on strings, attributes, self-closing tags, raw text and comments.

A PAGE (the HTML tokenizer's rules for what this needs):
  - a comment opens at `<!--` and ends at the first `-->` or `--!>`, or at once as `<!-->` or `<!--->`; unclosed, at the end;
  - `<!` that opens no comment, DOCTYPE or (in SVG or MathML) CDATA section, `<?`, and `</` before anything but an ASCII letter
    (including `</>`) are bogus or empty-close comments, to the next `>`; a CDATA section in SVG or MathML runs to `]]>` and holds
    no comment;
  - inside a tag, HTML whitespace is tab, LF, FF, CR or space; attribute states are before-name, name, after-name, before-value,
    quoted and unquoted -- a quote opens a quoted value only in before-value (after `=` following a name), and `/` marks a tag
    self-closing only outside an unquoted or before-value attribute (`<svg x=a/>` is not self-closing);
  - outside SVG and MathML, `style`, `textarea`, `title`, `xmp`, `iframe`, `noembed`, `noframes` and `noscript` run to their
    matching `</name` followed by HTML whitespace, `/` or `>`; `script` tracks its escaped (`<!--`) and double-escaped (`<script`)
    states; `plaintext` runs to the end; a `style`'s text has its stylesheet comments removed;
  - a `<` that opens no tag is text.
A STYLESHEET (the CSS tokenizer's): CRLF, CR and form feed are line feeds; outside strings and unquoted `url()`, a comment runs
from slash-star to star-slash, a backslash before a non-newline escapes that character (so `\"` opens no string, `\/*` no comment,
and `a\:url(` is one identifier, not `url(`), and `url(` at the start of an identifier followed by any whitespace and a non-quote
runs to the unescaped `)`.

  htmlSpans(text)        -> { comments: [[at, end]], styles: [[at, end]] }   in order, not overlapping
  htmlWithoutComments(t) -> text    each comment removed, each style element's text without its stylesheet comments
  cssWithoutComments(t)  -> text    line ends normalised, each comment removed
*/
const RAW = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext']);
const FOREIGN = new Set(['svg', 'math']);
const isSpace = (c) => c === '\t' || c === '\n' || c === '\f' || c === '\r' || c === ' ';
const isEndAfterName = (c) => isSpace(c) || c === '/' || c === '>' || c === '';

function scriptEnd(t, from) {
	let i = from, escaped = false, double = false;
	while (i < t.length) {
		if (!escaped && t.startsWith('<!--', i)) { escaped = true; i += 4; continue; }
		if (escaped && t.startsWith('-->', i)) { escaped = false; double = false; i += 3; continue; }
		if (t[i] === '<') {
			const close = t[i + 1] === '/';
			const sub = t.slice(i + (close ? 2 : 1), i + (close ? 8 : 7)).toLowerCase();
			const after = t[i + (close ? 8 : 7)] ?? '';
			if (sub === 'script' && isEndAfterName(after)) {
				if (close && !double) return i;
				if (escaped) double = !close;
			}
		}
		i++;
	}
	return t.length;
}

function rawEnd(t, from, lower) {
	if (lower === 'plaintext') return t.length;
	if (lower === 'script') return scriptEnd(t, from);
	const n = lower.length;
	for (let i = from; (i = t.indexOf('</', i)) >= 0; i += 2) {
		if (t.slice(i + 2, i + 2 + n).toLowerCase() === lower && isEndAfterName(t[i + 2 + n] ?? '')) return i;
	}
	return t.length;
}

export function htmlSpans(t) {
	const comments = [], styles = [];
	let i = 0, foreign = 0;
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
		if (foreign && t.startsWith('<![CDATA[', lt)) { const e = t.indexOf(']]>', lt + 9); i = e < 0 ? t.length : e + 3; continue; }
		const next = t[lt + 1] ?? '';
		if (next === '!' || next === '?' || (next === '/' && !/[A-Za-z]/.test(t[lt + 2] ?? ''))) {
			const e = t.indexOf('>', lt + 1), end = e < 0 ? t.length : e + 1;
			if (!/^<!doctype[\t\n\f\r >]/i.test(t.slice(lt, lt + 10))) comments.push([lt, end]);
			i = end; continue;
		}
		const close = next === '/';
		const name = /^[A-Za-z][^\t\n\f\r />]*/.exec(t.slice(lt + (close ? 2 : 1)))?.[0];
		if (!name) { i = lt + 1; continue; }   // a < that opens no tag is text
		let j = lt + (close ? 2 : 1) + name.length, state = 'before-name', selfClose = false;
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
			// unquoted attribute value: only HTML whitespace (or > at the loop condition) ends it
			if (isSpace(ch)) state = 'before-name';
			j++;
		}
		if (state === 'self-close' && t[j] === '>') selfClose = true;
		const end = Math.min(j + 1, t.length), lower = name.toLowerCase();
		if (close) { if (FOREIGN.has(lower) && foreign) foreign--; i = end; continue; }
		if (FOREIGN.has(lower)) { if (!selfClose) foreign++; i = end; continue; }
		if (!foreign && RAW.has(lower)) {
			const stop = rawEnd(t, end, lower);
			if (lower === 'style') styles.push([end, stop]);
			i = stop; continue;
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

export function cssWithoutComments(text) {
	const t = text.replace(/\r\n|\r|\f/g, '\n');
	let out = '', i = 0, inIdent = false;
	while (i < t.length) {
		const ch = t[i];
		if (ch === '/' && t[i + 1] === '*') { const e = t.indexOf('*/', i + 2); i = e < 0 ? t.length : e + 2; inIdent = false; continue; }
		if (ch === '\\' && t[i + 1] !== undefined && t[i + 1] !== '\n') { out += t.slice(i, i + 2); i += 2; inIdent = true; continue; }
		if (ch === '"' || ch === "'") {
			let j = i + 1;
			while (j < t.length && t[j] !== ch && t[j] !== '\n') j += t[j] === '\\' ? 2 : 1;
			const end = Math.min(t[j] === ch ? j + 1 : j, t.length);
			out += t.slice(i, end); i = end; inIdent = false; continue;
		}
		if (!inIdent && /^url\(/i.test(t.slice(i, i + 4))) {
			let k = i + 4;
			while (k < t.length && (t[k] === ' ' || t[k] === '\t' || t[k] === '\n')) k++;
			if (t[k] !== '"' && t[k] !== "'") {
				let j = k;
				while (j < t.length && t[j] !== ')') {
					if (t[j] === '"' || t[j] === "'" || t[j] === '(') break;
					j += t[j] === '\\' ? 2 : 1;
				}
				const end = Math.min(t[j] === ')' ? j + 1 : j, t.length);
				out += t.slice(i, end); i = end; inIdent = false; continue;
			}
		}
		inIdent = isCssIdent(ch);
		out += ch; i++;
	}
	return out;
}
