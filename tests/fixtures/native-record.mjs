/*
H26.8 (dev/design/components/NATIVE-SHAPES.md section 4.2; appendix A, "the record") -- THE RECORD THE DRAWING MOVES ANSWER TO, AS
PRODUCTION'S CODE DRAWS IT.

Written once, by running this file against a fresh `git archive ca492da` outside the repository, node modules linked, and committed
alone; never regenerated. A move's expectations are the record and the differences section 4.2 allows that move, never its own output:
`compareScenario` holds a live run to the record under each move's allowances, cumulatively -- `trace`, then `painters`, then `pipes`.
Move 2's reveal record (tests/fixtures/trace-record.mjs) is kept beside this one, not folded in: it is that move's guard, verified and in
production, and this record's marks group holds the reveal's marks across the boundaries NS13 names, which that one does not.

WHAT IT RUNS: the page's composition in Node, as app/src/main.js composes it -- `composeCanvas` (the model and its relations, the
selection, the commit boundary, the renderer, Input and its overlay, the held tools and the one crosshair), the page's network attached
as the page attaches it with its host hooks, and the movers and the reveal wired as the page wires them -- over a document with the
platform's semantics where draw's drawing code could tell (`makeDocument`), at fixed clock instants, a path's length the deterministic
stand-in `lengthOf`. No timer and no frame runs by itself: a step's own calls, and the owners' passes and frames the step asks for.
What it reads after each step is the scene's items, layer by layer, and for a foreign layer -- the network's pipes, the movers -- the
content beneath the element the scene answers for it; never the composition's elements.

WHAT IT DRIVES: only calls `ca492da` answers -- a load, the commit boundary's edits and an answer's ops, the network's hooks, the
selection, the overlay's hover and arming, Input's idle affordance, the held tools, the reveal's passes and the movers' frames. A call
whose owner the painters move changes goes through `STATES`, the two-line adapter 4.2 names: a state set on the renderer at `ca492da`,
on `editing-states.js` after.

  scenarios       each scenario of 4.2's table, by group -- loads, pipe triggers alone and combined, states, marks, the healed link,
                  the transient targets -- and one group beyond it, changes in place, which the coverage needs: each a document loaded
                  and steps, and what it must be seen to exercise (`proves`)
  runScenario     one scenario, live: each step's reading
  recordAll       every scenario and every document's export, as written to native-record.json
  compareScenario a live run against the record under a move's allowances (`MOVES`): the problems, none when it holds -- and
                  first the record's own proof, so a scenario that exercises nothing fails before anything is compared
  coverageOf      which lines of the drawing modules make a shape or write an attribute (`writingSites`), and how often each ran

THE RECORD, native-record.json:
  writtenFrom     ca492da
  archive         every module of the archive the recording loaded, by its SHA-256 -- to hold the archive to ca492da's tree
  coverage        each measured module (`MEASURED`): its SHA-256, its writing sites and how many ran, the sites no page reaches
                  (`UNREACHABLE`, each with why), its code lines and how many ran
  exports         each stored document's and coverage board's export, by its bytes' SHA-256
  scenarios       by name: its group; each trace a show began and each hide, with the step it fell in; and each step -- its label,
                  instant, mode and boundary, the model's events, a load's puts by kind, its layers as a delta of the step before
                  (`layersAt` rebuilds each in full: every item `[key, shapes]` in order, keys as `keyOf` reads them), the states
                  and marks the owners hold (`held`, `marks`), the caption, and what the step answered (`note`)

  node tests/fixtures/native-record.mjs --write    in the archive: records, measures Node's coverage of the drawing modules while it
                                                   does, refuses an unreached site or an unproved scenario, and writes the record
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';
import { productKinds } from '../../product/kinds.mjs';
import { COMPOSED_KINDS } from '../../product/types.mjs';
import { PRODUCT_CANVAS, CANVAS_SCENE, FOREIGN_LAYERS } from '../../product/canvas.mjs';
import { NETWORK_ROWS } from '../../plugins/network/kinds.mjs';
import { createPageNetwork } from '../../plugins/network/page.mjs';
import { createNetworkSession } from '../../plugins/network/session.mjs';
import { pipeEntity, pipeId } from '../../plugins/network/pipe-kind.mjs';
import { NETWORK_REFLECTS } from '../../plugins/network/selection-reflects.mjs';
import { commit } from '../../planner/txn.mjs';
import { Log } from '../../planner/log.mjs';
import { applyAnswer } from '../../app/src/changes.js';
import { editOf } from '../../app/src/commands.js';
import { RUN_PRESSES } from '../../app/src/run-mode.js';
import * as composition from '../../app/src/compose-canvas.js';
import * as painter from '../../app/src/painter.js';
import { Movers } from '../../plugins/simulation/mover-painter.mjs';
import { Reveal } from '../../plugins/simulation/reveal-painter.mjs';
import { traceOf } from '../../plugins/simulation/reveal.mjs';
import { svgDocument } from '../../server/svg.mjs';
import { parityBoard } from '../../tools/probe/boards.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const NATIVE_RECORD = new URL('./native-record.json', import.meta.url);
export const WRITTEN_FROM = 'ca492da';
export const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const PAGE_KINDS = productKinds(...NETWORK_ROWS);   // the kinds the page composes (app/src/main.js)

// the stand-in for draw's probe: a path's length from its `d` (4.2: a deterministic path length), the same as move 2's record
export const lengthOf = (d) => String(d ?? '').length * 3 + 0.5;

/*
THE ADAPTER (section 4.2): a state the record sets directly on its owner -- a link end's drag state, which Input's handle gesture sets
on the renderer at `ca492da` and on `editing-states.js` after the painters move. Every other state the record sets through the owner
that sets it on the page: the overlay's hover and arming, Input's idle affordance, the selection.
*/
const STATES = { set: (w, id, cls, on) => w.renderer.setState(id, cls, on) };

// ---- the platform: a document with its semantics where draw's drawing code could tell, and no timer or frame running by itself

