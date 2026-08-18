// SPEC — the LOCKED `standard` variant + the derived px ladder. The single source of px truth
// for the kernel. Frozen on purpose: the geometry is locked (docs/spec/HIERARCHY.md §2 / preview.html
// standardSpecTable). Do not edit without a deliberate re-lock.
//
// Budget: pitch = node + 6·step + gutter = 40 + 6·3 + 2 = 60
//   (the +step ladder rises through frame→selection→group→zone on BOTH sides → 6 rungs)

export const STD = Object.freeze({
	name: 'standard',
	pitch: 60,    // grid pitch — cell centres land on multiples of this
	node: 20,     // node frame half-extent (40px frame)
	step: 3,      // ladder step: frame→selection→group→zone, +step per side per rung
	gutter: 2,    // zone breathing gap kept inside the cell budget
	socket: 26,   // glyph box — every glyph normalises into it
	frameR: 5,    // node-frame corner radius (square frames)
	selArm: 10,   // selection-bracket arm length
	linkW: 6      // link / path stroke width
});

// the LOCKED bend radius (docs/spec/ATOMICS.md): a path corner radius = the node radius (20), so a 40px
// circle inscribes the bend exactly — which is precisely what a Waypoint is.
export const BEND_R = STD.node;   // 20

// defining params → per-layer geometry (the uniform +step ladder: frame→sel→group→zone)
export function derive(V) {
	return {
		cell: { ext: V.pitch / 2 },
		frame: { ext: V.node, r: V.frameR },
		socket: { ext: V.socket / 2 },
		selection: { ext: V.node + V.step, r: V.frameR + V.step, arm: V.selArm },
		group: { ext: V.node + 2 * V.step, r: V.frameR + 2 * V.step },
		zone: { ext: V.node + 3 * V.step, r: V.frameR + 3 * V.step, gutter: V.gutter }
	};
}

export const L_STD = derive(STD);
