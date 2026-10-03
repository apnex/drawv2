/*
THE COMPOSITION PRODUCTION RUNS, for tests (S-b, H18.12): the product's kinds with the network's rows, and the network's
link tenant -- what the server's store composes (server/store.js) and the lab composes (lab/src/root.js).

The planner has no default link tenant since S-b, so a test that plans must name one. These wrappers name this one where the
test passes none, and a Model built here carries these kinds; a test that is ABOUT composition imports the real ones.
*/
import { Model as RealModel } from '../../model/model.mjs';
import { plan as realPlan, commit as realCommit, undo as realUndo, redo as realRedo } from '../../planner/txn.mjs';
import { productKinds } from '../../planner/kinds.mjs';
import { NETWORK_ROWS } from '../../network/kinds.mjs';
import { createNetwork } from '../../network/network.mjs';
import { createTransit } from '../../network/transit.mjs';

export const KINDS = productKinds(...NETWORK_ROWS);
export const NETWORK = createNetwork(createTransit());
export const PLAN = { links: NETWORK.links, kinds: KINDS };

const withPlan = (options = {}) => ({ ...PLAN, ...options });
const withKinds = (options = {}) => ({ kinds: KINDS, ...options });

export class Model extends RealModel {
	constructor(options = {}) { super({ kinds: KINDS, ...options }); }
}
export const plan = (model, ops, options) => realPlan(model, ops, withPlan(options));
export const commit = (model, log, request, by, actor, options) => realCommit(model, log, request, by, actor, withPlan(options));
export const undo = (model, log, to = null, options) => realUndo(model, log, to, withKinds(options));
export const redo = (model, log, options) => realRedo(model, log, withKinds(options));
