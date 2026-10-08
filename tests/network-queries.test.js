/*
Q-a (H19.27; dev/design/unification/PLUGIN-QUERIES.md, Q1 ruled A) -- THE MODEL ASKS NO PLUGIN ANYTHING; THE NETWORK'S QUESTIONS
ARE THE NETWORK'S.

The core Model was built with `{ network }` and forwarded six questions to it under its own method names -- where a link is
drawn, whether it is down, what blocks it, which links pass through an anchor, whether an anchor declares its transit off,
whether what arrives stops there -- with the straight path a down link is drawn along. They are the network's functions over a
Model now (network/network-queries.mjs), each giving the answer a Model with no network gave, so no caller asks with an
optional call: at H19.25 three such calls answered "no links" once a method left the Model, instead of failing. The Model
holds what a plugin attaches to it (`attached`) and reads none of it; a row names the attachment its kind needs (`needs`).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Model } from '../model/model.mjs';
import { KINDS } from './fixtures/composed.mjs';
import { createNetwork } from '../network/network.mjs';
import { createTransit } from '../network/transit.mjs';
import { productKinds } from '../product/kinds.mjs';

const root = path.resolve(import.meta.dirname, '..');
const code = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const QUESTIONS = ['pathOf', 'linksRoutedThrough', 'isLinkDown', 'blockersOf', 'declaresNoTransit', 'stopsAt', 'straightPath'];
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true })
	.flatMap((e) => (e.isDirectory() ? (['node_modules', 'layers'].includes(e.name) ? [] : walk(path.join(d, e.name))) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []));
const queries = () => import('../network/network-queries.mjs');
const LINK = { id: 'link-0a0005', name: 'l', src: 'node-0a0001', dst: 'node-0a0003' };
const nodes = [{ id: 'node-0a0001', name: 'a', type: 'host', shape: 'circle', x: 0, y: 0 }, { id: 'node-0a0003', name: 'b', type: 'host', shape: 'circle', x: 240, y: 0 }];

test('Q-a: a Model with the network attached draws a link down when no pipe joins its ends, along its intent', async () => {
	const m = new Model({ kinds: KINDS, attached: { network: createNetwork(createTransit()) } });
	for (const n of nodes) m.put('node', n);
	m.put('link', LINK);
	const { isLinkDown, pathOf } = await queries();
	assert.equal(isLinkDown(m, LINK), true);
	assert.deepEqual(pathOf(m, LINK), [[0, 0], [240, 0]], 'drawn along its intent');
});

test('Q-a: the core Model asks no plugin anything -- no network, no question, no straight path', () => {
	const src = code('model/model.mjs');
	assert.doesNotMatch(src, /\bnetwork\b|MODEL_READS/, 'the core Model names no plugin');
	for (const q of QUESTIONS) assert.doesNotMatch(src, new RegExp(`\\b${q}\\b`), `the core Model names ${q}`);
});

test('Q-a: no caller asks one of the network\'s questions with an optional call', () => {
	const optional = new RegExp(`\\.(${QUESTIONS.join('|')})\\?\\.\\(`);
	for (const f of ['app/src', 'server', 'cli', 'lab', 'network', 'engine', 'kernel', 'model', 'planner', 'product', 'devices', 'zones', 'groups', 'tests'].flatMap(walk)) {
		assert.doesNotMatch(code(f), optional, `${f} asks with an optional call`);
	}
});

test('Q-a: with no network attached, each question gives the answer a Model with no network gave', async () => {
	const q = await queries();
	const m = new Model({ kinds: productKinds() });
	for (const n of nodes) m.put('node', n);
	assert.equal(q.pathOf(m, LINK), null);
	assert.deepEqual(q.linksRoutedThrough(m, 'node-0a0001'), []);
	assert.equal(q.isLinkDown(m, LINK), false);
	assert.deepEqual(q.blockersOf(m, LINK), []);
	assert.equal(q.declaresNoTransit(m, 'node-0a0001'), false);
	assert.equal(q.stopsAt(m, 'node-0a0001'), false);
	assert.deepEqual(q.straightPath(m, LINK), [[0, 0], [240, 0]], 'the straight path needs no network');
});

test('Q-a: a kind needing an attachment is refused without it, and the retired option is refused by name', () => {
	assert.throws(() => new Model({ kinds: KINDS }), /Model: kind link needs network attached -- \{ attached: \{ network \} \}/);
	assert.throws(() => new Model({ kinds: KINDS, network: createNetwork(createTransit()) }), /Model: unknown option network -- a plugin attaches as \{ attached: \{ network \} \}/);
	assert.deepEqual(KINDS.row('link').needs, ['network']);
});
