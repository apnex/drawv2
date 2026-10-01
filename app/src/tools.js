/*
TOOLS -- the held authoring tools: the stamp hand (a node type a click stamps), the text tool (a drag draws a text box),
and the ghost that rides the snapped cell while a hand is held. H17 cut K7.

They lived on the palette -- an HTML sidebar of tiles, chrome -- and Input reached into it for every one, so the canvas
depended on its own page's widget to know what the author was holding. A held tool is canvas state: the gesture machine
reads it (`tool` in the situation, `hand` in a release's facts) and the canvas draws its ghost. So it lives here, in the
canvas layer, and the palette is one VIEW of it: its tiles light up for the held type (`onChange`), and a tile click asks
for a hand like a digit does. The palette is not needed to hold one: a composition without it can still pass tools.
The lab passes none, as before -- its Input holds nothing, so digits and `t` stay inert there.

`NODE_TYPES` came with it: the digits 1-6 index it, which makes it the hand's list. One device table, shared with the
CLI's glyph map, is cut K6's to build; until then this is the one literal, and the palette reads it from here.
*/
import { ghostNode } from './painter.js';

export const NODE_TYPES = ['host', 'server', 'loadbalancer', 'firewall', 'vxlan', 'router'];

export class Tools {
	constructor({ svg, snap }) {
		this.svg = svg;
		this.overlay = svg.querySelector('#overlay');
		this.snap = snap;   // B36 — the one crosshair, shared with Overlay; see overlay.js
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
		this.readOnly = false; // Server-Locked: nothing is armed and nothing is created (Input sets it; the palette reads it)
		this.listeners = [];
	}

	// a view that shows what is held -- the palette's tiles -- hears every change
	onChange(fn) {
		this.listeners.push(fn);
	}

	notify() {
		for (const fn of this.listeners) fn(this);
	}

	// ---- the stamp hand ----
	toggleHand(type) {
		this.setHand(this.hand === type ? null : type);
	}

	setHand(type) {
		this.hand = type || null;
		// ANY change drops the ghost: its icon is baked at creation, so a stale
		// ghost would show a different type than the click will stamp
		this.hideHand();
		this.notify();
	}

	// A1 — arm/disarm the text tool. A toggle, not a held key: you do not hold `t` while you mouse.
	setTextTool(on) {
		this.textTool = !!on;
		this.svg.classList.toggle('texttool', this.textTool);
		this.notify();
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
}
