#!/usr/bin/env node
/*
canvas-layout -- H25.4 (B376). The canvas a page lays out is the composition's, written into the pages, never typed there.

product/canvas.mjs declares the canvas's viewBox, whose rectangle is its ground, and its layers back to front
(`CANVAS_VIEWBOX`, `CANVAS_LAYERS`). This writes them into each page the manifest declares (tools/layers.mjs `PAGES`) as its
`<svg id="container">`, between its BEGIN and END GENERATED markers, and `--check` fails when a page lays out anything else --
so the pages cannot drift from the composition, nor from each other (mission-kit P3), as tools/stylesheets.mjs holds the
stylesheets they load. Before H25.4 each page typed its canvas, fifteen lines alike, and the export read the order from one.

Usage: node tools/canvas-layout.mjs --check | --write
*/
import fs from 'node:fs';
import path from 'node:path';
import { PAGES } from './layers.mjs';
import { CANVAS_LAYERS, CANVAS_VIEWBOX } from '../product/canvas.mjs';
import { markersOf, withRegion } from './regions.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const mode = process.argv[2];
if (mode !== '--check' && mode !== '--write') { console.error('usage: node tools/canvas-layout.mjs --check | --write'); process.exit(2); }

const MARKERS = markersOf('canvas', 'tools/canvas-layout.mjs', 'product/canvas.mjs CANVAS_VIEWBOX, CANVAS_LAYERS');
const [x, y, width, height] = CANVAS_VIEWBOX.split(' ');
const LINES = [
	`<svg id="container" viewBox="${CANVAS_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">`,
	`\t<rect id="canvas" x="${x}" y="${y}" width="${width}" height="${height}"/>`,
	...CANVAS_LAYERS.map((id) => `\t<g id="${id}"></g>`),
	'</svg>',
];

const problems = [];
for (const page of Object.keys(PAGES)) {
	const file = path.join(ROOT, page), html = fs.readFileSync(file, 'utf8');
	let next;
	try { next = withRegion(html, MARKERS, LINES); } catch (e) { problems.push(`${page} ${e.message}`); continue; }
	if (next === null) { problems.push(`${page} has no generated canvas region -- add the BEGIN and END markers where its canvas is laid out`); continue; }
	if (next === html) continue;
	if (mode === '--write') { fs.writeFileSync(file, next); console.log(`  canvas-layout: wrote ${page}`); }
	else problems.push(`${page} lays out another canvas than the composition -- run node tools/canvas-layout.mjs --write`);
}
if (problems.length) { for (const p of problems) console.error(`  \u2717 ${p}`); console.error(`canvas-layout: FAIL -- ${problems.length} finding(s)`); process.exit(1); }
console.log(`canvas-layout: PASS -- ${Object.keys(PAGES).length} page(s) lay out the composition's canvas, its ${CANVAS_LAYERS.length} layers in order`);
