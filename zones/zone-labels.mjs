/*
WHERE A ZONE'S LABEL IS EDITED -- the zones plugin's. C-e, step eleven (H19.33; dev/design/unification/CANVAS-PLUGINS.md
section 3). F2 renames a zone; a double-click inside a zone, where nothing of higher rank answered, edits its name -- the topmost
zone under the pointer (rank 2, after a text box and a device). Its editor opens at the canvas's default, beside the corner. They
were app/src/input.js `editUnderPointer` and `onRenameKey`'s filter.
*/

const inside = (z, p) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;

export const ZONE_LABELS = {
	named: ['zone'],
	edits: [{ rank: 2, find: (model, pos) => {
		const zone = model.all('zone').filter((z) => inside(z, pos)).at(-1);   // topmost
		return zone ? { kind: 'zone', id: zone.id, edits: 'name' } : null;
	} }],
};
