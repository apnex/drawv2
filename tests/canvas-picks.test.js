/*
C-b (H19.30; dev/design/unification/CANVAS-PLUGINS.md, D1) -- WHAT THE POINTER LANDED ON IS ANSWERED BY THE PLUGIN THAT DREW IT.

The picker named every kind -- a device's group, a waypoint's, a zone's (under Shift only), a link and its click twin -- in
product code (app/src/pick.js `hitOf`). A painter or an appearance declares how its element is picked now: the selector its
element answers to (or the class the target itself carries), the word the hit is called by, and a modifier it is picked
under -- the zone, a backdrop, only with Shift held, passing a plain press through to the canvas (DESIGN U1). The canvas keeps
what spans kinds: handles (C-d's), a plugin's mark (`data-select`), the canvas. The hits are what they were: the gesture corpus
holds that.

A refinement chosen in the build: no new attribute. The design said every drawn entity would carry its id on one attribute;
every entity's element already carries it as `id` (a link's click twin as `data-link`), and the DOM is held byte for byte, so
each drawer declares how its element is found instead.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { picksOf, hitWith } from '../app/src/pick.js';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
// a target inside an element of this id answering to selectors carrying `word`, or carrying classes itself
const inside = (word, id) => ({ classList: { contains: () => false }, dataset: {}, closest: (s) => (s.includes(word) ? { id } : null) });
const self = (cls, attrs = {}) => ({ id: attrs.id, classList: { contains: (c) => c === cls }, dataset: attrs.dataset ?? {}, closest: () => null });
const hit = hitWith(picksOf(PRODUCT_CANVAS));

test('C-b: the product\'s picks answer a device, a waypoint, a zone under Shift, a link and its twin -- the state under test', () => {
	assert.deepEqual(hit({ target: inside('node', 'node-0b0001') }), { kind: 'node', id: 'node-0b0001' });
	assert.deepEqual(hit({ target: inside('waypoint', 'node-0b0002') }), { kind: 'waypoint', id: 'node-0b0002' });
	assert.deepEqual(hit({ target: inside('zone', 'zone-0b0003'), shiftKey: true }), { kind: 'zone', id: 'zone-0b0003' });
	assert.deepEqual(hit({ target: inside('zone', 'zone-0b0003') }), { kind: 'canvas', id: null }, 'a zone passes a plain press through (U1)');
	assert.deepEqual(hit({ target: self('link', { id: 'link-0b0004' }) }), { kind: 'link', id: 'link-0b0004' });
	assert.deepEqual(hit({ target: self('link-hit', { dataset: { link: 'link-0b0004' } }) }), { kind: 'link', id: 'link-0b0004' }, 'the click twin takes the click (B268)');
	assert.deepEqual(hit({ target: self('handle', { dataset: { corner: 'se' } }) }), { kind: 'handle', id: 'se' });
	assert.deepEqual(hit({ target: { classList: { contains: () => false }, dataset: { select: 'pipe-0b0001-0b0002' }, closest: () => null } }), { kind: 'pipe', id: 'pipe-0b0001-0b0002', mark: true });
	assert.deepEqual(hit({ target: { classList: { contains: () => false }, dataset: {}, closest: () => null } }), { kind: 'canvas', id: null });
});

test('C-b: without the zones plugin a zone is never picked -- the rule is the plugin\'s', () => {
	const without = hitWith(picksOf(PRODUCT_CANVAS.filter((p) => p.owner !== 'zones')));
	assert.deepEqual(without({ target: inside('zone', 'zone-0b0003'), shiftKey: true }), { kind: 'canvas', id: null });
});

test('C-b: the picker names no plugin\'s kind -- each drawer declares how its element is picked', () => {
	assert.doesNotMatch(code('app/src/pick.js'), /g\.node|g\.waypoint|g\.zone|'link(-hit)?'|'node'|'waypoint'|'zone'/);
	const owners = picksOf(PRODUCT_CANVAS).map((p) => `${p.owner}:${p.word}`);
	assert.deepEqual(owners.sort(), ['devices:node', 'network:link', 'network:link', 'network:waypoint', 'zones:zone']);
});

test('C-b: a malformed pick is refused when the picks are composed, naming its owner', () => {
	assert.throws(() => picksOf([{ owner: 'p', painters: [{ kind: 'x', layer: 'zones', create() {}, update() {}, picks: [{ closest: 'g.x' }] }] }]), /pick: p's pick for x names no word/);
	assert.throws(() => picksOf([{ owner: 'p', painters: [{ kind: 'x', layer: 'zones', create() {}, update() {}, picks: [{ word: 'x' }] }] }]), /pick: p's pick for x answers to no selector and no class/);
});

test('C-b: a backdrop is tried after what is drawn over it -- a target answering every pick is the device, not the zone', () => {
	const everywhere = { classList: { contains: () => false }, dataset: {}, closest: () => ({ id: 'node-0b0009' }) };
	assert.deepEqual(hit({ target: everywhere }), { kind: 'node', id: 'node-0b0009' });
	assert.equal(picksOf(PRODUCT_CANVAS).at(-1).word, 'zone', 'the zone, the one backdrop, last');
});
