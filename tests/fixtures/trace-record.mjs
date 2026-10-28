/*
H26.8's trace move (dev/design/components/NATIVE-SHAPES.md sections 4.1, 4.2 and 5) -- THE REVEAL'S STEPS AND THE EXPORT'S BYTES, AS
PRODUCTION'S CODE DRAWS THEM: the record move 2 answers to.

Section 4.1 has the record of section 4.2 written from `ca492da` before the trace move, and move 2's guard read against its reveal steps
under the trace rule and its export bytes. That record was not written when move 2 began, so this one holds those two parts of it, made
the way 4.2 says: run once against an archive of `ca492da` outside the repository, node modules linked, a deterministic path length
injected, committed alone before the move, and never regenerated -- the move's expectations are this record and the trace rule, never
its own output. The record 4.2 names, when it is written, holds these steps among its own.
REGENERATED once, at the verifier's SF1 on move 2, from a fresh archive of `ca492da` and committed alone again: five scenarios began no
trace and two held none across their event, each line shown at a scenario's first pass and so never withheld; the route changed in a way
the stand-in measure could not see; and the network was not attached. Each scenario now withholds its lines at its first step, names the
event a running trace must hold (`event`), and changes a route the measure sees; the network is attached as the page attaches it.

What it runs is the page's composition in Node, as the page composes it: a Model on the page's network with the maintained relations, a
Selection, the renderer drawing into the canvas's scene with no root, the network attached -- its pipes drawn into a layer of this file's
own, which the record does not read -- and the real reveal at fixed clock instants, its every step closed by one pass of the reveal, as
the loop runs it and as the page's model change asks it, last of the model's listeners. What it reads is the scene's items alone, layer
by layer.

  record.exports      every template and seed the side-by-side draws -- templates/, the parity board, the lab's boards -- each exported,
                      its bytes' SHA-256
  record.scenarios    for each scenario of SCENARIOS, after each step: the clock's instant, the caption, each reveal entity's items in
                      full (the entity's own and its companions, keyed as the renderer keys them) and every other item of each layer
                      by its SHA-256; and the trace each show began -- the line, the instant, its measured length and its duration

  node tests/fixtures/trace-record.mjs --write     writes trace-record.json from the tree this file stands in -- the archive of ca492da
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';
import { COMPOSED_KINDS } from '../../product/types.mjs';
import { PRODUCT_CANVAS, CANVAS_SCENE } from '../../product/canvas.mjs';
import { createPageNetwork } from '../../plugins/network/page.mjs';
import { createNetworkSession } from '../../plugins/network/session.mjs';
import { commit } from '../../planner/txn.mjs';
import { Log } from '../../planner/log.mjs';
import { Selection } from '../../app/src/selection.js';
import { Renderer, openCanvasScene } from '../../app/src/renderer.js';
import { Reveal } from '../../plugins/simulation/reveal-painter.mjs';
import { traceOf } from '../../plugins/simulation/reveal.mjs';
import { svgDocument } from '../../server/svg.mjs';
import { parityBoard } from '../../tools/probe/boards.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const TRACE_RECORD = new URL('./trace-record.json', import.meta.url);
export const WRITTEN_FROM = 'ca492da';
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// the stand-in for draw's probe: a path's length from its `d`, the same in the record and in the move (4.2: a deterministic path length)
export const lengthOf = (d) => String(d ?? '').length * 3 + 0.5;

// ---- the export, over every template and seed

// each lab board as the lab applies it: through the planner, its pipes ops of its own commit (lab/src/root.js FIXED BOARDS)
function labDocument(name, board) {
	const session = createNetworkSession();
	const authority = new Model({ kinds: COMPOSED_KINDS, attached: { network: session.network } });
	attachRelations(authority, { nearest: NODE_GRID.nearest });
	const answer = commit(authority, new Log(), { ops: [...board.ops, ...session.seed(board.pipes ?? [])], label: `seed ${name}` }, 'lab', 'lab', { kinds: COMPOSED_KINDS });
	if (!answer.ok) throw new Error(`lab board ${name} refused: ${answer.error}`);
	return authority.toJSON();
}
export function documents() {
	const dir = path.join(ROOT, 'templates');
	const out = fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort().map((f) => [`templates/${f}`, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]);
	out.push(['the parity board', parityBoard()]);
	const seeds = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/seeds.json'), 'utf8'));
	for (const [name, board] of Object.entries(seeds)) out.push([`lab ${name}`, labDocument(name, board)]);
	return out;
}
export const exportsOf = () => Object.fromEntries(documents().map(([name, doc]) => [name, sha256(svgDocument(structuredClone(doc)))]));

// ---- the reveal's steps

/*
The board: the parity board (tools/probe/boards.mjs), its link fa0001 made a control link -- dashed -- and a closed directed ring added,
whose line is offset, as the trace test drew them before the move; with the parity board's own undirected solid link, its down link,
drawn dotted, a device and a waypoint.
*/
export const IDS = { solid: 'link-fa0005', control: 'link-fa0001', ring: 'link-a00001', device: 'node-fa00a1', waypoint: 'node-a00002' };
export function board() {
	const b = parityBoard();
	b.links = b.links.map((l) => (l.id === IDS.control ? (({ direction, ...rest }) => ({ ...rest, control: true }))(l) : l));
	for (const [id, x, y] of [['node-a00001', -600, -420], ['node-a00002', -360, -420], ['node-a00003', -360, -180], ['node-a00004', -600, -180]]) b.nodes.push({ id, name: id.slice(-2), x, y });
	b.links.push({ id: IDS.ring, name: 'ring', src: 'node-a00001', dst: 'node-a00004', via: ['node-a00002', 'node-a00003'], closed: true, direction: 'forward', order: 99 });
	return b;
}

