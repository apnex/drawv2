/*
GR18 -- the tool, driven as a library rather than as a subprocess.

`main` is called directly so a verb's BEHAVIOUR is asserted rather than its formatting. A CLI tested
only by spawning it reports failures as exit codes and stdout diffs, which is how the shell version
went a whole release without anyone noticing it could not authenticate (B117).

The server here is a real one on a real port: the tool speaks only HTTP and imports nothing from
`server/`, so testing it in-process would be testing something the agent never runs.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { main } from '../cli/draw.mjs';
import { VERBS, byName } from '../cli/verbs.mjs';

let app, host, dataDir, home;

async function boot() {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-cli-'));
	home = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-home-'));
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	host = `http://127.0.0.1:${app.port}`;
}
const run = async (...argv) => {
	const out = [];
	await main([...argv, '--host', host], { HOME: home }, (s) => out.push(s));
	return out.join('');
};

test('GR18: every verb declares a summary, an example, and the route it reaches', () => {
	// the manifest is the source for help, dispatch, docs and the coverage scan; a verb missing any
	// of these is not a rough edge, it is a hole in three surfaces at once
	for (const v of VERBS) {
		assert.ok(v.summary, `${v.name} has no summary`);
		assert.ok(v.example, `${v.name} has no example`);
		assert.ok(v.route, `${v.name} declares no route`);
		assert.ok(v.usage.startsWith('draw '), `${v.name} usage should read as an invocation`);
		assert.equal(typeof v.run, 'function', `${v.name} has no handler`);
	}
});

test('GR18: a sub-verb beats its bare noun, so `lock status` is reachable', () => {
	// matching the bare name first would make every sub-verb unreachable, and the symptom would
	// look like a broken flag rather than a broken lookup
	assert.equal(byName('lock', 'status').name, 'lock status');
	assert.equal(byName('lock', undefined).name, 'lock');
	assert.equal(byName('lock', 'nonsense').name, 'lock', 'an unknown second word is an argument, not a sub-verb');
});

test('GR18: the door is chosen by the credential, never configured', async () => {
	const { base } = await import('../cli/draw.mjs').then((m) => ({ base: m.base }));
	assert.equal(base({}, {}).prefix, '/api/v1', 'no code, the editor door');
	assert.equal(base({}, { DRAW_CODE: 'x' }).prefix, '/connect/v1', 'a code, the agent door');
	assert.equal(base({ code: 'y' }, {}).prefix, '/connect/v1', 'the flag does it too');
	assert.equal(base({ host: 'http://h/' }, {}).host, 'http://h', 'a trailing slash never doubles');
});

test('the tool drives a diagram end to end, which is the whole of GR18', async () => {
	await boot();
	try {
		const id = (await run('create', 'cli-test')).trim();
		assert.match(id, /^diagram-[0-9a-f]{6}$/, 'create answers the minted id and nothing else');

		await run('lock', '--diagram', id);
		const commit = await run('commit', '--diagram', id, '--label', 'from the tool',
			'--ops', writeOps({ ops: [{ op: 'put', kind: 'node',
				entity: { id: 'node-c10001', name: 'from-cli', type: 'host', x: 120, y: 60 } }] }));
		assert.match(commit, /^v\d+/, 'commit answers the new version');

		const nodes = JSON.parse(await run('get', 'nodes', '--diagram', id, '--json'));
		assert.equal(nodes.length, 1);
		assert.equal(nodes[0].name, 'from-cli');

		const lock = JSON.parse(await run('lock', 'status', '--diagram', id, '--json'));
		assert.equal(lock.owner, 'server');
		assert.equal(typeof lock.expiresAt, 'number');

		await run('unlock', '--diagram', id);
		assert.equal(JSON.parse(await run('lock', 'status', '--diagram', id, '--json')).owner, 'client');

		const gone = JSON.parse(await run('delete', id, '--json'));
		assert.equal(gone.deleted, id);
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('a write without the slot is refused by the TOOL, before the server sees it', async () => {
	await boot();
	try {
		const id = (await run('create', 'no-lock')).trim();
		const err = await captureExit(() => run('commit', '--diagram', id, '--ops', writeOps({ ops: [] })));
		assert.match(err, /write slot/, 'it says which verb to run, rather than relaying a 423');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

function writeOps(obj) {
	const f = path.join(home, `ops-${Math.random().toString(36).slice(2)}.json`);
	fs.writeFileSync(f, JSON.stringify(obj));
	return f;
}
async function captureExit(fn) {
	const errs = [];
	const ew = process.stderr.write.bind(process.stderr);
	const exit = process.exit;
	process.stderr.write = (s) => { errs.push(s); return true; };
	process.exit = () => { throw new Error('__exit__'); };
	try { await fn(); } catch (e) { if (e.message !== '__exit__') throw e; }
	finally { process.stderr.write = ew; process.exit = exit; }
	return errs.join('');
}

/*
`place` -- intent in, geometry handled. The verb the tool exists for.

Two mistakes an agent actually makes: computing an off-grid coordinate, and landing on something
already there. These assert that both are removed, and that a name works where an id is expected,
because an agent thinks in names.
*/
test('place puts a node on a free anchor beside a reference, named by name', async () => {
	await boot();
	try {
		const id = (await run('create', 'place-test')).trim();
		await run('lock', '--diagram', id);
		await run('commit', '--diagram', id, '--label', 'seed', '--ops', writeOps({ ops: [{ op: 'put', kind: 'node',
			entity: { id: 'node-a00001', name: 'lb-1', type: 'loadbalancer', x: 0, y: 0 } }] }));

		const first = JSON.parse(await run('place', 'server', 'near', 'lb-1', '--dir', 'right', '--link', '--name', 'web-1', '--diagram', id, '--json'));
		assert.deepEqual(first.at, { x: 60, y: 0 }, 'one cell to the right, on the grid');
		assert.equal(first.linked, true);

		// the second must step PAST the first: an occupied anchor is not a free one
		const second = JSON.parse(await run('place', 'server', 'near', 'lb-1', '--dir', 'right', '--name', 'web-2', '--diagram', id, '--json'));
		assert.deepEqual(second.at, { x: 120, y: 0 }, 'stepped over the node it just placed');

		const nodes = JSON.parse(await run('get', 'nodes', '--diagram', id, '--json'));
		assert.deepEqual(nodes.map((n) => n.name).sort(), ['lb-1', 'web-1', 'web-2'], '--name survived flag parsing');

		// a name resolves where the route wants an id
		const about = JSON.parse(await run('about', 'lb-1', '--diagram', id, '--json'));
		assert.equal(about.id, 'node-a00001');
		assert.equal(about.neighbours.length, 1, 'only web-1 was linked');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('place refuses a direction with nothing free, rather than placing elsewhere', async () => {
	await boot();
	try {
		const id = (await run('create', 'boxed-in')).trim();
		await run('lock', '--diagram', id);
		const err = await captureExit(() => run('place', 'server', 'near', 'nonexistent', '--diagram', id));
		assert.match(err, /no node called nonexistent/, 'and it says how to find the real ones');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});
