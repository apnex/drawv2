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

export function createApp({ dataDir, secretsDir, port = 8080, clientDir, host, examplesDir = null } = {}) {
	const root = path.dirname(fileURLToPath(import.meta.url));
	// DEFAULT is the kernel-rendered thin UI (app/). The legacy client was retired (CL5); it lives
	// only on the app-v1 branch now. CLIENT_DIR can still point at a custom static dir if ever needed.
	const client = path.resolve(clientDir || path.join(root, '..', 'app'));
	const appDir = path.resolve(root, '..', 'app');       // also mounted at /next (back-compat alias)
	const kernelDir = path.resolve(root, '..', 'kernel');  // the geometry kernel ESM (mounted at /kernel)
	const engineDir = path.resolve(root, '..', 'engine');  // the relational engine ESM (mounted at /engine)
	const documentDir = path.resolve(root, '..', 'document'); // the document substrate ESM (mounted at /document)
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
	const hasDocument = fs.existsSync(path.join(documentDir, 'index.mjs'));

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
		// the new thin UI + the kernel ESM, mounted beside the legacy client during migration
		if (hasApp && (url.pathname === '/next' || url.pathname.startsWith('/next/'))) return serveFrom(req, res, appDir, '/next');
		if (hasKernel && url.pathname.startsWith('/kernel/')) return serveFrom(req, res, kernelDir, '/kernel');
		if (hasEngine && url.pathname.startsWith('/engine/')) return serveFrom(req, res, engineDir, '/engine');
		if (hasDocument && url.pathname.startsWith('/document/')) return serveFrom(req, res, documentDir, '/document');
		if (!hasClient) {
			res.writeHead(404, { 'Content-Type': 'application/json' });
			return res.end(JSON.stringify({ error: 'API-only mode; editor client not bundled' }) + '\n');
		}
		serveStatic(req, res, client);
	});

	const wss = new WebSocketServer({ server, path: '/ws' });
	wss.on('connection', (ws) => new Session(ws, store, hub, locks));

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
					store.flushAll();
					wss.clients.forEach((ws) => ws.terminate());
					return new Promise((done) => server.close(done));
				}
			});
		});
	});
}
