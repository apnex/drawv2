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

import { linkBetween, makeLink } from '../../network/link-queries.mjs';   // which links meet an anchor: the network's (K13d)
import { clone } from '../../model/ops.mjs';
import { kindOf, newId, projection } from '../../model/model.mjs';
import { makeZone } from '../../zones/make-zone.mjs';   // the zones plugin's factory (O-b1)
import { makeGroup } from '../../groups/make-group.mjs';   // the groups plugin's factory (O-c)
import { GAP, HALF, ZONE_EXT, clampDelta } from './snap.js';
import { SPAN_MAX } from '../../model/limits.mjs';
import { BARE_KIND, ANCHOR_KINDS } from '../../model/anchors.mjs';
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
export function deleteSelection(model, ids) {
	const RANK = { group: 0, zone: 1, link: 2, node: 4 };   // a plugin's kind ranks 3
	const entries = [...ids].filter((id) => model.entityExists(id))
		.map((id) => ({ id, kind: kindOf(id) }))
		.sort((a, b) => (RANK[a.kind] ?? 3) - (RANK[b.kind] ?? 3))
		.map(({ id, kind }) => ({ op: 'del', kind, entity: clone(kind, model.get(kind, id)) }));
	return { label: 'delete', entries };
}

// Group a selection: the group, and nothing else -- the planner's `group-steal` takes its members from any other group (V-d)
export function createGroup(model, memberIds) {
	const members = memberIds.filter((id) => model.endpointOf(id));
	if (members.length < 2) return { label: 'group', entries: [] };
	return { label: 'group', entries: [{ op: 'put', kind: 'group', entity: makeGroup(model, members) }] };
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

// toggle each selected node's frame shape (circle <-> square) — one undoable command. Non-node ids and
// missing nodes are skipped (model.get returns undefined).
export function reshapeNodes(model, ids) {
	const entries = ids.map((id) => (isTypedEntity('node', model.get('node', id)) ? model.get('node', id) : undefined)).filter(Boolean).map((n) => {
		const before = n.shape || 'circle';
		return { op: 'set', kind: 'node', id: n.id, after: { shape: before === 'square' ? 'circle' : 'square' } };
	});
	return { label: 'reshape', entries };
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

// one undoable command covering every group being dissolved
export function ungroupAll(model, groupIds) {
	const entries = [];
	groupIds.forEach((id) => {
		const group = model.get('group', id);
		if (group) entries.push({ op: 'del', kind: 'group', entity: clone('group', group) });
	});
	return { label: 'ungroup', entries };
}

// ---- H6.2 Tier B: the last six, previously built by hand inside input.js (B44) ----
// They lived there because each is a one-liner at its call site. That is exactly why they drifted:
// four carried a dead `before` and two aliased the live store through a shallow spread, both against
// rules stated at the top of THIS file. A builder cannot disagree with its own module.

// drag a zone corner: the committed geometry (the live preview already wrote it; history owns the edit)
// C-d (H19.32): an entity's fields set to what a handle drag made of them -- the shared handle gesture's one command, its label
// the handles' (a zone's corners: 'resize')
export function setFields(label, kind, id, after) {
	return { label, entries: [{ op: 'set', kind, id, after }] };
}

function resizeZone(id, after) {   // C-d: the zone's resize step (Shift+arrows) builds it; the handle drag sets the box itself
	return { label: 'resize', entries: [{ op: 'set', kind: 'zone', id, after: { x: after.x, y: after.y, w: after.w, h: after.h } }] };
}

// Shift+arrow: grow/shrink the lone selected node's span one cell (W1). Same 'resize' label as the
// zone path on purpose — one coalescing window covers a burst of either (D11).
export function resizeNodeSpan(id, span) {
	return { label: 'resize', entries: [{ op: 'set', kind: 'node', id, after: { span: { cols: span.cols, rows: span.rows } } }] };
}

// re-plug: rewire one end of a link onto another node
// fast-replace: retype a node in place — id/name/links/position survive
export function retypeNode(id, type) {
	return { label: 'retype', entries: [{ op: 'set', kind: 'node', id, after: { type } }] };
}

// C — close/open a multi-hop route. The label states which way it went, so undo reads correctly.
export function toggleClosed(link) {
	const closed = !link.closed;
	return { label: closed ? 'close path' : 'open path', entries: [{ op: 'set', kind: 'link', id: link.id, after: { closed } }] };
}

/*
H15.6 -- CYCLE a link's declared direction. Three states, so this cycles rather than toggles.

`direction` is absent (undeclared and symmetric), `forward` (the flow follows the stored order) or `reverse`
(it runs against it) -- `flow`, a boolean, until the format batch (F1, 2026-10-03). The cycle is undeclared -> forward -> reverse -> undeclared, which lets an author
reach every state from any state without needing to know which one they are in.

RETURNING TO UNDECLARED REMOVES THE KEY rather than writing a third value. Absent is what every
document written before this field carries and what `facing` reads as "no direction at all"; a link
left holding `direction: null` would be a fourth state the model does not have. `direction` is listed OPTIONAL
in model/shape.mjs, so the set-inverse rule turns the removing patch into a whole-entity put and
undoing the last step restores a link byte-identical to one never declared.

Direction is stored relative to `src`/`dst` and NOT as an end-name, so this never has to look at
which end is which -- see `linkFacing` in network/roles.mjs for what reads it.
*/
export function cycleDirection(link) {
	if (link.direction !== 'forward' && link.direction !== 'reverse') {
		return { label: 'direction forward', entries: [{ op: 'set', kind: 'link', id: link.id, after: { direction: 'forward' } }] };
	}
	if (link.direction === 'forward') {
		return { label: 'direction reverse', entries: [{ op: 'set', kind: 'link', id: link.id, after: { direction: 'reverse' } }] };
	}
	/*
	CLEARING IS A PUT, not a set carrying undefined, and the difference is not cosmetic.

	`after: { direction: undefined }` sets an OWN PROPERTY holding undefined. It vanishes from
	JSON.stringify, survives `'direction' in link`, and FAILS a schema asking for `forward` or `reverse` --
	so the clear was refused in memory and silently repaired by the next reload. That is B220's
	shape: two doors disagreeing, with a restart hiding the evidence.

	A whole-entity put is how this tree already removes a key -- `inverseOfSet` in planner/txn.mjs
	reaches for the same move when a patch would have to restore an absence. The entity is built
	without `direction` rather than with it undefined.
	*/
	const { direction, ...without } = link;
	return { label: 'direction cleared', entries: [{ op: 'put', kind: 'link', entity: without }] };
}

/*
H15.15 -- TOGGLE a link between the control plane and the data plane.

`control: true` means the link carries no data-plane packets. Two states rather than three, so this
toggles where `cycleDirection` cycles -- and turning it OFF removes the key rather than writing `false`,
for the reason cycleDirection clears with a put: `after: { control: undefined }` sets an own property
holding undefined, which is invisible to JSON, visible to `in`, and refused by a schema asking for a
boolean. Absent is the ordinary data link and what every older document carries.
*/
export function toggleControl(link) {
	if (link.control) {
		const { control, ...without } = link;
		return { label: 'data plane', entries: [{ op: 'put', kind: 'link', entity: without }] };
	}
	return { label: 'control plane', entries: [{ op: 'set', kind: 'link', id: link.id, after: { control: true } }] };
}

/*
L / Shift+L — wire the selected nodes with no pointer travel. L chains them in selection order;
Shift+L stars the first to every other. Existing pairs are skipped.

Built against a projection, and the duplicate check is why. `input.js` had to put each new link into
the LIVE model as it went, because `linkBetween` is what skips an existing pair and it reads the
model — so a selection like [a, b, a] would author a-b twice if the first were not already there.
That is a second, independent reason for the same eager put the clone path needed, and the same
scratch removes it.
*/
export function linkNodes(model, nodeIds, star) {
	const scratch = projection(model);
	const pairs = star
		? nodeIds.slice(1).map((n) => [nodeIds[0], n])
		: nodeIds.slice(0, -1).map((n, i) => [n, nodeIds[i + 1]]);
	const created = [];
	pairs.forEach(([a, b]) => {
		if (a === b || linkBetween(scratch, a, b)) return;   // skip self + existing, INCLUDING this batch
		const link = makeLink(scratch, a, b);
		scratch.put('link', link);
		created.push(link);
	});
	return { label: star ? 'star' : 'chain', entries: created.map((l) => ({ op: 'put', kind: 'link', entity: clone('link', l) })) };
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

// Z — fit a zone around the selection: the bounding box, snapped OUT to the zone grid (±HALF + k·GAP)
// and clamped to the canvas. Link-only or empty selections produce nothing.
export function wrapSelection(model, ids) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, boxed = 0;
	ids.forEach((id) => {
		const e = model.get(kindOf(id), id);
		if (!e || e.x === undefined) return;
		minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
		maxX = Math.max(maxX, e.x + (e.w || 0)); maxY = Math.max(maxY, e.y + (e.h || 0));
		boxed++;
	});
	if (boxed === 0) return { label: 'create zone', entries: [] };
	const floorZ = (v) => Math.floor((v - HALF) / GAP) * GAP + HALF;
	const ceilZ = (v) => Math.ceil((v - HALF) / GAP) * GAP + HALF;
	const x = Math.max(floorZ(minX - HALF), -ZONE_EXT.x);
	const y = Math.max(floorZ(minY - HALF), -ZONE_EXT.y);
	const x2 = Math.min(ceilZ(maxX + HALF), ZONE_EXT.x);
	const y2 = Math.min(ceilZ(maxY + HALF), ZONE_EXT.y);
	return createEntity('zone', makeZone(model, { x, y, w: Math.max(x2 - x, GAP), h: Math.max(y2 - y, GAP) }));
}

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

// Shift+arrow on a LONE zone — NW corner fixed, minimum one cell, clamped to the canvas
export function resizeZoneStep(model, ids, dx, dy) {
	const none = { label: 'resize', entries: [] };
	if (ids.length !== 1 || kindOf(ids[0]) !== 'zone') return none;
	const zone = model.get('zone', ids[0]);
	if (!zone) return none;
	const w = Math.min(Math.max(zone.w + dx * GAP, GAP), ZONE_EXT.x - zone.x);
	const h = Math.min(Math.max(zone.h + dy * GAP, GAP), ZONE_EXT.y - zone.y);
	if (w === zone.w && h === zone.h) return none;
	return resizeZone(zone.id, { x: zone.x, y: zone.y, w, h });
}

// Shift+arrow on a LONE node — grow its span one cell (W1). Origin fixed, capped at the validator's 64.
export function resizeNodeStep(model, ids, dx, dy) {
	const none = { label: 'resize', entries: [] };
	if (ids.length !== 1 || kindOf(ids[0]) !== 'node') return none;
	const node = (isTypedEntity('node', model.get('node', ids[0])) ? model.get('node', ids[0]) : undefined);
	if (!node) return none;
	const cur = node.span || { cols: 1, rows: 1 };
	const cols = Math.min(Math.max(cur.cols + dx, 1), SPAN_MAX);
	const rows = Math.min(Math.max(cur.rows + dy, 1), SPAN_MAX);
	if (cols === cur.cols && rows === cur.rows) return none;
	return resizeNodeSpan(node.id, { cols, rows });
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
export function cloneSubgraph(model, seedIds, places) {   // C-c: the seeds a placed kind's (snap.js placesOf)
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
	Links whose BOTH endpoints were cloned — carrying the route, not just the ends (B30).

	A link's `via` list and its `closed` flag are authored geometry: dropping them turns a multi-hop
	route into a straight line silently, which is loss of intent rather than a cosmetic difference.
	Any via waypoint not already in the clone set is pulled in here, because a cloned route needs its
	OWN bends — pointing the copy at the originals would make two links share them, which the
	validator forbids outright (a waypoint belongs to at most one link, in at most one role).
	*/
	model.all('link').forEach((link) => {
		if (!idMap.has(link.src) || !idMap.has(link.dst) || idMap.has(link.id)) return;
		const via = Array.isArray(link.via) ? link.via : [];
		via.forEach((wid) => {
			if (idMap.has(wid)) return;
			const w = bareAnchor(model, wid);
			if (w) cloneEntity(BARE_KIND, w);
		});
		// B187 -- the copy is named from the SCRATCH model, so a duplicated subgraph does not collide
		// with the names already in it
		const copy = { id: newId('link', scratch.collection('link')), name: scratch.nextName('link'),
			src: idMap.get(link.src), dst: idMap.get(link.dst) };
		const mapped = via.map((wid) => idMap.get(wid)).filter(Boolean);
		if (mapped.length) copy.via = mapped;
		if (link.closed) copy.closed = true;
		idMap.set(link.id, copy.id);
		scratch.put('link', copy);
		clones.push({ kind: 'link', entity: copy });
	});

	// groups fully contained in the clone set
	model.all('group').forEach((group) => {
		if (group.members.length > 0 && group.members.every((m) => idMap.has(m))) {
			const copy = makeGroup(scratch, group.members.map((m) => idMap.get(m)));
			scratch.put('group', copy);
			clones.push({ kind: 'group', entity: copy });
		}
	});
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
