/*
H26.3 (dev/design/components/INPUT-CAPTURE.md section 4, acceptance step 4; sections 6.2 and 6.3; guardrail G7) -- DRAW'S CAPTURE, OLD AND
NEW, SIDE BY SIDE: BEFORE ANYTHING IS DELETED, AND ON EVERY GATE AFTER.

Draw moves its capture onto input-capture and changes nothing any input of its pages produces. So the old capture and the adapter, each
handed the same events over fakes of its own, hand Input the same event, field for field and in the same key order, and make the same
`preventDefault` and `setPointerCapture` calls, and propagate the same error: over seeded streams of events shaped as a browser makes
them, and over every event the gesture corpus and the 24 test files driving the canvas make, through the harness with the real Input.
The inputs nothing in draw produces, which 6.3 lists, are each held with both answers. The fixture, tests/fixtures/capture-parity.mjs,
says what each side is and where the old code is kept.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { READ_AT, MOVED, ORIGINAL, EDGE_RECORD, EDGES, GENERATED, generatedComparisons, edgeAnswers, recordOf, VERIFICATION_READ, RESTATED_READ } from './fixtures/capture-parity.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const readJson = (url) => JSON.parse(fs.readFileSync(url, 'utf8'));

test('H26.3: the old capture is kept whole -- the copy is app/src/capture.js as it stood at READ_AT, byte for byte', () => {
	assert.equal(ORIGINAL.copySha(), ORIGINAL.sha256, `tests/fixtures/${ORIGINAL.copy} is ${ORIGINAL.file} as it stood at ${READ_AT}`);
	if (!MOVED) assert.equal(ORIGINAL.liveSha(), ORIGINAL.sha256, `before the move, ${ORIGINAL.file} is still the original`);
	assert.equal(readJson(EDGE_RECORD).readAt, READ_AT, 'the edges\' record was read at READ_AT');
});

test('H26.3: over seeded streams of events shaped as a browser makes them, the two hand Input the same events and ask the platform alike', () => {
	const rows = generatedComparisons({ ...GENERATED, streams: 200 });
	const differ = rows.filter((r) => !r.equal);
	assert.deepEqual(differ.slice(0, 3), [], `${differ.length} of ${rows.length} generated events answered differently`);
	// the streams reach every route, with every answer a sink gives -- or a pass would prove nothing of them
	const reached = (pred) => rows.filter(pred).length;
	assert.ok(reached((r) => r.method === 'onLeave' && r.route.join() === 'leave') > 300, 'the leave');
	for (const route of ['press', 'move', 'release', 'cancelDrag', 'hover', 'double', 'keyDown', 'keyUp']) {
		assert.ok(reached((r) => r.route.includes(route)) > 300, `${route} reached`);
		assert.ok(reached((r) => r.route.includes(route) && r.claimed && r.old.prevented === 1) > 100, `${route} claimed, and preventDefault called once`);
		assert.ok(reached((r) => r.route.includes(route) && r.threw) > 50, `${route} with Input throwing`);
	}
	assert.ok(reached((r) => r.route.includes('press') && r.capture && r.old.asked !== '[]') > 300, 'a press taking the pointer, setPointerCapture asked');
	assert.ok(reached((r) => r.method === 'onKeyDown' && r.route.length === 0) > 200, 'a key typed into a field, dropped on both');
	assert.ok(reached((r) => r.method === 'onContextMenu' && r.old.prevented === 1) > 500 && reached((r) => r.method === 'onContextMenu' && r.old.prevented === 0) > 100,
		'the menu suppressed off a field and left in one (B75)');
	assert.equal(rows.length, 200 * GENERATED.length);
});

/*
Section 6.3's inputs, which nothing in draw produces: each case's two answers held in the record -- as the code before the move gave them,
or, for the cases H26.3's verification added (V1, V4), as the verbatim old copy and the adapter after the move give them -- and each
difference of the kind its class says. `none` marks an input beside a class that both answer alike, showing where its line runs. Each
class outside 6.3's bullets is said where its cases are, in tests/fixtures/capture-parity.mjs EDGES.
*/
const BEGINS = /^TypeError: (pointerdown|pointermove|pointerup|pointercancel|pointerover|pointerout|dblclick|keydown|keyup): /;
const asked = (a) => JSON.parse(a.asked);
const CLASSES = {
	coordinates: (o, n) => o.handed.length === 1 && o.threw === null && n.handed.length === 0 && BEGINS.test(n.threw),
	button: (o, n) => o.handed.length === 1 && n.handed.length === 0 && BEGINS.test(n.threw),
	preventDefault: (o, n) => o.handed.length === 1 && n.handed.length === 0 && BEGINS.test(n.threw),
	'field-read': (o, n) => o.handed.length === 1 && n.handed.length === 0 && BEGINS.test(n.threw),
	'refused-both': (o, n) => o.handed.length === 0 && n.handed.length === 0 && o.threw !== null && BEGINS.test(n.threw) && o.threw !== n.threw,
	'other-family': (o, n) => o.handed.length === 1 && n.handed.length === 1 && o.handed[0].event !== n.handed[0].event && o.asked === n.asked,
	'no-pointerId': (o, n) => o.asked !== '[]' && n.asked === '[]' && o.handed[0].event === n.handed[0].event,
	conversion: (o, n) => o.handed.length === 1 && o.threw === null && n.handed.length === 0 && n.threw !== null,
	key: (o, n) => o.handed[0].event !== n.handed[0].event && JSON.parse(n.handed[0].event).key === null,
	surface: (o, n) => o.threw === null && /^Error: capture: input-capture refused the canvas -- /.test(n.threw) && JSON.parse(n.asked).added.length === 0,
	opening: (o, n) => o.threw === n.threw && o.threw !== null && asked(o).listening.length > 0 && asked(n).listening.length === 0,
	// outside 6.3's bullets (H26.3's verification, V1)
	'pointerId-not-integer': (o, n) => asked(o).length === 1 && asked(o)[0].length === 1 && n.asked === '[]' && o.handed[0].event === n.handed[0].event,
	'target-read-twice': (o, n) => o.reads > 1 && n.reads === 1 && JSON.stringify(o.handed) !== JSON.stringify(n.handed) && o.threw === null && n.threw === null,
	'leave-refused': (o, n) => o.handed.length === 1 && o.handed[0].route === 'leave' && o.threw === null && n.handed.length === 0 && /^TypeError: pointerleave: /.test(n.threw),
	'typed-refused': (o, n) => o.handed.length === 0 && o.threw === null && n.handed.length === 0 && /^TypeError: keydown: /.test(n.threw),
	// H26.4 (dev/design/components/VECTOR-SCENE.md section 6.3, its fourth bullet): the adapter converts by the canvas's scene, which refuses a
	// root answering no transform with Errors' Error where toCanvas threw a TypeError -- neither side handing Input anything
	'scene-conversion': (o, n) => o.handed.length === 0 && n.handed.length === 0 && /^TypeError: /.test(o.threw) && /^Error: toDrawing: /.test(n.threw),
};

