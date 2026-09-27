import { Model } from '../model/model.mjs';
import { linksOf, splitAtBend } from '../network/links.mjs';
// a query names the same file: this edge is planner -> planner, and L6 sees validate.js loaded
import { validate } from './validate.js?v=1';
export const MAX_OPS = 64;
export const LIMIT = 8;
export function commit(doc) { return validate(doc.id) && linksOf(new Model(), doc.id).length <= MAX_OPS ? splitAtBend(doc) : null; }
