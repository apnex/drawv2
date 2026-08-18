/*
CLI integrity audit (prism CLIIntegrity lineage): full command coverage of
cli/draw.sh against a real server on a random port with throwaway data.
The CLI is sovereign — it speaks only HTTP — so the audit drives the actual
executable via bash and asserts on its rendered output and exit codes.
NOTE: the server runs in-process, so the CLI must be spawned ASYNC — a sync
spawn blocks the event loop and deadlocks every request against it.
*/

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';

const CLI = fileURLToPath(new URL('../cli/draw.sh', import.meta.url));
let app, dataDir, env;

before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-cli-'));
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	env = {
		...process.env,
		DRAW_HOST: `http://localhost:${app.port}`,
		DRAW_CONTEXT: path.join(dataDir, 'cli-context')
	};
});

after(async () => {
	await app.close();
	fs.rmSync(dataDir, { recursive: true, force: true });
});

function cli(args, envOverride) {
	return new Promise((resolve) => {
		execFile('bash', [CLI, ...args], { encoding: 'utf8', env: envOverride || env },
			(err, stdout, stderr) => {
				resolve({ out: (stdout || '') + (stderr || ''), code: err ? (err.code ?? 1) : 0 });
			});
	});
}

test('health: heartbeat renders status ok', async () => {
	const r = await cli(['health']);
	assert.equal(r.code, 0);
	assert.match(r.out, /"status": "ok"/);
});

test('diagrams: table fidelity (headers + seed row)', async () => {
	const r = await cli(['diagrams']);
	assert.equal(r.code, 0);
	assert.match(r.out, /ID\s+NAME\s+VERSION/);
	assert.match(r.out, /diagram-/);
});

test('context: empty context defaults to the first diagram', async () => {
	const r = await cli(['context']);
	assert.equal(r.code, 0);
	assert.match(r.out, /defaulting to first diagram: .*diagram-/);
});

test('context: switching and persistence (by name resolution)', async () => {
	const name = JSON.parse((await cli(['diagrams', '--json'])).out)[0].name;
	const set = await cli(['context', name]);
	assert.equal(set.code, 0);
	assert.match(set.out, /Target diagram set to: .*diagram-/);
	assert.match((await cli(['context'])).out, /Current target: .*diagram-/);
});

test('get nodes: table fidelity with seed content', async () => {
	const r = await cli(['get', 'nodes']);
	assert.equal(r.code, 0);
	assert.match(r.out, /ID\s+NAME\s+TYPE\s+X\s+Y/);
	assert.match(r.out, /lb-1\s+loadbalancer\s+0\s+0/);
});

test('get: singular/plural aliasing', async () => {
	assert.match((await cli(['get', 'node'])).out, /lb-1/);
	assert.match((await cli(['get', 'link'])).out, /SRC\s+DST/);
});

test('get nodes <name>: exact-name filter returns one row', async () => {
	const r = await cli(['get', 'nodes', 'lb-1']);
	const rows = r.out.trim().split('\n');
	assert.equal(rows.length, 2, `expected header + 1 row, got:\n${r.out}`);
	assert.match(rows[1], /lb-1/);
});

test('get links: endpoint ids resolve to node names', async () => {
	const r = await cli(['get', 'links']);
	assert.equal(r.code, 0);
	assert.match(r.out, /lb-1/);
	assert.doesNotMatch(r.out, /node-[0-9a-f]{6}\s+node-/);
});

test('get links <name>: filters to links touching the named node', async () => {
	const all = (await cli(['get', 'links'])).out.trim().split('\n').length;
	const filtered = (await cli(['get', 'links', 'web-1'])).out.trim().split('\n');
	assert.ok(filtered.length > 1 && filtered.length < all, 'filter should narrow the table');
	filtered.slice(1).forEach((row) => assert.match(row, /web-1/));
});

test('--json: emits parseable filtered JSON', async () => {
	const r = await cli(['get', 'nodes', 'lb-1', '--json']);
	const data = JSON.parse(r.out);
	assert.equal(data.length, 1);
	assert.equal(data[0].name, 'lb-1');
});

test('status: meta lines + entity counts', async () => {
	const r = await cli(['status']);
	assert.equal(r.code, 0);
	assert.match(r.out, /DRAW STATUS: diagram-/);
	assert.match(r.out, /Schema:\s+1/);
	assert.match(r.out, /NODES\s+8/);
	assert.match(r.out, /Slides:\s+unbound/);
});

test('--diagram: overrides context by id prefix', async () => {
	const id = JSON.parse((await cli(['diagrams', '--json'])).out)[0].id;
	const r = await cli(['status', '--diagram', id.slice(0, 10)]);
	assert.match(r.out, new RegExp(`DRAW STATUS: ${id}`));
});

test('error path: unknown diagram fails at resolve with exit 1', async () => {
	const r = await cli(['get', 'nodes', '--diagram', 'bogus']);
	assert.equal(r.code, 1);
	assert.match(r.out, /no diagram matches: bogus/);
});

