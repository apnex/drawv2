/*
THE BARE ANCHOR -- one place that says how it is stored, so every reader asks here (promotion's format batch, F-b, H18.4;
dev/design/unification/FORMAT-BATCH.md section 6).

A bare anchor is an anchor with no type: what people and agents call a waypoint (F4, ruled 2026-10-03). Today it is a kind
of its own, `waypoint`, stored under `waypoints`. At F-c (H18.5) it becomes a node with no `type`, its id keeping its hex
(P-10). Every reader that asks "is this a waypoint?", "which are the waypoints?" or "what are the anchor kinds?" asks one of
the functions below, so F-c changes this module's answers rather than a hundred readers' questions.

WHAT IS NOT ASKED HERE, and why:
  - the word `waypoint` people and agents see -- keys, help, the palette's hand, the CLI's verbs: kept by F4;
  - the canvas's hit and scene vocabulary -- a hit `{ kind: 'waypoint' }` from the picker and a kernel scene entity of kind
    `waypoint` name what is DRAWN, which F4 keeps; they are derived from a stored entity here, and never stored;
  - the kind's own definition -- its row (model/shape.mjs, planner/kinds.mjs), which F-c rewrites;
  - the loader's repairs of shapes already written (server/store.js) and the migration (server/migrate.mjs): they read
    documents as they were stored;
  - `kernel/`, which may not import `model/` (C9), and the CLI, which ships standalone (B138): each restates the question
    where it reads a document, held to this module by tests.
tests/bare-anchor.test.js ratchets the kind's literal in every other product module, each remaining file with its reason, so a
new reader cannot bypass this one unseen.

Each function takes anything answering `get(kind, id)` and `all(kind)` -- a Model, the planner's projection, a test double --
so none of them depends on Model methods.
*/

import { CORE_KINDS } from './shape.mjs';

// the kind a bare anchor is stored as, and the kind an op that writes one names -- `node` from F-c
export const BARE_KIND = 'waypoint';

// the anchor kinds -- what a link may end at, a group may hold, a pipe may join: the composition's own list, so F-c's table
// change is the only edit it needs
export const ANCHOR_KINDS = CORE_KINDS.anchors;

// whether an entity of a kind is a bare anchor -- from F-c, a node with no `type`
export const isBareEntity = (kind, entity) => kind === BARE_KIND && !!entity;

// the bare anchor with this id, or undefined
export const bareAnchor = (model, id) => model.get(BARE_KIND, id);

// every bare anchor
export const bareAnchors = (model) => model.all(BARE_KIND);

// the anchor of any kind with this id, or undefined -- what a link's end or bend resolves to
export const anchorOf = (model, id) => {
	for (const kind of ANCHOR_KINDS) {
		const e = model.get(kind, id);
		if (e) return e;
	}
	return undefined;
};

// the bare anchors of a plain document -- a stored or wire document, not a Model
export const bareAnchorsOf = (doc) => doc?.[CORE_KINDS.collection[BARE_KIND]] || [];
