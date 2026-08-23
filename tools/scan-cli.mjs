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
const ALLOW = {
	oauth2callback: 'a browser redirect target in the OAuth dance, not an operation anyone invokes',
};

/*
Routes the tool is expected to gain. Every line is work not yet done, and deleting a line is how
the work is recorded as finished -- so this list only ever shrinks, and the gate says by how much.
*/
const PENDING = {
	sync: 'the Slides sync route behind `draw push`',
	slides: 'the Slides projection target -- CLI.md Projection',
	nodes: 'reachable by commit --ops, and by `draw add` / `draw place`; no pixel-taking wrapper, see above',
	/*
	The entity-write routes stay unwrapped, deliberately (ruled 2026-08-23).

	`draw add <type> at <cx>,<cy>` and `draw place <type> near|inside|between` cover the same
	ground and cover it better: an anchor cannot be off the grid where a pixel can, so a thin
	`POST /nodes --x 130` wrapper would re-open the exact class of mistake B110 closed. `commit
	--ops` remains the exact escape hatch for anything the two verbs cannot say.

	Listed here rather than deleted because a route the tool declines to wrap should say so.
	*/
	groups: 'reachable by commit --ops; no wrapper, see above',
	waypoints: 'reachable by commit --ops; no wrapper, see above',
};



/*
KNOWN COARSENESS, stated rather than implied (B119).

Coverage is per route FAMILY, so a verb reaching `GET /links/<id>/path` marks `links` covered while
`POST /links` does not exist. The check is a floor: it proves no family is entirely unreachable, not
that every method on one is driven. Method-aware extraction was attempted and abandoned -- see
tools/routes.mjs for why, and B119 for the fix, which belongs in the router.
*/
const routes = inventory();

const { VERBS } = await import('../cli/verbs.mjs');
const declared = new Set();
for (const v of VERBS) {
	if (!v.summary || !v.example) {
		console.error(`\n  FAIL — verb \`${v.name}\` has no ${v.summary ? 'example' : 'summary'}. CLI.md: both are mandatory.`);
		process.exit(1);
	}
	for (const seg of String(v.route).split('/')) if (seg && !seg.startsWith('<')) declared.add(seg);
}
const reached = new Set(routes.filter((r) => declared.has(r)));

const missing = routes.filter((r) => !reached.has(r) && !ALLOW[r] && !PENDING[r]);
const pending = routes.filter((r) => !reached.has(r) && PENDING[r]);
const stale = Object.keys(PENDING).filter((r) => reached.has(r));

for (const r of pending) console.log(`  PENDING    /${r}\n             └ ${PENDING[r]}`);
for (const r of Object.keys(ALLOW).filter((k) => routes.includes(k))) {
	console.log(`  allowed    /${r}\n             └ ${ALLOW[r]}`);
}
console.log(`  scan-cli: ${routes.length} route(s); ${reached.size} reached, ${pending.length} pending, ${missing.length} unaccounted`);

if (stale.length) {
	console.error(`\n  FAIL — ${stale.length} route(s) are listed PENDING but the CLI already reaches them: ${stale.join(', ')}.`);
	console.error('  Delete the line: PENDING is a countdown, and a stale entry hides the progress it was meant to show.');
	process.exit(1);
}
if (missing.length) {
	console.error(`\n  FAIL — ${missing.length} route(s) no CLI verb reaches and nothing accounts for: ${missing.join(', ')}.`);
	console.error('  GR18: add a verb, or record it in PENDING with the work, or in ALLOW with the reason.');
	process.exit(1);
}
console.log('  PASS — every route is reached, pending with recorded work, or allowed with a reason');
