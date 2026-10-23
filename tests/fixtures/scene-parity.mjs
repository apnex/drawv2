/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 4, acceptance step 4; section 6) -- THE SIDE-BY-SIDE: TODAY'S RENDERER AND THE
ADAPTER, OVER EVERY DOCUMENT AND EVERY KIND OF CHANGE DRAW MAKES, ELEMENT FOR ELEMENT.

Draw's page must show what it showed, and keep the elements it kept. So today's app/src/renderer.js and app/src/painter.js, kept
verbatim in tests/fixtures/pre-scene/app/src/, run beside the adapter -- the renderer on vector-scene through the live shadow -- each
on a tree of its own with the platform's semantics, driven through what a page does: a load, a put, a set and a delete of every kind,
a link's head gained, turned and lost, selections, hover and arming, each mode, labels, the real reveal and the real towers. After
every step: the two trees equal, element for element and attribute for attribute in order; the same elements kept and the same made
afresh, each kept one at its former place; the scene's items equal to what stands under its layers; and the towers' glyph lookups
equal. The same over every document the repository stores -- its templates -- the parity board and the lab's boards, with the
platform's measure and settle handed to both sides and without them, as the page and the harness differ. The export is run both
ways over the same documents, today's server/svg.mjs kept verbatim at tests/fixtures/pre-export/ beside the scene's, and must be
byte-identical. And the gesture corpus is replayed, the overlay's, snap layer's and grids' trees after every step held to a record
today's code wrote before the move (tests/fixtures/scene-parity-record.json, `trees`).

The stored diagrams are a server's data, never the repository's (.gitignore `diagrams/*.json`), and the owner's are read-only copies
outside it (tools/probe/parity.mjs `fetch`), so the gate holds neither; `node tests/fixtures/scene-parity.mjs --docs <dir>...` runs the
same side-by-side and the export both ways over every document in the folders named, on whoever's machine holds them.

Nothing here is pinned that an engine may approximate (B176, B423): the side-by-side and the export compare two sides live; the record
holds trees whose numbers are the pointer's, the grids' and the kernel's exact arithmetic, but for a handle's place, which the network
answers by `Math.hypot` (plugins/network/link-handles.mjs) -- so a handle is recorded at its offset from the point its part's spec
answers then, read live, and not at that point.

  makeDocument     a DOM-shaped tree with the platform's semantics: one class state, read and written through the attribute and a
                   DOMTokenList; appendChild and insertBefore detaching a node first; textContent; isConnected; getElementById over
                   the connected tree; the selectors draw uses; and every node numbered when made, so a step can say which elements
                   were kept. With a measure, each path answers getTotalLength and each element a style written into its attribute
                   as the shadow writes it, so the reveal's trace runs on both sides
  boards           every document the side-by-side draws, by name
  pageSideBySide   one document, both sides, every step; answers each step's findings
  exportBytes      a document's export, the SHA-256 of its bytes
  corpusTrees      a scenario of the gesture corpus, the editing layers' trees after each step
  EDGES            section 6.3's inputs, each run on the old side and the new: what each answered
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PRODUCT_CANVAS, CANVAS_LAYERS } from '../../product/canvas.mjs';
import { COMPOSED_KINDS, readModel } from '../../product/types.mjs';
import { productKinds } from '../../product/kinds.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';
import { Model, kindOf } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { commit } from '../../planner/txn.mjs';
import { Log } from '../../planner/log.mjs';
import { createNetworkSession } from '../../plugins/network/session.mjs';
import { Reveal } from '../../plugins/simulation/reveal-painter.mjs';
import { Movers } from '../../plugins/simulation/mover-painter.mjs';
import { parityBoard } from '../../tools/probe/boards.mjs';
import { Renderer as OldRenderer } from './pre-scene/app/src/renderer.js';
import * as oldPainter from './pre-scene/app/src/painter.js';
// the new side: the adapter, held in tests/fixtures/scene-adapter/ until the move put it in app/src/ and server/svg.mjs (H26.4)
import { Renderer as NewRenderer, openCanvasScene } from '../../app/src/renderer.js';
import { CANVAS_SCENE } from '../../product/canvas.mjs';
import { svgDocument as newExport } from '../../server/svg.mjs';
import { svgDocument as oldExport } from './pre-export/server/svg.mjs';
import * as newVisuals from '../../app/src/editing-visuals.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const NEW = { Renderer: NewRenderer, openCanvasScene, CANVAS_SCENE, svgDocument: newExport, visuals: newVisuals };
export const OLD = { Renderer: OldRenderer, painter: oldPainter, svgDocument: oldExport };

// ---- a DOM with the platform's semantics

