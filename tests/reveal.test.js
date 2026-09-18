/*
H14.4 -- a beat is a set plus a reveal, and the reveal is DERIVED from one stored origin.

The ops of a beat apply immediately and completely, exactly as a set does: one transaction, one
version, one undo. What a beat adds is a record saying WHEN each op's result becomes visible, and
visibility is computed from that record rather than stored per entity.

The load-bearing property is that at most ONE instant exists -- the active beat's origin. Everything
queued behind it derives its start from that origin plus the durations ahead of it, so no stamp can
go stale, nothing has to promote the queue, and a late joiner computes the same position as everyone
else from the same given. That is the H12 shape one level down: `moversAt` derives motion over a
static board, this derives the arrival of structure over a complete document.

B177 is why the origin is stored once and never per-beat: two tabs disagreed about the time by tens
of seconds because a stamp crossed a machine boundary.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../model/index.mjs';
import { validateDoc } from '../server/validate.js';
import { revealedAt, beatsOf } from '../model/reveal.mjs';

const NODE = (id, name, x, y) => ({ id, name, type: 'server', x, y });
function doc(nodes = [], extra = {}) {
	return {
		meta: { id: 'diagram-aa0001', name: 'r', version: 1, schema: 1 },
		nodes, links: [], waypoints: [], zones: [], groups: [], selection: [], ...extra,
	};
}
// one beat: three entities paced 200ms apart, starting at t=1000
const BEAT = { origin: 1000, beats: [{ interval: 200, caption: 'the web tier', ids: ['node-aa0001', 'node-aa0002', 'node-aa0003'] }] };

test('a reveal round-trips through the model, so it survives a write', () => {
	const m = new Model();
	m.load(doc([NODE('node-aa0001', 'a', 0, 0)], { reveal: BEAT }));
	const out = m.toJSON();
	assert.deepEqual(out.reveal, BEAT, 'toJSON must carry it -- otherwise every write drops the beat');
});

test('a document with no reveal is the normal case and stays legal', () => {
	const m = new Model();
	m.load(doc([NODE('node-aa0001', 'a', 0, 0)]));
	assert.equal(m.toJSON().reveal, undefined, 'absent, not an empty object');
	assert.equal(validateDoc(doc([NODE('node-aa0001', 'a', 0, 0)])), null);
});

test('the schema accepts a well-formed reveal and refuses a malformed one', () => {
	assert.equal(validateDoc(doc([], { reveal: BEAT })), null, 'a valid reveal passes');
	assert.ok(validateDoc(doc([], { reveal: { origin: 'soon', beats: [] } })), 'a non-numeric origin is refused');
	assert.ok(validateDoc(doc([], { reveal: { origin: 1000 } })), 'beats is required');
	assert.ok(validateDoc(doc([], { reveal: { origin: 1000, beats: [{ interval: -5, ids: [] }] } })),
		'a negative interval is refused');
	assert.ok(validateDoc(doc([], { reveal: { origin: 1000, beats: [{ interval: 200, ids: ['nope'] }] } })),
		'an id that is not an entity id is refused');
});

test('visibility is DERIVED: before the origin nothing in the beat is shown', () => {
	const r = revealedAt(BEAT, 999);
	assert.equal(r.has('node-aa0001'), false);
	assert.equal(r.size, 0, 'the beat has not started');
});

test('entities appear one interval apart, in the order the beat names them', () => {
	assert.deepEqual([...revealedAt(BEAT, 1000)], ['node-aa0001'], 'the first lands at the origin');
	assert.deepEqual([...revealedAt(BEAT, 1199)], ['node-aa0001'], 'and stays alone until the interval elapses');
	assert.deepEqual([...revealedAt(BEAT, 1200)], ['node-aa0001', 'node-aa0002']);
	assert.deepEqual([...revealedAt(BEAT, 1400)], ['node-aa0001', 'node-aa0002', 'node-aa0003']);
});

test('once complete a beat stays complete -- a reveal never runs backwards', () => {
	const late = revealedAt(BEAT, 99999);
	assert.equal(late.size, 3, 'everything the beat named is visible, forever after');
});

test('two peers at the same instant derive the same answer, having exchanged nothing', () => {
	// A5 parity: the reveal is a pure function of (record, instant), so there is nothing to sync.
	for (const t of [1000, 1150, 1300, 1400, 5000]) {
		assert.deepEqual([...revealedAt(BEAT, t)], [...revealedAt(BEAT, t)]);
	}
});

test('a queued beat starts where the one ahead of it ends, from the SAME origin', () => {
	/*
	The reason only one instant is stored. Beat 2 carries no timestamp: its start is beat 1's origin
	plus beat 1's duration, so cancelling or undoing beat 1 recomputes beat 2 for free and no stamp
	can be left pointing at a schedule that no longer exists.
	*/
	const two = { origin: 1000, beats: [
		{ interval: 200, caption: 'first', ids: ['node-aa0001', 'node-aa0002'] },
		{ interval: 100, caption: 'second', ids: ['node-bb0001', 'node-bb0002'] },
	] };
	// beat 1 spans 1000..1200 (two entities, one interval apart), so beat 2 opens AT 1200 --
	// back to back, with no gap invented between them
	assert.equal(revealedAt(two, 1199).has('node-bb0001'), false, 'beat 2 has not begun');
	assert.equal(revealedAt(two, 1199).size, 1, 'beat 1 has shown only its first by then');
	assert.equal(revealedAt(two, 1200).has('node-aa0002'), true, "beat 1's second lands at 1200");
	assert.equal(revealedAt(two, 1200).has('node-bb0001'), true, 'and beat 2 opens at the same instant');
	assert.equal(revealedAt(two, 1300).has('node-bb0002'), true, 'its second entity, one interval on');
});

