/*
H26.8 (dev/design/components/NATIVE-SHAPES.md section 4.2; appendix A, "the record") -- THE RECORD THE DRAWING MOVES ANSWER TO.

tests/fixtures/native-record.json was written by tests/fixtures/native-record.mjs run against a fresh archive of `ca492da` outside the
repository, and committed alone; it is never regenerated. Here it is held to what section 4.2 says it is -- every scenario of its table,
each seen to exercise what it names; its coverage of the drawing modules -- and the tree is held to it under the moves built so far:
`MOVE` is `trace` while the tree is `ca492da` with moves 1 and 2, and each drawing move sets it to itself as it lands (`painters`,
`pipes`), the comparison allowing what 4.2's table allows that move and every move before it (`compareScenario`).

The comparison is checked here against the record itself, with nothing drawn, so its allowances are seen to be the table's and no more:
the record against itself under `record`; today's trace refused after the trace move; attribute order and class token order allowed
from the painters move on, but not on a load; NS13's lifetimes and NS16's twin required from the painters move on. And an empty scenario
fails before anything is compared. tests/native-record-mutants.test.js plants faults in the drawing code and sees the record fail.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NATIVE_RECORD, WRITTEN_FROM, GROUPS, MEASURED, UNREACHABLE, STATE_CLASSES, scenarios, runScenario, compareScenario, proofOf, layersAt, storedDocuments, coverageDocuments,
	sha256, IDS } from './fixtures/native-record.mjs';
import { svgDocument } from '../server/svg.mjs';

const RECORD = JSON.parse(fs.readFileSync(NATIVE_RECORD, 'utf8'));
const ALL = scenarios();
const MOVE = 'trace';   // the drawing moves built on this tree: move 2, the trace. The painters move sets 'painters' as it lands, the pipes move 'pipes'

/*
Section 4.2's table, as the scenarios name its rows: each group's scenarios, and the number of each. A row 4.2 names that the record
lacks fails here by name.
*/
const STATES = ['hover', 'the idle ring', 'armed', 'armed-clone', 'a link end\'s drag state', 'selected', 'on-selected-path', 'blocking'];
const BOUNDARIES = ['a structural change', 'a mode change each way', 'deletion and undo', 'a load'];
const TABLE = {
	loads: [...storedDocuments(), ...coverageDocuments()].map(([name]) => `loads: ${name}`),
	'pipe triggers, alone': ['a hand pipe made', 'a hand pipe made, then laid again by a link', 'a link pipe laid again by hand', 'a hand pipe deleted', 'its endpoint moved, no link changed', 'an up link made over it, and deleted',
		'a link rerouted onto it', 'another pipe opening a route, and swept', 'a transit off and on', 'a load', 'an answer accepted with links listed before pipes', 'an answer refused',
		'a board seeded', 'a drag judged with no commit', 'run mode and back', 'the pipe selected, hovered and armed'].map((n) => `pipe triggers, alone: ${n}`),
	'pipe triggers, combined': ['one commit moving an endpoint, making a link and sweeping a pipe', 'a mode change with a pipe hovered and selected', 'a load with a pipe selected'].map((n) => `pipe triggers, combined: ${n}`),
	states: STATES.flatMap((s) => BOUNDARIES.map((b) => `states: ${s}, held across ${b}`)),
	marks: [...['a device', 'a waypoint'].flatMap((e) => BOUNDARIES.map((b) => `marks: unrevealed on ${e}, across ${b}`)), ...BOUNDARIES.map((b) => `marks: trace on a link, across ${b}`),
		...['its node redrawn in run mode', 'deletion and undo', 'a load', 'leaving run mode'].map((b) => `marks: aim on a tower, across ${b}`)],
	'the healed link': ['the healed link: a down link without a head gains a route by a pipe made, then loses it'],
	'transient targets': ['transient targets: a zone\'s corners, a link\'s ends, the stamp ghost, the crosshair, the datum'],
	'changes in place': ['changes in place: a zone, a group and its hull, a link left no room for its head, a ring turned, the labels'],
};

test('the native record was written from ca492da, holding every scenario of section 4.2\'s table, by group, and every document\'s export', () => {
	assert.equal(RECORD.writtenFrom, WRITTEN_FROM);
	assert.deepEqual(Object.keys(RECORD.scenarios), Object.keys(ALL), 'every scenario recorded, in order');
	for (const [group, names] of Object.entries(TABLE)) {
		const recorded = Object.entries(RECORD.scenarios).filter(([, s]) => s.group === group).map(([n]) => n);
		assert.deepEqual(recorded, names, `${group}: each scenario its row names`);
	}
	assert.deepEqual(Object.keys(TABLE), GROUPS, 'the groups, in order');
	assert.equal(Object.keys(RECORD.exports).length, 25, 'the 18 stored documents and the 7 coverage boards, each exported');
	const counts = Object.fromEntries(GROUPS.map((g) => [g, Object.values(RECORD.scenarios).filter((s) => s.group === g).reduce((n, s) => n + s.steps.length, 0)]));
	assert.deepEqual(counts, { loads: 150, 'pipe triggers, alone': 55, 'pipe triggers, combined': 11, states: 144, marks: 113, 'the healed link': 5, 'transient targets': 8, 'changes in place': 9 }, 'the steps of each group, which never change');
});

