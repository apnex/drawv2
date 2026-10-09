/*
C-e, step four (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5: a plugin's edits are data, the canvas's generic builders
build every command) -- THE ZONE KEYS ARE THE ZONES PLUGIN'S.

`z` wraps the selection in a zone: a key row the zones plugin brings, which asks the canvas for the selection's bounds -- by
what each placed kind says its size is (C-c) -- and makes the zone through the host. Shift+arrows steps the size of a lone
selected entity: a key every placed plugin may answer, so the canvas keeps the one row and each part declares its step (a
zone grows a cell, a device's span a cell), and the help line is phrased from the parts that declare one. The builders left
app/src/commands.js (`wrapSelection`, `resizeZoneStep`, `resizeNodeStep`, `resizeNodeSpan`).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeInput, key, seedNodes } from './fixtures/client-harness.mjs';
import { PRODUCT_CANVAS } from '../product/canvas.mjs';
import { helpSections } from '../app/src/help.js';
import { makeWaypoint } from '../devices/make-node.mjs';
import { makeZone } from '../zones/make-zone.mjs';

const code = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const keyLines = (h) => helpSections(h.input.bindings()).find((s) => s.title === 'keys').lines;
const box = (z) => z && { x: z.x, y: z.y, w: z.w, h: z.h };
const arrow = (k) => key(k, { shiftKey: true });

test('C-e: z wraps a device and a waypoint in a zone, selected, and says its size -- the state under test', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		const w = makeWaypoint(h.model, { x: 120, y: 60 }); h.model.put('node', w);
		h.selection.set([d.id, w.id]);
		h.capture.onKeyDown(key('z'));
		const [z] = h.model.all('zone');
		assert.deepEqual(box(z), { x: -30, y: -30, w: 180, h: 120 });
		assert.deepEqual(h.selection.list(), [z.id]);
		assert.equal(h.called('readout.flash'), true);
	} finally { h.restore(); }
});

// B319 -- `z` fitted the zone to a device's origin cell alone: a wide device's other cells sat outside the zone it was wrapped in
test('B319: z wraps a wide device whole -- every cell it spans inside the zone', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		h.model.set('node', d.id, { span: { cols: 3, rows: 2 } });
		h.selection.set([d.id]);
		h.capture.onKeyDown(key('z'));
		assert.deepEqual(box(h.model.all('zone')[0]), { x: -30, y: -30, w: 180, h: 120 });
	} finally { h.restore(); }
});

test('C-e: Shift+arrow grows a lone zone a cell and a lone device\'s span a cell; a waypoint or a mixed selection, nothing -- the state under test', () => {
	const h = makeInput();
	try {
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		const w = makeWaypoint(h.model, { x: 240, y: 240 }); h.model.put('node', w);
		const z = makeZone(h.model, { x: 150, y: 150, w: 120, h: 120 }); h.model.put('zone', z);
		h.selection.set([z.id]); h.capture.onKeyDown(arrow('ArrowRight'));
		assert.equal(h.model.get('zone', z.id).w, 180, 'the zone a cell wider');
		h.selection.set([d.id]); h.capture.onKeyDown(arrow('ArrowDown'));
		assert.deepEqual(h.model.get('node', d.id).span, { cols: 1, rows: 2 }, 'the device a cell taller');
		// the model, not the commit count: a step is amended, and amends coalesce before they are sent
		h.selection.set([w.id]); h.capture.onKeyDown(arrow('ArrowRight'));
		assert.equal(h.model.get('node', w.id).span, undefined, 'a waypoint has no size to step');
		h.selection.set([z.id, d.id]); h.capture.onKeyDown(arrow('ArrowRight'));
		assert.deepEqual([h.model.get('zone', z.id).w, h.model.get('node', d.id).span], [180, { cols: 1, rows: 2 }], 'a mixed selection steps nothing');
	} finally { h.restore(); }
});

test('C-e: the help says Shift+arrow resizes a zone or grows a node -- as it did -- and says only what the parts present step', () => {
	const full = makeInput();
	try {
		assert.equal(keyLines(full).find((l) => l.inputs[0] === 'Shift+arrow keys').label, 'resize the selected zone, or grow the selected node');
	} finally { full.restore(); }
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'zones') });
	try {
		assert.equal(keyLines(h).find((l) => l.inputs[0] === 'Shift+arrow keys').label, 'grow the selected node');
		assert.equal(keyLines(h).some((l) => l.inputs[0] === 'z'), false, 'no zone key');
		const [d] = seedNodes(h.model, [[0, 0, 'host']]);
		h.selection.set([d.id]);
		h.capture.onKeyDown(key('z'));
		assert.equal(h.model.all('zone').length, 0, 'z makes nothing');
	} finally { h.restore(); }
});

test('C-e: the canvas holds no zone key or size step of its own', () => {
	assert.doesNotMatch(code('app/src/commands.js'), /wrapSelection|resizeZoneStep|resizeNodeStep|resizeNodeSpan|makeZone/);
	assert.doesNotMatch(code('app/src/input.js'), /wrapInZone|onWrapKey|resizeZoneStep|resizeNodeStep/);
	assert.doesNotMatch(code('app/src/keymap.js'), /id: 'wrap'/);
});

// ---- C-e, step five (D5): the group keys are the groups plugin's; a delete's order is each plugin's ----

const groups = (h) => h.model.all('group');

test('C-e: Ctrl+G groups the selected anchors, labelled "group", the selection kept; Ctrl+Shift+G on a member ungroups -- the state under test', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [120, 0]]);
		h.selection.set([a.id, b.id]);
		h.capture.onKeyDown(key('g', { ctrlKey: true }));
		assert.deepEqual(groups(h).map((g) => g.members.slice().sort()), [[a.id, b.id].sort()]);
		assert.equal(h.commits.at(-1).label, 'group');
		assert.deepEqual(h.selection.list(), [a.id, b.id], 'the selection kept');
		h.selection.set([a.id]);
		h.capture.onKeyDown(key('g', { ctrlKey: true, shiftKey: true }));
		assert.equal(groups(h).length, 0);
		assert.equal(h.commits.at(-1).label, 'ungroup');
	} finally { h.restore(); }
});

test('C-e: a delete sends a group, then a zone, then a link, then a node -- each plugin\'s rank', async () => {
	const { makeLink } = await import('../network/link-queries.mjs');
	const { makeGroup } = await import('../groups/make-group.mjs');
	const h = makeInput();
	try {
		const [a, b, c] = seedNodes(h.model, [[0, 0], [120, 0], [240, 240]]);
		const l = makeLink(h.model, a.id, b.id); h.model.put('link', l);
		const g = makeGroup(h.model, [a.id, b.id]); h.model.put('group', g);
		const z = makeZone(h.model, { x: 330, y: 330, w: 120, h: 120 }); h.model.put('zone', z);
		// a group -- reached only by the builder, handed one -- goes before them all, as the groups plugin ranks it
		const { deleteSelection, deleteRanksOf } = await import('../app/src/commands.js');
		const cmd = deleteSelection(h.model, new Set([c.id, l.id, z.id, g.id].reverse()), deleteRanksOf(PRODUCT_CANVAS));
		assert.deepEqual(cmd.entries.map((e) => e.kind), ['group', 'zone', 'link', 'node']);
		h.selection.set([c.id, l.id, z.id]);   // a group is never selected: the selection keeps no group id
		h.capture.onKeyDown(key('Delete'));
		assert.deepEqual(h.commits.at(-1).ops.map((o) => o.kind), ['zone', 'link', 'node'], 'on the page');
	} finally { h.restore(); }
});

test('C-e: without the groups plugin\'s part Ctrl+G groups nothing and the help offers no group key', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'groups') });
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [120, 0]]);
		h.selection.set([a.id, b.id]);
		h.capture.onKeyDown(key('g', { ctrlKey: true }));
		assert.equal(groups(h).length, 0);
		assert.equal(keyLines(h).some((l) => /^Ctrl\+(Shift\+)?G$/.test(l.inputs[0])), false);
	} finally { h.restore(); }
});

test('C-e: the canvas holds no group key, group builder or delete ranking of its own', () => {
	assert.doesNotMatch(code('app/src/commands.js'), /export function createGroup|export function ungroupAll|const RANK = \{/);
	assert.doesNotMatch(code('app/src/input.js'), /onGroupKey|onUngroupKey|groupOf\(/);
	assert.doesNotMatch(code('app/src/keymap.js'), /id: 'group'|id: 'ungroup'/);
});

// ---- C-e, step six (D5): the devices plugin's key -- s reshapes the selected devices ----

test('C-e: s flips each selected device between circle and square, labelled "reshape"; a waypoint and a link untouched -- the state under test', async () => {
	const { makeLink } = await import('../network/link-queries.mjs');
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [120, 0]]);
		h.model.set('node', b.id, { shape: 'square' });
		const w = makeWaypoint(h.model, { x: 240, y: 240 }); h.model.put('node', w);
		const l = makeLink(h.model, a.id, b.id); h.model.put('link', l);
		h.selection.set([a.id, b.id, w.id, l.id]);
		h.capture.onKeyDown(key('s'));
		assert.deepEqual([h.model.get('node', a.id).shape, h.model.get('node', b.id).shape], ['square', 'circle']);
		assert.equal(h.model.get('node', w.id).shape, undefined, 'a waypoint has no shape to flip');
		assert.equal(h.commits.at(-1).label, 'reshape');
		assert.deepEqual(h.commits.at(-1).ops.map((o) => o.id).sort(), [a.id, b.id].sort());
	} finally { h.restore(); }
});

test('C-e: without the devices plugin\'s part s reshapes nothing and the help offers no reshape key', () => {
	const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== 'devices') });
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.selection.set([a.id]);
		h.capture.onKeyDown(key('s'));
		assert.equal(h.model.get('node', a.id).shape, 'circle');
		assert.equal(keyLines(h).some((l) => l.inputs[0] === 's'), false);
	} finally { h.restore(); }
});

test('C-e: the canvas holds no reshape key or builder of its own', () => {
	assert.doesNotMatch(code('app/src/commands.js'), /reshapeNodes/);
	assert.doesNotMatch(code('app/src/input.js'), /onReshape\b/);
	assert.doesNotMatch(code('app/src/keymap.js'), /id: 'reshape'/);
});

// ---- C-e, step seven (D5): the network's link keys -- c, f, k, l and Shift+L -- are the network's ----

const linkBoard = async (h) => {
	const { makeLink } = await import('../network/link-queries.mjs');
	const [a, b, c] = seedNodes(h.model, [[0, 0], [240, 0], [480, 0]]);
	const w = makeWaypoint(h.model, { x: 120, y: 120 }); h.model.put('node', w);
	const bent = { ...makeLink(h.model, a.id, b.id), via: [w.id] }; h.model.put('link', bent);
	return { a, b, c, w, bent };
};

test('C-e: c closes and opens a bent link, f cycles its direction, k its plane -- each under its label -- the state under test', async () => {
	const h = makeInput();
	try {
		const { bent } = await linkBoard(h);
		const at = () => h.model.get('link', bent.id);
		const press = (k) => { h.selection.set([bent.id]); h.capture.onKeyDown(key(k)); return h.commits.at(-1).label; };
		assert.deepEqual([press('c'), at().closed], ['close path', true]);
		assert.deepEqual([press('c'), at().closed], ['open path', false]);
		assert.deepEqual([press('f'), at().direction], ['direction forward', 'forward']);
		assert.deepEqual([press('f'), at().direction], ['direction reverse', 'reverse']);
		assert.deepEqual([press('f'), 'direction' in at()], ['direction cleared', false], 'cleared: the key gone, not undefined');
		assert.deepEqual([press('k'), at().control], ['control plane', true]);
		assert.deepEqual([press('k'), 'control' in at()], ['data plane', false]);
	} finally { h.restore(); }
});

test('C-e: l chains the selected devices and Shift+L stars them -- the new links selected; a waypoint is no device -- the state under test', async () => {
	const h = makeInput();
	try {
		const { a, b, c, w } = await linkBoard(h);
		const before = new Set(h.model.all('link').map((l) => l.id));
		h.selection.set([b.id, c.id, w.id]);
		h.capture.onKeyDown(key('l'));
		const made = h.model.all('link').filter((l) => !before.has(l.id));
		assert.deepEqual(made.map((l) => [l.src, l.dst]), [[b.id, c.id]], 'b to c; the waypoint skipped');
		assert.deepEqual(h.selection.list(), made.map((l) => l.id));
		assert.equal(h.commits.at(-1).label, 'chain');
		h.selection.set([a.id, b.id, c.id]);
		h.capture.onKeyDown(key('L', { shiftKey: true }));
		assert.equal(h.commits.at(-1).label, 'star');
		assert.deepEqual(h.model.all('link').filter((l) => !before.has(l.id)).map((l) => [l.src, l.dst]).sort(), [[a.id, c.id], [b.id, c.id]].sort(),
			'a to c added; a to b and b to c already linked');
	} finally { h.restore(); }
});

test('C-e: composed without the network, c, f, k and l do nothing and the help offers none of them', async () => {
	const h = makeInput({ plugins: [] });
	try {
		const { b, c, bent } = await linkBoard(h);
		const was = JSON.stringify(h.model.get('link', bent.id));
		for (const k of ['c', 'f', 'k']) { h.selection.set([bent.id]); h.capture.onKeyDown(key(k)); }
		assert.equal(JSON.stringify(h.model.get('link', bent.id)), was);
		const links = h.model.all('link').length;
		h.selection.set([b.id, c.id]); h.capture.onKeyDown(key('l'));
		assert.equal(h.model.all('link').length, links);
		assert.equal(keyLines(h).some((l) => ['c', 'f', 'k', 'l', 'Shift+L'].includes(l.inputs[0])), false);
	} finally { h.restore(); }
});

test('C-e: the canvas holds no link key or link builder of its own', () => {
	assert.doesNotMatch(code('app/src/commands.js'), /export function (toggleClosed|cycleDirection|toggleControl|linkNodes)\b/);
	assert.doesNotMatch(code('app/src/input.js'), /toggleClosePath|cycleLinkDirection|toggleLinkPlane|linkSelectedNodes|onCloseKey|onDirectionKey|onPlaneKey|onChainKey|onStarKey/);
	assert.doesNotMatch(code('app/src/keymap.js'), /id: '(close|close-refused|direction|plane|chain|star)'/);
});

// ---- C-e, step eight (D5): what follows a clone -- a link both of whose ends were cloned, a group all of whose members were --
// is each plugin's to declare; the network's transit edit reaches history through a generic builder ----

const cloneBoard = async (h) => {
	const { makeLink } = await import('../network/link-queries.mjs');
	const { makeGroup } = await import('../groups/make-group.mjs');
	const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
	const w = makeWaypoint(h.model, { x: 120, y: 120 }); h.model.put('node', w);
	h.model.put('link', { ...makeLink(h.model, a.id, b.id), via: [w.id] });
	h.model.put('group', makeGroup(h.model, [a.id, b.id]));
	return { a, b };
};
const made = (h, before) => {
	const now = ['node', 'link', 'group'].flatMap((k) => h.model.all(k).filter((e) => !before.has(e.id)).map(() => k));
	return now.reduce((n, k) => ({ ...n, [k]: (n[k] ?? 0) + 1 }), {});
};
const ids = (h) => new Set(['node', 'link', 'group'].flatMap((k) => h.model.all(k).map((e) => e.id)));

test('C-e: Ctrl+D on two linked, grouped devices copies them, the link with a bend of its own, and the group -- the state under test', async () => {
	const h = makeInput();
	try {
		const { a, b } = await cloneBoard(h);
		const before = ids(h);
		h.selection.set([a.id, b.id]);
		h.capture.onKeyDown(key('d', { ctrlKey: true }));
		assert.deepEqual(made(h, before), { node: 3, link: 1, group: 1 });
	} finally { h.restore(); }
});

test('C-e: composed without the network part no link follows a clone; without the groups part no group does', async () => {
	for (const [owner, want] of [['network', { node: 2, group: 1 }], ['groups', { node: 3, link: 1 }]]) {
		const h = makeInput({ parts: PRODUCT_CANVAS.filter((p) => p.owner !== owner) });
		try {
			const { a, b } = await cloneBoard(h);
			const before = ids(h);
			h.selection.set([a.id, b.id]);
			h.capture.onKeyDown(key('d', { ctrlKey: true }));
			assert.deepEqual(made(h, before), want, `without ${owner}`);
		} finally { h.restore(); }
	}
});

test('C-e: the clone builder names no follower, and the network builds no command by hand', () => {
	const body = code('app/src/commands.js').slice(code('app/src/commands.js').indexOf('export function cloneSubgraph'));
	assert.doesNotMatch(body.slice(0, body.indexOf('\n}\n')), /model\.all\('(link|group)'\)|makeGroup/);
	assert.doesNotMatch(code('network/host.mjs'), /label: 'transit', entries/);
});

test('C-e: a group holding a link\'s bend follows a clone of the link\'s ends -- the link follows first, pulling the bend in', async () => {
	const { makeLink } = await import('../network/link-queries.mjs');
	const { makeGroup } = await import('../groups/make-group.mjs');
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [240, 0]]);
		const w = makeWaypoint(h.model, { x: 120, y: 120 }); h.model.put('node', w);
		h.model.put('link', { ...makeLink(h.model, a.id, b.id), via: [w.id] });
		h.model.put('group', makeGroup(h.model, [a.id, b.id, w.id]));
		// on the page a group is selected whole -- selecting a member selects them all, the bend too (measured) -- so the order
		// shows only when the builder is handed the link's ends alone: the link must follow first, or the group is left behind
		const { cloneSubgraph, followersOf } = await import('../app/src/commands.js');
		const { placesOf } = await import('../app/src/snap.js');
		const { clones } = cloneSubgraph(h.model, [a.id, b.id], placesOf(PRODUCT_CANVAS), followersOf(PRODUCT_CANVAS));
		assert.deepEqual(clones.map((c) => c.kind), ['node', 'node', 'node', 'link', 'group'], 'the ends, the bend the link pulls in, the link, the group');
		const before = ids(h);
		h.selection.set([a.id, b.id]);
		assert.equal(h.selection.list().length, 3, 'the bend selected with its group');
		h.capture.onKeyDown(key('d', { ctrlKey: true }));
		assert.deepEqual(made(h, before), { node: 3, link: 1, group: 1 });
	} finally { h.restore(); }
});

test('C-e: editOf hands over copies -- a put\'s entity and a set\'s patch are never the objects it was given', async () => {
	const { editOf } = await import('../app/src/commands.js');
	const entity = { id: 'node-ab0001', name: 'w', x: 0, y: 0 };
	const after = { transit: false };
	const cmd = editOf('transit', [{ op: 'put', kind: 'node', entity }, { op: 'set', kind: 'node', id: 'node-ab0002', after }]);
	assert.equal(cmd.label, 'transit');
	assert.deepEqual(cmd.entries, [{ op: 'put', kind: 'node', entity }, { op: 'set', kind: 'node', id: 'node-ab0002', after }]);
	assert.notEqual(cmd.entries[0].entity, entity);
	assert.notEqual(cmd.entries[1].after, after);
});
