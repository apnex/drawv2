#!/usr/bin/env node
/*
scan-dead — H5/C1. Every exported symbol earns its existence from a real consumer.

Two populations, two rules, and they are NOT the same rule (H9.23/B91). An EXPORT is judged on
consumers outside its origin file, because the module is its boundary. A public METHOD of an
exported class is judged on whether anything calls it at all, origin included, because the class
is its boundary and `this.helper()` is inside it. Applying the export rule to methods reports 118
of 293 and means nothing. The method half is scoped to the server and the sovereign substrates,
because the client dispatches handlers by name from a table and no text-derived call graph can
see that.

A3 *Earned Exposure*: a concern earns an internal boundary by being one concern; it earns promotion
to a stable, depended-upon surface only when a real consumer outside its origin needs it. An export
with no consumer is a *Speculative Surface* — versioning and comprehension cost the system does not
yet owe. A3 also calls ceremony and scaffolding defects rather than neutral cost.

The scan reports three states, because "unreferenced" is not one thing:

  DEAD        no reference anywhere but its own definition
  TEST-ONLY   referenced only from tests/ — either a deliberate seam (GR4 precedent: writeDoc, now,
              flushMs exist so crash and durability tests are runnable AT ALL) or production code
              that lost its caller. The scan cannot tell those apart; a human must.
  LIVE        referenced from production

TEST-ONLY is deliberately not a failure. Collapsing it into DEAD would delete the injection seams
the test suite is built on; collapsing it into LIVE would hide code whose last real caller is gone.

ALLOW is the durable record of every judged exception, with the reason in the file. An entry with no
reason is not an exception, it is an oversight that learned to hide.

Usage: node tools/scan-dead.mjs [--verbose]
*/

import fs from 'node:fs';
import path from 'node:path';
import { SCANNER_ROOTS } from './layers.mjs';

// the folder lists live in the layer manifest (H17 K0), so a new folder is added in one place
const PROD = SCANNER_ROOTS.dead;
const TESTS = ['tests'];
const EXT = /\.(js|mjs)$/;

