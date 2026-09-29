/*
The order links were made in -- network/order.mjs, which says which link is OLDER (ruled 2026-09-30: "the
older link keeps a contested hand-laid pipe"). Session state in the lab, as pipes are; stored at promotion.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLinkOrder } from '../network/order.mjs';

test('links are ranked in the order they are first noted, and noting again changes nothing', () => {
	const o = createLinkOrder();
	o.note(['link-b', 'link-a']);
	o.note(['link-a', 'link-c']);
	assert.ok(o.rankOf('link-b') < o.rankOf('link-a') && o.rankOf('link-a') < o.rankOf('link-c'));
});

test('a link never noted is the newest of all', () => {
	const o = createLinkOrder();
	o.note(['link-a']);
	assert.equal(o.rankOf('link-new'), Infinity);
});

test('a link is never forgotten, so undoing its deletion gives it back its place', () => {
	const o = createLinkOrder();
	o.note(['link-a', 'link-b']);
	const was = o.rankOf('link-a');
	o.note(['link-b']);   // link-a deleted: it is simply not noted this time
	o.note(['link-a', 'link-b', 'link-c']);   // and restored by undo
	assert.equal(o.rankOf('link-a'), was);
});
