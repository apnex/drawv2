/*
H26.5 (the verifier's finding 1) -- THE LAB IS STARTED IN ONE PLACE, AND THAT PLACE WAITS 15 S.

tests/fixtures/lab-server.mjs `startLab` replaced six copies of a spawn and a poll, the shortest waiting 5 s; one copy missed by the
first fix (tests/svgexport.test.js) went on failing under load. So these hold the helper's three outcomes -- answering, exiting first,
never answering in its wait, the default wait timed -- and that no test names `lab/server.mjs` to run it but the helper.
RESTATED at the move's second verification: the exit's race raised to just under the wait (should-fix 1), the default wait timed rather
than only its constant read (note L5), and the guard reading every literal that names the lab's server, however it is spelled or run
(notes G2 to G4).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { startLab, LAB_START_WAIT_MS } from './fixtures/lab-server.mjs';
import { stopProcess } from './fixtures/teardown.mjs';
import { lex } from '../tools/js-tokens.mjs';

const groupGone = (pid) => { try { process.kill(-pid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } };
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => r(port)); }); });
const nothingAnswers = (port) => assert.rejects(fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) }), 'nothing answers on its port: the lab was stopped');

test('H26.5: startLab answers once the lab answers /health, on a port of its own', async () => {
	const lab = await startLab();
	try {
		assert.equal(lab.origin, `http://127.0.0.1:${lab.port}`);
		assert.equal((await fetch(`${lab.origin}/health`)).status, 200);
	} finally { await stopProcess(lab.proc); }
	assert.ok(groupGone(lab.proc.pid), 'and stopProcess stops it, as before');
});

test('H26.5: a lab that exits before answering -- its port taken by a listener that never answers -- rejects naming the exit', { timeout: 30000 }, async () => {
	// the lab cannot bind, and an ask of the port is accepted and never answered: each ask is bounded to a second, so the exit is seen
	const held = new Set();
	const taken = net.createServer((c) => { held.add(c); c.on('close', () => held.delete(c)); });
	await new Promise((r) => taken.listen(0, '127.0.0.1', r));
	let timer = null;
	try {
		// the message tells an exit from a time-out; the race, just under the wait, is there only so an ask left unbounded fails here rather
		// than holding the file open on the listener's socket
		const outcome = await Promise.race([startLab({ port: taken.address().port }).then(() => 'answered', (e) => e),
			new Promise((r) => { timer = setTimeout(() => r(`still waiting after ${LAB_START_WAIT_MS - 1000} ms`), LAB_START_WAIT_MS - 1000); })]);
		assert.match(String(outcome), /^Error: startLab: lab\/server\.mjs exited before answering http:\/\/127\.0\.0\.1:\d+\/health/);
	} finally { clearTimeout(timer); for (const c of held) c.destroy(); await new Promise((r) => taken.close(r)); }
});

test('H26.5: a lab that does not answer within the wait given is stopped, and the start rejects naming the wait', async () => {
	const port = await freePort();
	await assert.rejects(startLab({ port, waitMs: 0 }), new RegExp(`^Error: startLab: lab/server\\.mjs did not answer http://127\\.0\\.0\\.1:${port}/health within 0 ms$`));
	// a lab left running would bind its port in about 90 ms and answer; stopped, nothing ever does
	await new Promise((r) => setTimeout(r, 1500));
	await nothingAnswers(port);
});

/*
Note L5: the wait startLab uses when given none, timed. The lab's process is held back a minute before its server starts -- a module
imported first through NODE_OPTIONS, awaiting a timer -- so it lives and never answers; the start must reject naming 15 s, no sooner.
*/
test('H26.5 (note L5): given no wait, startLab waits 15 s for a lab that never answers, then stops it', { timeout: 45000 }, async () => {
	assert.equal(LAB_START_WAIT_MS, 15000, 'the wait tests/browser.test.js gives the product\'s server');
	const stall = 'data:text/javascript,await%20new%20Promise((r)%3D%3EsetTimeout(r,60000))';
	const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${stall}`.trim() };
	const port = await freePort();
	const t0 = Date.now();
	await assert.rejects(startLab({ port, env }), new RegExp(`^Error: startLab: lab/server\\.mjs did not answer http://127\\.0\\.0\\.1:${port}/health within 15000 ms$`));
	const waited = Date.now() - t0;
	assert.ok(waited >= 15000 && waited < 25000, `waited the 15 s, and stopped it: ${waited} ms`);
	await nothingAnswers(port);
});

