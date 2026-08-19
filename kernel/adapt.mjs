// SCHEMA ADAPTER — translate a stored document (px, center-origin, the persisted JSON
// shape) ↔ the kernel's declarative schema (cell coords). The document stays the source of
// truth + the persistence/wire format; the schema is DERIVED for rendering + validation only.
// Pure (no DOM): usable in the browser and headlessly in node.
//
// It lives in `kernel/` because it PRODUCES a kernel schema, and it takes the document as plain
// data — it imports nothing from `model/`, so hosting it here adds no dependency edge between
// sovereign peers and leaves the kernel self-sufficient for export. It was in `app/src/`, where the
// browser never called it: the client renders live DOM directly and the kernel renderer is the
// EXPORT authority. That mislocation is why it read as dead code (B28).
//
//   doc  node  { id, name, type, shape, x, y }   →  { id, kind:'node', cell:[cx,cy], frame, glyph, sel }
//   doc  zone  { id, name, x, y, w, h }           →  { id, kind:'zone', span:{cols,rows} }
//   doc  group { id, name, members:[…] }          →  { id, kind:'group', members:[…] }
//   doc  link  { id, src, dst }                   →  relation { id, route:{ from, to } }  (straight)
//
// The zone grid is half-cell-offset (edges at ±P/2 + k·P); covered node-cells:
//   c0 = (x + P/2)/P   c1 = (x + w − P/2)/P   (and rows from y,h)
import { STD } from './spec.mjs';
import { cellOf } from './geometry.mjs';

const P = STD.pitch;                              // 60 — the single source of pitch
const cell = cellOf;                              // px → cell, single-sourced from the kernel
const newId = (kind) => `${kind}-${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;

// document → kernel schema. `opts.selected` (a Set of ids) flags selected nodes so the kernel
// draws their selection brackets at the locked extent.
export function docToSchema(doc, opts = {}) {
	const selected = opts.selected || new Set();
	const entities = [], relations = [];
	(doc.nodes || []).forEach((n) => {
		const c0 = cell(n.x), r0 = cell(n.y);
		const e = { id: n.id, kind: 'node', cell: [c0, r0], frame: n.shape || 'circle', glyph: n.type, sel: selected.has(n.id) };
		// a multi-cell node: counts (doc) → absolute cell ranges (kernel), anchored at the node cell (+col/+row).
		if (n.span && (n.span.cols > 1 || n.span.rows > 1)) e.span = { cols: [c0, c0 + n.span.cols - 1], rows: [r0, r0 + n.span.rows - 1] };
		if (n.content && n.content.length) e.content = n.content;   // W2 content regions are node-local (offset + counts) → pass through
		entities.push(e);
	});
	(doc.zones || []).forEach((z) => {
		// clamp to ≥1 cell: a sub-pitch / degenerate zone must not invert (c1<c0 → empty range → NaN hull)
		const c0 = cell(z.x + P / 2), c1 = Math.max(c0, cell(z.x + z.w - P / 2));
		const r0 = cell(z.y + P / 2), r1 = Math.max(r0, cell(z.y + z.h - P / 2));
		entities.push({ id: z.id, kind: 'zone', span: { cols: [c0, c1], rows: [r0, r1] } });
	});
	(doc.waypoints || []).forEach((w) => entities.push({ id: w.id, kind: 'waypoint', cell: [cell(w.x), cell(w.y)] }));
	(doc.groups || []).forEach((g) => entities.push({ id: g.id, kind: 'group', members: [...(g.members || [])] }));
	(doc.links || []).forEach((l) => relations.push({ id: l.id, route: { from: l.src, to: l.dst, via: l.via || [], close: !!l.closed } }));
	return { variant: 'standard', entities, relations };
}

// kernel schema → document (the inverse coordinate math). Names are NOT in the schema (a UI/doc
// concern), so a doc→schema→doc round-trip preserves geometry/structure, not labels. Used for
// future import; the live UI keeps the doc as the source of truth and only ever derives a schema.
export function schemaToDoc(schema, meta = {}) {
	const nodes = [], waypoints = [], zones = [], groups = [], links = [];
	(schema.entities || []).forEach((e) => {
		if (e.kind === 'node') {
			const n = { id: e.id, name: e.name || '', type: e.glyph, shape: e.frame || 'circle', x: e.cell[0] * P, y: e.cell[1] * P };
			if (e.span) n.span = { cols: e.span.cols[1] - e.span.cols[0] + 1, rows: e.span.rows[1] - e.span.rows[0] + 1 };   // ranges → counts
			if (e.content && e.content.length) n.content = e.content;
			nodes.push(n);
		}
		else if (e.kind === 'waypoint') waypoints.push({ id: e.id, x: e.cell[0] * P, y: e.cell[1] * P });
		else if (e.kind === 'zone') {
			const [c0, c1] = e.span.cols, [r0, r1] = e.span.rows;
			zones.push({ id: e.id, name: e.name || '', x: c0 * P - P / 2, y: r0 * P - P / 2, w: (c1 - c0 + 1) * P, h: (r1 - r0 + 1) * P });
		} else if (e.kind === 'group') groups.push({ id: e.id, name: e.name || '', members: [...(e.members || [])] });
	});
	(schema.relations || []).forEach((r) => { if (r.route) links.push({ id: r.id || newId('link'), src: r.route.from, dst: r.route.to, ...(r.route.via && r.route.via.length ? { via: [...r.route.via] } : {}), ...(r.route.close ? { closed: true } : {}) }); });
	return { meta: { id: '', name: 'untitled', version: 0, schema: 1, slides: { url: '', presentationId: '', pageId: '' }, ...meta }, nodes, waypoints, links, zones, groups };
}
