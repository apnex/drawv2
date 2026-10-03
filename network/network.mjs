/*
The network plugin, as ONE object -- step T1 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md).

The Model asks the network four questions while drawing (`pathOf`, `linksRoutedThrough`, `isLinkDown`, `blockersOf`) and
two about transit (`declaresNoTransit`, what the ring marks; `stopsAt`, what every rule asks -- B278), declared in model/model.mjs, which refuses a network missing any. The planner asks it NOTHING (PL-3): the network brings
its own LINK TENANT, `links`, the reactions the planner runs when an edit touches links -- the waypoint and node
cascades it shares with production, and its own stranded pass, sweep and join, each with the network's conditions
inside (they were four hooks, `alsoReferenced`, `keepsOrphan`, `isStranded` and `joinsAt`, until PL-3). The lab hands
this one object to its Model, and its `links` to the planner.

Every answer reads the one derivation per board state (network/view.mjs, T2), except the stranded pass, which needs
none: a pinned link lives and dies with its pins (ruled 2026-09-30), so a link that lost a pin is deleted whatever ways
remain.

`view` rides along for the one caller that is not a product consumer: the lab's sweep of pipes no link runs over.
*/
import { createNetworkView } from './view.mjs';
import { preferredRoute, pipeKey } from './pipes.mjs';
import { pipeResolver, pipeDependents, pipeLinkDown, pipeBlockers } from './resolve.mjs';
import { pipeAnchors, keepsOrphan } from './guide.mjs';
import { linkTenant } from '../model/link-reactions.mjs';
import { transitReactions } from './transit.mjs';
import { ANCHOR_KINDS, anchorOf } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)
import { pipeId, pipeEntity } from './pipe-kind.mjs';

/*
H17.22 N-b -- THE PIPES' OWN REACTIONS, where the model holds pipes (the network's `pipe` kind, network/pipe-kind.mjs):

  pipe-cascade  an anchor deleted takes every pipe that ends at it -- a pipe is its pair (SD7), hand pipes included
  pipe-sweep    after the edit, every pipe laid with a link that no link then runs over goes; hand pipes stay (ruled
                2026-09-27) -- the session's sweep, judged on the same derivation (`view.inUse`, which keeps a down
                link's own legs). In the JOIN phase, after the join, because the session swept once the whole commit
                had landed, and a join can change a route.

A pipe change is therefore an op in the transaction that causes it, and undo restores pipes by replaying it. The tenant
declares the kind it needs (`kinds: ['pipe']`), so a planner composed without it refuses the network outright (N-d) --
the session's pipe set, and the guard that let these run over a model with no pipes, are gone.
*/
const endsAt = (pipe, id) => pipe.a === id || pipe.b === id;

function pipeReactions(view) {
	return [
		/*
		F-f (H18.8; P-3) -- A RING LAYS ITS CLOSING PIPE. Closing a link (`c`, or a link made closed) adds a leg from its dst
		back to its src, routed like any leg (network/pipes.mjs `stopsOf`); with no pipe there the ring would be down, so the
		pipe is laid with it, as a drag lays a link's legs -- a link pipe, swept when the ring is opened and nothing runs over
		it. In the reshape phase, before the stranded pass, the sweep and the join look.
		*/
		{
			id: 'ring-pipe',
			phase: 'reshape',
			trigger: [{ created: ['link'] }, { changed: { kind: 'link', fields: ['closed', 'src', 'dst'] } }],
			doc: 'a link closed into a ring lays a link pipe from its end back to its start, where none joins them: its closing leg is routed like any leg (P-3)',
			// it reads what each change is (TG-3): a link that is closed now, and whose closing pair no pipe joins
			run: ({ doc, matches }, emit) => {
				for (const { kind, after } of matches) {
					if (kind !== 'link' || !after?.closed || after.src === after.dst) continue;
					if (!doc.get('pipe', pipeId(after.src, after.dst)) && anchorOf(doc, after.src) && anchorOf(doc, after.dst)) emit([{ op: 'put', kind: 'pipe', entity: pipeEntity(after.src, after.dst, 'link') }]);
				}
			},
		},
		{
			id: 'pipe-cascade',
			phase: 'clear',
			doc: 'an anchor deleted takes every pipe that ends at it, hand pipes included: a pipe is its pair (SD7)',
			trigger: { deleted: [...ANCHOR_KINDS] },   // the anchor kinds
			run: ({ op, doc }, emit) => emit(doc.all('pipe').filter((p) => endsAt(p, op.id)).map((p) => ({ op: 'del', kind: 'pipe', id: p.id }))),
		},
		{
			id: 'pipe-sweep',
			phase: 'join',
			// anything that can move a route: a link made, deleted, re-ended or re-pinned; a pipe made, deleted or re-laid -- a new
			// hand pipe can shorten a route and leave a link pipe unused (TG-D3: judged over the whole board)
			trigger: [{ deleted: ['link', 'pipe'] }, { created: ['link', 'pipe'] }, { changed: { kind: 'link', fields: ['src', 'dst', 'via', 'closed'] } }, { changed: { kind: 'pipe', fields: ['laid'] } }],
			doc: 'after the edit and its join, a pipe laid with a link that no link runs over goes; hand pipes stay (ruled 2026-09-27)',
			run: ({ doc }, emit) => {
				const used = new Set();
				for (const r of view.of(doc).inUse()) for (let i = 0; i < r.length - 1; i++) used.add(pipeKey(r[i], r[i + 1]));
				emit(doc.all('pipe').filter((p) => p.laid === 'link' && !used.has(pipeKey(p.a, p.b))).map((p) => ({ op: 'del', kind: 'pipe', id: p.id })));
			},
		},
	];
}

