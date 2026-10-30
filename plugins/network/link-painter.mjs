/*
THE NETWORK'S LINK PAINTER -- C-a, step four (H19.29; dev/design/unification/CANVAS-PLUGINS.md, D1): how a link is drawn on the
page.

A link is a path along where the network draws it -- its route, or a down link's intent (`pathOf`) -- rounded at its bends
(the kernel's `roundedPath`), with the look the network derives in one call (`linkAppearance`: its weight, its dash, its head,
whether it is down), and an invisible twin just after it taking its clicks (B268). Stacked by drawing order (F-d). A link's
put, set or delete re-derives the waypoints at its ends and bends, since their roles are read from the links meeting them
(B218). It was the renderer's own branch (app/src/renderer.js `draw`, `update`, `linkPath`, `linkAppearanceOf`, `hitTwinOf`,
`refreshWaypointsOf`); the elements and every attribute are what the renderer built -- the K8 DOM corpus holds that.
RESTATED H26.8 (dev/design/components/NATIVE-SHAPES.md section 3.2, NS2; appendix B): it answers the link's shapes as ordered named
parts -- `''` its line, the link's own item keyed by its id, then `head`, `leg` and `hit`, each a companion keyed `<id>/<part>` -- where
it built elements, then updated each again by finding it (T5). A head or leg the link no longer has is a part no longer answered, which
the renderer removes; one it gains, a part answered, put where the order says, before the twin.
*/

import { STD, BEND_R } from '../../kernel/spec.mjs';
import { roundedPath } from '../../kernel/router.mjs';
import { linkAppearance, downStroke, NETWORK_TOKENS } from './appearance.mjs';
import { pathOf, isLinkDown } from './network-queries.mjs';
import { linkHeadOf, HEAD_OUTLINE } from './link-head.mjs';

const LINK_W = STD.linkW;   // the link's stroke width (6)

/*
B268 -- A LINK'S CLICK AREA, apart from how it looks. The browser hit-tests a stroke's dashes and not its gaps, so a down
link (dotted) or a control link (dashed) was selected only where a click landed on a dot -- measured, 10 of 29 clicks.
Each link therefore has an invisible twin drawn just after it: the same path and the same width and caps, never dashed,
never seen, taking the click for the link (`app/src/pick.js` reads its `data-link`). The click area is exactly the link's
own outline, gaps filled -- no wider -- and the visible link is untouched.
*/
const hitOf = (d, look) => ({ d, fill: 'none', stroke: 'transparent', 'stroke-width': look['stroke-width'],
	...(look['stroke-linecap'] ? { 'stroke-linecap': look['stroke-linecap'] } : {}) });

// the routed path: src, its bends, dst -- resolved by the network (`pathOf`), rounded at the kernel's bend; closed, a ring
const linkPath = (points, link) => points && roundedPath(points, BEND_R, !!link.closed);
/*
H24.6 (B356) -- ITS HEAD, a shape of its own (plugins/network/link-head.mjs): at the end the flow arrives at, its tip on that anchor's
outline -- as the part drawing the anchor declares it (`outlineOf`, the devices plugin for a device), or the network's own ring
-- with the line broken beneath it. Null for an undeclared link, or one with no room.
*/
const headOf = (model, link, points, outlineOf) => {
	if (!points) return null;
	const outline = (id) => outlineOf?.('node', model.get('node', id));
	return linkHeadOf(link, points, { start: outline(link.src), end: outline(link.dst) }, LINK_W);
};
// how a link looks: the ONE derivation (H15.9), fed whether it is down, which only the network knows, and whether it carries a head
const lookOf = (model, link, head) => linkAppearance(link, LINK_W, { down: isLinkDown(model, link), headed: !!head });
/*
The head's element: hollow, its outline 4 px. Its colour is the link's, by its state: the stylesheet colours it from the link
element it follows (`.link.selected + .link-head` and the down and blocking rules, all in plugins/network/network.css since H25.1), and these attributes
are what the export, which loads no stylesheet, draws. It names its link by `data-head-of` -- not `data-link`, which marks a
click twin the export leaves out -- and takes no click of its own (the twin under it does).
*/
const headAttrs = (head, down) => ({ class: 'link-head', 'data-head-of': head.of, d: head.headD, fill: 'none', stroke: down ? downStroke() : NETWORK_TOKENS.link,
	'stroke-width': HEAD_OUTLINE, 'stroke-linejoin': 'miter', ...(down ? { 'data-down': '' } : {}) });
