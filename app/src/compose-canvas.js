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
*/
import { sharedDefs } from '../../kernel/renderer.mjs';
import { cellOf, gridDot } from '../../kernel/geometry.mjs';
import { el, crosshair } from './painter.js';
import { nodePoints, zonePoints, CANVAS, GAP, placesOf } from './snap.js';
import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { Changes, applyAnswer } from './changes.js';
import { plan } from '../../planner/txn.mjs';   // the preview: the page plans its own view with the server's planner (V-d, PL-6)
import { Renderer } from './renderer.js';
import { Selection } from './selection.js';
import { LabelEditor } from './labeledit.js';
import { Tools } from './tools.js';
import { Input } from './input.js';
import { Capture } from './capture.js';
import { picksOf } from './pick.js';
import { Readout } from './readout.js';

/*
B200 -- THE NODE GRID'S DOT IS THE DOT A WAYPOINT HIGHLIGHTS. The kernel owns it as `gridDot` and the waypoint renderer
draws its own circle at the same radius in a brighter fill, one layer up, so a waypoint READS as the grid point lit up
while in fact occluding it. Two circles, deliberately: a waypoint restyling a grid element would couple the two layers,
and the radius is the only part that has to agree.

The zone grid keeps its own size: it marks the HALF-OFFSET grid, a different lattice, and reads as bigger on purpose
because it only appears while Shift is held.
*/
const ZONE_GRID_DOT = 5;

/*
  svg        the page's canvas element
  defs       the element the kernel's glyph and frame defs go into (#kdefs) -- handed in, as every element is (B45)
  host       where events arrive and host events go -- the page's `window`, handed in: the canvas reads no host (L11)
  network    the network plugin's object, handed to the Model (the lab); none in production
  readoutEl  the element the readout line writes into, or none -- the readout reads the canvas's own state, so it is built
             here (it was handed in as a chrome factory until the lab's import of it was the last layer-debt edge)
  tools      true to hold the stamp hand and text tool (the product); the lab holds none
  help, now, plugins, runRules   handed to Input as they are
Returns every part, and `listen()`, which starts event capture and answers the Capture.
*/
export function composeCanvas({ svg, defs, host, network = null, kinds = undefined, parts = [], readoutEl = null, tools = false, help = null, now, plugins = [], runRules = [] }) {
	// the kernel's glyph and frame defs: the kernel owns the look
	defs.innerHTML = sharedDefs();
	nodePoints().forEach((p) => el('circle', { cx: p.x, cy: p.y, r: gridDot().radius }, svg.querySelector('#grid-nodes')));
	zonePoints().forEach((p) => el('circle', { cx: p.x, cy: p.y, r: ZONE_GRID_DOT }, svg.querySelector('#grid-zones')));

	const model = new Model({ attached: { network }, kinds });   // the kinds a composition brings -- the core's when none are passed, so no links (S-e) (H17.22 N-a)
	// R3: the maintained reverse indices, registered before any other subscriber so they see a fresh index; `cellOf` is
	// injected here, at a composition root, so engine/ imports no kernel
	attachRelations(model, { cellOf });
	const selection = new Selection(model);
	/*
	the commit boundary: a root's transport subscribes to it, not to the model. V-d (H18.28; PL-6): it previews each commit
	with the planner composed as the page is -- the network's link tenant and the page's kinds -- so the tab shows the whole
	answer at once, and applies it carrying a selection across a join (B288)
	*/
	const preview = network && kinds ? (m, ops) => plan(m, ops, { links: network.links, kinds }) : null;
	const history = new Changes(model, { preview, apply: (ops) => applyAnswer(model, selection, ops) });
	const renderer = new Renderer(model, svg, { parts });   // C-a: the plugins' canvas parts, their painters among them
	selection.subscribe(() => renderer.reflectSelection(selection.list()));   // the renderer owns the selected look
	const labels = new LabelEditor({ svg, model, history });
	const shownReadout = readoutEl ? new Readout({ model, selection, elements: [readoutEl] }) : null;
	// B36 -- one crosshair on #snaplayer, owned here and shared by everything that draws it: Overlay inside Input, and the
	// held tools' ghost. Two owners of one layer drew two crosshairs.
	const snap = crosshair(svg.querySelector('#snaplayer'), CANVAS, GAP);
	const heldTools = tools ? new Tools({ svg, snap }) : null;
	const input = new Input({ svg, model, history, selection, renderer, labels, readout: shownReadout, tools: heldTools,
		host, help, now, snap, plugins, runRules, places: placesOf(parts) });   // C-c: the placed kinds
	let capture = null;
	// the DOM's events, as input events (dev/design/input/GESTURE-SYSTEM.md, L0) -- once the root's own listeners are in
	const listen = () => (capture ??= new Capture({ svg, host, sink: input, picks: picksOf(parts) }));   // C-b: the plugins' picks
	return { model, history, renderer, selection, labels, readout: shownReadout, snap, tools: heldTools, input, listen };
}
