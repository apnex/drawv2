/*
THE LINK REACTIONS -- what follows from an edit to links and the anchors they run through (PL-3,
dev/design/planner/PLANNER-SYSTEM.md section 6.2).

They were fixed passes inside the planner (`planner/txn.mjs`), each asking the network a question beside it -- four
hooks for one plugin. Now each is a declared REACTION, a row the planner's core runs in its phase:

	{ id, phase, doc, on?(op, doc) -> bool, run(ctx, emit) }

`doc` is what the row means, in a sentence; `tools/reaction-table.mjs` generates dev/design/planner/REACTIONS.md from it.

`run` reads the document and EMITS ops; the core applies each as it is emitted, so a reaction sees what it and every
reaction before it did (B240, B241), and the core writes every inverse (PL-2). A reaction never refuses (PL5): what it
cannot do it declines, and the document rules judge the result in the core's last phase.

A TENANT is an owner and its rows. A composition holds one link tenant (PD-2): the network plugin's (`network/network.mjs`),
built with `linkTenant` and its conditions -- pipes that reference anchors, a sweep that keeps nothing deliberate, a join
that stops where transit is off, and a stranded pass. Production's classic tenant, CLASSIC_LINKS, was deleted at S-b
(H18.12); a test may still build a tenant of its own with other conditions.

Network-layer code (tools/layers.mjs): it reads the model and the link invariants, and nothing of the planner. What it
needs of the planner -- the check a requested write receives -- arrives in `ctx.refuses`.
*/
import { collapseAtWaypoint, pairHolders, LINK_DECLARATIONS, closeLoop } from './link-rules.mjs';
import { isLoop } from './link-references.mjs';   // B300: a join may leave a loop
import { linkEndsAt } from './roles.mjs';   // whether a link ends at a point (B244), one statement with the roles (V-a)
import { BARE_KIND, isBareEntity, bareAnchor, bareAnchors } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)

const touching = (m, w) => m.all('link').filter((l) => l.src === w || l.dst === w || (l.via || []).includes(w));

// ---- clear: before an anchor is deleted, the links that cannot outlive it ----

/*
Deleting a node deletes every link ending at it. Since F-c (H18.5) a waypoint is a node with no type, and both clear reactions
hear a node deleted: each reads which shape of node it was -- the entity is still in the document during the clear phase --
and acts on its own, as the two kinds' triggers kept them apart before.
*/
const NODE_LINKS = {
	id: 'node-links',
	phase: 'clear',
	doc: 'deleting a typed node deletes every link ending at it',
	trigger: { deleted: ['node'] },
	run: ({ op, doc }, emit) => {
		if (isBareEntity(op.kind, doc.get(op.kind, op.id))) return;   // a waypoint: WAYPOINT_LINKS
		emit(doc.linksOf(op.id).map((link) => ({ op: 'del', kind: 'link', id: link.id })));
	},
};