// symbol -> why it has no production consumer. Reviewed at each milestone close.
const ALLOW = {
	'network/pipeset.mjs:createPipeSet': 'the session pipe set, which no page reads since H17.22 N-c put pipes in the model; kept one stage as the oracle the planner corpus holds the pipe reactions to, and deleted with this entry at N-d.',
	'tools/scan-skips.mjs:skipsIn': 'the TAP parser behind B250`s skip check. Its production caller is the CLI half of the same file, so the export earns its keep from tests/scan-skips.test.js, which drives it on written TAP -- nested subtests, todo, reasons -- without needing a machine that lacks Chrome.',
	// K12 (2026-10-01): exports the deleted barrels had hidden, each kept for its own reason; the rest were deleted or un-exported.
	'engine/kinds.mjs:MOVERS': 'the mover kinds table; `moverFor` reads it in this module. Exported so tests/rules.test.js asserts every kind against the table itself rather than a copy that would drift.',
	'engine/kinds.mjs:TOWERS': 'the tower kinds table; `towerFor` reads it in this module. Exported so the rule tests assert placement and combat against the table itself.',
	'engine/movers.mjs:MAX_MOVERS_PER_SPAWNER': 'the per-spawner cap `moversAt` applies in this module. Exported so tests/movers.test.js proves the bound holds against the number the module uses, as SESSIONS_KEPT is.',
	'engine/movers.mjs:positionOf': 'H12.3, delivered: where ONE mover is without building the set -- the query a tower asks. No production caller yet; tests/movers.test.js holds that it agrees with `moversAt`. Deleting it reverses a delivered milestone, which is a ruling, not a cleanup.',
	'engine/rules.mjs:DERIVATIONS': 'the derivation rows `factsAt` runs in this module. Exported so tests/rules.test.js asserts the rows themselves.',
	'engine/rules.mjs:factsAt': 'the facts at a tick, called by `combatAt` in this module. Exported so tests/rules.test.js checks the facts before combat folds them.',
	'kernel/adapt.mjs:schemaToDoc': 'the inverse of `docToSchema`. Its doc -> schema -> doc round trip in tests/span.test.js is the proof that the export adapter keeps geometry (B28), so the test is its consumer.',
	'kernel/geometry.mjs:cellOn': 'cell from a pixel on a layout, used by `nearestAnchor` in this module. Exported so tests/grid.test.js asserts the layout offset directly.',
	'kernel/geometry.mjs:pxOn': 'pixel from a cell on a layout, used by `anchorAt` in this module. Exported so tests/grid.test.js asserts the zone half-pitch offset directly.',
	'kernel/geometry.mjs:px': 'one axis, cell to pixel, used throughout this module. Exported so tests/engine.test.js asserts placement in pixels without restating the pitch.',
	'kernel/network-appearance.mjs:linkDash': 'a link`s dash, used by `linkAppearance` in this module. Exported so tests/span.test.js asserts the control-link dash on its own.',
	'kernel/network-roles.mjs:linkFacing': 'which way a link runs at a point, used by `waypointRoles` in this module. Exported because tests hold it and its twin in model/invariants.mjs to one answer (model/invariants.mjs says so).',
	'kernel/network-appearance.mjs:waypointAnchor': 'the plain anchor ring, used by `waypointLayers` in this module. Exported so tests/span.test.js asserts each layer of a waypoint on its own.',
	'kernel/network-appearance.mjs:waypointJunction': 'the junction mark, used by `waypointLayers` in this module. Exported for the same per-layer assertions.',
	'kernel/network-appearance.mjs:waypointStyle': 'a waypoint ring by role, used by `waypointLayers` in this module. Exported for the same per-layer assertions.',
	'kernel/network-roles.mjs:waypointRole': 'the single role of a waypoint, over `waypointRoles`. Moved, not deleted, by K13a when geometry splits (dev/design/h17/PLAN.md, condition C11); tests/span.test.js holds it until then.',
	'kernel/svg-scene.mjs:renderContentRegion': 'one content region as SVG, used by the node renderer in this module. Exported so tests/display.test.js and tests/span.test.js assert a region on its own.',
	'kernel/svg-scene.mjs:renderElement': 'one resolved element as SVG -- the per-entity path app/src/palette.js names as the better design once a DOM shim exists. Tests render single elements through it.',
	'server/sessionlog.mjs:OPENING_KEPT': 'the bound on how many of a session FIRST events are kept forever. Exported so tests/sessionlog.test.js asserts against the number the module uses; the property under test is that a flood cannot overwrite the opening, which the test can only check by knowing where the opening stops.',
	'server/sessionlog.mjs:SESSIONS_KEPT': 'the bound on how many finished sessions are remembered. Exported so tests/sessionlog.test.js asserts the ring against the number the module actually uses; a copy in the test would drift, and the property under test is precisely that neither ring grows without bound.',
	'server/sessionlog.mjs:EVENTS_PER_SESSION': 'the bound on the per-session event narrative, exported for the same reason as SESSIONS_KEPT. The test that matters proves the COUNT survives trimming, and it can only prove that by knowing where trimming starts.',
	'cli/draw.mjs:main': 'the tool`s entry point. Its production caller is the `import.meta.url` guard at the bottom of the same file, so the export earns its keep from tests -- and it must, because a CLI tested only by spawning a subprocess is a CLI whose failures arrive as exit codes and stdout diffs. Driving `main` directly is how a verb`s behaviour is asserted rather than its formatting.',
	'cli/verbs.mjs:columnsFor': 'the rule that a table shows what the entities actually CARRY, rather than a column list someone remembered to update. Its production callers are `get` and `show` in this same file, so the export earns its keep from the test -- and it must, because the property under test is universal over kinds and fields. `flow` shipped into the schema, the canvas and the exported SVG while the CLI showed four fixed columns, and an agent that cannot read a field through the tool reaches for `--json | python3`, which is routing around the CLI rather than extending it. Driving the two verbs end to end would assert the current fields; driving the rule asserts that the NEXT one is covered without editing anything.',
	'cli/verbs.mjs:SETTABLE': 'what `set` can write, per kind, and how a word becomes a stored value. Its production callers are `set` and `link` in this same file, so the export earns its keep from the test -- and it must, because the property under test is that the table AGREES WITH THE TAXONOMY. `flow` and `control` reached the document, the canvas and the export while `set` refused them from a flat closed list, so the tool could see a declaration it could not make; the test sweeps `OPTIONAL` in model/shape.mjs and fails on any optional scalar the table has not got, which it can only do if the table is reachable. The CLI cannot import that taxonomy -- B138 ships this file standalone -- so a restated table is the only option and a drift guard is the price.',
	'cli/verbs.mjs:parityOf': 'the A5 parity RULE, separated from the plumbing that fetches the three views. Its production caller is the `parity` verb in this same file, so the export earns its keep from tests -- and it must. The comparison was inline first, and the only test driving it used a diagram the tool had just built, which agrees with itself by construction: deleting either half of the comparison left the suite green. A parity check that has only ever seen parity is the same unverified claim it exists to refute, so the rule has to be reachable with a disagreement handed straight to it.',
	'model/reveal.mjs:TRACE_MS': 'the ruled trace duration, asserted so a test proves the DEFAULT is 500ms rather than whatever traceOf happens to return. Its production consumer is traceOf in the same file, so the export earns its keep from the test -- and it must, because the number is a director ruling and a floor-style assertion would let it drift.',
	'model/reveal.mjs:FADE_MS': 'the ruled fade duration. Deliberately has no JS consumer: a node fades via a CSS transition, because nothing in JS needs to know how long a browser interpolates an opacity. Declared beside TRACE_MS so the two ruled numbers read together, and app/style.css names this file so a reader of either finds the other.',
	'server/routes.mjs:families': 'the route FAMILIES the surface declares, compared in tests/routes.test.js against the names tools/routes.mjs derives from the router. Its whole job is to let one derivation check the other, so its only caller is the test that does the checking -- promoting it into production would mean the server consulting a list it is itself the source of.',
	'server/app.js:sweepLocks': 'everything a lapsed lock must tell somebody. Its only production caller is the sweep timer in `createApp`, in this same file, so the export earns its keep from tests -- the same shape as `iapIdentity` below and for the same reason. It exists as a named export precisely BECAUSE the arrow it replaced could not be tested: every test in the suite released its lock explicitly, so expiry was the one path nothing reached, and B115 shipped a stale agent indicator through that gap. Inlining it again would retire the test that proves a timed-out lock still clears the indicator.',
	'server/identity.mjs:iapIdentity': 'the IAP mechanism itself. H9.25 made `identitySource()` the only production caller, and it lives in this same file, so the export now earns its keep entirely from tests -- deliberately. This function is where twelve distinct refusals live (bad signature, wrong audience, wrong issuer, alg:none, expired, no email claim), each of which is a security boundary, and reaching them through `identitySource` would mean plumbing environment variables through every one. The alternative is not testing them directly, which is worse than an entry in this table.',
	'server/identity.mjs:jwkSource': 'as above -- injectable so the verifier can be tested against a locally generated key rather than a captured token.',
	'kernel/fixtures.mjs:FIXTURES': 'canonical reference scenes — consumed by the spec viewer and by eye, not by code',
	'app/src/commands.js:resizeNodeSpan': 'used internally by the Shift+arrow span builder (commands.js:333); exported so the W1 authoring gesture can be driven directly in a test rather than through a synthesised keystroke.',
	'app/src/help.js:eventsFor': 'the GATE instrument that keeps the generated help truthful: tests/help.test.js turns every documented input back into an event and asserts the row it documents really matches it, so the overlay can never claim a key the tables do not bind. The overlay itself shows the input as written (`shown`); only the proof needs the events.',
	'kernel/input-rules.mjs:overlapsIn': 'the GATE instrument for Q3 (ruled 2026-09-30): two rules matching one situation is a failure found before shipping, never resolved at runtime -- where `resolveInput` simply runs nothing. Its consumers are the tests that enumerate every composed table (product, and product with each plugin) against inputs, situations and guard states; a runtime caller would be the precedence this exists to forbid.',
	'server/files.mjs:metadataToken': 'the GCS metadata-server token fetch. Exported so B6 can prove the cache honours expiry and that an unreachable metadata server yields a sentence rather than an undici stack trace -- neither is observable through the backend surface.',
	'planner/log.mjs:LOG_MAX': 'the ring bound. I14 asserts eviction is oldest-first and that the only record is never evicted; a test that hardcoded the number would pass after someone changed it.',
	'planner/log.mjs:LOG_HARD_MAX': 'the hard ceiling that overrides the human floor. Same reason as LOG_MAX, and the interaction between the two is the property under test.',
	'planner/txn.mjs:MAX_OPS': 'the per-transaction op cap. Asserted so the rejection is proven to happen BEFORE any write, which is a claim about ordering that needs the bound.',
	'planner/validate.js:validateEntity': 'the per-entity half of the validator, called by validateDoc. Exported because 27 assertions exercise entity shapes directly -- span, content regions, node frame -- and routing each through a whole document would test the wrapper instead of the rule.',
	'tools/migrate-version.mjs:migrateDoc': 'the CS5 migration transform. The gate proves a migrated corpus boots and every entity survives deep-equal, which requires calling the transform rather than the CLI around it.',
	'tools/migrate-version.mjs:invariant': 'the migration`s own equality check. Asserted directly because a count-only comparison passes on a mangled coordinate -- the test exists to prove the checker catches what a weaker one would miss.',
};

