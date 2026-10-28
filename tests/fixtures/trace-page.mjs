/*
H26.8's trace move (dev/design/components/NATIVE-SHAPES.md section 5; NS4, B422) -- ONE FRAME OF THE TRACE TEST, in real Chrome: the
page's canvas composed as the page composes it -- a Model on the page's network with the maintained relations, a Selection the renderer
reflects, the renderer drawing into the canvas's scene on the bare root, the network attached and drawing its pipes in its own layer --
and the real reveal, measuring a line by draw's probe, wired to the model as app/src/main.js wires it. tests/vector-scene-trace.test.js
drives two frames of it.

The reveal's clock is the frame's own time (`Date.now`), or frozen at an instant (`freeze`), for sampling. `today(id)` traces a line as
production did before the move -- an inline dash and offset, a layout forced, a transition armed -- the reference the declared trace is
compared with, written here from `ca492da`'s plugins/simulation/reveal-painter.mjs `show` onto the line's element.
*/
import { Renderer, openCanvasScene } from '../../app/src/renderer.js';
import { pathLengthOf, el } from '../../app/src/painter.js';
import { foreignStates } from '../../app/src/compose-canvas.js';
import { PRODUCT_CANVAS, CANVAS_SCENE } from '../../product/canvas.mjs';
import { COMPOSED_KINDS } from '../../product/types.mjs';
import { Reveal } from '../../plugins/simulation/reveal-painter.mjs';
import { traceOf } from '../../plugins/simulation/reveal.mjs';
import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';
import { Selection } from '../../app/src/selection.js';
import { createPageNetwork } from '../../plugins/network/page.mjs';

const svg = document.getElementById('container');
const clock = { frozen: null };
const scene = openCanvasScene(CANVAS_SCENE, svg);
const net = createPageNetwork();
const model = new Model({ kinds: COMPOSED_KINDS, attached: { network: net.network } });
attachRelations(model, { nearest: NODE_GRID.nearest });
const selection = new Selection(model);
const renderer = new Renderer(model, svg, { parts: PRODUCT_CANVAS, scene, foreign: foreignStates(scene) });
selection.subscribe(() => renderer.reflectSelection(selection.list()));
const host = net.attach({ model, renderer, selection, edit() {}, say() {}, el, pipeLayer: scene.layerElement('pipes') });
const reveal = new Reveal({ model, renderer, now: () => clock.frozen ?? Date.now(), onCaption() {}, lengthOf: pathLengthOf });
model.onChange(() => reveal.sync());   // as app/src/main.js wires it: every change wakes the reveal
const line = (id) => document.getElementById(id);
const watched = new Map();

window.side = {
	load(json) { model.load(JSON.parse(json)); return true; },
	freeze(t) { clock.frozen = t; return true; },
	thaw() { clock.frozen = null; return true; },
	now() { return reveal.now(); },
	op(name, a = {}) {
		switch (name) {
			case 'set': return void model.set(a.kind, a.id, a.patch);
			case 'put': return void model.put(a.kind, a.entity);
			case 'del': return void model.del(a.kind, a.id);
			case 'show': return void reveal.show(a.id);
			case 'hide': return void reveal.hide(a.id);
			case 'paint': return void reveal.paint();
			case 'trace': reveal.trace = a.cfg; return undefined;
			case 'record': model.state.reveal = a.record; return void reveal.sync();
			case 'mode': return void renderer.setMode(a.mode);
			case 'select': return void selection.set(a.ids);
			case 'state': return void renderer.setState(a.id, a.cls, a.on);
			case 'clear': return void renderer.clearState(a.id, ...a.classes);
			// the network's settle: every link redrawn, with no model change -- here after a node moved in the model's state unannounced
			case 'settle': { const n = model.get('node', a.id); Object.assign(n, a.patch); return void host.redraw(); }
			default: throw new Error(`no op ${name}`);
		}
	},
	// production's trace before the move, onto the line's element: the reference
	today(id, cfg = null) {
		const dom = line(id);
		const len = dom.getTotalLength();
		const { ms } = traceOf(cfg, len);
		dom.style.transition = 'none';
		dom.style.strokeDasharray = `${len}`;
		dom.style.strokeDashoffset = `${len}`;
		void dom.getBoundingClientRect();
		dom.style.transition = `stroke-dashoffset ${ms}ms ease-out`;
		dom.style.strokeDashoffset = '0';
		return { len, ms };
	},
	// every animation and transition on the page paused at `ms` into it -- a fraction of a trace, sampled -- or let run again
	seek(ms) { const all = document.getAnimations(); for (const a of all) { a.pause(); a.currentTime = ms; } return all.length; },
	play() { for (const a of document.getAnimations()) a.play(); return true; },
	read(id) {
		const dom = line(id);
		if (!dom) return null;
		const cs = getComputedStyle(dom), anims = dom.getAnimations();
		return { dash: cs.strokeDasharray, offset: cs.strokeDashoffset, trace: dom.getAttribute('data-trace'), style: dom.getAttribute('style'),
			unrevealed: dom.hasAttribute('data-unrevealed'), length: pathLengthOf(dom.getAttribute('d')),
			animations: anims.map((a) => ({ name: a.animationName ?? a.transitionProperty, time: a.currentTime })) };
	},
	// whether the reveal's loop runs, and the traces it holds
	loop() { return { running: !!reveal.loop, traces: reveal.traces.size }; },
	// the animation on a line, kept to be told apart later: the same object, or another
	keep(id) { window.__kept = line(id).getAnimations()[0] ?? null; return !!window.__kept; },
	same(id) { return line(id).getAnimations()[0] === window.__kept; },
	// each write to an element, counted from now: its attributes, by name
	watch(id) {
		const writes = [];
		const o = new MutationObserver((records) => { for (const r of records) writes.push(r.attributeName); });
		o.observe(line(id), { attributes: true });
		watched.set(id, { o, writes });
		return true;
	},
	writes(id) { const w = watched.get(id); w.o.takeRecords().forEach((r) => w.writes.push(r.attributeName)); return w.writes.slice(); },
	unwatch(id) { watched.get(id)?.o.disconnect(); watched.delete(id); return true; },
	lineOf(id) { const l = line(id); return l ? { class: l.getAttribute('class'), stroke: getComputedStyle(l).stroke } : null; },
	frame() { return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))); },
};
