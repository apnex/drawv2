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
import { Changes } from '../../app/src/changes.js';
import { Renderer } from '../../app/src/renderer.js';
import { Selection } from '../../app/src/selection.js';
import { Input } from '../../app/src/input.js';
import { Readout } from '../../app/src/readout.js';
import { LabelEditor } from '../../app/src/labeledit.js';
import { commit } from '../../server/txn.mjs';
import { Log } from '../../server/log.mjs';
// INCUBATED (ruled 2026-09-28): the network plugin, built lab-first and promoted to production once
// proven. Production does not import network/ until then, and a test holds that boundary.
import { routeLink } from '../../network/pipes.mjs';

/*
The DOM contract, asserted rather than assumed.

A missing layer is a silent null: the renderer appends into nothing and the canvas stays blank with
no error, which is the hardest kind of failure to attribute. The product page and this one declare
the same ids, so a divergence between them is a real defect and is named here at boot.
*/
const NEEDED = ['container', 'canvas', 'grid-nodes', 'grid-zones', 'snaplayer', 'zones', 'groups',
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

// the tab's model -- what the author sees and edits
const model = new Model();
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
	const answer = commit(authority, log, request, 'lab', 'lab');
	if (!answer.ok) { say(`refused: ${answer.error}`); return; }
	/*
	THE PLANNER'S OWN OPS, at `answer.change.ops` -- not `answer.ops`.

	`commit()` returns { ok, change, version }, and the change carries the ops it actually applied,
	which include everything it DERIVED: the cascade, the orphan sweep, the collapse. Reading
	`answer.ops` finds undefined, applies nothing, and leaves a canvas that never updates while the
	notice cheerfully reports a new version. The first build of this file did exactly that.
	*/
	applyOps(model, answer.change?.ops ?? []);
	say(`v${answer.version} ${request.label ?? ''}`.trim());
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
		else { applyOps(model, answer.change?.ops ?? []); say(`seed ${wanted} -- ${ops.length} entities`); }
	}
}
