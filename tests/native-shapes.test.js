/*
H26.8's painters move (dev/design/components/NATIVE-SHAPES.md sections 3.2, 3.3 and 4.2; NS5, NS13, NS16; GR2, GR3, GR8, GR12) -- THE
NATIVE SHAPES. Each painter and appearance answers its entity's shapes, data, and the renderer describes each entity whole and puts it
by part, the editing states (app/src/editing-states.js) and the simulation's marks written on a copy of the description.

Held here, beside the record the drawing moves answer to (tests/native-record.test.js):
  GR2   the live shadow gone; the renderer refuses a painter bringing `create` or `update`, or answering no `shapes`
  GR3   the kit every painter and appearance is handed holds exactly 3.2's members, `shared` only for a painter declaring it
  GR8   the renderer answers data alone, each member called over a drawn board
  GR12  every record document in every mode drawn as the record holds it on a load -- each item's parts, each shape's attributes in
        order; an element kept across an update keeps its key
  NS13  each lifetime the move changes, by its own test, the record's step beside it where today differs
  NS16  the healed link's step differs from the record by its twin's `stroke-linecap` alone
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Model } from './fixtures/composed.mjs';
import { makeRenderer } from './fixtures/client-harness.mjs';
import { NATIVE_RECORD, IDS, scenarios, runScenario, layersAt, layersOf, ownOf, classOf, world, recordBoard, storedDocuments, coverageDocuments,
	load, edit, E, hover, frame } from './fixtures/native-record.mjs';
import { Renderer } from '../app/src/renderer.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { SIMULATION_CANVAS } from '../plugins/simulation/spawn-appearance.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RECORD = JSON.parse(fs.readFileSync(NATIVE_RECORD, 'utf8'));
const ALL = scenarios();
// a scenario run live, its layers at each step beside the record's
const lived = (name) => {
	const live = runScenario(ALL[name]), rec = RECORD.scenarios[name];
	return { live, rec, L: layersAt(live.steps), R: layersAt(rec.steps) };
};
const at = (rec, label) => { const k = rec.steps.findIndex((s) => s.label === label); assert.ok(k >= 0, `a step "${label}"`); return k; };
const boundaries = (rec, kind) => rec.steps.map((s, k) => (s.boundary === kind ? k : -1)).filter((k) => k >= 0);
const glyphOf = (shape) => { const find = (s) => (s?.attrs?.['data-layer'] === 'glyph' ? s : (s?.children ?? []).map(find).find(Boolean)); return find(shape); };

// ---- GR2

test('GR2: the live shadow is gone, and the renderer refuses a painter that creates, updates or answers no shapes', () => {
	assert.equal(fs.existsSync(path.join(ROOT, 'app/src/shadow.js')), false, 'app/src/shadow.js deleted');
	const { svg, scene, restore } = makeRenderer();
	try {
		const m = new Model();
		const part = (painter) => [{ owner: 'p', painters: [{ kind: 'zone', layer: 'zones', stacked: true, picks: [], shapes: () => null, ...painter }] }];
		assert.doesNotThrow(() => new Renderer(m, svg, { parts: part({}), scene }), 'a painter answering its shapes is composed');
		assert.throws(() => new Renderer(m, svg, { parts: part({ create() {} }), scene }), /p's painter for zone brings create -- a painter answers its shapes/);
		assert.throws(() => new Renderer(m, svg, { parts: part({ update() {} }), scene }), /p's painter for zone brings update -- a painter answers its shapes/);
		assert.throws(() => new Renderer(m, svg, { parts: part({ shapes: undefined }), scene }), /p's painter for zone has no shapes/);
	} finally { restore(); }
	for (const part of PRODUCT_CANVAS) {
		for (const p of part.painters ?? []) {
			assert.equal(typeof p.shapes, 'function', `${part.owner}'s ${p.kind}: shapes`);
			assert.deepEqual(['create', 'update'].filter((k) => k in p), [], `${part.owner}'s ${p.kind}: neither create nor update`);
		}
		// 3.2: an appearance's `look` and `structure` go, each of its parts answering shapes
		for (const a of part.appearances ?? []) assert.deepEqual(['look', 'structure'].filter((k) => k in a), [], `${part.owner}'s ${a.id}: no look, no structure`);
	}
});

// ---- GR3

const KIT = ['model', 'mode', 'renderOpts', 'sizeOf', 'outlineOf', 'pillWidth'];
// the product's canvas parts, each function a painter or appearance is handed a kit by recording the kit it is handed (always the second argument)
function watching(kits) {
	const watched = (fn, who) => function (...args) { kits.push([who, args[1]]); return fn.apply(this, args); };
	return PRODUCT_CANVAS.map((part) => ({ ...part,
		...(part.painters ? { painters: part.painters.map((p) => ({ ...p, shapes: watched(p.shapes, `${p.kind} shapes`), ...(p.redraws ? { redraws: watched(p.redraws, `${p.kind} redraws`) } : {}) })) } : {}),
		...(part.appearances ? { appearances: part.appearances.map((a) => ({ ...a, state: watched(a.state, `${a.id} state`),
			...(a.root ? { root: { ...a.root, class: watched(a.root.class, `${a.id} root class`) } } : {}),
			...(a.parts ? { parts: Object.fromEntries(Object.entries(a.parts).map(([layer, fn]) => [layer, watched(fn, `${a.id} ${layer}`)])) } : {}),
			...(a.redraws ? { redraws: watched(a.redraws, `${a.id} redraws`) } : {}) })) } : {}) }));
}

test('GR3: every kit a painter or appearance is handed holds exactly the model, the mode, renderOpts, sizeOf, outlineOf and pillWidth', () => {
	const kits = [];
	const { svg, scene, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = new Renderer(m, svg, { parts: watching(kits), scene });
		for (const [, doc] of [['the record\'s board', recordBoard()], ...storedDocuments(), ...coverageDocuments()]) {
			m.load(structuredClone(doc));
			for (const mode of ['edit', 'run', 'view']) r.setMode(mode);
		}
		m.set('node', IDS.charlie, { x: 60 });   // a link's redraws asked
	} finally { restore(); }
	assert.ok(kits.length > 1000, `kits handed over every document and mode (${kits.length})`);
	for (const [who, kit] of kits) assert.deepEqual(Object.keys(kit), KIT, who);
	const asked = new Set(kits.map(([who]) => who));
	for (const part of PRODUCT_CANVAS) {
		for (const p of part.painters ?? []) assert.ok(asked.has(`${p.kind} shapes`), `${p.kind}'s painter asked`);
		for (const a of part.appearances ?? []) assert.ok(asked.has(`${a.id} state`), `${a.id} asked`);
	}
});

test('GR3: a painter declaring `shared` is handed what it shares in its kit, beside the six; one declaring none is not', () => {
	const kits = [];
	const { svg, scene, restore } = makeRenderer();
	try {
		const m = new Model();
		const zone = { kind: 'zone', layer: 'zones', stacked: true, picks: [], shapes: (e, kit) => { kits.push(['zone', kit]); return null; } };
		const group = { kind: 'group', layer: 'groups', stacked: false, picks: [], shared: (model) => ({ zones: model.all('zone').length }),
			shapes: (e, kit) => { kits.push(['group', kit]); return null; } };
		new Renderer(m, svg, { parts: [{ owner: 'probe', painters: [zone, group] }], scene });
		m.put('zone', { id: 'zone-0d0a01', name: 'z', x: 0, y: 0, w: 120, h: 60 });
		m.put('group', { id: 'group-0d0a02', name: 'g', members: [] });
	} finally { restore(); }
	const of = (kind) => kits.filter(([k]) => k === kind).map(([, kit]) => kit);
	assert.ok(of('zone').length && of('group').length);
	for (const kit of of('zone')) assert.deepEqual(Object.keys(kit), KIT);
	for (const kit of of('group')) { assert.deepEqual(Object.keys(kit), [...KIT, 'shared']); assert.deepEqual(kit.shared, { zones: 1 }); }
});

// ---- GR8

// an element of a page or of the fake documents: anything that can be written to or have children appended
const isElement = (v) => v !== null && typeof v === 'object' && (typeof v.setAttribute === 'function' || typeof v.appendChild === 'function');
function holdsElement(v, seen = new WeakSet()) {
	if (v === null || typeof v !== 'object') return false;
	if (isElement(v)) return true;
	if (seen.has(v)) return false;
	seen.add(v);
	const values = v instanceof Map ? [...v.keys(), ...v.values()] : v instanceof Set ? [...v] : Object.values(v);
	return values.some((x) => holdsElement(x, seen));
}
/*
Every member of the renderer, and how it is called over a drawn board -- for each of a zone, a group, a link, a device, a waypoint and a
tower. A member this table does not name fails the test, so a new one is classed before it lands; the deleted members stay deleted.
*/
const RENDERER_MEMBERS = ['constructor', 'toggleLabels', 'renderOpts', 'setMode', 'watchMode', 'handle', 'syncAll', 'render', 'stackOf', 'refFor', 'place',
	'draws', 'update', 'kit', 'compose', 'describe', 'applied', 'putPart', 'putFresh', 'patch', 'reput', 'restate', 'mark', 'markOf', 'ownShapeOf',
	'drawerOf', 'redrawAfter', 'refreshGatherer', 'unput', 'remove'];
