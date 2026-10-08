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
import { bareAnchor } from '../devices/device-shapes.mjs';
import { linkAppearance, APPEARANCE_KEYS } from './appearance.mjs';
import { pathOf, isLinkDown } from './network-queries.mjs';

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
const linkPath = (model, link) => { const path = pathOf(model, link); return path && roundedPath(path, BEND_R, !!link.closed); };
// how a link looks: the ONE derivation (H15.9), fed whether it is down, which only the network knows
const lookOf = (model, link) => linkAppearance(link, LINK_W, { down: isLinkDown(model, link) });
// its click twin, found by the link it stands for (B268)
const twinOf = (id, layer) => [...layer.querySelectorAll('.link-hit')].find((t) => t.getAttribute('data-link') === id) ?? null;

const LINK_PAINTER = {
	kind: 'link',
	layer: 'links',
	stacked: true,
	// C-b: the path itself, and its click twin wherever a dotted or dashed stroke has a gap (B268)
	picks: [{ self: 'link', word: 'link' }, { self: 'link-hit', word: 'link', id: (t) => t.dataset.link }],
	create(link, { el, layer, model }) {
		const d = linkPath(model, link);
		if (!d) return null;
		const look = lookOf(model, link);
		const path = el('path', { id: link.id, class: 'link', fill: 'none', d, ...look }, layer);
		el('path', { class: 'link-hit', 'data-link': link.id, ...hitOf(d, look) }, layer);   // its click area (B268)
		return path;
	},
	update(link, dom, { setAttrs, layer, model }) {
		const d = linkPath(model, link);
		if (d) setAttrs(dom, { d });
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
		const want = lookOf(model, link);
		for (const attr of APPEARANCE_KEYS) {
			if (attr in want) dom.setAttribute(attr, want[attr]);
			else dom.removeAttribute(attr);
		}
		const twin = twinOf(link.id, layer);
		if (twin) setAttrs(twin, hitOf(dom.getAttribute('d'), want));
		return undefined;
	},
	// the elements drawn with it, moved and removed with it -- its click twin -- and the link an element in its layer stands for
	companions: (id, layer) => [twinOf(id, layer)].filter(Boolean),
	ownerOf: (element) => element.getAttribute('data-link'),
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
	redraws: (link, { model }) => [link.src, link.dst, ...(link.via || [])].map((id) => bareAnchor(model, id)).filter(Boolean).map((w) => ['node', w]),
};

export const LINK_PAINTERS = [LINK_PAINTER];
