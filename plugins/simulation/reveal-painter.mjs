/*
reveal.js -- the unfurl, applied to what is already on the canvas.

One concern: hiding the entities a beat has not reached yet, and saying what the beat is saying. It
owns no geometry, mints no elements and decides nothing about time -- `plugins/simulation/reveal.mjs` answers
which ids are visible at an instant, `clock.js` answers what the instant is, and this writes the
answer onto the DOM.

WHY HIDING RATHER THAN CREATING. The ops of a beat applied when it committed, so every entity
already exists in the model and the renderer has already drawn it. A reveal that created elements
would be a second renderer, drifting from the first the moment either changed; hiding what the
derivation withholds keeps one drawing path and makes the unfurl genuinely presentational. It also
means a viewer who arrives late, or reloads, or has beats disabled, sees a complete diagram rather
than a partial one -- which is the correct failure direction.

The paint loop is `paintloop.js`, shared with movers.js -- a timer floor with rAF on top, because a
reveal driven by rAF alone freezes in a background tab and then jumps.

NOT HERE, deliberately: no animation of the arrival itself (a fade or a grow belongs in CSS, keyed
off the same attribute this sets -- a link's trace among them since H26.8), and no caption typing. The caption TEXT is reported for whoever
owns the status bar to render; how it is typed out is presentation on top of a derived string, and
putting it here would make this module own a second concern.
*/
import { revealedAt, beatsOf, traceOf } from './reveal.mjs';
import { loop, clockOf } from './paintloop.mjs';

// The floor, matching movers.js. Not a frame rate -- a reveal moves at human pace, and the rAF loop
// below is what makes it smooth when the tab is visible.
const TICK_MS = 100;

// the declared trace's custom properties, the string the line's `style` holds while it traces (NATIVE-SHAPES.md section 5, a:F7)
const traceStyle = ({ len, ms }) => `--trace-len: ${len}; --trace-ms: ${ms}ms`;

export class Reveal {
	/*
	`lengthOf(d)`: draw's probe, a path's length from its `d` (app/src/painter.js `pathLengthOf`), handed by the page; a composition that
	hands none traces nothing, a link shown at once, as the harness's elements, which had no measure, were.
	*/
	constructor({ model, renderer, now, onCaption, lengthOf = null }) {
		this.model = model;
		this.renderer = renderer;
		this.now = clockOf(now);
		this.lengthOf = typeof lengthOf === 'function' ? lengthOf : null;
		// the status-bar channel. Injected rather than reached for, so this module owns no DOM it
		// was not handed and can be driven with no page at all.
		this.onCaption = typeof onCaption === 'function' ? onCaption : () => {};
		this.loop = null;
		this.hidden = new Set();    // what we are currently withholding, so paint only touches deltas
		this.said = null;           // the last caption emitted, so an unchanged one is not re-sent
		this.trace = null;          // H14.12 trace config; null is the ruled default (500ms fixed)
		// H26.8 (B422): the traces running, by line -- { run, d, len, ms, until } -- and the name each line last took, 'a' or 'b'
		this.traces = new Map();
		this.runs = new Map();
	}

	// the reveal record the document carries, or null when it carries none -- which is the normal
	// case and means everything is visible.
	record() {
		return this.model.state?.reveal || null;
	}

	/*
	Start or stop according to whether there is anything to reveal.

	Called on load and on every commit, the same way `movers.sync()` is: a commit may have added a
	beat, removed one by undo, or changed nothing. Stopping when there is no record is what keeps a
	document with no beats free of a timer it does not need.
	*/
	/*
	RESTATED at H26.8 (B422; NATIVE-SHAPES.md section 5): the loop runs while there is a record OR a trace running -- a record gone shows
	what it withheld, links tracing as ever, and the loop runs on until each of those traces is ended.
	*/
	sync() {
		if (!this.record()) { this.showAll(); this.keepWhileTracing(); return; }
		this.start();
		this.paint();
	}

	keepWhileTracing() {
		if (this.traces.size) this.start(); else this.stop();
	}

	start() {
		if (this.loop) return;
		this.loop = loop(() => this.paint(), TICK_MS);
	}

	stop() {
		if (this.loop) { this.loop.stop(); this.loop = null; }
	}

	// restore everything this module hid. Called when a reveal is undone or cancelled: absence of a
	// record means fully revealed, so nothing may stay hidden on the strength of a record that is
	// no longer there.
	showAll() {
		for (const id of this.hidden) this.show(id);
		this.hidden.clear();
		if (this.said !== null) { this.said = null; this.onCaption(null); }
	}

