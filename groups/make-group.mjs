/*
THE GROUP FACTORY -- the groups plugin's (O-c, H19.20): what `Model#makeGroup` made, for the canvas's group command and clone
and the server's REST create. The id and name come from the Model's kind-blind machinery, `freshId` and `nextName`, which the
core keeps (O1).
*/

// a new group of these members: a fresh id and the next free name
export function makeGroup(model, members) {
	return {
		id: model.freshId('group'),
		name: model.nextName('group'),
		members: [...members]
	};
}
