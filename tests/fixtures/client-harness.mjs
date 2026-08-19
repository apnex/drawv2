/*
The client harness — B23 / H2.1, and Stage 0 of H6.

Nothing in tests/ constructed any client class before this. `input.js` alone is 1,609 lines, 11
gesture modes and 23 of the app's 29 commit sites, all uncovered — which is why B14, B18 and B19
shipped. All three are the same shape: wiring that was designed, written, unit-tested in isolation
and never connected. `Changes.amend` exists and is tested; nothing calls it. `Sync.deferInbound` is
read; nothing assigns it. No unit test can see any of these, because every component passes alone.
Only something that constructs the ASSEMBLY catches them.

Why stubs and not jsdom or a browser: `input.js`'s entire global surface is four lines —
`document.getElementById('help')`, two `window.addEventListener`, one `window.dispatchEvent` — and
everything else is injected, with `readout`/`palette`/`dataview` already carrying null-object
defaults. Nine of the fifteen client modules touch no DOM at all. A dependency would buy fidelity
this arc has no assertion for, and the repo's stated property is one runtime dependency and no
build step.

── THE LOAD-BEARING CONSTRAINT ────────────────────────────────────────────────────────────────
Tests built on this harness assert at the COMMIT BOUNDARY and nowhere else.

`Changes.onCommit` is sovereign to how a gesture was produced (D4), so an assertion of the form
"this input emits these ops" survives H6's decomposition untouched — including H6.4, which rewrites
`onDown`/`onMove`/`onUp` entirely. An assertion on `input.mode` or `input.ctx` would break at H6.3,
and the net built to enable the refactor would become a tax on it: the harness would end up
ratifying the God Object it exists to remove. `tools/scan-writers.mjs` enforces this rather than
leaving it to memory.
──────────────────────────────────────────────────────────────────────────────────────────────
*/

import { Model } from '../../model/index.mjs';
import { attachRelations } from '../../engine/index.mjs';
import { cellOf } from '../../kernel/index.mjs';
import { Changes } from '../../app/src/changes.js';
import { Selection } from '../../app/src/selection.js';
import { crosshair } from '../../app/src/painter.js';
import { CANVAS, GAP } from '../../app/src/snap.js';
import { Input } from '../../app/src/input.js';

// ---- the smallest DOM the client's constructors actually touch ----

function fakeClassList() {
	const s = new Set();
	return {
		add: (...c) => c.forEach((x) => s.add(x)),
		remove: (...c) => c.forEach((x) => s.delete(x)),
		toggle: (c, on) => (on === undefined ? (s.has(c) ? s.delete(c) : s.add(c)) : on ? s.add(c) : s.delete(c)),
		contains: (c) => s.has(c),
	};
}

export function fakeEl(tag = 'div', id = '') {
	const el = {
		tagName: tag.toUpperCase(), id, hidden: true, children: [], dataset: {}, style: {},
		classList: fakeClassList(),
		attrs: {},
		setAttribute(k, v) { this.attrs[k] = String(v); },
		setAttributeNS(_ns, k, v) { this.attrs[k] = String(v); },
		getAttribute(k) { return this.attrs[k] ?? null; },
		removeAttribute(k) { delete this.attrs[k]; },
		appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
		removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
		// a real detach: setDatumMarker removes its marker and re-adds, so a no-op remove() would
		// leave every datum ever placed in the layer and the count assertions would be meaningless
		remove() { if (this.parentNode) this.parentNode.removeChild(this); },
		addEventListener() {},
		removeEventListener() {},
		closest() { return null; },
		querySelector(sel) { return this.byId?.[sel] ?? fakeEl('g', sel.replace('#', '')); },
		// a real class lookup over children. Returning [] made element REMOVAL untestable: code that
		// clears a layer by `querySelectorAll('.handle').forEach(h => h.remove())` silently cleared
		// nothing, so a "handles disappear" assertion could never fail.
		querySelectorAll(sel) {
			const cls = sel.startsWith('.') ? sel.slice(1) : null;
			if (!cls) return [];
			return this.children.filter((c) => (c.attrs.class || '').split(' ').includes(cls));
		},
		getBoundingClientRect() { return { left: 0, top: 0, width: 1920, height: 1080 }; },
		get ownerDocument() { return globalThis.document; },
		// SVG-only, and the reason a stub beats jsdom here: jsdom implements neither, so a jsdom
		// harness would need the same fiction with more machinery around it.
		getScreenCTM() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }; },
	};
	return el;
}

// Install just enough of `document` and `window` for a constructor to run. Returns a restore().
export function installDom() {
	const prevDoc = globalThis.document, prevWin = globalThis.window;
	const help = fakeEl('div', 'help');
	globalThis.document = {
		getElementById: (id) => (id === 'help' ? help : fakeEl('div', id)),
		createElement: (t) => fakeEl(t),
		createElementNS: (_ns, t) => fakeEl(t),
		body: fakeEl('body'),
		activeElement: null,
	};
	globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
	globalThis.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
	// painter.toCanvas builds a DOMPoint and applies the inverse screen CTM. With the identity CTM
	// above, canvas coordinates equal client coordinates — which is what lets a test say
	// `pointer(60, 60)` and mean the cell at (60, 60).
	globalThis.DOMPoint = class {
		constructor(x = 0, y = 0) { this.x = x; this.y = y; }
		matrixTransform(m) { return { x: this.x * m.a + this.y * m.c + m.e, y: this.x * m.b + this.y * m.d + m.f }; }
	};
	return () => {
		globalThis.document = prevDoc; globalThis.window = prevWin;
	};
}

