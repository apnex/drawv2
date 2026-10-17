#!/usr/bin/env node
/*
markup -- H25.4 (B376). Where a page's comments are, and a stylesheet without its comments, read as a browser's tokenizer reads
them: the copied-lines measure (tools/copies.mjs) removes comments before it compares lines, and the region rule (tools/regions.mjs)
trusts a marker only when it is a whole comment. Five verifications of H25.4 hid copies from cruder readings -- regular expressions
removing either language's comments from every file, deaf to strings, tags, raw text and the ways a comment can end.

A PAGE (the HTML tokenizer's rules for what this needs):
  - a comment opens at `<!--` and ends at the first `-->` or `--!>`, or at once as `<!-->` or `<!--->`; unclosed, at the end;
  - `<!` that opens no comment, DOCTYPE or (in SVG or MathML) CDATA section, `<?`, and `</` before anything but a letter, are
    bogus comments, to the next `>`; a CDATA section in SVG or MathML runs to `]]>` and holds no comment;
  - a tag runs to its `>`, a quote opening a value only where a value starts (after `=`), so `x=a'b` opens nothing;
  - outside SVG and MathML, `script`, `style`, `textarea`, `title` and the other raw-text elements hold text to their end tag,
    no comment; a `style`'s text is a stylesheet, its comments removed as a stylesheet's;
  - a `<` that opens no tag is text.
A STYLESHEET (the CSS tokenizer's): CRLF, CR and form feed are line feeds; a comment runs from slash-star to star-slash, outside
strings and unquoted `url()`; a string ends at its quote, a backslash escaping the next character, a newline among them, and an unescaped
newline ends it as a bad string.

  htmlSpans(text)        -> { comments: [[at, end]], styles: [[at, end]] }   in order, not overlapping
  htmlWithoutComments(t) -> text    each comment removed, each style element's text without its stylesheet comments
  cssWithoutComments(t)  -> text    line ends normalised, each comment removed
*/
const RAW = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext']);
const FOREIGN = new Set(['svg', 'math']);

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
		if (next === '!' || next === '?' || (next === '/' && !/[A-Za-z>]/.test(t[lt + 2] ?? ''))) {
			const e = t.indexOf('>', lt + 1), end = e < 0 ? t.length : e + 1;
			if (!/^<!doctype/i.test(t.slice(lt, lt + 9))) comments.push([lt, end]);
			i = end; continue;
		}
		const close = next === '/';
		const name = /^[A-Za-z][^\s/>]*/.exec(t.slice(lt + (close ? 2 : 1), lt + 64))?.[0];
		if (!name) { i = lt + 1; continue; }   // a < that opens no tag is text
		let j = lt + (close ? 2 : 1) + name.length, value = false;
		while (j < t.length && t[j] !== '>') {
			const ch = t[j];
			if (ch === '=') { value = true; j++; continue; }
			if (value && (ch === '"' || ch === "'")) { const e = t.indexOf(ch, j + 1); j = e < 0 ? t.length : e + 1; value = false; continue; }
			if (!/\s/.test(ch)) value = false;
			j++;
		}
		const end = Math.min(j + 1, t.length), lower = name.toLowerCase();
		if (close) { if (FOREIGN.has(lower) && foreign) foreign--; i = end; continue; }
		if (FOREIGN.has(lower)) { if (t[j - 1] !== '/') foreign++; i = end; continue; }
		if (!foreign && RAW.has(lower)) {
			const k = lower === 'plaintext' ? -1 : t.slice(end).search(new RegExp(`</${lower}[\\s/>]`, 'i'));
			const stop = k < 0 ? t.length : end + k;
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
		if (/^url\(\s*[^"'\s)]/i.test(t.slice(i, i + 64)) && !/[\w-]/.test(t[i - 1] ?? '')) {
			let j = i + 4;
			while (j < t.length && t[j] !== ')') j += t[j] === '\\' ? 2 : 1;
			const end = Math.min(j + 1, t.length);
			out += t.slice(i, end); i = end; continue;
		}
		out += ch; i++;
	}
	return out;
}
