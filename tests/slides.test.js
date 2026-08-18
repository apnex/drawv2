import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSlidesUrl, deleteRequests, createRequests, connectRequests, groupRequests, makeScale, OWNED_ID } from '../server/slides/transform.js';
import { SlidesSync } from '../server/slides/sync.js';
import { GoogleAuth } from '../server/slides/auth.js';

const DOC = {
	meta: {
		id: 'diagram-000001', name: 'demo', version: 1,
		slides: { url: 'https://docs.google.com/presentation/d/PRES_ID-123/edit#slide=id.p7', presentationId: '', pageId: '' }
	},
	nodes: [
		{ id: 'node-aaaa01', name: 'web-1', type: 'host', x: -720, y: 0 },
		{ id: 'node-aaaa02', name: 'db-1', type: 'server', x: -480, y: 0 }
	],
	links: [{ id: 'link-aaaa03', src: 'node-aaaa01', dst: 'node-aaaa02' }],
	zones: [{ id: 'zone-aaaa04', name: 'dmz', x: -810, y: -90, w: 420, h: 180 }],
	groups: [{ id: 'group-aaaa05', name: 'tier', members: ['node-aaaa01', 'node-aaaa02'] }]
};

test('parseSlidesUrl extracts presentation and slide ids', () => {
	assert.deepEqual(parseSlidesUrl('https://docs.google.com/presentation/d/abc_DEF-123/edit#slide=id.p7'),
		{ presentationId: 'abc_DEF-123', pageId: 'p7' });
	assert.deepEqual(parseSlidesUrl('https://docs.google.com/presentation/d/xyz/edit'),
		{ presentationId: 'xyz', pageId: null });
	// real slide ids can carry hyphens, colons, underscores
	assert.equal(parseSlidesUrl('https://docs.google.com/presentation/d/x/edit#slide=id.g1234abc_0-5').pageId, 'g1234abc_0-5');
	assert.equal(parseSlidesUrl('https://docs.google.com/presentation/d/x/edit#slide=id.SLIDES_API123:4').pageId, 'SLIDES_API123:4');
	// published-to-web links are detected, not mistaken for presentation id 'e'
	assert.equal(parseSlidesUrl('https://docs.google.com/presentation/d/e/2PACX-xyz/pub').published, true);
	assert.equal(parseSlidesUrl('https://example.com/nope'), null);
	assert.equal(parseSlidesUrl(''), null);
	assert.equal(parseSlidesUrl(undefined), null);
});

test('OWNED_ID matches exactly the ids draw creates', () => {
	['node-aaaa01', 'link-aaaa03', 'zone-aaaa04', 'node-aaaa01--label', 'zone-aaaa04--label',
		'node-aaaa01--hub', 'node-aaaa01--g'].forEach((id) =>
		assert.ok(OWNED_ID.test(id), id));
	['group-aaaa05', 'node-XYZ', 'p7', 'mytextbox', 'node-aaaa01--other'].forEach((id) =>
		assert.ok(!OWNED_ID.test(id), id));
});

// default 10in page: 1px = 4762.5 EMU, page center (4572000, 2571750)
const S = 4762.5, CX = 4572000, CY = 2571750;
const ex = (px) => Math.round(CX + px * S);
const ey = (py) => Math.round(CY + py * S);

