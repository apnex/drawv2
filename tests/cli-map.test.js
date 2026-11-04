/*
H26.6's move 12 (dev/design/components/PAN-ZOOM.md section 3.8, "The CLI's map, in chunks"; PZ33; 5.1 row 12; appendix A's move 12 rows)
-- THE CLI'S MAP ON AN INFINITE CANVAS. `draw map` reads the canvas in chunks of 31 by 17 cells, chunk 0,0 centred on cell 0,0 and the old
canvas whole; plain `map` is today's tight view inside chunk 0,0, else chunk 0,0 itself; `--chunk i,j` names a chunk; `--area`,
`--around` and `--zone` show a window of at most one chunk, never clipped to one; the five selectors exclude one another; and beneath
its key the map prints its chunk, its window and, for each of the eight regions about the window, what lies there and the one command
that looks there. The rules are the drafter's `chunk-rules.mjs` (the probes of H26.6); 3.8's worked cases are held here twice -- by the
rules the CLI exports, and through `draw map` itself on boards built to hold each case.
Every stored board's map, plain and `--full`, on both layouts, prints byte for byte as at `807eecc` above the new lines
(tests/fixtures/cli-map-record.json, each text's sha-256, written by running that commit's CLI over tests/fixtures/native-record.mjs
`storedDocuments`); the pinned production documents were compared in the move's own run (PAN-ZOOM.md appendix B, move 12).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { scratchFolder } from '@apnex/clean-runner';
import { makeApp } from './fixtures/app.mjs';
import { main } from '../cli/draw.mjs';
import { CHUNK_RULES } from '../cli/verbs.mjs';
import { storedDocuments } from './fixtures/native-record.mjs';

const { CHUNK, chunkOfCell, cellsOfChunk, cornersOfCells, windowChunk, sensesOf, senseLine } = CHUNK_RULES;

// ---- the rules, against 3.8's worked cases
test('H26.6 move 12, 3.8\'s worked cases: a cell\'s chunk across and down, on both signs; a chunk\'s cells, and on the zone layout its corners', () => {
	assert.deepEqual(CHUNK, { w: 31, h: 17 }, 'held in one place');
	assert.deepEqual([-47, -46, -16, -15, 0, 15, 16, 46, 47].map((cx) => chunkOfCell(cx, 0)[0]), [-2, -1, -1, 0, 0, 0, 1, 1, 2], 'floor((cx + 15) / 31)');
	assert.deepEqual([-26, -25, -9, -8, 0, 8, 9, 25, 26].map((cy) => chunkOfCell(0, cy)[1]), [-2, -1, -1, 0, 0, 0, 1, 1, 2], 'floor((cy + 8) / 17)');
	const cells = (i, j) => { const c = cellsOfChunk(i, j); return `${c.x0}..${c.x1} by ${c.y0}..${c.y1}`; };
	const corners = (i, j) => { const c = cornersOfCells(cellsOfChunk(i, j)); return `${c.x0}..${c.x1} by ${c.y0}..${c.y1}`; };
	assert.deepEqual([[1, 0], [-1, 0], [0, -1], [2, -3]].map(([i, j]) => cells(i, j)), ['16..46 by -8..8', '-46..-16 by -8..8', '-15..15 by -25..-9', '47..77 by -59..-43']);
	assert.deepEqual([[1, 0], [-1, 0], [0, -1], [2, -3]].map(([i, j]) => corners(i, j)), ['15..46 by -9..8', '-47..-16 by -9..8', '-16..15 by -26..-9', '46..77 by -60..-43']);
	assert.deepEqual([cells(0, 0), corners(0, 0)], ['-15..15 by -8..8', '-16..15 by -9..8'], 'chunk 0,0: the old canvas, 527 cells and 576 corners');
	// a zone corner belongs, for choosing a chunk, to the chunk of the cell after it
	assert.deepEqual([[-17, -10], [-16, -9], [14, 7], [15, 8]].map(([zx, zy]) => chunkOfCell(zx + 1, zy + 1)), [[-1, -1], [0, 0], [0, 0], [1, 1]]);
	assert.deepEqual(windowChunk({ x0: 14, x1: 16, y0: 0, y1: 0 }), [0, 0], '--area 14,0,16,0: three cells across chunks 0,0 and 1,0, its chunk its centre cell\'s');
	assert.deepEqual(cornersOfCells({ x0: 14, x1: 16, y0: 0, y1: 0 }), { x0: 13, x1: 16, y0: -1, y1: 0 }, 'on the zone layout, corners 13..16 by -1..0');
	assert.deepEqual([windowChunk({ x0: 11, x1: 19, y0: -4, y1: 4 }), windowChunk({ x0: 36, x1: 44, y0: -24, y1: -16 })], [[0, 0], [1, -1]], '--around cells 15,0 and 40,-20, radius 4');
	assert.deepEqual(windowChunk({ x0: -16, x1: -15, y0: -9, y1: -8 }), [-1, -1], 'a centre at -15.5 by -8.5 floors to cell -16,-9, chunk -1,-1 -- the floor mathematical, where truncating says 0,0');
});

const found = (s) => s.beyond.filter((b) => b.devices || b.waypoints || b.zones).map((b) => `${b.dir} ${b.devices}/${b.waypoints}/${b.zones} ${b.via} ${b.chunk.i},${b.chunk.j}`);
test('H26.6 move 12, 3.8\'s worked cases: the senses -- a region, its chunk, a zone in every region it reaches, Chebyshev distance and its tie', () => {
	const tight = { x0: -1, x1: 1, y0: -1, y1: 1 };
	assert.deepEqual(found(sensesOf(tight, [{ cx: 40, cy: 7, device: true }], [])), ['se 1/0/0 nearest 1,0'], 'a device at 40,7: south-east, in chunk 1,0, neither the window\'s nor its south-east neighbour 1,1');
	assert.deepEqual(found(sensesOf(tight, [{ cx: 5, cy: 0, device: true }], [])), ['e 1/0/0 window-chunk 0,0'], 'at 5,0: east, in this chunk');
	assert.deepEqual(found(sensesOf(tight, [], [{ x0: 3, x1: 5, y0: -6, y1: -4 }])), ['ne 0/0/1 window-chunk 0,0'], 'a zone of cells 3..5 by -6..-4: north-east alone');
	assert.deepEqual(found(sensesOf(tight, [], [{ x0: -3, x1: 3, y0: -3, y1: 3 }])), ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map((d) => `${d} 0/0/1 window-chunk 0,0`), 'a zone enclosing the window: all eight');
	const home = cellsOfChunk(0, 0);
	assert.deepEqual(found(sensesOf(home, [{ cx: 124, cy: -17, device: true }, { cx: 93, cy: -51, device: true }], [])), ['ne 2/0/0 nearest 3,-3'], 'chunks 4,-1 and 3,-3: Chebyshev distance, where Manhattan would pick 4,-1');
	assert.deepEqual(found(sensesOf(home, [{ cx: 62, cy: -17, device: true }, { cx: 31, cy: -34, device: true }], [])), ['ne 2/0/0 nearest 1,-2'], 'chunks 2,-1 and 1,-2 tie at 2: the lesser j');
	assert.deepEqual(found(sensesOf(home, [{ cx: -62, cy: 17, device: true }, { cx: -31, cy: 34, device: false }], [])), ['sw 1/1/0 nearest -2,1'], 'the mirror, on the other signs: the lesser j, -2,1');
	const empty = sensesOf(home, [], []);
	assert.deepEqual(empty.beyond.map((b) => [b.dir, b.chunk.i, b.chunk.j, b.via]), [['n', 0, -1, 'neighbour'], ['ne', 1, -1, 'neighbour'], ['e', 1, 0, 'neighbour'], ['se', 1, 1, 'neighbour'], ['s', 0, 1, 'neighbour'], ['sw', -1, 1, 'neighbour'], ['w', -1, 0, 'neighbour'], ['nw', -1, -1, 'neighbour']], 'an empty map\'s eight lines are its eight neighbours');
	assert.equal(senseLine(empty.beyond[0], (c) => `draw map --chunk ${c.i},${c.j}`), '  n   nothing, chunk 0,-1                        draw map --chunk 0,-1', 'the line\'s form');
	assert.equal(senseLine({ dir: 'se', devices: 3, waypoints: 1, zones: 0, chunk: { i: 1, j: 0 }, via: 'neighbour' }, () => 'x'), `  se  ${'3 devices, 1 waypoint, in chunk 1,0'.padEnd(42)} x`, 'the counts and where, padded to 42');
});

// ---- through `draw map`, on real boards
let app, host, home;
async function boot(docs = []) {
	const dataDir = scratchFolder('draw-cli-map-');
	home = scratchFolder('draw-cli-map-home-');
	for (const d of docs) fs.writeFileSync(path.join(dataDir, `${d.meta.id}.json`), JSON.stringify(d));
	app = await makeApp({ dataDir, port: 0 });
	host = `http://127.0.0.1:${app.port}`;
}
const run = async (...argv) => { const out = []; await main([...argv, '--host', host], { HOME: home }, (s) => out.push(s)); return out.join(''); };
async function captureExit(fn) {
	const errs = [], ew = process.stderr.write.bind(process.stderr), exit = process.exit;
	process.stderr.write = (s) => { errs.push(s); return true; };
	process.exit = () => { throw new Error('__exit__'); };
	try { await fn(); } catch (e) { if (e.message !== '__exit__') throw e; } finally { process.stderr.write = ew; process.exit = exit; }
	return errs.join('');
}
const idOf = (n) => `${n.toString(16)}`.padStart(16, 'b');   // a document id, made here rather than written out
const LAYOUTS = [{ id: 'layout-000001', name: 'node', pitch: 60, offset: 0, ext: { x: 900, y: 480 } }, { id: 'layout-000002', name: 'zone', pitch: 60, offset: 30, ext: { x: 930, y: 510 } }];
const board = (n, name, nodes, zones = []) => ({ meta: { id: idOf(n), name, version: 1, schema: 3 }, layouts: LAYOUTS, nodes, zones, links: [], pipes: [], groups: [] });
const device = (hex, name, cx, cy) => ({ id: `node-${hex}`, name, type: 'router', x: cx * 60, y: cy * 60 });
const zone = (hex, name, x0, y0, x1, y1) => ({ id: `zone-${hex}`, name, x: x0 * 60 - 30, y: y0 * 60 - 30, w: (x1 - x0 + 1) * 60, h: (y1 - y0 + 1) * 60 });
const senses = (text) => text.slice(text.indexOf('\n\nchunk ') + 2).split('\n').filter(Boolean);
const sensed = (json) => json.beyond.filter((b) => b.devices || b.waypoints || b.zones).map((b) => `${b.dir} ${b.devices}/${b.waypoints}/${b.zones} ${b.via} ${b.chunk.i},${b.chunk.j}`);

test('H26.6 move 12: a board with devices in chunks 2,0 and 0,-3 maps chunk 0,0 whole, names each with its command, and --chunk 2,0 shows them', async () => {
	await boot([board(1, 'far', [device('a00001', 'home', 0, 0), device('a00002', 'east-1', 62, 0), device('a00003', 'east-2', 63, 0), device('a00004', 'north', 0, -51)])]);
	try {
		const json = JSON.parse(await run('map', '--diagram', idOf(1), '--json'));
		assert.deepEqual([json.scope, json.window, json.chunk], ['chunk 0,0', { x0: -15, x1: 15, y0: -8, y1: 8 }, { i: 0, j: 0, cells: { x0: -15, x1: 15, y0: -8, y1: 8 } }], 'content past chunk 0,0: plain map shows chunk 0,0 whole');
		assert.deepEqual(sensed(json), ['n 1/0/0 nearest 0,-3', 'e 2/0/0 nearest 2,0'], 'each named, by the nearest chunk holding it');
		const text = await run('map', '--diagram', idOf(1));
		const lines = senses(text);
		assert.deepEqual(lines.slice(0, 2), ['chunk 0,0 (cells -15..15 by -8..8), window -15..15 by -8..8', 'beyond the window:']);
		assert.equal(lines[4], `  e   2 devices, nearest in chunk 2,0            draw map --diagram ${idOf(1)} --layout node --chunk 2,0 --host ${host}`, 'the command printed whole');
		const east = await run(...lines[4].slice(lines[4].indexOf('draw map ') + 5).split(' ').slice(0, -2));
		assert.match(east, /^far {2}chunk 2,0 {2}\(node grid, 2 occupied of 527\)/, 'run, it reaches the chunk and finds both');
		assert.match(east, /\n {2}62,0 {4}r {2}east-1\n {2}63,0 {4}r {2}east-2\n/, 'each in the key');
		assert.match(senses(east)[0], /^chunk 2,0 \(cells 47\.\.77 by -8\.\.8\), window 47\.\.77 by -8\.\.8$/);
		assert.match(senses(east).find((l) => l.startsWith('  w ')), /1 device, in this chunk|1 device, nearest in chunk 0,0/, 'and from there, home is named to the west');
		const north = JSON.parse(await run('map', '--diagram', idOf(1), '--chunk', '0,-3', '--json'));
		assert.deepEqual(north.occupied.map((o) => o.name), ['north'], '--chunk 0,-3 shows the one there');
	} finally { await app.close(); }
});

test('H26.6 move 12: every printed command runs, reaching the diagram and the layout the map showed -- under --diagram naming one not active, and under --layout zone', async () => {
	await boot([board(2, 'active', [device('a00011', 'a', 0, 0)]), board(3, 'other', [device('a00021', 'b', 1, 1), device('a00022', 'c', 40, 7)], [zone('a00031', 'pen', -3, 6, 2, 10)])]);
	try {
		await run('context', idOf(2));
		for (const layout of ['node', 'zone']) {
			const text = await run('map', '--diagram', idOf(3), '--layout', layout);
			const lines = senses(text).slice(2);
			assert.equal(lines.length, 8, `${layout}: eight senses`);
			for (const line of lines) {
				const argv = line.slice(line.indexOf('draw map ') + 5).split(' ');
				assert.deepEqual(argv.slice(0, 5), ['map', '--diagram', idOf(3), '--layout', layout], `${layout}: ${line.trim()} -- the map's own diagram and layout`);
				assert.ok(argv.every((a) => /^[\w.:/,-]+$/.test(a)), 'every argument a word, a number or an id');
				const [, chunk] = [...argv.join(' ').matchAll(/--chunk (-?\d+,-?\d+)/g)][0];
				const shown = await run(...argv.slice(0, -2));
				assert.match(shown, new RegExp(`^other {2}chunk ${chunk} {2}\\(${layout} grid, \\d+ occupied of ${layout === 'node' ? 527 : 576}\\)`), `${layout} ${chunk}: the other diagram, its layout, the chunk named`);
				assert.match(senses(shown)[0], new RegExp(`^chunk ${chunk} `));
			}
		}
		const zoneMap = JSON.parse(await run('map', '--diagram', idOf(3), '--layout', 'zone', '--json'));
		assert.deepEqual(zoneMap.window, { x0: -16, x1: 15, y0: -9, y1: 8 }, 'on the zone layout, plain map is chunk 0,0\'s corners, as today\'s whole canvas');
		assert.deepEqual(sensed(zoneMap), ['e 1/0/0 neighbour 1,0', 's 0/0/1 neighbour 0,1'], 'content past chunk 0,0, so chunk 0,0 whole: c east in 1,0, the pen\'s lower rows south in 0,1 -- measured in cells on both layouts');
		assert.deepEqual(sensed(JSON.parse(await run('map', '--diagram', idOf(3), '--json'))), sensed(zoneMap), 'the node layout senses alike');
	} finally { await app.close(); }
});

test('H26.6 move 12: --area, --around and --zone show a window of at most one chunk, never clipped to one; past it each is refused naming the limit; two selectors refused naming each', async () => {
	await boot([board(4, 'w', [device('a00041', 'edge', 15, 0), device('a00042', 'out', 40, -20), device('a00043', 'mid', 1, 0)], [zone('a00051', 'wide', -20, 0, 20, 2), zone('a00052', 'pen', 3, -6, 5, -4)])]);
	try {
		const map = async (...a) => JSON.parse(await run('map', '--diagram', idOf(4), ...a, '--json'));
		const across = await map('--area', '14,0,16,0');
		assert.deepEqual([across.window, across.chunk.i, across.chunk.j, across.scope], [{ x0: 14, x1: 16, y0: 0, y1: 0 }, 0, 0, 'cells 14,0 .. 16,0'], '--area 14,0,16,0: three cells across two chunks, chunk 0,0');
		assert.deepEqual((await map('--area', '14,0,16,0', '--layout', 'zone')).window, { x0: 13, x1: 16, y0: -1, y1: 0 }, 'on the zone layout, the corners bounding them');
		const text = await run('map', '--diagram', idOf(4), '--area', '14,0,16,0');
		assert.match(text, /^w {2}cells 14,0 \.\. 16,0 {2}\(node grid, 1 occupied of 3\)/, 'the header counting the window\'s own positions');
		assert.deepEqual([(await map('--around', 'edge')).window, (await map('--around', 'edge')).chunk.i], [{ x0: 11, x1: 19, y0: -4, y1: 4 }, 0], '--around a device at 15,0');
		const out = await map('--around', 'out');
		assert.deepEqual([out.window, out.chunk.i, out.chunk.j], [{ x0: 36, x1: 44, y0: -24, y1: -16 }, 1, -1], '--around a device at 40,-20, in chunk 1,-1');
		assert.deepEqual((await map('--zone', 'pen')).window, { x0: 3, x1: 5, y0: -6, y1: -4 }, '--zone: its cells');
		const refused = async (...a) => captureExit(() => run('map', '--diagram', idOf(4), ...a));
		assert.match(await refused('--area', '0,0,31,0'), /--area is at most 31 by 17 cells, one chunk/, '32 by 1 refused, naming the limit');
		assert.match(await refused('--area', '5,0,3,0'), /--area runs from its lesser corner to its greater/, 'the lesser corner first');
		assert.match(await refused('--area', '0,0,1'), /--area takes four whole numbers, cx0,cy0,cx1,cy1/);
		assert.match(await refused('--around', 'edge', '--radius', '9'), /--radius is a whole number from 1 to 8/, 'radius 9 refused, naming the limit');
		assert.match(await refused('--around', 'edge', '--radius', '0'), /--radius is a whole number from 1 to 8/);
		assert.match(await refused('--zone', 'wide'), /--zone wide spans 41 by 3 cells; a window is at most 31 by 17, one chunk/, 'a zone past one chunk refused');
		assert.match(await refused('--zone', 'pen', '--around', 'edge'), /--around and --zone each choose the window/, 'two selectors refused, naming each');
		assert.match(await refused('--full', '--chunk', '1,0'), /--chunk and --full each choose the window/);
		assert.match(await refused('--chunk', '1'), /--chunk takes two whole numbers, i,j/);
		assert.match(await refused('--chunk', '1.5,0'), /--chunk takes two whole numbers, i,j/);
		assert.match(await refused('--chunk'), /--chunk takes one value/);
		const c = await map('--chunk', '-1,0');
		assert.deepEqual([c.window, c.scope, c.chunk.cells], [{ x0: -46, x1: -16, y0: -8, y1: 8 }, 'chunk -1,0', { x0: -46, x1: -16, y0: -8, y1: 8 }], '--chunk -1,0 whole');
	} finally { await app.close(); }
});

test('H26.6 move 12: the senses through draw map -- 3.8\'s cases on a window -1..1 by -1..1, by --area', async () => {
	await boot([
		board(5, 'se', [device('a00061', 'a', 40, 7)]), board(6, 'e', [device('a00071', 'a', 5, 0)]),
		board(7, 'ne', [], [zone('a00081', 'z', 3, -6, 5, -4)]), board(8, 'all', [], [zone('a00091', 'z', -3, -3, 3, 3)]),
	]);
	try {
		const at = async (n) => sensed(JSON.parse(await run('map', '--diagram', idOf(n), '--area', '-1,-1,1,1', '--json')));
		assert.deepEqual(await at(5), ['se 1/0/0 nearest 1,0']);
		assert.deepEqual(await at(6), ['e 1/0/0 window-chunk 0,0']);
		assert.deepEqual(await at(7), ['ne 0/0/1 window-chunk 0,0']);
		assert.deepEqual(await at(8), ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map((d) => `${d} 0/0/1 window-chunk 0,0`));
		const text = await run('map', '--diagram', idOf(5), '--area', '-1,-1,1,1');
		assert.ok(senses(text).includes(`  se  1 device, nearest in chunk 1,0             draw map --diagram ${idOf(5)} --layout node --chunk 1,0 --host ${host}`));
	} finally { await app.close(); }
});

test('H26.6 move 12: anchor free takes the map\'s window -- plain, --chunk, --area -- and lists that window\'s free positions alone', async () => {
	await boot([board(9, 'f', [device('a000a1', 'a', 0, 0), device('a000a2', 'b', 2, 1)])]);
	try {
		const map = JSON.parse(await run('map', '--diagram', idOf(9), '--json'));
		const free = JSON.parse(await run('anchor', 'free', '--diagram', idOf(9), '--json'));
		assert.deepEqual([free.window, free.chunk], [map.window, map.chunk], 'plain: the plain map\'s window, the tight view');
		assert.deepEqual([free.window, free.count], [{ x0: -1, x1: 3, y0: -1, y1: 2 }, 5 * 4 - 2], 'its free positions alone: 20 less the two held');
		assert.ok(free.anchors.every((a) => !a.occupant && a.cx >= -1 && a.cx <= 3 && a.cy >= -1 && a.cy <= 2), 'every one free and inside');
		assert.equal('beyond' in free, false, 'and no senses');
		assert.equal((await run('anchor', 'free', '--diagram', idOf(9))).trimEnd(), '18 free on the node grid, window -1..3 by -1..2 in chunk 0,0');
		const east = JSON.parse(await run('anchor', 'free', '--diagram', idOf(9), '--chunk', '1,0', '--json'));
		assert.deepEqual([east.count, east.window, east.anchors[0].cx, east.anchors.at(-1).cx], [527, { x0: 16, x1: 46, y0: -8, y1: 8 }, 16, 46], '--chunk 1,0: one chunk, every position free');
		const zoneFree = JSON.parse(await run('anchor', 'free', '--diagram', idOf(9), '--layout', 'zone', '--chunk', '0,0', '--json'));
		assert.equal(zoneFree.count, 576, 'on the zone layout, the chunk\'s corners');
		const area = JSON.parse(await run('anchor', 'free', '--diagram', idOf(9), '--area', '-1,-1,1,1', '--json'));
		assert.deepEqual([area.count, area.window], [8, { x0: -1, x1: 1, y0: -1, y1: 1 }], '--area: nine less the one held');
		assert.match(await captureExit(() => run('anchor', 'free', '--diagram', idOf(9), '--area', '0,0,40,0')), /--area is at most 31 by 17 cells, one chunk/, 'never more than one chunk');
		assert.match(await captureExit(() => run('anchor', 'free', '--diagram', idOf(9), '--zone', 'x')), /unknown flag --zone for anchor free/, 'plain, --chunk and --area alone');
	} finally { await app.close(); }
});

/*
`parity` (PAN-ZOOM.md section 3.8, "The CLI"; PZ15): its duty is the whole document, so it asks the bounds of every anchor and zone in use,
in cells, with a margin of 2 -- and when that area is over the route's 10,000 positions, each node's and waypoint's own cell.
*/
test('H26.6 move 12: parity counts every anchor past the old frame -- one area when it fits, each anchor\'s cell when it does not', async () => {
	const pen = zone('a000c1', 'pen', 30, -3, 33, 0);
	await boot([board(10, 'near', [device('a000b1', 'a', 20, 0), device('a000b2', 'b', 40, -5), { id: 'node-a000b3', name: 'w', x: 1800, y: 60 }], [pen]),
		board(11, 'sparse', [device('a000b4', 'a', -120, 0), device('a000b5', 'b', 120, 90), { id: 'node-a000b6', name: 'w', x: 0, y: -3000 }])]);
	try {
		for (const n of [10, 11]) {
			const p = JSON.parse(await run('parity', '--diagram', idOf(n), '--json'));
			assert.equal(p.parity, true, `${idOf(n)}: parity holds`);
			assert.deepEqual(p.rows.find((r) => r[0] === 'on an anchor'), ['on an anchor', 3, '-', 3], 'the map shows all three on an anchor');
		}
		// control: the sparse board's bounds with their margin, 245 by 145 cells, are past the route's limit -- so it asked each cell
		const res = await fetch(`${host}/api/v1/diagrams/${idOf(11)}/layouts/node/anchors?cx0=-122&cy0=-52&cx1=122&cy1=92`);
		assert.deepEqual([res.status, (await res.json()).code], [422, 'area-too-large']);
	} finally { await app.close(); }
});

