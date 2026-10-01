/*
The network SESSION -- step T5 of the ruleset audit (dev/design/unification/RULESET-AUDIT.md, F14).

One object owns the network's state for a session and the order it changes in: the pipe set, the order links were made
in, the one network object built over both (T1), the legs a drag lays while the planner's answer is awaited, and the
notice that drag set. Before T5 all of it lived in the lab's composition root, which is wiring (scan-layers L8) and sat
at 178 of its 180 lines. It knows no DOM: the root still draws pipes and links and says the notice -- this says what
the network did.

SESSION STATE, NOT STORED. Pipes and ages are not in the document yet -- that is the one format batch, last (F6) -- so a
reload starts from nothing, which is correct rather than missing. For the same reason undo and redo cannot move pipes,
and the sweep is skipped after them: sweeping after an undo would leave the redone link with no pipes. A stated limit
of session pipes, not a rule.

THE ORDER OF ONE EDIT, which is the reason this is one object:
  1. `judge` -- the route hook. network/guide.mjs judges a finished drag by the director's rule of 2026-09-30 (any `w`
     makes a link, `g` alone lays pipes, a plain drag makes a link that lays none). What it lays WAITS for the planner
     to accept what it belongs to -- the link, or the anchors it keeps -- so a refused link leaves no pipes behind. With
     nothing to commit, it lays at once. The ordering holds because a route commit is emitted the moment it is made
     (`commands.routeLink` never sets `coalesce`), so the answer follows the hook and consumes exactly these legs.
  2. `answered` -- the planner's answer. Accepted: the legs are laid BEFORE the tab applies it, so the link is drawn
     along them from its first frame, and ages are noted AFTER -- a link seen for the first time is the newest, and one
     seen before keeps its age, so undo restores its place. Refused: the legs are dropped.
  3. `tidy` -- a pipe to an anchor the authority lost is not a pipe (SD7), and pipes laid WITH A LINK go once no link
     runs over them (ruled 2026-09-27), judged on the routes as drawn: one derivation (B257, T2).
*/
import { createPipeSet } from './pipeset.mjs';
import { createLinkOrder } from './order.mjs';
import { createNetwork } from './network.mjs';
import { judgeDrag } from './guide.mjs';
import { createTransit } from './transit.mjs';

export function createNetworkSession() {
	const pipes = createPipeSet(), order = createLinkOrder(), transit = createTransit();
	const network = createNetwork(pipes, order.rankOf, transit);
	const watchers = [];
	let pendingLegs = null, pendingNotice = null;
	const lay = (legs) => { for (const { a, b, laid } of legs ?? []) pipes.lay(a, b, laid); };

	return {
		pipes, order, network,

		/*
		THE TRANSIT TOGGLE (`x`, TRANSIT.md section 12, X1): flip each selected anchor's transit on its own, and say what
		happened -- the next settle says it. `selected` is plain data from the host: id, kind, type, name. Watchers hear
		which anchors changed, so the composition can redraw them.
		*/
		toggleTransit(selected) {
			const anchors = selected.filter((e) => e.kind === 'node' || e.kind === 'waypoint');
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

		// the route hook's answer, and whether a commit follows it -- with none, the legs were laid already
		judge(drag, links) {
			const verdict = judgeDrag(pipes.list(), drag, { links, rankOf: order.rankOf });
			pendingNotice = verdict.notice ?? null;
			const commits = verdict.ok || verdict.keep.some((id) => drag.placed.includes(id));
			if (commits) pendingLegs = verdict.legs;
			else lay(verdict.legs);
			return { verdict, commits };
		},

		// the planner's answer: true when accepted, after `apply` has brought the tab to it
		answered(answer, authority, apply) {
			const legs = pendingLegs; pendingLegs = null;
			if (!answer.ok) return false;
			lay(legs);
			apply();
			order.note(authority.all('link').map((l) => l.id).sort());
			return true;
		},

		tidy(authority, { sweep }) {
			pipes.prune((id) => !!(authority.get('node', id) || authority.get('waypoint', id)));
			if (sweep) pipes.sweep(network.view.of(authority).inUse());
		},

		// what the last drag said, once
		takeNotice() {
			const notice = pendingNotice; pendingNotice = null;
			return notice;
		},

		// a fixed board: each pipe with the lifetime its gesture would give it (2026-09-29), each link as old as it is listed
		seed(pipeTriples, linkIds) {
			for (const [a, b, laid] of pipeTriples) pipes.lay(a, b, laid);
			order.note(linkIds);
		},
	};
}
