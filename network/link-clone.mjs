/*
WHAT FOLLOWS A CLONE, OF THE NETWORK'S -- C-e, step eight (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5).

A link BOTH of whose ends were cloned is cloned with them, carrying its route: its `via` list and its `closed` flag are authored
geometry, and dropping them would turn a multi-hop route into a straight line silently (B30). A bend not already cloned is pulled
in through the canvas's own anchor cloner, because a cloned route needs its OWN bends -- two links sharing one is refused outright.
The copy is named from the SCRATCH model, so a duplicated subgraph does not collide with names already in it (B187). It ranks 1:
it runs before anything that follows what it pulls in (the groups plugin's group, rank 2). It was the link pass of
app/src/commands.js `cloneSubgraph`.
*/

import { newId } from '../model/model.mjs';
import { bareAnchor } from '../devices/device-shapes.mjs';

export const LINK_FOLLOWER = {
	rank: 1,
	follow: ({ model, scratch, idMap, cloneAnchor, add }) => {
		for (const link of model.all('link')) {
			if (!idMap.has(link.src) || !idMap.has(link.dst) || idMap.has(link.id)) continue;
			const via = Array.isArray(link.via) ? link.via : [];
			for (const wid of via) {
				if (idMap.has(wid)) continue;
				const w = bareAnchor(model, wid);
				if (w) cloneAnchor(w);
			}
			const copy = { id: newId('link', scratch.collection('link')), name: scratch.nextName('link'), src: idMap.get(link.src), dst: idMap.get(link.dst) };
			const mapped = via.map((wid) => idMap.get(wid)).filter(Boolean);
			if (mapped.length) copy.via = mapped;
			if (link.closed) copy.closed = true;
			add('link', copy, link.id);
		}
	},
};