const tokensOf = (value) => [...new Set(String(value ?? '').split(/[\t\n\f\r ]+/).filter(Boolean))];
const dataName = (key) => `data-${String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const cssName = (key) => String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const declarationsOf = (text) => { const out = new Map(); for (const p of String(text ?? '').split(';')) { const at = p.indexOf(':'); if (at > 0) out.set(p.slice(0, at).trim(), p.slice(at + 1).trim()); } return out; };
const matcherOf = (sel) => {
	const id = sel.match(/^#([\w-]+)$/)?.[1] ?? sel.match(/^\[id="([^"]*)"\]$/)?.[1];
	const cls = sel.match(/^\.([\w-]+)$/)?.[1], attr = sel.match(/^\[([\w-]+)="([^"]*)"\]$/), tag = /^[a-z]+$/i.test(sel) ? sel : null;
	return (n) => (id !== undefined ? n.attrs.id === id : cls ? tokensOf(n.attrs.class).includes(cls) : attr ? n.attrs[attr[1]] === attr[2] : tag ? n.tag === tag : false);
};
const walkTree = (n, hit, one, out = []) => {
	for (const c of n.children) { if (hit(c)) { out.push(c); if (one) return out; } walkTree(c, hit, one, out); if (one && out.length) return out; }
	return out;
};
/*
A DOM-shaped tree, as tests/fixtures/scene-parity.mjs's: one class state, read and written through the attribute and a DOMTokenList;
appendChild and insertBefore detaching a node first; textContent; isConnected; the selectors draw uses. Each element's `style` written
into its attribute, as a page's is; each path answering `getTotalLength` with the stand-in, as draw's probe measures on the page; and
`animate` answering a WAAPI animation that draws nothing, for the movers' packets, whose motion is no attribute.
*/
export function makeDocument() {
	const top = { children: [], parentNode: null, attrs: {} };
	const doc = {};
	const make = (tag) => {
		const node = {
			tag, tagName: tag, attrs: {}, children: [], parentNode: null, text: '', ownerDocument: doc,
			classList: {
				add(...cs) { const list = tokensOf(node.attrs.class); for (const c of cs) if (!list.includes(c)) list.push(c); writeClass(list); },
				remove(...cs) { writeClass(tokensOf(node.attrs.class).filter((c) => !cs.includes(c))); },
				toggle(c, force) {
					const list = tokensOf(node.attrs.class);
					if (list.includes(c)) { if (force === undefined || force === false) { writeClass(list.filter((x) => x !== c)); return false; } return true; }
					if (force === undefined || force === true) { list.push(c); writeClass(list); return true; }
					return false;
				},
				contains(c) { return tokensOf(node.attrs.class).includes(c); },
			},
			get dataset() { return new Proxy({}, { get: (_, k) => node.attrs[dataName(k)], set: (_, k, v) => { node.setAttribute(dataName(k), v); return true; } }); },
			get style() { return new Proxy({}, {
				get: (_, k) => declarationsOf(node.attrs.style).get(cssName(k)) ?? '',
				set: (_, k, v) => { const d = declarationsOf(node.attrs.style); if (v === '' || v == null) d.delete(cssName(k)); else d.set(cssName(k), String(v)); node.setAttribute('style', [...d].map(([p, x]) => `${p}: ${x};`).join(' ')); return true; },
			}); },
			get isConnected() { let p = node; while (p.parentNode) p = p.parentNode; return p === top; },
			get firstElementChild() { return node.children[0] ?? null; },
			get textContent() { return node.children.length ? node.children.map((c) => c.textContent).join('') : node.text; },
			set textContent(v) { for (const c of node.children) c.parentNode = null; node.children = []; node.text = v == null ? '' : String(v); },
			set innerHTML(_v) { for (const c of node.children) c.parentNode = null; node.children = []; node.text = ''; },
			setAttribute(k, v) { node.attrs[k] = String(v); },
			setAttributeNS(_ns, k, v) { node.setAttribute(k, v); },
			getAttribute(k) { return Object.hasOwn(node.attrs, k) ? node.attrs[k] : null; },
			hasAttribute(k) { return Object.hasOwn(node.attrs, k); },
			removeAttribute(k) { delete node.attrs[k]; },
			appendChild(c) { return node.insertBefore(c, null); },
			insertBefore(c, ref) {
				if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c);
				c.parentNode = node;
				const at = ref ? node.children.indexOf(ref) : -1;
				if (at < 0) node.children.push(c); else node.children.splice(at, 0, c);
				return c;
			},
			replaceChildren(...cs) { for (const c of node.children) c.parentNode = null; node.children = []; for (const c of cs) node.appendChild(c); },
			remove() { if (node.parentNode) node.parentNode.children = node.parentNode.children.filter((x) => x !== node); node.parentNode = null; },
			querySelector(sel) { return walkTree(node, matcherOf(sel), true)[0] ?? null; },
			querySelectorAll(sel) { return walkTree(node, matcherOf(sel), false); },
			getScreenCTM() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; } }; },
			getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }; },
			animate() { return { currentTime: 0, cancel() {} }; },
			addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, select() {},
		};
		if (tag === 'path') node.getTotalLength = () => lengthOf(node.attrs.d ?? '');
		const writeClass = (list) => { if (!Object.hasOwn(node.attrs, 'class') && !list.length) return; node.setAttribute('class', list.join(' ')); };
		return node;
	};
	doc.createElementNS = (_ns, tag) => make(tag);
	doc.createElement = (tag) => make(tag);
	doc.getElementById = (id) => walkTree(top, (n) => n.attrs?.id === id, true)[0] ?? null;
	doc.attach = (n) => { top.children.push(n); n.parentNode = top; return n; };
	return doc;
}

/*
The platform installed for one world and taken away after it: its document, and timers and frames that are kept and never run -- the
reveal's and the movers' loops start as on the page, and their passes and frames run when a step asks, so every instant is fixed.
*/
const PLATFORM_GLOBALS = ['document', 'requestAnimationFrame', 'cancelAnimationFrame', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'];
function installPlatform() {
	const was = Object.fromEntries(PLATFORM_GLOBALS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
	const doc = makeDocument();
	let n = 0;
	const never = () => ++n;
	Object.assign(globalThis, { document: doc, requestAnimationFrame: never, cancelAnimationFrame() {}, setInterval: never, clearInterval() {}, setTimeout: never, clearTimeout() {} });
	return { doc, restore() { for (const k of PLATFORM_GLOBALS) { if (was[k]) Object.defineProperty(globalThis, k, was[k]); else delete globalThis[k]; } } };
}

// ---- the page's composition, in Node

export const T0 = 1790000010000;   // the clock's instant at a world's start: the parity board's spawner, armed at 1790000000000, has packets in flight
const NS = 'http://www.w3.org/2000/svg';
/*
One world: app/src/main.js's composition, its parts in its order. The commit boundary's preview plans with the page's kinds, its apply
the page's; the network's edits reach it as the page's do; Input owns the overlay, the handles and what a load or a deletion drops.
The reveal is handed draw's probe, as the page hands it since move 2 (`ca492da`'s reveal measures through the renderer's platform,
which composeCanvas hands the same probe); here the probe answers the stand-in.
*/
export function world() {
	const platform = installPlatform();
	try {
		const doc = platform.doc;
		const root = doc.attach(doc.createElementNS(NS, 'svg'));
		const ground = doc.createElementNS(NS, 'rect'); ground.setAttribute('id', 'canvas'); root.appendChild(ground);
		const defs = doc.createElementNS(NS, 'defs');
		const clock = { t: T0 };
		const host = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
		const pageNetwork = createPageNetwork();
		const c = composition.composeCanvas({ svg: root, scene: CANVAS_SCENE, kinds: PAGE_KINDS, parts: PRODUCT_CANVAS, network: pageNetwork.network, plugins: pageNetwork.plugins,
			defs, host, readoutEl: null, tools: true, help: null, now: () => clock.t, runRules: RUN_PRESSES });
		const w = { platform, root, clock, ...c, session: pageNetwork.session, step: -1, events: [], traces: [], hides: [], aims: new Map(), puts: null };
		w.host = pageNetwork.attach({ model: c.model, renderer: c.renderer, selection: c.selection, edit: (label, entries) => c.history.commit(editOf(label, entries)),
			pipeLayer: c.scene.layerElement(FOREIGN_LAYERS.network), el: painter.el, pending: () => false, say: () => {} });
		/*
		The aim the movers hold for each tower, by what their frames write, dropped as NS13's table drops it -- with the tower, on a load,
		on leaving run mode -- before the movers' own listeners, which aim again within the same change.
		*/
		c.model.onChange((action, kind, entity) => { if (action === 'load') w.aims.clear(); if (action === 'del') w.aims.delete(entity?.id); });
		c.renderer.watchMode((m) => { if (m !== 'run') w.aims.clear(); });
		w.movers = new Movers({ model: c.model, renderer: c.renderer, layer: c.scene.layerElement(FOREIGN_LAYERS.simulation), now: () => clock.t, el: painter.el });
		const aimed = w.movers.aimTurrets.bind(w.movers);
		w.movers.aimTurrets = (wd, alive) => { const r = aimed(wd, alive); for (const t of wd.towers) { const g = w.movers.glyphOf(t.id); if (g?.dataset?.aim !== undefined) w.aims.set(t.id, g.dataset.aim); } return r; };
		c.renderer.watchMode(() => w.movers.sync());
		c.model.onChange(() => w.movers.sync());
		w.reveal = new Reveal({ model: c.model, renderer: c.renderer, now: () => clock.t, onCaption: (text) => { w.caption = text ?? null; }, lengthOf: painter.pathLengthOf });
		c.model.onChange(() => w.reveal.sync());
		// what the record reads beside the scene, none of it drawing: the model's events, each trace a show began and each hide
		c.model.onChange((action, kind, entity) => w.events.push([action, kind, action === 'load' ? null : entity?.id ?? null]));
		const show = w.reveal.show.bind(w.reveal), hide = w.reveal.hide.bind(w.reveal);
		w.reveal.show = (id) => {
			const dom = w.renderer.byId?.(id);
			if (dom && dom.tagName === 'path') { const len = lengthOf(dom.getAttribute('d')); if (len > 0) w.traces.push({ id, t: clock.t, step: w.step, len, ms: traceOf(w.reveal.trace, len).ms }); }
			return show(id);
		};
		w.reveal.hide = (id) => { if (w.renderer.byId?.(id)) w.hides.push({ id, t: clock.t, step: w.step }); return hide(id); };
		/*
		The states the owners hold, by what each asks of the renderer -- set, set off, cleared -- whatever the drawing then shows: what
		editing-states.js holds after the painters move, read here from the calls `ca492da` answers. The selection and its reflections
		are read from the selection itself (`heldStates`), since `ca492da`'s renderer forgets what it reflected on a load.
		*/
		w.states = new Map();
		const holds = (id) => { if (!w.states.has(id)) w.states.set(id, new Set()); return w.states.get(id); };
		if (typeof w.renderer.setState === 'function') {
			const setState = w.renderer.setState.bind(w.renderer), clearState = w.renderer.clearState.bind(w.renderer);
			w.renderer.setState = (id, cls, on) => { if (on) holds(id).add(cls); else holds(id).delete(cls); return setState(id, cls, on); };
			w.renderer.clearState = (id, ...classes) => { for (const cls of classes) holds(id).delete(cls); return clearState(id, ...classes); };
		}
		/*
		Each load's puts by kind -- an item made, one put again in place, one moved -- counted as tests/fixtures/scene-parity.mjs counts
		them, on the renderer's scene: the scene is frozen, so the renderer is handed one that counts and answers as it does.
		*/
		const scene = c.scene;
		const counted = { ...scene, put: (layer, key, shapes, place) => {
			if (w.puts) w.puts[!scene.items(layer).some((x) => x.key === key) ? 'new' : place && 'before' in place ? 'move' : 'patch']++;
			return scene.put(layer, key, shapes, place);
		} };
		if (c.renderer.scene === scene) c.renderer.scene = counted;
		w.reveal.sync();
		return w;
	} catch (e) { platform.restore(); throw e; }
}
function teardown(w) {
	try { w.reveal.stop(); w.movers.stop(); } finally { w.platform.restore(); }
}

// ---- reading

/*
A shape as the scene describes one -- tag, attributes in order, then its children or its text -- for an element of a foreign layer,
which its plugin draws on the platform.
*/
const shapeOf = (n) => ({ tag: n.tag, attrs: { ...n.attrs }, ...(n.children.length ? { children: n.children.map(shapeOf) } : n.text ? { text: n.text } : {}) });
const ENTITY = /^(node|link|zone|group|pipe)-/;
/*
An item's key as the record holds it, the same before a move and after: an entity's own item its id; a companion its entity's id and
its role, read from the class of what it draws (`link-x/link-head`), where `ca492da` keys it by a serial and the painters move by its
part; an editing visual its kind, where both key it by a serial too; a pipe's group, in the network's layer, its pipe's id.
*/
export function keyOf(layer, key, shapes) {
	const first = shapes[0];
	if (layer === FOREIGN_LAYERS.network && first?.attrs?.['data-pipe']) return first.attrs['data-pipe'];
	const m = /^(.*)\/[^/]+$/.exec(key);
	if (!m) return key;
	if (ENTITY.test(m[1])) return `${m[1]}/${tokensOf(first?.attrs?.class)[0] ?? first?.tag}`;
	return m[1];
}
// the layers the record reads: every layer of the scene but the grids, which the grid move answers for by its own record (4.1)
const READ = CANVAS_SCENE.layers.map((l) => l.name).filter((n) => !n.startsWith('grid-'));
// every layer's items now, each `[key, shapes]` in order; a foreign layer's content, its top-level elements as items
export function layersOf(w) {
	const out = {};
	for (const name of READ) {
		const foreign = w.scene.layers.find((l) => l.name === name)?.foreign;
		const items = foreign
			? w.scene.layerElement(name).children.map((n, i) => { const shapes = [shapeOf(n)]; return [keyOf(name, `${tokensOf(n.attrs.class)[0] ?? n.tag}/${i}`, shapes), shapes]; })
			: w.scene.items(name).map((it) => [keyOf(name, it.key, it.shapes), JSON.parse(JSON.stringify(it.shapes))]);
		out[name] = items;
	}
	return out;
}
// ---- the documents

// a board applied as the lab applies its boards: through the planner, its pipes ops of its own commit (lab/src/root.js FIXED BOARDS)
function applied(name, board) {
	const session = createNetworkSession();
	const authority = new Model({ kinds: COMPOSED_KINDS, attached: { network: session.network } });
	attachRelations(authority, { nearest: NODE_GRID.nearest });
	const answer = commit(authority, new Log(), { ops: [...board.ops, ...session.seed(board.pipes ?? [])], label: "seed" }, "lab", "lab", { kinds: COMPOSED_KINDS });
	if (!answer.ok) throw new Error(`board ${name} refused: ${answer.error}`);
	return authority.toJSON();
}
// the 18 stored documents: the templates, the parity board and the lab's boards, as the side-by-side and the export draw them
export function storedDocuments() {
	const dir = path.join(ROOT, 'templates');
	const out = fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort().map((f) => [`templates/${f}`, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]);
	out.push(['the parity board', parityBoard()]);
	const seeds = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/seeds.json'), 'utf8'));
	for (const [name, board] of Object.entries(seeds)) out.push([`lab ${name}`, applied(name, board)]);
	return out;
}
/*
The coverage boards (4.2; appendix B's measure, attr-orders-coverage.mjs): what the 18 documents never draw -- closed directed rings
forward and reverse, data and control; transit off on a device and on a waypoint; a panel with glyph, action, input and outlined
regions; a span without content; headed links up and down, data and control; a hand pipe and a link pipe.
*/
const putOp = (kind, entity) => ({ op: 'put', kind, entity });
const nodeOp = (id, x, y, o = {}) => putOp('node', { id, name: o.name ?? id.slice(-2), ...(o.bare ? {} : { type: o.type ?? 'router', shape: o.shape ?? 'circle' }), x, y, ...o.extra });
function ring(n, ox, direction, control) {
	const ids = [0, 1, 2, 3].map((i) => `node-0c${n}${i}00`);
	const ops = [[0, 0], [240, 0], [240, 240], [0, 240]].map(([x, y], i) => nodeOp(ids[i], ox + x, y, { bare: true }));
	ops.push(putOp('link', { id: `link-0c${n}000`, name: `ring-${direction}`, src: ids[0], dst: ids[3], via: [ids[1], ids[2]], closed: true, ...(control ? { control: true } : {}), direction }));
	return { ops, pipes: ids.map((id, i) => [id, ids[(i + 1) % 4], 'link']) };
}
const COVERAGE_BOARDS = {
	'a closed ring, forward, control': ring(1, 0, 'forward', true),
	'a closed ring, reverse, control': ring(2, 0, 'reverse', true),
	'a closed ring, forward, data': ring(3, 0, 'forward', false),
	'a closed ring, reverse, data': ring(4, 0, 'reverse', false),
	'transit off on a device and a waypoint': { ops: [nodeOp('node-0d0001', 0, 0, { extra: { transit: false } }), nodeOp('node-0d0002', 240, 120, { bare: true, extra: { transit: false } }), nodeOp('node-0d0003', 480, 0)], pipes: [] },
	'a panel with glyph, action, input and outlined regions; a span without content': { ops: [nodeOp('node-0e0001', 0, 0, { type: 'host', shape: 'square', name: '', extra: { span: { cols: 4, rows: 3 }, content: [
		{ at: [0, 0], cols: 1, rows: 1, content: 'glyph', glyph: 'router', action: 'help' },
		{ at: [1, 0], cols: 3, rows: 1, content: 'text', value: 'web-tier', align: 'left', outline: true, accent: '#4fc3f7' },
		{ at: [0, 1], cols: 2, rows: 1, content: 'text', value: 'type here', input: true },
		{ at: [2, 1], cols: 2, rows: 1, content: 'text', value: 'ping', action: 'ping' },
		{ at: [0, 2], cols: 1, rows: 1, content: 'glyph', glyph: 'switch' },
		{ at: [1, 2], cols: 3, rows: 1, content: 'text', value: 'online', align: 'center', outline: true, bg: '#aed581', fill: '#101010', rx: 13 },
	] } }), nodeOp('node-0e0002', 480, 0, { type: 'text', shape: 'square', name: 'note', extra: { span: { cols: 2, rows: 1 } } })], pipes: [] },
	'headed links up and down, data and control; a hand pipe and a link pipe': { ops: [nodeOp('node-0f0001', 0, 0), nodeOp('node-0f0002', 360, 0), nodeOp('node-0f0003', 0, 240), nodeOp('node-0f0004', 360, 240),
		putOp('link', { id: 'link-0f0001', name: 'up-data', src: 'node-0f0001', dst: 'node-0f0002', direction: 'forward' }),
		putOp('link', { id: 'link-0f0002', name: 'down-control', src: 'node-0f0003', dst: 'node-0f0004', direction: 'reverse', control: true }),
		putOp('link', { id: 'link-0f0003', name: 'down-data', src: 'node-0f0001', dst: 'node-0f0004', direction: 'forward' }),
		putOp('link', { id: 'link-0f0004', name: 'up-control', src: 'node-0f0003', dst: 'node-0f0002', direction: 'forward', control: true })],
		pipes: [['node-0f0001', 'node-0f0002', 'link'], ['node-0f0003', 'node-0f0002', 'hand']] },
};
export const coverageDocuments = () => Object.entries(COVERAGE_BOARDS).map(([name, b]) => [`coverage: ${name}`, applied(name, b)]);

/*
THE RECORD'S BOARD, for every group but the loads: the parity board, which holds a device of each look, a zone, a group, a panel, a
junction, links headed up and down, a spawning endpoint and a plain one, with --
  a waypoint `W` and two hand pipes, charlie to W (`H`, the pipe the triggers act on) and W to bravo, which no link runs over;
  a link from charlie to foxtrot, down until a pipe opens a way over H (`OVER`);
  a second link from alpha to bravo, down, held off its way by the first (`BLOCKED`, which the first is `blocking`);
  an undirected link from echo to delta, down without a head until a pipe heals it (`HEALS`, NS16);
  a tower beside the spawner's route, so the movers aim it in run mode.
*/
export const IDS = {
	device: 'node-fa00a1', charlie: 'node-fa00a3', bravo: 'node-fa00a2', delta: 'node-fa00a4', echo: 'node-fa00a5', foxtrot: 'node-fa00a6',
	waypoint: 'node-fa00b1', endpoint: 'node-fa00b3', spawner: 'node-fa00b2', W: 'node-fb00d1', tower: 'node-fb00c1',
	zone: 'zone-fa0001', group: 'group-fa0001', link: 'link-fa0001', blocker: 'link-fa0001', undirected: 'link-fa0005', down: 'link-fa0006',
	OVER: 'link-fb0003', BLOCKED: 'link-fb0001', HEALS: 'link-fb0002',
};
export const H = pipeId(IDS.charlie, IDS.W);
export function recordBoard() {
	const b = parityBoard();
	b.nodes.push({ id: IDS.W, name: 'w', x: 180, y: 120, order: 11 }, { id: IDS.tower, name: 'tower', type: 'loadbalancer', shape: 'circle', x: 480, y: -60, order: 12 });
	b.links.push({ id: IDS.BLOCKED, name: 'twin', src: IDS.device, dst: IDS.bravo, direction: 'forward', order: 11 },
		{ id: IDS.HEALS, name: 'heals', src: IDS.echo, dst: IDS.delta, order: 12 },
		{ id: IDS.OVER, name: 'over', src: IDS.charlie, dst: IDS.foxtrot, direction: 'forward', order: 13 });
	b.pipes.push(pipeEntity(IDS.charlie, IDS.W, 'hand'), pipeEntity(IDS.W, IDS.bravo, 'hand'));
	return b;
}

// ---- a scenario's run

/*
A step: its label, what it asks of the world at its instant, and where it stands -- `t` the clock's instant, held from the step
before when absent; `boundary` the NS13 boundary it is, when it is one: 'structural', 'mode', 'delete', 'undo', 'load', 'leave-run'.
*/
export const step = (label, action = () => {}, o = {}) => ({ label, action, ...o });
// the owners' own passes and frames, which no timer runs here: the reveal's pass, and the movers' frame -- their loops' bodies
export const pass = (w) => w.reveal.paint();
export const frame = (w) => { w.movers.fold(); w.movers.paint(); w.movers.trackBeams(); };
// the page's commit boundary, as an author's edit or the network's reaches it
export const edit = (w, label, entries) => { const done = w.history.commit({ label, entries }); if (!done?.length) throw new Error(`the planner refused "${label}"`); return done; };
export const E = {
	put: (kind, entity) => ({ op: 'put', kind, entity }),
	set: (kind, id, after) => ({ op: 'set', kind, id, after }),
	del: (w, kind, id) => ({ op: 'del', kind, entity: structuredClone(w.model.get(kind, id)) }),
};
// an answer the page applies (app/src/sync.js, the lab's door): its ops brought to the tab, then the network told
export const answer = (w, ops, request = { label: 'answer' }, version = 2) => { applyAnswer(w.model, w.selection, ops); w.host.settled(request, { ok: true, version, ops }); };
// the overlay's hover and arming, Input's idle affordance: as the pointer and the modifiers ask them on the page
export const hover = (w, kind, id, on = true) => w.input.overlayUi.hover({ kind, id }, on, {}, false);
export const idle = (w, kind, id) => w.input.idleAffordance({ on: { kind, id }, ctrlKey: false, altKey: false });
export const arm = (w, mods) => w.input.overlayUi.arm({ altKey: !!mods.alt, ctrlKey: !!mods.ctrl }, { readOnly: false, gesturing: false });
// a link end dragged, as Input's handle gesture marks it (through the adapter), and its end as the gesture's cancel or release asks
export const replug = (w, id, on = true) => STATES.set(w, id, 'replugging', on);
export const load = (w, doc) => w.model.load(structuredClone(doc));

function heldStates(w) {
	const held = new Map();
	const add = (id, cls) => { if (!held.has(id)) held.set(id, new Set()); held.get(id).add(cls); };
	const selected = new Set(w.selection.list());
	for (const id of selected) add(id, 'selected');
	for (const r of NETWORK_REFLECTS) for (const id of r.of(w.model, selected)) add(id, r.cls);
	const REFLECTED = new Set(['selected', ...NETWORK_REFLECTS.map((r) => r.cls)]);
	for (const [id, set] of w.states) for (const cls of set) if (!REFLECTED.has(cls)) add(id, cls);
	return Object.fromEntries([...held].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, s]) => [id, [...s].sort()]));
}

// items keyed uniquely within a layer: a key met again counts on (`#2`), which no layer of draw's holds but which must not merge
const keyed = (items) => { const seen = new Map(); return items.map(([k, s]) => { const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); return [n > 1 ? `${k}#${n}` : k, s]; }); };
// a step's layers against the step before: each layer that changed, its keys in order and the shapes of each key new or changed
function deltaOf(prev, now) {
	const out = {};
	for (const [layer, items] of Object.entries(now)) {
		const before = new Map(prev[layer] ?? []), keys = items.map(([k]) => k);
		const changed = Object.fromEntries(items.filter(([k, s]) => !before.has(k) || JSON.stringify(before.get(k)) !== JSON.stringify(s)));
		const sameKeys = prev[layer] && JSON.stringify(prev[layer].map(([k]) => k)) === JSON.stringify(keys);
		if (!sameKeys || Object.keys(changed).length) out[layer] = { keys, changed };
	}
	return out;
}
// each step's layers in full, from a scenario's deltas
export function layersAt(steps) {
	const out = [];
	let state = {};
	for (const s of steps) {
		const next = { ...state };
		for (const [layer, { keys, changed }] of Object.entries(s.layers)) {
			const before = new Map(state[layer] ?? []);
			next[layer] = keys.map((k) => [k, Object.hasOwn(changed, k) ? changed[k] : before.get(k)]);
		}
		out.push(next);
		state = next;
	}
	return out;
}

