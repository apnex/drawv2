/*
H25.0 (B365) -- THE MEASURES OF A COPIED FACT, each shown to catch a planted copy and to pass its control.

H22 closed the unification against a count of imports between parts, which a fact copied into two modules that never import each
other passes; the published SVG's copied order of layers and label rules drifted unseen (B361). tools/copies.mjs measures copies,
tools/scan-copies.mjs runs the measures over the tree and holds the findings to a record that may only shrink, inside a ceiling
frozen when H25 opened. A measure that cannot be shown to bite is not a measure (scan-twins learned that, X13), so each case plants
the copy it exists to see beside a control it must not -- and the ways H25.0's adversarial review found to hide a copy are planted
too.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { classesPutOnElements, classesInMarkup, stylesheetsInSource, copiedStyleRules, foreignStyleRules, stylesDrawnByNoPart, copiedLines, modulesNoEntryReaches, judgeFindings, judgeExceptions } from '../tools/copies.mjs';
import { FOLDERS, SCANNER_ROOTS, COPIES, NOT_PARTS } from '../tools/layers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('H25.0: a class is credited where code puts it on an element -- a class key, a template, markup as text, a state set through the renderer, classList -- and never where it is read or quoted under another key', () => {
	const src = [
		"el('rect', { class: 'zone-rect', rx: 4 }, g);",
		"d.line.setAttribute('class', `pipe pipe-${laid}${selected.has(id) ? ' selected' : ''}`);",
		"this.renderer.setState(target.id, 'hover', true);",
		"addClass: 'spawning',",
		"picks: [{ closest: 'g.node', word: 'node', idle: 'linkband' }],",
		"preview: 'textbox-preview',",
		"root: { layer: 'waypoints', class: (entity, kit, state) => `waypoint ${state}` },",
		"menu.agents.classList.toggle('armed', spectator.armed);",
		"svg: `<g transform=\"translate(-5,-12)\" class=\"solid\">`,",
		"const kind = 'zone';   // a kind word, not a class",
		"if ((n.attrs.class || '').split(/\\s+/).includes('label-pill')) return '';",
		"if (el.classList.contains('handle')) return;",
		"// class: 'commented-out'",
	].join('\n');
	assert.deepEqual([...classesPutOnElements(src)].sort(), ['armed', 'hover', 'linkband', 'pipe', 'selected', 'solid', 'spawning', 'textbox-preview', 'waypoint', 'zone-rect']);
});

test('H25.0: on this tree, the classes are credited to the parts that put them on elements -- the review\'s misattributions are gone', () => {
	const of = (f) => classesPutOnElements(read(f));
	for (const c of ['label', 'label-pill']) assert.ok(!of('server/svg.mjs').has(c), `the export reads ${c} and draws none`);
	// RESTATED at H25.1 (B366): a name's label is the core's (kernel/renderer.mjs nameLabel), drawn for the zones and devices alike
	assert.ok(of('kernel/renderer.mjs').has('label-pill') && of('kernel/renderer.mjs').has('label'), 'control: the core draws the name pill and its text');
	assert.ok(!of('zones/zone-painter.mjs').has('label-pill') && !of('devices/device-appearance.mjs').has('label-pill'), 'and neither plugin draws its own');
	assert.ok(of('zones/zone-painter.mjs').has('zone-label'), 'the zones plugin still names its own variant');
	assert.ok(!of('layouts/layout-canvas.mjs').has('zone') && of('layouts/layout-canvas.mjs').has('zonegrid'), 'the layouts plugin\'s grid named `zone` is no class; its `zonegrid` is');
	assert.ok(!of('network/appearance.mjs').has('solid'), 'a layer\'s `fill: \'solid\'` is no class');
	assert.ok(!of('network/anchor-appearance.mjs').has('waypoints') && of('network/anchor-appearance.mjs').has('waypoint'), 'a root\'s layer is no class; its class is');
	assert.ok(of('devices/device-types.mjs').has('solid') && of('devices/device-types.mjs').has('hollow'), 'control: the glyph art\'s markup draws `solid` and `hollow`');
	assert.ok(!of('app/src/pick.js').has('handle'), 'a class only tested with `contains` is not drawn');
});

test('H25.0: a page\'s markup credits the classes it writes; a commented-out element credits none', () => {
	assert.deepEqual([...classesInMarkup('<button class="menu-icon wide">+</button><!-- <i class="gone"></i> --><span id="x"></span>')].sort(), ['menu-icon', 'wide']);
});

test('H25.0: CSS a module holds as text is read from its source and named by its constant -- one rule is enough, so splitting a stylesheet hides none of it; code is not CSS', () => {
	const src = 'export const SHEET = `\n.a { fill: ${T.x}; }\n.b .c { stroke: red; stroke-width: 2; }\n`;\nconst ONE = `.d { fill: red; }`;\nconst CODE = `${a} and ${b}`;\n// a commented `.e { fill: red; }` template';
	const got = stylesheetsInSource(src);
	assert.deepEqual(got.map((s) => s.name), ['SHEET', 'ONE'], 'a one-rule template is a stylesheet; plain code and a comment are not');
	assert.match(got[0].css, /\.a \{ fill: X; \}/, 'an expression stands in as a placeholder');
});

test('H25.0: the same property of the same elements in two stylesheets is a copy -- a bare ancestor class or none, the same elements; another ancestor, or a state, is not', () => {
	const pair = (a, b) => copiedStyleRules([{ name: 'p', css: a }, { name: 'q', css: b }]);
	assert.deepEqual(pair('.a { fill: red; }', '.a { fill: blue; stroke: red; }'), [{ rule: '.a { fill }', in: ['p', 'q'] }], 'one copied property, whatever value each gives it');
	assert.equal(pair('.zone-rect { fill: red; }', '.zone .zone-rect { fill: red; }').length, 1, '`.zone .zone-rect` sets the rectangles `.zone-rect` does');
	assert.equal(pair('.node .select-box { stroke: red; }', '.node .select-box { stroke: red; }').length, 1, 'the same ancestor, the same elements');
	assert.equal(pair('.node .select-box { stroke: red; }', '.waypoint .select-box { stroke: red; }').length, 0, 'control: a node\'s box is not a waypoint\'s');
	assert.equal(pair('.node .select-box { display: none; }', '.node.selected .select-box { display: block; }').length, 0, 'control: a selected node\'s box is not every node\'s box');
	assert.equal(pair('.link-head { stroke: blue; }', '.link.selected + .link-head { stroke: green; }').length, 0, 'control: the head after a selected link is not every head');
	assert.equal(copiedStyleRules([{ name: 'p', css: '.a { fill: red; } .a { stroke: red; }' }]).length, 0, 'control: one stylesheet is one place');
});

test('H25.0: a stylesheet styling a class only another part\'s plugins draw is foreign; a class a host part also draws, or the sheet\'s own, is not', () => {
	const drawnBy = new Map([['zone-rect', new Set(['zones'])], ['selected', new Set(['zones', 'renderer'])], ['link', new Set(['network'])]]);
	const isPlugin = (p) => ['zones', 'network'].includes(p);
	const got = foreignStyleRules([{ name: 'page.css', owner: 'page', css: '.zone-rect { fill: red; } .x.selected { fill: red; }' }, { name: 'zones.css', owner: 'zones', css: '.zone-rect { fill: red; }' }], drawnBy, isPlugin);
	assert.deepEqual(got.map((x) => `${x.sheet} ${x.selector}`), ['page.css .zone-rect'], 'only the page styling the zones plugin\'s rectangle');
});

test('H25.0: a styled class no part draws, and a styled id no page writes and no module quotes, are reported; drawn and written ones are not', () => {
	const drawnBy = new Map([['link', new Set(['network'])]]);
	assert.deepEqual(stylesDrawnByNoPart([{ name: 'page.css', css: '.ghostly { fill: red; } .link { fill: red; } #gone { fill: red; } #status { fill: red; }' }], drawnBy, new Set(['status'])),
		[{ name: '.ghostly', in: ['page.css'] }, { name: '#gone', in: ['page.css'] }]);
});

test('H25.0: lines one page repeats from another, five in a row, are copied lines -- a comment put into the run hides none; four in a row, or short lines, are not', () => {
	const six = ['<g id="grid-nodes"></g>', '<g id="grid-zones"></g>', '<g id="snaplayer"></g>', '<g id="zones"></g>', '<g id="pipes"></g>', '<g id="groups"></g>'];
	assert.deepEqual(copiedLines([{ name: 'a.html', text: ['<a>', ...six, '<b>'].join('\n') }, { name: 'b.html', text: ['<c>', ...six].join('\n') }]), [{ files: ['a.html', 'b.html'], lines: six }]);
	const commented = [...six.slice(0, 3), '<!-- a comment', 'over two lines -->', ...six.slice(3)];
	assert.equal(copiedLines([{ name: 'a.html', text: commented.join('\n') }, { name: 'b.html', text: six.join('\n') }])[0]?.lines.length, 6, 'a comment inside the copy hides none of it');
	assert.deepEqual(copiedLines([{ name: 'a.html', text: six.slice(0, 4).join('\n') }, { name: 'b.html', text: six.slice(0, 4).join('\n') }]), [], 'control: four lines in a row are not a copy');
	assert.deepEqual(copiedLines([{ name: 'a', text: '}\n}\n}\n}\n}\n}' }, { name: 'b', text: '}\n}\n}\n}\n}\n}' }]), [], 'control: closing braces are not a copy');
});

/*
H25.4 (B376) -- A GENERATED REGION IS LEFT OUT ONLY WHEN A GENERATOR OWNS IT. Any marked region was left out, so lines typed between
markers no generator writes, or inside a second region of a name one does, hid from the measure (found by H25.4's verifier, who
copied seven lines into the lab inside a made-up region and every check passed).
*/
test('H25.4: a page\'s region is left out of the copied-lines measure only when it holds exactly what its generator writes -- every other marked region is read', async () => {
	const { markersOf, strayMarkers } = await import('../tools/regions.mjs');
	const six = ['<g id="grid-nodes"></g>', '<g id="grid-zones"></g>', '<g id="snaplayer"></g>', '<g id="zones"></g>', '<g id="pipes"></g>', '<g id="groups"></g>'];
	const own = { ...markersOf('canvas', COPIES.generated.canvas), lines: six };
	const other = { ...markersOf('stylesheets', COPIES.generated.stylesheets), lines: ['<link rel="stylesheet" href="/a.css">'] };
	const region = (r, lines = r.lines) => [r.begin, ...lines, r.end];
	const typed = ['<p class="one">a line typed in the page itself</p>', '<p class="two">and another typed after it</p>', '<p class="three">a third</p>', '<p class="four">a fourth</p>', '<p class="five">a fifth</p>'];
	const copies = (a, b, regions = [own, other]) => copiedLines([{ name: 'a.html', text: a.join('\n'), regions }, { name: 'b.html', text: b.join('\n'), regions }]).flatMap((x) => x.lines);
	assert.deepEqual(copies(region(own), region(own)), [], 'a region holding its generator\'s lines in each page: one master, not a copy');
	assert.deepEqual(copies([...region(own), ...typed], typed), typed, 'control: what is typed beside it is read');
	assert.deepEqual(copies(region(own, typed), typed), typed, 'a region holding anything but its generator\'s lines hides nothing');
	assert.deepEqual(copies(region({ ...markersOf('anything', COPIES.generated.canvas), lines: typed }), typed), typed, 'nor a region no generator writes');
	assert.deepEqual(copies([...region(own, typed), ...region(own)], typed), typed, 'nor a typed region before the real one, of the same name');
	assert.deepEqual(copies([own.begin.replace('by hand', 'by  hand'), ...typed, own.end, ...region(own)], typed), typed, 'nor one opened by a near copy of the marker');
	assert.deepEqual(copies(['<!-- BEGIN GENERATED: canvas (typed) -->', ...typed, ...region(own)], typed), typed, 'nor one with no end of its own');
	// the third verifier's: a stylesheet holds no region, so an exact pair in its comments hides nothing
	const sheet = (lines) => [`/* ${own.begin} */`, ...lines, `/* ${own.end} */`];
	assert.deepEqual(copiedLines([{ name: 'a.css', text: sheet(typed).join('\n'), regions: [] }, { name: 'b.css', text: typed.join('\n'), regions: [] }]).flatMap((x) => x.lines), typed, 'an exact pair in a stylesheet\'s comments hides nothing');
	// and a region whose marker does not open its line -- `<` before it -- is none, so removing it cannot make the next marker whole
	const made = [`<${other.begin}`, ...other.lines.map((l) => `<${l}`), `<${other.end}${own.begin.slice(1)}`, ...typed, ...region(own)];
	assert.deepEqual(copies(made, typed), typed, 'removing one region never makes another: regions are found on the page as written');
	// the real region's markers are kept; the typed region's two, and the one inside a comment, are named
	assert.deepEqual(strayMarkers([...region(own), ...region(own, typed), `/* ${own.begin} */`].join('\n'), [own]), [own.begin, own.end, own.begin], 'every marker not opening or closing a region left out is named, for the scanner to refuse');
	assert.deepEqual(strayMarkers([...region(own), '/* BEGIN GENERATED: x */'].join('\n'), [own]), ['/* BEGIN GENERATED: x */'], 'a stylesheet\'s own form of marker too');
	const scanner = fs.readFileSync(path.join(import.meta.dirname, '..', 'tools', 'scan-copies.mjs'), 'utf8');
	assert.match(scanner, /strayMarkers\(f\.text, f\.regions\)/, 'the scanner names them in every page and sheet it reads');
	assert.match(scanner, /\.\.\.strays,\n\];/, 'and fails on them');
	assert.match(scanner, /regions: f in PAGES \? Object\.values\(PAGE_REGIONS\) : \[\]/, 'and gives a page its regions and a stylesheet none');
});

