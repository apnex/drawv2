#!/usr/bin/env node
/*
page-regions -- H25.4 (B376). The regions written into the pages (tools/layers.mjs `PAGES`), each declared once: its exact markers,
from tools/layers.mjs `COPIES.generated`, and the lines it holds, from the composition's declarations. tools/stylesheets.mjs and
tools/canvas-layout.mjs write them; tools/scan-copies.mjs leaves a page's region out of its copied-lines measure only when it holds
exactly these lines (tools/regions.mjs). One definition, so the generators and the measure agree on every region by construction.

  PAGE_REGIONS.stylesheets  the stylesheets a page loads, in the composition's order (product/canvas.mjs PAGE_STYLESHEETS)
  PAGE_REGIONS.canvas       the canvas a page lays out: its viewBox, its ground and its layers (CANVAS_VIEWBOX, CANVAS_LAYERS)
*/
import { COPIES } from './layers.mjs';
import { PAGE_STYLESHEETS, CANVAS_LAYERS, CANVAS_VIEWBOX } from '../product/canvas.mjs';
import { markersOf } from './regions.mjs';

// a sheet's address: a page's own folder is the root it is served from, every other folder is mounted under its name
const href = (file) => (file.startsWith('app/') ? `/${file.slice('app/'.length)}` : `/${file}`);
const [x, y, width, height] = CANVAS_VIEWBOX.split(' ');

export const PAGE_REGIONS = {
	stylesheets: { ...markersOf('stylesheets', COPIES.generated.stylesheets), lines: PAGE_STYLESHEETS.map((f) => `<link rel="stylesheet" href="${href(f)}">`) },
	canvas: {
		...markersOf('canvas', COPIES.generated.canvas),
		lines: [
			`<svg id="container" viewBox="${CANVAS_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">`,
			`\t<rect id="canvas" x="${x}" y="${y}" width="${width}" height="${height}"/>`,
			...CANVAS_LAYERS.map((id) => `\t<g id="${id}"></g>`),
			'</svg>',
		],
	},
};
