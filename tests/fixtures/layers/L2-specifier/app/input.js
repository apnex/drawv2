import { situationOf } from '../sim/situation.mjs?v';
export const onKey = situationOf;
export const later = async () => (await import('../sim/kinds.mjs#x')).KINDS_OF_MOVER;
