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
The pan and zoom verbs join it at move 9 (below), the keys, home, fit and the remembered view at move 10.

H26.6's move 8 (PAN-ZOOM.md section 3.7, "The levels" and "The grid at each level"; PZ12, PZ24) -- THE LEVELS AND THE GRID'S VALUES,
held here alone, each tuned by one edit: `ZOOM_LEVELS`, the altitudes a view may take; `GRID_TIERS`, each level's tiers, coarsest first;
`GRID_DOT_LEVEL`, the level at which a grid's dot shows its drawing radius, so it keeps that size on screen at every level -- provisional,
the director's "fixed until we review"; and `GRID_MARGIN`, the screen pixels drawn beyond the view on each side. The grids part is handed
them for the view's level (`gridLook`), read at each draw. A view at a level is also set outright (`set`).

H26.6's move 9 (PAN-ZOOM.md section 3.6; PZ12, PZ17) -- THE GESTURES' VERBS, which the canvas's view rows run (app/src/recognize.js
VIEW_RULES, app/src/input.js): `scrollPan`, a wheel without Ctrl, the centre moved by the normalised deltas over the scale, so the drawing
moves the other way as a page scrolls -- the wheel never zooms without Ctrl (GR6); `dragPan`, a pan gesture's travel on screen, the drawing
following the pointer; and `pinchZoom`, a pinch or Ctrl and the wheel, the normalised `deltaY` accumulated and the view stepping one level
per `ZOOM_STEP_PIXELS` crossed about the pointer, never between levels. Deltas are normalised first by their unit (`normalisedDelta`).
THE ACCUMULATOR is held here, since this part sees every view set: a view the wheel did not set -- `set`, a drag's pan, and the keys, home
and fit of move 10 -- sets it to 0, as do focus lost and a switch of diagram (`pinchReset`); a resize, which keeps the view, keeps it.
WHEN A VERB THROWS (move 8's last check): the one write (`#write`) throws either BEFORE the view moves -- a malformed argument, or the scene
refusing a view past its supported range (vector-scene VS14), the view and the held pixels as they were -- or AFTER it moved -- a redraw a
listener asked failing in `settled` (move 8's L1), the view and the held pixels already the new ones. So no verb, and no caller, may read a
throw as "the view did not move": `view` is always the view the scene holds.
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
const ZOOM_STEP_PIXELS = 100;   // PZ12, 3.6: the pinch's normalised pixels per level, calibrated in the tester the director accepted
const LINE_PIXELS = 40;         // 3.6: a wheel's line, in pixels -- so three lines and 120 pixels zoom alike

// 3.6: a wheel's delta in screen pixels by its `deltaMode` -- 0 pixels as given, 1 lines of 40, 2 pages of `pagePixels`, the canvas's
// height -- or null where the unit is not reported or the page has no height, and the view is kept
export function normalisedDelta(delta, deltaMode, pagePixels) {
	if (deltaMode === 0) return delta;
	if (deltaMode === 1) return delta * LINE_PIXELS;
	if (deltaMode === 2 && pagePixels > 0) return delta * pagePixels;
	return null;
}

/*
3.6's accumulator, one fact's step: `acc` set to 0 first by a delta of the other sign; then it gains the delta, and while `|acc|` is at
least `step` and a level lies that way the level steps once, out for a positive delta and in for a negative, `acc` losing one step and
keeping the remainder; at the nearest or farthest level what remains that way is dropped, `acc` set to 0. Answers the level's index after,
`acc` after and how many levels it stepped -- one fact of 250 from 0.5x steps twice, to 2x, keeping 50.
*/
export function stepZoom(index, acc, delta, levels = ZOOM_LEVELS, step = ZOOM_STEP_PIXELS) {
	let held = delta !== 0 && acc !== 0 && Math.sign(delta) !== Math.sign(acc) ? 0 : acc;
	held += delta;
	let steps = 0;
	while (Math.abs(held) >= step && index + Math.sign(held) >= 0 && index + Math.sign(held) < levels.length) {
		index += Math.sign(held);
		held -= Math.sign(held) * step;
		steps++;
	}
	const way = Math.sign(held);
	if (way !== 0 && (index + way < 0 || index + way >= levels.length)) held = 0;
	return { index, acc: held + 0, steps };
}

/*
THE VIEW'S FRAMES -- the move 8 verifier's folds (L2, S2, L1). What the scene's listeners ask to draw again (the grids', the crosshair's)
waits until the scene has finished telling a view, since it may not be written while it tells (vector-scene VS17): `ask(fn)` queues it
and asks `later` -- the host's next animation frame -- to `run` the queue, once however many were asked; `run`, also called by the view
part as soon as a view it set has been told (`settled`), runs each asked function once and empties the queue, so the next ask asks a
frame again. Each runs whatever another throws, so one failing redraw -- a grid whose record is missing -- leaves the others theirs and
their own flags cleared; the error still surfaces, thrown when the queue has run, every error together when more than one throws.
*/
export function viewFrames(later) {
	const asked = [];
	let awaiting = false;
	const run = () => {
		awaiting = false;
		const errors = [];
		for (const fn of asked.splice(0)) { try { fn(); } catch (e) { errors.push(e); } }
		if (errors.length === 1) throw errors[0];
		if (errors.length > 1) throw new AggregateError(errors, `${errors.length} redraws failed: ${errors.map((e) => e?.message).join('; ')}`);
	};
	const ask = (fn) => { asked.push(fn); if (!awaiting) { awaiting = true; later(run); } };
	return { ask, run };
}

export class View {
	// `settled`, the composition's: told once a view this part set has been written and told, the scene writable again (the move 8 fold)
	#acc = 0;   // 3.6: the pinch's held pixels, toward the next level

	constructor({ scene, settled = () => {} }) {
		this.scene = scene;
		this.settled = settled;
		this.view = { x: 0, y: 0, level: 1 };   // PZ7: the first opening, centred on 0,0 at the 1x level
		this.apply();
	}

	// the root's size, in screen pixels: what the scene shows at its scale (VS15), read at the call
	size() {
		const { region } = this.scene.visible(), { scale } = this.scene.view();
		return { w: region.w * scale, h: region.h * scale };
	}

	/*
	THE ONE WRITE: `next`, a centre and a level, turned into the scene's top-left corner and scale and set on the scene, then held with the
	pinch's held pixels `acc`, then the composition told (`settled`). It throws BEFORE the view moves when the scene refuses it, the view
	and `acc` as they were, or AFTER, when a redraw `settled` runs fails, the view and `acc` the new ones (the header's WHEN A VERB THROWS).
	A root not laid out, or laid out to nothing, has no default scale: the view is held and set at the next resize.
	*/
	#write(next, acc) {
		const { w, h } = this.size();
		const laidOut = w > 0 && h > 0;
		if (laidOut) {
			const scale = defaultScale(w, h) / next.level;
			this.scene.setView({ x: next.x - w / (2 * scale), y: next.y - h / (2 * scale), scale });
		}
		this.view = next;
		this.#acc = acc;
		if (laidOut) this.settled();
	}

	// the view, set on the scene again as it stands -- the first opening, a resize -- the pinch's held pixels kept
	apply() {
		this.#write(this.view, this.#acc);
	}

	// the page's root was resized: the centre and the level kept, the view set again at the new default's scale
	resized() {
		this.apply();
	}

	/*
	A view set outright -- its centre and a level among the presets -- and applied (H26.6's move 8; move 10's home and fit set it so); the
	pinch's held pixels set to 0, the view not the wheel's. THROWS BEFORE the view moves for a level not among the presets, a centre not two
	finite numbers, or a view the scene refuses -- the view as it was -- and AFTER it moved when a redraw fails: the view set, the error the
	redraw's. A caller reads `view`, never the throw, for where the view is.
	*/
	set({ x, y, level }) {
		if (!ZOOM_LEVELS.includes(level)) throw new Error(`View: ${level} is no zoom level -- one of ${ZOOM_LEVELS.join(', ')}`);
		if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('View: a centre is two finite numbers');
		this.#write({ x, y, level }, 0);
	}

	// the scale of a level on the root as it is now, screen pixels per drawing unit -- or null for a root not laid out
	#scaleAt(level) {
		const { w, h } = this.size();
		return w > 0 && h > 0 ? defaultScale(w, h) / level : null;
	}

	/*
	3.6's `scroll-pan`: a wheel without Ctrl, its deltas normalised by `deltaMode` and the centre moved by them over the scale, so the
	drawing moves the other way, as a page scrolls; the level never changes (GR6), and the pinch's held pixels are kept, the view the
	wheel's. A unit not reported, or a root not laid out, keeps the view. Throws as `#write` says.
	*/
	scrollPan(deltaX, deltaY, deltaMode) {
		const scale = this.#scaleAt(this.view.level), page = this.size().h;
		const dx = normalisedDelta(deltaX, deltaMode, page), dy = normalisedDelta(deltaY, deltaMode, page);
		if (scale === null || dx === null || dy === null) return;
		this.#write({ ...this.view, x: this.view.x + dx / scale, y: this.view.y + dy / scale }, this.#acc);
	}

	/*
	3.6's pan gestures: the pointer's travel on screen since the last step, `travelX` and `travelY` screen pixels, the drawing following it
	-- the centre moved the other way by the travel over the scale -- the level kept and the pinch's held pixels set to 0, a drag's pan
	being a view the wheel did not set. Throws as `#write` says.
	*/
	dragPan(travelX, travelY) {
		const scale = this.#scaleAt(this.view.level);
		if (scale === null) return;
		this.#write({ ...this.view, x: this.view.x - travelX / scale, y: this.view.y - travelY / scale }, 0);
	}

	/*
	3.6's `pinch-zoom`: a pinch, or Ctrl and the wheel, its `deltaY` normalised and accumulated (`stepZoom`), the view stepping one level
	per `ZOOM_STEP_PIXELS` crossed, out for a positive delta and in for a negative, about `screen`, the fact's screen point: the level's
	scale is chosen first and handed to the scene's `zoomAbout`, so the drawing point under the pointer holds at every level and no view
	lies between levels. A fact that crosses no step holds its pixels toward the next; a unit not reported keeps the view and the held
	pixels. Throws as `#write` says -- `zoomAbout` refusing a view past the scene's range throws before, the held pixels as they were.
	*/
	pinchZoom(screen, deltaY, deltaMode) {
		const delta = normalisedDelta(deltaY, deltaMode, this.size().h);
		if (delta === null) return;
		const step = stepZoom(ZOOM_LEVELS.indexOf(this.view.level), this.#acc, delta);
		if (step.steps === 0) { this.#acc = step.acc; return; }
		const level = ZOOM_LEVELS[step.index], scale = this.#scaleAt(level);
		if (scale === null) { this.#write({ ...this.view, level }, step.acc); return; }
		const { w, h } = this.size(), at = this.scene.zoomAbout(screen, scale);
		this.#write({ x: at.x + w / (2 * scale), y: at.y + h / (2 * scale), level }, step.acc);
	}

	// 3.6: the pinch's held pixels set to 0 -- focus lost, a switch of diagram
	pinchReset() {
		this.#acc = 0;
	}

	// the pinch's held pixels, toward the next level: read by the tests of the accumulator
	pinchHeld() {
		return this.#acc;
	}

	// the grid's values for the view's level: its tiers, the scale a dot's drawing radius is shown at, and the margin (3.7, PZ24)
	gridLook() {
		const { w, h } = this.size();
		return { tiers: GRID_TIERS[this.view.level], dotScale: w > 0 && h > 0 ? defaultScale(w, h) / GRID_DOT_LEVEL : null, margin: GRID_MARGIN };
	}
}

/*
THE VIEW'S FRAME METER -- H26.6's move 9 (PAN-ZOOM.md section 4, PZ11; appendix A, move 9): each view the scene tells -- a pan's step, a
wheel's, a pinch's level -- timed from the moment it is told to the second animation frame after it, as the drafter's pan-cost.mjs and
move 8's measure time a view change: the first frame's callbacks run before it draws the view, the second's once it is drawn. A view a
person's input sets is told just before a frame's callbacks, so at 60 frames a second a step drawn in its own frame reads about 16.7
ms, one that misses a frame 33.3, and PZ11's budget, 50, three frames. A view told while one waits for its frame is shown by that same
frame and is not timed again. `figures()` answers the steps timed since the last `reset()`, their median and their 90th percentile, nearest rank,
in milliseconds; `shown(text)` is told the figure after each step and each reset. Composed by the lab (lab/src/root.js), so the director
pans the cap board on the Chromebook and reads PZ11's figure on the page; `host` the page's window, its clock and frames handed in.
*/
export function viewFrameMeter({ scene, host, shown = () => {} }) {
	const times = [];
	let waiting = null;
	const rank = (sorted, q) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];
	const figures = () => {
		const sorted = [...times].sort((a, b) => a - b);
		return { steps: sorted.length, median: sorted.length ? rank(sorted, 0.5) : null, p90: sorted.length ? rank(sorted, 0.9) : null };
	};
	const say = () => {
		const { steps, median, p90 } = figures();
		shown(steps ? `view frames: ${steps} step${steps === 1 ? '' : 's'}, median ${median.toFixed(1)} ms, 90th percentile ${p90.toFixed(1)} ms (PZ11: within 50)` : 'view frames: pan to measure');
	};
	const off = scene.onView(() => {
		if (waiting !== null) return;
		waiting = host.performance.now();
		host.requestAnimationFrame(() => host.requestAnimationFrame(() => { times.push(host.performance.now() - waiting); waiting = null; say(); }));
	});
	say();
	return { figures, reset: () => { times.length = 0; say(); }, close: off };
}