const RETIRED_MEMBERS = ['byId', 'glyphOf', 'setState', 'clearState', 'reflectSelection', 'elementOf', 'layerOf'];

test('GR8: the renderer answers data alone -- every member called over a drawn board, its states and marks held, answers no element', () => {
	assert.deepEqual(Object.getOwnPropertyNames(Renderer.prototype), RENDERER_MEMBERS, 'the renderer\'s members, each classed below');
	for (const name of RETIRED_MEMBERS) assert.equal(name in Renderer.prototype, false, `${name} deleted`);
	const MARKS = Object.keys(SIMULATION_CANVAS.marks);
	const w = world();
	try {
		load(w, recordBoard());
		w.selection.set([IDS.link]);
		hover(w, 'node', IDS.device);
		const r = w.renderer, answers = [];
		const ask = (name, ...args) => { answers.push([name, r[name](...args)]); };
		ask('setMode', 'run');
		frame(w);
		ask('toggleLabels'); ask('toggleLabels'); ask('renderOpts'); ask('kit'); ask('watchMode', () => {});
		const ENTITIES = [['zone', IDS.zone], ['group', IDS.group], ['link', IDS.link], ['node', IDS.device], ['node', IDS.waypoint], ['node', IDS.tower]];
		for (const [kind, id] of ENTITIES) {
			const e = w.model.get(kind, id), rec = () => r.drawn.get(id);
			assert.ok(rec(), `${id} drawn`);
			ask('ownShapeOf', id); ask('drawerOf', id); for (const m of MARKS) ask('markOf', id, m);
			ask('draws', kind); ask('stackOf', kind, e); ask('describe', kind, e); ask('kit', r.painters.get(kind) ?? null);
			if (r.appearances.has(kind)) ask('compose', kind, e);
			if (r.stackOf(kind, e)) ask('refFor', kind, e, r.stackOf(kind, e));
			ask('applied', rec());
			for (const [part, shape] of r.applied(rec())) ask('putPart', rec(), part, shape);
			ask('patch', rec(), r.describe(kind, e)); ask('reput', rec()); ask('restate', id, 'hover', true);
			ask('handle', 'set', kind, e); ask('update', kind, e); ask('place', kind, e); ask('render', kind, e); ask('putFresh', rec(), null);
			ask('redrawAfter', kind, e); ask('refreshGatherer', id);
		}
		ask('mark', IDS.tower, 'aim', 30); ask('markOf', IDS.tower, 'aim');
		ask('syncAll');
		ask('unput', IDS.zone); ask('remove', IDS.group);
		const called = new Set(answers.map(([name]) => name));
		assert.deepEqual(RENDERER_MEMBERS.filter((n) => n !== 'constructor' && !called.has(n)), [], 'every member called');
		for (const [name, value] of answers) assert.equal(holdsElement(value), false, `${name} answered no element`);
		// the own shape is a copy: writing on it reaches nothing the renderer keeps
		const own = r.ownShapeOf(IDS.link);
		own.attrs.class = 'written';
		assert.notEqual(r.ownShapeOf(IDS.link).attrs.class, 'written');
	} finally { w.platform.restore(); }
});

