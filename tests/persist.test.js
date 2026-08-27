// CS2 — the log is durable. Undo survives a process restart, the file round-trips exactly, a
// corrupt log costs history but never the diagram, and a failed write retries and is observable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../server/store.js';
import { openStore, OWNER } from './fixtures/app.mjs';
import { fsFiles } from '../server/files.mjs';
import { Log } from '../server/log.mjs';
import { serialize, parse } from '../server/docfile.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'draw-cs2-'));
// B112: an unpositioned fixture node gets a DISTINCT anchor derived from its id -- one
// anchor holds one occupant, so two fixtures defaulting to (0,0) is now a real violation.
const _at = (id) => (parseInt(id.slice(-4), 16) % 15 + 1) * 60;
// B112: the seeded example occupies row y=0, so fixtures live on a free row instead. One anchor
// holds one occupant, and `node('node-bb0001', 300)` used to land exactly on a seeded node.
const node = (id, x = null) => ({ id, name: id, type: 'host', shape: 'circle', x: x ?? _at(id), y: -480 });
const put = (kind, entity) => ({ op: 'put', kind, entity });

async function storeWith(dir) {
	// H9.17: authorization is on by default now, so a store whose diagrams nobody owns lists
	// nothing. `openStore` adopts, exactly as the composition root does after `init()`.
	const s = await openStore(dir);
	return { s, id: s.list(OWNER)[0].id };
}

// ---- I10: the file round-trips ----

