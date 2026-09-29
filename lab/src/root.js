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
planner answers. Here the same callback hands it to `commit()` from `server/txn.mjs` against a
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
import { Readout } from '../../app/src/readout.js';
import { LabelEditor } from '../../app/src/labeledit.js';
import { commit, undo, redo } from '../../server/txn.mjs';
import { Log } from '../../server/log.mjs';
// INCUBATED (ruled 2026-09-28): the network plugin, built lab-first and promoted to production once
// proven. Production does not import network/ until then, and a test holds that boundary.
import { routeLink } from '../../network/pipes.mjs';
import { createPipeSet } from '../../network/pipeset.mjs';
import { pipeResolver, pipeDependents } from '../../network/resolve.mjs';
import { checkGuidedRoute, pipeAnchors, routesOf, keptOnRefusal, keepsOrphan } from '../../network/guide.mjs';
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
The pipe set, for the session. Pipes are not stored yet -- that is the one format batch, last (F6)
-- so they live here and a reload starts from nothing, which is correct rather than missing.
*/
const pipes = createPipeSet();

/*
The tab's model draws links along their ROUTE over pipes, through the interface declared on Model
for exactly this (`resolvePath`). Production constructs `new Model()` and draws the straight
polyline it always has; nothing here reaches production.
*/
// where a link runs, AND which links a moved anchor affects, from one authority -- or the pipes follow
// a moved anchor while the links routed through it stay behind (the director's report, 2026-09-29)
const model = new Model({ resolvePath: pipeResolver(pipes), routedThrough: pipeDependents(pipes) });
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
selection.subscribe(() => renderer.reflectSelection(selection.list()));
const labels = new LabelEditor({ svg, model, history });
const readout = new Readout({ model, selection, elements: [document.getElementById('readout-bottom')] });
const snap = crosshair(svg.querySelector('#snaplayer'), CANVAS, GAP);

/*
THE ROUTE HOOK -- how `g` exists in the lab and nowhere else.

Input asks it once per finished link drag, for the whole drawn route. It checks the route with the
incubator (network/guide.mjs): a guide the fewest-pipes route would skip is refused and NAMED, rather
than committed as a link that silently ignores what the author drew.

It lays NOTHING. The legs are held until the planner accepts the link, then laid -- so a link the
planner refuses leaves no pipes behind. That ordering holds because a route commit is emitted the
moment it is made: `commands.routeLink` never sets `coalesce`, so the planner's answer follows this
hook synchronously and consumes exactly these legs.
*/
let pendingLegs = null, pendingNotice = null;
const routeHook = (route) => {
	const verdict = checkGuidedRoute(pipes.list(), route);
	if (!verdict.ok) {
		// refusal refuses the LINK: the g anchors and their hand pipes are kept (network/guide.mjs)
		const kept = keptOnRefusal(verdict, route);
		pendingNotice = `refused: ${verdict.reason} -- the link is refused; the g anchors and their pipes are kept`;
		say(pendingNotice);
		if (kept.placedKept.length) pendingLegs = kept.legs;   // laid when the planner accepts the kept anchors
		else { for (const l of kept.legs) pipes.lay(l.a, l.b, l.laid); drawPipes(); pendingNotice = null; }
		return { ...verdict, keep: kept.keep };
	}
	pendingLegs = verdict.legs;
	return verdict;
};

const input = new Input({ svg, model, history, selection, renderer, labels, readout,
	palette: null, host: window, help: null, now: () => Date.now(), snap, routeHook });

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
		// pipes reference anchors too, and live here rather than in the document, so the planner is told
		// -- or its orphan sweep removes an anchor that pins one link and guides another (measured)
		: commit(authority, log, request, 'lab', 'lab', {
			alsoReferenced: (m) => pipeAnchors(pipes.list(), m),   // only pipes that survive the edit being judged
			keepsOrphan,   // the network model's rule: only links and hand-laid pipes keep an anchor (2026-09-29)
		});
	const legs = pendingLegs; pendingLegs = null;
	if (!answer.ok) { say(`refused: ${answer.error}`); return; }
	// pipes BEFORE the tab applies the link, so the link is drawn along them from its first frame
	for (const { a, b, laid } of legs ?? []) pipes.lay(a, b, laid);
	/*
	THE ANSWER, RECONCILED BY THE PRODUCT'S OWN RULE.

	Two shapes: `commit()` returns its applied ops at `change.ops` -- reading `answer.ops` there
	applied nothing, the first build's defect -- and `undo()`/`redo()` return them at `ops`.

	They are not applied wholesale. The tab already applied its own ops optimistically, and the
	answer can arrive after a coalescing timer, when the author has moved on; re-applying older ops
	over a newer live edit is the snapback K1 fixed. `derivedToApply` is K1's one rule for exactly
	this -- the planned ops that are not our own echoed back -- so the lab MOUNTS it (G1) rather than
	forking a simpler rule. Undo and redo take the same path with nothing sent, as they do in sync.js.
	Nothing is in flight in the lab, because the planner answers in the same page.
	*/
	const planned = answer.change?.ops ?? answer.ops ?? [];
	const apply = derivedToApply(request.ops ?? [], planned, []);
	if (apply.length) applyOps(model, apply);
	/*
	Pipes laid WITH A LINK go once no link remains on them (ruled 2026-09-27); pipes laid by hand stay.
	Swept after ordinary edits only. Pipes are session state OUTSIDE the planner's log until the format
	batch stores them, so undo and redo cannot move them: sweeping after an undo would leave the redone
	link with no pipes, drawn down. Leftover pipes after an undo are the smaller lie, and it goes at
	the next ordinary edit. This is a stated limit of session pipes, not a rule.
	*/
	// a pipe to a deleted anchor is not a pipe (SD7) -- after every edit, undo and redo included
	pipes.prune((id) => !!(authority.get('node', id) || authority.get('waypoint', id)));
	if (!request.verb) pipes.sweep(routesOf(pipes.list(), authority.all('link')));
	drawPipes();
	/*
	EVERY LINK REDRAWN once the pipes have settled. A link's drawn route depends on the pipe set, and
	the pipe set lives outside the model -- so the model's change events, which drive the renderer,
	never announce that a new pipe made a shortcut or that a swept one lengthened a route. Found while
	fixing the director's anchor-move report: the same one-fact-two-authorities defect, reached through
	the pipes rather than an anchor. Whole-board redraw is right for a lab-sized board; a targeted one
	belongs with the promotion, when pipes live in the document and their changes are events like any
	other.
	*/
	for (const l of model.all('link')) renderer.update('link', l);
	// a refusal's reason stays on the notice through the commit that keeps its anchors, or it would flash past
	say(pendingNotice ?? `v${answer.version} ${request.verb ?? request.label ?? ''}`.trim());
	pendingNotice = null;
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
			for (const [x, y] of board.pipes) pipes.lay(x, y, 'hand');
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
window.lab = { model, authority, pipes, history, log, input, routeHook };
