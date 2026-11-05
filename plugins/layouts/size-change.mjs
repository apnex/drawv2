/*
H26.6's move 15 (dev/design/components/PAN-ZOOM.md section 3.5; PZ1 to PZ4, PZ19, PZ21, PZ29, PZ31; GR8, GR18) -- A SIZE CHANGE.

A person, an agent or the CLI sets the grid record's `pitch` as any edit; the planner's transaction phase runs this plugin's reaction,
so every door gets one answer and the change is one commit and one undo (PZ4). The director's Q3, as clarified: "Keep their square.
This was my original intent." So:
  - every anchor -- a device, a waypoint, a text box, a spanning device by its anchor -- keeps its device-lattice index: at (col, row) on
    the old grid it stands at (col, row) on the new, `positionAt` on the old lattice and `pointOf` on the new (SG3);
  - every zone's corners keep their zone-lattice indices, so its sides keep their counts of squares and it keeps every anchor it held;
  - every size is kept -- a device's span, frame, sockets and content are in the unit of 60 (PZ18) -- and links, pipes and groups follow
    their anchors, their routes derived again.
Every position is so multiplied by the new size over the old, about the origin, exactly: by index, never by multiplying a coordinate.

How the planner holds it, the planner unchanged (3.5):
  SIZE_CHANGE       the reaction, in the `reshape` phase: on a net change of the record's pitch, every anchor and zone moved by index
                    from where the request left it;
  LONE_SIZE_CHANGE  a refusal on the result: unless the result is exactly the size change computed from the model before the request --
                    the record's pitch its only difference, every other entity differing only as the change moves it -- it is refused,
                    naming what else changed; and first, PZ31's bound: a change landing an anchor, a zone's corner or its far edge past
                    1,000,000 is refused naming the entity and the point;
  ON_RESULT_GRID    a refusal on the result (GR18): every anchor and zone the request changed -- and, on a net change of the pitch,
                    every one -- judged against the result's own grid, so a request that sets the pitch and restores it cannot leave an
                    edit judged against the grid between;
The notice (step 5) is plugins/layouts/size-notice.mjs's, outside the planner's entry, which loads this module through the layout row.
*/
import { diagramLattices } from '../../kernel/geometry.mjs';
import { COORD_BOUND } from '../../model/limits.mjs';
import { ANCHOR_KINDS } from '../../model/anchors.mjs';

const RECT = 'zone';   // the zones plugin's kind: a rect whose corners lie on the zone lattice and whose sides are whole squares
const pitchChange = (matches) => matches.find((c) => c.kind === 'layout' && c.before && c.after && c.fields.has('pitch'));
const nameOf = (e) => e.name ?? e.id;

// an anchor's point on the new grid, by its index on the old -- or null, off the old lattice
function anchorTo(from, to, p) {
	const at = from.device.positionAt({ x: p.x, y: p.y });
	return at ? to.device.pointOf(at) : null;
}
// a zone's rect on the new grid, by its corners' indices on the old -- or null, off the old zone lattice
function rectTo(from, to, z) {
	const a = from.zone.positionAt({ x: z.x, y: z.y }), b = from.zone.positionAt({ x: z.x + z.w, y: z.y + z.h });
	if (!a || !b) return null;
	const A = to.zone.pointOf(a), B = to.zone.pointOf(b);
	return { x: A.x, y: A.y, w: B.x - A.x, h: B.y - A.y };
}
const kindsIn = (doc) => ({ anchors: ANCHOR_KINDS.filter((k) => doc.kinds?.has(k)), rects: doc.kinds?.has(RECT) ? [RECT] : [] });

/*
The size change of one document from the grid of `oldPitch` to `newPitch`, as ops: a `set` of every anchor and zone whose place moves.
What lies off the old lattice is left where it is, for ON_RESULT_GRID to name.
*/
function sizeChangeOps(doc, oldPitch, newPitch) {
	const from = diagramLattices({ pitch: oldPitch }), to = diagramLattices({ pitch: newPitch }), ops = [];
	const { anchors, rects } = kindsIn(doc);
	for (const kind of anchors) for (const n of doc.all(kind)) {
		const p = anchorTo(from, to, n);
		if (p && (p.x !== n.x || p.y !== n.y)) ops.push({ op: 'set', kind, id: n.id, patch: { x: p.x, y: p.y } });
	}
	for (const kind of rects) for (const z of doc.all(kind)) {
		const r = rectTo(from, to, z);
		if (r && (r.x !== z.x || r.y !== z.y || r.w !== z.w || r.h !== z.h)) ops.push({ op: 'set', kind, id: z.id, patch: r });
	}
	return ops;
}

const SIZE_CHANGE = {
	id: 'size-change',
	phase: 'reshape',
	trigger: { changed: { kind: 'layout', fields: ['pitch'] } },
	doc: 'a change of the grid\'s size moves every anchor and every zone\'s corners by lattice index -- each keeps its square, the diagram scaled by the new size over the old, every device its own size (PAN-ZOOM.md 3.5)',
	run: ({ doc, matches }, emit) => {
		const c = pitchChange(matches);
		if (c) emit(sizeChangeOps(doc, c.before.pitch, c.after.pitch));
	},
};

