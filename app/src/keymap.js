/*
KEYMAP — which intent a keystroke means, and whether it mutates. The PRODUCT's rows for the Rules engine
(kernel/input-rules.mjs, dev/RULES.md section 11): `on` says which keystroke a row is about, `when` -- where a row has
one -- which situation it means that in, and the engine finds the ONE row that matches. A plugin brings its own rows
beside these; nothing here knows it exists.

NO ROW WINS BY POSITION (ruled 2026-09-30, Q3). The table was ordered once, for the same reason the recognizer is
(dev/INPUT.md §4): in a 243-line ladder the ordering is invisible. That ladder had THREE guards interleaved
at different depths — the help modal, Server-Locked, and gesture-in-flight — so whether a key worked
depended on which of the three it happened to sit below. B18, B37 and B42 are all instances.

Each entry declares its own tolerances instead:

	mutates        does it author a change?  → refused while Server-Locked (SCOPE decision 5)
	duringHelp     meaningful with the help overlay open? (only Escape and `?`)
	duringGesture  meaningful mid-drag? Escape, Shift, `w` for a bend, and 1-6 to chain a node (B147)

Defaults are the safe ones: a new entry mutates, and is inert during help and during a gesture,
until its author says otherwise. Adding a key wrongly then FAILS CLOSED rather than quietly becoming
the next B42.

`run` names a method on Input. The bodies deliberately did not move: this step turns DISPATCH into
data, which is where every one of those defects lived. Relocating the logic as well would have made
the diff unreviewable and told the net nothing new.
*/

const plain = (e) => !e.ctrlKey && !e.metaKey && !e.altKey;
// the situation terms the product's rows ask (engine/situation.mjs builds the value; the terms live with their tenant)
const oneLink = (s) => s.selection.size === 1 && s.selection.kinds[0] === 'link';
const oneBentLink = (s) => oneLink(s) && s.selection.bends > 0;
const oneStraightLink = (s) => oneLink(s) && s.selection.bends === 0;
const linkStepOnNode = (s) => s.gesture === 'link' && s.step === 'node';
const meta = (e) => e.ctrlKey || e.metaKey;
const is = (e, k) => e.key.toLowerCase() === k;
const arrow = (e) => e.key.startsWith('Arrow');

/*
B47 — `prevent` says whether the DISPATCHER claims the key, and it defaults to TRUE.

Bind a key and you own it: that is the safe default, because a binding that lets the browser also
act on the same keystroke is almost always a bug, and the six handlers that omitted
`preventDefault()` were indistinguishable from ones that forgot. Making it a table field is what
turns an omission into a decision.

`prevent: false` means only that the dispatcher does not claim it unconditionally. Two different
reasons appear below and both are legitimate:

  a BROWSER DEFAULT MUST SURVIVE   `escape` — exiting fullscreen and cancelling an IME composition
                                   are the browser's to handle, and swallowing them is user-hostile.

  THE HANDLER CLAIMS IT ONLY WHEN  `alt`/`control` (Alt only, to keep Firefox's menu bar out of the
  IT ACTS                          delete chord), `labels` (Tab only when the canvas holds focus,
                                   so it can still traverse the toolbar), and `waypoint` / `stamp` /
                                   `delete`, which prevent only on the path that does something.

That second reason is a condition on RUNTIME STATE, which a static table cannot see — so those
handlers keep their own call rather than the table pretending to know.
*/

/*
B48 — Shift is matched HERE, not re-read in the handler.

`plain()` tests ctrl/meta/alt and deliberately leaves Shift free, which is right for chords like
Ctrl+Shift+G but was wrong as a default: five bindings matched one entry and then branched on
`evt.shiftKey` inside their handler. The table under-reported its own key surface, and for history it
was simply false — `redo` matched only Ctrl+Y while Ctrl+Shift+Z matched the entry named `undo`.

A rule's id must name the verb the keystroke performs. That is the property that makes this table
worth reading, and it is what B42 was found by. Where Shift selects a different verb the entries are
split; nothing re-reads Shift after the match.
*/

