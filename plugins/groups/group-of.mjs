/*
THE GROUP AN ENTITY BELONGS TO -- the groups plugin's (O-c, H19.20): what `Model#groupOf` answered, for the renderer's hull,
the canvas's group key and REST's context. The core finds the entity that gathers an id, for any kind that gathers
(`Model#gathererOf`, model/shape.mjs `gathers`); this is that question asked of the group.
*/

// the group whose members include `id`, else undefined
export function groupOf(model, id) {
	const gatherer = model.gathererOf(id);
	return gatherer && gatherer.id.startsWith('group-') ? gatherer : undefined;
}
