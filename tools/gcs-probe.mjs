#!/usr/bin/env node
/*
Exercise gcsFiles against a REAL bucket -- B6.

Deliberately outside `npm run gate`: CI has no GCP credentials, and a test that silently skips when
unauthenticated is worse than no test, because the green tick then means nothing.

The unit tests in tests/gcs.test.js prove the adapter matches my model of the GCS API. Only this can
tell me the model is right -- the pagination shape, whether an empty bucket really omits `items`,
whether a 412 really comes back on a stale generation, whether the generation header is really named
what I think. Every one of those is an assumption until a real bucket answers.

  BUCKET=diagrams.apnex.io node tools/gcs-probe.mjs

Auth comes from `gcloud auth print-access-token` rather than the metadata server, which does not
exist off-GCP. That difference is itself untested here and is the probe's own blind spot: it proves
the four verbs, not the token source Cloud Run will use.
*/
import { execSync } from 'node:child_process';
import { gcsFiles } from '../server/files.mjs';

const bucket = process.env.BUCKET || 'diagrams.apnex.io';
const token = async () => execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const files = gcsFiles(bucket, { token });

const NAME = `probe-${Date.now()}.json`;
let failures = 0;
const check = (label, cond, detail = '') => {
	console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
	if (!cond) failures++;
};

console.log(`\ngcs-probe against gs://${bucket}\n`);

const before = await files.list();
check('list() returns an array', Array.isArray(before), `${before.length} object(s)`);

await files.write(NAME, JSON.stringify({ hello: 'world' }));
check('write() created the object', (await files.list()).includes(NAME));

const text = await files.read(NAME);
check('read() round-trips the bytes', JSON.parse(text).hello === 'world');

await files.write(NAME, JSON.stringify({ hello: 'again' }));
check('write() overwrites using the generation it tracked', JSON.parse(await files.read(NAME)).hello === 'again');

// the compare-and-swap, forced: a SECOND adapter has never seen this name, so it writes with
// ifGenerationMatch=0 against an object that exists. That must be refused.
const rival = gcsFiles(bucket, { token });
let conflicted = false;
try { await rival.write(NAME, '{"hello":"rival"}'); } catch (e) { conflicted = /write conflict/.test(e.message); }
check('a rival writer is REFUSED, not allowed to clobber', conflicted);
check('and the original content survived it', JSON.parse(await files.read(NAME)).hello === 'again');

let absent = false;
try { await files.read('definitely-not-here.json'); } catch (e) { absent = /no such object/.test(e.message); }
check('read() of a missing object is a named absence', absent);

await files.remove(NAME);
check('remove() deleted it', !(await files.list()).includes(NAME));
await files.remove(NAME);
check('remove() is idempotent — absent is success', true);

/*
The whole Store on the real bucket.

The checks above exercise four verbs in isolation. This is the claim that actually matters for the
deployment: that Store boots, seeds, commits and flushes with GCS underneath, and that a SECOND
Store reads back what the first one wrote. If the seam were wrong anywhere, this is where it shows.
*/
console.log('\n  -- Store on GCS --\n');
const { Store } = await import('../server/store.js');
const scope = `store-probe-${Date.now()}`;
const scoped = gcsFiles(bucket, { token });
/*
A prefixed namespace, so the probe cannot collide with real documents.

The first version of this filtered on list but did NOT prefix on write, so the seed landed under its
own name at the bucket root, the filtered list never saw it, and the cleanup check passed while
deleting nothing -- a green assertion over an empty set. The prefix has to be applied on all four
verbs or it is not a namespace, it is a blindfold.
*/
const key = (n) => `${scope}/${n}`;
const ns = {
	list: async () => (await scoped.list()).filter((n) => n.startsWith(`${scope}/`)).map((n) => n.slice(scope.length + 1)),
	read: (n) => scoped.read(key(n)),
	write: (n, t) => scoped.write(key(n), t),
	remove: (n) => scoped.remove(key(n)),
};

const s1 = new Store('/nonexistent/gcs', { flushMs: 3_600_000, files: ns });
await s1.init();
const id = s1.list()[0].id;
check('Store.init seeded into an empty bucket', !!id, id);
await s1.flushAll();
check('flushAll wrote the seed through the adapter', (await ns.list()).length > 0);

const s2 = new Store('/nonexistent/gcs', { flushMs: 3_600_000, files: ns });
await s2.init();
check('a second Store read the document back off GCS', s2.list().some((d) => d.id === id));
check('durableVersion reflects a write that LANDED', s1.durableVersion(id) === s1.log(id).version);

const litter = (await scoped.list()).filter((n) => n.startsWith(`${scope}/`));
for (const n of litter) await scoped.remove(n);
check('probe objects cleaned up', litter.length > 0 && (await ns.list()).length === 0, `${litter.length} removed`);

console.log(`\n${failures ? `FAILED (${failures})` : 'all checks passed'}\n`);
process.exit(failures ? 1 : 0);
