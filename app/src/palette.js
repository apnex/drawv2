/*
Palette — HTML sidebar of node types. Lives OUTSIDE the SVG canvas so the
1920x1080 surface stays 100% diagram (it maps 1:1 to a slide). Dragging an
item onto the canvas creates a node (ghost + crosshair feedback during drag).
Also owns the STAMP HAND: a held node type (digits 1-6, Q pipette, or a tile
click) whose ghost rides the snapped cell; input.js stamps it on click.
*/

import { CANVAS, GAP, snapNode } from './snap.js';
import { toCanvas, ghostNode, crosshair } from './painter.js';
import * as commands from './commands.js';

export const NODE_TYPES = ['host', 'server', 'loadbalancer', 'firewall', 'vxlan', 'router'];

export class Palette {
	constructor({ container, svg, model, history, selection }) {
		this.svg = svg;
		this.model = model;
		this.history = history;
		this.selection = selection;
		this.overlay = svg.querySelector('#overlay');
		this.snap = crosshair(svg.querySelector('#snaplayer'), CANVAS, GAP);
		this.drag = null;
		this.hand = null;      // held node type (stamp hand), or null
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
		// tile #7: the Waypoint — a routing pivot / single-use link terminal (a ring, no glyph)
		const NS = 'http://www.w3.org/2000/svg';
		const wp = document.createElementNS(NS, 'svg');
		wp.setAttribute('viewBox', '-26 -26 52 52');
		wp.setAttribute('class', 'palette-item node');
		wp.dataset.type = 'waypoint';
		const ring = document.createElementNS(NS, 'circle');
		ring.setAttribute('r', 20); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#4fc3f7'); ring.setAttribute('stroke-width', 2);
		wp.appendChild(ring);
		const wdot = document.createElementNS(NS, 'circle');
		wdot.setAttribute('r', 2.6); wdot.setAttribute('fill', '#4fc3f7');
		wp.appendChild(wdot);
		const wbadge = document.createElementNS(NS, 'text');
		wbadge.setAttribute('class', 'digit-badge'); wbadge.setAttribute('x', 18); wbadge.setAttribute('y', -14);
		wbadge.textContent = '7';
		wp.appendChild(wbadge);
		wp.addEventListener('pointerdown', (e) => this.onDown(e, wp, 'waypoint'));
		container.appendChild(wp);
		this.items['waypoint'] = wp;
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
			if (Math.hypot(evt.clientX - sx, evt.clientY - sy) < 5) this.toggleHand(type);
			return;
		}
		const snapped = snapNode(pos);
		const entity = type === 'waypoint' ? this.model.makeWaypoint(snapped) : this.model.makeNode(type, snapped);
		this.history.commit(commands.createEntity(type === 'waypoint' ? 'waypoint' : 'node', entity));
		this.selection.set([entity.id]);
	}
}
