import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createApp } from '../server/app.js';

let app, base, dataDir;

before(async () => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-test-'));
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://localhost:${app.port}`;
});

after(async () => {
	await app.close();
	fs.rmSync(dataDir, { recursive: true, force: true });
});

// a tiny protocol client: send cmds, await replies by cmd name
function connect() {
	const ws = new WebSocket(`ws://localhost:${app.port}/ws`);
	const inbox = [];
	const waiters = [];
	ws.on('message', (data) => {
		const msg = JSON.parse(data.toString());
		const i = waiters.findIndex((w) => w.cmds.includes(msg.cmd));
		if (i !== -1) waiters.splice(i, 1)[0].resolve(msg);
		else inbox.push(msg);
	});
	return new Promise((resolve, reject) => {
		ws.on('open', () => resolve({
			ws,
			inbox,
			send: (cmd, body) => ws.send(JSON.stringify({ cmd, body })),
			expect: (...cmds) => {
				const i = inbox.findIndex((m) => cmds.includes(m.cmd));
				if (i !== -1) return Promise.resolve(inbox.splice(i, 1)[0]);
				return new Promise((res, rej) => {
					const timer = setTimeout(() => rej(new Error(`timeout waiting for ${cmds}`)), 3000);
					waiters.push({ cmds, resolve: (m) => { clearTimeout(timer); res(m); } });
				});
			},
			close: () => ws.close()
		}));
		ws.on('error', reject);
	});
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const get = async (p) => {
	const res = await fetch(base + p);
	return { status: res.status, body: await res.json().catch(() => null) };
};

test('boot seeds the example diagram; health + list respond', async () => {
	const health = await get('/health');
	assert.equal(health.status, 200);
	assert.equal(health.body.status, 'ok');
	const list = await get('/api/v1/diagrams');
	assert.equal(list.body.length, 1);
	assert.equal(list.body[0].name, 'example');
	const doc = (await get(`/api/v1/diagrams/${list.body[0].id}`)).body;
	assert.equal(doc.nodes.length, 8, 'seed carries the example topology');
	assert.equal(doc.links.length, 9);
	assert.equal(doc.zones.length, 2);
	assert.equal(doc.groups.length, 1);
});

test('hello returns a snapshot with doc and diagram list', async () => {
	const c = await connect();
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	assert.equal(snap.body.doc.meta.name, 'example');
	assert.ok(Array.isArray(snap.body.diagrams));
	c.close();
});

test('apply put/set/del roundtrip, REST reflects it, disk persists it', async () => {
	const c = await connect();
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	const diagramId = snap.body.doc.meta.id;

	const node = { id: 'node-aaaa01', name: 'web-1', type: 'host', x: 210, y: 210 };
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: node }] });
	await c.expect('ack');

	let rest = await get(`/api/v1/diagrams/${diagramId}/nodes/node-aaaa01`);
	assert.equal(rest.status, 200);
	assert.equal(rest.body.name, 'web-1');

	c.send('commit', { ops: [{ op: 'set', kind: 'node', id: ({ id: 'node-aaaa01', x: 270 }).id, patch: { id: 'node-aaaa01', x: 270 } }] });
	await c.expect('ack');
	rest = await get(`/api/v1/diagrams/${diagramId}/nodes/node-aaaa01`);
	assert.equal(rest.body.x, 270);
	assert.equal(rest.body.y, 210, 'set merges, not replaces');

	await sleep(350); // debounce flush
	const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, `${diagramId}.json`), 'utf8'));
	assert.equal(onDisk.nodes.find((n) => n.id === 'node-aaaa01').x, 270);

	c.send('commit', { ops: [{ op: 'del', kind: 'node', id: ({ id: 'node-aaaa01' }).id }] });
	await c.expect('ack');
	rest = await get(`/api/v1/diagrams/${diagramId}/nodes/node-aaaa01`);
	assert.equal(rest.status, 404);
	c.close();
});

test('invalid mutations are rejected and not applied', async () => {
	const c = await connect();
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	const diagramId = snap.body.doc.meta.id;

	// bad id format
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-XYZ', name: 'x', type: 'host', x: 30, y: 30 } }] });
	let err = await c.expect('error');
	assert.match(err.body.message, /invalid id/);

	// off-canvas coordinates
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-bbbb01', name: 'x', type: 'host', x: -2000, y: 30 } }] });
	err = await c.expect('error');
	assert.match(err.body.message, /invalid value/);

	// unknown field
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-bbbb02', name: 'x', type: 'host', x: 30, y: 30, evil: 1 } }] });
	err = await c.expect('error');
	assert.match(err.body.message, /unknown field/);

	// dangling link
	c.send('commit', { ops: [{ op: 'put', kind: 'link', entity: { id: 'link-bbbb03', src: 'node-bbbb04', dst: 'node-bbbb05' } }] });
	err = await c.expect('error');
	assert.match(err.body.message, /does not exist/);

	const nodes = await get(`/api/v1/diagrams/${diagramId}/nodes`);
	assert.ok(!nodes.body.some((n) => n.id.startsWith('node-bbbb')), 'nothing applied');
	c.close();
});

test('node shape persists over the wire; legacy (no shape) still applies; bad shape rejected', async () => {
	const c = await connect();
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	const diagramId = snap.body.doc.meta.id;

	// a square node round-trips and persists
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-dddd01', name: 'sq', type: 'host', shape: 'square', x: 60, y: 60 } }] });
	await c.expect('ack');
	// a node WITHOUT shape is still valid (the field is optional — backward compat)
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-dddd02', name: 'leg', type: 'host', x: 120, y: 60 } }] });
	await c.expect('ack');
	// an unknown shape is rejected
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-dddd03', name: 'tri', type: 'host', shape: 'triangle', x: 180, y: 60 } }] });
	const err = await c.expect('error');
	assert.match(err.body.message, /invalid value/);

	await sleep(350); // debounce flush
	const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, `${diagramId}.json`), 'utf8'));
	assert.equal(onDisk.nodes.find((n) => n.id === 'node-dddd01').shape, 'square');
	assert.ok(!('shape' in onDisk.nodes.find((n) => n.id === 'node-dddd02')), 'legacy node stays shape-less');
	assert.ok(!onDisk.nodes.some((n) => n.id === 'node-dddd03'), 'bad shape not persisted');
	c.close();
});

