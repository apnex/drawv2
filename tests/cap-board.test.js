/*
H26.6's move 9 (dev/design/components/PAN-ZOOM.md section 4, PZ11; appendix A, move 9) -- THE CAP BOARD, the board the lab serves as
`caps` (lab/measure-boards.json, apart from the fixed boards the records hold), held equal to its generator (tools/cap-board.mjs), at every cap a document can reach on the old frame, and
accepted by the planner as the lab commits it -- 2,000 ops a request, in turn. Its measure on the page is tests/lab-browser.test.js's.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { capBoard } from '../tools/cap-board.mjs';
import { Model } from '../model/model.mjs';
import { attachRelations } from '../engine/store.mjs';
import { commit } from '../planner/txn.mjs';
import { Log } from '../planner/log.mjs';
import { productKinds } from '../product/kinds.mjs';
import { NETWORK_ROWS } from '../plugins/network/kinds.mjs';
import { createPageNetwork } from '../plugins/network/page.mjs';
import { diagramLattices } from '../kernel/geometry.mjs';
const NODE_GRID = diagramLattices({ pitch: 60 }).device;   // H26.6's move 13: a diagram's device lattice at 60, NODE_GRID gone from the kernel (GR16)

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../lab/${f}`, import.meta.url), 'utf8'));

test('H26.6 move 9, PZ11: the lab\'s `caps` board is the generator\'s, opening in run mode, and no fixed board -- the records\' documents stay the 18', () => {
	const measured = read('measure-boards.json'), fixed = read('seeds.json');
	assert.deepEqual(Object.keys(measured), ['caps'], 'the boards measured on: the cap board alone');
	assert.equal(JSON.stringify(measured.caps), JSON.stringify(capBoard()), 'lab/measure-boards.json holds what tools/cap-board.mjs makes -- run node tools/cap-board.mjs --write');
	assert.equal(measured.caps.mode, 'run');
	assert.equal(Object.keys(fixed).length, 13, 'lab/seeds.json keeps its 13 boards, which the native record and the export\'s bytes hold (GR11, GR12)');
	assert.equal(Object.keys(fixed).filter((k) => k in measured).length, 0, 'no name in both, so `?seed=` finds one board');
});

test('H26.6 move 9, PZ11: the cap board holds every cap but the groups\' -- 527 anchors on every position of the old frame, 576 zones, 2,000 links, 4,000 pipes -- and the most groups 527 anchors hold, 263', () => {
	const board = capBoard();
	const of = (kind) => board.ops.filter((o) => o.kind === kind).map((o) => o.entity);
	const nodes = of('node'), zones = of('zone'), links = of('link'), groups = of('group');
	assert.deepEqual([nodes.length, zones.length, links.length, board.pipes.length, groups.length], [527, 576, 2000, 4000, 263]);
	assert.equal(new Set(nodes.map((n) => `${n.x},${n.y}`)).size, 527, 'each anchor on its own position');
	assert.ok(nodes.every((n) => Math.abs(n.x) <= 900 && Math.abs(n.y) <= 480 && n.x % 60 === 0 && n.y % 60 === 0), 'every position of the device grid within the old frame');
	assert.equal(new Set(links.map((l) => [l.src, l.dst].sort().join())).size, 2000, 'each pair linked once');
	assert.equal(new Set(board.pipes.map(([a, b]) => [a, b].sort().join())).size, 4000, 'one pipe a pair');
	const members = groups.flatMap((g) => g.members);
	assert.ok(groups.every((g) => g.members.length === 2) && new Set(members).size === 526, 'two members a group, none in two: 263 is floor(527 / 2) (B82, B85)');
	const waypoints = nodes.filter((n) => !n.type), ends = new Set(links.flatMap((l) => [l.src, l.dst]));
	assert.deepEqual([waypoints.length, waypoints.filter((w) => w.spawn && ends.has(w.id)).length], [106, 106], 'every waypoint an armed spawner at a link\'s end');
});

test('H26.6 move 9, PZ11: the planner accepts the cap board as the lab commits it, 2,000 ops a request', () => {
	const page = createPageNetwork(), { network } = page;
	const kinds = productKinds(...NETWORK_ROWS);
	const authority = new Model({ kinds, attached: { network } });
	attachRelations(authority, { deviceLattice: () => NODE_GRID });
	const board = capBoard(), all = [...board.ops, ...page.session.seed(board.pipes)], log = new Log();
	for (let i = 0; i < all.length; i += 2000) {
		const a = commit(authority, log, { ops: all.slice(i, i + 2000), label: 'seed caps' }, 'lab', 'lab', { kinds });
		assert.ok(a.ok, `the request from op ${i}: ${a.error}`);
	}
	const doc = authority.toJSON();
	assert.deepEqual(['nodes', 'zones', 'links', 'pipes', 'groups'].map((k) => doc[k].length), [527, 576, 2000, 4000, 263]);
	assert.equal(commit(authority, log, { ops: [{ op: 'put', kind: 'group', entity: { id: 'group-0fffff', name: 'one more', members: [doc.nodes[526].id, doc.nodes[0].id] } }], label: 'one more' }, 'lab', 'lab', { kinds }).ok, true,
		'a 264th group is accepted only by taking a member from another, which then dissolves -- the groups stay at 263');
	assert.equal(authority.toJSON().groups.length, 263);
});
