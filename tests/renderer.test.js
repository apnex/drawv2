/*
B121 -- the client renderer, under test at last.

Nothing in the suite could construct a Renderer, so every rule `app/src/renderer.js` owns was
verified by eye or not at all. That is also why the W4 socket rule diverged: the kernel expresses
the same visual rules and IS tested, so only one of the two was ever held to it -- B107's shape in
a different substrate, a tested implementation standing in for the one that runs.
*/
import { test } from 'node:test';
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
