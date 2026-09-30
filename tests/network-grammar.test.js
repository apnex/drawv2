/*
THE NETWORK'S DRAG GRAMMAR AS DATA -- step T3 of the ruleset audit (dev/RULES.md section 11; RULESET G5-G7).

What a finished drag makes, and which pipe each hop lays, were conditions inside `judgeDrag`, and the facts they read
-- which keys were pressed, how the end was reached, which stops are guides -- were worked out inside the product's
Input. Now Input records the drag as it happened (its steps), `dragFacts` reads the facts from that record in the
plugin, and two tables in network/grammar.mjs say what the facts mean. The Rules engine reads the tables, so the
grammar is held to Q3 like any other rows: exactly one row per case, never resolved by position.

BEHAVIOUR IS UNCHANGED, and this file proves it the strong way: the formula `judgeDrag` used before T3 is copied below
as an oracle, and the tables must give its answer for every case enumerated.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DRAG_KINDS, LEGS, dragFacts, kindOf, pipeFor } from '../network/grammar.mjs';
import { networkInput } from '../network/keys.mjs';
import { composeRules, overlapsIn } from '../kernel/input-rules.mjs';

// ---- the facts, from Input's record ----

const record = (o) => ({ src: 'S', dst: 'D', pins: [], route: [], placed: [], steps: [], release: 'anchor', srcKey: false, ...o });

test('dragFacts: a plain drag released on an anchor pressed nothing and reached its end with no key', () => {
	const f = dragFacts(record({}));
	assert.deepEqual([f.stops, f.pins, f.guides, f.pressed, f.endPressed], [['S', 'D'], [], [], { w: false, g: false }, false]);
});

test('dragFacts: the stops a g made are guides, in drawn order, and the end is not one of them', () => {
	const f = dragFacts(record({ route: ['g1', 'p', 'g2'], pins: ['p'], steps: [{ key: 'g', stop: 'g1' }, { key: 'w', stop: 'p' }, { key: 'g', stop: 'g2' }] }));
	assert.deepEqual(f.guides, ['g1', 'g2']);
	assert.deepEqual(f.stops, ['S', 'g1', 'p', 'g2', 'D']);
	assert.deepEqual(f.pressed, { w: true, g: true });
	const ended = dragFacts(record({ dst: 'g2', route: ['g1'], release: 'stop', steps: [{ key: 'g', stop: 'g1' }, { key: 'g', stop: 'g2' }] }));
	assert.deepEqual(ended.guides, ['g1'], 'the end is the destination, not a guide');
	assert.equal(ended.endPressed, 'g', 'released on empty ground after g: the end was reached with g');
});

test('dragFacts: an end reached with w -- a waypoint, or a node (lab) -- says w; the source key passes through', () => {
	const f = dragFacts(record({ dst: 'N', release: 'stop', steps: [{ key: 'w', stop: 'N' }], srcKey: 'w' }));
	assert.equal(f.endPressed, 'w');
	assert.equal(f.srcKey, 'w');
	assert.equal(dragFacts(record({ steps: [{ key: 'g', stop: 'x' }], route: ['x'] })).endPressed, false, 'released ON an anchor: no key at the end');
});

test('the network plugin hands its judge the facts, never Input\'s record', () => {
	let seen = null;
	const plugin = networkInput((facts) => { seen = facts; return { ok: true }; });
	assert.equal(plugin.owner, 'network');
	plugin.judgeDrag(record({ route: ['g1'], steps: [{ key: 'g', stop: 'g1' }] }));
	assert.deepEqual(seen.guides, ['g1']);
	assert.equal('steps' in seen, false, 'the judge reads facts, not how Input kept them');
	assert.deepEqual(plugin.keys.map((r) => r.id), ['guide', 'stop-on-node']);
});

// ---- the tables ----

const PRESSED = [{ w: false, g: false }, { w: true, g: false }, { w: false, g: true }, { w: true, g: true }];

test('DRAG_KINDS: every combination of keys is exactly one kind (G5)', () => {
	const table = composeRules({ owner: 'network', rules: DRAG_KINDS });
	assert.deepEqual(overlapsIn(table, PRESSED.map((pressed) => ({ pressed })), [null], [{}]), []);
	assert.deepEqual(PRESSED.map((pressed) => kindOf({ pressed }).makes), ['link', 'link', 'pipes', 'link'],
		'any w a link; g without w pipes only; neither a link over what is there');
});

// every hop worth distinguishing: its ends, how the drag ended, how many stops, the source w, the drag's kind, guides
const HOPS = [];
for (const [a, b] of [['S', 'D'], ['S', 'x'], ['x', 'D'], ['x', 'y'], ['D', 'D']]) for (const endPressed of [false, 'w', 'g'])
	for (const count of [2, 3, 4]) for (const srcW of [false, true]) for (const pipesOnly of [false, true])
		for (const guidedA of [false, true]) for (const guidedB of [false, true])
			HOPS.push({ a, b, dst: 'D', endPressed, count, srcW, pipesOnly, guidedA, guidedB });

test('LEGS: every hop is exactly one row -- no overlap (Q3) and no gap, since a gap would drop a pipe in silence', () => {
	const table = composeRules({ owner: 'network', rules: LEGS });
	assert.deepEqual(overlapsIn(table, HOPS, [null], [{}]), []);
	for (const hop of HOPS) assert.doesNotThrow(() => pipeFor(hop), JSON.stringify(hop));
});

/*
THE ORACLE: judgeDrag's leg formula as it stood before T3 (network/guide.mjs at d59b867), copied verbatim in meaning.
A hop is skipped when its ends are one anchor, or when it is the only hop of a drag that pressed no key -- not at the
end, not the source w; otherwise it is laid by hand in a pipes-only drag, or touching a guide, or into an end reached
with g, and with the link otherwise.
*/
const oracle = ({ a, b, dst, endPressed, count, srcW, pipesOnly, guidedA, guidedB }) => {
	if (a === b || (b === dst && !endPressed && count === 2 && !srcW)) return null;
	return pipesOnly || guidedA || guidedB || (b === dst && endPressed === 'g') ? 'hand' : 'link';
};

test('LEGS gives the pre-T3 formula\'s answer for every hop: behaviour unchanged (G6, G7)', () => {
	const differ = HOPS.filter((h) => pipeFor(h) !== oracle(h)).map((h) => `${JSON.stringify(h)} -> ${pipeFor(h)}, was ${oracle(h)}`);
	assert.deepEqual(differ, []);
});

test('every grammar row says what it means in a sentence, for the generated table (P3)', () => {
	for (const r of [...DRAG_KINDS, ...LEGS, ...networkInput(() => ({})).keys]) {
		assert.ok(typeof r.doc === 'string' && r.doc.length > 20, `${r.id}: a sentence`);
		assert.match(r.doc, /^[\x20-\x7e]*$/, `${r.id}: typeable characters only (S13)`);
	}
});

test('the gesture table in the design docs is exactly what the grammar produces', () => {
	assert.doesNotThrow(() => execFileSync(process.execPath, ['tools/gesture-table.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: 'pipe' }));
});
