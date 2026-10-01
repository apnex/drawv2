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
import { clone } from '../model/ops.mjs';
import { newId } from '../model/model.mjs';

const BOTH = [true, false], OFF = [false];
const OFFERS = { router: BOTH, firewall: BOTH, vxlan: BOTH, loadbalancer: OFF, server: OFF, host: OFF };

// the values a type offers: a bare anchor offers both
const transitOffers = (entity) => (entity.kind === 'waypoint' ? BOTH : OFFERS[entity.type] ?? OFF);

// an anchor in a model, as the table reads it: a node by its type, a waypoint as a bare anchor
const entitiesOf = (model) => [...model.all('node').map((n) => ({ ...n, kind: 'node' })), ...model.all('waypoint').map((w) => ({ ...w, kind: 'waypoint' }))];

export function createTransit() {
	const set = new Map();   // anchor id -> its declared value, only where it differs from the type's default
	const valueOf = (entity) => (set.has(entity.id) ? set.get(entity.id) : transitOffers(entity)[0]);
	return {
		// whether the author declared transit off here -- what the ring marks; a type with no choice declares nothing
		declaredOff: (id) => set.get(id) === false,
		// the anchors in a model that no route may pass -- declared off, or of a type that offers only off (TR-1, TR-6) --
		// sorted, so a board's derivation can be keyed on them
		blockedIn: (model) => entitiesOf(model).filter((e) => valueOf(e) === false).map((e) => e.id).sort(),
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
		return { ...rest, src: p.src, dst: p.dst, ...(p.via ? { via: p.via } : {}) };
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
		{ op: 'set', kind: 'link', id: src.id, after: { src: merged.src, dst: merged.dst, via: merged.via ?? [], ...(typeof merged.flow === 'boolean' ? { flow: merged.flow } : {}) } },
	] };
}
