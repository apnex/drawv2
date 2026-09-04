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
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/*
Files skipped WHOLE, and the bar for being one is now proportionality.

A blanket skip is the widest exemption this scanner has: it does not permit the dead references in a
file, it stops reading the file. Measured before narrowing this list, `COMMIT-DELETIONS.md` carried
599 path references of which **551 resolved** -- so the skip was leaving 551 live citations unchecked
in order to permit 48 dead ones, and any one of those 551 could rot without a word. Same shape for
`COMMIT-AUDIT.md`: 54 refs, 43 resolving.

Both are read now, with their genuinely dead paths named individually below. `design/README.md`
stays because there the ratio is the other way -- 8 refs, 2 resolving -- and it describes itself as
defunct, so per-path entries would be ceremony over a file nobody is maintaining.
*/
const HISTORICAL = new Set([
	'design/README.md',                // 8 refs, 2 resolve, and the file says it is defunct
]);

/*
Resolution is against the TRACKED tree, not the working tree.

This scanner used `fs.existsSync` and therefore answered differently on different machines. It went
green locally and red in CI on the first push (H7): README cites `secrets/google-credentials.json`
and `docs/` cites a seeded `diagrams/*.json`, both of which exist on the developer's disk and are
GITIGNORED, so a fresh clone has neither. A guardrail whose answer depends on whose machine it runs
on is not a guardrail — and a doc reference means "a reader who clones this can find it", which is
exactly what `git ls-files` measures.

Directories are matched by prefix, since a doc may legitimately cite `examples/` or `kernel/`.
*/
const tracked = new Set(
	execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
);
const trackedDirs = new Set();
for (const f of tracked) {
	const parts = f.split('/');
	for (let i = 1; i < parts.length; i++) trackedDirs.add(parts.slice(0, i).join('/'));
}
const inRepo = (rel) => tracked.has(rel) || trackedDirs.has(rel.replace(/\/$/, ''));