// ---- GR12

/*
And each load's puts, which the side-by-side held before the move (tests/vector-scene-parity.test.js, a:F10): every put on a load makes
an item, as many as today's -- the items a link's creation removes and makes afresh, the waypoints at its ends (B218), among them -- and
none moves one. None patches one, but a tower the movers aim within the load's own change in run mode: its aim a mark its owner sets
again, a mark-only put (3.2, rule 4).
*/
test('GR12: every record document, in view, edit and run, drawn on its load exactly as the record holds it -- each item\'s parts, each shape\'s attributes in order', () => {
	const names = Object.keys(ALL).filter((n) => ALL[n].group === 'loads');
	assert.equal(names.length, 26, 'the 18 stored documents, the 7 coverage boards and the swap');
	let loads = 0, aimed = 0;
	for (const name of names) {
		const { live, rec, L, R } = lived(name);
		rec.steps.forEach((s, k) => {
			if (!s.puts) return;
			loads++;
			const now = live.steps[k];
			assert.equal(now.mode, s.mode, `${name}, step ${k}: its mode`);
			assert.equal(JSON.stringify(L[k]), JSON.stringify(R[k]), `${name}, step ${k} (${s.label}): every layer, item, part and attribute, in order`);
			const towers = now.mode === 'run' ? Object.keys(now.marks.aims).length : 0;
			aimed += towers;
			assert.deepEqual(now.puts, { new: s.puts.new, patch: towers, move: 0 }, `${name}, step ${k}: each put makes an item, as many as today's; none moved; none patched but an aimed tower's mark`);
		});
	}
	assert.equal(loads, 81, 'each load of each document in each mode');
	assert.ok(aimed > 0, 'a tower aimed within a load, so its mark-only put is seen');
});