/*
H25.4 (B376), the fourth verification -- THE MEASURE READS AS A BROWSER READS, AND A REGION HIDES NOTHING TYPED ELSEWHERE. A region was
left out of both sides of a comparison, so lines typed in one page that the other generates matched nothing; and comments were
removed in either language, lines split at LF alone -- so an HTML comment's opener in a stylesheet, one in a page's attribute, or a
lone CR between lines hid live copies.
*/
test('H25.4: a copy typed of lines another page generates is found; comments are read in each file\'s own language; every line end counts', async () => {
	const { markersOf } = await import('../tools/regions.mjs');
	const typed = ['<p class="one">a line typed in the page itself</p>', '<p class="two">and another typed after it</p>', '<p class="three">a third</p>', '<p class="four">a fourth</p>', '<p class="five">a fifth</p>'];
	const own = { ...markersOf('canvas', COPIES.generated.canvas), lines: typed };
	const other = { ...markersOf('stylesheets', COPIES.generated.stylesheets), lines: ['<link rel="stylesheet" href="/a.css">', '<link rel="stylesheet" href="/b.css">', '<link rel="stylesheet" href="/c.css">', '<link rel="stylesheet" href="/d.css">', '<link rel="stylesheet" href="/e.css">'] };
	const pages = (a, b) => copiedLines([{ name: 'a.html', text: a.join('\n'), regions: [own, other] }, { name: 'b.html', text: b.join('\n'), regions: [own, other] }]).flatMap((x) => x.lines);
	assert.deepEqual(pages([own.begin, ...typed, own.end], [own.begin, ...typed, own.end]), [], 'control: the region in both pages, each generated, is no copy');
	assert.deepEqual(pages([own.begin, ...typed, own.end], ['<template>', ...typed, '</template>']), typed, 'the same lines typed outside any region, in the other page, are');
	assert.deepEqual(pages([own.begin, ...typed, '<p>one line more</p>', own.end], [own.begin, ...typed, own.end]), [...typed], 'a region holding its lines and one more is no region: what it holds is read');
	// a region whose marker does not open its line is none -- and removing the one before it on the line must not make it one,
	// in either region order (the fifth verifier's j1a: passing [other, own] as the scanner does)
	assert.deepEqual(pages([other.begin, ...other.lines, other.end + own.begin, ...typed, own.end], [own.begin, ...typed, own.end]), typed, 'regions are found on the page as written (canvas first)');
	const pagesOtherFirst = (a, b) => copiedLines([{ name: 'a.html', text: a.join('\n'), regions: [other, own] }, { name: 'b.html', text: b.join('\n'), regions: [other, own] }]).flatMap((x) => x.lines);
	assert.deepEqual(pagesOtherFirst([other.begin, ...other.lines, other.end + own.begin, ...typed, own.end], [own.begin, ...typed, own.end]), typed, 'and in the scanner\'s order (stylesheets first)');
	// the fifth verifier's z8 / COMBO-R: a comment left open before a region closes at the region's BEGIN in the browser, so the
	// marker is not a whole comment and the region is not trusted -- removing the region before comments let that comment run on
	// and swallow everything typed after it
	assert.deepEqual(pages(['<!-- left open', other.begin, ...other.lines, other.end, ...typed], [other.begin, ...other.lines, other.end, ...typed]), [...other.lines, ...typed], 'a comment left open before a region swallows its BEGIN, not the lines typed after the region');
	assert.deepEqual(pages(['<!-->', ...typed, '<!-- x -->'], typed), typed, '<!--> ends at once, so it hides nothing after it');
	assert.deepEqual(pages(['<!-- a --!>', ...typed, '<!-- x -->'], typed), typed, 'and --!> closes its comment');
	assert.deepEqual(pages(['<style><!--</style>', ...typed, '<p>--></p>'], typed), typed, '<!-- inside <style> opens no HTML comment');
	assert.deepEqual(pages(['<textarea><!--</textarea>', ...typed, '<p>--></p>'], typed), typed, 'nor inside <textarea>');
	assert.deepEqual(pages(['<svg><![CDATA[ > <!-- ]]></svg>', ...typed, '<p>--></p>'], typed), typed, 'nor inside an SVG CDATA section');
	assert.deepEqual(pages(['<p x=a\'b>1 < 2 "</p>', ...typed.flatMap((l) => [l, '<!-- note -->'])], typed), typed, 'an unquoted quote or a stray < hides no comment between copied lines');
	const sheets = (a, b) => copiedLines([{ name: 'a.css', text: a, regions: [] }, { name: 'b.css', text: b, regions: [] }]).flatMap((x) => x.lines);
	const rules = ['#one { color: red; cursor: pointer; }', '#two { color: blue; cursor: move; }', '#three { color: green; }', '#four { color: black; }', '#five { color: white; }'];
	assert.deepEqual(sheets(['/* <!-- */', ...rules, '/* --> */'].join('\n'), rules.join('\n')), rules, 'an HTML comment\'s opener inside a stylesheet\'s comment hides no rule');
	assert.deepEqual(sheets(['.x { content: "<!--"; }', ...rules, '.y { content: "-->"; }'].join('\n'), rules.join('\n')).filter((l) => rules.includes(l)), rules, 'nor one inside a string');
	assert.deepEqual(sheets(['.x { content: "/*"; }', ...rules, '.y { content: "*/"; }'].join('\n'), rules.join('\n')).filter((l) => rules.includes(l)), rules, 'nor a stylesheet comment\'s own opener inside a string');
	assert.deepEqual(sheets(['/* a comment', 'over two lines */', ...rules].join('\n'), rules.join('\n')), rules, 'control: a real stylesheet comment is still removed');
	assert.deepEqual(pages(['<p title="<!--">', ...typed, '<p title="-->">'], typed), typed, 'an HTML comment\'s opener inside a page\'s attribute hides no element');
	assert.deepEqual(pages(['<p>/*</p>', ...typed, '<p>*/</p>'], typed), typed, 'nor a stylesheet comment\'s opener in a page\'s text');
	assert.deepEqual(pages([typed.join('\r')], typed), typed, 'lines ended by a lone CR are lines');
	assert.deepEqual(sheets(['* { box-sizing: border-box; margin: 0; }', ...rules.slice(0, 4)].join('\n'), ['* { box-sizing: border-box; margin: 0; }', ...rules.slice(0, 4)].join('\n'))[0], '* { box-sizing: border-box; margin: 0; }', 'and a line opening with * is compared like any other');
	assert.deepEqual(sheets(['.u { background: url(/*); }', ...rules, '.v { background: url(*/); }'].join('\n'), rules.join('\n')).filter((l) => rules.includes(l)), rules, 'unquoted url(/*) opens no stylesheet comment');
	assert.deepEqual(sheets(['.u { content: "\\\n/*"; }', ...rules, '.v { content: "*/"; }'].join('\n'), rules.join('\n')).filter((l) => rules.includes(l)), rules, 'nor a string continued over an escaped newline');
	assert.deepEqual(sheets(['.u { content: "/*', ...rules, '.v { content: "*/"; }'].join('\n'), rules.join('\n')).filter((l) => rules.includes(l)), rules, 'a broken string ends at its newline');
	assert.deepEqual(sheets(rules.join('\f'), rules.join('\n')), rules, 'and form feed ends a line in a stylesheet');
});

