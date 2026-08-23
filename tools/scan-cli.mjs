#!/usr/bin/env node
/*
GR18 -- the tool can do everything the API can.

Agentic interaction with draw is through `cli/draw.sh`, not raw HTTP, and that only means something
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
const CLI = 'cli/draw.sh';

// routes the tool will never carry, with the reason it would be wrong to
const ALLOW = {
	oauth2callback: 'a browser redirect target in the OAuth dance, not an operation anyone invokes',
	health: 'covered: `draw health` already reaches it',
};

/*
Routes the tool is expected to gain. Every line is work not yet done, and deleting a line is how
the work is recorded as finished -- so this list only ever shrinks, and the gate says by how much.
*/
const PENDING = {
	commit: 'batch transactions -- CLI.md Writing',
	lock: 'the write slot -- CLI.md Writing',
	undo: 'CLI.md Writing', redo: 'CLI.md Writing',
	selection: 'authoritative selection -- CLI.md Writing',
	layouts: 'the named grids -- CLI.md Placement',
	nearest: 'anchor nearest <x> <y> -- CLI.md Placement',
	anchors: 'anchor free -- CLI.md Placement',
	grants: 'per-diagram access -- CLI.md Access',
	workspace: 'workspace grants, codes, agents, viewers -- CLI.md Access and Awareness',
	agents: 'CLI.md Awareness', viewers: 'CLI.md Awareness',
	codes: 'connection codes -- CLI.md Access',
	nodes: 'high-level node verbs -- CLI.md Writing',
	links: 'CLI.md Writing', zones: 'CLI.md Writing', groups: 'CLI.md Writing', waypoints: 'CLI.md Writing',
	diagrams: 'covered for reads; create and delete are CLI.md Lifecycle',
};

const rest = fs.readFileSync(REST, 'utf8');
const cli = fs.readFileSync(CLI, 'utf8');

const collections = (rest.match(/const COLLECTIONS = \{([^}]*)\}/)?.[1].match(/(\w+):/g) || [])
	.map((k) => k.slice(0, -1));
const named = [...rest.matchAll(/parts\[\d+\] === '([a-z0-9]+)'/g)].map((m) => m[1]);
const routes = [...new Set([...collections, ...named])].sort();

/*
A verb "reaches" a route when the CLI issues a REQUEST naming that segment -- not merely when the
string appears in the file. The first version of this matched anywhere, and counted `/undo` in a
comment explaining that the CLI does NOT undo. A check that reads prose as coverage reports the
opposite of the truth.
*/
const requests = cli.split('\n')
	.filter((l) => !/^\s*#/.test(l))
	.filter((l) => /\$\{APIHOST\}/.test(l))
	.join('\n');
const reached = new Set(routes.filter((r) => new RegExp(`/${r}\\b`).test(requests)));

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