test('GR12: an element kept across an update keeps its key -- a zone, a group, a link and its companions patched in place', () => {
	const w = world();
	try {
		load(w, recordBoard());
		const items = () => {
			const out = new Map();
			const walk = (n) => { const it = w.scene.itemOf(n); if (it && it.path.length === 1) out.set(n, `${it.layer}:${it.key}`); for (const c of n.children ?? []) walk(c); };
			walk(w.root);
			return out;
		};
		const before = items();
		edit(w, 'zone', [E.set('zone', IDS.zone, { w: 960, name: 'resized' })]);
		edit(w, 'group', [E.set('group', IDS.group, { name: 'renamed' })]);
		edit(w, 'move', [E.set('node', IDS.charlie, { x: 60 })]);
		edit(w, 'turn', [E.set('link', IDS.link, { direction: 'reverse' })]);
		const after = items();
		for (const [el, key] of after) if (before.has(el)) assert.equal(key, before.get(el), `an element kept keeps its key ${before.get(el)}`);
		const kept = new Set([...after].filter(([el]) => before.has(el)).map(([, key]) => key));
		for (const key of [`zones:${IDS.zone}`, `groups:${IDS.group}`, `links:${IDS.link}`, `links:${IDS.link}/head`, `links:${IDS.link}/leg`, `links:${IDS.link}/hit`]) {
			assert.ok(kept.has(key), `${key} kept across its update`);
		}
	} finally { w.platform.restore(); }
});

