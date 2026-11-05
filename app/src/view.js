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

H26.6's move 10 (PAN-ZOOM.md section 3.7; PZ6, PZ23, PZ28) -- THE KEYS' VERBS AND THE REMEMBERED VIEW. `zoomIn`, `zoomOut` and
`zoomDefault` step a level nearer or farther, or return to 1x, about the canvas's centre, each a level and a pivot handed to `zoomAbout`
as the pinch's are; `home` brings the centre to 0,0 at the level as it is (PZ6) and `fit` centres given bounds at the nearest level that
shows them whole with `FIT_PAD` screen pixels on each side, else at the farthest, answering that it is larger -- both a centre and a
level set outright, through `setView`, since `zoomAbout` keeps a point; a verb that changes nothing does nothing. THE STORE is the page's
(app/src/main.js), `{ read(id), write(id, value) }`, the key its own; the lab hands none and remembers nothing. `open(id)` -- a diagram
loaded -- writes any save still waiting, for the diagram it was bound to, then reads `id`'s value and opens there, or as the first opening
when it is absent, unreadable or malformed (`storedView`); `adopt(id)` -- the same document under a new id, a template's fork -- keeps the
view and binds it to `id`. Each view that moves schedules a save bound, then, to its diagram and to itself, written `SAVE_AFTER_MS` after
the view last moved, or at once by `flush` -- the page hiding -- or by the next `open`; so one diagram's view is never written under
another's key. A read or a write that throws is ignored, the view working unremembered (3.7).
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
const FIT_PAD = 24;             // 3.7: fit's padding, screen pixels on each side of the diagram's bounds
const SAVE_AFTER_MS = 500;      // 3.7, PZ23: a view is saved half a second after it last moved
const VIEW_BOUND = 1_000_000;   // PZ31: a remembered centre is read only within the bound every coordinate keeps
/*
H26.6's move 11 (PAN-ZOOM.md section 3.7, "At each level"; PZ12; the director's ruling after move 10, section 9): THE LABELS' FLOOR, the
screen pixels a label's text must reach to be drawn -- under it, a label and its pill are hidden, at a level far enough out; on a canvas
1,366 wide at 2x and 3x, on one 1,920 wide at 3x alone, the labels' 13 units then 3.2 and 2.1 pixels, and 3.4. Held here beside the other
values, tuned in the lab by one edit; the export draws every label whatever the view (`labelsShown`, below).
*/
const LABEL_FLOOR = 5;

/*
3.7, PZ23: a level no longer among `levels` read as the nearest by ratio, `|log(level / preset)|`, a tie going to the farther -- so one
beyond the presets' ends is the end nearer it: a remembered 4 opens at 3x and 0.25 at 0.5x. A tie is judged within a relative 1e-12, the
two logarithms' own rounding.
*/
export function nearestLevel(level, levels = ZOOM_LEVELS) {
	let best = null, gap = Infinity;
	for (const preset of levels) {
		const d = Math.abs(Math.log(level / preset));
		if (d < gap * (1 - 1e-12) || (Math.abs(d - gap) <= 1e-12 * Math.max(d, gap) && preset > best)) { best = preset; gap = d; }
	}
	return best;
}

