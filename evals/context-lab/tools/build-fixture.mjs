#!/usr/bin/env node
/*
Build the map evaluation's fixtures (H28.3, B440): draw's runtime at the revision pack.json pins, then one workspace folder per
scenario under evals/context-lab/fixtures/, each checked as a run will check it. Run before `context-lab run`, and again after the
pinned revision, the diagram, a policy or the shim changes. `--runtime-only` stops after the runtime (the generator needs it);
`--stamp` first writes the digest of what scores a run into every experiment's notes (fixture-lib.mjs SCORED), which unrecords them.

  node evals/context-lab/tools/build-fixture.mjs [--runtime-only] [--stamp]
*/
import fs from 'node:fs';
import path from 'node:path';
import { PACK, STAMP, buildRuntime, composeFixture, packDigest, pinnedRevision, readPack, scenarioFixtures, verifyFixtures } from './fixture-lib.mjs';

if (process.argv.includes('--stamp')) {
	const stamp = `pack digest ${packDigest()}`;
	for (const e of readPack().experiments) {
		const file = path.join(PACK, e), x = JSON.parse(fs.readFileSync(file, 'utf8'));
		x.notes = STAMP.test(x.notes ?? '') ? x.notes.replace(STAMP, stamp) : `${x.notes ?? ''} ${stamp}.`.trim();
		fs.writeFileSync(file, `${JSON.stringify(x, null, '\t')}\n`);
	}
	console.log(`stamped: ${stamp}`);
}

const revision = pinnedRevision();
const runtime = path.join(PACK, 'fixtures', 'runtime');
buildRuntime(path.resolve(PACK, '..', '..'), revision, runtime);
console.log(`runtime: draw at ${revision} in ${path.relative(process.cwd(), runtime)}`);
if (!process.argv.includes('--runtime-only')) {
	for (const { id, fixture } of scenarioFixtures()) {
		composeFixture(path.join(PACK, fixture), { runtime, scenario: id, revision });
		console.log(`fixture: ${id} in ${path.relative(process.cwd(), path.join(PACK, fixture))}`);
	}
	const faults = verifyFixtures();
	for (const f of faults) console.error(`FAULT ${f}`);
	process.exitCode = faults.length ? 1 : 0;
	if (!faults.length) console.log('every fixture checks');
}
