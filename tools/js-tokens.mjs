#!/usr/bin/env node
/*
js-tokens -- the JavaScript tokenizer tools/scan-layers.mjs reads every module with, in a module of its own so a second tool reads
modules the same way (tools/code-split.mjs, which splits draw's code by statement). Moved here unchanged from tools/scan-layers.mjs,
where its comments say what each rule was found by; nothing here reads a file or names a layer.

  lex(src)       the tokens of a module: `{ type, value, start, end, line }`, type one of id, priv, num, str, tpl, re and p
                 (punctuation); comments and whitespace dropped, strings, templates and regex literals single tokens, a template
                 split at each substitution, whose tokens follow it; a `)` or `}` marked `control` or `block` where it closes one
  isP(t, v)      whether a token is the punctuation v
  isId(t, v)     whether a token is an identifier, the name v when given
*/

// ---------------------------------------------------------------------------------------------
// The tokenizer. Comments and whitespace are dropped; strings, templates and regex literals are
// single tokens, so nothing inside them can look like code.
// ---------------------------------------------------------------------------------------------
const KW_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??',
	'++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**'];

const MULTI = new Set(PUNCT.map((p) => p[0]));
// identifier characters by code: ASCII letters, `_`, `$`, and anything past ASCII (digits continue only)
const identStart = (k) => (k >= 97 && k <= 122) || (k >= 65 && k <= 90) || k === 95 || k === 36 || k > 127;
const identPart = (k) => identStart(k) || (k >= 48 && k <= 57);
// `if (x) /re/` -- after the head of one of these, a `/` starts a regex rather than dividing
const CONTROL = new Set(['if', 'while', 'for', 'with']);
// a `{` after one of these opens a block, and a `/` after that block's `}` starts a regex
const BLOCK_AFTER = new Set(['else', 'do', 'try', 'finally']);
const SIMPLE_ESCAPE = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v' };

/*
The escape at s[j] (a backslash), decoded as the language decodes it: `\x41`, `A` and
`\u{41}` are all `A`, and a backslash before a line break continues the line. A string or an
identifier is read as what it MEANS, so `'../engine/x.mjs'` is the path it names and
`window` is `window`. Returns [text, the index after the escape].
*/
function decodeEscape(s, j) {
	const d = s[j + 1];
	if (d === undefined) return ['', j + 1];
	if (d === '\r' && s[j + 2] === '\n') return ['', j + 3];
	if (d === '\n' || d === '\r' || d === '\u2028' || d === '\u2029') return ['', j + 2];
	if (SIMPLE_ESCAPE[d]) return [SIMPLE_ESCAPE[d], j + 2];
	const code = (hex) => { try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; } };
	if (d === 'x') {
		const h = /^[0-9a-fA-F]{2}/.exec(s.slice(j + 2, j + 4));
		return h ? [code(h[0]), j + 4] : ['x', j + 2];
	}
	if (d === 'u') {
		const m = /^(?:\{([0-9a-fA-F]+)\}|([0-9a-fA-F]{4}))/.exec(s.slice(j + 2, j + 16));
		return m ? [code(m[1] ?? m[2]), j + 2 + m[0].length] : ['u', j + 2];
	}
	if (d >= '0' && d <= '7') {
		const m = /^(?:[0-3][0-7]{0,2}|[4-7][0-7]?)/.exec(s.slice(j + 1, j + 4));
		return [String.fromCharCode(parseInt(m[0], 8)), j + 1 + m[0].length];
	}
	return [d, j + 2];
}
const cook = (raw) => {
	let out = '';
	for (let j = 0; j < raw.length;) {
		if (raw[j] === '\\') { const [t, e] = decodeEscape(raw, j); out += t; j = e; } else out += raw[j++];
	}
	return out;
};

