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
import { preferredRoute, pipeKey, route } from './pipes.mjs';
import { pipeResolver, pipeDependents, pipeLinkDown, pipeBlockers } from './resolve.mjs';
import { pipeAnchors, keepsOrphan } from './guide.mjs';
import { linkTenant } from './link-reactions.mjs';
import { transitReactions, stopsBlockedOn, stopAtBlockedStop } from './transit.mjs';
import { ANCHOR_KINDS, anchorOf, bareAnchor } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)
import { cutAtBend } from './link-rules.mjs';   // a cut at a bend, its piece's id derived (V-c)
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

function pipeReactions(view, transit = null) {
	return [
		/*
		S-c (H18.13; ruled 2026-10-03, G2) -- A PINNED LINK LAYS THE LEGS IT HAS NO WAY OVER, from any door. In the lab a drag
		lays a link's pipes (network/session.mjs `judge`); a link made through the CLI, REST or a page with no drag judge had
		none, and under the network's routing came up down. So a link with pins -- or a ring, whose closing leg is a leg (P-3) --
		that is made or re-pinned lays a link pipe straight between two consecutive stops wherever NO PIPES JOIN THEM AT ALL,
		the legs judged in order and none reusing a pipe an earlier leg took, as routing judges them (`routeLink`). A plain link
		lays nothing: "Direct links without a key lay no pipe" (2026-09-30).
		Pipes at all, not a way a route may take: where pipes join two stops only through an anchor whose transit is off, the
		link is down by the author's choice (TR-1, TR-3), and laying a pipe round it would overrule that -- measured: the first
		version asked for a way, and matrix row TRN-16 came up where it is ruled down. So a lab drag is untouched: its judge
		has laid every leg it draws. It subsumes F-f's `ring-pipe`, which asked the same question of a closing leg alone.
		In the STRANDED phase, after the stranded pass, so a link that lost a pin and goes whole lays nothing on its way out;
		before the sweep and the join look.
		*/
		{
			id: 'link-legs',
			phase: 'stranded',
			trigger: [{ created: ['link'] }, { changed: { kind: 'link', fields: ['src', 'dst', 'via', 'closed'] } }],
			doc: 'a link with pins, or a ring, made or re-pinned lays a link pipe for each leg between consecutive stops that no pipes join; a plain link lays none (G2, P-3)',
			// it reads what each change is (TG-3): a link standing now, pinned or closed, whose stops changed
			run: ({ doc, matches }, emit) => {
				for (const { kind, before, after, fields } of matches) {
					if (kind !== 'link' || !after || !(after.via?.length || after.closed)) continue;
					if (before && !['src', 'dst', 'via', 'closed'].some((f) => fields.has(f))) continue;
					const stops = [after.src, ...(after.via ?? []), after.dst, ...(after.closed ? [after.src] : [])];
					if (stops.some((id) => !anchorOf(doc, id))) continue;
					const used = new Set();
					for (let i = 0; i < stops.length - 1; i++) {
						const [a, b] = [stops[i], stops[i + 1]];
						if (a === b) continue;
						const open = doc.all('pipe').filter((p) => !used.has(pipeKey(p.a, p.b)));
						const leg = route(open, a, b);   // pipes at all: a leg blocked only by transit stays down (TR-1)
						if (leg) { for (let k = 0; k < leg.length - 1; k++) used.add(pipeKey(leg[k], leg[k + 1])); continue; }
						const laid = doc.get('pipe', pipeId(a, b));
						used.add(pipeKey(a, b));
						if (!laid) emit([{ op: 'put', kind: 'pipe', entity: pipeEntity(a, b, 'link') }]);
					}
				}
			},
		},
		/*
		V-c (H18.27; K18a, B243) -- A NEW LINK LANDING ON ANOTHER LINK'S BEND CUTS THAT LINK THERE, from any door (ruled 2026-09-25,
		"What a link does at a junction", R1: a junction is terminations only). It was the browser's alone (app/src/input.js
		`splitsFor`), so a link drawn to a bend through REST or the CLI left the other link bending through the junction (B243).
		Each end of a link made, that is a waypoint, cuts every link bending there -- re-ended at it, keeping its id, order and
		declarations, its new piece the newest with an id derived from the cut (H17-D10), so the browser's preview and the server
		mint the same (PL-6). A piece is cut again if it still bends at the other end. A ring has no ends, so it lands nowhere.
		Threading a bend leaves it a bend (B211). In the RESHAPE phase, with transit's cut, before the stranded pass and the join.
		*/
		{
			id: 'junction-cut',
			phase: 'reshape',
			// a link made; and (B303) a link re-pinned, which arrives at its new pins as a made one does
			trigger: [{ created: ['link'] }, { changed: { kind: 'link', fields: ['via', 'closed'] } }],
			doc: 'a link made with an end on another link\'s bend cuts that link there: it is re-ended at the bend and keeps its id, order and declarations, and its new piece is the newest, its id derived from the cut (R1, B243, H17-D10); and a link made or re-pinned through a stop whose transit is off is cut there, as a drag pressing w on it is (TR-2b, B303)',
			run: ({ doc, matches }, emit) => {
				for (const { kind, before, after } of matches) {
					if (kind !== 'link' || !after || !doc.get('link', after.id)) continue;
					/*
					B303 (H19.10) -- A LINK ARRIVING PINNED WHERE WHAT ARRIVES STOPS is cut there, from any door: made through REST or the
					CLI with such a pin, or re-pinned onto one. A drag cuts for itself (TR-2b), so what it makes never arrives so pinned.
					In this reaction, beside the landing cut, so one reaction owns every cut of a link at its arrival (PD-3).
					*/
					if (transit) for (const w of stopsBlockedOn(doc.get('link', after.id), doc, transit)) stopAtBlockedStop(doc, w, emit);
					// the landing cut: a link MADE in this edit -- one that existed before is not landing anywhere (TG-3)
					if (before || after.closed) continue;
					for (const end of [after.src, after.dst]) {
						if (!bareAnchor(doc, end)) continue;
						// the links bending there NOW -- a piece an earlier cut made is cut again at the other end
						for (const other of [...doc.all('link')].sort((a, b) => (a.id < b.id ? -1 : 1))) {
							if (other.id === after.id) continue;
							const ops = cutAtBend(doc, other, end);
							if (ops) emit(ops);
						}
					}
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
		links: { owner: tenant.owner, kinds: ['pipe'], ...(transit ? { fields: { node: ['transit'] } } : {}), reactions: [...tenant.reactions, ...(edits?.reactions ?? []), ...pipeReactions(view, transit)], refusals: edits?.refusals ?? [] },
	};
}