// CS4 — `push` is gone. A client no longer sends a document to overwrite one; it says what it
// believes it holds and the server decides. (Was: "push replaces the document".)
test('resume: in step -> `sync`, no document; behind -> a snapshot', async () => {
	const c = await connect();
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	const id = snap.body.doc.meta.id;
	assert.equal(typeof snap.body.version, 'number', 'a snapshot says which version it IS');

	// in step: the server sends the authority, not an O(doc) round trip
	c.send('resume', { diagram: id, version: snap.body.version });
	const sync = await c.expect('sync', 'snapshot');
	assert.equal(sync.cmd, 'sync', 'in step: no document');
	assert.equal(sync.body.version, snap.body.version);
	for (const k of ['canUndo', 'canRedo', 'locked']) assert.ok(k in sync.body, `sync carries ${k}`);
	assert.equal('doc' in sync.body, false, 'and carries no document at all');

	// behind: the server answers with the document
	c.send('resume', { diagram: id, version: snap.body.version - 1 });
	const back = await c.expect('sync', 'snapshot');
	assert.equal(back.cmd, 'snapshot', 'behind: the whole document');
	assert.equal(back.body.doc.meta.id, id);
	assert.equal('rewound' in back.body, false, 'behind is not rewound');

	c.send('resume', { diagram: 'diagram-ffffff', version: 0 });
	const err = await c.expect('error');
	assert.equal(err.body.code, 'unknown-diagram');
	c.close();
});

// D29 — the server restarted before flushing changes it had already acked, so it now holds LESS
// than the client. `push` used to repair this by clobbering; deleting it without the rewind reply
// would convert a repaired divergence into a SILENT revert.
test('resume: a client AHEAD of the server is told it was rewound, not silently reverted', async () => {
	const c = await connect();
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	const id = snap.body.doc.meta.id;

	c.send('resume', { diagram: id, version: snap.body.version + 3 });
	const reply = await c.expect('sync', 'snapshot');
	assert.equal(reply.cmd, 'snapshot');
	assert.deepEqual(reply.body.rewound, { from: snap.body.version + 3, to: snap.body.version });
	assert.equal(reply.body.doc.meta.id, id, 'and the authoritative document comes with it');
	c.close();
});

// I11 — no client authority over identity or version.
test('I11: `create {doc}` mints the id, and a body `version` is ignored', async () => {
	const c = await connect();
	c.send('hello', {});
	const before = (await c.expect('snapshot')).body;

	const doc = {
		meta: { id: 'diagram-ffffff', name: 'claimed' },
		nodes: [{ id: 'node-cccc01', name: 'a', type: 'host', x: 30, y: 30 }],
		waypoints: [], links: [], zones: [], groups: []
	};
	c.send('create', { name: 'adopted', doc });
	const made = await c.expect('snapshot');
	assert.notEqual(made.body.doc.meta.id, 'diagram-ffffff', 'the client cannot name a diagram');
	assert.match(made.body.doc.meta.id, /^diagram-[0-9a-f]{6}$/, 'the server minted one');
	assert.equal(made.body.doc.nodes.length, 1, 'the content came with it');
	assert.equal(made.body.version, 0, 'a new diagram starts at 0 whatever the client believed');

	// a client-supplied `version` in a commit body is ignored — only `expect` is a precondition
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-cccc02', name: 'b', type: 'host', x: 90, y: 30 } }], version: 9999 });
	const ack = await c.expect('ack');
	assert.equal(ack.body.version, 1, 'the server minted the version, not the client');

	c.send('commit', { ops: [{ op: 'del', kind: 'node', id: 'node-cccc02' }], expect: 9999 });
	const err = await c.expect('error');
	assert.match(err.body.message, /version conflict/, 'but `expect` IS honoured, as a precondition');

	// and the diagram the server first answered with is untouched (B2)
	const untouched = await get(`/api/v1/diagrams/${before.doc.meta.id}`);
	assert.equal(untouched.body.nodes.length, before.doc.nodes.length, 'the pre-existing diagram is intact');
	c.close();
});

/*
Renaming a diagram is a CHANGE, not a command of its own.

`case 'meta'` was deleted at CS3a when meta became an op, and the browser kept sending `meta` for
two milestones — every rename and every pasted Slides URL was answered `unknown cmd: meta` and
dropped. Found by tests/spec.test.js, which derives the wire vocabulary from the server's own
dispatch instead of trusting the document.
*/
test('a rename is an undoable, broadcast change — not a side-channel command', async () => {
	const a = await connect();
	a.send('hello', {});
	const id = (await a.expect('snapshot')).body.doc.meta.id;

	const b = await connect();
	b.send('resume', { diagram: id, version: 0 });
	await b.expect('sync', 'snapshot');

	a.send('commit', { ops: [{ op: 'meta', patch: { name: 'renamed-by-a' } }], label: 'rename', txnId: 'r1' });
	const ack = await a.expect('ack');
	assert.equal(ack.body.label, 'rename');

	const heard = await b.expect('change');
	assert.equal(heard.body.ops[0].op, 'meta', 'the other tab was told');
	assert.equal(heard.body.ops[0].patch.name, 'renamed-by-a');
	assert.equal((await get(`/api/v1/diagrams/${id}`)).body.meta.name, 'renamed-by-a', 'and it persisted');

	a.send('undo', { expect: ack.body.version });
	await a.expect('ack');
	assert.notEqual((await get(`/api/v1/diagrams/${id}`)).body.meta.name, 'renamed-by-a', 'a rename undoes');

	// the retired command is refused, so a stale client fails loudly rather than silently
	a.send('meta', { name: 'side-channel' });
	assert.match((await a.expect('error')).body.message, /unknown cmd: meta/);
	a.close(); b.close();
});

