// FIXTURES — canonical scenes expressed in the SCHEMA (the engine's input), in the cell-centre
// + Waypoint routing model. Groups:
//   reference — the locked `standard` 3×3 block, now schema-driven (engine ↔ renderer parity).
//   routing   — hand-routed turning paths threaded through placed Waypoints (cell-centre bends),
//               plus a NEGATIVE obstacle case retained as "what bad looks like".
//   clover    — the fractal Clover signature reproduced in our grammar: a 4-fold-symmetric
//               bundle of rounded, orthogonal, multi-waypoint paths. The routing acceptance proof.
//
// `expect` (optional): rules expected to FAIL (a negative fixture). Absent ⇒ all rules pass.

// rotate a CELL (or px) point 90° (N→E→S→W): (x,y) → (-y,x)
const rot = ([x, y]) => [-y, x];
const rotPath = (pts, k) => { let p = pts; for (let i = 0; i < k; i++) p = p.map(rot); return p; };

// --- standard 3×3 reference, in the schema (matches the old hand-built standardScene) ---
function standardSchema() {
	const cells = [-1, 0, 1];
	const GLYPH = [['router', 'firewall', 'loadbalancer'], ['server', 'host', 'vxlan'], ['host', 'router', 'firewall']];
	const SEL = new Set(['-1,-1', '0,0', '1,1']);
	const entities = [];
	for (const cj of cells) for (const ci of cells)
		entities.push({ id: `n${ci}_${cj}`, kind: 'node', cell: [ci, cj], glyph: GLYPH[cj + 1][ci + 1], frame: (ci + cj) % 2 === 0 ? 'circle' : 'square', sel: SEL.has(`${ci},${cj}`) });
	entities.push({ id: 'zTop', kind: 'zone', span: { cols: [-1, 1], rows: [-1, -1] } });
	entities.push({ id: 'zBot', kind: 'zone', span: { cols: [-1, 1], rows: [1, 1] } });
	entities.push({ id: 'gTL', kind: 'group', members: ['n-1_-1', 'n0_-1'] });   // top-left pair (intra top zone)
	entities.push({ id: 'gR', kind: 'group', members: ['n1_-1', 'n1_0', 'n1_1'] }); // right column (cross-zone)
	const relations = [
		{ route: { src: 'n-1_-1', dst: 'n-1_0' } },   // down out of the group
		{ route: { src: 'n0_0', dst: 'n1_0' } },       // across the middle row
		{ route: { src: 'n1_0', dst: 'n1_1' } }        // down into the bottom zone
	];
	return { entities, relations };
}

// --- clover: centre node + 4 leaves, each leaf joined to the centre by two bowing paths ---
function cloverSchema() {
	const D = 3, bow = 1, R = 24;                                     // leaf distance / petal bow (cells) · corner radius
	const nLeft = [[0, 0], [-bow, 0], [-bow, -D], [0, -D]];           // N petal, left lobe (cells)
	const nRight = [[0, 0], [bow, 0], [bow, -D], [0, -D]];            // N petal, right lobe (cells)
	const leafCell = [[0, -D], [D, 0], [0, D], [-D, 0]];             // N E S W
	const leafGlyph = ['firewall', 'loadbalancer', 'server', 'host'];
	const entities = [{ id: 'C', kind: 'node', cell: [0, 0], glyph: 'router', frame: 'circle' }];
	const relations = [];
	for (let k = 0; k < 4; k++) {
		entities.push({ id: `L${k}`, kind: 'node', cell: leafCell[k], glyph: leafGlyph[k], frame: k % 2 ? 'square' : 'circle' });
		relations.push({ route: { src: 'C', dst: `L${k}`, via: rotPath(nLeft, k).slice(1, -1), radius: R } });
		relations.push({ route: { src: 'C', dst: `L${k}`, via: rotPath(nRight, k).slice(1, -1), radius: R } });
	}
	return { entities, relations };
}

export const FIXTURES = [
	// ── reference ────────────────────────────────────────────────────────────────────────
	{
		name: 'standard-3x3', group: 'reference',
		note: 'the locked standard geometry — frames · selection brackets · two groups · two zones · straight links — schema-driven through resolve()',
		schema: standardSchema()
	},
	// ── routing (hand-routed turning paths bent through placed Waypoints) ────────────────────
	{
		name: 'route-L', group: 'routing',
		note: 'single L-bend through ONE waypoint at the corner cell — the r=20 turn inscribed in the 40px circle',
		schema: {
			entities: [
				{ id: 'a', kind: 'node', cell: [0, 0], glyph: 'router' },
				{ id: 'w', kind: 'waypoint', cell: [0, 2] },
				{ id: 'b', kind: 'node', cell: [2, 2], glyph: 'host', frame: 'square' }
			],
			relations: [{ route: { src: 'a', via: ['w'], dst: 'b' } }]
		}
	},
	{
		name: 'route-Z', group: 'routing',
		note: 'Z / offset jog through TWO waypoints — both bends on cell centres (no sub-grid corners)',
		schema: {
			entities: [
				{ id: 'a', kind: 'node', cell: [0, 0], glyph: 'router' },
				{ id: 'w1', kind: 'waypoint', cell: [0, 1] },
				{ id: 'w2', kind: 'waypoint', cell: [2, 1] },
				{ id: 'b', kind: 'node', cell: [2, 3], glyph: 'server', frame: 'square' }
			],
			relations: [{ route: { src: 'a', via: ['w1', 'w2'], dst: 'b' } }]
		}
	},
	{
		name: 'route-passthrough', group: 'routing',
		note: 'a straight path crosses a ZONE (permeable space) — obstacle stays clean (zones are not solid)',
		schema: {
			entities: [
				{ id: 'a', kind: 'node', cell: [0, 0], glyph: 'router' }, { id: 'b', kind: 'node', cell: [0, 4], glyph: 'host' },
				{ id: 'z', kind: 'zone', span: { cols: [-1, 1], rows: [2, 2] } }
			],
			relations: [{ route: { src: 'a', dst: 'b' } }]
		}
	},
	{
		name: 'route-through-node', group: 'routing',
		note: 'NEGATIVE: a straight path cuts through an unattached NODE → obstacle FAILS (retained as "what bad looks like")',
		expect: ['obstacle'],
		schema: {
			entities: [
				{ id: 'a', kind: 'node', cell: [0, 0], glyph: 'router' }, { id: 'mid', kind: 'node', cell: [0, 2], glyph: 'firewall', frame: 'square' }, { id: 'b', kind: 'node', cell: [0, 4], glyph: 'host' }
			],
			relations: [{ route: { src: 'a', dst: 'b' } }]
		}
	},
	// ── clover (the routing acceptance signature) ───────────────────────────────────────────
	{
		name: 'clover', group: 'clover',
		note: 'fractal Clover signature: 4 petals, 8 rounded orthogonal multi-waypoint paths, 4-fold symmetric. Known artifact: adjacent petals share coincident lobe-stubs at the hub → expected `overlap` (visually occluded by the centre node; fix later with a hub junction).',
		expect: ['overlap'],
		schema: cloverSchema()
	}
];
