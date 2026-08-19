// CS2 — the log is durable. Undo survives a process restart, the file round-trips exactly, a
// corrupt log costs history but never the diagram, and a failed write retries and is observable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../server/store.js';
import { Log } from '../server/log.mjs';
import { serialize, parse } from '../server/docfile.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'draw-cs2-'));
const node = (id, x = 0) => ({ id, name: id, type: 'host', shape: 'circle', x, y: 0 });
const put = (kind, entity) => ({ op: 'put', kind, entity });

function storeWith(dir) {
	const s = new Store(dir);
	s.init();
	return { s, id: s.list()[0].id };
}

// ---- I10: the file round-trips ----

test('I10: parse(serialize(doc, log)) deep-equals the input, including a large record', () => {
	const doc = { meta: { id: 'diagram-aaaaaa', name: 'x', slides: { url: '', presentationId: '', pageId: '' } },
		nodes: [], waypoints: [], links: [], zones: [], groups: [], selection: [] };
	const log = new Log(0);
	// a delete-all of a 65-entity diagram is the largest record the design admits
	const ops = Array.from({ length: 65 }, (_, i) => ({ op: 'del', kind: 'node', id: `node-${String(i).padStart(6, '0')}` }));
	const inverse = ops.map((o) => ({ op: 'put', kind: 'node', entity: node(o.id, i(o)) }));
	function i(o) { return Number(o.id.slice(-3)) * 6; }
	log.version++;
	log.append({ seq: 1, from: 0, at: 1, by: 'client', actor: 'a', label: 'delete', ops, inverse });
	assert.ok(JSON.stringify(log.records[0]).length > 5000, 'the record is genuinely large');

	const back = parse(serialize(doc, log));
	assert.deepEqual(back.doc, doc);
	assert.deepEqual(back.log, log.toJSON());
});

/*
B13 — a `$` in any entity name must not corrupt the file.

`serialize` splices the log block in with `String.replace(regex, string)`, and in a string
replacement `$&`, $-backtick, `$'`, `$1` and `$$` are REPLACEMENT PATTERNS, not literals. The block
carries every log record, a record carries entity names, and a name is any string
(`server/validate.js` FIELDS.node.name = `str(v, 64)`). `$&` expands to the matched `"\n}"` and
injects a raw newline into a JSON string literal.

Why this is worse than a bad write: the write SUCCEEDS and `entry.dirty` is cleared
(`server/store.js:343`), so nothing reports it. The file is unreadable only at the next boot,
where `Store.init` skips it — and if it is the only diagram, D17/GR8 makes the process refuse to
start. A user naming a node `$&` is a persistent boot failure plus the loss of that diagram's log.
*/
const ADVERSARIAL = ['a$&b', "a$'b", 'a$`b', 'a$1b', 'a$$b', '$&', '$`'];

test('B13: a replacement-pattern entity name round-trips through the file', () => {
	for (const name of ADVERSARIAL) {
		const doc = { meta: { id: 'diagram-aaaaaa', name: 'x', slides: { url: '', presentationId: '', pageId: '' } },
			nodes: [], waypoints: [], links: [], zones: [], groups: [], selection: [] };
		const log = new Log(0);
		log.version++;
		log.append({ seq: 1, from: 0, at: 1, by: 'client', actor: 'a', label: 'rename',
			ops: [{ op: 'put', kind: 'node', entity: { ...node('node-aaaaaa'), name } }], inverse: [] });

		const text = serialize(doc, log);
		let back;
		assert.doesNotThrow(() => { back = parse(text); },
			`a node named ${JSON.stringify(name)} produced an unparseable file`);
		assert.equal(back.log.records[0].ops[0].entity.name, name,
			`the name did not survive serialize: ${JSON.stringify(name)}`);
	}
});

test('B13: the log block survives a document body that does not end in "\\n}"', () => {
	// the splice is anchored on /\n\}$/; anything that does not match drops the whole log SILENTLY.
	const log = new Log(0);
	log.version++;
	log.append({ seq: 1, from: 0, at: 1, by: 'client', actor: 'a', label: 'x', ops: [], inverse: [] });
	const back = parse(serialize({}, log));
	assert.deepEqual(back.log, log.toJSON(), 'an empty document body must not lose the log');
});

