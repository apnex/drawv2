/*
THE SIMULATION'S APPEARANCE ON AN ANCHOR -- C-a, step three (H19.29; D3). A waypoint armed with a spawner is marked
`spawning`, which recolours its marks rather than replacing them -- the 2026-09-22 ruling's own example of an appearance that
composes. It was the renderer's (`waypointClass`, B313).
*/

const SPAWNING = {
	id: 'spawning',
	kind: 'node',
	state: (entity) => (entity.spawn ? 'armed' : null),
	composes: true,
	addClass: 'spawning',
};

// the simulation's canvas part
export const SIMULATION_CANVAS = { owner: 'the simulation', appearances: [SPAWNING] };
