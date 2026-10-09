/*
Commands — request builders. Every committed user action becomes a command: a label and a list of
entries describing the FORWARD intent. app/src/changes.js applies them locally and submits them.

  { op: 'put', kind, entity }        create or replace
  { op: 'del', kind, entity }        remove (the entity rides along for the local apply)
  { op: 'set', kind, id, after }     change these fields

No entry carries `before` any more. The inverse is derived server-side by the planner, which is the
only place that holds the pre-state at the moment each op is decided — so computing it here was
both duplicated and, for anything the server cascades, incomplete.

The cascade closures below survive on purpose. They are a LOCAL PROJECTION: a disconnected browser
must not build a document whose links dangle, and the server's planner re-derives the same cascade
idempotently over the explicit ops (an already-deleted link yields no further op). What went is the
inverse-building, not the closure.
AMENDED 2026-10-04 (P5 V-d, H18.28; PL-6): the closures went too. A command is the author's intent alone; the page previews it
with the planner (app/src/changes.js), which is the one place a cascade, a strip, a trim or a steal is decided -- and a
disconnected browser previews with it as well, so it still never builds a document whose links dangle.
*/

import { clone } from '../../model/ops.mjs';
import { kindOf, projection } from '../../model/model.mjs';
import { GAP, clampDelta } from './snap.js';
import { BARE_KIND } from '../../model/anchors.mjs';
import { bareAnchor, isTypedEntity } from '../../devices/device-shapes.mjs';
import { drawnKind } from '../../devices/anchor-words.mjs';   // the drawn word (F4)   // the bare anchor, asked in one place (F-b)

// entities are cloned at every command boundary: the live store object must never
// alias a history entry, or later in-place model.set mutations rewrite history
// ---- command builders ----

export function createEntity(kind, entity) {
	// named for what is drawn: a node with no type is a waypoint (F-c, F4)
	return { label: `create ${drawnKind(kind, entity)}`, entries: [{ op: 'put', kind, entity: clone(kind, entity) }] };
}

/*
The anchors a REFUSED drag keeps -- one undo step, so the kept geometry comes back or goes as one.

A route hook may refuse a link and name anchors to keep (the incubating network plugin keeps the `g`
anchors of a refused drag: the director, 2026-09-29, "G is supposed to keep the pipe/anchors even if the
link fails"). They were placed live during the drag and exist only in the tab; this is the commit that
takes them to the planner. Built here, not in Input, because commands are built in one place.
*/
export function keepAnchors(waypoints) {
	return { label: 'guide anchors', entries: waypoints.map((w) => ({ op: 'put', kind: BARE_KIND, entity: clone(BARE_KIND, w) })) };
}

/*
H17.22 N-c -- A DRAG JUDGE'S ENTRIES, after the drag's own command: one edit, one undo step. With no command of the drag's
own (a refused drag that keeps nothing), the judge's entries are the edit, labelled for what they are. Kind-blind: what
the entries put is the judge's -- the network's pipes in the lab.
*/
export function withJudged(command, judged = []) {
	if (!command) return judged.length ? { label: 'pipes', entries: [...judged] } : null;
	return judged.length ? { ...command, entries: [...command.entries, ...judged] } : command;
}

// moves: [{ kind: 'node'|'zone', id, after: {x,y} }]
export function moveEntities(moves) {
	return {
		label: 'move',
		entries: moves.map((m) => ({
			op: 'set', kind: m.kind, id: m.id,
			after: { x: m.after.x, y: m.after.y }
		}))
	};
}

/*
Delete a selection -- what the author asked, and only that (P5 V-d, H18.28; PL-6, ruled PD-5).

This computed the whole closure in the browser: links touching a deleted node, a deleted pin's strip and B81's delete instead,
groups trimmed or dissolved -- a "local projection" of the server's rules, which drifted from them (B221, P-7: a pin deleted
here stripped while the server deleted its link). The planner is the one place those rules live, and the page previews
with it (app/src/changes.js), so this sends the deletes the author made and the tab shows the planner's consequences.
Selected entities only, each once, by its kind -- a plugin's too (a hand pipe, B281): dependents first, so the request reads
as the author would say it.
*/
// C-e (H19.33): each kind's rank in a delete is its part's (`deleteRanks`) -- the groups plugin's group first, the zones plugin's
// zone, the network's link, the anchor last; a kind no part ranks, 3
export function deleteRanksOf(parts) {
	const ranks = {}, by = {};
	for (const p of parts) for (const [kind, rank] of Object.entries(p.deleteRanks ?? {})) {
		if (kind in ranks) throw new Error(`commands: ${kind}'s rank in a delete is brought by ${by[kind]} and by ${p.owner}`);
		ranks[kind] = rank; by[kind] = p.owner;
	}
	return ranks;
}

