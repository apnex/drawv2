/*
Ops — the op vocabulary and the ONLY write into a Model.

An op is an instruction against one entity. The same four shapes travel the wire, sit in a Change's
`ops`, and sit — pre-reversed — in its `inverse`, so forward and backward are one code path and
cannot disagree:

  { op:'put',  kind, entity }     whole entity value
  { op:'set',  kind, id, patch }  ONLY the keys that actually change
  { op:'del',  kind, id }         by id; the entity lives in the inverse
  { op:'meta', patch }            { name?, slides:{url?} } — config meta, no id

Sovereign: this module knows the Model and the shape table, nothing else. No server, no wire, no
store. Both peers load it — document/ is mounted at /document (server/app.js:150).

`applyOps` is the single mutation point in the system. A source scan (tools/scan-writers.mjs)
fails on any model.put/set/del outside it, because an out-of-band write corrupts every stored
inverse below it with no error at the time of corruption.
*/

import { COMPOSITE } from './shape.mjs';

export const OPS = ['put', 'set', 'del', 'meta'];

// A copy deep enough that the result shares no mutable structure with the original. Walks the
// COMPOSITE table rather than an if-ladder, so a new nested field is declared in one place.
// Load-bearing twice over: a stored inverse must not alias the live model (undo would replay a
// value that has since changed under it), and a `put` must not alias the wire payload.
export function clone(kind, entity) {
	const copy = { ...entity };
	for (const field of COMPOSITE[kind] ?? []) {
		const v = copy[field];
		if (v === undefined) continue;
		if (Array.isArray(v)) copy[field] = v.map((x) => (x && typeof x === 'object' ? structuredClone(x) : x));
		else if (v && typeof v === 'object') copy[field] = structuredClone(v);
	}
	return copy;
}

// Apply a planned op-list in order. The ONLY write. Ops arrive already validated and already
// cascaded by plan(); this function makes no decisions and rejects nothing — a malformed op here
// is a planner bug, so it throws rather than silently no-op'ing (the old applyOps had no `else`
// and swallowed an unrecognised action).
export function applyOps(model, ops) {
	for (const op of ops) {
		if (op.op === 'put') model.put(op.kind, clone(op.kind, op.entity));
		else if (op.op === 'set') model.set(op.kind, op.id, clone(op.kind, op.patch));
		else if (op.op === 'del') model.del(op.kind, op.id);
		else if (op.op === 'meta') applyMeta(model, op.patch);
		else throw new Error(`applyOps: unknown op '${op.op}'`);
	}
}

// meta is config, not an entity: no id, and only the two keys a user can author. `slides.url` is
// the user-pasted deck; presentationId/pageId are STATUS, written by the server after a push
// (Store.bindSlides) and never carried in a Change.
function applyMeta(model, patch) {
	const meta = model.state.meta;
	if (patch.name !== undefined) meta.name = patch.name;
	if (patch.slides && patch.slides.url !== undefined) meta.slides.url = patch.slides.url;
}
