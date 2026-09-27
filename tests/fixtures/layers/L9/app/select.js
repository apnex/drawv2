import * as inv from '../model/invariants.mjs';
const { splitAtBend } = inv;
export const onSelect = (l) => splitAtBend(inv.other(l));
