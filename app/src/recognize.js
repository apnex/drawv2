/*
RECOGNIZE (`pressRows`) — which gesture is starting?

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

import { ANCHOR_KINDS } from '../../model/anchors.mjs';   // the anchor kinds, the core's (D4)

const L = (e) => e.button === 0;
const R = (e) => e.button === 2;
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
/*
C-d, step four (H19.32; D4) -- WHAT A HIT IS, by what the plugins say: each drawn hit word with whether its kind is PLACED (a part
places it, C-c), whether it is an ANCHOR (the core's anchor kinds), whether a Ctrl+left press CLONES it (the one fact a pick
declares, since nothing else states it -- a waypoint's left press draws a link whatever the modifiers), and the modifier it is
picked under (the zone, under Shift). A press on a drawn hit that is no anchor selects it.
H26.8's picks move (NATIVE-SHAPES.md section 3.2; reading 3, o:F2): a mark pick -- the network's hand pipe -- names no word and is taken
here no more than a handle is, so the press rows, the overlay's facts and the generated help see a mark only through `hit.mark`, as before.
*/
export function hitFactsOf(picks, places) {
	const facts = new Map();
	for (const p of picks) {
		if (p.handle || p.mark) continue;
		const was = facts.get(p.word) ?? {};
		facts.set(p.word, { placed: was.placed || places.has(p.kind), anchor: was.anchor || ANCHOR_KINDS.includes(p.kind), clones: was.clones || !!p.clones, modifier: was.modifier ?? p.modifier ?? null,
			idle: was.idle ?? p.idle ?? null,   // C-f: the state it shows idle under the pointer -- a device's ring
			right: was.right || p.button === 'right' });   // H24.5: pressed with the right button only -- a zone
	}
	return facts;
}

const MODIFIER_WORD = { shiftKey: 'Shift', ctrlKey: 'Ctrl', altKey: 'Alt' };

// the product's press rows over the composed picks and places -- each row's kinds read from the facts, and the kind lists its
// help documents built from the plugins' words, in the order the picks are composed
export function pressRows(picks, places) {
	const facts = hitFactsOf(picks, places);
	const is = (fact) => (h) => !!facts.get(h.kind)?.[fact];
	const drawn = (h) => facts.has(h.kind);   // a hit naming something a plugin draws -- a real, selectable entity (not a handle, not the canvas)
	const placed = is('placed'), anchor = is('anchor'), clones = is('clones'), right = is('right');
	const selects = (h) => (drawn(h) && !anchor(h)) || !!h.mark;
	const words = (test) => [...facts.keys()].filter((w) => test({ kind: w })).join('|');
	// the left press's help line names what a left press takes -- not a kind pressed with the right button only (H24.5)
	const pressed = [...facts.keys()].filter((w) => !facts.get(w).anchor && !facts.get(w).right).map((w) => `${facts.get(w).modifier ? `${MODIFIER_WORD[facts.get(w).modifier]}+` : ''}left on ${w}`);
	// H24.5: a right-button row's help lines -- the kinds picked with no modifier, then each held modifier's own (a zone's Shift)
	const onRight = (mods, test) => {
		const ws = [...facts.keys()].filter((w) => test({ kind: w }));
		const line = (held, list) => `${[...mods, ...held].join('+')}${mods.length || held.length ? '+' : ''}right on ${list.join('|')}`;
		const plain = ws.filter((w) => !facts.get(w).modifier);
		const byMod = [...new Set(ws.map((w) => facts.get(w).modifier).filter(Boolean))];
		return [...(plain.length ? [line([], plain)] : []), ...byMod.map((m) => line([MODIFIER_WORD[m]], ws.filter((w) => facts.get(w).modifier === m)))];
	};
	return [
		// right button: the delete chord, then clone, then press
		{ id: 'chord', input: onRight(['Alt'], drawn),     mutates: true,  on: (e) => R(e) && e.altKey && !!e.on.id && !e.on.handle,      run: 'deleteUnderCursor' },
		{ id: 'r-clone', input: onRight(['Ctrl'], placed),   mutates: true,  on: (e) => R(e) && e.ctrlKey && !e.altKey && placed(e.on),           gesture: 'clone-pending' },
		{ id: 'r-press', input: onRight([], placed),   mutates: false, on: (e) => R(e) && !e.ctrlKey && !e.altKey && placed(e.on),          gesture: 'pending' },

		// left button, most specific first in reading, and disjoint in fact: a press on a handle opens the shared handle gesture from
		// the row of the plugin that declared it; a held tool's press is the devices plugin's text box (C-d). A kind pressed with the
		// right button only -- a zone -- is taken by no left row here, so its plugin's own left row may (H24.5: Shift+left draws over it)
		{ id: 'l-clone', input: [`Ctrl+left on ${words((h) => clones(h) && !right(h))}`],   mutates: true,  on: (e) => L(e) && e.ctrlKey && clones(e.on) && !right(e.on), when: free,                gesture: 'clone-pending' },
		// a left press on an anchor draws a link from it -- with Ctrl, one that clones is cloned instead (the row above)
		{ id: 'link', input: [`left on ${words(anchor)}`],      mutates: true,  on: (e) => L(e) && anchor(e.on) && !(e.ctrlKey && clones(e.on)), when: free, gesture: 'link' },

		// the non-mutating tail. These are what a Server-Locked client is left with, and SCOPE decision 5
		// promises exactly them: "selection, the data view, and the readout still work".
		// a plugin's mark (app/src/pick.js) is pressed as a link is: it selects, and a drag never moves it (H17.22 N-c2)
		{ id: 'press', input: [...pressed, 'left on mark'],     mutates: false, on: (e) => L(e) && selects(e.on) && !right(e.on) && !e.ctrlKey, when: free, gesture: 'pending' },
		{ id: 'marquee', input: ['left on canvas'],   mutates: false, on: (e) => L(e) && e.on.kind === 'canvas' && !e.shiftKey, when: free,    gesture: 'marquee' },

		// ...and what a locked client reached by falling past the authoring rows above, which a writer never sees
		{ id: 'press-locked',   mutates: false, whileReadOnly: true, on: (e) => L(e) && drawn(e.on) && !right(e.on) && (anchor(e.on) || e.ctrlKey), gesture: 'pending' },
		{ id: 'marquee-locked', mutates: false, whileReadOnly: true, on: (e) => L(e) && e.on.kind === 'canvas' && e.shiftKey, gesture: 'marquee' },
		{ id: 'r-press-locked', mutates: false, whileReadOnly: true, on: (e) => R(e) && (e.ctrlKey || e.altKey) && placed(e.on), gesture: 'pending' },
	];
}

/*
A DOUBLE CLICK is a binding too: it edits the label under the pointer. It authors a change, so a locked client is refused
by the engine's guard -- the handler used to check read-only itself, twice.
*/
export const DOUBLE_CLICKS = [
	{ id: 'edit-label', input: ['double'], mutates: true, on: (e) => e.type === 'double', run: 'editUnderPointer' },
];