test('beatsOf reports which beat is current and how far into it, for the caption channel', () => {
	const two = { origin: 1000, beats: [
		{ interval: 200, caption: 'first', ids: ['node-aa0001', 'node-aa0002'] },
		{ interval: 100, caption: 'second', ids: ['node-bb0001'] },
	] };
	assert.equal(beatsOf(two, 900).active, null, 'nothing before the origin');
	assert.equal(beatsOf(two, 1100).active.caption, 'first');
	assert.equal(beatsOf(two, 1450).active.caption, 'second');
	// the caption is held until replaced, so after the last beat the last caption stands
	assert.equal(beatsOf(two, 9999).active.caption, 'second', 'the caption outlives its reveal');
});

test('an empty beat list is inert rather than an error', () => {
	assert.equal(revealedAt({ origin: 1000, beats: [] }, 5000).size, 0);
	assert.equal(beatsOf({ origin: 1000, beats: [] }, 5000).active, null);
	assert.equal(revealedAt(undefined, 5000).size, 0, 'no reveal at all is the normal case');
});

test('a zero interval reveals a whole beat at once rather than never', () => {
	const instant = { origin: 1000, beats: [{ interval: 0, ids: ['node-aa0001', 'node-aa0002'] }] };
	assert.equal(revealedAt(instant, 1000).size, 2, 'both land on the origin');
	assert.equal(revealedAt(instant, 999).size, 0);
});

