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

const REST = 'server/rest.js';

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
	nodes: 'high-level node verbs -- CLI.md Writing',
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

const rest = fs.readFileSync(REST, 'utf8');

/*
The inventory, and it must be WIDER than GR10's.

GR10 matches `parts[n] === 'x'` only, which misses two shapes the router actually uses: a literal
`url.pathname === '/health'`, and the NEGATIVE form `parts[2] !== 'diagrams'` that guards the whole
diagram family. Inheriting that derivation reported the CLI reaching 1 route of 21 while it plainly
reached three, because the two it covered best were the two the pattern could not see.

`v1` is dropped: it is the version prefix every path carries, not a route anyone drives.
*/
const collections = (rest.match(/const COLLECTIONS = \{([^}]*)\}/)?.[1].match(/(\w+):/g) || [])
	.map((k) => k.slice(0, -1));
const named = [...rest.matchAll(/parts\[\d+\] [!=]== '([a-z0-9]+)'/g)].map((m) => m[1]);
const literal = [...rest.matchAll(/url\.pathname === '\/([a-z0-9]+)'/g)].map((m) => m[1]);
const routes = [...new Set([...collections, ...named, ...literal])].filter((r) => !['v1', 'api'].includes(r)).sort();

/*
KNOWN COARSENESS, stated rather than implied (B119).

Coverage is per path SEGMENT, so a verb reaching `GET /links/<id>/path` marks `links` covered while
`POST /links` -- the high-level create verb -- still does not exist. The check is therefore a floor:
it proves no route family is entirely unreachable, and does not prove every method on one is driven.
Saying so here because a scanner whose header over-claims is the defect this codebase keeps finding,
and the honest fix needs method-aware route extraction from a router that branches on `req.method`
in several shapes.

Coverage is read from the MANIFEST, not grepped out of the tool's source.

The shell version could only be checked by pattern-matching its text, and the first attempt counted
`/undo` inside a comment explaining that the CLI does NOT undo -- a coverage check reading prose and
reporting the exact opposite of the truth. Each verb now DECLARES the route it reaches, so this
compares two lists instead of guessing at one.
*/
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