// deleting a waypoint deletes the links ending at it and strips it from the links bending through it
const WAYPOINT_LINKS = {
	id: 'waypoint-links',
	phase: 'clear',
	doc: 'deleting a waypoint deletes the links ending at it, and strips it from the links bending through it -- or deletes one the strip would leave a second straight link on its pair (B81)',
	trigger: { deleted: [BARE_KIND] },
	run: ({ op, doc }, emit) => {
		if (!isBareEntity(op.kind, doc.get(op.kind, op.id))) return;   // a typed node: NODE_LINKS
		const id = op.id;
		const ops = [];
		/*
		B81: stripping a waypoint can leave a link STRAIGHT, and a pair carries only one straight
		link. Where the strip would produce a colliding duplicate the link is deleted with the
		waypoint instead, in the same undoable step.

		That matches the branch below it: a waypoint that is a link's ENDPOINT already deletes the
		link rather than stripping it, on the same principle -- a link that cannot survive the
		operation does not limp on in a degenerate form. Refusing the waypoint deletion outright
		was the alternative and was rejected: being told you may not delete a waypoint because of
		a link you were not thinking about is a worse answer than removing the link that could
		not exist.

		An EXISTING straight link outranks one that would be created by this strip, so the route
		yields to the direct link rather than the reverse.
		*/
		const dying = new Set();
		const stripped = [];
		for (const link of doc.linksAt(id)) {
			if (link.src === id || link.dst === id) dying.add(link.id);
			else stripped.push(link);
		}
		// the document as the strip leaves it, judged by the one predicate (RULESET-AUDIT T4): a stripped link replaces
		// itself here, and a deleted one leaves, so each strip is judged after the ones before it
		let standing = doc.all('link').filter((l) => !dying.has(l.id));
		for (const link of doc.linksAt(id)) if (dying.has(link.id)) ops.push({ op: 'del', kind: 'link', id: link.id });
		for (const link of stripped) {
			const remaining = link.via.filter((w) => w !== id);
			const after = { ...link, via: remaining };
			if (pairHolders(after, standing, doc).length) {
				ops.push({ op: 'del', kind: 'link', id: link.id });
				standing = standing.filter((l) => l.id !== link.id);
				continue;
			}
			standing = standing.map((l) => (l.id === link.id ? after : l));
			ops.push({ op: 'set', kind: 'link', id: link.id, patch: { via: remaining } });
		}
		// decided against the document before any of them applies, then emitted together
		emit(ops);
	},
};

// ---- stranded: the network's only; production strands nothing ----

/*
A pinned link that lost a pin to this transaction is deleted whole -- the network's rule (ruled 2026-09-29, widened
2026-09-30: "a pinned link lives and dies with its pins"), so this builder is used by `network/network.mjs` alone.
*/
/*
	A LINK LEFT WITH NO WAY AFTER LOSING A PIN goes whole (ruled 2026-09-29, see `isStranded` above).

	ON THE RESULT, like the sweep below and for the same reason: a batch may strip a pin and lay the way
	back in a later op. Only a pin DELETED here counts -- one that existed before and is gone now -- so a
	link that loses its route any other way is left to be down, and one ending at the deleted anchor was
	already removed by the cascade. Removed exactly as a requested delete would be (`planDel`), and BEFORE
	the sweep, so the sweep then takes the anchors that existed only for it: one transaction, one undo.
	*/
const STRANDED_LINKS = {
	id: 'stranded-links',
	phase: 'stranded',
	trigger: { deleted: [BARE_KIND] },   // a pin is a waypoint: only losing one strands a link
	doc: 'a link that lost a pin to this edit is deleted whole: a pinned link lives and dies with its pins',
	// TG-3: handed the waypoints deleted; the links that pinned one, still standing, go whole. It reads what each change is
	// rather than trusting its trigger to have filtered -- the shadow guard hands a reaction every change, and caught this
	// one taking a moved waypoint for a deleted one
	run: ({ before, doc, matches }, emit) => {
		const gone = new Set(matches.filter((c) => !c.after && isBareEntity(c.kind, c.before)).map((c) => c.id));
		for (const was of before.all('link')) {
			if (!(was.via || []).some((w) => gone.has(w))) continue;
			if (doc.get('link', was.id)) emit([{ op: 'del', kind: 'link', id: was.id }]);
		}
	},
};

// ---- sweep: the anchors this transaction orphaned ----

/*
	B162 -- a waypoint that has lost every link self-destructs, in the same transaction.

	The cascade already runs the other way: deleting a waypoint deletes a link that cannot survive
	it, because "a link that cannot survive the operation does not limp on in a degenerate form".
	This is the mirror. A waypoint exists to be part of a path; with no path it is debris that still
	renders and still holds its anchor, so a removed shape used to leave its bends scattered on the
	canvas -- 64 of them, from one deleted ring.

	ON THE RESULT, not per op, for the same reason the invariant check below is: a batch may
	transiently orphan and end valid. Deleting one link while re-routing another through the same
	bends is legal and a per-op sweep would eat them in between.

	IN THIS TRANSACTION, so the inverse restores waypoint and link together and one undo puts the
	shape back whole.

	THE ROLE IS DERIVED, never stored. In a link's `via` it is a bend; at `src`/`dst` of an open
	link an endpoint; at `src`/`dst` of a CLOSED link a bend again, because a ring has no ends; and
	referenced nowhere, an orphan. Only `pinned` is written down, because a waypoint placed
	deliberately with no link has no structure to read an intention off.
	AMENDED 2026-10-04 (S-d, H18.14): `pinned` is retired -- nothing about a waypoint's role is written down now.
	*/
