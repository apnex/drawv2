/*
H18.4 (F-b) -- THE BARE ANCHOR IS ASKED IN ONE PLACE (model/anchors.mjs; dev/design/unification/FORMAT-BATCH.md section 6).

A bare anchor -- what people call a waypoint -- is the `waypoint` kind today and a node with no type from F-c. Every product
module that asks how one is stored asks model/anchors.mjs, so F-c changes that module's answers rather than every reader's
question. This file holds the answers, and RATCHETS the kind's literal in every other product module: the count per file must
equal the record below, each with the reason it is not asked through the module. A rise is a new reader bypassing it; a fall
is progress, written down here in the commit that makes it.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BARE_KIND, ANCHOR_KINDS, isBareEntity, bareAnchor, bareAnchors, anchorOf, bareAnchorsOf } from '../model/anchors.mjs';
import { Model } from '../model/model.mjs';
import { docToSchema } from '../kernel/adapt.mjs';

const root = new URL('..', import.meta.url).pathname;

const board = () => {
	const m = new Model();
	m.put('node', { id: 'node-00000a', name: 'r', type: 'router', x: 0, y: 0 });
	m.put(BARE_KIND, { id: `${BARE_KIND}-00000b`, name: 'w', x: 60, y: 0 });
	return m;
};

test('F-b: the bare anchor is the waypoint kind until F-c, and the anchor kinds are the composition\'s', () => {
	assert.equal(BARE_KIND, 'waypoint', 'F-c makes this node, and the readers follow');
	assert.deepEqual(ANCHOR_KINDS, ['node', 'waypoint'], 'read from the kind table: the rows marked anchor');
	assert.equal(isBareEntity('node', { id: 'node-00000a', type: 'router' }), false);
	assert.equal(isBareEntity('waypoint', { id: 'waypoint-00000b' }), true);
	assert.equal(isBareEntity('waypoint', undefined), false, 'no entity is no bare anchor');
});

test('F-b: the functions answer over a model, and over a plain document', () => {
	const m = board();
	assert.deepEqual(bareAnchors(m).map((w) => w.id), ['waypoint-00000b']);
	assert.equal(bareAnchor(m, 'waypoint-00000b').name, 'w');
	assert.equal(bareAnchor(m, 'node-00000a'), undefined, 'a typed node is not bare');
	assert.equal(anchorOf(m, 'node-00000a').name, 'r');
	assert.equal(anchorOf(m, 'waypoint-00000b').name, 'w');
	assert.equal(anchorOf(m, 'link-00000c'), undefined);
	assert.equal(m.endpointOf('waypoint-00000b').name, 'w', 'the Model resolves an end through the same question');
	assert.deepEqual(bareAnchorsOf(m.toJSON()).map((w) => w.id), ['waypoint-00000b']);
	assert.deepEqual(bareAnchorsOf({}), [], 'a document without them has none');
});

/*
kernel/ may not import model/ (C9), so the export's adapter restates the question where it reads a document. Held to the
module by behaviour: the scene's waypoints are exactly the document's bare anchors -- so F-c, changing the module, fails here
until the adapter changes with it.
*/
test('F-b: the export\'s adapter draws exactly the document\'s bare anchors as waypoints', () => {
	const doc = board().toJSON();
	const scene = docToSchema(doc).entities.filter((e) => e.kind === 'waypoint').map((e) => e.id);
	assert.deepEqual(scene, bareAnchorsOf(doc).map((w) => w.id));
});

// ---- the ratchet ----

const ROOTS = ['app/src', 'model', 'planner', 'engine', 'kernel', 'network', 'server', 'cli', 'lab/src'];
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true })
	.flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []));
