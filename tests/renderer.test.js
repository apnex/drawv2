/*
B121 -- the client renderer, under test at last.

Nothing in the suite could construct a Renderer, so every rule `app/src/renderer.js` owns was
verified by eye or not at all. That is also why the W4 socket rule diverged: the kernel expresses
the same visual rules and IS tested, so only one of the two was ever held to it -- B107's shape in
a different substrate, a tested implementation standing in for the one that runs.
*/
import { test } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { Renderer } from '../app/src/renderer.js';
import { renderElement, resolve, STD, L_STD } from '../kernel/index.mjs';
import { makeRenderer, classesIn } from './fixtures/client-harness.mjs';

const withRenderer = (fn) => {
	const { svg, restore } = makeRenderer();
	try { fn({ svg, model: new Model(), Renderer, make: (m) => new Renderer(m, svg) }); } finally { restore(); }
};

test('W4: a plain node shows its socket in edit mode and not in view', () => {
	withRenderer(({ svg, model, make }) => {
		const r = make(model);
		model.put('node', { id: 'node-aa0001', name: 'n', type: 'host', shape: 'circle', x: 0, y: 0 });
		const sockets = () => classesIn(svg).filter((c) => c === 'socket').length;

		assert.equal(r.mode, 'view');
		assert.equal(sockets(), 0, 'view is clean');
		r.setMode('edit');
		assert.equal(sockets(), 1, 'edit shows it');
		r.setMode('view');
		assert.equal(sockets(), 0, 'and hides it again');
	});
});

test('W4: switching mode re-renders PLAIN nodes, not only panels', () => {
	/*
	setMode re-rendered only nodes carrying content, which was enough while a plain socket was
	unconditional. Gating it without widening that would leave the change invisible until some
	unrelated edit happened to re-render the node.
	*/
	withRenderer(({ svg, model, make }) => {
		const r = make(model);
		model.put('node', { id: 'node-aa0001', name: 'n', type: 'host', shape: 'circle', x: 0, y: 0 });
		r.setMode('edit');
		assert.equal(classesIn(svg).filter((c) => c === 'socket').length, 1,
			'the mode switch alone re-rendered a plain node');
	});
});

/*
B121 -- PARITY. The two renderers must agree on which elements a node has.

They emit differently on purpose: the kernel builds strings for headless export, the client
reconciles DOM incrementally so a drag does not rebuild the scene. Extracting isPanel, frameRadius
and showsSockets removed the restated RULES, and this holds the result -- the shared element set,
for the same entity, in the same mode.

Only the classes both renderers own are compared. The client also draws labels, hulls and handles,
which are editor furniture the export has no business carrying.

`select-box` is excluded, and the first run of this test is why. The client emits it ALWAYS and
toggles visibility by class, because pre-creating it makes selection a class flip rather than a DOM
build; the kernel emits it only when the element is selected, because a static export has nothing
to toggle. That is a difference in emission strategy rather than in the rule, and the distinction is
worth having been forced to make: a parity gate that demanded sameness here would be asserting that
the incremental renderer stop being incremental.
*/
const SHARED = ['frame', 'socket'];

test('B121: client and kernel agree on a plain node, in both modes', () => {
	for (const editing of [false, true]) {
		const el = resolve({ entities: [{ id: 'node-000001', kind: 'node', cell: [0, 0], glyph: 'host' }] }).scene[0];
		const fromKernel = renderElement(el, STD, L_STD, { sockets: editing });
		const kernelSet = SHARED.filter((c) => new RegExp(`class="${c}"`).test(fromKernel));

		let clientSet;
		withRenderer(({ svg, model, make }) => {
			const r = make(model);
			if (editing) r.setMode('edit');
			model.put('node', { id: 'node-000001', name: 'n', type: 'host', shape: 'circle', x: 0, y: 0 });
			const seen = new Set(classesIn(svg));
			clientSet = SHARED.filter((c) => seen.has(c));
		});
		assert.deepEqual(clientSet, kernelSet, `mode=${editing ? 'edit' : 'view'}: the two renderers disagree`);
	}
});

test('B121: client and kernel agree on a content panel too', () => {
	const content = [{ at: [0, 0], content: 'text', value: 'hi' }];
	for (const editing of [false, true]) {
		const el = resolve({ entities: [{ id: 'node-000002', kind: 'node', cell: [0, 0], content }] }).scene[0];
		const kernelSet = SHARED.filter((c) => new RegExp(`class="${c}"`).test(renderElement(el, STD, L_STD, { sockets: editing })));

		let clientSet;
		withRenderer(({ svg, model, make }) => {
			const r = make(model);
			if (editing) r.setMode('edit');
			model.put('node', { id: 'node-000002', name: 'p', type: 'host', shape: 'square', x: 0, y: 0, content });
			const seen = new Set(classesIn(svg));
			clientSet = SHARED.filter((c) => seen.has(c));
		});
		assert.deepEqual(clientSet, kernelSet, `panel, mode=${editing ? 'edit' : 'view'}: the two renderers disagree`);
	}
});

/*
Tab shows or hides names, and they start visible.

It used to toggle a numeric overlay of every coordinate. That was deleted rather than rebound --
never properly useful, and keeping it to avoid saying so is how a tool accumulates.

Hidden by CSS class rather than by re-rendering: the toggle stays instant on a large diagram, and
an exported SVG is unaffected, because a diagram nobody can read is not a diagram.
*/
test('Tab: labels are visible by default, and toggle off and on', () => {
	withRenderer(({ svg, model, make }) => {
		const r = make(model);
		model.put('node', { id: 'node-aa0001', name: 'web-1', type: 'host', shape: 'circle', x: 0, y: 0 });

		assert.equal(r.labels, true, 'a fresh session shows names');
		assert.equal(svg.classList.contains('labels-off'), false);
		assert.ok(classesIn(svg).includes('label'), 'and the label element is there to begin with');

		assert.equal(r.toggleLabels(), false);
		assert.equal(svg.classList.contains('labels-off'), true, 'hidden by class');
		assert.ok(classesIn(svg).includes('label'),
			'the element STAYS -- hiding is a class, so the toggle costs no re-render and the export is unaffected');

		assert.equal(r.toggleLabels(), true);
		assert.equal(svg.classList.contains('labels-off'), false);
	});
});

