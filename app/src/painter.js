/*
Painter -- low-level SVG DOM helpers, for what draws outside the canvas's scene.
v1 painter lineage: no model knowledge, raw canvas coordinates only.

H26.4 (dev/design/components/VECTOR-SCENE.md sections 5.1 and 5.3; appendix B): the canvas's scene is vector-scene's, so what draws
into it no longer builds elements here. Left: `el`, for the drawers of the foreign layers -- the network's pipes and the simulation's
movers, handed the layer element the scene answers for each; beside it the reveal's trace's probe (D12), which the page hands the
reveal; `buildPreview`, which builds each of the palette's tiles, a standalone <svg> in the sidebar outside the canvas; and the help
panel's two questions. `toCanvas` went to the scene's `toDrawing`, and the crosshair, the stamp ghost and the preview rect, line and
path to app/src/editing-visuals.js, native; `layerOf` went with Input's overlay element. RESTATED H26.8's painters move: `setAttrs`,
which the renderer's kit handed the painters, is this module's own now -- a painter answers shapes and sets no attribute.
*/

const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent = null) {
	const node = document.createElementNS(NS, tag);
	setAttrs(node, attrs);
	if (parent) parent.appendChild(node);
	return node;
}

function setAttrs(node, attrs) {
	for (const key in attrs) {
		if (key === 'href') {
			node.setAttribute('href', attrs[key]);
		} else {
			node.setAttributeNS(null, key, attrs[key]);
		}
	}
	return node;
}

/*
H26.4 (VECTOR-SCENE.md D12, section 5.1) -- DRAW'S PROBE: a path's length measured by a probe of draw's own holding the same `d`, never put
on the page. RESTATED at H26.8's trace move (NATIVE-SHAPES.md section 5): the page hands it to the reveal, which measures the line it
traces by its `d`; the settle beside it, which forced the old trace's layout, is gone with that trace.
*/
let probe = null;
export function pathLengthOf(d) {
	probe ??= document.createElementNS(NS, 'path');
	probe.setAttribute('d', d);
	return probe.getTotalLength();
}

// a preview a hand declares -- elements as data, `{ tag, attrs, children }` -- built under a parent (C-e): the palette's tiles, outside
// the canvas; the stamp ghost describes the same preview to the scene (app/src/editing-visuals.js), one source for the numbers (B205, B318)
export function buildPreview(parent, preview) {
	for (const p of preview) {
		const node = el(p.tag, p.attrs, parent);
		if (p.children) buildPreview(node, p.children);
	}
	return parent;
}

/*
Small DOM questions the input layers used to ask themselves, asked here instead -- the gesture system keeps every DOM
read in capture and the view modules (dev/design/input/GESTURE-SYSTEM.md, invariant G1).
*/
// whether a panel (the help overlay) is showing, and show or hide it
export const isShown = (el) => !el.hidden;
export const setShown = (el, show) => { el.hidden = !show; };