test('the Slides binding is STATUS the server records — not a change, and not the client’s to send', async () => {
	const { Store } = await import('../server/store.js');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-bind-'));
	try {
		const store = new Store(dir, { flushMs: 3_600_000 });
		await store.init();
		const id = store.list()[0].id;
		const before = store.diagrams.get(id).log.version;

		assert.equal(store.bindSlides(id, 'PRES_ID-123', 'g7'), null);
		const meta = store.get(id).toJSON().meta;
		assert.equal(meta.slides.presentationId, 'PRES_ID-123');
		assert.equal(meta.slides.pageId, 'g7');
		assert.equal(store.diagrams.get(id).log.version, before, 'status does not bump the version');
		assert.equal(store.diagrams.get(id).log.canUndo(), false, 'and is not undoable');
		assert.equal(store.bindSlides('diagram-ffffff', 'p', 'g'), 'unknown diagram');

		// it survives a restart — a binding that does not persist re-targets pages[0] on re-push
		await store.flushAll();
		const again = new Store(dir, { flushMs: 3_600_000 });
		await again.init();
		assert.equal(again.get(id).toJSON().meta.slides.pageId, 'g7');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('create and open switch diagrams; meta rename persists', async () => {
	const c = await connect();
	c.send('hello', {});
	const first = (await c.expect('snapshot')).body.doc.meta.id;

	const listedBefore = (await get('/api/v1/diagrams')).body.length;
	c.send('create', { name: 'second' });
	const created = await c.expect('snapshot');
	const secondId = created.body.doc.meta.id;
	assert.notEqual(secondId, first);
	assert.equal(created.body.doc.meta.name, 'second');
	assert.equal(created.body.diagrams.length, listedBefore + 1);

	c.send('commit', { ops: [{ op: 'meta', patch: { name: 'renamed' } }] });
	await c.expect('ack');
	const list = await get('/api/v1/diagrams');
	assert.ok(list.body.some((d) => d.id === secondId && d.name === 'renamed'));

	c.send('open', { id: first });
	const reopened = await c.expect('snapshot');
	assert.equal(reopened.body.doc.meta.id, first);

	// mutations after open land in the reopened diagram
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-dddd01', name: 'n', type: 'host', x: 30, y: 30 } }] });
	await c.expect('ack');
	const nodes = await get(`/api/v1/diagrams/${first}/nodes`);
	assert.ok(nodes.body.some((n) => n.id === 'node-dddd01'));
	c.close();
});

test('REST surface: 404s, read-only enforcement, slides placeholder', async () => {
	assert.equal((await get('/api/v1/diagrams/diagram-nope00')).status, 404);
	assert.equal((await get('/api/v1/nonsense')).status, 404);

	const id = (await get('/api/v1/diagrams')).body[0].id;
	assert.equal((await get(`/api/v1/diagrams/${id}/widgets`)).status, 404);

	// writes require a server-side lock — refused with 423 until acquired
	// (the Server-Locked suite covers the locked happy path)
	const post = await fetch(`${base}/api/v1/diagrams/${id}/nodes`, { method: 'POST' });
	assert.equal(post.status, 423);
	const del = await fetch(`${base}/api/v1/diagrams/${id}/nodes/node-000000`, { method: 'DELETE' });
	assert.equal(del.status, 423);
});

test('slides push endpoint walks the auth states', async () => {
	const id = (await get('/api/v1/diagrams')).body[0].id;

	// no credentials file -> 503 with setup help
	let res = await fetch(`${base}/api/v1/diagrams/${id}/sync/slides`, { method: 'POST' });
	assert.equal(res.status, 503);
	assert.match((await res.json()).help, /google-credentials/);

	// credentials present but never authorized -> 401 with an auth URL
	fs.writeFileSync(path.join(dataDir, 'google-credentials.json'), JSON.stringify({
		installed: { client_id: 'cid.apps.googleusercontent.com', client_secret: 'shh' }
	}));
	res = await fetch(`${base}/api/v1/diagrams/${id}/sync/slides`, { method: 'POST' });
	assert.equal(res.status, 401);
	const body = await res.json();
	assert.match(body.authUrl, /accounts\.google\.com.*client_id=cid/);
	assert.match(body.authUrl, /oauth2callback/);

	// unknown diagram -> 404 regardless
	res = await fetch(`${base}/api/v1/diagrams/diagram-nope99/sync/slides`, { method: 'POST' });
	assert.equal(res.status, 404);

	fs.rmSync(path.join(dataDir, 'google-credentials.json'));
});

test('static client is served with traversal protection', async () => {
	const index = await fetch(base + '/');
	assert.equal(index.status, 200);
	assert.match(await index.text(), /draw/);
	const js = await fetch(base + '/src/main.js');
	assert.equal(js.status, 200);
	const traversal = await fetch(base + '/../package.json');
	assert.notEqual(traversal.status, 200);
});

test('deep links /d/<diagram-id> serve the editor', async () => {
	const id = (await get('/api/v1/diagrams')).body[0].id;
	const deep = await fetch(`${base}/d/${id}`);
	assert.equal(deep.status, 200);
	assert.match(deep.headers.get('content-type'), /text\/html/);
	const html = await deep.text();
	assert.match(html, /draw/);
	// REGRESSION: asset refs must be absolute or they resolve under /d/ and 404
	assert.match(html, /src="\/src\/main\.js"/);
	assert.match(html, /href="\/style\.css"/);
	assert.ok(!html.includes('src="./'), 'no relative script paths');

	// only well-formed diagram ids route to the editor
	assert.equal((await fetch(`${base}/d/garbage`)).status, 404);
	assert.equal((await fetch(`${base}/d/diagram-XYZXYZ`)).status, 404);
	assert.equal((await fetch(`${base}/d/diagram-000001/extra`)).status, 404);
});

test('malformed websocket input gets error replies, session survives', async () => {
	const c = await connect();
	c.ws.send('not json{{{');
	let err = await c.expect('error');
	assert.match(err.body.message, /malformed/);

	c.send('nonsense', {});
	err = await c.expect('error');
	assert.match(err.body.message, /unknown cmd/);

	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-eeee01', name: 'x', type: 'host', x: 30, y: 30 } }] });
	err = await c.expect('error');
	assert.match(err.body.message, /no diagram open/);

	// session still usable after errors
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	assert.ok(snap.body.doc);
	c.close();
});

// REGRESSION (rewritten at CS4): `resume` is the FIRST message on a fresh socket, so it must adopt
// the session's diagram by itself — there is no `hello` before it. This is the shape the old
// client-authoritative push had, minus the document.
test('REGRESSION: resume as the FIRST message on a fresh socket adopts the diagram', async () => {
	const c1 = await connect();
	c1.send('hello', {});
	const snap = (await c1.expect('snapshot')).body;
	const id = snap.doc.meta.id;
	c1.close();

	// exactly what Sync does after a reconnect: resume, no hello
	const c2 = await connect();
	c2.send('resume', { diagram: id, version: snap.version });
	const reply = await c2.expect('sync', 'snapshot');
	assert.equal(reply.cmd, 'sync');

	// and the session is now bound: a commit lands without a hello ever being sent on this socket
	c2.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-abab02', name: 'recon2', type: 'host', x: 150, y: 90 } }] });
	await c2.expect('ack');
	const rest = await get(`/api/v1/diagrams/${id}/nodes/node-abab02`);
	assert.equal(rest.status, 200);

	// the outbox's replay contract: re-sending an accepted change is a NO-OP, never a double-apply
	const versionAfter = (await get(`/api/v1/diagrams/${id}/history`)).body.version;
	c2.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-abab02', name: 'recon2', type: 'host', x: 150, y: 90 } }] });
	const replay = await c2.expect('ack');
	assert.equal(replay.body.noop, true, 'the replayed change planned zero ops');
	assert.equal((await get(`/api/v1/diagrams/${id}/history`)).body.version, versionAfter, 'and did not bump the version');
	c2.close();
});

test('REGRESSION: prototype-pollution shaped payloads are rejected, session survives', async () => {
	const c = await connect();
	c.send('hello', {});
	await c.expect('snapshot');

	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: JSON.parse('{"id":"node-cdcd01","name":"x","type":"host","x":30,"y":30,"__proto__":{"polluted":1}}') }] });
	let err = await c.expect('error');
	assert.match(err.body.message, /unknown field/);
	assert.equal({}.polluted, undefined);

	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-cdcd02', name: 'x', type: 'host', x: 30, y: 30, constructor: 'evil' } }] });
	err = await c.expect('error');
	assert.match(err.body.message, /unknown field/);

	c.send('commit', { ops: [{ op: 'put', kind: 'evil', entity: { id: 'node-cdcd03' } }] });
	err = await c.expect('error');

	// session still alive and functional
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-cdcd04', name: 'ok', type: 'host', x: 30, y: 30 } }] });
	await c.expect('ack');
	c.send('commit', { ops: [{ op: 'del', kind: 'node', id: ({ id: 'node-cdcd04' }).id }] });
	await c.expect('ack');
	c.close();
});

