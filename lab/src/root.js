/*
The lab's composition root -- H17 cut K10.

This file COMPOSES and defines nothing. `scan-layers` rule L8 enforces that: `lab/` may export no
name, declare no class, and nothing may import it. So everything here is wiring, and every rule it
exercises lives in a module the product loads too (G1: mount, never fork).

WHAT IS ABSENT, and why each one is safe to leave out:
  Net, Sync, Watchdog   there is no server. The planner runs here (H17-D8).
  Palette               the lab's subject is gestures on the canvas, not the stamp hand.
  Menu, access, help    chrome. The canvas modules never read them.
  Movers, Clock         run mode is not the subject; `r` therefore does nothing (H17-D7 records
                        that three bindings are inert in the lab).

WHAT IS PRESENT is the whole key table (H17-D7), because the point of the lab is to drive real
gestures against real rules.

THE DOOR. In the product, `history.onCommit` hands a request to `sync.submit` and the server's
planner answers. Here the same callback hands it to `commit()` from `planner/txn.mjs` against a
LOCAL AUTHORITY MODEL, and the answer is applied back. That is one line's difference in the
composition, and it is the whole reason the lab can show the planner's cascade and sweep with no
network: the tab model proposes, the authority model rules, exactly as production does.
*/

import { sharedDefs } from '../../kernel/renderer.mjs';
import { cellOf, gridDot } from '../../kernel/geometry.mjs';
import { el, crosshair } from '../../app/src/painter.js';
import { nodePoints, zonePoints, CANVAS, GAP } from '../../app/src/snap.js';
import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { applyOps } from '../../model/ops.mjs';
import { Changes, derivedToApply } from '../../app/src/changes.js';
import { Renderer } from '../../app/src/renderer.js';
import { Selection } from '../../app/src/selection.js';
import { Input } from '../../app/src/input.js';
import { Capture } from '../../app/src/capture.js';
import { cutAt, joinAt } from '../../network/transit.mjs';
import { Readout } from '../../app/src/readout.js';
import { LabelEditor } from '../../app/src/labeledit.js';
import { commit, undo, redo } from '../../planner/txn.mjs';
import { Log } from '../../planner/log.mjs';
// INCUBATED (ruled 2026-09-28): the network plugin, built lab-first and promoted to production once
// proven. Production does not import network/ until then, and a test holds that boundary.
import { routeLink } from '../../network/pipes.mjs';
import { whyDown, downSummary } from '../../network/resolve.mjs';
import { createNetworkSession } from '../../network/session.mjs';
import { networkInput } from '../../network/keys.mjs';
import { pipeAttributes } from '../../network/appearance.mjs';

/*
The DOM contract, asserted rather than assumed.

A missing layer is a silent null: the renderer appends into nothing and the canvas stays blank with
no error, which is the hardest kind of failure to attribute. The product page and this one declare
the same ids, so a divergence between them is a real defect and is named here at boot.
*/
const NEEDED = ['container', 'canvas', 'grid-nodes', 'grid-zones', 'snaplayer', 'zones', 'pipes', 'groups',
	'links', 'waypoints', 'nodes', 'movers', 'overlay', 'readout-bottom', 'lab-notice', 'kdefs'];
const missing = NEEDED.filter((id) => !document.getElementById(id));
if (missing.length) throw new Error(`the lab page is missing: ${missing.join(', ')}`);

document.getElementById('kdefs').innerHTML = sharedDefs();

const svg = document.getElementById('container');
const ZONE_GRID_DOT = 5;
const gridNodes = svg.querySelector('#grid-nodes');
nodePoints().forEach((p) => el('circle', { cx: p.x, cy: p.y, r: gridDot().radius }, gridNodes));
const gridZones = svg.querySelector('#grid-zones');
zonePoints().forEach((p) => el('circle', { cx: p.x, cy: p.y, r: ZONE_GRID_DOT }, gridZones));

