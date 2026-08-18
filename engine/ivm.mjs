/*
ivm.mjs — incremental-view maintenance: ONE maintained reverse index over a change stream. The generic
skeleton that engine/relations.mjs hand-inlined THREE times (link incidence, group membership, cell
occupancy): multimap add / del / clear-empty + the snapshot-diff on `set` + the sameKeys fast-path.

A view is parameterized by the tenant's KEYING — `refsOf(entity) -> keys[]` — plus a bucket kind:
  'set'    — key -> Set<entityId>   (many entities per key: incidence, occupancy)
  'single' — key -> entityId        (one owner per key: membership; remove/overwrite honour a re-ownership
                                      guard so reassigning an entity to a new key never un-owns it)

The snapshot-diff is the load-bearing trick: emit('set') delivers only the NEW entity (no before/after
pair), so each view keeps a per-entity snapshot of its PRIOR keys and diffs prior-vs-next — never re-
deriving the old keys from a stale source.

Engine-resident at sample-size-one (the only tenant is draw's relations). Promote to prism/ as a neutral
primitive ONLY when a second domain grows a maintained index (the deferred S3 step) — promotion by
evidence, per the stopping rule.
*/
export function maintainIndex({ refsOf, kind }) {
	const index = new Map();   // key -> Set<id> (kind 'set') | id (kind 'single')
	const snap = new Map();    // entityId -> [keys]  (prior keys, diffed on set/del)

	const add = kind === 'set'
		? (key, id) => { let s = index.get(key); if (!s) index.set(key, s = new Set()); s.add(id); }
		: (key, id) => index.set(key, id);
	const remove = kind === 'set'
		? (key, id) => { const s = index.get(key); if (s) { s.delete(id); if (!s.size) index.delete(key); } }
		: (key, id) => { if (index.get(key) === id) index.delete(key); };   // single-value RE-OWNERSHIP guard
	const sameKeys = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

	const del = (id) => { const keys = snap.get(id); if (keys) keys.forEach((k) => remove(k, id)); snap.delete(id); };
	const put = (entity) => { del(entity.id); const keys = refsOf(entity); keys.forEach((k) => add(k, entity.id)); snap.set(entity.id, keys); };
	const set = (entity) => {                                   // diff prior keys (snapshot) -> new keys
		const next = refsOf(entity), prev = snap.get(entity.id) || [];
		if (sameKeys(prev, next)) return;                      // unchanged keys (e.g. a within-cell drag frame): zero bucket work
		const ns = new Set(next), ps = new Set(prev);
		prev.forEach((k) => { if (!ns.has(k)) remove(k, entity.id); });   // keys it no longer touches
		next.forEach((k) => { if (!ps.has(k)) add(k, entity.id); });     // keys it newly touches
		snap.set(entity.id, next);
	};

	return {
		put, set, del,
		get: (key) => index.get(key),     // Set<id> | id | undefined
		has: (key) => index.has(key),
		clear: () => { index.clear(); snap.clear(); }
	};
}