export function deleteSelection(model, ids, ranks = {}) {
	const entries = [...ids].filter((id) => model.entityExists(id))
		.map((id) => ({ id, kind: kindOf(id) }))
		.sort((a, b) => (ranks[a.kind] ?? 3) - (ranks[b.kind] ?? 3))
		.map(({ id, kind }) => ({ op: 'del', kind, entity: clone(kind, model.get(kind, id)) }));
	return { label: 'delete', entries };
}

// W6 — live input editing: write a new value into a node's content region (idx). Deep-copies the whole
// content array (regions are objects in an array) so before/after are independent history snapshots.
export function setContentValue(model, nodeId, idx, value) {
	const node = model.get('node', nodeId);
	if (!node || !Array.isArray(node.content) || !node.content[idx]) return { label: 'edit', entries: [] };
	const dup = (c) => c.map((r) => ({ ...r, ...(r.at ? { at: [...r.at] } : {}) }));
	const before = dup(node.content);
	const after = dup(node.content);
	after[idx].value = value;
	return { label: 'edit', entries: [{ op: 'set', kind: 'node', id: nodeId, after: { content: after } }] };
}

export function renameEntity(kind, id, before, after) {
	return {
		label: 'rename',
		entries: [{ op: 'set', kind, id, after: { name: after } }]
	};
}

// clone a subgraph: entries are puts of already-materialized clone entities
// (built by input.js during the drag); commit re-applies them idempotently
export function cloneEntities(clones) {
	return {
		label: 'clone',
		entries: clones.map((c) => ({ op: 'put', kind: c.kind, entity: clone(c.kind, c.entity) }))
	};
}

// ---- H6.2 Tier B: the last six, previously built by hand inside input.js (B44) ----
// They lived there because each is a one-liner at its call site. That is exactly why they drifted:
// four carried a dead `before` and two aliased the live store through a shallow spread, both against
// rules stated at the top of THIS file. A builder cannot disagree with its own module.

// drag a zone corner: the committed geometry (the live preview already wrote it; history owns the edit)
// C-d (H19.32): an entity's fields set to what a handle drag made of them -- the shared handle gesture's one command, its label
// the handles' (a zone's corners: 'resize')
// C-e (D5): one entity put, under a plugin's label -- a group the groups plugin made
export function putEntity(label, kind, entity) {
	return { label, entries: [{ op: 'put', kind, entity: clone(kind, entity) }] };
}

// C-e (D5): several entities' fields set, as one edit under a plugin's label -- the devices plugin's reshape
export function setFieldsAll(label, sets) {
	return { label, entries: sets.map((x) => ({ op: 'set', kind: x.kind, id: x.id, after: x.after })) };
}

// C-e (D5): several entities put, as one edit under a plugin's label -- the network's chained links
export function putEntities(label, puts) {
	return { label, entries: puts.map((p) => ({ op: 'put', kind: p.kind, entity: clone(p.kind, p.entity) })) };
}

// C-e (D5): a plugin's edit handed over as entries -- the network's transit -- each rebuilt here, so a put or a delete
// carries its own copy and nothing the wire drops (B44)
export function editOf(label, entries) {
	return { label, entries: entries.map((e) => (e.op === 'set'
		? { op: 'set', kind: e.kind, id: e.id, after: { ...e.after } }
		: { op: e.op, kind: e.kind, entity: clone(e.kind, e.entity) })) };
}

// C-e (D5): entities deleted, under a plugin's label -- each that still exists, as the model holds it
export function deleteEntities(label, model, refs) {
	return { label, entries: refs.filter((r) => model.get(r.kind, r.id)).map((r) => ({ op: 'del', kind: r.kind, entity: clone(r.kind, model.get(r.kind, r.id)) })) };
}

export function setFields(label, kind, id, after) {
	return { label, entries: [{ op: 'set', kind, id, after }] };
}

// a finished route: the materialised waypoints AND the link as one undo step, waypoints first so the
// link never references a bend that does not exist yet.
export function routeLink(placed, link) {
	/*
	B210's SPLITS rode in this entry list until V-c (H18.27): linking to a bend cut the link bending there, computed here in the
	browser. The cut is the planner's now (network/network.mjs `junction-cut`), at every door (B243), and arrives in the answer.
	*/
	return {
		label: link.via?.length ? 'route' : 'link',   // a NAME for the undo entry, not the pair rule (that is `pairHolders`)
		entries: [
			...(placed || []).map((wp) => ({ op: 'put', kind: BARE_KIND, entity: clone(BARE_KIND, wp) })),
			{ op: 'put', kind: 'link', entity: clone('link', link) }
		]
	};
}

