/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 4, acceptance step 4; section 6) -- THE GESTURE CORPUS'S EDITING TREES, held to the
record today's code wrote before H26.4 (tests/fixtures/scene-parity-record.json, `trees`).

RESTATED at H26.8's painters move (dev/design/components/NATIVE-SHAPES.md sections 4.2 and 4.5, NS10): this fixture ran today's
renderer, painter and export, kept verbatim at tests/fixtures/pre-scene/ and tests/fixtures/pre-export/, beside the adapter over every
document the repository stores -- the side-by-side -- and held section 6.3's inputs with both answers. Those copies ran the live
plugins' painters, which answer shapes since the move and no longer build elements, so they went with it, once the record the drawing
moves answer to passed under the painters move's allowances. Each assertion of the side-by-side has its replacement, named in
tests/vector-scene-parity.test.js. What stays here is what the corpus's editing trees need -- the overlay's, the snap layer's and the
grids' trees after every step of the gesture corpus, read through the harness the corpus replays on -- one of move 3's guards (4.1).

Nothing here is pinned that an engine may approximate (B176, B423): the record holds trees whose numbers are the pointer's, the grids'
and the kernel's exact arithmetic, but for a handle's place, which the network answers by `Math.hypot`
(plugins/network/link-handles.mjs) -- so a handle is recorded at its offset from the point its part's spec answers then, read live,
and not at that point.

  corpusTrees   a scenario of the gesture corpus, the editing layers' trees after each step
  compact       a scenario's trees, each distinct state once
  treesOpen     the corpus's harness, its grids drawn into it as the composition draws them
  readRecord    the record
*/
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PRODUCT_CANVAS } from '../../product/canvas.mjs';
import { kindOf } from '../../model/model.mjs';

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/*
The overlay's, the snap layer's and the grids' trees after each step of a scenario, through the harness the corpus replays on, the
grids drawn into it as the composition draws them. Each tree is kept as data, attributes in order; the grids', whose dots are many and
change only on a load, by the SHA-256 of that data and its count of dots.
*/
export const harnessTree = (n, place = null) => ({ tag: n.tagName, attrs: Object.entries(n.attrs ?? {}).map(([k, v]) => [k, place?.(n, k, v) ?? v]), text: n.children?.length ? '' : (n.textContent ?? ''), children: (n.children ?? []).map((c) => harnessTree(c, place)) });
const gridOf = (layer) => ({ dots: layer.children.length, sha256: sha256(JSON.stringify(harnessTree(layer).children)) });
/*
A handle's place, as its offset from the point its part's spec answers for it now -- `point.x-6`, the overlay's half a handle short of the
point, when it is exactly there -- so the record holds where the overlay put it against its point, and not the point, which the network
computes by Math.hypot. Its point: the lone selected entity's spec (Overlay `handleSpecs`), its name the handle's data attribute.
*/
const HALF_HANDLE = 6;   // app/src/overlay.js HANDLE / 2
function handlePlaces(h) {
	const ids = h.selection.list();
	const spec = ids.length === 1 ? h.input.overlayUi.handleSpecs().get(kindOf(ids[0])) : null;
	const entity = spec && h.model.get(kindOf(ids[0]), ids[0]);
	const points = (entity && spec.points(entity, h.model)) || {};
	const attr = spec ? `data-${spec.key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}` : null;
	return (n, k, v) => {
		if (!attr || (k !== 'x' && k !== 'y') || !(n.attrs?.class ?? '').split(' ').includes('handle')) return null;
		const p = points[n.attrs[attr]];
		return p && Number(v) === p[k] - HALF_HANDLE ? `point.${k}-${HALF_HANDLE}` : `${v} (off its point)`;
	};
}
export function corpusTrees(scenario, { record, open }) {
	const steps = [];
	// each layer's content, not the layer's own element, which the harness makes before the move and the scene after it
	const capture = (h) => ({ overlay: harnessTree(h.layers['#overlay'], handlePlaces(h)).children, snaplayer: harnessTree(h.layers['#snaplayer']).children, grids: ['#grid-nodes', '#grid-zones'].map((id) => gridOf(h.layers[id])) });
	record(scenario, { withHarness: (h) => { open(h); steps.push(capture(h)); }, afterStep: (h) => steps.push(capture(h)) });
	return steps;
}
// a scenario's trees, each distinct state once and each step an index into them, so the record holds what changed
export function compact(steps) {
	const states = [], at = new Map();
	const index = steps.map((s) => { const k = JSON.stringify(s); if (!at.has(k)) { at.set(k, states.length); states.push(s); } return at.get(k); });
	return { states, steps: index };
}

export const RECORD = new URL('./scene-parity-record.json', import.meta.url);
export const readRecord = () => JSON.parse(fs.readFileSync(RECORD, 'utf8'));
/*
The corpus's harness, its grids drawn into it as the composition draws them. RESTATED at H26.4: the grids are items of the scene the
harness opens, whose layers it finds; before the move they were drawn into layers made here, as the page's markup held them.
*/
export async function treesOpen() {
	const { Grids } = await import('../../app/src/grids.js');
	return (h) => { new Grids({ scene: h.scene, parts: PRODUCT_CANVAS, model: h.model }); };
}
