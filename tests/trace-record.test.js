/*
H26.8's trace move (dev/design/components/NATIVE-SHAPES.md sections 4.1, 4.2 and 5) -- THE RECORD MOVE 2 ANSWERS TO: the reveal's steps
and the export's bytes as production's code draws them, written from an archive of `ca492da` (tests/fixtures/trace-record.mjs).

Committed alone, before the move: so here the live code, unchanged since `ca492da` in everything the record reads, reproduces it exactly
-- every export's bytes, every step's items and caption, every trace a show began. The move restates this test to read the reveal's
steps under the trace rule (section 4.2) and the export's bytes unchanged.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TRACE_RECORD, WRITTEN_FROM, SCENARIOS, exportsOf, runScenario } from './fixtures/trace-record.mjs';

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

for (const [id, scenario] of Object.entries(SCENARIOS)) {
	test(`the reveal's steps as the record holds them: ${id}`, () => {
		assert.deepEqual(JSON.parse(JSON.stringify(runScenario(scenario))), RECORD.scenarios[id]);
	});
}