export function lex(src) {
	const T = [];
	const n = src.length;
	let i = 0, line = 1;
	const stack = [];    // 't' for a template substitution; 'block' or 'expr' for a brace
	const parens = [];   // per open paren: whether it holds the head of if/while/for/with
	const push = (type, value, start, l) => T.push({ type, value, start, end: i, line: l });
	/*
	A `/` starts a regex unless the token before it ends an expression. A `)` or a `}` ends one
	only sometimes: `if (ok) /'/.test(s)` and `{} /'/.test(s)` begin a regex, `f(x) / 2` and
	`({}) / 2` divide. Reading the first kind as division turns the rest of the line into a string,
	and an `import()` on that line vanishes (the attack's A15), so each `)` and `}` records which
	kind it closes.
	*/
	const regexOk = () => {
		const p = T[T.length - 1];
		if (!p) return true;
		if (['num', 'str', 'tpl', 're', 'priv'].includes(p.type)) return false;
		if (p.type === 'id') return KW_BEFORE_REGEX.has(p.value);
		if (p.value === ')') return p.control === true;
		if (p.value === '}') return p.block === true;
		return ![']', '++', '--'].includes(p.value);
	};
	// whether a `{` here opens a block (a statement's body) or an object literal
	const braceKind = () => {
		const p = T[T.length - 1];
		if (!p) return 'block';
		if (p.type === 'id') return BLOCK_AFTER.has(p.value) || !KW_BEFORE_REGEX.has(p.value) ? 'block' : 'expr';
		if (p.type !== 'p') return 'expr';
		if ([')', '=>', ';', '{', '}'].includes(p.value)) return 'block';
		if (p.value === ':') return stack[stack.length - 1] === 'expr' || stack[stack.length - 1] === 't' ? 'expr' : 'block';
		return 'expr';
	};
	// an identifier from s[j], its escapes decoded; [name, the index after it]
	const identAt = (j) => {
		let name = '';
		while (j < n) {
			if (src[j] === '\\' && src[j + 1] === 'u') {
				const [t, e] = decodeEscape(src, j);
				if (e === j + 2) break;
				name += t; j = e; continue;
			}
			const k = src.charCodeAt(j);
			if (name === '' ? identStart(k) : identPart(k)) { name += src[j]; j++; continue; }
			break;
		}
		return [name, j];
	};
	const template = (start, l) => {
		let raw = '';
		while (i < n) {
			const c = src[i];
			if (c === '\\') { raw += src.slice(i, i + 2); if (src[i + 1] === '\n') line++; i += 2; continue; }
			if (c === '`') { i++; push('tpl', raw, start, l); Object.assign(T[T.length - 1], { tail: true, cooked: cook(raw) }); return; }
			if (c === '$' && src[i + 1] === '{') { i += 2; push('tpl', raw, start, l); T[T.length - 1].cooked = cook(raw); stack.push('t'); return; }
			if (c === '\n') line++;
			raw += c; i++;
		}
		push('tpl', raw, start, l);
		T[T.length - 1].cooked = cook(raw);
	};
	if (src.startsWith('#!')) while (i < n && src[i] !== '\n') i++;
	while (i < n) {
		const c = src[i];
		const start = i, l = line;
		if (c === '\n') { line++; i++; continue; }
		if (c === ' ' || c === '\t' || c === '\r' || /[\f\v\u00a0\ufeff\u2028\u2029]/.test(c)) { i++; continue; }
		if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
		if (c === '/' && src[i + 1] === '*') {
			const e = src.indexOf('*/', i + 2);
			const stop = e < 0 ? n : e + 2;
			for (let k = i; k < stop; k++) if (src[k] === '\n') line++;
			i = stop; continue;
		}
		if (c === '\'' || c === '"') {
			let v = ''; i++;
			while (i < n && src[i] !== c && src[i] !== '\n') {
				if (src[i] === '\\') {
					if (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n')) line++;
					const [t, e] = decodeEscape(src, i); v += t; i = e; continue;
				}
				v += src[i++];
			}
			i++;
			push('str', v, start, l); continue;
		}
		if (c === '`') { i++; template(start, l); T[T.length - 1].head = true; continue; }
		if (c === '#' || identStart(src.charCodeAt(i)) || (c === '\\' && src[i + 1] === 'u')) {
			const [name, j] = identAt(c === '#' ? i + 1 : i);
			if (j === i) { i++; push('p', c, start, l); continue; }
			i = j; push(c === '#' ? 'priv' : 'id', c === '#' ? `#${name}` : name, start, l); continue;
		}
		if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] || ''))) {
			const m = /^(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?/.exec(src.slice(i, i + 64));
			i += m ? m[0].length : 1; push('num', src.slice(start, i), start, l); continue;
		}
		if (c === '/' && regexOk()) {
			let j = i + 1, cls = false;
			while (j < n && src[j] !== '\n') {
				const d = src[j];
				if (d === '\\') { j += 2; continue; }
				if (cls) { if (d === ']') cls = false; } else if (d === '[') cls = true; else if (d === '/') break;
				j++;
			}
			const body = src.slice(i + 1, j);
			j++;
			const f = j;
			while (j < n && /[a-z]/i.test(src[j])) j++;
			i = j; push('re', body, start, l); T[T.length - 1].flags = src.slice(f, j); continue;
		}
		if (c === '(') {
			const p = T[T.length - 1], q = T[T.length - 2];
			const head = p?.type === 'id' && !isP(q, '.') && (CONTROL.has(p.value) || (p.value === 'await' && isId(q, 'for')));
			parens.push(head);
			i++; push('p', '(', start, l); continue;
		}
		if (c === ')') { const head = parens.pop(); i++; push('p', ')', start, l); if (head) T[T.length - 1].control = true; continue; }
		if (c === '{') { stack.push(braceKind()); i++; push('p', '{', start, l); continue; }
		if (c === '}') {
			if (stack[stack.length - 1] === 't') { stack.pop(); i++; template(start, l); continue; }
			const kind = stack.pop(); i++; push('p', '}', start, l);
			if (kind === 'block') T[T.length - 1].block = true;
			continue;
		}
		if (c === '?' && src[i + 1] === '.' && !/\d/.test(src[i + 2] || '')) { i += 2; push('p', '?.', start, l); continue; }
		const op = MULTI.has(c) ? PUNCT.find((p) => src.startsWith(p, i)) : null;
		i += op ? op.length : 1;
		push('p', op || c, start, l);
	}
	return T;
}

export function isP(t, v) { return t?.type === 'p' && t.value === v; }
export function isId(t, v) { return t?.type === 'id' && (v === undefined || t.value === v); }
