#!/usr/bin/env node
/*
page-regions -- H25.4 (B376). The regions written into the pages (tools/layers.mjs `PAGES`), each declared once: its exact markers,
from tools/layers.mjs `COPIES.generated`, and the lines it holds, from the composition's declarations. tools/stylesheets.mjs,
tools/canvas-layout.mjs and tools/import-map.mjs write them; tools/scan-copies.mjs leaves a page's region out of its copied-lines
measure only when it holds exactly these lines (tools/regions.mjs). One definition, so the generators and the measure agree on every
region by construction.

  PAGE_REGIONS.stylesheets  the stylesheets a page loads, in the composition's order (product/canvas.mjs PAGE_STYLESHEETS)
  PAGE_REGIONS.canvas       the canvas a page lays out: its viewBox, its ground and its layers (CANVAS_VIEWBOX, CANVAS_LAYERS)
  PAGE_REGIONS.importmap    H26.1: the page's one import map, an entry per export of each component installed (tools/components.mjs)
  importMapRegion(imports)  that region for any map -- the generator writes it for the tree it is given, the measure for this one
*/
import path from 'node:path';
import { COPIES } from './layers.mjs';
import { PAGE_STYLESHEETS, CANVAS_LAYERS, CANVAS_VIEWBOX } from '../product/canvas.mjs';
import { markersOf } from './regions.mjs';
import { importMapOf } from './components.mjs';

// a sheet's address: a page's own folder is the root it is served from, every other folder is mounted under its name
const href = (file) => (file.startsWith('app/') ? `/${file.slice('app/'.length)}` : `/${file}`);
const [x, y, width, height] = CANVAS_VIEWBOX.split(' ');

export const importMapRegion = (imports) => ({
	...markersOf('importmap', COPIES.generated.importmap),
	lines: ['<script type="importmap">', ...JSON.stringify({ imports }, null, '\t').split('\n'), '</script>'],
});

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
	// what this tree installs; a problem with it is the generator's to report (tools/import-map.mjs --check), never a throw here
	importmap: importMapRegion(importMapOf(path.resolve(import.meta.dirname, '..')).imports),
};
