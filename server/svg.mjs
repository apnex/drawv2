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
import { render, sharedDefs, docToSchema } from '../kernel/index.mjs';
import { KERNEL_CSS } from '../kernel/theme.mjs';

export function svgDocument(doc) {
	const body = render(docToSchema(doc));
	// inject styles + defs immediately after the root tag, so the file stands alone
	const at = body.indexOf('>') + 1;
	return body.slice(0, at) + `\n<style>${KERNEL_CSS}</style>\n${sharedDefs()}\n` + body.slice(at);
}
