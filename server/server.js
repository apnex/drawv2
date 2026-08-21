#!/usr/bin/env node
/*
draw server — CLI entry. Serves the client, the read-only REST API, and the
persistence websocket on one port. State lives in <dataDir>/<diagram-id>.json.
*/

import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { gcsFiles } from './files.mjs';

const args = process.argv.slice(2);
function flag(name, fallback) {
	const i = args.indexOf(`--${name}`);
	return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

// 12-factor: every flag has an env equivalent for container deployments
const port = Number(process.env.PORT || flag('port', 8080));
const dataDir = process.env.DATA_DIR || flag('data', undefined);
const clientDir = process.env.CLIENT_DIR || flag('client', undefined);
const secretsDir = process.env.SECRETS_DIR || flag('secrets', undefined);
const host = process.env.HOST || flag('host', undefined);
// The example corpus, shipped in the repo and copied into the data dir on FIRST boot only. The
// data dir is runtime state (gitignored, a mounted bucket in production); examples/ is content.
const examplesDir = process.env.EXAMPLES_DIR
	|| flag('examples', fileURLToPath(new URL('../examples', import.meta.url)));

/*
BUCKET selects the object store; its absence selects the local filesystem -- B6.

Explicit rather than inferred. The alternative was to detect Cloud Run from the environment and
switch silently, which makes the most consequential choice in the process invisible at the call
site and untestable anywhere else. One variable, named after the thing it supplies, and the log line
below says which backend actually won.

`examplesDir` is unaffected on purpose: the corpus is read-only content in the image, and only the
mutable store moves to GCS (files.mjs).
*/
const bucket = process.env.BUCKET || flag('bucket', undefined);

/*
Authorization -- ACCESS.md. IAP_AUDIENCE turns it on; OWNER claims what predates it.

The combination that must never happen quietly is a real deployment with authorization off, so it
is refused rather than defaulted. BUCKET means this is running against the shared object store,
and without an audience there is no identity, and without identity `list()` returns every diagram
to every caller. Booting anyway would look completely healthy while being wide open, which is the
exact failure mode this milestone exists to remove.
*/
const audience = process.env.IAP_AUDIENCE || '';
const owner = process.env.OWNER || '';
// H9.8: comma-separated, e.g. ALLOW_DOMAINS=apnex.com.au,gmail.com. Unset means no domain
// restriction -- grants still default-deny, so a stranger signs in and sees an empty list.
const domains = (process.env.ALLOW_DOMAINS || '').split(',').map((d) => d.trim()).filter(Boolean);
if (bucket && !audience) {
	console.error('[ draw ] refusing to boot: BUCKET is set but IAP_AUDIENCE is not, so no request '
		+ 'carries an identity and every diagram would be listed to every caller. Set IAP_AUDIENCE to '
		+ 'the backend service audience, or unset BUCKET to run locally.');
	process.exit(1);
}
if (audience) console.log(`[ draw ] authorization: on${owner ? `, adopting unowned diagrams for ${owner}` : ''}`);
const files = bucket ? gcsFiles(bucket) : null;
if (bucket) console.log(`[ draw ] persistence: gs://${bucket}`);

const app = await createApp({ port, dataDir, secretsDir, clientDir, host, examplesDir, files, authz: Boolean(audience), owner, domains });
if (audience) {
	console.log(domains.length
		? `[ draw ] sign-in restricted to ${domains.join(', ')}`
		: '[ draw ] sign-in open to any account IAP admits; access is by grant only');
}
console.log(`[ draw ] editor + API on http://localhost:${app.port} (ws on /ws)`);

// a single bad request must never take the whole server (and every other
// diagram + websocket session) down — log and keep serving. The request paths
// already catch their own errors; this is the last-resort net.
process.on('unhandledRejection', (err) => {
	console.error('[ draw ] unhandled rejection:', (err && err.message) || err);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	// B59 -- flushAll is async, so the exit MUST wait for it. Firing and exiting would discard
	// every debounced write at shutdown, which on Cloud Run is the normal way a revision ends.
	process.on(signal, async () => {
		try {
			await app.store.flushAll();
		} catch (err) {
			console.error(`[ draw ] flush on ${signal} failed: ${err.message}`);
		}
		process.exit(0);
	});
}