/*
THE NETWORK SESSION (RULESET-AUDIT T5): the pipes, the link ages, the legs a drag lays while the planner's answer is
awaited, and the order one edit changes them in -- network/session.mjs, which knows no DOM. This file draws what it says.

Its network is ONE object (T1), handed to the tab's Model -- where a link runs, which links a moved anchor affects,
whether it is down, what blocks it -- and to the planner -- what else references an anchor, which orphans survive, which
links are stranded. Production constructs `new Model()` and commits with no network; nothing here reaches production.
*/
const session = createNetworkSession(), { pipes, order, network } = session;
const model = new Model({ network });
attachRelations(model, { cellOf });

/*
The AUTHORITY model, and why there are two.

Production has a tab model and a server model, and every rule that matters -- the cascade, the
orphan sweep, the collapse, every refusal -- runs on the server's. A lab with one model would show
the tab's optimistic view and prove nothing about the planner.

So the lab holds both, in one page. The authority model starts empty and is fed the same ops, and
the planner's answer is what the tab applies. The seam is identical to production's; only the
transport is gone.
*/
const authority = new Model();
attachRelations(authority, { cellOf });
const log = new Log();

const notice = document.getElementById('lab-notice');
const say = (text) => { notice.textContent = text; };


/*
PIPES ARE DRAWN, beneath the links routed over them.

Redrawn whole on every change. The pipe set is small and redrawing it is cheap, and a painter that
tried to reconcile incrementally would need to know which pipes changed -- a second index over the
pipe set, which is exactly the kind of second authority this programme exists to remove.

How a pipe LOOKS is the network plugin's (network/appearance.mjs), applied here as attributes. The
first painter left colour to the stylesheet's `currentColor`, which inherited black and made pipes
invisible; one measured authority in the plugin replaces it.
*/
const pipeLayer = svg.querySelector('#pipes');
const drawPipes = () => {
	pipeLayer.replaceChildren();
	for (const { a, b, laid } of pipes.list()) {
		const p = model.endpointOf(a), q = model.endpointOf(b);
		if (!p || !q) continue;   // an anchor the pipe names has gone; the next sweep removes the pipe
		el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: `pipe pipe-${laid}`, ...pipeAttributes(laid) }, pipeLayer);
	}
};
model.onChange(drawPipes);

const history = new Changes(model);
const renderer = new Renderer(model, svg);
const selection = new Selection(model);
// a selected down link says WHY it is down -- held by a named link, or no way at all (2026-09-30)
selection.subscribe(() => { renderer.reflectSelection(selection.list()); const why = whyDown(model, selection.list(), network); if (why) say(why); });
const labels = new LabelEditor({ svg, model, history });
const readout = new Readout({ model, selection, elements: [document.getElementById('readout-bottom')] });
const snap = crosshair(svg.querySelector('#snaplayer'), CANVAS, GAP);

/*
THE ROUTE HOOK -- how `g`, and the network's rules for a drag, exist in the lab and nowhere else. Input asks it once per
finished drag; the session judges it (network/session.mjs `judge`) and holds what it lays until the planner answers.

SETTLE THE BOARD after its pipes or links change -- ONE step, so every path that changes them takes all of it. A link's
drawn route depends on the pipe set, which lives outside the model, so the model's change events never announce that a
new pipe made a way or that a swept one broke one: EVERY link is redrawn here. Whole-board is right for a lab-sized
board; a targeted redraw belongs with the promotion, when pipes are stored and their changes are events like any other.
Before this was one step, a g drag laid its pipes and redrew only the pipes, so a link that healed over them stayed
drawn down until the next edit. The sweep is skipped after undo and redo (session pipes, network/session.mjs).
*/
const settle = (sweep, fallback) => {
	session.tidy(authority, { sweep });
	drawPipes();
	for (const l of model.all('link')) renderer.update('link', l);
	renderer.reflectSelection(selection.list());   // an edit can change who blocks whom
	say(session.takeNotice() ?? `${fallback}${downSummary(model)}`.trim());   // DOWN is said as well as drawn
};
const routeHook = (drag) => {
	const { verdict, commits } = session.judge(drag, authority.all('link'), authority);
	if (!commits) settle(true, '');   // nothing to commit: its pipes were laid now
	return verdict;
};

