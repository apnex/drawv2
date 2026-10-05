// P6 W-e (H18.35; A5) -- AN AGENT CAN DO WITH PIPES EVERYTHING A PERSON CAN (PROMOTION.md section 6, P6's exit criterion). Each
// thing a person does with pipes, done through the CLI against the real server, is held to what the gesture is ruled to make:
// the behaviour matrix's own `expect` for the row -- the same seed board, replayed through the agent door, the same ids -- or,
// for the one gesture no row draws, the network's own drag judge. dev/design/unification/AGENTS-LAY-PIPES.md, stage W-e.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeApp } from './fixtures/app.mjs';
import { main } from '../cli/draw.mjs';
import { createNetworkSession } from '../network/session.mjs';
import { Model } from './fixtures/composed.mjs';

const MATRIX = JSON.parse(fs.readFileSync(new URL('../dev/design/unification/BEHAVIOUR-MATRIX.json', import.meta.url), 'utf8'));
const SEEDS = JSON.parse(fs.readFileSync(new URL('../lab/seeds.json', import.meta.url), 'utf8'));
const row = (id) => MATRIX.rows.find((r) => r.id === id);

let app, dataDir, home, host;
before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-parity-'));
	home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-parity-home-'));
	app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	host = `http://127.0.0.1:${app.port}`;
});
after(async () => { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); });

const run = async (...argv) => { const out = []; await main([...argv, '--host', host], { HOME: home }, (s) => out.push(s)); return out.join(''); };
const json = async (...argv) => JSON.parse(await run(...argv, '--json'));
// a run the CLI refuses: its message, where the matrix's row is a refusal
async function refused(...argv) {
	const errs = [], ew = process.stderr.write.bind(process.stderr), exit = process.exit;
	process.stderr.write = (s) => { errs.push(s); return true; };
	process.exit = () => { throw new Error('__exit__'); };
	try { await run(...argv); } catch (e) { if (e.message !== '__exit__') throw e; } finally { process.stderr.write = ew; process.exit = exit; }
	return errs.join('');
}

// the seed board a matrix state names, committed through the agent door with its own ids, and its setup replayed as an agent would
async function board(state, setup = async () => {}) {
	const s = MATRIX.states[state];
	const seed = SEEDS[s.board];
	const id = (await run('create', `${state}-${Math.random().toString(36).slice(2, 6)}`)).trim();
	await run('lock', '--diagram', id);
	const pipes = await import('../network/pipe-kind.mjs');
	const ops = [...seed.ops, ...seed.pipes.map(([a, b, laid]) => ({ op: 'put', kind: 'pipe', entity: pipes.pipeEntity(a, b, laid) }))];
	const f = path.join(home, `seed-${id}.json`);
	fs.writeFileSync(f, JSON.stringify({ ops }));
	await run('commit', '--diagram', id, '--label', 'seed', '--ops', f);
	await setup(id);
	return id;
}

// a matrix row's `expect`, read against the server's document through the agent door -- the keys the pipe rows use
async function holds(id, expect) {
	const doc = await json('show', '--diagram', id);
	const links = doc.links || [];
	const down = [];
	for (const l of links) if ((await json('link', 'path', l.id, '--diagram', id)).down) down.push(l.id);
	const got = {}, want = {};
	const take = (k, g) => { if (k in expect) { got[k] = g; want[k] = expect[k]; } };
	take('links', links.length);
	take('down', down.length);
	take('anchors', (doc.waypoints || []).length);
	const laid = (k) => (doc.pipes || []).filter((p) => p.laid === k).length;
	if ('pipes' in expect) { got.pipes = typeof expect.pipes === 'number' ? (doc.pipes || []).length : { hand: laid('hand'), link: laid('link') }; want.pipes = expect.pipes; }
	if (expect.linkState) { got.linkState = Object.fromEntries(Object.keys(expect.linkState).map((l) => [l, down.includes(l) ? 'down' : 'up'])); want.linkState = expect.linkState; }
	if (expect.linksBetween) {
		got.linksBetween = Object.fromEntries(Object.keys(expect.linksBetween).map((k) => { const [a, b] = k.split('|'); return [k, links.filter((l) => (l.src === a && l.dst === b) || (l.src === b && l.dst === a)).length]; }));
		want.linksBetween = expect.linksBetween;
	}
	if (expect.keptAt) {
		got.keptAt = expect.keptAt.map(([x, y]) => (doc.waypoints || []).some((w) => w.x === x && w.y === y));
		want.keptAt = expect.keptAt.map(() => true);
	}
	assert.deepEqual(got, want);
}
// the 'down' state: the cross board with its centre deleted (DEL-01) -- done by an agent as `draw rm`
const downBoard = () => board('down', (id) => run('rm', 'w5', '--diagram', id));

