/*
THE NETWORK, ATTACHED TO A PAGE -- the plugin's choreography around an edit: when its rules run, and in what order.

The network's RULES were always here, in `plugins/network/`; the ORDERING -- judge a drag, lay its pipes once the planner accepts
it, sweep, repaint, say what is down -- was hand-written in the lab's composition root. A plugin's behaviour belongs to the
plugin, as its input rows (plugins/network/keys.mjs), its planner reactions (`network.links`) and its colour roles do, and
promotion's stage P5 composes the network on the product page: left in the lab root, that would have been a second copy
of the ordering, the drift K8 removed for the canvas. So a page ATTACHES the network, and these are its hooks:

  judge(drag)                 the drag judge Input asks once per finished drag (plugins/network/keys.mjs `networkInput`)
  answered(request, answer, apply)   the page's commit door hands it the planner's answer; true when accepted
  refused(answer)             after the page has taken the planner's document back on a refusal
  seed(pipes, run)                   a fixed board: its pipes handed to the page's `run` as ops for the board's own commit,
                                     then the board settled; its links are aged by the drawing order the planner stamps (F-d)
  redraw()                           another writer's change, or a snapshot, has changed the board: its links drawn again

The page keeps what is its own: where the planner runs (the lab's authority model, production's server), how a refusal
is resynchronised, and the notice it writes to (`say`). The network layer imports no canvas code.

H26.8's pipes move (dev/design/components/NATIVE-SHAPES.md section 4.6, NS3): the pipes are a painted kind
(plugins/network/pipe-painter.mjs), drawn by the renderer under its one schedule, rule P. The network's own drawer went -- its map of
pipe elements and `paint`, its subscriptions to the model's changes and the mode's, and the pipe repaint in its settle, which keeps
the links' redraw and the reflection -- and with it the page's foreign pipe layer and the hook for a pipe's states.
*/
import { whyDown, downSummary } from './resolve.mjs';
import { transitSummary } from './transit.mjs';
import { kindOf } from '../../model/model.mjs';

