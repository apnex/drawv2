/*
PICK — resolve a point, or an event, to the entity under it.

One duty: *what is there?* Nothing here decides what to DO about it — that is the recognizer's job
(dev/INPUT.md §4) — and nothing here holds state. Two distinct questions live together because
they are the same question asked of two inputs:

  - from an event      `hitWith(...)`    -- what did the pointer land on? (the item the scene made the target for; H26.8)
  · from a coordinate  `grabbedAt(...)`  — what occupies this point? (reads the Model, by what the parts say they cover)

Span-awareness is the reason these are not one-liners. A multi-cell node is hittable across its WHOLE
footprint, not just near its origin cell, so every predicate goes through `spanExtent` rather than a
radius (B29's family of bugs was surfaces forgetting exactly this).

Lifted out of `input.js` at H6.2 with the bodies unchanged; `this.model` became a parameter. The
first of the three units INPUT.md §8 names.
*/

import { kindOf } from '../../model/model.mjs';

// ---- from an event: what did the pointer land on? ----

/*
C-b (H19.30; CANVAS-PLUGINS.md, D1) -- THE PLUGINS' PICKS. A painter or an appearance declares how what it draws is picked; a part declares
its handles. A pick named the selector its element answered to (`closest`) or the class the target carried (`self`), and was found by
walking up from the event's target.
RESTATED at H26.8's picks move (dev/design/components/NATIVE-SHAPES.md section 3.2, NS6, GR4) -- PICKS BY ITEM. What the pointer landed on is
the item the scene made the target for (`scene.itemOf`), keyed `<id>` or `<id>/<part>`, and its drawer -- the painter or winning appearance
that drew it (the renderer's `drawerOf`) -- answers by its one pick:
  { word, modifier?, button?, idle?, clones?, parts?, on? }
  word      what the hit is called by
  modifier  a modifier it is picked under: without it a press passes through to the canvas -- the zone, an inert backdrop (DESIGN U1)
  button    `'right'`: pressed with the right button only (H24.5; app/src/recognize.js); `idle`, the state it shows idle under the pointer;
            `clones`, a Ctrl+left press clones it -- facts the press rows read, never the pick itself
  parts     the entity's items that answer, all when absent -- a link's line and its click twin, not its head or leg
  on        an attribute the shape at the target's path must carry
A MARK -- `{ mark: true, on, parts? }` -- names no word: a plugin's mark the canvas selects (H17.22 N-c2, B281), the network's hand pipe by its
hit line's `data-select`; its hit is `{ kind, id, mark: true }`, the kind read off the id, and app/src/recognize.js `hitFactsOf` takes none,
as it takes no handle (reading 3, o:F2). A selector or a class, a word on a mark, a mark naming no attribute, more than one pick for a
drawer, are refused when the canvas is built.
*/
const RETIRED_PICK = ['closest', 'self'];
// the drawer a pick belongs to, as the renderer answers it (`drawerOf`): an appearance by its id, a painter by its kind
const drawerKey = (d) => (d.id !== undefined ? `appearance ${d.id}` : `painter ${d.kind}`);
export function picksOf(parts) {
	const picks = [];
	for (const part of parts) {
		for (const d of [...(part.painters ?? []), ...(part.appearances ?? [])]) {
			const declared = d.picks ?? [];
			if (declared.length > 1) throw new Error(`pick: ${part.owner}'s ${d.kind} declares ${declared.length} picks -- one per drawer, its \`parts\` naming the items that answer (GR4)`);
			for (const p of declared) {
				const retired = RETIRED_PICK.filter((k) => k in p);
				if (retired.length) throw new Error(`pick: ${part.owner}'s pick for ${d.kind} names ${retired.join(' and ')} -- a pick answers by item (H26.8, GR4)`);
				if (p.mark) {
					if ('word' in p) throw new Error(`pick: ${part.owner}'s mark for ${d.kind} names a word -- a mark is selected, never a drawn word (o:F2)`);
					if (typeof p.on !== 'string') throw new Error(`pick: ${part.owner}'s mark for ${d.kind} names no attribute its shape carries`);
				} else if (typeof p.word !== 'string') throw new Error(`pick: ${part.owner}'s pick for ${d.kind} names no word`);
				picks.push({ ...p, owner: part.owner, kind: d.kind, drawer: drawerKey(d) });
			}
		}
		// C-d: a handle is picked by the `data-` key its declaration names, and called by its word (a corner handle, a link end)
		for (const h of part.handles ?? []) {
			if (typeof h.word !== 'string' || typeof h.key !== 'string') throw new Error(`pick: ${part.owner}'s handles for ${h.kind} name no word or no key`);
			picks.push({ handle: h.key, word: h.word, owner: part.owner, kind: h.kind });
		}
	}
	return picks;
}

