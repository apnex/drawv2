/*
H25.2 (B366; dev/DECISIONS.md H25-2) -- THE PAGE'S RULES, APPLIED TO WHAT THE EXPORT DRAWS (server/svg-style.mjs).

The export writes, as each element's attributes, what the page's own stylesheets give that element, and carries no stylesheet: so it
asks no CSS of a renderer, restyles nothing it is pasted into, and states no look of its own. A small cascade does it, and each
case below holds one part of a browser's behaviour that it must reproduce -- the adjacent-sibling step among them, whose first
reading attached each step to the wrong side and turned a down link's head blue until this caught it -- and each refusal it must
make rather than ship a picture wrong. The parity test (tests/browser.test.js H24.8) and the probe hold its result to Chrome's.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesOfSheets, drawingRules, styleMarkup, nodeContext, drawnOf } from '../server/svg-style.mjs';

const sheet = (css) => rulesOfSheets([{ name: 'test.css', css }]);
const style = (markup, css, inherited) => styleMarkup(markup, sheet(css), inherited);

test('H25.2: a rule\'s drawn properties are written onto what it matches -- by class, id, tag, attribute, a descendant step and an adjacent one', () => {
	const css = ':root { --tok-a: #111; } .x { fill: var(--tok-a); } #i { stroke: red; } text { font-size: 9px; } [data-d] { opacity: 0.5; } .p .c { fill: blue; } .a + .b { stroke: green; }';
	const out = style('<g class="p"><rect class="x"/><rect id="i"/><text>t</text><path data-d=""/><circle class="c"/><path class="a"/><path class="b"/><path class="b"/></g>', css);
	assert.match(out, /<rect class="x" fill="#111"\/>/, 'a class, its colour token written in');
	assert.match(out, /<rect id="i" stroke="red"\/>/, 'an id');
	assert.match(out, /<text font-size="9px">t<\/text>/, 'a tag');
	assert.match(out, /<path data-d="" opacity="0.5"\/>/, 'an attribute');
	assert.match(out, /<circle class="c" fill="blue"\/>/, 'a descendant step');
	assert.match(out, /<path class="a"\/><path class="b" stroke="green"\/><path class="b"\/>/, 'an adjacent step: the b straight after an a, and not the b after that');
	const plain = '<g class="w"></g><g/><text x="a&lt;b&gt;&amp;&quot;c, and &amp;lt; typed as text">1 &lt; 2 &amp;&gt;</text>';
	assert.equal(style(plain, '.zz { fill: red; }'), plain, 'and what no rule matches is written back exactly -- each element in the form it came in, each escape once');
});

test('H25.2: the cascade is a browser\'s -- specificity, then order; an element\'s inline style beats any rule; a hover never applies', () => {
	const out = style('<rect class="x y" style="stroke-width:4"/><rect class="x"/>', '.x.y { fill: red; } .x { fill: blue; stroke-width: 1; } .x:hover { fill: green; } .x { stroke: black; } .x { stroke: white; }');
	assert.match(out, /<rect class="x y" style="stroke-width:4" fill="red" stroke="white"\/>/, 'the more specific rule wins whatever its order; the later of two equal ones wins; the inline width stands');
	assert.match(out, /<rect class="x" fill="blue" stroke-width="1" stroke="white"\/>/, 'control: the plain one, and no hover colour');
});

test('H25.2: custom properties are inherited down the tree, and var() resolves through them or falls back', () => {
	const css = '.n { --f: #222; } .z { --w: 2; } .k { fill: var(--f, #999); stroke-width: var(--w, 1); stroke: var(--none, var(--f, #999)); }';
	const out = style('<g class="n"><g><rect class="k"/></g></g><rect class="k"/>', css);
	assert.match(out, /<g class="n"><g><rect class="k" fill="#222" stroke-width="1" stroke="#222"\/><\/g><\/g>/, 'from an ancestor two steps up; a nested fallback through it');
	assert.match(out, /<\/g><rect class="k" fill="#999" stroke-width="1" stroke="#999"\/>/, 'outside it, the fallbacks');
	assert.match(style('<rect class="k"/>', '.k { fill: var(--f); }', { '--f': '#333' }), /fill="#333"/, 'a scope handed in, as the glyph art is drawn in a device\'s');
	assert.throws(() => style('<rect class="k"/>', '.k { fill: var(--f); }'), /var\(--f\) has no value and no fallback/, 'and a value with neither is refused');
	assert.match(style('<rect class="k"/>', ':root { --tok-a: #444; } .k { fill: var(--tok-a, #999); }'), /fill="#444"/, 'a colour token is defined wherever the page loads it, so its fallback never draws');
	assert.match(style('<g class="n"><rect class="k" style="--f: #555"/></g>', '.n { --f: #222; } .k { --f: #666; fill: var(--f); }'), /<rect class="k" style="--f: #555" fill="#555"\/>/, 'an element\'s own custom property beats a rule\'s and an ancestor\'s');
});

test('H25.2: what acts only on a pointer or over time is left out; what draws and cannot be written is refused; so is syntax this cannot match', () => {
	assert.equal(style('<rect class="k"/>', '.k { cursor: move; pointer-events: none; user-select: none; transition: opacity 1s; fill: red; }'), '<rect class="k" fill="red"/>');
	assert.throws(() => style('<rect class="k"/>', '.k { filter: blur(2px); }'), /a rule sets filter on <rect class="k">, which the export can neither draw nor knowingly leave out/);
	assert.throws(() => sheet('.a > .b { fill: red; }'), /does not match the step ">"/);
	assert.throws(() => sheet('.a:not(.b) { fill: red; }'), /cannot match the selector/);
	assert.throws(() => sheet('.a:first-child { fill: red; }'), /cannot match the pseudo-class ":first-child"/, 'a pseudo-class a still picture could be in');
	assert.doesNotThrow(() => sheet('.a:hover, .a:focus-visible { fill: red; }'), 'control: those of the pointer and focus are read, and never match');
	assert.throws(() => sheet('.a { fill: red !important; }'), /!important, which the export does not weigh/);
	assert.throws(() => sheet('.a { transform: rotate(45deg); }'), /a transform with CSS units/);
	assert.doesNotThrow(() => sheet('.a { transform: scale(0.3); }'), 'control: the unitless transform the page\'s sheets hold');
	assert.throws(() => sheet(':root { --gap: 4px; }'), /:root sets --gap, which is not a colour token/);
	for (const bad of ['<rect a=\'x\'/>', '<![CDATA[x]]>', '<?xml version="1.0"?><g/>', '<rect hidden/>']) assert.throws(() => style(bad, '.a { fill: red; }'), /markup reader cannot read/, bad);
	assert.equal(style('<text x="&#39;&#x3c;">a</text>', '.zz { fill: red; }'), '<text x="\'&lt;">a</text>', 'a numeric reference is read as its character, then written as the export writes it');
	assert.throws(() => rulesOfSheets([{ name: 'm.css', css: '@media print { .a { fill: red; } }' }]), /m\.css holds an at-rule/);
	assert.throws(() => sheet('.a { fill: var(--tok-missing); }'), /names --tok-missing, which no colour registry/);
});

test('H25.2: on the page\'s own sheets -- a down link\'s head and leg take the down colour, a name the label colour, a frame and the glyph art a device\'s colours, the ground the canvas\'s', async () => {
	const rules = drawingRules();
	const { NETWORK_TOKENS, downStroke } = await import('../network/appearance.mjs');
	const { TOKENS } = await import('../kernel/theme.mjs');
	const links = styleMarkup('<g><path class="link" data-down=""/><path class="link-head"/><path class="link-leg"/><path class="link"/><path class="link-head"/></g>', rules);
	assert.match(links, new RegExp(`<path class="link" data-down="" stroke="${downStroke()}"/><path class="link-head" fill="none" stroke="${downStroke()}"/><path class="link-leg" fill="none" stroke="${downStroke()}"/>`), 'down: the line, its head, its leg');
	assert.match(links, new RegExp(`<path class="link" stroke="${NETWORK_TOKENS.link}"/><path class="link-head" fill="none" stroke="${NETWORK_TOKENS.link}"/></g>`), 'control: an up link\'s, in the link colour');
	assert.match(styleMarkup('<text class="label">n</text>', rules), new RegExp(`fill="${TOKENS.label}"`), 'a name');
	const scope = nodeContext(rules);
	assert.deepEqual(Object.keys(scope).sort(), ['--fill', '--icon', '--outer'], 'a device\'s group gives its colours');
	assert.match(styleMarkup('<rect class="frame"/><g class="solid"/>', rules, scope), new RegExp(`<rect class="frame" fill="${TOKENS.panel}" fill-opacity="1" stroke="${scope['--outer']}"/><g class="solid" fill="${scope['--icon']}" stroke="${scope['--icon']}" stroke-width="0.2"/>`));
	assert.deepEqual(drawnOf('rect', { id: 'canvas' }, rules), { fill: TOKENS.panel }, 'the ground, as the canvas is drawn');
	assert.doesNotMatch(styleMarkup('<rect class="clickable"/><path class="link"/>', rules), /pointer-events|cursor/, 'and nothing of the page\'s pointer rules');
});

/*
The rules are applied to the file as it is written, not to the tree the painters drew: the file flattens the layers and gives a
line's id to its group, so a rule keyed to what the painted tree holds and the file does not would style the file where a browser
reading it with the page's sheets never could. The first option-A build styled the painted tree, and the probe found a spawning
endpoint's ring turned green in two of the director's diagrams -- which showed that the file had never drawn a spawner as the page
does, since it wrote a waypoint's circles bare of the classes the page's rule names (B370).
CORRECTED at H25.2b (B370; dev/DECISIONS.md H25-3): the file keeps a waypoint's circles' classes, so the page's own spawning rule
draws the ring and the dot green, 3 wide, as on the page. tests/browser.test.js H24.8 compares the two in the browser, the parity
board now holding a spawner.
*/
test('H25.2b: the rules meet the file as written, and the file writes what they need -- a spawning endpoint drawn as the page draws it', async () => {
	const { svgDocument } = await import('../server/svg.mjs');
	const { parityBoard } = await import('../tools/probe/boards.mjs');
	const board = parityBoard();
	board.nodes.find((n) => n.id === 'node-fa00a2').name = 'b<r>&"v';
	const out = svgDocument(board);
	const wp = out.match(/<g id="node-fa00b2"><g class="waypoint[^"]*\bspawning\b[^"]*">(.*?)<\/g><\/g>/);
	assert.ok(wp, 'control: the board\'s spawner is written as a spawning waypoint, its circles inside');
	const rule = (text) => Object.fromEntries(drawingRules().find((r) => r.text === text).decls);
	const ring = rule('.waypoint.spawning .wp-ring'), dot = rule('.waypoint.spawning .wp-dot');
	const attrs = (cls) => Object.fromEntries([...(wp[1].match(new RegExp(`<circle [^>]*class="${cls}"[^>]*>`)) ?? [''])[0].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
	const r = attrs('wp-ring'), d = attrs('wp-dot');
	assert.deepEqual([r.stroke, r['stroke-width'], r['stroke-opacity']], [ring.stroke, ring['stroke-width'], ring['stroke-opacity']], 'the ring in the page\'s spawning colour and width');
	assert.equal(d.fill, dot.fill, 'the dot likewise');
	const { NETWORK_TOKENS } = await import('../network/appearance.mjs');
	for (const id of ['node-fa00b1', 'node-fa00b3']) {
		const plain = out.match(new RegExp(`<g id="${id}"><g class="waypoint[^"]*">(.*?)</g></g>`));
		assert.ok(plain && !/spawning/.test(plain[0]), `control: ${id} -- the junction, and the plain endpoint -- spawns nothing`);
		const strokes = [...plain[1].matchAll(/ stroke="([^"]*)"/g)].map((m) => m[1]);
		assert.ok(strokes.length > 0 && strokes.every((s) => s === NETWORK_TOKENS.waypoint), `and ${id} is drawn in the waypoint colour, not the spawning one: ${strokes}`);
	}
	assert.ok(out.includes('>b&lt;r&gt;&amp;&quot;v</text>'), 'and a name the file escapes is read back and written once escaped, not twice');
	assert.doesNotMatch(out, /&amp;(gt|lt|amp|quot);/, 'nothing escaped twice');
});
