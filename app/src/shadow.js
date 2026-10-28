/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1, D8, D12) -- THE LIVE SHADOW, draw's translation onto vector-scene, retired by
H26.8 when each painter describes its item to the scene directly.

Draw's painters, appearances, reveal and towers keep the element-shaped objects they handle today: each is a shadow node of this
module's, built by the kit's `el` and `setAttrs` into a fragment the renderer holds for one entity, and every change to one marks that
entity, which the renderer puts to the scene -- at the end of its call, or at once for a change made outside one. It is the export's
headless node (server/svg.mjs before H26.4), moved here and given the platform's semantics wherever draw's drawing code could tell:
  tagName          SVG's case, the tag as written
  classList        a DOMTokenList over the `class` attribute: a token removed that is absent writes nothing, an add rewrites the set
  dataset          the `data-` attributes, read and written
  style            each declaration written into the `style` attribute, in the order first written -- the old trace's; since H26.8
                   the reveal writes the attribute whole, and no painter writes this, which goes with the shadow
  textContent      the text, or the children's; written, it replaces the children
  isConnected      while the node stands in the fragment of an entity the renderer draws -- the towers' cached glyph
A write that changes nothing marks nothing, so the reveal's hide, on every tick, puts nothing. It reaches no global and names no plugin's
kind.
RESTATED at H26.8's trace move (NATIVE-SHAPES.md section 5): the platform's measure and settle -- `getTotalLength` and
`getBoundingClientRect`, which the page handed in so the old trace could measure its line and force a layout -- are gone: the reveal
measures a line's `d` with draw's probe itself, and its trace is declared, needing no layout forced.
*/

const tokensOf = (value) => [...new Set(String(value ?? '').split(/[\t\n\f\r ]+/).filter(Boolean))];
const dataName = (key) => `data-${String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const cssName = (key) => String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
// the declarations of a `style` attribute, in order: property -> value
const declarationsOf = (text) => {
	const out = new Map();
	for (const part of String(text ?? '').split(';')) { const at = part.indexOf(':'); if (at > 0) out.set(part.slice(0, at).trim(), part.slice(at + 1).trim()); }
	return out;
};
// the selectors draw's drawing code asks of its own nodes: a class, an attribute's value, an id, a tag
const matcherOf = (sel) => {
	const id = sel.match(/^#([\w-]+)$/)?.[1], cls = sel.match(/^\.([\w-]+)$/)?.[1], attr = sel.match(/^\[([\w-]+)="([^"]*)"\]$/), tag = /^[a-z]+$/i.test(sel) ? sel : null;
	if (!id && !cls && !attr && !tag) throw new Error(`shadow: no selector ${sel} -- a class, an attribute's value, an id or a tag`);
	return (n) => (id ? n.attrs.id === id : cls ? tokensOf(n.attrs.class).includes(cls) : attr ? n.attrs[attr[1]] === attr[2] : n.tag === tag);
};
const walk = (n, hit, one, out = []) => {
	for (const c of n.children) {
		if (hit(c)) { out.push(c); if (one) return out; }
		walk(c, hit, one, out);
		if (one && out.length) return out;
	}
	return out;
};

