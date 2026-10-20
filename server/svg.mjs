/*
Render a stored diagram as a SELF-CONTAINED SVG document (H2, B330, H22.5).

Ruled H2 (2026-10-04): run mode and the download are ONE rendering, decided in one place in code. `svgDocument` drives the
real `Renderer` (`app/src/renderer.js`) in `'run'` mode over `PRODUCT_CANVAS` (`product/canvas.mjs`) and a lightweight
headless SVG tree, then serialises the rendered layers into a standalone `<svg xmlns="http://www.w3.org/2000/svg">` with
the parts' `defs`, each element carrying as attributes what the page's own stylesheets give it (server/svg-style.mjs, H25.2). `export` therefore imports `renderer`, `product`,
`lattice`, `document`, `primitives` and `colours` -- never a plugin directly.
*/
import { L_STD } from '../kernel/spec.mjs';
import { NODE_GRID } from '../kernel/geometry.mjs';
import { sharedDefs } from '../kernel/renderer.mjs';
import { Renderer } from '../app/src/renderer.js';
import { PRODUCT_CANVAS, CANVAS_LAYERS } from '../product/canvas.mjs';
import { drawingRules, styleMarkup, nodeContext, drawnOf } from './svg-style.mjs';   // H25.2: the page's rules, applied
import { COMPOSED_KINDS, readModel } from '../product/types.mjs';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/*
H24.8 (B361): THE PAGE'S ORDER OF LAYERS IS THE EXPORT'S. The export stacks the layers its parts draw into back to front as the
page does; it once stacked them in the order the parts are listed, which drew every device of a published diagram under its links.
H25.4 (B376): the order is the composition's (product/canvas.mjs CANVAS_LAYERS), which tools/canvas-layout.mjs writes into the
pages -- read here from the declaration, where it was read out of the product page's markup. A layer it does not hold is refused,
not stacked by guess.
*/
function layerIdsOf(parts) {
	const drawn = new Set();
	for (const p of parts) {
		for (const x of p.painters ?? []) if (x.layer) drawn.add(x.layer);
		for (const x of p.appearances ?? []) if (x.root?.layer) drawn.add(x.root.layer);
	}
	const unplaced = [...drawn].filter((id) => !CANVAS_LAYERS.includes(id));
	if (unplaced.length) throw new Error(`a canvas part draws into ${unplaced.join(', ')}, a layer the canvas's layout does not hold (product/canvas.mjs CANVAS_LAYERS)`);
	return CANVAS_LAYERS.filter((id) => drawn.has(id));
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
	const attrs = Object.entries(outAttrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
	const inner = n.textContent ? esc(n.textContent) : n.children.map((c) => serializeNode(c, layerSet)).join('');
	const xml = inner ? `<${n.tag}${attrs}>${inner}</${n.tag}>` : `<${n.tag}${attrs}/>`;
	if (n.parentNode?.tag === 'g' && layerSet.has(n.parentNode.attrs.id) && n.attrs.id) {
		if (n.tag === 'g' && n.attrs.class !== 'node' && n.children.some((c) => c.attrs.class === 'select-box')) {
			const { id, transform, ...rest } = n.attrs;
			const tr = transform?.match(/translate\(([-\d.]+),([-\d.]+)\)/);
			const [cx, cy] = tr ? [tr[1], tr[2]] : ['0', '0'];
			const innerAttrs = Object.entries(rest).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
			// H25.2b (B370; dev/DECISIONS.md H25-3): each circle keeps its class, so the page's rules reach it as on the page -- a spawning
			// endpoint's ring and dot green; written bare, the file drew every spawner as a plain endpoint
			const circles = n.children.filter((c) => c.tag === 'circle').map((c) => `<circle ${Object.entries({ cx, cy, ...c.attrs }).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('');
			return `<g id="${esc(id)}"><g${innerAttrs}>${circles}</g></g>`;
		}
	}
	return xml;
}

/*
H25.2 (B366): A LINK IS WRITTEN AS ONE GROUP NAMED BY ITS ID -- its line as the painter drew it, its class kept, then the head and
the leg that name it (\`data-head-of\`, \`data-leg-of\`) -- so the page's own rules style it as on the page: the down rule reaches
the head as the line's next sibling (network/network.css), and nothing in the file is coloured by the export. The group keeps the
\`<g id="link-...">\` the file has always drawn, which \`draw render --summary\` and \`draw parity\` count links by, so a CLI already
installed reads a new file as it read an old one. The line gives its id to the group; the click twin stays out (\`data-link\`).
*/
function withCompanions(children) {
	const out = [];
	for (const c of children) {
		const of = c.attrs['data-head-of'] ?? c.attrs['data-leg-of'];
		const owner = of && out.find((x) => x.attrs?.id === of);
		if (owner) { owner.companions.push(c); continue; }
		// a line is a path the layer holds under an id -- a structure, naming no plugin's kind (tests/core-names-no-plugin.test.js U3)
		if (c.tag === 'path' && c.attrs.id && c.attrs.d) out.push(Object.assign(Object.create(c), { companions: [] }));
		else out.push(c);
	}
	return out;
}
function linkGroup(c, layerSet) {
	const { id, d, ...rest } = c.attrs;
	const line = `<path d="${esc(d)}"${Object.entries(rest).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}/>`;
	return `<g id="${esc(id)}">${line}${c.companions.map((x) => serializeNode(x, layerSet)).join('')}</g>`;
}

function boundsOf(svg, L = L_STD) {
	let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
	const ext = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
	for (const layer of svg.children) {
		for (const el of layer.children) {
			const tr = el.attrs.transform?.match(/translate\(([-\d.]+),([-\d.]+)\)/);
			if (tr) {
				const cx = Number(tr[1]), cy = Number(tr[2]), e = L.frame.ext;
				const sp = el.attrs['data-span']?.split('x').map(Number);
				// H26.1 (SNAP-GRID.md appendix B): what the span runs through beyond its first cell, `span(...).through` on the node grid
				const { w: sw, h: sh } = sp ? NODE_GRID.span({ col: 0, row: 0 }, { col: sp[0] - 1, row: sp[1] - 1 }).through : { w: 0, h: 0 };
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
	// H25.2 (B366; dev/DECISIONS.md H25-2): the page's rules applied and written as each element's attributes, so the file carries no
	// stylesheet, asks no CSS of a renderer and restyles nothing it is pasted into. Applied to the drawing as the file writes it --
	// its layers flattened, a line's id given to its group -- so a rule meets each element exactly where a browser reading this file
	// with the page's sheets would meet it, and nothing the painted tree held that the file does not styles anything. A waypoint's
	// circles keep their classes (H25.2b, B370), so the page's spawning rule draws a spawner as on the page (tests/svg-style.test.js).
	const rules = drawingRules();
	const defs = styleMarkup(sharedDefs(undefined, undefined, PRODUCT_CANVAS.map((p) => p.defs).filter(Boolean).join('\n')), rules, nodeContext(rules));
	const items = styleMarkup(svg.children.flatMap((layer) => withCompanions(layer.children).map((c) => (c.companions ? linkGroup(c, layerSet) : serializeNode(c, layerSet)))).filter(Boolean).join(''), rules);
	return `<svg xmlns="http://www.w3.org/2000/svg" class="scene" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">\n${defs}\n\t  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${drawnOf('rect', { id: 'canvas' }, rules).fill}"/>\n\t  ${items}\n\t</svg>`;
}
