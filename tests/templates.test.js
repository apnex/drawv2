/*
The shipped template set (H9.9).

`templates/` is tracked; `diagrams/` is not. The store REWRITES a diagram file on every edit, so a
tracked runtime directory shows a diff whenever anyone uses the app -- and on Cloud Run that
directory is a mounted bucket, so the two were always different things.

THIS FILE REPLACES `examples.test.js`, which asserted the behaviour H9.9 reverses. The example
corpus was COPIED into the data dir on first boot and became real, shared, mutable diagrams; under
per-diagram access control that was wrong twice over -- shared state everyone could edit, and no
per-user starting point. Templates are read from the image, never written, listed to everyone, and
forked on first write.

The invariant the old file protected is unchanged and is why the reversal is safe: DELETED USER WORK
NEVER RETURNS. A template is not user work. A template reappearing after its fork is deleted is not
a resurrection, because it was never the caller's to delete.

`templatesDir` is INJECTED rather than discovered, for the reason `examplesDir` was: a store that
went looking for a sibling directory would behave differently depending on where it was constructed,
and every other test in this suite would silently start loading the whole shipped set. No count is
named in prose -- the set is curated, and a number in prose goes stale the first time it is.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../server/store.js';
import { validateDoc } from '../server/validate.js';
import { OWNER, makeApp } from './fixtures/app.mjs';
import { WebSocket } from 'ws';

const TEMPLATES = fileURLToPath(new URL('../templates', import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'draw-tpl-'));
const shipped = () => fs.readdirSync(TEMPLATES).filter((f) => f.endsWith('.json'))
	.map((f) => [f, JSON.parse(fs.readFileSync(path.join(TEMPLATES, f), 'utf8'))]);

test('every shipped template validates against the CURRENT schema', () => {
	const files = shipped();
	assert.ok(files.length > 0, 'the set is not empty');
	for (const [f, doc] of files) {
		assert.equal(validateDoc(doc), null, `${f} must load on the binary that ships with it`);
		assert.equal(f, `${doc.meta.id}.json`, `${f}: filename must match meta.id`);
		assert.match(doc.meta.id, /^template-[0-9a-f]{6}$/, `${f}: a template carries a template id`);
	}
});

/*
A template is NOBODY'S, and that is what makes it listable to everyone and forkable by anyone.

An owner would make it someone's private work that everybody could see; grants would make it a
sharing decision baked into the image; a selection would hand every forker whatever the author
happened to have highlighted when they exported it.
*/
test('a template carries no owner, no grants, no selection and no history', () => {
	for (const [f, doc] of shipped()) {
		assert.equal(doc.meta.owner, undefined, `${f}: a template has no owner`);
		assert.equal(doc.meta.grants, undefined, `${f}: a template has no grants`);
		assert.equal(doc.selection, undefined, `${f}: the selection was the author's`);
		assert.equal(doc.meta.version, 0, `${f}: a template has no history`);
		assert.equal('log' in doc, false, `${f}: no log block -- nobody wants a stranger's undo stack`);
		assert.equal('slides' in doc.meta, false, `${f} still carries meta.slides after the purge`);
	}
});

