/*
Render a stored diagram as a SELF-CONTAINED SVG document.

The kernel renderer's duty is to produce a complete SVG for a caller that is not the browser — an
agent, a script, `curl`, or a person clicking a download. It had no door: `kernel/adapt.mjs` and
`KERNEL_CSS` both existed for exactly this and nothing composed them, which is why an audit read
them as dead code (B28). The client renderer is NOT a duplicate of this one; it maintains live,
individually addressable elements for a person editing, which a string cannot do.

Self-contained is the whole requirement. A download has no page to inherit from, so the glyph
artwork and the styles travel inside the file, and every `href="#…"` must resolve within it.
*/
import { sharedDefs } from '../kernel/renderer.mjs';
import { renderScene } from '../kernel/svg-scene.mjs';
import { resolve } from '../kernel/engine.mjs';
import { docToSchema } from '../kernel/adapt.mjs';
import { KERNEL_CSS } from '../kernel/theme.mjs';
import { readModel, linesOf } from '../network/read-model.mjs';   // each link as the network draws it (R-c)

/*
A schema as an SVG string: the kernel's deterministic core (`resolve`) handed to its scene renderer. K2c moved this here
from the kernel's barrel, which defined it and which K2c deleted, because the export door is its only production caller
(H17-D4).
*/
export function render(schema, pad) {
	const { V, L, scene } = resolve(schema);
	return renderScene(scene, V, L, pad);
}

/*
R-c (H18.21) -- the download is what run mode shows (ruled H2, refined): each link along its route over pipes, a down link with
the canvas's down look (H1), and the waypoints in the run picture's layers (kernel/network-appearance.mjs RUN_PICTURE). The
routes are the network's, read through its read composition; the kernel is handed them as data.
*/
export function svgDocument(doc) {
	const body = render(docToSchema(doc, { lines: linesOf(readModel(doc)) }));
	// inject styles + defs immediately after the root tag, so the file stands alone
	const at = body.indexOf('>') + 1;
	return body.slice(0, at) + `\n<style>${KERNEL_CSS}</style>\n${sharedDefs()}\n` + body.slice(at);
}