/*
One scenario, live: its document loaded at the first step, each step asked at its instant, and after each -- the clock, the mode, the
model's events, a load's puts by kind, every layer's items (as a delta), the states the owners hold (`held`), the marks the reveal and
the movers hold (`marks`), and the caption; and over the scenario, each trace a show began and each hide.
*/
export function runScenario(sc) {
	const w = world();
	try {
		const doc = sc.doc();
		const ctx = { doc };
		const steps = [];
		let prev = {};
		for (const s of sc.steps) {
			if (s.t !== undefined) w.clock.t = s.t;
			w.step = steps.length;
			w.events = [];
			const loading = s.loads === true;
			w.puts = loading ? { new: 0, patch: 0, move: 0 } : null;
			const note = s.action(w, ctx);
			const puts = w.puts; w.puts = null;
			const layers = layersOf(w);
			for (const l of Object.keys(layers)) layers[l] = keyed(layers[l]);
			steps.push({ label: s.label, t: w.clock.t, mode: w.renderer.mode, ...(s.boundary ? { boundary: s.boundary } : {}), events: w.events,
				...(puts ? { puts } : {}), layers: deltaOf(prev, layers), held: heldStates(w),
				marks: { unrevealed: [...w.reveal.hidden].sort(), aims: Object.fromEntries([...w.aims].sort(([a], [b]) => (a < b ? -1 : 1))) }, caption: w.caption ?? null,
				...(note !== undefined ? { note } : {}), ...(w.describes ? { describes: w.describes() } : {}) });
			prev = layers;
		}
		return JSON.parse(JSON.stringify({ steps, traces: w.traces, hides: w.hides }));
	} finally { teardown(w); }
}

// ---- what a scenario must be seen to do

const itemIn = (layers, key) => { for (const items of Object.values(layers)) { const f = items.find(([k]) => k === key); if (f) return f[1]; } return null; };
export const ownOf = (layers, id) => itemIn(layers, id)?.[0] ?? null;
export const classOf = (shape) => tokensOf(shape?.attrs?.class);
const pipeGroupOf = (layers, id) => (layers[FOREIGN_LAYERS.network] ?? []).find(([k]) => k === id)?.[1][0] ?? null;
export const pipeLineOf = (layers, id) => pipeGroupOf(layers, id)?.children?.find((c) => c.attrs?.id === id) ?? null;
const under = (layers, id) => classOf(pipeGroupOf(layers, id)).includes('under');
function* shapesIn(layers) {
	const walk = function* (layer, s) { yield [layer, s]; for (const c of s.children ?? []) yield* walk(layer, c); };
	for (const [layer, items] of Object.entries(layers)) for (const [, shapes] of items) for (const s of shapes) yield* walk(layer, s);
}
const anyShape = (layers, test) => { for (const [layer, s] of shapesIn(layers)) if (test(s, layer)) return true; return false; };
const has = (s, cls) => classOf(s).includes(cls);
const at = (rec, label) => { const k = rec.steps.findIndex((s) => s.label === label); if (k < 0) throw new Error(`no step "${label}"`); return k; };
const itemCount = (layers) => Object.entries(layers).reduce((n, [, items]) => n + items.length, 0);
// a scenario's proof: each claim and whether it holds, its failures named
const claims = (...list) => list.filter(([ok]) => !ok).map(([, what]) => what);

