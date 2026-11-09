/*
H30-1 (dev/DECISIONS.md) -- ONE VALUE FOR THE CHROME'S CONTROLS, A GLYPH SOCKET'S SIZE.

The home button and the header's controls are chrome on a layout of their own at scale 1, never zooming with the canvas, sized by a glyph
socket's 26 (kernel/spec.mjs `STD.socket`) at that scale: the header's control height and the home button's side are one CSS value,
`--control-h`, declared once at `:root` in app/style.css. The stylesheet cannot import the spec, so the two are held equal here, as the
repository holds its other copies equal: read both, and compare.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STD } from '../kernel/spec.mjs';

const STYLE = fs.readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');
const code = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// what the one value is and who reads it, or the reasons it is not one value held to the socket
function chromeSocketProblems(css, socket) {
	const rules = code(css);
	const declared = [...rules.matchAll(/--control-h:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
	const problems = [];
	if (declared.length !== 1) problems.push(`--control-h declared ${declared.length} times, not once`);
	if (!/^:root\s*\{\s*--control-h:\s*[\d.]+px;\s*\}/m.test(rules)) problems.push('--control-h is not declared at :root');
	if (declared.length === 1 && declared[0] !== socket) problems.push(`--control-h is ${declared[0]}px where a glyph socket is ${socket}`);
	const home = rules.match(/#view-home\s*\{([^}]*)\}/)?.[1] ?? '';
	for (const side of ['width', 'height']) {
		if (!new RegExp(`(^|[;\\s])${side}:\\s*var\\(--control-h\\)`).test(home)) problems.push(`#view-home's ${side} is not var(--control-h)`);
	}
	return problems;
}

test('H30-1: the home button and the header\'s controls are one value, --control-h at :root, equal to a glyph socket (STD.socket)', () => {
	assert.equal(STD.socket, 26, 'precondition: a glyph socket is 26');
	assert.deepEqual(chromeSocketProblems(STYLE, STD.socket), [], 'one value, the socket\'s');
});

test('H30-1: the check fails when the stylesheet and the socket disagree, or the button takes a figure of its own', () => {
	const planted = STYLE.replace(/^:root\s*\{\s*--control-h:\s*26px;\s*\}/m, ':root { --control-h: 30px; }');
	assert.notEqual(planted, STYLE, 'precondition: the 26 planted as 30');
	assert.deepEqual(chromeSocketProblems(planted, STD.socket), ['--control-h is 30px where a glyph socket is 26']);
	const ownFigure = STYLE.replace(/(#view-home\s*\{[^}]*?)width:\s*var\(--control-h\)/, '$1width: 26px');
	assert.deepEqual(chromeSocketProblems(ownFigure, STD.socket), ['#view-home\'s width is not var(--control-h)']);
});