/*
H17.22 N-d -- IT TAKES THE PAGE'S MODEL AND NO OTHER. It took the lab's in-page planner model too, and read it in three
places: the drag judge's links and transit stops, the sweep, and the ages noted on an answer -- the gap recorded against
promotion's P5, since the product page holds no such model. The sweep is the planner's now; the judge reads the tab, which
holds what the planner holds once an answer is applied, and the ages are noted on the tab `apply` has just brought to it.
*/
// `edit(label, entries)`: commit an edit the network made as entries -- the canvas's generic builder (D5, C-e step eight)
export function attachNetwork({ session, model, renderer, selection, states = renderer.states, edit, say, pending = () => false }) {
	const { network } = session;

	// a selected down link says WHY it is down -- held by a named link, or no way at all (2026-09-30). The selected LOOK is
	// composeCanvas's subscriber, so a page attaches the network AFTER composing the canvas, and that one runs first
	/*
	B296 -- and says it LAST, after the answer to the edit that selected it. In the lab the planner answers in the page, so an
	edit settles and then Input selects its new link, and the why is the last word. On the product page Input selects it
	while the edit is on the wire (`pending`, the page's outbox), so the why was said first and the answer's count overwrote
	it. A why said while an edit is pending is said again once every answer is in, if the selection still has one.
	*/
	let whyAwaits = false;
	selection.subscribe(() => { const why = whyDown(model, selection.list(), network); if (why) { say(why); if (pending()) whyAwaits = true; } });
	const whyAgain = () => {
		if (!whyAwaits || pending()) return;
		whyAwaits = false;
		const why = whyDown(model, selection.list(), network);
		if (why) say(why);
	};

	/*
	SETTLE THE BOARD after its pipes or links change -- ONE step, so every path that changes them takes all of it. A link's
	drawn route depends on the pipe set, which lives outside the model, so the model's change events never announce that a
	new pipe made a way or that a swept one broke one: EVERY link is redrawn here. Whole-board is right for a lab-sized
	board; a targeted redraw belongs with the promotion, when pipes are stored and their changes are events like any other.
	Before this was one step, a g drag laid its pipes and redrew only the pipes, so a link that healed over them stayed
	drawn down until the next edit. It sweeps nothing: since N-c the planner sweeps and prunes pipes in the edit itself.
	*/
	const redraw = () => {
		// H26.8's pipes move: no pipe repainted here -- the renderer describes each pipe as its model changes (rule P), so a settle
		// redraws the links alone, whose routes read the pipe set, and reflects the selection
		for (const l of model.all('link')) renderer.update('link', l);
		states?.reflect(selection.list());   // an edit can change who blocks whom -- H26.8: the editing states, the renderer's (NS13)
	};
	const settle = (fallback) => {
		redraw();
		say(session.takeNotice() ?? `${fallback}${downSummary(model)}`.trim());   // DOWN is said as well as drawn
	};

	// THE DRAG JUDGE -- how `g`, and the network's rules for a drag, exist; the session judges it (plugins/network/session.mjs
	// `judge`), its pipes riding as entries in the commit Input makes. With no commit at all, the board settles now, to say why
	const judge = (drag) => {
		const { verdict, commits } = session.judge(drag, model.all('link'), model);
		if (!commits) settle('');
		return verdict;
	};

	/*
	A TRANSIT CHANGE is an EDIT (F-e, H18.7): the session hands over the set of each anchor's `transit`, committed here as one
	edit; the planner cuts the links pinned at a waypoint turned off and joins the two left at one turned back on (TR-2), from
	any door. The notice -- what the session said, then how many drawn links were cut into how many pieces and how many pieces
	joined into how many links (2026-10-02), then what is down -- is said when the planner answers, from the answer's ops.
	A toggle that changes nothing (every anchor refused) commits nothing, and settles at once.
	*/
	const pendingTransit = [];
	session.onTransitChange((ids, entries) => {
		const said = session.takeNotice() ?? '';
		if (!entries?.length) { settle(''); say(`${said}${downSummary(model)}`); return; }
		pendingTransit.push(said);
		edit('transit', entries);   // through the canvas's generic builder -- the network builds no command by hand (D5)
		for (const id of ids) { const e = model.endpointOf(id); if (e) renderer.render(kindOf(id), e); }   // the ring, at once
	});
	const transitNotice = (answer) => {
		const said = pendingTransit.shift() ?? '';
		const { cut, joined, opened, closed } = transitSummary(answer.change?.ops ?? answer.ops ?? []);
		const rings = (n, did) => (n ? ` -- ${n} ring${n === 1 ? '' : 's'} ${did}` : '');   // B299
		say(`${said}${rings(opened, 'opened')}${cut ? ` -- ${cut.links} link${cut.links === 1 ? '' : 's'} cut into ${cut.pieces} pieces` : ''}${joined ? ` -- ${joined.pieces} pieces joined into ${joined.links} link${joined.links === 1 ? '' : 's'}` : ''}${rings(closed, 'closed again')}${downSummary(model)}`);
	};

	/*
	THE ANSWER -- the page's own reconciliation, `apply`, brings the tab to it, pipes included; then the session notes the
	ages (plugins/network/session.mjs `answered`) and the board settles. False when refused: the page takes the planner's document
	back as it resynchronises, and then calls `refused`.
	*/
	const answered = (request, answer, apply) => {
		const accepted = session.answered(answer, model, apply);
		if (accepted) settled(request, answer);
		if (!accepted && request.label === 'transit') pendingTransit.shift();
		return accepted;
	};
	/*
	AN ACCEPTED ANSWER THE PAGE HAS ALREADY APPLIED (V-b, H18.26): the product page's Sync applies its answers itself
	(app/src/sync.js `applyAck`), then hands them here -- the board settles and says so, as `answered` does in the lab.
	*/
	const settled = (request, answer) => {
		settle(`v${answer.version ?? '?'} ${request.verb ?? request.label ?? ''}`);
		if (request.label === 'transit' && pendingTransit.length > 0) transitNotice(answer);   // the transit edit's own notice (F-e)
		whyAgain();   // B296
	};
	const refused = (answer) => { settle(''); say(`refused: ${answer.error}`); whyAwaits = false; };

	/*
	A fixed board: its pipes go to the page's `run` as ops for the board's own commit (N-c), and its links are aged by the
	drawing order the planner stamps on them, in the order the board lists them (F-d); and once it lands its links are drawn again -- the commit lists its links before its
	pipes, so each link was drawn before the pipes it runs over existed in the tab. Answers the page's answer.
	*/
	const seed = (boardPipes, run) => { const answer = run(session.seed(boardPipes)); redraw(); return answer; };

	// another writer's change, or a snapshot, has changed the board: redraw it, saying nothing (V-b)
	return { judge, answered, settled, refused, redraw, seed };
}
