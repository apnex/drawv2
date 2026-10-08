/*
THE NETWORK'S CANVAS PART -- what the network brings to the page (C-a, H19.29; dev/design/unification/CANVAS-PLUGINS.md): its
link painter (network/link-painter.mjs) and its appearances on the anchor (network/anchor-appearance.mjs). Composed by the
product (product/canvas.mjs) with the other plugins' parts.
*/

import { LINK_PAINTERS } from './link-painter.mjs';
import { NETWORK_APPEARANCES } from './anchor-appearance.mjs';

export const NETWORK_CANVAS = { owner: 'network', painters: LINK_PAINTERS, appearances: NETWORK_APPEARANCES };
