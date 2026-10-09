/*
releases.js -- what a gesture MEANS when it ends, as rows of the Rules engine (stage 5 of the gesture system,
dev/design/input/GESTURE-SYSTEM.md, sections 5.4 and 5.5).

A gesture owns its lifecycle -- its preview, its teardown, the facts it can see when the button comes up. What those
facts MEAN is here: each gesture hands over its facts, plain data, and the engine (kernel/input-rules.mjs) finds the ONE
row they mean, which names an action on Input. The actions do what they are named and decide nothing; before this the
release handlers decided in `if`s -- the link release alone made about twelve decisions.

Each table is complete and disjoint by construction: every row states what it does not mean, no row wins by position
(Q3), and a release no row means does nothing (I6). An authoring row mutates, so a locked client is refused by the
engine's guard.

THE FACTS each gesture hands over -- only what a row reads:

  link      dst          a destination was found (the anchor released on, else the last stop drawn)
            dstIsSrc     it is the source itself
            srcAlive     the source still exists
            validTarget  released on an anchor that can end the link
            hasVia       the drag drew stops -- a routed link, never chained on
            admitted     the pair has room for the link (B72, `pairHolders`)
            judged       a plugin judges this drag (the lab's network)
            click        the release was a click (app/src/triggers.js)
            atStart      it landed where the drag began -- a chained run's anchor, for a chained drag
            shift, ctrl, alt       held at the release; pressShift -- held at the press
            srcIsNode, hand, handIsSrcType, chained, srcSelected   for what a click means
  marquee   click, hand, shift, ctrl, alt
  ctrl-click  exists     the entity pressed still exists
  handle    the declaring plugin's facts (C-d): a link end's retargets and admitted (network/link-handles.mjs), a zone's changed
  box       area         the box has width and height (the opening row's own releases, C-d)
  drag-start  onLink, onWaypoint, leftPress    what the press was on, and with which button
*/

const released = (e) => e.type === 'up';
const moved = (e) => e.type === 'move';

// ---- the link drag: commit, chain, a click that retypes, toggles, selects or focuses, or discard ----
const commits = (r) => r.dst && r.srcAlive && !r.dstIsSrc && (r.admitted || (r.judged && !r.shift));
const chainsOn = (r) => r.validTarget && r.shift && !r.hasVia;   // Shift-release on an anchor: the run carries on from it
const clickHere = (r) => r.srcAlive && !r.hasVia && r.click && r.atStart;
// a plain click on a node with a different type held retypes it -- never the anchor of a chained run, never with a modifier
const retypes = (r) => clickHere(r) && r.srcIsNode && !!r.hand && r.hand !== 'waypoint' && !r.chained
	&& !r.shift && !r.ctrl && !r.alt && !r.handIsSrcType;
const clicks = (r) => !commits(r) && !chainsOn(r) && clickHere(r) && !retypes(r);

export const LINK_RELEASES = [
	{ id: 'link-commit-and-chain', said: 'Shift + release a link on a node', mutates: true, on: released, when: (r) => commits(r) && chainsOn(r), run: 'commitDrawnLinkAndChain' },
	{ id: 'link-commit', mutates: true, on: released, when: (r) => commits(r) && !chainsOn(r), run: 'commitDrawnLink' },
	// an already-linked target with Shift: skip the duplicate, and keep the chain run alive
	{ id: 'link-chain-on', said: 'Shift + release a link on a node it already joins', mutates: false, on: released, when: (r) => !commits(r) && chainsOn(r), run: 'chainOnFromTarget' },
	{ id: 'link-retype', said: 'click a node with a different type held', mutates: true, on: released, when: (r) => !commits(r) && !chainsOn(r) && retypes(r), run: 'retypeClicked' },
	// a no-drag press is still a click: select, as a press elsewhere does
	{ id: 'link-toggle', said: 'Shift + click a node or waypoint', mutates: false, on: released, when: (r) => clicks(r) && r.pressShift, run: 'toggleClicked' },
	{ id: 'link-select', mutates: false, on: released, when: (r) => clicks(r) && !r.pressShift && !r.srcSelected, run: 'selectClicked' },
	{ id: 'link-focus', mutates: false, on: released, when: (r) => clicks(r) && !r.pressShift && r.srcSelected, run: 'focusClicked' },
	// an invalid target, a duplicate, or a route released off an anchor: the anchors the drag placed go
	{ id: 'link-discard', mutates: false, on: released, when: (r) => !commits(r) && !chainsOn(r) && !clickHere(r), run: 'discardDrawnLink' },
];

// ---- the marquee: a click stamps the held type or clears; a drag selects or adds ----
// a plain click with a held type stamps -- an occupied cell refuses the stamp and still consumes the click: it meant
// "stamp", never "deselect"
const stamps = (r) => r.click && !!r.hand && !r.shift && !r.ctrl && !r.alt;

export const MARQUEE_RELEASES = [
	{ id: 'marquee-stamp', said: 'click the canvas with a type held', mutates: true, on: released, when: stamps, run: 'stampClicked' },
	{ id: 'marquee-clear', mutates: false, on: released, when: (r) => r.click && !stamps(r) && !r.shift, run: 'clearOnClick' },
	{ id: 'marquee-select', mutates: false, on: released, when: (r) => !r.click && !r.shift, run: 'selectInBox' },
	{ id: 'marquee-add', said: 'hold Shift as a marquee is released', mutates: false, on: released, when: (r) => !r.click && r.shift, run: 'addInBox' },
];

// ---- Ctrl+click with no drag: toggle what was pressed ----
export const CTRL_CLICKS = [
	{ id: 'ctrl-click-toggle', said: 'Ctrl + click a node, zone or link', mutates: false, on: released, when: (r) => r.exists, run: 'toggleCtrlClicked' },
];

// ---- a replug: retarget one end, where the pair has room ----
// C-d (H19.32): a handle's release is the declaring plugin's rows -- the network's re-plug (network/link-handles.mjs)

// ---- a zone drawn: made when it has area ----
// C-d (H19.32): what a released box means is the row's that opened it -- the zones plugin's makes a zone (zones/zone-gestures.mjs)

/*
---- a press becoming a drag ----

A press is not a mutation; the drag it becomes is (dev/INPUT.md section 4) -- so these are authoring rows, and a locked
client's press stays a press: the engine's guard, where the escalation used to check read-only itself.

B203 -- a LEFT drag never moves a waypoint: left is the link button on a waypoint, and the press still selects. A link
never moves at all.
*/
export const PRESS_DRAGS = [
	// a plugin's mark is never moved by a drag (H17.22 N-c2): what it joins decides where it is
	{ id: 'start-move', mutates: true, on: moved, when: (r) => !r.onLink && !r.onMark && !(r.onWaypoint && r.leftPress), run: 'startMove' },
];
export const CLONE_DRAGS = [
	{ id: 'start-clone', mutates: true, on: moved, run: 'startClone' },
];