const tokensOf = (value) => [...new Set(String(value ?? '').split(/[\t\n\f\r ]+/).filter(Boolean))];
const dataName = (key) => `data-${String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const cssName = (key) => String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const declarationsOf = (text) => { const out = new Map(); for (const p of String(text ?? '').split(';')) { const at = p.indexOf(':'); if (at > 0) out.set(p.slice(0, at).trim(), p.slice(at + 1).trim()); } return out; };
const matcherOf = (sel) => {
	const id = sel.match(/^#([\w-]+)$/)?.[1] ?? sel.match(/^\[id="([^"]*)"\]$/)?.[1];
	const cls = sel.match(/^\.([\w-]+)$/)?.[1], attr = sel.match(/^\[([\w-]+)="([^"]*)"\]$/), tag = /^[a-z]+$/i.test(sel) ? sel : null;
	return (n) => (id !== undefined ? n.attrs.id === id : cls ? tokensOf(n.attrs.class).includes(cls) : attr ? n.attrs[attr[1]] === attr[2] : tag ? n.tag === tag : false);
};
const walk = (n, hit, one, out = []) => {
	for (const c of n.children) { if (hit(c)) { out.push(c); if (one) return out; } walk(c, hit, one, out); if (one && out.length) return out; }
	return out;
};
// the stand-in for the platform's measure of a path's `d`, the same on both sides
export const lengthOf = (d) => String(d).length * 3 + 0.5;

export function makeDocument({ measure = false } = {}) {
	let serial = 0;
	const top = { children: [], parentNode: null, attrs: {} };
	const doc = { serial: () => serial };
	const make = (tag) => {
		const node = {
			tag, tagName: tag, attrs: {}, children: [], parentNode: null, text: '', serial: ++serial, ownerDocument: doc,
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
			querySelector(sel) { return walk(node, matcherOf(sel), true)[0] ?? null; },
			querySelectorAll(sel) { return walk(node, matcherOf(sel), false); },
			getScreenCTM() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; } }; },
		};
		const writeClass = (list) => { if (!Object.hasOwn(node.attrs, 'class') && !list.length) return; node.setAttribute('class', list.join(' ')); };
		if (measure) {
			// the platform's measure and style, as the shadow answers them on the new side: what the page's own would compute differs in
			// its text alone, which the trace test reads in Chrome (tests/vector-scene-trace.test.js)
			if (tag === 'path') node.getTotalLength = () => lengthOf(node.attrs.d ?? '');
			node.getBoundingClientRect = () => ({});
			Object.defineProperty(node, 'style', { get: () => new Proxy({}, {
				get: (_, k) => declarationsOf(node.attrs.style).get(cssName(k)) ?? '',
				set: (_, k, v) => { const d = declarationsOf(node.attrs.style); if (v === '' || v == null) d.delete(cssName(k)); else d.set(cssName(k), String(v)); node.setAttribute('style', [...d].map(([p, x]) => `${p}: ${x};`).join(' ')); return true; },
			}) });
		}
		return node;
	};
	doc.createElementNS = (_ns, tag) => make(tag);
	doc.getElementById = (id) => walk(top, (n) => n.attrs?.id === id, true)[0] ?? null;
	doc.attach = (n) => { top.children.push(n); n.parentNode = top; return n; };
	return doc;
}
// a subtree as data, attributes in order; its nodes in document order, for identity
export const ser = (n) => ({ tag: n.tag, attrs: Object.entries(n.attrs), text: n.children.length ? '' : n.text, children: n.children.map(ser) });
export const flat = (n, out = []) => { for (const c of n.children) { out.push(c); flat(c, out); } return out; };
const desc = (d) => ({ tag: d.tag, attrs: Object.entries(d.attrs), text: d.text ?? '', children: (d.children ?? []).map(desc) });

// ---- the documents

// each lab board as the lab applies it: through the planner, its pipes ops of its own commit (lab/src/root.js FIXED BOARDS)
function labDocument(name, board) {
	const session = createNetworkSession();
	const authority = new Model({ kinds: COMPOSED_KINDS, attached: { network: session.network } });
	attachRelations(authority, { nearest: NODE_GRID.nearest });
	const answer = commit(authority, new Log(), { ops: [...board.ops, ...session.seed(board.pipes ?? [])], label: `seed ${name}` }, 'lab', 'lab', { kinds: COMPOSED_KINDS });
	if (!answer.ok) throw new Error(`lab board ${name} refused: ${answer.error}`);
	return authority.toJSON();
}
// the documents in a folder, each by its path
export const documentsIn = (dir, as = dir) => fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort().map((f) => [`${as}/${f}`, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]);
// every document the repository stores and the side-by-side draws: the templates, the parity board, and the lab's boards
export function boards() {
	const out = documentsIn(path.join(ROOT, 'templates'), 'templates');
	out.push(['the parity board', parityBoard()]);
	const seeds = JSON.parse(fs.readFileSync(path.join(ROOT, 'lab/seeds.json'), 'utf8'));
	for (const [name, board] of Object.entries(seeds)) out.push([`lab ${name}`, labDocument(name, board)]);
	return out;
}

// ---- one document, both sides

const FOREIGN = new Set(['pipes', 'movers']);
/*
`measure`: hand both sides the platform's measure and settle -- the page's case -- or neither, the harness's and the export's. Answers
`{ steps, glyphs, loadPuts }`: each step's label and what differed, if anything.
*/
export function pageSideBySide(name, doc, { measure = false, impl = NEW } = {}) {
	const tDoc = makeDocument({ measure }), tRoot = tDoc.attach(tDoc.createElementNS('', 'svg'));
	const ground = (d, root) => { const g = d.createElementNS('', 'rect'); g.setAttribute('id', 'canvas'); root.appendChild(g); };
	ground(tDoc, tRoot);
	for (const id of CANVAS_LAYERS) { const g = tDoc.createElementNS('', 'g'); g.setAttribute('id', id); tRoot.appendChild(g); }
	const dDoc = makeDocument(), dRoot = dDoc.attach(dDoc.createElementNS('', 'svg'));
	ground(dDoc, dRoot);
	const scene = impl.openCanvasScene(impl.CANVAS_SCENE, dRoot);
	// each put the load makes, by kind: an item made, one put again in place (a patch), or one moved by a `before`
	let puts = 0, loading = false;
	const loadKinds = { new: 0, patch: 0, move: 0 };
	const counted = { ...scene, put: (layer, key, shapes, place) => {
		if (loading) { puts++; loadKinds[!scene.items(layer).some((x) => x.key === key) ? 'new' : place && 'before' in place ? 'move' : 'patch']++; }
		return scene.put(layer, key, shapes, place);
	} };
	const prev = globalThis.document;
	const mA = readModel(structuredClone(doc), COMPOSED_KINDS), mB = readModel(structuredClone(doc), COMPOSED_KINDS);
	let rA;
	globalThis.document = tDoc;
	try { rA = new OLD.Renderer(mA, tRoot, { parts: PRODUCT_CANVAS }); } finally { globalThis.document = prev; }
	const rB = new impl.Renderer(mB, dRoot, { parts: PRODUCT_CANVAS, scene: counted, platform: measure ? { lengthOf, settle: () => {} } : {} });
	const sides = { A: { m: mA, r: rA, root: tRoot, doc: tDoc }, B: { m: mB, r: rB, root: dRoot, doc: dDoc } };
	for (const s of Object.values(sides)) s.reveal = new Reveal({ model: s.m, renderer: s.r, now: () => 0, onCaption() {} });
	const glyphs = { A: 0, B: 0 };
	const out = { name, measure, steps: [], glyphs, loadPuts: 0, loadKinds };
	let before = { A: [], B: [] };
	const both = (label, f) => {
		const mark = { A: tDoc.serial(), B: dDoc.serial() }, threw = {};
		for (const k of ['A', 'B']) {
			if (k === 'A') globalThis.document = tDoc;
			try { f(sides[k], k); } catch (e) { threw[k] = `${e.constructor.name}: ${e.message}`; } finally { globalThis.document = prev; }
		}
		const found = [];
		if (threw.A !== threw.B) found.push(`threw: ${threw.A} | ${threw.B}`);
		const a = JSON.stringify(tRoot.children.map(ser)), b = JSON.stringify(dRoot.children.map(ser));
		if (a !== b) { let i = 0; while (a[i] === b[i]) i++; found.push(`trees: ...${a.slice(Math.max(0, i - 80), i + 120)} | ...${b.slice(Math.max(0, i - 80), i + 120)}`); }
		// identity: each element now, made since the step began, or kept -- at the index it held among the elements before the step
		const identity = (k) => {
			const els = flat(sides[k].root), was = new Map(before[k].map((s, i) => [s, i]));
			const now = els.map((e) => (e.serial > mark[k] ? 'new' : was.has(e.serial) ? was.get(e.serial) : 'moved-in'));
			before[k] = els.map((e) => e.serial);
			return now;
		};
		const ia = identity('A'), ib = identity('B');
		if (JSON.stringify(ia) !== JSON.stringify(ib)) found.push(`identity: first differs at ${ia.findIndex((x, i) => x !== ib[i])} of ${ia.length} | ${ib.length}`);
		// the scene's items, each layer's, equal to the elements under that layer
		for (const L of scene.layers.filter((l) => !l.foreign)) {
			const g = dRoot.children.find((x) => x.attrs.id === L.name);
			if (JSON.stringify(g.children.map(ser)) !== JSON.stringify(scene.items(L.name).flatMap((it) => it.shapes).map(desc))) found.push(`items: ${L.name}`);
		}
		out.steps.push([label, found]);
	};
	loading = true;
	both('load', (s) => s.r.syncAll());
	loading = false; out.loadPuts = puts;
	out.loadItems = scene.layers.filter((l) => !l.foreign).reduce((n, l) => n + scene.items(l.name).length, 0);
	const all = (kind) => (mA.kinds.has(kind) ? structuredClone(mA.all(kind)) : []);
	const nodes = all('node').filter((n) => n.type), waypoints = all('node').filter((n) => !n.type), links = all('link'), zones = all('zone'), groups = all('group'), pipes = all('pipe');
	// a set of every kind
	if (nodes[0]) both('move a device', (s) => s.m.set('node', nodes[0].id, { x: nodes[0].x + 60 }));
	if (nodes[1]) both('rename a device', (s) => s.m.set('node', nodes[1].id, { name: 'renamed' }));
	if (waypoints[0]) both('move a waypoint', (s) => s.m.set('node', waypoints[0].id, { y: waypoints[0].y + 60 }));
	if (zones[0]) both('resize a zone', (s) => s.m.set('zone', zones[0].id, { w: zones[0].w + 60, name: '' }));
	if (groups[0]) both('rename a group', (s) => s.m.set('group', groups[0].id, { name: 'regrouped' }));
	if (pipes[0]) both('touch a pipe', (s) => s.m.set('pipe', pipes[0].id, { laid: (pipes[0].laid ?? 0) + 1 }));
	if (nodes[0]) both('restack a device', (s) => s.m.set('node', nodes[0].id, { order: 1 }));
	// a head gained, turned and lost: a link's line and twin kept, its head and leg made and removed, as the painter does
	for (const l of links.slice(0, 4)) {
		both('direct a link forward', (s) => s.m.set('link', l.id, { direction: 'forward' }));
		both('direct it in reverse', (s) => s.m.set('link', l.id, { direction: 'reverse' }));
		both('make it symmetric', (s) => s.m.set('link', l.id, { direction: undefined }));
		both('direct it again, as a control link', (s) => s.m.set('link', l.id, { direction: 'forward', control: true }));
	}
	if (links[0]) both('re-route a link', (s) => s.m.set('link', links[0].id, { via: [] }));
	// selections, hover, arming
	const some = [nodes[0], links[0], zones[0], groups[0], waypoints[0]].filter(Boolean).map((e) => e.id);
	if (some.length) both('select', (s) => s.r.reflectSelection(some));
	if (some.length > 1) both('select fewer', (s) => s.r.reflectSelection(some.slice(1)));
	const hovered = nodes[2] ?? nodes[0] ?? waypoints[0];
	if (hovered) {
		both('hover', (s) => s.r.setState(hovered.id, 'hover', true));
		both('unhover what is not hovered', (s) => s.r.setState((nodes[3] ?? hovered).id, 'hover', false));
		both('arm, then clear', (s) => { s.r.setState(hovered.id, 'armed', true); s.r.clearState(hovered.id, 'hover', 'armed'); });
	}
	// the real reveal, outside any renderer call: hide and show, a trace where the platform measures, a fade where it does not
	for (const e of [...nodes.slice(0, 2), ...links.slice(0, 2)]) {
		both('reveal hides', (s) => s.reveal.hide(e.id));
		both('reveal hides again', (s) => s.reveal.hide(e.id));
		both('reveal shows', (s) => s.reveal.show(e.id));
	}
	if (links[0]) both('a revealed link updated in place', (s) => s.m.set('link', links[0].id, { name: 'traced' }));
	// the real towers: three frames aiming every typed node at a mover beside it, the renderer's glyph lookups counted
	const towers = nodes.slice(0, 3).map((n) => ({ id: n.id, x: n.x, y: n.y, range: 9 }));
	if (towers.length) {
		for (const k of ['A', 'B']) {
			const r = sides[k].r;
			sides[k].movers = new Movers({ model: sides[k].m, renderer: { glyphOf: (id) => { glyphs[k]++; return r.glyphOf(id); } }, layer: null, now: () => 0 });
		}
		both('towers turn, three frames', (s) => { for (let f = 0; f < 3; f++) s.movers.aimTurrets({ towers }, towers.map((t) => ({ id: `m-${t.id}`, at: [t.x + 60 * (f + 1), t.y + 30], progress: 1 }))); });
		if (nodes[0]) both('a tower redrawn, then turned again', (s) => { s.m.set('node', nodes[0].id, { name: 'tower' }); s.movers.aimTurrets({ towers }, towers.map((t) => ({ id: `m-${t.id}`, at: [t.x - 60, t.y - 30], progress: 1 }))); });
	}
	// each mode and labels
	both('edit mode', (s) => s.r.setMode('edit'));
	both('run mode', (s) => s.r.setMode('run'));
	both('labels off', (s) => s.r.toggleLabels());
	both('labels on', (s) => s.r.toggleLabels());
	// a delete and a put of every kind: each put back anew, returning to its place (F-d)
	for (const [kind, list] of [['link', links.slice(1, 2)], ['node', nodes.slice(3, 4)], ['node', waypoints.slice(1, 2)], ['zone', zones.slice(0, 1)], ['group', groups.slice(0, 1)], ['pipe', pipes.slice(0, 1)]]) {
		for (const e of list) {
			both(`delete a ${kind}`, (s) => s.m.del(kind, e.id));
			both(`put the ${kind} back`, (s) => s.m.put(kind, structuredClone(e)));
		}
	}
	if (nodes[0]) both('put a device anew', (s) => s.m.put('node', { ...structuredClone(nodes[0]), name: 'again' }));
	both('view mode', (s) => s.r.setMode('view'));
	both('reload', (s) => s.m.load(structuredClone(doc)));
	if (some.length) both('select after the reload', (s) => s.r.reflectSelection(some));
	return out;
}

// ---- the editing visuals: today's builders and the native ones, side by side

/*
Each sequence drives one or more of the five visuals through what Input, the tools, the palette and the composition do with them --
made, moved, blocked, updated, hidden, removed, and written to once removed -- on today's builders (app/src/painter.js, kept verbatim),
each handed the layer element the page handed it, and on the native ones, each handed the scene. After every call the overlay's and the
snap layer's trees must be equal, attribute for attribute in order, and the same elements kept.
*/
const CANVAS = { hw: 960, hh: 540 }, GAP = 60;
const PREVIEW = [{ tag: 'use', attrs: { 'data-layer': 'frame', href: '#m-circle' } }, { tag: 'svg', attrs: { x: -13, y: -13, width: 26, height: 26, viewBox: '-15 -15 30 30', preserveAspectRatio: 'xMidYMid meet' }, children: [{ tag: 'use', attrs: { 'data-layer': 'glyph', href: '#glyph-router' } }] }];
export const VISUAL_SEQUENCES = {
	crosshair: [['make', 'cross', 'crosshair'], ['call', 'cross', 'show', { x: 60, y: -120 }], ['call', 'cross', 'show', { x: -240, y: 0 }], ['call', 'cross', 'hide'], ['call', 'cross', 'hide'], ['call', 'cross', 'show', { x: 0.5, y: -0 }]],
	ghost: [['make', 'g', 'ghostNode', PREVIEW], ['call', 'g', 'moveTo', { x: 60, y: 60 }], ['call', 'g', 'setBlocked', true], ['call', 'g', 'moveTo', { x: 120, y: 60 }], ['call', 'g', 'setBlocked', true],
		['call', 'g', 'setBlocked', false], ['call', 'g', 'remove'], ['call', 'g', 'moveTo', { x: 0, y: 0 }], ['call', 'g', 'setBlocked', true], ['call', 'g', 'remove']],
	'ghost blocked before it moves': [['make', 'g', 'ghostNode', PREVIEW], ['call', 'g', 'setBlocked', 1], ['call', 'g', 'moveTo', { x: -60, y: 30.25 }], ['call', 'g', 'setBlocked', 0], ['call', 'g', 'remove']],
	'preview rect': [['make', 'r', 'previewRect', 'marquee'], ['call', 'r', 'update', { x: 10, y: 20, w: 30, h: 40 }], ['call', 'r', 'update', { x: -10, y: -20.5, w: 0, h: 1e-7 }], ['call', 'r', 'remove'], ['call', 'r', 'update', { x: 1, y: 1, w: 1, h: 1 }], ['call', 'r', 'remove']],
	'preview line': [['make', 'l', 'previewLine'], ['call', 'l', 'update', { x: 0, y: 0 }, { x: 60, y: 60 }], ['call', 'l', 'update', { x: 0, y: 0 }, { x: -60, y: 120 }], ['call', 'l', 'remove'], ['call', 'l', 'update', { x: 1, y: 2 }, { x: 3, y: 4 }]],
	'preview path': [['make', 'p', 'previewPath'], ['call', 'p', 'update', 'M 0 0 L 60 0'], ['call', 'p', 'update', 'M 0 0 L 60 0 L 60 60'], ['call', 'p', 'remove']],
	'every visual at once': [['make', 'g', 'ghostNode', PREVIEW], ['make', 'cross', 'crosshair'], ['call', 'cross', 'show', { x: 60, y: 60 }], ['make', 'r', 'previewRect', 'textbox-preview'], ['call', 'g', 'moveTo', { x: 60, y: 60 }],
		['make', 'l', 'previewLine'], ['call', 'cross', 'show', { x: 120, y: 60 }], ['call', 'r', 'update', { x: 0, y: 0, w: 60, h: 60 }], ['make', 'p', 'previewPath'], ['call', 'l', 'update', { x: 0, y: 0 }, { x: 9, y: 9 }],
		['call', 'g', 'remove'], ['make', 'g2', 'ghostNode', PREVIEW], ['call', 'p', 'update', 'M 1 1'], ['call', 'cross', 'hide'], ['call', 'r', 'remove'], ['call', 'cross', 'show', { x: 0, y: 0 }], ['call', 'l', 'remove'], ['call', 'g2', 'setBlocked', true], ['call', 'p', 'remove'], ['call', 'g2', 'remove']],
};
export function visualSideBySide(sequence, { impl = NEW } = {}) {
	const tDoc = makeDocument(), tRoot = tDoc.attach(tDoc.createElementNS('', 'svg'));
	for (const id of CANVAS_LAYERS) { const g = tDoc.createElementNS('', 'g'); g.setAttribute('id', id); tRoot.appendChild(g); }
	const dDoc = makeDocument(), dRoot = dDoc.attach(dDoc.createElementNS('', 'svg'));
	const scene = impl.openCanvasScene(impl.CANVAS_SCENE, dRoot);
	const layerOf = (root, id) => root.children.find((g) => g.attrs.id === id);
	// today's: the crosshair on the snap layer, the composition's choice; the ghost and the previews on the overlay, Input's and the tools'
	const oldMake = { crosshair: () => OLD.painter.crosshair(layerOf(tRoot, 'snaplayer'), CANVAS, GAP), ghostNode: (p) => OLD.painter.ghostNode(layerOf(tRoot, 'overlay'), p),
		previewRect: (c) => OLD.painter.previewRect(layerOf(tRoot, 'overlay'), c), previewLine: () => OLD.painter.previewLine(layerOf(tRoot, 'overlay')), previewPath: () => OLD.painter.previewPath(layerOf(tRoot, 'overlay')) };
	const newMake = { crosshair: () => impl.visuals.crosshair(scene, CANVAS, GAP), ghostNode: (p) => impl.visuals.ghostNode(scene, p),
		previewRect: (c) => impl.visuals.previewRect(scene, c), previewLine: () => impl.visuals.previewLine(scene), previewPath: () => impl.visuals.previewPath(scene) };
	const held = { A: {}, B: {} }, before = { A: [], B: [] }, out = [];
	const prev = globalThis.document;
	for (const [op, name, what, ...args] of sequence) {
		const mark = { A: tDoc.serial(), B: dDoc.serial() };
		for (const k of ['A', 'B']) {
			if (k === 'A') globalThis.document = tDoc;
			try {
				if (op === 'make') held[k][name] = (k === 'A' ? oldMake : newMake)[what](...args);
				else held[k][name][what](...args);
			} finally { globalThis.document = prev; }
		}
		const trees = (root) => JSON.stringify(['snaplayer', 'overlay'].map((id) => ser(layerOf(root, id))));
		const found = [];
		const a = trees(tRoot), b = trees(dRoot);
		if (a !== b) found.push(`trees: ${a} | ${b}`);
		const identity = (k, root) => {
			const els = ['snaplayer', 'overlay'].flatMap((id) => flat(layerOf(root, id))), was = new Map(before[k].map((x, i) => [x, i]));
			const now = els.map((e) => (e.serial > mark[k] ? 'new' : was.has(e.serial) ? was.get(e.serial) : 'moved-in'));
			before[k] = els.map((e) => e.serial);
			return JSON.stringify(now);
		};
		if (identity('A', tRoot) !== identity('B', dRoot)) found.push('identity');
		out.push([`${op} ${name} ${op === 'make' ? what : `${what}(${args.map((x) => JSON.stringify(x)).join(', ')})`}`, found]);
	}
	return out;
}

// ---- the export

export const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
export const exportBytes = (svgDocument, doc) => sha256(svgDocument(structuredClone(doc)));

// ---- the gesture corpus: the editing layers after every step

/*
The overlay's, the snap layer's and the grids' trees after each step of a scenario, through the harness the corpus replays on, the
grids drawn into it as the composition draws them. Each tree is kept as data, attributes in order; the grids', whose dots are many and
change only on a load, by the SHA-256 of that data and its count of dots.
*/
export const harnessTree = (n, place = null) => ({ tag: n.tagName, attrs: Object.entries(n.attrs ?? {}).map(([k, v]) => [k, place?.(n, k, v) ?? v]), text: n.children?.length ? '' : (n.textContent ?? ''), children: (n.children ?? []).map((c) => harnessTree(c, place)) });
const gridOf = (layer) => ({ dots: layer.children.length, sha256: sha256(JSON.stringify(harnessTree(layer).children)) });
/*
A handle's place, as its offset from the point its part's spec answers for it now -- `point.x-6`, the overlay's half a handle short of the
point, when it is exactly there -- so the record holds where the overlay put it against its point, and not the point, which the network
computes by Math.hypot. Its point: the lone selected entity's spec (Overlay `handleSpecs`), its name the handle's data attribute.
*/
const HALF_HANDLE = 6;   // app/src/overlay.js HANDLE / 2
function handlePlaces(h) {
	const ids = h.selection.list();
	const spec = ids.length === 1 ? h.input.overlayUi.handleSpecs().get(kindOf(ids[0])) : null;
	const entity = spec && h.model.get(kindOf(ids[0]), ids[0]);
	const points = (entity && spec.points(entity, h.model)) || {};
	const attr = spec ? `data-${spec.key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}` : null;
	return (n, k, v) => {
		if (!attr || (k !== 'x' && k !== 'y') || !(n.attrs?.class ?? '').split(' ').includes('handle')) return null;
		const p = points[n.attrs[attr]];
		return p && Number(v) === p[k] - HALF_HANDLE ? `point.${k}-${HALF_HANDLE}` : `${v} (off its point)`;
	};
}
export function corpusTrees(scenario, { record, open }) {
	const steps = [];
	// each layer's content, not the layer's own element, which the harness makes before the move and the scene after it
	const capture = (h) => ({ overlay: harnessTree(h.layers['#overlay'], handlePlaces(h)).children, snaplayer: harnessTree(h.layers['#snaplayer']).children, grids: ['#grid-nodes', '#grid-zones'].map((id) => gridOf(h.layers[id])) });
	record(scenario, { withHarness: (h) => { open(h); steps.push(capture(h)); }, afterStep: (h) => steps.push(capture(h)) });
	return steps;
}
// a scenario's trees, each distinct state once and each step an index into them, so the record holds what changed
export function compact(steps) {
	const states = [], at = new Map();
	const index = steps.map((s) => { const k = JSON.stringify(s); if (!at.has(k)) { at.set(k, states.length); states.push(s); } return at.get(k); });
	return { states, steps: index };
}

// ---- section 6.3: the inputs nothing in draw produces, which now behave differently, each run on the old side and the new

// an answer as data: what it answered, numbers that are not finite named, or what it threw
const named = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x)));
const answerOf = (f) => { try { return { answered: named(f()) }; } catch (e) { return { threw: e.constructor.name, message: e.message }; } };
const EDGE_KINDS = productKinds();   // the product's kinds, the network's not composed: a zone's painter is all an edge needs
// a part whose one painter, for zones, draws what `write` draws -- the old renderer over a tree with the markup's layers, the new over a scene
function edgeRenderers(write, after = () => {}) {
	const part = { owner: 'edge', painters: [{ kind: 'zone', layer: 'zones', create: (e, kit) => write(kit, e), update() {} }] };
	const zone = { id: 'zone-ed0001', x: 0, y: 0, w: 60, h: 60, order: 1 };
	const old = () => {
		const d = makeDocument(), root = d.attach(d.createElementNS('', 'svg')), prev = globalThis.document;
		for (const id of CANVAS_LAYERS) { const g = d.createElementNS('', 'g'); g.setAttribute('id', id); root.appendChild(g); }
		globalThis.document = d;
		try {
			const m = new Model({ kinds: EDGE_KINDS });
			new OLD.Renderer(m, root, { parts: [part] });
			m.put('zone', structuredClone(zone));
			after();
			return root.children.find((g) => g.attrs.id === 'zones').children.map(ser);
		} finally { globalThis.document = prev; }
	};
	const now = (impl = NEW) => {
		const d = makeDocument(), root = d.attach(d.createElementNS('', 'svg'));
		const scene = impl.openCanvasScene(impl.CANVAS_SCENE, root), m = new Model({ kinds: EDGE_KINDS });
		new impl.Renderer(m, root, { parts: [part], scene });
		m.put('zone', structuredClone(zone));
		after();
		return root.children.find((g) => g.attrs.id === 'zones').children.map(ser);
	};
	return { old: () => answerOf(old), new: (impl) => answerOf(() => now(impl)) };
}
// a root whose screen transform is `ctm` -- old: today's toCanvas over the platform's DOMPoint, binary64 as DOMPoint computes; new: the scene's
class DOMPointStandIn { constructor(x = 0, y = 0) { this.x = x; this.y = y; } matrixTransform(m) { return { x: m.a * this.x + m.c * this.y + m.e, y: m.b * this.x + m.d * this.y + m.f }; } }
function conversion(ctm, screen) {
	const root = () => { const d = makeDocument(), r = d.attach(d.createElementNS('', 'svg')); r.getScreenCTM = () => ctm(); return r; };
	return {
		old: () => { const prev = globalThis.DOMPoint; globalThis.DOMPoint = DOMPointStandIn; try { return answerOf(() => { const p = OLD.painter.toCanvas({ clientX: screen.x, clientY: screen.y }, root()); return { x: p.x, y: p.y }; }); } finally { globalThis.DOMPoint = prev; } },
		new: (impl = NEW) => answerOf(() => ({ ...impl.openCanvasScene(impl.CANVAS_SCENE, root()).toDrawing(screen) })),
	};
}
const nest = (el, parent, depth) => { let at = parent; for (let i = 0; i < depth; i++) at = el('g', {}, at); return parent.children[0]; };
const matrix = (m) => () => ({ ...m, inverse: () => ({ ...m }) });
/*
Each edge: the 6.3 bullet it belongs to, and its two sides. `native` marks one whose new side is an editing visual, which exists from the
move; its new answer is added then (the record's `new` absent until it is).
*/
export const EDGES = {
	'attribute-name-prefixed': { class: 'attribute-form', ...edgeRenderers(({ el, layer }) => el('path', { 'xlink:href': '#x', d: 'M0 0' }, layer)) },
	'attribute-name-handler': { class: 'attribute-form', ...edgeRenderers(({ el, layer }) => el('path', { onclick: 'go()', d: 'M0 0' }, layer)) },
	'attribute-name-character': { class: 'attribute-form', ...edgeRenderers(({ el, layer }) => el('path', { 'd!': 'M0 0' }, layer)) },
	'attribute-value-not-finite': { class: 'shadow-writes-as-the-platform', ...edgeRenderers(({ el, layer }) => el('rect', { x: NaN, y: Infinity, width: 1, height: 1 }, layer)) },
	'native-attribute-value-not-finite': { class: 'attribute-value', native: true,
		old: () => answerOf(() => {
			const d = makeDocument(), layer = d.attach(d.createElementNS('', 'g')), prev = globalThis.document;
			globalThis.document = d;
			try { OLD.painter.previewRect(layer, 'marquee').update({ x: NaN, y: 0, w: Infinity, h: 1 }); return layer.children.map(ser); } finally { globalThis.document = prev; }
		}),
		new: (impl = NEW) => answerOf(() => {
			const d = makeDocument(), root = d.attach(d.createElementNS('', 'svg')), scene = impl.openCanvasScene(impl.CANVAS_SCENE, root);
			impl.visuals.previewRect(scene, 'marquee').update({ x: NaN, y: 0, w: Infinity, h: 1 });
			return root.children.find((g) => g.attrs.id === 'overlay').children.map(ser);
		}),
	},
	'tag-prefixed': { class: 'tag-form', ...edgeRenderers(({ el, layer }) => el('svg:g', {}, layer)) },
	'nested-33-deep': { class: 'nesting', ...edgeRenderers(({ el, layer }) => nest(el, layer, 33)) },
	'nested-32-deep': { class: 'nesting-control', ...edgeRenderers(({ el, layer }) => nest(el, layer, 32)) },
	'conversion-no-transform': { class: 'conversion', ...conversion(() => null, { x: 10, y: 20 }) },
	'conversion-inverse-not-a-function': { class: 'conversion', ...conversion(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: 7 }), { x: 10, y: 20 }) },
	'conversion-member-not-finite': { class: 'conversion', ...conversion(matrix({ a: NaN, b: 0, c: 0, d: 1, e: 0, f: 0 }), { x: 10, y: 20 }) },
	'conversion-answer-overflows': { class: 'conversion', ...conversion(matrix({ a: 1e308, b: 0, c: 0, d: 1, e: 0, f: 0 }), { x: 1e10, y: 0 }) },
	'conversion-finite-control': { class: 'conversion-control', ...conversion(matrix({ a: 0.5, b: 0, c: 0, d: 0.5, e: -480, f: -270 }), { x: 10, y: 20 }) },
	'root-refuses-a-layer': {
		class: 'root-refuses',
		old: () => answerOf(() => {
			// today the page's markup held the layers: a root that refuses to take an element is never asked to, and the renderer draws
			const d = makeDocument(), root = d.attach(d.createElementNS('', 'svg')), prev = globalThis.document;
			for (const id of CANVAS_LAYERS) { const g = d.createElementNS('', 'g'); g.setAttribute('id', id); root.appendChild(g); }
			root.appendChild = () => { throw new Error('the root refuses'); };
			globalThis.document = d;
			try { new OLD.Renderer(new Model({ kinds: EDGE_KINDS }), root, { parts: PRODUCT_CANVAS }); return { layers: root.children.length }; } finally { globalThis.document = prev; }
		}),
		new: (impl = NEW) => {
			const d = makeDocument(), root = d.attach(d.createElementNS('', 'svg'));
			const ground = d.createElementNS('', 'rect'); root.appendChild(ground);
			let taken = 0;
			const append = root.appendChild;
			root.appendChild = (c) => { if (++taken === 4) throw new Error('the root refuses'); return append(c); };
			const answer = answerOf(() => impl.openCanvasScene(impl.CANVAS_SCENE, root));
			return { ...answer, left: root.children.length };
		},
	},
	// a painter keeps its element and writes it once its call has returned, with no renderer call to follow: at once, as today
	'change-after-the-call': { class: 'after-the-call', ...(() => {
		let kept = null;
		return edgeRenderers(({ el, layer }) => { kept = el('rect', { class: 'kept', width: 1 }, layer); return kept; }, () => kept.setAttribute('width', 2));
	})() },
};

// ---- the record, and where the old code is kept

// the commit at which the copies and the record were read, the code before the move whole; MOVED once app/src/renderer.js is the adapter
export const READ_AT = 'afef004';
export const MOVED = true;   // H26.4: app/src/renderer.js and server/svg.mjs are the adapter
export const ORIGINALS = [
	{ file: 'app/src/renderer.js', copy: 'tests/fixtures/pre-scene/app/src/renderer.js', sha256: '43d6fdeee5d0b3124a53058ab57f1f52afe902f2ac3535d648fcbae320283425' },
	{ file: 'app/src/painter.js', copy: 'tests/fixtures/pre-scene/app/src/painter.js', sha256: 'b8aaafb50e7c5265671eeb6e87e772bde8085bbabe5e5bee7e8234740c6b4f6e' },
	{ file: 'server/svg.mjs', copy: 'tests/fixtures/pre-export/server/svg.mjs', sha256: 'c659aad767cbaaf121d72902dce65553c7aa76fef0c3024a6d2d0e6cb036c07e' },
];
export const fileSha = (file) => sha256(fs.readFileSync(path.join(ROOT, file)));
export const RECORD = new URL('./scene-parity-record.json', import.meta.url);
export const readRecord = () => JSON.parse(fs.readFileSync(RECORD, 'utf8'));
/*
The corpus's harness, its grids drawn into it as the composition draws them. RESTATED at the move: the grids are items of the scene the
harness opens, whose layers it finds; before the move they were drawn into layers made here, as the page's markup held them.
*/
export async function treesOpen() {
	const { Grids } = await import('../../app/src/grids.js');
	return (h) => { new Grids({ scene: h.scene, parts: PRODUCT_CANVAS, model: h.model }); };
}
export const edgeAnswers = (impl = NEW) => Object.fromEntries(Object.entries(EDGES).map(([id, e]) => [id, { class: e.class, old: e.old(), new: e.new(impl) }]));

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1] && process.argv[2] === '--write') {
	if (MOVED) throw new Error('the record is written from the code before the move, while app/src/renderer.js is the original');
	for (const o of ORIGINALS) if (fileSha(o.file) !== o.sha256 || fileSha(o.copy) !== o.sha256) throw new Error(`${o.file} or its copy is not the original read at ${READ_AT}`);
	const { SCENARIOS, record } = await import('./gesture-corpus.mjs');
	const open = await treesOpen();
	const out = {
		about: 'H26.4: the side-by-side\'s record, written by tests/fixtures/scene-parity.mjs --write from the code before the move: the overlay\'s, the snap layer\'s and the grids\' trees after every step of the gesture corpus, each distinct state once, a handle at its offset from its point; and each input section 6.3 lists, both answers. Never written by hand.',
		readAt: READ_AT,
		trees: Object.fromEntries(SCENARIOS.map((s) => [s.id, compact(corpusTrees(s, { record, open }))])),
		edges: edgeAnswers(),
	};
	fs.writeFileSync(RECORD, `${JSON.stringify(out, null, '\t')}\n`);
	console.log(`scene-parity: wrote ${Object.keys(out.trees).length} scenarios' trees and ${Object.keys(out.edges).length} edges to ${RECORD.pathname}`);
}

