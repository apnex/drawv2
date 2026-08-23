#!/usr/bin/env node
/*
The route inventory, derived once (B118).

Two scanners needed to know what the server answers, and each worked it out for itself. They
disagreed: GR10 matched `parts[n] === 'x'` only, and so could not see `url.pathname === '/health'`
or the NEGATIVE `parts[2] !== 'diagrams'` that guards the whole diagram family -- the two most-used
surfaces in the product were the two its check could not see, while its header claimed to hold
every REST path. scan-cli inherited the same derivation, reported the CLI reaching 1 route of 21
when it plainly reached three, and only surfaced the problem because wrong ARITHMETIC is visible
where a wrong claim is not.

Two derivations of one truth is the twin problem this codebase keeps finding, so there is now one.

NAMES ONLY, deliberately (B119). Attributing a METHOD to each route was attempted twice here and
abandoned: by position, which mislabelled the whole workspace family because `handleWorkspace` sits
above `handleWrite` and branches internally; and by nearest guard, which then reported `diagrams` as
write-only -- the most-used read in the product. A coverage gate fed a wrong mode would demand a
write verb for a read-only route, so the check would be lying in the direction that costs work.

The honest fix is for the router to DECLARE its methods rather than have them inferred from control
flow, and that is a change to `server/rest.js` rather than to this file. Until then this reports
what it can prove: which route families exist. B119 records the gap.
*/
import fs from 'node:fs';

const SRC = 'server/rest.js';
// prefixes every path carries; they name a version and a family, not an operation anyone drives
const NOT_ROUTES = new Set(['v1', 'api', 'connect']);

export function inventory(src = fs.readFileSync(SRC, 'utf8')) {
	const found = new Set();
	const add = (name) => { if (!NOT_ROUTES.has(name)) found.add(name); };

	// the entity collections the router dispatches on
	for (const key of (src.match(/const COLLECTIONS = \{([^}]*)\}/)?.[1].match(/(\w+):/g) || [])) {
		add(key.slice(0, -1));
	}
	// named segments, positive AND negative -- the negative form guards the diagram family
	for (const m of src.matchAll(/parts\[\d+\] [!=]== '([a-z0-9]+)'/g)) add(m[1]);
	// literal pathname routes, which carry no `parts` at all
	for (const m of src.matchAll(/url\.pathname === '\/([a-z0-9]+)'/g)) add(m[1]);

	return [...found].sort();
}


if (import.meta.url === `file://${process.argv[1]}`) {
	const rows = inventory();
	for (const r of rows) console.log(`  ${r}`);
	console.log(`  ${rows.length} route(s)`);
}
