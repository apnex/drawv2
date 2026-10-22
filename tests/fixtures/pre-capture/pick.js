// H26.3: the one name tests/fixtures/pre-capture/capture.js, kept verbatim, imports from './pick.js' -- app/src/pick.js's, unchanged;
// bound here rather than re-exported, since no module of this tree is a barrel (tools/layers.mjs L4)
import { hitWith as live } from '../../../app/src/pick.js';
export const hitWith = live;