/*
	B216 -- only a BEND is swept. A waypoint an author TERMINATED a link at survives losing it.

	The sweep was written for bends and its reasoning is theirs: a bend exists to shape a path, so
	with no path it is debris that still renders and still holds its anchor -- 64 of them left over
	from one deleted ring. An endpoint is not that. It is a place the author put something, the same
	way a node is, and deleting a link must no more remove it than it removes the node at the other
	end.

	`refs` cannot tell them apart -- it folds src, dst and via into one set -- so the role is read
	separately from the state BEFORE the transaction. A waypoint threaded as a bend and nothing else
	is swept; one anything terminated at is kept, and becomes a bare anchor the author can reuse or
	delete deliberately.
	*/
/*
	ONLY WHAT THIS TRANSACTION ORPHANED, which is the same rule the invariant check below uses and
	for the same reason. Sweeping every unreferenced waypoint would make an unrelated commit quietly
	delete debris the caller never mentioned, and would put those deletions in its inverse -- so an
	undo of "move a node" would resurrect somebody else's litter. A document that reached a messy
	state stays repairable on its own terms.

	Found by the GR5 differential: the frozen oracle and the modern planner diverged on random
	mutations that touched no link at all, because the corpus contains documents with pre-existing
	orphans. That divergence was the design telling me the scope was wrong.
	*/
/*
`alsoReferenced(model) -> ids` names what ELSE references an anchor (the network's pipes); `keepsOrphan(w, { wasBendOnly })`
says which orphans survive. Production's rule was B162 and B216: kept if pinned or a link's end. The network keeps none
(ruled 2026-09-29: "deliberate" means held by the pipes laid with g, which reach the sweep through `alsoReferenced`).
S-d (H18.14): `pinned` is retired, and the network's is the only rule a composition runs.
The deletes are emitted one at a time, so each waypoint's groups are trimmed against what the previous trim left (B241).
*/
function orphanSweep({ alsoReferenced = null, keepsOrphan, says }) {
	const refs = (m) => {
		const set = new Set(alsoReferenced ? alsoReferenced(m) : []);
		for (const l of m.all('link')) {
			set.add(l.src);
			set.add(l.dst);
			for (const w of Array.isArray(l.via) ? l.via : []) set.add(w);
		}
		return set;
	};
	// B244 -- whether a link ENDS at a point, a ring having no ends: the role derivation's statement (network/roles.mjs
	// `linkEndsAt`), read here since V-a rather than restated as it had to be while the two could not share by import (C9)
	const endsAt = linkEndsAt;
	const wasBendOnly = (m) => {
		const bend = new Set();
		const terminal = new Set();
		for (const l of m.all('link')) {
			for (const end of [l.src, l.dst]) (endsAt(l, end) ? terminal : bend).add(end);
			for (const w of Array.isArray(l.via) ? l.via : []) bend.add(w);
		}
		for (const id of terminal) bend.delete(id);
		return bend;
	};
	return {
		id: 'orphan-sweep',
		phase: 'sweep',
		// what stops referencing an anchor: a link or pipe deleted, or a link re-ended or re-pinned
		trigger: [{ deleted: ['link', 'pipe'] }, { changed: { kind: 'link', fields: ['src', 'dst', 'via'] } }],
		doc: `a waypoint this edit left referenced by nothing is deleted, its groups trimmed first (B162, B241); ${says}`,
		run: ({ before, doc }, emit) => {
			const wasReferenced = refs(before);
			const nowReferenced = refs(doc);
			const bendOnly = wasBendOnly(before);
			const debris = bareAnchors(doc).filter((w) => !nowReferenced.has(w.id)
				&& wasReferenced.has(w.id)                       // it arrived unreferenced; not ours to remove
				&& !keepsOrphan(w, { wasBendOnly: bendOnly.has(w.id) }));
			for (const w of debris) emit([{ op: 'del', kind: BARE_KIND, id: w.id }]);
		},
	};
}

