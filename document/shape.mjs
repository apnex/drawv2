/*
Shape — the per-kind field taxonomy, in ONE place.

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

Downstream this table is the source for: clone()'s deep-copy walk (document/ops.mjs), the
set-inverse absent-key rule (an inverse that must remove a key rather than restore a value uses a
whole-entity put — see server/txn.mjs), and validateEntity's optional-field allowance.
*/

// nested value → a spread is not enough
export const COMPOSITE = {
	node:     new Set(['span', 'content']),
	link:     new Set(['via']),
	group:    new Set(['members']),
	zone:     new Set(),
	waypoint: new Set(),
};

// may be absent from a stored entity (pre-dates the field, or is genuinely optional)
export const OPTIONAL = {
	node:     new Set(['shape', 'span', 'content']),
	link:     new Set(['via', 'closed']),
	group:    new Set(),
	zone:     new Set(),
	waypoint: new Set(),
};