test('Tab: hiding names does not disturb the shared element set', () => {
	// the parity gate compares frame and socket; a label toggle must not move either
	withRenderer(({ svg, model, make }) => {
		const r = make(model);
		model.put('node', { id: 'node-aa0001', name: 'web-1', type: 'host', shape: 'circle', x: 0, y: 0 });
		const before = classesIn(svg).filter((c) => c === 'frame' || c === 'socket').sort();
		r.toggleLabels();
		assert.deepEqual(classesIn(svg).filter((c) => c === 'frame' || c === 'socket').sort(), before);
	});
});

/*
B205 -- a palette tile and a canvas node draw the same glyph at the same size.

The tile hand-built two layers: `<use href="#m-circle">` for the frame, which matched, and a bare
`<use href="#glyph-*">` for the art, which did not. A bare use falls back to `.icon`'s constant
`scale(0.3)`, while a canvas node nests the glyph in an `<svg>` FITTED to its own bounding box.

Every tile was undersized, each by a different amount -- 0.300 against fits ranging 0.867 to 1.171 --
so the relative sizes were wrong too: on canvas a host glyph is a third larger than a router and in
the palette they were identical. The director found it by eye, as "the menu nodes are not the same
literal nodes", after a geometry change moved one side and not the other.

Asserted as AGREEMENT rather than against literals. Checking the palette emits viewBox "-15 -15 30
30" would pin today's numbers and pass for as long as nobody changed them, which is the failure
mode that produced the drift. What must hold is that both sides read the same source.
*/
test('B205: the palette fits each glyph exactly as the kernel does', async () => {
	const { GLYPH_BB, STD } = await import('../kernel/index.mjs');
	const src = fs.readFileSync(new URL('../app/src/palette.js', import.meta.url), 'utf8');

	assert.match(src, /GLYPH_BB\[type\]/, 'the palette must fit the glyph to ITS OWN bounding box');
	assert.match(src, /STD\.socket/, 'and into the socket-sized box a canvas node uses');
	assert.doesNotMatch(src, /href.{0,4}, `#glyph-\$\{type\}`\);\s*\n\s*item\.appendChild\(use\)/,
		'a bare <use> appended straight to the tile is the drift -- it takes .icon scale(0.3)');

	/*
	The numbers the tile builds from must be the numbers the kernel renders with. Compared per
	glyph, because the whole point is that the fit is NOT a constant -- a single shared scale is
	what the palette had.
	*/
	for (const type of ['router', 'host', 'server', 'loadbalancer', 'firewall', 'vxlan']) {
		const el = resolve({ entities: [{ id: 'node-000001', kind: 'node', cell: [0, 0], glyph: type }] }).scene[0];
		const kernel = renderElement(el, STD, L_STD);
		const [bx, by, bw, bh] = GLYPH_BB[type] || GLYPH_BB.host;

		assert.match(kernel, new RegExp(`viewBox="${bx} ${by} ${bw} ${bh}"`),
			`${type}: the kernel does not fit this glyph to the box the palette will read`);
		assert.match(kernel, new RegExp(`width="${STD.socket}" height="${STD.socket}"`),
			`${type}: the kernel glyph box is not STD.socket`);
	}
});

/*
B218: deleting a link re-derives the waypoints it touched.

A waypoint's role is DERIVED from the links at it, and the delete branch only dropped the link's own
DOM node. So an endpoint kept drawing its pad after the link that made it one was gone -- the
document was correct and the canvas was a frame behind it, which is the divergence that is hardest
to notice because nothing is broken on reload.

Asserted on the DOM rather than on the source, because counting call sites proves the wiring exists
and not that the ring actually clears. The delete branch has to refresh from the DELETED entity:
once the link is out of the model, nothing else records which waypoints it touched.
*/
test('B218: an endpoint falls back to a plain anchor when its link is deleted', () => {
	withRenderer(({ svg, model, make }) => {
		make(model);
		model.put('node', { id: 'node-aa0001', name: 'a', type: 'host', shape: 'circle', x: -120, y: 0 });
		model.put('waypoint', { id: 'waypoint-aa0001', name: 'w', x: 0, y: 0 });
		model.put('link', { id: 'link-aa0001', name: 'l', src: 'node-aa0001', dst: 'waypoint-aa0001' });

		const wp = () => svg.ownerDocument.getElementById('waypoint-aa0001');
		const ringCount = () => wp().querySelectorAll('.wp-ring').length;

		assert.equal(ringCount(), 1, 'precondition: a link terminates here, so it draws the endpoint pad');
		assert.match(wp().getAttribute('class'), /endpoint/, 'and is classed as one');

		model.del('link', 'link-aa0001');

		assert.ok(wp(), 'the waypoint itself survives -- deleting a link never deletes what it terminated at');
		assert.equal(ringCount(), 0, 'the pad is gone: with no links there is no sub-type to draw');
		assert.equal(wp().querySelectorAll('.wp-anchor').length, 1, 'a plain anchor remains');
		assert.equal(wp().querySelectorAll('.wp-dot').length, 1, 'with its grid dot');
		assert.doesNotMatch(wp().getAttribute('class'), /endpoint|junction/, 'and no sub-type class');
	});
});
