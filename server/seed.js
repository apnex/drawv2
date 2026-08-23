/*
Seed — the example topology created on first boot (SCOPE: "seeded example
diagram"). Entity ids are generated fresh each time so two seeded diagrams
are stable across reseeds.
*/

import { newId } from '../model/index.mjs';

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
	].map(([src, dst]) => ({ id: make('link'), src: n(src), dst: n(dst) }));

	return {
		meta: {
			id: make('diagram'),
			name: 'example',
			version: 0,
			schema: 1
		},
		nodes,
		links,
		zones: [
			{ id: make('zone'), name: 'edge', x: -570, y: -90, w: 420, h: 180 },
			{ id: make('zone'), name: 'web-tier', x: 210, y: -270, w: 180, h: 540 }
		],
		groups: [
			{ id: make('group'), name: 'web-servers', members: [n(4), n(5), n(6)] }
		]
	};
}