export const KEYMAP = [
	// ---- modifier feedback: not verbs, and they must reach a live drag (ortho arms mid-gesture) ----
	{ id: 'shift',   mutates: false, duringGesture: true, duringHelp: true, on: (e) => e.key === 'Shift',   run: 'onShiftDown' },
	{ id: 'alt',     prevent: false, mutates: false, duringGesture: true, duringHelp: true, on: (e) => e.key === 'Alt',     run: 'onArmingKey' },
	{ id: 'control', prevent: false, mutates: false, duringGesture: true, duringHelp: true, on: (e) => e.key === 'Control', run: 'onArmingKey' },

	// ---- modal + always-available ----
	{ id: 'escape',  prevent: false, mutates: false, duringGesture: true, duringHelp: true, on: (e) => e.key === 'Escape', run: 'onEscape' },
	{ id: 'help',    mutates: false, duringGesture: true, duringHelp: true, on: (e) => e.key === '/' || e.key === '?', run: 'onHelpKey' },

	// ---- view state: no model change, so live while Server-Locked ----
	{ id: 'edit-mode', mutates: false, on: (e) => is(e, 'e') && plain(e), run: 'onEditMode' },
	{ id: 'run-mode',  mutates: false, on: (e) => is(e, 'r') && plain(e), run: 'onRunMode' },
	{ id: 'labels',    prevent: false, mutates: false, on: (e) => e.key === 'Tab',        run: 'onLabels' },

	// ---- inspection: SCOPE decision 5 promises these keep working while locked ----
	{ id: 'select-all', mutates: false, on: (e) => meta(e) && is(e, 'a'), run: 'onSelectAll' },
	{ id: 'datum',       mutates: false, on: (e) => e.key === ' ' && !e.shiftKey, run: 'onDatum' },
	{ id: 'datum-clear', mutates: false, on: (e) => e.key === ' ' && e.shiftKey,  run: 'onDatumClear' },

	// ---- authoring ----
	// `w` is the one mutating verb that belongs DURING a gesture: dropping a bend mid-route is the
	// whole point of it, and the mouse button is still held. Over a node mid-drag it means nothing
	// here -- a bend cannot sit on a node -- which is what leaves that situation free for a plugin to
	// mean something by (the network's `stop-on-node`, network/keys.mjs). `g` is not the product's
	// at all any more: it is the network plugin's, and production composes none (dev/RULES.md section 11).
	{ id: 'waypoint',  prevent: false, mutates: true, duringGesture: true, on: (e) => is(e, 'w') && plain(e), when: (s) => !linkStepOnNode(s), run: 'onWaypointKey' },
	{ id: 'text-tool', mutates: true, on: (e) => is(e, 't') && plain(e) && !e.repeat,         run: 'onTextTool' },
	{ id: 'reshape',   mutates: true, on: (e) => is(e, 's') && plain(e),                      run: 'onReshape' },
		// B147: meaningful mid-drag now -- a digit places that node and carries the link run through
	// it, which is the same argument `w` already makes for a bend
	{ id: 'hand',      mutates: true, duringGesture: true, on: (e) => /^[1-6]$/.test(e.key) && plain(e), run: 'onHandDigit' },
	{ id: 'pipette',   mutates: true, on: (e) => is(e, 'q') && plain(e),                      run: 'onPipette' },
	{ id: 'stamp',     prevent: false, mutates: true, on: (e) => e.key === 'Enter',                           run: 'onStampKey' },
	{ id: 'nudge',       mutates: true, on: (e) => arrow(e) && !e.shiftKey,                   run: 'onArrowKey' },
	{ id: 'resize-step', mutates: true, on: (e) => arrow(e) && e.shiftKey,                    run: 'onResizeStep' },
	{ id: 'wrap',      mutates: true, on: (e) => is(e, 'z') && !meta(e),                      run: 'onWrapKey' },
	// `c` means two things by situation -- the acceptance case of the Rules system, ruled 2026-09-30: close (or open) ONE
	// link with a bend, refuse ONE link without, and anything else means nothing. Two rows, and no handler asks.
	{ id: 'close',         mutates: true, on: (e) => is(e, 'c') && plain(e), when: oneBentLink,     run: 'onCloseKey' },
	{ id: 'close-refused', mutates: true, on: (e) => is(e, 'c') && plain(e), when: oneStraightLink, run: 'onCloseRefused' },
	{ id: 'flow',      mutates: true, on: (e) => is(e, 'f') && plain(e),                      run: 'onFlowKey' },
	{ id: 'plane',     mutates: true, on: (e) => is(e, 'k') && plain(e),                      run: 'onPlaneKey' },
	{ id: 'chain',     mutates: true, on: (e) => is(e, 'l') && plain(e) && !e.shiftKey,       run: 'onChainKey' },
	{ id: 'star',      mutates: true, on: (e) => is(e, 'l') && plain(e) && e.shiftKey,        run: 'onStarKey' },
	{ id: 'rename',    mutates: true, on: (e) => e.key === 'F2',                              run: 'onRenameKey' },

	/*
	History. Ctrl+Shift+Backspace means "reverse another writer's whole run" (D21), which is
	deliberately not Ctrl+Z — taking back N changes you did not make is a different intent from
	stepping back one you did, and it should not be reachable by holding a key down.

	It was the ONE keystroke two rows matched: `undo-run` won because it was listed above `delete`,
	and a comment and a test held the order. Ruled 2026-09-30 (Q3), order decides nothing, so
	`delete` states the chord it does not mean -- and the test now asserts that NO keystroke, in any
	situation, matches two rows (`tests/input.test.js`).
	*/
	{ id: 'undo-run', mutates: true, on: (e) => meta(e) && e.shiftKey && e.key === 'Backspace', run: 'onUndoRun' },
	{ id: 'undo',     mutates: true, on: (e) => meta(e) && is(e, 'z') && !e.shiftKey,            run: 'onUndoKey' },
	{ id: 'redo',     mutates: true, on: (e) => meta(e) && (is(e, 'y') || (is(e, 'z') && e.shiftKey)), run: 'onRedoKey' },
	{ id: 'dup',      mutates: true, on: (e) => meta(e) && is(e, 'd'),                          run: 'onDuplicate' },
	{ id: 'group',    mutates: true, on: (e) => meta(e) && is(e, 'g') && !e.shiftKey,            run: 'onGroupKey' },
	{ id: 'ungroup',  mutates: true, on: (e) => meta(e) && is(e, 'g') && e.shiftKey,             run: 'onUngroupKey' },
	{ id: 'delete',   prevent: false, mutates: true, on: (e) => (e.key === 'Delete' || e.key === 'Backspace') && !(meta(e) && e.shiftKey && e.key === 'Backspace'), run: 'onDeleteKey' },
];

/*
KEY RELEASES -- bindings on the `key-up` trigger (stage 4 of the gesture system). They were an `if` ladder in Input's
handler; now they resolve through the Rules engine like every other input. Meaningful in every state, since a release
only undoes what the press armed -- the zone grid Shift showed, the arming Alt or Control lit -- and never authors.
*/
export const KEY_RELEASES = [
	{ id: 'shift-up',  prevent: false, mutates: false, duringHelp: true, duringGesture: true, on: (e) => e.key === 'Shift', run: 'onShiftUp' },
	{ id: 'arming-up', prevent: false, mutates: false, duringHelp: true, duringGesture: true, on: (e) => e.key === 'Alt' || e.key === 'Control', run: 'onArmingUp' },
];

