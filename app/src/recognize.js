/*
RECOGNIZE — which gesture is starting?

An ORDERED table once, because the order was the specification (dev/INPUT.md §3–§4) -- since stage 4 of the gesture
system it is rows of the Rules engine, disjoint, and the order is decoration (see THE ROWS below). It replaces a
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
// the right button presses these; a link is not one of them
const rightKinds = (h) => h.kind === 'node' || h.kind === 'zone' || h.kind === 'waypoint';
// the situation terms: whether no tool is held (a held tool's press is the devices plugin's, C-d)
const free = (s) => !s.tool;

/*
THE ROWS -- stage 4 of the gesture system (dev/design/input/GESTURE-SYSTEM.md): rows of the Rules engine
(kernel/input-rules.mjs), resolved exactly as the keys are.

`on(e)` reads the press -- its button, its modifiers, and what is under it (`e.on`, from capture); `when(s)` reads the
situation -- whether a tool is held. The outcome is a GESTURE to start or an immediate `run`.

NO ROW WINS BY POSITION (Q3). This table was ordered, and 14 pairs of its rows could match one press; each row now says
what it does NOT mean -- a held tool takes every left press, the Alt chord takes a right press before clone and press,
Ctrl+left clones an entity before it links or selects, a node or waypoint links before it selects, Shift on the canvas
draws a zone rather than a marquee.

THE LOCKED FALLBACKS. The old table was FILTERED by read-only, not halted, and that was the design: a locked click on a
node fell past `link` (it mutates) to `press`, and still selected. Here that is three rows admitted only while writes
are refused (`whileReadOnly`) -- a GUARD, applied by the engine, since a condition never tests authority (RULES I5).
They cover exactly what a locked client used to reach by falling through, and a writer never sees them.

tests/pointer-bindings.test.js holds the old table and its resolver as an oracle: for every press, tool and lock, these
rows start the same gesture.
*/
export const RECOGNIZE = [
	// C-d (H19.32): a held tool's press -- the text box -- is the devices plugin's row over the shared box gesture

	// right button: the delete chord, then clone, then press
	{ id: 'chord', input: ['Alt+right on node|waypoint|zone|link'],     mutates: true,  on: (e) => R(e) && e.altKey && !!e.on.id && e.on.kind !== 'handle',      run: 'deleteUnderCursor' },
	{ id: 'r-clone', input: ['Ctrl+right on node|waypoint|zone'],   mutates: true,  on: (e) => R(e) && e.ctrlKey && !e.altKey && rightKinds(e.on),           gesture: 'clone-pending' },
	{ id: 'r-press', input: ['right on node|waypoint|zone'],   mutates: false, on: (e) => R(e) && !e.ctrlKey && !e.altKey && rightKinds(e.on),          gesture: 'pending' },

	// left button, most specific first in reading, and disjoint in fact. C-d (H19.32): a press on a handle opens the shared handle
	// gesture from the row of the plugin that declared the handle -- the zones plugin's corners, the network's link ends
	{ id: 'l-clone', input: ['Ctrl+left on node|zone|link'],   mutates: true,  on: (e) => L(e) && e.ctrlKey && entity(e.on), when: free,                gesture: 'clone-pending' },
	{ id: 'link', input: ['left on node|waypoint'],      mutates: true,  on: (e) => L(e) && (e.on.kind === 'waypoint' || (e.on.kind === 'node' && !e.ctrlKey)), when: free, gesture: 'link' },
	// C-d (H19.32): the zone's draw is the zones plugin's row, over the shared box gesture (zones/zone-gestures.mjs)

	// the non-mutating tail. These are what a Server-Locked client is left with, and SCOPE decision 5
	// promises exactly them: "selection, the data view, and the readout still work".
	// a plugin's mark (app/src/pick.js) is pressed as a link is: it selects, and a drag never moves it (H17.22 N-c2)
	{ id: 'press', input: ['Shift+left on zone', 'left on link', 'left on mark'],     mutates: false, on: (e) => L(e) && (e.on.kind === 'zone' || e.on.kind === 'link' || !!e.on.mark) && !e.ctrlKey, when: free, gesture: 'pending' },
	{ id: 'marquee', input: ['left on canvas'],   mutates: false, on: (e) => L(e) && e.on.kind === 'canvas' && !e.shiftKey, when: free,    gesture: 'marquee' },

	// ...and what a locked client reached by falling past the authoring rows above, which a writer never sees
	{ id: 'press-locked',   mutates: false, whileReadOnly: true, on: (e) => L(e) && selectable(e.on) && (e.on.kind === 'node' || e.on.kind === 'waypoint' || e.ctrlKey), gesture: 'pending' },
	{ id: 'marquee-locked', mutates: false, whileReadOnly: true, on: (e) => L(e) && e.on.kind === 'canvas' && e.shiftKey, gesture: 'marquee' },
	{ id: 'r-press-locked', mutates: false, whileReadOnly: true, on: (e) => R(e) && (e.ctrlKey || e.altKey) && rightKinds(e.on), gesture: 'pending' },
];

/*
A DOUBLE CLICK is a binding too: it edits the label under the pointer. It authors a change, so a locked client is refused
by the engine's guard -- the handler used to check read-only itself, twice.
*/
export const DOUBLE_CLICKS = [
	{ id: 'edit-label', input: ['double'], mutates: true, on: (e) => e.type === 'double', run: 'editUnderPointer' },
];