// value equality over the plain values a document holds
function same(a, b) {
	if (a === b) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a), kb = Object.keys(b);
	return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
}
const beyond = (...v) => v.some((c) => Math.abs(c) > COORD_BOUND);

const LONE_SIZE_CHANGE = {
	id: 'size-change-alone',
	trigger: { changed: { kind: 'layout', fields: ['pitch'] } },
	doc: 'a grid size change is an edit of its own: refused unless the result is exactly the change computed from the document before -- every position by lattice index, nothing else changed -- and refused if it would carry anything past PZ31\'s bound, naming it and where it would land',
	refuse: ({ before, doc, matches }) => {
		const c = pitchChange(matches);
		if (!c) return null;
		const oldPitch = c.before.pitch, newPitch = c.after.pitch;
		const from = diagramLattices({ pitch: oldPitch }), to = diagramLattices({ pitch: newPitch });
		const expected = before.toJSON(), got = doc.toJSON(), { anchors, rects } = kindsIn(doc);
		const why = (what) => `a grid size change is an edit of its own -- ${what} beside the grid of ${newPitch}; set the grid alone, then edit`;
		const past = (e, x, y) => `the grid of ${newPitch} would put ${nameOf(e)} at ${x},${y}, past the bound of ${COORD_BOUND} from the origin -- a size change multiplies every position by ${newPitch} over ${oldPitch} (PZ31)`;
		const at = (kind) => expected[before.kinds.collection[kind]] ?? [];
		for (const kind of anchors) for (const n of at(kind)) {
			const p = anchorTo(from, to, n);
			if (!p) continue;
			if (beyond(p.x, p.y)) return past(n, p.x, p.y);
			n.x = p.x; n.y = p.y;
		}
		for (const kind of rects) for (const z of at(kind)) {
			const r = rectTo(from, to, z);
			if (!r) continue;
			if (beyond(r.x, r.y)) return past(z, r.x, r.y);
			if (beyond(r.x + r.w, r.y + r.h)) return past(z, r.x + r.w, r.y + r.h);
			Object.assign(z, r);
		}
		for (const l of expected[before.kinds.collection.layout] ?? []) if (l.id === c.id) l.pitch = newPitch;
		// the result, entity by entity, against the change computed from the document before
		for (const key of new Set([...Object.keys(expected), ...Object.keys(got)])) {
			const kind = before.kinds.list.find((k) => before.kinds.collection[k] === key);
			if (!kind) { if (!same(expected[key], got[key])) return why(`the diagram's ${key} would change`); continue; }
			const was = new Map((expected[key] ?? []).map((e) => [e.id, e])), now = new Map((got[key] ?? []).map((e) => [e.id, e]));
			for (const [id, e] of now) {
				if (!was.has(id)) return why(`${kind} ${nameOf(e)} would be made`);
				if (!same(was.get(id), e)) return why(`${kind} ${nameOf(e)} would change`);
			}
			for (const [id, e] of was) if (!now.has(id)) return why(`${kind} ${nameOf(e)} would be deleted`);
		}
		return null;
	},
};

const ON_RESULT_GRID = {
	id: 'on-result-grid',
	trigger: [
		{ changed: { kind: 'layout', fields: ['pitch'] } },
		...ANCHOR_KINDS.flatMap((kind) => [{ created: [kind] }, { changed: { kind, fields: ['x', 'y'] } }]),
		{ created: [RECT] }, { changed: { kind: RECT, fields: ['x', 'y', 'w', 'h'] } },
	],
	doc: 'every anchor and zone an edit leaves is on the result\'s own grid -- a request that changes the grid and restores it cannot keep an edit judged against the grid between (GR18)',
	refuse: ({ doc, matches }) => {
		const record = doc.all('layout')[0];   // the one record (layout-kind.mjs)
		if (!record) return null;
		const { device, zone } = diagramLattices(record), pitch = record.pitch, { anchors, rects } = kindsIn(doc);
		const every = !!pitchChange(matches);
		const judged = (kinds) => (every ? kinds.flatMap((k) => doc.all(k)) : matches.filter((c) => kinds.includes(c.kind) && c.after).map((c) => doc.get(c.kind, c.id)).filter(Boolean));
		const off = (e) => `${nameOf(e)} at ${e.x},${e.y} would be left off the diagram's grid of ${pitch} -- an edit is judged on the grid it is made on, and this request changes the grid around it (GR18)`;
		for (const n of judged(anchors)) if (device.positionAt({ x: n.x, y: n.y }) === null) return off(n);
		for (const z of judged(rects)) {
			const whole = (v) => Number.isInteger(v / pitch) && v >= pitch;
			if (zone.positionAt({ x: z.x, y: z.y }) === null || !whole(z.w) || !whole(z.h)) return off(z);
		}
		return null;
	},
};

// the layouts plugin's tenant, carried on its row (plugins/layouts/layout-kind.mjs; model/shape.mjs `tenants`)
export const LAYOUTS_TENANT = { owner: 'layouts', reactions: [SIZE_CHANGE], refusals: [LONE_SIZE_CHANGE, ON_RESULT_GRID] };
