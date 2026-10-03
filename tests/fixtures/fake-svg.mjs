/*
A FAKE SVG LAYER for painters tested without a browser: `el(tag, attrs, parent)` as app/src/painter.js has it, making
nodes that keep their attributes and children, answer `setAttribute` and `remove`, and can be listed back. Enough for the
network's pipe painter (network/host.mjs), which keeps one element per pipe and updates it in place.
*/
export function fakeLayer() {
	const make = (tag, attrs = {}, parent = null) => {
		const node = { tag, attrs: { ...attrs }, children: [], parent: null,
			setAttribute(k, v) { this.attrs[k] = v; },
			getAttribute(k) { return this.attrs[k]; },
			remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; },
			appendChild(c) { c.parent = this; this.children.push(c); } };
		if (parent) parent.appendChild(node);
		return node;
	};
	const root = make('g');
	const all = (n = root) => n.children.flatMap((c) => [c, ...all(c)]);
	return { root, el: make, all, made: () => all().length };
}
