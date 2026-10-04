/*
NETWORK APPEARANCE -- how the network is DRAWN: the scene elements for waypoints, paths, junctions and ports, the
waypoint ring ladder and the layers each waypoint draws, and a link's width, dash, arrowhead and appearance attributes.
Both renderers read it -- the live canvas (app/src/renderer.js) and the export (kernel/svg-scene.mjs) -- so they cannot
draw a waypoint or a link differently.

K13a (dev/design/h17/PLAN.md): split from kernel/geometry.mjs, whose core grid exported these network names (L5, L5p).
Network layer: it reads the core spec, theme and grid, and nothing else.

V-a (H18.25; PROMOTION.md P5, PU22): moved from `network/appearance.mjs` into the network plugin, beside its pipes' look,
which this module now holds too (section at the end) -- one module for how everything the network draws looks.
*/
import { TOKENS } from '../kernel/theme.mjs';   // the product's roles it draws beside its own (the canvas panel fill)
import { colour } from '../kernel/palette.mjs';

/*
THE NETWORK PLUGIN'S COLOUR ROLES -- which palette colour each thing it draws uses (ruled 2026-10-01: one core palette,
kernel/palette.mjs; a plugin declares its roles). Here, beside its appearance; moved into `network/` with the rest of the
plugin at V-a (dev/PRODUCTION-UPGRADE.md PU22). tools/colour-tokens.mjs writes them to network/tokens.css as `--tok-network-<role>`.
*/
export const NETWORK_COLOURS = {
	pipe: 'blueGrey400',         // the layer beneath the links (pipeAttributes, below)
	transitRing: 'red200',       // an anchor whose transit the author turned off (TRANSIT.md section 12; light red, ruled 2026-10-02)
	down: 'orange500',           // a link with no route right now, and a link blocking the selected down link's way
	pipeSelected: 'lightGreen300',   // a selected hand pipe (H17.22 N-c2, B281) -- the product's one selection colour, its accent
};
import { STD, BEND_R } from '../kernel/spec.mjs';
import { gridDot } from '../kernel/geometry.mjs';
import { evenDash } from '../kernel/renderer.mjs';   // a fitted dash for the transit ring (2026-10-02)

// ---- the network's scene elements (px coords, center-origin) ----
/*
waypoint: a placeable 40px-circle routing pivot. A path bends through its centre with r=20, so the
bend is inscribed exactly in the circle. Permeable (not a routing obstacle).

`role` is DERIVED by the engine from the relations, never stored on the document: a waypoint in a
route's `via` is a BEND, one at its `from`/`to` is an ENDPOINT, and one at the from/to of a CLOSED
route is a bend again, because a ring has no ends. Carrying it on the element rather than deciding
in the renderer is what lets the live canvas and the SVG export agree without either restating the
rule -- they both consume this.
*/
/*
B209 -- carries the ROLE SET. `role` is a projection kept beside it for `bboxOf` and the hit tests,
which ask a yes/no question and do not need the whole list.
*/
export const waypoint = (cx, cy, roles = []) => ({
	kind: 'waypoint', cx, cy, roles,
	role: roles.includes('endpoint') ? 'endpoint' : 'bend',
});

export const port = (cx, cy, o = {}) => ({ kind: 'port', cx, cy, style: o.style || 'square', size: o.size || 10 });
export const junction = (cx, cy) => ({ kind: 'junction', cx, cy });       // a tap point on a trunk
// path = a routed polyline through grid waypoints (px). The router renders it with rounded
// corners; GRC validates its turns. `pts` = [[x,y], …]; radius defaults to the locked bend.
export const path = (pts, o = {}) => ({ kind: 'path', pts, radius: o.radius ?? BEND_R, closed: !!o.closed });