// the pipe layer's nodes: the page's foreign layer, which the scene answers only with a root -- the network's pipes, which the record does not read
function pipeNode(tag, attrs = {}, parent = null) {
	const node = { tag, attrs: { ...attrs }, children: [], parent,
		setAttribute(k, v) { node.attrs[k] = String(v); },
		remove() { if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node); node.parent = null; } };
	if (parent) parent.children.push(node);
	return node;
}

// the page's composition, in Node, at a clock the steps set
function world() {
	const net = createPageNetwork();
	const model = new Model({ kinds: COMPOSED_KINDS, attached: { network: net.network } });
	attachRelations(model, { nearest: NODE_GRID.nearest });
	const selection = new Selection(model);
	const scene = openCanvasScene(CANVAS_SCENE);
	// the page hands the renderer its measure and settle before the move, and the reveal its measure after it: each takes what it reads
	const renderer = new Renderer(model, null, { parts: PRODUCT_CANVAS, scene, platform: { lengthOf, settle: () => {} } });
	selection.subscribe(() => renderer.reflectSelection(selection.list()));
	// the network attached after the canvas, as the page attaches it (app/src/main.js): its paint on every change and mode, its settle
	const host = net.attach({ model, renderer, selection, edit() {}, say() {}, el: pipeNode, pipeLayer: pipeNode('g', { id: 'pipes' }) });
	const clock = { t: 0 }, said = { caption: null };
	const reveal = new Reveal({ model, renderer, now: () => clock.t, onCaption: (c) => { said.caption = c; }, lengthOf });
	const w = { model, selection, scene, renderer, host, reveal, clock, said, traces: [], hides: [] };
	// the traces each show began and the hides, logged as the reveal is asked: a show traces a line whose measured length is not zero
	const show = reveal.show.bind(reveal), hide = reveal.hide.bind(reveal);
	reveal.show = (id) => {
		const dom = renderer.byId(id);
		if (dom && dom.tagName === 'path') {
			const len = lengthOf(dom.getAttribute('d'));
			if (len > 0) w.traces.push({ id, t: clock.t, len, ms: traceOf(reveal.trace, len).ms });
		}
		return show(id);
	};
	reveal.hide = (id) => { if (renderer.byId(id)) w.hides.push({ id, t: clock.t }); return hide(id); };
	model.load(board());
	renderer.syncAll?.();
	return w;
}

const named = (key, ids) => ids.some((id) => key === id || key.startsWith(`${id}/`));
// one step's reading: each reveal entity's items whole, every other item of each layer by its hash
function read(w, ids) {
	const layers = {};
	for (const l of w.scene.layers) {
		if (l.foreign) continue;
		const items = w.scene.items(l.name);
		const whole = items.filter((x) => named(x.key, ids)).map((x) => [x.key, x.shapes]);
		const rest = items.filter((x) => !named(x.key, ids)).map((x) => [x.key, x.shapes]);
		layers[l.name] = { whole: JSON.parse(JSON.stringify(whole)), rest: sha256(JSON.stringify(rest)) };
	}
	return layers;
}