test('createRequests: center-anchored integer-EMU geometry; uniform circle nodes', () => {
	const reqs = createRequests(DOC, 'p7');
	const host = reqs.find((r) => r.createShape && r.createShape.objectId === 'node-aaaa01').createShape;
	assert.equal(host.shapeType, 'ELLIPSE');
	assert.equal(host.elementProperties.transform.translateX, ex(-720 - 21));
	assert.equal(host.elementProperties.transform.translateY, ey(0 - 21));
	assert.equal(host.elementProperties.transform.unit, 'EMU');
	assert.equal(host.elementProperties.size.width.magnitude, Math.round(42 * S));
	assert.ok(Number.isInteger(host.elementProperties.transform.translateX), 'integer EMU');
	assert.equal(host.elementProperties.pageObjectId, 'p7');

	// every node type is a circle — faithful to the canvas (per-type shapes deferred)
	const server = reqs.find((r) => r.createShape && r.createShape.objectId === 'node-aaaa02').createShape;
	assert.equal(server.shapeType, 'ELLIPSE');
	const zone = reqs.find((r) => r.createShape && r.createShape.objectId === 'zone-aaaa04').createShape;
	assert.equal(zone.shapeType, 'RECTANGLE', 'sharp corners: API has no radius adjustment');

	// the center hub: 6px dot at the node center, created AFTER the circle (renders on top)
	const hub = reqs.find((r) => r.createShape && r.createShape.objectId === 'node-aaaa01--hub').createShape;
	assert.equal(hub.shapeType, 'ELLIPSE');
	assert.equal(hub.elementProperties.size.width.magnitude, Math.round(6 * S));
	assert.equal(hub.elementProperties.transform.translateX, ex(-720 - 3));
	const order = reqs.filter((r) => r.createShape).map((r) => r.createShape.objectId);
	assert.ok(order.indexOf('node-aaaa01') < order.indexOf('node-aaaa01--hub'), 'hub above circle');

	// label "padding 0": MIDDLE content alignment cancels the uncontrollable insets
	const labelProps = reqs.find((r) => r.updateShapeProperties && r.updateShapeProperties.objectId === 'node-aaaa01--label');
	assert.equal(labelProps.updateShapeProperties.shapeProperties.contentAlignment, 'MIDDLE');
	const labelShape = reqs.find((r) => r.createShape && r.createShape.objectId === 'node-aaaa01--label').createShape;
	assert.equal(labelShape.elementProperties.transform.translateY, ey(0 + 21 + 1));

	// long names get wrap-proof boxes sized to the text, still centered
	const long = createRequests({ nodes: [{ id: 'node-aaaa07', name: 'a-very-long-loadbalancer-name', type: 'host', x: 0, y: 0 }] }, 'p7');
	const longLabel = long.find((r) => r.createShape && r.createShape.objectId === 'node-aaaa07--label').createShape;
	const w = 29 * 9.6 + 48; // 326.4px
	assert.equal(longLabel.elementProperties.size.width.magnitude, Math.round(w * S));
	assert.equal(longLabel.elementProperties.transform.translateX, ex(-w / 2));
});

test('groupRequests bundles circle + hub + label per node', () => {
	const reqs = groupRequests(DOC);
	assert.equal(reqs.length, 2);
	assert.deepEqual(reqs[0].groupObjects, {
		groupObjectId: 'node-aaaa01--g',
		childrenObjectIds: ['node-aaaa01', 'node-aaaa01--hub', 'node-aaaa01--label']
	});
	// unnamed nodes have no label to group
	const bare = groupRequests({ nodes: [{ id: 'node-aaaa08', name: '', type: 'host', x: 90, y: 90 }] });
	assert.deepEqual(bare[0].groupObjects.childrenObjectIds, ['node-aaaa08', 'node-aaaa08--hub']);
});