/*
One hop of a chained link run -- B147.

`routeLink` above maps everything in `placed` to `kind: BARE_KIND`, which is right for what it was
built for and wrong for a hop: a hop lands on a NODE. Passing the node through that list produced a
`put/waypoint` carrying a node's fields, which the browser applied happily and the server refused
with `commit rejected - invalid` -- caught by the director in the editor, not by any test here.

So the kinds are named rather than assumed. The waypoints threaded into this segment, the node the
segment lands on, and the link, as ONE entry list: undoing a chain should step back one hop, not
unpick a node from its link.
*/
/*
Several links from one drag, as ONE undo step -- what `routeLink` is for a single link. A drag judge may cut the drawn link
at stops it names (transit, TRANSIT.md section 12, TR-2b: a w on an anchor whose transit is off makes two links ending
there), and the pieces arrive together, with the anchors the drag placed; the cuts their ends make are the planner's (V-c).
*/
export function routeLinks(placed, links) {
	return {
		label: 'route',
		entries: [
			...(placed || []).map((wp) => ({ op: 'put', kind: BARE_KIND, entity: clone(BARE_KIND, wp) })),
			...links.map((l) => ({ op: 'put', kind: 'link', entity: clone('link', l) })),
		],
	};
}

export function chainHop(waypoints, node, link) {
	return {
		label: 'chain',
		entries: [
			...(waypoints || []).map((wp) => ({ op: 'put', kind: BARE_KIND, entity: clone(BARE_KIND, wp) })),
			{ op: 'put', kind: 'node', entity: clone('node', node) },
			{ op: 'put', kind: 'link', entity: clone('link', link) },
		],
	};
}

// ---- document metadata. `meta` is a single record, so these patch it rather than an entity. ----
// Both were written out by hand in sync.js — the second copy is why this
// exists as a builder rather than a third literal.

export function renameDocument(name) {
	return { label: 'rename', entries: [{ op: 'meta', patch: { name } }] };
}


/*
---- H6.9 / B46: builders that COMPUTE, not just shape ----

These four were written inside input.js, where they read as gesture code because a key press is what
triggers them. None of them touches `mode`, `ctx` or an event: each takes the model and a selection
and answers "what change does this intent produce". That is this module's sentence, so they belong
here — the same argument as B44, in the form GR16 cannot see, because they called a builder rather
than writing a `{label, entries}` literal.

They self-guard and return EMPTY ENTRIES when there is nothing to do, following `createGroup` and
`reshapeNodes`. `Changes.commit` and `Changes.amend` both no-op on an empty command, so a caller
never needs a guard of its own — which is what lets the call sites collapse to one line.
*/

// arrow keys — shift the movable part of the selection one cell, clamped so nothing leaves the canvas
export function nudgeSelection(model, ids, dx, dy, places) {   // C-c: `places`, the placed kinds (snap.js placesOf)
	const moved = [];
	ids.forEach((id) => {
		const kind = kindOf(id);
		if (!places.has(kind)) return;
		const e = model.get(kind, id);
		if (e) moved.push({ kind, id, before: { x: e.x, y: e.y } });
	});
	if (moved.length === 0) return { label: 'move', entries: [] };
	const delta = clampDelta(model, moved, { x: dx * GAP, y: dy * GAP }, places);
	if (delta.x === 0 && delta.y === 0) return { label: 'move', entries: [] };
	return moveEntities(moved.map((m) => ({
		kind: m.kind, id: m.id, after: { x: m.before.x + delta.x, y: m.before.y + delta.y },
	})));
}

/*
Clone a subgraph — the closure, computed against a PROJECTION so nothing real is touched.

This was `input.js#cloneClosure`, where it had to `put` each copy into the live model as it went.
That put was doing allocation, not authoring: `newId` reads the collection, `nextName` rebuilds its
set from the model, and both go wrong for sibling k if k-1 is not there yet. Proven by removing the
puts and cloning three hosts — `[host-4, host-4, host-4]`. A scratch projection gives the batch a
namespace that already contains itself, which is the same trick `planner/txn.mjs` plans with.

What comes back is inert: plain entities in no model at all. MATERIALISING them is the caller's
decision and the two callers differ, which is exactly why it does not belong in here. A clone DRAG
puts them live so they render under the pointer (INPUT.md I-IN5 — live preview writes the shared
Model); Ctrl+D never shows them and goes straight to a commit.
*/
// C-e (H19.33): what follows a clone, each part's, in rank order -- the network's link (1), the groups plugin's group (2)
export function followersOf(parts) {
	return parts.flatMap((p) => (p.follows ?? []).map((f) => ({ ...f, owner: p.owner }))).sort((a, b) => a.rank - b.rank);
}

