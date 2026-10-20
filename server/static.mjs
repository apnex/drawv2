/*
THE ONE STATIC RESPONDER -- H17 cut K9, shared by the product's server (server/app.js) and the lab's (lab/server.mjs).

Each had its own: the product two near-copies (`serveFrom` for a mounted folder, `serveStatic` for the client with its
deep links), the lab a third. Three copies of a traversal guard is how one of them comes to differ, and one did: the
product held a file inside its folder with `file.startsWith(baseDir)`, which a SIBLING folder sharing the prefix
(`/kernel2` beside `/kernel`) also passes; the lab bounded it with a separator. This holds the separator-bounded guard
for both.

What each server serves stays its own -- the product its mounts and deep links, the lab its declared mounts and the
planner files it names by hand. This owns only how a file is found inside a folder and how it is sent -- compressed, and
never kept by the browser (H24.16-1) -- and, since H26.1, the vendor mount both serve alike: a component's built files at a
versioned address, the only files a browser keeps (D7).

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
	'.map': 'application/json; charset=utf-8',   // H26.1: a component's source maps, which a browser's tools ask for
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

export function sendFile(req, res, file, { cache = 'no-store' } = {}) {
	if (!file) return notFound(res);
	fs.readFile(file, (err, data) => {
		if (err) return notFound(res);
		const type = MIME[path.extname(file)] || 'application/octet-stream';
		const send = (body, used) => {
			res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, Vary: 'Accept-Encoding',
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

/*
H26.1 (dev/design/components/SNAP-GRID.md section 7.6, D7) -- THE VENDOR MOUNT: `/vendor/@apnex/<name>@<version>/<file>`, served from
node_modules/@apnex/<name>/dist/<file>, for the import map the pages hold (tools/import-map.mjs).

One responder, which the product's server and the lab's each call in a line -- no entry in either's mounts, so the lab keeps its line
budget (L8) and the test that every folder it mounts is in the image (H17 C5) is unchanged: the files come from `npm ci`, not a COPY.
It serves only a package draw depends on (package.json `dependencies`) and only at the version installed (its own package.json),
read at each request, so a page naming another version -- one from before a deploy -- is answered 404 rather than another release's
file (B403); any other name, version or file is a 404, as every mount answers (H17 C6). The file is a plain path inside dist/ --
no empty, `.` or `..` segment, no escape, no backslash -- and is bounded by `fileWithin` as every mount is.

KEPT A YEAR, AND ONLY THESE (D7): an address that carries the version, of a release that is never replaced (H26-2), is never the
wrong file, so the browser may keep it; draw's own files and the page that holds the map stay `no-store` (H24.16-1), so a page reached
by Back or a restored session fetches a fresh map. Compressed as sendFile compresses every file.

Returns false for a path outside the mount, so a server goes on to its own routes; the path is the one the URL parser makes of the
request, dot segments resolved, as every handler reads it (H24.13).
*/
const ROOT = path.resolve(import.meta.dirname, '..');
const KEPT = 'public, max-age=31536000, immutable';
const VENDORED = /^\/vendor\/(@apnex\/[a-z0-9][a-z0-9._-]*)@([^/]+)(\/.*)$/;   // H26-2: each component is the package @apnex/<name>
const VENDORED_FILE = /^(?:\/(?!\.\.?(?:\/|$))[A-Za-z0-9._-]+)+$/;
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

export function sendVendored(req, res, root = ROOT) {
	let pathname;
	try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { return false; }
	if (!pathname.startsWith('/vendor/')) return false;
	const [, name, version, file] = VENDORED.exec(pathname) ?? [];
	const depended = name && Object.hasOwn(readJson(path.join(root, 'package.json'))?.dependencies ?? {}, name);
	const installed = depended ? readJson(path.join(root, 'node_modules', name, 'package.json')) : null;
	if (!installed || installed.name !== name || installed.version !== version || !VENDORED_FILE.test(file)) { notFound(res); return true; }
	sendFile(req, res, fileWithin(path.join(root, 'node_modules', name, 'dist'), file), { cache: KEPT });
	return true;
}
