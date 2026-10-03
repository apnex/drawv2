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
import { transitEdit } from './transit.mjs';
import { pipeAttributes, pipeHitAttributes } from './appearance.mjs';
import { pipeId } from './pipe-kind.mjs';
import { kindOf } from '../model/model.mjs';

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

	ONE ELEMENT PER PIPE, made when the pipe first appears and kept until the pipe is deleted (the director, 2026-10-02: "the
	DOM doesnt change, but just marks pipes not visible / hidden"). Each paint reads every pipe from the model and reconciles
	the elements against it -- creates the new, removes the gone, and updates every kept one's ends, class and visibility --
	so the model stays the one authority and nothing tracks which pipes changed. What is kept is only the elements, by id,
	as the canvas renderer keeps its own. It was redrawn whole on every change until then. Elements leaving the DOM only with
	their pipe is also what an infinite canvas needs, to unload what is out of view (B289).

	Each pipe is a group, `.pipe-of`: its visible line, under the pipe's own id so the canvas's selection reaches it (the
	renderer marks an id it can find); and for a HAND pipe an invisible hit line naming it (`data-select`), how the canvas
	picks a plugin's mark (app/src/pick.js) -- so a hand pipe can be selected and deleted (N6, B281). A pipe laid with a link
	gets none: it follows its links, and is never offered.

	A PIPE A LINK RUNS OVER IS HIDDEN, not removed (the director, 2026-10-02): the link is drawn along it. Its group is marked
	`under`, which network/network.css hides, line and hit line alike. What counts is read off the network's one derivation
	for this board (cached, network/view.mjs): an UP link's route. A down link is drawn along its intent, not its legs, so
	its own pipes stay shown -- the way it would heal onto. How a pipe LOOKS is the plugin's own (network/appearance.mjs),
	applied as attributes: the first painter left colour to `currentColor`, which inherited black and made pipes invisible.
	*/
	const occupied = () => {
		const view = network.view.of(model), on = new Set();
		for (const l of model.all('link')) {
			const r = view.route(l.id);
			if (r) for (let i = 0; i < r.length - 1; i++) on.add(pipeId(r[i], r[i + 1]));
		}
		return on;
	};
	const drawn = new Map();   // pipe id -> { group, line, hit, laid }: the elements, never a second record of the pipes
	const setEnds = (node, p, q) => { for (const [k, v] of [['x1', p.x], ['y1', p.y], ['x2', q.x], ['y2', q.y]]) node.setAttribute(k, v); };
	const make = (id, laid) => {
		const group = el('g', { class: 'pipe-of', 'data-pipe': id }, pipeLayer);
		const line = el('line', { id, ...pipeAttributes(laid) }, group);
		const hit = laid === 'hand' ? el('line', { class: 'pipe-hit', 'data-select': id, ...pipeHitAttributes() }, group) : null;
		return { group, line, hit, laid };
	};
	const paint = () => {
		const selected = new Set(selection.list()), under = occupied(), live = new Set();
		for (const { id, a, b, laid } of model.all('pipe')) {   // the tab's pipes, as it holds them (N-c)
			const p = model.endpointOf(a), q = model.endpointOf(b);
			if (!p || !q) continue;   // an anchor the pipe names has gone; the planner removes the pipe in the same edit
			live.add(id);
			let d = drawn.get(id);
			if (d && d.laid !== laid) { d.group.remove(); d = null; }   // a link pipe laid again by hand: its look and its hit line change
			if (!d) { d = make(id, laid); drawn.set(id, d); }
			setEnds(d.line, p, q);
			if (d.hit) setEnds(d.hit, p, q);
			d.line.setAttribute('class', `pipe pipe-${laid}${selected.has(id) ? ' selected' : ''}`);
			d.group.setAttribute('class', `pipe-of${under.has(id) ? ' under' : ''}`);
		}
		for (const [id, d] of drawn) if (!live.has(id)) { d.group.remove(); drawn.delete(id); }   // the pipe is gone
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
		for (const id of ids) { const e = model.endpointOf(id); if (e) renderer.render(kindOf(id), e); }
		const said = session.takeNotice() ?? '';
		// one edit, each waypoint's cut or join built on the board the ones before it leave (B283)
		const edit = transitEdit(model, ids, (id) => network.stopsAt(id, model));
		if (edit) history.commit({ label: edit.label, entries: edit.entries });
		const cut = edit?.cut ?? null, joined = edit?.joined ?? null;
		settle('');
		// how many drawn links were cut and into how many pieces, and how many pieces joined into how many links (2026-10-02)
		say(`${said}${cut ? ` -- ${cut.links} link${cut.links === 1 ? '' : 's'} cut into ${cut.pieces} pieces` : ''}${joined ? ` -- ${joined.pieces} pieces joined into ${joined.links} link${joined.links === 1 ? '' : 's'}` : ''}${downSummary(model)}`);
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
