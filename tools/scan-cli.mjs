#!/usr/bin/env node
/*
GR18 -- the tool can do everything the API can.

Agentic interaction with draw is through `cli/draw.mjs`, not raw HTTP, and that only means something
if the tool is complete. This derives the route inventory from `server/rest.js` -- the same
derivation GR10 uses to hold API.md -- and asserts a CLI verb reaches each one, or that its absence
is recorded with a reason.

Derived rather than restated on purpose. Four hand-maintained copies of a route list is how a CLI
drifts from its server, and H9 added an entire write surface the tool never learned while every
check stayed green (B117). A new endpoint now fails this until the tool can drive it.

PENDING is not ALLOW. An entry here is a route the tool is expected to gain and has not yet: the
list is a countdown, printed with its own count, and shrinks as verbs land. ALLOW is for a route
that is deliberately never a verb, and each needs a sentence saying why.
*/
import fs from 'node:fs';
import { inventory } from './routes.mjs';


// routes the tool will never carry, with the reason it would be wrong to
const ALLOW = {};

/*
Routes the tool deliberately does NOT wrap, with the reason, keyed by path so an entry names one
operation rather than a whole family.

Each of these is SUPERSEDED, not missing, and the distinction is the whole design: the entity routes
take pixels, and a cell cannot be off the grid where a pixel can, so a thin wrapper would re-open the
class of mistake B110 closed. Every one now has a contextual verb that commits through
`/diagrams/:id/commit` instead.

B133 is why the reasons below are specific rather than a repeated "as above". They used to read that
way, and eight identical notes hid the fact that half of them named work that had no verb AT ALL --
so a 20-node topology went in as one hand-authored `commit --ops` and re-derived cell-to-pixel, the
zone half-pitch, the id grammar and three invariants in a throwaway script. A deferral that does not
say what it costs is not a deferral, it is an omission with a comment on it.
*/
const PENDING = {
	'diagrams/:id/nodes': 'superseded by `draw add <type> at <cell>` and `draw place near|inside|between` (B110: a wrapper would take pixels)',
	// keyed by PATH, so one reason has to cover POST, PATCH and DELETE together. Where they differ,
	// the reason says so rather than letting the strongest case speak for all three.
	'diagrams/:id/nodes/:entity': 'PATCH superseded by `draw move` and `draw rename`; DELETE has NO verb -- removing an entity is still `commit --ops` with `{op:"del"}` (B133 remainder)',
	'diagrams/:id/links': 'superseded by `draw link <src> <dst> --via <cell>`, which mints the waypoints a bend needs (B133)',
	'diagrams/:id/links/:entity': 'no verb yet: re-routing an existing link. `draw link` replaces it; `commit --ops` edits it',
	'diagrams/:id/zones': 'superseded by `draw zone <name> from <cell> to <cell>`, which owns the half-pitch offset (B133)',
	'diagrams/:id/zones/:entity': 'PATCH partly superseded by `draw rename`; resizing and DELETE have no verb (B133 remainder)',
	'diagrams/:id/groups': 'superseded by `draw group <name> <ref> <ref>` (B133)',
	'diagrams/:id/groups/:entity': 'PATCH partly superseded by `draw rename`; membership changes and DELETE have no verb (B133 remainder)',
};



