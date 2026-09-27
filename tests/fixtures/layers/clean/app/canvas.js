import { STD } from '../kernel/index.mjs';
import { commit } from '../planner/txn.mjs';
// a property named window and a key named window are not reads of the global; only the last line is
export const host = (o) => o.window;
export const keys = { window: 1 };
export function draw(doc) { return commit(doc) && STD * window.devicePixelRatio; }
// none of these is a host read or a hidden import: a member, a key, and a regex after a condition
export const other = (o, ok, s) => { if (ok) /import/.test(s); return o.self ?? { global: 1, eval: 2 }; };