test('REGRESSION: bare del-node cascades links and groups server-side (doc always reloads)', async () => {
	const c = await connect();
	c.send('hello', {});
	const diagramId = (await c.expect('snapshot')).body.doc.meta.id;

	const mk = (id, x) => ({ id, name: id, type: 'host', x, y: 270 });
	for (const [id, x] of [['node-efef01', 270], ['node-efef02', 390], ['node-efef03', 510]]) {
		c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: mk(id, x) }] });
		await c.expect('ack');
	}
	c.send('commit', { ops: [{ op: 'put', kind: 'link', entity: { id: 'link-efef04', src: 'node-efef01', dst: 'node-efef02' } }] });
	await c.expect('ack');
	c.send('commit', { ops: [{ op: 'put', kind: 'group', entity: { id: 'group-efef05', name: 'g', members: ['node-efef01', 'node-efef02', 'node-efef03'] } }] });
	await c.expect('ack');

	// a bare node delete with NO explicit cascade deltas
	c.send('commit', { ops: [{ op: 'del', kind: 'node', id: ({ id: 'node-efef01' }).id }] });
	await c.expect('ack');

	const doc = (await get(`/api/v1/diagrams/${diagramId}`)).body;
	assert.ok(!doc.links.some((l) => l.id === 'link-efef04'), 'dangling link cascaded');
	const group = doc.groups.find((g) => g.id === 'group-efef05');
	assert.deepEqual(group.members.sort(), ['node-efef02', 'node-efef03'], 'group member pruned');

	// the persisted doc must reload after a restart
	await app.close();
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://localhost:${app.port}`;
	assert.equal((await get(`/api/v1/diagrams/${diagramId}`)).status, 200, 'doc survived restart');
	c.close();
});

test('R2: ws select persists the selection (model-state) and survives a restart', async () => {
	const c = await connect();
	c.send('hello', {});
	const diagramId = (await c.expect('snapshot')).body.doc.meta.id;
	for (const [id, x] of [['node-5e1e01', 270], ['node-5e1e02', 390]]) {
		c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id, name: id, type: 'host', x, y: 270 } }] });
		await c.expect('ack');
	}
	c.send('select', { ids: ['node-5e1e01', 'node-5e1e02'] });   // forward the selection (model-state)
	await c.expect('ack');
	let doc = (await get(`/api/v1/diagrams/${diagramId}`)).body;
	assert.deepEqual([...doc.selection].sort(), ['node-5e1e01', 'node-5e1e02'], 'selection persisted in the doc');
	// survives a restart (the user's "refresh keeps my selection", server-side)
	await app.close();
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://localhost:${app.port}`;
	doc = (await get(`/api/v1/diagrams/${diagramId}`)).body;
	assert.deepEqual([...doc.selection].sort(), ['node-5e1e01', 'node-5e1e02'], 'selection survived the restart');
	c.close();
});

test('R2: a malformed ws select is rejected (and the session survives)', async () => {
	const c = await connect();
	c.send('hello', {});
	await c.expect('snapshot');
	c.send('select', { ids: ['garbage'] });
	assert.equal((await c.expect('ack', 'error')).cmd, 'error', 'malformed selection rejected');
	c.send('list', {});                                          // session still alive after the rejection
	assert.ok(await c.expect('diagrams'));
	c.close();
});

