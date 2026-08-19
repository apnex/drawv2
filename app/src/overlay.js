/*
OVERLAY — draw transient feedback for the current pointer and selection.

One duty: everything that tells a person what WILL happen, and nothing that makes it happen. The
hover ring, the arming recolour, the re-plug and resize handles, the snap crosshair, the datum
marker, the zone-layer indicator. None of it commits; all of it disappears.

That is exactly what made this the risky part of H6 (docs/spec/INPUT.md §9): five of the six units
end in a commit, so the commit-boundary net proves they survived the move. This one commits nothing,
so it needed its own net first — `tests/affordance.test.js`, written at H2.6 against the behaviour
rather than the structure, and verified against five regressions of exactly this shape.

── WHY IT OWNS STATE, AND WHICH ──────────────────────────────────────────────────────────────────
`hovered`, `armed`, `datumEl` and the crosshair are the four fields whose ONLY purpose is deciding
what is currently drawn. They lived on Input beside `mode` and `ctx`, which is why "what gesture am
I in" and "what is highlighted" were one object with thirteen fields and no boundary between them.

Two inputs stay OUT: whether the client is read-only, and whether a gesture is in flight. Both are
the gesture layer's to know, so `arm()` takes them rather than reaching for them — this module must
not acquire an opinion about mutation, which is precisely the coupling that produced B18/B37/B42.
─────────────────────────────────────────────────────────────────────────────────────────────────*/

import { el } from './painter.js';
import { CANVAS, GAP, NODE_R, dist, zoneCorners } from './snap.js';
import { inFootprint } from './pick.js';
import { kindOf } from '../../model/index.mjs';

const HANDLE = 12;

export class Overlay {
	constructor({ svg, model, selection, renderer, snap }) {
		this.svg = svg;
		this.model = model;
		this.selection = selection;
		this.renderer = renderer;
		this.layer = svg.querySelector('#overlay');
		this.snapLayer = svg.querySelector('#snaplayer');

		this.hovered = null;      // the entity under the pointer, or null
		this.armed = null;        // { id, cls } — the delete / clone chord's target
		this.datumEl = null;      // the local-origin marker
		// B36 — ONE crosshair on #snaplayer, injected. Overlay and Palette each used to construct their
		// own on that same layer, so two could be drawn at once. Nothing showed it because Input's
		// onDown happens to hide the stamp hand first, which is correctness by remembering rather
		// than by construction. One instance makes the second impossible.
		this.crosshair = snap;
	}

	// ---- hover ----

	// `gesturing` is the caller's: a drag owns the pointer, so hover must not track under it
	hover(hit, on, evt, gesturing) {
		if (gesturing) return;
		if (!hit.id || hit.kind === 'handle') return;
		this.renderer.setState(hit.id, 'hover', on);
		if (!on) this.renderer.setState(hit.id, 'linkband', false);
		this.hovered = on ? hit.id : (this.hovered === hit.id ? null : this.hovered);
		// deliberately does NOT arm. Arming needs to know whether the client is read-only, and this
		// module must not hold that opinion (see the header). An early version self-armed here with
		// default options and momentarily armed while Server-Locked — corrected a line later by the
		// caller, but it had already told the renderer, which is a promise a locked client must not
		// make. The affordance test caught it. Arming is the caller's to sequence, with context.
	}

	// the pointer moved: is the hovered entity still under it? A node stays hovered anywhere in its
	// FOOTPRINT, a waypoint within its radius.
	refreshHover(pos) {
		if (!this.hovered) return this.disarm();
		const id = this.hovered;
		const ent = this.model.get(kindOf(id), id);
		const still = pos && ent && ent.x !== undefined
			&& (kindOf(id) === 'node' ? inFootprint(ent, pos, NODE_R) : dist(ent, pos) <= NODE_R);
		if (!still) {
			this.renderer.clearState(id, 'hover', 'linkband');
			this.hovered = null;
		}
		this.disarm();
	}