test('I10: parse(serialize(doc, log)) deep-equals the input, including a large record', () => {
	const doc = { meta: { id: 'diagram-aaaaaa', name: 'x' },
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
		const doc = { meta: { id: 'diagram-aaaaaa', name: 'x' },
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

test('B13: a $-named node survives a restart — the corruption escalated to a boot refusal', async () => {
	const dir = tmp();
	try {
		const a = await storeWith(dir);
		a.s.commit(a.id, { label: 'create', ops: [put('node', { ...node('node-bd0001', 300), name: 'a$&b' })] }, 'server', 't', OWNER);
		a.s.flush(a.id);

		const b = new Store(dir);            // a different process would see exactly this
		await assert.doesNotReject(() => b.init(), 'the store refused to boot on a file it corrupted itself');
		b.adopt(OWNER);
		const named = b.get(a.id).all('node').find((n) => n.id === 'node-bd0001');
		assert.equal(named.name, 'a$&b', 'the name came back intact');
		assert.ok(b.diagrams.get(a.id).log.records.length >= 1, 'and the log came back with it');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('I10: the document half stays pretty-printed and carries no log key', async () => {
	const dir = tmp();
	try {
		const { s, id } = await storeWith(dir);
		s.commit(id, { ops: [put('node', node('node-ba0001', 300))] }, 'server', 't', OWNER);
		await s.flush(id);
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
test('B20: a GR9 breach is counted and named as an invariant failure, not a flush failure', async () => {
	const dir = tmp();
	try {
		const { s, id } = await storeWith(dir);
		s.commit(id, { ops: [put('node', node('node-be0001', 60))] }, 'server', 't', OWNER);
		await s.flush(id);

		const log = s.diagrams.get(id).log;
		log.records[log.records.length - 1].seq = log.version + 5;   // a record above its own watermark
		s.commit(id, { ops: [put('node', node('node-be0002', 120))] }, 'server', 't', OWNER);
		await s.flush(id);

		assert.equal(s.flushFailures(), 0, 'a structural breach is NOT an I/O failure and must not be counted as one');
		assert.equal(s.invariantFailures(), 1, 'it is counted as what it is');
		assert.ok(fs.existsSync(path.join(dir, `${id}.json`)), 'and the document is still persisted — the breach is in the log accounting, not the user data');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B20: a breach is re-checked on the next write, not reported once and forgotten', async () => {
	const dir = tmp();
	try {
		const { s, id } = await storeWith(dir);
		s.commit(id, { ops: [put('node', node('node-bf0001', 60))] }, 'server', 't', OWNER);
		await s.flush(id);
		const log = s.diagrams.get(id).log;
		log.records[log.records.length - 1].seq = log.version + 5;

		s.commit(id, { ops: [put('node', node('node-bf0002', 120))] }, 'server', 't', OWNER);
		await s.flush(id);
		s.commit(id, { ops: [put('node', node('node-bf0003', 180))] }, 'server', 't', OWNER);
		await s.flush(id);
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
test('B15: durableVersion names the flushed watermark, not the absence of dirt', async () => {
	const dir = tmp();
	try {
		const s = await openStore(dir, { flushMs: 100000 });  // nothing auto-flushes during the test
		const id = s.list(OWNER)[0].id;

		assert.equal(s.durableVersion(id), s.diagrams.get(id).log.version, 'a freshly-loaded diagram is fully durable');
		const atLoad = s.durableVersion(id);

		s.commit(id, { ops: [put('node', node('node-c00001', 60))] }, 'server', 't', OWNER);
		s.commit(id, { ops: [put('node', node('node-c00002', 120))] }, 'server', 't', OWNER);
		const third = s.commit(id, { ops: [put('node', node('node-c00003', 180))] }, 'server', 't', OWNER);

		assert.equal(s.durableVersion(id), atLoad, 'three commits in one window flushed NOTHING, so nothing new is durable');
		assert.ok(s.durableVersion(id) < third.version - 1, 'the old `version - 1` guess over-reported by two');

		await s.flush(id);
		assert.equal(s.durableVersion(id), third.version, 'after the flush, everything is durable');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B15: a failed write leaves durableVersion behind, and a later success advances it', async () => {
	const dir = tmp();
	try {
		let fail = false;
		// B55 -- the seam is the whole file surface now, so a fault is injected by wrapping one
		// verb of the real backend rather than replacing the only one that existed.
		const real = fsFiles(dir);
		const s = new Store(dir, { flushMs: 100000, files: { ...real, write(name, text) {
			if (fail) throw new Error('backend unavailable');
			real.write(name, text);
		} } });
		await s.init();
		s.adopt(OWNER);
		const id = s.list(OWNER)[0].id;
		await s.flush(id);
		const durable = s.durableVersion(id);

		fail = true;
		const r = s.commit(id, { ops: [put('node', node('node-c10001', 60))] }, 'server', 't', OWNER);
		await s.flush(id);
		assert.equal(s.durableVersion(id), durable, 'a write that threw did not make anything durable');
		assert.ok(s.flushFailures() > 0, 'and it is counted as the I/O failure it is');

		fail = false;
		await s.flush(id);
		assert.equal(s.durableVersion(id), r.version, 'the retry that landed advanced the watermark');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- I5 across a restart ----

test('I5: undo survives a process restart', async () => {
	const dir = tmp();
	try {
		const a = await storeWith(dir);
		const before = a.s.get(a.id).all('node').length;
		a.s.commit(a.id, { label: 'create', ops: [put('node', node('node-bb0001', 300))] }, 'server', 't', OWNER);
		a.s.flush(a.id);
		assert.equal(a.s.get(a.id).all('node').length, before + 1);

		const b = await openStore(dir);      // a different process would see exactly this
		assert.equal(b.get(a.id).all('node').length, before + 1, 'the change persisted');
		const r = b.undo(a.id, null, OWNER);
		assert.equal(r.ok, true, 'undo is available after a restart');
		assert.equal(b.get(a.id).all('node').length, before, 'and it reverses the change');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- GR9 / I12: the watermark survives ----

test('I12: version is monotonic ACROSS restarts and no seq is re-minted', async () => {
	const dir = tmp();
	try {
		const a = await storeWith(dir);
		// distinct anchors: one anchor holds one occupant (B112)
		for (const [k, n] of ['node-ca0001', 'node-ca0002', 'node-ca0003'].entries()) {
			a.s.commit(a.id, { ops: [put('node', node(n, 60 + k * 60))] }, 'server', 't', OWNER);
		}
		a.s.flush(a.id);
		const pre = a.s.diagrams.get(a.id).log.version;
		assert.ok(pre >= 3);

		const b = await openStore(dir);
		assert.equal(b.diagrams.get(a.id).log.version, pre, 'the watermark came back');
		const r = b.commit(a.id, { ops: [put('node', node('node-ca0004', 240))] }, 'server', 't', OWNER);   // 120 is taken by ca0002 (B112)
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

test('I14: evicted survives a restart', async () => {
	const dir = tmp();
	try {
		const a = await storeWith(dir);
		const entry = a.s.diagrams.get(a.id);
		for (let i = 1; i <= 120; i++) {
			entry.log.version++;
			entry.log.append({ seq: entry.log.version, from: entry.log.version - 1, at: i, by: 'client', actor: 'a', label: 'x', ops: [], inverse: [] });
		}
		const dropped = entry.log.evicted;
		assert.ok(dropped > 0);
		a.s.markDirty(a.id); a.s.flush(a.id);

		const b = await openStore(dir);
		assert.equal(b.diagrams.get(a.id).log.evicted, dropped, 'the count of what was lost is itself durable');
		assert.equal(b.diagrams.get(a.id).log.truncated, true);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- I13: corruption tolerance ----

test('I13: a malformed log costs history, never the diagram', async () => {
	for (const broken of ['null', '"nonsense"', '{"records":"not an array"}', '{"version":"x","records":[1,2]}']) {
		const dir = tmp();
		try {
			const { s, id } = await storeWith(dir);
			s.commit(id, { ops: [put('node', node('node-da0001', 60))] }, 'server', 't', OWNER);
			await s.flush(id);
			const file = path.join(dir, `${id}.json`);
			const { doc } = parse(fs.readFileSync(file, 'utf8'));
			// re-write with a corrupt log block
			fs.writeFileSync(file, JSON.stringify({ ...doc, log: JSON.parse(broken) }, null, '\t') + '\n');

			const b = await openStore(dir);
			assert.equal(b.list(OWNER).length, 1, `the diagram survived a log of ${broken}`);
			assert.equal(b.get(id).all('node').length, doc.nodes.length, 'and its content is intact');
			assert.equal(b.diagrams.get(id).log.records.length, 0, 'history is empty, not corrupt');
		} finally { fs.rmSync(dir, { recursive: true, force: true }); }
	}
});

// ---- I9: ops and their record publish together ----

test('I9: an observer of every write never sees ops without their record', async () => {
	const dir = tmp();
	try {
		const seen = [];
		const real = fsFiles(dir);
		const s = await openStore(dir, { files: { ...real, write(name, text) { seen.push(parse(text)); real.write(name, text); } } });
		const id = s.list(OWNER)[0].id;
		s.commit(id, { label: 'create', ops: [put('node', node('node-ea0001', 60))] }, 'server', 't', OWNER);
		await s.flush(id);
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
		const real = fsFiles(dir);
		const s = new Store(dir, { flushMs: 10, files: { ...real, write(name, text) {
			if (fail) throw new Error('backend unavailable');
			real.write(name, text);
		} } });
		await s.init();
		s.adopt(OWNER);
		const id = s.list(OWNER)[0].id;
		s.commit(id, { ops: [put('node', node('node-fa0001', 60))] }, 'server', 't', OWNER);
		await s.flush(id);
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
		const { s, id } = await storeWith(dir);
		s.commit(id, { ops: [put('node', node('node-ga0001', 60))] }, 'server', 't', OWNER);
		await s.flush(id);
		const raw = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
		assert.ok(raw.log, 'the file carries a log');
		const { validateDoc } = await import('../server/validate.js');
		assert.equal(validateDoc(raw), null, 'a validator that knows nothing of `log` still accepts the file');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
B55 -- the seam is real, not nominal.

The point of widening `writeDoc` into `{list, read, write, remove}` is that a backend which is not a
filesystem can be supplied by injection. Passing tests against the filesystem default do not
demonstrate that: they would pass just as well if the store still reached `fs` behind the seam.

So this store runs on a Map. No directory is created, nothing touches disk, and the four verbs take
names because an object store has keys rather than paths -- which is the shape the GCS adapter needs
(DEPLOY.md, H8.2).
*/
test('B55: the store runs on a backend with no filesystem at all', async () => {
	const mem = new Map();
	const files = {
		list: () => [...mem.keys()],
		read: (name) => {
			if (!mem.has(name)) throw new Error(`no such object: ${name}`);
			return mem.get(name);
		},
		write: (name, text) => { mem.set(name, text); },
		remove: (name) => { mem.delete(name); },
	};

	const s = await openStore('/nonexistent/never-created', { flushMs: 10000, files });                                     // seeds, because the backend is empty
	const id = s.list(OWNER)[0].id;
	assert.ok(id, 'a diagram exists after boot');

	s.commit(id, { label: 'create', ops: [put('node', node('node-ea0001', 60))] }, 'server', 't', OWNER);
	await s.flush(id);
	assert.equal(mem.size, 1, 'the flush landed in the Map, not on disk');
	assert.ok(mem.get(`${id}.json`).includes('node-ea0001'), 'and it carries the change');

	// a second store over the SAME backend reads it back - the round trip is the real proof
	const s2 = await openStore('/nonexistent/never-created', { flushMs: 10000, files });
	assert.equal(s2.list(OWNER).length, 1, 'the second store found the document');
	assert.ok(s2.get(id).get('node', 'node-ea0001'), 'and parsed the node out of it');   // get(id) is the model

	await s2.remove(id, OWNER);
	assert.equal(mem.size, 0, 'remove reached the backend too');
	assert.equal(fs.existsSync('/nonexistent/never-created'), false, 'no directory was ever created');
});

/*
B59 -- the seam accepts a backend that cannot answer synchronously.

B55 ran the store on a `Map` and I called that proof the seam was swappable. It was not: a `Map`
answers instantly, and the backend the seam exists for is HTTP, which cannot. The property I checked
was "not filesystem-bound"; the property that mattered was "not synchronous", and those came apart
exactly where GCS lives.

So this backend defers every verb across a real macrotask and, on read, hands back a value that
never existed synchronously. If any caller in the store reads the return value instead of awaiting
it, it sees a Promise where text should be, and the parse dies.
*/
const defer = (v) => new Promise((res) => setTimeout(() => res(v), 1));

test('B59: the store runs on a backend that answers only asynchronously', async () => {
	const mem = new Map();
	const seen = [];
	const files = {
		async list() { return defer([...mem.keys()]); },
		async read(name) {
			if (!mem.has(name)) throw new Error(`no such object: ${name}`);
			return defer(mem.get(name));
		},
		async write(name, text) { seen.push(name); await defer(null); mem.set(name, text); },
		async remove(name) { await defer(null); mem.delete(name); },
	};

	const s = await openStore('/nonexistent/async-only', { flushMs: 10000, files });
	const id = s.list(OWNER)[0].id;

	s.commit(id, { label: 'create', ops: [put('node', node('node-ea0001', 60))] }, 'server', 't', OWNER);
	await s.flush(id);
	assert.equal(mem.size, 1, 'the flush completed against an async backend');
	assert.ok(mem.get(`${id}.json`).includes('node-ea0001'));

	// B15's watermark must reflect a write that actually LANDED, not one merely started. If flush
	// resolved before the backend did, this would be advanced on a promise rather than on durability.
	assert.equal(s.durableVersion(id), s.log(id).version, 'durable only after the write settled');

	// the round trip is the part a synchronous Map could never have exercised
	const s2 = await openStore('/nonexistent/async-only', { flushMs: 10000, files });
	assert.ok(s2.get(id).get('node', 'node-ea0001'), 'a second store read it back over the async seam');

	await s2.remove(id, OWNER);
	assert.equal(mem.size, 0, 'remove settled too');
});

/*
B83 -- a document loaded with a violation is REPORTED, and still opens.

`Store.install` is the one choke point every whole-document path passes: `init` off disk,
`create({doc})` off the wire, and the example seed. All three ran `validateDoc`, none ran
`violations()`, so a document carrying a cross-entity violation was admitted in silence and
mentioned nowhere.

Refusing was the wrong answer and is not what this does. `txn.mjs` deliberately admits an
already-violating document so it can be repaired; refusing at load would brick exactly the files
that most need opening. This is the treatment the GR9 log invariant already gets a few tests
above -- count it, name it, and let `/health` say `corrupt` rather than `degraded`.
*/
test('B83: a document with a cross-entity violation LOADS, and is counted', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-inv-'));
	const doc = {
		meta: { id: 'diagram-ee0001', name: 'broken', version: 0, schema: 1, owner: '', grants: {}, slides: {} },
		nodes: [0, 1].map((i) => ({ id: `node-ee000${i}`, name: `n${i}`, type: 'host', shape: 'circle', x: i * 60, y: 0 })),
		waypoints: [], zones: [], groups: [], selection: [],
		// two straight links on one pair: writable before the rule existed, uncreatable now
		links: [{ id: 'link-ee0002', src: 'node-ee0000', dst: 'node-ee0001' },
			{ id: 'link-ee0003', src: 'node-ee0000', dst: 'node-ee0001' }],
	};
	fs.writeFileSync(path.join(dir, 'diagram-ee0001.json'), JSON.stringify(doc, null, '\t'));

	const s = await openStore(dir, { flushMs: 3_600_000 });
	try {
		assert.ok(s.get('diagram-ee0001'), 'the document OPENED — reporting is not refusing');
		assert.equal(s.invariantFailures(), 1, 'and the violation was counted, like a GR9 breach');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B83: a clean document counts nothing — the check is not always red', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-inv-ok-'));
	const s = await openStore(dir, { flushMs: 3_600_000 });
	try {
		assert.equal(s.invariantFailures(), 0);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
Slides Phase 1 -- a document carrying the retired key is rewritten, once.

Stripping on load made the API correct and left the bucket untouched: loading does not mark a
document dirty, so a diagram nobody edits would keep `meta.slides` on disk forever and Phase 2
would wait on an estate that could not turn over. Verified live before this existed -- the API
served six meta keys while the object still had seven.
*/
test('a stored doc carrying meta.slides is rewritten without it, and only once', async () => {
	const dir = tmp();
	try {
		const id = 'diagram-51de51';
		const doc = { meta: { id, name: 'legacy', version: 0, schema: 1, owner: '', grants: {},
			slides: { url: 'https://docs.google.com/x', presentationId: 'p', pageId: 'g' } },
			nodes: [], waypoints: [], links: [], zones: [], groups: [], selection: [] };
		fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(doc));

		const a = await openStore(dir, { flushMs: 5 });
		assert.equal('slides' in a.get(id).toJSON().meta, false, 'stripped in memory');
		await a.flushAll();

		const onDisk = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
		assert.equal('slides' in onDisk.meta, false, 'and the FILE lost it -- this is the half that was missing');
		assert.equal(onDisk.meta.version, 0, 'without a version bump: removing a retired field is nobody\'s change');

		// a clean document must not be rewritten on every boot
		const b = await openStore(dir, { flushMs: 5 });
		assert.equal(b.diagrams.get(id).dirty, false, 'nothing to shed, so nothing to write');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
Slides Phase 2 -- the schema refuses the retired key, and an old file still opens.

These two must both hold, and they pull against each other. A validator that still knows the name
of a deleted feature is carrying it, so `validateDoc` refuses `meta.slides` outright. But validation
runs on the raw file, so refusing there alone would make every document written before the purge
unloadable -- including a backup taken last week. The loader strips first, which is the only reason
both can be true.
*/
test('Phase 2: the schema refuses meta.slides, and a pre-purge file still loads', async () => {
	const { validateDoc } = await import('../server/validate.js');
	const legacy = { meta: { id: 'diagram-51de52', name: 'legacy', version: 0, schema: 1, owner: '', grants: {},
		slides: { url: 'https://docs.google.com/x', presentationId: 'p', pageId: 'g' } },
		nodes: [], waypoints: [], links: [], zones: [], groups: [], selection: [] };

	assert.match(validateDoc(JSON.parse(JSON.stringify(legacy))), /unknown meta key: slides/,
		'the validator no longer knows the name of the deleted feature');

	const dir = tmp();
	try {
		fs.writeFileSync(path.join(dir, 'diagram-51de52.json'), JSON.stringify(legacy));
		const s = await openStore(dir, { flushMs: 5 });
		assert.ok(s.get('diagram-51de52'), 'and yet the pre-purge file opened -- stripped before validation');
		await s.flushAll();
		const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'diagram-51de52.json'), 'utf8'));
		assert.equal('slides' in onDisk.meta, false, 'rewritten clean, so it validates on its own next time');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
B109 -- the recycle bin fails CLOSED, and reports one row per diagram.

Both of these were wrong in the first version and both showed up the moment it ran against the real
bucket. Every entry read as `(unreadable)`, and the ownership test was written to skip when the
owner could not be determined -- so an unreadable entry was shown to everybody. Since a deleted
document takes its grants with it, "unreadable" is exactly the state where the check matters most.

The duplicates were the second: each delete mints a soft-deleted generation and `remove` issues two,
so a diagram created and deleted twice appeared four times -- which also makes `restore <id>`
ambiguous about which version it would bring back.

Driven through a fake backend, because the property is about what the STORE does with what a
backend hands it, and no real bucket can be made to answer unreadably on demand.
*/
test('B109: an unreadable entry is withheld under authorization, not shown to everyone', async () => {
	const dir = tmp();
	const real = fsFiles(dir);
	const OTHER = 'user:someone-else@example.com';
	const files = {
		...real,
		async recoverable() {
			return [
				{ name: 'diagram-aa0001.json', generation: '1', deletedAt: '2026-01-01T00:00:00Z', purgeAt: '2026-01-08T00:00:00Z' },
				{ name: 'diagram-bb0002.json', generation: '2', deletedAt: '2026-01-02T00:00:00Z', purgeAt: '2026-01-09T00:00:00Z' },
			];
		},
		async read(name, gen) {
			if (name === 'diagram-aa0001.json' && gen) throw new Error('gone');   // unreadable
			if (name === 'diagram-bb0002.json' && gen) {
				return serialize({ meta: { id: 'diagram-bb0002', name: 'theirs', owner: OTHER, schema: 1, version: 0, grants: {} },
					nodes: [], waypoints: [], links: [], zones: [], groups: [], selection: [] }, null);
			}
			return real.read(name);
		},
	};
	const s = new Store(dir, { flushMs: 3_600_000, files, authz: true });
	await s.init();
	try {
		const mine = await s.recoverable(OWNER);
		assert.deepEqual(mine, [], 'neither the unreadable one nor somebody else\'s reaches me');

		const theirs = await s.recoverable(OTHER);
		assert.deepEqual(theirs.map((d) => d.id), ['diagram-bb0002'], 'the owner sees their own');
		assert.equal(theirs[0].name, 'theirs', 'read back from the deleted document itself');

		assert.deepEqual(await s.recoverable(null), [], 'and no principal sees nothing at all');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B109: repeated deletions of one diagram are one row, the newest', async () => {
	const dir = tmp();
	const real = fsFiles(dir);
	const files = {
		...real,
		// `remove` issues two deletes per diagram, so generations accumulate per id
		async recoverable() {
			return [
				{ name: 'diagram-cc0003.json', generation: '1', deletedAt: '2026-01-01T00:00:00Z', purgeAt: '2026-01-08T00:00:00Z' },
				{ name: 'diagram-cc0003.json', generation: '2', deletedAt: '2026-01-03T00:00:00Z', purgeAt: '2026-01-10T00:00:00Z' },
				{ name: 'diagram-cc0003.json', generation: '3', deletedAt: '2026-01-02T00:00:00Z', purgeAt: '2026-01-09T00:00:00Z' },
			];
		},
		async read() { throw new Error('unreadable'); },
	};
	const s = new Store(dir, { flushMs: 3_600_000, files, authz: false });
	await s.init();
	try {
		const found = await s.recoverable(null);
		assert.equal(found.length, 1, 'one row per diagram, however many generations exist');
		assert.equal(found[0].generation, '2', 'and it is the newest -- restore names an id, so it must be unambiguous');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('B109: a filesystem answers null, which is not an empty recycle bin', async () => {
	const dir = tmp();
	const s = await openStore(dir);
	try {
		assert.equal(await s.recoverable(OWNER), null,
			'null says there is no window; [] would claim there is one and it is empty');
		assert.match(await s.restore('diagram-aaaaaa', OWNER), /no delete window/);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
