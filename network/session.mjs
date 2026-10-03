/*
The network SESSION -- step T5 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md, F14).

One object owns the network's state for a session and the order it changes in: the order links were made in, the
transit settings, the one network object built over them and the model's pipes (T1), and the notice a drag set. It held
the pipe set and the legs a drag laid while the planner's answer was awaited until H17.22 N-c moved pipes into the model. Before T5 all of it lived in the lab's composition root, which is wiring (scan-layers L8) and sat
at 178 of its 180 lines. It knows no DOM: the attached network (network/host.mjs) draws pipes and links, and the page
says the notice -- this says what the network did.

PIPES ARE IN THE MODEL (H17.22 N-c). They were this session's set; now they are entities of the network's `pipe` kind
(network/pipe-kind.mjs) in the models the page holds, changed only through the planner: a drag's pipes ride in the drag's
own commit, an anchor's deletion takes its pipes, and the sweep is a planner reaction (network/network.mjs). So undo and
redo move pipes with everything else, and the rule "the sweep is skipped after undo" is gone with the limit it served.
Link ages and transit stay session state until promotion's format batch (N3, TR-7): a reload starts from nothing.

THE ORDER OF ONE EDIT:
  1. `judge` -- the route hook. network/guide.mjs judges a finished drag by the director's rule of 2026-09-30 (any `w`
     makes a link, `g` alone lays pipes, a plain drag makes a link that lays none). What it lays comes back as ENTRIES
     -- pipe puts, or a link pipe made a hand pipe -- which Input adds to the commit the drag makes: the link, its pieces,
     or the anchors a refused drag keeps; with none of those, Input commits the pipes alone. So a refused link's pipes are
     refused with it, and the link is drawn along its pipes from its first frame, both by construction.
  2. `answered` -- the planner's answer. Accepted: the page applies it, and ages are noted AFTER -- a link seen for the
     first time is the newest, and one seen before keeps its age, so undo restores its place.
*/
import { createLinkOrder } from './order.mjs';
import { createNetwork } from './network.mjs';
import { judgeDrag } from './guide.mjs';
import { createTransit } from './transit.mjs';
import { pipeId, pipeEntity } from './pipe-kind.mjs';
import { ANCHOR_KINDS } from '../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)

/*
What a drag's legs change in a model, as entries the canvas's history takes: a pipe new to its pair is put; a link pipe
laid again by hand becomes a hand pipe; anything else -- the same pipe again, or a hand pipe a link lays over, which must
never become disposable -- changes nothing. The rule the session's pipe set held until N-d deleted it.
*/
function pipeEntries(legs, model) {
	const seen = new Set(), out = [];
	for (const { a, b, laid } of legs ?? []) {
		const id = pipeId(a, b);
		if (a === b || seen.has(id)) continue;
		seen.add(id);
		const had = model.get('pipe', id);
		if (!had) out.push({ op: 'put', kind: 'pipe', entity: pipeEntity(a, b, laid) });
		else if (laid === 'hand' && had.laid !== 'hand') out.push({ op: 'set', kind: 'pipe', id, after: { laid: 'hand' } });
	}
	return out;
}

export function createNetworkSession() {
	const order = createLinkOrder(), transit = createTransit();
	const network = createNetwork(order.rankOf, transit);   // it reads the models' own pipes (N-c, N-d)
	const watchers = [];
	let pendingNotice = null;

	return {
		order, network,

		/*
		THE TRANSIT TOGGLE (`x`, TRANSIT.md section 12, X1): flip each selected anchor's transit on its own, and say what
		happened -- the next settle says it. `selected` is plain data from the host: id, kind, type, name. Watchers hear
		which anchors changed, so the composition can redraw them.
		*/
		toggleTransit(selected) {
			const anchors = selected.filter((e) => ANCHOR_KINDS.includes(e.kind));
			if (!anchors.length) return;
			const { flipped, refused } = transit.flip(anchors);
			const said = [];
			if (flipped.length) said.push(`transit ${flipped.map((e) => `${e.transit ? 'on' : 'off'} at ${e.name || e.id}`).join(', ')}`);
			if (refused.length) said.push(`${refused.map((e) => `${e.name || e.id} is a ${e.type}`).join(', ')}, which never passes routes -- its transit stays off`);
			pendingNotice = said.join('; ');
			for (const w of watchers) w(flipped.map((e) => e.id));
		},

		// hear which anchors' transit changed
		onTransitChange(fn) { watchers.push(fn); },

		/*
		The route hook's answer, carrying its pipes as `entries` for the drag's commit, and whether any commit follows --
		none when the drag makes no link, keeps no anchor and lays no pipe, and then nothing reaches the planner.
		*/
		judge(drag, links, model) {
			// in the model the drag is judged against, the anchors no route may pass (TR-1)
			const stops = new Set(transit.blockedIn(model));
			const judged = judgeDrag(model.all('pipe'), drag, { links, rankOf: order.rankOf, passes: (id) => !stops.has(id),
				nameOf: (id) => model.endpointOf(id)?.name || id });   // notices name anchors as the author does
			pendingNotice = judged.notice ?? null;
			const verdict = { ...judged, entries: pipeEntries(judged.legs, model) };
			const commits = verdict.ok || verdict.keep.some((id) => drag.placed.includes(id)) || verdict.entries.length > 0;
			return { verdict, commits };
		},

		// the planner's answer: true when accepted, after `apply` has brought the tab to it
		answered(answer, model, apply) {
			if (!answer.ok) return false;
			apply();
			order.note(model.all('link').map((l) => l.id).sort());   // the model `apply` brought to the answer
			return true;
		},

		// what the last drag said, once
		takeNotice() {
			const notice = pendingNotice; pendingNotice = null;
			return notice;
		},

		/*
		A fixed board: each link as old as it is listed, and each pipe -- with the lifetime its gesture would give it
		(2026-09-29) -- as an op for the board's own commit, so the board's pipes are in the document like an author's.
		*/
		seed(pipeTriples, linkIds) {
			order.note(linkIds);
			return pipeTriples.filter(([a, b]) => a !== b).map(([a, b, laid]) => ({ op: 'put', kind: 'pipe', entity: pipeEntity(a, b, laid) }));
		},
	};
}