	// drop the hover for one id, or unconditionally (`null`) — a deleted entity, a document swap
	clearHover(id = null) {
		if (!this.hovered) return;
		if (id === null || this.hovered === id) {
			this.renderer.clearState(this.hovered, 'hover', 'linkband');
			this.hovered = null;
		}
	}

	// ---- arming: the chord that says "this click will delete / clone" ----

	/*
	`readOnly` and `gesturing` arrive from the caller. Arming red PROMISES a mutation, so a locked
	client must not show it — but this module has no business knowing what "locked" means, and every
	time that knowledge leaked into a positional check it produced a defect (B18, B37, B42).
	*/
	arm(evt, { readOnly = false, gesturing = false } = {}) {
		this.disarm();
		if (readOnly || !this.hovered || gesturing) return;
		const kind = kindOf(this.hovered);
		if (evt.altKey) this.armed = { id: this.hovered, cls: 'armed' };
		else if (evt.ctrlKey && (kind === 'node' || kind === 'zone')) this.armed = { id: this.hovered, cls: 'armed-clone' };
		if (this.armed) this.renderer.setState(this.armed.id, this.armed.cls, true);
	}

	disarm() {
		if (!this.armed) return;
		this.renderer.clearState(this.armed.id, 'armed', 'armed-clone');
		this.armed = null;
	}

	// ---- datum: a local origin for the readout (KiCad's space-bar convention) ----

	datum(pos) {
		if (this.datumEl) {
			this.datumEl.remove();
			this.datumEl = null;
		}
		if (!pos) return;
		this.datumEl = el('path', {
			class: 'datum',
			d: 'M 0 -8 L 8 0 L 0 8 L -8 0 Z M 0 -13 L 0 -8 M 0 8 L 0 13 M -13 0 L -8 0 M 8 0 L 13 0',
			transform: `translate(${pos.x},${pos.y})`
		}, this.snapLayer);
	}

	// ---- handles: the grab points a single selection offers ----

	/*
	Re-plug handles for a selected link, resize handles for a selected zone, nothing otherwise —
	handles are an affordance for ONE subject, so a multi-selection shows none.

	Cleared first, every time. That clear is load-bearing: without it handles accumulate on every
	selection change, and the affordance test that proves it could not fail until the harness's
	`querySelectorAll` stopped returning [] (H2.6).
	*/
	handles() {
		this.layer.querySelectorAll('.handle').forEach((h) => h.remove());
		const ids = this.selection.list();
		if (ids.length !== 1) return;
		const id = ids[0];

		if (kindOf(id) === 'link') {
			const path = this.model.pathOf(this.model.get('link', id));
			if (!path) return;
			// B29 — each handle sits on the route's OWN first/last segment, not on a straight line
			// between the ends. On a routed link those are different directions entirely, and the
			// handles used to float off the path they were supposed to grab.
			const along = (from, to) => {
				const d = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
				const off = Math.min(NODE_R + 6, d * 0.4);
				return { x: from[0] + (to[0] - from[0]) / d * off, y: from[1] + (to[1] - from[1]) / d * off };
			};
			this.#place({ src: along(path[0], path[1]), dst: along(path[path.length - 1], path[path.length - 2]) }, 6, 'end');
			return;
		}

		if (kindOf(id) !== 'zone') return;
		const z = this.model.get('zone', id);
		if (!z) return;
		this.#place(zoneCorners(z), 2, 'corner');
	}

	// one rect per named point, tagged with the dataset key the recognizer reads back
	#place(points, rx, datasetKey) {
		Object.entries(points).forEach(([name, p]) => {
			const h = el('rect', { class: 'handle', width: HANDLE, height: HANDLE,
				x: p.x - HANDLE / 2, y: p.y - HANDLE / 2, rx }, this.layer);
			h.dataset[datasetKey] = name;
		});
	}

	// ---- the zone-layer indicator ----

	// Shift raises the zone layer — but ortho-lock owns Shift mid-drag, so no flash during those
	zoneGrid(shiftHeld, moving) {
		this.svg.classList.toggle('zonegrid', !!shiftHeld && !moving);
	}
}