test('createRequests: background, z-order, labels, alpha contracts', () => {
	const reqs = createRequests(DOC, 'p7');
	assert.ok(reqs[0].updatePageProperties, 'background first');

	const order = reqs.filter((r) => r.createShape || r.createLine)
		.map((r) => (r.createShape || r.createLine).objectId);
	assert.ok(order.indexOf('zone-aaaa04') < order.indexOf('link-aaaa03'), 'zones under links');
	assert.ok(order.indexOf('link-aaaa03') < order.indexOf('node-aaaa01'), 'links under nodes');

	// node labels are adjacent text boxes; zone labels live INSIDE the zone shape
	const labels = order.filter((id) => id.endsWith('--label'));
	assert.deepEqual(labels.sort(), ['node-aaaa01--label', 'node-aaaa02--label']);
	const zoneText = reqs.find((r) => r.insertText && r.insertText.objectId === 'zone-aaaa04');
	assert.equal(zoneText.insertText.text, 'dmz');

	const zoneStyle = reqs.find((r) => r.updateShapeProperties && r.updateShapeProperties.objectId === 'zone-aaaa04');
	assert.equal(zoneStyle.updateShapeProperties.shapeProperties.shapeBackgroundFill.solidFill.alpha, 0.3);
	assert.equal(zoneStyle.updateShapeProperties.shapeProperties.contentAlignment, 'TOP');

	// node fill alpha explicit: the broad field mask would otherwise reset it to 0
	const nodeStyle = reqs.find((r) => r.updateShapeProperties && r.updateShapeProperties.objectId === 'node-aaaa01');
	assert.equal(nodeStyle.updateShapeProperties.shapeProperties.shapeBackgroundFill.solidFill.alpha, 1);

	// every text styling request must address a textRange or the API rejects it
	reqs.filter((r) => r.updateTextStyle || r.updateParagraphStyle).forEach((r) => {
		const req = r.updateTextStyle || r.updateParagraphStyle;
		assert.equal(req.textRange.type, 'ALL', `textRange on ${req.objectId}`);
	});

	assert.ok(!order.some((id) => id.startsWith('group-')));
	assert.ok(!reqs.some((r) => r.createImage), 'native shapes only — never images');
});

test('createRequests: link spans ring edge to ring edge', () => {
	const reqs = createRequests(DOC, 'p7');
	const line = reqs.find((r) => r.createLine).createLine;
	assert.equal(line.lineCategory, 'STRAIGHT');
	assert.equal(line.elementProperties.size.width.magnitude, Math.round(198 * S));
	assert.equal(line.elementProperties.transform.translateX, ex(-699));
});

test('createRequests: links with missing endpoints are skipped', () => {
	const doc = { ...DOC, links: [{ id: 'link-ffffff', src: 'node-aaaa01', dst: 'node-gone99' }] };
	assert.ok(!createRequests(doc, 'p7').some((r) => r.createLine));
});

test('deleteRequests: full pattern wipe on target slide, model-ids-only elsewhere', () => {
	const modelIds = new Set(['node-aaaa01', 'node-aaaa02', 'link-aaaa03', 'zone-aaaa04']);
	const presentation = {
		slides: [
			{
				objectId: 'p1',
				pageElements: [
					{ objectId: 'node-0dd001' }, // stale: deleted entity, pattern-wiped on target
					{ objectId: 'usershape_1' },
					{ // user grouped our shapes with nothing else: delete the group itself
						objectId: 'g_allmine',
						elementGroup: { children: [{ objectId: 'node-aaaa02' }, { objectId: 'node-aaaa02--label' }] }
					},
					{ // mixed group: only our children die
						objectId: 'g_mixed',
						elementGroup: {
							children: [
								{ objectId: 'link-aaaa03' },
								{ objectId: 'theirshape' },
								{ objectId: 'g_nested', elementGroup: { children: [{ objectId: 'zone-aaaa04' }] } }
							]
						}
					}
				]
			},
			{
				objectId: 'p2',
				pageElements: [
					{ objectId: 'zone-bbbb01' },       // SIBLING diagram's push: must survive
					{ objectId: 'node-aaaa01--label' } // this diagram's leftover after a rebind: wiped
				]
			}
		]
	};
	const ids = deleteRequests(presentation, 'p1', modelIds).map((r) => r.deleteObject.objectId);
	assert.deepEqual(ids.sort(), ['g_allmine', 'g_nested', 'link-aaaa03', 'node-0dd001', 'node-aaaa01--label']);
	assert.ok(!ids.includes('zone-bbbb01'), 'sibling diagram pushes are never touched');
});

