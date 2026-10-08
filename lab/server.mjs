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

K9: HOW a file is found and sent is the one responder the product's server uses too (server/static.mjs) -- a shared
module rather than an export of server/app.js, which would have widened the product's surface for the lab. WHAT is
served stays here, declared below: a static server whose traversal check is wrong is the one way a no-API service can
still be dangerous, so the check is held once, by its own test (tests/static.test.js).
*/

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileWithin, sendFile, notFound } from '../server/static.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
The mounts, declared rather than derived.

A lab page loads its own files, the canvas modules it composes, the sovereign module folders, and the planner. Each
folder is served whole or not at all (H17-D5), and nothing else is reachable.

`server/` IS NOT SERVED, at all. The first build of this mounted the whole directory, and the probe that caught it is
the reason it does not now: `GET /server/store.js` returned 200 -- the GCS-backed store. It carried no credential, so
nothing leaked, but a no-API service that serves its product's server directory has thrown away the reason it was safe
to deploy. Then the planner lived in `server/` and had to be served as five named files; K4 moved it to its own folder,
`planner/`, which holds rule code the browser runs and no secret, so it is mounted like the rest and `server/` needs no
exception. tests/static.test.js asks for `server/store.js`, `identity.mjs` and `anchor.mjs` and requires 404.
*/
const MOUNTS = {
	'/src/': 'lab/src',
	'/app/': 'app',
	'/kernel/': 'kernel',
	'/model/': 'model',
	'/engine/': 'engine',
	'/planner/': 'planner',   // K4 (H17-D5): the planner, whole -- the page commits through it
	'/network/': 'network',   // the incubating plugin (ruled 2026-09-28)
	'/zones/': 'zones',       // the zones plugin (O-b1, H19.19)
	'/groups/': 'groups',     // the groups plugin (O-c, H19.20)
};

function send(res, code, body) {
	res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
	res.end(body);
}

// a URL path to a file inside a mount, or null -- the mount's bound is `fileWithin` (server/static.mjs)
function resolveFile(pathname) {
	if (pathname === '/' || pathname === '/index.html') return path.join(ROOT, 'lab/index.html');
	if (pathname === '/lab.css') return path.join(ROOT, 'lab/lab.css');
	if (pathname === '/seeds.json') return path.join(ROOT, 'lab/seeds.json');   // the fixed boards (data, not code)
	if (pathname === '/style.css') return path.join(ROOT, 'app/style.css');
	if (pathname === '/tokens.css') return path.join(ROOT, 'app/tokens.css');   // H15.23: the colours style.css reads
	for (const [prefix, dir] of Object.entries(MOUNTS)) {
		if (pathname.startsWith(prefix)) return fileWithin(path.join(ROOT, dir), pathname.slice(prefix.length));
	}
	return null;
}

const server = http.createServer((req, res) => {
	if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
	if (req.url === '/health') return send(res, 200, 'ok');

	const file = resolveFile(new URL(req.url, 'http://localhost').pathname);
	return file ? sendFile(req, res, file) : notFound(res);
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => console.log(`[ lab ] serving on ${port} -- nothing is stored`));