const input = new Input({ svg, model, history, selection, renderer, labels, readout,
	palette: null, host: window, help: null, now: () => Date.now(), snap,
	plugins: [networkInput(routeHook, session)] });   // its own keys, and its judge of a drag (dev/RULES.md section 11)
const capture = new Capture({ svg, host: window, sink: input });   // the DOM's events, as input events (L0)
// a transit change redraws the anchors it marks, then settles -- which says what the session said (TRANSIT.md section 12)
// it can take links down or heal them (TR-4), so the notice counts what is down after it. At a waypoint it is also an EDIT
// (TR-2): turned off, the links pinned there are cut in two; turned back on, the two left ending there join -- one commit
session.onTransitChange((ids) => {
	for (const id of ids) { const e = model.endpointOf(id); if (e) renderer.render(e.type ? 'node' : 'waypoint', e); }
	const said = session.takeNotice() ?? '';
	const edits = ids.filter((id) => model.get('waypoint', id)).map((id) => (network.declaresNoTransit(id) ? cutAt(model, id) : joinAt(model, id))).filter(Boolean);
	if (edits.length) history.commit({ label: 'transit', entries: edits.flatMap((e) => e.entries) });
	const cut = edits.reduce((n, e) => n + (e.cut ?? 0), 0), joined = edits.some((e) => e.label === 'join');
	settle(false, '');
	say(`${said}${cut ? ` -- ${cut} link${cut === 1 ? '' : 's'} cut in two there` : ''}${joined ? ' -- its two links joined again' : ''}${downSummary(model)}`);
});

/*
THE DOOR (G11): a planner refusal is VISIBLE.

In production a refusal arrives as an answer over the socket and the tab shows a notice. Here it
returns from `commit()` directly, and it must still reach the author -- a lab that swallows a
refusal would teach the opposite of what the planner does, which is the one thing this canvas
exists to show.
*/
history.onCommit((request) => {
	/*
	UNDO AND REDO ARE VERBS, and they go to the real `undo()` and `redo()` -- not to `commit()`.

	`Changes` emits `{ verb: 'undo', expect }` for Ctrl+Z. The first build sent every request to
	`commit()`, which answered "version conflict" -- so Ctrl+Z was refused in the lab while H17-D8
	promises it works. Found by driving the planner, not by reading the ruling.

	`expect` is deliberately not checked here. It guards the server against a concurrent writer; the
	lab is one writer in one page, and its Changes never learns a server version to send.
	*/
	const answer = request.verb === 'undo' ? undo(authority, log, request.to ?? null)
		: request.verb === 'redo' ? redo(authority, log)
		// the same network: pipes reference anchors, only links and hand pipes keep one, and a link that loses a pin with no
		// other way goes whole (2026-09-29) -- all judged over the pipes that survive the edit
		: commit(authority, log, request, 'lab', 'lab', { links: network.links });
	/*
	THE ANSWER, RECONCILED BY THE PRODUCT'S OWN RULE -- applied by the session once it has laid the drag's pipes, so the
	link is drawn along them from its first frame (network/session.mjs `answered`).

	Two shapes: `commit()` returns its applied ops at `change.ops` -- reading `answer.ops` there
	applied nothing, the first build's defect -- and `undo()`/`redo()` return them at `ops`.

	They are not applied wholesale. The tab already applied its own ops optimistically, and the
	answer can arrive after a coalescing timer, when the author has moved on; re-applying older ops
	over a newer live edit is the snapback K1 fixed. `derivedToApply` is K1's one rule for exactly
	this -- the planned ops that are not our own echoed back -- so the lab MOUNTS it (G1) rather than
	forking a simpler rule. Undo and redo take the same path with nothing sent, as they do in sync.js.
	Nothing is in flight in the lab, because the planner answers in the same page.
	*/
	const accepted = session.answered(answer, authority, () => {
		const apply = derivedToApply(request.ops ?? [], answer.change?.ops ?? answer.ops ?? [], []);
		if (apply.length) applyOps(model, apply);
	});
	/*
	B260 -- A REFUSAL TAKES THE PLANNER'S DOCUMENT BACK. The tab applied the request optimistically, so a refused one
	left the tab holding what the planner does not -- a link that was never made. Production resynchronises in that case
	(app/src/sync.js, requestResync); in the lab the planner is in the page, so the tab reloads from it, keeping its
	selection of whatever still exists.
	*/
	if (!accepted) { model.load({ ...authority.toJSON(), selection: [...model.state.selection] }); settle(false, ''); say(`refused: ${answer.error}`); return; }
	settle(!request.verb, `v${answer.version} ${request.verb ?? request.label ?? ''}`);
});