test('connectRequests binds each link to the center hubs (no reroute needed)', () => {
	const reqs = connectRequests(DOC);
	assert.equal(reqs.length, 1);
	const props = reqs[0].updateLineProperties;
	assert.equal(props.lineProperties.startConnection.connectedObjectId, 'node-aaaa01--hub');
	assert.equal(props.lineProperties.endConnection.connectedObjectId, 'node-aaaa02--hub');
	assert.ok(!reqs.some((r) => r.rerouteLine), 'hub sites are all the center: site 0 is always right');
});

function fakeTransport(pages) {
	const calls = [];
	return {
		calls,
		get: async (id) => { calls.push(['get', id]); return { presentationId: id, slides: pages }; },
		batchUpdate: async (id, requests) => { calls.push(['batch', id, requests]); return {}; }
	};
}

test('SlidesSync.push: wipe -> create -> connect against the bound page', async () => {
	const transport = fakeTransport([
		{ objectId: 'p1', pageElements: [{ objectId: 'node-0dd001' }] }, // a SIBLING diagram's push: kept
		{ objectId: 'p7', pageElements: [{ objectId: 'theirshape' }, { objectId: 'zone-57a1e0' }] }
	]);
	const sync = new SlidesSync(null, transport);
	const report = await sync.push(DOC);

	assert.equal(report.presentationId, 'PRES_ID-123');
	assert.equal(report.pageId, 'p7', 'slide id from the URL fragment wins');
	assert.equal(report.deleted, 1, 'stale object on the TARGET slide wiped; sibling diagram kept');
	assert.equal(report.staleDeleted, 1, 'stale object reported');
	assert.equal(report.entities, 4, 'nodes+links+zones');
	assert.ok(report.objects > report.entities, 'labels counted separately');
	assert.equal(report.linksConnected, true);

	assert.equal(report.nodesGrouped, true);
	const batches = transport.calls.filter((c) => c[0] === 'batch');
	assert.equal(batches.length, 4, 'wipe, create, connect, group');
	assert.ok(batches[0][2][0].deleteObject);
	assert.ok(batches[1][2][0].updatePageProperties);
	assert.ok(batches[2][2][0].updateLineProperties.lineProperties.startConnection);
	assert.ok(batches[3][2][0].groupObjects);
});

test('SlidesSync.push: bound page missing errors instead of silently wiping slide 1', async () => {
	const transport = fakeTransport([{ objectId: 'pOther', pageElements: [] }]);
	const sync = new SlidesSync(null, transport);
	await assert.rejects(() => sync.push(DOC), (err) => err.code === 'no-page' && /p7/.test(err.message));
});

test('SlidesSync.push: no fragment falls back to first slide; remembered binding wins over fallback', async () => {
	const transport = fakeTransport([{ objectId: 'pFirst', pageElements: [] }, { objectId: 'pSaved', pageElements: [] }]);
	const sync = new SlidesSync(null, transport);
	const doc = JSON.parse(JSON.stringify(DOC));
	doc.meta.slides.url = 'https://docs.google.com/presentation/d/XX/edit';
	let report = await sync.push(doc);
	assert.equal(report.pageId, 'pFirst');

	// remembered binding only counts for the SAME presentation
	doc.meta.slides.presentationId = 'XX';
	doc.meta.slides.pageId = 'pSaved';
	report = await sync.push(doc);
	assert.equal(report.pageId, 'pSaved');

	// stale binding from a DIFFERENT presentation falls back to the first slide
	doc.meta.slides.presentationId = 'OLD_DECK';
	report = await sync.push(doc);
	assert.equal(report.pageId, 'pFirst');

	// remembered slide deleted since last push: graceful fallback, no error
	doc.meta.slides.presentationId = 'XX';
	doc.meta.slides.pageId = 'pGone';
	report = await sync.push(doc);
	assert.equal(report.pageId, 'pFirst');
});

