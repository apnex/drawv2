/*
THE BARE ANCHOR -- one place that says how it is stored, so every reader asks here (promotion's format batch, F-b, H18.4;
dev/design/unification/FORMAT-BATCH.md section 6).

A bare anchor is an anchor with no type: what people and agents call a waypoint (F4, ruled 2026-10-03). Since F-c (H18.5)
it is a NODE WITH NO `type`, its id keeping its hex (P-10); until then it was a kind of its own, `waypoint`. Every reader
that asks "is this a waypoint?", "which are the waypoints?", "which are the typed nodes?" or "what are the anchor kinds?"
asks one of the functions below, so the storage is decided here once.

Whether a node has a type is fixed when it is made (the node row refuses a change, planner/kinds.mjs), so an entity's answer
never changes under a reader that cached it.

WHAT IS NOT ASKED HERE, and why:
  - the word `waypoint` people and agents see -- keys, help, the palette's hand, the CLI's verbs: kept by F4;
  - the canvas's hit and scene vocabulary -- a hit `{ kind: 'waypoint' }` from the picker and a kernel scene entity of kind
    `waypoint` name what is DRAWN, which F4 keeps; model/anchor-words.mjs derives it from a stored entity, and it is never
    stored -- a module of its own because the planner, which loads this one, reads no drawn word;
  - the kind's own definition -- its row (model/shape.mjs, planner/kinds.mjs);
  - `kernel/`, which may not import `model/` (C9), and the CLI, which ships standalone (B138): each restates the question
    where it reads a document, held to this module by tests.
tests/bare-anchor.test.js ratchets the stored kind's old literal in every other product module, each remaining file with its
reason, so a new reader cannot bypass this one unseen.

Each function takes anything answering `get(kind, id)` and `all(kind)` -- a Model, the planner's projection, a test double --
so none of them depends on Model methods.
*/

import { CORE_KINDS } from './shape.mjs';

// the kind a bare anchor is stored as, and the kind an op that writes one names
export const BARE_KIND = 'node';

// the anchor kinds -- what a link may end at, a group may hold, a pipe may join: the composition's own list
export const ANCHOR_KINDS = CORE_KINDS.anchors;

// whether an entity of a kind is a bare anchor: a node with no type
export const isBareEntity = (kind, entity) => kind === BARE_KIND && !!entity && !entity.type;

// whether an entity of a kind is a typed node -- what draws a glyph, carries content, and is never a bend
export const isTypedEntity = (kind, entity) => kind === 'node' && !!entity && !!entity.type;

// the bare anchor with this id, or undefined
export const bareAnchor = (model, id) => {
	const e = model.get(BARE_KIND, id);
	return e && !e.type ? e : undefined;
};

// every bare anchor
export const bareAnchors = (model) => model.all(BARE_KIND).filter((e) => !e.type);

// every typed node
export const typedNodes = (model) => model.all('node').filter((e) => !!e.type);

// the anchor of any kind with this id, or undefined -- what a link's end or bend resolves to
export const anchorOf = (model, id) => {
	for (const kind of ANCHOR_KINDS) {
		const e = model.get(kind, id);
		if (e) return e;
	}
	return undefined;
};