/*
How a waypoint of each role is DRAWN, beside the rule for what it is.

The two renderers are deliberately separate (B28) -- one keeps addressable DOM for a person editing,
the other emits a finished SVG string -- but they had each inlined the same four decisions: stroke
weight, radius, fill and opacity. Change the pad weight in one and the canvas and the export diverge
in silence, which is exactly the failure this pair produced twice while it was being built.

The kernel owns the numbers and each renderer owns only its emission. That is not a new idea here:
`L_STD`, `TOKENS`, `contentLayout`, `groupHull` and `roundedPath` already work this way and the
client imports every one of them. The waypoint style was the outlier.

B199 -- a waypoint is an ANCHOR, and a sub-type is an additive layer on top of it.

  anchor    a light hollow ring at the full extent, plus the centre dot. EVERY waypoint has one,
            whatever it does, because the anchor is what a waypoint IS -- a grid point a link can
            reach. It is not a style a role selects; it is the floor.
  endpoint  adds a heavy opaque pad INSIDE the anchor. The line still runs to the centre and the
            pad's fill masks it, so the path appears to terminate on the pad exactly as before.
  bend      adds nothing. The path turning is the whole rendering, and what a bend looked like was
            always just the anchor -- that is now stated rather than coincidental.

B200 -- THE LAYERS ARE A LADDER OF CONCENTRIC RINGS, on whole numbers.

Sub-types are expected to multiply, and a waypoint may carry several at once, so the layers have to
read as distinct rings when drawn together. Separation is measured between bands of INK, edge to
edge rather than centre to centre -- a stroke straddles its radius, so two rings can be far apart
by radius and still touch.

  layer     radius  width   ink            clear gap before it
  dot          2    solid    0.0 -  2.0
  junction     7      3      5.5 -  8.5    3.5
  endpoint    14      5     11.5 - 16.5    3.0
  anchor      20      2     19.0 - 21.0    2.5

EVERY RADIUS AND WIDTH IS A WHOLE NUMBER, and the gaps absorb the remainder instead. The first cut
of this rule fixed the gaps at exactly 3.0 and derived the radii, which produced 6.7 and 13.7 from
an inherited dot of 2.2 and an inherited anchor stroke of 1.6. Those two values were sediment --
the old bend's weight and the original dot size -- and deriving from them spread their awkwardness
through every layer that came after.

The director inverted it: pick round radii, let the gaps land where they land. 3.5 / 3.0 / 2.5 is
not uniform, and at canvas scale the difference is not perceptible -- the three variants were
rendered at 1:1 and compared before this was chosen.

Weight still carries meaning. The endpoint pad at 5 stays heavier than the junction ring at 3,
because a heavy ring says a line TERMINATES here; an equal-weight variant was rejected for making
the two rings read as peers.

A future sub-type takes a rung by the same arithmetic: choose a whole radius and width, keep the
ink clear of its neighbours. What the rule does NOT survive is a layer that is not a concentric
ring -- a square or a glyph has no single ink band, and that is a decision between the shape and
the ladder rather than something to solve here.
*/
const ANCHOR_WIDTH = 2;
const ANCHOR_OPACITY = 0.7;
const JUNCTION_RADIUS = 7;
const JUNCTION_WIDTH = 3;
const ENDPOINT_RADIUS = 14;
const ENDPOINT_WIDTH = 5;
/*
The transit ring (ruled 2026-09-28): the author declared that this anchor keeps apart what
reaches it, so no bend and no junction form here.

AMENDED 2026-10-02 -- IT TAKES THE JUNCTION'S PLACE (the director: "a copy of the JUNCTION ring, but just very slightly
thinner, and a light red color ... Now that we can never draw a junction I would like the transit ring to occupy that
visual space"; "still dashed"). An anchor whose transit is off is never a junction (B277), so the junction's rung of the
ladder is free there: the ring is drawn at the junction's radius, 7, and -- seen side by side in the lab -- at its width, 3,
too (the director chose "Width 3, dash 3 2" over width 2). Dashed, in light red (Red 200), each dash 3 long and a gap of
2, so a dash stays at least as long as the stroke is thick and the ring reads as dashed rather than as a row of ticks,
which a 2-unit dash at this width did. (AMENDED: about 4 and 2, fitted -- below.) Unfilled, unlike the junction: on a waypoint the endpoint pad beneath already
masks the centre, and on a node, which draws the same ring at its anchor point, a fill would blank out the glyph. It
clears the endpoint ring as the junction does: ink 5.5 to 8.5 against the endpoint's 11.5 to 16.5.

Until then it sat at radius 10 with a width of 1, in the gap between the junction and endpoint rings, in Orange 300.
*/
const TRANSIT_RADIUS = JUNCTION_RADIUS;
const TRANSIT_WIDTH = JUNCTION_WIDTH;
/*
AMENDED 2026-10-02: dashes of about 4 with gaps of about 2, fitted to divide the ring exactly (`evenDash`) -- the director
chose "4 / 2" over 5 / 3, and asked that a dash size be a target the pattern adjusts to fit, so no short dash is left where
the ring begins and ends. On this ring: seven dashes, each about 4.2.
*/
const TRANSIT_DASH = evenDash(2 * Math.PI * TRANSIT_RADIUS, 4, 2);

