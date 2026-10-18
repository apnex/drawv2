/*
A DIRECTED LINK'S HEAD -- H24.6 (B356; docs/spec/ATOMICS.md "Arrowheads", "The design, as ruled"). Pure geometry: no DOM.

The head was an SVG marker at the path's last point, which is the anchor's centre, so it lay under the device it pointed at --
on a 6 px link a 6-7 px wedge showed, on a 3.6 px control link nothing. A marker cannot do what was ruled: sit on the anchor's
outline while the line runs on to the centre, hold an 18 px floor, or take the line's colour. So the head is a shape of its own,
worked out here and drawn by the link painter (network/link-painter.mjs) -- the one drawing path the canvas, the export and the
lab share.

  where      the line still runs to its anchor's centre; the head points along the line's straight run into that anchor, its
             outline's OUTER edge touching the anchor's outline where the line crosses it (H24.6-1)
  how big    4 line widths long, never under 18 px -- as wide as it is long (H24.6-2); shrunk only when the straight run is too
             short to hold it, so it never bends round a corner
  shape      hollow, outlined at 4 px, its inside clear: the line is broken beneath it, drawn out from 1 px inside the head's base,
             with a leg of its own from under the head's solid tip on to the centre (H24.6-2b; attached, 2026-10-16)
  which end  where the flow arrives (`linkMarker`); a closed ring, which has no ends, carries it where it closes, at its first
             anchor

An anchor's outline is declared by whoever draws the anchor -- the devices plugin for a device (devices/device-footprint.mjs
`DEVICE_OUTLINES`) -- and reaches the painter through the renderer (`outlineOf`). Undeclared, it is the network's own anchor
ring: a circle of the frame's extent, 20.
*/
import { L_STD, BEND_R } from '../kernel/spec.mjs';
import { pathGeometry } from '../kernel/router.mjs';
import { linkMarker, linkWidth } from './appearance.mjs';   // which end the flow arrives at, and the line's width -- the appearance's answers

export const HEAD_OUTLINE = 4;                      // the hollow head's outline (H24.6-2b)
export const headLength = (w) => Math.max(4 * w, 18);   // H24.6-2
const HEAD_MIN = 8;                                 // shorter than this, a run has no room for a head at all
const OVERLAP = 1;                                  // the line runs this far into the head's base, so no seam shows
const RING = { form: 'circle', r: L_STD.frame.ext };   // the network's anchor ring: an anchor nothing else declares
const SIN = Math.sin(Math.atan(0.5));               // a head as wide as it is long: its half-angle's sine

/*
The distance from an anchor's centre to its outline along a unit direction `v` -- a circle's radius, or where the ray leaves a
rectangle given relative to the centre (`x0 < 0 < x1`, `y0 < 0 < y1`; a wide device's rectangle reaches past its first cell).
*/
export function outlineDistance(outline, v) {
	const o = outline ?? RING;
	if (o.form === 'circle') return o.r;
	const tx = v.x > 0 ? o.x1 / v.x : v.x < 0 ? o.x0 / v.x : Infinity;
	const ty = v.y > 0 ? o.y1 / v.y : v.y < 0 ? o.y0 / v.y : Infinity;
	return Math.min(tx, ty);
}

const r3 = (n) => Math.round(n * 1000) / 1000 + 0;   // `+ 0` turns -0 into 0
const fmt = (p) => `${r3(p[0])} ${r3(p[1])}`;          // as the kernel's router writes a point
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const at = (p, u, d) => [p[0] + u[0] * d, p[1] + u[1] * d];

