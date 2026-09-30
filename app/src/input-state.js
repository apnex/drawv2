/*
input-state.js -- L1 of the gesture system: what the input has done, as ONE plain value
(dev/design/input/GESTURE-SYSTEM.md, section 5.2; stage 2).

`track(state, event) -> state` is a pure reducer. It reads input events from capture (L0), and two NOTES the gesture
layer leaves for the next gesture; it writes nothing, keeps nothing between calls, and the same stream always yields the
same state -- so a gesture can be replayed exactly (invariant G2).

WHAT IT HOLDS -- only what something reads, as the design's guardrails require; held keys, the press position and the
distance travelled join at stage 3, when the click and drag triggers are their first readers:

	pointer.at     where the pointer is, in canvas coordinates, or null off the canvas. Keys act there: `w`, Enter, space,
	               the pipette, a digit mid-drag. It was `Input#lastPos`.
	armed          the `w` that placed an anchor, which counts as the next drag's first key while that anchor is still the
	               sole selection (ruled 2026-09-30). `placed` is set by the note; a press hands it to `source` and clears
	               it -- every press consumes it, so a click away clears it. They were `placedByW` and `armedSource`.
	chained        this link drag was begun by a chain -- a Shift-release or a digit mid-drag -- not by a press. Any press
	               clears it. It was `ctx.chained`, and the retype-in-place click reads it.

THE NOTES are what an action tells the next gesture, recorded in the same stream as the input so replay sees them too:

	{ type: 'armed', id }    a `w` placed this anchor
	{ type: 'chained' }      a chain began the link drag now live

Time enters with the first timed trigger (stage 3); until then nothing here reads a clock.
*/

export const initialInputState = () => ({ pointer: { at: null }, armed: { placed: null, source: null }, chained: false });

export function track(state, event) {
	switch (event.type) {
		case 'down': return { pointer: { at: event.at }, armed: { placed: null, source: state.armed.placed }, chained: false };
		case 'move': return { ...state, pointer: { at: event.at } };
		case 'leave': return { ...state, pointer: { at: null } };
		case 'armed': return { ...state, armed: { ...state.armed, placed: event.id } };
		case 'chained': return { ...state, chained: true };
		default: return state;
	}
}