test('every scenario the record holds exercises what it names -- its proof holds on the record alone, so no scenario is empty', () => {
	for (const [name, sc] of Object.entries(ALL)) assert.deepEqual(proofOf(sc, RECORD.scenarios[name]), [], name);
});

test('its coverage: every line of ca492da\'s drawing modules that makes a shape or writes an attribute ran while it recorded, but the sites no page reaches, each with why', () => {
	const files = Object.values(MEASURED).flat();
	assert.deepEqual(Object.keys(RECORD.coverage).sort(), [...files].sort(), 'each module of the painters, appearances, nameLabel, renderer, pipe drawer, reveal and movers measured');
	for (const f of files) {
		const c = RECORD.coverage[f];
		assert.equal(c.reached + c.allowed.length, c.sites, `${f}: every writing site reached, ${c.sites - c.reached} not, of which ${c.allowed.length} no page reaches`);
		const why = UNREACHABLE.find((u) => u.file === f);
		for (const a of c.allowed) assert.ok(why?.lines.includes(Number(a.split(':')[0])) && why.why.length > 40, `${f}: ${a} left unreached with a reason`);
		assert.ok(RECORD.archive[f] === c.sha256, `${f}: measured as the archive held it`);
	}
	const sites = files.reduce((n, f) => n + RECORD.coverage[f].sites, 0), reached = files.reduce((n, f) => n + RECORD.coverage[f].reached, 0);
	assert.deepEqual([sites, reached], [113, 108], 'the writing sites and those reached, which never change: 5 no page reaches');
});

test('every stored document and coverage board exports the bytes the record holds', () => {
	for (const [name, doc] of [...storedDocuments(), ...coverageDocuments()]) assert.equal(sha256(svgDocument(structuredClone(doc))), RECORD.exports[name], name);
});

for (const [name, sc] of Object.entries(ALL)) {
	test(`the tree draws the record under the ${MOVE} move: ${name}`, () => {
		assert.deepEqual(compareScenario(sc, RECORD.scenarios[name], runScenario(sc), { move: MOVE }), []);
	});
}

// ---- the comparison's allowances, against the record itself

const copy = (x) => JSON.parse(JSON.stringify(x));
const failing = (move, edit = (r) => r) => Object.entries(ALL).filter(([name, sc]) => compareScenario(sc, RECORD.scenarios[name], edit(copy(RECORD.scenarios[name]), name), { move }).length).map(([n]) => n);
// a live run that draws a scenario's record but nothing after its first step: no change, no event, nothing held
const emptied = (rec) => ({ ...rec, traces: [], hides: [], steps: rec.steps.map((s, k) => (k === 0 ? s : { ...s, events: [], layers: {}, puts: undefined, held: {}, marks: { unrevealed: [], aims: {} }, note: undefined })) });

test('the comparison fails a scenario whose record exercises nothing, before it compares anything -- one of each group', () => {
	for (const group of GROUPS) {
		const [name, sc] = Object.entries(ALL).find(([, s]) => s.group === group);
		const problems = compareScenario(sc, emptied(copy(RECORD.scenarios[name])), copy(RECORD.scenarios[name]), { move: 'record' });
		assert.ok(problems.length && problems.every((p) => p.startsWith('the record does not exercise what the scenario names')), `${name}: ${problems[0]}`);
	}
});

test('the comparison allows the trace move today\'s trace taken away by the rule, and nothing else', () => {
	assert.deepEqual(failing('record'), [], 'the record against itself, under nothing allowed');
	assert.deepEqual(failing('trace'), Object.keys(ALL).filter((n) => n.startsWith('marks: trace on a link')), 'today\'s trace refused after the trace move, which takes the dash away (B422)');
});

// every step's own item of `id`, its attributes reordered or its class tokens reversed, at steps that are not loads, or at the loads
function reshaped(rec, id, how, { loads = false } = {}) {
	for (const s of rec.steps) {
		if (!!s.puts !== loads) continue;
		for (const { changed } of Object.values(s.layers)) {
			const shape = changed[id]?.[0];
			if (!shape) continue;
			if (how === 'order') shape.attrs = Object.fromEntries(Object.entries(shape.attrs).reverse());
			if (how === 'tokens') shape.attrs.class = shape.attrs.class.split(' ').reverse().join(' ');
		}
	}
	return rec;
}

