/*
THE ONE STATIC RESPONDER -- H17 cut K9, shared by the product's server (server/app.js) and the lab's (lab/server.mjs).

Each had its own: the product two near-copies (`serveFrom` for a mounted folder, `serveStatic` for the client with its
deep links), the lab a third. Three copies of a traversal guard is how one of them comes to differ, and one did: the
product held a file inside its folder with `file.startsWith(baseDir)`, which a SIBLING folder sharing the prefix
(`/kernel2` beside `/kernel`) also passes; the lab bounded it with a separator. This holds the separator-bounded guard
for both.

What each server serves stays its own -- the product its mounts and deep links, the lab its declared mounts and the
planner files it names by hand. This owns only how a file is found inside a folder and how it is sent -- compressed, and
never kept by the browser (H24.16-1).

Its own layer, `serve` (tools/layers.mjs): Node-side, never served to a browser, and importable by the two servers --
the lab's layer may not import server-only code, which is why this is not simply a server module.
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

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

/*
B386 (H24.16, H24.16-1) -- send a file compressed, and never let the browser keep it.

It was sent as written, so every visit downloaded the page's files at full size, about 1,041 KB with its stylesheets. Text over
512 bytes now goes brotli or gzip, as the request's Accept-Encoding allows (a coding at q=0 refused), about 407 KB. It stays
`no-store`: a browser keeping a module, even one it asks about on every use, runs the old one after a deploy when the page is
reached by Back or a restored session -- it does not ask then -- and the page's version check cannot see it (H24.16's first build,
refused by its verification). Keeping files waits for versioned addresses (B398).
The coded bytes are kept with a hash of the file's content, so each is made once per content per process -- or a few times, if
several first requests arrive at once -- and a changed file is never answered with the coding of its old content.
*/
const COMPRESSIBLE = /^(text\/|image\/svg\+xml|application\/json)/;
const WORTH_COMPRESSING = 512;
const CODINGS = [
	{ name: 'br', code: (data, done) => zlib.brotliCompress(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }, done) },
	{ name: 'gzip', code: (data, done) => zlib.gzip(data, done) },
];
const CODED = new Map();   // file -> { hash, coded: { br, gzip } }

// whether a request's Accept-Encoding allows a coding: named with no q, or with a q above zero
function accepts(header, coding) {
	for (const part of String(header || '').split(',')) {
		const [name, ...params] = part.split(';').map((x) => x.trim());
		if (name.toLowerCase() !== coding) continue;
		const q = params.find((x) => /^q=/i.test(x));
		return !q || Number(q.slice(2)) > 0;
	}
	return false;
}

export function sendFile(req, res, file) {
	if (!file) return notFound(res);
	fs.readFile(file, (err, data) => {
		if (err) return notFound(res);
		const type = MIME[path.extname(file)] || 'application/octet-stream';
		const send = (body, used) => {
			res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', Vary: 'Accept-Encoding',
				...(used ? { 'Content-Encoding': used.name } : {}), 'Content-Length': body.length });
			res.end(req.method === 'HEAD' ? undefined : body);
		};
		const coding = COMPRESSIBLE.test(type) && data.length > WORTH_COMPRESSING
			? CODINGS.find((c) => accepts(req.headers['accept-encoding'], c.name)) : null;
		if (!coding) return send(data, null);
		const hash = crypto.createHash('sha256').update(data).digest('base64url');
		let kept = CODED.get(file);
		if (!kept || kept.hash !== hash) { kept = { hash, coded: {} }; CODED.set(file, kept); }
		if (kept.coded[coding.name]) return send(kept.coded[coding.name], coding);
		coding.code(data, (codeErr, body) => {
			if (codeErr) return send(data, null);   // never fail a file for want of compression
			kept.coded[coding.name] = body;
			send(body, coding);
		});
	});
}