// ---- the scenarios, by group (section 4.2's table)

const loadStep = (label, o = {}) => step(label, (w, { doc }) => load(w, doc), { loads: true, ...o });
const mode = (m) => (w) => w.renderer.setMode(m);
const BEAT = (origin, ids, interval = 0) => ({ origin, beats: [{ interval, caption: 'the beat', ids }] });

/*
LOADS: each stored document and each coverage board, loaded in view, in edit and in run -- each layer's trees, attributes in order,
after each step; each load's puts by kind; and each document's export, its bytes' SHA-256 (`recordAll`).
*/
const FEATURES = {
	'coverage: a closed ring, forward, control': (L) => [[anyShape(L, (s) => has(s, 'link') && s.attrs['stroke-dasharray'] && s.attrs['stroke-dashoffset'] !== undefined), 'a dashed closed ring drawn with its offset'], [anyShape(L, (s) => has(s, 'link-head')), 'its head']],
	'coverage: a closed ring, reverse, control': (L) => [[anyShape(L, (s) => has(s, 'link') && s.attrs['stroke-dasharray'] && s.attrs['stroke-dashoffset'] !== undefined), 'a dashed closed ring drawn with its offset'], [anyShape(L, (s) => has(s, 'link-head')), 'its head']],
	'coverage: a closed ring, forward, data': (L) => [[anyShape(L, (s) => has(s, 'link') && !s.attrs['stroke-dasharray'] && s.attrs.d?.includes('Q')), 'a solid closed ring'], [anyShape(L, (s) => has(s, 'link-head')), 'its head']],
	'coverage: a closed ring, reverse, data': (L) => [[anyShape(L, (s) => has(s, 'link') && !s.attrs['stroke-dasharray'] && s.attrs.d?.includes('Q')), 'a solid closed ring'], [anyShape(L, (s) => has(s, 'link-head')), 'its head']],
	'coverage: transit off on a device and a waypoint': (L) => [[anyShape(L, (s, l) => l === 'nodes' && has(s, 'wp-transit')), 'a device\'s transit ring'], [anyShape(L, (s, l) => l === 'waypoints' && has(s, 'wp-transit')), 'a waypoint\'s']],
	'coverage: a panel with glyph, action, input and outlined regions; a span without content': (L) => [
		[anyShape(L, (s) => has(s, 'clickable') && s.attrs['data-action'] !== undefined), 'an action region'], [anyShape(L, (s) => has(s, 'clickable') && s.attrs['data-input'] !== undefined), 'an input region'],
		[anyShape(L, (s) => has(s, 'content-box')), 'an outlined region'], [anyShape(L, (s) => s.tag === 'svg' && s.attrs.viewBox && s.children?.some((c) => c.attrs?.['data-layer'] === 'glyph')), 'a glyph region'],
		[anyShape(L, (s) => has(s, 'node') && s.attrs['data-span'] !== undefined && s.attrs['data-content'] === undefined), 'a span without content']],
	'coverage: headed links up and down, data and control; a hand pipe and a link pipe': (L) => [
		[anyShape(L, (s) => has(s, 'link-head') && s.attrs['data-down'] !== undefined), 'a down link\'s head'], [anyShape(L, (s) => has(s, 'link-head') && s.attrs['data-down'] === undefined), 'an up link\'s head'],
		[anyShape(L, (s) => has(s, 'link-leg') && s.attrs['stroke-dasharray']), 'a dashed leg'], [anyShape(L, (s) => has(s, 'pipe-hand')), 'a hand pipe'], [anyShape(L, (s) => has(s, 'pipe-hit')), 'its hit line'], [anyShape(L, (s) => has(s, 'pipe-link')), 'a link pipe']],
};
function loadScenario(name, doc) {
	return { group: 'loads', name: `loads: ${name}`, doc: () => doc, steps: [
		loadStep('loaded in view'), step('to edit mode', mode('edit'), { boundary: 'mode' }), loadStep('loaded in edit'),
		step('to run mode', mode('run'), { boundary: 'mode' }), loadStep('loaded in run'), step('back to view', mode('view'), { boundary: 'mode' }),
	], proves: (rec, L) => claims(
		...['loaded in view', 'loaded in edit', 'loaded in run'].flatMap((label) => { const k = at(rec, label); return [[rec.steps[k].puts?.new > 0, `${label}: items put`], [rec.steps[k].events.some(([a]) => a === 'load'), `${label}: the model loaded`]]; }),
		[['view', 'edit', 'run'].every((m, i) => rec.steps[at(rec, `loaded in ${m}`)].mode === m), 'each load in its mode'],
		[itemCount(L[0]) > 0, 'the document drew items'],
		...(FEATURES[name]?.(L[0]) ?? [])) };
}

// a trigger authored in the tab, then its answer settling the network -- the two calls the page makes for an edit of its own
const authored = (label, entries) => [
	step(label, (w) => { edit(w, label, entries(w)); }),
	step(`${label}: its answer settles the board`, (w) => w.host.settled({ label }, { ok: true, version: 2, ops: [] })),
];
const settledLabel = (label) => `${label}: its answer settles the board`;
const recordDoc = () => recordBoard();
const withReveal = (reveal) => () => ({ ...recordBoard(), reveal });

