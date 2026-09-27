export async function onDrag(l) { const m = await import('../model/invariants.mjs'); const { splitAtBend } = m; return splitAtBend(l); }