say('lab -- nothing is stored, nothing is shared');
/*
Proof the incubator is composed and running, not merely imported. A trivial route through the
network plugin, reported on the notice: if `network/` fails to load, the module graph fails before
this line and the notice never reads it, so its presence is the evidence.
*/
const probe = routeLink([{ a: 'A', b: 'B' }, { a: 'B', b: 'C' }], { src: 'A', dst: 'C' });
say(`lab -- nothing is stored, nothing is shared -- network plugin ${probe ? 'loaded' : 'FAILED'}`);

/*
FIXED BOARDS -- `?seed=<name>`, read from lab/seeds.json.

A gesture question cannot be answered on whatever the author happened to draw: `w` and `g` differ only
in particular shapes, and those take deliberate setup, so every board here is one where the gestures
decide something. The same board comes back after a reload, so two runs can be compared.

DATA, IN A DATA FILE. The boards began as literals in this file and grew until the L8 budget said
so -- and the budget's own comment names a rising ceiling as the sign that something is in the wrong
place. It was: boards are data, not composition. Moving them out also retired a hack, since the
tests had been extracting the literals from this source and evaluating them.

Every board is applied THROUGH THE PLANNER, as an author's edit is, so a board the product could not
reach is refused rather than shown. Its pipes are laid into the session's pipe set first, so the
links are routed over it the moment they are drawn. An unknown name refuses and lists what exists,
rather than silently giving a different board.
*/
const wanted = new URLSearchParams(location.search).get('seed');
if (wanted) {
	/*
	A FAILED FETCH MUST NOT KILL THE PAGE. This is a top-level await, so an unhandled rejection here
	fails the whole module: `window.lab` is never set and the canvas that loaded above is left dead. The
	gate caught it as a flake -- about one page in 130 -- and a real reload could meet it the same way.
	So the failure is caught and SAID, and the lab stays usable without its board.
	*/
	let boards = {};
	try { boards = await (await fetch('/seeds.json')).json(); }
	catch (e) { say(`seed ${wanted} could not be loaded (${e.message}) -- the canvas still works; reload to try again`); }
	const board = boards[wanted];
	if (!board) { if (Object.keys(boards).length) say(`no seed '${wanted}' -- try: ${Object.keys(boards).join(', ')}`); }
	else {
		const answer = commit(authority, log, { ops: board.ops, label: `seed ${wanted}` }, 'lab', 'lab');
		if (!answer.ok) say(`seed ${wanted} refused: ${answer.error}`);
		else {
			session.seed(board.pipes, board.ops.filter((o) => o.kind === 'link').map((o) => o.entity.id));
			applyOps(model, answer.change?.ops ?? []);
			drawPipes();
			say(`seed ${wanted} -- ${board.ops.length} entities, ${pipes.list().length} pipes`);
		}
	}
}

/*
A TEST HANDLE, and nothing else uses it.

`tests/lab-browser.test.js` drives this page in real Chrome and needs to reach the models and the
commit seam. The alternative -- asserting the lab's wiring by reading this file as source -- let
four defects through in one session: the door read `answer.ops`, an import named the wrong module,
the image lacked `network/`, and Ctrl+Z was refused. Each passed every source check. Only running
the page showed them, so the page is what the test runs.

The product exposes `window.draw` for the same reason (tests/browser.test.js). Nothing here is
reachable from production: `lab/` is served only at lab.apnex.io and imported by nothing.
*/
window.lab = { model, authority, pipes, order, network, history, log, input, capture, routeHook };