test('H26.3: each input section 6.3 lists answers differently, of the kind its bullet says, both answers held -- and the inputs beside each alike', () => {
	const live = edgeAnswers();
	const record = readJson(EDGE_RECORD);
	assert.deepEqual(Object.keys(live), EDGES.map((c) => c.id), 'every case answered');
	assert.equal(record.verification.read, VERIFICATION_READ, 'the verification section says where its answers were read');
	const held = [...Object.keys(record.edges), ...Object.keys(record.verification.edges)];
	assert.deepEqual([...held].sort(), EDGES.map((c) => c.id).sort(), 'the record holds every case, once');
	assert.equal(new Set(held).size, held.length, 'and none in both sections');
	/*
	AMENDED H26.4 (dev/design/components/VECTOR-SCENE.md section 6.3; appendix B): the cases whose adapter answer the scene's conversion
	changed, restated with both answers -- the old side's as held before, the new refused by the scene's toDrawing -- and no other case.
	*/
	assert.equal(record.restated.read, RESTATED_READ, 'the restated section says where its answers were read');
	assert.deepEqual(Object.keys(record.restated.edges), ['conversion-nan', 'leave-no-transform', 'move-no-transform'], 'the conversions alone');
	for (const [id, r] of Object.entries(record.restated.edges)) {
		const was = record.edges[id] ?? record.verification.edges[id];
		assert.deepEqual(r.old, was.old, `${id}: the old side answers as the record held it`);
		assert.match(r.new.threw, /^Error: toDrawing: /, `${id}: the scene's conversion refuses it`);
	}
	for (const c of EDGES) {
		const { old, new: neu, equal } = live[c.id];
		assert.deepEqual(live[c.id], recordOf(record, c.id), `${c.id}: both answers are the ones the record holds`);
		if (c.class === 'none') { assert.equal(equal, true, `${c.id}: both answer alike`); continue; }
		assert.equal(equal, false, `${c.id}: the two answer differently`);
		assert.ok(CLASSES[c.class](old, neu), `${c.id} differs as a ${c.class} case does:\nold ${JSON.stringify(old)}\nnew ${JSON.stringify(neu)}`);
	}
	assert.deepEqual([...new Set(EDGES.map((c) => c.class))].filter((k) => k !== 'none').sort(), Object.keys(CLASSES).sort(), 'every class held by a case');
});