test('B13: a $-named node survives a restart — the corruption escalated to a boot refusal', () => {
	const dir = tmp();
	try {
		const a = storeWith(dir);
		a.s.commit(a.id, { label: 'create', ops: [put('node', { ...node('node-bd0001', 300), name: 'a$&b' })] }, 'server', 't');
		a.s.flush(a.id);

		const b = new Store(dir);            // a different process would see exactly this
		assert.doesNotThrow(() => b.init(), 'the store refused to boot on a file it corrupted itself');
		const named = b.get(a.id).all('node').find((n) => n.id === 'node-bd0001');
		assert.equal(named.name, 'a$&b', 'the name came back intact');
		assert.ok(b.diagrams.get(a.id).log.records.length >= 1, 'and the log came back with it');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('I10: the document half stays pretty-printed and carries no log key', () => {
	const dir = tmp();
	try {
		const { s, id } = storeWith(dir);
		s.commit(id, { ops: [put('node', node('node-ba0001', 300))] }, 'server', 't');
		s.flush(id);
		const text = fs.readFileSync(path.join(dir, `${id}.json`), 'utf8');
		assert.match(text, /\n\t"nodes": \[/, 'the document is still diffable');
		assert.match(text, /\n\t"log": \{/, 'the log is a sibling key');
		const { doc } = parse(text);
		assert.equal(doc.log, undefined, 'the log never reaches Model.toJSON()');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
B20 — a GR9 invariant breach is not an I/O failure and must not be reported as one.

The assert lived INSIDE the write's try/catch, so a structural breach took the B4 recovery path
designed for a failing `renameSync`. Four consequences, all wrong: the write had already SUCCEEDED
and `dirty` was already false; the catch counted `flushFailures` and logged "flush failed", which
is not what happened; `/health` then reported `degraded` FOREVER because that counter never
decrements; and the rescheduled retry returned immediately at the `!entry.dirty` guard, so the
real breach was reported exactly once, mislabelled, and never re-checked.

A structural invariant violation and a transient I/O failure are different failures. They do not
share a counter, a message, or a recovery path — a retry cannot repair a log that mis-mints a seq.
*/
test('B20: a GR9 breach is counted and named as an invariant failure, not a flush failure', () => {
	const dir = tmp();
	try {
		const { s, id } = storeWith(dir);
		s.commit(id, { ops: [put('node', node('node-be0001', 60))] }, 'server', 't');
		s.flush(id);

		const log = s.diagrams.get(id).log;
		log.records[log.records.length - 1].seq = log.version + 5;   // a record above its own watermark
		s.commit(id, { ops: [put('node', node('node-be0002', 120))] }, 'server', 't');
		s.flush(id);

		assert.equal(s.flushFailures(), 0, 'a structural breach is NOT an I/O failure and must not be counted as one');
		assert.equal(s.invariantFailures(), 1, 'it is counted as what it is');
		assert.ok(fs.existsSync(path.join(dir, `${id}.json`)), 'and the document is still persisted — the breach is in the log accounting, not the user data');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B20: a breach is re-checked on the next write, not reported once and forgotten', () => {
	const dir = tmp();
	try {
		const { s, id } = storeWith(dir);
		s.commit(id, { ops: [put('node', node('node-bf0001', 60))] }, 'server', 't');
		s.flush(id);
		const log = s.diagrams.get(id).log;
		log.records[log.records.length - 1].seq = log.version + 5;

		s.commit(id, { ops: [put('node', node('node-bf0002', 120))] }, 'server', 't');
		s.flush(id);
		s.commit(id, { ops: [put('node', node('node-bf0003', 180))] }, 'server', 't');
		s.flush(id);
		assert.equal(s.invariantFailures(), 2, 'the breach is still there, so it is still reported');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
B15 — `durableVersion` must name what is actually on disk.

It was derived from a BOOLEAN (`entry.dirty`) with no flushed watermark, spelled three different
ways at three sites (protocol.js:105 with null-guards, protocol.js:245 and rest.js:283 without).
`dirty` answers "is there anything unwritten?", which is not the question: with three commits
inside one 200 ms debounce window the ack for v3 reported `durableVersion: 2` while NOTHING had
been flushed and the true durable version was 0.

The client prunes its persisted outbox on this number (D30), so it discards work that exists only
in memory. D29's rewind detects the loss on reconnect — but the outbox, which is the recovery
material, is already gone. A1 `Ephemeral Truth Loss`, inside the window B6 declares safe.
*/
test('B15: durableVersion names the flushed watermark, not the absence of dirt', () => {
	const dir = tmp();
	try {
		const s = new Store(dir, { flushMs: 100000 });   // nothing auto-flushes during the test
		s.init();
		const id = s.list()[0].id;

		assert.equal(s.durableVersion(id), s.diagrams.get(id).log.version, 'a freshly-loaded diagram is fully durable');
		const atLoad = s.durableVersion(id);

		s.commit(id, { ops: [put('node', node('node-c00001', 60))] }, 'server', 't');
		s.commit(id, { ops: [put('node', node('node-c00002', 120))] }, 'server', 't');
		const third = s.commit(id, { ops: [put('node', node('node-c00003', 180))] }, 'server', 't');

		assert.equal(s.durableVersion(id), atLoad, 'three commits in one window flushed NOTHING, so nothing new is durable');
		assert.ok(s.durableVersion(id) < third.version - 1, 'the old `version - 1` guess over-reported by two');

		s.flush(id);
		assert.equal(s.durableVersion(id), third.version, 'after the flush, everything is durable');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B15: a failed write leaves durableVersion behind, and a later success advances it', () => {
	const dir = tmp();
	try {
		let fail = false;
		const s = new Store(dir, { flushMs: 100000, writeDoc: (f, t) => {
			if (fail) throw new Error('backend unavailable');
			fs.writeFileSync(f, t);
		} });
		s.init();
		const id = s.list()[0].id;
		s.flush(id);
		const durable = s.durableVersion(id);

		fail = true;
		const r = s.commit(id, { ops: [put('node', node('node-c10001', 60))] }, 'server', 't');
		s.flush(id);
		assert.equal(s.durableVersion(id), durable, 'a write that threw did not make anything durable');
		assert.ok(s.flushFailures() > 0, 'and it is counted as the I/O failure it is');

		fail = false;
		s.flush(id);
		assert.equal(s.durableVersion(id), r.version, 'the retry that landed advanced the watermark');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- I5 across a restart ----

test('I5: undo survives a process restart', () => {
	const dir = tmp();
	try {
		const a = storeWith(dir);
		const before = a.s.get(a.id).all('node').length;
		a.s.commit(a.id, { label: 'create', ops: [put('node', node('node-bb0001', 300))] }, 'server', 't');
		a.s.flush(a.id);
		assert.equal(a.s.get(a.id).all('node').length, before + 1);

		const b = new Store(dir);            // a different process would see exactly this
		b.init();
		assert.equal(b.get(a.id).all('node').length, before + 1, 'the change persisted');
		const r = b.undo(a.id);
		assert.equal(r.ok, true, 'undo is available after a restart');
		assert.equal(b.get(a.id).all('node').length, before, 'and it reverses the change');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- GR9 / I12: the watermark survives ----

test('I12: version is monotonic ACROSS restarts and no seq is re-minted', () => {
	const dir = tmp();
	try {
		const a = storeWith(dir);
		for (const n of ['node-ca0001', 'node-ca0002', 'node-ca0003']) {
			a.s.commit(a.id, { ops: [put('node', node(n, 60))] }, 'server', 't');
		}
		a.s.flush(a.id);
		const pre = a.s.diagrams.get(a.id).log.version;
		assert.ok(pre >= 3);

		const b = new Store(dir); b.init();
		assert.equal(b.diagrams.get(a.id).log.version, pre, 'the watermark came back');
		const r = b.commit(a.id, { ops: [put('node', node('node-ca0004', 120))] }, 'server', 't');
		assert.equal(r.version, pre + 1, 'the next change continues the sequence');

		const seqs = b.diagrams.get(a.id).log.records.map((x) => x.seq);
		assert.equal(new Set(seqs).size, seqs.length, 'no seq collision inside the ring');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- I14: bounding ----

test('I14: the ring bounds, evicts oldest-first, and counts what it dropped', () => {
	const log = new Log(0);
	for (let i = 1; i <= 150; i++) {
		log.version++;
		log.append({ seq: i, from: i - 1, at: i, by: 'client', actor: 'a', label: 'x', ops: [], inverse: [] });
	}
	assert.equal(log.records.length, 100, 'capped at LOG_MAX');
	assert.equal(log.records[0].seq, 51, 'oldest-first');
	assert.equal(log.evicted, 50);
	assert.equal(log.truncated, true);
});

test('I14: the only record is never evicted, however large', () => {
	const log = new Log(0);
	const huge = Array.from({ length: 2000 }, (_, i) => ({ op: 'del', kind: 'node', id: `node-${String(i).padStart(6, '0')}` }));
	log.version++;
	log.append({ seq: 1, from: 0, at: 1, by: 'client', actor: 'a', label: 'delete', ops: huge, inverse: huge });
	assert.ok(log.bytes > 32 * 1024, 'it is over the byte cap on its own');
	assert.equal(log.records.length, 1, 'select-all-delete can never be the one thing you cannot undo');
	assert.equal(log.evicted, 0);
});

test('I14: evicted survives a restart', () => {
	const dir = tmp();
	try {
		const a = storeWith(dir);
		const entry = a.s.diagrams.get(a.id);
		for (let i = 1; i <= 120; i++) {
			entry.log.version++;
			entry.log.append({ seq: entry.log.version, from: entry.log.version - 1, at: i, by: 'client', actor: 'a', label: 'x', ops: [], inverse: [] });
		}
		const dropped = entry.log.evicted;
		assert.ok(dropped > 0);
		a.s.markDirty(a.id); a.s.flush(a.id);

		const b = new Store(dir); b.init();
		assert.equal(b.diagrams.get(a.id).log.evicted, dropped, 'the count of what was lost is itself durable');
		assert.equal(b.diagrams.get(a.id).log.truncated, true);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- I13: corruption tolerance ----

test('I13: a malformed log costs history, never the diagram', () => {
	for (const broken of ['null', '"nonsense"', '{"records":"not an array"}', '{"version":"x","records":[1,2]}']) {
		const dir = tmp();
		try {
			const { s, id } = storeWith(dir);
			s.commit(id, { ops: [put('node', node('node-da0001', 60))] }, 'server', 't');
			s.flush(id);
			const file = path.join(dir, `${id}.json`);
			const { doc } = parse(fs.readFileSync(file, 'utf8'));
			// re-write with a corrupt log block
			fs.writeFileSync(file, JSON.stringify({ ...doc, log: JSON.parse(broken) }, null, '\t') + '\n');

			const b = new Store(dir); b.init();
			assert.equal(b.list().length, 1, `the diagram survived a log of ${broken}`);
			assert.equal(b.get(id).all('node').length, doc.nodes.length, 'and its content is intact');
			assert.equal(b.diagrams.get(id).log.records.length, 0, 'history is empty, not corrupt');
		} finally { fs.rmSync(dir, { recursive: true, force: true }); }
	}
});

// ---- I9: ops and their record publish together ----

test('I9: an observer of every write never sees ops without their record', () => {
	const dir = tmp();
	try {
		const seen = [];
		const s = new Store(dir, { writeDoc: (file, text) => { seen.push(parse(text)); fs.writeFileSync(file, text); } });
		s.init();
		const id = s.list()[0].id;
		s.commit(id, { label: 'create', ops: [put('node', node('node-ea0001', 60))] }, 'server', 't');
		s.flush(id);
		const last = seen[seen.length - 1];
		const hasNode = last.doc.nodes.some((n) => n.id === 'node-ea0001');
		const hasRecord = (last.log?.records || []).some((r) => r.ops.some((o) => o.entity?.id === 'node-ea0001'));
		assert.equal(hasNode, hasRecord, 'the entity and the record describing it publish together');
		assert.equal(hasNode, true);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- B4: a failed flush retries, and is observable ----

test('B4: a failed write retries without a further edit, and is counted', async () => {
	const dir = tmp();
	try {
		let fail = true;
		const s = new Store(dir, { flushMs: 10, writeDoc: (file, text) => {
			if (fail) throw new Error('backend unavailable');
			fs.writeFileSync(file, text);
		} });
		s.init();
		const id = s.list()[0].id;
		s.commit(id, { ops: [put('node', node('node-fa0001', 60))] }, 'server', 't');
		s.flush(id);
		assert.ok(s.flushFailures() > 0, 'the failure is counted, not swallowed');
		assert.equal(s.diagrams.get(id).dirty, true, 'and the entry is still dirty');

		fail = false;
		await new Promise((r) => setTimeout(r, 60));      // no further edit — the retry must fire
		assert.equal(s.diagrams.get(id).dirty, false, 'the rescheduled flush recovered it');
		assert.ok(fs.existsSync(path.join(dir, `${id}.json`)));
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- reversibility: a pre-CS2 reader must still load a CS2 file ----

test('the log key is invisible to a pre-CS2 reader — validateDoc gates no top-level key', async () => {
	const dir = tmp();
	try {
		const { s, id } = storeWith(dir);
		s.commit(id, { ops: [put('node', node('node-ga0001', 60))] }, 'server', 't');
		s.flush(id);
		const raw = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
		assert.ok(raw.log, 'the file carries a log');
		const { validateDoc } = await import('../server/validate.js');
		assert.equal(validateDoc(raw), null, 'a validator that knows nothing of `log` still accepts the file');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