// C-c: the seeds a placed kind's (snap.js placesOf); C-e: what follows them, the parts' followers (followersOf)
export function cloneSubgraph(model, seedIds, places, followers = []) {
	const scratch = projection(model);       // allocate against a namespace that includes the batch
	const idMap = new Map();
	const clones = [];

	// One cloner per placeable kind. A waypoint is `{id, x, y}` and nothing else
	// (planner/validate.js FIELDS.waypoint), so it must NOT be given a name — inventing a field the
	// server rejects makes the clone apply locally and then be refused on the wire.
	const cloneEntity = (kind, src) => {
		const copy = { ...src, id: scratch.freshId(kind) };   // an anchor's hex unique across anchor kinds (N2)
		// a copy is a new item, drawn newest -- not at its original's place (F-d)
		if (scratch.kinds.optional[kind]?.has('order')) copy.order = scratch.nextOrder(kind);
		/*
		B187 -- EVERY clone is renamed, by kind rather than by a list of kinds.

		This renamed a node and a zone and deliberately skipped a waypoint, because the schema had no
		name field and inventing one made the clone apply locally then be refused on the wire. The
		hazard is now inverted: `{...src}` carries the ORIGINAL's name, and two entities sharing one
		makes `resolveId` refuse them both as ambiguous.

		A node is renamed from its TYPE -- `host-4`, not `node-4` -- which is the convention
		`nextName` was built for and the only reason this is not a one-liner.
		*/
		copy.name = scratch.nextName(isTypedEntity(kind, src) ? src.type : drawnKind(kind, src));
		idMap.set(src.id, copy.id);
		scratch.put(kind, copy);             // the THROWAWAY, so sibling k+1 can see it
		clones.push({ kind, entity: copy });
		return copy;
	};

	seedIds.forEach((id) => {
		const kind = kindOf(id);
		if (!places.has(kind)) return;   // B30: waypoints are placeable -- every placed kind is (C-c)
		const src = model.get(kind, id);
		if (src) cloneEntity(kind, src);
	});
	if (idMap.size === 0) return null;

	/*
	C-e (H19.33) -- WHAT FOLLOWS the seeds is each part's: a link both of whose ends were cloned, with bends of its own (the
	network, network/link-clone.mjs), then a group all of whose members were (the groups plugin, groups/group-clone.mjs). A
	follower clones a further anchor through the canvas's own cloner, and adds each copy -- into the scratch, so the next
	sibling sees it, and into the batch.
	*/
	const add = (kind, copy, fromId = null) => {
		if (fromId) idMap.set(fromId, copy.id);
		scratch.put(kind, copy);
		clones.push({ kind, entity: copy });
	};
	for (const f of followers) f.follow({ model, scratch, idMap, cloneAnchor: (src) => cloneEntity(kindOf(src.id), src), add });
	return { clones, idMap };
}

/*
H12.7 -- arm or disarm an endpoint waypoint as a spawner.

ASYMMETRIC ON PURPOSE, and the asymmetry is forced by the ops vocabulary rather than chosen.

Arming ADDS a key, which `set` expresses. Disarming REMOVES one, which `set` cannot: `model.set` is
`Object.assign`, so a patch of `{ spawn: undefined }` writes the key as undefined rather than
dropping it, and the validator then refuses the entity because `spawn` must be a whole object. So
disarming is a `put` of the entity WITHOUT the field -- the same reasoning `planner/txn.mjs`
already applies in reverse, where a `set` that introduces a key inverts as a whole-entity `put`.

`since` is stamped by the CALLER from the agreed clock, never from `Date.now()` here. A builder
that read the wall clock would put a local instant into a shared document, and every other peer
would compute departures from a phase that was never theirs.
*/
export function toggleSpawn(model, waypointId, now, opts = {}) {
	const wp = bareAnchor(model, waypointId);
	if (!wp) return null;
	if (wp.spawn) {
		const { spawn, ...without } = wp;
		return { label: 'stop spawning', entries: [{ op: 'put', kind: BARE_KIND, entity: clone(BARE_KIND, without) }] };
	}
	/*
	RED by default, per the director. It is DOCUMENT state rather than a stylesheet rule, because a
	spawner may eventually want its own colour -- so changing this default moves NEW spawners only,
	and anything already armed keeps the colour it was authored with. Disarm and re-arm to adopt it.
	*/
	const spawn = {
		interval: opts.interval ?? 900,
		// CELLS per second (B172). 1.4 crosses a cell in about 700ms, which reads as travelling
		// rather than flickering. The conversion to pixels is the simulation's, done once.
		speed: opts.speed ?? 1.4,
		// a KIND, not a colour -- the stylesheet owns the look, so changing it reaches spawners
		// that already exist rather than only the next one armed
		kind: opts.kind ?? 'packet',
		since: now,
	};
	// NESTED, not spread. `after` is the patch applied to the WAYPOINT, so a bare spread would
	// write interval/speed/colour as top-level waypoint fields and the server would refuse them --
	// which is exactly what it did, and what the test below caught before it ever reached a wire.
	return { label: 'spawn', entries: [{ op: 'set', kind: BARE_KIND, id: waypointId, after: { spawn } }] };
}
