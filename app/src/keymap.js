/*
KEYMAP — which intent a keystroke means, and whether it mutates.

An ORDERED table, for the same reason the recognizer is one (docs/spec/INPUT.md §4): the ordering is
the specification, and in a 243-line ladder it is invisible. That ladder had THREE guards interleaved
at different depths — the help modal, Server-Locked, and gesture-in-flight — so whether a key worked
depended on which of the three it happened to sit below. B18, B37 and B42 are all instances.

Each entry declares its own tolerances instead:

	mutates        does it author a change?  → refused while Server-Locked (SCOPE decision 5)
	duringHelp     meaningful with the help overlay open? (only Escape and `?`)
	duringGesture  meaningful mid-drag? (only Escape, Shift, and `w` — dropping a bend IS the point)

Defaults are the safe ones: a new entry mutates, and is inert during help and during a gesture,
until its author says otherwise. Adding a key wrongly then FAILS CLOSED rather than quietly becoming
the next B42.

`run` names a method on Input. The bodies deliberately did not move: this step turns DISPATCH into
data, which is where every one of those defects lived. Relocating the logic as well would have made
the diff unreviewable and told the net nothing new.
*/

const plain = (e) => !e.ctrlKey && !e.metaKey && !e.altKey;
const meta = (e) => e.ctrlKey || e.metaKey;
const is = (e, k) => e.key.toLowerCase() === k;

export const KEYMAP = [
	// ---- modifier feedback: not verbs, and they must reach a live drag (ortho arms mid-gesture) ----
	{ id: 'shift',   mutates: false, duringGesture: true, duringHelp: true, when: (e) => e.key === 'Shift',   run: 'onShiftDown' },
	{ id: 'alt',     mutates: false, duringGesture: true, duringHelp: true, when: (e) => e.key === 'Alt',     run: 'onArmingKey' },
	{ id: 'control', mutates: false, duringGesture: true, duringHelp: true, when: (e) => e.key === 'Control', run: 'onArmingKey' },

	// ---- modal + always-available ----
	{ id: 'escape',  mutates: false, duringGesture: true, duringHelp: true, when: (e) => e.key === 'Escape', run: 'onEscape' },
	{ id: 'help',    mutates: false, duringGesture: true, duringHelp: true, when: (e) => e.key === '/' || e.key === '?', run: 'onHelpKey' },

	// ---- view state: no model change, so live while Server-Locked ----
	{ id: 'edit-mode', mutates: false, when: (e) => is(e, 'e') && plain(e), run: 'onEditMode' },
	{ id: 'run-mode',  mutates: false, when: (e) => is(e, 'r') && plain(e), run: 'onRunMode' },
	{ id: 'dataview',  mutates: false, when: (e) => e.key === 'Tab',        run: 'onDataView' },

	// ---- inspection: SCOPE decision 5 promises these keep working while locked ----
	{ id: 'select-all', mutates: false, when: (e) => meta(e) && is(e, 'a'), run: 'onSelectAll' },
	{ id: 'datum',      mutates: false, when: (e) => e.key === ' ',         run: 'onDatum' },

	// ---- authoring ----
	// `w` is the one mutating verb that belongs DURING a gesture: dropping a bend mid-route is the
	// whole point of it, and the mouse button is still held.
	{ id: 'waypoint',  mutates: true, duringGesture: true, when: (e) => is(e, 'w') && plain(e), run: 'onWaypointKey' },
	{ id: 'text-tool', mutates: true, when: (e) => is(e, 't') && plain(e) && !e.repeat,         run: 'onTextTool' },
	{ id: 'reshape',   mutates: true, when: (e) => is(e, 's') && plain(e),                      run: 'onReshape' },
	{ id: 'hand',      mutates: true, when: (e) => /^[1-7]$/.test(e.key) && plain(e),           run: 'onHandDigit' },
	{ id: 'pipette',   mutates: true, when: (e) => is(e, 'q') && plain(e),                      run: 'onPipette' },
	{ id: 'stamp',     mutates: true, when: (e) => e.key === 'Enter',                           run: 'onStampKey' },
	{ id: 'nudge',     mutates: true, when: (e) => e.key.startsWith('Arrow'),                   run: 'onArrowKey' },
	{ id: 'wrap',      mutates: true, when: (e) => is(e, 'z') && !meta(e),                      run: 'onWrapKey' },
	{ id: 'close',     mutates: true, when: (e) => is(e, 'c') && plain(e),                      run: 'onCloseKey' },
	{ id: 'chain',     mutates: true, when: (e) => is(e, 'l') && plain(e),                      run: 'onChainKey' },
	{ id: 'rename',    mutates: true, when: (e) => e.key === 'F2',                              run: 'onRenameKey' },

	/*
	History. `undo-run` must precede `delete`, and it is the ONLY place in this table where order
	decides anything — enumerated, not assumed: every other keystroke matches exactly one entry, so
	between disjoint rules the ordering is decoration.

	Ctrl+Shift+Backspace matches both. It means "reverse another writer's whole run" (D21), which is
	deliberately not Ctrl+Z — taking back N changes you did not make is a different intent from
	stepping back one you did, and it should not be reachable by holding a key down. If `delete` came
	first, that intent would silently become "delete the selection".
	*/
	{ id: 'undo-run', mutates: true, when: (e) => meta(e) && e.shiftKey && e.key === 'Backspace', run: 'onUndoRun' },
	{ id: 'undo',     mutates: true, when: (e) => meta(e) && is(e, 'z'),                          run: 'onUndoKey' },
	{ id: 'redo',     mutates: true, when: (e) => meta(e) && is(e, 'y'),                          run: 'onRedoKey' },
	{ id: 'dup',      mutates: true, when: (e) => meta(e) && is(e, 'd'),                          run: 'onDuplicate' },
	{ id: 'group',    mutates: true, when: (e) => meta(e) && is(e, 'g'),                          run: 'onGroupKey' },
	{ id: 'delete',   mutates: true, when: (e) => e.key === 'Delete' || e.key === 'Backspace',    run: 'onDeleteKey' },
];

/*
The first entry whose tolerances the current context satisfies. FILTERS rather than halts, exactly
as the recognizer does, so one mechanism serves both — and because key rules are disjoint (one combo
matches one entry), filtering and halting coincide here anyway. Keeping them the same means the
Server-Locked gate cannot be applied two ways, which is how it drifted before.
*/
export function resolveKey(evt, ctx) {
	for (const r of KEYMAP) {
		if (r.mutates && ctx.readOnly) continue;
		if (ctx.helpOpen && !r.duringHelp) continue;
		if (ctx.gesturing && !r.duringGesture) continue;
		if (r.when(evt, ctx)) return r;
	}
	return null;
}
