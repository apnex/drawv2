/*
TRANSIT -- does what arrives at an anchor pass through it, or stop (dev/design/unification/TRANSIT.md; ruled 2026-09-28
and 2026-09-30, TR-1 to TR-7).

THE TABLE is a PERMISSION, per device type (TRANSIT.md section 5, ruled as proposed, TR-6): which values of `transit` a
type offers, the first being what an anchor takes when its author has declared nothing. A bare anchor, a router, a
firewall and a vxlan offer both, and pass by default; a load balancer, a server and a host offer only off. A type the
table does not name -- a text box, a panel -- is no routing device, and offers only off too.

THE SETTING is the author's choice within what the type offers, STORED on the anchor as `transit` since promotion's format
batch (F-e, H18.7; TR-7) -- only where it differs from the type's default, so an anchor nobody touched carries nothing. It
was session state in the lab, which a reload lost and undo did not move; now it is the document's, every peer reads the same
value, and undo restores it with everything else. The network refuses a value the type does not offer.
*/
import { cutAtBend, openRingIntoLoop, closeLoopIntoRing } from './link-rules.mjs';
import { nodeOffersTransit } from './transit-offers.mjs';   // whether a node may be passed (H19.10)
import { isBareEntity, bareAnchor, BARE_KIND } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)

// the table of what each type offers is the plugin's configuration, in a module of its own (H19.10)
import { transitOffersOf } from './transit-offers.mjs';

// an anchor's transit: what it stores, or its type's default
const valueOf = (entity) => (typeof entity.transit === 'boolean' ? entity.transit : transitOffersOf(entity)[0]);

/*
The transit rules, read off the model each is asked about -- nothing is kept here (F-e). The one rule (B278): what arrives at
an anchor stops there when its transit is off, declared or by a type that offers only off (TR-1, TR-6).
*/
export function createTransit() {
	return {
		// whether the author declared transit off here -- what the ring marks, and nothing else; a type with no choice declares nothing
		declaredOff: (id, model) => {
			const e = model.get('node', id);
			return !!e && e.transit === false && transitOffersOf(e).length > 1;
		},
		// the anchors in a model where what arrives stops, sorted, so a board's derivation can be keyed on them -- the rule as a set
		blockedIn: (model) => model.all('node').filter((e) => valueOf(e) === false).map((e) => e.id).sort(),
		// whether what arrives at one anchor stops there -- the rule asked of one id; an id the model holds no anchor for stops nothing
		stopsAt: (id, model) => {
			const e = model.get('node', id);
			return !!e && valueOf(e) === false;
		},
		/*
		Flip each anchor on its own (ruled 2026-09-28: many anchors at once, each flipped independently), as the EDIT that
		stores it: a set of `transit`, or a whole put without it when the flip returns the anchor to its type's default -- a
		clearing set would leave a key holding undefined (B220's shape; app/src/commands.js `cycleDirection`). An anchor whose
		type offers no choice is refused, and named. `entities` are the anchors as the model holds them.
		*/
		flip(entities) {
			const flipped = [], refused = [], entries = [];
			for (const e of entities) {
				const offers = transitOffersOf(e);
				if (offers.length < 2) { refused.push(e); continue; }
				const next = !valueOf(e);
				const { kind: _k, ...stored } = e;
				if (next === offers[0]) { const { transit: _t, ...without } = stored; entries.push({ op: 'put', kind: 'node', entity: without }); }
				else entries.push({ op: 'set', kind: 'node', id: e.id, after: { transit: next } });
				flipped.push({ ...e, transit: next });
			}
			return { flipped, refused, entries };
		},
	};
}

/*
F-e (H18.7) -- TRANSIT'S EDITS ARE THE PLANNER'S. Turning a waypoint's transit off cuts every link bending there into links
that end there (TR-2); turning it back on joins the two left ending there -- the shared `link-join`, woken by the change
(network/link-reactions.mjs `wakesAt`). They were an edit the page built (`transitEdit`), so two places decided when a join
happened; now a change of `transit`, from any door, sets them off, and undo replays them with the rest.

`transit-cut` runs in the `reshape` phase, after the requested ops and before the stranded pass, the sweep and the join,
so those see the pieces. Each waypoint is cut on the board the cuts before it left (B283), in the order the edit changed them.
A cut re-ends the link the author drew -- its id, its order, its declarations (B213, B284) -- and puts each new piece
newest, with an id derived from the link and the waypoint, so the planner mints the same piece on every peer.
*/
// the cut itself -- re-ending, the derived piece id -- is one shape with the junction's (network/link-rules.mjs `cutAtBend`, V-c)

/*
B303 (H19.10) -- WHERE A LINK MAY NOT BE PINNED: the stops of `link` at which what arrives stops, by the transit rule (TR-1).
A link written pinned through one -- from REST, the CLI, any door -- is cut there, as a drag pressing `w` on it cuts (TR-2b);
the network's landing reaction asks this of each link an edit makes or re-pins, so one reaction owns every cut of a link at its
arrival and two never cut one link in one phase (PD-3).
*/
export function stopsBlockedOn(link, doc, transit) {
	const stops = [...(link.via ?? []), ...(link.closed ? [link.src, link.dst] : [])];
	// a stop that could pass routes and is set not to -- a waypoint or a router with transit off; a host never passes routes, and
	// a ring cornered at one is left as it was
	return stops.filter((w) => nodeOffersTransit(doc.get('node', w)) && transit.stopsAt(w, doc));
}

