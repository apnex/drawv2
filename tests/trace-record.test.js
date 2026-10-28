/*
H26.8's trace move (dev/design/components/NATIVE-SHAPES.md sections 4.1, 4.2 and 5) -- THE RECORD MOVE 2 ANSWERS TO: the reveal's steps
and the export's bytes as production's code draws them, written from an archive of `ca492da` (tests/fixtures/trace-record.mjs).

Committed alone, before the move: so there the live code, unchanged since `ca492da` in everything the record reads, reproduced it exactly
-- every export's bytes, every step's items and caption, every trace a show began.
RESTATED at the move (section 4.2's allowed difference for the trace, B422): the export's bytes unchanged, and the reveal's steps under
the trace rule. Today's record shows the inline dash a trace wrote on its line -- `transition`, `stroke-dasharray` and
`stroke-dashoffset` in its `style`, never taken away. After the move a line carries, at a step where the record shows that dash, the
trace's attributes if the step's instant lies in `[show, show + ms)` and no hide of the line has come since the show: `data-trace`, the
name the line's traces alternate from `a`, and `style` exactly `--trace-len: <len>; --trace-ms: <ms>ms`, its length read from the line's
`d` as the step leaves it and its duration the one recorded when the trace began -- and none of them otherwise. Everything else is the
record's: every other attribute of the line in its order, every other shape and item, every other item of every layer by its hash, each
caption, and the traces each show began and the hides.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TRACE_RECORD, WRITTEN_FROM, SCENARIOS, exportsOf, runScenario, lengthOf } from './fixtures/trace-record.mjs';

const RECORD = JSON.parse(fs.readFileSync(TRACE_RECORD, 'utf8'));

test('the trace record was written from ca492da, over every template and seed and every scenario named', () => {
	assert.equal(RECORD.writtenFrom, WRITTEN_FROM);
	assert.equal(Object.keys(RECORD.exports).length, 18, 'the 18 documents: the templates, the parity board, the lab\'s boards');
	assert.deepEqual(Object.keys(RECORD.scenarios), Object.keys(SCENARIOS), 'every scenario recorded, in order');
	const steps = Object.values(RECORD.scenarios).reduce((n, s) => n + s.steps.length, 0);
	assert.equal(steps, 68);
	assert.ok(Object.values(RECORD.scenarios).some((s) => s.traces.length), 'and the record holds traces begun');
});

test('every template and seed exports the bytes the record holds', () => {
	assert.deepEqual(exportsOf(), RECORD.exports);
});

// today's trace, as the record shows it on a line: the inline dash in its `style`
const TODAY = /^transition: stroke-dashoffset [\d.e+-]+ms ease-out; stroke-dasharray: [\d.e+-]+; stroke-dashoffset: 0;$/;
const TRACE_ATTRS = ['data-trace', 'style'];
/*
The trace rule: what a line of the record's step `step` carries after the move. `traces` and `hides` are the record's -- each trace a
show began, and each hide -- of the scenario. A hide at the same instant as a show came before it: the one step that asks both of one line
asks the hide first, and a pass asks one or the other.
*/
function expectedAttrs(id, attrs, t, traces, hides) {
	const entries = Object.entries(attrs);
	if (!('style' in attrs)) return { order: entries, trace: {} };
	assert.match(attrs.style, TODAY, `${id} at ${t}: the record's style is today's trace and nothing else`);
	const order = entries.filter(([k]) => k !== 'style');
	const begun = traces.filter((x) => x.id === id && x.t <= t);
	const last = begun.at(-1);
	const active = last && t < last.t + last.ms && !hides.some((h) => h.id === id && h.t > last.t && h.t <= t);
	if (!active) return { order, trace: {} };
	return { order, trace: { 'data-trace': (begun.length - 1) % 2 === 0 ? 'a' : 'b', style: `--trace-len: ${lengthOf(attrs.d)}; --trace-ms: ${last.ms}ms` } };
}
const split = (attrs) => ({ order: Object.entries(attrs).filter(([k]) => !TRACE_ATTRS.includes(k)), trace: Object.fromEntries(TRACE_ATTRS.filter((k) => k in attrs).map((k) => [k, attrs[k]])) });

for (const [id, scenario] of Object.entries(SCENARIOS)) {
	test(`the reveal's steps as the record holds them, under the trace rule: ${id}`, () => {
		const rec = RECORD.scenarios[id], live = JSON.parse(JSON.stringify(runScenario(scenario)));
		assert.deepEqual(live.traces, rec.traces, 'the same traces begun, each at its instant, its length and its duration');
		assert.deepEqual(live.hides, rec.hides, 'the same hides');
		assert.equal(live.steps.length, rec.steps.length);
		let traced = 0, ended = 0;
		rec.steps.forEach((was, k) => {
			const now = live.steps[k], at = `${id}, step ${k} (${was.label}, t ${was.t})`;
			assert.deepEqual([now.label, now.t, now.caption], [was.label, was.t, was.caption], `${at}: the step and its caption`);
			assert.deepEqual(Object.keys(now.layers), Object.keys(was.layers), `${at}: the layers`);
			for (const [layer, w] of Object.entries(was.layers)) {
				const n = now.layers[layer];
				assert.equal(n.rest, w.rest, `${at}: every other item of ${layer}, by its hash`);
				assert.deepEqual(n.whole.map(([key]) => key), w.whole.map(([key]) => key), `${at}: the reveal entities' items in ${layer}`);
				w.whole.forEach(([key, shapes], i) => {
					const [, nowShapes] = n.whole[i];
					const [own, ...rest] = shapes, [nowOwn, ...nowRest] = nowShapes;
					assert.deepEqual(nowRest, rest, `${at}: ${key}'s other shapes`);
					assert.deepEqual({ ...nowOwn, attrs: undefined }, { ...own, attrs: undefined }, `${at}: ${key}'s own shape but its attributes`);
					if (own.attrs.id !== key) { assert.deepEqual(nowOwn.attrs, own.attrs, `${at}: ${key}'s attributes`); return; }
					const want = expectedAttrs(key, own.attrs, was.t, rec.traces, rec.hides), got = split(nowOwn.attrs);
					assert.deepEqual(got.order, want.order, `${at}: ${key}'s every other attribute, in its order`);
					assert.deepEqual(got.trace, want.trace, `${at}: ${key}'s trace, by the rule`);
					if ('style' in own.attrs) { if ('data-trace' in want.trace) traced++; else ended++; }
				});
			}
		});
		if (rec.traces.length) assert.ok(traced > 0, `${id}: some step holds a trace running, so the rule was asked of one (${ended} ended)`);
	});
}

// the record's control: under the rule, a line the record shows with today's dash after its trace carries nothing -- B422, where the
// dash was never taken away; and the rule asked of every scenario's every traced line
test('the trace rule over the whole record: traces running, and lines whose trace has ended carrying no dash', () => {
	let running = 0, ended = 0;
	for (const rec of Object.values(RECORD.scenarios)) for (const step of rec.steps) for (const { whole } of Object.values(step.layers)) for (const [key, [own]] of whole) {
		if (own.attrs.id !== key || !('style' in own.attrs)) continue;
		const want = expectedAttrs(key, own.attrs, step.t, rec.traces, rec.hides);
		if ('data-trace' in want.trace) running++; else ended++;
	}
	assert.deepEqual({ running, ended }, { running: 33, ended: 20 }, 'the rule decides both ways across the record, which never changes: 33 steps of a line tracing, 20 of one whose trace has ended');
});
