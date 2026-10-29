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
everything else is injected, with `readout`/`tools`/`dataview` already carrying null-object
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

import { Model } from '../../model/model.mjs';
import { attachRelations } from '../../engine/store.mjs';
import { NODE_GRID } from '../../kernel/geometry.mjs';   // H26.1: the relation index is injected the node grid's nearest (it was cellOf)
import { Changes, applyAnswer } from '../../app/src/changes.js';
import { plan } from '../../planner/txn.mjs';
import { LabelEditor } from '../../app/src/labeledit.js';
import { Tools } from '../../app/src/tools.js';
import { Selection } from '../../app/src/selection.js';
import { EditingStates } from '../../app/src/editing-states.js';   // H26.8: the editing states, Input's and its overlay's (a:F12)
import { crosshair } from '../../app/src/editing-visuals.js';   // H26.4: the editing part's, an item of the scene
import { openCanvasScene } from '../../app/src/renderer.js';
import { CANVAS_SCENE } from '../../product/canvas.mjs';
import { CANVAS, GAP } from '../../app/src/snap.js';
import { Input } from '../../app/src/input.js';
import { RUN_PRESSES } from '../../app/src/run-mode.js';
import { captureCanvas } from '../../app/src/capture.js';
import { picksOf, regionsOf } from '../../app/src/pick.js';
import { PRODUCT_CANVAS } from '../../product/canvas.mjs';
import { networkInput } from '../../plugins/network/keys.mjs';
import { createNetworkSession } from '../../plugins/network/session.mjs';
import { productKinds } from '../../product/kinds.mjs';
import { NETWORK_ROWS } from '../../plugins/network/kinds.mjs';
import { makeNode } from '../../plugins/devices/make-node.mjs';   // O-e1: the devices plugin's factories
const PAGE_KINDS = productKinds(...NETWORK_ROWS);

// ---- the smallest DOM the client's constructors actually touch ----

