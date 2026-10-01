#!/usr/bin/env node
/*
colour-tokens -- H15.23 (B255): one registry for every colour the canvas and its page draw, and the gate that holds it.

ONE MASTER, ONE GENERATED VIEW (mission-kit P3), as tools/gesture-table.mjs is for the drag grammar. The master is
`kernel/theme.mjs` -- `TOKENS`, the canvas's roles, and `CHROME`, the page's -- and the view is `app/tokens.css`, a
`:root` block of `--tok-<role>` custom properties the stylesheets read. The kernel cannot see a stylesheet, so before this
the canvas had two authorities for every colour, and 73 uses already repeated a value `TOKENS` held (B235 and B236 were
that family, each found by eye).

`--check`, in the gate, fails on:
  - app/tokens.css differing from what the tables produce;
  - a colour literal -- `#hex`, `rgb()`, `rgba()` -- in a stylesheet, the client, the lab or the kernel, outside
    `kernel/theme.mjs` (comments are read past, so a comment may name a colour);
  - a `var(--tok-...)` naming a token the tables do not hold.
The incubating network plugin (`network/`) owns its own appearance until promotion moves it into the registry, as the
pipe colour is; it is outside the scan by name, not by omission.

Usage: node tools/colour-tokens.mjs --check | --write
*/
import fs from 'node:fs';
import path from 'node:path';
import { TOKENS, CHROME } from '../kernel/theme.mjs';

const root = path.resolve(import.meta.dirname, '..');
const VIEW = path.join(root, 'app/tokens.css');
const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const isColour = (v) => typeof v === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))$/.test(v);
const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const tokenName = (key) => `--tok-${kebab(key)}`;

const entries = [...Object.entries(TOKENS), ...Object.entries(CHROME)].filter(([, v]) => isColour(v));
function render() {
	const lines = entries.map(([k, v]) => `\t${tokenName(k)}: ${v};`);
	return `/* GENERATED from kernel/theme.mjs (TOKENS, CHROME) by tools/colour-tokens.mjs -- edit the tables, then run --write. */\n:root {\n${lines.join('\n')}\n}\n`;
}

const SCANNED = [
	['app/style.css'], ['lab/lab.css'],
	...['app/src', 'lab/src', 'kernel'].map((d) => [d, /\.(m?js)$/]),
];
const strip = (text, css) => (css ? text.replace(/\/\*[\s\S]*?\*\//g, '') : text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1'));
function scan() {
	const found = [];
	const defined = new Set(entries.map(([k]) => tokenName(k)));
	for (const [where, ext] of SCANNED) {
		const files = ext ? fs.readdirSync(path.join(root, where)).filter((f) => ext.test(f)).map((f) => path.join(where, f)) : [where];
		for (const rel of files) {
			if (rel === 'kernel/theme.mjs') continue;
			const css = rel.endsWith('.css');
			const code = strip(fs.readFileSync(path.join(root, rel), 'utf8'), css);
			for (const m of code.matchAll(COLOUR)) found.push(`${rel}: colour literal ${m[0]} -- name it in kernel/theme.mjs and read the token`);
			if (css) for (const m of code.matchAll(/var\((--tok-[\w-]+)\)/g)) if (!defined.has(m[1])) found.push(`${rel}: ${m[1]} is not a token`);
		}
	}
	return found;
}

const mode = process.argv[2];
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
	if (mode !== '--check' && mode !== '--write') { console.error('usage: node tools/colour-tokens.mjs --check | --write'); process.exit(2); }
	if (mode === '--write') {
		fs.writeFileSync(VIEW, render());
		console.log(`colour-tokens: wrote ${path.relative(root, VIEW)} (${entries.length} tokens)`);
	} else {
		const problems = [];
		if (!fs.existsSync(VIEW) || fs.readFileSync(VIEW, 'utf8') !== render()) problems.push('app/tokens.css differs from what kernel/theme.mjs produces; run node tools/colour-tokens.mjs --write');
		problems.push(...scan());
		if (problems.length) { for (const p of problems) console.error(`  ${p}`); console.error(`colour-tokens: FAIL -- ${problems.length} finding(s)`); process.exit(1); }
		console.log(`colour-tokens: PASS -- ${entries.length} tokens, one registry, no colour literal outside it`);
	}
}