// ---- join: two links left alone at a waypoint become one ----

/*
	B215 -- a waypoint left with one link IN and one OUT is a BEND, so rejoin them.

	A junction cannot exist with two links; that shape is a path passing through the point. Deleting
	a link from a three-way junction leaves exactly it, and without this the waypoint stays a
	junction -- the document remembering a gesture rather than describing what is on screen.

	HERE, not in the client's delete command, which is where it was first written and wrong. Undo
	and redo are computed server-side and never run a client command, so an undone split stayed
	split; and the CLI and REST doors write through this planner without touching `commands.js` at
	all. One rule, one place, every door.

	THE INBOUND LINK'S ID SURVIVES. It is the half that kept the original id when the link was
	split, so split-then-delete is a round trip back to the route the author drew rather than a
	churn of identities.

	ONLY WAYPOINTS THIS TRANSACTION TOUCHED, the same scope rule the sweep above uses and for the
	same reason: collapsing a pre-existing two-link waypoint would rewrite a shape the caller never
	mentioned and put that rewrite in its inverse.
	*/
/*
	ON LOSING A LINK, not on gaining one. The scope was "any waypoint at the end of any link this
	transaction touched", which included CREATING one -- so drawing two links that met at a
	waypoint collapsed them into a bend the moment the second was made, and the author could never
	build a two-link terminus at all.

	A collapse is a reaction to a shape being LEFT BEHIND. Only a removal can leave one.
	*/
