/*
App — composition root: one HTTP server serving the static client and the
REST API, with the websocket endpoint upgraded on /ws. It also owns the
Server-Locked control plane: the lock arbiter and the broadcast hub, wired
into both the websocket sessions and the REST writes.
Importable for tests (port 0 = random); server.js is the CLI entry.
*/

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Store } from './store.js';
import { Session } from './protocol.js';
import { handleRest } from './rest.js';
import { Locks } from './locks.js';
import { Hub } from './hub.js';
import { svgDocument } from './svg.mjs';
import { GoogleAuth } from './slides/auth.js';
import { SlidesSync } from './slides/sync.js';

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.json': 'application/json',
	'.ico': 'image/x-icon'
};

// serve a directory under a URL prefix (e.g. /next → app/, /kernel → kernel/). The bare prefix
// serves index.html. Used to mount the new thin UI + the kernel ESM beside the legacy client.
function serveFrom(req, res, baseDir, prefix) {
	const url = new URL(req.url, 'http://localhost');
	let rel = url.pathname.slice(prefix.length);
	if (rel === '' || rel === '/') rel = '/index.html';
	const file = path.normalize(path.join(baseDir, rel));
	if (!file.startsWith(baseDir)) {
		res.writeHead(403);
		return res.end('forbidden');
	}
	fs.readFile(file, (err, data) => {
		if (err) {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			return res.end('not found');
		}
		res.writeHead(200, {
			'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
			'Cache-Control': 'no-store'
		});
		res.end(data);
	});
}