// code lines only: block comments and whole-line comments are prose, which may say "waypoint" freely
function codeLines(text) {
	const out = [];
	let block = false;
	for (const line of text.split('\n')) {
		if (block) { if (line.includes('*/')) block = false; continue; }
		const t = line.trim();
		if (t.startsWith('/*')) { if (!t.includes('*/')) block = true; continue; }
		if (t.startsWith('//') || t.startsWith('*')) continue;
		out.push(line.replace(/\s\/\/\s.*$/, ''));
	}
	return out;
}
// the kind or its collection as a literal: 'waypoint', "waypoint", `waypoint, 'waypoint-, 'waypoints', .waypoints
const LITERAL = /['"`]waypoints?['"`-]|\.waypoints\b/;

const RECORD = {
	'model/anchors.mjs': [1, 'the one place that says it'],
	'model/shape.mjs': [4, 'the kind\'s own row and collection -- F-c rewrites it'],
	'planner/kinds.mjs': [5, 'the kind\'s field checks and the id grammar of what links and groups name -- F-c rewrites them'],
	'server/store.js': [2, 'the loader\'s repairs of documents as they were written (B187 names, B172 spawners)'],
	'model/model.mjs': [1, 'a new waypoint\'s NAME, `waypoint-<n>` -- the word people use (F4)'],
	'model/link-reactions.mjs': [1, 'a reaction\'s id, `waypoint-links`, which names it in the generated table'],
	'cli/verbs.mjs': [29, 'the CLI ships standalone (B138) and reads the wire document; it changes with the wire at F-c'],
	'kernel/adapt.mjs': [2, 'kernel/ may not import model/ (C9): reads the document, held by the adapter test above'],
	'kernel/engine.mjs': [2, 'the scene\'s `waypoint` kind -- what is drawn, F4'],
	'kernel/fixtures.mjs': [3, 'the spec viewer\'s scenes, in the scene\'s vocabulary'],
	'kernel/geometry.mjs': [1, 'the scene\'s `waypoint` kind -- what is drawn, F4'],
	'kernel/network-appearance.mjs': [1, 'the scene\'s `waypoint` kind -- what is drawn, F4'],
	'kernel/svg-scene.mjs': [1, 'the scene\'s `waypoint` kind -- what is drawn, F4'],
	'engine/situation.mjs': [3, 'the situation\'s word for what the pointer is over, derived through the module (F4)'],
	'app/src/pick.js': [1, 'a hit on a drawn waypoint -- the canvas\'s word, F4'],
	'app/src/recognize.js': [4, 'the gesture rows\' hit words, F4'],
	'app/src/input.js': [4, 'the hit, the palette hand and the step words, F4'],
	'app/src/palette.js': [2, 'the palette\'s waypoint tile, F4'],
	'app/src/painter.js': [1, 'the palette\'s waypoint tile, F4'],
	'app/src/help.js': [1, 'the help overlay\'s waypoint situation, F4'],
	'app/src/keymap.js': [1, 'the `w` key\'s id, F4'],
	'app/src/releases.js': [1, 'the palette hand, F4'],
	'app/src/renderer.js': [1, 'the drawn waypoint\'s class and layer, F4'],
	'lab/src/root.js': [1, 'the page\'s waypoint layer id'],
};

test('F-b: the bare anchor\'s literal appears in no product module beyond the record, each with its reason', () => {
	const measured = {};
	for (const f of ROOTS.flatMap(walk).sort()) {
		const n = codeLines(fs.readFileSync(path.join(root, f), 'utf8')).filter((l) => LITERAL.test(l)).length;
		if (n) measured[f] = n;
	}
	for (const f of new Set([...Object.keys(measured), ...Object.keys(RECORD)])) {
		const n = measured[f] ?? 0, r = RECORD[f]?.[0] ?? 0;
		assert.ok(n <= r, `${f}: ${n} line(s) name the bare anchor's kind, recorded ${r} -- RISE: ask model/anchors.mjs instead`);
		assert.ok(n >= r, `${f}: ${n}, recorded ${r} -- FALL: lower the record in this commit, so the progress is written down`);
	}
});

test('F-b: the ratchet sees a reader that bypasses the module', () => {
	const bypass = "\tfor (const w of model.all('waypoint')) seen.add(w.id);";
	assert.equal(codeLines(bypass).filter((l) => LITERAL.test(l)).length, 1);
	assert.equal(codeLines("\t// model.all('waypoint') in a comment").filter((l) => LITERAL.test(l)).length, 0, 'prose is free');
	assert.equal(codeLines('\tconst n = doc.waypoints.length;').filter((l) => LITERAL.test(l)).length, 1, 'the collection too');
});
