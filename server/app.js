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
import { handleRest, announceActivity } from './rest.js';
import { domainGate, bearerIdentity, anyOf } from './identity.mjs';
import { originPolicy } from './origin.mjs';
import { Locks } from './locks.js';
import { Hub } from './hub.js';
import { svgDocument } from './svg.mjs';

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


// B54 - how long a client may stay silent before it is presumed gone. Two rounds of this is the
// worst-case eviction delay, which is why it is well under any sensible proxy idle timeout.
const PING_MS = 30000;

/*
`/connect` -- the agent's door, and B101 made it a door to the surface rather than to one room.

The load balancer routes `/connect/*` to a backend with IAP switched off, so the prefix's whole job
is to name a route the editor already has, without it. IAP is configured per backend service and
has no path exclusion, which is why a path reachable without a Google sign-in must be routed
elsewhere at all.

It is stripped at INGRESS, before identity is resolved and before anything routes, so no code below
can tell which door a request came through. That is what keeps the prefix a door and never a
privilege (H9.7), and doing it here makes that true of strictly more code than the old rewrite did:
that one sat inside the REST router, so the router itself -- and everything app.js does outside it,
including the picture -- were door-aware.

The map is explicit rather than a blanket strip of `/connect`. A blanket strip would put every
route this file grows behind the IAP-free backend the moment somebody added one, silently, which is
a footgun wearing a door's clothes. Two entries today; a third is a deliberate act.

None of this authorizes anything. Authentication happens after this point and authorization after
that, on the principal alone -- a request through the door with no valid code carries no principal,
and the store refuses it exactly as it refuses one that slipped past IAP.
*/
const AGENT_DOOR = [
	['/connect/v1/', '/api/v1/'],   // the REST surface (H9.6)
	['/connect/d/', '/d/'],         // the rendered picture (B101)
];

function throughTheAgentDoor(rawUrl) {
	for (const [door, real] of AGENT_DOOR) {
		if (rawUrl.startsWith(door)) return real + rawUrl.slice(door.length);
	}
	return rawUrl;
}

/*
B115 -- everything a lapsed lock has to tell somebody, in one place with a name.

A lock that times out is announced by nobody unless this runs. `agents` fires on explicit acquire
and release, so the PUSHED list went stale while GET /workspace/agents stayed correct -- the pull
right and the push wrong, which is worse than both being wrong because it looks like it works. The
director watched an indicator keep reporting an agent that had timed out.

It is a named export rather than an arrow inside setInterval because that arrow could not be
tested: every existing test releases a lock explicitly, so expiry -- the one path that reaches here
-- was the case the whole suite missed. Now it takes a fake clock and two counters.

The `agents` announcement is sent ONCE for the sweep rather than per freed diagram, because its body
is the entire live set and sending it twice would say the same thing twice.
*/
export function sweepLocks(locks, hub, store) {
	const freed = locks.sweep();
	freed.forEach((id) => hub.broadcast(id, 'lock', { owner: 'client' }));
	if (freed.length) announceActivity(hub, store, locks);
	return freed;
}

