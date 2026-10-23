/*
H26.4 (dev/design/components/VECTOR-SCENE.md acceptance step 5, D12, section 6.2) -- ONE FRAME OF THE TRACE TEST, in real Chrome:
today's renderer on the page's markup (`?which=old`, the copy kept verbatim at tests/fixtures/pre-scene/app/src/), or the adapter on a
scene opened on the bare root with the page's measure and settle (`?which=new`), each with the real reveal, unchanged. The same
operations on both, read back as the layers' trees and which elements were kept, and as the trace's computed values at sampled times.
tests/vector-scene-trace.test.js puts two frames side by side and drives them.
*/
import { Renderer as OldRenderer } from './pre-scene/app/src/renderer.js';
import { Renderer as NewRenderer, openCanvasScene } from './scene-adapter/renderer.js';
import { pathLengthOf, settleOf } from './scene-adapter/platform.js';
import { CANVAS_SCENE } from './scene-adapter/canvas-scene.mjs';
import { PRODUCT_CANVAS, CANVAS_LAYERS } from '../../product/canvas.mjs';
import { COMPOSED_KINDS, readModel } from '../../product/types.mjs';
import { Reveal } from '../../plugins/simulation/reveal-painter.mjs';

const which = new URL(import.meta.url).searchParams.get('which');
const svg = document.getElementById('container');
let model = null, renderer = null, reveal = null, scene = null;
const seen = new WeakMap();
let serial = 0, before = [];
const walk = (n, out = []) => { for (const c of n.children) { out.push(c); walk(c, out); } return out; };
/*
The style attribute compared as the CSSOM reads it back: its text is the shadow's own serialization (section 6.2), its declarations
today's. And held apart from the other attributes, its place among them given on its own: Chrome writes an inline style set through
the CSSOM into the attribute lazily, making the attribute when it is first read, so on today's side it stands wherever that read finds
the others -- after an attribute added since the style was set -- where the shadow, which must put it at once for the trace to start,
puts it when it is set. Nothing draws or reads by an attribute's place; tests/vector-scene-trace.test.js tells the two apart.
*/
const ser = (n) => {
	const attrs = [...n.attributes];
	const at = attrs.findIndex((a) => a.name === 'style');
	return { tag: n.tagName, attrs: attrs.filter((a) => a.name !== 'style').map((a) => [a.name, a.value]), ...(at < 0 ? {} : { style: n.style.cssText, styleAt: at }),
		text: n.children.length ? '' : n.textContent, children: [...n.children].map(ser) };
};
const withoutStyleAt = (key, value) => (key === 'styleAt' ? undefined : value);
const layersOf = () => CANVAS_LAYERS.map((id) => document.getElementById(id));

window.side = {
	load(json) {
		if (scene) scene.close();
		if (which === 'old') for (const g of layersOf()) g.replaceChildren();
		model = readModel(JSON.parse(json), COMPOSED_KINDS);
		if (which === 'old') renderer = new OldRenderer(model, svg, { parts: PRODUCT_CANVAS });
		else {
			scene = openCanvasScene(CANVAS_SCENE, svg);
			renderer = new NewRenderer(model, svg, { parts: PRODUCT_CANVAS, scene, platform: { lengthOf: pathLengthOf, settle: settleOf(svg) } });
		}
		reveal = new Reveal({ model, renderer, now: () => 0, onCaption() {} });
		renderer.syncAll();
		before = [];
		return true;
	},
	// one operation, named as the test names them
	op(name, a = {}) {
		switch (name) {
			case 'set': return void model.set(a.kind, a.id, a.patch);
			case 'put': return void model.put(a.kind, a.entity);
			case 'show': return void reveal.show(a.id);
			case 'hide': return void reveal.hide(a.id);
			case 'trace': reveal.trace = a.cfg; return undefined;
			default: throw new Error(`no op ${name}`);
		}
	},
	// the layers' trees, and which elements were kept -- each at its former index -- and which made afresh since the last snapshot
	snapshot() {
		const els = layersOf().flatMap((g) => walk(g));
		const was = new Map(before.map((s, i) => [s, i]));
		const identity = els.map((e) => { if (!seen.has(e)) { seen.set(e, ++serial); return 'new'; } return was.has(seen.get(e)) ? was.get(seen.get(e)) : 'moved-in'; });
		before = els.map((e) => seen.get(e));
		const tree = layersOf().map(ser);
		return { exact: JSON.stringify({ tree, identity }), apart: JSON.stringify({ tree, identity }, withoutStyleAt) };
	},
	length(id) { const el = document.getElementById(id); return el && typeof el.getTotalLength === 'function' ? el.getTotalLength() : null; },
	attribute(id, name) { return document.getElementById(id)?.getAttribute(name) ?? null; },
	finish() { for (const an of document.getAnimations()) an.finish(); return true; },
	// every animation of this document paused and set to `t` ms from its start; then what is computed and inline for the element
	sample(id, t) {
		for (const an of document.getAnimations()) { an.pause(); an.currentTime = t; }
		const el = document.getElementById(id), cs = getComputedStyle(el);
		return { dasharray: cs.strokeDasharray, dashoffset: cs.strokeDashoffset, opacity: cs.opacity, visibility: cs.visibility,
			inline: { dasharray: el.style.strokeDasharray, dashoffset: el.style.strokeDashoffset, transition: el.style.transition },
			animations: document.getAnimations().length };
	},
	frame() { return new Promise((r) => setTimeout(() => r(true), 40)); },   // a hidden frame has no animation frames
};