test('the comparison allows the painters move attribute order and class token order on every step but a load', () => {
	const changes = 'changes in place: a zone, a group and its hull, a link left no room for its head, a ring turned, the labels';
	const z = reshaped(copy(RECORD.scenarios[changes]), IDS.zone, 'order'), zLoad = reshaped(copy(RECORD.scenarios[changes]), IDS.zone, 'order', { loads: true });
	assert.ok(compareScenario(ALL[changes], RECORD.scenarios[changes], z, { move: 'trace' }).length, 'a zone\'s attributes reordered: refused before the painters move');
	assert.deepEqual(compareScenario(ALL[changes], RECORD.scenarios[changes], z, { move: 'painters' }).filter((p) => p.includes(IDS.zone)), [], 'allowed by it, on a step that is not a load');
	assert.ok(compareScenario(ALL[changes], RECORD.scenarios[changes], zLoad, { move: 'painters' }).some((p) => p.includes(IDS.zone)), 'refused on a load, which the painters move draws in order');
	const hover = 'states: hover, held across a structural change', ht = reshaped(copy(RECORD.scenarios[hover]), IDS.device, 'tokens');
	assert.ok(compareScenario(ALL[hover], RECORD.scenarios[hover], ht, { move: 'trace' }).length, 'class tokens reordered: refused before the painters move');
	assert.deepEqual(compareScenario(ALL[hover], RECORD.scenarios[hover], ht, { move: 'painters' }).filter((p) => p.startsWith('step 1 ')), [], 'compared as a set by it, where the state is set');
});

/*
NS13 and NS16 after the painters move: a live run drawing today's lifetimes -- the record itself -- fails each scenario where NS13 rules
another lifetime or NS16 another twin, and where the trace move took today's trace away, and passes every other; a live run drawing what
the owners hold passes each NS13 and NS16 scenario.
*/
test('the comparison requires of the painters move NS13\'s lifetimes and NS16\'s twin, where today\'s differ, and nothing else', () => {
	const ns = failing('painters');
	assert.deepEqual(ns, [
		'pipe triggers, alone: a board seeded',   // a board seeded heals the undirected down link: its twin keeps its round cap (NS16)
		...['hover', 'the idle ring', 'armed', 'armed-clone'].flatMap((s) => [`states: ${s}, held across a structural change`, `states: ${s}, held across a mode change each way`]),
		'states: a link end\'s drag state, held across deletion and undo', 'states: selected, held across a load', 'states: on-selected-path, held across a load', 'states: blocking, held across a load',
		...['a device', 'a waypoint'].flatMap((e) => ['a structural change', 'a mode change each way', 'deletion and undo'].map((b) => `marks: unrevealed on ${e}, across ${b}`)),
		...BOUNDARIES.map((b) => `marks: trace on a link, across ${b}`),   // today's trace, taken away since the trace move (B422)
		'the healed link: a down link without a head gains a route by a pipe made, then loses it',
		'changes in place: a zone, a group and its hull, a link left no room for its head, a ring turned, the labels',   // a link losing its head drops its line's cap, its twin keeps it (NS16)
	], 'today\'s lifetimes refused where NS13 or NS16 rules another, and only there');
	// the same runs drawing what the owners hold: each state on its target while held, each mark while its owner holds it, each twin's cap its line's
	const held = (rec) => {
		const L = layersAt(rec.steps);
		rec.steps.forEach((s, k) => {
			const layers = {};
			for (const [layer, items] of Object.entries(L[k])) {
				const changed = {};
				for (const [key, shapes] of items) {
					const out = copy(shapes), id = key.split('/')[0], own = out[0]?.attrs;
					if (own?.id === id && layer !== 'pipes') {
						own.class = [...own.class.split(' ').filter((c) => !STATE_CLASSES.includes(c)), ...(s.held[id] ?? [])].join(' ');
						if (s.marks.unrevealed.includes(id)) own['data-unrevealed'] = ''; else delete own['data-unrevealed'];
					}
					if (key.endsWith('/link-hit')) { const line = items.find(([kk]) => kk === id)?.[1][0].attrs; if (line && 'stroke-linecap' in line) out[0].attrs['stroke-linecap'] = line['stroke-linecap']; else delete out[0].attrs['stroke-linecap']; }
					changed[key] = out;
				}
				layers[layer] = { keys: items.map(([key]) => key), changed };
			}
			s.layers = layers;
		});
		return rec;
	};
	assert.deepEqual(ns.filter((n) => !n.startsWith('marks: trace on a link')).filter((n) => compareScenario(ALL[n], RECORD.scenarios[n], held(copy(RECORD.scenarios[n])), { move: 'painters' }).length), [], 'each passes once drawn as its owners hold it');
});