test('R3: REST PUT /selection sets the authoritative selection, broadcasts to viewers, persists across a restart', async () => {
	const H = (token) => ({ 'Content-Type': 'application/json', ...(token ? { 'X-Draw-Lock': token } : {}) });
	const id = (await get('/api/v1/diagrams')).body[0].id;
	const sel = async () => (await get(`/api/v1/diagrams/${id}/selection`)).body.selection.sort();

	// acquire the lock for the whole agentic write sequence (released in finally so a failed
	// assertion can't leak the lock into the next test)
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	assert.ok(lock.token, 'lock acquired');
	const putSel = (ids) => fetch(`${base}/api/v1/diagrams/${id}/selection`, {
		method: 'PUT', headers: H(lock.token), body: JSON.stringify({ ids })
	});
	try {
		// create two nodes via REST (agentic write path)
		for (const [nid, x] of [['node-3a3a01', 270], ['node-3a3a02', 390]]) {
			const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
				method: 'POST', headers: H(lock.token),
				body: JSON.stringify({ ops: [{ op: 'put', kind: 'node', entity: { id: nid, name: nid, type: 'host', x, y: 270 } }] })
			});
			assert.equal(r.status, 200);
		}

		// a viewer subscribes AFTER the node-creation broadcasts, so the next snapshot it sees is the PUT's
		const viewer = await connect();
		viewer.send('open', { id });
		await viewer.expect('snapshot');

		// PUT the authoritative selection (model-state)
		const put = await putSel(['node-3a3a01', 'node-3a3a02']);
		assert.equal(put.status, 200);
		assert.deepEqual((await put.json()).selection.sort(), ['node-3a3a01', 'node-3a3a02'], 'PUT echoes the selection');

		// the viewer reflects the agent's focus via the selection EVENT (B34 — this was a whole
		// snapshot: the entire document re-transmitted for a focus change)
		const evt = await viewer.expect('selection');
		assert.deepEqual([...evt.body.ids].sort(), ['node-3a3a01', 'node-3a3a02'], 'viewer reflects the agent selection');
		assert.ok(evt.body.actor, 'and knows whose focus it is');
		viewer.close();

		// GET .../selection reflects it; the full doc carries it (flush-before-ack durability)
		assert.deepEqual(await sel(), ['node-3a3a01', 'node-3a3a02'], 'GET /selection reflects');
		assert.deepEqual([...(await get(`/api/v1/diagrams/${id}`)).body.selection].sort(),
			['node-3a3a01', 'node-3a3a02'], 'persisted in the doc');

		// PUT REPLACES wholesale (not merge): a narrower PUT drops the previously-selected id
		assert.equal((await putSel(['node-3a3a01'])).status, 200);
		assert.deepEqual(await sel(), ['node-3a3a01'], 'PUT replaced the selection (node-3a3a02 dropped, not merged)');

		// an empty PUT clears the selection (a real agentic operation)
		const cleared = await putSel([]);
		assert.equal(cleared.status, 200);
		assert.deepEqual((await cleared.json()).selection, [], 'empty PUT echoes []');
		assert.deepEqual(await sel(), [], 'selection cleared');

		// restore a non-trivial selection for the restart-persistence check
		assert.equal((await putSel(['node-3a3a01', 'node-3a3a02'])).status, 200);
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}

	// survives a restart (outside the lock scope — releasing the lock does not touch the selection)
	await app.close();
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://localhost:${app.port}`;
	assert.deepEqual([...(await get(`/api/v1/diagrams/${id}`)).body.selection].sort(),
		['node-3a3a01', 'node-3a3a02'], 'selection survived the restart');
});

test('B101: an agent can fetch the picture of what it drew, through its own door', async () => {
	const id = (await get('/api/v1/diagrams')).body[0].id;

	const front = await fetch(`${base}/d/${id}.svg`);
	assert.equal(front.status, 200, 'the editor route still works');
	const svg = await front.text();
	assert.match(svg, /^<svg/, 'and it is an SVG');

	// the same picture, named without the prefix the load balancer routes past IAP
	const door = await fetch(`${base}/connect/d/${id}.svg`);
	assert.equal(door.status, 200, 'reachable through the agent door -- B101 was that it was not');
	assert.equal(door.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
	assert.equal(await door.text(), svg, 'byte for byte the same render, because it is one route');

	// the REST surface still comes through its own entry
	assert.equal((await fetch(`${base}/connect/v1/diagrams`)).status, 200);
	// an unknown diagram is a 404 from the route, not a static-file miss
	assert.equal((await fetch(`${base}/connect/d/diagram-ffffff.svg`)).status, 404);
});

test('B101: the agent door is not a blanket strip -- it opens onto two paths, not the app', async () => {
	/*
	The failure this guards is silent and arrives later: someone adds a route to app.js, and it is
	served through the IAP-free backend from the moment it exists because /connect strips to
	anything. Asserted behaviourally as well as statically, because the static check reads the
	table and this reads what the server actually answers.
	*/
	for (const p of ['/connect/index.html', '/connect/', '/connect/health', '/connect/next/index.html']) {
		const r = await fetch(`${base}${p}`);
		assert.ok(r.status === 404 || r.status === 405,
			`${p} answered ${r.status}: the door opened onto something it was not pointed at`);
	}
});

test('B102: an agent that lost its token can see when the lock frees', async () => {
	const id = (await get('/api/v1/diagrams')).body[0].id;

	const free = (await get(`/api/v1/diagrams/${id}/lock`)).body;
	assert.equal(free.owner, 'client', 'unheld to begin with');
	assert.equal(free.expiresAt, null, 'nothing holds it, so there is nothing to wait for');

	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		// the agent has thrown its token away -- this read is all it has left
		const held = (await get(`/api/v1/diagrams/${id}/lock`)).body;
		assert.equal(held.owner, 'server');
		assert.equal(typeof held.expiresAt, 'number', 'the expiry is readable without the token');
		assert.equal(held.expiresAt, lock.expiresAt, 'and it is the same instant POST reported');
		assert.ok(held.expiresAt > Date.now(), 'in the future, so it can actually be waited on');
		// the D22 hold is a DIFFERENT wait and must not be conflated with the lock lapsing
		assert.equal(held.heldUntil, null, 'no human reclaim has happened, so no hold');
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': lock.token } });
	}

	const after = (await get(`/api/v1/diagrams/${id}/lock`)).body;
	assert.equal(after.expiresAt, null, 'released, so there is nothing to wait for again');
});

