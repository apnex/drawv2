const ID = /^(node|waypoint|link|zone|group|diagram|template)-[0-9a-f]{6}$/i;
export const isIdI = (id) => ID.test(id);