/*
PIPE TRIGGERS, each alone, on the record's board, and combined -- the trees after each step, which hold each pipe's group, line and hit
line as the network draws them: the descriptions the pipes move compares, its describe counts read from each step's events.
*/
const PIPE_TRIGGERS = {
	'a hand pipe made': { steps: authored('a hand pipe made', () => [E.put('pipe', pipeEntity(IDS.charlie, IDS.endpoint, 'hand'))]),
		proves: (rec, L) => { const k = at(rec, 'a hand pipe made'); const id = pipeId(IDS.charlie, IDS.endpoint); return claims([!pipeGroupOf(L[k - 1], id) && pipeGroupOf(L[k], id)?.children?.some((c) => has(c, 'pipe-hit')), 'a hand pipe drawn where none was, with its hit line']); } },
	/*
	A hand pipe laid again by a link: a link drawn along it, its w drag laying the same pair, which leaves a hand pipe as it was -- "a
	hand pipe a link lays over ... changes nothing" (plugins/network/session.mjs `pipeEntries`); the pipe drawn under the link.
	*/
	'a hand pipe made, then laid again by a link': { steps: [...authored('a hand pipe made', () => [E.put('pipe', pipeEntity(IDS.charlie, IDS.endpoint, 'hand'))]),
		...authored('laid again by a link drawn along it', () => [E.put('link', { id: 'link-fb0006', name: 'along', src: IDS.charlie, dst: IDS.endpoint, direction: 'forward' })])],
		proves: (rec, L) => { const id = pipeId(IDS.charlie, IDS.endpoint), k = at(rec, settledLabel('laid again by a link drawn along it'));
			return claims([has(pipeLineOf(L[at(rec, 'a hand pipe made')], id), 'pipe-hand'), 'a hand pipe made'], [has(pipeLineOf(L[k], id), 'pipe-hand') && under(L[k], id), 'still a hand pipe, now under the link laid along it']); } },
	// and the reverse the network allows, a link pipe laid again by hand: its look changes and it gains its hit line (plugins/network/host.mjs `paint`)
	'a link pipe laid again by hand': { steps: authored('laid again by hand', () => [E.set('pipe', pipeId(IDS.device, IDS.bravo), { laid: 'hand' })]),
		proves: (rec, L) => { const id = pipeId(IDS.device, IDS.bravo), k = at(rec, 'laid again by hand');
			return claims([has(pipeLineOf(L[k - 1], id), 'pipe-link') && !pipeGroupOf(L[k - 1], id).children.some((c) => has(c, 'pipe-hit')), 'a link pipe, no hit line, before'],
				[has(pipeLineOf(L[k], id), 'pipe-hand') && pipeGroupOf(L[k], id).children.some((c) => has(c, 'pipe-hit')), 'a hand pipe with its hit line after']); } },
	'a hand pipe deleted': { steps: authored('deleted', (w) => [E.del(w, 'pipe', H)]),
		proves: (rec, L) => { const k = at(rec, 'deleted'); return claims([pipeGroupOf(L[k - 1], H) && !pipeGroupOf(L[k], H), 'drawn, then gone']); } },
	'its endpoint moved, no link changed': { steps: authored('its endpoint moved', () => [E.set('node', IDS.W, { x: 300 })]),
		proves: (rec, L) => { const k = at(rec, 'its endpoint moved'); return claims([JSON.stringify(pipeLineOf(L[k - 1], H)?.attrs) !== JSON.stringify(pipeLineOf(L[k], H)?.attrs), 'its line moved'], [!rec.steps[k].events.some(([, kind]) => kind === 'link'), 'no link changed']); } },
	'an up link made over it, and deleted': { steps: [...authored('an up link made over it', () => [E.put('link', { id: 'link-fb0004', name: 'onto', src: IDS.charlie, dst: IDS.W, direction: 'forward' })]),
		...authored('the link deleted', (w) => [E.del(w, 'link', 'link-fb0004')])],
		proves: (rec, L) => claims([!under(L[at(rec, 'an up link made over it') - 1], H), 'not under at first'], [under(L[at(rec, settledLabel('an up link made over it'))], H), 'under once the link runs over it'], [!under(L[at(rec, settledLabel('the link deleted'))], H), 'not under once it goes']) },
	'a link rerouted onto it': { steps: authored('a link rerouted onto it', () => [E.set('link', 'link-fa0007', { src: IDS.charlie })]),
		proves: (rec, L) => claims([!under(L[at(rec, 'a link rerouted onto it') - 1], H) && under(L[at(rec, settledLabel('a link rerouted onto it'))], H), 'under once a link is rerouted over it'], [rec.steps[at(rec, 'a link rerouted onto it')].events.some(([a, kind]) => a === 'set' && kind === 'link'), 'by a set of the link']) },
	'another pipe opening a route, and swept': { steps: [...authored('another pipe opens a route over it', () => [E.put('pipe', pipeEntity(IDS.W, IDS.foxtrot, 'link'))]),
		...authored('the route\'s link deleted, the pipe swept', (w) => [E.del(w, 'link', IDS.OVER)])],
		proves: (rec, L) => { const swept = rec.steps[at(rec, 'the route\'s link deleted, the pipe swept')];
			return claims([under(L[at(rec, settledLabel('another pipe opens a route over it'))], H), 'under once the other pipe opens the over link\'s way'],
				[swept.events.some(([a, kind, id]) => a === 'del' && kind === 'pipe' && id === pipeId(IDS.W, IDS.foxtrot)), 'the other pipe swept'], [!under(L[at(rec, settledLabel('the route\'s link deleted, the pipe swept'))], H), 'not under after']); } },
	'a transit off and on': { steps: [...authored('a pipe opens the over link\'s way through W', () => [E.put('pipe', pipeEntity(IDS.W, IDS.foxtrot, 'hand'))]),
		step('transit off at W', (w) => { w.session.toggleTransit([{ kind: 'node', ...w.model.get('node', IDS.W) }]); w.host.settled({ label: 'transit' }, { ok: true, version: 3, ops: [] }); }),
		step('transit on at W', (w) => { w.session.toggleTransit([{ kind: 'node', ...w.model.get('node', IDS.W) }]); w.host.settled({ label: 'transit' }, { ok: true, version: 4, ops: [] }); })],
		proves: (rec, L) => claims([rec.steps[at(rec, 'transit off at W')].events.some(([a, kind, id]) => a === 'set' && id === IDS.W), 'W\'s transit set off'],
			[under(L[at(rec, 'transit off at W') - 1], H) && !under(L[at(rec, 'transit off at W')], H), 'the route over H cut at W'], [under(L[at(rec, 'transit on at W')], H), 'and run over it again once W passes']) },
	'a load': { steps: [loadStep('loaded again')],
		proves: (rec, L) => claims([rec.steps[1].events.some(([a]) => a === 'load'), 'the model loaded'], [JSON.stringify(L[1][FOREIGN_LAYERS.network]) === JSON.stringify(L[0][FOREIGN_LAYERS.network]) && L[1][FOREIGN_LAYERS.network].length > 0, 'the pipes drawn again as before']) },
	'an answer accepted with links listed before pipes': { steps: [step('an answer: a link, then the pipe its way needs', (w) => answer(w, [
		{ op: 'put', kind: 'link', entity: { id: 'link-fb0005', name: 'answered', src: IDS.charlie, dst: IDS.endpoint, direction: 'forward', order: 20 } },
		{ op: 'put', kind: 'pipe', entity: pipeEntity(IDS.charlie, IDS.endpoint, 'hand') }]))],
		proves: (rec, L) => { const k = 1, ev = rec.steps[k].events.map(([a, kind]) => `${a} ${kind}`);
			return claims([ev.indexOf('put link') >= 0 && ev.indexOf('put link') < ev.indexOf('put pipe'), 'the link applied before the pipe'], [ownOf(L[k], 'link-fb0005') && ownOf(L[k], 'link-fb0005').attrs['data-down'] === undefined, 'the link drawn up once the board settles']); } },
	'an answer refused': { steps: [...authored('a hand pipe made in the tab', () => [E.put('pipe', pipeEntity(IDS.charlie, IDS.endpoint, 'hand'))]).slice(0, 1),
		step('refused: the planner\'s document taken back, then the network told', (w, { doc }) => { load(w, doc); w.host.refused({ ok: false, error: 'the record refuses it' }); }, { loads: true })],
		proves: (rec, L) => claims([pipeGroupOf(L[1], pipeId(IDS.charlie, IDS.endpoint)) && !pipeGroupOf(L[2], pipeId(IDS.charlie, IDS.endpoint)), 'the tab\'s pipe drawn, then gone with the refusal']) },
	'a board seeded': { steps: [step('a board seeded', (w) => { w.host.seed([[IDS.charlie, IDS.endpoint, 'hand'], [IDS.echo, IDS.delta, 'link']], (ops) => edit(w, 'seed', ops.map((o) => E.put(o.kind, o.entity)))); })],
		proves: (rec, L) => claims([pipeGroupOf(L[1], pipeId(IDS.charlie, IDS.endpoint)) && pipeGroupOf(L[1], pipeId(IDS.echo, IDS.delta)), 'the seeded pipes drawn']) },
	// a g drag along H, which exists: no link made, no anchor kept, no pipe laid -- so nothing commits and the board settles at once
	'a drag judged with no commit': { steps: [step('a drag judged, nothing committed', (w) => {
		const facts = { src: IDS.charlie, dst: IDS.W, pins: [], guides: [IDS.W], placed: [], stops: [IDS.charlie, IDS.W], pressed: { w: false, g: true }, endPressed: 'g', srcKey: false };
		const verdict = w.host.judge(facts);
		return { ok: verdict.ok, entries: verdict.entries.length };
	})], proves: (rec) => claims([rec.steps[1].events.length === 0, 'no model event: nothing committed'], [rec.steps[1].note?.ok === false && rec.steps[1].note?.entries === 0, 'the judge made no link and laid no pipe']) },
	'run mode and back': { steps: [step('to run mode', mode('run'), { boundary: 'mode' }), step('back to view', mode('view'), { boundary: 'mode' })],
		proves: (rec, L) => claims([L[0][FOREIGN_LAYERS.network].length > 0 && L[1][FOREIGN_LAYERS.network].length === 0, 'no pipe in run mode'], [JSON.stringify(L[2][FOREIGN_LAYERS.network]) === JSON.stringify(L[0][FOREIGN_LAYERS.network]), 'every pipe back after']) },
	'the pipe selected, hovered and armed': { steps: [step('selected', (w) => w.selection.set([H])), step('hovered', (w) => hover(w, 'pipe', H)), step('armed', (w) => arm(w, { alt: true })),
		step('disarmed and unhovered', (w) => { w.input.overlayUi.disarm(); hover(w, 'pipe', H, false); }), step('deselected', (w) => w.selection.set([]))],
		proves: (rec, L) => claims([has(pipeLineOf(L[at(rec, 'selected')], H), 'selected'), 'its line selected'], [has(pipeLineOf(L[at(rec, 'hovered')], H), 'hover'), 'hovered'], [has(pipeLineOf(L[at(rec, 'armed')], H), 'armed'), 'armed'],
			[!has(pipeLineOf(L[at(rec, 'deselected')], H), 'selected'), 'and let go']) },
};
const PIPE_COMBINED = {
	'one commit moving an endpoint, making a link and sweeping a pipe': { steps: authored('one commit: W moved, a link made over H, the pipe W to bravo deleted', (w) => [
		E.set('node', IDS.W, { y: 180 }), E.put('link', { id: 'link-fb0004', name: 'onto', src: IDS.charlie, dst: IDS.W, direction: 'forward' }), E.del(w, 'pipe', pipeId(IDS.W, IDS.bravo))]),
		proves: (rec, L) => { const label = 'one commit: W moved, a link made over H, the pipe W to bravo deleted'; const ev = rec.steps[at(rec, label)].events.map(([a, kind]) => `${a} ${kind}`);
			return claims([ev.includes('set node') && ev.includes('put link') && ev.includes('del pipe'), 'a node set, a link put and a pipe deleted in one step'], [under(L[at(rec, settledLabel(label))], H), 'H run over after']); } },
	'a mode change with a pipe hovered and selected': { steps: [step('selected and hovered', (w) => { w.selection.set([H]); hover(w, 'pipe', H); }), step('to edit mode', mode('edit'), { boundary: 'mode' }),
		step('to run mode', mode('run'), { boundary: 'mode' }), step('back to view', mode('view'), { boundary: 'mode' })],
		proves: (rec, L) => claims([has(pipeLineOf(L[1], H), 'hover') && has(pipeLineOf(L[1], H), 'selected'), 'hovered and selected before the change']) },
	'a load with a pipe selected': { steps: [step('selected', (w) => w.selection.set([H])), step('the tab\'s document loaded again', (w) => load(w, w.model.toJSON()), { loads: true })],
		proves: (rec, L) => claims([has(pipeLineOf(L[1], H), 'selected'), 'selected before the load'], [rec.steps[2].held[H]?.includes('selected'), 'still selected after it']) },
};

/*
Undo, as the page meets it: what the deletion took -- the entity and whatever the planner removed with it, a device's links -- put back
by an answer in the order a document lists them, nodes before pipes and links.
*/
const KIND_ORDER = ['node', 'zone', 'group', 'pipe', 'link'];
function deleteWithUndoStep(label, kind, id) {
	return step(label, (w, ctx) => {
		const before = new Map(KIND_ORDER.flatMap((k) => (w.model.kinds.has(k) ? w.model.all(k) : []).map((e) => [`${k}:${e.id}`, [k, structuredClone(e)]])));
		edit(w, 'delete', [E.del(w, kind, id)]);
		ctx.undo = [...before].filter(([key]) => { const [k, i] = key.split(':'); return !w.model.get(k, i); }).map(([, [k, e]]) => ({ op: 'put', kind: k, entity: e }))
			.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
	}, { boundary: 'delete' });
}
// the undo's answer, applied and settled as the page applies an answer (`answer`)
const undoStep = (label) => step(label, (w, ctx) => answer(w, ctx.undo, { label: 'undo' }), { boundary: 'undo' });
const settleStep = (label) => step(settledLabel(label), (w) => w.host.settled({ label }, { ok: true, version: 2, ops: [] }));

/*
STATES (NS13): each state, set as its owner sets it on the page, held across each boundary -- a structural change of its entity, a mode
change each way, deletion and undo, and a load (Input's drops on a load done as Input does them) -- the entity's class after each step,
and what each owner holds (`held`).
*/
const STRUCTURAL = {
	[IDS.device]: (w) => edit(w, 'reshape', [E.set('node', IDS.device, { span: { cols: 2, rows: 1 } })]),
	[IDS.link]: (w) => edit(w, 'turn', [E.set('link', IDS.link, { direction: 'reverse' })]),
	[IDS.waypoint]: (w) => edit(w, 'arm', [E.set('node', IDS.waypoint, { spawn: { interval: 900, speed: 1, kind: 'packet', since: 1790000000000 } })]),
	[IDS.endpoint]: (w) => edit(w, 'arm', [E.set('node', IDS.endpoint, { spawn: { interval: 900, speed: 1, kind: 'packet', since: 1790000000000 } })]),
	[IDS.undirected]: (w) => edit(w, 'direct', [E.set('link', IDS.undirected, { direction: 'forward' })]),
	[IDS.tower]: (w) => edit(w, 'reshape', [E.set('node', IDS.tower, { span: { cols: 2, rows: 1 } })]),
};
const STATE_CASES = {
	hover: { id: IDS.device, cls: 'hover', set: (w) => hover(w, 'node', IDS.device) },
	'the idle ring': { id: IDS.device, cls: 'linkband', set: (w) => { hover(w, 'node', IDS.device); idle(w, 'node', IDS.device); } },
	armed: { id: IDS.device, cls: 'armed', set: (w) => { hover(w, 'node', IDS.device); arm(w, { alt: true }); } },
	'armed-clone': { id: IDS.device, cls: 'armed-clone', set: (w) => { hover(w, 'node', IDS.device); arm(w, { ctrl: true }); } },
	'a link end\'s drag state': { id: IDS.link, cls: 'replugging', set: (w) => replug(w, IDS.link), onLoad: (w) => replug(w, IDS.link, false) },
	selected: { id: IDS.device, cls: 'selected', set: (w) => w.selection.set([IDS.device]) },
	'on-selected-path': { id: IDS.waypoint, cls: 'on-selected-path', set: (w) => w.selection.set(['link-fa0002']) },
	blocking: { id: IDS.blocker, cls: 'blocking', set: (w) => w.selection.set([IDS.BLOCKED]) },
};
const BOUNDARIES = {
	'a structural change': (c) => [step('its entity changed in structure', (w) => STRUCTURAL[c.id](w), { boundary: 'structural' }), settleStep('its entity changed in structure')],
	'a mode change each way': () => [step('to edit mode', mode('edit'), { boundary: 'mode' }), step('back to view', mode('view'), { boundary: 'mode' }),
		step('to run mode', mode('run'), { boundary: 'mode' }), step('back to view again', mode('view'), { boundary: 'mode' })],
	'deletion and undo': (c) => [deleteWithUndoStep('its entity deleted', c.id.startsWith('link-') ? 'link' : 'node', c.id), settleStep('its entity deleted'), undoStep('undone')],
	// the tab's document loaded again, as a snapshot answering a resync: what the tab holds -- its selection, its reveal -- survives it
	'a load': (c) => [step('loaded', (w) => { load(w, w.model.toJSON()); c.onLoad?.(w); }, { loads: true, boundary: 'load' })],
};
function stateScenario(name, c, boundary) {
	return { group: 'states', name: `states: ${name}, held across ${boundary}`, doc: recordDoc, focus: [c.id], steps: [loadStep('loaded'), step(`${c.cls} set`, c.set), ...BOUNDARIES[boundary](c)],
		proves: (rec, L) => { const k = at(rec, `${c.cls} set`); return claims([classOf(ownOf(L[k], c.id)).includes(c.cls), `${c.cls} shown on ${c.id} once set`], [rec.steps[k].held[c.id]?.includes(c.cls), `${c.cls} held by its owner`],
			[rec.steps.slice(k + 1).some((s) => s.boundary), 'a boundary after it']); } };
}

