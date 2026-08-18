/*
Selection — the model's authoritative selected-id set (model-state / status). Selecting a grouped
node expands to its whole group (group = move/select-as-one, docs/spec/SCOPE.md decision 3). Holds NO state of
its own: a thin behavior layer over `model.state.selection` (MS1), and NO renderer (the R7 shed —
observers subscribe()). Reconcile-to-config (auto-prune on del, restore-on-load) is single-sourced
in the Model (expandSelection/setSelection, load-filter, del-net). Testable without a renderer.
*/

export class Selection {
	constructor(model) {
		this.model = model;
		this.subscribers = []; // observers — wired at the composition root (renderer reflection + input refresh)
		// reflection side of reconcile: a delete drops the id from the shared model.state.selection
		// during emit (membership-aware → fire changed only on a real drop). Model.del also nets it
		// post-emit (the server's reconcile); both hit the same Set, so this is idempotent. A document
		// load is reconciled by Model.load itself, so here we only re-reflect.
		model.onChange((action, kind, entity) => {
			if (action === 'del') { if (this.model.state.selection.delete(entity.id)) this.changed(); }
			else if (action === 'load') this.changed();
		});
	}

	// observe selection changes. Selection holds no renderer: the renderer subscribes its
	// reflectSelection, input subscribes its handle/readout refresh (both at the composition root).
	subscribe(fn) { this.subscribers.push(fn); }

	changed() {
		this.subscribers.forEach((fn) => fn());
	}

	set(ids) {
		this.model.setSelection(ids);   // expand-to-group + reconcile-to-live, single-sourced in the Model
		this.changed();
	}

	add(ids) {
		this.model.expandSelection(ids).forEach((id) => { if (this.model.selectable(id)) this.model.state.selection.add(id); });
		this.changed();
	}

	toggle(id) {
		if (this.has(id)) {
			this.model.expandSelection([id]).forEach((i) => this.model.state.selection.delete(i));
			this.changed();
		} else {
			this.add([id]);   // add() fires changed()
		}
	}

	clear() {
		this.model.state.selection.clear();
		this.changed();
	}

	has(id) { return this.model.state.selection.has(id); }

	list() { return [...this.model.state.selection]; }

	size() { return this.model.state.selection.size; }

	selectedNodes() {
		return this.list().filter((id) => this.model.get('node', id));
	}

	// nodes AND waypoints in the selection — the entities that can be grouped / moved as one
	groupable() {
		return this.list().filter((id) => this.model.endpointOf(id));
	}
}
