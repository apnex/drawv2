/*
Palette — HTML sidebar of node types. Lives OUTSIDE the SVG canvas so the
1920x1080 surface stays 100% diagram (it maps 1:1 to a slide). Dragging an
item onto the canvas creates a node (ghost + crosshair feedback during drag).
Also owns the STAMP HAND: a held node type (digits 1-6, Q pipette, or a tile
click) whose ghost rides the snapped cell; input.js stamps it on click.
*/

import { CANVAS, GAP, snapNode } from './snap.js';
import { toCanvas, ghostNode } from './painter.js';
import * as commands from './commands.js';

export const NODE_TYPES = ['host', 'server', 'loadbalancer', 'firewall', 'vxlan', 'router'];

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
	constructor({ container, svg, model, history, selection, snap }) {
		this.svg = svg;
		this.model = model;
		this.history = history;
		this.selection = selection;
		this.overlay = svg.querySelector('#overlay');
		this.snap = snap;   // B36 — the one crosshair, shared with Overlay; see overlay.js
		this.drag = null;
		/*
		The two HELD TOOLS. Both are "armed, waiting for a canvas action", and they are separate
		fields rather than one because they are consumed differently: a hand STAMPS on click and needs
		a type to stamp, the text tool DRAGS a frame and is a mode. Collapsing them to one value would
		make every `hand` consumer special-case a type that cannot be stamped.

		What they DO share is a lifecycle, and that is what B42 was: `setReadOnly` cleared the hand and
		the delete arming and forgot the text tool, so a tool armed before a Server-Locked handoff
		outlived it and authored a box on the next click. The asymmetry existed because the list of
		things to clear lived at each call site. `releaseTools()` is that list, here, once.
		*/
		this.hand = null;      // held node type (stamp hand), or null
		this.textTool = false; // A1 — 't' armed: a drag draws a text box (mirrors Shift+drag-zone)
		this.handGhost = null;
		this.readOnly = false; // Server-Locked: no creation from the palette
		this.items = {};       // type -> tile element
		this.build(container);
		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.drag) {
				this.cancel();
				// this Esc is consumed by the drag-cancel: it must not also
				// clear the hand (input's handler runs after this one)
				e.stopImmediatePropagation();
			}
		});
	}

	// ---- the stamp hand ----
	toggleHand(type) {
		this.setHand(this.hand === type ? null : type);
	}

	setHand(type) {
		this.hand = type || null;
		Object.entries(this.items).forEach(([t, item]) =>
			item.classList.toggle('held', t === this.hand));
		// ANY change drops the ghost: its icon is baked at creation, so a stale
		// ghost would show a different type than the click will stamp
		this.hideHand();
	}

	// A1 — arm/disarm the text tool. A toggle, not a held key: you do not hold `t` while you mouse.
	setTextTool(on) {
		this.textTool = !!on;
		this.svg.classList.toggle('texttool', this.textTool);
	}

	// is ANY authoring tool armed? The predicate B42 needed and nobody had.
	holding() {
		return !!this.hand || this.textTool;
	}

	// drop every armed tool. One call, so a THIRD tool is added here rather than at each site that
	// has to remember it — a document swap, a Server-Locked handoff, an Escape.
	releaseTools() {
		this.setHand(null);
		this.setTextTool(false);
	}

	// ghost rides the SNAPPED cell; red when the cell is occupied (won't stamp)
	trackHand(pos, blocked) {
		if (!this.hand) return;
		if (!this.handGhost) this.handGhost = ghostNode(this.overlay, this.hand);
		this.handGhost.moveTo(pos);
		this.handGhost.setBlocked(blocked);
		this.snap.show(pos);
	}

	hideHand() {
		if (this.handGhost) {
			this.handGhost.remove();
			this.handGhost = null;
			this.snap.hide();
		}
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
			// tiles show the default (circle) frame + the type's glyph — the two layers
			const frame = document.createElementNS('http://www.w3.org/2000/svg', 'use');
			frame.setAttribute('href', '#m-circle');
			item.appendChild(frame);
			const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
			use.setAttribute('href', `#glyph-${type}`);
			item.appendChild(use);
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
		if (this.readOnly) return; // Server-Locked: palette is inert
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
			if (Math.hypot(evt.clientX - sx, evt.clientY - sy) < CLICK_SLOP) this.toggleHand(type);
			return;
		}
		const snapped = snapNode(pos);
		const entity = type === 'waypoint' ? this.model.makeWaypoint(snapped) : this.model.makeNode(type, snapped);
		this.history.commit(commands.createEntity(type === 'waypoint' ? 'waypoint' : 'node', entity));
		this.selection.set([entity.id]);
	}
}
