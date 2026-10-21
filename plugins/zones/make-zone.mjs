/*
THE ZONE FACTORY -- the zones plugin's (O-b1, H19.19): what `Model#makeZone` made, for the canvas's zone gesture and command
and the server's REST create. The id, name and drawing order come from the Model's kind-blind machinery -- `freshId`,
`nextName`, `nextOrder` -- which the core keeps (O1).
*/

// a new zone over a box: a fresh id, the next free name and the next drawing order -- what `Model#makeZone` made
export function makeZone(model, box) {
	return {
		id: model.freshId('zone'),
		name: model.nextName('zone'),
		order: model.nextOrder('zone'),
		x: box.x,
		y: box.y,
		w: box.w,
		h: box.h
	};
}
