#!/usr/bin/env node
/*
THE WAY BACK FROM SCHEMA 3 (WD-b1, H19.45; dev/design/unification/WIDE-DEVICES.md section 13, finding 6).

The image before schema 3 refuses a schema 3 document, and a backup taken before the deploy loses every edit made since. So
before an older image is deployed, a copy of the bucket is rewritten as schema 2 -- each diagram's layouts dropped, its
schema stamped 2, its log and every other entity kept -- and copied back. Writes only to the directory it is given.

	node tools/migrate-down-to-schema-2.mjs <directory holding a copy of the bucket>

Deleted with the migration at WD-c (H19.47).
*/

import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize } from '../server/docfile.mjs';
import { migrateDownToSchema2 } from '../server/migrate-schema-3.mjs';
import { productKinds } from '../product/kinds.mjs';

const FILE = /^diagram-[0-9a-f]{6}\.json$/;
const dir = process.argv[2];
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
	console.error('usage: node tools/migrate-down-to-schema-2.mjs <directory holding a copy of the bucket>');
	process.exit(2);
}
const KINDS = productKinds();   // the always-held entities are the product's (its layouts), so the product's composition serves
let rewritten = 0;
const left = [];
for (const file of fs.readdirSync(dir).filter((f) => FILE.test(f)).sort()) {
	const at = path.join(dir, file);
	const { doc, log } = parse(fs.readFileSync(at, 'utf8'));
	if (doc?.meta?.schema !== 3) { left.push(`${file} (schema ${doc?.meta?.schema})`); continue; }
	fs.writeFileSync(at, serialize(migrateDownToSchema2(doc, KINDS), log));
	rewritten++;
}
console.log(`${rewritten} diagram(s) rewritten as schema 2${left.length ? `; left as they were, not schema 3: ${left.join(', ')}` : ''}`);
