#!/usr/bin/env node
/*
H25.0b (B366) -- THE BOARDS THE PARITY PROBE AND THE BROWSER PARITY TEST DRAW, one definition for both.

The parity board holds every thing a diagram draws whose look the page, the export and two commits could disagree on: devices
with their names, a zone with its name, a text panel with a plain row and a clickable one, directed links with their heads and
legs, a junction three links meet at, a link running beneath a device, a link with no direction, a DOWN link with a head (no
pipe joins its ends), a group, an endpoint armed with a spawner, and a plain endpoint. H25.0's review found the board had no down link and no
group, so a change turning a down link's head blue, or a hull's stroke, would have passed the test meant to catch it (finding 3).
H25.2b (B370): nor had it a spawner, so the published file drew a spawning endpoint as a plain one, where the page draws it green,
and nothing compared the two until the probe met it in two of the director's diagrams; and nor a plain endpoint, so a change
painting every endpoint in the spawning green passed the test as well (found by H25.2b's verifier).

tests/browser.test.js `H24.8 (B361)` draws it in the page and the served file; tools/probe/parity.mjs draws it at two commits.
*/
import { productKinds } from '../../product/kinds.mjs';
import { pipeEntity } from '../../network/pipe-kind.mjs';

export const PARITY_DIAGRAM = '0000000000fa0001';

export function parityBoard() {
	const device = (id, name, type, x, y, order) => ({ id, name, type, shape: 'square', x, y, order });
	const link = (n, src, dst, direction = 'forward') => ({ id: `link-fa000${n}`, name: `l${n}`, src, dst, ...(direction ? { direction } : {}), order: n });
	const piped = [['node-fa00a1', 'node-fa00a2'], ['node-fa00a4', 'node-fa00b1'], ['node-fa00a2', 'node-fa00b1'], ['node-fa00b1', 'node-fa00a1'], ['node-fa00a1', 'node-fa00a4'], ['node-fa00b2', 'node-fa00a2'], ['node-fa00b3', 'node-fa00a4']];
	return {
		// the two layouts every schema 3 document holds -- the layouts plugin's, so the network is not composed here (tests/read-model.test.js R-a)
		meta: { id: PARITY_DIAGRAM, name: 'parity', version: 1, schema: 3 }, layouts: structuredClone(productKinds().always.layout),
		nodes: [
			device('node-fa00a1', 'alpha', 'router', -360, 0, 1),
			device('node-fa00a2', 'bravo', 'host', 360, 0, 2),
			device('node-fa00a3', 'charlie', 'host', 0, 0, 3),
			device('node-fa00a4', 'delta', 'host', 0, 240, 4),
			{ id: 'node-fa00b1', name: 'j', x: 0, y: -180, order: 5 },
			{ id: 'node-fa00c1', name: 'note', type: 'text', shape: 'square', x: -360, y: -300, span: { cols: 5, rows: 2 }, order: 6,
				content: [
					{ at: [0, 0], cols: 5, rows: 1, content: 'text', value: 'a note on the board', align: 'left', size: 11 },
					{ at: [0, 1], cols: 5, rows: 1, content: 'text', value: 'a button', align: 'center', size: 11, action: 'go', outline: true },
				] },
			device('node-fa00a5', 'echo', 'firewall', -360, 420, 7),
			device('node-fa00a6', 'foxtrot', 'server', 360, 420, 8),
			// H25.2b (B370): an endpoint armed with a spawner, which the page draws green in every mode. Its \`since\` a fixed real stamp:
			// the validator refuses one before 2020-09, and the server skips a document it refuses without a word
			{ id: 'node-fa00b2', name: 's', x: 360, y: -180, order: 9, spawn: { interval: 900, speed: 1, kind: 'packet', since: 1790000000000 } },
			// and a plain endpoint beside it, so the spawning look is held to the spawner alone
			{ id: 'node-fa00b3', name: 'p', x: 360, y: 240, order: 10 },
		],
		links: [link(1, 'node-fa00a1', 'node-fa00a2'), link(2, 'node-fa00a4', 'node-fa00b1'), link(3, 'node-fa00a2', 'node-fa00b1'), link(4, 'node-fa00b1', 'node-fa00a1'),
			link(5, 'node-fa00a1', 'node-fa00a4', null),
			link(6, 'node-fa00a5', 'node-fa00a6'),   // no pipe joins echo and foxtrot, so this link is down
			link(7, 'node-fa00b2', 'node-fa00a2'), link(8, 'node-fa00b3', 'node-fa00a4')],
		pipes: piped.map(([x, y]) => pipeEntity(x, y, 'link')),
		zones: [{ id: 'zone-fa0001', name: 'the zone', x: -450, y: -90, w: 900, h: 420, order: 1 }],
		groups: [{ id: 'group-fa0001', name: 'pair', members: ['node-fa00a3', 'node-fa00a4'] }],
		selection: [],
	};
}
