/*
B190 -- a flag the verb does not declare is REFUSED, and `--draft` is on every write.

Two halves of one defect. `--draft` shipped on `place` alone, and because an unknown flag was
silently dropped the other twelve write verbs accepted it and wrote anyway: measured on the estate,
`draw link a b --draft` returned v3 while `draft show` reported nothing staged. The flag did
nothing and said nothing.

Refusing an undeclared flag is what turns that class of defect into a first-invocation failure
rather than a silent wrong answer. It is the same rule the tool already applies to an unknown verb.

The global flags are exempt because they are read by the dispatcher or by `activeId` rather than by
any one verb, and only 45 of 62 verbs declare `--diagram` while every one of them honours it.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeApp } from './fixtures/app.mjs';
import { main } from '../cli/draw.mjs';
import { VERBS } from '../cli/verbs.mjs';

let app, host, dataDir, home;

async function boot() {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-flag-'));
	home = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-fhome-'));
	app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	host = `http://127.0.0.1:${app.port}`;
}
const run = async (...argv) => {
	const out = [];
	await main([...argv, '--host', host], { HOME: home }, (s) => out.push(s));
	return out.join('');
};
async function captureExit(fn) {
	const errs = [];
	const ew = process.stderr.write.bind(process.stderr);
	const exit = process.exit;
	process.stderr.write = (s) => { errs.push(s); return true; };
	process.exit = () => { throw new Error('__exit__'); };
	try { await fn(); } catch (e) { if (e.message !== '__exit__') throw e; }
	finally { process.stderr.write = ew; process.exit = exit; }
	return errs.join('');
}
const version = async (id) => {
	const list = JSON.parse(await run('diagrams', '--json'));
	return list.find((d) => d.id === id).version;
};

test('an undeclared flag is refused, and the refusal names the flag and the verb', async () => {
	await boot();
	try {
		const id = (await run('create', 'flag-refuse')).trim();
		await run('lock', '--diagram', id);
		const err = await captureExit(() => run('add', 'server', 'at', '0,0', '--nmae', 'typo', '--diagram', id));
		assert.match(err, /--nmae/, 'the refusal names the flag');
		assert.match(err, /add/, 'and the verb');
	} finally { await app.close(); }
});

test('a typo does not write -- the whole point of refusing rather than warning', async () => {
	await boot();
	try {
		const id = (await run('create', 'flag-nowrite')).trim();
		await run('lock', '--diagram', id);
		const before = await version(id);
		await captureExit(() => run('add', 'server', 'at', '0,0', '--nmae', 'typo', '--diagram', id));
		assert.equal(await version(id), before, 'a refused invocation must not have written');
	} finally { await app.close(); }
});

test('the global flags are accepted by every verb, declared or not', async () => {
	await boot();
	try {
		// `--diagram` is honoured by activeId for every verb that targets a document, and only 45
		// of 62 declare it. A refusal that did not exempt the globals would break the other 17.
		const id = (await run('create', 'flag-global')).trim();
		const out = await run('dump', '--diagram', id, '--json');
		assert.ok(JSON.parse(out).meta, '--diagram + --json passed through');
	} finally { await app.close(); }
});

test('every write verb that commits ops declares --draft', () => {
	/*
	The B190 defect itself, as a property rather than a sample. A verb that posts ops to /commit is
	draftable by definition; one that declares no --draft is one an agent can stage into and have
	silently applied.
	*/
	const src = fs.readFileSync(new URL('../cli/verbs.mjs', import.meta.url), 'utf8');
	const missing = [];
	for (const v of VERBS) {
		if (v.route !== '/diagrams/<id>/commit') continue;
		if (v.name === 'commit') continue;            // commit IS the apply, not a stageable write
		if (!(v.flags || []).some((f) => f.name === '--draft')) missing.push(v.name);
	}
	assert.deepEqual(missing, [], `these commit ops and cannot be drafted: ${missing.join(', ')}`);

	/*
	And the reverse, which the first pass missed. Declaring --draft on a READ verb is meaningless:
	there is nothing to stage, so the flag would be accepted and ignored -- the exact silence this
	whole row exists to remove. Caught by mutation: a bulk edit anchored on verb NAMES gave --draft
	to `zone contents` and `link path`, and nothing failed.
	*/
	const spurious = VERBS
		.filter((v) => (v.flags || []).some((f) => f.name === '--draft'))
		.filter((v) => v.route !== '/diagrams/<id>/commit')
		.map((v) => v.name);
	assert.deepEqual(spurious, [], `these declare --draft and stage nothing: ${spurious.join(', ')}`);
	assert.ok(src.length > 0);
});

test('a drafted write stages for every write verb, not only place', async () => {
	await boot();
	try {
		const id = (await run('create', 'flag-stage')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'a', '--diagram', id);
		await run('add', 'server', 'at', '2,0', '--name', 'b', '--diagram', id);
		const before = await version(id);

		// one of each shape: a link (two refs), a rename (a patch), a zone (its own geometry)
		await run('link', 'a', 'b', '--draft', '--diagram', id);
		await run('rename', 'a', 'core', '--draft', '--diagram', id);
		await run('zone', 'dmz', 'from', '-2,-2', 'to', '-1,-1', '--draft', '--diagram', id);
		assert.equal(await version(id), before, 'none of the three may have written');

		const staged = JSON.parse(await run('draft', 'show', '--json'));
		assert.equal(staged.ops.length, 3, `expected 3 staged, got ${staged.ops.length}`);

		await run('commit', '--diagram', id);
		assert.equal(await version(id), before + 1, 'all three landed as ONE transaction');

		const doc = JSON.parse(await run('dump', '--diagram', id, '--json'));
		assert.equal(doc.links.length, 1, 'the link landed');
		assert.equal(doc.zones.length, 1, 'the zone landed');
		assert.ok(doc.nodes.some((n) => n.name === 'core'), 'the rename landed');
	} finally { await app.close(); }
});

test('rm stages too, so a drafted set can remove as well as add', async () => {
	await boot();
	try {
		const id = (await run('create', 'flag-rm')).trim();
		await run('lock', '--diagram', id);
		await run('add', 'server', 'at', '0,0', '--name', 'doomed', '--diagram', id);
		const before = await version(id);
		await run('rm', 'doomed', '--draft', '--diagram', id);
		assert.equal(await version(id), before, 'rm --draft must not delete yet');
		assert.equal(JSON.parse(await run('dump', '--diagram', id, '--json')).nodes.length, 1);

		await run('commit', '--diagram', id);
		assert.equal(JSON.parse(await run('dump', '--diagram', id, '--json')).nodes.length, 0,
			'the deletion landed on commit');
	} finally { await app.close(); }
});