/*
`onDirty(owner)`: a node of `owner`'s fragment changed. Answers `make(tag, attrs, parent)`, a shadow node, and `fragment(owner)`, the
parent an entity's painter draws into, holding the entity's top-level nodes.
*/
export function shadowKit({ onDirty }) {
	const enter = (n, frag) => { n.frag = frag; for (const c of n.children) enter(c, frag); };
	const touch = (n) => { const owner = n?.frag?.owner; if (owner) onDirty(owner); };
	const make = (tag, attrs = {}, parent = null) => {
		const node = {
			tag, tagName: tag, attrs: {}, children: [], parentNode: null, text: '', frag: null,
			classList: {
				add(...cs) { const list = tokensOf(node.attrs.class); for (const c of cs) if (!list.includes(c)) list.push(c); writeClass(list); },
				remove(...cs) { writeClass(tokensOf(node.attrs.class).filter((c) => !cs.includes(c))); },
				toggle(c, force) {
					const list = tokensOf(node.attrs.class);
					if (list.includes(c)) { if (force === undefined || force === false) { writeClass(list.filter((x) => x !== c)); return false; } return true; }
					if (force === undefined || force === true) { list.push(c); writeClass(list); return true; }
					return false;
				},
				contains(c) { return tokensOf(node.attrs.class).includes(c); },
			},
			get dataset() {
				return new Proxy({}, {
					get: (_, k) => (typeof k === 'string' ? node.attrs[dataName(k)] : undefined),
					set: (_, k, v) => { node.setAttribute(dataName(k), v); return true; },
				});
			},
			get style() {
				return new Proxy({}, {
					get: (_, k) => (typeof k === 'string' ? declarationsOf(node.attrs.style).get(cssName(k)) ?? '' : undefined),
					set: (_, k, v) => {
						const d = declarationsOf(node.attrs.style), name = cssName(k);
						if (v === '' || v === null || v === undefined) d.delete(name); else d.set(name, String(v));
						node.setAttribute('style', [...d].map(([p, x]) => `${p}: ${x};`).join(' '));
						return true;
					},
				});
			},
			get isConnected() { return !!node.frag && node !== node.frag && !!node.frag.owner?.live; },
			get firstElementChild() { return node.children[0] ?? null; },
			get textContent() { return node.children.length ? node.children.map((c) => c.textContent).join('') : node.text; },
			set textContent(v) {
				const text = v == null ? '' : String(v);
				if (!node.children.length && node.text === text) return;
				for (const c of node.children) { c.parentNode = null; enter(c, null); }
				node.children = []; node.text = text;
				touch(node);
			},
			setAttribute(k, v) {
				const value = String(v);
				if (node.attrs[k] === value) return;   // a write that changes nothing marks nothing
				node.attrs[k] = value;
				touch(node);
			},
			setAttributeNS(_ns, k, v) { node.setAttribute(k, v); },
			getAttribute(k) { return Object.hasOwn(node.attrs, k) ? node.attrs[k] : null; },
			hasAttribute(k) { return Object.hasOwn(node.attrs, k); },
			removeAttribute(k) { if (!Object.hasOwn(node.attrs, k)) return; delete node.attrs[k]; touch(node); },
			appendChild(c) { return node.insertBefore(c, null); },
			insertBefore(c, ref) {
				if (c.parentNode) { const was = c.parentNode; was.children = was.children.filter((x) => x !== c); touch(was); }
				c.parentNode = node;
				enter(c, node.frag);
				const at = ref ? node.children.indexOf(ref) : -1;
				if (at < 0) node.children.push(c); else node.children.splice(at, 0, c);
				node.text = '';
				touch(node);
				return c;
			},
			remove() {
				const was = node.parentNode;
				if (!was) return;
				was.children = was.children.filter((x) => x !== node);
				node.parentNode = null;
				touch(was);
				enter(node, null);
			},
			querySelector(sel) { return walk(node, matcherOf(sel), true)[0] ?? null; },
			querySelectorAll(sel) { return walk(node, matcherOf(sel), false); },
		};
		const writeClass = (list) => { if (!Object.hasOwn(node.attrs, 'class') && !list.length) return; node.setAttribute('class', list.join(' ')); };
		for (const [k, v] of Object.entries(attrs)) node.attrs[k] = String(v);
		if (parent) parent.appendChild(node);
		return node;
	};
	const fragment = (owner) => { const f = make('#fragment'); f.frag = f; f.owner = owner; return f; };
	return { make, fragment };
}

// shadow nodes as the scene's shapes: `{ tag, attrs }`, then `children` when a node has children, or `text` when it has text (VS5)
export function describe(nodes) {
	return nodes.map((n) => {
		const shape = { tag: n.tag, attrs: { ...n.attrs } };
		if (n.children.length) shape.children = describe(n.children);
		else if (n.text !== '') shape.text = n.text;
		return shape;
	});
}
