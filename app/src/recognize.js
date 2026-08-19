/*
RECOGNIZE — which gesture is starting?

An ORDERED table, because the order IS the specification (docs/spec/INPUT.md §3–§4). It replaces a
167-line nest in which the ordering was load-bearing and entirely invisible — and invisible ordering
is not a stylistic complaint here, it is the measured cause of three defects:

  B18  three mutation paths sat ABOVE the read-only guard and ran while locked
  B37  two inspection verbs sat BELOW it and were wrongly blocked
  B42  a fourth path above it that B18's fix did not reach

── THE GATE FILTERS, IT DOES NOT HALT ────────────────────────────────────────────────────────────
Every rule declares whether it mutates, and a read-only client dispatches against the non-mutating
rules ONLY. That distinction is the whole design. If the gate aborted on a mutating match instead,
a locked click on a node would match `link` (mutating), be refused, and do nothing — silently losing
click-select. Filtering lets it fall past `link` to `press`, which is exactly the behaviour the old
code hand-wrote as a special-case branch. The special case does not get handled; it stops existing.
──────────────────────────────────────────────────────────────────────────────────────────────────

`mutates` does NOT settle everything, and the honest place to say so is here. A press on an entity
becomes a move (mutating) or a select (not) depending on whether you then drag, so `press` is
`mutates: false` and the pending→move ESCALATION is a second gate point. One flag cannot know the
future.

Two things are deliberately NOT rules. Run mode is a mode of the whole surface, not a gesture, so it
is a guard above the table. Chain wiring means *the live gesture consumes this press*, which is a
gesture-level concern, not a decision about starting one. Forcing either into the table would be
making the abstraction lie to look tidy.
*/

const L = (e) => e.button === 0;
const R = (e) => e.button === 2;
const entity = (h) => h.kind === 'node' || h.kind === 'zone' || h.kind === 'link';
// a hit that names a real, selectable entity. NOT the same as `h.id`: a handle carries an id too
// (its corner name), and a press on one must never fall through to select-by-id — it would set the
// selection to a non-entity, which Selection rejects, silently CLEARING the selection and hiding
// the very handles being grabbed. Found by exercising the table against a locked client.
const selectable = (h) => entity(h) || h.kind === 'waypoint';

/*
Each rule: `when(hit, evt, ctx) → bool`, `mutates`, and an outcome that is either a GESTURE to start
or an immediate `run`. `ctx` carries only what a predicate may ask — the model and the held tool —
never Input itself.
*/
export const RECOGNIZE = [
	// a held tool places on the next click, whatever is under it
	{ id: 'tool',      mutates: true,  when: (h, e, c) => L(e) && !!c.tool,                        gesture: 'textbox' },

	// right button: the delete chord, then move/clone
	{ id: 'chord',     mutates: true,  when: (h, e) => R(e) && e.altKey && h.id && h.kind !== 'handle', run: 'deleteUnderCursor' },
	{ id: 'r-clone',   mutates: true,  when: (h, e) => R(e) && e.ctrlKey && (h.kind === 'node' || h.kind === 'zone' || h.kind === 'waypoint'), gesture: 'clone-pending' },
	{ id: 'r-press',   mutates: false, when: (h, e) => R(e) && (h.kind === 'node' || h.kind === 'zone' || h.kind === 'waypoint'), gesture: 'pending' },

	// left button, most specific first: handles are drawn ON TOP, so they win over what is beneath
	{ id: 'resize',    mutates: true,  when: (h, e) => L(e) && h.kind === 'handle',                gesture: 'resize' },
	{ id: 'replug',    mutates: true,  when: (h, e) => L(e) && h.kind === 'lhandle',               gesture: 'replug' },
	{ id: 'l-clone',   mutates: true,  when: (h, e) => L(e) && e.ctrlKey && entity(h),             gesture: 'clone-pending' },
	{ id: 'link',      mutates: true,  when: (h, e, c) => L(e) && (h.kind === 'node' || (h.kind === 'waypoint' && c.waypointFree(h.id))), gesture: 'link' },
	{ id: 'zone-draw', mutates: true,  when: (h, e) => L(e) && h.kind === 'canvas' && e.shiftKey, gesture: 'zone' },

	// the non-mutating tail. These are what a Server-Locked client is left with, and SCOPE decision 5
	// promises exactly them: "selection, the data view, and the readout still work".
	{ id: 'press',     mutates: false, when: (h, e) => L(e) && selectable(h),                     gesture: 'pending' },
	{ id: 'marquee',   mutates: false, when: (h, e) => L(e) && h.kind === 'canvas',                gesture: 'marquee' },
];

/*
The first rule that matches, skipping any that mutate while read-only. Returns the rule, or null.

One function so the gate cannot be applied two ways — which is how it drifted before. The keymap
uses this same dispatcher over its own table; the tables are separate because ordering only has
meaning within a domain, and a key rule can never compete with a pointer rule.
*/
export function resolveRule(rules, hit, evt, ctx) {
	for (const r of rules) {
		if (r.mutates && ctx.readOnly) continue;   // FILTER, never halt — see the header
		if (r.when(hit, evt, ctx)) return r;
	}
	return null;
}
