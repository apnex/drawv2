/*
THE ONE STATIC RESPONDER -- H17 cut K9, shared by the product's server (server/app.js) and the lab's (lab/server.mjs).

Each had its own: the product two near-copies (`serveFrom` for a mounted folder, `serveStatic` for the client with its
deep links), the lab a third. Three copies of a traversal guard is how one of them comes to differ, and one did: the
product held a file inside its folder with `file.startsWith(baseDir)`, which a SIBLING folder sharing the prefix
(`/kernel2` beside `/kernel`) also passes; the lab bounded it with a separator. This holds the separator-bounded guard
for both.

What each server serves stays its own -- the product its mounts and deep links, the lab its declared mounts and the
planner files it names by hand. This owns only how a file is found inside a folder and how it is sent -- compressed, and
kept by the browser while it asks whether the file changed (H24.16).

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
B386 (H24.16) -- send a file compressed, and let the browser keep it while it asks whether it changed.

It was always `no-store` and never compressed, so every visit downloaded the page's 134 modules again, about 974 KB. Now:
  COMPRESSED  brotli or gzip, as the request's Accept-Encoding allows (a coding at q=0 is refused), for text over 512 bytes;
              the coded bytes kept with the file, so each is made once per file per process.
  KEPT        `no-cache` and a strong ETag of the file's content: the browser keeps it and asks on every use, and an
              unchanged file is answered 304 with no body. A stale module is still never served -- it is the wrong page
              -- because the question is always asked, so a deploy reaches every tab at once.
A file's cached content is keyed by its size and modified time, so a file that changes on disk is read again.
*/
const COMPRESSIBLE = /^(text\/|image\/svg\+xml|application\/json)/;
const WORTH_COMPRESSING = 512;
const CODINGS = [
	{ name: 'br', suffix: 'br', code: (data, done) => zlib.brotliCompress(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }, done) },
	{ name: 'gzip', suffix: 'gz', code: (data, done) => zlib.gzip(data, done) },
];
const KEPT = new Map();   // file -> { size, mtimeMs, data, tag, coded: { br, gzip } }

// whether a request's Accept-Encoding allows a coding: named with no q, or with a q above zero
function accepts(header, coding) {
	for (const part of String(header || '').split(',')) {
		const [name, ...params] = part.split(';').map((x) => x.trim());
		if (name.toLowerCase() !== coding) continue;
		const q = params.find((x) => x.startsWith('q='));
		return !q || Number(q.slice(2)) > 0;
	}
	return false;
}

// whether If-None-Match names this content, in any coding, strong or weak -- the comparison RFC 9110 gives it
function unchanged(header, tag) {
	return String(header || '').split(',').map((t) => t.trim().replace(/^W\//, '').replace(/-(?:br|gz)"$/, '"'))
		.some((t) => t === '*' || t === tag);
}

function kept(file, done) {
	fs.stat(file, (err, st) => {
		if (err || !st.isFile()) return done(err || new Error('not a file'));
		const had = KEPT.get(file);
		if (had && had.size === st.size && had.mtimeMs === st.mtimeMs) return done(null, had);
		fs.readFile(file, (readErr, data) => {
			if (readErr) return done(readErr);
			const tag = `"${crypto.createHash('sha256').update(data).digest('base64url').slice(0, 27)}"`;
			const entry = { size: st.size, mtimeMs: st.mtimeMs, data, tag, coded: {} };
			KEPT.set(file, entry);
			done(null, entry);
		});
	});
}

export function sendFile(req, res, file) {
	if (!file) return notFound(res);
	kept(file, (err, entry) => {
		if (err) return notFound(res);
		const type = MIME[path.extname(file)] || 'application/octet-stream';
		const coding = COMPRESSIBLE.test(type) && entry.data.length > WORTH_COMPRESSING
			? CODINGS.find((c) => accepts(req.headers['accept-encoding'], c.name)) : null;
		const tag = coding ? entry.tag.replace(/"$/, `-${coding.suffix}"`) : entry.tag;
		const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: tag, Vary: 'Accept-Encoding' };
		if (unchanged(req.headers['if-none-match'], entry.tag)) {
			res.writeHead(304, headers);
			return res.end();
		}
		const send = (body, used) => {
			const sent = used ? { ...headers, 'Content-Encoding': used.name } : { ...headers, ETag: entry.tag };
			res.writeHead(200, { ...sent, 'Content-Length': body.length });
			res.end(req.method === 'HEAD' ? undefined : body);
		};
		if (!coding) return send(entry.data, null);
		if (entry.coded[coding.name]) return send(entry.coded[coding.name], coding);
		coding.code(entry.data, (codeErr, body) => {
			if (codeErr) return send(entry.data, null);   // never fail a file for want of compression
			entry.coded[coding.name] = body;
			send(body, coding);
		});
	});
}
