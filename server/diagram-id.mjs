/*
mintDiagramId -- the one minter of diagram ids (B351, H23).

A diagram id is 16 hex digits from `crypto.randomBytes(8)`, drawn again while `taken` holds it. A published
diagram's `/<id>.svg` answers anyone who has the link, so the id is a capability and comes from the platform's
cryptographic source rather than `Math.random`.

Its own module because two server modules mint one -- `server/store.js` `create` and `server/seed.js` `seedDoc` --
and the store imports the seed, so neither can host it for the other. `model/model.mjs` `newId` refuses the
`diagram` kind, so no second, weaker minter can appear beside this one.
*/

import crypto from 'node:crypto';

// `taken` is the ids already in use, as an object keyed by id
export function mintDiagramId(taken = {}) {
	let id;
	do id = crypto.randomBytes(8).toString('hex');
	while (taken[id]);
	return id;
}
