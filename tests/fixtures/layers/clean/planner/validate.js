const ID = /^(node|waypoint|link|zone|group|diagram|template)-[0-9a-f]{6}$/;
export function validate(id) { return ID.test(id); }
