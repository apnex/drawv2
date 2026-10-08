/*
A SPAWNER'S FIELD, COMPOSED ONTO AN ANCHOR -- the simulation's (O-e2, H19.21; dev/design/unification/KINDS-AS-PLUGINS.md section
16; O4). A waypoint may emit movers along its link: `spawn`, whole or absent, added to the anchor's kind as the network adds
`transit` (S-a). A device carries none -- the rule asks the devices plugin whether one is composed. Moved from
planner/kinds.mjs unchanged, check and message alike.
*/

import { SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, SPAWN_SPEED_MAX } from '../model/limits.mjs';
import { hasDevice } from '../devices/device-fields.mjs';   // whether a device is composed: the devices plugin's

// the check is LOCAL, as every row's is (model/shape.mjs, B110)
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
/*
H12.5 -- a spawner's configuration, whole or absent.

`SINCE_FLOOR` rejects a stamp from before this system could have produced one, and the ceiling
rejects one implausibly far ahead. Both exist because `since` feeds arithmetic: `engine/movers.mjs`
derives the live window from it, and a wild value asks for a walk nobody wanted. A clock a little
fast is normal and tolerated; a clock wrong by years is a corrupt field.
*/
const SINCE_FLOOR = 1_600_000_000_000;                       // 2020-09, comfortably before this tree existed
const SINCE_CEIL = () => Date.now() + 86_400_000;            // a day ahead absorbs any sane clock skew
/*
B172 -- `kind` names a look, it does not carry one.

`colour` used to be a hex per spawner, which meant the appearance of every packet in the estate was
copied into each document that had one: three changes of mind proved that changing it meant
rewriting data. A kind resolves to a CSS class instead, so the stylesheet owns the look and one edit
reaches everything -- including spawners already armed, which a stored hex can never do.

It is the same shape the tree already uses for a node: `type` is stored, the glyph is resolved.
Per-kind appearance stays expressible, which is what creep types will need.
*/
const SPAWN_KINDS = ['packet'];
const SPAWN = {
	interval: (v) => num(v, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX),
	speed: (v) => num(v, 0.1, SPAWN_SPEED_MAX),          // CELLS per second
	kind: (v) => SPAWN_KINDS.includes(v),
	since: (v) => num(v, SINCE_FLOOR, SINCE_CEIL()),
};
const spawn = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
	&& Object.keys(SPAWN).every((k) => Object.hasOwn(v, k))            // whole, never partial
	&& Object.keys(v).every((k) => Object.hasOwn(SPAWN, k) && SPAWN[k](v[k]));

export const SPAWN_FIELDS = {
	kind: 'node',
	owner: 'the simulation',
	extends: true,
	fields: {
		/*
		H12.5 -- this endpoint EMITS movers along its link.

		Whole-object, with every key required: a spawner is either configured or absent, and there
		is no such thing as half of one. Accepting a partial would push a default into whoever read
		it next, and two readers would eventually choose differently.

		`since` is the shared phase -- an epoch instant, so every peer computes the SAME departure
		times from it rather than each starting its own animation when it happened to load. It is
		bounded rather than free: a stamp far outside living memory is a corrupt value, not a
		diagram somebody armed, and admitting it would let one bad field ask the simulation to walk
		an absurd window.

		Direction is deliberately NOT a field here -- see `model/shape.mjs`. It is read off which
		end of the link this waypoint occupies.
		*/
		spawn: (v) => spawn(v)
	},
	optional: ['spawn'],
	// a spawner is a waypoint's: a device carries none (F-c; the node row's rule, the spawner's half)
	refers: (entity) => (hasDevice(entity) && 'spawn' in entity ? `a typed node has no spawn: ${entity.id}` : null),
};