// reference -> why it does not resolve in the repository. Reviewed at each milestone close.
const ALLOW = {
	/*
	`SCOPE.md` was split and removed on 2026-09-03: the wire contract, vocabulary and entity model to
	`docs/spec/API.md`, the ruling register to `docs/DECISIONS.md`, durability to `COMMIT.md`. The
	scope framing itself was superseded in premise by `VISION.md` and is gone.

	These citations are PROVENANCE and are the point of the sentence they sit in -- a milestone table
	recording which locked decision it amended, an audit preserved as performed, a backlog row citing
	the file that carried the defect. Repointing them would rewrite what those records say happened.
	Same precedent as the ATOMICS and DEPLOY entries below.
	*/
	'docs/BACKLOG.md:docs/spec/SCOPE.md': 'SCOPE.md was split and removed 2026-09-03; this names it as provenance for what moved or what was amended, not as a live path',
	'docs/BOARD.md:docs/spec/SCOPE.md': 'SCOPE.md was split and removed 2026-09-03; this names it as provenance for what moved or what was amended, not as a live path',
	'docs/DECISIONS.md:docs/spec/SCOPE.md': 'SCOPE.md was split and removed 2026-09-03; this names it as provenance for what moved or what was amended, not as a live path',
	'docs/spec/API.md:docs/spec/SCOPE.md': 'SCOPE.md was split and removed 2026-09-03; this names it as provenance for what moved or what was amended, not as a live path',
	'docs/spec/COMMIT-AUDIT.md:docs/spec/SCOPE.md': 'SCOPE.md was split and removed 2026-09-03; this names it as provenance for what moved or what was amended, not as a live path',
	'docs/spec/COMMIT-DELETIONS.md:docs/spec/SCOPE.md': 'SCOPE.md was split and removed 2026-09-03; this names it as provenance for what moved or what was amended, not as a live path',
	'docs/spec/COMMIT.md:docs/spec/SCOPE.md': 'SCOPE.md was split and removed 2026-09-03; this names it as provenance for what moved or what was amended, not as a live path',
	'docs/spec/DESIGN.md:docs/spec/SCOPE.md': 'SCOPE.md was split and removed 2026-09-03; this names it as provenance for what moved or what was amended, not as a live path',
	'*:server/slides/auth.js': 'the Slides feature, PURGED at Phase 1 and recorded in COMMIT-DELETIONS.md. Every remaining reference is frozen history -- COMMIT.md and COMMIT-AUDIT.md citing lines as evidence for rulings made while it existed, and BACKLOG rows describing defects in it. M4 forbids rewriting an artifact recorded before the change.',
	'*:server/slides/sync.js': 'as above -- cited as evidence in records written while the feature existed.',
	'*:tests/slides.test.js': 'as above.',
	'*:docs/slides-setup.md': 'the operator guide for a feature that no longer exists; cited from records written while it did.',
	'*:app/src/dataview.js': 'the numeric X-ray, DELETED 2026-08-23 and recorded in COMMIT-DELETIONS.md. The remaining references are frozen history -- rows describing defects in it, and the deletion record citing its own header as evidence. M4 forbids rewriting an artifact recorded before the change.',
	/*
	NAMED FILES, not a wildcard -- and the narrowing is the point.

	`*:cli/draw.sh` claimed "every reference left is frozen history", and the claim quietly stopped
	being true twice: the Dockerfile went on symlinking `draw` to it (B137), and README's layout
	table went on describing it as the CLI, read-only, in a tree where it does not exist. A wildcard
	cannot tell a citation from a description, so it exempted both, and a scanner exempting the
	thing it was written to catch is worse than no scanner.

	Listing the files that legitimately cite it forces a new reference to be argued rather than
	inherited. COMMIT-DELETIONS.md and COMMIT-AUDIT.md are not here because they are HISTORICAL and
	skipped whole.
	*/
	/*
	The two files that used to be skipped WHOLE, now enumerated -- and the test each entry had to
	pass is the director's: is this a true statement about the past, or is it an error?

	Answered mechanically rather than by assertion. Every path below was put to `git log --all` to
	see whether it ever existed, which separates a record of something deleted from a citation of
	something that never was. Four existed and were removed. Three are mission-kit paths outside
	this repository. One is gitignored runtime data. And one is simply WRONG, and is marked as such
	rather than excused.
	*/
	'docs/spec/COMMIT-DELETIONS.md:cli/draw.sh': 'the shell CLI, 6 commits, retired at B117. This file names the dead; that is its job.',
	'docs/spec/COMMIT-DELETIONS.md:app/src/schema.js': 'the client schema module, 3 commits, deleted. Cited as the thing deleted.',
	'docs/spec/COMMIT-DELETIONS.md:server/slides/transform.js': 'purged with Slides, 5 commits. Cited as the thing purged.',
	'docs/spec/COMMIT-DELETIONS.md:server/commit.mjs': 'existed for 2 commits before `server/txn.mjs` replaced it at CS1. A real file, really removed.',
	'docs/spec/COMMIT-DELETIONS.md:diagrams/diagram-000001.json': 'runtime data, gitignored by design (B49). Present on a working machine, absent from a clone -- which is what `git ls-files` correctly reports.',
	'docs/spec/COMMIT-AUDIT.md:cli/draw.sh': 'as above -- a received audit citing the shell CLI while it existed.',
	'docs/spec/COMMIT-AUDIT.md:app/src/schema.js': 'as above.',
	'docs/spec/COMMIT-AUDIT.md:server/commit.mjs': 'as above -- real, and really replaced.',
	'docs/spec/COMMIT-AUDIT.md:methodology/M7-axiom-alignment-audit.md': 'a mission-kit path, outside this repository. Not ours to resolve.',
	'docs/spec/COMMIT-AUDIT.md:mission-kit/methodology/M7-axiom-alignment-audit.md': 'as above.',
	'docs/spec/COMMIT-AUDIT.md:work-types/W22-axiom-alignment-gate.md': 'as above.',
	/*
	WRONG, and recorded as wrong rather than excused.

	`git log --all` finds no such path, ever: the auditor meant `server/slides/sync.js`, and dropped
	the `server/`. It is not history, it is a mistake in a received document -- and the only reason
	it is not simply corrected is that COMMIT-AUDIT.md is an external artefact reproduced verbatim,
	so editing it would misrepresent what was received. Correcting it would also gain nothing: the
	file it points at was itself purged with Slides, so the fixed path would not resolve either.
	The error is named here so a reader meets it as an error, which is the part that was missing.
	*/
	'docs/spec/COMMIT-AUDIT.md:slides/sync.js': 'WRONG PATH, never existed at any commit -- the auditor meant `server/slides/sync.js` (itself since purged). Kept because the file is a verbatim external artefact; recorded as an error, not as history.',
	'docs/spec/COMMIT.md:cli/draw.sh': 'rulings that cite line numbers true of the shell CLI while it existed. M4 forbids repointing them at draw.mjs -- those lines were never true of that file.',
	'docs/BACKLOG.md:cli/draw.sh': 'rows describing the defects that ended it, B61 and B117, written while it was the CLI.',
	'docs/BOARD.md:cli/draw.sh': 'H11.16, which records the Dockerfile still symlinking a retired path. Naming the dead path is the item.',
	'*:tests/cli.test.js': 'the shell CLI`s tests, deleted with it. Cited in COMMIT.md as evidence for a CS5 rewrite list. Same reason: the citation is a record of what was true then.',
	'docs/spec/DEPLOY.md:/src/main.js': 'a URL path, not a repository path -- app/ is served at the web root, so the client bundle is fetched from /src/main.js. Named because it is the request used to prove the app itself is still behind IAP.',
	'docs/spec/DEPLOY.md:core/engineer.js': 'a file of the 2021 generation (github.com/apnex/draw), named as evidence that the v1 bucket was a stale deploy rather than divergent work',
	'docs/spec/DEPLOY.md:core/loader.js': 'as above - v1 provenance, not a path in this repository',
	'docs/BACKLOG.md:secrets/google-credentials.json': 'B49 cites the paths that exposed the defect AS ITS EVIDENCE — same as B31 below',
	'docs/BACKLOG.md:secrets/google-token.json': 'as above (B49 evidence)',
	'docs/BACKLOG.md:diagrams/diagram-000001.json': 'as above (B49 evidence)',
	'docs/slides-setup.md:secrets/google-credentials.json': 'runtime, gitignored: the user downloads it during OAuth setup - the doc is telling them where to put it',
	'docs/slides-setup.md:secrets/google-token.json': 'runtime, gitignored: written by the OAuth flow on first authorization',
	'docs/spec/COMMIT.md:diagrams/diagram-000001.json': 'runtime, gitignored: the store seeds diagrams/ from examples/ on first boot',
	'docs/DECISIONS.md:.refs/draw/index.html': 'moved with Borrowed mechanisms when SCOPE.md was split; the lineage clones are a local research checkout, never committed',
	'docs/spec/SCOPE.md:.refs/draw/index.html': 'the draw lineage clones are a local research checkout, never committed (SCOPE names them as such)',
	'docs/spec/ATOMICS.md:design/sim/atomics.mjs': 'design/sim is the superseded pre-kernel sandbox; ATOMICS cites it as provenance for a locked decision',
	'docs/spec/ATOMICS.md:design/sim/handles.mjs': 'as above — provenance citation, not a live path',
	'docs/spec/ATOMICS.md:design/sim/parallel.mjs': 'as above',
	'docs/spec/ATOMICS.md:design/sim/star.mjs': 'as above',
	// provenance: naming a superseded file is the point of the sentence, not a broken pointer
	// B166 unified the link vocabulary and deleted the adapter that existed only to translate it.
	// The register cites the file BECAUSE it is gone -- the row is the record of its whole life.
	'docs/BACKLOG.md:engine/routes.mjs': 'provenance -- the adapter B166 deleted; the row records why it existed and why it does not',
	'tools/scan-docrefs.mjs:engine/routes.mjs': 'this scanner\'s own allow-list text',
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
};

