/*
THE NETWORK'S LINK PAINTER -- C-a, step four (H19.29; dev/design/unification/CANVAS-PLUGINS.md, D1): how a link is drawn on the
page.

A link is a path along where the network draws it -- its route, or a down link's intent (`pathOf`) -- rounded at its bends
(the kernel's `roundedPath`), with the look the network derives in one call (`linkAppearance`: its weight, its dash, its head,
whether it is down), and an invisible twin just after it taking its clicks (B268). Stacked by drawing order (F-d). A link's
put, set or delete re-derives the waypoints at its ends and bends, since their roles are read from the links meeting them
(B218). It was the renderer's own branch (app/src/renderer.js `draw`, `update`, `linkPath`, `linkAppearanceOf`, `hitTwinOf`,
`refreshWaypointsOf`); the elements and every attribute are what the renderer built -- the K8 DOM corpus holds that.
*/

import { STD, BEND_R } from '../kernel/spec.mjs';
import { roundedPath } from '../kernel/router.mjs';
import { linkAppearance, APPEARANCE_KEYS, downStroke, NETWORK_TOKENS } from './appearance.mjs';
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
H24.6 (B356) -- ITS HEAD, a shape of its own (network/link-head.mjs): at the end the flow arrives at, its tip on that anchor's
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
element it follows (`.link.selected + .link-head` and the down and blocking rules, all in network/network.css since H25.1), and these attributes
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
const LEG_OPTIONAL = ['stroke-dasharray', 'stroke-dashoffset', 'data-down'];   // what a leg may stop carrying, removed on update
// its click twin, found by the link it stands for (B268); its head and its leg, likewise
const twinOf = (id, layer) => [...layer.querySelectorAll('.link-hit')].find((t) => t.getAttribute('data-link') === id) ?? null;
const headElOf = (id, layer) => [...layer.querySelectorAll('.link-head')].find((t) => t.getAttribute('data-head-of') === id) ?? null;
const legElOf = (id, layer) => [...layer.querySelectorAll('.link-leg')].find((t) => t.getAttribute('data-leg-of') === id) ?? null;
// a ring's one piece starts inside its head's tip, so its dash pattern is started there (no other line states an offset)
const lineOffsetOf = (head) => (head && head.lineOffset ? { 'stroke-dashoffset': head.lineOffset } : {});

const LINK_PAINTER = {
	kind: 'link',
	layer: 'links',
	stacked: true,
	// C-b: the path itself, and its click twin wherever a dotted or dashed stroke has a gap (B268)
	picks: [{ self: 'link', word: 'link', clones: true }, { self: 'link-hit', word: 'link', id: (t) => t.dataset.link, clones: true }],   // D4: Ctrl+left clones it
	// the link, then its head straight after it -- the stylesheet colours a head by the element before it -- then its click twin
	create(link, { el, layer, model, outlineOf }) {
		const points = pathOf(model, link), d = linkPath(points, link);
		if (!d) return null;
		const head = headOf(model, link, points, outlineOf), look = lookOf(model, link, head);
		const path = el('path', { id: link.id, class: 'link', fill: 'none', d: head ? head.lineD : d, ...look, ...lineOffsetOf(head) }, layer);
		if (head) el('path', headAttrs({ ...head, of: link.id }, 'data-down' in look), layer);
		if (head?.legD) el('path', legAttrs({ ...head, of: link.id }, look), layer);   // straight after its head
		el('path', { class: 'link-hit', 'data-link': link.id, ...hitOf(d, look) }, layer);   // its click area (B268), the whole line
		return path;
	},
	update(link, dom, { el, setAttrs, layer, model, outlineOf }) {
		const points = pathOf(model, link), d = linkPath(points, link);
		const head = d ? headOf(model, link, points, outlineOf) : null;
		if (d) setAttrs(dom, { d: head ? head.lineD : d });
		/*
		B228 -- THE MARKER IS PART OF THE LINK, so an update must re-derive it.

		`render` set it and `update` set only `d`, so the first press of `f` drew an arrow and
		every press afterwards changed the document and nothing else: the element already
		existed, so it never went back through `render`.

		Set-or-remove rather than set-if-present. Clearing a declaration has to REMOVE the
		attribute, and an update that only ever adds would strand the last head on a link the
		author has since made symmetric.

		B218 was this shape one branch over -- create and update refreshed a waypoint's role and
		delete did not. A rule wired into one branch of `handle` is wired into none of the others.
		*/
		/*
		H15.9 -- the SAME derivation create uses, applied as set-or-remove over the declared
		key set. B228 was an update that set some of these and forgot others; there is now no
		list to forget, because `APPEARANCE_KEYS` is what the derivation itself declares.
		*/
		const want = lookOf(model, link, head);
		for (const attr of APPEARANCE_KEYS) {
			if (attr in want) dom.setAttribute(attr, want[attr]);
			else dom.removeAttribute(attr);
		}
		if (head?.lineOffset) dom.setAttribute('stroke-dashoffset', head.lineOffset); else dom.removeAttribute('stroke-dashoffset');
		const twin = twinOf(link.id, layer);
		if (twin && d) setAttrs(twin, hitOf(d, want));
		/*
		H24.6 -- THE HEAD IS PART OF THE LINK, as the marker was (B228): an update makes it, moves it or takes it away, by the same
		derivation create uses. A new one goes straight after the link, before its twin, where create puts it.
		*/
		const had = headElOf(link.id, layer);
		if (head) {
			const attrs = headAttrs({ ...head, of: link.id }, 'data-down' in want);
			if (had) { setAttrs(had, attrs); if (!('data-down' in attrs)) had.removeAttribute('data-down'); }
			else layer.insertBefore(el('path', attrs, layer), twin);
		} else if (had) had.remove();
		// and its leg, likewise: made, changed or taken away, and a new one put between the head and the twin, where create puts it
		const leg = legElOf(link.id, layer);
		if (head?.legD) {
			const attrs = legAttrs({ ...head, of: link.id }, want);
			if (leg) { setAttrs(leg, attrs); for (const k of LEG_OPTIONAL) if (!(k in attrs)) leg.removeAttribute(k); }
			else layer.insertBefore(el('path', attrs, layer), twin);
		} else if (leg) leg.remove();
		return undefined;
	},
	// the elements drawn with it, moved and removed with it -- its head, its leg, then its click twin -- and the link an element stands for
	companions: (id, layer) => [headElOf(id, layer), legElOf(id, layer), twinOf(id, layer)].filter(Boolean),
	ownerOf: (element) => element.getAttribute('data-link') ?? element.getAttribute('data-head-of') ?? element.getAttribute('data-leg-of'),
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
