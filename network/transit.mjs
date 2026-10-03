/*
TRANSIT -- does what arrives at an anchor pass through it, or stop (dev/design/unification/TRANSIT.md; ruled 2026-09-28
and 2026-09-30, TR-1 to TR-7).

THE TABLE is a PERMISSION, per device type (TRANSIT.md section 5, ruled as proposed, TR-6): which values of `transit` a
type offers, the first being what an anchor takes when its author has declared nothing. A bare anchor, a router, a
firewall and a vxlan offer both, and pass by default; a load balancer, a server and a host offer only off. A type the
table does not name -- a text box, a panel -- is no routing device, and offers only off too.

THE SETTING is the author's choice within what the type offers, kept per anchor. In the lab it is session state, as
pipes are, until promotion's format batch stores it (TR-7): a reload loses it, and undo does not move it.
*/
import { splitAtBend, collapseAtWaypoint } from '../model/invariants.mjs';
import { clone, applyOps } from '../model/ops.mjs';
import { newId, projection } from '../model/model.mjs';
import { BARE_KIND, isBareEntity, bareAnchor, bareAnchors } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)

const BOTH = [true, false], OFF = [false];
const OFFERS = { router: BOTH, firewall: BOTH, vxlan: BOTH, loadbalancer: OFF, server: OFF, host: OFF };

// the values a type offers: a bare anchor offers both
const transitOffers = (entity) => (isBareEntity(entity.kind, entity) ? BOTH : OFFERS[entity.type] ?? OFF);

// an anchor in a model, as the table reads it: a node by its type, a waypoint as a bare anchor
const entitiesOf = (model) => [...model.all('node').map((n) => ({ ...n, kind: 'node' })), ...bareAnchors(model).map((w) => ({ ...w, kind: BARE_KIND }))];

export function createTransit() {
	const set = new Map();   // anchor id -> its declared value, only where it differs from the type's default
	const valueOf = (entity) => (set.has(entity.id) ? set.get(entity.id) : transitOffers(entity)[0]);
	// THE ONE RULE (B278): what arrives at this anchor stops there -- declared off, or of a type that offers only off (TR-1, TR-6)
	const stops = (entity) => valueOf(entity) === false;
	return {
		// whether the author declared transit off here -- what the ring marks, and nothing else; a type with no choice declares nothing
		declaredOff: (id) => set.get(id) === false,
		// the anchors in a model where what arrives stops, sorted, so a board's derivation can be keyed on them -- the rule as a set
		blockedIn: (model) => entitiesOf(model).filter(stops).map((e) => e.id).sort(),
		// whether what arrives at one anchor stops there -- the rule asked of one id; an id the model holds no anchor for stops nothing
		stopsAt: (id, model) => {
			const node = model.get('node', id), waypoint = !node && bareAnchor(model, id);
			return node ? stops({ ...node, kind: 'node' }) : waypoint ? stops({ ...waypoint, kind: BARE_KIND }) : false;
		},
		/*
		Flip each anchor on its own (ruled 2026-09-28: many anchors at once, each flipped independently). An anchor whose
		type offers no choice is refused, and named. Answers what changed and what was refused.
		*/
		flip(entities) {
			const flipped = [], refused = [];
			for (const e of entities) {
				const offers = transitOffers(e);
				if (offers.length < 2) { refused.push(e); continue; }
				const next = !valueOf(e);
				if (next === offers[0]) set.delete(e.id); else set.set(e.id, next);
				flipped.push({ ...e, transit: next });
			}
			return { flipped, refused };
		},
	};
}

/*
CUT AT A WAYPOINT, and JOIN AT ONE -- the two edits turning an anchor's transit off and on makes (TRANSIT.md section 12,
TR-2). They build the edit as the canvas's history takes it -- one command -- and are the network's to make, since
where a link may bend is a network rule.

`cutAt` divides every link that bends at the waypoint into two that end there, as a junction does (B210), the src half
keeping the original id (B213) so a join restores the link the author drew. `joinAt` merges the two links left ending
at a waypoint into one bending there, by the planner's own rule (`collapseAtWaypoint`, ruled 2026-09-26: two links left
alone at a point join) -- only when exactly two links touch it and both end there. Each is null when it would do nothing.
*/
export function cutAt(model, waypointId) {
	const cuts = model.all('link').map((l) => ({ original: l, pieces: splitAtBend(l, waypointId) })).filter((c) => c.pieces);
	if (!cuts.length) return null;
	// a piece as a whole link: the src half is the original re-ended, the dst half a new link of its own
	const piece = (original, p, i) => {
		const base = i === 0 ? { ...original } : { ...model.makeLink(p.src, p.dst), id: newId('link', model.collection('link')) };
		const { via: _drop, ...rest } = base;
		return { ...rest, ...p };   // the half's ends, pins and the link's declarations (`splitAtBend`, B284)
	};
	const entries = cuts.flatMap(({ original, pieces }) => [
		{ op: 'del', kind: 'link', entity: clone('link', original) },
		...pieces.map((p, i) => ({ op: 'put', kind: 'link', entity: clone('link', piece(original, p, i)) })),
	]);
	return { label: 'cut', entries, cut: cuts.length };
}

