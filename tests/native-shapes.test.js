/*
H26.8's painters move (dev/design/components/NATIVE-SHAPES.md sections 3.2, 3.3 and 4.2; NS5, NS13, NS16; GR2, GR3, GR8, GR12) -- THE
NATIVE SHAPES. Each painter and appearance answers its entity's shapes, data, and the renderer describes each entity whole and puts it
by part, the editing states (app/src/editing-states.js) and the simulation's marks written on a copy of the description.

Held here, beside the record the drawing moves answer to (tests/native-record.test.js):
  GR2   the live shadow gone; the renderer refuses a painter bringing `create` or `update`, or answering no `shapes`
  GR3   the kit every painter and appearance is handed holds exactly 3.2's members, `shared` only for a painter declaring it
  GR8   the renderer answers data alone, each member called over a drawn board; tools/scan-writers.mjs counts every spelling that finds
        an element, by file, each negative fixture failing
  GR12  every record document in every mode drawn as the record holds it on a load -- each item's parts, each shape's attributes in
        order; an element kept across an update keeps its key
  NS13  each lifetime the move changes, by its own test, the record's step beside it where today differs; from the pipes move a pipe's
        states on its line through a repaint, the pipes the renderer's to draw, where the network's hook handed a state on (the
        painters move's B1)
  NS5   an id the renderer does not draw holds no mark; a description answering nothing drops the entity's marks (3.2, rule 3); a mark
        read back is a frozen copy
  NS16  the healed link's step differs from the record by its twin's `stroke-linecap` alone
  NS3   from the pipes move, a pipe's states on its line, the shape bearing its id, never its group, as the export's resolver styles it
        (section 3.2; reading 3, o:F1); what the pipes share empty with no network (a:F4)
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Model } from './fixtures/composed.mjs';
import { makeRenderer } from './fixtures/client-harness.mjs';
import { NATIVE_RECORD, IDS, scenarios, runScenario, layersAt, layersOf, ownOf, classOf, world, recordBoard, storedDocuments, coverageDocuments,
	load, edit, E, hover, arm, frame, H, PIPES } from './fixtures/native-record.mjs';
import { Renderer } from '../app/src/renderer.js';
import { EditingStates } from '../app/src/editing-states.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { SIMULATION_CANVAS } from '../plugins/simulation/spawn-appearance.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RECORD = JSON.parse(fs.readFileSync(NATIVE_RECORD, 'utf8'));
const ALL = scenarios();
// a scenario run live, its layers at each step beside the record's
const lived = (name) => {
	const live = runScenario(ALL[name], { tags: true }), rec = RECORD.scenarios[name];
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
	// the pipes move: the pipe painter declares `shared` (rule P), and its kit holds it beside the six
	const sharing = new Set(PRODUCT_CANVAS.flatMap((part) => (part.painters ?? []).filter((p) => p.shared).map((p) => `${p.kind} shapes`)));
	assert.deepEqual([...sharing], ['pipe shapes'], 'the one painter that shares');
	for (const [who, kit] of kits) assert.deepEqual(Object.keys(kit), sharing.has(who) ? [...KIT, 'shared'] : KIT, who);
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
const RENDERER_MEMBERS = ['constructor', 'toggleLabels', 'renderOpts', 'setMode', 'watchMode', 'handle', 'invalidatedBy', 'syncAll', 'render', 'stackOf',
	'refFor', 'place', 'draws', 'update', 'kit', 'sharedOf', 'compose', 'describe', 'applied', 'putPart', 'putFresh', 'patch', 'reput', 'restate', 'mark',
	'markOf', 'ownShapeOf', 'drawerOf', 'redrawAfter', 'refreshGatherer', 'unput', 'remove'];
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
		// the pipes move: a pipe, drawn by the renderer outside run mode, and rule P's schedule
		ask('setMode', 'view');
		const pipe = w.model.get('pipe', H);
		assert.ok(r.drawn.get(H), `${H} drawn`);
		ask('ownShapeOf', H); ask('drawerOf', H); ask('describe', 'pipe', pipe); ask('kit', r.painters.get('pipe')); ask('sharedOf', r.painters.get('pipe'));
		ask('invalidatedBy', 'node'); ask('invalidatedBy', 'pipe'); ask('restate', H); ask('handle', 'set', 'pipe', pipe);
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

// tools/scan-writers.mjs over a fixture; its scene-read lines alone (the other rules' broken-scan floors fire on any partial fixture)
function sceneReadLines(files) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gr8-'));
	try {
		for (const [file, body] of Object.entries(files)) {
			fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
			fs.writeFileSync(path.join(dir, file), body);
		}
		let out;
		try { out = execFileSync('node', [path.join(ROOT, 'tools/scan-writers.mjs'), '--root', dir], { encoding: 'utf8' }); } catch (e) { out = e.stdout || ''; }
		return out.split('\n').filter((l) => /scene read\(s\), allowed/.test(l)).join('\n');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('GR8: scan-writers counts by file every spelling that finds an element -- a lookup, a traversal then a read, and a listener each fail', () => {
	// healthy: a counted file at its count, a spelling in a comment, a description's `children` written as a key
	assert.equal(sceneReadLines({
		'app/src/readout.js': '// getElementById( named in a comment\nexport const listen = (el, fn) => el.addEventListener(\'click\', fn);\n',
		'plugins/zones/zone-painter.mjs': 'export const shapes = () => [[\'\', { tag: \'g\', attrs: {}, children: [] }]];\n',
	}), '', 'nothing past its count');
	assert.match(sceneReadLines({ 'plugins/zones/zone-painter.mjs': 'export const find = (svg, id) => svg.getElementById(id);\n' }),
		/plugins\/zones\/zone-painter\.mjs: 1 scene read\(s\), allowed 0/, 'a plugin looking an element up');
	assert.match(sceneReadLines({ 'app/src/overlay.js': 'export const ownerOf = (el) => el.parentNode.getAttribute(\'id\');\n' }),
		/app\/src\/overlay\.js: 1 scene read\(s\), allowed 0/, 'the editing duty walking from an element to another, then reading it');
	assert.match(sceneReadLines({ 'app/src/selection.js': 'export const listen = (el, fn) => el.addEventListener(\'pointerdown\', fn);\n' }),
		/app\/src\/selection\.js: 1 scene read\(s\), allowed 0/, 'a listener on an element');
	assert.match(sceneReadLines({ 'app/src/readout.js': 'export const listen = (a, b, fn) => { a.addEventListener(\'click\', fn); b.addEventListener(\'click\', fn); };\n' }),
		/app\/src\/readout\.js: 2 scene read\(s\), allowed 1/, 'a counted file one past its count');
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
			// RESTATED at the pipes move: the pipes layer's items in the model's order, as a load's describing puts them (rule P, 1) -- the
			// record's, but where `ca492da`'s drawer kept a pipe's element across the load (the build's erratum, tests/fixtures/native-record.mjs `pipesInOrder`)
			const inModel = (items) => now.pipeOrder.filter((id) => items.some(([key]) => key === id)).map((id) => items.find(([key]) => key === id));
			assert.equal(JSON.stringify({ ...L[k], [PIPES]: inModel(L[k][PIPES]) }), JSON.stringify({ ...R[k], [PIPES]: inModel(R[k][PIPES]) }), `${name}, step ${k} (${s.label}): every layer, item, part and attribute, in order`);
			assert.deepEqual(L[k][PIPES].map(([key]) => key), inModel(L[k][PIPES]).map(([key]) => key), `${name}, step ${k}: the pipes in the model's order`);
			const towers = now.mode === 'run' ? Object.keys(now.marks.aims).length : 0;
			aimed += towers;
			// RESTATED at the pipes move: one more new item per pipe the load leaves drawn, the renderer's to put now
			assert.deepEqual(now.puts, { new: s.puts.new + R[k][PIPES].length, patch: towers, move: 0 }, `${name}, step ${k}: each put makes an item, as many as today's and the pipes; none moved; none patched but an aimed tower's mark`);
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

/*
NS13 at the pipes move (section 4.2's pipes row, the one change of behaviour it names): a pipe's states kept through a repaint. The
network's drawer wrote a pipe line's class whole at every repaint -- any change of the model, a mode change, a settle -- so a hover or an
arming the overlay still held was lost until the pointer moved again; and a line run mode drew afresh showed none until the overlay asked
again (the painters move's B1, met then by the editing states handing every ask to the network's hook). The renderer draws each pipe now,
describing what is held onto its line each time it puts it; a state changed is a state-only put, an ask that changes nothing puts nothing.
*/
test('NS13 (pipes): a pipe\'s hover and arming kept through a repaint -- an end moved, run mode and back, a settle -- where the network\'s repaint lost them', () => {
	const w = world();
	try {
		load(w, recordBoard());
		const line = () => layersOf(w)[PIPES].find(([key]) => key === H)?.[1][0].children.find((c) => c.attrs.id === H) ?? null;
		hover(w, 'pipe', H); arm(w, { alt: true });
		assert.deepEqual(classOf(line()), ['pipe', 'pipe-hand', 'hover', 'armed'], 'hovered and armed, on its line');
		edit(w, 'move', [E.set('node', IDS.W, { x: 300 })]);
		assert.deepEqual(classOf(line()), ['pipe', 'pipe-hand', 'hover', 'armed'], 'kept as its end moves, the pipe described again');
		w.host.settled({ label: 'move' }, { ok: true, version: 2, ops: [] });
		assert.deepEqual(classOf(line()), ['pipe', 'pipe-hand', 'hover', 'armed'], 'and through the settle');
		w.renderer.setMode('run');
		assert.equal(line(), null, 'run mode draws no pipe');
		w.renderer.setMode('view');
		assert.deepEqual(classOf(line()), ['pipe', 'pipe-hand', 'hover', 'armed'], 'drawn afresh after run mode, with what is held');
		const puts = [], inner = w.renderer.scene;
		w.renderer.scene = { ...inner, put: (...a) => { puts.push(a[1]); return inner.put(...a); } };
		w.renderer.states.setState(H, 'hover', true);
		assert.deepEqual(puts, [], 'an ask that changes nothing puts nothing');
		w.renderer.states.setState(H, 'hover', false);
		assert.deepEqual([puts, classOf(line())], [[H], ['pipe', 'pipe-hand', 'armed']], 'a state let go: one state-only put');
		w.renderer.states.setState('pipe-0d0c02-0d0c03', 'hover', true);
		assert.deepEqual(puts, [H], 'an id the renderer does not draw: nothing put, nothing marked');
	} finally { w.platform.restore(); }
});

