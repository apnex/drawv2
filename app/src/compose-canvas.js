/*
composeCanvas -- the canvas half of a page, composed once. H17 cut K8.

The product page (app/src/main.js) and the lab (lab/src/root.js) each built the same canvas by hand, line for line: the
kernel's defs, both grids, the model and its relation index, the commit boundary, the renderer, the selection and its
reflection, the label editor, the one crosshair, the gesture machine and its event capture. Two copies of a composition
drift exactly where a rule hides in the wiring -- the crosshair's single owner (B36), the index registered before every
other subscriber (R3) -- so this is the one place they are decided, and each root adds only what is its own: the product
its sync, palette, clock, movers and reveal; the lab its network session, its authority model and its notice.

Canvas layer: it imports nothing of the page around it. The two parts that ARE the page's come in from the root -- the
readout's element; the held tools, run mode's rows and the
plugins as values.

ORDER IS BEHAVIOUR, so it is not hidden. Input's key handling runs after any listener a root registers first, and the
palette's Escape -- cancel a sidebar drag, and spend the key so the held hand stays -- depends on registering first. So
this does not start capturing: it returns `listen()`, and a root calls it once its own listeners are in place
(tests/browser.test.js "K8: Escape during a sidebar drag").

H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1, D9) -- THE SCENE IS OPENED HERE, from the declaration the root hands in
(product/canvas.mjs CANVAS_SCENE), on the page's root through the renderer's `openCanvasScene`: the scene appends the layers after the
root's ground, and is handed on as a value -- to the grids, the renderer, the one crosshair, the held tools, Input and capture's
adapter -- and returned, for what the root draws itself into the foreign layers and its palette. H26.8's painters move
(dev/design/components/NATIVE-SHAPES.md sections 3.2 and 3.3): the renderer describes each entity and puts it by part, so the page's
measure and settle it was handed for the live shadow (D12) went with it; the editing states are made here (app/src/editing-states.js)
and handed to the renderer, Input, the overlay and the network's settle, the selection reflected into them.
*/
import { sharedDefs } from '../../kernel/renderer.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';
import { crosshair } from './editing-visuals.js';   // H26.4: the editing part's, an item of the scene
import { CANVAS } from './snap.js';
import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { Changes, applyAnswer } from './changes.js';
import { plan } from '../../planner/txn.mjs';   // the preview: the page plans its own view with the server's planner (V-d, PL-6)
import { Renderer, openCanvasScene } from './renderer.js';
import { Selection } from './selection.js';
import { EditingStates } from './editing-states.js';   // H26.8: the editing part's states (NS13)
import { LabelEditor } from './labeledit.js';
import { Tools } from './tools.js';
import { Input } from './input.js';
import { captureCanvas } from './capture.js';
import { picksOf, regionsOf } from './pick.js';
import { Readout } from './readout.js';
import { Grids } from './grids.js';   // WD-b2: the grids, from the open diagram's records

