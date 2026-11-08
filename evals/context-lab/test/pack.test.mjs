/*
The map evaluation's own tests (H28.3, B440): the committed board and answers agree, the scorers pass a right outcome and fail a wrong
one, the measures count what they say, each arm's patch lands exactly or is refused, and the shim runs draw's CLI against draw's
server in a workspace with no port, refusing what a task does not allow and carrying a lock from call to call.

  node --test evals/context-lab/test/
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync, spawnSync } from 'node:child_process';
import { answersOf, boardOf, edgeClear, inArea, taskScores, measures, diffDocs, cellIn } from '../hooks/scoring.mjs';
import { patch, PATCHES } from '../hooks/arm-cli.mjs';
import { DEVICES, LINKS, ZONES, TARGETS } from '../tools/generate.mjs';
import { DOOR, HOST, packDigest, pinnedRevision, readPack, stateOf } from '../tools/fixture-lib.mjs';

const PACK = path.resolve(import.meta.dirname, '..');
const REPO = path.resolve(PACK, '..', '..');
const json = (...p) => JSON.parse(fs.readFileSync(path.join(PACK, ...p), 'utf8'));
const diagram = json('data', 'diagram.json');
const answers = json('data', 'answers.json');
const clone = (x) => JSON.parse(JSON.stringify(x));
const node = (doc, name) => doc.nodes.find((n) => n.name === name);
const withNode = (doc, n) => { const d = clone(doc); d.nodes.push({ id: `node-${n.name}`, order: 999, ...n }); return d; };

test('the committed board is the generator\'s, and its answers are read from it', () => {
	const b = boardOf(diagram);
	assert.equal(b.devices.length, DEVICES.length, 'every device, no more');
	for (const [name, type, cx, cy] of DEVICES) assert.deepEqual([node(diagram, name)?.type, ...b.byName.get(name).cell], [type, cx, cy], name);
	assert.equal(diagram.links.length, LINKS.length);
	assert.deepEqual(diagram.zones.map((z) => z.name).sort(), ZONES.map((z) => z[0]).sort());
	assert.deepEqual(answersOf(diagram), answers, 'data/answers.json is answersOf(data/diagram.json)');
	assert.equal(diagram.log, undefined, 'no undo log: the fixture\'s history is empty');
});

test('every experiment is stamped with the digest of what scores it, so recording one pins the scoring and the data too', () => {
	for (const e of readPack().experiments) assert.ok(json(e).notes.includes(`pack digest ${packDigest()}`), `${e}: run tools/build-fixture.mjs --stamp`);
});

test('the targets sit two cells inside their chunks at both sizes, with decoys, one vxlan, and T6\'s edges tested both ways', () => {
	for (const t of TARGETS) assert.ok(edgeClear(...boardOf(diagram).byName.get(t).cell), t);
	const names = new Set(diagram.nodes.map((n) => n.name));
	for (const d of ['vault-1', 'vault-2', 'vault-3', 'vault-4', 'vault-5', 'vault-6', 'fw-north-1', 'fw-north-2', 'fw-north-4', 'db-west-1', 'db-west-3', 'app-east-4', 'app-east-6']) assert.ok(names.has(d), d);
	assert.equal(boardOf(diagram).devices.filter((n) => n.type === 'vxlan').length, 1);
	const cells = boardOf(diagram).devices.map((n) => n.cell);
	for (const [inside, outside] of [[[20, -20], [19, 0]], [[70, -20], [71, 0]], [[20, -20], [21, -21]], [[25, 10], [22, 11]]]) {
		assert.ok(cells.some((c) => c[0] === inside[0] && c[1] === inside[1]) && inArea(inside), `a device at ${inside}`);
		assert.ok(cells.some((c) => c[0] === outside[0] && c[1] === outside[1]) && !inArea(outside), `a device just outside, at ${outside}`);
	}
	assert.ok(boardOf(diagram).waypoints.some((w) => inArea(w.cell)), 'a waypoint inside T6\'s area, not to be counted');
	assert.equal(answers['t6-count'].count, 16);
});

test('the answer scorers pass the right answer, in the forms an agent writes it, and fail a wrong one', () => {
	const s = (scenario, answer, after = diagram) => taskScores(scenario, { answer, before: diagram, after, answers }).success;
	assert.equal(s('t1-find', '68,16\n'), 1);
	assert.equal(s('t1-find', 'vault-7: 68, 16'), 1, 'a name before the cell is not read as a number');
	assert.equal(s('t1-find', '68,15'), 0, 'a wrong cell fails');
	assert.equal(s('t1-find', ''), 0, 'no answer fails');
	assert.equal(s('t2-trace', 'spine-4 52,-18'), 1);
	assert.equal(s('t2-trace', 'spine-4, 52,-18'), 1, 'spine-4, then a comma, is not the cell -4,52');
	assert.equal(s('t2-trace', 'spine-2 52,-18'), 0, 'the wrong device fails');
	assert.equal(s('t2-trace', 'spine-4 -40,5'), 0, 'the wrong cell fails');
	assert.equal(s('t6-count', '16'), 1);
	assert.equal(s('t6-count', '15\n16'), 0, 'the first line is the answer');
	assert.deepEqual(cellIn('tun-q7 -62,-20'), [-62, -20]);
});

test('the edit scorers: the one asked-for change passes; a wrong cell, a wrong type or a second change fails', () => {
	const s = (scenario, after, answer = '') => taskScores(scenario, { answer, before: diagram, after, answers });
	const sw = (x, y, extra = {}) => withNode(diagram, { name: 'sw-new', type: 'server', x: x * 60, y: y * 60, ...extra });
	assert.equal(s('t3-place', sw(-49, -18)).success, 1, 'east of fw-north-3');
	assert.equal(s('t3-place', sw(-50, -19)).success, 1, 'north of it');
	assert.equal(s('t3-place', sw(-48, -18)).success, 0, 'two cells away');
	assert.equal(s('t3-place', sw(-49, -18, { type: 'host' })).success, 0, 'a host, not a server');
	const moved = sw(-49, -18); node(moved, 'vault-1').x += 60;
	assert.equal(s('t3-place', moved).success, 0, 'something else moved');
	const [db, app] = [node(diagram, 'db-west-2').id, node(diagram, 'app-east-5').id];
	const linked = (src, dst, via = []) => { const d = clone(diagram); d.links.push({ id: 'link-new', name: 'link-new', src, dst, via, order: 99 }); return d; };
	assert.equal(s('t4-wire', linked(app, db)).success, 1, 'either direction');
	const bent = linked(db, app, ['node-wp']); bent.nodes.push({ id: 'node-wp', name: 'node-wp', x: 0, y: 1200, order: 98 });
	assert.equal(s('t4-wire', bent).success, 1, 'with a waypoint of its own');
	assert.equal(s('t4-wire', linked(db, node(diagram, 'app-east-4').id)).success, 0, 'to a decoy');
	const two = linked(db, app); two.links.push({ id: 'link-x', name: 'link-x', src: db, dst: node(diagram, 'vault-1').id, via: [], order: 100 });
	assert.equal(s('t4-wire', two).success, 0, 'a second link');
	const h = (x, y) => withNode(diagram, { name: 'h-west', type: 'host', x: x * 60, y: y * 60 });
	assert.deepEqual(s('t5-hunt', h(-63, -20), 'tun-q7 -62,-20'), { found: 1, placed: 1, success: 1 });
	assert.deepEqual(s('t5-hunt', h(-61, -20), 'tun-q7 -62,-20'), { found: 1, placed: 0, success: 0 }, 'east of it, not west');
	assert.deepEqual(s('t5-hunt', h(-63, -20), 'tun-q7 -62,-21'), { found: 0, placed: 1, success: 0 }, 'a wrong cell in the answer');
	assert.equal(diffDocs(diagram, diagram).added.nodes.length, 0);
});

test('the measures: wrong-chunk reads, reads to the target, and senses followed, from the shim\'s log', () => {
	const read = (argv, w, senses = []) => ({ verb: 'map', exit: 0, argv, allowed: true, map: { window: w, senses } });
	const chunk = (i, j) => ({ x0: 31 * i - 15, x1: 31 * i + 15, y0: 17 * j - 8, y1: 17 * j + 8 });
	const near = (i, j, n = 1) => [{ dir: 'e', n, chunk: [i, j] }];
	// T1's vault-7 at 68,16 is in chunk 2,1: 0,0 then 1,0 (nearer) then -1,0 (farther: wrong) then 1,0 again (no nearer: wrong) then 2,1
	const log = [read(['map'], chunk(0, 0), near(1, 0)), read(['map', '--chunk', '1,0'], chunk(1, 0), near(2, 0, 0)), read(['map', '--chunk', '-1,0'], chunk(-1, 0)),
		read(['map', '--chunk', '1,0'], chunk(1, 0)), read(['map', '--chunk', '2,1'], chunk(2, 1)), read(['map', '--chunk', '2,0'], chunk(2, 0)),
		{ verb: 'about', exit: 0, argv: ['about', 'vault-7'] }, { verb: 'get', exit: 2, allowed: false, argv: ['get', 'nodes'] }];
	const m = measures('t1-find', log, answers);
	assert.deepEqual([m['map-calls'], m['wrong-reads'], m['reads-to-target'], m['target-reads'], m['saw-targets']], [6, 2, 5, 1, 1]);
	assert.deepEqual([m['senses-followed'], m['followed-content'], m['other-reads'], m.refused, m['draw-calls']], [3, 2, 1, 1, 8], '1,0 twice and 2,0 printed; 2,0 named nothing');
	const t6 = measures('t6-count', [read(['map', '--chunk', '1,0'], chunk(1, 0)), read(['map', '--chunk', '1,0'], chunk(1, 0))], answers);
	assert.equal(t6['wrong-reads'], 1, 'a second read of the same part of T6\'s area adds nothing');
	assert.equal(measures('t5-hunt', [], answers)['map-calls'], 0, 'no log, no reads');
});

test('each arm\'s patch lands exactly on draw\'s CLI at the pinned revision, or the arm is refused', () => {
	const text = execFileSync('git', ['-C', REPO, 'show', `${pinnedRevision()}:cli/verbs.mjs`], { encoding: 'utf8', maxBuffer: 1 << 26 });
	assert.equal(patch('cli-a', text), text, 'a and a2: draw\'s CLI as shipped');
	assert.match(patch('cli-b', text), /const CHUNK = Object\.freeze\(\{ w: 17, h: 17 \}\);/);
	const c = patch('cli-c', text);
	assert.ok(!c.includes("'beyond the window:'") && !c.includes('beyond: senses.beyond'), 'c: no senses in the text or the --json');
	assert.equal(PATCHES['cli-c'].length, 4);
	assert.throws(() => patch('cli-b', text.replace('w: 31, h: 17', 'w: 33, h: 17')), /expected 1/, 'a CLI the patch does not fit refuses the arm');
	assert.throws(() => patch('cli-z', text), /no patch/);
});

test('the shim: draw\'s CLI against draw\'s server, in process with no port, its refusals and its lock carried between calls', () => {
	const ws = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'draw-map-shim-'));
	try {
		fs.mkdirSync(path.join(ws, '.draw', 'home', '.config', 'draw'), { recursive: true });
		fs.writeFileSync(path.join(ws, 'draw'), DOOR, { mode: 0o755 });
		fs.copyFileSync(path.join(PACK, 'fixture', 'shim.mjs'), path.join(ws, '.draw', 'shim.mjs'));
		fs.symlinkSync(REPO, path.join(ws, '.draw', 'runtime'));
		fs.writeFileSync(path.join(ws, '.draw', 'policy.json'), JSON.stringify({ allow: ['map', 'lock', 'add'] }));
		fs.writeFileSync(path.join(ws, '.draw', 'state.json.gz'), stateOf(diagram));
		fs.writeFileSync(path.join(ws, '.draw', 'home', '.config', 'draw', 'context'), JSON.stringify({ [HOST]: diagram.meta.id }));
		const draw = (...argv) => spawnSync(process.execPath, [path.join(ws, 'draw'), ...argv], { cwd: ws, encoding: 'utf8', timeout: 60000 });
		const map = draw('map', '--chunk', '2,1');
		assert.equal(map.status, 0, map.stderr);
		assert.match(map.stdout, /68,16 +h {2}vault-7/, 'chunk 2,1 shows vault-7');
		assert.doesNotMatch(map.stdout, /\[ store \]/, 'the server\'s console lines are not the agent\'s');
		const refused = draw('about', 'vault-7');
		assert.equal(refused.status, 2);
		assert.match(refused.stderr, /allows only these verbs: map, lock, add/);
		assert.equal(draw('add', 'host', 'at', '-63,-20', '--name', 'h-west').status, 1, 'a write without the lock is draw\'s refusal');
		assert.equal(draw('lock').status, 0);
		const add = draw('add', 'host', 'at', '-63,-20', '--name', 'h-west');
		assert.equal(add.status, 0, `the lock held from the call before: ${add.stderr}`);
		const after = JSON.parse(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ws, '.draw', 'state.json.gz')))).files[`${diagram.meta.id}.json`]);
		assert.ok(after.nodes.some((n) => n.name === 'h-west' && n.x === -63 * 60), 'the write reached the stored state');
		const log = fs.readFileSync(path.join(ws, '.draw', 'log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
		assert.deepEqual(log.map((e) => [e.verb, e.allowed, e.exit]), [['map', true, 0], ['about', false, 2], ['add', true, 1], ['lock', true, 0], ['add', true, 0]]);
		assert.deepEqual(log[0].map.window, { x0: 47, x1: 77, y0: 9, y1: 25 });
		assert.equal(log[0].map.senses.length, 8);
		assert.deepEqual(log[0].chunkSize, [31, 17]);
		assert.ok(!fs.readdirSync(path.join(ws, '.draw')).some((f) => f.startsWith('run-') || f === 'lock'), 'nothing left behind by a call');
	} finally { fs.rmSync(ws, { recursive: true, force: true }); }
});