/*
The consumer. `app/src/reveal.js` turns the derivation into marks on the canvas, and these drive it
with a fake renderer and a fake clock -- no DOM at all, which is the property B45 exists to keep.
*/
test('the painter hides what the beat has not reached, and shows it when it does', async () => {
	const { Reveal } = await import('../app/src/reveal.js');
	const marks = new Map();
	const renderer = { byId: (id) => marks.get(id) };
	for (const id of ['node-aa0001', 'node-aa0002', 'node-aa0003']) {
		marks.set(id, { attrs: new Set(),
			setAttribute(k) { this.attrs.add(k); }, removeAttribute(k) { this.attrs.delete(k); } });
	}
	let t = 999;
	const r = new Reveal({ model: { state: { reveal: BEAT } }, renderer, now: () => t });
	const unrevealed = (id) => marks.get(id).attrs.has('data-unrevealed');

	r.paint();
	assert.equal(unrevealed('node-aa0001'), true, 'nothing shown before the origin');

	t = 1000; r.paint();
	assert.equal(unrevealed('node-aa0001'), false, 'the first is revealed at the origin');
	assert.equal(unrevealed('node-aa0002'), true, 'the second is not');

	t = 1400; r.paint();
	assert.equal(unrevealed('node-aa0003'), false, 'all three by the end of the beat');
});

test('the painter reports the caption, and only when it changes', async () => {
	const { Reveal } = await import('../app/src/reveal.js');
	const said = [];
	let t = 900;
	const r = new Reveal({
		model: { state: { reveal: BEAT } },
		renderer: { byId: () => null },
		now: () => t,
		onCaption: (c) => said.push(c),
	});
	r.paint();                       // before the origin: nothing said
	t = 1100; r.paint(); r.paint();  // twice inside the beat
	t = 1300; r.paint();             // still the same beat
	assert.deepEqual(said, ['the web tier'], 'emitted once, not once per paint');
});

test('a document with no reveal leaves every entity alone', async () => {
	const { Reveal } = await import('../app/src/reveal.js');
	const mark = { attrs: new Set(), setAttribute(k) { this.attrs.add(k); }, removeAttribute(k) { this.attrs.delete(k); } };
	const r = new Reveal({ model: { state: { reveal: null } }, renderer: { byId: () => mark }, now: () => 5000 });
	r.paint();
	assert.equal(mark.attrs.size, 0, 'nothing is withheld when nothing says to withhold it');
});

test('undoing a beat restores everything it was hiding', async () => {
	/*
	The failure this prevents: a beat is undone mid-reveal, the record goes, and whatever was hidden
	at that instant stays hidden forever -- entities present in the document and invisible on the
	canvas, with nothing left to explain why.
	*/
	const { Reveal } = await import('../app/src/reveal.js');
	const marks = new Map();
	for (const id of ['node-aa0001', 'node-aa0002', 'node-aa0003']) {
		marks.set(id, { attrs: new Set(),
			setAttribute(k) { this.attrs.add(k); }, removeAttribute(k) { this.attrs.delete(k); } });
	}
	const model = { state: { reveal: BEAT } };
	const r = new Reveal({ model, renderer: { byId: (id) => marks.get(id) }, now: () => 1000 });
	r.paint();
	assert.equal(marks.get('node-aa0003').attrs.has('data-unrevealed'), true, 'hidden mid-beat');

	model.state.reveal = null;       // undo removed the beat
	r.sync();
	for (const [id, m] of marks) assert.equal(m.attrs.size, 0, `${id} was left hidden`);
});

/*
H14.7 -- authoring a beat, and undoing one.

The reveal record is built SERVER-side because only the planner knows which ids a commit produced:
an intent op names `near lb-1` and the id is minted while resolving it, so a client assembling the
record would be guessing at the very ids the feature exists to order.

Ruled 2026-09-04: the reveal is part of what a commit changes, so it INVERTS. Undoing a beat takes
its reveal with it and restores the one before, which is what keeps `one undo per beat` true and
stops the document holding a record that describes a commit already reversed.
*/
test('a commit carrying pace and caption records a reveal over the ids it produced', async () => {
	const { commit } = await import('../server/txn.mjs');
	const { Log } = await import('../server/log.mjs');
	const m = new Model();
	m.load(doc());
	const log = new Log();
	const r = commit(m, log, {
		ops: [
			{ op: 'put', kind: 'node', entity: { id: 'node-aa0001', name: 'a', type: 'server', x: 0, y: 0 } },
			{ op: 'put', kind: 'node', entity: { id: 'node-aa0002', name: 'b', type: 'server', x: 60, y: 0 } },
		],
		pace: 200, caption: 'the web tier',
	});
	assert.ok(r.ok, r.error);
	const rec = m.toJSON().reveal;
	assert.ok(rec, 'the commit recorded a reveal');
	assert.equal(rec.beats.length, 1);
	assert.equal(rec.beats[0].caption, 'the web tier');
	assert.equal(rec.beats[0].interval, 200);
	assert.deepEqual(rec.beats[0].ids, ['node-aa0001', 'node-aa0002'], 'in the order the ops applied');
});