// ---- NS13, each change by its own test

test('NS13: `selected` is shown while selected, a load included -- where today a load loses it though the selection survives', () => {
	for (const [name, id, cls] of [['states: selected, held across a load', IDS.device, 'selected'], ['states: on-selected-path, held across a load', IDS.waypoint, 'on-selected-path']]) {
		const { rec, L, R } = lived(name);
		const [k] = boundaries(rec, 'load');
		assert.ok(classOf(ownOf(L[k], id)).includes(cls), `${name}: ${cls} shown after the load`);
		if (cls === 'selected') assert.equal(classOf(ownOf(R[k], id)).includes(cls), false, 'today\'s record: lost on the load');
	}
});

test('NS13: hover and the idle ring are kept while held, through a structural change and a mode change each way -- where today a fresh element loses them', () => {
	for (const [state, cls] of [['hover', 'hover'], ['the idle ring', 'linkband']]) {
		for (const boundary of ['a structural change', 'a mode change each way']) {
			const name = `states: ${state}, held across ${boundary}`, { rec, L, R } = lived(name);
			const steps = rec.steps.map((s, k) => k).filter((k) => k > at(rec, `${cls} set`));
			for (const k of steps) assert.ok(classOf(ownOf(L[k], IDS.device)).includes(cls), `${name}, step ${k}: ${cls} shown`);
			assert.ok(steps.some((k) => !classOf(ownOf(R[k], IDS.device)).includes(cls)), `${name}: today's record loses it`);
		}
	}
});

test('NS13: arming, a clone\'s arming and a link end\'s drag state are kept while held -- through a structural and a mode change, and the drag state through deletion and undo', () => {
	for (const [state, cls, id, kept] of [['armed', 'armed', IDS.device, ['a structural change', 'a mode change each way']], ['armed-clone', 'armed-clone', IDS.device, ['a structural change', 'a mode change each way']],
		['a link end\'s drag state', 'replugging', IDS.link, ['a structural change', 'a mode change each way', 'deletion and undo']]]) {
		for (const boundary of kept) {
			const name = `states: ${state}, held across ${boundary}`, { rec, L } = lived(name);
			for (let k = at(rec, `${cls} set`); k < rec.steps.length; k++) {
				const own = ownOf(L[k], id);
				if (own) assert.ok(classOf(own).includes(cls), `${name}, step ${k}: ${cls} shown wherever ${id} is drawn`);
				else assert.equal(rec.steps.slice(0, k + 1).filter((s) => s.boundary).at(-1)?.boundary, 'delete', `${name}, step ${k}: drawn but while deleted`);
			}
		}
	}
	// the drag state on the link an undo puts back, which today draws afresh without it
	const { rec, L, R } = lived('states: a link end\'s drag state, held across deletion and undo');
	const [undo] = boundaries(rec, 'undo');
	assert.ok(classOf(ownOf(L[undo], IDS.link)).includes('replugging'));
	assert.equal(classOf(ownOf(R[undo], IDS.link)).includes('replugging'), false, 'today\'s record: lost on the restored link');
});

test('NS13: a state target\'s classes are its description\'s, then the states in the order set -- through a redraw, where today a fresh element re-sets `selected` first', () => {
	const w = world();
	try {
		load(w, recordBoard());
		const drawn = () => classOf(ownOf(layersOf(w), IDS.device)), own = () => classOf(w.renderer.ownShapeOf(IDS.device));
		hover(w, 'node', IDS.device);
		w.selection.set([IDS.device]);
		assert.deepEqual(drawn(), [...own(), 'hover', 'selected'], 'hover set first');
		w.renderer.setMode('edit');   // every device described and put afresh
		assert.deepEqual(drawn(), [...own(), 'hover', 'selected'], 'the same order after a redraw');
		hover(w, 'node', IDS.device, false);
		w.selection.set([]);
		w.selection.set([IDS.device]);
		hover(w, 'node', IDS.device);
		assert.deepEqual(drawn(), [...own(), 'selected', 'hover'], 'selected set first');
	} finally { w.platform.restore(); }
});

