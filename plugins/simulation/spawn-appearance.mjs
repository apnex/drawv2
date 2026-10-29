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

/*
H26.8 (dev/design/components/NATIVE-SHAPES.md section 3.2, NS5, NS13) -- THE SIMULATION'S MARKS, declared by the part that owns them.
The reveal and the towers wrote onto the renderer's elements (T6); now each tells the renderer the value it holds for an entity --
`renderer.mark(id, name, value | null)`, every pass or frame -- and the renderer applies the mark's declaration to its description each
time it puts the entity, so a mark is kept through a mode or a structural change and dropped with its entity and on a load, set again
by its owner's next pass. Each answers the entity's parts with the mark written, the parts it is handed left as they were:
  unrevealed   `data-unrevealed=""` on the state target -- a beat has not reached it (plugins/simulation/reveal-painter.mjs)
  trace        `{ run, len, ms }`: `data-trace`, then `style` exactly `--trace-len: <len>; --trace-ms: <ms>ms`, on the state target, a
               link's line -- the declared trace (section 5, a:F7), which plugins/simulation/simulation.css runs
  aim          degrees: `data-aim`, then `transform` `rotate(<deg>)`, on the shape holding `data-layer="glyph"` beneath the state
               target -- a tower facing what it tracks (plugins/simulation/mover-painter.mjs)
No painter or appearance reads a mark, and the export holds none.
*/
const traceStyle = ({ len, ms }) => `--trace-len: ${len}; --trace-ms: ${ms}ms`;
// the entity's own part with the shape `test` picks written by `write`, at any depth -- the parts handed in unchanged: the shapes on the
// way down are new, the one written has its own attributes, and every other is shared
function writing(parts, test, write) {
	return parts.map(([part, shape]) => {
		if (part !== '') return [part, shape];
		let done = false;
		const walk = (s) => {
			if (done) return s;
			if (test(s)) { done = true; const c = { ...s, attrs: { ...s.attrs } }; write(c.attrs); return c; }
			return s.children ? { ...s, children: s.children.map(walk) } : s;
		};
		return [part, walk(shape)];
	});
}
// the state target: the shape bearing the entity's id within its own item (section 3.2)
const bearsId = (s) => typeof s.attrs?.id === 'string';
// the glyph beneath it
const isGlyph = (s) => s.attrs?.['data-layer'] === 'glyph';
const SIMULATION_MARKS = {
	unrevealed: (parts) => writing(parts, bearsId, (a) => { a['data-unrevealed'] = ''; }),
	trace: (parts, trace) => writing(parts, bearsId, (a) => { a['data-trace'] = trace.run; a.style = traceStyle(trace); }),
	aim: (parts, deg) => writing(parts, isGlyph, (a) => { a['data-aim'] = String(deg); a.transform = `rotate(${deg})`; }),
};

// the simulation's canvas part
const SPAWN_KEY = 'spawn';
export const isSpawning = (entity) => !!(entity && entity[SPAWN_KEY]);

export const SIMULATION_CANVAS = { owner: 'the simulation', stylesheets: ['plugins/simulation/simulation.css'], appearances: [SPAWNING], marks: SIMULATION_MARKS, isSpawning };
