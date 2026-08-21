#!/usr/bin/env node
/*
scan-dead — H5/C1. Every exported symbol earns its existence from a real consumer.

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

const PROD = ['kernel', 'engine', 'model', 'app/src', 'server', 'tools', 'cli'];
const TESTS = ['tests'];
const EXT = /\.(js|mjs)$/;

// symbol -> why it has no production consumer. Reviewed at each milestone close.
const ALLOW = {
	'server/identity.mjs:iapIdentity': 'the IAP mechanism itself. H9.25 made `identitySource()` the only production caller, and it lives in this same file, so the export now earns its keep entirely from tests -- deliberately. This function is where twelve distinct refusals live (bad signature, wrong audience, wrong issuer, alg:none, expired, no email claim), each of which is a security boundary, and reaching them through `identitySource` would mean plumbing environment variables through every one. The alternative is not testing them directly, which is worse than an entry in this table.',
	'server/identity.mjs:jwkSource': 'as above -- injectable so the verifier can be tested against a locally generated key rather than a captured token.',
	'kernel/fixtures.mjs:FIXTURES': 'canonical reference scenes — consumed by the spec viewer and by eye, not by code',
	'app/src/commands.js:resizeNodeSpan': 'used internally by the Shift+arrow span builder (commands.js:333); exported so the W1 authoring gesture can be driven directly in a test rather than through a synthesised keystroke.',
	'app/src/keymap.js:KEYMAP': 'the key table itself. B47/B48 assert over it -- that every entry declares `prevent`, that exactly one overlapping pair exists, that the matched rule names its verb. Those are properties of the table, not of any dispatch, so the table has to be reachable.',
	'server/files.mjs:metadataToken': 'the GCS metadata-server token fetch. Exported so B6 can prove the cache honours expiry and that an unreachable metadata server yields a sentence rather than an undici stack trace -- neither is observable through the backend surface.',
	'server/log.mjs:LOG_MAX': 'the ring bound. I14 asserts eviction is oldest-first and that the only record is never evicted; a test that hardcoded the number would pass after someone changed it.',
	'server/log.mjs:LOG_HARD_MAX': 'the hard ceiling that overrides the human floor. Same reason as LOG_MAX, and the interaction between the two is the property under test.',
	'server/slides/transform.js:OWNED_ID': 'the id pattern that marks a Slides element as ours. The wipe deletes by this pattern on the bound page, so a test must assert the pattern matches exactly what draw creates and nothing else.',
	'server/txn.mjs:MAX_OPS': 'the per-transaction op cap. Asserted so the rejection is proven to happen BEFORE any write, which is a claim about ordering that needs the bound.',
	'server/validate.js:validateEntity': 'the per-entity half of the validator, called by validateDoc. Exported because 27 assertions exercise entity shapes directly -- span, content regions, node frame -- and routing each through a whole document would test the wrapper instead of the rule.',
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

const findings = [];
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

console.log(`  scan-dead: ${exported.length} export(s); ${findings.length} without a production consumer, ${Object.keys(ALLOW).length} allowed`);
if (unlisted.length) {
	console.log(`\n  FAIL — ${unlisted.length} export(s) with no production consumer and no recorded reason.`);
	console.log('  Each is DELETE (via COMMIT.md §7.4), KEEP (add to ALLOW with the reason), or PROMOTE (it needs a caller).\n');
	process.exit(1);
}
console.log('  PASS — every export has a production consumer or a recorded reason\n');
