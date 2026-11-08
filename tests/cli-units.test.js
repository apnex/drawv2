/*
H29.1 (dev/DECISIONS.md H29; B453) -- THE CLI NAMES ITS UNITS. H28.3's evaluation found 36 of its 57 failures carrying pixel values:
`get` printed a position in pixels and named no unit, while `add`, `move`, `link --via` and `map` take cells, so agents answered
in pixels (`vault-7` as `4080,960`) and typed pixels into write verbs (`add server at -3000,-1080`), which exited 0. So every
verb that shows a position shows the cell beside the pixels, each named, in its text and its `--json` (the old fields kept, a cell
beside them), every verb's help names the unit it prints and the unit it takes, and a write whose cell lies far outside the
diagram is refused before it is sent, naming the pixel reading when the numbers look like pixels, unless `--far` is given.

Run against an in-process server, as tests/cli-map.test.js is.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratchFolder } from '@apnex/clean-runner';
import { makeApp } from './fixtures/app.mjs';
import { main } from '../cli/draw.mjs';

const ID = 'c0ffee00c0ffee01';   // a document id, made for this file
const P = 60;                    // the board's pitch, its stored grid record's
// cells: edge 2,1  web 5,1  db -4,3  bend (a waypoint) 3,4; the zone site over cells -5..-3 by 2..4 -- the board's extent -5..5 by 1..4
const BOARD = {
	meta: { id: ID, name: 'units', version: 1, schema: 4 },
	layouts: [{ id: 'layout-000001', name: 'grid', pitch: P }],
	nodes: [
		{ id: 'node-a00001', name: 'edge', type: 'router', x: 2 * P, y: 1 * P },
		{ id: 'node-a00002', name: 'web', type: 'host', x: 5 * P, y: 1 * P },
		{ id: 'node-a00003', name: 'db', type: 'server', x: -4 * P, y: 3 * P },
		{ id: 'node-a00004', name: 'bend', x: 3 * P, y: 4 * P },
	],
	zones: [{ id: 'zone-a00001', name: 'site', x: -5 * P - P / 2, y: 2 * P - P / 2, w: 3 * P, h: 3 * P }],
	links: [{ id: 'link-a00001', name: 'wire', src: 'node-a00001', dst: 'node-a00002', via: [] }],
	pipes: [], groups: [],
};

async function withBoard(fn) {
	const dataDir = scratchFolder('draw-cli-units-');
	const home = scratchFolder('draw-cli-units-home-');
	fs.writeFileSync(path.join(dataDir, `${ID}.json`), JSON.stringify(BOARD));
	const app = await makeApp({ dataDir, port: 0 });
	const host = `http://127.0.0.1:${app.port}`;
	const run = async (...argv) => { const out = []; await main([...argv, '--host', host, '--diagram', ID], { HOME: home }, (s) => out.push(s)); return out.join(''); };
	const refused = async (...argv) => {
		const errs = [], ew = process.stderr.write.bind(process.stderr), exit = process.exit;
		process.stderr.write = (s) => { errs.push(s); return true; };
		process.exit = () => { throw new Error('__exit__'); };
		try { await run(...argv); } catch (e) { if (e.message !== '__exit__') throw e; return errs.join(''); } finally { process.stderr.write = ew; process.exit = exit; }
		assert.fail(`draw ${argv.join(' ')} was not refused`);
	};
	const stored = async () => JSON.parse(await run('dump', '--json'));
	try { await fn({ run, refused, stored }); } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
}
const help = async (...verb) => { const out = []; await main(['help', ...verb], {}, (s) => out.push(s)); return out.join(''); };

test('H29.1: `get` shows each position in px with its cell beside it, both named; --json keeps x and y and adds the cell', () => withBoard(async ({ run }) => {
	const text = await run('get', 'nodes', 'edge');
	assert.match(text, /X PX\s+Y PX\s+CELL/, 'the pixel columns named px, a CELL column beside them');
	assert.match(text, /edge\s+router\s+120\s+60\s+2,1/, 'edge at 120,60 px, cell 2,1');
	const [edge] = JSON.parse(await run('get', 'nodes', 'edge', '--json'));
	assert.deepEqual([edge.x, edge.y, edge.cell], [120, 60, { cx: 2, cy: 1 }], 'x and y as they were, and the cell beside them');
	const wp = JSON.parse(await run('get', 'waypoints', '--json'));
	assert.deepEqual(wp.map((w) => w.cell), [{ cx: 3, cy: 4 }], 'a waypoint\'s cell too');
	const zones = await run('get', 'zones');
	assert.match(zones, /X PX\s+Y PX\s+W PX\s+H PX\s+CELLS/, 'a zone\'s extent in px, named, and its cells');
	assert.match(zones, /site\s+-330\s+90\s+180\s+180\s+-5,2 \.\. -3,4/, 'site over cells -5..-3 by 2..4');
	const [site] = JSON.parse(await run('get', 'zones', '--json'));
	assert.deepEqual([site.x, site.w, site.cells], [-330, 180, { x0: -5, y0: 2, x1: -3, y1: 4 }]);
	const show = await run('show');
	assert.match(show, /edge\s+router\s+120\s+60\s+2,1/, '`show` carries the cell as `get` does');
	assert.deepEqual(JSON.parse(await run('show', '--json')).nodes.find((n) => n.name === 'web').cell, { cx: 5, cy: 1 });
}));

test('H29.1: about, near, zone contents and link path show px and the cell, named; their --json adds the cell beside the old fields', () => withBoard(async ({ run }) => {
	assert.match(await run('about', 'edge'), /at\s+120,60 px \(cell 2,1\)/, 'about: px and the cell');
	const about = JSON.parse(await run('about', 'edge', '--json'));
	assert.deepEqual([about.at, about.cell], [{ x: 120, y: 60 }, { cx: 2, cy: 1 }]);
	const near = await run('near', '120', '60', '--within', '200');
	assert.match(near, /AT PX\s+CELL\s+DIST PX/, 'near names its columns');
	assert.match(near, /edge\s+120,60\s+2,1/, 'edge, 120,60 px, cell 2,1');
	const nearJson = JSON.parse(await run('near', '120', '60', '--within', '200', '--json'));
	const occ = nearJson.occupants.find((o) => o.name === 'edge');
	assert.deepEqual([occ.x, occ.y, occ.cell], [120, 60, { cx: 2, cy: 1 }]);
	const inside = await run('zone', 'contents', 'site');
	assert.match(inside, /AT PX\s+CELL/, 'zone contents names its columns');
	assert.match(inside, /db\s+-240,180\s+-4,3/, 'db at -240,180 px, cell -4,3');
	assert.deepEqual(JSON.parse(await run('zone', 'contents', 'site', '--json')).contents.find((c) => c.name === 'db').cell, { cx: -4, cy: 3 });
	const route = await run('link', 'path', 'wire');
	assert.match(route, /^px\s+120,60/m, 'the route\'s points named px');
	assert.match(route, /^cells\s+2,1 .*5,1$/m, 'and as cells');
	const routeJson = JSON.parse(await run('link', 'path', 'wire', '--json'));
	assert.deepEqual(routeJson.pathCells.at(0), [2, 1], 'pathCells beside path');
	assert.deepEqual(routeJson.path.at(0), [120, 60], 'path as it was');
}));

test('H29.1: each verb\'s help names the unit it prints and the unit it takes', async () => {
	assert.match(await help('get'), /px.*cell|cell.*px/s, 'get prints px and cells');
	for (const v of [['show'], ['about'], ['zone', 'contents'], ['link', 'path']]) assert.match(await help(...v), /px/, `${v.join(' ')} names px`);
	assert.match(await help('near'), /x\s+.*pixels \(px\)/, 'near takes pixels, and says so');
	assert.match(await help('anchor', 'nearest'), /pixels \(px\)/);
	for (const v of [['add'], ['move'], ['zone'], ['panel']]) assert.match(await help(...v), /CELL, not pixels/, `${v.join(' ')} takes a cell, and says it is not pixels`);
	assert.match(await help('link'), /--via\s+.*CELL, not pixels/, 'link --via takes cells');
	for (const v of [['add'], ['move'], ['link'], ['zone'], ['panel']]) assert.match(await help(...v), /--far/, `${v.join(' ')} carries --far`);
	assert.match(await help('dump'), /px/, 'dump names the document\'s unit');
	assert.match(await help('layouts'), /pixels per cell/, 'layouts names what the pitch measures');
});

test('H29.1: a write whose cell lies far outside the diagram is refused before it is sent, naming the pixel reading; --far places it', () => withBoard(async ({ run, refused, stored }) => {
	await run('lock');
	const before = (await stored()).meta.version;
	const add = await refused('add', 'server', 'at', '240,180');
	assert.match(add, /refused: cell 240,180 lies 235 cells south-east of the diagram \(cells -5\.\.5, 1\.\.4\); as pixels it is cell 4,3 -- pass cells, or --far to place it there/);
	assert.match(await refused('move', 'db', 'to', '-360,-300'), /refused: cell -360,-300 lies 355 cells north-west of the diagram \(cells -5\.\.5, 1\.\.4\); as pixels it is cell -6,-5/);
	assert.match(await refused('move', 'db', 'to', '-3000,-1080'), /refused: cell -3000,-1080 lies 2,995 cells north-west of the diagram/, 'thousands grouped');
	assert.match(await refused('link', 'edge', 'db', '--via', '240,180'), /refused: --via cell 240,180 lies 235 cells south-east of the diagram.*as pixels it is cell 4,3/);
	assert.match(await refused('zone', 'far', 'from', '240,180', 'to', '300,240'), /refused: cell 240,180 lies 235 cells south-east/);
	assert.match(await refused('panel', 'p', 'at', '240,180', '--cols', '2', '--rows', '1'), /refused: cell 240,180 lies 235 cells south-east/);
	const odd = await refused('add', 'server', 'at', '500,7');
	assert.match(odd, /refused: cell 500,7 lies 495 cells south-east of the diagram/, 'far, though not a multiple of the pitch');
	assert.doesNotMatch(odd, /as pixels/, 'so no pixel reading is offered');
	assert.equal((await stored()).meta.version, before, 'nothing was written');
	assert.match(await run('add', 'server', 'at', '7,1', '--name', 'near-1'), /near-1 .* at cell 7,1 = 420,60 px/, 'a near write is unaffected, and names its units');
	assert.match(await run('add', 'server', 'at', '240,180', '--name', 'far-1', '--far'), /far-1 .* at cell 240,180 = 14400,10800 px/, '--far places it');
	assert.match(await run('move', 'db', 'to', '-360,-300', '--far'), /-> cell -360,-300 = -21600,-18000 px/);
	const doc = await stored();
	assert.deepEqual(['near-1', 'far-1', 'db'].map((n) => { const e = doc.nodes.find((x) => x.name === n); return [e.x, e.y]; }), [[420, 60], [14400, 10800], [-21600, -18000]]);
	assert.match(await run('zone', 'lab', 'from', '-1,6', 'to', '1,7'), /lab \(zone-[0-9a-f]+\) 180x120 px at -90,330 px \(cells -1,6 \.\. 1,7\)/, 'a new zone, in px and cells');
}));

test('H29.1: an empty diagram refuses a cell more than one chunk from the origin, and allows one within it', () => withBoard(async ({ run, refused }) => {
	await run('lock');
	for (const ref of ['edge', 'web', 'db', 'bend']) await run('rm', ref);
	await run('rm', 'site');
	assert.match(await refused('add', 'host', 'at', '32,0'), /refused: cell 32,0 lies 32 cells east of the diagram \(empty, so measured from cell 0,0\)/);
	assert.match(await run('add', 'host', 'at', '31,0', '--name', 'edge-of-reach'), /at cell 31,0 = 1860,0 px/);
}));
