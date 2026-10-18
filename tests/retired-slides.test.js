/*
H24.11 (B380) -- draw names Google Slides nowhere live.

The Slides feature was purged in two phases (dev/COMMIT-DELETIONS.md), and the director ruled that draw has evolved past alignment
with Google Slides, its mentions to go from the repository's description and everywhere else (dev/DECISIONS.md H24.11). The
descriptions, the current spec text, the comments, the control-bar fixture and the test names no longer name it.

The records written while the feature existed keep their mentions, because a record is frozen at authorship and amended rather
than rewritten (mission-kit RU2), and `.gitignore` keeps the feature's leftover credential files out of this public repository; each
is listed below with why. A mention anywhere else fails, and so does a listed file that no longer mentions it, so the list stays
exactly the files that do.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

// the word, singular or plural, whole -- `slides-push` included, `slider` and `backslides` not -- and the feature's own names: its
// deck, its binding's fields, its OAuth scope, its documents' address and its credential files
const MENTION = /\bslides?\b|\bdecks?\b|\bpresentationId\b|\bpageId\b|\bbindSlides\b|auth\/presentations|docs\.google\.com|google-(?:credentials|token)/i;

const KEPT = {
	'dev/BACKLOG.md': 'the durable record, append-and-close: rows written while the feature existed, and B380, which removed its mentions',
	'dev/BOARD.md': 'closed items H4.6, H7.3 and H8.3, and H24.11, which removed the mentions',
	'dev/DECISIONS.md': 'rulings recorded while the feature existed; decision 1 amended by H24.11',
	'dev/COMMIT-DELETIONS.md': 'the record of what the purge deleted',
	'dev/COMMIT-DELIVERY.md': 'the CS1 to CS6 delivery record',
	'dev/history/COMMIT-AUDIT.md': 'a verbatim audit of its time',
	'dev/design/widgets/DESIGN.md': 'the diagram-as-UI design as authored, marked by a dated amendment',
	'dev/design/widgets/control-bar.html': 'a mockup of that design, as authored',
	'dev/design/widgets/control-bar-live.html': 'a mockup of that design, as authored',
	'dev/design/widgets/preview.html': 'the comparison of that design, as authored',
	'dev/design/widgets/rationale.json': 'the detail of that design, as authored',
	'dev/design/unification/UNIFICATION-COMPLETE.md': 'the H25 delta record, naming the dead style rules H25.3 deleted',
	'docs/spec/TRANSACTIONS.md': 'locked rulings, changed only by a dated amendment in the file; the Slides binding marked retired by one',
	'tools/copies-ceiling.json': 'the frozen ceiling of H25.0, its hash pinned by tests/scan-copies.test.js',
	'tools/scan-docrefs.mjs': 'allows the purged paths the records above cite',
	'.gitignore': 'keeps the feature\'s leftover credential files, still present on a machine that once ran it, out of this public repository',
	'tests/retired-slides.test.js': 'this guard',
};

const BINARY = new Set(['.png']);

function filesMentioning() {
	const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
	return tracked.filter((f) => !BINARY.has(path.extname(f)) && fs.existsSync(path.join(root, f))
		&& MENTION.test(fs.readFileSync(path.join(root, f), 'utf8')));
}

test('B380: the measure sees the word whole, and passes over words that only contain it (control)', () => {
	for (const said of ['pushes to Google Slides', 'action: \'slides-push\'', 'maps 1:1 to a slide.', 'meta.slides', 'binding a deck', '{presentationId, pageId}',
		'bindSlides(id)', 'auth/presentations', 'https://docs.google.com/x', 'secrets/google-token.json']) {
		assert.equal(MENTION.test(said), true, said);
	}
	for (const not of ['a slider', 'backslides', 'slideshow', 'sliding', 'decking', 'pageIdx', 'storage.googleapis.com']) assert.equal(MENTION.test(not), false, not);
});

test('B380: no tracked file outside the files kept mentions Slides', () => {
	assert.deepEqual(filesMentioning().filter((f) => !(f in KEPT)), []);
});

test('B380: every file kept still mentions Slides, so the list holds no stale entry', () => {
	const mentioning = new Set(filesMentioning());
	assert.deepEqual(Object.keys(KEPT).filter((f) => !mentioning.has(f)), []);
});
