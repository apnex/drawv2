/*
triggers.js -- L2 of the gesture system: what an input MEANS AS A GESTURE, decided once
(dev/design/input/GESTURE-SYSTEM.md, section 5.3; stage 3).

Derived from the input state (L1, app/src/input-state.js), never from an event alone, so every gesture asks the same
question the same way. Before this, "was that a click or a drag?" was answered three ways -- the distance from the press
at each move, the distance at release, and the size of the marquee's box -- and they disagreed at the edges: a drag out
and back counted as a click, and the same small release was a click on the canvas and a drag on a node.

THE RULE, ruled 2026-09-30: a CLICK is a release that never travelled more than the threshold from its press; anything
else is a DROP, and the press became a DRAG the moment it went further. The furthest point counts, not the last one.

Only the triggers something reads are here; the rest of the design's vocabulary -- a step, a key release, a double
click as triggers, a hold -- arrives with the bindings that read them (stage 4 on).
*/

export const DRAG_THRESHOLD = 4;   // canvas units a press may wander and still be a click

// the press has gone further than a click may: it is a drag
export const dragging = (state) => !!state.press && state.press.travelled > DRAG_THRESHOLD;

// what a release is: a click, or the drop that ends a drag
export const releaseTrigger = (state) => (dragging(state) ? 'drop' : 'click');