/*
Coverage is now per ROUTE AND METHOD (B119).

It used to be per family, so `draw link path` reaching `GET /links/<id>/path` marked `links` covered
while `POST /links` did not exist -- a floor dressed as a guarantee. `server/routes.mjs` declares
the pairs and `tests/routes.test.js` proves each one against a running server, so the target is a
fact rather than an inference. Two attempts at inferring methods from the router are recorded in
tools/routes.mjs; the second reported `diagrams` as write-only.

Paths are normalised because the two sides name placeholders differently -- the router declares
`:id`, a verb declares `<id>` -- and neither spelling is more correct than the other.
*/
const { ROUTES } = await import('../server/routes.mjs');
const { VERBS } = await import('../cli/verbs.mjs');
const norm = (p) => String(p).replace(/^\//, '').replace(/<[^>]+>|:[a-z]+/gi, '*');

const declared = new Set();
for (const v of VERBS) {
	if (!v.summary || !v.example) {
		console.error(`\n  FAIL — verb \`${v.name}\` has no ${v.summary ? 'example' : 'summary'}. CLI.md: both are mandatory.`);
		process.exit(1);
	}
	declared.add(`${v.method || 'GET'} ${norm(v.route)}`);
	// a composite verb reaches more than one pair, and all of them count as covered
	for (const a of v.also || []) { const [m, pth] = a.split(' '); declared.add(`${m} ${norm(pth)}`); }
}

const pairs = ROUTES.flatMap((r) => r.methods.map((m) => ({ key: `${m} ${norm(r.path)}`, path: r.path, method: m })));
const unreached = pairs.filter((p) => !declared.has(p.key));
const routes = inventory();
const reached = new Set(routes.filter((r) => [...declared].some((d) => d.includes(`/${r}`) || d.endsWith(` ${r}`))));

/*
The reverse direction: a route a VERB declares must be one the server has -- B132.

Everything above asks whether each declared route is reached by some verb. Nothing asked the
opposite, so a verb could name a route that does not exist and the count would still read clean:
`draw health` declared `/health`, the matcher found `health` in ROUTES, and the pair was counted
covered while the verb asked for `<prefix>/health` and collected a 404 in every configuration.

Declaration compared against declaration is the fault B119 closed for methods and left open for
paths. The server's own surface is the authority here, and `tests/routes.test.js` proves that
surface against a running process, so a verb agreeing with it is a fact rather than an inference.
*/
const known = new Set(ROUTES.map((r) => norm(r.path)));
/*
Two paths sit OUTSIDE the versioned surface by design, and `server/routes.mjs` says so: it declares
paths relative to the version prefix, and these are not relative to anything.

`/d/<id>.svg` is the picture, reached through its own door entry (`/connect/d/` -> `/d/`, B101).
The root `/health` is the liveness contract that Cloud Run and the Dockerfile probe, and it stays
uncredentialed for that reason -- B132 gave the agent a prefix-relative `health` beside it rather
than moving the probe. Listing `/d/<id>.svg` in ROUTES would make that file's own stated rule false.
*/
const OFF_SURFACE = new Set(['d/*.svg']);
const invented = [];
for (const v of VERBS) {
	for (const d of [v.route, ...(v.also || [])]) {
		if (!d) continue;
		const path = norm(String(d).replace(/^[A-Z]+\s+/, ''));
		if (!known.has(path) && !OFF_SURFACE.has(path)) {
			invented.push(`${v.name} declares ${d}, which server/routes.mjs does not have`);
		}
	}
}
for (const line of invented) console.log(`  \u2717 ${line}`);

const missing = unreached.filter((p) => !ALLOW[p.path] && !PENDING[p.path]);
const pending = unreached.filter((p) => PENDING[p.path]);
const stale = Object.keys(PENDING).filter((p) => !unreached.some((u) => u.path === p));

for (const p of pending) console.log(`  PENDING    ${p.method} /${p.path}\n             \u2514 ${PENDING[p.path]}`);
console.log(`  scan-cli: ${pairs.length} route+method pair(s); ${pairs.length - unreached.length} reached, ${pending.length} pending, ${missing.length} unaccounted`);

if (stale.length) {
	console.error(`\n  FAIL — ${stale.length} entr(y/ies) listed PENDING that the CLI already reaches: ${stale.join(', ')}.`);
	console.error('  Delete the line: PENDING is a countdown, and a stale entry hides the progress it was meant to show.');
	process.exit(1);
}
if (missing.length || invented.length) {
	console.error(`\n  FAIL — ${missing.length} pair(s) no CLI verb reaches and nothing accounts for:`);
	for (const p of missing) console.error(`    ${p.method} /${p.path}`);
	console.error('  GR18: add a verb, or record it in PENDING with the work, or in ALLOW with the reason.');
	process.exit(1);
}
console.log('  PASS — every route+method pair is reached, pending with recorded work, or allowed with a reason');