/*
`points` the link's routed path (src, its bends, dst), `closed` a ring, `which` 'end' | 'start' | null (`linkMarker`), `width`
the line's, `outlines` { start, end } -- the anchors' at either end. Null when undeclared or when no run has room; otherwise
the tip, the head's length, its outline as a path (`headD`), the line from the head's base outward (`lineD`, its dash pattern
started at `lineOffset`), and the leg from inside the tip into the anchor (`legD`, its pattern started at the tip by `legOffset`).
*/
export function linkHead({ points, closed = false, which, width, outlines = {} }) {
	if (!which || !points || points.length < 2) return null;
	const geo = pathGeometry(points, BEND_R, closed);
	if (!geo.length) return null;
	const n = points.length;
	// the straight run the head sits on, the end of it the flow arrives at, and the anchor it points into
	let h, arrives, centre, other = null;
	if (!closed && which === 'end') { h = geo.length - 1; arrives = 'b'; centre = points[n - 1]; if (h === 0) other = outlines.start; }
	else if (!closed) { h = 0; arrives = 'a'; centre = points[0]; if (geo.length === 1) other = outlines.end; }
	else if (which === 'end') { h = geo.length - 1; arrives = 'b'; centre = points[0]; }   // the run home, arriving at the first anchor
	else { h = 1; arrives = 'a'; centre = points[0]; }                                       // the first run, travelled backwards
	const run = geo[h];
	if (!run || run.kind !== 'line') return null;
	const into = arrives === 'b' ? run.b : run.a, from = arrives === 'b' ? run.a : run.b;
	const runLen = len(sub(into, from));
	if (runLen === 0) return null;
	const u = [(into[0] - from[0]) / runLen, (into[1] - from[1]) / runLen];   // the flow's direction along the run
	const outward = { x: -u[0], y: -u[1] };
	const reach = len(sub(into, centre));                                       // a ring's run ends at its corner, short of the centre
	const D = Math.max(outlineDistance(outlines[which === 'end' && !closed ? 'end' : 'start'], outward), reach);
	const tip = at(centre, u, -D);
	const room = runLen - (D - reach) - (other ? outlineDistance(other, { x: u[0], y: u[1] }) : 0);
	const L = Math.min(headLength(width), room);
	if (L < HEAD_MIN) return null;
	const gap = at(tip, u, -(L - OVERLAP));   // where the line meets the head, 1 px inside its base
	/*
	EACH PIECE BEGINS AT THE HEAD (the director, 2026-10-16: the leg past the head should be "attached to the head of the arrow").
	The leg into the anchor starts `tuck` px inside the tip, where the solid apex is at least as wide as the line, so the two read as
	one shape -- starting at the tip itself, a flat line end met the apex's point and left a notch either side. And a dashed or
	dotted line must not begin in a gap: one path cannot promise where its pattern stands after a break (renderers differ on
	whether dashing restarts), so the leg is a piece of its own, its pattern started at the tip (`legOffset`), and the line is laid
	from the head's base outward, so its first dash sits on the base. A ring has no leg: it is one piece from inside the tip, round
	in the flow's direction, back to the base.
	*/
	const tuck = Math.min(width + 1, HEAD_OUTLINE / SIN - 0.5);
	const legStart = at(tip, u, -tuck);
	const rev = (g) => (g.kind === 'line' ? ` L${fmt(g.a)}` : ` Q${fmt(g.c)} ${fmt(g.a)}`);   // a primitive travelled backwards
	const fwd = (g) => (g.kind === 'line' ? ` L${fmt(g.b)}` : ` Q${fmt(g.c)} ${fmt(g.b)}`);
	let lineD, legD = null, lineOffset = 0;
	if (!closed && arrives === 'b') {        // from the base, back along the head's run and every primitive before it
		lineD = `M${fmt(gap)} L${fmt(run.a)}`;
		for (let i = h - 1; i >= 0; i--) lineD += rev(geo[i]);
		legD = `M${fmt(legStart)} L${fmt(centre)}`;
	} else if (!closed) {                    // from the base, on along the head's run and every primitive after it
		lineD = `M${fmt(gap)} L${fmt(run.b)}`;
		for (let i = h + 1; i < geo.length; i++) lineD += fwd(geo[i]);
		legD = `M${fmt(legStart)} L${fmt(centre)}`;
	} else if (arrives === 'b') {            // a ring, forward: on past the tip, round, and home to the base
		lineD = `M${fmt(legStart)} L${fmt(run.b)}`;
		for (let i = 0; i < h; i++) lineD += fwd(geo[i]);
		lineD += ` L${fmt(gap)}`;
		lineOffset = -tuck;
	} else {                                 // a ring, reverse: the same, travelled the other way
		lineD = `M${fmt(legStart)} L${fmt(run.a)}${rev(geo[0])}`;
		for (let i = geo.length - 1; i > h; i--) lineD += rev(geo[i]);
		lineD += ` L${fmt(gap)}`;
		lineOffset = -tuck;
	}
	// the outline's centre line: its outer edge touches the tip, its base, and as wide as it is long
	const back = (HEAD_OUTLINE / 2) / SIN;
	const tipC = at(tip, u, -back);
	const depth = L - back - HEAD_OUTLINE / 2;
	const base = at(tipC, u, -depth), half = depth / 2, nrm = [-u[1], u[0]];
	const headD = `M${fmt(tipC)} L${fmt(at(base, nrm, half))} L${fmt(at(base, nrm, -half))} Z`;
	return { tip: [r3(tip[0]), r3(tip[1])], length: r3(L), headD, lineD, lineOffset: r3(lineOffset), legD, legOffset: r3(-tuck) };
}

/*
A link's head, in one call: its routed `points`, the `outlines` of the anchors at its ends, and the canvas's link width. Which end
carries it and how wide the line is are the appearance's answers (`linkMarker`, `linkWidth`), asked here so a renderer asks one
question rather than three (tests/span.test.js H15.9 holds that).
*/
export const linkHeadOf = (link, points, outlines, w) => linkHead({ points, closed: !!link.closed, which: linkMarker(link), width: linkWidth(link, w), outlines });
