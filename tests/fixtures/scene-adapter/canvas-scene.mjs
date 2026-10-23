/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1) -- the side-by-side's stand-in for the composition's declaration of the scene,
product/canvas.mjs CANVAS_SCENE at the move: the canvas's layers in order, each written with its id, and the two the plugins draw
themselves -- the network's pipes and the simulation's movers -- foreign.
*/
import { CANVAS_LAYERS } from '../../../product/canvas.mjs';

const FOREIGN = ['pipes', 'movers'];
export const CANVAS_SCENE = { layers: CANVAS_LAYERS.map((name) => ({ name, attrs: { id: name }, ...(FOREIGN.includes(name) ? { foreign: true } : {}) })) };