function walk(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (EXT.test(e.name)) out.push(p);
	}
	return out;
}

const prodFiles = PROD.flatMap((r) => walk(r));
const testFiles = TESTS.flatMap((r) => walk(r));
const read = (f) => fs.readFileSync(f, 'utf8');
// B62: comments AND string literals go. A symbol named in its own error message was enough to
// satisfy the check -- `iapIdentity requires the backend service audience` made `iapIdentity`
// look consumed. Prose about a symbol is not a dependency on it.
const strip = (t) => t
	.replace(/\/\*[\s\S]*?\*\//g, ' ')
	.replace(/\/\/[^\n]*/g, ' ')
	.replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
	.replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
	.replace(/`(?:[^`\\]|\\.)*`/g, '``');

// every exported symbol, with the file that defines it
const exported = [];
for (const f of prodFiles) {
	const t = read(f);
	for (const m of t.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let)\s+(\w+)/gm)) exported.push([f, m[1]]);
	for (const m of t.matchAll(/^export\s*\{([^}]*)\}/gm)) {
		for (const raw of m[1].split(',')) {
			const n = raw.trim().split(/\s+as\s+/).pop().trim();
			if (n && n !== 'default') exported.push([f, n]);
		}
	}
}

/*
A reference is a mention in a file OTHER than the one that defines the symbol (B62).

This used to discount a single occurrence in the origin file and count the rest, which meant any
internal use of an export satisfied the check -- and internal use is precisely what does NOT earn
an export. A3 asks for "a real consumer outside its origin"; the header of this file has said so
since it was written, and the arithmetic said something weaker. Seventeen exports were passing on
their own internal references.

The origin file is now excluded outright rather than discounted, so the code implements the rule
the comment always claimed.
*/
const countIn = (files, sym, self) => {
	let n = 0;
	for (const f of files) {
		if (f === self) continue;
		n += [...strip(read(f)).matchAll(new RegExp(`\\b${sym}\\b`, 'g'))].length;
	}
	return n;
};

/*
Public methods of exported classes -- H9.23/B91.

B90 was an authorization model complete in the store and reachable from nothing: `grant`, `revoke`
and `setOwner` had 29 call sites and every one was in a test. It survived a whole milestone with
this scanner green, because `Store` is exported and has consumers, so every method it carries
counted as reached.

The rule here is NOT the export rule, and the difference was measured rather than assumed. Applying
"a consumer outside its origin" to methods reports 118 of 293, because `this.onKeyDown()` inside its
own class is the normal way a method is used -- for an export the module is the boundary, for a
method the class is, and `this.x()` is inside it. The rule that means something is simply: NOTHING
CALLS IT. Origin included.

Scoped to the sovereign substrates and the server, and that is a real limit rather than laziness.
`app/src/input.js` dispatches key handlers by NAME from the KEYMAP table (B47/B48), so the only
reference to `onDeleteKey` is a string -- which `strip` removes on purpose, since B62 established
that prose naming a symbol is not a dependency on it. A call-graph built from text cannot see
dispatch-by-name, so a check that included the client would report thirty-two live handlers as
dead. Better to hold a smaller surface truthfully.
*/
const METHOD_SCOPE = SCANNER_ROOTS.deadMethods;
const methods = [];
for (const f of METHOD_SCOPE.flatMap((r) => walk(r))) {
	const t = strip(read(f));
	for (const m of t.matchAll(/^export\s+class\s+(\w+)/gm)) {
		const start = t.indexOf('{', m.index);
		let depth = 0, end = start;
		for (let i = start; i < t.length; i++) {
			if (t[i] === '{') depth++;
			else if (t[i] === '}' && --depth === 0) { end = i; break; }
		}
		const seen = new Set();
		// one tab of indent is a member of THIS class; `#private` cannot match, which is correct --
		// a private method is internal by declaration and owes nobody an outside caller
		for (const mm of t.slice(start + 1, end).matchAll(/^\t(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z_$][\w$]*)\s*\(/gm)) {
			const name = mm[1];
			if (name === 'constructor' || seen.has(name)) continue;
			seen.add(name);
			methods.push([f, m[1], name]);
		}
	}
}
const callsTo = (files, name) => files.reduce(
	(a, f) => a + [...strip(read(f)).matchAll(new RegExp(`\\.${name}\\b`, 'g'))].length, 0);

