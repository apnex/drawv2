const ID = /^(node|waypoint|link|zone|group|pipe|diagram|template)-[0-9a-f]{6}$/;
export function validate(id, doc) {
	for (const k of ['nodes', 'waypoints', 'links', 'zones', 'groups']) if (!doc[k]) return false;
	return ID.test(id);
}