// the transit ring as a layer -- one spec, which `waypointLayers` hands out for an anchor and the canvas takes for a node
// from the same list, so the two cannot be drawn differently (transit with pipes, TRANSIT.md section 12, stage X1)
const transitLayer = () => ({ cls: 'wp-transit', radius: TRANSIT_RADIUS, width: TRANSIT_WIDTH, fill: 'none', opacity: 1, dash: TRANSIT_DASH.dash, pathLength: TRANSIT_DASH.pathLength, stroke: colour(NETWORK_COLOURS.transitRing) });

export const waypointStyle = (role, ext) => {
	const endpoint = role === 'endpoint';
	return {
		// the sub-type layer: what this waypoint adds to the anchor. `null` for a plain bend.
		width: endpoint ? ENDPOINT_WIDTH : ANCHOR_WIDTH,
		radius: endpoint ? ENDPOINT_RADIUS : ext,
		fill: endpoint ? TOKENS.panel : 'none',
		opacity: endpoint ? 1 : ANCHOR_OPACITY,
	};
};

/*
The anchor every waypoint draws, beneath whatever its sub-type adds.

Identical to what `waypointStyle('bend', ext)` returns, and that is the point rather than a
duplication: a bend adds no layer, so a bend IS its anchor. Naming it separately means an endpoint
can draw one too without asking for the style of a role it does not have.
*/
export const waypointAnchor = (ext) => ({
	radius: ext,
	width: ANCHOR_WIDTH,
	fill: 'none',
	opacity: ANCHOR_OPACITY,
});

/*
The junction ring -- the sub-type between the dot and the endpoint pad.

Hollow, because a junction says "these links are connected here" rather than "a line stops here",
and the path must stay visible running through it. That is the same reasoning the `junction`
ELEMENT already carries in the kernel renderer, which uses an opaque centre for a different job:
that one is a tie-point drawn instead of a waypoint, this one is a layer drawn on top of one.
*/
/*
The junction ring -- OPAQUE, for the same reason an endpoint pad is.

It was hollow on the reasoning that a junction means "these links are CONNECTED here", so the paths
should stay visible running through it. B211 voided that: a junction is terminations only, and
nothing passes through one. Links END at its edge, so a hollow ring showed their tails crossing
underneath and meeting at a point they do not reach.

`TOKENS.panel` is the theme's canvas / opaque-centre fill, which the endpoint pad already uses to
say exactly this.
*/
export const waypointJunction = () => ({
	radius: JUNCTION_RADIUS,
	width: JUNCTION_WIDTH,
	fill: TOKENS.panel,
	opacity: 1,
});

/*
THE RUN PICTURE -- what run mode shows and the SVG download draws, ONE rendering decided here (P4 R-c, H18.21; ruled H2, refined
2026-10-04: "there is no separation between their rendering (unified when a static image) and therefore one place for code.
We can adjust what is in and out later").

Run mode is for watching, and a download is the diagram as finished; neither shows authoring geometry. Leaving out, today:
  pipes      every pipe, a link's or a hand one -- the way a route is laid, not the route (the director, 2026-10-02; H2)
  anchor     each waypoint's anchor ring, which is also its grab target, so nothing is dragged while the diagram runs (B201)
  bend dot   a bend's centre dot: a bend is a corner its route turns, and the turn is already in the path (B202). An
             endpoint keeps its dot -- where movers enter, and what `spawning` and `armed` colour

These were three stylesheet rules over elements the canvas still drew (app/style.css, network/network.css), and the export
drew every layer; now the canvas in run mode and the export both draw this subset, and nothing is hidden after drawing.
What is in or out changes HERE, and both follow.
*/
// the colour a down link is drawn in where no stylesheet colours it -- the export (on the canvas, network/network.css)
export const downStroke = () => colour(NETWORK_COLOURS.down);