/*
The state target (section 3.2; reading 3, o:F1; appendix A, pipe-state-target.mjs as a test): a pipe's states land on its line, the shape
bearing its id beneath its group, never the group -- so one selected hand pipe, its description styled by the export's resolver (the
page's own sheets), draws its line `pipe pipe-hand selected` in the selected pipe's colour, its group `pipe-of`, as the network drew it.
*/
test('NS3: a selected hand pipe\'s state on its line, never its group -- styled by the export\'s resolver, as the network drew it', async () => {
	const { drawingRules, styleMarkup } = await import('../server/svg-style.mjs');
	const w = world();
	try {
		load(w, recordBoard());
		w.selection.set([H]);
		const [group] = layersOf(w)[PIPES].find(([key]) => key === H)[1];
		const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
		const markup = (n) => `<${n.tag}${Object.entries(n.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}>${(n.children ?? []).map(markup).join('')}</${n.tag}>`;
		const text = styleMarkup(markup(group), drawingRules());
		const attr = (tagText, k) => new RegExp(`(?:^| )${k}="([^"]*)"`).exec(tagText)?.[1] ?? null;
		const g = /<g ([^>]*)>/.exec(text)[1], line = /<line ([^>]*?)\/?>/.exec(text)[1];
		assert.deepEqual({ group: attr(g, 'class'), line: attr(line, 'class'), stroke: attr(line, 'stroke') }, { group: 'pipe-of', line: 'pipe pipe-hand selected', stroke: '#aed581' });
		assert.equal(group.attrs.id, undefined, 'the group bears no id: the line is the state target');
	} finally { w.platform.restore(); }
});