const BEAT = (origin, ids, interval = 200) => ({ origin, beats: [{ interval, caption: 'the beat', ids }] });
const REVEALED = [IDS.device, IDS.solid, IDS.control, 'link-fa0006', IDS.waypoint];   // fa0006: the parity board's down link
const at = (t, label, action = () => {}) => [label, t, action];
const mover = (w, id) => w.model.get('node', w.model.get('link', id).src);
/*
The device raised: the source of the solid link and the control link, each route, and each `d`, longer -- the solid link's `M-360 0 L0 240`
to `M-360 -240 L0 240`, which the stand-in sees, where a move along the line's own axis would leave the string as long.
*/
const RAISE = 240;
const raised = (w) => { const n = w.model.get('node', IDS.device); w.model.set('node', n.id, { y: n.y - RAISE }); };
/*
Each scenario a beat or the reveal asked directly, through the events section 5's lifecycle names -- the trace's end, a hide, a hide and
a show in one task, a route changed, a structural change of the line, a mode change each way, deletion and undo, a load, the record gone,
velocity mode, a closed ring -- each step an action at its instant, then one pass. Each first step falls before its lines' instant, so
they are withheld and a later pass shows them, traced. `event` names the step whose instant a trace of `id` must be running at, begun
before it and neither ended nor hidden since -- the event the scenario is for -- and `rerouted`, where that step leaves the line on a route
whose measured length is not the trace's.
*/
export const SCENARIOS = {
	'a beat reveals a device, three links and a waypoint, each traced or faded, to its end': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, REVEALED); },
		steps: [at(900, 'before the origin'), at(1000, 'the device'), at(1200, 'the solid link'), at(1300, 'the solid link mid-trace'), at(1400, 'the control link'),
			at(1600, 'the down link'), at(1699, 'the solid link at its last instant'), at(1700, 'the solid link at its end'), at(1800, 'the waypoint'), at(2000, 'all but the down link ended'), at(2200, 'all ended'), at(3000, 'long after')],
		event: { step: 'the solid link at its last instant', id: IDS.solid },
	},
	'a hide mid-trace ends it, and the next show begins it again': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, REVEALED); },
		steps: [at(1100, 'the solid link withheld'), at(1300, 'the solid link shown, traced'), at(1350, 'withheld again by a later beat', (w) => { w.model.state.reveal = BEAT(5000, REVEALED); }),
			at(1400, 'a tick while withheld'), at(1500, 'another tick'), at(5200, 'shown again by the later beat'), at(5300, 'traced again'), at(5699, 'its last instant'), at(5700, 'its end'), at(5800, 'after')],
		event: { step: 'withheld again by a later beat', id: IDS.solid },
	},
	'a hide and a show in one task, directly': {
		setup: () => {},
		steps: [at(100, 'hidden', (w) => w.reveal.hide(IDS.solid)), at(200, 'shown: traced', (w) => w.reveal.show(IDS.solid)), at(400, 'hidden and shown in one task', (w) => { w.reveal.hide(IDS.solid); w.reveal.show(IDS.solid); }),
			at(600, 'mid the second trace'), at(899, 'its last instant'), at(900, 'its end'), at(1000, 'after')],
		event: { step: 'hidden and shown in one task', id: IDS.solid },
	},
	'a route changed mid-trace, and the network settling with nothing changed': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, [IDS.solid], 0); },
		steps: [at(900, 'withheld'), at(1000, 'traced'), at(1100, 'mid-trace'), at(1200, 'its source raised, its route longer', raised), at(1300, 'still tracing'),
			at(1350, 'the network settles, every link redrawn, its route unchanged', (w) => w.host.redraw()), at(1499, 'its last instant'), at(1500, 'its end'), at(1600, 'after')],
		event: { step: 'its source raised, its route longer', id: IDS.solid, rerouted: true },
	},
	'a structural change mid-trace: the line gains a head': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, [IDS.solid], 0); },
		steps: [at(900, 'withheld'), at(1000, 'traced'), at(1100, 'mid-trace'), at(1200, 'directed forward', (w) => w.model.set('link', IDS.solid, { direction: 'forward' })), at(1300, 'still tracing'),
			at(1499, 'its last instant'), at(1500, 'its end'), at(1600, 'after')],
		event: { step: 'directed forward', id: IDS.solid },
	},
	'a mode change each way mid-trace': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, [IDS.solid, IDS.device], 0); w.model.state.reveal.beats.push({ interval: 0, ids: [IDS.waypoint] }); },
		steps: [at(900, 'withheld'), at(1000, 'traced'), at(1100, 'mid-trace'), at(1150, 'to edit mode', (w) => w.renderer.setMode('edit')), at(1200, 'to run mode', (w) => w.renderer.setMode('run')),
			at(1250, 'back to view', (w) => w.renderer.setMode('view')), at(1499, 'its last instant'), at(1500, 'its end'), at(1600, 'after')],
		event: { step: 'to edit mode', id: IDS.solid },
	},
	'deletion and undo mid-trace, its route changed while it was gone': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, [IDS.solid], 0); },
		steps: [at(900, 'withheld'), at(1000, 'traced'), at(1100, 'mid-trace'),
			at(1150, 'deleted, then its source raised', (w) => { w.held = structuredClone(w.model.get('link', IDS.solid)); w.model.del('link', IDS.solid); raised(w); }),
			at(1200, 'restored, drawn afresh on the longer route', (w) => w.model.put('link', w.held)), at(1300, 'mid'), at(1499, 'its last instant'), at(1500, 'its instant'), at(1600, 'after')],
		event: { step: 'restored, drawn afresh on the longer route', id: IDS.solid, rerouted: true },
	},
	'a load mid-trace, the document loaded on another route': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, [IDS.solid, IDS.control], 300); },
		steps: [at(900, 'both withheld'), at(1000, 'the solid link traced'), at(1100, 'mid-trace, the control link withheld'),
			at(1150, 'the document loaded again, the record with it, the device raised', (w) => {
				const doc = board(); doc.reveal = BEAT(1000, [IDS.solid, IDS.control], 300);
				doc.nodes = doc.nodes.map((n) => (n.id === IDS.device ? { ...n, y: n.y - RAISE } : n));
				w.model.load(doc);
			}),
			at(1300, 'the control link revealed'), at(1499, 'the solid link\'s last instant'), at(1500, 'the solid link\'s instant'), at(1799, 'the control link\'s last instant'), at(1800, 'its end'), at(1900, 'after')],
		event: { step: 'the document loaded again, the record with it, the device raised', id: IDS.solid, rerouted: true },
	},
	'the record gone mid-beat: what was withheld is shown, links traced': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, REVEALED); },
		steps: [at(1100, 'early: the solid link withheld'), at(1300, 'the solid link traced'), at(1350, 'the record gone', (w) => { w.model.state.reveal = null; }), at(1600, 'the last traces running'),
			at(1799, 'the solid link\'s last instant'), at(1800, 'its end'), at(1849, 'the others\' last instant'), at(1850, 'their end'), at(2000, 'after')],
		event: { step: 'the record gone', id: IDS.solid },
	},
	'velocity mode: the duration is the length over the speed, kept when the route changes': {
		setup: (w) => { w.reveal.trace = { mode: 'velocity', pxPerMs: 0.05 }; w.model.state.reveal = BEAT(1000, [IDS.solid, IDS.control], 0); },
		steps: [at(900, 'both withheld'), at(1000, 'both traced'), at(1100, 'mid'), at(1200, 'its source raised, its route longer', raised), at(1400, 'later'),
			at(1849, 'their last instant'), at(1850, 'their end'), at(3000, 'after')],
		event: { step: 'its source raised, its route longer', id: IDS.solid, rerouted: true },
	},
	'a closed directed ring, its line offset': {
		setup: (w) => { w.model.state.reveal = BEAT(1000, [IDS.ring], 0); },
		steps: [at(900, 'withheld'), at(1000, 'traced'), at(1250, 'mid'), at(1499, 'its last instant'), at(1500, 'its end'), at(1600, 'after')],
		event: { step: 'mid', id: IDS.ring },
	},
};
// every id a scenario's reveal names, so its items are read whole
const idsOf = () => [...new Set([...REVEALED, IDS.ring, ...Object.values(IDS)])];

export function runScenario(scenario) {
	const w = world();
	const ids = idsOf();
	scenario.setup(w);
	const steps = [];
	for (const [label, t, action] of scenario.steps) {
		w.clock.t = t;
		action(w);
		w.reveal.paint();
		steps.push({ label, t, caption: w.said.caption, layers: read(w, ids) });
	}
	return { steps, traces: w.traces, hides: w.hides };
}

export function recordAll() {
	return { writtenFrom: WRITTEN_FROM, exports: exportsOf(), scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([id, s]) => [id, runScenario(s)])) };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1] && process.argv[2] === '--write') {
	const rec = recordAll();
	fs.writeFileSync(TRACE_RECORD, `${JSON.stringify(rec, null, '\t')}\n`);
	console.log(`trace-record: ${Object.keys(rec.exports).length} export(s); ${Object.keys(rec.scenarios).length} scenario(s), ${Object.values(rec.scenarios).reduce((n, s) => n + s.steps.length, 0)} step(s)`);
}