/*
  svg        the page's canvas element
  scene      the canvas's scene, declared by the composition (product/canvas.mjs CANVAS_SCENE), opened here on `svg`
  defs       the element the kernel's glyph and frame defs go into (#kdefs) -- handed in, as every element is (B45)
  host       where events arrive and host events go -- the page's `window`, handed in: the canvas reads no host (L11)
  network    the network plugin's object, handed to the Model (the lab); none in production
  readoutEl  the element the readout line writes into, or none -- the readout reads the canvas's own state, so it is built
             here (it was handed in as a chrome factory until the lab's import of it was the last layer-debt edge)
  tools      true to hold the stamp hand and text tool (the product); the lab holds none
  help, now, plugins, runRules   handed to Input as they are
Returns every part, the opened scene among them, and `listen()`, which starts event capture and answers its `{ close }`
(app/src/capture.js `captureCanvas`, H26.3).
*/
export function composeCanvas({ svg, scene: declared, defs, host, network = null, kinds = undefined, parts = [], readoutEl = null, tools = false, help = null, now, plugins = [], runRules = [] }) {
	// the kernel's glyph and frame defs: the kernel owns the look
	defs.innerHTML = sharedDefs(undefined, undefined, parts.map((p) => p.defs).filter(Boolean).join('\n'));
	// H26.4: the canvas's scene, its layers appended after the root's ground -- opened, or refused naming each problem
	const scene = openCanvasScene(declared, svg);

	const model = new Model({ attached: { network }, kinds });   // the kinds a composition brings -- the core's when none are passed, so no links (S-e) (H17.22 N-a)
	// R3: the maintained reverse indices, registered before any other subscriber so they see a fresh index; the node grid's
	// `nearest` is injected here, at a composition root, so engine/ imports no kernel (H26.1: it was `cellOf`)
	attachRelations(model, { nearest: NODE_GRID.nearest });
	// WD-b2 (H19.46): each grid a part declares, drawn from the open diagram and again on every load -- the layouts plugin's two
	new Grids({ scene, parts, model });
	const selection = new Selection(model);
	/*
	the commit boundary: a root's transport subscribes to it, not to the model. V-d (H18.28; PL-6): it previews each commit
	with the planner composed as the page is -- the network's link tenant and the page's kinds -- so the tab shows the whole
	answer at once, and applies it carrying a selection across a join (B288)
	*/
	const preview = kinds ? (m, ops) => plan(m, ops, { kinds }) : null;
	const history = new Changes(model, { preview, apply: (ops) => applyAnswer(model, selection, ops) });
	/*
	H26.8 (NATIVE-SHAPES.md section 3.2, NS13): the editing states, held in one place -- the selection's look and its reflections, the
	overlay's hover and arming, a link end's drag state -- and handed to the renderer, which shows each while it is held, to Input and
	its overlay, and to the network's settle (through the renderer it is attached to)
	*/
	const states = new EditingStates({ model, parts });
	const renderer = new Renderer(model, svg, { parts, scene, states, foreign: foreignStates(scene) });   // C-a: the plugins' canvas parts, their painters among them
	selection.subscribe(() => states.reflect(selection.list()));   // the selected look and what it lights, held for what is selected
	// C-e: where each kind's label sits -- the first part that says so
	const labels = new LabelEditor({ svg, scene, model, history, labelAt: (e) => parts.map((p) => p.labels?.labelAt?.(e)).find((x) => x) ?? null,
		wordOf: (kind, e) => parts.map((p) => p.labels?.wordOf?.(kind, e)).find((x) => x) ?? null,   // C-e: and what a Tab run groups by
		contentOf: (e, idx) => parts.map((p) => p.labels?.content).filter(Boolean).find((c) => c.valueOf(e, idx) != null) ?? null });   // and a panel's regions
	const shownReadout = readoutEl ? new Readout({ model, selection, elements: [readoutEl], parts }) : null;   // C-e: each kind's words, from its part
	// B36 -- one crosshair on #snaplayer, owned here and shared by everything that draws it: Overlay inside Input, and the
	// held tools' ghost. Two owners of one layer drew two crosshairs. H26.4: one item of the scene's snap layer
	const snap = crosshair(scene, CANVAS, NODE_GRID.declaration.pitch);   // H26.1: a box a pitch wide, the node grid's
	const heldTools = tools ? new Tools({ svg, scene, snap, preview: parts.find((p) => p.hand)?.hand.preview ?? null }) : null;   // C-e: the ghost draws the hand's preview
	const input = new Input({ svg, scene, model, history, selection, renderer, states, labels, readout: shownReadout, tools: heldTools,
		host, help, now, snap, plugins, runRules, parts });   // C-c, C-d: the canvas parts -- places, press rows, handles
	let capture = null;
	// the platform's events, as input events (dev/design/input/GESTURE-SYSTEM.md, L0), through input-capture (H26.3) -- once the root's own listeners are in
	const listen = () => (capture ??= captureCanvas({ svg, scene, host, sink: input, picks: picksOf(parts), regions: regionsOf(parts) }));   // C-b: the plugins' picks; C-f: run mode's regions
	return { scene, model, history, renderer, states, selection, labels, readout: shownReadout, snap, tools: heldTools, input, listen };
}

/*
H26.4 (F1; dev/design/components/VECTOR-SCENE.md section 5.1, D5, D7) -- THE STATES OF AN ID THE RENDERER DID NOT DRAW. The network draws
each pipe's line in its foreign layer under the pipe's own id, so the canvas's selection, hover and arming reach it (plugins/network/host.mjs
`paint`): today's renderer found it by the page's getElementById. The renderer now holds what it drew alone, and hands any other id's state
here, which marks the element bearing that id beneath the scene's foreign layers -- the first, in the layers' order, as the page's
document found it -- whose content the plugins draw and the scene never writes. Nothing beneath a scene layer is written here (VS4).
*/
export function foreignStates(scene) {
	const layers = scene.layers.filter((l) => l.foreign).map((l) => scene.layerElement(l.name));
	const find = (id) => {
		for (const layer of layers) {
			const found = layer.querySelector(`[id="${id}"]`);
			if (found?.getAttribute?.('id') === id) return found;   // the element bearing the id -- never a stand-in a layer offers
		}
		return null;
	};
	// each ask, a set or a clear, as the renderer hands it (since H26.8's painters move a clear arrives as a set to off, one per class)
	return {
		setState(id, cls, on) { find(id)?.classList.toggle(cls, on); },
	};
}

// C-f (H19.34): the header's counts, each part's (`tally`: a rank, a word, a count) -- devices, links, zones, as the page has always said
export function tallyOf(parts, model) {
	return parts.filter((p) => p.tally).map((p) => p.tally).sort((a, b) => a.rank - b.rank).map((t) => `${t.of(model)} ${t.word}`).join(' / ');
}
