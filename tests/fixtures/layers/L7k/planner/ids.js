const ID = /^(node|waypoint|link|zone|group|diagram|template)-[0-9a-f]{6}$|^pipe-[0-9a-f]{6}$/;
export const isId = (id) => ID.test(id);