test('push: unconfigured credentials fail loudly with help, exit 1', async () => {
	const r = await cli(['push']);
	assert.equal(r.code, 1);
	assert.match(r.out, /FAILED/);
	assert.match(r.out, /credentials/);
});

test('get with no entity prints usage, never fetches', async () => {
	const r = await cli(['get']);
	assert.equal(r.code, 0);
	assert.match(r.out, /nodes, links, zones, groups/);
});

test('unknown command prints usage with exit 1', async () => {
	const r = await cli(['frobnicate']);
	assert.equal(r.code, 1);
	assert.match(r.out, /Usage:/);
});

test('server unreachable: clean error, exit 1', async () => {
	const r = await cli(['diagrams'], { ...env, DRAW_HOST: 'http://localhost:1' });
	assert.equal(r.code, 1);
	assert.match(r.out, /server unreachable/);
});

// ---- review-pass regressions ----

test('symlinked install: templates and context resolve through the link', async () => {
	const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-bin-'));
	const link = path.join(binDir, 'draw');
	fs.symlinkSync(CLI, link);
	try {
		const r = await new Promise((resolve) => {
			execFile(link, ['get', 'nodes'], { encoding: 'utf8', env }, (err, stdout, stderr) => {
				resolve({ out: (stdout || '') + (stderr || ''), code: err ? (err.code ?? 1) : 0 });
			});
		});
		assert.equal(r.code, 0);
		assert.match(r.out, /lb-1/, 'table must render via symlink');
		assert.doesNotMatch(r.out, /Could not open/);
	} finally {
		fs.rmSync(binDir, { recursive: true, force: true });
	}
});

test('trailing --diagram with no value errors instead of hanging', async () => {
	const r = await cli(['status', '--diagram']);
	assert.equal(r.code, 1);
	assert.match(r.out, /requires a value/);
});

test('context: a typo never clobbers the saved context', async () => {
	const file = env.DRAW_CONTEXT;
	fs.writeFileSync(file, 'diagram-known\n');
	const r = await cli(['context', 'No Such Diagram']);
	assert.equal(r.code, 1);
	assert.match(r.out, /no diagram matches/);
	assert.equal(fs.readFileSync(file, 'utf8').trim(), 'diagram-known');
	fs.unlinkSync(file); // never leak the sentinel into later tests
});

test('context: unreachable server never clobbers the saved context', async () => {
	const file = env.DRAW_CONTEXT;
	fs.writeFileSync(file, 'diagram-known\n');
	const r = await cli(['context', 'anything'], { ...env, DRAW_HOST: 'http://localhost:1' });
	assert.equal(r.code, 1);
	assert.equal(fs.readFileSync(file, 'utf8').trim(), 'diagram-known');
	fs.unlinkSync(file); // never leak the sentinel into later tests
});

test('non-JSON response: reads as error, never as success', async () => {
	const http = await import('node:http');
	const fake = http.createServer((req, res) => {
		res.writeHead(502, { 'Content-Type': 'text/html' });
		res.end('<html>502 Bad Gateway</html>');
	});
	await new Promise((res) => fake.listen(0, res));
	const host = `http://localhost:${fake.address().port}`;
	try {
		const r = await cli(['get', 'nodes'], { ...env, DRAW_HOST: host });
		assert.equal(r.code, 1);
		assert.match(r.out, /invalid \(non-JSON\) response/);
	} finally {
		fake.close();
	}
});

test('agentic output: piped invocations carry no ANSI codes', async () => {
	const r = await cli(['get', 'nodes']);
	assert.doesNotMatch(r.out, /\x1B\[/, 'colors must be suppressed off-TTY');
	const err = await cli(['get', 'nodes', '--diagram', 'bogus']);
	assert.doesNotMatch(err.out, /\x1B\[/, 'error grammar must also be clean');
});

test('show: full diagram view in one call', async () => {
	const r = await cli(['show']);
	assert.equal(r.code, 0);
	assert.match(r.out, /DRAW SHOW: diagram-/);
	assert.match(r.out, /--- nodes \(8\) ---/);
	assert.match(r.out, /--- links \(\d+\) ---/);
	assert.match(r.out, /lb-1/);
	assert.match(r.out, /SRC\s+DST/);
});

test('show --json: the full document for machine consumption', async () => {
	const r = await cli(['show', '--json']);
	const doc = JSON.parse(r.out);
	assert.ok(doc.meta && Array.isArray(doc.nodes) && Array.isArray(doc.links));
});

test('--json links <name>: matches the table filter (endpoint names)', async () => {
	const r = await cli(['get', 'links', 'web-1', '--json']);
	const data = JSON.parse(r.out);
	assert.ok(data.length >= 1, 'json filter must match by endpoint name like the table');
	data.forEach((l) => assert.ok(l.src && l.dst));
});