export const RUN_PICTURE = Object.freeze({
	pipes: false,
	// whether a waypoint layer is left out of the run picture, given the waypoint's roles
	leavesOut: (layer, roles) => layer.cls === 'wp-anchor' || (layer.cls === 'wp-dot' && !roles.length),
});

/*
B209 -- every layer a waypoint draws, innermost last so the opaque pad cannot bury what sits inside
it. The anchor is the floor and is always present; the rest are the sub-types `waypointRoles`
derived. One list, walked by both renderers, so the canvas and the export cannot disagree about
what a role looks like.
R-c (H18.21): `{ run: true }` asks for the run picture's layers (`RUN_PICTURE`), which the export always draws.
*/
export const waypointLayers = (roles, ext, links = null, anchor = null, { run = false } = {}) => {
	const all = layersOf(roles, ext, links, anchor);
	return run ? all.filter((l) => !RUN_PICTURE.leavesOut(l, roles)) : all;
};
const layersOf = (roles, ext, links, anchor) => {
	const out = [{ cls: 'wp-anchor', ...waypointAnchor(ext) }];
	/*
	The transit ring is the one layer here that is NOT derived from the role set.

	Every other layer answers "what did the page turn out to be": one termination is an endpoint,
	three is a junction. This answers "what did the author declare", which is why it reads the
	anchor rather than the roles, and why it draws at any link count including none -- an anchor
	marked before its links exist must SHOW the mark, or allowing that pre-declaration buys
	nothing (ruled 2026-09-28).

	It composes rather than replaces: a non-transiting anchor with three links draws the endpoint
	ring and this one inside it -- so it is pushed AFTER the derived rings, below only the centre dot.
	Pushed before them first, it was painted over by the endpoint ring's opaque fill the moment a cut
	made the anchor an endpoint (the director's report, 2026-09-30).
	*/
	if (roles.includes('endpoint')) {
		// H15.16 -- the ring carries the plane in its WEIGHT, at the same ratio the link uses. The
		// links are needed because a role set alone cannot say which plane a terminus serves.
		const ring = waypointStyle('endpoint', ext);
		if (allControl(links)) ring.width = round1(ring.width * CONTROL_WEIGHT);
		out.push({ cls: 'wp-ring', ...ring });
	}
	if (roles.includes('junction')) out.push({ cls: 'wp-junction', ...waypointJunction() });
	if (anchor && anchor.transit === false) out.push(transitLayer());   // on top of the rings it sits between
	out.push({ cls: 'wp-dot', radius: gridDot().radius, fill: 'solid' });
	return out;
};

/*
The dash a link is drawn with, DERIVED from its plane. Null for an ordinary data link, which is
solid, so absence of the field means absence of the attribute rather than a default written out.

The pattern is a multiple of the stroke so it scales with the line rather than carrying its own
number -- the same reasoning `markerUnits="strokeWidth"` uses for the arrowhead.
*/
const round1 = (n) => Math.round(n * 10) / 10;

/*
The dash pattern of a control link, in STROKE WIDTHS rather than pixels, so it scales with the line
and stays in proportion if `linkW` or the control weight is ever changed.

Both halves are named. The gap was hardcoded at one width while the dash was a constant, which made
one of the two adjustable and the other invisible -- and the ratio between them is the whole of how
a dashed line reads.
*/
const DASH_ON = 2;      // dash length
const DASH_OFF = 1.5;   // gap -- shorter than the dash, or the line reads as separate marks
export const linkDash = (link, w = STD.linkW) =>
	(link.control ? `${round1(w * DASH_ON)} ${round1(w * DASH_OFF)}` : null);

/*
H15.16 -- the control plane reads THINNER, so the plane is legible without reading the dash.

One ratio, applied to the link stroke and to the endpoint ring alike, so the two cannot drift into
different ideas of "slightly thinner". A fraction rather than a second constant because the widths
it scales are already ruled numbers -- `linkW` and the endpoint ladder -- and a control link should
stay in proportion if either is ever changed.
*/
const CONTROL_WEIGHT = 0.6;
export const linkWidth = (link, w = STD.linkW) => (link.control ? round1(w * CONTROL_WEIGHT) : w);