/*
`joinsAt(waypointId, doc)` says whether two links left at a waypoint may join: production always; the network not
where the waypoint's transit is off (TR-5).
*/
/*
`wakesAt` (F-e, H18.7): the node fields whose change makes a waypoint a candidate however its links stood -- the network's
`transit`, so turning it back on joins the two links a cut left there (TR-2). The classic tenant names none.
*/
function linkJoin({ joinsAt = () => true, says, wakesAt = [] }) {
	return {
		id: 'link-join',
		phase: 'join',
		// a link leaving a waypoint, or a link's declarations changing there (B269, B285, B286) -- or, where a tenant says so, a
		// waypoint's own (F-e)
		trigger: [{ deleted: ['link'] }, { changed: { kind: 'link', fields: LINK_DECLARATIONS } }, ...(wakesAt.length ? [{ changed: { kind: BARE_KIND, fields: wakesAt } }] : [])],
		doc: `two links this edit left alone at a waypoint, or made compatible there by changing a plane or direction (B285), become one, the inbound id surviving, unless the result would break a rule a requested write meets (B215, B239); ${says}`,
		// TG-3: handed the links its trigger heard -- deleted, or a declaration changed -- instead of scanning the ops
		run: ({ before, doc, matches, refuses }, emit) => {
			const touched = new Set();
			/*
	B285 -- A CHANGE OF DECLARATION decides a join too (ruled 2026-10-02): an edit that changes one of a link's declarations
	(`LINK_DECLARATIONS`, model/link-rules.mjs -- its plane, its direction) can make the two links at a junction compatible, and two links remaining compatible after a mutation join (2026-09-28).
	So the ends of such a link are candidates whatever the count did. Nothing else that sets a link is: a rename or a move
	of a pin decides nothing, and a second link drawn to a terminus still never joins (B214).
	*/
			/*
	B286 -- A DECLARATION THAT CHANGED, however the edit was written: compared on the link before the edit and after it,
	not read off a `set`'s patch -- clearing a direction is a whole-entity put (app/src/commands.js `cycleFlow`), and the
	patch test missed it. A link the edit created is not compared: a second link drawn to a terminus never joins (B214).
	*/
			const redeclared = new Set();
			const woken = new Set();   // B300: waypoints whose own declaration -- transit -- set this join off; only there may a loop result
			for (const { kind, id, before: was, after: now, fields } of matches) {
				// a waypoint whose own declaration changed -- its transit turned back on, say (F-e): a candidate as a redeclared link's end is
				if (kind === BARE_KIND) { if (now && isBareEntity(kind, now) && wakesAt.some((f) => fields.has(f))) { touched.add(id); redeclared.add(id); woken.add(id); } continue; }
				if (kind !== 'link') continue;
				if (now && LINK_DECLARATIONS.some((k) => fields.has(k))) {
					for (const end of [now.src, now.dst]) if (bareAnchor(doc, end)) { touched.add(end); redeclared.add(end); }
					continue;
				}
				if (now) continue;
				for (const end of [was.src, was.dst]) if (bareAnchor(doc, end)) touched.add(end);
			}
			/*
	B269 -- ONLY WHERE A LINK LEFT. A deleted link that is replaced at the same waypoint -- a split puts its half back,
	ending where it did -- leaves the count there as it was, and nothing was left behind; joining there rewrote a two-link
	terminus nobody touched. Found in the lab: cutting a link at a second non-transiting pin joined the two links at the
	first. So a waypoint joins only when this transaction lowered the number of links touching it.
	*/
			for (const w of touched) {
				const at = touching(doc, w);
				// a link left (B269), or one of the two was redeclared (B285)
				if (at.length !== 2 || (at.length >= touching(before, w).length && !redeclared.has(w))) continue;
				if (!joinsAt(w, doc)) continue;
				/*
		B222 -- PICK A PAIR, do not demand a stored orientation.

		This chose `inbound` by `l.dst === w` and `outbound` by `l.src === w`, so two links that both
		stored `w` as their src found no inbound and the collapse silently declined. Stored order is
		which end the author dragged from; for an undeclared link it means nothing, and reading it
		here made a bend's survival depend on a gesture several steps earlier.

		The src side is the link that ENDS at the waypoint, preferred so the original id survives a
		split-then-collapse round trip (B213). When neither ends here, `collapseAtWaypoint` orients
		them; when both do, the other is flipped. Order within the pair is all that is decided here.
		*/
				const src = at.find((l) => l.dst === w) || at[0];
				const other = at.find((l) => l !== src);
				let merged = other ? collapseAtWaypoint(src, other, w, { loop: woken.has(w) }) : null;
				if (!merged) continue;
				/*
		B300 -- A LOOP EXISTS ONLY WHILE ITS END STOPS WHAT ARRIVES (ruled 2026-10-07, B299). A join that leaves one -- the two
		pieces of a ring cut at two waypoints, rejoined at one -- closes it into a ring where its end lets links join, so turning
		a ring's waypoints back on makes it whole in whatever order.
		*/
				if (isLoop(merged) && joinsAt(merged.src, doc)) merged = closeLoop(merged)[0].entity;
				const inbound = src, outbound = other;
		// `patch`, not `after` -- `after` is the COMMAND vocabulary and applyOps reads `patch`. The
		// first version used the command spelling, so the del landed and the merge silently did not.
		// SRC travels in the patch too. It never changed while the pair had to arrive stored in the
		// right order, so writing only dst and via was sufficient; now that the src side may be
		// flipped to face through the point, omitting it left the merged link still ending at the
		// waypoint it was supposed to absorb.
		// DIRECTION travels with SRC, for the same reason. A declaration is expressed relative to the
		// stored order, so a flip that inverts `direction` in the merged object but does not write it
		// leaves the document declaring the opposite of what the author meant -- silently, since
		// every other field looks right. Omitted only when the link was undeclared.
				const patch = { src: merged.src, dst: merged.dst, via: merged.via,
					...(merged.direction !== undefined ? { direction: merged.direction } : {}), ...(merged.closed ? { closed: true } : {}) };
				/*
		B239 -- a merge is TAKEN only if the link it produces passes the rules a requested write does.

		The merged link is built from two valid halves, and that is not enough. Joining x->w to
		w->y via [x] names x twice, and joining two halves can produce an endpoint pair another link
		already bends through at a shared waypoint. The referential rules refuse both, and they are
		deliberately outside `violations()` -- which was this write's only check. So the collapse
		committed documents that `validateDoc` refuses, and the store skips a refused file at its next
		boot: the whole diagram lost, from a delete the author made legally.

		The SAME check a requested set receives, rather than a second copy of the rules, run against
		the projection AS THE EARLIER MERGES LEFT IT (B240) -- a merge can be legal on the document
		the transaction started from and illegal once a neighbouring merge has already produced the
		link it would duplicate. Declining is safe: two links left meeting at the waypoint is a
		two-link terminus, which is a legal state (B217) and exactly what the author would have had
		without the collapse.

		Checked with the absorbed half still present, because it cannot change the verdict: it always
		ends at this waypoint and the merged link never does, so it never shares the merged link's
		endpoint pair. The first version removed it from a whole-document copy per candidate, which
		made a large delete about four times slower and produced byte-identical plans over 39,858
		randomized transactions (H16 review).
		*/
				if (refuses({ op: 'set', kind: 'link', id: inbound.id, patch })) continue;   // declined, never refused (PL5)
				/*
				The inverse is the core's (PL-2), and it reaches for `inverseOfSet`, which solves the case that bit here
				when it was hand-written: a collapse INTRODUCES `via` on a link that had none, so the inverse is a `put`
				of the whole prior link rather than `patch: { via: [] }`, which would leave an empty array behind.
				*/
				/*
		B240 -- APPLIED AS IT IS DECIDED, so the next merge reads the document this one left.

		The merges used to be collected and applied once, after the loop. Every merge after the first
		therefore read its pair as the links stood before ANY merge. Delete the one link that made two
		neighbouring waypoints junctions and both collapse: the second then rewrote a link the first had
		already deleted, the set landed on nothing, and the far node was left with no link -- while the
		transaction reported success and the document validated. Declared flow was judged against the
		same stale links, so a convergence the matrix calls a junction was merged away.

		This is the shape the planner already uses between requested ops: advance the projection, then
		read it. The set of waypoints to consider is still fixed before the loop, so a merge's own
		delete never becomes a trigger -- a valid merge carries both halves' references and cannot
		leave a new candidate behind.
		*/
				// SUCCESSION (TG-1b): the deleted link says what it joined into, a fact the answer carries, so a page following an
				// entity -- its selection, B288 -- reads it rather than recognising the shape of these two ops
				emit([{ op: 'del', kind: 'link', id: outbound.id, into: inbound.id }, { op: 'set', kind: 'link', id: inbound.id, patch }]);
			}
		},
	};
}

// ---- a link tenant, from the builders above ----

/*
Every link tenant is the same rows in the same order, differing in its CONDITIONS -- which the tenant's author states
at composition, and the planner never asks: whether links that lost a pin are stranded, what else references an
anchor, which orphans survive, where links may join. `says` puts the last two in words, for the generated table. Production states its own (`planner/tenants.mjs`), and so does
the network (`network/network.mjs`).
*/
export function linkTenant({ owner, stranded = false, alsoReferenced = null, keepsOrphan, joinsAt = () => true, joinWakesAt = [], says }) {
	return {
		owner,
		reactions: [NODE_LINKS, WAYPOINT_LINKS, ...(stranded ? [STRANDED_LINKS] : []),
			orphanSweep({ alsoReferenced, keepsOrphan, says: says.sweep }), linkJoin({ joinsAt, says: says.join, wakesAt: joinWakesAt })],
	};
}