/*
MARKS (NS13): the reveal's `unrevealed` on a device and on a waypoint, and its `trace` on a link, across a structural change, a mode
change each way, deletion and undo, and a load; the movers' `aim` on a tower across its node redrawn in run mode, deletion and undo, a
load, and leaving run mode -- the entity's attributes before each boundary, at it, and after the owner's next pass or frame.
*/
const markThen = (boundarySteps, after) => boundarySteps.flatMap((s) => [s, after(s)]);
const glyphOf = (shape) => { const find = (s) => (s?.attrs?.['data-layer'] === 'glyph' ? s : (s?.children ?? []).map(find).find(Boolean)); return find(shape); };
function unrevealedScenario(id, boundary) {
	const c = { id };
	return { group: 'marks', name: `marks: unrevealed on ${id === IDS.device ? 'a device' : 'a waypoint'}, across ${boundary}`, doc: withReveal(BEAT(T0 + 600000, [id])), focus: [id],
		steps: [loadStep('loaded, withheld'), step('a pass', pass), ...markThen(BOUNDARIES[boundary](c), (s) => step(`${s.label}: the reveal's next pass`, pass))],
		proves: (rec, L) => claims([ownOf(L[at(rec, 'a pass')], id)?.attrs['data-unrevealed'] !== undefined, `${id} marked unrevealed before the boundary`], [rec.steps[at(rec, 'a pass')].marks.unrevealed.includes(id), 'held by the reveal']) };
}
function traceScenario(boundary) {
	const id = IDS.undirected, c = { id };
	const bs = BOUNDARIES[boundary](c).map((s, i) => ({ ...s, t: T0 + 1100 + 100 * i }));   // each inside the trace, which ends at T0 + 1500
	return { group: 'marks', name: `marks: trace on a link, across ${boundary}`, doc: withReveal(BEAT(T0 + 1000, [id])), focus: [id],
		steps: [loadStep('loaded, withheld'), step('shown: its trace begun', pass, { t: T0 + 1000 }), ...markThen(bs, (s) => step(`${s.label}: the reveal's next pass`, pass, { t: s.t + 50 })),
			step('past its end: a pass', pass, { t: T0 + 1600 })],
		proves: (rec, L) => { const k = at(rec, 'shown: its trace begun'); return claims([rec.traces.some((x) => x.id === id && x.t === T0 + 1000), 'its trace begun by a show'],
			[ownOf(L[k], id)?.attrs.style !== undefined || ownOf(L[k], id)?.attrs['data-trace'] !== undefined, 'the line traced before the boundary'],
			[rec.steps.some((s, i) => s.boundary && s.t < rec.traces[0].t + rec.traces[0].ms && i > k), 'a boundary inside the trace']); } };
}
function aimScenario(boundary) {
	const id = IDS.tower;
	const AIM = {
		'its node redrawn in run mode': [step('the tower redrawn in run mode', (w) => STRUCTURAL[id](w), { boundary: 'structural', t: T0 + 400 }), { ...settleStep('the tower redrawn in run mode'), t: T0 + 600 }],
		'deletion and undo': [{ ...deleteWithUndoStep('the tower deleted', 'node', id), t: T0 + 400 }, { ...settleStep('the tower deleted'), t: T0 + 600 }, { ...undoStep('undone'), t: T0 + 800 }],
		'a load': [step('loaded', (w) => load(w, w.model.toJSON()), { loads: true, boundary: 'load', t: T0 + 400 })],
		'leaving run mode': [step('back to view', mode('view'), { boundary: 'leave-run', t: T0 + 400 })],
	}[boundary];
	return { group: 'marks', name: `marks: aim on a tower, across ${boundary}`, doc: recordDoc, focus: [id],
		steps: [loadStep('loaded'), step('to run mode', mode('run'), { boundary: 'mode' }), step('a frame', frame, { t: T0 + 200 }),
			...AIM.flatMap((s) => (s.boundary === 'leave-run' ? [s] : [s, step(`${s.label}: the movers' next frame`, frame, { t: s.t + 100 })]))],
		proves: (rec, L) => { const k = at(rec, 'a frame'); return claims([glyphOf(ownOf(L[k], id))?.attrs['data-aim'] !== undefined, 'the tower aimed before the boundary'], [rec.steps[k].marks.aims[id] !== undefined, 'the aim held by the movers'],
			[(L[k][FOREIGN_LAYERS.simulation] ?? []).length > 0, 'the movers drawing']); } };
}

/*
THE HEALED LINK (NS16): an undirected down link, drawn without a head, gaining a route by a pipe made, then losing it -- its line and its
click twin after each step.
*/
const HEALED = { group: 'the healed link', name: 'the healed link: a down link without a head gains a route by a pipe made, then loses it', doc: recordDoc, focus: [IDS.HEALS],
	steps: [loadStep('loaded: down'), ...authored('a pipe made: a way for it', () => [E.put('pipe', pipeEntity(IDS.echo, IDS.delta, 'hand'))]), ...authored('the pipe deleted: down again', (w) => [E.del(w, 'pipe', pipeId(IDS.echo, IDS.delta))])],
	proves: (rec, L) => { const line = (k) => ownOf(L[k], IDS.HEALS), twin = (k) => itemIn(L[k], `${IDS.HEALS}/link-hit`)?.[0];
		const healed = at(rec, settledLabel('a pipe made: a way for it')), downAgain = at(rec, settledLabel('the pipe deleted: down again'));
		return claims([line(0)?.attrs['data-down'] !== undefined && !itemIn(L[0], `${IDS.HEALS}/link-head`), 'down, with no head, at first'], [line(healed)?.attrs['data-down'] === undefined, 'up once healed'],
			[twin(healed)?.attrs['stroke-linecap'] !== undefined && line(healed)?.attrs['stroke-linecap'] === undefined, 'its twin keeping the cap its line no longer has (the leftover NS16 names)'],
			[line(downAgain)?.attrs['data-down'] !== undefined, 'down again']); } };

/*
THE TRANSIENT TARGETS: a selected zone's corners, a selected link's ends, a held hand's stamp ghost, the crosshair and the datum -- the
editing items, by layer, for the picks comparison.
*/
const TRANSIENT = { group: 'transient targets', name: 'transient targets: a zone\'s corners, a link\'s ends, the stamp ghost, the crosshair, the datum', doc: recordDoc,
	steps: [loadStep('loaded'), step('a zone selected: its corners', (w) => w.selection.set([IDS.zone])), step('a link selected: its ends', (w) => w.selection.set([IDS.link])),
		step('a hand held: its ghost over a free cell', (w) => { w.selection.set([]); w.tools.setHand('router'); w.tools.trackHand({ x: 120, y: -360 }, false); }),
		step('the ghost over an occupied cell', (w) => w.tools.trackHand({ x: -360, y: 0 }, true)),
		step('the hand dropped; the crosshair alone', (w) => { w.tools.setHand(null); w.snap.show({ x: 240, y: -120 }); }),
		step('the datum', (w) => w.input.overlayUi.datum({ x: -120, y: 60 })),
		step('all let go', (w) => { w.input.overlayUi.datum(null); w.snap.hide(); })],
	proves: (rec, L) => { const handles = (k, data) => (L[k].overlay ?? []).some(([key, shapes]) => key === 'handles' && shapes.some((s) => s.attrs[data] !== undefined));
		return claims([handles(at(rec, 'a zone selected: its corners'), 'data-corner'), 'the zone\'s corners'], [handles(at(rec, 'a link selected: its ends'), 'data-end'), 'the link\'s ends'],
			[(L[at(rec, 'a hand held: its ghost over a free cell')].overlay ?? []).some(([key]) => key === 'ghost'), 'the ghost'],
			[(L[at(rec, 'the ghost over an occupied cell')].overlay ?? []).some(([key, s]) => key === 'ghost' && has(s[0], 'blocked')), 'the ghost blocked'],
			[(L[at(rec, 'the hand dropped; the crosshair alone')].snaplayer ?? []).length > 0, 'the crosshair'], [(L[at(rec, 'the datum')].snaplayer ?? []).some(([key]) => key === 'datum'), 'the datum']); } };

/*
CHANGES IN PLACE, beyond section 4.2's table: what its coverage needs that no group of the table changes -- a zone and a group updated
in place, a hull following its member, a link's head and leg taken away by an update, a closed ring's offset written again by one, and
the labels toggled (a class of the page's root, which the record does not read). Its own group, named for what it is.
*/
const RING = 'link-fc0001';
const CHANGES = { group: 'changes in place', name: 'changes in place: a zone, a group and its hull, a link left no room for its head, a ring turned, the labels', focus: [IDS.zone, IDS.group, IDS.link, RING],
	doc: () => { const b = recordBoard(); const ids = [0, 1, 2, 3].map((i) => `node-fc00${i}1`);
		[[-840, -420], [-600, -420], [-600, -180], [-840, -180]].forEach(([x, y], i) => b.nodes.push({ id: ids[i], name: `r${i}`, x, y, order: 20 + i }));
		b.links.push({ id: RING, name: 'ring', src: ids[0], dst: ids[3], via: [ids[1], ids[2]], closed: true, control: true, direction: 'forward', order: 20 });
		for (let i = 0; i < 4; i++) b.pipes.push(pipeEntity(ids[i], ids[(i + 1) % 4], 'link'));
		return b; },
	steps: [loadStep('loaded'), step('the zone resized and renamed', (w) => edit(w, 'zone', [E.set('zone', IDS.zone, { w: 960, name: 'resized' })])),
		step('the group renamed', (w) => edit(w, 'group', [E.set('group', IDS.group, { name: 'renamed' })])),
		step('a member moved: its hull follows', (w) => edit(w, 'move', [E.set('node', IDS.charlie, { x: 60 })])),
		// a live drag: Input's move gesture sets the model at the pointer's exact place, off the grid, until the drop commits (app/src/input.js `updateMove`)
		step('bravo dragged live beside alpha: its link left no room for a head and leg', (w) => w.model.set('node', IDS.bravo, { x: -330, y: 0 })),
		step('bravo dragged back: its head and leg made again', (w) => w.model.set('node', IDS.bravo, { x: 360, y: 0 })),
		step('the ring turned: its offset written again', (w) => edit(w, 'turn', [E.set('link', RING, { direction: 'reverse' })])),
		step('labels off', (w) => w.renderer.toggleLabels()), step('labels on', (w) => w.renderer.toggleLabels())],
	proves: (rec, L) => { const k = (label) => at(rec, label), attrs = (i, id) => JSON.stringify(ownOf(L[i], id)?.attrs);
		const hull = (i) => JSON.stringify(itemIn(L[i], IDS.group));
		return claims([JSON.stringify(itemIn(L[k('the zone resized and renamed')], IDS.zone)) !== JSON.stringify(itemIn(L[0], IDS.zone)), 'the zone drawn again in place'],
			[rec.steps[k('the group renamed')].events.some(([a, kind]) => a === 'set' && kind === 'group'), 'the group set'], [hull(k('a member moved: its hull follows')) !== hull(k('the group renamed')), 'its hull following its member'],
			[itemIn(L[0], `${IDS.link}/link-head`) && !itemIn(L[k('bravo dragged live beside alpha: its link left no room for a head and leg')], `${IDS.link}/link-head`), 'the link\'s head taken away'],
			[itemIn(L[0], `${IDS.link}/link-leg`) && !itemIn(L[k('bravo dragged live beside alpha: its link left no room for a head and leg')], `${IDS.link}/link-leg`), 'and its leg'],
			[attrs(k('the ring turned: its offset written again'), RING) !== attrs(0, RING) && ownOf(L[k('the ring turned: its offset written again')], RING)?.attrs['stroke-dashoffset'] !== undefined, 'the ring\'s offset written again']); } };