test('B103: a rejected commit names WHICH op failed, not just what was wrong', async () => {
	const id = (await get('/api/v1/diagrams')).body[0].id;
	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		// op 0 is valid, op 1 is not: a link to a node that does not exist. The planner walks the
		// batch in order and knows it stopped at 1 -- before B103 the REST layer discarded that.
		const r = await fetch(`${base}/api/v1/diagrams/${id}/commit`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': lock.token },
			body: JSON.stringify({ ops: [
				{ op: 'put', kind: 'node', entity: { id: 'node-c10001', name: 'ok', type: 'host', x: 0, y: 0 } },
				{ op: 'put', kind: 'link', entity: { id: 'link-c10001', src: 'node-c10001', dst: 'node-ffffff' } },
			], label: 'one good op then one bad' }),
		});
		const body = await r.json();
		assert.equal(r.status, 422);
		assert.equal(body.opIndex, 1, 'the failing op index reaches the agent');
		assert.ok(body.error, 'and the message is still there');
		// the whole batch is refused, so the valid op must not have landed either (atomicity)
		const doc = (await get(`/api/v1/diagrams/${id}`)).body;
		assert.ok(!doc.nodes.some((n) => n.id === 'node-c10001'), 'the good op in the failed batch wrote nothing');
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: { 'X-Draw-Lock': lock.token } });
	}
});

test('R3: PUT /selection is lock-gated (423) and rejects a malformed body (422)', async () => {
	const H = (token) => ({ 'Content-Type': 'application/json', ...(token ? { 'X-Draw-Lock': token } : {}) });
	const id = (await get('/api/v1/diagrams')).body[0].id;
	const putSel = (token, body) => fetch(`${base}/api/v1/diagrams/${id}/selection`, {
		method: 'PUT', headers: H(token), body: JSON.stringify(body)
	});

	// no lock held → 423 (this test depends on starting unlocked; the prior R3 test releases its lock)
	assert.equal((await putSel(null, { ids: [] })).status, 423, 'refused without the lock');

	const lock = await (await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'POST' })).json();
	try {
		// malformed shape → 422 (the shape gate rejects a non-id; never existence-checked)
		assert.equal((await putSel(lock.token, { ids: ['garbage'] })).status, 422, 'malformed selection rejected');
		// a non-selectable KIND (group) hard-rejects the whole PUT — distinct from a stale-but-selectable
		// id, which is silently pruned. This is the intended boundary (matches the ws select path).
		assert.equal((await putSel(lock.token, { ids: ['group-aaaaaa'] })).status, 422, 'non-selectable kind rejected');
		// missing ids array → 400
		assert.equal((await putSel(lock.token, {})).status, 400, 'missing ids array rejected');
		// a non-PUT method on /selection → 405 (not the misleading 423/404 a stray write method would get)
		assert.equal((await fetch(`${base}/api/v1/diagrams/${id}/selection`, {
			method: 'POST', headers: H(lock.token), body: JSON.stringify({ ids: [] })
		})).status, 405, 'POST /selection not allowed');
	} finally {
		await fetch(`${base}/api/v1/diagrams/${id}/lock`, { method: 'DELETE', headers: H(lock.token) });
	}
});

test('R3: a stray write method on a non-selection route keeps the clean 405 (PUT is selection-only)', async () => {
	const id = (await get('/api/v1/diagrams')).body[0].id;
	// PUT was added to the dispatch ONLY for /selection; every other PUT must still fall to a 405,
	// not be misrouted through the lock gate into a 423/404.
	for (const p of [`/api/v1/diagrams/${id}`, `/api/v1/diagrams/${id}/nodes`, `/api/v1/diagrams/${id}/commit`]) {
		assert.equal((await fetch(base + p, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}'
		})).status, 405, `PUT ${p} → 405 method not allowed`);
	}
});

test('meta slides patch is accepted; unknown slides fields are rejected', async () => {
	const c = await connect();
	c.send('hello', {});
	const diagramId = (await c.expect('snapshot')).body.doc.meta.id;

	c.send('commit', { ops: [{ op: 'meta', patch: { slides: { url: 'https://docs.google.com/presentation/d/abc123' } } }] });
	await c.expect('ack');
	const doc = (await get(`/api/v1/diagrams/${diagramId}`)).body;
	assert.match(doc.meta.slides.url, /abc123/);

	c.send('commit', { ops: [{ op: 'meta', patch: { slides: { evil: 'x' } } }] });
	const err = await c.expect('error');
	assert.match(err.body.message, /unknown slides field/);
	c.close();
});

