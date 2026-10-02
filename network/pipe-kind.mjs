/*
THE PIPE KIND -- the network plugin's own kind, a row of the one shape every kind takes (H17.22 N-b; ruled 2026-10-02:
"Plugins bring their own kinds", N1; N2, N5, N6).

A pipe joins two anchors. It is stored as `{ id, a, b, laid }`:

  id     `pipe-<lowerhex>-<higherhex>` -- the 6-hex parts of its two anchors' ids, lower first, since a pipe has no
         direction (N2). Every peer, the browser and the planner mint the same id for the same pair, so one pipe per pair
         is a property of the id, and an anchor restored by undo restores the same pipe id. It needs anchor hex to be
         unique across the anchor kinds, which the Model's `freshId` keeps (N-a).
  a, b   the two anchors' full ids, `a` the lower hex. Kept beside the id because readers want the ids, not the hex; an
         anchor's id never changes, so the two cannot drift, and the row refuses an id that does not match them.
  laid   `link` -- laid with a link, swept once no link needs it -- or `hand`, laid by `g`, kept until the author deletes
         it (ruled 2026-09-27). A pipe laid with a link and then laid by hand becomes a hand pipe; the reverse never
         happens, or deleting a link would remove geometry the author chose (the session's `pipeEntries`; this row refuses it).

Not named (N5): most pipes are laid by the system, so a name would record no intent. Selectable (N6): the canvas offers
only hand pipes, by its picking; another door may delete any pipe by id.
*/

const ANCHOR = /^(node|waypoint)-[0-9a-f]{6}$/;
const hexOf = (anchorId) => anchorId.slice(anchorId.indexOf('-') + 1);

// the id of the pipe joining two anchors, in either order
export const pipeId = (x, y) => {
	const [lo, hi] = [hexOf(x), hexOf(y)].sort();
	return `pipe-${lo}-${hi}`;
};

// a pipe entity from its two ends, `a` the lower hex
export const pipeEntity = (x, y, laid) => {
	const [a, b] = hexOf(x) < hexOf(y) ? [x, y] : [y, x];
	return { id: pipeId(a, b), a, b, laid };
};

/*
The judgement: twice the link cap. A link's route crosses several pipes, and a pipe belongs to one pair of anchors, so a
document holds more pipes than links; nothing measured sets it more closely.
*/
const PIPE_CAP = 4000;

export const PIPE_ROW = {
	kind: 'pipe', owner: 'the network', collection: 'pipes',
	selectable: true, named: false, anchor: false,
	composite: [], optional: [], references: ['node', 'waypoint'],
	fields: {
		id: (v) => typeof v === 'string' && /^pipe-[0-9a-f]{6}-[0-9a-f]{6}$/.test(v),
		a: (v) => typeof v === 'string' && ANCHOR.test(v),
		b: (v) => typeof v === 'string' && ANCHOR.test(v),
		laid: (v) => v === 'link' || v === 'hand',
	},
	/*
	Its cross-entity check, on the pipe as it would stand: both ends exist, they are stored lower hex first and are two
	anchors, not one; the id is the one its ends make; and a hand pipe never becomes a link pipe.
	*/
	refers: (pipe, access, patch, before) => {
		for (const end of [pipe.a, pipe.b]) if (!access.has('node', end) && !access.has('waypoint', end)) return `pipe end does not exist: ${end}`;
		if (!(hexOf(pipe.a) < hexOf(pipe.b))) return `pipe ends are stored lower hex first, and are two anchors: ${pipe.a}, ${pipe.b}`;
		if (pipe.id !== pipeId(pipe.a, pipe.b)) return `pipe id ${pipe.id} is not the one its ends make, ${pipeId(pipe.a, pipe.b)}`;
		if (before?.laid === 'hand' && pipe.laid === 'link') return `a pipe laid by hand stays a hand pipe: ${pipe.id}`;
		return null;
	},
	cap: PIPE_CAP,
};