function serveStatic(req, res, clientDir) {
	const url = new URL(req.url, 'http://localhost');
	// deep links: /d/<diagram-id> is the editor with that diagram preselected
	const route = (url.pathname === '/' || /^\/d\/diagram-[0-9a-f]{6}$/.test(url.pathname))
		? 'index.html' : url.pathname;
	let file = path.normalize(path.join(clientDir, route));
	if (!file.startsWith(clientDir)) {
		res.writeHead(403);
		return res.end('forbidden');
	}
	fs.readFile(file, (err, data) => {
		if (err) {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			return res.end('not found');
		}
		res.writeHead(200, {
			'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
			'Cache-Control': 'no-store'
		});
		res.end(data);
	});
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
	({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function handleOAuthCallback(req, res, url, slides) {
	const page = (title, body) => {
		res.writeHead(200, {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
		});
		res.end(`<!DOCTYPE html><html><body style="background:#101010;color:#aed581;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh"><div><h2>${esc(title)}</h2><p style="color:#ddddff">${esc(body)}</p></div></body></html>`);
	};
	const code = url.searchParams.get('code');
	if (!code) return page('draw — authorization failed', url.searchParams.get('error') || 'no code returned');
	if (!slides.auth.checkState(url.searchParams.get('state'))) {
		return page('draw — authorization rejected', 'state mismatch: this callback does not belong to a flow this server started');
	}
	try {
		await slides.auth.exchangeCode(code, slides.redirectUri);
		console.log('[ slides ] Google authorization stored');
		page('draw — authorized ✓', 'You can close this tab and push to Slides.');
	} catch (err) {
		page('draw — authorization failed', err.message);
	}
}

// B54 - how long a client may stay silent before it is presumed gone. Two rounds of this is the
// worst-case eviction delay, which is why it is well under any sensible proxy idle timeout.
const PING_MS = 30000;

export function createApp({ dataDir, secretsDir, port = 8080, clientDir, host, examplesDir = null, pingMs = PING_MS } = {}) {
	const root = path.dirname(fileURLToPath(import.meta.url));
	// DEFAULT is the kernel-rendered thin UI (app/). The legacy client was retired (CL5); it lives
	// only on the app-v1 branch now. CLIENT_DIR can still point at a custom static dir if ever needed.
	const client = path.resolve(clientDir || path.join(root, '..', 'app'));
	const appDir = path.resolve(root, '..', 'app');       // also mounted at /next (back-compat alias)
	const kernelDir = path.resolve(root, '..', 'kernel');  // the geometry kernel ESM (mounted at /kernel)
	const engineDir = path.resolve(root, '..', 'engine');  // the relational engine ESM (mounted at /engine)
	const modelDir = path.resolve(root, '..', 'model'); // the model substrate ESM (mounted at /model)
	const data = path.resolve(dataDir || path.join(root, '..', 'diagrams'));
	// credentials live OUTSIDE the diagram data dir: the data volume must carry no secrets
	const secrets = path.resolve(secretsDir || path.join(root, '..', 'secrets'));
	// examplesDir is null unless the caller supplies one — only server/server.js does, so a test
	// that constructs an app gets the single programmatic seed, not whatever ships in examples/.
	const store = new Store(data, { examplesDir });
	store.init();

	const auth = new GoogleAuth(data, secrets);
	const slides = { auth, sync: new SlidesSync(auth) };

	// Server-Locked control plane: lock arbiter + websocket broadcast hub
	const locks = new Locks();
	const hub = new Hub();

	// the backend is self-sufficient: with no client directory it runs API-only
	// (websocket + REST), e.g. as a container behind a separately served client
	const hasClient = fs.existsSync(path.join(client, 'index.html'));
	if (!hasClient) console.log('[ app ] no client directory found — running API-only');
	// the new thin UI + kernel mounts only advertise when present (absent in API-only / partial images)
	const hasApp = fs.existsSync(path.join(appDir, 'index.html'));
	const hasKernel = fs.existsSync(path.join(kernelDir, 'index.mjs'));
	const hasEngine = fs.existsSync(path.join(engineDir, 'index.mjs'));
	const hasModel = fs.existsSync(path.join(modelDir, 'index.mjs'));

	const server = http.createServer(async (req, res) => {
		const url = new URL(req.url, 'http://localhost');
		if (url.pathname === '/oauth2callback' && req.method === 'GET') {
			return handleOAuthCallback(req, res, url, slides);
		}
		if (handleRest(req, res, store, slides, locks, hub)) return;
		if (req.method !== 'GET') {
			res.writeHead(405);
			return res.end();
		}
		/*
		`/d/<id>.svg` — the diagram you are looking at, as a downloadable image.

		A sibling of the deep link rather than an /api/v1 route, because it is not a description of
		the model: it is the picture, for someone who has `/d/<id>` open and wants the same thing as
		a file. `curl -O` then yields `<id>.svg` rather than a file called `svg`. It must be matched
		BEFORE static handling, which owns `/d/` today and would otherwise look for a file on disk.
		A read, so no lock — the same rule the rest of GET follows.
		*/
		const asSvg = url.pathname.match(/^\/d\/(diagram-[0-9a-f]{6})\.svg$/);
		if (asSvg) {
			const model = store.get(asSvg[1]);
			if (!model) {
				res.writeHead(404, { 'Content-Type': 'application/json' });
				return res.end(JSON.stringify({ error: `unknown diagram: ${asSvg[1]}` }) + '\n');
			}
			const body = svgDocument(model.toJSON());
			res.writeHead(200, {
				'Content-Type': 'image/svg+xml; charset=utf-8',
				'Cache-Control': 'no-store',
				'Access-Control-Allow-Origin': '*',
				// a browser navigating here RENDERS it; `curl -O` and a download both name the file
				'Content-Disposition': `inline; filename="${asSvg[1]}.svg"`
			});
			return res.end(body);
		}
		// the new thin UI + the kernel ESM, mounted beside the legacy client during migration
		if (hasApp && (url.pathname === '/next' || url.pathname.startsWith('/next/'))) return serveFrom(req, res, appDir, '/next');
		if (hasKernel && url.pathname.startsWith('/kernel/')) return serveFrom(req, res, kernelDir, '/kernel');
		if (hasEngine && url.pathname.startsWith('/engine/')) return serveFrom(req, res, engineDir, '/engine');
		if (hasModel && url.pathname.startsWith('/model/')) return serveFrom(req, res, modelDir, '/model');
		if (!hasClient) {
			res.writeHead(404, { 'Content-Type': 'application/json' });
			return res.end(JSON.stringify({ error: 'API-only mode; editor client not bundled' }) + '\n');
		}
		serveStatic(req, res, client);
	});

	const wss = new WebSocketServer({ server, path: '/ws' });
	wss.on('connection', (ws) => {
		// B54 - liveness. `close` evicts a session for every disconnect that produces a TCP FIN, but
		// a peer that vanishes without one (lid closed, partition, NAT idle-timeout) never sends it,
		// and the socket sits in the Hub at readyState OPEN forever while the client reconnects
		// beside it. A pong resets the flag; missing one whole round is what "gone" means here.
		ws.isAlive = true;
		ws.on('pong', () => { ws.isAlive = true; });
		new Session(ws, store, hub, locks);
	});

	// ONE sweep for every client, not a timer per socket. `terminate()` is deliberate: it produces
	// the `close` event the session FSM already handles, so liveness adds no second eviction path.
	const pingTimer = setInterval(() => {
		wss.clients.forEach((ws) => {
			if (ws.isAlive === false) return ws.terminate();
			ws.isAlive = false;
			ws.ping();
		});
	}, pingMs);
	pingTimer.unref();

	// liveness: a crashed controller's lock frees itself by TTL; sweep so the
	// freed diagram's viewers are told it's editable again (lazy TTL alone is silent)
	const sweepTimer = setInterval(() => {
		locks.sweep().forEach((id) => hub.broadcast(id, 'lock', { owner: 'client' }));
	}, 5000);
	sweepTimer.unref();

	// localhost tool: loopback by default; containers/LAN opt in via HOST=0.0.0.0
	const bindHost = host || process.env.HOST || '127.0.0.1';
	return new Promise((resolve) => {
		server.listen(port, bindHost, () => {
			// one configured redirect URI: never derived from request headers
			slides.redirectUri = process.env.OAUTH_REDIRECT_URI
				|| `http://localhost:${server.address().port}/oauth2callback`;
			resolve({
				server,
				store,
				port: server.address().port,
				close() {
					clearInterval(sweepTimer);
					clearInterval(pingTimer);
					store.flushAll();
					wss.clients.forEach((ws) => ws.terminate());
					return new Promise((done) => server.close(done));
				}
			});
		});
	});
}
