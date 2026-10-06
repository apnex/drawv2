/*
Seed — the example topology created on first boot (SCOPE: "seeded example
diagram"). Entity ids are generated fresh each time so two seeded diagrams
are stable across reseeds.
*/

import { newId } from '../model/model.mjs';
import { SCHEMA } from '../model/shape.mjs';
import { pipeEntity } from '../network/pipe-kind.mjs';   // a link's leg is a pipe (P3), and the seed is stored complete

export function seedDoc() {
	const taken = {};
	const make = (kind) => {
		const id = newId(kind, taken);
		taken[id] = true;
		return id;
	};

	// center-origin: lb-1 sits at the true canvas center [0,0]
	const nodes = [
		{ id: make('node'), name: 'client', type: 'host', x: -720, y: 0 },
		{ id: make('node'), name: 'edge-router', type: 'router', x: -480, y: 0 },
		{ id: make('node'), name: 'firewall-1', type: 'firewall', x: -240, y: 0 },
		{ id: make('node'), name: 'lb-1', type: 'loadbalancer', x: 0, y: 0 },
		{ id: make('node'), name: 'web-1', type: 'server', x: 300, y: -180 },
		{ id: make('node'), name: 'web-2', type: 'server', x: 300, y: 0 },
		{ id: make('node'), name: 'web-3', type: 'server', x: 300, y: 180 },
		{ id: make('node'), name: 'overlay', type: 'vxlan', x: 600, y: 0 }
	];
	const n = (i) => nodes[i].id;
	const links = [
		[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7]
	// B187 -- every entity is named, and a link minted from a pair is named from its index
	].map(([src, dst], i) => ({ id: make('link'), name: `link-${i + 1}`, src: n(src), dst: n(dst) }));

	/*
	B291 (H19.3) -- WRITTEN COMPLETE, in the current format: each item its drawing order, rising in the order listed (F-d),
	and each link's leg its pipe, laid with the link (P3), so every seeded link comes up. The migration once filled both in
	on the way into the store; it is deleted, and nothing completes a document now.
	*/
	const ordered = (list) => list.map((e, i) => ({ ...e, order: i + 1 }));
	return {
		meta: {
			id: make('diagram'),
			name: 'example',
			version: 0,
			schema: SCHEMA
		},
		nodes: ordered(nodes),
		links: ordered(links),
		pipes: links.map((l) => pipeEntity(l.src, l.dst, 'link')),
		zones: ordered([
			{ id: make('zone'), name: 'edge', x: -570, y: -90, w: 420, h: 180 },
			{ id: make('zone'), name: 'web-tier', x: 210, y: -270, w: 180, h: 540 }
		]),
		groups: [
			{ id: make('group'), name: 'web-servers', members: [n(4), n(5), n(6)] }
		]
	};
}
