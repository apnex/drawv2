/*
H18.4 (F-b), H18.5 (F-c) -- THE BARE ANCHOR IS ASKED IN ONE PLACE (model/anchors.mjs; dev/design/unification/FORMAT-BATCH.md
section 6).

A bare anchor -- what people call a waypoint -- was the `waypoint` kind until F-c and is a node with no type since (P-10).
Every product module asks model/anchors.mjs how one is stored. This file holds the answers, and RATCHETS the old kind's
literal in every other product module: the count per file must equal the record below, each with the reason it is not a
stored kind -- since F-c none is, so a new one is a reader naming a kind that no longer exists. A rise is that; a fall is
progress, written down here in the commit that makes it.
*/
import { test } from 'node:test';
import { KINDS } from './fixtures/composed.mjs';   // O-b1: a reader is handed its caller's kinds
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BARE_KIND, ANCHOR_KINDS, anchorOf } from '../model/anchors.mjs';
import { isBareEntity, isTypedEntity, bareAnchor, bareAnchors, typedNodes } from '../devices/device-shapes.mjs';
import { drawnKind, isAnchorWord } from '../devices/anchor-words.mjs';
import { Model } from '../model/model.mjs';
import { docToSchema } from '../kernel/adapt.mjs';

const root = new URL('..', import.meta.url).pathname;

const board = () => {
	const m = new Model();
	m.put('node', { id: 'node-00000a', name: 'r', type: 'router', x: 0, y: 0 });
	m.put(BARE_KIND, { id: 'node-00000b', name: 'w', x: 60, y: 0 });
	return m;
};

test('F-c: a bare anchor is a node with no type, and the only anchor kind is the node', () => {
	assert.equal(BARE_KIND, 'node');
	assert.deepEqual(ANCHOR_KINDS, ['node'], 'read from the kind table: the rows marked anchor');
	assert.equal(isBareEntity('node', { id: 'node-00000a', type: 'router' }), false);
	assert.equal(isBareEntity('node', { id: 'node-00000b' }), true);
	assert.equal(isBareEntity('node', undefined), false, 'no entity is no bare anchor');
	assert.equal(isBareEntity('link', { id: 'link-00000c' }), false, 'only a node can be one');
	assert.equal(isTypedEntity('node', { id: 'node-00000a', type: 'router' }), true);
	assert.equal(isTypedEntity('node', { id: 'node-00000b' }), false);
	assert.deepEqual([drawnKind('node', { type: 'host' }), drawnKind('node', {}), drawnKind('zone', {})], ['node', 'waypoint', 'zone'], 'what each is drawn as (F4)');
	assert.deepEqual(['node', 'waypoint', 'link'].map(isAnchorWord), [true, true, false]);
});

test('F-b: the functions answer over a model, and over a plain document', () => {
	const m = board();
	assert.deepEqual(bareAnchors(m).map((w) => w.id), ['node-00000b']);
	assert.deepEqual(typedNodes(m).map((n) => n.id), ['node-00000a']);
	assert.equal(bareAnchor(m, 'node-00000b').name, 'w');
	assert.equal(bareAnchor(m, 'node-00000a'), undefined, 'a typed node is not bare');
	assert.equal(anchorOf(m, 'node-00000a').name, 'r');
	assert.equal(anchorOf(m, 'node-00000b').name, 'w');
	assert.equal(anchorOf(m, 'link-00000c'), undefined);
	assert.equal(m.endpointOf('node-00000b').name, 'w', 'the Model resolves an end through the same question');
	// `bareAnchorsOf`, the question asked of a plain document, went at S-e (H18.15) with its one caller, the link's references
	// in planner/validate.js -- the link's row reads the generic access, a Model or a document alike, through `isBareEntity`
});

/*
kernel/ may not import model/ (C9), so the export's adapter restates the question where it reads a document. Held to the
module by behaviour: the scene's waypoints are exactly the document's bare anchors -- so F-c, changing the module, fails here
until the adapter changes with it.
*/
test('F-b: the export\'s adapter draws exactly the document\'s bare anchors as waypoints, and the CLI reads the same', async () => {
	const doc = board().toJSON();
	const scene = docToSchema(doc).entities.filter((e) => e.kind === 'waypoint').map((e) => e.id);
	const bare = doc.nodes.filter((n) => isBareEntity('node', n)).map((w) => w.id);   // the module's question, per stored node
	assert.ok(bare.length > 0, 'the board has bare anchors, so the comparison is not vacuous');
	assert.deepEqual(scene, bare);
	// the CLI ships standalone (B138) and restates the question too
	const { isWaypoint } = await import('../cli/verbs.mjs');
	assert.deepEqual(doc.nodes.filter(isWaypoint).map((n) => n.id), bare);
});

