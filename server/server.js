#!/usr/bin/env node
/*
draw server — CLI entry. Serves the client, the read-only REST API, and the
persistence websocket on one port. State lives in <dataDir>/<diagram-id>.json.
*/

import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

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

const app = await createApp({ port, dataDir, secretsDir, clientDir, host, examplesDir });
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
