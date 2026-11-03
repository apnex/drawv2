/*
THE VIEW -- H26.6's move 7 (dev/design/components/PAN-ZOOM.md sections 3.1 and 3.7; PZ7, PZ22, PZ25).

A viewer's view of the open diagram, held here and applied to the canvas's scene, which writes it on every layer (vector-scene's
view, VS14 to VS17). The view is `{ x, y, level }`: the drawing point at the canvas's centre, and the zoom level, an altitude, the
scale being the default's divided by the level -- the default the old 1920 by 1080 frame's fit in the canvas, so a level shows the
same proportion of the diagram on every window. The scene's own view is the point at the root's top-left corner and the scale,
`x - W / (2 * scale)`, `W` the root's width -- the width of `visible()`'s region times the scene's scale; draw's root carries no CSS
transform, so its units are screen pixels.

THE FIRST OPENING (PZ7, ruled): centre 0,0 at the 1x level, the scale that fits the old frame -- every diagram opens as it showed
when the root's viewBox fitted that frame. That scale is the default zoom, not a lock, and its rule stands here alone (`FIRST_FRAME`,
`defaultScale`), so the default is changed by one edit.

A RESIZE changes what the root shows, not the view (VS15): the page tells this part (`resized`), which keeps the centre and the level
and sets the view again at the new default's scale. A root not yet laid out, or laid out to nothing, has no default scale, and the
view waits for the next resize.

Handed the scene as a value by the composition (app/src/compose-canvas.js); it imports nothing and reads no page of its own (GR10).
The pan and zoom verbs and the remembered view join it at moves 9 and 10.

H26.6's move 8 (PAN-ZOOM.md section 3.7, "The levels" and "The grid at each level"; PZ12, PZ24) -- THE LEVELS AND THE GRID'S VALUES,
held here alone, each tuned by one edit: `ZOOM_LEVELS`, the altitudes a view may take; `GRID_TIERS`, each level's tiers, coarsest first;
`GRID_DOT_LEVEL`, the level at which a grid's dot shows its drawing radius, so it keeps that size on screen at every level -- provisional,
the director's "fixed until we review"; and `GRID_MARGIN`, the screen pixels drawn beyond the view on each side. The grids part is handed
them for the view's level (`gridLook`), read at each draw. Until the verbs arrive, a view at a level is set outright (`set`).
*/

// PZ7: the frame the first opening fits, centred on 0,0 -- the old canvas's 1920 by 1080, a default zoom and never a bound
const FIRST_FRAME = { w: 1920, h: 1080 };
// the scale that fits the first frame in a root of `w` by `h` screen pixels, as its viewBox fitted it (preserveAspectRatio's meet)
const defaultScale = (w, h) => Math.min(w / FIRST_FRAME.w, h / FIRST_FRAME.h);

// PZ12, ruled: 0.5x twice as close as the default, 1x the default, 2x and 3x the camera at two and three times the altitude
const ZOOM_LEVELS = Object.freeze([0.5, 1, 2, 3]);
const tier = (every, opacity) => Object.freeze({ every, opacity });
// PZ24, ruled: every dot at every level; 2x every 4th full and the rest at half; 3x every 10th full, every 2nd at half, the rest a quarter
const GRID_TIERS = Object.freeze({
	0.5: Object.freeze([tier(1, 1)]),
	1: Object.freeze([tier(1, 1)]),
	2: Object.freeze([tier(4, 1), tier(1, 0.5)]),
	3: Object.freeze([tier(10, 1), tier(2, 0.5), tier(1, 0.25)]),
});
const GRID_DOT_LEVEL = 1;   // PZ24, the director's "fixed until we review": a dot shows its drawing radius at 1x, and that size at every level
const GRID_MARGIN = 32;     // screen pixels drawn beyond the view on each side, so a pan within them draws nothing again

export class View {
	constructor({ scene }) {
		this.scene = scene;
		this.view = { x: 0, y: 0, level: 1 };   // PZ7: the first opening, centred on 0,0 at the 1x level
		this.apply();
	}

	// the root's size, in screen pixels: what the scene shows at its scale (VS15), read at the call
	size() {
		const { region } = this.scene.visible(), { scale } = this.scene.view();
		return { w: region.w * scale, h: region.h * scale };
	}

	// the view, set on the scene: its centre and level turned into the scene's top-left corner and scale
	apply() {
		const { w, h } = this.size();
		if (!(w > 0 && h > 0)) return;   // not laid out yet: no default scale, so nothing to set until a resize
		const scale = defaultScale(w, h) / this.view.level;
		this.scene.setView({ x: this.view.x - w / (2 * scale), y: this.view.y - h / (2 * scale), scale });
	}

	// the page's root was resized: the centre and the level kept, the view set again at the new default's scale
	resized() {
		this.apply();
	}

	// a view set outright -- its centre and a level among the presets -- and applied (H26.6's move 8; the verbs of moves 9 and 10 set it so)
	set({ x, y, level }) {
		if (!ZOOM_LEVELS.includes(level)) throw new Error(`View: ${level} is no zoom level -- one of ${ZOOM_LEVELS.join(', ')}`);
		if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('View: a centre is two finite numbers');
		this.view = { x, y, level };
		this.apply();
	}

	// the grid's values for the view's level: its tiers, the scale a dot's drawing radius is shown at, and the margin (3.7, PZ24)
	gridLook() {
		const { w, h } = this.size();
		return { tiers: GRID_TIERS[this.view.level], dotScale: w > 0 && h > 0 ? defaultScale(w, h) / GRID_DOT_LEVEL : null, margin: GRID_MARGIN };
	}
}