/*
H17.22 N-d -- THE NETWORK READS THE MODEL IT IS ASKED ABOUT: its pipes are that model's `pipe` entities, always. It took
a pipe source while the lab still kept pipes in the session; that source, and the session's set, are deleted.
*/
export function createNetwork(transit = null) {
	// each model's links aged by their own stored drawing order (network/view.mjs `ageIn`, F-d)
	const view = createNetworkView((model) => model.all('pipe'), null, transit);
	const edits = transit ? transitReactions(transit) : null;   // transit's own reactions and refusal (F-e)
	/*
	The network's LINK TENANT (PL-3, PD-2), in place of production's classic one, with the pipes' own reactions after it.
	Each condition is judged against the model the planner hands over, so only pipes that survive the edit count.
	*/
	const tenant = linkTenant({
		owner: 'network links',
		// a pinned link lives and dies with its pins (ruled 2026-09-30)
		stranded: true,
		// pipes reference anchors too, and nothing deliberate is kept beyond them (ruled 2026-09-29)
		alsoReferenced: (model) => pipeAnchors(view, model),
		keepsOrphan,
		// two links left at a waypoint join only where what arrives may pass on -- not where transit is off (TR-5)
		joinsAt: (waypointId, model) => !transit?.stopsAt(waypointId, model),
		// and turning a waypoint's transit back on wakes the join there (TR-2, F-e)
		joinWakesAt: transit ? ['transit'] : [],
		says: { sweep: 'the pipes that survive the edit reference anchors too, and nothing else is kept (ruled 2026-09-29)', join: 'only where the waypoint\'s transit is on (TR-5)' },
	});
	return {
		view,
		// the Model's four drawing questions
		pathOf: pipeResolver(view),
		linksRoutedThrough: pipeDependents(view),
		isLinkDown: pipeLinkDown(view),
		blockersOf: pipeBlockers(view),
		// what the author declared about transit, as the anchor stores it (F-e, TRANSIT.md section 12) -- what the ring marks
		declaresNoTransit: (id, model) => !!transit?.declaredOff(id, model),
		// whether what arrives at an anchor stops there (B278): the one transit question every rule asks -- routing keys on the
		// same rule as a set (network/view.mjs), the join refusal below, the toggle's cut, the roles; without transit, nothing stops
		stopsAt: (id, model) => !!transit?.stopsAt(id, model),
		/*
		Why transit keeps a down link from a way -- what a selected down link says (TR-1). `declared`: the anchors whose
		transit the author turned off, any ONE of which turned back on would give the link a way -- what the author can do.
		`types`: when none would, the anchors on the way it would otherwise take whose type never passes a route.
		*/
		transitBlocking(link, model) {
			const { pipes, passes } = view.of(model);
			const declared = (transit ? transit.blockedIn(model) : []).filter((id) => transit.declaredOff(id, model)
				&& preferredRoute(pipes, link, (x) => x === id || passes(x)));
			if (declared.length) return { declared, types: [] };
			const way = preferredRoute(pipes, link);
			return { declared: [], types: way ? way.slice(1, -1).filter((id) => !passes(id)) : [] };
		},
		// the link tenant, the pipes' reactions after its own (N-b)
		// and transit's cut and its refusal of a value a type does not offer (F-e)
		links: { owner: tenant.owner, kinds: ['pipe'], reactions: [...tenant.reactions, ...(edits?.reactions ?? []), ...pipeReactions(view)], refusals: edits?.refusals ?? [] },
	};
}