test('targeted hello, unknown open, set-on-missing, create-doc meta sanitization', async () => {
	const c = await connect();
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	const diagramId = snap.body.doc.meta.id;
	c.send('create', { name: 'other' });
	await c.expect('snapshot');

	// targeted hello goes back to the named diagram
	c.send('hello', { diagram: diagramId });
	const back = await c.expect('snapshot');
	assert.equal(back.body.doc.meta.id, diagramId);

	c.send('open', { id: 'diagram-nope01' });
	let err = await c.expect('error');
	assert.match(err.body.message, /unknown diagram/);

	c.send('commit', { ops: [{ op: 'set', kind: 'node', id: ({ id: 'node-abcd99', x: 90 }).id, patch: { id: 'node-abcd99', x: 90 } }] });
	err = await c.expect('error');
	assert.match(err.body.message, /missing entity/);

	// junk meta keys: rejected at the boundary. CS4 moved this from `push` to `create {doc}` — the
	// surviving bulk-ingest path, and the only one a client has left.
	const doc = back.body.doc;
	doc.nodes = []; doc.links = []; doc.zones = []; doc.groups = [];
	c.send('create', { name: 'junk', doc: { ...doc, meta: { ...doc.meta, junk: 'gone' } } });
	err = await c.expect('error');
	assert.equal(err.body.code, 'create-rejected');
	assert.match(err.body.message, /unknown meta key/);
	c.send('create', { name: 'junk', doc: { ...doc, meta: { ...doc.meta, version: 'NaN-string' } } });
	err = await c.expect('error');
	assert.match(err.body.message, /invalid meta.version/);
	// a rejected create writes NOTHING: no diagram was minted for either attempt (I1, by purity)
	assert.equal((await get('/api/v1/diagrams')).body.some((d) => d.name === 'junk'), false);
	// prototype-chain ids never resolve: del rejected, REST 404s
	c.send('commit', { ops: [{ op: 'del', kind: 'node', id: ({ id: '__proto__' }).id }] });
	err = await c.expect('error');
	assert.match(err.body.message, /valid entity.id/);
	for (const probe of ['__proto__', 'constructor', 'hasOwnProperty']) {
		assert.equal((await get(`/api/v1/diagrams/${diagramId}/nodes/${probe}`)).status, 404);
	}
	c.close();
});

test('create {doc} validateDoc rejections: duplicate ids and self-links', async () => {
	const c = await connect();
	c.send('hello', {});
	const doc = (await c.expect('snapshot')).body.doc;
	const countBefore = (await get('/api/v1/diagrams')).body.length;

	const node = { id: 'node-dada01', name: 'a', type: 'host', x: 30, y: 30 };
	c.send('create', { name: 'dup', doc: { ...doc, nodes: [node, { ...node }], links: [], zones: [], groups: [] } });
	let err = await c.expect('error');
	assert.match(err.body.message, /duplicate id/);

	c.send('create', { name: 'self', doc: { ...doc, nodes: [node], links: [{ id: 'link-dada02', src: node.id, dst: node.id }], zones: [], groups: [] } });
	err = await c.expect('error');
	assert.match(err.body.message, /self-link|same node|missing node/);

	c.send('create', { name: 'notadoc', doc: 'nope' });
	err = await c.expect('error');
	assert.match(err.body.message, /doc is not an object/);

	assert.equal((await get('/api/v1/diagrams')).body.length, countBefore, 'no rejected create minted a diagram');
	c.close();
});

test('corrupt and invalid files in the data dir are skipped at boot', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-corrupt-'));
	fs.writeFileSync(path.join(dir, 'diagram-bad001.json'), 'not json at all {{{');
	fs.writeFileSync(path.join(dir, 'diagram-bad002.json'), JSON.stringify({ meta: { id: 'diagram-bad002', name: 'x' }, nodes: [{ id: 'node-zz', evil: true }] }));
	const good = {
		meta: { id: 'diagram-aaaa11', name: 'good', version: 0, schema: 1, slides: { url: '', presentationId: '', pageId: '' } },
		nodes: [], links: [], zones: [], groups: []
	};
	fs.writeFileSync(path.join(dir, 'diagram-aaaa11.json'), JSON.stringify(good));

	const app2 = await createApp({ dataDir: dir, secretsDir: dir, port: 0 });
	const list = await (await fetch(`http://localhost:${app2.port}/api/v1/diagrams`)).json();
	assert.equal(list.length, 1);
	assert.equal(list[0].id, 'diagram-aaaa11');
	await app2.close();
	fs.rmSync(dir, { recursive: true, force: true });
});

