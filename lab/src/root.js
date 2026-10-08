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

import { cellOf } from '../../kernel/geometry.mjs';
import { el } from '../../app/src/painter.js';
import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { applyOps } from '../../model/ops.mjs';
import { derivedToApply, applyAnswer } from '../../app/src/changes.js';
import { composeCanvas } from '../../app/src/compose-canvas.js';   // K8: the canvas, composed as the product composes it
import { commit, undo, redo } from '../../planner/txn.mjs';
import { Log } from '../../planner/log.mjs';
import { productKinds } from '../../product/kinds.mjs';
// the network plugin -- incubated here from 2026-09-28, composed into a page by its one function since V-b (H18.26), as the
// product page composes it
import { routeLink } from '../../network/pipes.mjs';
import { NETWORK_ROWS } from '../../network/kinds.mjs';   // the network's kind and the field it contributes (S-a)
import { createPageNetwork } from '../../network/page.mjs';

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

const svg = document.getElementById('container');

/*
THE NETWORK SESSION (RULESET-AUDIT T5): the link ages, the transit settings, and the network that reads the models' own
pipes (H17.22 N-c) -- network/session.mjs, which knows no DOM. This file draws what it says.

Its network is ONE object (T1), handed to the tab's Model -- where a link runs, which links a moved anchor affects,
whether it is down, what blocks it -- and to the planner -- what else references an anchor, which orphans survive, which
links are stranded. Production constructs `new Model()` and commits with no network; nothing here reaches production.
*/
const page = createPageNetwork(), { network } = page;   // the network, composed into this page as into the product's (V-b)
// THE KINDS (H17.22): the product's five and the network's pipe, one composition handed to both models and the planner
const kinds = productKinds(...NETWORK_ROWS);
/*
K8 -- the canvas, composed by the one function the product page composes it with (app/src/compose-canvas.js), handed
this network. The lab holds no tools and no run mode; its drag judge is the attached network's, below, reached lazily
because the network attaches to the parts composed here.
*/
const { model, history, renderer, selection, input, listen } = composeCanvas({
	svg, defs: document.getElementById('kdefs'), host: window, network, kinds,
	readoutEl: document.getElementById('readout-bottom'),
	help: null, now: () => Date.now(),
	plugins: page.plugins,   // its own keys, and its judge of a drag (dev/RULES.md section 11)
});

/*
The AUTHORITY model, and why there are two.

Production has a tab model and a server model, and every rule that matters -- the cascade, the
orphan sweep, the collapse, every refusal -- runs on the server's. A lab with one model would show
the tab's optimistic view and prove nothing about the planner.

So the lab holds both, in one page. The authority model starts empty and is fed the same ops, and
the planner's answer is what the tab applies. The seam is identical to production's; only the
transport is gone.
*/
const authority = new Model({ kinds, attached: { network } });   // a Model holding links draws with the network (V-e, J2)
attachRelations(authority, { cellOf });
const log = new Log();

const notice = document.getElementById('lab-notice');
const say = (text) => { notice.textContent = text; };


/*
THE NETWORK, ATTACHED (network/host.mjs): its pipe painter, its drag judge, its transit edits, its answer step and the
settle that follows every change -- the plugin's choreography, which promotion attaches to the product page the same way.
What stays here is the lab's own: the in-page planner below (the authority model and its log), the refusal that takes the
planner's document back, the notice, and which fixed board to load.
*/
const net = page.attach({ model, renderer, selection, history, pipeLayer: svg.querySelector('#pipes'), el, say });
const capture = listen();   // the DOM's events, as input events (L0)
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
	const answer = request.verb === 'undo' ? undo(authority, log, request.to ?? null, { kinds })
		: request.verb === 'redo' ? redo(authority, log, { kinds })
		// the same network: pipes reference anchors, only links and hand pipes keep one, and a link that loses a pin with no
		// other way goes whole (2026-09-29) -- all judged over the pipes that survive the edit
		: commit(authority, log, request, 'lab', 'lab', { links: network.links, kinds });
	/*
	THE ANSWER, RECONCILED BY THE PRODUCT'S OWN RULE -- pipes included, since they are ops in the edit (N-c), so a link is
	drawn along its pipes from its first frame (network/session.mjs `answered`).

	Two shapes: `commit()` returns its applied ops at `change.ops` -- reading `answer.ops` there
	applied nothing, the first build's defect -- and `undo()`/`redo()` return them at `ops`.

	They are not applied wholesale. The tab already applied its own ops optimistically, and the
	answer can arrive after a coalescing timer, when the author has moved on; re-applying older ops
	over a newer live edit is the snapback K1 fixed. `derivedToApply` is K1's one rule for exactly
	this -- the planned ops that are not our own echoed back -- so the lab MOUNTS it (G1) rather than
	forking a simpler rule. Undo and redo take the same path with nothing sent, as they do in sync.js.
	Nothing is in flight in the lab, because the planner answers in the same page.
	*/
	const accepted = net.answered(request, answer, () => {
		applyAnswer(model, selection, derivedToApply(request.applied ?? request.ops ?? [], answer.change?.ops ?? answer.ops ?? [], []));   // against what the tab applied, the preview (V-d)   // a selection carried across a join (B288)
	});
	/*
	B260 -- A REFUSAL TAKES THE PLANNER'S DOCUMENT BACK. The tab applied the request optimistically, so a refused one
	left the tab holding what the planner does not -- a link that was never made. Production resynchronises in that case
	(app/src/sync.js, requestResync); in the lab the planner is in the page, so the tab reloads from it, keeping its
	selection of whatever still exists.
	*/
	if (!accepted) { model.load({ ...authority.toJSON(), selection: [...model.state.selection] }); net.refused(answer); }
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
reach is refused rather than shown. Its pipes are ops in the same commit (N-c) and its links are aged first, so the links
are routed over them the moment they are drawn (network/host.mjs `seed`). An unknown name refuses and lists what exists,
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
		// the board's pipes ride in its own commit (N-c), under the network's tenant like every edit -- the one tenant since S-b
		const answer = net.seed(board.pipes, (pipeOps) => {
			const a = commit(authority, log, { ops: [...board.ops, ...pipeOps], label: `seed ${wanted}` }, 'lab', 'lab', { links: network.links, kinds });
			if (a.ok) applyOps(model, a.change?.ops ?? []);
			return a;
		});
		if (!answer.ok) say(`seed ${wanted} refused: ${answer.error}`);
		else say(`seed ${wanted} -- ${board.ops.length} entities, ${model.all('pipe').length} pipes`);
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
window.lab = { model, authority, network, history, log, input, capture, routeHook: net.judge };