test('NS13: `unrevealed` is kept through a mode change each way and a structural change -- where today a fresh element loses it until the next pass', () => {
	for (const [what, id] of [['a device', IDS.device], ['a waypoint', IDS.endpoint]]) {
		for (const boundary of ['a mode change each way', 'a structural change']) {
			const name = `marks: unrevealed on ${what}, across ${boundary}`, { rec, L, R } = lived(name);
			for (let k = at(rec, 'a pass'); k < rec.steps.length; k++) assert.notEqual(ownOf(L[k], id)?.attrs['data-unrevealed'], undefined, `${name}, step ${k}: marked`);
			assert.ok(rec.steps.some((s, k) => k > at(rec, 'a pass') && ownOf(R[k], id)?.attrs['data-unrevealed'] === undefined), `${name}: today's record loses it`);
		}
	}
});

test('NS13: `trace` is kept through a structural and a mode change, and dropped with its entity and on a load', () => {
	const id = IDS.undirected, traced = (layers) => ownOf(layers, id)?.attrs['data-trace'] !== undefined && /^--trace-len: [\d.]+; --trace-ms: \d+ms$/.test(ownOf(layers, id)?.attrs.style ?? '');
	for (const boundary of ['a structural change', 'a mode change each way']) {
		const { rec, L } = lived(`marks: trace on a link, across ${boundary}`);
		for (let k = at(rec, 'shown: its trace begun'); k < at(rec, 'past its end: a pass'); k++) assert.ok(traced(L[k]), `${boundary}, step ${k} (${rec.steps[k].label}): traced`);
		assert.equal(traced(L[at(rec, 'past its end: a pass')]), false, `${boundary}: ended past its instant`);
	}
	for (const [boundary, kind] of [['deletion and undo', 'undo'], ['a load', 'load']]) {
		const { rec, L } = lived(`marks: trace on a link, across ${boundary}`);
		assert.ok(traced(L[at(rec, 'shown: its trace begun')]), `${boundary}: traced before it`);
		for (let k = boundaries(rec, kind)[0]; k < rec.steps.length; k++) assert.equal(traced(L[k]), false, `${boundary}, step ${k} (${rec.steps[k].label}): its trace dropped`);
	}
});

test('NS13: `aim` is kept through a tower redrawn in run mode, dropped with it and on a load and set again by the movers, and cleared on leaving run mode', () => {
	for (const boundary of ['its node redrawn in run mode', 'deletion and undo', 'a load', 'leaving run mode']) {
		const { rec, L, R } = lived(`marks: aim on a tower, across ${boundary}`);
		rec.steps.forEach((s, k) => assert.equal(glyphOf(ownOf(L[k], IDS.tower))?.attrs['data-aim'], glyphOf(ownOf(R[k], IDS.tower))?.attrs['data-aim'], `${boundary}, step ${k} (${s.label}): the aim as today`));
		if (boundary === 'leaving run mode') assert.equal(glyphOf(ownOf(L.at(-1), IDS.tower))?.attrs['data-aim'], undefined, 'cleared');
	}
});

