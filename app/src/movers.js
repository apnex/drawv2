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
import { moversAt, spawnersOf, worldOf, combatAt } from '../../engine/index.mjs';
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
		this.beams = new Map();     // tower id -> { line, targetId }
		this.beamLayer = null;
		this.moverLayer = null;
		this.deaths = new Map();    // mover id -> tick it died, from the last fold
		this.timer = null;
		this.raf = null;
	}

	/*
	Every armed endpoint, described for the simulation.

	`spawn` lives on the waypoint; the ROUTE it emits along, and the DIRECTION, come from the link
	that waypoint terminates. Pressing the `src` end sends movers src to dst and pressing `dst` sends
	them the other way -- which is why direction is never stored: reversing a route reverses the
	movers for free, and a stored copy would have been wrong the moment that happened.
	*/
	// B174 -- the adapter moved to `engine/spawners.mjs`. It reads only the model, so keeping it here
	// made it unreachable from anywhere but a browser tab, and a client-side report could not be
	// investigated without a human reading numbers out of a console.
	spawners() {
		return spawnersOf(this.model);
	}

	// run mode shows motion; every other mode is still. Called on mode change and on every commit.
	sync() {
		if (this.renderer.mode !== 'run') return this.stop();
		this.start();
		this.fold();
		this.paint();
	}

	/*
	Two layers, in a fixed order, because the order is the visual.

	A beam drawn BEHIND an opaque packet is occluded from the packet's near edge inward, so the line
	appears to stop at the edge rather than reach the middle -- which is precisely what a laser
	should not look like. Movers were appended to the layer continuously and the beam group was
	created once, so every packet made after the first beam landed on top of it. Ordering the two
	groups explicitly makes that independent of when anything was created.
	*/
	layers() {
		if (!this.layer) return false;
		if (!this.moverLayer || !this.moverLayer.isConnected) {
			this.moverLayer = el('g', { class: 'packets' }, this.layer);
			this.beamLayer = el('g', { class: 'beams' }, this.layer);   // second child: drawn over the packets
		}
		return true;
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
		this.timer = setInterval(() => this.fold(), TICK_MS);
		/*
		A frame loop, which this file otherwise refuses -- and the exception is narrow enough to state.

		The compositor owns MOTION because a mover's whole journey is known when it departs, so the
		browser can be handed a path and left alone. A beam has no such journey: it is a line between
		two things that are both moving, and nothing can interpolate it for us.

		It is still not reading the DOM back. Each frame recomputes the target's position from the
		SIMULATION -- `moversAt`, measured at 0.006ms -- and writes it out. Truth still flows one way;
		what changed is only that this consumer needs it more often than five times a second.

		The expensive half stays slow: `combatAt` folds damage over the transit window at 2.87ms a
		call, so WHO is being burned is decided at TICK_MS and only WHERE they are is tracked here.
		*/
		const frame = () => {
			this.paint();
			this.trackBeams();
			this.raf = requestAnimationFrame(frame);
		};
		this.raf = requestAnimationFrame(frame);
	}

	stop() {
		if (this.timer) { clearInterval(this.timer); this.timer = null; }
		this.deaths = new Map();
		if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
		this.clear();
	}

	/*
	THE SLOW HALF -- who is alive, who is dead, who is being burned.

	`combatAt` folds damage over the transit window at 2.87ms a call, which is the cost the deviation
	tier knowingly buys: a damaged mover accumulates state, so the answer has to be folded rather
	than evaluated. Kept at TICK_MS because the ANSWER changes slowly -- a creep takes three hits to
	die -- while its POSITION changes every frame.
	*/
	fold() {
		const world = worldOf(this.model);
		const combat = combatAt(world, this.now());
		this.deaths = combat.dead;
		this.syncBeams(world, combat);
	}

	/*
	THE FAST HALF -- which elements should exist, run every frame.

	This used to run at TICK_MS with the fold, and that was visible: an element is only created once
	`moversAt` lists its mover, so a packet departing just after a tick waited up to 200ms to appear,
	then was SEEDED to its true position and popped into existence 8.4px along its route. With a
	900ms interval against a 200ms tick the phase alternates, so every other packet emerged from the
	source centre and the ones between it did not -- which is exactly what the director reported.

	Running it per frame drops the worst case to one frame, about 1.4px, and costs almost nothing:
	`moversAt` is 0.006ms because an undamaged mover is still a closed form of `t`. Only the fold is
	expensive, and the fold stayed where it was.
	*/
	paint() {
		if (!this.layers()) return;
		const prepared = this.spawners();
		const dead = this.deaths || new Map();
		const live = moversAt(prepared, this.now()).filter((m) => !dead.has(m.id));
		const seen = new Set();
		const byId = new Map(prepared.map((s) => [s.id, s]));
		// one path string per SPAWNER per frame, not one per mover: `roundedPath` builds a string,
		// and rebuilding it for each of twenty packets sixty times a second is work for nothing.
		const paths = new Map(prepared.map((s) => [s.id, this.pathOf(s)]));

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
				if (rec.d === paths.get(m.spawnerId)) continue;   // same route: leave the compositor alone
				rec.anim?.cancel();
				rec.el.remove();
				this.anims.delete(m.id);
			}
			this.spawnEl(m, s, paths.get(m.spawnerId));
		}
		// a mover the simulation no longer lists is gone: it arrived, its spawner was disarmed, or a
		// tower killed it. The element goes either way -- this layer does not need to know which.
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

	spawnEl(mover, spawner, path) {
		if (!spawner || !this.layers()) return;
		const d = path || this.pathOf(spawner);
		// B45 -- `painter.el` rather than `document.createElementNS`. A DOM global welds a module to
		// the one page it happens to run on; the painter is the surface that legitimately owns it.
		// the mover's stable identity travels onto the element, so anything inspecting the page --
		// a probe, a future overlay, a person in devtools -- can follow ONE mover rather than whichever
		// happens to be first in the DOM. Costs an attribute; without it, identity is unobservable.
		// B172 -- the KIND names a class and the stylesheet owns the look, so one edit reaches every
		// packet including those already armed. A stored hex could never do that; three repaints proved it.
		const dot = el('circle', { r: 6, class: `mover ${spawner.kind || 'packet'}`, 'data-mover': mover.id }, this.moverLayer);
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

	/*
	Which tower is burning which mover, refreshed at TICK_MS.

	A beam is not a projectile and deliberately so -- ruled 2026-09-02. It connects instantaneously,
	so there is nothing in flight to derive a position for, and no question of what a shot does when
	its target dies before it lands. The line drawn here IS the hit.
	*/
	syncBeams(world, combat) {
		if (!this.layers()) return;
		const towers = new Map(world.towers.map((t) => [t.id, t]));
		const firing = new Set();
		for (const f of combat.hits) {
			firing.add(f.tower);
			const t = towers.get(f.tower);
			let rec = this.beams.get(f.tower);
			if (!rec) {
				const line = el('line', { class: 'beam', x1: t.x, y1: t.y, x2: t.x, y2: t.y }, this.beamLayer);
				rec = { line, targetId: f.target };
				this.beams.set(f.tower, rec);
			}
			rec.targetId = f.target;
			rec.line.setAttribute('x1', t.x);
			rec.line.setAttribute('y1', t.y);
		}
		// a tower that stopped firing -- cooled down, or ran out of targets in range
		for (const [id, rec] of this.beams) {
			if (firing.has(id)) continue;
			rec.line.remove();
			this.beams.delete(id);
		}
	}

	// the fast half: only the far END of each live beam, recomputed from the simulation each frame
	trackBeams() {
		if (!this.beams.size) return;
		const live = moversAt(this.spawners(), this.now());
		const at = new Map(live.map((m) => [m.id, m.at]));
		for (const [, rec] of this.beams) {
			const p = at.get(rec.targetId);
			if (!p) continue;                       // target died this frame; the next pass removes the line
			rec.line.setAttribute('x2', p[0]);
			rec.line.setAttribute('y2', p[1]);
		}
	}

	clear() {
		for (const [, rec] of this.anims) { rec.anim?.cancel(); rec.el.remove(); }
		this.anims.clear();
		for (const [, rec] of this.beams) rec.line.remove();
		this.beams.clear();
	}
}
