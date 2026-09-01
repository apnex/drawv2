/*
routes.mjs — a MODEL's links, in the KERNEL's vocabulary.

One concern: the translation, and only the translation. `model/` and `kernel/` are sovereign
siblings and `model/` imports the kernel nowhere, so neither of them can own this -- it belongs to
the layer that already depends on both.

The two speak different names for the same facts:

	model   src      dst    via    closed
	kernel  from     to     via    close

That is a mapping of four words, which is exactly the size of thing that gets rewritten at each call
site and then diverges at one of them. It was already written twice -- `app/src/renderer.js` mapped
it inline to derive a role, and `engine/situation.mjs` needed the same mapping for the same reason.
The second one is what made it a twin rather than a detail, so it is stated once here.

Getting it wrong is silent, which is the argument for a named home rather than care. `close` and
`closed` differ by one letter and a wrong guess does not throw: it yields `undefined`, which is
falsy, so a closed ring quietly reports ENDS. Nothing fails; the drawing is simply wrong.
*/

import { waypointRole } from '../kernel/index.mjs';

// the kernel-shaped view of one model link
export const asRoute = (link) => ({
	from: link.src,
	to: link.dst,
	via: link.via || [],
	close: !!link.closed,
});

/*
The role a waypoint plays among these model links: `endpoint` where it terminates an open path,
`bend` where it turns one, and `bend` again on a closed ring because a ring has no ends.

The rule itself stays in the kernel (B162) -- this adds the vocabulary and nothing else, so there is
still exactly one place that decides what a role IS.
*/
export const roleOf = (id, links) => waypointRole(id, (links || []).map(asRoute));
