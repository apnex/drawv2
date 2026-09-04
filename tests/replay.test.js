/*
F5 — is replaying the outbox after a reload safe?

This had to be answered because H13.10 made reloads AUTOMATIC. Before that a reload was a person
choosing to press refresh; now the client does it to itself on evidence of staleness, so the replay
path runs more often and without anyone deciding to take the risk.

The mechanism, established rather than assumed:

	- the outbox holds only UNACKED commits, and it is durable across a reload (D30)
	- `restoreOutbox` mints a FRESH `txnId` for each restored message
	- the server keeps no memory of applied transaction ids -- it echoes `txnId` on the ack and
	  nothing more

So a commit that was applied server-side whose ack never arrived WILL be applied a second time, and
nothing anywhere deduplicates it. Exactly-once is not provided. What has to hold instead is that
applying twice reaches the same document as applying once.

IT IS SAFE, AND FOR A BETTER REASON THAN THE COMMANDS BEING CAREFUL.

The first attempt to prove these tests bite tried to make a toggle relative, and could not. There is
nowhere for relativity to live: `applyOps` has exactly four verbs and not one of them reads the
current value to compute a new one. `put` carries a whole entity, `set` carries resolved fields,
`del` carries an id, `meta` carries resolved fields. A command CANNOT emit "flip it" or "move it by
ten" because the vocabulary has no way to express it.

So replay is idempotent by construction rather than by discipline, which is a much stronger thing to
be able to say. The load-bearing guard is therefore the vocabulary check at the bottom of this file,
not the per-command tests above it -- those are regression evidence for behaviour that is currently
impossible to break without adding a fifth verb.

WHAT IS STILL NOT PROVIDED, stated so nobody reads this file as promising more than it does:
exactly-once. `restoreOutbox` mints a fresh `txnId` and the server remembers none, so a replayed
commit lands as a SECOND transaction in the log. The document converges; the history does not. One
user action can therefore cost two undos, and two entries against `LOG_MAX`. That is a real cost and
it is not addressed here.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from '../model/index.mjs';
import { applyOps } from '../model/ops.mjs';
import * as commands from '../app/src/commands.js';

/*
Command entries are NOT wire ops, and the difference matters here.

`changes.js` maps `{ op:'set', after }` to `{ op:'set', patch }` on the way out, so the outbox holds
the WIRE shape and a replay replays that. A first draft of this file applied command entries to
`applyOps` directly: `patch` was undefined, every `set` silently did nothing, and the tests reported
that toggles were broken. They were not -- the harness was addressing the wrong shape, which is the
exact failure this project keeps meeting.

Mirrored from `changes.js:toOp` rather than imported, because it is not exported; the vocabulary
guard at the bottom fails if a fourth op verb ever appears.
*/
const toOp = (e) => {
	if (e.op === 'put') return { op: 'put', kind: e.kind, entity: e.entity };
	if (e.op === 'del') return { op: 'del', kind: e.kind, id: e.entity.id };
	if (e.op === 'set') return { op: 'set', kind: e.kind, id: e.id, patch: e.after };
	if (e.op === 'meta') return { op: 'meta', patch: e.patch };
	throw new Error(`toOp: unknown entry op '${e.op}'`);
};
const wire = (cmd) => cmd.entries.map(toOp);

const NODE = 'node-aa0001', LINK = 'link-aa0003';
const WP_A = 'waypoint-aa0004', WP_B = 'waypoint-aa0005';

function doc() {
	const m = new Model();
	m.put('node', { id: NODE, name: 'n', type: 'host', shape: 'circle', x: 60, y: 60 });
	m.put('waypoint', { id: WP_A, name: WP_A, x: 0, y: 0 });
	m.put('waypoint', { id: WP_B, name: WP_B, x: 240, y: 0 });
	m.put('link', { id: LINK, name: LINK, src: WP_A, dst: WP_B });
	return m;
}

// apply once, then again, and compare against applying once
function twiceEqualsOnce(build) {
	const once = doc(), twice = doc();
	applyOps(once, wire(build(once)));
	const entries = wire(build(twice));
	applyOps(twice, entries);
	applyOps(twice, entries);            // the replay: the SAME ops, as the outbox holds them
	return { once: JSON.stringify(once.toJSON()), twice: JSON.stringify(twice.toJSON()) };
}

test('F5: replaying a move reaches the same document', () => {
	const r = twiceEqualsOnce(() => commands.moveEntities([{ kind: 'node', id: NODE, after: { x: 180, y: 120 } }]));
	assert.equal(r.twice, r.once);
});

test('F5: replaying a create does not create a second entity', () => {
	// ids are minted CLIENT-side before submission, so a replay carries the same id and overwrites
	// rather than inserting. That is the property that makes `put` safe to repeat.
	// The id is minted ONCE here: `makeNode` mints a fresh one per call, so building the command
	// twice would compare two documents that differ by id and prove nothing about replay.
	const minted = doc().makeNode('router', { x: 300, y: 300 });
	const r = twiceEqualsOnce(() => commands.createEntity('node', minted));
	assert.equal(r.twice, r.once);
	const after = doc();
	const node = minted;
	const ops = wire(commands.createEntity('node', node));
	applyOps(after, ops); applyOps(after, ops);
	assert.equal(after.all('node').filter((n) => n.id === node.id).length, 1, 'exactly one, not two');
});