test('H25.4: the regions the measure trusts are the ones the generators write -- one definition', async () => {
	const { PAGE_REGIONS } = await import('../tools/page-regions.mjs');
	const { markersOf } = await import('../tools/regions.mjs');
	assert.deepEqual(Object.keys(PAGE_REGIONS).sort(), Object.keys(COPIES.generated).sort(), 'a region for each generator the manifest names, and no other');
	for (const [name, r] of Object.entries(PAGE_REGIONS)) assert.deepEqual({ begin: r.begin, end: r.end }, markersOf(name, COPIES.generated[name]), `${name}: its markers are the manifest's`);
	for (const tool of ['tools/stylesheets.mjs', 'tools/canvas-layout.mjs']) assert.match(fs.readFileSync(path.join(import.meta.dirname, '..', tool), 'utf8'), /PAGE_REGIONS\.(stylesheets|canvas)/, `${tool} writes the region from that definition`);
});

test('H25.4: each generator the copy measure trusts is run by the gate with --check, as a step of its own', () => {
	const steps = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8')).scripts.gate.split('&&').map((x) => x.trim());
	const owners = Object.entries(COPIES.generated);
	assert.deepEqual(owners.map(([name]) => name).sort(), ['canvas', 'stylesheets'], 'control: the two regions the pages hold');
	for (const [name, { tool }] of owners) assert.ok(steps.includes(`node ${tool} --check`), `the ${name} region's generator, ${tool}, is a gate step exactly -- nothing after it to excuse a failure`);
});

