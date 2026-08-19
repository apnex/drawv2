/*
Readout — live coordinate display. One source of truth, mounted into any
number of DOM elements (placement comparison). Content by priority:
active gesture (drag target / box dims) > selection > snapped cursor.
A two-entity selection also reads its center-to-center Δ and length (a tape measure).
Units: model px, or cm under the 19.2cm metric deck standard (÷100);
clicking any mount toggles, persisted.
*/

import { kindOf } from '../../model/index.mjs';
import { GAP, spanExtent } from './snap.js';

const UNITS_KEY = 'draw.units';

export class Readout {
	constructor({ model, selection, elements }) {
		this.model = model;
		this.selection = selection;
		this.elements = elements.filter(Boolean);
		this.cursor = null;    // snapped grid point under the pointer
		this.transient = null; // gesture feedback string (drag target, box dims)
		this.datum = null;     // local origin: readout appends ∂ relative terms
		try { this.units = localStorage.getItem(UNITS_KEY) === 'cm' ? 'cm' : 'px'; } catch { this.units = 'px'; }

		this.elements.forEach((node) => {
			node.addEventListener('click', () => this.toggleUnits());
			node.title = 'model coordinates — click to toggle px/cm';
		});
		// committed moves/renames on selected entities refresh the display
		model.onChange((action, kind, entity) => {
			if (action !== 'load' && entity && this.selection.has(entity.id)) this.render();
			if (action === 'load') this.render();
		});
		this.render();
	}

	toggleUnits() {
		this.units = this.units === 'px' ? 'cm' : 'px';
		try { localStorage.setItem(UNITS_KEY, this.units); } catch { /* private mode */ }
		this.render();
		if (this.onUnitsChanged) this.onUnitsChanged(this.units); // e.g. the data-view overlay
	}

	n(v) {
		return this.units === 'cm' ? (v / 100).toFixed(2) : String(v);
	}

	pair(x, y) {
		return `[${this.n(x)}, ${this.n(y)}]${this.units === 'cm' ? 'cm' : ''}`;
	}

	dims(w, h) {
		return `${this.n(w)}×${this.n(h)}${this.units === 'cm' ? 'cm' : ''}`;
	}

	setCursor(pos, hand, blocked) {
		this.cursor = pos;
		this.cursorHand = hand || null;       // stamp-hand grammar on the cursor line
		this.cursorBlocked = !!blocked;
		this.render();
	}

	// datum (KiCad space-bar local origin): session-only, never persisted
	setDatum(pos) {
		this.datum = pos;
		this.render();
	}

	// relative term against the datum, in the current display units
	rel(x, y) {
		if (!this.datum) return '';
		return ` ∂[${this.n(x - this.datum.x)}, ${this.n(y - this.datum.y)}]${this.units === 'cm' ? 'cm' : ''}`;
	}

	signed(v) {
		return (v > 0 ? '+' : '') + v;
	}

	// gesture feedback: where the drag base will land / live box dimensions
	setDrag(pos, cells) {
		const d = cells ? ` Δ[${this.signed(cells.x)}, ${this.signed(cells.y)}]` : '';
		this.transient = `→ ${this.pair(pos.x, pos.y)}${d}${this.rel(pos.x, pos.y)}`;
		this.render();
	}

	// link gesture: source → target name, or the snapped cell under the cursor
	setLink(from, to) {
		this.transient = `${from} → ${typeof to === 'string' ? to : this.pair(to.x, to.y)}`;
		this.render();
	}

	setBox(box) {
		this.transient = `${this.pair(box.x, box.y)} ${this.dims(box.w, box.h)}`;
		this.render();
	}

	clearTransient() {
		this.transient = null;
		this.render();
	}

	// a brief receipt (duplicate / wrap-zone) that outranks everything, then reverts
	flash(msg, ms = 1200) {
		this.flashMsg = msg;
		this.render();
		if (this._flashTimer) clearTimeout(this._flashTimer);
		this._flashTimer = setTimeout(() => {
			this.flashMsg = null;
			this._flashTimer = null;
			this.render();
		}, ms);
	}

	selectionText() {
		const ids = this.selection.list();
		if (ids.length === 0) return null;
		if (ids.length === 1) {
			const id = ids[0];
			const kind = kindOf(id);
			const entity = this.model.get(kind, id);
			if (!entity) return null;
			if (kind === 'node') return `${entity.name || 'node'} ${this.pair(entity.x, entity.y)}${this.rel(entity.x, entity.y)}`;
			if (kind === 'zone') return `${entity.name || 'zone'} ${this.pair(entity.x, entity.y)} ${this.dims(entity.w, entity.h)}${this.rel(entity.x, entity.y)}`;
			if (kind === 'link') {
				// an ANCHOR is a node OR a waypoint (B29). A waypoint has no name — it is a bend, not a
				// component — so it reads as its position, which is the only thing that identifies it.
				const nameOf = (id) => {
					const e = this.model.endpointOf(id);
					if (!e) return '?';
					return e.name || this.pair(e.x, e.y);
				};
				return `${nameOf(entity.src)} ↔ ${nameOf(entity.dst)}`;
			}
			return id;
		}
		// multi-selection: count + bounding box of positioned entities, plus — for
		// exactly two — their center-to-center separation and length (a tape measure)
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		const centers = [];
		ids.forEach((id) => {
			const kind = kindOf(id);
			const entity = this.model.get(kind, id);
			if (!entity || entity.x === undefined) return;
			let w = entity.w || 0, h = entity.h || 0;
			if (kind === 'node' && entity.span) { const e = spanExtent(entity.span); w = e.sw; h = e.sh; }   // span-aware footprint
			minX = Math.min(minX, entity.x); minY = Math.min(minY, entity.y);
			maxX = Math.max(maxX, entity.x + w); maxY = Math.max(maxY, entity.y + h);
			centers.push({ x: entity.x + w / 2, y: entity.y + h / 2 });
		});
		if (centers.length === 0) return `${ids.length} selected`;
		let line = `${ids.length} selected ${this.pair(minX, minY)} – ${this.pair(maxX, maxY)}`;
		if (centers.length === 2) {
			const dx = Math.abs(centers[1].x - centers[0].x);
			const dy = Math.abs(centers[1].y - centers[0].y);
			const len = Math.round(Math.hypot(dx, dy));
			const u = this.units === 'cm' ? 'cm' : '';
			line += `  Δ[${this.n(dx)}, ${this.n(dy)}]${u} L ${this.n(len)}${u}`;
		}
		return line;
	}

	cursorText() {
		if (!this.cursor) return '';
		const at = `${this.pair(this.cursor.x, this.cursor.y)}${this.rel(this.cursor.x, this.cursor.y)}`;
		if (this.cursorHand) {
			return this.cursorBlocked
				? `stamp ${this.cursorHand} ✗ occupied ${at}`
				: `stamp ${this.cursorHand} → ${at}`;
		}
		return `cursor ${at}`;
	}

	render() {
		// a LIVE gesture (transient, set only mid-drag) always wins — the readout is
		// the placement instrument. Otherwise a flash receipt outranks the idle lines,
		// and a held hand outranks the selection line.
		const text = this.transient
			|| this.flashMsg
			|| (this.cursorHand ? this.cursorText() : null)
			|| this.selectionText()
			|| this.cursorText();
		this.elements.forEach((node) => { node.textContent = text; });
	}
}
