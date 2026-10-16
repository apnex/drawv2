/*
Render a stored diagram as a SELF-CONTAINED SVG document (H2, B330, H22.5).

Ruled H2 (2026-10-04): run mode and the download are ONE rendering, decided in one place in code. `svgDocument` drives the
real `Renderer` (`app/src/renderer.js`) in `'run'` mode over `PRODUCT_CANVAS` (`product/canvas.mjs`) and a lightweight
headless SVG tree, then serialises the rendered layers into a standalone `<svg xmlns="http://www.w3.org/2000/svg">` with
`KERNEL_CSS`, `EXPORT_CSS` and the parts' `defs`. `export` therefore imports `renderer`, `product`, `lattice`, `document`,
`primitives` and `colours` -- never a plugin directly.
*/
import { STD, L_STD } from '../kernel/spec.mjs';
import { TOKENS, KERNEL_CSS } from '../kernel/theme.mjs';
import { sharedDefs } from '../kernel/renderer.mjs';
import { Renderer } from '../app/src/renderer.js';
import fs from 'node:fs';
import { PRODUCT_CANVAS, EXPORT_CSS, LINK_COLOURS } from '../product/canvas.mjs';
import { COMPOSED_KINDS, readModel } from '../product/types.mjs';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/*
H24.8 (B361): THE PAGE'S ORDER OF LAYERS IS THE EXPORT'S. The product page lays out its canvas's layers, back to front, in
`#container` (app/index.html; the lab's page is held to the same list by tests/run-picture.test.js), and the export stacks the
layers its parts draw into in that order, read from the page itself -- one declaration, no copy to drift. The export once
stacked them in the order the parts are listed, which drew every device of a published diagram under its links. A layer the
page does not lay out is refused, not stacked by guess.
*/
let pageLayers = null;
function pageLayerOrder() {
	if (pageLayers) return pageLayers;
	const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
	const container = html.match(/<svg id="container"[\s\S]*?<\/svg>/)?.[0];
	if (!container) throw new Error('app/index.html lays out no <svg id="container">, whose order of layers the export stacks by');
	pageLayers = [...container.matchAll(/<g id="([\w-]+)"/g)].map((m) => m[1]);
	return pageLayers;
}

function layerIdsOf(parts) {
	const drawn = new Set();
	for (const p of parts) {
		for (const x of p.painters ?? []) if (x.layer) drawn.add(x.layer);
		for (const x of p.appearances ?? []) if (x.root?.layer) drawn.add(x.root.layer);
	}
	const order = pageLayerOrder();
	const unplaced = [...drawn].filter((id) => !order.includes(id));
	if (unplaced.length) throw new Error(`a canvas part draws into ${unplaced.join(', ')}, a layer app/index.html does not lay out`);
	return order.filter((id) => drawn.has(id));
}

function headlessSvg(layerIds) {
	const byId = new Map();
	const make = (tag, attrs = {}, parent = null) => {
		const node = {
			tag,
			tagName: tag.toUpperCase(),
			attrs: {},
			children: [],
			parentNode: null,
			textContent: '',
			classList: {
				_set: new Set(),
				add(...cs) { cs.forEach((c) => this._set.add(c)); this._sync(); },
				remove(...cs) { cs.forEach((c) => this._set.delete(c)); this._sync(); },
				toggle(c, on) { const next = on === undefined ? !this._set.has(c) : !!on; if (next) this._set.add(c); else this._set.delete(c); this._sync(); return next; },
				contains(c) { return this._set.has(c); },
				_sync() { node.attrs.class = [...this._set].join(' '); },
			},
			setAttribute(k, v) {
				this.attrs[k] = String(v);
				if (k === 'id') byId.set(String(v), this);
				if (k === 'class') this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
			},
			setAttributeNS(_ns, k, v) { this.setAttribute(k, v); },
			getAttribute(k) { return Object.hasOwn(this.attrs, k) ? this.attrs[k] : null; },
			removeAttribute(k) {
				if (k === 'id' && this.attrs.id) byId.delete(this.attrs.id);
				delete this.attrs[k];
			},
			appendChild(c) {
				if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c);
				c.parentNode = this;
				this.children.push(c);
				return c;
			},
			insertBefore(c, ref) {
				if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c);
				c.parentNode = this;
				const at = ref ? this.children.indexOf(ref) : -1;
				if (at < 0) this.children.push(c); else this.children.splice(at, 0, c);
				return c;
			},
			remove() {
				if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this);
				this.parentNode = null;
				if (this.attrs.id) byId.delete(this.attrs.id);
			},
			querySelector(sel) {
				if (sel.startsWith('#')) return byId.get(sel.slice(1)) ?? null;
				const cls = sel.match(/^\.([\w-]+)$/)?.[1], attr = sel.match(/^\[([\w-]+)="([^"]*)"\]$/);
				const hit = (n) => (cls ? (n.attrs.class || '').split(/\s+/).includes(cls) : attr ? n.attrs[attr[1]] === attr[2] : false);
				const walk = (n) => { for (const c of n.children) { if (hit(c)) return c; const d = walk(c); if (d) return d; } return null; };
				return walk(this);
			},
			querySelectorAll(sel) {
				const cls = sel.startsWith('.') ? sel.slice(1) : null;
				const out = [];
				const walk = (n) => { for (const c of n.children) { if (cls && (c.attrs.class || '').split(/\s+/).includes(cls)) out.push(c); walk(c); } };
				walk(this);
				return out;
			},
			set innerHTML(_v) { this.children = []; },
			get ownerDocument() { return doc; },
		};
		for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
		if (parent) parent.appendChild(node);
		return node;
	};
	const doc = {
		createElementNS: (_ns, tag) => make(tag),
		getElementById: (id) => byId.get(id) ?? null,
	};
	const svg = make('svg');
	for (const id of layerIds) make('g', { id }, svg);
	return { svg, doc };
}

