/*
Palette — HTML sidebar of node types. Lives OUTSIDE the SVG canvas so the
1920x1080 surface stays 100% diagram. Dragging an
item onto the canvas creates a node (ghost + crosshair feedback during drag).

K7 (H17): it is a VIEW of the held tools, not their owner. The stamp hand, the text tool and the hand's ghost live in
app/src/tools.js, the canvas layer, where the gesture machine reads them; a tile click asks the tools for a hand, as a
digit does, and the tiles light up for whatever the tools hold.
*/

import { snapNode } from './snap.js';
import { buildPreview } from './painter.js';   // each tile, a standalone <svg> in the sidebar outside the canvas (H26.4: it stays)
import { ghostNode } from './editing-visuals.js';   // H26.4: the dragged tile's ghost, an item of the canvas's scene


/*
B36 asked whether this and input.js's threshold are one constant written twice. They are not,
and the reason is worth stating rather than leaving as two bare numbers.

  PRESS_THRESHOLD_PIXELS  4   SCREEN pixels -- a press on the canvas becomes a drag past it, decided by
                              the gesture session on each fact's `screen` point. RESTATED at H26.6's
                              move 9 (dev/design/components/PAN-ZOOM.md section 3.2, PZ17): it was 4
                              CANVAS units, measured after toDrawing(), and so changed on screen with the
                              view; no drawing-unit threshold remains in draw.
  CLICK_SLOP              5   SCREEN pixels -- a tile press was a click, not a drag off the palette.
                              Measured on raw clientX/clientY, because a palette tile is chrome: it lives
                              outside the canvas transform and never moves with it. Unchanged at move 9:
                              it was in screen pixels already, as the design asks.

Both are screen distances now; they stay two because they decide two things -- a canvas press's
drag, inclusive of 4, and a tile's click, strictly under 5 -- and neither move changed either.
*/
const CLICK_SLOP = 5;

