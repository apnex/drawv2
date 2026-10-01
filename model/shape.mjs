/*
Shape — the entity kinds and their per-kind field taxonomy, in ONE place.

PL-5 (dev/design/planner/PLANNER-SYSTEM.md; ruled 2026-10-01): the KIND TABLE. The five kinds were listed separately
in `model/model.mjs` (twice), `server/validate.js` (twice), `server/rest.js` and `server/store.js`; each now derives
from `KINDS` and the table below. One literal, checked by `scan-layers` L7k to be exactly the product's five. Two lists
stay where they are on purpose: the id grammar in `server/validate.js` is a literal C3 pins, and each kind's field
CHECKS stay at the trust boundary, which sources its facts and keeps its checks local. Injecting the table into a
composition -- so the lab could add a kind production does not have -- waits for promotion's format batch (B273).

Two facts about every entity kind that were previously encoded in two separate hand-maintained
lists, in two different layers, that nothing forced to agree:

  COMPOSITE  fields holding a nested array/object, so a copy must go deeper than a spread.
             Was: the `if (copy.x)` ladder in app/src/commands.js clone().
  OPTIONAL   fields that may be absent from a stored entity — documents written before the
             field existed must still load. Absent means "the renderer's default", never null.
             Was: the OPTIONAL map in server/validate.js.

The two sets are genuinely different and that is not an accident: `link.closed` is optional but
scalar, `group.members` is composite but mandatory, `node.shape` is optional but scalar. A single
merged list would be wrong in both directions.

Per kind, the table also holds the collection a document stores it under and whether it can be selected.

Downstream this table is the source for: clone()'s deep-copy walk (model/ops.mjs), the
set-inverse absent-key rule (an inverse that must remove a key rather than restore a value uses a
whole-entity put — see server/txn.mjs), and validateEntity's optional-field allowance.
*/

// the product's kinds, in the order a document lists its collections
export const KINDS = ['node', 'waypoint', 'link', 'zone', 'group'];

/*
  collection  the document key the kind is stored under
  selectable  whether a selection may hold it (a group never is; it is selected through its members)
  composite   fields holding a nested value -- a spread is not enough to copy one
  optional    fields that may be absent from a stored entity (pre-dates the field, or is genuinely optional)
*/
const TABLE = {
	node:     { collection: 'nodes',     selectable: true,  composite: ['span', 'content'], optional: ['shape', 'span', 'content'] },
	waypoint: {
		collection: 'waypoints', selectable: true, composite: [],
		/*
		B162: `pinned` says the author placed this waypoint deliberately, with no link to derive a
		role from. Optional because almost none carry it -- a bend never does.

		H12.5: `spawn` says this endpoint EMITS along its link. One composite field rather than four
		loose ones, because absent means "not a spawner" and that is a single fact -- four independent
		optional numbers would make a half-configured spawner representable, and it is not a state.

		The DIRECTION is not stored. It is derived from which end of the link this waypoint is: press
		the `src` end and movers run src to dst, press `dst` and they run the other way. Storing it
		would be a twin of the link, wrong the first time a route was reversed.
		*/
		optional: ['pinned', 'spawn'],
	},
	link:     { collection: 'links',     selectable: true,  composite: ['via'],             optional: ['via', 'closed', 'flow', 'control'] },
	zone:     { collection: 'zones',     selectable: true,  composite: [],                  optional: [] },
	group:    { collection: 'groups',    selectable: false, composite: ['members'],         optional: [] },
};

const byKind = (fact) => Object.fromEntries(KINDS.map((k) => [k, fact(TABLE[k])]));

export const COLLECTION = byKind((t) => t.collection);
export const SELECTABLE_KINDS = KINDS.filter((k) => TABLE[k].selectable);
// nested value -> a spread is not enough
export const COMPOSITE = byKind((t) => new Set(t.composite));
// may be absent from a stored entity
export const OPTIONAL = byKind((t) => new Set(t.optional));