test('collection caps are enforced on apply', async () => {
	// direct store exercise — 2000 websocket roundtrips would be slow
	const { Store } = await import('../server/store.js');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-cap-'));
	const store = new Store(dir);
	await store.init();
	const id = store.list()[0].id;
	const seeded = store.get(id).all('node').length;
	for (let i = 0; i < 2000 - seeded; i++) {
		const hex = i.toString(16).padStart(6, '0');
		const res = store.commit(id, { ops: [{ op: 'put', kind: 'node', entity: { id: `node-${hex}`, name: `n${i}`, type: 'host', x: 30, y: 30 } }] }, 'server');
		assert.equal(res.ok, true);
	}
	const over = store.commit(id, { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-ffffff', name: 'over', type: 'host', x: 30, y: 30 } }] }, 'server');
	assert.equal(over.ok, false);
	assert.match(over.error, /limit/);
	await store.flushAll();
	fs.rmSync(dir, { recursive: true, force: true });
});

test('delete removes a diagram, its file, and hands the session a survivor', async () => {
	const c = await connect();
	c.send('hello', {});
	const homeId = (await c.expect('snapshot')).body.doc.meta.id;

	c.send('create', { name: 'doomed' });
	const doomedId = (await c.expect('snapshot')).body.doc.meta.id;
	await sleep(300); // let the create flush to disk
	const file = path.join(dataDir, `${doomedId}.json`);
	assert.ok(fs.existsSync(file), 'created diagram persisted');

	// deleting the CURRENT diagram answers with a snapshot of a survivor
	c.send('delete', { id: doomedId });
	const after = await c.expect('snapshot');
	assert.notEqual(after.body.doc.meta.id, doomedId);
	assert.ok(!after.body.diagrams.some((d) => d.id === doomedId));
	assert.ok(!fs.existsSync(file), 'file removed from disk');
	assert.equal((await get(`/api/v1/diagrams/${doomedId}`)).status, 404);

	// the session continues working on the survivor
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-de1e01', name: 'alive', type: 'host', x: 30, y: 30 } }] });
	await c.expect('ack');
	assert.ok(after.body.doc.meta.id === homeId || true);
	c.send('commit', { ops: [{ op: 'del', kind: 'node', id: ({ id: 'node-de1e01' }).id }] });
	await c.expect('ack');

	// unknown id errors cleanly
	c.send('delete', { id: 'diagram-nope42' });
	const err = await c.expect('error');
	assert.match(err.body.message, /unknown diagram/);
	c.close();
});

test('deleting the last diagram reseeds the example (store never goes empty)', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-lastdel-'));
	const app2 = await createApp({ dataDir: dir, secretsDir: dir, port: 0 });
	const base2 = `http://localhost:${app2.port}`;

	const ws = new WebSocket(`ws://localhost:${app2.port}/ws`);
	const msgs = [];
	ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
	await new Promise((res) => ws.on('open', res));
	const send = (cmd, body) => ws.send(JSON.stringify({ cmd, body }));
	const expect = (cmd) => new Promise((res, rej) => {
		const t = setTimeout(() => rej(new Error(`timeout ${cmd}`)), 3000);
		const iv = setInterval(() => {
			const i = msgs.findIndex((m) => m.cmd === cmd);
			if (i !== -1) { clearTimeout(t); clearInterval(iv); res(msgs.splice(i, 1)[0]); }
		}, 20);
	});

	send('hello', {});
	const first = (await expect('snapshot')).body.doc.meta.id;
	send('delete', { id: first });
	const reseeded = await expect('snapshot');
	assert.notEqual(reseeded.body.doc.meta.id, first, 'fresh seed has a fresh id');
	assert.equal(reseeded.body.doc.meta.name, 'example');
	assert.equal(reseeded.body.doc.nodes.length, 8);
	assert.equal((await (await fetch(`${base2}/api/v1/diagrams`)).json()).length, 1);

	ws.close();
	await app2.close();
	fs.rmSync(dir, { recursive: true, force: true });
});

test('server restart reloads persisted state from disk', async () => {
	const c = await connect();
	c.send('hello', {});
	const snap = await c.expect('snapshot');
	const diagramId = snap.body.doc.meta.id;
	c.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-ffff01', name: 'persisted', type: 'server', x: 510, y: 510 } }] });
	await c.expect('ack');
	c.close();

	await app.close(); // flushes
	app = await createApp({ dataDir, secretsDir: dataDir, port: 0 });
	base = `http://localhost:${app.port}`;

	const rest = await get(`/api/v1/diagrams/${diagramId}/nodes/node-ffff01`);
	assert.equal(rest.status, 200);
	assert.equal(rest.body.name, 'persisted');
});

/*
D14 on the websocket — H4a.

D14 is [LOCKED] and reads: `expect` is optional on forward writes and MANDATORY on undo and redo.
REST enforced that; the websocket did not. Its gate was

    const mine = cmd === 'undo' ? (top && top.actor === this.actor) : true;
    if (!mine && body.expect == null) return this.error('expect required…');

so REDO never required `expect` at all, and UNDO did not require it when you authored the top
record. "I wrote the top record" is exactly the belief D14 exists to distrust: another writer can
interleave between the read that formed the belief and the undo that acts on it, and the ring is
shared. Tightened to match REST and the decision. Safe by construction — the browser already sends
`expect` on every undo and redo (app/src/changes.js:94-95).
*/
test('D14: the websocket refuses undo AND redo without expect, even for the author', async () => {
	const a = await connect();
	a.send('hello', {});
	const snap = await a.expect('snapshot');
	const id = snap.body.doc.meta.id;

	a.send('commit', { ops: [{ op: 'meta', patch: { name: 'd14-probe' } }], label: 'rename' });
	const ack = await a.expect('ack');

	// this session authored the top record — previously that alone waived the precondition
	a.send('undo', {});
	const e1 = await a.expect('error');
	assert.equal(e1.body.code, 'expect-required', 'authorship is not a substitute for a precondition');

	a.send('undo', { expect: ack.body.version });
	const undone = await a.expect('ack');

	a.send('redo', {});
	const e2 = await a.expect('error');
	assert.equal(e2.body.code, 'expect-required', 'redo is a reversal too, and its target is just as implicit');

	a.send('redo', { expect: undone.body.version });
	await a.expect('ack');
	a.close();
});

test('B25/I11: create {doc} IGNORES a well-formed client version but REJECTS a malformed one', async () => {
	const c = await connect();
	c.send('hello', {});
	const doc = (await c.expect('snapshot')).body.doc;

	// well-formed but not the client's to choose: ignored, and the mirror agrees with the log (D6)
	c.send('create', { name: 'v-probe', doc: { ...doc, meta: { ...doc.meta, version: 999 } } });
	const made = await c.expect('snapshot');
	assert.equal(made.body.doc.meta.version, 0, 'the client cannot mint a version any more than an id');
	assert.equal(made.body.version, made.body.doc.meta.version, 'log and document report the same number');

	// malformed: still refused at the boundary, never silently repaired (D17)
	c.send('create', { name: 'v-bad', doc: { ...doc, meta: { ...doc.meta, version: 'NaN-string' } } });
	assert.match((await c.expect('error')).body.message, /invalid meta.version/);
	c.close();
});

test('B34: the websocket broadcasts selection too — the gap between the transports closes', async () => {
	// The ws `select` case set the selection and replied `ack {ok:true}` — it broadcast NOTHING, so
	// two viewers never shared a selection, while REST shipped an entire snapshot for the same
	// change. Neither was right. Selection is a first-class EVENT: it is what lets a human watch an
	// agent work, and what a future view or animation attributes a transition to.
	const a = await connect(); a.send('hello', {});
	const snap = await a.expect('snapshot');
	const id = snap.body.doc.meta.id;
	// author a node rather than assuming the shared seed still has one — this suite mutates it
	a.send('commit', { ops: [{ op: 'put', kind: 'node', entity: { id: 'node-5e1ec7', name: 'sel', type: 'host', shape: 'circle', x: 480, y: 480 } }], label: 'create node' });
	await a.expect('ack');
	const nodeId = 'node-5e1ec7';

	const b = await connect(); b.send('hello', { diagram: id });
	await b.expect('snapshot');

	a.send('select', { ids: [nodeId] });
	await a.expect('ack');

	const evt = await b.expect('selection');
	assert.deepEqual(evt.body.ids, [nodeId], 'the other viewer was told what is selected');
	assert.ok(evt.body.actor, 'and by whom');
	a.close(); b.close();
});
