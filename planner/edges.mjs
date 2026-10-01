/*
THE PLANNER'S EDGES -- what sits around the transaction core rather than in it (PL-4, dev/design/planner/PLANNER-SYSTEM.md
section 6.4; PD-6).

The core (`planner/txn.mjs`) plans, applies and records, and knows neither time nor presentation. Two things it used to
hold are here:

  wallClock     the clock a composition passes as `now` -- the default, so a test that passes nothing still gets one.
                The core read `Date.now()` three times in a file whose header says "no timers"; now it calls whatever
                clock it was handed, and the server's store hands it its own injected one.
  BEATS         a RECORD EXTENSION: what a commit carries beside its ops. A `pace` makes a commit a beat, and the
                document's reveal schedule (H14.4, H14.7) is extended and recorded, with its inverse, so undo and redo
                move it with the ops.

A record extension is a row the core runs around every commit:

	{ id, field, refuse(request, planned) -> error | null, next(state, request, planned, now) -> value | undefined }

`planned` is the plan the core will apply: `{ ops, inverse }`.

`refuse` runs before anything is applied (PR4, B270); `next` runs after the ops apply and answers the field's new value,
or `undefined` for "untouched". The core writes `state[field]`, records `change[field]` and `change[field + 'Inverse']`
when the value changed, and restores them on undo and redo -- the same record shape the reveal always had, so stored
logs read exactly as before.
*/
import { CAPTION_MAX } from '../model/limits.mjs';

export const wallClock = () => Date.now();

/*
The ids a paced commit reveals: the entities it CREATED, in the order they applied.

B272 -- it was every entity the commit put, so a beat that only renamed an entity already on screen withheld it until
its turn. A created entity is one whose inverse is a delete: the core writes a `del` inverse only for a put of something
absent (`inverseOf`, planner/txn.mjs), so the plan says which they are without the extension reading the document.
*/
function beatIds(request, { ops, inverse }) {
	if (!Number.isInteger(request.pace) || request.pace < 0) return [];
	const created = new Set(inverse.filter((o) => o.op === 'del').map((o) => `${o.kind}:${o.id}`));
	return ops.filter((o) => o.op === 'put' && created.has(`${o.kind}:${o.entity.id}`)).map((o) => o.entity.id);
}

export const BEATS = {
	id: 'beats',
	field: 'reveal',
	/*
	B220 -- REFUSED, not truncated and not stored unchecked.

	This was `String(request.caption)` with no length test, while `validateDoc` checked the stored file against a limit
	at boot. So a long caption was accepted, persisted, served all session, and then refused when the server next read
	the file -- the diagram vanished from its owner's list with nothing said, and the only trace was a skip line in the
	boot log. A document the system produced could not be reloaded by the system.

	Refusing is right rather than truncating: a caption silently shortened is a narration the author did not write, and
	they would find out by reading it later. The limit is stated once in `model/limits.mjs` and both doors read it, which
	is the property that was missing -- not the value of the limit.

	B270 -- decided before the apply, from the planned ops, so a refusal touches nothing.
	*/
	refuse(request, planned) {
		if (!beatIds(request, planned).length || request.caption === undefined) return null;
		const n = String(request.caption).length;
		return n > CAPTION_MAX ? `caption is ${n} characters; the limit is ${CAPTION_MAX}` : null;
	},
	/*
	H14.4/H14.7 -- a `pace` makes this commit a BEAT, and the record is built at commit because only commit knows which
	ids it produced.

	An intent op names a relationship and the id is minted while resolving it (B189), so a client assembling this would
	be guessing at the very ids the beat exists to order. The planned ops are the resolved list, in the order they
	applied, which is exactly the order to reveal in.

	Only CREATED entities are revealed: a beat that renames something would otherwise hide an entity already on screen
	(B272, fixed in `beatIds` above). A caption rides only on a beat, so a paced commit that creates nothing has no beat,
	and its caption is neither stored nor judged.

	The reveal INVERTS like anything else (ruled 2026-09-04): the core records the value before and after, so undoing a
	beat takes its reveal with it and undoing past an earlier beat restores THAT one.
	*/
	next(state, request, planned, now) {
		const ids = beatIds(request, planned);
		if (!ids.length) return undefined;
		const beat = { interval: request.pace, ids };
		if (request.caption !== undefined) {
			const caption = String(request.caption);
			if (caption) beat.caption = caption;
		}
		/*
		B193 -- a beat joins a schedule that is still playing, and STARTS one that has drained.

		The origin was stamped once and never moved, so a beat committed after the queue finished inherited a window that
		had already closed and never unfurled. The caption still showed, being held until replaced, so the narration read
		correctly while nothing paced -- which is why it survived being watched.

		An agent narrating across a pause is the use case rather than an edge, so the test is whether the existing
		schedule has ENDED, not whether one exists. A drained reveal is replaced rather than appended to: carrying expired
		beats forward would leave the record describing unfurls nobody can ever see, and they have already played.
		*/
		const prev = state.reveal;
		const t = now();
		const playing = prev && t < prev.origin + prev.beats.reduce((a, b) => a + (b.ids?.length || 0) * (b.interval || 0), 0);
		return playing ? { ...prev, beats: [...prev.beats, beat] } : { origin: t, beats: [beat] };
	},
};