/*
The leg (the director, 2026-10-16: "attached to the head of the arrow"): the short piece of line from under the head's tip on into
the anchor, drawn straight after the head as a piece of its own, so a dashed or dotted pattern starts at the tip rather than
wherever the line's left off. It is the line's own look -- width, dash, caps -- and its colour by state as the head's is.
*/
const legAttrs = (head, look) => ({ class: 'link-leg', 'data-leg-of': head.of, d: head.legD, fill: 'none', stroke: 'data-down' in look ? downStroke() : NETWORK_TOKENS.link,
	'stroke-width': look['stroke-width'], 'stroke-linecap': look['stroke-linecap'] ?? 'butt',
	...(look['stroke-dasharray'] ? { 'stroke-dasharray': look['stroke-dasharray'], 'stroke-dashoffset': head.legOffset } : {}),
	...('data-down' in look ? { 'data-down': '' } : {}) });
// a ring's one piece starts inside its head's tip, so its dash pattern is started there (no other line states an offset)
const lineOffsetOf = (head) => (head && head.lineOffset ? { 'stroke-dashoffset': head.lineOffset } : {});

const LINK_PAINTER = {
	kind: 'link',
	layer: 'links',
	stacked: true,
	// C-b: the path itself, and its click twin wherever a dotted or dashed stroke has a gap (B268) -- RESTATED at H26.8's picks move: one
	// pick, by item, its line (`''`) and its twin (`hit`) answering, its head and leg not; D4: Ctrl+left clones it
	picks: [{ word: 'link', clones: true, parts: ['', 'hit'] }],
	run: { entity: [''] },   // C-f: what it draws, its line alone, a press on which run mode places nothing (where it was `drawn`)
	/*
	The link, then its head straight after it -- the stylesheet colours a head by the element before it -- then its leg, then its click
	twin, the whole line. B228 and H15.9 held an update to the same derivation create used, a set-or-remove over the declared keys; one
	description is that derivation, and what the link no longer carries is simply not answered.
	*/
	shapes(link, { model, outlineOf }) {
		const points = pathOf(model, link), d = linkPath(points, link);
		if (!d) return null;
		const head = headOf(model, link, points, outlineOf), look = lookOf(model, link, head);
		const parts = [['', { tag: 'path', attrs: { id: link.id, class: 'link', fill: 'none', d: head ? head.lineD : d, ...look, ...lineOffsetOf(head) } }]];
		if (head) parts.push(['head', { tag: 'path', attrs: headAttrs({ ...head, of: link.id }, 'data-down' in look) }]);
		if (head?.legD) parts.push(['leg', { tag: 'path', attrs: legAttrs({ ...head, of: link.id }, look) }]);   // straight after its head
		parts.push(['hit', { tag: 'path', attrs: { class: 'link-hit', 'data-link': link.id, ...hitOf(d, look) } }]);   // its click area (B268), the whole line
		return parts;
	},
	/*
	A link change can change what its WAYPOINTS are.

	A waypoint's role is derived from the links touching it, so creating, re-routing or closing a
	link makes its terminals and bends draw differently. Only the link's own path was being updated,
	so a waypoint kept whatever ring it was first drawn with.

	Invisible on a fresh load, because every link already exists and the initial render is correct.
	It only showed while AUTHORING -- place a waypoint, link to it, and nothing redrew it. Called from render,
	update AND delete. A NEW link is what turns a lone waypoint into an endpoint, and fixing only
	the update path left that case broken; B218 was the mirror -- a DELETED link leaves its endpoint
	drawing a pad for a link that is gone.

	Re-rendered rather than patched: the role decides fill, radius, stroke width and class together,
	and setting those four from here would be a second copy of the drawing.
	*/
	redraws: (link, { model }) => [link.src, link.dst, ...(link.via || [])].map((id) => model.endpointOf(id)).filter(Boolean).map((w) => ['node', w]),
};

export const LINK_PAINTERS = [LINK_PAINTER];
