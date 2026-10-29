/*
H26.8 (dev/design/components/NATIVE-SHAPES.md section 4.2; appendix A, "the record") -- THE RECORD THE DRAWING MOVES ANSWER TO.

tests/fixtures/native-record.json was written by tests/fixtures/native-record.mjs run against a fresh archive of `ca492da` outside the
repository, and committed alone; it is never regenerated. Here it is held to what section 4.2 says it is -- every scenario of its table,
each seen to exercise what it names; its coverage of the drawing modules -- and the tree is held to it under the moves built so far:
`MOVE` is `trace` while the tree is `ca492da` with moves 1 and 2, and each drawing move sets it to itself as it lands (`painters`,
`pipes`), the comparison allowing what 4.2's table allows that move and every move before it (`compareScenario`).

The comparison is checked here against the record itself, with nothing drawn, so its allowances are seen to be the table's and no more:
the record against itself under `record`; today's trace refused after the trace move; attribute order and class token order allowed
from the painters move on, but not on a load, where a class's own tokens keep their order; NS13's lifetimes and NS16's twin required
from the painters move on; rule P's descriptions exact per step from the pipes move on, every pipe taken from the model; the root's
classes held under every move. And from the pipes move each put of a load step judged by section 4.2's load rule (NS17), on the live
run's tags (GR14): 170 load steps, every put tagged, and every fault appendix A plants for the rule failing it. An empty scenario fails before anything is compared, and a state, mark or
combined-pipe scenario emptied from its boundary on fails its own proof. tests/native-record-mutants.test.js plants faults in the
drawing code and sees the record fail.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NATIVE_RECORD, WRITTEN_FROM, GROUPS, MEASURED, UNREACHABLE, STATE_CLASSES, scenarios, runScenario, compareScenario, proofOf, layersAt, storedDocuments, coverageDocuments,
	sha256, IDS, H, rulePAt, countPuts, PIPES, keyOf } from './fixtures/native-record.mjs';
import { svgDocument } from '../server/svg.mjs';

const RECORD = JSON.parse(fs.readFileSync(NATIVE_RECORD, 'utf8'));
const ALL = scenarios();
const MOVE = 'pipes';   // the drawing moves built on this tree: moves 2, 3 and 4, the trace, the painters and the pipes
// each scenario run live once, tagged (the pipes move's load rule), for the comparison and the faults planted in its tags below
const LIVE = new Map();
const liveOf = (name) => { if (!LIVE.has(name)) LIVE.set(name, runScenario(ALL[name], { tags: true })); return LIVE.get(name); };

/*
Section 4.2's table, as the scenarios name its rows: each group's scenarios, and the number of each. A row 4.2 names that the record
lacks fails here by name.
*/
const STATES = ['hover', 'the idle ring', 'armed', 'armed-clone', 'a link end\'s drag state', 'selected', 'on-selected-path', 'blocking'];
const BOUNDARIES = ['a structural change', 'a mode change each way', 'deletion and undo', 'a load'];
const TABLE = {
	loads: [...[...storedDocuments(), ...coverageDocuments()].map(([name]) => `loads: ${name}`),
		'loads: the record\'s board swapped for one lacking a zone, a device, a waypoint, their links and two pipes, in view, edit and run'],
	'pipe triggers, alone': ['a hand pipe made', 'a hand pipe made, then laid again by a link', 'a link pipe laid again by hand', 'a hand pipe deleted', 'its endpoint moved, no link changed', 'an up link made over it, and deleted',
		'a link rerouted onto it', 'another pipe opening a route, and swept', 'a transit off and on', 'a load', 'an answer accepted with links listed before pipes', 'an answer refused',
		'a board seeded', 'a drag judged with no commit', 'run mode and back', 'the pipe selected, hovered and armed'].map((n) => `pipe triggers, alone: ${n}`),
	'pipe triggers, combined': ['one commit moving an endpoint, making a link and sweeping a pipe', 'a mode change with a pipe hovered and selected', 'a load with a pipe selected'].map((n) => `pipe triggers, combined: ${n}`),
	states: [...STATES.flatMap((s) => BOUNDARIES.map((b) => `states: ${s}, held across ${b}`)),
		...['on-selected-path, let go as the selection changes, then clears', 'blocking, let go as the selection changes, then clears', 'the idle ring, let go as the pointer leaves'].map((n) => `states: ${n}`)],
	marks: [...['a device', 'a waypoint'].flatMap((e) => BOUNDARIES.map((b) => `marks: unrevealed on ${e}, across ${b}`)), ...BOUNDARIES.map((b) => `marks: trace on a link, across ${b}`),
		...['its node redrawn in run mode', 'deletion and undo', 'a load', 'leaving run mode'].map((b) => `marks: aim on a tower, across ${b}`)],
	'the healed link': ['the healed link: a down link without a head gains a route by a pipe made, then loses it'],
	'transient targets': ['transient targets: a zone\'s corners, a link\'s ends, the stamp ghost, the crosshair, the datum'],
	'changes in place': ['changes in place: a zone, a group and its hull, a link and a ring left no room for their heads, a ring turned, the labels', 'changes in place: a route changed while packets fly'],
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
	assert.deepEqual(counts, { loads: 158, 'pipe triggers, alone': 57, 'pipe triggers, combined': 11, states: 159, marks: 113, 'the healed link': 5, 'transient targets': 8, 'changes in place': 16 }, 'the steps of each group, which never change');
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
		assert.deepEqual(compareScenario(sc, RECORD.scenarios[name], liveOf(name), { move: MOVE }), []);
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

/*
The verifier's SF8: a state, mark or combined-pipe scenario is for what happens at and after its boundary, so a record emptied from its
first boundary on -- the boundary step and every step after it, no event, no change, nothing held -- fails its proof; one with no
boundary, emptied after its first step.
*/
test('a state, mark or combined-pipe scenario emptied from its boundary on fails its own proof -- the boundary seen, and what NS13 holds after it', () => {
	const scs = Object.entries(ALL).filter(([, sc]) => ['states', 'marks', 'pipe triggers, combined'].includes(sc.group));
	assert.equal(scs.length, 54);
	for (const [name, sc] of scs) {
		const rec = copy(RECORD.scenarios[name]), b = rec.steps.findIndex((s, k) => k > 0 && s.boundary);
		rec.steps = rec.steps.map((s, k) => (k < (b > 0 ? b : 1) ? s : { ...s, events: [], layers: {}, puts: undefined, held: {}, marks: { unrevealed: [], aims: {} }, note: undefined }));
		assert.ok(proofOf(sc, rec).length > 0, `${name}: emptied from step ${b > 0 ? b : 1}, its proof still held`);
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
	const changes = 'changes in place: a zone, a group and its hull, a link and a ring left no room for their heads, a ring turned, the labels';
	const z = reshaped(copy(RECORD.scenarios[changes]), IDS.zone, 'order'), zLoad = reshaped(copy(RECORD.scenarios[changes]), IDS.zone, 'order', { loads: true });
	assert.ok(compareScenario(ALL[changes], RECORD.scenarios[changes], z, { move: 'trace' }).length, 'a zone\'s attributes reordered: refused before the painters move');
	assert.deepEqual(compareScenario(ALL[changes], RECORD.scenarios[changes], z, { move: 'painters' }).filter((p) => p.includes(IDS.zone)), [], 'allowed by it, on a step that is not a load');
	assert.ok(compareScenario(ALL[changes], RECORD.scenarios[changes], zLoad, { move: 'painters' }).some((p) => p.includes(IDS.zone)), 'refused on a load, which the painters move draws in order');
	const hover = 'states: hover, held across a structural change', ht = reshaped(copy(RECORD.scenarios[hover]), IDS.device, 'tokens');
	assert.ok(compareScenario(ALL[hover], RECORD.scenarios[hover], ht, { move: 'trace' }).length, 'class tokens reordered: refused before the painters move');
	assert.deepEqual(compareScenario(ALL[hover], RECORD.scenarios[hover], ht, { move: 'painters' }).filter((p) => p.startsWith('step 1 ')), [], 'compared as a set by it, where the state is set');
	// the verifier's SF1: on a load a class is compared in order -- its own tokens in their order, its states as a set
	const wLoad = reshaped(copy(RECORD.scenarios[changes]), IDS.waypoint, 'tokens', { loads: true });
	assert.equal(RECORD.scenarios[changes].steps[0].layers.waypoints.changed[IDS.waypoint][0].attrs.class, 'waypoint junction', 'precondition: a class of two tokens of its own, at a load');
	assert.ok(compareScenario(ALL[changes], RECORD.scenarios[changes], wLoad, { move: 'painters' }).some((p) => p.startsWith('step 0 ') && p.includes(IDS.waypoint)), 'a class reversed at a load: refused by the painters move');
	assert.ok(compareScenario(ALL[changes], RECORD.scenarios[changes], wLoad, { move: 'pipes' }).some((p) => p.startsWith('step 0 ') && p.includes(IDS.waypoint)), 'and by every move after it');
});

/*
The pipes move (the verifier's SF2, SF3 and SF4): each step's descriptions exactly as rule P names them -- a pipe described twice where
rule P names it once refused, and three times; every pipe the model holds named on a mode change, run mode included, where no pipe is
drawn and the painter answers null. RESTATED at the pipes move (NS17): a load's puts are judged by the load rule, below, from the live
run's tags -- a load whose puts were not tagged refused -- in place of "no patch, no move".
*/
const asRuleP = (name, times = (n) => n) => { const rec = RECORD.scenarios[name], live = copy(rec); live.steps.forEach((s, k) => { s.describes = Object.fromEntries(Object.entries(rulePAt(rec, k)).map(([p, n]) => [p, times(n, k)])); }); return live; };
const underPipes = (name, live) => compareScenario(ALL[name], RECORD.scenarios[name], live, { move: 'pipes' });
const describing = (problems) => problems.filter((p) => /described|counts no pipe/.test(p));
test('GR14: the comparison requires of the pipes move each step\'s descriptions exactly as rule P names them, every pipe from the model, and a load\'s puts tagged', () => {
	const moved = 'pipe triggers, alone: its endpoint moved, no link changed', rec = RECORD.scenarios[moved];
	const k = rec.steps.findIndex((s) => s.label === 'its endpoint moved');
	assert.deepEqual(rulePAt(rec, k), { 'pipe-fa00a2-fb00d1': 1, [H]: 1 }, 'its endpoint moved: the two pipes naming it, once each');
	assert.equal(Object.keys(rulePAt(rec, 0)).length, 9, 'the load: every pipe, once');
	assert.deepEqual(rulePAt(rec, k + 1), {}, 'the settle: none (rule 5)');
	assert.deepEqual(describing(underPipes(moved, asRuleP(moved))), [], 'described as rule P names: held');
	assert.deepEqual(describing(underPipes(moved, asRuleP(moved, (n) => n * 2))).map((p) => p.split(':')[0]), ['step 0 (loaded)', 'step 1 (its endpoint moved)'], 'twice where rule P names once: refused, at the load and at the move');
	assert.ok(describing(underPipes(moved, asRuleP(moved, (n, i) => (i === k ? 3 : n)))).some((p) => p.startsWith(`step ${k} `)), 'three times: refused');
	assert.ok(describing(underPipes(moved, (() => { const l = copy(rec); l.steps.forEach((s) => delete s.describes); return l; })())).length, 'a run counting no descriptions: refused');
	const run = 'pipe triggers, alone: run mode and back', rr = RECORD.scenarios[run], toRun = rr.steps.findIndex((s) => s.label === 'to run mode');
	assert.equal(layersAt(rr.steps)[toRun].pipes.length, 0, 'precondition: run mode draws no pipe');
	assert.deepEqual(Object.keys(rulePAt(rr, toRun)), rr.steps[toRun].net.pipes, 'yet entering run mode describes every pipe the model holds, the painter answering null');
	assert.equal(rr.steps[toRun].net.pipes.length, 9);
	const none = asRuleP(run, (n, i) => (i === toRun ? 0 : n));
	assert.ok(describing(underPipes(run, none)).some((p) => p.startsWith(`step ${toRun} `)), 'none described on entering run mode: refused');
	const tags = (f) => { const l = copy(liveOf(moved)); f(l.steps[0]); return underPipes(moved, l).filter((p) => p.startsWith('step 0 ')); };
	assert.deepEqual(tags(() => {}), [], 'the live run, its load\'s puts tagged: held');
	assert.ok(tags((s) => { delete s.tagged; }).some((p) => /not tagged/.test(p)), 'a load whose puts were not tagged: refused');
	assert.throws(() => countPuts({ painters: new Map() }, {}, () => {}), /no name the record can count/, 'a renderer holding its scene where the record cannot count it: refused, loudly');
});

test('the comparison holds the classes the renderer writes on the page\'s root -- its modes and labels -- under every move', () => {
	const changes = 'changes in place: a zone, a group and its hull, a link and a ring left no room for their heads, a ring turned, the labels', rec = RECORD.scenarios[changes];
	const off = rec.steps.findIndex((s) => s.label === 'labels off');
	assert.deepEqual(rec.steps[off].root.split(' '), ['labels-off']);
	const live = copy(rec); live.steps[off].root = '';
	for (const move of ['record', 'trace', 'painters', 'pipes']) assert.ok(compareScenario(ALL[changes], rec, live, { move }).some((p) => p.startsWith(`step ${off} `) && p.includes('root')), `the labels not toggled: refused under ${move}`);
	const run = 'pipe triggers, alone: run mode and back', rr = RECORD.scenarios[run];
	assert.deepEqual(rr.steps.map((s) => s.root), ['', 'run-mode', ''], 'run mode marked on the root, and let go');
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
		'changes in place: a zone, a group and its hull, a link and a ring left no room for their heads, a ring turned, the labels',   // a link losing its head drops its line's cap, its twin keeps it (NS16)
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

/*
THE LOAD RULE (section 4.2, NS17; appendix A, the pipes move) -- every put the renderer makes in a load step, tagged by the calls open as
it was made: the load's describing (`syncAll` on the stack, no owner's call), a describing after the load (`render` or `update`, neither),
or an owner's put (`renderer.mark`, the editing states' `setState`, `clearState`, `reflect`). Over the record's 170 load steps: every put
tagged and none under no frame; the describing 9,127 puts as `ca492da`'s and one more per pipe item, 1,140; 22 after the refused answer,
the network's settle re-describing its links; 25 owners' puts in 22 steps -- the mark puts in exactly the record's 17 steps that patch,
the state puts in exactly NS13's five let-gos across a load.
*/
const LOAD_STEPS = () => Object.entries(RECORD.scenarios).flatMap(([name, rec]) => rec.steps.map((s, k) => (s.puts ? [name, k] : null)).filter(Boolean));
test('GR14, NS17: every put of the record\'s 170 load steps tagged and judged by the load rule -- the describing, a describing after the load, an owner\'s', () => {
	const steps = LOAD_STEPS();
	assert.equal(steps.length, 170);
	const n = { all: 0, describing: 0, pipes: 0, after: 0, owners: 0, stray: 0 }, markSteps = [], stateSteps = [], afterSteps = [];
	for (const [name, k] of steps) {
		const live = liveOf(name).steps[k], t = live.tagged;
		assert.ok(Array.isArray(t), `${name}, step ${k}: tagged`);
		assert.equal(t.length, live.puts.new + live.puts.patch + live.puts.move, `${name}, step ${k}: every put the renderer made, tagged`);
		n.all += t.length;
		n.describing += t.filter((p) => p.sync && !p.owner).length;
		n.pipes += t.filter((p) => p.sync && !p.owner && p.layer === PIPES).length;
		n.after += t.filter((p) => !p.sync && !p.owner && p.describe).length;
		n.owners += t.filter((p) => p.owner).length;
		n.stray += t.filter((p) => !p.sync && !p.owner && !p.describe).length;
		if (t.some((p) => p.owner?.call === 'mark')) markSteps.push(`${name} | ${k}`);
		if (t.some((p) => p.owner && p.owner.call !== 'mark')) stateSteps.push(`${name} | ${k}`);
		if (t.some((p) => !p.sync && !p.owner && p.describe)) afterSteps.push(`${name} | ${k}`);
	}
	assert.deepEqual(n, { all: 10314, describing: 10267, pipes: 1140, after: 22, owners: 25, stray: 0 }, 'each put, by the call it fell under');
	assert.equal(n.describing - n.pipes, 9127, 'the describing, but the pipes: ca492da\'s, put for put');
	const patching = Object.entries(RECORD.scenarios).flatMap(([name, rec]) => rec.steps.map((s, k) => (s.puts?.patch ? `${name} | ${k}` : null)).filter(Boolean));
	assert.equal(patching.length, 17);
	assert.deepEqual(markSteps.sort(), patching.sort(), 'the steps holding mark puts: exactly the record\'s 17 that patch');
	assert.deepEqual(stateSteps, ['hover', 'the idle ring', 'armed', 'armed-clone', 'a link end\'s drag state'].map((st) => `states: ${st}, held across a load | 2`), 'those holding state puts: NS13\'s five let-gos across a load');
	assert.deepEqual(afterSteps, ['pipe triggers, alone: an answer refused | 2'], 'a describing after the load: the network\'s settle after the refused answer alone');
});

/*
THE FAULTS APPENDIX A PLANTS FOR THE LOAD RULE, each in a live run's tags and each failing it: a describing patch or move; a pipe put
twice on a load; an extra describing put, the new count above the record's plus the pipes; an item the record does not hold put and
removed in place of a repeated legitimate put, the total unchanged; a describing put drawn wrong and put right by a later repeat; a
re-describing after the load that changes its item, or puts a pipe; a re-put sent to another layer and removed before the final
drawing is restored, the total unchanged; a duplicate put under a valid owner; a wrong value later restored; a state set where the
record lets it go; an owner's put on an id the record holds no change for; a put under no frame. tests/native-record-mutants.test.js
plants the rule's faults in the drawing code too. And the two the pipes move's verifier found unplanted, each the only check that
catches its fault: an owner's put into another layer where its key also stands (rule 3's layer, C5); a re-describing after the load of a
key the load did not put, as last put, in place of a repeated describing put, the total unchanged (rule 2's "a key the load put", C4).
*/
const LOADED = 'pipe triggers, alone: a load', REFUSED = 'pipe triggers, alone: an answer refused', AIMED = 'marks: aim on a tower, across a load';
const WITHHELD = 'marks: unrevealed on a device, across a load', HOVERED = 'states: hover, held across a load';
const SWAPPED = 'loads: the record\'s board swapped for one lacking a zone, a device, a waypoint, their links and two pipes, in view, edit and run';
// the load rule's problems at step `k` of a scenario's live run, its tags edited by `plant`
const planted = (name, k, plant) => {
	const live = copy(liveOf(name));
	plant(live.steps[k].tagged, live.steps[k]);
	return underPipes(name, live).filter((p) => p.startsWith(`step ${k} `) && /rule \d/.test(p));
};
const describingOf = (t) => t.filter((p) => p.sync && !p.owner);
const repeated = (t) => { const seen = new Map(); for (const [i, p] of t.entries()) { if (!p.sync || p.owner) continue; if (seen.has(p.key)) return [seen.get(p.key), i]; seen.set(p.key, i); } return null; };
const own = (p) => p.shapes[0];
test('NS17: every fault appendix A plants for the load rule fails it, in a live run\'s tags', () => {
	for (const [name, k] of [[LOADED, 0], [REFUSED, 2], [AIMED, 3], [WITHHELD, 0], [HOVERED, 2]]) assert.deepEqual(planted(name, k, () => {}), [], `control: ${name}, step ${k}, as run`);
	const fails = (what, problems, re) => assert.ok(problems.some((p) => re.test(p)), `${what}: ${problems.join(' / ') || 'held'}`);
	// the load's describing (rule 1)
	for (const kind of ['patch', 'move']) fails(`a describing ${kind}`, planted(LOADED, 0, (t) => { describingOf(t).find((p) => !p.key.startsWith('pipe-')).kind = kind; }), new RegExp(`rule 1: .* as a ${kind}`));
	fails('a pipe put twice on a load', planted(LOADED, 0, (t) => { const i = t.findIndex((p) => p.sync && p.layer === PIPES); t.splice(i + 1, 0, copy(t[i])); }), /rule 1: pipe pipe-\S+ put 2 times/);
	const extra = planted(LOADED, 0, (t) => { const [, j] = repeated(t); t.splice(j + 1, 0, copy(t[j])); });
	fails('an extra describing put, the new count above the record\'s plus pipes', extra, /rule 1: 86 new put\(s\) .* make 85/);
	assert.equal(extra.length, 1, 'and nothing else: a legitimate repeat, one too many');
	fails('an item the record does not hold put and removed in place of a repeated legitimate put', planted(LOADED, 0, (t) => { const [, j] = repeated(t); t[j].key = 'node-fa0bad'; }), /rule 1: the load's describing puts nodes node-fa0bad, an item the record does not hold after the step/);
	fails('a describing put drawn wrong and put right by a later repeat', planted(LOADED, 0, (t) => { const [i] = repeated(t); own(t[i]).attrs = { ...own(t[i]).attrs, transform: 'translate(999,999)' }; }), /rule 1: \S+ \S+ put again unlike the describing last put it/);
	// a describing after the load (rule 2)
	const afterOf = (t) => t.find((p) => !p.sync && !p.owner && p.describe);
	fails('a re-describing after the load that changes its item', planted(REFUSED, 2, (t) => { const p = afterOf(t); own(p).attrs = { ...own(p).attrs, class: `${own(p).attrs.class} stray` }; }), /rule 2: .* its description changed/);
	fails('a re-describing after the load that puts a pipe', planted(REFUSED, 2, (t) => { const pipe = t.find((p) => p.sync && p.layer === PIPES); t.push({ ...copy(pipe), sync: false, describe: 'update', prev: { layer: pipe.layer, shapes: copy(pipe.shapes) } }); }), /rule 2: update after the load puts pipes pipe-\S+: a pipe/);
	fails('a re-put sent to another layer and removed, the total unchanged', planted(REFUSED, 2, (t) => { afterOf(t).layer = 'zones'; }), /rule 2: .* into zones, its last put in /);
	// an owner's put (rule 3)
	const ownerOf = (t, call) => t.findIndex((p) => p.owner?.call === call);
	fails('a duplicate put under a valid owner', planted(WITHHELD, 0, (t) => { const i = ownerOf(t, 'mark'); t.splice(i + 1, 0, { ...copy(t[i]), prev: { layer: t[i].layer, shapes: copy(t[i].shapes) } }); }), /rule 3: mark unrevealed .* redundant/);
	fails('a wrong value later restored', planted(AIMED, 3, (t) => {
		const i = ownerOf(t, 'mark'), right = t[i], wrong = copy(right);
		const glyph = (shapes) => { const find = (sh) => (sh.attrs?.['data-layer'] === 'glyph' ? sh : (sh.children ?? []).map(find).find(Boolean)); return find(shapes[0]); };
		Object.assign(glyph(wrong.shapes).attrs, { 'data-aim': '7', transform: 'rotate(7)' });
		right.prev = { layer: right.layer, shapes: copy(wrong.shapes) };
		t.splice(i, 0, wrong);
	}), /rule 3: mark aim .* data-aim "7", the record holding "-143"/);
	fails('a state set where the record lets it go', planted(HOVERED, 2, (t) => {
		const p = t[ownerOf(t, 'setState')], was = p.prev.shapes;
		p.prev.shapes = p.shapes; p.shapes = was; p.owner.args = [p.owner.args[0], 'hover', true];
	}), /rule 3: setState puts nodes node-fa00a1: hover set on node-fa00a1, where the record lets it go/);
	fails('an owner\'s put on an id the record holds no change for', planted(HOVERED, 2, (t) => {
		const bravo = t.findLast((p) => p.sync && p.key === IDS.bravo), shapes = copy(bravo.shapes);
		own({ shapes }).attrs.class = `${own({ shapes }).attrs.class} hover`;
		t.push({ key: IDS.bravo, layer: bravo.layer, kind: 'patch', sync: false, owner: { call: 'setState', args: [IDS.bravo, 'hover', true] }, describe: null, prev: { layer: bravo.layer, shapes: copy(bravo.shapes) }, shapes });
	}), /rule 3: setState puts nodes node-fa00a2: hover set on node-fa00a2, the record holding no change of it across the step/);
	// the verifier's two (rule 3's layer, C5; rule 2's "a key the load put", C4): each the one problem, so nothing else catches it
	const alone = (what, problems, re) => assert.ok(problems.length === 1 && re.test(problems[0]), `${what}: ${problems.join(' / ') || 'held'}`);
	alone('a mark put into another layer where its key also stands', planted(AIMED, 3, (t) => { t[ownerOf(t, 'mark')].layer = 'links'; }), /rule 3: mark aim puts links node-fb00c1: into links, its previous put in nodes$/);
	alone('a state put into another layer where its key also stands', planted(HOVERED, 2, (t) => { t[ownerOf(t, 'setState')].layer = 'zones'; }), /rule 3: setState puts zones node-fa00a1: into zones, its previous put in nodes$/);
	alone('a re-describing after the load of a key the load did not put, in place of a repeated describing put', planted(SWAPPED, 1, (t) => {
		const gone = liveOf(SWAPPED).steps[0].tagged.findLast((p) => p.key === IDS.echo);   // echo, which the swapped board lacks, as last put
		assert.ok(gone && !t.some((p) => p.key === IDS.echo), 'precondition: drawn before the swap, and not put by it');
		const [, j] = repeated(t);
		t.splice(j, 1);
		t.push({ key: IDS.echo, layer: gone.layer, kind: 'new', sync: false, owner: null, describe: 'render', prev: { layer: gone.layer, shapes: copy(gone.shapes) }, shapes: copy(gone.shapes) });
	}), /rule 2: render after the load puts nodes node-fa00a5: a key the load did not put/);
	// a put under no frame (rule 4)
	fails('a put under no frame', planted(LOADED, 0, (t) => { const p = describingOf(t)[0]; t.push({ ...copy(p), sync: false, describe: null, owner: null }); }), /rule 4: .* under no frame/);
});

/*
THE PIPES LAYER'S ORDER, an erratum of the pipes move's build (tests/fixtures/native-record.mjs `pipesInOrder`): from the pipes move the
pipes layer holds the record's items in the order rule P puts them -- a load's describing in the model's order, a pipe made last, a pipe
described again where it stands. The record's own order is refused at the two steps where `ca492da`'s drawer put another, and an order
rule P would not put is refused at every step.
*/
test('the pipes layer under the pipes move: the record\'s items, in the order rule P puts them -- the model\'s on a load, each kept item where it stood otherwise', () => {
	const swap = 'loads: the record\'s board swapped for one lacking a zone, a device, a waypoint, their links and two pipes, in view, edit and run';
	const laid = 'pipe triggers, alone: a link pipe laid again by hand';
	const order = (name, k) => layersAt(liveOf(name).steps)[k][PIPES].map(([key]) => key);
	const recorded = (name, k) => layersAt(RECORD.scenarios[name].steps)[k][PIPES].map(([key]) => key);
	for (const [name, k] of [[swap, 3], [laid, 1], [laid, 2]]) {
		assert.notDeepEqual(order(name, k), recorded(name, k), `${name}, step ${k}: the record's order is not the one rule P puts`);
		assert.deepEqual([...order(name, k)].sort(), [...recorded(name, k)].sort(), 'its items the record\'s');
	}
	assert.deepEqual(order(swap, 3), liveOf(swap).steps[3].pipeOrder.filter((id) => order(swap, 3).includes(id)), 'a load: the model\'s order');
	assert.deepEqual(order(laid, 1), order(laid, 0), 'a pipe laid again by hand: where it stood');
	// a live run putting its pipes in an order rule P does not: refused, at a load and at a step that is not one
	const reversed = (name, k) => { const l = copy(liveOf(name)); const s = l.steps[k]; const items = layersAt(l.steps)[k][PIPES]; s.layers[PIPES] = { keys: items.map(([key]) => key).reverse(), changed: Object.fromEntries(items) }; return underPipes(name, l).filter((p) => p.startsWith(`step ${k} `) && p.includes('rule P puts them')); };
	assert.ok(reversed(swap, 0).length, 'reversed at a load: refused');
	assert.ok(reversed(laid, 1).length, 'reversed at a pipe laid again: refused');
});

/*
Rule P's cost (4.6): never more work than today. `ca492da`'s drawer reconciled every pipe the model held at each model change and each
mode change, and again at each settle; rule P describes at most that, at every step of every scenario -- and a node moved, only the
pipes ending at it.
*/
test('GR14: rule P describes no more pipes at any step than ca492da\'s drawer reconciled -- every pipe at each model change and mode change', () => {
	let steps = 0, today = 0, now = 0;
	for (const [name, rec] of Object.entries(RECORD.scenarios)) {
		liveOf(name).steps.forEach((s, k) => {
			const was = rec.steps[k], changes = was.events.length + (k > 0 && rec.steps[k - 1].mode !== was.mode ? 1 : 0);
			const described = Object.values(s.describes ?? {}).reduce((a, b) => a + b, 0);
			const reconciled = changes * was.net.pipes.length;
			assert.ok(described <= Math.max(reconciled, was.puts ? was.net.pipes.length : 0), `${name}, step ${k}: ${described} described, today ${reconciled}`);
			steps++; today += reconciled; now += described;
		});
	}
	assert.ok(steps === 527 && now < today, `${now} pipe descriptions over the record's 527 steps, where today's drawer reconciled ${today}`);
	const moved = 'pipe triggers, alone: its endpoint moved, no link changed', k = RECORD.scenarios[moved].steps.findIndex((s) => s.label === 'its endpoint moved');
	assert.deepEqual(Object.keys(liveOf(moved).steps[k].describes).sort(), ['pipe-fa00a2-fb00d1', H].sort(), 'a node moved: only the pipes ending at it');
});
