/*
H26.8 (dev/design/components/NATIVE-SHAPES.md section 3.2, NS13) -- THE EDITING STATES: which session states each entity shows, held
in one place.

A state is a class an entity shows while something holds it -- the selection's `selected`, the parts' reflections of it (the
network's `on-selected-path` and `blocking`), the overlay's `hover` and the idle ring a pick shows, the arming chord's `armed` and
`armed-clone`, a link end's drag state. Until H26.8 each was a class toggled on the renderer's element, so a fresh element -- a mode
change, a structural change, a load -- lost it while its owner still held it (NS13, measured). Now each owner asks this module, which
holds what each entity shows in the order it was set, and the renderer describes it onto the entity's state target each time it puts
the entity, and again whenever a state changes: shown while held.

  setState(id, cls, on)      hold `cls` for `id`, or let it go
  clearState(id, ...classes) let each go
  reflect(selected)          the selection's `selected`, and each part's reflection of it, held for exactly the ids they name now --
                             what it marked before and marks no longer, let go
  classesOf(id)              the classes `id` shows, in the order set
  onChange(fn)               `fn(id, cls, on)` for each class held or let go

The names `setState` and `clearState` are the renderer's that they were, so tools/copies.mjs credits a state class to the module that
sets it as before (a:F13).

A CHANGE IS TOLD, an ask that changes nothing is not. The painters move told every ask (its verifier's B1): a pipe's line was the
network's to draw until the pipes move, and only the element it last drew showed a state, so an owner asking again -- the overlay, its
pointer over a line drawn afresh -- had to reach the composition's hook for it. The renderer draws every pipe since, describing what is
held onto each line it draws, and the hook went with the network's drawer.

The composition makes it and hands it to the renderer, Input and its overlay, and the network's settle; it imports nothing, and a part's
reflections arrive with its canvas part.
*/

export class EditingStates {
	/*
	`model`, which a reflection reads; `parts`, the canvas parts, each bringing its `reflects`: `{ cls, of(model, selected) -> ids }`,
	checked here as the renderer checked them.
	*/
	constructor({ model = null, parts = [] } = {}) {
		this.model = model;
		this.reflects = parts.flatMap((p) => (p.reflects ?? []).map((r) => {
			if (typeof r.cls !== 'string' || typeof r.of !== 'function') throw new Error(`EditingStates: ${p.owner}'s selection reflection names no class or no marks`);
			return { cls: r.cls, of: r.of, owner: p.owner };
		}));
		this.held = new Map();       // id -> its classes, in the order set
		this.selected = new Set();   // what `reflect` last held `selected` for
		this.marked = new Map();     // a reflection's class -> the ids it last marked
		this.listeners = [];
	}

	onChange(fn) { this.listeners.push(fn); }

	setState(id, cls, on) {
		const list = this.held.get(id) ?? [];
		const has = list.includes(cls);
		if (on ? has : !has) return;
		if (on) this.held.set(id, [...list, cls]);
		else if (list.length === 1) this.held.delete(id);
		else this.held.set(id, list.filter((c) => c !== cls));
		for (const fn of this.listeners) fn(id, cls, !!on);
	}

	clearState(id, ...classes) {
		for (const cls of classes) this.setState(id, cls, false);
	}

	// the selection's look, and each part's reflection of the selection: let go what is no longer named, held what is
	reflect(ids) {
		const next = new Set(ids);
		for (const id of this.selected) if (!next.has(id)) this.setState(id, 'selected', false);
		for (const id of next) if (!this.selected.has(id)) this.setState(id, 'selected', true);
		this.selected = next;
		for (const r of this.reflects) {
			const now = r.of(this.model, this.selected), before = this.marked.get(r.cls) ?? new Set();
			for (const id of before) if (!now.has(id)) this.setState(id, r.cls, false);
			for (const id of now) this.setState(id, r.cls, true);
			this.marked.set(r.cls, now);
		}
	}

	classesOf(id) { return [...(this.held.get(id) ?? [])]; }
}