// every scenario, by name, in order
export function scenarios() {
	const out = [];
	for (const [name, doc] of [...storedDocuments(), ...coverageDocuments()]) out.push(loadScenario(name, doc));
	for (const [name, t] of Object.entries(PIPE_TRIGGERS)) out.push({ group: 'pipe triggers, alone', name: `pipe triggers, alone: ${name}`, doc: recordDoc, steps: [loadStep('loaded'), ...t.steps], proves: t.proves });
	for (const [name, t] of Object.entries(PIPE_COMBINED)) out.push({ group: 'pipe triggers, combined', name: `pipe triggers, combined: ${name}`, doc: recordDoc, steps: [loadStep('loaded'), ...t.steps], proves: t.proves });
	for (const [name, c] of Object.entries(STATE_CASES)) for (const b of Object.keys(BOUNDARIES)) out.push(stateScenario(name, c, b));
	for (const id of [IDS.device, IDS.endpoint]) for (const b of Object.keys(BOUNDARIES)) out.push(unrevealedScenario(id, b));
	for (const b of Object.keys(BOUNDARIES)) out.push(traceScenario(b));
	for (const b of ['its node redrawn in run mode', 'deletion and undo', 'a load', 'leaving run mode']) out.push(aimScenario(b));
	out.push(HEALED, TRANSIENT, CHANGES);
	return Object.fromEntries(out.map((s) => [s.name, s]));
}
export const GROUPS = ['loads', 'pipe triggers, alone', 'pipe triggers, combined', 'states', 'marks', 'the healed link', 'transient targets', 'changes in place'];

// a recorded scenario's proof: what it fails to exercise, from the record alone
export const proofOf = (sc, rec) => { try { return sc.proves(rec, layersAt(rec.steps)); } catch (e) { return [`its proof threw: ${e.message}`]; } };

// ---- the record

// every scenario recorded, and every document's export -- the stored documents' and the coverage boards' -- by its bytes' SHA-256
export function recordAll({ only = null } = {}) {
	const all = scenarios(), out = { writtenFrom: WRITTEN_FROM, exports: {}, scenarios: {} };
	for (const [name, doc] of [...storedDocuments(), ...coverageDocuments()]) out.exports[name] = sha256(svgDocument(structuredClone(doc)));
	for (const [name, sc] of Object.entries(all)) {
		if (only && !only(sc)) continue;
		out.scenarios[name] = { group: sc.group, ...runScenario(sc) };
	}
	return out;
}

// ---- the comparison: a live run against the record, under each move's allowances (section 4.2)

