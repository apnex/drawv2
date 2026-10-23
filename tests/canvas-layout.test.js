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
import { CANVAS_LAYERS, CANVAS_VIEWBOX, CANVAS_SCENE } from '../product/canvas.mjs';
import { PAGES, COPIES } from '../tools/layers.mjs';
import { markersOf, withRegion } from '../tools/regions.mjs';
import { PAGE_REGIONS } from '../tools/page-regions.mjs';

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
	const { begin, end } = PAGE_REGIONS.canvas;
	assert.deepEqual({ begin, end }, markersOf('canvas', COPIES.generated.canvas), 'control: the region the generator writes is the one the manifest names');
	const pages = Object.keys(PAGES);
	assert.ok(pages.includes('app/index.html') && pages.includes('lab/index.html'), 'control: the product page and the lab are among the pages');
	for (const page of pages) {
		const html = read(page), from = html.indexOf(begin), to = html.indexOf(end);
		assert.ok(from > 0 && to > from, `${page} holds the generated canvas region`);
		const region = html.slice(from, to);
		// RESTATED at H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1, appendix B): the region holds the root, its viewBox and its
		// ground, and no layer -- the scene the canvas opens from the composition's declaration appends them after the ground
		assert.deepEqual(containerOf(region), { viewBox: CANVAS_VIEWBOX, ground: CANVAS_VIEWBOX, layers: [] }, `${page}: the canvas is the declaration's`);
		// and exactly so, character for character, indent and all -- an attribute added to a layer is a hand edit too (H25.4's verifiers)
		const [x, y, w, h] = CANVAS_VIEWBOX.split(' '), indent = html.slice(html.lastIndexOf('\n', from) + 1, from);
		const svg = [`<svg id="container" viewBox="${CANVAS_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">`, `\t<rect id="canvas" x="${x}" y="${y}" width="${w}" height="${h}"/>`, '</svg>'];
		assert.equal(html.slice(from, to + end.length), [begin, ...svg, end].join(`\n${indent}`), `${page}: its region holds the declaration's canvas and nothing else`);
		assert.match(html.slice(0, from), /<main id="stage">\s*$/, `${page}: the canvas is the first thing in its stage`);
		assert.equal(containerOf(html.slice(0, from) + html.slice(to)), null, `${page} lays out no other canvas outside the region`);
	}
	// H26.4: the layers in order are the scene's, each the declaration's layer by name, the pipes and the movers foreign
	assert.deepEqual(CANVAS_SCENE.layers.map((l) => l.name), CANVAS_LAYERS, 'the scene declares the canvas\'s layers, in order');
	assert.deepEqual(CANVAS_SCENE.layers.filter((l) => l.foreign).map((l) => l.name), ['pipes', 'movers'], 'the two the plugins draw themselves, foreign');
	assert.ok(CANVAS_SCENE.layers.every((l) => l.attrs.id === l.name), 'each written with its id, as the page\'s markup held it');
});

test('H25.4: a region is rewritten between its markers and nowhere else, at the marker\'s indent; a page without them, or holding them twice, is refused', () => {
	const m = { ...markersOf('canvas', { tool: 'tools/canvas-layout.mjs', source: 'the declaration' }), lines: ['<a>', '\t<b/>', '</a>'] };
	const page = `<main>\n\t\t${m.begin}\n\t\t<old/>\n\t\t${m.end}\n\t\t<kept/>\n</main>`;
	assert.equal(withRegion(page, m), `<main>\n\t\t${m.begin}\n\t\t<a>\n\t\t\t<b/>\n\t\t</a>\n\t\t${m.end}\n\t\t<kept/>\n</main>`);
	assert.equal(withRegion(withRegion(page, m), m), withRegion(page, m), 'written twice, the same');
	assert.equal(withRegion('<main><old/></main>', m), null, 'a page with no markers has no region to write');
	assert.equal(withRegion(`<main><${m.begin}\n<old/>\n${m.end}</main>`, m), null, 'nor one whose marker does not open its line');
	assert.throws(() => withRegion(`${page}\n${m.begin}\n<typed/>\n${m.end}`, m, 'lab/index.html'), /lab\/index\.html holds the region .* twice/, 'a page holding the region twice is refused, by name: one is written, the other typed');
	assert.ok(read('app/index.html').includes(PAGE_REGIONS.stylesheets.begin), 'control: the stylesheet region the pages already hold is written through the same definitions');
});

test('H25.4: nothing else types the layers -- the lab checks for the declared ones, and the export stacks by them', () => {
	assert.doesNotMatch(read('lab/src/root.js'), /'grid-zones'|'snaplayer'|'waypoints'/, 'the lab names no layer of its own');
	// RESTATED at H26.4: the scene appends them, so the lab checks each declared one stands where the scene put it, after the ground
	assert.match(read('lab/src/root.js'), /CANVAS_LAYERS\.filter\(\(id, i\) => document\.getElementById\(id\) !== svg\.children\[i \+ 1\]\)/, 'it checks for the declared ones');
	assert.doesNotMatch(read('server/svg.mjs'), /index\.html/, 'the export reads no page');
	assert.match(read('server/svg.mjs'), /CANVAS_LAYERS/, 'it stacks by the declaration');
});
