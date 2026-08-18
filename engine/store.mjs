/*
Engine store — attaches the maintained relations (engine/relations.mjs) to a Model: builds the
indices from current state, keeps them in sync via the onChange spine, and exposes them as
`model.index` — the delegate-or-scan seam the Model query methods consult. The first STATEFUL engine
module + the first client-side engine wiring (main.js). Opt-in: a Model with no index attached keeps
scanning (the server, and the rollback path). Register it BEFORE other subscribers (right after
`new Model()`) so consumers see a fresh index when their own onChange handlers run. R3.
*/
import { makeRelations } from './relations.mjs';

export function attachRelations(model, deps = {}) {
	const rel = makeRelations(model, deps);   // deps (e.g. { cellOf }) injected through to the index — keeps engine/ free of kernel imports
	rel.rebuild();                  // build from current state before any event can fire
	model.index = rel;              // the delegate seam: doc.js query methods now use the index
	model.onChange((action, kind, entity) => {
		if (model.index !== rel) return;       // detached → stop maintaining (rollback)
		if (action === 'load') rel.rebuild();  // document swap → full rebuild
		else rel.apply(action, kind, entity);
	});
	return { rel, detach() { model.index = null; } };   // detach → query methods fall back to scans
}
