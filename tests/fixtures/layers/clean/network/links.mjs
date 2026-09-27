import { cellOf } from '../kernel/grid.mjs';
export function linksOf(model, id) { return [cellOf(id.length)]; }
export function splitAtBend(link) { return [link]; }