/*
Code comments cite paths too, and they are exactly as load-bearing — a header saying "see X" sends a
reader somewhere with the same authority a doc does. Scanning only .md missed nine such references,
including two `see docs/history/PRISMV2-DESIGN.md` pointers to a file deleted long ago. Found by
running the audit, not by designing it.
*/
const CODE_ROOTS = ['kernel', 'engine', 'model', 'app/src', 'server', 'cli'];
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
const BARE = /(?<![\w/`])((?:docs|design|kernel|engine|model|app|server|tests|tools|cli)\/[A-Za-z0-9_.\-/]+\.(?:js|mjs|md|json))/g;

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
		if (candidates.some((c) => inRepo(c))) continue;
		const key = `${doc}:${ref}`;
		broken.push({ key, doc, ref, allowed: !!ALLOW[key] || !!ALLOW[`*:${ref}`] });
	}
}

for (const src of CODE_ROOTS.flatMap((r) => codeFiles(r))) {
	const text = fs.readFileSync(src, 'utf8');
	for (const m of [...text.matchAll(PATHLIKE), ...text.matchAll(BARE)]) {
		const ref = m[1];
		total++;
		if (ref.startsWith('http') || !ref.includes('/')) continue;   // a bare filename may be a forward reference
		if (inRepo(ref)) continue;
		const key = `${src}:${ref}`;
		broken.push({ key, doc: src, ref, allowed: !!ALLOW[key] || !!ALLOW[`*:${ref}`] });
	}
}

/*
The Dockerfile names paths from this repo, and the build cannot tell you when one is wrong.

B137: `RUN ln -s /app/cli/draw.sh /usr/local/bin/draw` outlived `draw.sh` by two milestones. The
image built clean every time, because `ln -s` does not check its target -- it will happily create a
link to nothing -- so the defect was invisible until somebody ran `draw` inside a container, which
nobody does. A `COPY` of a missing path DOES fail the build, but only when the build runs, and B53
records that nothing in the gate builds the image.

So this is checked the same way documentation is: every path the Dockerfile names must resolve in
the tracked tree. It costs one file read and catches the class, not the instance.
*/
const DOCKERFILE = 'Dockerfile';
if (fs.existsSync(DOCKERFILE)) {
	const text = fs.readFileSync(DOCKERFILE, 'utf8');
	const named = [];
	// COPY <src>... <dest> -- every source but the last token, skipping --from= and friends
	for (const m of text.matchAll(/^COPY\s+(?!--)(.+)$/gm)) {
		const parts = m[1].trim().split(/\s+/);
		named.push(...parts.slice(0, -1));
	}
	// and any in-image path that points back at something we shipped
	for (const m of text.matchAll(/ln -s\s+\/app\/(\S+)/g)) named.push(m[1]);
	for (const ref of named) {
		const clean = ref.replace(/^\/app\//, '').replace(/\/$/, '');
		if (!clean || clean === '.' || clean.startsWith('$')) continue;
		total++;
		if (inRepo(clean)) continue;
		/*
		The `*:` wildcard does NOT apply here, and that exemption is the whole subtlety.

		A wildcard entry means "this path is dead, and records written while it lived may cite it" --
		M4, and correct for prose. The Dockerfile is not citing anything: `ln -s` and `COPY` are
		instructions the build follows. `cli/draw.sh` is allow-listed for exactly the historical
		reason, and on this check's first run that wildcard exempted the live `ln -s` too, so B137
		stayed invisible in the very scanner written to catch it.

		Only an explicit `Dockerfile:<path>` entry exempts a build instruction, which forces the
		reason to be about the BUILD rather than inherited from a note about documentation.
		*/
		broken.push({ key: `${DOCKERFILE}:${clean}`, doc: DOCKERFILE, ref: clean,
			allowed: !!ALLOW[`${DOCKERFILE}:${clean}`] });
	}
}

const unlisted = broken.filter((b) => !b.allowed);
if (process.argv.includes('--verbose') || unlisted.length) {
	let last = '';
	for (const b of broken.sort((a, c) => a.key.localeCompare(c.key))) {
		if (b.doc !== last) { console.log(`  ${b.doc}`); last = b.doc; }
		console.log(`    ${b.allowed ? 'allowed' : 'BROKEN '}  ${b.ref}`);
		// the reason must come from whichever entry MATCHED. Reading only the exact key printed
		// `undefined` for every wildcard exemption, which is an allow-list entry a reader cannot
		// check -- and the point of the list is that each one carries an argument.
		if (b.allowed) console.log(`               \u2514 ${ALLOW[b.key] || ALLOW[`*:${b.ref}`]}`);
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
