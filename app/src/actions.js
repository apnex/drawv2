/*
actions.js -- every action a binding can name, named ONCE, with the label a person reads (stage 6 of the gesture system,
dev/design/input/GESTURE-SYSTEM.md, section 5.5; invariant G6).

A binding names its action -- a key row's `run`, a press row's `gesture` -- and the help overlay, and the context menu
after it, show the label from here. Nothing keeps its own list of what the controls do: the help overlay's 41
hand-written rows had drifted (they still offered `7` as the waypoint, which B146 removed, and a Tab "data view" that
had been deleted), because nothing compared them with the tables.

A plugin's rows bring their own label, as `doc`; the product does not name what it does not know exists.
*/

export const ACTION_LABELS = {
	// ---- keys ----
	onShiftDown: 'hold for the zone layer; mid-drag, lock to an axis',
	onArmingKey: 'arm the chord under the pointer: Alt to delete, Ctrl to clone',
	onEscape: 'cancel the gesture, drop the tool or the held type, or clear the selection',
	onHelpKey: 'show or hide this overlay',
	onEditMode: 'edit mode: show the socket grid on content panels',
	onRunMode: 'run mode: panel buttons act, and inputs edit',
	onLabels: 'show or hide names',
	onDatum: 'set the datum at the pointer',
	onDatumClear: 'clear the datum',
	onWaypointKey: 'drop a waypoint; while drawing a link, pin a bend',
	onTextTool: 'arm the text tool: then drag a text box, or click for one cell',
	onHandDigit: 'pick up a node type to stamp; while drawing a link, place one and chain on',
	onPipette: 'pick up the type of the node under the pointer',
	onStampKey: 'stamp the held type at the pointer',
	onArrowKey: 'nudge the selection one cell',
	onRenameKey: 'rename the selection',
	onUndoRun: 'undo another writer\'s whole run',
	onUndoKey: 'undo',
	onRedoKey: 'redo',
	onDuplicate: 'duplicate the selection at the remembered pitch',
	onDeleteKey: 'delete the selection',
	// ---- what a press starts ----
	'gesture:link': 'draw a link: release on a node or waypoint',
	'gesture:clone-pending': 'clone: drag the copy into place',
	'gesture:pending': 'select; drag to move',
	'gesture:marquee': 'marquee select, with every link whose ends are both inside',
	deleteUnderCursor: 'delete what is under the pointer',
	editUnderPointer: 'edit the label under the pointer',
	// ---- what a release means, where it is a control of its own ----
	commitDrawnLinkAndChain: 'make the link and carry on drawing from where it landed',
	chainOnFromTarget: 'carry on drawing from a node already linked',
	retypeClicked: 'retype the node in place',
	toggleClicked: 'add it to the selection, or take it out',
	toggleCtrlClicked: 'add it to the selection, or take it out',
	stampClicked: 'stamp the held type there',
	addInBox: 'add what the marquee takes to the selection',
	// ---- run mode ----
	fireActionHere: 'press the panel button',
	openInputHere: 'edit the panel input',
};

// the action a row names: its run, or the gesture it starts
export const actionOf = (row) => (typeof row.run === 'string' ? row.run : row.gesture ? `gesture:${row.gesture}` : null);
