/*
A LINK'S DECLARATIONS, ONE LIST (`LINK_DECLARATIONS`, model/invariants.mjs) -- the fields that decide whether two links are
compatible. The split carries them (B284) and the planner's join is woken by a change to one (B285); `collapseAtWaypoint`
is what actually compares them. So the list must be exactly the link fields that can change its verdict.

Held by behaviour, over the link's own kind row, so a field added to links later is judged without editing this test:
every link field but the structural ones (identity, ends, pins, ring) is varied on an otherwise joinable pair, and it must
change the verdict exactly when it is on the list. A new declaration added to the comparison and not the list -- or the
reverse -- fails here.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINK_DECLARATIONS, collapseAtWaypoint, splitAtBend } from '../model/invariants.mjs';
import { PRODUCT_KINDS } from '../planner/kinds.mjs';

const STRUCTURAL = ['id', 'name', 'src', 'dst', 'via', 'closed'];
const W = 'waypoint-00000e';
const pair = () => [{ id: 'link-00000a', name: 'a', src: 'node-00000a', dst: W }, { id: 'link-00000b', name: 'b', src: W, dst: 'node-00000b' }];
const joins = (a, b) => collapseAtWaypoint(a, b, W) !== null;
// the values a field's own check accepts, from a small universe -- enough to set it, and to set it differently
const valuesOf = (check) => [true, false, 'a', 'b', 1, 2, 'forward', 'reverse'].filter((v) => { try { return check(v); } catch { return false; } });

test('every link field that can change whether two links join is a declaration, and every declaration can', () => {
	const fields = PRODUCT_KINDS.row('link').fields;
	for (const field of Object.keys(fields).filter((f) => !STRUCTURAL.includes(f))) {
		const values = valuesOf(fields[field]);
		assert.ok(values.length >= 2, `${field}: this test needs two values its check accepts to vary it`);
		let decides = false;
		for (const x of [undefined, ...values]) for (const y of [undefined, ...values]) {
			const [a, b] = pair();
			if (x !== undefined) a[field] = x;
			if (y !== undefined) b[field] = y;
			if (joins(a, b) !== joins(...pair())) decides = true;
		}
		assert.equal(decides, LINK_DECLARATIONS.includes(field),
			decides ? `${field} decides whether two links join, so it must be in LINK_DECLARATIONS` : `${field} is in LINK_DECLARATIONS but decides nothing`);
	}
	for (const d of LINK_DECLARATIONS) assert.ok(d in fields, `${d} is a declaration the link row does not have`);
});

test('a cut carries exactly the declarations a link has, and invents none', () => {
	const link = { id: 'link-00000a', name: 'a', src: 'node-00000a', dst: 'node-00000b', via: [W], control: true, direction: 'reverse' };
	for (const half of splitAtBend(link, W)) for (const d of LINK_DECLARATIONS) assert.equal(half[d], link[d], d);
	const { control: _c, direction: _f, ...plain } = link;
	for (const half of splitAtBend(plain, W)) for (const d of LINK_DECLARATIONS) assert.ok(!(d in half), `an undeclared link's half has no ${d}`);
});