const findings = [];
for (const [file, cls, name] of methods) {
	if (callsTo(prodFiles, name) > 0) continue;
	const test = callsTo(testFiles, name);
	findings.push({ key: `${file}:${cls}#${name}`, file, sym: `${cls}#${name}`, prod: 0, test,
		state: test > 0 ? 'TEST-ONLY' : 'DEAD' });
}
for (const [file, sym] of exported) {
	const prod = countIn(prodFiles, sym, file);
	const test = countIn(testFiles, sym, null);
	if (prod > 0) continue;
	findings.push({ key: `${file}:${sym}`, file, sym, prod, test, state: test > 0 ? 'TEST-ONLY' : 'DEAD' });
}

/*
An ALLOW entry that is no longer a finding is a live exemption for a condition that has ended
(B62). It is not harmless: it silently covers the symbol if its consumer disappears later, so the
scanner would answer "allowed" where it should answer DEAD. Two were found the moment this was
checked -- `server/identity.mjs:iapIdentity`, whose reason literally named its own expiry
("until list() filters by grant in the same milestone", which then shipped), and
`kernel/adapt.mjs:schemaToDoc`. Both had been granted, satisfied, and never revoked.

Reported rather than failed: an exemption outliving its cause is a bookkeeping error, and failing
the gate on it would block a commit that has just legitimately given a symbol its first consumer.
*/
const keys = new Set(findings.map((f) => f.key));
const stale = Object.keys(ALLOW).filter((k) => !keys.has(k));
for (const k of stale) console.log(`  stale-allow ${k} — now has a consumer; the exemption has outlived its reason`);

