/*
The shim behind `./draw` in every workspace of draw's map evaluation (H28.3, B440; evals/context-lab/README.md).

Each call boots draw's own server in this process, on no port at all -- the CLI's `fetch` is answered by the server's request handler
over an in-memory stream pair, so a runtime whose sandbox refuses sockets (codex) runs exactly as every other -- then runs draw's own
CLI (`cli/draw.mjs` `main`) against it, flushes the store, and exits. Nothing outlives the call.

  - the data: the server's data folder lives gzipped in `.draw/state.json.gz`, unpacked into a folder of its own for the call and
    packed back only when it changed, so the answer is not one `grep` away from an agent told to use the map; with it, the server's
    write locks, which draw holds in memory, so a `draw lock` in one call holds for the next
  - the host: fixed, `http://localhost:8080`, because the CLI keys the selected diagram, a draft and lock tokens by host
  - the exit: `process.exit` is held for the call, so a refusal (`die`) still flushes the store and writes its log line
  - the log: one JSON line per call in `.draw/log.jsonl` -- the arguments, the verb, whether the task allowed it, the exit, the time,
    the chunk in force, and for `map` the window in cells, its chunk and the sense commands it printed
  - the policy: `.draw/policy.json` names the verbs a task allows (`allow`, or null for every verb); any other is refused, logged
  - one call at a time: `.draw/lock`, so an agent's parallel calls cannot lose each other's writes
  - quiet: the server's console lines go to the log line, so the agent reads only what draw's CLI prints
*/
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { duplexPair } from 'node:stream';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const HOST = 'http://localhost:8080';
// the verbs `help` and no verb at all are always allowed: they read no diagram
const ALWAYS = new Set(['help']);

class Exit extends Error { constructor(code) { super(`exit ${code}`); this.code = code; } }

// draw's app in this process, listening on nothing: `listen` is answered without a socket for the one call to createApp
export async function bootApp(runtime, dataDir) {
	const { createApp } = await import(pathToFileURL(path.join(runtime, 'server', 'app.js')).href);
	const listen = http.Server.prototype.listen;
	http.Server.prototype.listen = function inProcess(...args) {
		const cb = args.find((a) => typeof a === 'function');
		this.address = () => ({ port: 0, address: 'in-process', family: 'none' });
		if (cb) process.nextTick(cb);
		return this;
	};
	let app;
	try { app = await createApp({ dataDir, port: 0, templatesDir: null, authz: false }); } finally { http.Server.prototype.listen = listen; }
	const fetchInProcess = (url, opts = {}) => new Promise((resolve, reject) => {
		const u = new URL(String(url));
		const req = http.request({
			method: opts.method || 'GET', path: u.pathname + u.search, headers: { host: u.host, ...(opts.headers || {}) },
			createConnection: () => { const [client, server] = duplexPair(); app.server.emit('connection', server); return client; },
		}, (res) => {
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('error', reject);
			res.on('end', () => {
				const headers = new Headers();
				for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
				const status = res.statusCode;
				resolve(new Response([101, 204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers }));
			});
		});
		req.on('error', reject);
		if (opts.body !== undefined && opts.body !== null) req.write(opts.body);
		req.end();
	});
	return { app, fetch: fetchInProcess };
}

// main's own parse, enough to name the verb the call runs (cli/draw.mjs parseArgs)
export function verbTokens(argv) {
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) { rest.push(a); continue; }
		const next = argv[i + 1];
		if (next !== undefined && !next.startsWith('--')) i++;
	}
	return rest;
}

