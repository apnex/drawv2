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
import { isBareEntity } from '../model/anchors.mjs';
import { drawnKind } from '../model/anchor-words.mjs';   // the drawn word (F4)   // the bare anchor, asked in one place (F-b)

/*
K5 (dev/design/h17/PLAN.md) -- CORE, so every layer that decides what an input means may read it: the canvas (Input),
the server, a menu. It sat in the simulation layer, where the canvas may not reach, while describing nothing about
simulation; its one import outside core was the role derivation, which the caller now applies and hands in
(`access.rolesOf`), so one derivation still decides what a waypoint is.
*/

/*
Build the situation.

`access` is the small set of questions this needs answered about the document, supplied by whoever
owns it. Passing an accessor rather than a Model is what keeps this runnable on either peer: the
browser hands it a live model's methods, the server hands it a stored document's, and neither has to
become the other. It is the same shape `model/referential.mjs` already uses for the same reason.

	access.get(kind, id)   -> entity or null
	access.rolesOf(id)     -> a waypoint's roles: `waypointRoles` (kernel/network-roles.mjs) over the links touching it

`ctx` is the transient part -- the things that are true of this moment rather than of the document:
which mode the surface is in, whether it is refusing writes, what the gesture is on, what is
selected.

THE GESTURE AND ITS STEP -- added for the input rules (dev/RULES.md section 11, ruled 2026-09-30 Q1: a rule sees the
selection, plus what the current step of a gesture is on). `gesture` names the one in progress ('link', 'move', ...)
or null; `step` is what the pointer is over during it -- 'node', 'waypoint' or 'ground' -- or null when no gesture is.
Both are words, never elements or positions, so the value still crosses a boundary intact.
*/
export function situationOf(access, ctx = {}, t = null) {
	const { mode = 'view', readOnly = false, targetId = null, selection = [], gesture = null, step = null, tool = false } = ctx;
	return {
		at: t,                                  // the agreed instant, or null when time is irrelevant
		mode,                                   // 'view' | 'edit' | 'run'
		readOnly: !!readOnly,
		target: describeTarget(access, targetId),
		selection: describeSelection(access, selection),
		gesture: gesture ?? null,
		step: gesture ? step ?? null : null,
		tool: !!tool,   // a tool is held -- the text tool, today -- and takes every left press (app/src/recognize.js)
	};
}

// What the gesture is ON. Null when it is on nothing, which is a real answer and not an absence.
function describeTarget(access, id) {
	if (!id) return null;
	const stored = kindOf(id);
	const entity = access.get ? access.get(stored, id) : null;
	if (!entity) return null;
	// a bare anchor is a `waypoint` to every rule that reads a situation -- the word F4 keeps, whatever kind stores it
	const kind = isBareEntity(stored, entity) ? 'waypoint' : stored;
	const t = { kind, id };
	if (kind === 'waypoint') {
		/*
		The role is DERIVED exactly as it is derived everywhere else -- B162's rule, `waypointRoles`, read
		from the links that touch this waypoint rather than from a stored field -- and handed in by the
		caller (K5). A situation that carried its own idea of the role would be a third copy.

		B166: model links are handed straight to the kernel now. There was briefly an adapter here
		translating `src`/`dst`/`closed` into `from`/`to`/`close`; unifying the vocabulary deleted
		both the adapter and the class of silent bug it existed to contain.
		*/
		/*
		B208 -- the SET, and ONLY the set.

		A single `role` was populated beside it for one commit, and that made the migration hazard
		undetectable: `role === 'endpoint'` went on working, so reverting `onEndpoint` to string
		equality passed every test. A legacy field kept "just in case" is a second answer to the same
		question, and the first thing to go stale.

		The renderers still read a single `el.role`, but they derive it themselves from
		`waypointRole`; nothing downstream of here needs one.
		*/
		t.roles = access.rolesOf ? access.rolesOf(id) : [];   // derived by the one rule, by whoever owns the links (K5)
		// whether this endpoint is already emitting. A boolean rather than the config, because the
		// question a decision asks is "is it on"; the numbers belong to whoever is going to run them.
		t.spawning = !!entity.spawn;
	}
	return t;
}

// The selection, described rather than handed over. Kinds are deduplicated and sorted so two equal
// selections produce equal situations -- a value that compares unstably is not a value.
// `bends` is how many waypoints the ONE selected link bends through, and null otherwise: `c` means close on a link with
// a bend and a refusal on one without (ruled 2026-09-30), and a rule reads that here rather than from the model.
function describeSelection(access, ids) {
	const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
	const one = list.length === 1 && kindOf(list[0]) === 'link' && access.get ? access.get('link', list[0]) : null;
	// what each selected entity is DRAWN as -- a waypoint is a node with no type (F-c), and the situation says waypoint (F4)
	const drawn = (id) => (access.get ? drawnKind(kindOf(id), access.get(kindOf(id), id)) : kindOf(id));
	return { size: list.length, ids: [...list], kinds: [...new Set(list.map(drawn))].sort(),
		bends: one ? (Array.isArray(one.via) ? one.via.length : 0) : null };
}

/*
PREDICATES — the shared vocabulary, as free functions over an inert value.

They exist so a decision asks a NAMED question rather than reaching into the shape. That matters
more than it looks: `s.target && s.target.kind === 'waypoint' && s.target.roles.includes('endpoint')`
written at three call sites is three chances to get it subtly different, and the third one is a
defect nobody can see. It is the same argument that put `waypointRole` in the kernel.
*/

// the gesture is on a waypoint that TERMINATES a path, rather than bending one. A closed ring has
// no ends, so nothing on it is ever an endpoint -- that falls out of waypointRole, not from here.
/*
B208 -- reads the SET, not the string.

This is the migration hazard the design named in advance. `role === 'endpoint'` keeps compiling
against a set-valued field and is false for every waypoint, so spawner arming would stop working
everywhere with nothing failing to compile and no test noticing -- the same shape as B201, where a
comparison went on working while meaning something else.

`roles` is also why a T-junction can still be armed: it terminates a link AND carries three
directions, so it holds both roles at once, which a single-valued field could not say.
*/
export const onEndpoint = (s) => !!s.target && s.target.kind === 'waypoint'
	&& Array.isArray(s.target.roles) && s.target.roles.includes('endpoint');

// the surface is being read rather than authored
export const inReadView = (s) => s.mode === 'run';


/*
The gesture is on open ground -- no entity under it.

An absence, stated as a named question rather than as `!s.target` written at each call site. It is
the condition tower placement turns on, and it is the first predicate here that is TRUE of nothing:
`describeTarget` already answers null deliberately, calling that a real answer and not a gap, so
this only gives that answer a name.
*/
export const onOpenGround = (s) => !s.target;
