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
import { splitAtBend } from './link-rules.mjs';
import { isBareEntity, bareAnchor, BARE_KIND } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)

const BOTH = [true, false], OFF = [false];
const OFFERS = { router: BOTH, firewall: BOTH, vxlan: BOTH, loadbalancer: OFF, server: OFF, host: OFF };

// the values a node offers, its default first: a bare anchor offers both
const transitOffers = (entity) => (isBareEntity(BARE_KIND, entity) ? BOTH : OFFERS[entity.type] ?? OFF);

// an anchor's transit: what it stores, or its type's default
const valueOf = (entity) => (typeof entity.transit === 'boolean' ? entity.transit : transitOffers(entity)[0]);

/*
The transit rules, read off the model each is asked about -- nothing is kept here (F-e). The one rule (B278): what arrives at
an anchor stops there when its transit is off, declared or by a type that offers only off (TR-1, TR-6).
*/
export function createTransit() {
	return {
		// whether the author declared transit off here -- what the ring marks, and nothing else; a type with no choice declares nothing
		declaredOff: (id, model) => {
			const e = model.get('node', id);
			return !!e && e.transit === false && transitOffers(e).length > 1;
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
				const offers = transitOffers(e);
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
const hexOf = (id) => id.slice(id.indexOf('-') + 1);
const pieceId = (doc, from, at) => {
	let n = (parseInt(hexOf(from), 16) ^ parseInt(hexOf(at), 16)) & 0xffffff;
	for (;;) {
		const id = `link-${n.toString(16).padStart(6, '0')}`;
		if (!doc.get('link', id)) return id;
		n = (n + 1) & 0xffffff;
	}
};

export function transitReactions(transit) {
	const cut = {
		id: 'transit-cut',
		phase: 'reshape',
		trigger: { changed: { kind: BARE_KIND, fields: ['transit'] } },
		doc: 'a waypoint whose transit this edit turned off cuts every link bending there into links that end there, the first keeping the link\'s id, its order and its declarations, each new piece the newest (TR-2, B283, B284)',
		run: ({ doc, matches }, emit) => {
			// it reads what each change is, not trusting its trigger to have filtered (TG-3): a waypoint whose transit changed, and
			// that stops what arrives now
			for (const { id: w, before, after, fields } of matches) {
				if (!before || !after || !fields.has('transit') || !bareAnchor(doc, w) || !transit.stopsAt(w, doc)) continue;
				for (const link of [...doc.all('link')].sort((a, b) => (a.id < b.id ? -1 : 1))) {
					const halves = splitAtBend(link, w);
					if (!halves) continue;
					const { via: _drop, ...rest } = link;
					const [first, second] = halves;
					const piece = { ...second, id: pieceId(doc, link.id, w), name: doc.nextName('link'), order: doc.nextOrder('link') };
					emit([{ op: 'put', kind: 'link', entity: { ...rest, ...first } }, { op: 'put', kind: 'link', entity: piece }]);
				}
			}
		},
	};
	const offered = {
		id: 'transit-offers',
		trigger: [{ created: ['node'] }, { changed: { kind: 'node', fields: ['transit', 'type'] } }],
		doc: 'a node may store only a transit its type offers: a load balancer, a server and a host never pass routes (TR-6)',
		refuse: ({ matches }) => {
			for (const { after } of matches) {
				if (!after || typeof after.transit !== 'boolean' || transitOffers(after).includes(after.transit)) continue;
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
	}
	const cutLinks = new Set(drawnAs.values()).size;
	const joinedLinks = new Set([...into.keys()].map(survivor)).size;
	return {
		cut: cutLinks ? { links: cutLinks, pieces: cutLinks + pieces } : null,
		joined: joinedLinks ? { links: joinedLinks, pieces: joinedLinks + into.size } : null,
	};
}
