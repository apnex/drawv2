/*
reveal.js -- the unfurl, applied to what is already on the canvas.

One concern: hiding the entities a beat has not reached yet, and saying what the beat is saying. It
owns no geometry, mints no elements and decides nothing about time -- `model/reveal.mjs` answers
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
off the same attribute this sets), and no caption typing. The caption TEXT is reported for whoever
owns the status bar to render; how it is typed out is presentation on top of a derived string, and
putting it here would make this module own a second concern.
*/
import { revealedAt, beatsOf } from '../../model/reveal.mjs';
import { loop, clockOf } from './paintloop.js';

// The floor, matching movers.js. Not a frame rate -- a reveal moves at human pace, and the rAF loop
// below is what makes it smooth when the tab is visible.
const TICK_MS = 100;

export class Reveal {
	constructor({ model, renderer, now, onCaption }) {
		this.model = model;
		this.renderer = renderer;
		this.now = clockOf(now);
		// the status-bar channel. Injected rather than reached for, so this module owns no DOM it
		// was not handed and can be driven with no page at all.
		this.onCaption = typeof onCaption === 'function' ? onCaption : () => {};
		this.loop = null;
		this.hidden = new Set();    // what we are currently withholding, so paint only touches deltas
		this.said = null;           // the last caption emitted, so an unchanged one is not re-sent
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
	sync() {
		if (!this.record()) { this.stop(); this.showAll(); return; }
		this.start();
		this.paint();
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

	show(id) {
		const dom = this.renderer.byId?.(id);
		if (dom) dom.removeAttribute('data-unrevealed');
	}

	hide(id) {
		const dom = this.renderer.byId?.(id);
		if (dom) dom.setAttribute('data-unrevealed', '');
	}

	/*
	One pass: hide what the beat has not reached, show what it has, and report the caption.

	Every id the record NAMES is either shown or hidden; an id it does not name is never touched, so
	a beat describing three entities has no opinion about the other forty. That is what makes a
	reveal additive over a complete document rather than a filter over one.
	*/
	paint() {
		const rec = this.record();
		if (!rec) return this.showAll();
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

		// the caption is held until replaced (model/reveal.mjs), so this emits only on a change --
		// a status bar re-rendering the same string ten times a second would defeat any typing.
		const { active } = beatsOf(rec, t);
		const caption = active?.caption ?? null;
		if (caption !== this.said) { this.said = caption; this.onCaption(caption); }
	}
}
