/*
situation.mjs — WHAT IS TRUE RIGHT NOW, as a value.

The read-surface. Anything deciding what an input MEANS reads a situation and nothing else: not the
model, not the DOM, not a renderer's private field. One concern, and the whole of it is "describe
the present"; it holds no opinion about what anyone should do with the description.

WHY THIS IS THE WORK RATHER THAN SCAFFOLDING. The rules surface is undecided and deliberately so --
its shape is owed a prior-art pass (B163, flag F3). The SITUATION is
not owed anything: whatever shape dispatch eventually takes, a mod, an agent, a menu and a keystroke
all have to ask the same first question, and they must all get the same answer. Building it now is
the director's rule that an abstraction is premature only when it generalises over instances nobody
has seen -- this one IS the deliverable.

IT IS PLAIN DATA, AND THAT IS A CONSTRAINT NOT A STYLE. The survey settled that behaviour must run
in a browser AND on a server, so a situation has to survive `JSON.stringify` and arrive intact
somewhere else. That rules out the obvious ergonomic shape -- an object carrying `s.one('link')`
style methods over a live model -- because methods do not serialise and a live model reference is
exactly the reach across a boundary this exists to prevent. Predicates therefore live BESIDE the
value as free functions, and the value stays inert.

WHAT IT DELIBERATELY OMITS. No pixels, no event object, no element handles, no callbacks. A
consumer that needs those is looking at presentation, which is a different concern and a different
unit. Fields are added when something needs them, one at a time, because a situation that describes
everything is a second model rather than a description.
*/

import { kindOf } from '../model/model.mjs';
import { waypointRole } from '../kernel/index.mjs';

/*
Build the situation.

`access` is the small set of questions this needs answered about the document, supplied by whoever
owns it. Passing an accessor rather than a Model is what keeps this runnable on either peer: the
browser hands it a live model's methods, the server hands it a stored document's, and neither has to
become the other. It is the same shape `model/referential.mjs` already uses for the same reason.

	access.get(kind, id)   -> entity or null
	access.linksTouching(id) -> the links that name this id as src, dst or via

`ctx` is the transient part -- the things that are true of this moment rather than of the document:
which mode the surface is in, whether it is refusing writes, what the gesture is on, what is
selected.
*/
export function situationOf(access, ctx = {}, t = null) {
	const { mode = 'view', readOnly = false, targetId = null, selection = [] } = ctx;
	return {
		at: t,                                  // the agreed instant, or null when time is irrelevant
		mode,                                   // 'view' | 'edit' | 'run'
		readOnly: !!readOnly,
		target: describeTarget(access, targetId),
		selection: describeSelection(selection),
	};
}

// What the gesture is ON. Null when it is on nothing, which is a real answer and not an absence.
function describeTarget(access, id) {
	if (!id) return null;
	const kind = kindOf(id);
	const entity = access.get ? access.get(kind, id) : null;
	if (!entity) return null;
	const t = { kind, id };
	if (kind === 'waypoint') {
		/*
		The role is DERIVED here exactly as it is derived everywhere else -- B162's rule, read from
		the links that touch this waypoint rather than from a stored field. A situation that carried
		its own idea of the role would be a third copy, and the first to go stale.

		B166: model links are handed straight to the kernel now. There was briefly an adapter here
		translating `src`/`dst`/`closed` into `from`/`to`/`close`; unifying the vocabulary deleted
		both the adapter and the class of silent bug it existed to contain.
		*/
		const touching = access.linksTouching ? access.linksTouching(id) : [];
		t.role = waypointRole(id, touching);
		// whether this endpoint is already emitting. A boolean rather than the config, because the
		// question a decision asks is "is it on"; the numbers belong to whoever is going to run them.
		t.spawning = !!entity.spawn;
	}
	return t;
}

// The selection, described rather than handed over. Kinds are deduplicated and sorted so two equal
// selections produce equal situations -- a value that compares unstably is not a value.
function describeSelection(ids) {
	const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
	return { size: list.length, ids: [...list], kinds: [...new Set(list.map(kindOf))].sort() };
}

/*
PREDICATES — the shared vocabulary, as free functions over an inert value.

They exist so a decision asks a NAMED question rather than reaching into the shape. That matters
more than it looks: `s.target && s.target.kind === 'waypoint' && s.target.role === 'endpoint'`
written at three call sites is three chances to get it subtly different, and the third one is a
defect nobody can see. It is the same argument that put `waypointRole` in the kernel.
*/

// exactly one thing is selected, and it is of this kind
export const oneSelected = (s, kind) => s.selection.size === 1 && s.selection.kinds[0] === kind;

// the gesture is on a waypoint that TERMINATES a path, rather than bending one. A closed ring has
// no ends, so nothing on it is ever an endpoint -- that falls out of waypointRole, not from here.
export const onEndpoint = (s) => !!s.target && s.target.kind === 'waypoint' && s.target.role === 'endpoint';

// the surface is being read rather than authored
export const inReadView = (s) => s.mode === 'run';

// the target is an endpoint that is already emitting
export const onSpawner = (s) => onEndpoint(s) && !!s.target.spawning;

/*
The gesture is on open ground -- no entity under it.

An absence, stated as a named question rather than as `!s.target` written at each call site. It is
the condition tower placement turns on, and it is the first predicate here that is TRUE of nothing:
`describeTarget` already answers null deliberately, calling that a real answer and not a gap, so
this only gives that answer a name.
*/
export const onOpenGround = (s) => !s.target;