test('H25.0: a module no production entry reaches -- by an import, a re-export or a literal import() -- is reported', () => {
	const files = { 'e.mjs': "import { x } from './a.mjs';\nexport { y } from './b.mjs';", 'a.mjs': "const m = await import('./c.mjs');", 'b.mjs': '', 'c.mjs': '', 'lone.mjs': "import './a.mjs';" };
	const resolve = (from, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
	assert.deepEqual(modulesNoEntryReaches(['e.mjs'], Object.keys(files), (f) => files[f] ?? null, resolve), ['lone.mjs'], 'only the module nothing reached; it importing others reaches nothing back');
});

test('H25.0: the record may only shrink inside a frozen ceiling -- a new copy refused, a removed one refused until recorded, and a copy swapped for another is two faults, not none', () => {
	const ceiling = { m: ['a', 'b', 'c'] };
	assert.deepEqual(judgeFindings({ m: ['a', 'b'] }, { m: ['a', 'b'] }, ceiling), [], 'control: findings on their record pass');
	assert.match(judgeFindings({ m: ['a', 'b', 'x'] }, { m: ['a', 'b'] }, ceiling)[0], /NEW COPY -- x/);
	assert.match(judgeFindings({ m: ['a'] }, { m: ['a', 'b'] }, ceiling)[0], /removed -- b; lower the record/);
	assert.equal(judgeFindings({ m: ['a', 'x'] }, { m: ['a', 'b'] }, ceiling).length, 2, 'one removed and one added: both seen');
	assert.match(judgeFindings({ m: ['a', 'x'] }, { m: ['a', 'x'] }, ceiling)[0], /the record holds a copy the frozen ceiling never had -- x/, 'a new copy written into the record by hand is refused');
	assert.match(judgeFindings({ m: [] }, {}, ceiling)[0], /measured and not recorded/);
});

test('H25.0: a ruled exception is for a copy that exists; one for a copy that is gone is a fault, and each entry goes to the ruling resolver', () => {
	const { entries, faults } = judgeExceptions({ m: ['a'] }, { m: { a: { cites: ['H25'], trigger: 'permanent' }, gone: { cites: ['H25'], trigger: 'permanent' } } });
	assert.equal(entries.length, 2, 'both exceptions are handed to tools/exceptions.mjs');
	assert.deepEqual(faults, ["COPIES.exceptions['m'] gone: an exception for a copy that is gone -- remove it"]);
});

test('H25.0: the duplicate scanners read every folder scan-layers walks but the tools and the tests -- a new plugin folder is compared without an edit', () => {
	const product = FOLDERS.map((f) => f.dir).filter((d) => d !== 'tools' && d !== 'tests');
	for (const d of ['network', 'devices', 'zones', 'groups', 'layouts', 'product', 'lab', 'cli']) assert.ok(product.includes(d), `control: ${d} is a folder scan-layers walks`);
	assert.deepEqual(SCANNER_ROOTS.twins, product, 'scan-twins compares every product folder (it read six, none a plugin\'s)');
	assert.deepEqual(SCANNER_ROOTS.copies, product, 'scan-copies looks in every product folder');
	// RESTATED at H25.3b (B374) and H25.5 (B378, D5 of H25-1): the three foreign style rules and the REST route list
	assert.deepEqual(Object.fromEntries(Object.entries(COPIES.exceptions).map(([k, v]) => [k, Object.keys(v).sort()])), { 'foreign style rules': ['#container.zonegrid .zone', '.waypoint.spawning .wp-dot', '.waypoint.spawning .wp-ring'], 'modules no entry reaches': ['server/routes.mjs'] }, 'the copies ruled to stand, and no others');
	for (const x of Object.values(COPIES.exceptions).flatMap((m) => Object.values(m))) assert.ok((x.cites.includes('H25-4') || x.cites.includes('H25-1')) && x.trigger.length > 20, 'each cites its ruling and says what reopens it');
});

/*
THE CEILING IS FROZEN: the copies when H25 opened, 2026-10-17. Pinned by its hash, as RATCHET_CEILING is (tests/scan-layers.test.js):
editing it means editing this line too, in a diff a reviewer sees. The record only shrinks inside it.
CORRECTED at H25.1 (B366): the findings were named by the sheet each sat in, so moving a rule between sheets renamed its copy and
read as one copy removed and another added. They are named by the fact copied now (tools/scan-copies.mjs), and the ceiling was
regenerated by that scanner from the tree H25 opened on, be5c9c3 -- the same copies, re-expressed: 120 findings where 128 were,
eight foreign rules having been counted once per sheet for one selector. Was f5c3529b7a5b9a0a2dc4cc6e3b483e858916638c678eddeb6f4e1b45a8c7ff8c.
*/
const CEILING_SHA256 = '08e1f016d59c4d098e59c66dcaab55423a74bde1a583740cfb5627df1c0de881';

test('H25.0: the frozen ceiling is the one H25 opened with, and the record holds nothing outside it', () => {
	assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'tools/copies-ceiling.json'))).digest('hex'), CEILING_SHA256, 'tools/copies-ceiling.json is frozen');
	const ceiling = JSON.parse(read('tools/copies-ceiling.json')), record = JSON.parse(read('tools/copies-record.json'));
	for (const [k, v] of Object.entries(record)) for (const f of v) assert.ok((ceiling[k] ?? []).includes(f), `${k}: ${f} is recorded and the ceiling never had it`);
});

