/*
H25.4 (B376) -- THE CANVAS'S LAYOUT, DECLARED ONCE.

Which part's layer lies over which is a fact of the composition: the links beneath the devices, the pipes beneath the links,
the movers over everything they travel. It was typed in the product page and again in the lab -- the viewBox, the ground and
eleven layers, fifteen lines alike -- and a third time as the ids the lab checks for, and the export read the order out of the
product page's markup. Now product/canvas.mjs declares it (`CANVAS_VIEWBOX`, `CANVAS_LAYERS`), tools/canvas-layout.mjs writes it
into each page between generated markers (the gate runs it with --check, as it runs tools/stylesheets.mjs), and the lab and the
export read the declaration itself.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANVAS_LAYERS, CANVAS_VIEWBOX } from '../product/canvas.mjs';
import { PAGES } from '../tools/layers.mjs';
import { markersOf, withRegion } from '../tools/regions.mjs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const containerOf = (html) => {
	const svg = html.match(/<svg id="container"[^>]*>[\s\S]*?<\/svg>/)?.[0];
	if (!svg) return null;
	const ground = svg.match(/<rect id="canvas" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/);
	return { viewBox: svg.match(/viewBox="([^"]*)"/)[1], ground: ground && ground.slice(1).join(' '), layers: [...svg.matchAll(/<g id="([\w-]+)"/g)].map((m) => m[1]) };
};

test('H25.4: each page lays out the canvas the composition declares -- its viewBox, its ground, its layers in order -- inside a region written from it', () => {
	const at = (id) => CANVAS_LAYERS.indexOf(id);
	assert.ok(at('zones') < at('links') && at('pipes') < at('links') && at('links') < at('waypoints') && at('waypoints') < at('nodes') && at('nodes') < at('movers') && at('movers') < at('overlay'),
		'control: the declaration stacks zones and pipes beneath the links, the links beneath waypoints and devices, the movers over them, the overlay last');
	const { begin, end } = markersOf('canvas', 'tools/canvas-layout.mjs', 'product/canvas.mjs CANVAS_VIEWBOX, CANVAS_LAYERS');
	const pages = Object.keys(PAGES);
	assert.ok(pages.includes('app/index.html') && pages.includes('lab/index.html'), 'control: the product page and the lab are among the pages');
	for (const page of pages) {
		const html = read(page), from = html.indexOf(begin), to = html.indexOf(end);
		assert.ok(from > 0 && to > from, `${page} holds the generated canvas region`);
		const region = html.slice(from, to);
		assert.deepEqual(containerOf(region), { viewBox: CANVAS_VIEWBOX, ground: CANVAS_VIEWBOX, layers: CANVAS_LAYERS }, `${page}: the canvas is the declaration's`);
		assert.equal(containerOf(html.slice(0, from) + html.slice(to)), null, `${page} lays out no other canvas outside the region`);
	}
});

test('H25.4: a region is rewritten between its markers and nowhere else, at the marker\'s indent; a page without them is refused', () => {
	const m = markersOf('canvas', 'tools/canvas-layout.mjs', 'the declaration');
	const page = `<main>\n\t\t${m.begin}\n\t\t<old/>\n\t\t${m.end}\n\t\t<kept/>\n</main>`;
	assert.equal(withRegion(page, m, ['<a>', '\t<b/>', '</a>']), `<main>\n\t\t${m.begin}\n\t\t<a>\n\t\t\t<b/>\n\t\t</a>\n\t\t${m.end}\n\t\t<kept/>\n</main>`);
	assert.equal(withRegion(withRegion(page, m, ['<a/>']), m, ['<a/>']), withRegion(page, m, ['<a/>']), 'written twice, the same');
	assert.equal(withRegion('<main><old/></main>', m, ['<a/>']), null, 'a page with no markers has no region to write');
	const stylesheets = markersOf('stylesheets', 'tools/stylesheets.mjs', 'product/canvas.mjs PAGE_STYLESHEETS');
	assert.ok(read('app/index.html').includes(stylesheets.begin), 'control: the stylesheet region the pages already hold is written through the same markers');
});

test('H25.4: nothing else types the layers -- the lab checks for the declared ones, and the export stacks by them', () => {
	assert.doesNotMatch(read('lab/src/root.js'), /'grid-zones'|'snaplayer'|'waypoints'/, 'the lab names no layer of its own');
	assert.match(read('lab/src/root.js'), /\.\.\.CANVAS_LAYERS/, 'it checks for the declared ones');
	assert.doesNotMatch(read('server/svg.mjs'), /index\.html/, 'the export reads no page');
	assert.match(read('server/svg.mjs'), /CANVAS_LAYERS/, 'it stacks by the declaration');
});