// where what arrives stops: a ring through it opens there (B299), first, so a second stop of the same edit cuts the loop it left;
// then every link pinned there is cut (TR-2). The one statement of the cut at a stop, for a transit change and a link's arrival.
export function stopAtBlockedStop(doc, w, emit) {
	const links = () => [...doc.all('link')].sort((a, b) => (a.id < b.id ? -1 : 1));
	const passable = (id) => nodeOffersTransit(doc.get('node', id));   // H19.10: a waypoint, or a device that passes routes
	for (const link of links()) { const ops = openRingIntoLoop(link, w, passable); if (ops) emit(ops); }
	for (const link of links()) { const ops = cutAtBend(doc, link, w); if (ops) emit(ops); }
}

export function transitReactions(transit) {
	const cut = {
		id: 'transit-cut',
		phase: 'reshape',
		// a node's transit changing -- a waypoint's, or since H19.10 a device's that passes routes
		trigger: { changed: { kind: BARE_KIND, fields: ['transit'] } },
		doc: 'a waypoint whose transit this edit turned off cuts every link bending there into links that end there, the first keeping the link\'s id, its order and its declarations, each new piece the newest (TR-2, B283, B284); a ring through it opens there into a loop that starts and ends at it, and turning it back on closes the loop into a ring again (B299)',
		run: ({ doc, matches }, emit) => {
			const links = () => [...doc.all('link')].sort((a, b) => (a.id < b.id ? -1 : 1));
			const passable = (id) => nodeOffersTransit(doc.get('node', id));   // H19.10: a waypoint, or a device that passes routes
			// it reads what each change is, not trusting its trigger to have filtered (TG-3)
			for (const { id, before, after, fields } of matches) {
				// a node whose transit changed -- a waypoint, or since H19.10 a device that passes routes
				if (!before || !after || !fields.has('transit') || !passable(id)) continue;
				if (!transit.stopsAt(id, doc)) {
					// B299: turned back on -- a loop ending here closes into a ring again
					for (const link of links()) if (link.src === id) { const ops = closeLoopIntoRing(link); if (ops) emit(ops); }
					continue;
				}
				stopAtBlockedStop(doc, id, emit);
			}
		},
	};
	const offered = {
		id: 'transit-offers',
		trigger: [{ created: ['node'] }, { changed: { kind: 'node', fields: ['transit', 'type'] } }],
		doc: 'a node may store only a transit its type offers: a load balancer, a server and a host never pass routes (TR-6)',
		refuse: ({ matches }) => {
			for (const { after } of matches) {
				if (!after || typeof after.transit !== 'boolean' || transitOffersOf(after).includes(after.transit)) continue;
				return `${after.name || after.id} is a ${after.type}, which never passes routes -- its transit cannot be turned on`;
			}
			return null;
		},
	};
	return { reactions: [cut], refusals: [offered] };
}

/*
WHAT A TRANSIT EDIT DID, read off the planner's answer, for the notice (the director, 2026-10-02): how many links the
author drew were cut and into how many pieces, and how many pieces joined into how many links. A cut is a re-put of a
link and the put of its new piece after it, so a piece cut from a piece is traced to the link it came from -- one link cut
at two waypoints is one link in three pieces. A join is the delete of a link that names what it joined `into`.
*/
export function transitSummary(ops) {
	const drawnAs = new Map();
	const drawn = (id) => drawnAs.get(id) ?? id;
	const into = new Map();
	const survivor = (id) => (into.has(id) ? survivor(into.get(id)) : id);
	let pieces = 0;
	const opened = new Set(), closedRings = new Set();
	// a cut is two link puts in a row (`transit-cut`): the link re-ended, then its new piece
	for (let i = 0; i < ops.length; i++) {
		const op = ops[i], next = ops[i + 1];
		if (op.op === 'put' && op.kind === 'link' && next?.op === 'put' && next.kind === 'link' && next.entity.id !== op.entity.id) {
			drawnAs.set(next.entity.id, drawn(op.entity.id));
			pieces++;
			i++;
			continue;
		}
		if (op.op === 'del' && op.kind === 'link' && op.into) into.set(op.id, op.into);
		// B299: a ring opened into a loop, or a loop closed into a ring -- one put of the link
		if (op.op === 'put' && op.kind === 'link' && op.entity.closed === true) closedRings.add(op.entity.id);
		else if (op.op === 'put' && op.kind === 'link' && op.entity.src === op.entity.dst) opened.add(op.entity.id);
	}
	const cutLinks = new Set(drawnAs.values()).size;
	const joinedLinks = new Set([...into.keys()].map(survivor)).size;
	return {
		cut: cutLinks ? { links: cutLinks, pieces: cutLinks + pieces } : null,
		joined: joinedLinks ? { links: joinedLinks, pieces: joinedLinks + into.size } : null,
		opened: opened.size, closed: closedRings.size,
	};
}
