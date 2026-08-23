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

The high-level entity verbs take pixels. `draw add <type> at <cx>,<cy>` and `draw place <type>
near|inside|between` cover the same ground and cover it better, because a cell cannot be off the
grid where a pixel can -- a thin wrapper would re-open the class of mistake B110 closed. `commit
--ops` stays the exact escape hatch for anything the two verbs cannot say.
*/
const PENDING = {
	'diagrams/:id/nodes': 'superseded by draw add / draw place; a pixel-taking wrapper would re-open B110',
	'diagrams/:id/nodes/:entity': 'as above; a move is a commit --ops, or draw place on a free anchor',
	'diagrams/:id/links': 'as above; draw place --link creates the common case',
	'diagrams/:id/links/:entity': 'as above',
	'diagrams/:id/zones': 'as above; zones sit on the half-offset grid, which an anchor verb should own',
	'diagrams/:id/zones/:entity': 'as above',
	'diagrams/:id/groups': 'as above',
	'diagrams/:id/groups/:entity': 'as above',
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
if (missing.length) {
	console.error(`\n  FAIL — ${missing.length} pair(s) no CLI verb reaches and nothing accounts for:`);
	for (const p of missing) console.error(`    ${p.method} /${p.path}`);
	console.error('  GR18: add a verb, or record it in PENDING with the work, or in ALLOW with the reason.');
	process.exit(1);
}
console.log('  PASS — every route+method pair is reached, pending with recorded work, or allowed with a reason');