// ---- the ratchet ----

const ROOTS = ['app/src', 'model', 'planner', 'engine', 'kernel', 'network', 'server', 'cli', 'lab/src', 'devices', 'zones', 'groups'];   // O-e1: and the plugins
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
	'devices/anchor-words.mjs': [2, 'the drawn word, derived from a stored entity (`drawnKind`, `isAnchorWord`) -- moved from model/ at O-e1'],
	'devices/make-node.mjs': [1, 'a new waypoint\'s NAME, `waypoint-<n>` -- the word people use (F4); moved with `makeWaypoint` from model/model.mjs at O-e1'],
	'network/link-reactions.mjs': [1, 'a reaction\'s id, `waypoint-links`, which names it in the generated table'],
	'cli/verbs.mjs': [19, 'the verbs\' words for the two shapes of node, read through the CLI\'s own view (F4)'],
	'kernel/adapt.mjs': [3, 'the scene\'s `waypoint` kind -- what is drawn, F4; kernel/ may not import model/ (C9)'],
	'kernel/engine.mjs': [2, 'the scene\'s `waypoint` kind -- what is drawn, F4'],
	'kernel/fixtures.mjs': [3, 'the spec viewer\'s scenes, in the scene\'s vocabulary'],
	'kernel/geometry.mjs': [1, 'the scene\'s `waypoint` kind -- what is drawn, F4'],
	'network/appearance.mjs': [1, 'the scene\'s `waypoint` kind -- what is drawn, F4'],
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
	'app/src/renderer.js': [2, 'the drawn waypoint\'s class and layer, and the layer it is stacked in, F4'],
	'lab/src/root.js': [1, 'the page\'s waypoint layer id'],
};

test('F-b, F-c: the old kind\'s literal appears in no product module beyond the record, each with its reason', () => {
	const measured = {};
	for (const f of ROOTS.flatMap(walk).sort()) {
		const n = codeLines(fs.readFileSync(path.join(root, f), 'utf8')).filter((l) => LITERAL.test(l)).length;
		if (n) measured[f] = n;
	}
	for (const f of new Set([...Object.keys(measured), ...Object.keys(RECORD)])) {
		const n = measured[f] ?? 0, r = RECORD[f]?.[0] ?? 0;
		assert.ok(n <= r, `${f}: ${n} line(s) name the old waypoint kind, recorded ${r} -- RISE: ask model/anchors.mjs instead`);
		assert.ok(n >= r, `${f}: ${n}, recorded ${r} -- FALL: lower the record in this commit, so the progress is written down`);
	}
});

test('F-b: the ratchet sees a reader that bypasses the module', () => {
	const bypass = "\tfor (const w of model.all('waypoint')) seen.add(w.id);";   // a reader naming the kind F-c removed
	assert.equal(codeLines(bypass).filter((l) => LITERAL.test(l)).length, 1);
	assert.equal(codeLines("\t// model.all('waypoint') in a comment").filter((l) => LITERAL.test(l)).length, 0, 'prose is free');
	assert.equal(codeLines('\tconst n = doc.waypoints.length;').filter((l) => LITERAL.test(l)).length, 1, 'the collection too');
});

// F-c: the export draws a waypoint under its node id, as a waypoint -- the shape `draw parity` and `draw render --summary` count
test('F-c: the export draws a waypoint as a waypoint, under its node id', async () => {
	const { svgDocument } = await import('../server/svg.mjs');
	const doc = { meta: { id: 'diagram-000001', name: 'x' }, zones: [], groups: [],
		nodes: [{ id: 'node-0000aa', name: 'a', type: 'host', x: 0, y: 0 }, { id: 'node-0000bb', name: 'b', type: 'host', x: 240, y: 0 }, { id: 'node-0000cc', name: 'w', x: 120, y: 60 }],
		links: [{ id: 'link-0000dd', name: 'l', src: 'node-0000aa', dst: 'node-0000bb', via: ['node-0000cc'] }] };
	const body = svgDocument(doc, KINDS).split('</defs>').pop();
	const count = (re) => (body.match(re) || []).length;
	assert.equal(count(/<g id="node-[0-9a-f]{6}"><g class="waypoint\b/g), 1, 'one waypoint, drawn as one');
	assert.equal(count(/<g id="node-[0-9a-f]{6}"/g), 3, 'beside the two typed nodes');
});
