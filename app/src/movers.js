/*
movers.js — DRAWING the movers. One concern, and it is presentation only.

This is the render half of the simulation/render split. It reads what `engine/movers.mjs` computes
and never answers back: no measurement here feeds a decision, and nothing upstream asks this layer
where anything is. Truth flows one way. Reading positions back out of the DOM would make the
compositor authoritative, break determinism, and leave the server -- which has no DOM -- unable to
answer the same question. It is the one rule this file has.

WHY THE BROWSER ANIMATES RATHER THAN A FRAME LOOP. `offset-path` takes the very path string the
kernel already produces, and the compositor interpolates between frames off the main thread. A
`requestAnimationFrame` loop setting `cx`/`cy` would do the same job with more code, on the main
thread, and would stutter under load exactly when a diagram is busiest.

AND WHY THAT DOES NOT MAKE THE BROWSER THE TRUTH. Each animation is SEEDED: `currentTime` is set
from the agreed clock, so the browser is told where in the cycle it already is rather than starting
from now. Two peers therefore draw the same mover in the same place without exchanging a message,
and `positionOf` still answers the same question in a test with no browser at all. The kernel and
the browser were measured to agree to 0.0145px, which is what `tests/route-oracle.test.js` holds.

MOTION IS RUN-MODE ONLY, by the director's ruling: nothing animates while a diagram is being
authored. The spawn CONFIG stays visible in every mode -- that is the renderer's business, not this
file's -- so an author can see that an endpoint emits without it moving under their cursor.
*/

import { el } from './painter.js';
import { prepareSpawner, moversAt } from '../../engine/index.mjs';
import { roundedPath, BEND_R } from '../../kernel/index.mjs';

// how often to look for a NEWLY DEPARTED mover. Not a frame rate -- the compositor owns motion.
const TICK_MS = 200;

export class Movers {
	constructor({ model, renderer, layer, now }) {
		this.model = model;
		this.renderer = renderer;
		this.layer = layer;
		this.now = typeof now === 'function' ? now : () => Date.now();
		this.anims = new Map();     // mover id -> { el, anim }
		this.timer = null;
	}

	/*
	Every armed endpoint, described for the simulation.

	`spawn` lives on the waypoint; the ROUTE it emits along, and the DIRECTION, come from the link
	that waypoint terminates. Pressing the `src` end sends movers src to dst and pressing `dst` sends
	them the other way -- which is why direction is never stored: reversing a route reverses the
	movers for free, and a stored copy would have been wrong the moment that happened.
	*/
	spawners() {
		const out = [];
		for (const wp of this.model.all('waypoint')) {
			if (!wp.spawn) continue;
			const links = this.model.linksAt?.(wp.id) || [];
			const link = links.find((l) => (l.src === wp.id || l.dst === wp.id) && !l.closed);
			if (!link) continue;                       // a ring has no ends, so it emits nothing
			const pts = this.model.pathOf(link);
			if (!pts || pts.length < 2) continue;      // a dangling route resolves to nothing
			out.push(prepareSpawner({
				id: wp.id,
				pts: link.src === wp.id ? pts : [...pts].reverse(),
				closed: false,
				radius: BEND_R,
				...wp.spawn,
			}));
		}
		return out;
	}

	// run mode shows motion; every other mode is still. Called on mode change and on every commit.
	sync() {
		if (this.renderer.mode !== 'run') return this.stop();
		this.start();
		this.render();
	}

	/*
	A SLOW tick, and only to create what has newly departed.

	The compositor moves everything that already exists, so nothing here runs per frame. What a
	timer is needed for is the moment a new mover leaves: `moversAt` will start listing it, and an
	element has to exist for the browser to animate. 200ms is well under the 50ms floor... no --
	well under any authorable interval's visible consequence, and a mover created a fraction late
	is SEEDED to its true position rather than starting from zero, so lateness costs nothing.
	*/
	start() {
		if (this.timer) return;
		this.timer = setInterval(() => this.render(), TICK_MS);
	}

