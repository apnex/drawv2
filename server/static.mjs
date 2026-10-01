/*
THE ONE STATIC RESPONDER -- H17 cut K9, shared by the product's server (server/app.js) and the lab's (lab/server.mjs).

Each had its own: the product two near-copies (`serveFrom` for a mounted folder, `serveStatic` for the client with its
deep links), the lab a third. Three copies of a traversal guard is how one of them comes to differ, and one did: the
product held a file inside its folder with `file.startsWith(baseDir)`, which a SIBLING folder sharing the prefix
(`/kernel2` beside `/kernel`) also passes; the lab bounded it with a separator. This holds the separator-bounded guard
for both.

What each server serves stays its own -- the product its mounts and deep links, the lab its declared mounts and the
planner files it names by hand. This owns only how a file is found inside a folder and how it is sent.

Its own layer, `serve` (tools/layers.mjs): Node-side, never served to a browser, and importable by the two servers --
the lab's layer may not import server-only code, which is why this is not simply a server module.
*/
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.json': 'application/json; charset=utf-8',
	'.ico': 'image/x-icon',
};

/*
The file a URL path names inside `base`, or null.

RESOLVED FIRST, then bounded: `path.normalize` collapses `..` before the check, and the check is on the absolute path,
not the URL text, so an encoded separator cannot walk past it. BOUNDED BY A SEPARATOR, so `/x/kernel2/a` is not inside
`/x/kernel`.
*/
export function fileWithin(base, rel) {
	const root = path.resolve(base);
	const file = path.normalize(path.join(root, rel));
	return file === root || file.startsWith(root + path.sep) ? file : null;
}

// 404 for anything that names no servable file -- a missing one, a folder, or a path that walked out of its folder:
// one status, so a probe learns nothing about what lies outside (H17 C6)
export function notFound(res) {
	res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
	res.end('not found');
}

// send a file, or 404. Always `no-store`: these are modules under active development, and a stale one is a wrong page.
export function sendFile(req, res, file) {
	if (!file) return notFound(res);
	fs.readFile(file, (err, data) => {
		if (err) return notFound(res);
		res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
		res.end(req.method === 'HEAD' ? undefined : data);
	});
}