export class Palette {
	// C-e: `hand` -- what can be held and how an item looks, the devices plugin's; `stamp(item, pos)` -- a drop, stamped by the canvas
	// H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1): `scene`, the canvas's -- its ghost is put there, and a pointer's place
	// in the drawing is its `toDrawing`, the arithmetic `toCanvas` did
	// H26.6's move 7 (dev/design/components/PAN-ZOOM.md section 3.8): `root`, the canvas's root element, which a drop is decided over
	constructor({ container, root, scene, snap, tools, hand = null, stamp = () => false }) {
		this.root = root;
		this.scene = scene;
		this.snap = snap;   // B36 — the one crosshair, shared with Overlay; see overlay.js
		this.drag = null;
		this.tools = tools;   // K7: the held tools this palette shows and arms (app/src/tools.js)
		this.holdable = hand?.items ?? [];   // what the hand can hold, in order -- the devices plugin's (C-e)
		this.preview = hand?.preview;
		this.stamp = stamp;
		this.items = {};       // type -> tile element
		this.build(container);
		// the held type's tile lights up, whoever armed it -- a digit, Q, Escape, a lock, or this palette
		tools.onChange(() => Object.entries(this.items).forEach(([t, item]) => item.classList.toggle('held', t === tools.hand)));
		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.drag) {
				this.cancel();
				// this Esc is consumed by the drag-cancel: it must not also
				// clear the hand (input's handler runs after this one)
				e.stopImmediatePropagation();
			}
		});
	}

	cancel() {
		if (this.drag && this.drag.ghost) this.drag.ghost.remove();
		this.drag = null;
		this.snap.hide();
	}

	build(container) {
		this.holdable.forEach((type, i) => {
			const item = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			item.setAttribute('viewBox', '-26 -26 52 52');
			item.setAttribute('class', 'palette-item node');
			item.dataset.type = type;
			/*
			B205 -- THE TILE IS BUILT FROM THE KERNEL'S NUMBERS, not from numbers of its own.

			It hand-builds two layers: `<use href="#m-circle">` for the frame and `<use
			href="#glyph-*">` for the art. The frame matched, and so did the glyph REFERENCE -- a
			`<use>` is what makes one definition serve canvas, palette, export and favicon alike, and
			that was never the problem.

			What differed is the WRAPPER. Unwrapped, the use inherits `.icon`'s constant
			`scale(0.3)`; a canvas node nests it in an `<svg>` whose viewBox is the glyph's own
			bounding box, so the art is FITTED rather than scaled. Glyphs differ in extent -- router
			is 30x30, server 22.2x22.2 -- so one constant renders them at unequal sizes. Every tile
			was 65-74% undersized, each by a DIFFERENT amount, and the relative sizes went with them:
			on canvas a host glyph is a third larger than a router, and in the palette they were
			identical.

			Fixed by reading `GLYPH_BB[type]` and `STD.socket` -- the same values the kernel renders
			with -- rather than by copying today's output. Pinning the numbers here would work until
			the next geometry change moved one side and not the other, which is how this drifted.

			Rendering through `renderElement` was the first attempt and is the better idea: the tile
			would BE a kernel node rather than a structure built to match one. Its output is a
			string, and neither `insertAdjacentHTML` on an SVGElement nor `DOMParser` exists in the
			test environment, so it needs a DOM shim before it can land. The property that matters --
			one source for the numbers -- holds either way.
			*/
			// AMENDED at C-e step two (H19.33): the frame and the fitted glyph are the hand's preview -- the same numbers, now declared
			// by the devices plugin, and the ghost draws them too (B318)
			buildPreview(item, this.preview(type));
			// hotkey badge: digit i+1 arms this type into the hand
			const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			badge.setAttribute('class', 'digit-badge');
			badge.setAttribute('x', 18);
			badge.setAttribute('y', -14);
			badge.textContent = String(i + 1);
			item.appendChild(badge);
			item.addEventListener('pointerdown', (e) => this.onDown(e, item, type));
			container.appendChild(item);
			this.items[type] = item;
		});
		/*
		The waypoint is NOT a palette tile -- B146, ruled 2026-08-27.

		This panel lists node TYPES, and a waypoint is not one: it carries no type, no glyph and no
		name, because it is a routing anchor rather than a device on the canvas. `NODE_TYPES` holds
		six entries and never held it; the seventh tile existed only here, and forced a matching
		special case in `onHandDigit` and a `[1-7]` range in the keymap.

		Listing it also cost more than tidiness. The help row read `w / waypoint (7)`, which presents
		the palette slot number as a keyboard alias for the verb, and a reader who tries `7` mid-drag
		finds it refused and concludes the routing pivot is broken. That was B73, and it was a
		labelling defect the whole time.

		Nothing is lost. `w` places a waypoint idle (`placeWaypoint`) and mid-drag
		(`dropRouteWaypoint`), which is every case the tile covered except holding the key to stamp
		several -- and a routing anchor placed repeatedly with no link to bend is not a use anybody
		has.
		*/
	}

	onDown(evt, item, type) {
		if (this.tools.readOnly) return; // Server-Locked: palette is inert
		evt.preventDefault();
		try { item.setPointerCapture(evt.pointerId); } catch { /* synthetic events */ }
		this.drag = { type, ghost: null, sx: evt.clientX, sy: evt.clientY };
		const move = (e) => this.onMove(e);
		const up = (e) => {
			try { item.releasePointerCapture(evt.pointerId); } catch { /* synthetic events */ }
			item.removeEventListener('pointermove', move);
			item.removeEventListener('pointerup', up);
			this.onUp(e);
		};
		item.addEventListener('pointermove', move);
		item.addEventListener('pointerup', up);
	}

	/*
	H26.6's move 7 (dev/design/components/PAN-ZOOM.md section 3.8, "The palette's drop") -- OVER THE CANVAS, decided in screen space: a
	pointer is over the canvas when its screen point lies within the root's box and the topmost element there is the root or within it.
	It replaced `inCanvas`, a test of the drawing point against the old 1920 by 1080 frame, which also told a drop from a tile click and from
	a release over the page's chrome: now any drawing point the canvas shows takes a drop, and a release over the header or the palette
	takes none. Where a drop lands is the hand's snapping -- on the unbounded lattice since the extents went at move 11, so on the cell under
	the release however far out.
	*/
	overCanvas(evt) {
		const box = this.root.getBoundingClientRect(), x = evt.clientX, y = evt.clientY;
		if (!(x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)) return false;
		const top = this.root.ownerDocument.elementFromPoint(x, y);
		return !!top && (top === this.root || this.root.contains(top));
	}

	onMove(evt) {
		if (!this.drag) return;
		const pos = this.scene.toDrawing({ x: evt.clientX, y: evt.clientY });
		if (!this.overCanvas(evt)) {
			if (this.drag.ghost) { this.drag.ghost.remove(); this.drag.ghost = null; this.snap.hide(); }
			return;
		}
		if (!this.drag.ghost) this.drag.ghost = ghostNode(this.scene, this.preview(this.drag.type));   // the hand's preview (B318)
		this.drag.ghost.moveTo(pos);
		this.snap.show(snapNode(pos));
	}

	onUp(evt) {
		if (!this.drag) return;
		const { ghost, type, sx, sy } = this.drag;
		this.drag = null;
		if (ghost) ghost.remove();
		this.snap.hide();
		const pos = this.scene.toDrawing({ x: evt.clientX, y: evt.clientY });
		if (!this.overCanvas(evt)) {
			// a click on the tile (no drag) toggles the stamp hand
			if (Math.hypot(evt.clientX - sx, evt.clientY - sy) < CLICK_SLOP) this.tools.toggleHand(type);
			return;
		}
		// a drop stamps the tile's item where it lands, as a click with it held does: the hand's grid, its rule for what blocks a
		// stamp, the selection following (C-e)
		this.stamp(type, pos);
	}
}