// the documents a machine holds outside the repository -- a server's diagrams, the probe's read-only copies -- through the side-by-side and
// the export both ways; each document said by its path and a count, never its content
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1] && process.argv[2] === '--docs') {
	let docs = 0, steps = 0, differ = 0, exportsUnequal = 0, glyphsUnequal = 0;
	for (const dir of process.argv.slice(3)) {
		for (const [name, doc] of documentsIn(dir)) {
			docs++;
			for (const measure of [false, true]) {
				const run = pageSideBySide(name, doc, { measure });
				steps += run.steps.length;
				const bad = run.steps.filter(([, found]) => found.length);
				differ += bad.length;
				if (run.glyphs.A !== run.glyphs.B) glyphsUnequal++;
				if (bad.length) console.log(`  ${name}${measure ? ', measured' : ''}: ${bad.length} step(s) differ, first ${bad[0][0]}: ${bad[0][1].join('; ').slice(0, 300)}`);
			}
			if (exportBytes(OLD.svgDocument, doc) !== exportBytes(NEW.svgDocument, doc)) { exportsUnequal++; console.log(`  ${name}: the export differs`); }
		}
	}
	console.log(`scene-parity --docs: ${docs} document(s), ${steps} step(s), ${differ} differing, ${glyphsUnequal} with glyph lookups unequal, ${exportsUnequal} export(s) not byte-identical`);
	process.exit(differ || exportsUnequal || glyphsUnequal ? 1 : 0);
}