/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1, "The test harness") -- THE PLATFORM'S SEMANTICS WHERE DRAW'S DRAWING CODE
COULD TELL. A fake element's class list and its `class` attribute are one state, the list a DOMTokenList over the attribute (a token
removed that is absent writes nothing, an add rewrites the set); `appendChild` detaches a child it moves, as `insertBefore` already
did; `textContent` replaces the children; `dataset` reads and writes the `data-` attributes. None of this changed what any test
measured while the renderer and the overlay wrote through these fakes: the class list was a set of its own, so a class the renderer
toggled never reached the attribute and a class written as an attribute never reached the list, and a moved child stayed in two
parents -- which no test met. vector-scene writes through `setAttribute` and reads nothing back, so the harness must answer as a
browser does (INPUT-CAPTURE.md section 10.1 found the same of `insertBefore`).
*/
const tokensOf = (value) => [...new Set(String(value ?? '').split(/[\t\n\f\r ]+/).filter(Boolean))];
const dataName = (key) => `data-${String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const dataKey = (name) => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function fakeClassList(el) {
	// the DOMTokenList update steps: nothing written when the element has no class attribute and the set is empty
	const write = (list) => { if (!Object.hasOwn(el.attrs, 'class') && !list.length) return; el.setAttribute('class', list.join(' ')); };
	return {
		add: (...cs) => { const list = tokensOf(el.attrs.class); for (const c of cs) if (!list.includes(c)) list.push(c); write(list); },
		remove: (...cs) => write(tokensOf(el.attrs.class).filter((c) => !cs.includes(c))),
		toggle: (c, force) => {
			const list = tokensOf(el.attrs.class);
			if (list.includes(c)) { if (force === undefined || force === false) { write(list.filter((x) => x !== c)); return false; } return true; }
			if (force === undefined || force === true) { list.push(c); write(list); return true; }
			return false;
		},
		contains: (c) => tokensOf(el.attrs.class).includes(c),
	};
}
function fakeDataset(el) {
	const names = () => Object.keys(el.attrs).filter((k) => k.startsWith('data-'));
	return new Proxy({}, {
		get: (_, k) => (typeof k === 'string' ? el.attrs[dataName(k)] : undefined),
		set: (_, k, v) => { el.setAttribute(dataName(k), v); return true; },
		has: (_, k) => typeof k === 'string' && Object.hasOwn(el.attrs, dataName(k)),
		deleteProperty: (_, k) => { el.removeAttribute(dataName(k)); return true; },
		ownKeys: () => names().map(dataKey),
		getOwnPropertyDescriptor: (_, k) => (typeof k === 'string' && Object.hasOwn(el.attrs, dataName(k)) ? { value: el.attrs[dataName(k)], writable: true, enumerable: true, configurable: true } : undefined),
	});
}

export function fakeEl(tag = 'div', id = '') {
	const el = {
		tagName: tag.toUpperCase(), id, hidden: true, children: [], style: {},
		attrs: {},
		_text: '',
		setAttribute(k, v) {
			this.attrs[k] = String(v);
			// B121: an id makes an element findable. The renderer reconciles by
			// `document.getElementById(id)` and REPLACES what it finds, so a document that cannot
			// find anything makes every re-render append a duplicate -- which looked like a
			// renderer leak until the stub was the thing at fault.
			if (k === 'id' && globalThis.__domIds) globalThis.__domIds.set(String(v), this);
		},
		// the painter sets every attribute through setAttributeNS, so the id registry has to be
		// here too -- registering only in setAttribute meant nothing was ever findable
		setAttributeNS(_ns, k, v) { this.setAttribute(k, v); },
		getAttribute(k) { return this.attrs[k] ?? null; },
		hasAttribute(k) { return Object.hasOwn(this.attrs, k); },
		removeAttribute(k) { delete this.attrs[k]; },
		// H26.4: a child appended is detached from where it stood first, as a browser moves it
		appendChild(c) { return this.insertBefore(c, null); },
		// F-d: the renderer stacks an item among its layer's (app/src/renderer.js `place`); `ref` null appends
		insertBefore(c, ref) {
			if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c);
			c.parentNode = this;
			const at = ref ? this.children.indexOf(ref) : -1;
			if (at < 0) this.children.push(c); else this.children.splice(at, 0, c);
			return c;
		},
		removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
		// WD-b2: the grids clear a layer before redrawing it (app/src/grids.js)
		replaceChildren(...nodes) { for (const c of this.children) c.parentNode = null; this.children = []; for (const c of nodes) this.appendChild(c); },
		// H26.4: the text an element holds, its children's when it has children; written, it replaces them
		get textContent() { return this.children.length ? this.children.map((c) => c.textContent ?? '').join('') : this._text; },
		set textContent(v) { for (const c of this.children) c.parentNode = null; this.children = []; this._text = v == null ? '' : String(v); },
		// a real detach: setDatumMarker removes its marker and re-adds, so a no-op remove() would
		// leave every datum ever placed in the layer and the count assertions would be meaningless
		remove() {
			if (this.parentNode) this.parentNode.removeChild(this);
			if (globalThis.__domIds && this.attrs.id) globalThis.__domIds.delete(this.attrs.id);
		},
		addEventListener() {},
		removeEventListener() {},
		// H26.3 (INPUT-CAPTURE.md section 5): a browser refuses to take a synthetic pointer, and so does this, as the old capture swallowed
		// the fakes' missing method; input-capture's reply answers false
		setPointerCapture() { throw new Error('setPointerCapture: no active pointer -- a synthetic event'); },
		closest() { return null; },
		/*
		H15.9 -- a real DESCENDANT lookup for the selectors the renderer uses (`.cls`, `[attr="v"]`, a tag), before the
		old fallback of a fresh detached element. Returning a detached element made every `update` write into nothing in
		this harness, so a test comparing an update with a fresh render could only report differences that are not there.
		*/
		querySelector(sel) {
			if (this.byId?.[sel]) return this.byId[sel];
			const cls = sel.match(/^\.([\w-]+)$/)?.[1], attr = sel.match(/^\[([\w-]+)="([^"]*)"\]$/), tag = /^[a-z]+$/i.test(sel) ? sel.toUpperCase() : null;
			const hit = (n) => (cls ? (n.attrs?.class || '').split(' ').includes(cls) : attr ? n.attrs?.[attr[1]] === attr[2] : tag ? n.tagName === tag : false);
			const walk = (n) => { for (const c of n.children || []) { if (hit(c)) return c; const d = walk(c); if (d) return d; } return null; };
			return ((cls || attr || tag) && walk(this)) || fakeEl('g', sel.replace('#', ''));
		},
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
	el.classList = fakeClassList(el);   // H26.4: one state with the class attribute
	el.dataset = fakeDataset(el);       // H26.4: the data- attributes
	return el;
}

// Install just enough of `document` and `window` for a constructor to run. Returns a restore().
export function installDom() {
	const prevDoc = globalThis.document, prevWin = globalThis.window;
	const help = fakeEl('div', 'help');
	const ids = new Map();
	globalThis.__domIds = ids;
	globalThis.document = {
		// a real registry, not a fresh stub per call: see setAttribute above
		getElementById: (id) => (id === 'help' ? help : (ids.get(id) || null)),
		createElement: (t) => fakeEl(t),
		createElementNS: (_ns, t) => fakeEl(t),
		body: fakeEl('body'),
		activeElement: null,
	};
	globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
	globalThis.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
	// painter.toCanvas builds a DOMPoint and applies the inverse screen CTM. With the identity CTM
	// above, canvas coordinates equal client coordinates — which is what lets a test say
	// `pointer(60, 60)` and mean the cell at (60, 60). RESTATED at H26.4: the scene's toDrawing computes the same over the same
	// transform; the DOMPoint stays for the verbatim painter's toCanvas, which the old capture converts by (H26.3's side-by-side)
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
// runRules: run mode's rows, the product page's by default; the lab composes none (lab/src/root.js), which H26.2's side-by-side asks for
export function makeInput({ readOnly = false, bare = false, host: hostOverride = null, routeHook = null, plugins = null, parts = PRODUCT_CANVAS, runRules = RUN_PRESSES } = {}) {   // parts: the canvas parts, the page's by default (C-d)
	const restore = installDom();

	// the kinds the product page composes (S-b, G1), and its network: a Model holding links draws with one (V-e, J2) -- the
	// network SESSION's, as the page's is (plugins/network/page.mjs), so the real drag judge below judges on the network the Model draws with
	const session = createNetworkSession();
	const pageNetwork = session.network;
	const model = new Model({ kinds: PAGE_KINDS, attached: { network: pageNetwork }});
	attachRelations(model, { nearest: NODE_GRID.nearest });
	const selection = new Selection(model);
	// V-d (H18.28; PL-6): the commit boundary previews with the planner, composed as the product page composes it
	const tenant = pageNetwork.links;
	const history = new Changes(model, { preview: (m, ops) => plan(m, ops, { links: tenant, kinds: PAGE_KINDS }), apply: (ops) => applyAnswer(model, selection, ops) });

	const calls = [];
	const rec = (name) => (...args) => { calls.push({ name, args }); };
	const renderer = { mode: 'view', setMode: rec('renderer.setMode'),
		toggleLabels: rec('renderer.toggleLabels') };   // Tab calls it; a stub must be total (the gesture corpus found the gap)
	/*
	H26.8 (dev/design/components/NATIVE-SHAPES.md section 3.2, appendix A, a:F12) -- THE EDITING STATES, real, their calls recorded by
	forwarding spies: Input and its overlay hold the hover, the arming, the idle ring and a link end's drag state in
	app/src/editing-states.js, which the renderer stub recorded as `renderer.setState` and `renderer.clearState` until the move; each call
	is recorded as `states.setState` and `states.clearState` with the same arguments, and reaches the real states, so a test may ask
	both what was called and what is held.
	*/
	const held = new EditingStates({ model, parts });
	const states = { setState: (...args) => { calls.push({ name: 'states.setState', args }); held.setState(...args); },
		clearState: (...args) => { calls.push({ name: 'states.clearState', args }); held.clearState(...args); },
		reflect: (ids) => held.reflect(ids), classesOf: (id) => held.classesOf(id), onChange: (fn) => held.onChange(fn) };
	// A stub must be TOTAL or it is a trap — the same lesson Input's own readout null-object records.
	// `focusId` moved here at H6.12, so the stub tracks it for real rather than swallowing the call:
	// a test can then assert F2 picked the directly-touched entity, which was unassertable before.
	const labels = {
		focusId: null,
		isOpen: () => false,
		open: rec('labels.open'),
		openContent: rec('labels.openContent'),
		close: rec('labels.close'),
		// BORROWED, not reimplemented. Writing the rule out a second time here made the H6.12 tests
		// exercise this file instead of the product — they passed happily against a labeledit.js
		// whose logic had been broken on purpose. The stub supplies the state (`focusId`) and the
		// sink (`open`); the DECISION stays the real one, so breaking it fails these tests.
		setFocus: LabelEditor.prototype.setFocus,
		openFocused: LabelEditor.prototype.openFocused,
		// borrowed too: they find the element and call `openContent`, which is recorded -- so a lookup that finds nothing
		// records nothing, exactly as the product opens nothing
		openFrame: LabelEditor.prototype.openFrame,
		openRegion: LabelEditor.prototype.openRegion,
	};
	// Recording collaborators. Asserting that a gesture did or did not REACH one of these is still a
	// boundary assertion — it is the contract between Input and its peer, not Input's internal state.
	const readout = { setCursor: rec('readout.setCursor'), setDrag: rec('readout.setDrag'), setBox: rec('readout.setBox'),
		setLink: rec('readout.setLink'), setDatum: rec('readout.setDatum'), clearTransient: rec('readout.clearTransient'),
		render: rec('readout.render'), flash: rec('readout.flash'), dims: () => '', signed: () => '' };
	// The held-tool state is REAL here, not recorded-and-swallowed: B42 was precisely a tool surviving a lock -- so a stub
	// that forgets it cannot catch the regression it exists for. `holding` and `releaseTools` borrow the real ones (the
	// tools, app/src/tools.js, since K7) for the same reason H6.12's labels stub does: a reimplementation would let the
	// product break silently.
	const tools = {
		hand: null, textTool: false, readOnly: false,
		setHand(type) { this.hand = type || null; calls.push({ name: 'tools.setHand', args: [type] }); },
		toggleHand: rec('tools.toggleHand'),
		trackHand: rec('tools.trackHand'),
		hideHand: rec('tools.hideHand'),
		setTextTool(on) { this.textTool = !!on; calls.push({ name: 'tools.setTextTool', args: [!!on] }); },
		holding: Tools.prototype.holding,
		releaseTools: Tools.prototype.releaseTools,
	};
	const dataview = { toggle: rec('dataview.toggle') };

	// H26.4 (VECTOR-SCENE.md section 5.1): the canvas's scene, opened over the fake root as the page opens it, and its layers found
	const { svg, scene } = sceneOver(fakeEl('svg', 'canvas'));

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
	const snap = crosshair(scene, CANVAS, GAP);

	// the commit boundary — the ONLY surface these tests assert on
	const commits = [];
	history.onCommit((request) => commits.push(request));

	// `bare` omits the optional collaborators entirely, exercising Input's own null-object defaults.
	let input;
	try {
		input = bare
			? new Input({ svg, scene, model, history, selection, renderer, states, labels, host, help, snap, parts })   // places are composition, not a collaborator (C-c)
			// run mode's rows as the production root hands them in (K5); `bare` omits them as it omits every collaborator
			: new Input({ svg, scene, model, history, selection, renderer, states, labels, readout, tools, dataview, host, help, snap, runRules,
				/*
				P7 X-a (H18.37) -- THE PRODUCT PAGE'S INPUT, as app/src/main.js composes it since V-b: the network's keys and its REAL
				drag judge (plugins/network/session.mjs `judge`, what plugins/network/page.mjs attaches), judging on the board the tab holds. Before
				X-a this harness composed the network only when a test passed a stub judge, so every other test -- and 69 of the
				gesture corpus's 75 scenarios -- ran the page as it was before P5, with no g and no x.
				`routeHook` stays: a STUB judge, for tests of the plugin seam itself; `plugins`, a composition given whole.
				*/
				plugins: plugins ?? [networkInput(routeHook ?? ((drag) => session.judge(drag, model.all('link'), model).verdict), session)],
				parts });   // C-c: the placed kinds, as the page composes them
	} catch (e) { restore(); throw e; }   // a refused composition must not leave the stub DOM installed
	if (readOnly) input.setReadOnly(true);
	// L0: tests drive the page's events through capture, as a browser does -- Input itself takes only input events
	const opened = { svg, scene, host, sink: input, picks: picksOf(parts), regions: regionsOf(parts) };   // C-b: the plugins' picks; C-f: run mode's regions, as the page composes them
	// H26.3 (INPUT-CAPTURE.md section 5): through the listeners input-capture and the adapter add, as the page's events arrive. RESTATED at
	// H26.5 (RELEASES-0.2.md section 4): the parity hook, which drove the old capture beside it when DRAW_CAPTURE_PARITY was set, is retired
	const capture = captureDispatch(opened);

	return {
		input, capture, model, history, selection, svg, scene, commits, calls, restore, renderer, states, labels, tools, help, snap,
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

/*
H26.3 (dev/design/components/INPUT-CAPTURE.md section 5) -- THE PAGE'S EVENTS THROUGH THE LISTENERS A CAPTURE ADDED. `dispatchFor(open)`
answers a function of `{ svg, host, sink, picks, regions }` that makes the fakes it is handed record each listener added to them while
`open` runs -- the component's eight on the surface and two on the host, and the adapter's menu -- calls `open` with them, and answers
the nine methods tests drive the canvas by, each calling the listener added for its event, as a browser calls it. An object's own
`addEventListener` is kept and still called, so a test's host sees what it always saw; nothing else of a fake is touched.
RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md section 4): and the host's `blur`, which draw lists, so three on the host and a
tenth method, `onBlur`, which calls nothing when no blur listener was added -- a focus loss the platform fires though nothing hears it.
*/
export function dispatchFor(open) {
	return ({ svg, scene, host, sink, picks = [], regions = {} }) => {   // H26.4: and the canvas's scene, whose toDrawing converts
		const listeners = new Map();
		let opening = false;
		for (const [fake, tag] of [[svg, 'svg'], [host, 'host']]) {
			const given = fake.addEventListener;
			if (typeof given !== 'function') continue;
			fake.addEventListener = function (name, listener) {
				if (opening) listeners.set(`${tag}:${name}`, listener);
				return Reflect.apply(given, this, [name, listener]);
			};
		}
		opening = true;
		try { open({ svg, scene, host, sink, picks, regions }); } finally { opening = false; }
		const call = (key) => (evt) => listeners.get(key)(evt);
		return {
			onDown: call('svg:pointerdown'), onMove: call('svg:pointermove'), onUp: call('svg:pointerup'), onCancel: call('svg:pointercancel'),
			onHover: (evt, entering) => listeners.get(entering ? 'svg:pointerover' : 'svg:pointerout')(evt),
			onDblClick: call('svg:dblclick'), onKeyDown: call('host:keydown'), onKeyUp: call('host:keyup'), onContextMenu: call('host:contextmenu'),
			// H26.5 (dev/design/components/RELEASES-0.2.md section 4): the host's focus loss -- the platform fires it whether or not anything
			// listens, so a capture that added no blur listener hears nothing of it, as draw heard nothing before input-capture 0.2.0 (B413)
			onBlur: (evt) => listeners.get('host:blur')?.(evt),
		};
	};
}
// the page's canvas through draw's adapter (app/src/capture.js `captureCanvas`): `makeInput` hands it as `h.capture`
export const captureDispatch = (opened) => dispatchFor(captureCanvas)(opened);

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
		const n = makeNode(model, type, { x, y });
		model.put('node', n);
		return n;
	});
}

/*
B121 -- a Renderer, in a harness.

Nothing in the suite could construct one, so every rule `app/src/renderer.js` owns was verified by
eye or not at all. That is also why the W4 socket rule diverged: the kernel expresses the same
visual rules and IS tested, so only one of the two was ever held to it -- B107's shape in a
different substrate.

The layers are real elements rather than the `querySelector` fallback, because the renderer looks
them up by id at construction and then appends into them; a fresh stub per lookup would silently
throw every node away.
*/
export function makeRenderer() {
	const restore = installDom();
	const { svg, scene } = sceneOver(fakeEl('svg', 'canvas'));   // H26.4: the renderer draws into the scene, handed it
	return { svg, scene, restore };
}

/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1, "The test harness") -- THE CANVAS'S SCENE OVER A FAKE ROOT, as the page opens
it over its own (app/src/compose-canvas.js): the composition's declaration, the layers appended to the root, each then found by its id,
so `svg.querySelector('#nodes')` and the harness's `layers` answer the layer the scene made. Needs the stub DOM installed.
*/
export function sceneOver(svg) {
	const scene = openCanvasScene(CANVAS_SCENE, svg);
	svg.byId = Object.fromEntries(svg.children.map((layer) => [`#${layer.attrs.id}`, layer]));
	return { svg, scene };
}

/*
Every class in a subtree, which the stub's own querySelectorAll cannot give.

That one matches direct children only, and several existing tests count on exactly that -- widening
it would change what they measure. This walks instead, so a parity check can ask what the renderer
actually emitted without disturbing anything that already relies on the narrow behaviour.
*/
export function classesIn(node) {
	const out = [];
	const walk = (n) => {
		const cls = (n.attrs?.class || '').split(' ').filter(Boolean);
		out.push(...cls);
		(n.children || []).forEach(walk);
	};
	walk(node);
	return out;
}