export async function createApp({ dataDir, secretsDir, port = 8080, clientDir, host, examplesDir = null, pingMs = PING_MS, files = null, authz = true, owner = '', principalOf = null, domains = [], origins = '', lockTtlMs = 0 } = {}) {
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
	// `files` null means the Store picks its filesystem default; server.js supplies gcsFiles when
	// BUCKET is set (B6). The app itself stays ignorant of which backend it got.
	/*
	The one place a request becomes a principal -- ACCESS.md.

	`principalOf` is the whole of it. H9.25 removed the `audience` parameter, so this function no
	longer knows that IAP exists: `server.js` resolves a source through `identitySource()` and hands
	the result in. Absent one, a request resolves to nobody, which is the correct answer -- with
	authorization off the store ignores the principal entirely, and with it on a request that proves
	nothing should carry nothing.
	*/
	// H9.8: the allowlist wraps whatever produced the principal, including an injected one, so a
	// test exercises the same composition production uses
	/*
	B70: refuse the one combination that is never intended.

	`authz` on without a `principalOf` means the grant filter is active and no request can ever carry
	an identity -- every list is empty and every write is refused, including the owner's. That is
	indistinguishable at a glance from a working deployment that simply has no data, which is how it
	survived a production cutover.

	Throwing here rather than defaulting is the point: the previous behaviour silently substituted
	a stub that returns null, so a missing argument became a running service with no identity.

	H9.25 also made the original mistake unrepresentable rather than merely detected. B70 was an
	argument that was tested and not passed; with `audience` gone there is one identity argument, so
	there is no longer a second value that can be consulted while the real one goes missing.
	*/
	if (authz && !principalOf) {
		throw new Error('createApp: authz is on but there is no way to identify anyone -- pass '
			+ '`principalOf`, which server.js resolves through identitySource(). Authorization with no '
			+ 'identity source refuses every caller including the owner.');
	}
	const store = new Store(data, { examplesDir, files, authz });
	await store.init();
	/*
	H9.6: two doors, one boundary. A Google identity via `principalOf`, or a connection code as a
	bearer token. The allowlist wraps both, which costs nothing -- `domainGate` judges a domain and
	an agent has none, so it passes an `agent:` principal through untouched (H9.8).

	Order matters only for a request carrying both, which no real caller does: an IAP assertion is
	the stronger claim, so it wins. Past this line nothing knows which door was used, and that is
	exactly what lets the store gate on the grant alone.
	*/
	const identify = domainGate(anyOf(principalOf, bearerIdentity((code) => store.agentForCode(code))), domains);
	/*
	Adoption runs after init and before anything can ask what exists -- H9.10.

	Diagrams written before ownership existed belong to nobody, so under a grant filter they are
	visible to nobody. Claiming them is explicit and idempotent rather than implicit, because the
	alternative rule -- unowned means anyone may see it -- is a default nobody should acquire by
	accident.
	*/
	if (owner) {
		const claimed = store.adopt(owner);
		if (claimed) console.log(`[ store ] adopted ${claimed} unowned diagram(s) for ${owner}`);
	}

	// Server-Locked control plane: lock arbiter + websocket broadcast hub
	// B142: the backstop is a decision, taken here and tunable by the operator, rather than a
	// default nobody revisited. `reclaim` remains what actually protects a person's control.
	const locks = new Locks(lockTtlMs ? { ttlMs: lockTtlMs } : {});
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
		req.url = throughTheAgentDoor(req.url);
		const url = new URL(req.url, 'http://localhost');
		// resolved here rather than inside the router, so every REST handler receives a principal
		// and none of them reads a header (ACCESS.md -- one boundary)
		const principal = await identify(req.headers).catch(() => null);
		if (handleRest(req, res, store, locks, hub, principal)) return;
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
			// B67: an SVG is a rendering of the document, so it carries the whole document's
			// content. ACCESS.md already says the representation is not the permission; until
			// now nothing enforced it.
			if (!store.canRead(asSvg[1], principal)) {
				res.writeHead(403, { 'Content-Type': 'application/json' });
				return res.end(JSON.stringify({ error: 'forbidden: no access to this diagram', code: 'forbidden' }) + '\n');
			}
			const body = svgDocument(model.toJSON());
			res.writeHead(200, {
				'Content-Type': 'image/svg+xml; charset=utf-8',
				'Cache-Control': 'no-store',
				// H9.28: the wildcard is gone here too. An <img> embed never needed it -- CORS governs
				// reading a response with script, and this route is now grant-gated (B67) besides.
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

	/*
	H9.28/B33 -- refuse an upgrade from an origin we do not know.

	This is the gate CORS cannot provide. A websocket handshake has no preflight, so any page may
	attempt one against us, and the browser attaches our cookies to it; the identity boundary below
	would then resolve a perfectly valid principal for a request its owner never intended.

	Refused at `verifyClient` rather than inside `connection`, so the socket is never established
	and no Session is constructed for a caller we are about to reject. Every refusal is logged with
	both sides -- a same-origin client that this wrongly refuses would otherwise fail as a silent
	reconnect loop, which is the hardest kind of outage to attribute.
	*/
	const originAllowed = originPolicy(origins);
	const wss = new WebSocketServer({
		server,
		path: '/ws',
		verifyClient: ({ origin, req }) => {
			if (originAllowed(origin, req.headers.host)) return true;
			console.warn(`[ ws ] refusing upgrade from origin ${origin || '(none)'} -- host is ${req.headers.host}`);
			return false;
		},
	});
	wss.on('connection', (ws, request) => {
		// B54 - liveness. `close` evicts a session for every disconnect that produces a TCP FIN, but
		// a peer that vanishes without one (lid closed, partition, NAT idle-timeout) never sends it,
		// and the socket sits in the Hub at readyState OPEN forever while the client reconnects
		// beside it. A pong resets the flag; missing one whole round is what "gone" means here.
		ws.isAlive = true;
		ws.on('pong', () => { ws.isAlive = true; });
		// the upgrade request carries the same IAP headers as any other; resolving once per socket
		// rather than per message is right because the identity cannot change mid-connection
		identify(request?.headers || {}).catch(() => null)
			.then((principal) => new Session(ws, store, hub, locks, principal));
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
	const sweepTimer = setInterval(() => sweepLocks(locks, hub, store), 5000);
	sweepTimer.unref();

	// localhost tool: loopback by default; containers/LAN opt in via HOST=0.0.0.0
	const bindHost = host || process.env.HOST || '127.0.0.1';
	return new Promise((resolve) => {
		server.listen(port, bindHost, () => {
			resolve({
				server,
				store,
				locks,
				port: server.address().port,
				async close() {
					clearInterval(sweepTimer);
					clearInterval(pingTimer);
					// B59 -- awaited, not fired: close() is what tests use to assert durability,
					// and an unawaited flush would let the socket shut before the write landed.
					await store.flushAll();
					wss.clients.forEach((ws) => ws.terminate());
					return new Promise((done) => server.close(done));
				}
			});
		});
	});
}