test('a commit with no pace records nothing -- a set is not a beat', async () => {
	const { commit } = await import('../server/txn.mjs');
	const { Log } = await import('../server/log.mjs');
	const m = new Model();
	m.load(doc());
	commit(m, new Log(), { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0001', name: 'a', type: 'server', x: 0, y: 0 } }] });
	assert.equal(m.toJSON().reveal, undefined, 'no pace, no reveal');
});

test('undoing a beat takes its reveal with it', async () => {
	const { commit, undo } = await import('../server/txn.mjs');
	const { Log } = await import('../server/log.mjs');
	const m = new Model();
	m.load(doc());
	const log = new Log();
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0001', name: 'a', type: 'server', x: 0, y: 0 } }], pace: 200, caption: 'one' });
	assert.ok(m.state.reveal, 'the beat is recorded');

	undo(m, log);
	assert.equal(m.get('node', 'node-aa0001'), undefined, 'the entity went');
	assert.equal(m.state.reveal, null, 'and so did the record naming it -- no ghost');
});

test('undoing back past an earlier beat restores THAT one, not nothing', async () => {
	const { commit, undo } = await import('../server/txn.mjs');
	const { Log } = await import('../server/log.mjs');
	const m = new Model();
	m.load(doc());
	const log = new Log();
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0001', name: 'a', type: 'server', x: 0, y: 0 } }], pace: 100, caption: 'first' });
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0002', name: 'b', type: 'server', x: 60, y: 0 } }], pace: 300, caption: 'second' });
	assert.equal(m.state.reveal.beats.at(-1).caption, 'second');

	undo(m, log);
	assert.ok(m.state.reveal, 'the first beat is still there');
	assert.equal(m.state.reveal.beats.at(-1).caption, 'first', 'restored, not cleared');
	assert.equal(m.get('node', 'node-aa0001')?.name, 'a', 'and its entity survived');
});

test('a second beat queues behind the first rather than replacing it', async () => {
	const { commit } = await import('../server/txn.mjs');
	const { Log } = await import('../server/log.mjs');
	const m = new Model();
	m.load(doc());
	const log = new Log();
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0001', name: 'a', type: 'server', x: 0, y: 0 } }], pace: 100, caption: 'first' });
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0002', name: 'b', type: 'server', x: 60, y: 0 } }], pace: 100, caption: 'second' });
	const rec = m.toJSON().reveal;
	assert.equal(rec.beats.length, 2, 'both beats are in the queue');
	assert.deepEqual(rec.beats.map((b) => b.caption), ['first', 'second'], 'in order');
	// and the queue still carries ONE instant between them
	assert.equal(Object.keys(rec).sort().join(','), 'beats,origin');
});

test('a beat records only the entities it CREATED, not ones it merely touched', async () => {
	const { commit } = await import('../server/txn.mjs');
	const { Log } = await import('../server/log.mjs');
	const m = new Model();
	m.load(doc([NODE('node-aa0001', 'existing', 0, 0)]));
	const log = new Log();
	commit(m, log, { ops: [{ op: 'set', kind: 'node', id: 'node-aa0001', patch: { name: 'renamed' } }], pace: 200, caption: 'rename' });
	const rec = m.toJSON().reveal;
	// hiding something that was already on screen would make a rename look like a deletion
	assert.equal(rec, undefined, 'a beat that creates nothing reveals nothing');
});

test('redo puts the beat back, reveal and all', async () => {
	const { commit, undo, redo } = await import('../server/txn.mjs');
	const { Log } = await import('../server/log.mjs');
	const m = new Model();
	m.load(doc());
	const log = new Log();
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0001', name: 'a', type: 'server', x: 0, y: 0 } }], pace: 200, caption: 'back' });
	undo(m, log);
	assert.equal(m.state.reveal, null);
	redo(m, log);
	assert.ok(m.get('node', 'node-aa0001'), 'the entity is back');
	assert.equal(m.state.reveal?.beats.at(-1).caption, 'back', 'and so is the beat that revealed it');
});

test('a beat authored through the CLI reaches the document, end to end', async () => {
	const fs = await import('node:fs');
	const os = await import('node:os');
	const path = await import('node:path');
	const { makeApp } = await import('./fixtures/app.mjs');
	const { main } = await import('../cli/draw.mjs');
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-beat-'));
	const home = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-bhome-'));
	const app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	const host = `http://127.0.0.1:${app.port}`;
	const run = async (...argv) => {
		const out = [];
		await main([...argv, '--host', host], { HOME: home }, (s) => out.push(s));
		return out.join('');
	};
	try {
		const id = (await run('create', 'beat-e2e')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'lb', '--diagram', id);
		await run('place', 'server', 'near', 'lb', '--name', 'w1', '--draft', '--diagram', id);
		await run('place', 'server', 'near', 'lb', '--name', 'w2', '--draft', '--diagram', id);
		await run('commit', '--pace', '250', '--caption', 'the web tier', '--diagram', id);

		const out = JSON.parse(await run('dump', '--diagram', id, '--json'));
		assert.ok(out.reveal, 'the document carries a reveal');
		assert.equal(out.reveal.beats.length, 1);
		assert.equal(out.reveal.beats[0].interval, 250);
		assert.equal(out.reveal.beats[0].caption, 'the web tier');
		assert.equal(out.reveal.beats[0].ids.length, 2, 'both placed nodes, and not the pre-existing lb');
		// the ids are the ones the SERVER minted while resolving `near lb`
		const placed = out.nodes.filter((n) => n.name !== 'lb').map((n) => n.id).sort();
		assert.deepEqual([...out.reveal.beats[0].ids].sort(), placed);
	} finally { await app.close(); }
});

test('undoing a RUN of beats restores what stood before all of them', async () => {
	/*
	M2 of the mutation pass survived without this. `undo {to}` reverses several records at once, and
	the walk goes newest-first -- so the reveal must end at the OLDEST record's inverse, not the
	newest one it happened to see first. Restoring the newest would leave the document holding a
	beat whose entities were just removed, which is the exact ghost this ruling exists to prevent.
	*/
	const { commit, undo } = await import('../server/txn.mjs');
	const { Log } = await import('../server/log.mjs');
	const m = new Model();
	m.load(doc());
	const log = new Log();
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0001', name: 'a', type: 'server', x: 0, y: 0 } }], pace: 100, caption: 'first' });
	const firstSeq = log.records.at(-1).seq;
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0002', name: 'b', type: 'server', x: 60, y: 0 } }], pace: 100, caption: 'second' });
	commit(m, log, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa0003', name: 'c', type: 'server', x: 120, y: 0 } }], pace: 100, caption: 'third' });
	assert.equal(m.state.reveal.beats.length, 3);

	undo(m, log, firstSeq);            // reverse all three in one transaction
	assert.equal(m.get('node', 'node-aa0001'), undefined, 'every entity went');
	assert.equal(m.state.reveal, null, 'and the reveal went back to before the FIRST beat');
});
