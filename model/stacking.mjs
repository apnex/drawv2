/*
THE STACKING -- the drawing order as readers compare it (F-d, H18.6; model/order.mjs says what the order is and who stamps
it). The canvas stacks its layers by it, the network ages links by it, and the export restates it (kernel/ may not import
model/, C9). Apart from model/order.mjs because the planner loads that one and compares nothing.
*/

import { byId } from './order.mjs';

export const orderOf = (entity) => (entity && Number.isInteger(entity.order) ? entity.order : 0);

export const byDrawingOrder = (a, b) => {
	const x = orderOf(a), y = orderOf(b);
	return x < y ? -1 : x > y ? 1 : byId(a, b);
};