test('H26.6 move 12: every stored board\'s map, plain and --full, on both layouts, prints byte for byte as at 807eecc above the new lines, and ends in its chunk and eight senses', async () => {
	const record = JSON.parse(fs.readFileSync(new URL('./fixtures/cli-map-record.json', import.meta.url), 'utf8'));
	const docs = storedDocuments().map(([name, d], i) => ({ name, doc: { ...structuredClone(d), meta: { ...d.meta, id: `${(i + 1).toString(16).padStart(4, '0')}`.padStart(16, 'a') } } }));
	for (const e of docs) delete e.doc.meta.owner;
	await boot(docs.map((e) => e.doc));
	try {
		let compared = 0;
		for (const e of docs) for (const layout of ['node', 'zone']) for (const full of [false, true]) {
			const key = `${e.name} ${layout}${full ? ' --full' : ''}`;
			const text = await run('map', '--diagram', e.doc.meta.id, '--layout', layout, ...(full ? ['--full'] : []));
			const at = text.indexOf('\n\nchunk ');
			assert.ok(at > 0, `${key}: the chunk line`);
			const footer = text.slice(at + 2).split('\n').filter(Boolean);
			assert.deepEqual([footer.length, footer[1]], [10, 'beyond the window:'], `${key}: the chunk, the window and eight senses`);
			assert.equal(crypto.createHash('sha256').update(text.slice(0, at)).digest('base64'), record.maps[key], `${key}: above the new lines, as at ${record.writtenFrom}`);
			compared++;
		}
		assert.equal(compared, Object.keys(record.maps).length, 'every recorded map compared');
		assert.equal(compared, 72, '18 stored boards, four maps each');
	} finally { await app.close(); }
});
