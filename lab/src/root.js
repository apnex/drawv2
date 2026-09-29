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
import { pipeResolver } from '../../network/resolve.mjs';

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
const model = new Model({ resolvePath: pipeResolver(pipes) });
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

Colour comes from nothing here: pipes take the stylesheet's class, because B255 records that the
canvas already has two authorities for every colour and adding a third while that row is open would
repeat the defect knowingly.
*/
const pipeLayer = svg.querySelector('#pipes');
const drawPipes = () => {
	pipeLayer.replaceChildren();
	for (const { a, b, laid } of pipes.list()) {
		const p = model.endpointOf(a), q = model.endpointOf(b);
		if (!p || !q) continue;   // an anchor the pipe names has gone; the next sweep removes the pipe
		el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: `pipe pipe-${laid}` }, pipeLayer);
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

const input = new Input({ svg, model, history, selection, renderer, labels, readout,
	palette: null, host: window, help: null, now: () => Date.now(), snap });

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
		: commit(authority, log, request, 'lab', 'lab');
	if (!answer.ok) { say(`refused: ${answer.error}`); return; }
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
	say(`v${answer.version} ${request.verb ?? request.label ?? ''}`.trim());
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
FIXED BOARDS -- the seed half of K10.

A gesture question cannot be answered on whatever the author happened to draw. `w` and `g` differ
only in particular shapes, and those take deliberate setup to reach, so an empty canvas turns the
comparison into a memory test. These are the boards where the two produce DIFFERENT pages, each
reachable by `?seed=<name>` so the same board survives a reload and two runs can be compared.

They live in this file rather than beside it because L8 bars a lab module from importing another
lab module -- the lab is ONE composition, not a small application, and the rule is right.

Every seed is applied THROUGH THE PLANNER, exactly as an author's edit is. A seed that could
bypass the rules would let the lab show a page the product cannot reach, which is worse than
having no seed. Ids are literal so a board is byte-identical on every load.
*/
const P = 60;   // kernel/spec.mjs STD.pitch
const nd = (n, name, x, y, type = 'router') => ({ op: 'put', kind: 'node',
	entity: { id: `node-00000${n}`, name, type, x: x * P, y: y * P, shape: 'circle' } });
const wp = (n, x, y) => ({ op: 'put', kind: 'waypoint',
	entity: { id: `waypoint-00000${n}`, name: `w${n}`, x: x * P, y: y * P } });
const lk = (n, name, src, dst, via) => ({ op: 'put', kind: 'link',
	entity: { id: `link-00000${n}`, name, src, dst, ...(via ? { via } : {}) } });

const BOARDS = {
	// two routes through one BARE anchor. Pin it with `w` and you get four terminations and a
	// junction; leave it bare and they cross. This is the case the director asked for.
	cross: [nd(1, 'A', -6, 0), nd(2, 'B', 6, 0), nd(3, 'C', 0, -4), nd(4, 'D', 0, 4), wp(5, 0, 0),
		lk(1, 'east-west', 'node-000001', 'node-000002'), lk(2, 'north-south', 'node-000003', 'node-000004')],

	// one link through one anchor: `w` there is a bend (two terminations that agree), `g` is nothing
	bend: [nd(1, 'A', -6, 0), nd(2, 'B', 6, 0), wp(5, 0, -2),
		lk(1, 'trunk', 'node-000001', 'node-000002', ['waypoint-000005'])],

	// the board that shows g's COST rather than its benefit: two ways across, so deleting a pipe can
	// move a route off an anchor the author placed. A `w` pin holds; a guide anchor does not, because
	// it is not in the link's intent (GUIDE-ANCHORS.md open item 3).
	detour: [nd(1, 'A', -8, 0), nd(2, 'B', 8, 0), wp(5, 0, 0), wp(6, -4, 5), wp(7, 4, 5),
		lk(1, 'uplink', 'node-000001', 'node-000002', ['waypoint-000005'])],

	// three links at one anchor -- a junction at any direction. The board for `x` (transit):
	// toggling it off must leave three endpoints rather than a junction.
	tri: [nd(1, 'A', -6, -3), nd(2, 'B', 6, -3), nd(3, 'C', 0, 5), wp(5, 0, 0),
		lk(1, 'a', 'node-000001', 'waypoint-000005'), lk(2, 'b', 'node-000002', 'waypoint-000005'),
		lk(3, 'c', 'node-000003', 'waypoint-000005')],
};

/*
THE CONDUIT each board lays. Pipes are the incubator's, not the document's, so they cannot ride in
the planner's op list -- they are laid into the session's pipe set beside it.

Chosen so each board's links have somewhere to route, and so the boards show what they are FOR:
`cross` runs both links through the bare centre, and `detour` offers two ways across so that
deleting one pipe moves the route.
*/
const N = (n) => `node-00000${n}`, W = (n) => `waypoint-00000${n}`;
const CONDUIT = {
	cross: [[N(1), W(5)], [W(5), N(2)], [N(3), W(5)], [W(5), N(4)]],
	bend: [[N(1), W(5)], [W(5), N(2)]],
	detour: [[N(1), W(5)], [W(5), N(2)], [N(1), W(6)], [W(6), W(7)], [W(7), N(2)]],
	tri: [[N(1), W(5)], [N(2), W(5)], [N(3), W(5)]],
};

/*
An unknown name REFUSES and lists what exists, rather than falling back to an empty board. A seed
that silently gives a different board than the one named makes two runs incomparable, which is the
whole thing these exist to prevent.
*/
const wanted = new URLSearchParams(location.search).get('seed');
if (wanted) {
	const ops = BOARDS[wanted];
	if (!ops) say(`no seed '${wanted}' -- try: ${Object.keys(BOARDS).join(', ')}`);
	else {
		const answer = commit(authority, log, { ops, label: `seed ${wanted}` }, 'lab', 'lab');
		if (!answer.ok) say(`seed ${wanted} refused: ${answer.error}`);
		else {
			// conduit FIRST, so the links are routed over it the moment they are drawn
			for (const [x, y] of CONDUIT[wanted] ?? []) pipes.lay(x, y, 'hand');
			applyOps(model, answer.change?.ops ?? []);
			say(`seed ${wanted} -- ${ops.length} entities, ${pipes.list().length} pipes`);
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
window.lab = { model, authority, pipes, history, log };
