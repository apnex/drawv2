/*
How the network plugin's own entities look -- starting with pipes. INCUBATING (ruled 2026-09-28).

ONE AUTHORITY, and not a stylesheet. The first pipe painter set no colour and styled pipes in
lab/lab.css with `stroke: currentColor` at 0.35 opacity, to avoid adding a colour while B255 (the
canvas's two authorities for every colour) is open. `currentColor` inherited black: MEASURED
rgb(0, 0, 0) at 1.1:1 on the canvas, which is invisible -- the director reported it, and the gate never
could have, because it checked that pipes were DRAWN and never what colour they came out. The
handover's first listed failure, verifying the attribute instead of the computed result, exactly.

So the colour is chosen here, measured, and applied as an attribute by whoever draws a pipe; the
stylesheet holds no pipe rule at all. SD11b puts pipes in the network plugin, and H17 K13a already
plans a "network appearance" module -- this is it, early. When B255's registry lands, this is what the
plugin contributes to it.

  stroke  #8b949e  6.2:1 on the #101010 canvas: clearly visible, and quieter than links (#4fc3f7,
                   9.5:1) so pipes read as the layer beneath them. SOLID -- no opacity, so the
                   contrast on screen is the contrast measured here.
  width   3        half a link's 6: the lower layer is the lighter line.
  dash    a pipe laid WITH A LINK is dashed, because it lasts only while a link uses it; one laid BY
          HAND is solid, because it stays (the 2026-09-27 lifetime ruling). The difference is on the
          canvas rather than something the author must remember.
*/
import { colour } from '../kernel/palette.mjs';
import { NETWORK_COLOURS, linkWidth } from '../kernel/network-appearance.mjs';

// the network's pipe role, from the one palette (kernel/network-appearance.mjs NETWORK_COLOURS; snapped 2026-10-01 to
// Blue Grey 400, the nearest Material colour to the #8b949e measured below)
const PIPE_STROKE = colour(NETWORK_COLOURS.pipe);
const PIPE_WIDTH = 3;
const PIPE_DASH = { link: '6 4', hand: null };

// the attributes one pipe is drawn with -- the module's ONE door, so a painter cannot pick up half the style
// and miss the rest, and a test reads the colour through the same door the painter uses
export function pipeAttributes(laid) {
	const dash = PIPE_DASH[laid];
	return { stroke: PIPE_STROKE, 'stroke-width': PIPE_WIDTH, fill: 'none', ...(dash ? { 'stroke-dasharray': dash } : {}) };
}

/*
A HAND PIPE'S CLICK AREA (H17.22 N-c2, B281): exactly the thinnest link's width -- a control link's -- so a pipe a link is
drawn over is covered by that link's own click area (B268: a link's click area is its own width) and never peeks out
beside it, as ruled: a covered pipe cannot be clicked. Wider than the pipe drawn, so a free pipe is not fiddly.
*/
export const pipeHitAttributes = () => ({ stroke: 'transparent', 'stroke-width': linkWidth({ control: true }), fill: 'none' });
