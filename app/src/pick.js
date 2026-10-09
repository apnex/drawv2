/*
PICK — resolve a point, or an event, to the entity under it.

One duty: *what is there?* Nothing here decides what to DO about it — that is the recognizer's job
(dev/INPUT.md §4) — and nothing here holds state. Two distinct questions live together because
they are the same question asked of two inputs:

  · from a DOM event   `hitOf(evt)`      — what did the pointer land on? (reads the rendered tree)
  · from a coordinate  `grabbedAt(...)`  — what occupies this point? (reads the Model, by what the parts say they cover)

Span-awareness is the reason these are not one-liners. A multi-cell node is hittable across its WHOLE
footprint, not just near its origin cell, so every predicate goes through `spanExtent` rather than a
radius (B29's family of bugs was surfaces forgetting exactly this).

Lifted out of `input.js` at H6.2 with the bodies unchanged; `this.model` became a parameter. The
first of the three units INPUT.md §8 names.
*/

import { kindOf } from '../../model/model.mjs';

// ---- from a DOM event: what did the pointer land on? ----

/*
C-b (H19.30; CANVAS-PLUGINS.md, D1) -- THE PLUGINS' PICKS. A painter or an appearance declares how its element is picked --
`picks: [{ closest, word, modifier? } | { self, word, id? }]`: the selector its element answers to, or the class the target
itself carries (a link's path, its click twin); the word the hit is called by; and a modifier it is picked under. A pick under a
modifier not held passes the press through to the canvas -- the zone, an inert backdrop on its own layer, picked only with
Shift, so a plain click or marquee passes THROUGH it, which is what makes marquee-select work inside a zone at all (DESIGN U1).
Composed from the page's canvas parts in their order, a backdrop's after the rest -- what is drawn over a backdrop takes the
press first; a pick naming no word, or answering to nothing, is refused.
*/
export function picksOf(parts) {
	const picks = [];
	for (const part of parts) {
		for (const d of [...(part.painters ?? []), ...(part.appearances ?? [])]) {
			for (const p of d.picks ?? []) {
				if (typeof p.word !== 'string') throw new Error(`pick: ${part.owner}'s pick for ${d.kind} names no word`);
				if (!p.closest && !p.self) throw new Error(`pick: ${part.owner}'s pick for ${d.kind} answers to no selector and no class`);
				picks.push({ ...p, owner: part.owner, kind: d.kind });
			}
		}
		// C-d: a handle is picked by the dataset key its declaration names, and called by its word (a corner handle, a link end)
		for (const h of part.handles ?? []) {
			if (typeof h.word !== 'string' || typeof h.key !== 'string') throw new Error(`pick: ${part.owner}'s handles for ${h.kind} name no word or no key`);
			picks.push({ handle: h.key, word: h.word, owner: part.owner, kind: h.kind });
		}
	}
	// a backdrop -- a pick under a modifier, passing a plain press through -- is tried after everything drawn over it
	return [...picks.filter((p) => !p.modifier), ...picks.filter((p) => p.modifier)];
}

// what the pointer landed on, by the composed picks -- a handle, a plugin's element, a plugin's mark, or the canvas
export function hitWith(picks) {
	return (evt) => {
		const target = evt.target;
		if (!target.closest) return { kind: 'canvas', id: null };
		if (target.classList && target.classList.contains('handle')) {
			// a handle: the declaration whose dataset key it carries names it -- its word, and the handle as the hit's id (C-d)
			// `handle` flags it, as `mark` flags a plugin's mark: a handle names no entity, so no row may take its id for one (B316)
			for (const p of picks) if (p.handle && target.dataset?.[p.handle] !== undefined) return { kind: p.word, id: target.dataset[p.handle], handle: true };
			return { kind: 'canvas', id: null };
		}
		for (const p of picks) {
			if (p.handle) continue;
			if (p.self) {
				if (target.classList && target.classList.contains(p.self)) return { kind: p.word, id: p.id ? p.id(target) : target.id };
				continue;
			}
			const found = target.closest(p.closest);
			if (!found) continue;
			if (p.modifier && !evt[p.modifier]) return { kind: 'canvas', id: null };   // a backdrop passes the press through (U1)
			return { kind: p.word, id: found.id };
		}
		/*
		H17.22 N-c2 -- A MARK a plugin drew names what a click on it selects (`data-select`): the network's hand pipes (B281). The
		kind is read off the id, as everywhere; `mark` says the canvas draws no handle of its own for it, so a press selects it and
		a drag never moves it (app/src/releases.js PRESS_DRAGS). The canvas names no plugin kind.
		*/
		const mark = target.dataset?.select;
		if (mark) return { kind: kindOf(mark), id: mark, mark: true };
		return { kind: 'canvas', id: null };
	};
}

// ---- from a coordinate: what occupies this point? ----

/*
C-e, step three (H19.33) -- WHAT IS AT A POINT is what each part says its items cover (`at`), asked in the parts' order: the
devices plugin's devices (devices/device-footprint.mjs), the network's waypoints and links (network/anchor-points.mjs). An entry
names the word its items are picked by and the items (`of`), and any of: what a press grabs (`grabs`), what keeps a hover
(`under`), what a box takes (`within`), and what a box takes once it took what the item joins (`joins`).
*/
export function pointsOf(parts) {
	const points = [];
	for (const part of parts) for (const a of part.at ?? []) {
		if (typeof a.word !== 'string' || typeof a.of !== 'function') throw new Error(`pick: ${part.owner}'s point picks name no word or no items`);
		points.push({ ...a, owner: part.owner });
	}
	return points;
}

// the first item, in the parts' order, that grabs `pos` -- of the named words, or of any
export function grabbedAt(points, model, pos, words = null) {
	for (const a of points) {
		if (!a.grabs || (words && !words.includes(a.word))) continue;
		const found = a.of(model).find((x) => a.grabs(x, pos));
		if (found) return found;
	}
	return null;
}

// what a box takes: every item whose cover meets it, then every item whose ends it took (a link with both ends inside)
export function takenIn(points, model, box) {
	const taken = [];
	for (const a of points) if (a.within) for (const x of a.of(model)) if (a.within(x, box)) taken.push(x.id);
	const inBox = new Set(taken);
	for (const a of points) if (a.joins) for (const x of a.of(model)) if (a.joins(x, inBox)) taken.push(x.id);
	return taken;
}

// cell occupancy (the engine's O(1) index, not a scan): anything rests here -- the core's
export const occupiedAnyAt = (model, p) => model.occupiedAnyAt(p);