test('templates are listed to every principal, and are NOT in the store', async () => {
	const dir = tmp();
	const store = new Store(dir, { templatesDir: TEMPLATES, authz: true });
	await store.init();
	try {
		assert.equal(store.total(), 0, 'a template is read from the image, never written to the store');
		const listed = store.list('user:stranger@example.com');
		const templates = listed.filter((e) => e.template);
		assert.equal(templates.length, shipped().length, 'every template is offered to a stranger');
		assert.equal(listed.length, templates.length, 'and a stranger sees nothing else -- grants default-deny');
		// nothing was written to disk: the set exists in the image and nowhere else
		assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length, 0);
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
The first write FORKS, which is the whole feature.

Refusing would be simpler and would make a template a thing you look at rather than a thing you
start from. Forking at `commit` rather than at each caller is deliberate: REST and the websocket
both funnel through it, so it is the only place that sees every write.
*/
test('H9.9: the first write against a template forks it, and the answer says where it went', async () => {
	const dir = tmp();
	const store = new Store(dir, { templatesDir: TEMPLATES, authz: true });
	await store.init();
	const ME = 'user:me@example.com';
	try {
		const [, tpl] = shipped()[0];
		const before = store.get(tpl.meta.id).all('node').length;
		const res = store.commit(tpl.meta.id, {
			ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa9001', type: 'host', x: 0, y: 0, name: 'mine' } }],
			label: 'add',
		}, 'client', null, ME);

		assert.equal(res.ok, true, 'the write lands');
		assert.match(res.forkedTo || '', /^diagram-[0-9a-f]{6}$/, 'on a real diagram, and the caller is told which');

		const fork = store.get(res.forkedTo);
		assert.equal(fork.all('node').length, before + 1, 'the fork carries the template content plus the write');
		assert.equal(fork.state.meta.owner, ME, 'and belongs to whoever wrote to it');
		assert.equal(fork.state.meta.name, tpl.meta.name, 'keeping the name it was started from');

		// THE TEMPLATE IS UNCHANGED. It is content in the image; a write against it must not be
		// able to reach it, or one caller's edit becomes everybody's starting point.
		assert.equal(store.get(tpl.meta.id).all('node').length, before, 'the template is untouched');
		assert.equal(store.list('user:other@example.com').filter((e) => !e.template).length, 0,
			'and the fork is the writer\'s alone');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H9.9: a template is not deletable, undoable or redoable -- it is nobody\'s', async () => {
	const dir = tmp();
	const store = new Store(dir, { templatesDir: TEMPLATES, authz: true });
	await store.init();
	const ME = 'user:me@example.com';
	try {
		const [, tpl] = shipped()[0];
		const id = tpl.meta.id;
		assert.match(await store.remove(id, ME), /cannot delete a template/, 'not yours to delete');
		assert.match(store.undo(id, null, ME).error || '', /cannot undo a template/, 'and it has no history');
		assert.match(store.redo(id, ME).error || '', /cannot redo a template/);
		// each refusal NAMES the template case rather than answering "unknown diagram", which would
		// be a lie about something the caller can see in the listing
		assert.equal(store.templates.has(id), true, 'and it survived every refusal');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
The invariant the retired example corpus protected, restated and still true.

`examples.test.js` asserted that deleting a seeded example did not bring it back, recording the
reason as "seeding is FIRST BOOT only -- a re-seeding store would resurrect deleted work forever".
That sentence is about USER WORK. A template is not user work, so a template outliving a deleted
fork is not a resurrection -- what stays impossible is a deleted DIAGRAM coming back.
*/
test('deleting a fork does not resurrect it, and the template it came from stays', async () => {
	const dir = tmp();
	const ME = 'user:me@example.com';
	let store = new Store(dir, { templatesDir: TEMPLATES, authz: true });
	await store.init();
	const [, tpl] = shipped()[0];
	const forked = store.commit(tpl.meta.id, {
		ops: [{ op: 'put', kind: 'node', entity: { id: 'node-aa9002', type: 'host', x: 0, y: 0, name: 'x' } }],
		label: 'add',
	}, 'client', null, ME).forkedTo;
	try {
		await store.remove(forked, ME);
		store = new Store(dir, { templatesDir: TEMPLATES, authz: true });
		await store.init();
		assert.equal(store.get(forked), null, 'the deleted fork is gone and stays gone -- it was user work');
		assert.equal(store.templates.has(tpl.meta.id), true, 'the template is still offered -- it never was');
		assert.equal(store.total(), 0, 'and an empty store is legitimate now, because the listing is not');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a malformed template is skipped, not fatal -- a packaging bug must not block a boot', async () => {
	const dir = tmp();
	const tdir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-badtpl-'));
	for (const [f, doc] of shipped()) fs.writeFileSync(path.join(tdir, f), JSON.stringify(doc));
	fs.writeFileSync(path.join(tdir, 'template-ffffff.json'), '{ not json');
	try {
		const store = new Store(dir, { templatesDir: tdir, authz: false });
		await store.init();
		/*
		A DIAGRAM that will not parse refuses the boot, because it is somebody's lost work and
		booting without it fabricates a plausible, complete, wrong store. A template that will not
		parse costs a menu entry, so it is a warning. The asymmetry is the point.
		*/
		assert.equal(store.templates.size, shipped().length, 'the good ones loaded');
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
		fs.rmSync(tdir, { recursive: true, force: true });
	}
});

/*
H9.9 -- the fork reaches the caller through BOTH transports, by different means.

The store forks, and that is invisible unless each transport says so. A websocket session must
REBIND, or the next write lands on the template again and forks a second time -- draw three shapes
and you would own three diagrams. A REST caller has no session, so the new id travels in the body.

Asserted at the transport rather than in the store, because the store test above already proves the
fork; what these prove is that the caller can find out, and that the second write knows where it is.
*/
test('H9.9: a session rebinds to its fork, so a second write does not fork again', async () => {
	const dir = tmp();
	const app = await makeApp({ dataDir: dir, secretsDir: dir, port: 0, templatesDir: TEMPLATES });
	const tplId = shipped()[0][1].meta.id;
	const started = shipped()[0][1].nodes.length;
	const ws = new WebSocket(`ws://localhost:${app.port}/ws`);
	const seen = [];
	ws.on('message', (d) => seen.push(JSON.parse(d.toString())));
	await new Promise((r) => ws.on('open', r));
	const settle = () => new Promise((r) => setTimeout(r, 120));
	try {
		ws.send(JSON.stringify({ cmd: 'hello', body: { diagram: tplId } }));
		await settle();
		/*
		Renames, not new nodes. Placing a node needs a free anchor, and two of my attempts were
		refused for colliding with the template's own content -- which looks EXACTLY like the rebind
		having failed. A rename cannot collide, so a refusal here would mean what the test says.
		*/
		const rename = (name) => ({ ops: [{ op: 'meta', patch: { name } }], label: 'rename' });

		ws.send(JSON.stringify({ cmd: 'commit', body: rename('first') }));
		await settle();
		const forked = seen.find((m) => m.cmd === 'forked');
		assert.ok(forked, 'the session is told it moved');
		assert.match(forked.body.diagram, /^diagram-[0-9a-f]{6}$/, 'onto a real diagram');

		ws.send(JSON.stringify({ cmd: 'commit', body: rename('second') }));
		await settle();
		const mine = app.store.list(OWNER).filter((e) => !e.template);
		assert.equal(mine.length, 1, 'the SECOND write went to the same fork, not to a new one');
		assert.equal(app.store.get(forked.body.diagram).state.meta.name, 'second',
			'and the SECOND write landed on the fork too -- the session stayed where it moved to');
		assert.equal(app.store.get(tplId).state.meta.name, shipped()[0][1].meta.name,
			'the template is untouched');
		assert.equal(app.store.get(tplId).all('node').length, started, 'in content as well as name');
	} finally { ws.close(); await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
H9.9 -- a template is offered to every PRINCIPAL, which is not the same as to everyone.

The first version of `canRead` returned true for a template unconditionally, reasoning that
something owned by nobody gives authorization nothing to decide. That is true about the GRANT and
false about the DOOR. `/connect` sits outside IAP by design, so an unauthenticated caller reached it
and `curl` with no credential returned a real network topology in full.

Caught by running a container with IAP_AUDIENCE set, which is the configuration production runs. An
earlier container had no identity source, so authorization was off and every check said yes.
*/
test('H9.9: an unauthenticated caller is offered no template, and can read none', async () => {
	const dir = tmp();
	const store = new Store(dir, { templatesDir: TEMPLATES, authz: true });
	await store.init();
	try {
		const id = shipped()[0][1].meta.id;
		assert.equal(store.canRead(id, 'user:someone@example.com'), true, 'a principal may read one');
		assert.equal(store.canRead(id, null), false, 'and nobody may not — the door is the point');
		assert.equal(store.list(null).length, 0, 'nor are the names offered');
		assert.ok(store.list('user:someone@example.com').length > 0, 'while a principal sees them');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