const dataName = (key) => `data-${String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const CANVAS_HIT = Object.freeze({ kind: 'canvas', id: null });
// the shapes of an item from its own shape down the target's path, the target's last: read off the scene's description, never the element
function shapesOn(scene, { layer, key, path }) {
	const item = scene.items(layer).find((x) => x.key === key);
	const out = [];
	let shape = item ? { children: item.shapes } : null;
	for (const i of path) { shape = shape?.children?.[i]; if (!shape) return []; out.push(shape); }
	return out;
}
// an item's entity and part, from its key: `<id>`, or `<id>/<part>` -- an editing item's key names no entity the renderer draws
const entityOf = (key) => { const at = key.indexOf('/'); return at < 0 ? { id: key, part: '' } : { id: key.slice(0, at), part: key.slice(at + 1) }; };

/*
What the pointer landed on: `(evt) -> { kind, id, handle?, mark? }`, `evt` holding the target and the modifiers. The item the scene made the
target for; an editing handle answers by the `data-` key its declaration names, `handle` flagging it -- a handle names no entity, so no row
may take its id for one (B316); an entity's item answers its drawer's pick where `parts` and `on` admit the shape at the target's path, its
modifier held or none declared, and otherwise the canvas (U1); anything else -- open ground, an editing visual, what the scene did not make
-- is the canvas. Which drawer answers where two overlap is which item the platform's hit test finds: the layers' order (3.2, precedence).
*/
export function hitWith(picks, { scene, drawerOf }) {
	const byDrawer = new Map(picks.filter((p) => p.drawer).map((p) => [p.drawer, p]));
	const handles = picks.filter((p) => p.handle);
	return (evt) => {
		const at = scene.itemOf(evt.target);
		if (!at) return CANVAS_HIT;
		const shape = shapesOn(scene, at).at(-1);
		if (!shape) return CANVAS_HIT;
		const { id, part } = entityOf(at.key);
		const drawer = drawerOf(id);
		if (!drawer) {
			// an editing item: a handle answers by the key its declaration names; any other visual is the canvas's
			if (!String(shape.attrs?.class ?? '').split(/\s+/).includes('handle')) return CANVAS_HIT;
			for (const h of handles) { const v = shape.attrs[dataName(h.handle)]; if (v !== undefined) return { kind: h.word, id: v, handle: true }; }
			return CANVAS_HIT;
		}
		const p = byDrawer.get(drawerKey(drawer));
		if (!p || (p.parts && !p.parts.includes(part)) || (p.on && shape.attrs?.[p.on] === undefined)) return CANVAS_HIT;
		if (p.modifier && !evt[p.modifier]) return CANVAS_HIT;   // a backdrop passes the press through (U1)
		return p.mark ? { kind: kindOf(id), id, mark: true } : { kind: p.word, id };
	};
}

/*
C-f (H19.34) -- WHAT RUN MODE READS UNDER A PRESS. It was read by the parts' page selectors -- what each draws (`drawn`), what a run press
aims at (`runTargets`) -- each joined for one `closest` (app/src/capture.js `regionOf`).
RESTATED at H26.8's picks move (NATIVE-SHAPES.md section 3.2, "Run regions"; o:F5, o:F9): a drawer declares `run: { entity?: parts,
target?: true }` beside its pick, and `regionWith({ scene, drawerOf })` answers `(target) -> region`, the seven fields as they were:
  target, overTarget   the item's entity, and true, when its drawer declares `target` (the network's anchor appearance, a waypoint)
  action, input,       the deepest shape on the target's path holding `data-action` or `data-input`, read as before: its action, or its
  control              input's index (`data-idx`) where it names no action, and whether one was found
  owner                null unless a control was found; then the item's entity, when its drawer declares the item's part `entity`
  entity               whether the item's part is among its drawer's `entity` parts: every part of a zone, group or device, a link's line
Null when there is no target to ask; open ground, an editing visual and what the scene did not make answer every field empty.
*/
const NO_REGION = Object.freeze({ target: null, overTarget: false, action: null, input: null, owner: null, control: false, entity: false });
export function regionWith({ scene, drawerOf }) {
	return (target) => {
		if (target === null || typeof target !== 'object') return null;
		const at = scene.itemOf(target);
		if (!at) return { ...NO_REGION };
		const control = shapesOn(scene, at).findLast((s) => s.attrs?.['data-action'] !== undefined || s.attrs?.['data-input'] !== undefined) ?? null;
		const { id, part } = entityOf(at.key);
		const run = drawerOf(id)?.run ?? {};
		const entity = !!run.entity?.includes(part), action = control?.attrs['data-action'];
		return {
			target: run.target ? id : null,
			overTarget: !!run.target,   // an item answered -- run mode places nothing over one
			action: action ? action : null,
			input: control && !action && control.attrs['data-input'] !== undefined ? Number(control.attrs['data-idx']) : null,
			owner: control && entity ? id : null,
			control: !!control,
			entity,
		};
	};
}

// ---- from a coordinate: what occupies this point? ----

/*
C-e, step three (H19.33) -- WHAT IS AT A POINT is what each part says its items cover (`at`), asked in the parts' order: the
devices plugin's devices (plugins/devices/device-footprint.mjs), the network's waypoints and links (plugins/network/anchor-points.mjs). An entry
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
