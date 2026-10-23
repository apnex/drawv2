// H26.3: the one name tests/fixtures/pre-capture/capture.js, kept verbatim, imports from './painter.js' -- app/src/painter.js's, unchanged.
// A re-export, so a barrel by L4's measure, which names it as its one exception (tools/layers.mjs RULES.L4.verbatim; H26.3's verification, V6)
// AMENDED H26.4 (dev/design/components/VECTOR-SCENE.md section 10.1, a:F9 and o:F8): `toCanvas` leaves app/src/painter.js, so this answers it
// from the verbatim painter kept beside today's renderer -- the old capture keeps the old conversion, independent of the scene's
export { toCanvas } from '../pre-scene/app/src/painter.js';