export function joinAt(model, waypointId) {
	const at = model.all('link').filter((l) => l.src === waypointId || l.dst === waypointId || (l.via || []).includes(waypointId));
	if (at.length !== 2) return null;
	const src = at.find((l) => l.dst === waypointId) || at[0];
	const other = at.find((l) => l !== src);
	const merged = collapseAtWaypoint(src, other, waypointId);
	if (!merged) return null;
	return { label: 'join', entries: [
		{ op: 'del', kind: 'link', entity: clone('link', other) },
		{ op: 'set', kind: 'link', id: src.id, after: { src: merged.src, dst: merged.dst, via: merged.via ?? [], ...(merged.direction !== undefined ? { direction: merged.direction } : {}) } },
	] };
}

/*
B283 -- A TRANSIT CHANGE AT SEVERAL WAYPOINTS AT ONCE is ONE edit, built in order: each waypoint's cut or join is judged on
a projection of the board as the ones before it leave it, and applied there before the next is judged. Built each against
the same board, two cuts of one link both deleted and re-put the original -- the second re-ending it over both pins while
the first's far piece still ran past the second -- so a link ended up down over a pipe another held, and no join could undo
it (the director's report, 2026-10-02). `stops(id)` says whether what arrives at the waypoint now stops there.
Answers the entries, as the canvas's history takes them; `cut`, how many links the author drew were cut and into how many
pieces -- a piece an earlier cut made is traced back to the link it came from, so one link cut at two waypoints is one link
in three pieces, not two links cut in two (the director, 2026-10-02); and `joined`, how many pieces joined into how many
links -- three pieces joined at two waypoints are three pieces into one link, not "its two links". Null if nothing.
*/
const asOp = (e) => (e.op === 'set' ? { op: 'set', kind: e.kind, id: e.id, patch: e.after } : e.op === 'del' ? { op: 'del', kind: e.kind, id: e.entity.id } : e);

export function transitEdit(model, waypointIds, stops) {
	const ids = waypointIds.filter((id) => bareAnchor(model, id));   // a node's transit cuts nothing: its links end there
	if (!ids.length) return null;
	const board = projection(model);
	const entries = [];
	const drawnAs = new Map();   // a piece's id -> the id of the link the author drew, which it was cut from
	const drawn = (id) => drawnAs.get(id) ?? id;
	let pieces = 0;
	const into = new Map();   // a link a join removed -> the link it joined into; followed to the one left standing
	const survivor = (id) => (into.has(id) ? survivor(into.get(id)) : id);
	for (const id of ids) {
		const edit = stops(id) ? cutAt(board, id) : joinAt(board, id);
		if (!edit) continue;
		applyOps(board, edit.entries.map(asOp));
		entries.push(...edit.entries);
		// a cut deletes a link and puts its two halves, the first keeping its id; the second is new, and is the same drawn link
		if (edit.label === 'cut') {
			let from = null;
			for (const e of edit.entries) {
				if (e.op === 'del') from = drawn(e.entity.id);
				else if (e.op === 'put' && e.entity.id !== from && !drawnAs.has(e.entity.id) && from) drawnAs.set(e.entity.id, from);
			}
			pieces += edit.cut;
		}
		// a join deletes one link and re-ends the other over both: the deleted one joined into the one kept
		if (edit.label === 'join') {
			const gone = edit.entries.find((e) => e.op === 'del').entity.id, kept = edit.entries.find((e) => e.op === 'set').id;
			into.set(gone, kept);
		}
	}
	const cutLinks = new Set(drawnAs.values()).size;
	const joinedLinks = new Set([...into.keys()].map(survivor)).size;
	return entries.length ? { label: 'transit', entries,
		cut: cutLinks ? { links: cutLinks, pieces: cutLinks + pieces } : null,
		joined: joinedLinks ? { links: joinedLinks, pieces: joinedLinks + into.size } : null } : null;
}