/*
Every event the tests make: the gesture corpus and the files driving the canvas through the harness, run with DRAW_CAPTURE_PARITY naming
a folder, so the harness's capture drives both sides with each event -- the real side with Input, the other replaying what Input wrote
and threw -- and records each comparison. Those files, found by what they call, are the 24 appendix B counts.
*/
const DRIVING = /\.capture\.on[A-Z]/;
const drivers = () => fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js') && DRIVING.test(fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8'))).sort();

test('H26.3: every event the gesture corpus and the tests driving the canvas make reaches Input alike through both, and asks the platform alike', { timeout: 240000 }, () => {
	const files = drivers();
	assert.equal(files.length, 24, `the 24 test files driving the canvas through the harness: ${files.join(', ')}`);
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-parity-'));
	try {
		const run = spawnSync(process.execPath, ['--test', '--test-reporter=dot', ...[...files, 'gesture-corpus.test.js'].map((f) => path.join('tests', f))],
			// a run of its own: the runner's NODE_TEST_CONTEXT, inherited, would make the child report to this run rather than run its files
			{ cwd: ROOT, env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT')), DRAW_CAPTURE_PARITY: folder }, encoding: 'utf8', maxBuffer: 1 << 26 });
		assert.equal(run.status, 0, `the files pass with both sides driven:\n${run.stdout.slice(-3000)}${run.stderr.slice(-2000)}`);
		const rows = fs.readdirSync(folder).flatMap((f) => fs.readFileSync(path.join(folder, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
		const differ = rows.filter((r) => !r.equal);
		assert.deepEqual(differ.slice(0, 3), [], `${differ.length} of ${rows.length} events answered differently`);
		const where = new Set(rows.map((r) => r.where));
		for (const f of [...files, 'gesture-corpus.test.js']) assert.ok(where.has(f), `${f} made events, and each was compared`);
		const per = (m) => rows.filter((r) => r.m === m).length;
		for (const m of ['onDown', 'onMove', 'onUp', 'onCancel', 'onHover', 'onDblClick', 'onKeyDown', 'onKeyUp', 'onContextMenu']) assert.ok(per(m) > 0, `${m} driven`);
		assert.ok(rows.length > 3000, `the tests' events, compared: ${rows.length}`);
		assert.ok(rows.some((r) => r.capture) && rows.some((r) => r.claimed) && rows.some((r) => r.threw), 'a press taken, an event claimed and an Input that threw among them');
	} finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