function serializeNode(n, layerSet) {
	if ('data-link' in n.attrs || n.attrs.class === 'select-box') return '';
	if (n.tag === 'text' && !n.textContent) return '';
	if ((n.attrs.class || '').split(/\s+/).includes('label-pill') && (!n.attrs.width || Number(n.attrs.width) === 0)) return '';
	const outAttrs = { ...n.attrs };
	if (n.tag === 'text' && !outAttrs.fill && (outAttrs.class || '').split(/\s+/).includes('label')) outAttrs.fill = TOKENS.label;
	const attrs = Object.entries(outAttrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
	const inner = n.textContent ? esc(n.textContent) : n.children.map((c) => serializeNode(c, layerSet)).join('');
	const xml = inner ? `<${n.tag}${attrs}>${inner}</${n.tag}>` : `<${n.tag}${attrs}/>`;
	if (n.parentNode?.tag === 'g' && layerSet.has(n.parentNode.attrs.id) && n.attrs.id) {
		if (n.tag === 'g' && n.attrs.class !== 'node' && n.children.some((c) => c.attrs.class === 'select-box')) {
			const { id, transform, ...rest } = n.attrs;
			const tr = transform?.match(/translate\(([-\d.]+),([-\d.]+)\)/);
			const [cx, cy] = tr ? [tr[1], tr[2]] : ['0', '0'];
			const innerAttrs = Object.entries(rest).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
			const circles = n.children.filter((c) => c.tag === 'circle').map((c) => `<circle ${Object.entries({ cx, cy, ...c.attrs }).filter(([k]) => k !== 'class').map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('');
			return `<g id="${esc(id)}"><g${innerAttrs}>${circles}</g></g>`;
		}
		if (n.tag === 'path' && n.attrs.d) {
			const { id, class: _c, d, ...rest } = n.attrs;
			const stroke = 'data-down' in rest ? LINK_COLOURS.down : LINK_COLOURS.up;
			// H24.8 (B361): its ends and corners as the painter left them, as on the page -- no rounding of the export's own
			const pathAttrs = Object.entries({ fill: 'none', stroke, ...rest }).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
			return `<g id="${esc(id)}"><path d="${esc(d)}"${pathAttrs}/></g>`;
		}
	}
	return xml;
}

function boundsOf(svg, L = L_STD, V = STD) {
	let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
	const ext = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
	for (const layer of svg.children) {
		for (const el of layer.children) {
			const tr = el.attrs.transform?.match(/translate\(([-\d.]+),([-\d.]+)\)/);
			if (tr) {
				const cx = Number(tr[1]), cy = Number(tr[2]), e = L.frame.ext;
				const sp = el.attrs['data-span']?.split('x').map(Number);
				const sw = sp ? (sp[0] - 1) * V.pitch : 0, sh = sp ? (sp[1] - 1) * V.pitch : 0;
				ext(cx - e, cy - e); ext(cx + e + sw, cy + e + sh);
			}
			for (const c of el.children) {
				if (c.tag === 'rect' && c.attrs.x !== undefined && c.attrs.width !== undefined && !tr) {
					const x = Number(c.attrs.x), y = Number(c.attrs.y), w = Number(c.attrs.width), h = Number(c.attrs.height);
					ext(x, y); ext(x + w, y + h);
				}
			}
			if (el.tag === 'path' && el.attrs.d) {
				for (const m of el.attrs.d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)) ext(Number(m[1]), Number(m[2]));
			}
		}
	}
	if (minX > maxX) { minX = -100; minY = -100; maxX = 100; maxY = 100; }
	return { minX, minY, maxX, maxY };
}

export function svgDocument(doc, kinds = COMPOSED_KINDS, pad = 18) {
	const layerIds = layerIdsOf(PRODUCT_CANVAS);
	const layerSet = new Set(layerIds);
	const { svg, doc: fakeDoc } = headlessSvg(layerIds);
	const prevDoc = globalThis.document;
	globalThis.document = fakeDoc;
	try {
		const model = readModel(doc, kinds);
		const renderer = new Renderer(model, svg, { parts: PRODUCT_CANVAS });
		renderer.mode = 'run';
		renderer.syncAll();
	} finally {
		globalThis.document = prevDoc;
	}
	const { minX, minY, maxX, maxY } = boundsOf(svg);
	const vbX = minX - pad, vbY = minY - pad, vbW = (maxX - minX) + 2 * pad, vbH = (maxY - minY) + 2 * pad;
	const defs = sharedDefs(undefined, undefined, PRODUCT_CANVAS.map((p) => p.defs).filter(Boolean).join('\n'));
	const items = svg.children.flatMap((layer) => layer.children.map((c) => serializeNode(c, layerSet))).filter(Boolean).join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" class="scene" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">\n<style>${KERNEL_CSS}${EXPORT_CSS}</style>\n${defs}\n\t  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${TOKENS.panel}"/>\n\t  ${items}\n\t</svg>`;
}