/*
The moves the record answers to, in order; each allows what section 4.2's table names, and every move after it the same:
  record    nothing: `ca492da`'s own code, run again, draws the record exactly -- how a reader holds the record to its archive
  trace     a traced line's `style` and `data-trace` by the trace rule -- today's inline dash at a step is, after, the trace's attributes
            while the trace runs and none after
  painters  attribute order on an element kept across a patch, compared as a map but on a load; class tokens as a set; the lifetimes
            NS13 rules, the states and marks shown while their owners hold them (`held`, `marks`); a healed link's twin without the
            `stroke-linecap` its line no longer has (NS16); element identity, which the record does not hold, so a load's puts by kind
  pipes     a pipe's states held through a repaint (NS13); each pipe described as rule P names (4.6), read from the live run's counts,
            and no put on a load patching or moving an item
*/
export const MOVES = ['record', 'trace', 'painters', 'pipes'];
// the states NS13 rules -- each held by its owner and shown on the state target while held, after the painters move
export const STATE_CLASSES = ['hover', 'linkband', 'armed', 'armed-clone', 'replugging', 'selected', 'on-selected-path', 'blocking'];
// today's trace, as a line of the record shows it: the inline dash, never taken away (B422)
const TODAY_TRACE = /^transition: stroke-dashoffset [\d.e+-]+ms ease-out; stroke-dasharray: [\d.e+-]+; stroke-dashoffset: 0;$/;
export const traceStyle = (len, ms) => `--trace-len: ${len}; --trace-ms: ${ms}ms`;
/*
The trace of `id` running at step `k` of a recorded scenario: its last show at or before the step, the step's instant short of its end,
no hide of the line since that show -- a hide in the show's own step came before it, as a pass asks one or the other -- and, after the
painters move (`kept`), no load or deletion of the line in a later step, which drops the mark with the entity.
*/
function traceAt(rec, id, k, { kept = false } = {}) {
	const shows = rec.traces.filter((x) => x.id === id && x.step <= k);
	const last = shows.at(-1);
	if (!last || !(rec.steps[k].t < last.t + last.ms)) return null;
	if (rec.hides.some((h) => h.id === id && h.step > last.step && h.step <= k)) return null;
	if (kept && rec.steps.slice(last.step + 1, k + 1).some((st) => st.events.some(([a, , e]) => a === 'load' || (a === 'del' && e === id)))) return null;
	return { run: (shows.length - 1) % 2 === 0 ? 'a' : 'b', ms: last.ms };
}
const tokensSorted = (cls) => tokensOf(cls).sort().join(' ');
const findShape = (shapes, test) => { for (const sh of shapes) { if (test(sh)) return sh; const c = findShape(sh.children ?? [], test); if (c) return c; } return null; };
/*
What the record's item `[key, shapes]` at step `k` must be, live, under `move` -- the record's shapes with the move's allowances applied:
the trace rule on the line bearing the entity's id; after the painters move the states and marks its owners hold on its state target, a
tower's aim on its glyph, a twin's cap as its line's; after the pipes move a pipe's states on its line.
*/
function expectedItem(rec, k, layer, key, shapes, full, move) {
	const at = MOVES.indexOf(move), step = rec.steps[k];
	const out = JSON.parse(JSON.stringify(shapes));
	const id = key.split('/')[0];
	const target = findShape(out, (sh) => sh.attrs?.id === id);
	if (target && !key.includes('/')) {
		const a = target.attrs;
		const kept = at >= MOVES.indexOf('painters');
		const today = at >= MOVES.indexOf('trace') && typeof a.style === 'string' && TODAY_TRACE.test(a.style);
		const trace = traceAt(rec, id, k, { kept });
		if (today || (at >= MOVES.indexOf('trace') && 'data-trace' in a) || kept) {
			// the trace's attributes where today's inline dash stood -- each written when the show wrote it -- or last, for a line drawn afresh
			const entries = Object.entries(a).filter(([n]) => n !== 'data-trace');
			const at2 = today ? entries.findIndex(([n]) => n === 'style') : entries.length;
			const marks = trace && (today || kept) && target.tag === 'path' ? [['data-trace', trace.run], ['style', traceStyle(lengthOf(a.d), trace.ms)]] : [];
			const next = [...entries.slice(0, at2), ...marks, ...entries.slice(today ? at2 + 1 : at2)];
			for (const n of Object.keys(a)) delete a[n];
			for (const [n, v] of next) a[n] = v;
		}
		const statesHere = layer !== FOREIGN_LAYERS.network ? kept : at >= MOVES.indexOf('pipes');
		if (statesHere) {
			const base = tokensOf(a.class).filter((c) => !STATE_CLASSES.includes(c));
			a.class = [...base, ...(step.held[id] ?? [])].join(' ');
		}
		if (kept && layer !== FOREIGN_LAYERS.network) {
			delete a['data-unrevealed'];
			if (step.marks.unrevealed.includes(id)) a['data-unrevealed'] = '';
			const glyph = findShape(out, (sh) => sh.attrs?.['data-layer'] === 'glyph');
			if (glyph && (step.marks.aims[id] !== undefined || 'data-aim' in glyph.attrs)) {
				delete glyph.attrs['data-aim']; delete glyph.attrs.transform;
				if (step.marks.aims[id] !== undefined) { glyph.attrs['data-aim'] = step.marks.aims[id]; glyph.attrs.transform = `rotate(${step.marks.aims[id]})`; }
			}
		}
	}
	if (at >= MOVES.indexOf('painters') && key.endsWith('/link-hit')) {
		const line = (full[layer] ?? []).find(([kk]) => kk === id)?.[1]?.[0]?.attrs;
		const twin = out[0].attrs;
		if (line && 'stroke-linecap' in line) twin['stroke-linecap'] = line['stroke-linecap']; else delete twin['stroke-linecap'];
	}
	return out;
}
// a shape as compared: its attributes in order, or after the painters move as a map but on a load, its class a set
function canonical(shapes, { ordered, classSet }) {
	const one = (sh) => {
		let attrs = Object.entries(sh.attrs ?? {});
		if (classSet) attrs = attrs.map(([k2, v]) => [k2, k2 === 'class' ? tokensSorted(v) : v]);
		if (!ordered) attrs.sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
		return { tag: sh.tag, attrs, text: sh.text ?? null, children: (sh.children ?? []).map(one) };
	};
	return JSON.stringify(shapes.map(one));
}
/*
Rule P (4.6), what the pipes move must describe at a step, read from the record: every pipe on a load and on a mode change; on a change
of a pipe, a link or a node, every pipe when the set of pipes a link runs over (`under`, read from the record's drawing) changed, and
otherwise the changed pipes and those naming a changed node; none on anything else -- a selection, a hover, an arming are state-only.
*/
export function rulePAt(rec, k, layers) {
	const step = rec.steps[k], prev = rec.steps[k - 1];
	const pipesOf = (L) => (L[FOREIGN_LAYERS.network] ?? []).map(([key]) => key);
	const all = pipesOf(layers[k]);
	if (step.events.some(([a]) => a === 'load') || (prev && prev.mode !== step.mode)) return new Set(all);
	const changes = step.events.filter(([, kind]) => ['pipe', 'link', 'node'].includes(kind));
	if (!changes.length) return new Set();
	const underOf = (L) => JSON.stringify((L[FOREIGN_LAYERS.network] ?? []).filter(([, [g]]) => classOf(g).includes('under')).map(([key]) => key));
	if (k > 0 && underOf(layers[k]) !== underOf(layers[k - 1])) return new Set(all);
	const nodes = new Set(changes.filter(([, kind]) => kind === 'node').map(([, , id]) => id));
	const out = new Set(changes.filter(([, kind]) => kind === 'pipe').map(([, , id]) => id).filter((id) => all.includes(id)));
	for (const key of all) { const [, a, b] = /^pipe-(.+)-(.+)$/.exec(key) ?? []; if (a && (nodes.has(`node-${a}`) || nodes.has(`node-${b}`))) out.add(key); }
	return out;
}
/*
A live run of scenario `name` against its record, under `move`: the problems, none when the run holds. It fails a scenario the record
does not prove it exercises (`proves`) before it compares anything, so an empty scenario can never pass.
*/
export function compareScenario(sc, rec, live, { move = 'trace' } = {}) {
	const at = MOVES.indexOf(move);
	if (at < 0) throw new Error(`compareScenario: no move "${move}" -- one of ${MOVES.join(', ')}`);
	const problems = proofOf(sc, rec).map((p) => `the record does not exercise what the scenario names: ${p}`);
	if (problems.length) return problems;
	if (live.steps.length !== rec.steps.length) return [`${live.steps.length} steps run, ${rec.steps.length} recorded`];
	const R = layersAt(rec.steps), Lv = layersAt(live.steps);
	rec.steps.forEach((was, k) => {
		const now = live.steps[k], where = `step ${k} (${was.label})`;
		const same = (what, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${where}: ${what}: recorded ${JSON.stringify(a)?.slice(0, 300)}, live ${JSON.stringify(b)?.slice(0, 300)}`); };
		same('the step', [was.label, was.t, was.mode, was.boundary ?? null], [now.label, now.t, now.mode, now.boundary ?? null]);
		same('the model\'s events', was.events, now.events);
		same('the caption', was.caption, now.caption);
		if (at < MOVES.indexOf('painters')) { same('the load\'s puts by kind', was.puts ?? null, now.puts ?? null); same('the states held', was.held, now.held); same('the marks held', was.marks, now.marks); }
		if (at >= MOVES.indexOf('pipes') && now.puts && (now.puts.patch || now.puts.move)) problems.push(`${where}: a load put ${now.puts.patch} patch(es) and ${now.puts.move} move(s) (rule P: none)`);
		if (at >= MOVES.indexOf('pipes')) {
			const want = [...rulePAt(rec, k, R)].sort(), got = Object.keys(now.describes ?? {}).filter((x) => now.describes[x] > 0).sort();
			if (!now.describes) problems.push(`${where}: the live run counts no pipe descriptions`);
			else if (JSON.stringify(want) !== JSON.stringify(got)) problems.push(`${where}: pipes described ${JSON.stringify(got)}, rule P names ${JSON.stringify(want)}`);
			else if (was.events.some(([a]) => a === 'load') && got.some((x) => now.describes[x] !== 1)) problems.push(`${where}: a load describes each pipe once (rule P)`);
		}
		const ordered = at < MOVES.indexOf('painters') || !!was.puts;
		const opts = { ordered, classSet: at >= MOVES.indexOf('painters') };
		for (const layer of Object.keys(R[k])) {
			const rItems = R[k][layer], lItems = Lv[k][layer] ?? [];
			same(`${layer}: the items in order`, rItems.map(([key]) => key), lItems.map(([key]) => key));
			const live2 = new Map(lItems);
			for (const [key, shapes] of rItems) {
				if (!live2.has(key)) continue;
				const want = canonical(expectedItem(rec, k, layer, key, shapes, R[k], move), opts), got = canonical(live2.get(key), opts);
				if (want !== got) { let i = 0; while (want[i] === got[i]) i++; problems.push(`${where}: ${layer} ${key}: ...${want.slice(Math.max(0, i - 60), i + 140)} | live ...${got.slice(Math.max(0, i - 60), i + 140)}`); }
			}
		}
	});
	return problems;
}

// ---- the coverage section 4.2 claims

/*
The modules whose drawing the record must reach -- `ca492da`'s painters, appearances, `nameLabel`, renderer, pipe drawer, reveal and
movers -- and in each, the lines it measures: the whole module, or the pipe drawer's span of plugins/network/host.mjs, from its map of
drawn pipes to its subscriptions.
*/
export const MEASURED = {
	painters: ['plugins/zones/zone-painter.mjs', 'plugins/groups/group-painter.mjs', 'plugins/network/link-painter.mjs', 'plugins/network/link-head.mjs'],
	appearances: ['plugins/devices/device-appearance.mjs', 'plugins/network/anchor-appearance.mjs', 'plugins/network/appearance.mjs', 'plugins/simulation/spawn-appearance.mjs'],
	nameLabel: ['kernel/renderer.mjs'],
	renderer: ['app/src/renderer.js', 'app/src/shadow.js'],
	'pipe drawer': ['plugins/network/host.mjs'],
	reveal: ['plugins/simulation/reveal-painter.mjs'],
	movers: ['plugins/simulation/mover-painter.mjs'],
};
const SPANS = { 'plugins/network/host.mjs': ['const drawn = new Map();', 'renderer.watchMode(paint);'] };
/*
A writing site: where a line makes a shape or writes an attribute -- an element made (`el`, `createElementNS`), an attribute set or
removed, a class toggled, a `dataset` or `style` property or `textContent` written, an element moved or removed, a label made
(`nameLabel`), an item put or removed, a node described for the scene -- read from the source with its comments and strings blanked.
*/
const WRITES = /\b(?:el|createElementNS|setAttribute|setAttributeNS|removeAttribute|setAttrs|applyLook|insertBefore|appendChild|replaceChildren|nameLabel|describe)\s*\(|\.classList\.(?:add|remove|toggle)\s*\(|\.dataset\.\w+\s*=(?!=)|\.style\.\w+\s*=(?!=)|\btextContent\s*=(?!=)|\.remove\(\)|\bscene\.(?:put|remove)\s*\(/g;
function blanked(src) {
	const out = src.split('');
	const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
	const REGEX_BEFORE = /[(,=:[!&|?{};+\-*%<>~^]|^$/;
	let i = 0, prev = '';
	// code until `stop` (a template's `}`), from `i`; answers where it stopped
	const code = (stop) => {
		let depth = 0;
		while (i < src.length) {
			const c = src[i], two = src.slice(i, i + 2);
			if (stop && c === '}' && depth === 0) return;
			if (two === '//') { const end = src.indexOf('\n', i); const e = end < 0 ? src.length : end; blank(i, e); i = e; continue; }
			if (two === '/*') { const end = src.indexOf('*/', i + 2); const e = end < 0 ? src.length : end + 2; blank(i, e); i = e; continue; }
			if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; } blank(i + 1, j); i = j + 1; prev = c; continue; }
			if (c === '`') { template(); prev = '`'; continue; }
			if (c === '/' && REGEX_BEFORE.test(prev)) {
				let j = i + 1, cls = false;
				while (j < src.length && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
				blank(i + 1, j); i = j + 1; while (/[a-z]/.test(src[i] ?? '')) i++; prev = '/'; continue;
			}
			if (c === '{') depth++;
			if (c === '}') depth--;
			if (!/\s/.test(c)) prev = c;
			i++;
		}
	};
	const template = () => {
		i++;
		while (i < src.length && src[i] !== '`') {
			if (src[i] === '\\') { blank(i, i + 2); i += 2; continue; }
			if (src.slice(i, i + 2) === '${') { i += 2; prev = '{'; code(true); i++; continue; }
			if (src[i] !== '\n') out[i] = ' ';
			i++;
		}
		i++;
	};
	code(false);
	return out.join('');
}
export function writingSites(rel, src) {
	const text = blanked(src), lines = src.split('\n');
	let from = 0, to = src.length;
	if (SPANS[rel]) { from = src.indexOf(SPANS[rel][0]); to = src.indexOf(SPANS[rel][1]) + SPANS[rel][1].length; if (from < 0 || to < from) throw new Error(`${rel}: the measured span is not found`); }
	const sites = [];
	for (const m of text.matchAll(WRITES)) {
		if (m.index < from || m.index > to) continue;
		const line = src.slice(0, m.index).split('\n').length;
		sites.push({ offset: m.index, line, col: m.index - src.lastIndexOf('\n', m.index - 1), what: m[0].replace(/\s*\($/, '').trim(), text: lines[line - 1].trim().slice(0, 160) });
	}
	return sites;
}
/*
The writing sites no page reaches, each with why -- the only ones the coverage may leave unreached. Lines are `ca492da`'s, which the
archive holds (`record.archive`).
*/
export const UNREACHABLE = [
	{ file: 'plugins/simulation/mover-painter.mjs', lines: [35, 36, 37], why: 'the movers\' default element builder, for a composition handing no `el`: the page and the lab both hand app/src/painter.js\'s `el`, so nothing a page draws goes through it' },
	{ file: 'app/src/shadow.js', lines: [101], why: 'the shadow node\'s `setAttributeNS`, offered for the platform\'s semantics: no drawing code calls it on a shadow node -- its one caller, the movers\' default builder, draws on the platform' },
];
const allowed = (u) => UNREACHABLE.some((a) => a.file === u.file && a.lines.includes(u.line));
// how many times the innermost block holding `offset` ran, from a module's V8 block coverage
function countAt(functions, offset) {
	let best = null;
	for (const f of functions) for (const r of f.ranges) if (r.startOffset <= offset && offset < r.endOffset && (!best || r.endOffset - r.startOffset < best.endOffset - best.startOffset)) best = r;
	return best ? best.count : 0;
}
/*
Each measured module's coverage from the V8 coverage files a recording wrote: its SHA-256 as it stood, its writing sites and each one's
count, and its lines run of its lines holding code. Answers `{ files, unreached }`, `unreached` every writing site no step reached.
*/
export function coverageOf(root, dir) {
	const byUrl = new Map();
	for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).result) byUrl.set(r.url, [...(byUrl.get(r.url) ?? []), ...r.functions]);
	const files = {}, unreached = [];
	for (const [part, rels] of Object.entries(MEASURED)) for (const rel of rels) {
		const src = fs.readFileSync(path.join(root, rel), 'utf8');
		const functions = byUrl.get(`file://${path.join(root, rel)}`);
		if (!functions) throw new Error(`${rel}: no coverage -- the recording never loaded it`);
		const sites = writingSites(rel, src).map((s) => ({ ...s, count: countAt(functions, s.offset) }));
		const text = blanked(src).split('\n');
		let code = 0, run = 0, offset = 0;
		for (const line of text) { const at = line.search(/\S/); if (at >= 0) { code++; if (countAt(functions, offset + at) > 0) run++; } offset += line.length + 1; }
		files[rel] = { part, sha256: sha256(src), sites: sites.length, reached: sites.filter((s) => s.count > 0).length, lines: { code, run } };
		for (const s of sites) if (s.count === 0) unreached.push({ file: rel, line: s.line, col: s.col, what: s.what, text: s.text });
		files[rel].allowed = sites.filter((s) => s.count === 0 && allowed({ file: rel, line: s.line })).map((s) => `${s.line}:${s.col} ${s.what}`);
	}
	return { files, unreached: unreached.filter((u) => !allowed(u)) };
}

// ---- writing it, in the archive

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
	const [mode, out] = process.argv.slice(2);
	if (mode === '--record') {
		fs.writeFileSync(out, JSON.stringify(recordAll()));
	} else if (mode === '--write') {
		const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || ROOT, 'native-record-'));
		const raw = path.join(tmp, 'record.json'), cov = path.join(tmp, 'coverage');
		const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, '--record', raw], { env: { ...process.env, NODE_V8_COVERAGE: cov }, stdio: 'inherit' });
		if (r.status !== 0) throw new Error(`the recording failed: ${r.status}`);
		const rec = JSON.parse(fs.readFileSync(raw, 'utf8'));
		const all = scenarios(), problems = [];
		for (const [name, sc] of Object.entries(all)) for (const p of proofOf(sc, rec.scenarios[name])) problems.push(`${name}: ${p}`);
		const coverage = coverageOf(ROOT, cov);
		for (const u of coverage.unreached) problems.push(`unreached: ${u.file}:${u.line}:${u.col} ${u.what} -- ${u.text}`);
		// every module of the archive the recording loaded, by its SHA-256, so a reader can hold the archive to ca492da's tree
		const archive = {};
		for (const f of fs.readdirSync(cov).filter((x) => x.endsWith('.json'))) for (const s of JSON.parse(fs.readFileSync(path.join(cov, f), 'utf8')).result) {
			if (!s.url.startsWith(`file://${ROOT}/`) || s.url.includes('/node_modules/')) continue;
			const rel = s.url.slice(`file://${ROOT}/`.length);
			archive[rel] = sha256(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
		}
		fs.rmSync(tmp, { recursive: true, force: true });
		if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
		const record = { writtenFrom: WRITTEN_FROM, archive: Object.fromEntries(Object.entries(archive).sort()), coverage: coverage.files, exports: rec.exports, scenarios: rec.scenarios };
		fs.writeFileSync(NATIVE_RECORD, `${JSON.stringify(record)}\n`);
		const steps = Object.values(rec.scenarios).reduce((n, s) => n + s.steps.length, 0);
		const sum = (k) => Object.values(coverage.files).reduce((n, f) => n + (Array.isArray(f[k]) ? f[k].length : f[k]), 0);
		console.log(`native-record: ${Object.keys(rec.exports).length} export(s); ${Object.keys(rec.scenarios).length} scenario(s), ${steps} step(s); ${sum('sites')} writing site(s), ${sum('reached')} reached, ${sum('allowed')} no page reaches`);
	}
}