	stop() {
		if (this.timer) { clearInterval(this.timer); this.timer = null; }
		this.clear();
	}

	render() {
		const prepared = this.spawners();
		const live = moversAt(prepared, this.now());
		const seen = new Set();
		const byId = new Map(prepared.map((s) => [s.id, s]));

		/*
		B171 -- a mover in flight must adopt a route that changed under it.

		The old line here read *already flying: leave the compositor alone*, which is right while the
		geometry holds and wrong the moment it does not. `offset-path` is baked onto the element at
		creation, so moving an endpoint left packets travelling a line the diagram no longer drew --
		two distinct paths in the air at once, measured at 8 old against 2 new.

		The simulation never had this problem: `moversAt` reads the live document every call, so the
		progress below is ALREADY correct for the new route. Only the drawing was stale, which is why
		the fix is to rebuild the element from the simulation rather than to compute anything new.

		Travel is PRESERVED, not restarted. Speed is constant, so what is conserved is distance
		covered, and `m.progress` is that distance against the new length -- reseeding from it puts a
		mover where it genuinely is. Restarting the animation instead would teleport every packet
		back to its source on any edit, which is a worse defect than the one being fixed.
		*/
		for (const m of live) {
			seen.add(m.id);
			const s = byId.get(m.spawnerId);
			const rec = this.anims.get(m.id);
			if (rec) {
				if (rec.d === this.pathOf(s)) continue;   // same route: leave the compositor alone
				rec.anim?.cancel();
				rec.el.remove();
				this.anims.delete(m.id);
			}
			this.spawnEl(m, s);
		}
		// a mover the simulation no longer lists has been consumed -- it arrived, or its spawner
		// was disarmed. Either way the element goes; nothing is "destroyed" in the simulation.
		for (const [id, rec] of this.anims) {
			if (seen.has(id)) continue;
			rec.anim?.cancel();
			rec.el.remove();
			this.anims.delete(id);
		}
	}

	// the route as the browser will be given it. One function, so the string an element was BUILT
	// with and the string it is COMPARED against cannot drift -- which is the whole mechanism here.
	pathOf(spawner) {
		return spawner ? roundedPath(spawner.pts, spawner.radius ?? BEND_R, false) : null;
	}

	spawnEl(mover, spawner) {
		if (!spawner || !this.layer) return;
		const d = this.pathOf(spawner);
		// B45 -- `painter.el` rather than `document.createElementNS`. A DOM global welds a module to
		// the one page it happens to run on; the painter is the surface that legitimately owns it.
		// the mover's stable identity travels onto the element, so anything inspecting the page --
		// a probe, a future overlay, a person in devtools -- can follow ONE mover rather than whichever
		// happens to be first in the DOM. Costs an attribute; without it, identity is unobservable.
		// B172 -- the KIND names a class and the stylesheet owns the look, so one edit reaches every
		// packet including those already armed. A stored hex could never do that; three repaints proved it.
		const dot = el('circle', { r: 6, class: `mover ${spawner.kind || 'packet'}`, 'data-mover': mover.id }, this.layer);
		dot.style.offsetPath = `path("${d}")`;
		dot.style.offsetRotate = '0deg';          // a packet does not bank into the corners

		const duration = (spawner.length / spawner.pxSpeed) * 1000;   // px/px-per-s; the cells conversion is the simulation's
		const anim = dot.animate(
			[{ offsetDistance: '0%' }, { offsetDistance: '100%' }],
			{ duration, fill: 'forwards' },
		);
		// SEEDED, not started: the browser is told how far through it already is, from the shared
		// clock. This one line is the whole reason two tabs agree.
		anim.currentTime = mover.progress * duration;
		// `d` is remembered so the next pass can tell whether the route moved underneath it
		this.anims.set(mover.id, { el: dot, anim, d });
	}

	clear() {
		for (const [, rec] of this.anims) { rec.anim?.cancel(); rec.el.remove(); }
		this.anims.clear();
	}
}