test('A5, lay a hand pipe: HEAL-02 (g on the end) is `draw pipe A B`', async () => {
	const id = await downBoard();
	await run('pipe', 'A', 'B', '--diagram', id);
	await holds(id, row('HEAL-02').expect);
});

test('A5, a plain link: HEAL-03 (mouseup on the end) is `draw link A B` -- refused, a straight link already joins them', async () => {
	const id = await downBoard();
	assert.match(await refused('link', 'A', 'B', '--diagram', id), /straight link/);
	await holds(id, row('HEAL-03').expect);
});

test('A5, a link with a pin, laying its legs: HEAL-04 (w bend) is `draw link A B --via 0,-2`', async () => {
	const id = await downBoard();
	await run('link', 'A', 'B', '--via', '0,-2', '--diagram', id);
	await holds(id, row('HEAL-04').expect);
});

test('A5, remove a pipe: PIPE-03 (g anchor and hops, then delete one) is `draw add waypoint`, `draw pipe`, `draw pipe --off`', async () => {
	const id = await board('routed');
	await run('add', 'waypoint', 'at', '-4,-3', '--name', 'g1', '--diagram', id);
	await run('pipe', 'A', 'g1', '--diagram', id);
	await run('pipe', 'g1', 'C', '--diagram', id);
	await run('pipe', 'A', 'g1', '--off', '--diagram', id);
	await holds(id, row('PIPE-03').expect);
});

/*
A direct link that lays its own pipe -- the keyed drag with no pins, which no matrix row draws -- is held to the network's own
drag judge: a drag from A to B started with `w` (`srcKey`), judged on the same board, lays exactly the pipes `--lay` lays.
*/
test('A5, a link that lays its own pipe: `draw link A B --lay` lays what the drag judge lays for a drag started with w', async () => {
	const id = (await run('create', 'lay-parity')).trim();
	await run('lock', '--diagram', id);
	const nodes = [{ id: 'node-0a0001', name: 'A', type: 'router', x: -360, y: 0, shape: 'circle' }, { id: 'node-0a0002', name: 'B', type: 'router', x: 360, y: 0, shape: 'circle' }];
	const f = path.join(home, 'lay.json');
	fs.writeFileSync(f, JSON.stringify({ ops: nodes.map((entity) => ({ op: 'put', kind: 'node', entity })) }));
	await run('commit', '--diagram', id, '--label', 'seed', '--ops', f);
	const m = new Model();
	for (const n of nodes) m.put('node', n);
	const drag = { src: 'node-0a0001', dst: 'node-0a0002', stops: ['node-0a0001', 'node-0a0002'], pins: [], guides: [], placed: [], pressed: { w: false, g: false }, endPressed: false, srcKey: 'w' };
	const { verdict } = createNetworkSession().judge(drag, [], m);
	assert.equal(verdict.ok, true, 'the drag makes a link');
	const gesture = verdict.entries.map((e) => `${e.entity.id}:${e.entity.laid}`);
	assert.ok(gesture.length > 0, 'and lays a pipe with it -- the comparison is not vacuous');
	await run('link', 'A', 'B', '--lay', '--diagram', id);
	const doc = await json('show', '--diagram', id);
	assert.deepEqual((doc.pipes || []).map((p) => `${p.id}:${p.laid}`), gesture);
	assert.equal((await json('link', 'path', doc.links[0].id, '--diagram', id)).down, false, 'and the link is up, as the drag\'s is');
});

test('A5, see the pipes: every pipe in the document is in `draw get pipes`, with the links its route runs over', async () => {
	const id = await board('routed');
	const doc = await json('show', '--diagram', id);
	const listed = await json('get', 'pipes', '--diagram', id);
	assert.deepEqual(listed.map((p) => p.id).sort(), (doc.pipes || []).map((p) => p.id).sort());
	for (const l of doc.links) {
		const { route } = await json('link', 'path', l.id, '--diagram', id);
		for (let i = 0; i < route.length - 1; i++) {
			const p = listed.find((q) => (q.a === route[i] && q.b === route[i + 1]) || (q.a === route[i + 1] && q.b === route[i]));
			assert.ok(p?.carries.includes(l.id), `${l.id} runs over ${route[i]}-${route[i + 1]}, and its pipe says so`);
		}
	}
});
