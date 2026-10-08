/*
K13d (H19.25; dev/design/h17/PLAN.md K13d; KINDS-AS-PLUGINS.md section 17) -- THE MODEL'S LINK METHODS ARE THE NETWORK'S.

The link has been the network plugin's kind since S-e (H18.15; G5), but the core Model kept five methods that read it by name
-- `linksOf`, `linksAt`, `linkBetween`, `linksBetween`, `makeLink` -- the last place the core named a kind but the anchor
(tests/core-names-no-plugin.test.js recorded them as K13d's debt). They are the network's functions now
(network/link-queries.mjs), answering from the relations index when one is attached and by a scan otherwise, as the Model
did. Nothing a user sees changes.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Model } from './fixtures/composed.mjs';
import { attachRelations } from '../engine/store.mjs';
import { cellOf } from '../kernel/geometry.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const queries = () => import('../network/link-queries.mjs');
const board = (indexed) => {
	const m = new Model();
	if (indexed) attachRelations(m, { cellOf });
	for (const [h, x] of [['0f0001', 0], ['0f0002', 240], ['0f0004', 480]]) m.put('node', { id: `node-${h}`, name: h, type: 'host', shape: 'circle', x, y: 0 });
	m.put('node', { id: 'node-0f0003', name: 'w', x: 120, y: 120 });
	m.put('link', { id: 'link-0f0005', name: 'a', src: 'node-0f0001', dst: 'node-0f0002' });
	m.put('link', { id: 'link-0f0006', name: 'b', src: 'node-0f0002', dst: 'node-0f0001', via: ['node-0f0003'] });
	m.put('link', { id: 'link-0f0007', name: 'c', src: 'node-0f0002', dst: 'node-0f0004' });
	return m;
};
const ids = (links) => links.map((l) => l.id);

test('K13d: the Model holds the links it is given -- the state under test', () => {
	const m = board(false);
	assert.deepEqual(m.all('link').map((l) => l.id).sort(), ['link-0f0005', 'link-0f0006', 'link-0f0007']);
});

test('K13d: the core Model names no link and makes none', () => {
	assert.doesNotMatch(code('model/model.mjs'), /'links?'/, 'the core Model names no plugin kind');
	const m = board(false);
	for (const name of ['linksOf', 'linksAt', 'linkBetween', 'linksBetween', 'makeLink']) assert.equal(typeof m[name], 'undefined', `the Model has no ${name}`);
});

test('K13d: the network answers which links meet an anchor, from the index and from the scan alike', async () => {
	const { linksOf, linksAt, linkBetween, linksBetween } = await queries();
	for (const indexed of [true, false]) {
		const m = board(indexed);
		assert.equal(!!m.index, indexed);
		assert.deepEqual(ids(linksOf(m, 'node-0f0002')), ['link-0f0005', 'link-0f0006', 'link-0f0007'], 'every link ending at it, by id');
		assert.deepEqual(ids(linksAt(m, 'node-0f0003')), ['link-0f0006'], 'a bend: the link through it');
		assert.deepEqual(ids(linksBetween(m, 'node-0f0001', 'node-0f0002')), ['link-0f0005', 'link-0f0006'], 'either direction');
		assert.equal(linkBetween(m, 'node-0f0002', 'node-0f0001').id, 'link-0f0005', 'the lowest id among them (B246)');
		assert.equal(linkBetween(m, 'node-0f0001', 'node-0f0004'), undefined);
	}
});

test('K13d: the network makes a link as the Model did -- a fresh id, the next name, the next order', async () => {
	const { makeLink } = await queries();
	const m = board(false);
	const l = makeLink(m, 'node-0f0001', 'node-0f0004');
	assert.match(l.id, /^link-[0-9a-f]{6}$/);
	assert.deepEqual({ ...l, id: 0 }, { id: 0, name: 'link-1', order: 1, src: 'node-0f0001', dst: 'node-0f0004' });
});
