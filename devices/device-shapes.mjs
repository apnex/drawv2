/*
THE TWO SHAPES AN ANCHOR TAKES -- the devices plugin's question (O-e1, H19.21; O4): is a device composed on this anchor, or is
it bare -- what people and agents call a waypoint (F4)? The director (O4): "The core holds only the anchor", and an anchor
carries no type; a device's `type` is this plugin's, so whether an anchor carries one is asked here, never by the core.

These were model/anchors.mjs's since F-b (H18.4), when F-c (H18.5) made a waypoint a node with no `type` (P-10): one place
says how a waypoint is stored, so every reader asks here. Moved unchanged. Whether a device is composed is fixed when the
anchor is made (the node row refuses a change, planner/kinds.mjs), so an entity's answer never changes under a reader that
cached it.

Each function takes anything answering `get(kind, id)` and `all(kind)` -- a Model, the planner's projection, a test double.
`kernel/adapt.mjs` (which may not import a plugin, C9) and the CLI (which ships standalone, B138) restate the question, held
to this module by tests/bare-anchor.test.js.
*/

import { BARE_KIND } from '../model/anchors.mjs';   // the anchor's stored kind, the core's

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
