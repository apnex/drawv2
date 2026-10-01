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
const BOTH = [true, false], OFF = [false];
const OFFERS = { router: BOTH, firewall: BOTH, vxlan: BOTH, loadbalancer: OFF, server: OFF, host: OFF };

// the values a type offers: a bare anchor offers both
const transitOffers = (entity) => (entity.kind === 'waypoint' ? BOTH : OFFERS[entity.type] ?? OFF);

export function createTransit() {
	const set = new Map();   // anchor id -> its declared value, only where it differs from the type's default
	const valueOf = (entity) => (set.has(entity.id) ? set.get(entity.id) : transitOffers(entity)[0]);
	return {
		// whether the author declared transit off here -- what the ring marks; a type with no choice declares nothing
		declaredOff: (id) => set.get(id) === false,
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