	/*
	H14.12 -- a node fades and a link TRACES, drawn source to destination.

	The trace is a dash-offset: the whole path length is laid down as one dash and pushed out of
	view, then animated back to zero, which is the standard SVG technique. A node keeps the fade: it
	has no direction to trace, and a shape growing from nothing reads as a glitch rather than as an
	arrival.

	RESTATED at H26.8 (B422; dev/design/components/NATIVE-SHAPES.md section 5, NS4) -- THE TRACE DECLARED. Today's inline dash was
	written, a layout forced and a transition armed, and the dash never taken away: a control or down link revealed was drawn solid
	ever after, and a longer route showed a gap. Now the line's `d` is measured by draw's probe (`lengthOf`), the duration is
	`traceOf`'s as ever, and the line carries `data-trace`, a name alternated per line, and the length and duration as custom
	properties, which the simulation's stylesheet runs as one animation (plugins/simulation/simulation.css); at `show + ms` by the
	reveal's clock both go, and the line is drawn with its own dash again. The name alternates so a hide and a show in one task begin
	the trace again -- the same name, removed and written back before the page draws, would not.
	*/
	show(id) {
		const dom = this.renderer.byId?.(id);
		if (!dom) return;
		if (dom.tagName === 'path' && this.lengthOf) {
			const d = dom.getAttribute('d'), len = this.lengthOf(d);
			if (len > 0) {
				const { ms } = traceOf(this.trace, len);
				const run = this.runs.get(id) === 'a' ? 'b' : 'a';
				const trace = { run, d, len, ms, until: this.now() + ms };
				this.runs.set(id, run);
				this.traces.set(id, trace);
				dom.setAttribute('data-trace', run);
				dom.setAttribute('style', traceStyle(trace));
			}
		}
		dom.removeAttribute('data-unrevealed');
	}

	// H26.8: a hide ends the line's trace and withholds it; on every tick it finds nothing to end and the mark standing, and writes nothing
	hide(id) {
		const dom = this.renderer.byId?.(id);
		this.endTrace(id, dom);
		if (dom && dom.getAttribute('data-unrevealed') === null) dom.setAttribute('data-unrevealed', '');
	}

	/*
	H26.8 -- a trace ended: its entry dropped, and its attributes taken away where they still stand on the line. A line the renderer has
	drawn afresh since -- a load, an undo restoring it -- or one no longer drawn carries none of them, and nothing is written.
	*/
	endTrace(id, dom = this.renderer.byId?.(id)) {
		const trace = this.traces.get(id);
		if (!trace) return;
		this.traces.delete(id);
		if (!dom || dom.getAttribute('data-trace') !== trace.run) return;
		dom.removeAttribute('data-trace');
		dom.removeAttribute('style');
	}

	/*
	H26.8 -- each trace running, at the start of every pass: ended once its instant has come; otherwise its line's `d` read again and,
	where the route has changed -- a model change, in the same task; the network's settle redrawing a link, on the next pass -- its
	length written, so the animation keeps its time and draws the same fraction of the new line. A line redescribed with its route
	unchanged writes nothing, and the animation runs on.
	*/
	tend() {
		const t = this.now();
		for (const [id, trace] of [...this.traces]) {
			const dom = this.renderer.byId?.(id);
			if (t >= trace.until) { this.endTrace(id, dom); continue; }
			if (!dom || dom.getAttribute('data-trace') !== trace.run) continue;
			const d = dom.getAttribute('d');
			if (d === trace.d) continue;
			trace.d = d;
			const len = this.lengthOf(d);
			if (len === trace.len) continue;
			trace.len = len;
			dom.setAttribute('style', traceStyle(trace));
		}
	}

	/*
	One pass: hide what the beat has not reached, show what it has, and report the caption.

	Every id the record NAMES is either shown or hidden; an id it does not name is never touched, so
	a beat describing three entities has no opinion about the other forty. That is what makes a
	reveal additive over a complete document rather than a filter over one.
	*/
	paint() {
		this.tend();   // H26.8: the traces first -- each ended past its instant, each length read again
		const rec = this.record();
		if (!rec) { this.showAll(); if (!this.traces.size) this.stop(); return; }
		const t = this.now();
		const visible = revealedAt(rec, t);

		const named = new Set();
		for (const beat of rec.beats || []) for (const id of beat.ids || []) named.add(id);

		/*
		The set records what we INTEND to withhold; the DOM write is attempted every pass.

		B191 -- the first version treated `hidden` as proof the attribute had landed and skipped an
		id already in it. On the change path the reveal is applied BEFORE the ops that create the
		elements, so the first paint marks ids whose DOM does not exist yet: `hide()` found nothing,
		the id sat in the set, and no later pass ever retried it. The painter reported two withheld
		entities and the canvas showed three.

		Writing an attribute that is already set is free, and the alternative -- tracking whether
		each write succeeded -- is a second piece of state that can disagree with the DOM.
		*/
		for (const id of named) {
			if (visible.has(id)) {
				if (this.hidden.delete(id)) this.show(id);
			} else {
				this.hidden.add(id);
				this.hide(id);
			}
		}

		// the caption is held until replaced (plugins/simulation/reveal.mjs), so this emits only on a change --
		// a status bar re-rendering the same string ten times a second would defeat any typing.
		const { active } = beatsOf(rec, t);
		const caption = active?.caption ?? null;
		if (caption !== this.said) { this.said = caption; this.onCaption(caption); }
	}
}