/*
Notes G2 to G4: what names the lab's server to run it. A string or template literal whose value is a path to it -- 'lab/server.mjs',
"./lab/server.mjs", a template's `${root}/lab/server.mjs`, or the 'server.mjs' of path.join(root, 'lab', 'server.mjs'), the repository
having one server.mjs -- in code, comments and regular expressions not being literals (tools/js-tokens.mjs). One is allowed outside the
helper only on a line that reads the file and runs nothing: readFileSync there, and no spawn, exec, fork, execPath or Worker.
*/
const NAMES_LAB = /(^|\/)lab\/server\.mjs$|^server\.mjs$/;
const RUNS = /^(spawn\w*|exec\w*|fork|execPath|Worker)$/;
function labNamedIn(src) {
	const tokens = lex(src);
	const idsOn = (line) => tokens.filter((t) => t.line === line && t.type === 'id').map((t) => t.value);
	return tokens.filter((t) => (t.type === 'str' || t.type === 'tpl') && NAMES_LAB.test(t.value)).filter((t) => {
		const ids = idsOn(t.line);
		return !(ids.includes('readFileSync') && !ids.some((v) => RUNS.test(v)));
	}).map((t) => `${t.line}: ${t.value}`);
}

test('H26.5 (notes G2 to G4): the guard finds the lab named to run it however it is spelled or run, and passes a read, a comment, a title, a pattern', () => {
	const run = [
		"spawn(\"node\", [\"lab/server.mjs\"], {})",
		"spawnGroup('node', ['./lab/server.mjs'], {})",
		"spawn(process.execPath, ['lab/server.mjs'])",
		"spawn(process.execPath, [`${root}/lab/server.mjs`])",
		"spawn('node', [path.join(root, 'lab', 'server.mjs')])",
		"const LAB = 'lab/server.mjs';\nspawnGroup('node', [LAB]);",
		"fork('./lab/server.mjs')",
		"execFile(process.execPath, ['../lab/server.mjs'])",
		"const s = fs.readFileSync(p, 'utf8'); spawn('node', ['lab/server.mjs']);",   // a read on the line excuses no run beside it
	];
	for (const src of run) assert.equal(labNamedIn(src).length, 1, `found: ${src}`);
	const not = [
		"const src = fs.readFileSync(path.join(root, 'lab/server.mjs'), 'utf8');",
		"// spawn('node', ['lab/server.mjs'])",
		"test('no test starts lab/server.mjs but through startLab', () => {});",
		"assert.match(message, /lab\\/server\\.mjs exited/);",
	];
	for (const src of not) assert.deepEqual(labNamedIn(src), [], `passed: ${src}`);
});

test('H26.5: no test names lab/server.mjs to run it but startLab -- a copy with a wait of its own is how the 5 s one was missed', () => {
	const root = path.resolve(import.meta.dirname);
	const files = fs.readdirSync(root, { recursive: true }).filter((f) => /\.(m?js)$/.test(f));
	assert.ok(files.length > 150, `the tests were read: ${files.length}`);
	const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
	const own = labNamedIn(read('fixtures/lab-server.mjs'));
	assert.ok(own.length === 1 && /^\d+: lab\/server\.mjs$/.test(own[0]), `control: the helper's own spawn is found: ${own}`);
	const naming = Object.fromEntries(files.filter((f) => f !== 'fixtures/lab-server.mjs').map((f) => [f, labNamedIn(read(f))]).filter(([, found]) => found.length));
	assert.deepEqual(naming, {}, 'no other test names the lab\'s server but to read it');
	const callers = files.filter((f) => /\bstartLab\(/.test(read(f))).sort();
	assert.deepEqual(callers, ['fixtures/lab-server.mjs', 'import-map-browser.test.js', 'lab-browser.test.js', 'lab-server.test.js', 'probe-sides.test.js', 'process-tether.test.js', 'static.test.js', 'svgexport.test.js'],
		'the seven sites that start it -- H26-19\'s kill test the seventh -- each through the helper');
});
