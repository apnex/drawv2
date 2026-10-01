/*
Palette — HTML sidebar of node types. Lives OUTSIDE the SVG canvas so the
1920x1080 surface stays 100% diagram (it maps 1:1 to a slide). Dragging an
item onto the canvas creates a node (ghost + crosshair feedback during drag).

K7 (H17): it is a VIEW of the held tools, not their owner. The stamp hand, the text tool and the hand's ghost live in
app/src/tools.js, the canvas layer, where the gesture machine reads them; a tile click asks the tools for a hand, as a
digit does, and the tiles light up for whatever the tools hold.
*/

import { CANVAS, GAP, snapNode } from './snap.js';
import { toCanvas, ghostNode } from './painter.js';
import * as commands from './commands.js';
import { NODE_TYPES } from './tools.js';
import { GLYPH_BB } from '../../kernel/theme.mjs';
import { STD } from '../../kernel/spec.mjs';


/*
B36 asked whether this and input.js's DRAG_THRESHOLD are one constant written twice. They are not,
and the reason is worth stating rather than leaving as two bare numbers.

  DRAG_THRESHOLD  4   CANVAS units — a press becomes a drag. Measured after toCanvas(), so it is a
                      distance in document space and survives pan/zoom: four units is four units
                      whatever the viewport is doing.
  CLICK_SLOP      5   SCREEN pixels — a tile press was a click, not a drag off the palette. Measured
                      on raw clientX/clientY, because a palette tile is chrome: it lives outside the
                      canvas transform and never moves with it.

Collapsing them would mean comparing a document-space distance with a screen-space one, which are
equal only at 1:1 zoom. Two constants is the correct answer; two ANONYMOUS constants was not.
*/
const CLICK_SLOP = 5;

export class Palette {
	constructor({ container, svg, model, history, selection, snap, tools }) {
		this.svg = svg;
		this.model = model;
		this.history = history;
		this.selection = selection;
		this.overlay = svg.querySelector('#overlay');
		this.snap = snap;   // B36 — the one crosshair, shared with Overlay; see overlay.js
		this.drag = null;
		this.tools = tools;   // K7: the held tools this palette shows and arms (app/src/tools.js)
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
		NODE_TYPES.forEach((type, i) => {
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
			const frame = document.createElementNS('http://www.w3.org/2000/svg', 'use');
			frame.setAttribute('href', '#m-circle');
			item.appendChild(frame);

			// the glyph FITTED to its own bounding box in a socket-sized box -- the nested <svg> the
			// kernel emits, built with DOM calls because the numbers are what must not drift, and
			// parsing the kernel's string needs a DOMParser the test environment does not have
			const [bx, by, bw, bh] = GLYPH_BB[type] || GLYPH_BB.host;
			const S = STD.socket;
			const box = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			box.setAttribute('x', -S / 2);
			box.setAttribute('y', -S / 2);
			box.setAttribute('width', S);
			box.setAttribute('height', S);
			box.setAttribute('viewBox', `${bx} ${by} ${bw} ${bh}`);
			box.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
			use.setAttribute('href', `#glyph-${type}`);
			box.appendChild(use);
			item.appendChild(box);
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

	inCanvas(pos) {
		return Math.abs(pos.x) <= CANVAS.hw && Math.abs(pos.y) <= CANVAS.hh;
	}

	onMove(evt) {
		if (!this.drag) return;
		const pos = toCanvas(evt, this.svg);
		if (!this.inCanvas(pos)) {
			if (this.drag.ghost) { this.drag.ghost.remove(); this.drag.ghost = null; this.snap.hide(); }
			return;
		}
		if (!this.drag.ghost) this.drag.ghost = ghostNode(this.overlay, this.drag.type);
		this.drag.ghost.moveTo(pos);
		this.snap.show(snapNode(pos));
	}

	onUp(evt) {
		if (!this.drag) return;
		const { ghost, type, sx, sy } = this.drag;
		this.drag = null;
		if (ghost) ghost.remove();
		this.snap.hide();
		const pos = toCanvas(evt, this.svg);
		if (!this.inCanvas(pos)) {
			// a click on the tile (no drag) toggles the stamp hand
			if (Math.hypot(evt.clientX - sx, evt.clientY - sy) < CLICK_SLOP) this.tools.toggleHand(type);
			return;
		}
		const snapped = snapNode(pos);
		const entity = type === 'waypoint' ? this.model.makeWaypoint(snapped) : this.model.makeNode(type, snapped);
		this.history.commit(commands.createEntity(type === 'waypoint' ? 'waypoint' : 'node', entity));
		this.selection.set([entity.id]);
	}
}
