/*
spawners.mjs — a DOCUMENT's armed endpoints, described for the simulation.

The adapter between what is stored and what `moversAt` consumes: which waypoints are armed, which
link each emits along, and in which direction.

IT LIVES HERE BECAUSE IT NEVER NEEDED A BROWSER. It was written as a method on the presentation
layer and reads nothing but the model -- zero references to a DOM, a renderer or an element. That
placement made it unreachable from anywhere except a browser tab, which is why a report of "one
spawner is not animating" could not be investigated without asking the director to open a console
and read numbers back. That is the A5 fault this file exists to close: the human was acting as the
agent's eyes for a fact the system already knew.

Now the browser, the server and `draw movers` all derive spawners from the SAME function, so the
answer to "what should be moving right now" is one answer rather than three that can disagree.

DIRECTION IS DERIVED, not stored. Arm the `src` end and movers run src to dst; arm `dst` and the
route is reversed. A stored direction would be a twin of the link and wrong the first time one was
reversed.
*/

import { prepareSpawner } from './movers.mjs';
import { BEND_R } from '../kernel/index.mjs';

/*
`model` is anything answering `all('waypoint')`, `linksAt(id)` and `pathOf(link)` -- the live client
Model, or a Model built from a stored document on the server. Passing the shape rather than the
class is what lets both peers call this without either becoming the other.
*/
export function spawnersOf(model) {
	const out = [];
	for (const wp of model.all('waypoint')) {
		if (!wp.spawn) continue;
		const links = model.linksAt?.(wp.id) || [];
		const link = links.find((l) => (l.src === wp.id || l.dst === wp.id) && !l.closed);
		if (!link) continue;                       // a ring has no ends, so it emits nothing
		const pts = model.pathOf(link);
		if (!pts || pts.length < 2) continue;      // a dangling route resolves to nothing
		out.push(prepareSpawner({
			id: wp.id,
			link: link.id,
			pts: link.src === wp.id ? pts : [...pts].reverse(),
			closed: false,
			radius: BEND_R,
			...wp.spawn,
		}));
	}
	return out;
}
