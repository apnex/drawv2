/*
NETWORK ROLES -- what a waypoint or a link IS, derived from the links touching it. Pure: it imports nothing, reads only
what it is handed, and draws nothing.

K13a (dev/design/h17/PLAN.md): split from kernel/geometry.mjs, whose core grid exported these network names (L5, L5p).
Network layer, read by both renderers, the situation (engine/situation.mjs) and the export: one rule for what a waypoint
is, so the canvas and the export cannot disagree.
*/
/*
The bend/endpoint rule, in ONE place, because two renderers need the same answer.

The live editor builds addressable DOM for a person editing; the kernel builds a finished SVG for
everyone else. B28 ruled that split deliberate and it stands -- but the RULE for what a waypoint is
must not be duplicated across it, or the export and the canvas disagree and only one of them gets
looked at. That happened: the role landed in `resolve()`, which the client never calls.

Takes the LINKS TOUCHING this waypoint, which both callers already hold -- the kernel from
`schema.relations`, the client from the engine's maintained `linksAt` index. Each supplies its own
shape; neither restates the rule.

  in a route's via        -> bend, the path turns here
  at from/to, open route  -> endpoint, a line terminates here
  at from/to, CLOSED      -> bend, because a ring has no ends
  touched by nothing      -> bend, drawn plainly; the sweep will take it
*/
/*
B208 -- the sub-types a waypoint currently holds, as a SET.

A waypoint is an anchor and sub-types are additive layers on it, so a single exclusive role could
not express the model: a waypoint where three links terminate is a junction AND an endpoint, and
one where two links bend through is a junction and nothing else.

THE EMPTY SET IS A BEND. A bend adds no layer -- the path turning is its whole rendering -- so it
is the ABSENCE of a sub-type rather than a member. Including it would make `['bend','endpoint']`
constructible, which is a contradiction nothing prevents, and would force every render loop to
special-case a member meaning "draw nothing".

B211 -- A JUNCTION IS WHERE LINKS TERMINATE, and only that.

A junction is a MEET: paths converge and are CONNECTED. A link merely threaded through a waypoint
is passing, not meeting, so it contributes nothing to the count -- two links bending at one point
is two bends, which is exactly what it looks like, and stays a bend.

More than one TERMINATION is therefore the test. Two links ending at a waypoint is the smallest
meet; one is a plain terminus. Threading is invisible to it.

This replaced a direction count -- a via worth two, a terminus worth one, more than two a junction
-- which called two threaded links a junction because it counted lines converging rather than paths
ending. The director ruled that threading must not make one, and landing on a bend must: those are
different gestures and the count could not tell them apart.

A closed ring still has no ends, so nothing on one ever terminates.
*/

/*
H15.15 -- WHICH PLANE a link belongs to. `control: true` is the control plane; absent or false is
the ordinary data plane, so every document written before the field reads unchanged.

A predicate rather than a raw field read, because two rules consult it -- the role derivation here
and the collapse in model/link-rules.mjs -- and B232 shipped because one place implemented the
matrix and another disagreed about it.
*/
const samePlane = (a, b) => !!a.control === !!b.control;

/*
Which way a link faces at a point: `in`, `out`, or null for an undeclared link or a point it merely
threads. The twin of `facing` in model/link-rules.mjs, which cannot be imported here -- `kernel/`
depends on no `model/` and the reverse, an independence worth more than one boolean.

Exported so the agreement between the twins is driven against THIS function rather than a copy
re-typed in a test, which would pass while the real one drifted.
*/
export const linkFacing = (link, pointId) => {
	if (link.direction !== 'forward' && link.direction !== 'reverse') return null;
	const head = link.direction === 'forward' ? link.dst : link.src;
	const tail = link.direction === 'forward' ? link.src : link.dst;
	if (pointId === head) return 'in';
	if (pointId === tail) return 'out';
	return null;
};

/*
B244 (K14a) -- WHETHER A LINK ENDS AT A POINT: at its `src` or `dst`, unless it is closed, because a ring has no ends. The
statement the role derivation reads. Its twin is `endsAt` in the planner's orphan sweep (model/link-reactions.mjs), which
`kernel/` and `model/` may not share by import (C9); the sweep's copy lacked the ring clause, and so kept a deleted ring's
`src` and `dst` as termini. tests/sweep-references.test.js holds the two to one answer.
*/
const linkEndsAt = (link, pointId) => !link.closed && (link.src === pointId || link.dst === pointId);