test('NS13: a mark is the renderer\'s to keep -- through a redraw, a structural change and a mode change -- and to drop with its entity and on a load', () => {
	const { svg, scene, restore } = makeRenderer();
	try {
		const m = new Model();
		const r = new Renderer(m, svg, { parts: PRODUCT_CANVAS, scene });
		m.load(structuredClone(recordBoard()));
		const held = () => [r.markOf(IDS.device, 'unrevealed'), r.markOf(IDS.undirected, 'trace'), r.markOf(IDS.tower, 'aim')];
		// what the page shows: the attribute each mark writes, on the element the scene made
		const glyphIn = (el) => { if (!el) return null; if (el.getAttribute?.('data-layer') === 'glyph') return el; for (const c of el.children ?? []) { const g = glyphIn(c); if (g) return g; } return null; };
		const byId = (id) => svg.ownerDocument.getElementById(id);
		const shown = () => [byId(IDS.device)?.getAttribute('data-unrevealed') ?? null, byId(IDS.undirected)?.getAttribute('data-trace') ?? null,
			glyphIn(byId(IDS.tower))?.getAttribute('data-aim') ?? null];
		const TRACE = { run: 'a', len: 42.5, ms: 500 };
		r.mark(IDS.device, 'unrevealed', true); r.mark(IDS.undirected, 'trace', TRACE); r.mark(IDS.tower, 'aim', 30);
		assert.deepEqual(held(), [true, TRACE, 30]);
		assert.deepEqual(shown(), ['', 'a', '30']);
		r.render('node', m.get('node', IDS.device)); r.render('node', m.get('node', IDS.tower)); r.render('link', m.get('link', IDS.undirected));
		assert.deepEqual([held(), shown()], [[true, TRACE, 30], ['', 'a', '30']], 'kept through a redraw');
		m.set('node', IDS.device, { name: 'renamed' }); m.set('link', IDS.undirected, { direction: 'forward' }); m.set('node', IDS.tower, { name: 'renamed' });
		assert.deepEqual([held(), shown()], [[true, TRACE, 30], ['', 'a', '30']], 'kept through a structural change');
		for (const mode of ['edit', 'run', 'view']) r.setMode(mode);
		assert.deepEqual([held(), shown()], [[true, TRACE, 30], ['', 'a', '30']], 'kept through a mode change each way');
		const tower = structuredClone(m.get('node', IDS.tower));
		m.del('node', IDS.tower);
		assert.equal(r.markOf(IDS.tower, 'aim'), null, 'dropped with its entity');
		m.put('node', tower);
		assert.equal(r.markOf(IDS.tower, 'aim'), null, 'and not back with it: its owner sets it again');
		m.load(structuredClone(recordBoard()));
		assert.deepEqual(held(), [null, null, null], 'every mark dropped on a load');
		assert.deepEqual(shown(), [null, null, null]);
	} finally { restore(); }
});

// ---- NS16

// a step's layers as a map of shapes, attributes and class tokens as sets: what 4.2 allows the painters move off a load
const canonical = (layers) => JSON.stringify(layers, (k, v) => {
	if (k !== 'attrs' || !v || typeof v !== 'object') return v;
	return Object.fromEntries(Object.entries(v).map(([a, x]) => [a, a === 'class' ? classOf({ attrs: { class: x } }).sort().join(' ') : x]).sort(([a], [b]) => (a < b ? -1 : 1)));
});

test('NS16: the healed link\'s step differs from the record by its twin\'s `stroke-linecap` alone -- its line, its head and the step back to down as the record', () => {
	const { rec, L, R } = lived('the healed link: a down link without a head gains a route by a pipe made, then loses it');
	const id = IDS.HEALS, twin = (layers) => layers.links.find(([key]) => key === `${id}/link-hit`)?.[1][0];
	let healed = 0;
	rec.steps.forEach((s, k) => {
		const up = ownOf(R[k], id)?.attrs['data-down'] === undefined;
		if (!up) { assert.equal(canonical(L[k]), canonical(R[k]), `step ${k} (${s.label}): down, as the record`); return; }
		healed++;
		assert.notEqual(twin(R[k])?.attrs['stroke-linecap'], undefined, `step ${k}: today's twin keeps the cap its line lost`);
		assert.equal(twin(L[k])?.attrs['stroke-linecap'], undefined, `step ${k}: the twin as a fresh draw gives it, no cap`);
		const without = structuredClone(R[k]);
		delete twin(without).attrs['stroke-linecap'];
		assert.equal(canonical(L[k]), canonical(without), `step ${k} (${s.label}): every other item, part and attribute as the record`);
	});
	assert.ok(healed > 0 && healed < rec.steps.length, 'healed, then down again');
});
