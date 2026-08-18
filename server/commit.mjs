// commit — the transactional write seam used by the diagram store: load -> mutate -> validate ->
// atomic save, or reject writing NOTHING. Rejection safety comes from PURITY, not rollback: the
// mutator computes the next store without touching the live one, so a rejected commit needs no undo.
//
// `port`   = { load(): store, save(store): void, validate(store): violations[] }
// `mutate` = (store) => { ok:true, store, ...result }  |  { ok:false, ... } to reject before any write.
//
// Provenance: lifted verbatim from the prism state-engine core (same author) when drawv2 stopped
// depending on that project. Its other primitives (graph walk, FSM stepper) had no consumer here.

export function commit(port, mutate) {
	const res = mutate(port.load());
	if (!res.ok) return res;                          // caller rejected (illegal move) — nothing saved
	const violations = port.validate(res.store);
	if (violations.length) return { ok: false, error: 'gate rejected the result (nothing written)', violations };
	port.save(res.store);
	return { ok: true, ...res };
}