const unlisted = findings.filter((f) => !ALLOW[f.key]);
const verbose = process.argv.includes('--verbose');

if (verbose || unlisted.length) {
	for (const f of findings.sort((a, b) => a.key.localeCompare(b.key))) {
		const mark = ALLOW[f.key] ? 'allowed' : f.state;
		console.log(`  ${mark.padEnd(10)} ${f.key}${f.test ? ` (tests: ${f.test})` : ''}`);
		if (ALLOW[f.key]) console.log(`             \u2514 ${ALLOW[f.key]}`);
	}
}

// A scan that matches nothing is a false green — the roots moved or the export syntax changed.
if (exported.length === 0) {
	console.log('  \u2717 NO exports matched at all — the scan is broken, not the tree clean');
	process.exit(1);
}

// exports and methods are two populations under one rule; reporting them as one number was how
// B92 hid the size of the board, so both are named for what they count.
console.log(`  scan-dead: ${exported.length} export(s) + ${methods.length} method(s) of ${new Set(methods.map((m) => m[1])).size} exported class(es); ${findings.length} without a production consumer, ${Object.keys(ALLOW).length} allowed`);
if (unlisted.length) {
	console.log(`\n  FAIL — ${unlisted.length} symbol(s) with no production consumer and no recorded reason.`);
	console.log('  Each is DELETE (via `dev/COMMIT-DELIVERY.md` section 2.4), KEEP (add to ALLOW with the reason), or PROMOTE (it needs a caller).\n');
	process.exit(1);
}
console.log(`  PASS — every export, and every public method of an exported class under `
	+ `${METHOD_SCOPE.join('/')}, has a production consumer or a recorded reason\n`);