test('F5: replaying a toggle does not toggle it BACK', () => {
	/*
	The case that would break, and the reason this file exists. `toggleClosed` reads the current
	value and emits the OPPOSITE as an absolute field, so the op says `closed: true` rather than
	"flip it". Replay therefore re-asserts rather than reverses.

	Had the op carried the intent instead of the result, a replayed close would silently re-open a
	ring -- and nothing in the system would have reported anything wrong.
	*/
	const m = doc();
	const ops = wire(commands.toggleClosed(m.get('link', LINK)));
	applyOps(m, ops);
	assert.equal(m.get('link', LINK).closed, true, 'closed once');
	applyOps(m, ops);
	assert.equal(m.get('link', LINK).closed, true, 'still closed after the replay, not re-opened');
});

test('F5: replaying a reshape does not flip the shape back', () => {
	// same hazard as the toggle above: the op must carry the resulting shape, not "the other one"
	const m = doc();
	const ops = wire(commands.reshapeNodes(m, [NODE]));
	applyOps(m, ops);
	const shape = m.get('node', NODE).shape;
	applyOps(m, ops);
	assert.equal(m.get('node', NODE).shape, shape, `replay flipped ${shape} back`);
});

test('F5: replaying an arm leaves the spawner armed with the same instant', () => {
	// `since` decides where every packet is. A replay that restamped it would teleport the whole
	// route for every viewer, which is the H12 defect class arriving by a new door.
	const m = doc();
	const ops = wire(commands.toggleSpawn(m, WP_A, 1_788_300_000_000));
	applyOps(m, ops);
	const first = JSON.stringify(m.get('waypoint', WP_A).spawn);
	applyOps(m, ops);
	assert.equal(JSON.stringify(m.get('waypoint', WP_A).spawn), first, 'the replay changed the spawn');
});

test('F5: replaying a delete is a no-op rather than a fault', () => {
	const m = doc();
	const ops = wire(commands.deleteSelection(m, new Set([NODE])));
	applyOps(m, ops);
	assert.ok(!m.get('node', NODE), 'gone after the first apply');
	applyOps(m, ops);            // must not throw
	assert.ok(!m.get('node', NODE), 'still gone, and the replay raised nothing');
});

/*
The guard, and the part that will still be true when someone adds a command next year.

Every assertion above tests a command that exists today. This one tests the RULE: an op carries a
resolved value, never an instruction to be interpreted against whatever the document happens to say
when it lands. A future `{ op: 'nudge', dx: 10 }` would replay as twenty pixels and pass every test
above, because none of them would know to look at it.
*/
test('F5: no command emits a relative or intent-shaped op', () => {
	const src = fs.readFileSync(new URL('../app/src/commands.js', import.meta.url), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	const ops = [...src.matchAll(/op: '(\w+)'/g)].map((m) => m[1]);
	/*
	`meta` belongs here and is safe for the same reason as the rest: `renameDocument` emits
	`patch: { name }`, a resolved value rather than an instruction. Listed explicitly so that a
	FIFTH verb has to be looked at by a person before it can ride the replay path.
	*/
	assert.deepEqual([...new Set(ops)].sort(), ['del', 'meta', 'put', 'set'],
		'a new op verb appeared -- confirm it is absolute before allowing it, or the outbox replay stops being safe');
	for (const banned of ['dx:', 'dy:', 'delta', 'toggle:', 'by:']) {
		assert.equal(src.includes(`, ${banned}`), false, `an op appears to carry a relative field: ${banned}`);
	}
});

test('F5: the op vocabulary has nowhere for a relative value to live', () => {
	/*
	The guard that actually holds replay safety up.

	Every handler in `applyOps` must pass its payload straight through. The moment one reads the
	existing entity to compute a new value -- `x: cur.x + op.dx` -- replay stops being idempotent and
	every test above it keeps passing, because they only know the commands that exist today.
	*/
	const src = fs.readFileSync(new URL('../model/ops.mjs', import.meta.url), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	const body = src.slice(src.indexOf('export function applyOps'));
	const fn = body.slice(0, body.indexOf('\n}'));
	for (const reading of ['model.get(', '.x +', '.y +', 'current', 'existing', 'prev']) {
		assert.equal(fn.includes(reading), false,
			`applyOps appears to read prior state via ${reading} -- an op that derives from the document is not replayable`);
	}
	const verbs = [...fn.matchAll(/op\.op === '(\w+)'/g)].map((m) => m[1]).sort();
	assert.deepEqual(verbs, ['del', 'meta', 'put', 'set'], `applyOps grew a verb: ${verbs}`);
});