/*
B277 -- TRANSIT OFF ADMITS ENDPOINTS ONLY. An anchor whose transit is off stops what arrives (TRANSIT.md section 4, TR-5),
so nothing meets there and nothing turns there: every link that ends there ends, at any count, and the anchor is an
endpoint -- never a junction, never a bend (the director, 2026-10-02). One endpoint ring at every count, ruled the same
day; the transit ring beside it says why. `transit` is whether what arrives passes, handed in by whoever holds it -- the
network, through the Model's `stopsAt` (B278) -- and absent means on, which is every anchor production has.
*/
export const waypointRoles = (id, touching, { transit = true } = {}) => {
	const roles = [];
	let terminations = 0;

	for (const t of touching || []) {
		if (!linkEndsAt(t, id)) continue;             // threaded through, or a ring, which has no ends
		if (t.src === id) terminations += 1;
		if (t.dst === id) terminations += 1;
	}
	const endpoint = terminations > 0;
	if (transit === false) return endpoint ? ['endpoint'] : [];

	/*
	B211 -- A JUNCTION SUPERSEDES AN ENDPOINT, ruled by the director.

	A junction is where links MEET, and every link at one terminates there, so `endpoint` would be
	true of every junction and say nothing. Worse, it would DRAW: the pad and the ring both, two
	sub-type layers on one waypoint where the outer one is redundant. The junction ring is the
	statement; the pad is what a lone terminus looks like.

	They remain separate roles rather than one, because the predicates ask different questions --
	`onEndpoint` gates spawner arming, and a junction can still be armed.
	*/
	// THREE is the smallest meet regardless of what anything declares
	if (terminations > 2) return ['junction'];

	/*
	H15.4 -- TWO CAN BE A JUNCTION TOO, once a direction can be declared.

	B214 ruled that two terminations is never a meet, and that was right while no link could say
	which way it flowed: the three 2-link shapes differed only in stored order, which means nothing
	(B222). A DECLARATION changes it. Two flows arriving is a convergence, two leaving is a
	divergence, and neither is a path passing through -- each is a place where flow does something
	other than continue, which is what a junction is.

	`direction` is read the same way `facing` in model/link-rules.mjs reads it, and the two are held to
	agree by test rather than by a shared import: `kernel/` imports no `model/` and `model/` imports
	no `kernel/`, which is a deliberate independence neither should lose for one boolean.

	An UNDECLARED link has no direction and so cannot oppose anything -- which keeps every document
	written before this field reading exactly as it did.
	*/
	if (terminations === 2) {
		const two = (touching || []).filter((t) => linkEndsAt(t, id));

		/*
		THE TWO-LINK MATRIX. A bend means flow passes through UNCHANGED, so a waypoint where
		anything differs is a place where something happens -- which is what a junction is.

		B232 -- the direction half decided only ONE of its two cases. It returned `['junction']`
		when the directions opposed and fell through otherwise, so a genuine pass-through landed on
		the `endpoint` line below and read as a terminus. A bend is the absence of a sub-type
		(B199), so the answer is the empty set rather than another role.

		B233 -- the PLANE and the DIRECTION are independent, and the first version nested one inside
		the other. The plane check ran only when both links declared a flow, so a control link
		meeting a data link with no direction at all fell through to `endpoint`. Planes differing is
		enough on its own; it does not need anyone to have said which way things move.

		Both defects are the same mistake: a case the code never decided, in a matrix that was
		ruled whole. The rule generalises -- when more link types arrive the question stays "does
		anything differ?" rather than needing a branch for each.
		*/
		if (two.length === 2 && !samePlane(two[0], two[1])) return ['junction'];

		const dirs = two.map((t) => linkFacing(t, id)).filter(Boolean);
		if (dirs.length === 2) return dirs[0] !== dirs[1] ? [] : ['junction'];
	}
	if (endpoint) roles.push('endpoint');
	return roles;
};

/*
A WAYPOINT'S ROLES IN A MODEL -- the question every reader holding a Model asks, asked in one place: the canvas renderer
(what to draw) and Input's situation (what the pointer is on). Both had written `waypointRoles(id, model.linksAt(id))`
for themselves, and B277 was both of them omitting the anchor's transit. It asks `stopsAt` -- whether what arrives stops
there -- and not the declaration, which only draws the ring (B278): a type offering only off stops what arrives and declares
nothing. The Model is read by shape -- `kernel/` imports no `model/` -- so a model with no network, where nothing stops,
gets the transiting roles it always had.
*/
export const waypointRolesIn = (model, id) =>
	waypointRoles(id, model.linksAt?.(id) || [], { transit: !model.stopsAt?.(id) });

/*
The single role, for callers that still ask for one. Derived from the set so there is one
derivation rather than two: `endpoint` if it terminates, otherwise `bend`.

Kept because the renderers and `situation` read a class name and a predicate, and migrating those
is step 4. It will go when they do.
*/
export const waypointRole = (id, touching) => (waypointRoles(id, touching).includes('endpoint') ? 'endpoint' : 'bend');