test('NS3: what the pipes share -- the pipes an up link runs over -- empty with no network, frozen, and the same while the derivation is cached (a:F4)', async () => {
	const { occupiedOf } = await import('../plugins/network/network-queries.mjs');
	const { Model: CoreModel } = await import('../model/model.mjs');
	assert.deepEqual(occupiedOf(new CoreModel()), [], 'a Model with no network attached: none');
	const w = world();
	try {
		load(w, recordBoard());
		const a = occupiedOf(w.model), b = occupiedOf(w.model);
		assert.ok(Object.isFrozen(a) && a === b, 'frozen, and the same while the derivation is the cached one');
		assert.deepEqual([...a], RECORD.scenarios['pipe triggers, alone: a load'].steps[0].net.events.at(-1).shared, 'the record\'s `shared` after the load');
	} finally { w.platform.restore(); }
});

test('NS5 and section 3.2, rule 3: an id the renderer does not draw holds no mark, a description answering nothing drops the entity\'s marks, and a mark read back is a frozen copy', () => {
	const { svg, scene, restore } = makeRenderer();
	try {
		const m = new Model();
		const flag = (parts, v) => parts.map(([part, s]) => [part, part === '' ? { ...s, attrs: { ...s.attrs, 'data-flag': JSON.stringify(v) } } : s]);
		const zone = { kind: 'zone', layer: 'zones', stacked: true, picks: [], shapes: (e) => (e.name === 'hidden' ? null : [['', { tag: 'g', attrs: { id: e.id, class: 'zone' } }]]) };
		const r = new Renderer(m, svg, { parts: [{ owner: 'probe', painters: [zone], marks: { flag } }], scene });
		const Z = { id: 'zone-0d0d01', name: 'z', x: 0, y: 0, w: 120, h: 60 };
		const shown = () => scene.items('zones').find((it) => it.key === Z.id)?.shapes[0].attrs['data-flag'] ?? null;
		// NS5: an id not drawn holds none -- not while undrawn, nor once it is drawn
		r.mark(Z.id, 'flag', 1);
		assert.equal(r.markOf(Z.id, 'flag'), null, 'an undrawn id holds no mark');
		m.put('zone', Z);
		assert.deepEqual([r.markOf(Z.id, 'flag'), shown()], [null, null], 'nor shows one once drawn');
		// rule 3: a redraw describing nothing removes every key and drops the marks; drawn again, it holds none
		r.mark(Z.id, 'flag', 2);
		assert.deepEqual([r.markOf(Z.id, 'flag'), shown()], [2, '2']);
		r.render('zone', { ...Z, name: 'hidden' });
		assert.equal(r.markOf(Z.id, 'flag'), null, 'a redraw answering nothing drops the mark');
		assert.equal(scene.items('zones').some((it) => it.key === Z.id), false, 'and removes its item');
		r.render('zone', Z);
		assert.deepEqual([r.markOf(Z.id, 'flag'), shown()], [null, null], 'drawn again, it holds none');
		// and a change describing nothing, the same
		r.mark(Z.id, 'flag', 3);
		m.set('zone', Z.id, { name: 'hidden' });
		assert.equal(r.markOf(Z.id, 'flag'), null, 'a change answering nothing drops the mark');
		m.set('zone', Z.id, { name: 'z' });
		assert.deepEqual([r.markOf(Z.id, 'flag'), shown()], [null, null]);
		// a mark read back is a copy its owner's later writes do not reach, frozen against a reader's
		const value = { run: 'a', len: 42.5, ms: 500 };
		r.mark(Z.id, 'flag', value);
		value.len = 99;
		assert.deepEqual(r.markOf(Z.id, 'flag'), { run: 'a', len: 42.5, ms: 500 }, 'the owner\'s later write does not reach it');
		assert.throws(() => { r.markOf(Z.id, 'flag').len = 1; }, TypeError, 'frozen');
		assert.equal(shown(), JSON.stringify({ run: 'a', len: 42.5, ms: 500 }), 'and the page shows what was set');
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
