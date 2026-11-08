#!/usr/bin/env node
/*
Generate the map evaluation's diagram (H28.3, B440) through draw's own CLI doors -- `create`, `add`, `link`, `zone` -- against draw's
server at the pinned revision, in this process, then write data/diagram.json (the store's file, its undo log dropped so the fixture's
history is empty) and data/answers.json (each task's answer, read back from that file). Rarely run: the committed pair is the fixture,
and the ids the server mints change with every generation. Needs the runtime first:

  node evals/context-lab/tools/build-fixture.mjs --runtime-only && node evals/context-lab/tools/generate.mjs

The board spans cells -72..71 by -21..20: five chunks across and three down at 31 by 17, nine across at 17 by 17. Every target sits
at least two cells inside its chunk's edges at both sizes; its decoys share its name but for the number; the one vxlan is far
north-west; T6's area has devices one cell either side of each of its edges, and three of the T2 link's waypoints inside it.
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PACK } from './fixture-lib.mjs';
import { bootApp, HOST } from '../fixture/shim.mjs';
import { answersOf, edgeClear } from '../hooks/scoring.mjs';

// [name, type, cx, cy]
export const DEVICES = [
	// chunk 0,0
	['edge-gw', 'router', -3, 3], ['vault-1', 'host', -10, -5], ['lb-c1', 'loadbalancer', 0, -2], ['web-c1', 'host', 5, 5],
	['web-c2', 'host', 6, -6], ['rtr-c1', 'router', -8, 7], ['app-c1', 'server', 9, 1], ['fw-c1', 'firewall', -14, 0],
	// west
	['spine-2', 'router', -40, 5], ['db-west-1', 'server', -30, -20], ['vault-3', 'host', -45, 15], ['web-w1', 'host', -25, 0],
	['web-w2', 'host', -35, -6], ['lb-w1', 'loadbalancer', -28, 10], ['fw-north-1', 'firewall', -22, -16], ['app-w1', 'server', -38, 20],
	// far west
	['fw-north-3', 'firewall', -50, -18], ['log-n1', 'host', -51, -18], ['log-n2', 'host', -50, -17], ['tun-q7', 'vxlan', -62, -20],
	['db-west-2', 'server', -66, 6], ['db-west-3', 'server', -70, 20], ['vault-5', 'host', -70, -8], ['spine-5', 'router', -60, 18],
	['web-fw1', 'host', -55, 0], ['lb-fw1', 'loadbalancer', -65, -12], ['app-fw1', 'server', -58, 10],
	// north and south of 0,0
	['spine-3', 'router', -4, -18], ['web-n1', 'host', 8, -15], ['app-n1', 'server', -8, -20],
	['web-s1', 'host', 0, 15], ['lb-s1', 'loadbalancer', 10, 20], ['app-s1', 'server', -12, 18],
	// east
	['fw-north-2', 'firewall', 30, -20], ['vault-2', 'host', 25, 10], ['vault-4', 'host', 45, -6], ['app-east-4', 'server', 40, 18],
	['spine-1', 'router', 40, 20], ['lb-e1', 'loadbalancer', 35, -10], ['lb-e2', 'loadbalancer', 35, 0], ['srv-e1', 'server', 28, -3],
	['web-e1', 'host', 20, -20], ['web-e2', 'host', 19, 0], ['web-e3', 'host', 21, -21], ['web-e4', 'host', 22, 11],
	// far east
	['spine-4', 'router', 52, -18], ['app-east-5', 'server', 57, -4], ['app-east-6', 'server', 70, -20], ['vault-6', 'host', 66, -15],
	['vault-7', 'host', 68, 16], ['fw-north-4', 'firewall', 60, -12], ['srv-fe1', 'server', 48, 5], ['srv-fe2', 'server', 62, 2],
	['web-fe1', 'host', 71, 0], ['lb-fe1', 'loadbalancer', 55, 12], ['web-fe2', 'host', 65, 8], ['rtr-fe1', 'router', 50, -8],
];
// [src, dst, via cells]
export const LINKS = [
	['edge-gw', 'spine-4', [[20, 3], [20, -14], [52, -14]]], ['edge-gw', 'spine-2', []], ['edge-gw', 'spine-3', []],
	['spine-2', 'web-w1', []], ['spine-2', 'db-west-1', []], ['spine-3', 'web-n1', []], ['spine-3', 'app-n1', []],
	['spine-4', 'fw-north-4', []], ['spine-4', 'app-east-6', []], ['fw-north-4', 'vault-6', []], ['app-east-5', 'srv-fe2', []],
	['app-east-5', 'rtr-fe1', []], ['db-west-2', 'app-fw1', []], ['db-west-2', 'lb-fw1', []], ['spine-5', 'db-west-3', []],
	['spine-5', 'web-fw1', []], ['fw-north-3', 'log-n1', []], ['fw-north-3', 'lb-fw1', []], ['lb-c1', 'web-c1', []],
	['lb-c1', 'web-c2', []], ['lb-c1', 'app-c1', []], ['fw-c1', 'lb-c1', []], ['fw-c1', 'web-w1', []], ['lb-e1', 'srv-e1', []],
	['lb-e2', 'srv-e1', []], ['spine-1', 'app-east-4', []], ['spine-1', 'lb-s1', []], ['lb-s1', 'web-s1', []], ['app-s1', 'web-s1', []],
	['vault-3', 'lb-w1', [[-45, 10]]], ['srv-fe1', 'lb-e2', []],
];
// [name, from cell, to cell]
export const ZONES = [
	['dmz', [10, -6], [30, 4]], ['core', [-20, -4], [-5, 6]], ['west-dc', [-72, 2], [-60, 12]],
	['east-dc', [50, -11], [64, 0]], ['north-edge', [-30, -22], [-14, -12]], ['south-lab', [30, 12], [48, 22]],
];
export const TARGETS = ['vault-7', 'edge-gw', 'spine-4', 'fw-north-3', 'db-west-2', 'app-east-5', 'tun-q7'];

class Exit extends Error { constructor(code) { super(`exit ${code}`); this.code = code; } }

async function generate() {
	for (const t of TARGETS) {
		const d = DEVICES.find((x) => x[0] === t);
		if (!edgeClear(d[2], d[3])) throw new Error(`${t} at ${d[2]},${d[3]} is within two cells of a chunk's edge`);
	}
	const runtime = path.join(PACK, 'fixtures', 'runtime');
	const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'draw-map-eval-'));
	const dataDir = path.join(scratch, 'data'), home = path.join(scratch, 'home');
	fs.mkdirSync(dataDir); fs.mkdirSync(home);
	const { app, fetch } = await bootApp(runtime, dataDir);
	globalThis.fetch = fetch;
	const { main } = await import(pathToFileURL(path.join(runtime, 'cli', 'draw.mjs')).href);
	const realExit = process.exit;
	const draw = async (...argv) => {
		const out = [];
		process.exit = (c) => { throw new Exit(c); };
		try { await main(argv, { HOME: home, DRAW_HOST: HOST }, (s) => out.push(s)); } catch (e) { throw new Error(`draw ${argv.join(' ')}: ${e.message}`); } finally { process.exit = realExit; }
		return out.join('');
	};
	await draw('create', 'estate');
	await draw('use', 'estate');
	await draw('lock');
	for (const [name, type, cx, cy] of DEVICES) await draw('add', type, 'at', `${cx},${cy}`, '--name', name);
	for (const [src, dst, via] of LINKS) await draw('link', src, dst, ...via.flatMap(([x, y]) => ['--via', `${x},${y}`]));
	for (const [name, [x0, y0], [x1, y1]] of ZONES) await draw('zone', name, 'from', `${x0},${y0}`, 'to', `${x1},${y1}`);
	await app.store.flushAll();
	// the store seeds a first diagram into an empty folder; the board is the one named estate
	const stored = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'))).find((d) => d.meta?.name === 'estate');
	const { log, ...diagram } = stored;
	fs.writeFileSync(path.join(PACK, 'data', 'diagram.json'), `${JSON.stringify(diagram, null, '\t')}\n`);
	fs.writeFileSync(path.join(PACK, 'data', 'answers.json'), `${JSON.stringify(answersOf(diagram), null, '\t')}\n`);
	fs.rmSync(scratch, { recursive: true, force: true });
	console.log(`data/diagram.json: ${diagram.meta.id}, ${diagram.nodes.length} nodes, ${diagram.links.length} links, ${diagram.zones.length} zones (log of ${log ? 'some' : 'no'} records dropped)`);
	process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await generate();
