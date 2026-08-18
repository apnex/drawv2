/*
Painter — low-level SVG DOM helpers + ephemeral overlay widgets
(snap crosshair, ghost node, preview rect, live link). v1 painter lineage:
no model knowledge, raw canvas coordinates only.
*/

const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent = null) {
	const node = document.createElementNS(NS, tag);
	setAttrs(node, attrs);
	if (parent) parent.appendChild(node);
	return node;
}

export function setAttrs(node, attrs) {
	for (const key in attrs) {
		if (key === 'href') {
			node.setAttribute('href', attrs[key]);
		} else {
			node.setAttributeNS(null, key, attrs[key]);
		}
	}
	return node;
}

// translate a pointer event into logical canvas coordinates
export function toCanvas(evt, svg) {
	const pt = new DOMPoint(evt.clientX, evt.clientY);
	return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// ---- overlay widgets ----

// v1's crosshair + cell-box snap feedback
export function crosshair(overlay, canvas, gap) {
	let v = null, h = null, box = null;
	return {
		show(pos) {
			if (!v) {
				v = el('line', { class: 'gridline' }, overlay);
				h = el('line', { class: 'gridline' }, overlay);
				box = el('rect', { class: 'snapbox', width: gap, height: gap }, overlay);
			}
			setAttrs(v, { x1: pos.x, y1: -canvas.hh, x2: pos.x, y2: canvas.hh });
			setAttrs(h, { x1: -canvas.hw, y1: pos.y, x2: canvas.hw, y2: pos.y });
			setAttrs(box, { x: pos.x - gap / 2, y: pos.y - gap / 2 });
		},
		hide() {
			[v, h, box].forEach((n) => n && n.remove());
			v = h = box = null;
		}
	};
}

export function ghostNode(overlay, type, shape = 'circle') {
	const g = el('g', { class: 'node ghost' }, overlay);
	if (type === 'waypoint') {
		el('circle', { class: 'wp-ring', r: 20, fill: 'none', 'stroke-width': 1.6 }, g);
		el('circle', { class: 'wp-dot', r: 2.2 }, g);
	} else {
		el('use', { 'data-layer': 'frame', href: `#m-${shape}` }, g);
		el('use', { 'data-layer': 'glyph', href: `#glyph-${type}` }, g);
	}
	return {
		moveTo(pos) { g.setAttribute('transform', `translate(${pos.x},${pos.y})`); },
		setBlocked(on) { g.classList.toggle('blocked', !!on); },
		remove() { g.remove(); }
	};
}

export function previewRect(overlay, cls) {
	const rect = el('rect', { class: cls, x: 0, y: 0, width: 0, height: 0 }, overlay);
	return {
		update(box) { setAttrs(rect, { x: box.x, y: box.y, width: box.w, height: box.h }); },
		remove() { rect.remove(); }
	};
}

export function previewLine(overlay) {
	const line = el('line', { class: 'link-live' }, overlay);
	return {
		update(p1, p2) { setAttrs(line, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }); },
		remove() { line.remove(); }
	};
}

// a multi-segment route preview: takes an SVG path `d` (caller builds it via the kernel router
// so the preview matches the committed route).
export function previewPath(overlay) {
	const p = el('path', { class: 'link-live', fill: 'none' }, overlay);
	return {
		update(d) { p.setAttribute('d', d); },
		remove() { p.remove(); }
	};
}