export const packState = (dir) => {
	const files = {};
	for (const f of fs.readdirSync(dir).sort()) if (fs.statSync(path.join(dir, f)).isFile()) files[f] = fs.readFileSync(path.join(dir, f), 'utf8');
	return files;
};
// the state: the data folder's files, and the server's write locks -- held in memory by draw, so carried here from call to call
export const readState = (gz) => JSON.parse(zlib.gunzipSync(fs.readFileSync(gz)).toString('utf8'));
export const writeState = (gz, state) => {
	const tmp = `${gz}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, zlib.gzipSync(JSON.stringify(state), { level: 9 }));
	fs.renameSync(tmp, gz);
};

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
function lock(file) {
	for (let waited = 0; waited < 120000; waited += 50) {
		try { fs.writeFileSync(file, String(process.pid), { flag: 'wx' }); return; } catch (e) { if (e.code !== 'EEXIST') throw e; }
		const pid = Number(fs.readFileSync(file, 'utf8')) || 0;
		if (pid && !alive(pid)) { try { fs.unlinkSync(file); } catch { /* another took it */ } continue; }
		sleep(50);
	}
	throw new Error('another ./draw call held the folder for two minutes');
}

// the map's window in cells, its chunk and its senses, from the verb's own answer (H26.6's move 12)
function mapRecord(json, layout) {
	if (!json || !json.window) return null;
	const w = json.window;
	const cells = layout === 'zone' ? { x0: w.x0 + 1, x1: w.x1, y0: w.y0 + 1, y1: w.y1 } : { x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 };
	return {
		layout, window: cells, scope: json.scope, chunk: json.chunk ? [json.chunk.i, json.chunk.j] : null,
		shown: (json.occupied || []).map((o) => o.name ?? o.id),
		senses: (json.beyond || []).map((b) => ({ dir: b.dir, n: (b.devices || 0) + (b.waypoints || 0) + (b.zones || 0), chunk: [b.chunk.i, b.chunk.j] })),
	};
}

export async function runCli(argv, here = path.dirname(fileURLToPath(import.meta.url))) {
	const runtime = path.join(here, 'runtime');
	const policy = JSON.parse(fs.readFileSync(path.join(here, 'policy.json'), 'utf8'));
	const realExit = process.exit.bind(process);
	const started = Date.now();
	const entry = { at: new Date(started).toISOString(), argv };
	const log = () => fs.appendFileSync(path.join(here, 'log.jsonl'), `${JSON.stringify({ ...entry, ms: Date.now() - started })}\n`);
	lock(path.join(here, 'lock'));
	const unlock = () => { try { fs.unlinkSync(path.join(here, 'lock')); } catch { /* gone */ } };
	let tmp = null;
	try {
		const verbs = await import(pathToFileURL(path.join(runtime, 'cli', 'verbs.mjs')).href);
		const rest = verbTokens(argv);
		const verb = rest.length ? verbs.byName(rest[0], rest[1]) : null;
		entry.verb = verb ? verb.name : (rest[0] ?? null);
		entry.chunkSize = [verbs.CHUNK_RULES.CHUNK.w, verbs.CHUNK_RULES.CHUNK.h];
		entry.allowed = !verb || ALWAYS.has(verb.name) || rest[0] === 'help' || policy.allow === null || policy.allow.includes(verb.name);
		if (!entry.allowed) {
			process.stderr.write(`[ ERROR ] this task allows only these verbs: ${policy.allow.join(', ')} -- \`${verb.name}\` is not one of them\n`);
			entry.exit = 2;
			return 2;
		}
		// the server's own console lines (its store's boot line names this folder) go to the log, not to the agent; the CLI writes no console
		const said = [];
		for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = (...a) => { said.push(a.map(String).join(' ')); };
		entry.server = said;
		tmp = fs.mkdtempSync(path.join(here, 'run-'));
		const before = readState(path.join(here, 'state.json.gz'));
		for (const [f, body] of Object.entries(before.files)) fs.writeFileSync(path.join(tmp, f), body);
		const { app, fetch } = await bootApp(runtime, tmp);
		for (const [id, lock] of before.locks?.map ?? []) app.locks.map.set(id, lock);
		for (const [id, until] of before.locks?.holds ?? []) app.locks.holds.set(id, until);
		const { main } = await import(pathToFileURL(path.join(runtime, 'cli', 'draw.mjs')).href);
		globalThis.fetch = fetch;
		for (const v of verbs.VERBS) {
			if (v.name !== 'map') continue;
			const run = v.run;
			v.run = async (ctx, args) => {
				const r = await run(ctx, args);
				entry.map = mapRecord(r?.json, ctx.flags.layout && ctx.flags.layout !== true ? ctx.flags.layout : 'node');
				return r;
			};
		}
		process.exit = (code) => { throw new Exit(code ?? 0); };
		let code;
		try {
			code = await main(argv, { HOME: path.join(here, 'home'), DRAW_HOST: HOST, NO_COLOR: '1' }, (s) => process.stdout.write(s));
		} catch (e) {
			if (e instanceof Exit) code = e.code;
			else { process.stderr.write(`[ ERROR ] ${e.message}\n`); code = 1; }
		} finally {
			process.exit = realExit;
		}
		await app.store.flushAll();
		const after = { files: packState(tmp), locks: { map: [...app.locks.map], holds: [...app.locks.holds] } };
		entry.wrote = JSON.stringify(after.files) !== JSON.stringify(before.files);
		if (JSON.stringify(after) !== JSON.stringify({ locks: { map: [], holds: [] }, ...before })) writeState(path.join(here, 'state.json.gz'), after);
		entry.exit = code;
		return code;
	} catch (e) {
		process.exit = realExit;
		process.stderr.write(`[ ERROR ] the shim failed: ${e.message}\n`);
		entry.exit = 70;
		entry.shimError = e.message;
		return 70;
	} finally {
		if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
		log();
		unlock();
	}
}

// `./draw` calls this; it exits once stdout has drained, whatever timers the app left
export async function cli(argv) {
	const code = await runCli(argv);
	process.stdout.write('', () => process.exit(code));
}
