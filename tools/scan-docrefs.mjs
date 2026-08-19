#!/usr/bin/env node
/*
scan-docrefs — H5/C3. A path named in the documentation must exist.

A4 *Zero-Loss Knowledge*: documentation is the working memory of the system, and an actor
rehydrating from the record fills whatever the record gets wrong — a human guesses, a memory-less
one invents. A citation to a file that no longer exists is worse than no citation: it sends the
reader somewhere, confidently, and the place is gone. `docs/BACKLOG.md` requires evidence as
`[V, file:line]`, so its citations are load-bearing by construction.

HISTORICAL RECORDS ARE EXEMPT, and the exemption is the whole reason this check is usable. A
deletion table's JOB is to name what was deleted; `COMMIT-DELETIONS.md` citing `server/commit.mjs`
is the record working, not rotting. `tests/spec.test.js` already draws this distinction for SCOPE
amendments — "an amendment's job is to NAME the commands it retired, so scanning it would make the
file permanently unfixable" — and this scan inherits it.

Usage: node tools/scan-docrefs.mjs [--verbose]
*/

import fs from 'node:fs';
import path from 'node:path';

// files whose purpose is to name things that no longer exist
const HISTORICAL = new Set([
	'docs/spec/COMMIT-DELETIONS.md',   // one row per deleted symbol — naming the dead is the point
	'docs/spec/COMMIT-AUDIT.md',       // an external audit report, frozen as received
	'design/README.md',                // explicitly "mostly DEFUNCT / historical", superseded by kernel/
]);

// reference -> why it does not resolve on disk. Reviewed at each milestone close.
const ALLOW = {
	'docs/spec/SCOPE.md:.refs/draw/index.html': 'the draw lineage clones are a local research checkout, never committed (SCOPE names them as such)',
	'docs/spec/ATOMICS.md:design/sim/atomics.mjs': 'design/sim is the superseded pre-kernel sandbox; ATOMICS cites it as provenance for a locked decision',
	'docs/spec/ATOMICS.md:design/sim/handles.mjs': 'as above — provenance citation, not a live path',
	'docs/spec/ATOMICS.md:design/sim/parallel.mjs': 'as above',
	'docs/spec/ATOMICS.md:design/sim/star.mjs': 'as above',
	// provenance: naming a superseded file is the point of the sentence, not a broken pointer
	'server/txn.mjs:server/commit.mjs': 'provenance header — records the file this one replaced (CS1)',
	'kernel/renderer.mjs:design/widgets/render.mjs': 'provenance — the mockup the content-region renderer was derived from',
	'tools/scan-docrefs.mjs:server/commit.mjs': 'this scanner\'s own allow-list text',
	'tools/scan-docrefs.mjs:design/sim/atomics.mjs': 'as above',
	'tools/scan-docrefs.mjs:design/sim/handles.mjs': 'as above',
	'tools/scan-docrefs.mjs:design/sim/parallel.mjs': 'as above',
	'tools/scan-docrefs.mjs:design/sim/star.mjs': 'as above',
	// GR5 is [LOCKED] and names the guardrail as designed; X15 records that it was retired unbuilt
	'docs/spec/COMMIT.md:tests/diff-inverse.test.js': 'GR5 as specified; retired unbuilt and recorded as deviation X15',
	'docs/BOARD.md:tests/diff-inverse.test.js': 'as above',
	'docs/BACKLOG.md:tests/diff-inverse.test.js': 'as above (B22, closed by retirement)',
	'docs/spec/COMMIT.md:server/commit.mjs': '§7.1 is a deletion table and D5 records the removal — naming the dead is the job',
	'design/walk/FINDINGS.md:design/walk/grc.mjs': 'the walk record is historical; the checker graduated to kernel/grc.mjs',
	'design/widgets/DESIGN.md:model/arc-catalog.json': 'a mockup input from the pre-kernel design sandbox, never part of this tree',
	'docs/BACKLOG.md:kernel/view.mjs': 'B31 cites the broken paths AS ITS EVIDENCE — the row recording the drift must name it',
	'docs/BACKLOG.md:design/view.mjs': 'as above (B31 evidence)',
	'docs/BACKLOG.md:design/shot.mjs': 'as above (B31 evidence)',
	'docs/BACKLOG.md:docs/spec/CLEANLINESS.md': 'as above (B31 evidence)',
	'docs/BACKLOG.md:docs/history/PRISMV2-DESIGN.md': 'as above (B31 evidence)',
	'docs/BACKLOG.md:app/src/schema.js': 'as above (B31 evidence) — the row names the path it was repointed FROM',
	'docs/BACKLOG.md:client/src/renderer.js': 'as above (B31 evidence)',
	// A FORWARD reference: a plan may name a path that does not exist yet. Bare filenames are already
	// skipped (which is why H6's pick.js / overlay.js / keymap.js do not trip), so only a proposed
	// path WITH a directory needs recording. Delete this entry when B41 lands and the path is real.
	'docs/BACKLOG.md:model/model.mjs': 'B41 proposes this name; the rename has not happened yet',
};