test('SlidesSync.push: create failure after wipe reports partial state', async () => {
	const transport = fakeTransport([{ objectId: 'p7', pageElements: [{ objectId: 'node-aaaa01' }] }]);
	transport.batchUpdate = async (id, requests) => {
		if (requests[0].deleteObject) return {};
		throw new Error('boom');
	};
	const sync = new SlidesSync(null, transport);
	await assert.rejects(() => sync.push(DOC), (err) =>
		err.partial?.deleted === 1 && /push again/.test(err.message));
});

test('SlidesSync.push: connector rejection does not fail the push', async () => {
	const transport = fakeTransport([{ objectId: 'p7', pageElements: [] }]);
	const realBatch = transport.batchUpdate;
	transport.batchUpdate = async (id, requests) => {
		if (requests[0].updateLineProperties?.lineProperties?.startConnection) throw new Error('bad site');
		return realBatch(id, requests);
	};
	const sync = new SlidesSync(null, transport);
	const report = await sync.push(DOC);
	assert.equal(report.linksConnected, false);
	assert.equal(report.nodesGrouped, true, 'grouping still attempted after connect failure');
	assert.ok(report.objects > 0);
});

test('SlidesSync.push: group rejection does not fail the push', async () => {
	const transport = fakeTransport([{ objectId: 'p7', pageElements: [] }]);
	const realBatch = transport.batchUpdate;
	transport.batchUpdate = async (id, requests) => {
		if (requests[0].groupObjects) throw new Error('cannot group');
		return realBatch(id, requests);
	};
	const sync = new SlidesSync(null, transport);
	const report = await sync.push(DOC);
	assert.equal(report.nodesGrouped, false);
	assert.equal(report.linksConnected, true, 'hub binding survives without grouping');
});

test('SlidesSync.push: errors carry codes', async () => {
	const sync = new SlidesSync(null, fakeTransport([]));
	await assert.rejects(() => sync.push({ ...DOC, meta: { ...DOC.meta, slides: { url: '' } } }),
		(err) => err.code === 'no-url');
	await assert.rejects(() => sync.push({ ...DOC, meta: { ...DOC.meta, slides: { url: 'https://what.ever/x' } } }),
		(err) => err.code === 'bad-url');
	await assert.rejects(() => sync.push({ ...DOC, meta: { ...DOC.meta, slides: { url: 'https://docs.google.com/presentation/d/e/2PACX-x/pub' } } }),
		(err) => err.code === 'bad-url' && /published/.test(err.message));
	await assert.rejects(() => sync.push(DOC), (err) => err.code === 'no-page');
});

test('GoogleAuth: invalid_grant clears the token so the next push re-authorizes', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-auth-'));
	fs.writeFileSync(path.join(dir, 'google-credentials.json'),
		JSON.stringify({ installed: { client_id: 'cid', client_secret: 'sec' } }));
	const auth = new GoogleAuth(dir);
	auth.saveToken({ refresh_token: 'dead', access_token: 'old', expiry: 0 });
	assert.ok(auth.authorized());

	const realFetch = globalThis.fetch;
	globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: 'invalid_grant' }) });
	try {
		await assert.rejects(() => auth.accessToken(), /not authorized/);
	} finally {
		globalThis.fetch = realFetch;
	}
	assert.ok(!auth.authorized(), 'token cleared');
	assert.ok(!fs.existsSync(path.join(dir, 'google-token.json')));
	fs.rmSync(dir, { recursive: true, force: true });
});

test('GoogleAuth: state nonce round-trip', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-auth2-'));
	fs.writeFileSync(path.join(dir, 'google-credentials.json'),
		JSON.stringify({ installed: { client_id: 'cid', client_secret: 'sec' } }));
	const auth = new GoogleAuth(dir);
	const url = new URL(auth.authUrl('http://localhost:1/oauth2callback'));
	const state = url.searchParams.get('state');
	assert.ok(state && state.length >= 32);
	assert.ok(!auth.checkState('forged'), 'forged state rejected');
	assert.ok(auth.checkState(state), 'real state accepted after a forged attempt');
	assert.ok(!auth.checkState(state), 'nonce is single-use');
	fs.rmSync(dir, { recursive: true, force: true });
});
