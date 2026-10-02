/*
THE NETWORK, ATTACHED TO A PAGE -- the plugin's choreography around an edit: when its rules run, and in what order.

The network's RULES were always here, in `network/`; the ORDERING -- judge a drag, lay its pipes once the planner accepts
it, sweep, repaint, say what is down -- was hand-written in the lab's composition root. A plugin's behaviour belongs to the
plugin, as its input rows (network/keys.mjs), its planner reactions (`network.links`) and its colour roles do, and
promotion's stage P5 composes the network on the product page: left in the lab root, that would have been a second copy
of the ordering, the drift K8 removed for the canvas. So a page ATTACHES the network, and these are its hooks:

  judge(drag)                 the drag judge Input asks once per finished drag (network/keys.mjs `networkInput`)
  answered(request, answer, apply)   the page's commit door hands it the planner's answer; true when accepted
  refused(answer)             after the page has taken the planner's document back on a refusal
  seed(pipes, linkIds, run)          a fixed board: its links aged, its pipes handed to the page's `run` as ops for the board's
                                     own commit, then the pipes drawn
  paint()                            draw the pipes now

The page keeps what is its own: where the planner runs (the lab's authority model, production's server), how a refusal
is resynchronised, and the notice it writes to (`say`). The canvas parts come in -- the network layer imports no canvas
code -- with the painter's `el`.
*/
import { whyDown, downSummary } from './resolve.mjs';
import { cutAt, joinAt } from './transit.mjs';
import { pipeAttributes, pipeHitAttributes } from './appearance.mjs';

