// H26.3: the one name tests/fixtures/pre-capture/capture.js, kept verbatim, imports from './painter.js' -- app/src/painter.js's, unchanged;
// bound here rather than re-exported, since no module of this tree is a barrel (tools/layers.mjs L4)
import { toCanvas as live } from '../../../app/src/painter.js';
export const toCanvas = live;