/*
Code comments cite paths too, and they are exactly as load-bearing — a header saying "see X" sends a
reader somewhere with the same authority a doc does. Scanning only .md missed nine such references,
including two `see docs/history/PRISMV2-DESIGN.md` pointers to a file deleted long ago. Found by
running the audit, not by designing it.
*/
const CODE_ROOTS = ['kernel', 'engine', 'document', 'app/src', 'server', 'cli'];
const CODE_EXT = /\.(js|mjs)$/;

const docs = [];
(function walk(dir) {
	if (!fs.existsSync(dir)) return;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p); }
		else if (e.name.endsWith('.md')) docs.push(p);
	}
})('.');

const PATHLIKE = /`([A-Za-z0-9_.\-/]+\.(?:js|mjs|md|json|sh|html|css|svg))(?:[:#][^`]*)?`/g;
// in code, the common form carries no backticks
const BARE = /(?<![\w/`])((?:docs|design|kernel|engine|document|app|server|tests|tools|cli)\/[A-Za-z0-9_.\-/]+\.(?:js|mjs|md|json))/g;

function codeFiles(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) codeFiles(p, out);
		else if (CODE_EXT.test(e.name)) out.push(p);
	}
	return out;
}

let total = 0;
const broken = [];
for (const doc of docs) {
	if (HISTORICAL.has(doc)) continue;
	const text = fs.readFileSync(doc, 'utf8');
	for (const m of text.matchAll(PATHLIKE)) {
		const ref = m[1];
		total++;
		if (ref.startsWith('http') || !ref.includes('/')) continue;   // bare filenames are ambiguous
		const candidates = [ref, path.join(path.dirname(doc), ref)];
		if (candidates.some((c) => fs.existsSync(c))) continue;
		const key = `${doc}:${ref}`;
		broken.push({ key, doc, ref, allowed: !!ALLOW[key] });
	}
}

for (const src of CODE_ROOTS.flatMap((r) => codeFiles(r))) {
	const text = fs.readFileSync(src, 'utf8');
	for (const m of [...text.matchAll(PATHLIKE), ...text.matchAll(BARE)]) {
		const ref = m[1];
		total++;
		if (ref.startsWith('http') || !ref.includes('/')) continue;   // a bare filename may be a forward reference
		if (fs.existsSync(ref)) continue;
		const key = `${src}:${ref}`;
		broken.push({ key, doc: src, ref, allowed: !!ALLOW[key] });
	}
}

const unlisted = broken.filter((b) => !b.allowed);
if (process.argv.includes('--verbose') || unlisted.length) {
	let last = '';
	for (const b of broken.sort((a, c) => a.key.localeCompare(c.key))) {
		if (b.doc !== last) { console.log(`  ${b.doc}`); last = b.doc; }
		console.log(`    ${b.allowed ? 'allowed' : 'BROKEN '}  ${b.ref}`);
		if (b.allowed) console.log(`               \u2514 ${ALLOW[b.key]}`);
	}
}

if (total === 0) {
	console.log('  \u2717 NO path references matched at all — the scan is broken, not the docs clean');
	process.exit(1);
}

console.log(`  scan-docrefs: ${total} path reference(s) across ${docs.length - HISTORICAL.size} live doc(s); ${broken.length} unresolved, ${Object.keys(ALLOW).length} allowed`);
if (unlisted.length) {
	console.log(`\n  FAIL — ${unlisted.length} reference(s) point at nothing. Repoint, delete, or record why the path is legitimately absent.\n`);
	process.exit(1);
}
console.log('  PASS — every documented path resolves, or is recorded as deliberately absent\n');
