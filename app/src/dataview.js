/*
DataView — Tab-toggled numeric overlay (Factorio info X-ray): every node shows
its [x, y], every zone its [x, y] w×h, every link its length. Pointer-inert and
read-only; subscribes to the model so the tags track moves / resizes / undo live.
Units (px or cm) follow the readout's toggle; on/off state persists.
*/

import { el } from './painter.js';
import { NODE_R, dist } from './snap.js';

const KEY = 'draw.dataview';

export class DataView {
	constructor({ model, svg }) {
		this.model = model;
		this.layer = svg.querySelector('#dataview');
		try { this.units = localStorage.getItem('draw.units') === 'cm' ? 'cm' : 'px'; } catch { this.units = 'px'; }
		try { this.active = localStorage.getItem(KEY) === '1'; } catch { this.active = false; }
		this._raf = 0;
		// live: coalesce the model-change storm (a multi-entity drag fires set per
		// entity per frame) into ONE rebuild per animation frame
		model.onChange(() => this.schedule());
		this.render();
	}

	schedule() {
		if (!this.active || this._raf) return;
		if (typeof requestAnimationFrame !== 'function') return this.render();
		this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); });
	}

	toggle() {
		this.active = !this.active;
		try { localStorage.setItem(KEY, this.active ? '1' : '0'); } catch { /* private mode */ }
		this.render(); // immediate feedback on the keypress
	}

	// the readout owns the px/cm toggle and notifies us so the overlay stays in step
	setUnits(units) {
		this.units = units === 'cm' ? 'cm' : 'px';
		if (this.active) this.render();
	}

	// px snaps to whole units so a mid-drag (unsnapped) model value never shows
	// long fractions; committed values are grid-aligned and unaffected
	n(v) {
		return this.units === 'cm' ? (v / 100).toFixed(2) : String(Math.round(v));
	}

	render() {
		this.layer.innerHTML = '';
		if (!this.active) return;
		const u = this.units === 'cm' ? 'cm' : '';
		// nodes: [x, y] just above-right of the icon, clear of the label strip below
		this.model.all('node').forEach((nd) => {
			this.tag(nd.x + NODE_R - 2, nd.y - NODE_R - 4, `[${this.n(nd.x)}, ${this.n(nd.y)}]${u}`);
		});
		// zones: [x, y] w×h under the name
		this.model.all('zone').forEach((z) => {
			this.tag(z.x + 10, z.y + 40, `[${this.n(z.x)}, ${this.n(z.y)}]${u} ${this.n(z.w)}×${this.n(z.h)}${u}`);
		});
		// links: length at the midpoint, on a backing pill (lines cross other geometry)
		this.model.all('link').forEach((l) => {
			const s = this.model.get('node', l.src);
			const d = this.model.get('node', l.dst);
			if (!s || !d) return;
			this.tag((s.x + d.x) / 2, (s.y + d.y) / 2, `${this.n(Math.round(dist(s, d)))}${u}`, true);
		});
	}

	tag(x, y, text, pill) {
		if (pill) {
			const w = text.length * 7 + 6;
			el('rect', { class: 'data-pill', x: x - w / 2, y: y - 9, width: w, height: 13, rx: 3 }, this.layer);
		}
		const t = el('text', { class: 'data-tag', x, y, 'text-anchor': pill ? 'middle' : 'start' }, this.layer);
		t.textContent = text;
	}
}