// every link terminating here is control plane. MIXED IS DATA: a terminus serving both is not
// half control, and thinning it would claim something the graph does not say.
const allControl = (links) => Array.isArray(links) && links.length > 0 && links.every((l) => !!l.control);

/*
H15.6 -- WHICH END OF A LINK CARRIES THE ARROWHEAD, derived from the declaration.

The first appearance in this tree that follows from a DECLARATION rather than from a type, and so
the first real exercise of the pipeline: derived state in, one answer out, every renderer reading it
rather than deciding again.

`'end'`, `'start'`, or null for an undeclared link -- which has no head because it asserts no
direction to point. The head sits where the flow ARRIVES, which is the same fact `linkFacing`
reports as `in`, and a test holds the two to agreement.
*/
/*
H15.9 -- THE APPEARANCE PIPELINE, for a link.

Everything a renderer needs to draw one, derived in a single call and returned as ATTRIBUTES rather
than as advice. A caller emits what it is given; it decides nothing.

WHY THIS SHAPE, stated plainly because it is a response to a ledger rather than a preference. Every
appearance defect in H15 lived in the gap between a derivation and the renderer that consumed it:

  B225  the adapter dropped a field, so one renderer had nothing to derive from
  B226  an attribute was emitted that resolved to no paint
  B228  create set the marker and update did not -- the same assembly, written twice
  B232  a rule implemented in one place and guarded from another
  B234  the name reached no renderer at all, through four doors

Sub-questions answered separately and assembled at each call site is what made all of those
possible. One answer, assembled once, removes the second place to forget.

ABSENT IS ABSENT. A key that does not apply is missing from the object rather than present and
undefined, because a caller that sets attributes blindly would otherwise write "undefined" into the
DOM. `APPEARANCE_KEYS` names every key this can produce, so an UPDATE can remove what a previous
state set -- which is the half B228 got wrong and could not have got right without it.
*/
export const APPEARANCE_KEYS = ['stroke-width', 'stroke-dasharray', 'stroke-linecap', 'data-down', 'marker-end', 'marker-start'];

/*
A DOWN link -- one with no route right now, which heals when a route returns (ruled 2026-09-25) -- is
drawn DOTTED, as the director described it (2026-09-29): "a dotted/control like link directly between
the source and dest node would indicate 'ready to heal'".

DOTS, NOT THE CONTROL DASH. A control link is already dashed, and so is the live drag preview; a dashed
down link would read as a live control-plane link. A dot is a zero-length dash with a ROUND cap -- without
the cap it draws nothing -- spaced in stroke widths like the dash, so it scales with the line. The link
keeps its own weight, so a down control link is still visibly control plane.

`down` is DERIVED state the link does not carry (no route over the pipes), passed in by whoever knows
it. Production never passes it: it has no routes to lose.
*/
const DOT_GAP = 2;   // centre to centre, in stroke widths: one dot's width of gap between dots

export const linkAppearance = (link, w = STD.linkW, { down = false } = {}) => {
	const width = linkWidth(link, w);
	const dash = down ? `0 ${round1(width * DOT_GAP)}` : linkDash(link, width);
	const head = linkMarker(link);
	return {
		'stroke-width': width,
		...(dash ? { 'stroke-dasharray': dash } : {}),
		...(down ? { 'stroke-linecap': 'round' } : {}),
		// ORANGE as well (2026-09-29): link colour is the stylesheet's, beside .link.selected, so the state is marked here and coloured there
		...(down ? { 'data-down': '' } : {}),
		...(head === 'end' ? { 'marker-end': 'url(#flow-end)' } : {}),
		...(head === 'start' ? { 'marker-start': 'url(#flow-start)' } : {}),
	};
};

export const linkMarker = (link) => {
	if (link.direction !== 'forward' && link.direction !== 'reverse') return null;
	return link.direction === 'forward' ? 'end' : 'start';
};

/*
THE PIPES' LOOK -- how the network plugin's own entities look, starting with pipes (ruled 2026-09-28). Was network/appearance.mjs
whole, until V-a merged the kernel's network appearance into it.

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

// the network's pipe role, from the one palette (NETWORK_COLOURS, above; snapped 2026-10-01 to
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