test('H25.0: on this tree the scanner reads every stylesheet the pages load, and every finding is on the record', () => {
	const out = execFileSync('node', ['tools/scan-copies.mjs', '--verbose'], { cwd: root, encoding: 'utf8' });
	// RESTATED at H25.2 (B366): KERNEL_CSS and EXPORT_CSS retired; the canvas's own sheet split from the chrome's
	for (const sheet of ['app/style.css', 'app/canvas.css', 'network/network.css', 'lab/lab.css', 'kernel/primitives.css', 'zones/zones.css']) assert.ok(out.includes(sheet), `the scan reads ${sheet}`);
	assert.match(out, /scan-copies: 1[0-9] stylesheet\(s\)/, 'and no fewer sheets than the pages load');
	for (const [k, v] of Object.entries(JSON.parse(read('tools/copies-record.json')))) assert.match(out, new RegExp(`\\n  ${k}: ${v.length}\\n`), `${k}: ${v.length}, as recorded`);
	assert.match(out, /PASS -- every copy is on the record and none is new/);
});

/*
H25.1 (B366, D1, D2): EACH PLUGIN BRINGS ITS OWN LOOK. The page's stylesheet styled 53 rules' worth of classes only plugins draw;
they moved, word for word, into the plugins' sheets (and a name's label into the core's), which the pages load from the
composition (tools/stylesheets.mjs). Pinned here as well as by the record, because a finding is named by its selector: until H25.2
retires EXPORT_CSS, a `.link` rule put back into the page's sheet would share a name with the export's own.
*/
test('H25.1: the page\'s stylesheet styles no class only a plugin draws, and every sheet the composition names is loaded by both pages', async () => {
	const out = execFileSync('node', ['tools/scan-copies.mjs', '--verbose'], { cwd: root, encoding: 'utf8' });
	const foreign = out.split('\n  foreign style rules: ')[1].split('\n\n')[0].split('\n').slice(1);
	assert.ok(foreign.length > 0, 'control: the scan still reports the foreign rules it finds elsewhere');
	assert.deepEqual(foreign.filter((l) => l.trim().startsWith('app/style.css:')), [], 'none of them is the page\'s');
	const { PAGE_STYLESHEETS, PRODUCT_CANVAS } = await import('../product/canvas.mjs');
	for (const p of PRODUCT_CANVAS.filter((x) => x.painters || x.appearances || x.grids)) assert.ok((p.stylesheets ?? []).length, `${p.owner} brings a stylesheet`);
	for (const page of ['app/index.html', 'lab/index.html']) {
		const hrefs = [...read(page).matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
		assert.deepEqual(hrefs.slice(0, PAGE_STYLESHEETS.length), PAGE_STYLESHEETS.map((f) => (f.startsWith('app/') ? `/${f.slice(4)}` : `/${f}`)), `${page} loads the composition's sheets first, in its order`);
	}
});

test('H25.5: the old scene renderer is gone -- NOT_PARTS is empty, and every recorded copy finding is a ruled exception', () => {
	assert.deepEqual(NOT_PARTS, {}, 'every module in the product belongs to a part');
	const record = JSON.parse(read('tools/copies-record.json'));
	assert.deepEqual(record['modules no entry reaches'], ['server/routes.mjs'], 'only the ruled REST route list remains unreached');
	for (const [k, v] of Object.entries(record)) {
		for (const item of v) assert.ok(COPIES.exceptions[k]?.[item], `${k}: ${item} is on the record and not a ruled exception`);
	}
});