/*
3.7, PZ23: a remembered value as the view it opens at, or null for one that is malformed -- not a plain object of `v` 1, an `x` and a `y`
each a finite number within PZ31's bound, and a `level` a finite number above 0 -- its level read as the nearest preset.
*/
export function storedView(value, levels = ZOOM_LEVELS) {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || value.v !== 1) return null;
	const within = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= VIEW_BOUND;
	if (!within(value.x) || !within(value.y) || typeof value.level !== 'number' || !Number.isFinite(value.level) || !(value.level > 0)) return null;
	return { x: value.x, y: value.y, level: nearestLevel(value.level, levels) };
}

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
	#pinchPixels = 0;   // 3.6: the pinch's held pixels, toward the next level
	#saving = null;     // move 10: the save waiting -- `{ id, view, timer }`, bound when it was scheduled -- or null

	// move 10: `store`, the page's `{ read(id), write(id, value) }`, or none -- the lab's; `timers`, the host's `{ set(fn, ms), clear(t) }`
	constructor({ scene, settled = () => {}, store = null, timers = null }) {
		this.scene = scene;
		this.settled = settled;
		this.store = store;
		this.timers = timers;
		this.diagram = null;   // the diagram the view is remembered for, once one is opened
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
	#write(next, acc, { save = true } = {}) {
		const { w, h } = this.size();
		const laidOut = w > 0 && h > 0;
		if (laidOut) {
			const scale = defaultScale(w, h) / next.level;
			this.scene.setView({ x: next.x - w / (2 * scale), y: next.y - h / (2 * scale), scale });
		}
		const moved = next.x !== this.view.x || next.y !== this.view.y || next.level !== this.view.level;
		this.view = next;
		this.#pinchPixels = acc;
		if (moved && save) this.#schedule();   // move 10: before `settled`, so a failing redraw still leaves the view remembered
		if (laidOut) this.settled();
	}

	// move 10 (PZ23): a save of the view as it now stands, bound to its diagram now, written half a second after the view last moved
	#schedule() {
		if (!this.store || this.diagram === null) return;
		if (this.#saving) this.timers?.clear(this.#saving.timer);
		const bound = { id: this.diagram, view: { ...this.view }, timer: null };
		this.#saving = bound;
		if (this.timers) bound.timer = this.timers.set(() => this.flush(), SAVE_AFTER_MS);
	}

	// move 10 (PZ23): the save waiting, written now, under the diagram it was bound to -- the page hiding, a diagram opened; a write that
	// throws is ignored (3.7)
	flush() {
		const bound = this.#saving;
		if (!bound) return;
		this.#saving = null;
		this.timers?.clear(bound.timer);
		try { this.store.write(bound.id, { v: 1, x: bound.view.x, y: bound.view.y, level: bound.view.level }); } catch { /* storage blocked or full: unremembered */ }
	}

	/*
	move 10 (PZ23, 3.7): a diagram loaded, once its document is in and before its first frame. The same diagram again -- a resynchronising
	snapshot -- keeps the view; another writes any save still waiting, then opens at `id`'s remembered view, or as the first opening when it
	has none, its value unreadable or malformed. Opening moves the view but saves nothing: it was read, not moved.
	*/
	open(id) {
		if (id === this.diagram) return;
		this.flush();
		this.diagram = id;
		let value = null;
		try { value = this.store ? this.store.read(id) : null; } catch { /* storage blocked: the first opening */ }
		this.#write(storedView(value) ?? { x: 0, y: 0, level: 1 }, 0, { save: false });
	}

	// move 10: the same document under a new id -- a template's fork, which the viewer did not open -- the view kept and remembered for it
	adopt(id) {
		if (id === this.diagram) return;
		this.flush();
		this.diagram = id;
		this.#schedule();
	}

	// the view, set on the scene again as it stands -- the first opening, a resize -- the pinch's held pixels kept
	apply() {
		this.#write(this.view, this.#pinchPixels);
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
		this.#write({ ...this.view, x: this.view.x + dx / scale, y: this.view.y + dy / scale }, this.#pinchPixels);
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
		const step = stepZoom(ZOOM_LEVELS.indexOf(this.view.level), this.#pinchPixels, delta);
		if (step.steps === 0) { this.#pinchPixels = step.acc; return; }
		this.#zoomTo(ZOOM_LEVELS[step.index], screen, step.acc);
	}

	// a level, its scale chosen first and handed to the scene's `zoomAbout` with the screen point it keeps; a root not laid out takes the level
	#zoomTo(level, screen, acc) {
		const scale = this.#scaleAt(level);
		if (scale === null) { this.#write({ ...this.view, level }, acc); return; }
		const { w, h } = this.size(), at = this.scene.zoomAbout(screen, scale);
		this.#write({ x: at.x + w / (2 * scale), y: at.y + h / (2 * scale), level }, acc);
	}

	// move 10 (PZ28): a level about the canvas's centre -- keys have no pointer -- the pinch's held pixels set to 0; the same level, nothing
	#zoomAboutCentre(level) {
		if (level === undefined || level === this.view.level) return;
		this.#zoomTo(level, this.scene.toScreen({ x: this.view.x, y: this.view.y }), 0);
	}

	// `=` or `+`: a level nearer, about the canvas's centre; at the nearest, nothing
	zoomIn() { this.#zoomAboutCentre(ZOOM_LEVELS[ZOOM_LEVELS.indexOf(this.view.level) - 1]); }
	// `-`: a level farther, about the canvas's centre; at the farthest, nothing
	zoomOut() { this.#zoomAboutCentre(ZOOM_LEVELS[ZOOM_LEVELS.indexOf(this.view.level) + 1]); }
	// `Shift+0`: the default level, 1x, about the canvas's centre -- no level is actual size, so its key is the default's (PZ28)
	zoomDefault() { this.#zoomAboutCentre(1); }

	// `h` and the reticle (PZ6, ruled): the centre to cell 0,0, the level kept, set outright; already there, nothing
	home() {
		if (this.view.x === 0 && this.view.y === 0) return;
		this.set({ x: 0, y: 0, level: this.view.level });
	}

	/*
	`Shift+1` (3.7, PZ28): `bounds` -- `{ x0, y0, x1, y1 }`, every device's frame, zone and waypoint, or null for an empty diagram --
	centred at the nearest level that shows them whole, `FIT_PAD` screen pixels on each side, else at the farthest; an empty diagram fits
	as it first opens (PZ7). Answers `{ level, larger }`, `larger` when no level shows them whole, for the page to flash -- or null for a
	root not laid out, the view kept. A fit that changes nothing does nothing.
	*/
	fit(bounds) {
		const { w, h } = this.size();
		if (!(w > 0 && h > 0)) return null;
		const next = bounds ? { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2, level: null } : { x: 0, y: 0, level: 1 };
		let larger = false;
		if (bounds) {
			const shows = (level) => (bounds.x1 - bounds.x0) * (defaultScale(w, h) / level) + 2 * FIT_PAD <= w && (bounds.y1 - bounds.y0) * (defaultScale(w, h) / level) + 2 * FIT_PAD <= h;
			next.level = ZOOM_LEVELS.find(shows) ?? ZOOM_LEVELS.at(-1);
			larger = !shows(next.level);
		}
		if (next.x !== this.view.x || next.y !== this.view.y || next.level !== this.view.level) this.set(next);
		return { level: next.level, larger };
	}

	// 3.6: the pinch's held pixels set to 0 -- focus lost, a switch of diagram
	pinchReset() {
		this.#pinchPixels = 0;
	}

	// the pinch's held pixels, toward the next level: read by the tests of the accumulator
	pinchHeld() {
		return this.#pinchPixels;
	}

	/*
	H26.6's move 11 (3.7): whether a label of `text` drawing units shows -- its text at least LABEL_FLOOR screen pixels -- at `scale`, the
	screen pixels per drawing unit a listener is told (`visible().scale`), else at the view's own level's; a root not laid out has no scale,
	so its labels show. A listener passes the scale it is told: this part writes the scene before it holds the new view (the header's WHEN A
	VERB THROWS), so while the scene tells, the level held is the one before.
	*/
	labelsShown(text, scale = this.#scaleAt(this.view.level)) {
		return scale === null || text * scale >= LABEL_FLOOR;
	}

	// the grid's values for the view's level: its tiers, the scale a dot's drawing radius is shown at, and the margin (3.7, PZ24)
	gridLook() {
		const { w, h } = this.size();
		return { tiers: GRID_TIERS[this.view.level], dotScale: w > 0 && h > 0 ? defaultScale(w, h) / GRID_DOT_LEVEL : null, margin: GRID_MARGIN };
	}
}

/*
THE VIEW'S FRAME METER -- H26.6's move 9 (PAN-ZOOM.md section 4, PZ11; appendix A, move 9): each view the scene tells -- a pan's step, a
wheel's, a pinch's level -- timed from the moment it is told to the third animation frame's callbacks after it. RESTATED at the production
gate of moves 9 to 12 (S1): it timed to the second, a frame short of the drafter's pan-cost.mjs, on whose figures PZ11's 50 was set --
pan-cost.mjs sets a step in one frame's callbacks, which that frame draws, and times it to the second frame's after; a view a person's
input sets is told just before a frame's callbacks, that frame drawing it, so the first callbacks here are the drawing frame's and the
third are pan-cost.mjs's second after it. So at 60 frames a second a step drawn in its own frame reads about 33.3 ms, as pan-cost.mjs
read a cheap step, one that misses a frame 50, and "within 50" is what PZ11 meant: no frame missed. A view told while another still
waits for its drawing frame is shown by that same frame and is not timed again; one told after it is timed on its own, so a pan's step
a frame is timed every frame. `figures()` answers the steps timed since the last `reset()`, their median and their 90th percentile, nearest rank,
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
		shown(steps ? `view frames: ${steps} step${steps === 1 ? '' : 's'}, median ${median.toFixed(1)} ms, 90th percentile ${p90.toFixed(1)} ms (PZ11: within 50, as pan-cost.mjs times a step -- to the second frame after the one drawing it)` : 'view frames: pan to measure');
	};
	const off = scene.onView(() => {
		if (waiting !== null) return;
		const told = host.performance.now();
		waiting = told;
		host.requestAnimationFrame(() => {
			waiting = null;   // the drawing frame: a view told from here is drawn by a later one
			host.requestAnimationFrame(() => host.requestAnimationFrame(() => { times.push(host.performance.now() - told); say(); }));
		});
	});
	say();
	return { figures, reset: () => { times.length = 0; say(); }, close: off };
}
