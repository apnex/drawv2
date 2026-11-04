/*
H26.6's move 12 (dev/design/components/PAN-ZOOM.md section 3.8, "The anchor lists"; PZ9; 5.1 row 12; appendix A's move 12 rows) -- THE
ANCHORS ROUTE BY AREA, through the agent door. `GET .../layouts/<name>/anchors` names an area, in drawing units or in cells, clipped to
PZ31's bound and answered by snap-grid's `inView` with a `max` of 10,000: a stride above 1 is refused 422 `area-too-large`, naming the limit
and the area's width and height in squares; a malformed query 400 `area-malformed`, naming the parameter; an area wholly beyond the bound
answers no anchors. An area holding the old frame answering the list as it was is tests/layouts-api.test.js's.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './fixtures/app.mjs';
import { scratchFolder } from '@apnex/clean-runner';

let app, base, id;
before(async () => {
	app = await makeApp({ dataDir: scratchFolder('draw-anchors-area-'), port: 0 });
	base = `http://localhost:${app.port}`;
	id = (await (await fetch(`${base}/api/v1/diagrams`)).json())[0].id;
});
after(async () => { await app.close(); });
const ask = async (layout, query) => {
	const res = await fetch(`${base}/api/v1/diagrams/${id}/layouts/${layout}/anchors?${query}`);
	return { status: res.status, body: await res.json() };
};

test('H26.6 move 12: an area of exactly 10,000 positions is listed, at stride 1; one of 10,001 is refused 422 area-too-large, naming the limit and its size in squares', async () => {
	const ten = await ask('node', 'cx0=0&cy0=0&cx1=99&cy1=99');
	assert.deepEqual([ten.status, ten.body.count, ten.body.anchors[0].cx, ten.body.anchors.at(-1).cx, ten.body.anchors.at(-1).cy], [200, 10000, 0, 99, 99], '100 by 100 positions');
	assert.deepEqual(ten.body.anchors.slice(0, 2).map((a) => [a.cx, a.cy]), [[0, 0], [1, 0]], 'by row, then column');
	const over = await ask('node', 'cx0=0&cy0=0&cx1=72&cy1=136');   // 73 by 137 positions, 10,001
	assert.deepEqual([over.status, over.body.code], [422, 'area-too-large']);
	assert.equal(over.body.error, 'anchors lists at most 10000 positions in one area; this one is 72 by 136 squares -- ask a smaller area');
	const units = await ask('zone', 'x0=-3030&y0=-3030&x1=3045&y1=3030');   // 102 by 102 zone corners
	assert.deepEqual([units.status, units.body.code], [422, 'area-too-large'], 'in drawing units, on the zone layout');
	assert.match(units.body.error, /at most 10000 positions in one area; this one is 101 by 101 squares/, 'each side over the pitch, rounded down: 6,075 and 6,060 over 60');
	const tenUnits = await ask('zone', 'x0=30&y0=30&x1=5970&y1=5970');
	assert.deepEqual([tenUnits.status, tenUnits.body.count], [200, 10000], 'control: 100 by 100 zone corners in drawing units');
});

test('H26.6 move 12: an area on its edges holds them -- a point, a line, a lattice edge; an empty area between positions lists none', async () => {
	const bare = (r) => r.body.anchors.map(({ layout, cx, cy, x, y }) => ({ layout, cx, cy, x, y }));
	assert.deepEqual(bare(await ask('node', 'x0=0&y0=0&x1=0&y1=0')), [{ layout: 'node', cx: 0, cy: 0, x: 0, y: 0 }], 'an area of no size on a position holds it');
	assert.deepEqual((await ask('node', 'x0=60&y0=-60&x1=180&y1=-60')).body.anchors.map((a) => a.cx), [1, 2, 3], 'a line through three positions, both ends held');
	assert.deepEqual(bare(await ask('zone', 'cx0=2&cy0=3&cx1=2&cy1=3')), [{ layout: 'zone', cx: 2, cy: 3, x: 150, y: 210 }], 'one zone corner by its cell, on the zone lattice');
	const empty = await ask('node', 'x0=1&y0=1&x1=59&y1=59');
	assert.deepEqual([empty.status, empty.body], [200, { layout: 'node', count: 0, anchors: [] }], 'between four positions: none');
});

test('H26.6 move 12: the area is clipped to PZ31\'s bound -- past it nothing, across it the part within, wholly beyond it 200 with no anchors', async () => {
	const across = await ask('node', 'x0=999900&y0=0&x1=1000200&y1=0');
	assert.deepEqual(across.body.anchors.map((a) => a.x), [999900, 999960], 'across the bound: the positions within it');
	const cells = await ask('node', 'cx0=16665&cy0=0&cx1=16668&cy1=0');
	assert.deepEqual(cells.body.anchors.map((a) => a.cx), [16665, 16666], 'in cells, likewise: 16,666 is 999,960, 16,667 past the bound');
	const safe = Number.MAX_SAFE_INTEGER;
	for (const q of ['x0=2000000&y0=0&x1=3000000&y1=0', 'cx0=-90000000&cy0=0&cx1=-80000000&cy1=0', `cx0=${safe}&cy0=0&cx1=${safe}&cy1=0`, 'cx0=0&cy0=1e300&cx1=0&cy1=1e300']) {
		const r = await ask('zone', q);
		assert.deepEqual([r.status, r.body.count], [200, 0], `${q}: wholly beyond the bound, no anchors`);
	}
	const huge = await ask('node', 'x0=-1e300&y0=0&x1=1e300&y1=0');
	assert.deepEqual([huge.status, huge.body.code], [422, 'area-too-large'], 'an area reaching far past both edges is clipped first, then counted');
	assert.match(huge.body.error, /this one is 33333 by 0 squares/, 'its clipped size named');
});

test('H26.6 move 12: a malformed query is refused 400 area-malformed, naming its parameter', async () => {
	const cases = [
		['', /anchors requires an area: x0, y0, x1 and y1 in drawing units, or cx0, cy0, cx1 and cy1 in cells/],
		['free=1', /anchors requires an area/],
		['x0=0&y0=0&x1=60', /the area in drawing units lacks y1/],
		['cx1=1&cy1=1', /the area in cells lacks cx0, cy0/],
		['x0=0&y0=0&x1=60&y1=60&cx0=0', /one area, in drawing units \(x0, y0, x1, y1\) or in cells \(cx0, cy0, cx1, cy1\), not both: x0, y0, x1, y1, cx0 given/],
		['x0=abc&y0=0&x1=60&y1=60', /x0 must be a finite number, not "abc"/],
		['x0=0&y0=&x1=60&y1=60', /y0 must be a finite number, not ""/],
		['x0=0&y0=0&x1=Infinity&y1=60', /x1 must be a finite number, not "Infinity"/],
		['x0=0&y0=0&x1=60&y1=NaN', /y1 must be a finite number, not "NaN"/],
		['cx0=0&cy0=0&cx1=1.5&cy1=1', /cx1 must be a whole number of cells, not "1.5"/],
		['x0=60&y0=0&x1=0&y1=60', /x0 \(60\) is above x1 \(0\)/],
		['cx0=0&cy0=5&cx1=1&cy1=4', /cy0 \(5\) is above cy1 \(4\)/],
	];
	for (const [q, why] of cases) {
		const r = await ask('node', q);
		assert.deepEqual([r.status, r.body.code], [400, 'area-malformed'], `${q || '(no query)'}: malformed`);
		assert.match(r.body.error, why, `${q || '(no query)'}: names its parameter`);
	}
	assert.equal((await ask('node', 'x0=0.5&y0=-0.5&x1=60.25&y1=0')).status, 200, 'control: drawing units need not be whole');
});

test('H26.6 move 12: free=1 keeps its meaning inside an area -- an occupied anchor carries its occupant, and the free list leaves it out', async () => {
	const doc = await (await fetch(`${base}/api/v1/diagrams/${id}`)).json();
	const n = doc.nodes[0];
	const near = `x0=${n.x - 60}&y0=${n.y - 60}&x1=${n.x + 60}&y1=${n.y + 60}`;
	const all = (await ask('node', near)).body, free = (await ask('node', `free=1&${near}`)).body;
	assert.equal(all.count, 9, 'nine positions about a node');
	assert.equal(all.anchors[4].occupant, n.id, 'the middle one its node\'s');
	assert.ok(!free.anchors.some((a) => a.x === n.x && a.y === n.y) && free.count === all.count - all.anchors.filter((a) => a.occupant).length, 'free=1 leaves out every occupied one');
});
