#!/usr/bin/env node
/*
gate-runtime -- B423. The gate runs on the runtime the image runs, or it proves nothing about what ships.

The Dockerfile names the runtime production runs (`FROM node:<major>-...`), and CI's gate job runs that major too
(.github/workflows/gate.yml). The local pre-push hook runs `npm run gate` on whatever `node` is first on the path; for eleven pushes
that was a newer major than the image's, and a test whose sweep differed by engine (tests/fixtures/grid-parity.mjs, B423) passed
on every push here while CI's gate failed on every one. This step fails the gate, first, when the running major is not the image's,
naming both, so a gate that passes here is a gate run on what ships.

Usage: node tools/gate-runtime.mjs [--dockerfile <path>]
*/
import fs from 'node:fs';
import path from 'node:path';

const i = process.argv.indexOf('--dockerfile');
const file = i > -1 ? process.argv[i + 1] : path.resolve(import.meta.dirname, '..', 'Dockerfile');
const from = /^FROM\s+node:(\d+)\b/m.exec(fs.readFileSync(file, 'utf8'));
if (!from) {
	console.error(`gate-runtime: ${file} names no node:<major> image -- the gate cannot tell which runtime ships`);
	process.exit(1);
}
const want = Number(from[1]), have = Number(process.versions.node.split('.')[0]);
if (have !== want) {
	console.error(`gate-runtime: FAIL -- the gate runs on Node.js ${process.versions.node}, and the image runs Node.js ${want} (${path.basename(file)}); run it on Node.js ${want} (.nvmrc), as CI does`);
	process.exit(1);
}
console.log(`gate-runtime: PASS -- Node.js ${process.versions.node}, the image's major (${want})`);