/*
H17.22 N-d -- IT TAKES THE PAGE'S MODEL AND NO OTHER. It took the lab's in-page planner model too, and read it in three
places: the drag judge's links and transit stops, the sweep, and the ages noted on an answer -- the gap recorded against
promotion's P5, since the product page holds no such model. The sweep is the planner's now; the judge reads the tab, which
holds what the planner holds once an answer is applied, and the ages are noted on the tab `apply` has just brought to it.
*/
export function attachNetwork({ session, model, renderer, selection, history, pipeLayer, el, say }) {
	const { network } = session;

	/*
	PIPES ARE DRAWN, beneath the links routed over them.

	Redrawn whole on every change. The pipe set is small and redrawing it is cheap, and a painter that tried to reconcile
	incrementally would need to know which pipes changed -- a second index over the pipe set, which is exactly the kind of
	second authority this programme exists to remove. How a pipe LOOKS is the plugin's own (network/appearance.mjs),
	applied as attributes: the first painter left colour to the stylesheet's `currentColor`, which inherited black and made
	pipes invisible, and one measured authority in the plugin replaced it.
	*/
	/*
	Each pipe is drawn under its own id, so the canvas's selection reaches it (the renderer marks an id it can find), and a
	repaint keeps it marked. A HAND pipe also gets an invisible hit line naming it (`data-select`), which is how the canvas
	picks a plugin's mark (app/src/pick.js) -- so a hand pipe can be selected and deleted (N6, B281). A pipe laid with a link
	gets none: it follows its links, and is never offered.
	*/
	const paint = () => {
		pipeLayer.replaceChildren();
		const selected = new Set(selection.list());
		for (const { id, a, b, laid } of model.all('pipe')) {   // the tab's pipes, as it holds them (N-c)
			const p = model.endpointOf(a), q = model.endpointOf(b);
			if (!p || !q) continue;   // an anchor the pipe names has gone; the planner removes the pipe in the same edit
			el('line', { id, x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: `pipe pipe-${laid}${selected.has(id) ? ' selected' : ''}`, ...pipeAttributes(laid) }, pipeLayer);
			if (laid === 'hand') el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'pipe-hit', 'data-select': id, ...pipeHitAttributes() }, pipeLayer);
		}
	};
	model.onChange(paint);
	// a selected down link says WHY it is down -- held by a named link, or no way at all (2026-09-30). The selected LOOK is
	// composeCanvas's subscriber, so a page attaches the network AFTER composing the canvas, and that one runs first
	selection.subscribe(() => { const why = whyDown(model, selection.list(), network); if (why) say(why); });

	/*
	SETTLE THE BOARD after its pipes or links change -- ONE step, so every path that changes them takes all of it. A link's
	drawn route depends on the pipe set, which lives outside the model, so the model's change events never announce that a
	new pipe made a way or that a swept one broke one: EVERY link is redrawn here. Whole-board is right for a lab-sized
	board; a targeted redraw belongs with the promotion, when pipes are stored and their changes are events like any other.
	Before this was one step, a g drag laid its pipes and redrew only the pipes, so a link that healed over them stayed
	drawn down until the next edit. It sweeps nothing: since N-c the planner sweeps and prunes pipes in the edit itself.
	*/
	const redraw = () => {
		paint();
		for (const l of model.all('link')) renderer.update('link', l);
		renderer.reflectSelection(selection.list());   // an edit can change who blocks whom
	};
	const settle = (fallback) => {
		redraw();
		say(session.takeNotice() ?? `${fallback}${downSummary(model)}`.trim());   // DOWN is said as well as drawn
	};

	// THE DRAG JUDGE -- how `g`, and the network's rules for a drag, exist; the session judges it (network/session.mjs
	// `judge`), its pipes riding as entries in the commit Input makes. With no commit at all, the board settles now, to say why
	const judge = (drag) => {
		const { verdict, commits } = session.judge(drag, model.all('link'), model);
		if (!commits) settle('');
		return verdict;
	};

	/*
	A TRANSIT CHANGE redraws the anchors it marks, then settles -- which says what the session said (TRANSIT.md section 12).
	It can take links down or heal them (TR-4), so the notice counts what is down after it. At a waypoint it is also an EDIT
	(TR-2): turned off, the links pinned there are cut in two; turned back on, the two left ending there join -- one commit.
	Which, it asks as every rule does: whether what arrives now stops there (`stopsAt`, B278), not what was declared.
	*/
	session.onTransitChange((ids) => {
		for (const id of ids) { const e = model.endpointOf(id); if (e) renderer.render(e.type ? 'node' : 'waypoint', e); }
		const said = session.takeNotice() ?? '';
		const edits = ids.filter((id) => model.get('waypoint', id)).map((id) => (network.stopsAt(id, model) ? cutAt(model, id) : joinAt(model, id))).filter(Boolean);
		if (edits.length) history.commit({ label: 'transit', entries: edits.flatMap((e) => e.entries) });
		const cut = edits.reduce((n, e) => n + (e.cut ?? 0), 0), joined = edits.some((e) => e.label === 'join');
		settle('');
		say(`${said}${cut ? ` -- ${cut} link${cut === 1 ? '' : 's'} cut in two there` : ''}${joined ? ' -- its two links joined again' : ''}${downSummary(model)}`);
	});

	/*
	THE ANSWER -- the page's own reconciliation, `apply`, brings the tab to it, pipes included; then the session notes the
	ages (network/session.mjs `answered`) and the board settles. False when refused: the page takes the planner's document
	back as it resynchronises, and then calls `refused`.
	*/
	const answered = (request, answer, apply) => {
		const accepted = session.answered(answer, model, apply);
		if (accepted) settle(`v${answer.version} ${request.verb ?? request.label ?? ''}`);
		return accepted;
	};
	const refused = (answer) => { settle(''); say(`refused: ${answer.error}`); };

	/*
	A fixed board: its links aged first, so they are routed by age; its pipes go to the page's `run` as ops for the board's
	own commit (N-c); and once it lands the board is drawn again whole -- the commit lists its links before its pipes, so
	each link was drawn before the pipes it runs over existed in the tab. Answers the page's answer.
	*/
	const seed = (boardPipes, linkIds, run) => { const answer = run(session.seed(boardPipes, linkIds)); redraw(); return answer; };

	return { judge, answered, refused, seed, paint };
}