// ---- the assembly under test ----

/*
A real Model, a real Changes, a real Selection, a real Input. The collaborators that only DRAW are
stubbed, because nothing here asserts on drawing — `renderer` and `labels` are recorded so a test
can show a gesture did not, say, open the label editor, without asserting on pixels.
*/
export function makeInput({ readOnly = false, bare = false, host: hostOverride = null } = {}) {
	const restore = installDom();

	const model = new Model();
	attachRelations(model, { cellOf });
	const history = new Changes(model);
	const selection = new Selection(model);

	const calls = [];
	const rec = (name) => (...args) => { calls.push({ name, args }); };
	const renderer = { mode: 'view', setMode: rec('renderer.setMode'), setState: rec('renderer.setState'), clearState: rec('renderer.clearState') };
	const labels = { isOpen: () => false, open: rec('labels.open'), openContent: rec('labels.openContent'), close: rec('labels.close') };
	// Recording collaborators. Asserting that a gesture did or did not REACH one of these is still a
	// boundary assertion — it is the contract between Input and its peer, not Input's internal state.
	const readout = { setCursor: rec('readout.setCursor'), setDrag: rec('readout.setDrag'), setBox: rec('readout.setBox'),
		setLink: rec('readout.setLink'), setDatum: rec('readout.setDatum'), clearTransient: rec('readout.clearTransient'),
		render: rec('readout.render'), flash: rec('readout.flash'), dims: () => '', signed: () => '' };
	const palette = { hand: null, setHand: rec('palette.setHand'), toggleHand: rec('palette.toggleHand'),
		trackHand: rec('palette.trackHand'), hideHand: rec('palette.hideHand') };
	const dataview = { toggle: rec('dataview.toggle') };

	const svg = fakeEl('svg', 'canvas');
	svg.byId = { '#overlay': fakeEl('g', 'overlay'), '#snaplayer': fakeEl('g', 'snaplayer') };

	/*
	B45 — the host surface and the help element are INJECTED, not reached for. Input used to take
	`window` and `#help` from globals, which meant this harness could only supply them by installing
	fakes on globalThis. It still installs a DOM (painter.js needs one to build elements), but Input's
	own collaborators now arrive through its constructor like every other one.

	`host` records dispatched events rather than swallowing them: the previous stub's `dispatchEvent`
	was a no-op returning true, so the W5 `draw:action` handoff could only be observed by a test that
	monkey-patched globalThis mid-run. That is now the harness's job.
	*/
	const dispatched = [];
	const host = hostOverride || {
		addEventListener() {}, removeEventListener() {},
		dispatchEvent(e) { dispatched.push(e); return true; },
	};
	const help = fakeEl('div', 'help');
	// B36 — the single crosshair main.js owns, injected here the same way. Sharing it is the point:
	// two instances on one layer is the defect, so the harness must not quietly create a second.
	const snap = crosshair(svg.byId['#snaplayer'], CANVAS, GAP);

	// the commit boundary — the ONLY surface these tests assert on
	const commits = [];
	history.onCommit((request) => commits.push(request));

	// `bare` omits the optional collaborators entirely, exercising Input's own null-object defaults.
	const input = bare
		? new Input({ svg, model, history, selection, renderer, labels, host, help, snap })
		: new Input({ svg, model, history, selection, renderer, labels, readout, palette, dataview, host, help, snap });
	if (readOnly) input.setReadOnly(true);

	return {
		input, model, history, selection, svg, commits, calls, restore, renderer, labels, palette, help, snap,
		// events Input handed to the host (W5 `draw:action`) — an outbound boundary, so a fair assertion
		dispatched,
		// the transient-feedback layers, so a test can ask "what is drawn right now" without
		// reaching into Input. H6 moves this code into overlay.js; these accessors do not move.
		layers: svg.byId,
		drawn: (layer, cls) => (svg.byId[layer]?.children ?? []).filter((c) => (c.attrs.class || '').split(' ').includes(cls)),
		stateCalls: (name) => calls.filter((c) => c.name === name).map((c) => c.args),
		called: (name) => calls.some((c) => c.name === name),
		// the ops of the single change a gesture produced; throws loudly on 0 or 2+, because a
		// gesture emitting two changes is the defect (B14's coalescing) as often as none is.
		soleCommit() {
			if (commits.length !== 1) throw new Error(`expected exactly 1 commit, got ${commits.length}`);
			return commits[0];
		},
		opsOf(i = 0) { return commits[i]?.ops ?? []; },
		reset() { commits.length = 0; calls.length = 0; dispatched.length = 0; },
	};
}

// ---- synthetic events: methods are called directly, so these are plain shapes ----

export const key = (k, mod = {}) => ({
	key: k, code: k, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
	target: { tagName: 'BODY' }, preventDefault() {}, stopPropagation() {}, ...mod,
});

export const pointer = (x, y, mod = {}) => ({
	clientX: x, clientY: y, button: 0, buttons: 1,
	shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
	target: { tagName: 'svg', closest: () => null }, pointerId: 1,
	preventDefault() {}, stopPropagation() {}, ...mod,
});

// ---- document builders (the model is real; these just seed it) ----

export function seedNodes(model, specs) {
	return specs.map(([x, y, type = 'host']) => {
		const n = model.makeNode(type, { x, y });
		model.put('node', n);
		return n;
	});
}
