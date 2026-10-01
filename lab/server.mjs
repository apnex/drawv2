/*
The lab's own entry point -- H17 cut K10.

A SEPARATE SERVICE, never a path on the product (H17-D1 as amended 2026-09-28). The distinction is
the whole security argument: a `/lab` route on `server/app.js` would put unauthenticated content
inside the IAP perimeter and give the application a second door, which is the "footgun wearing a
door's clothes" that `AGENT_DOOR` in that file already warns against. This process shares the image
with the product and nothing else -- no Store, no Hub, no Locks, no identity, no API, no websocket.
There is nothing behind it to authorize, which is why it is safe with no IAP.

It serves static files and that is all. Any method other than GET or HEAD is refused, and the only
readable directories are the ones a lab page actually loads.

WHY NOT REUSE `serveFrom` FROM server/app.js: it is not exported, and exporting it to reach it here
would widen the product's surface for the lab's convenience -- the wrong direction. The traversal
guard below is the same shape and is held by its own test, because a static server whose traversal
check is wrong is the one way a no-API service can still be dangerous.
*/

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
The mounts, declared rather than derived.

A lab page loads its own files, the canvas modules it composes, and the four sovereign module
folders. Nothing else is reachable: `server/` is NOT mounted, so the planner's source is loaded by
the page from `/server/txn.mjs` -- which means that one folder IS needed. It is mounted read-only
like the rest, and it carries no secret: `server/txn.mjs` is the rule code the browser must run,
and every credential lives in the environment or in GCS, never in a served file.
*/
const MOUNTS = {
	'/src/': 'lab/src',
	'/app/': 'app',
	'/kernel/': 'kernel',
	'/model/': 'model',
	'/engine/': 'engine',
	'/network/': 'network',   // the incubating plugin (ruled 2026-09-28)
};

/*
`server/` IS NOT MOUNTED. The lab loads exactly five files from it -- the planner -- and they are
listed by name rather than by folder.

The first build of this mounted the whole directory, and the probe that caught it is the reason it
does not now: `GET /server/store.js` returned 200. That file is the GCS-backed store. It carries no
credential, so nothing leaked, but a no-API service that serves its product's entire server
directory has thrown away the reason it was safe to deploy at all. A mount is a standing promise
about every file a folder will EVER hold, and this folder grows.

Named files are a promise about five. `scan-layers` already knows the planner's closure (the
`planner` entry in tools/layers.mjs), and a test holds this list to it, so a fifth file joining the
planner fails the gate rather than silently becoming public.
*/
const PLANNER_FILES = new Set([
	'server/txn.mjs',
	'server/log.mjs',
	'server/validate.js',
	'server/anchor.mjs',
	// PL-3: the product's tenants of the planner (groups, classic links) -- rule code the planner runs, like txn.mjs
	'server/tenants.mjs',
]);

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.json': 'application/json; charset=utf-8',
};

function send(res, code, body, type = 'text/plain; charset=utf-8') {
	res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
	res.end(body);
}

/*
Resolve a URL path to a file inside a mount, or null.

`path.normalize` collapses `..` BEFORE the prefix check, and the check is on the resolved absolute
path rather than on the URL text -- a guard that inspects the URL can be walked past with an
encoded separator, while one that resolves first cannot.
*/
function resolveFile(pathname) {
	if (pathname === '/' || pathname === '/index.html') return path.join(ROOT, 'lab/index.html');
	if (pathname === '/lab.css') return path.join(ROOT, 'lab/lab.css');
	if (pathname === '/seeds.json') return path.join(ROOT, 'lab/seeds.json');   // the fixed boards (data, not code)
	if (pathname === '/style.css') return path.join(ROOT, 'app/style.css');
	if (pathname.startsWith('/server/')) {
		const rel = path.normalize(pathname).slice(1);
		return PLANNER_FILES.has(rel) ? path.join(ROOT, rel) : null;
	}
	for (const [prefix, dir] of Object.entries(MOUNTS)) {
		if (!pathname.startsWith(prefix)) continue;
		const base = path.join(ROOT, dir);
		const file = path.normalize(path.join(base, pathname.slice(prefix.length)));
		return file.startsWith(base + path.sep) ? file : null;
	}
	return null;
}

const server = http.createServer((req, res) => {
	if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
	if (req.url === '/health') return send(res, 200, 'ok');

	const file = resolveFile(new URL(req.url, 'http://localhost').pathname);
	if (!file) return send(res, 404, 'not found');

	fs.readFile(file, (err, data) => {
		if (err) return send(res, 404, 'not found');
		send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
	});
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => console.log(`[ lab ] serving on ${port} -- nothing is stored`));
