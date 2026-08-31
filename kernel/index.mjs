// KERNEL — the public interface. Consumers build on the .next geometry kernel by importing
// from HERE only; the individual modules are implementation detail.
//
//   import { resolve, render, check, STD } from './kernel/index.mjs';
//
//   resolve(schema) → { V, L, scene, byId }   (the deterministic core)
//   render(schema)  → SVG string               (resolve → renderer)
//   check(schema)   → [{ rule, pass, why }]     (resolve → GRC)
export { STD, L_STD, derive, BEND_R } from './spec.mjs';
export { resolve } from './engine.mjs';
export { renderScene, renderElement, sharedDefs, DRAW_ORDER, selBox, renderContentRegion, contentLayout, hexColor, isPanel, frameRadius, showsSockets } from './renderer.mjs';
export { grc, RULES, crossings } from './grc.mjs';
export { roundedPath, gridSnap } from './router.mjs';
export { docToSchema, schemaToDoc } from './adapt.mjs';
export { px, cellPx, cellCenter, cellOf, groupHull, bboxOf, spanExtent } from './geometry.mjs';
// B162: the bend/endpoint rule, so the live renderer and the SVG export reach the same answer
export { waypointRole } from './geometry.mjs';
export { LAYOUTS, layoutOf, onLayout, snapLayout, cellOn, pxOn, nearestAnchor, anchorAt } from './geometry.mjs';

import { resolve } from './engine.mjs';
import { renderScene } from './renderer.mjs';
import { grc } from './grc.mjs';

export function render(schema, pad) { const { V, L, scene } = resolve(schema); return renderScene(scene, V, L, pad); }
export function check(schema) { const { V, L, scene } = resolve(schema); return grc(scene, V, L); }
