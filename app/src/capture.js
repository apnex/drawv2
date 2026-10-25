/*
capture.js -- L0 of the gesture system (dev/design/input/GESTURE-SYSTEM.md, section 5.1): draw's adapter over `@apnex/input-capture`
(dev/design/components/INPUT-CAPTURE.md section 5, H26-8). The component listens on the canvas and the window, reads each platform
event into one frozen fact, and does what a fact's reply asks; this module is draw's side of that boundary, and the only one that
names the component (D9).

WHAT DRAW SUPPLIES, each draw's content or policy:

	surface     the canvas element, `#container`
	keys        the host, the page's `window`
	toDrawing   where a screen point lies in the drawing: the canvas's scene's (H26.4, app/src/renderer.js `openCanvasScene`), through the root's screen
	            transform read at each event, the arithmetic `toCanvas` did
	hit         what is under the pointer: `on`, by the parts' picks (pick.js `hitWith`), and on a press `region`, run mode's controls
	            under it -- the waypoint, a `data-action` or `data-input` region and its node, whether any entity is there; null when
	            the target cannot be asked, which is itself an answer: run mode places nothing then. Null on a `leave`
	focus       on a key-down alone: a key typed into a field (the header's inputs, the label editor), which canvas shortcuts never
	            see; otherwise whether focus is on a button, link, field or tabbable element, where Tab must keep its meaning
	deliver     the round trip: each fact made into draw's INPUT EVENT, handed to the input layers, and in a `finally` the reply asked
	            to claim the event (`claimed`, preventDefault) and to take the pointer (`capture`), as the input layers wrote
	listen      `blur` alone (H26.5, dev/design/components/RELEASES-0.2.md section 4): the host's focus loss, after which no release of
	            a key held is promised to arrive, handed to Input's `blur` (B413). Neither the wheel, which waits for pan and zoom
	            (H26.6), nor the context menu, which draw's own listener on the host covers beyond the surface (B75)

AN INPUT EVENT is today's, field for field and in today's key order (section 5, G7): `type`; `button`, `0` for a key; `key`; `repeat`,
`false` for a pointer; the modifiers; on a pointer `at` and `on`; on a press `region`; on a key-down `onControl`; `claimed` and `capture`
false, which the input layers write and this acts on. `trigger` is the input layers' own field, and never read here.
AMENDED H26.5 (dev/design/components/RELEASES-0.2.md section 4, RD18): and on a pointer, after `on`, the fact's `pointerId` -- the
event's when a safe integer, else null -- for input-binding, which tells another pointer's move and release apart by it from 0.2.0;
input-binding 0.1.0 reads none of it, and no code of draw's reads it (tests/input-capture.test.js G1 holds app/src/input.js to that).
RESTATED at H26.5's input-binding move: draw is on input-binding 0.2.0, whose session reads it, and Input acts on what the session makes
of it (`otherPointer`), still reading no `pointerId` of its own.

WHAT NEVER REACHES THE INPUT LAYERS. Keys typed into a field: canvas shortcuts do not apply there. The context menu: suppressed
everywhere but a field, which is the browser's question, not a gesture's (B75) -- draw's own listener, on the host, after the keys,
since the component makes no menu fact (D5, B412).

KEPT, registered (section 6.3): one press for every pointer -- draw's event carries no `pointerId`, so a second pointer replaces the
first's press (B409). RESTATED at H26.5: the event carries it now, and B409 holds until draw is on input-binding 0.2.0, which reads it
(RD18) -- and then narrowed, a second pointer's press still replacing the first's, as it is since H26.5's input-binding move. And a key
released while the page lacks focus still makes no key-up, but the focus loss before it is now heard and handed to Input's `blur`,
which clears what Shift, Alt and Control left (B413, RELEASES-0.2.md section 4).
*/
import { openCapture } from '@apnex/input-capture';
import { hitWith } from './pick.js';

const FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const CONTROL = 'button, a[href], select, input, textarea, [tabindex]';
const askable = (t) => !!t && typeof t.closest === 'function';

// the run-mode controls under a press, from the target -- null when the target cannot be asked. C-f: by the parts' selectors
// (app/src/pick.js `regionsOf`) -- what they draw, and what a run press aims at
function regionOf(target, { drawn = '', target: aim = '' } = {}) {
	if (!askable(target)) return null;
	const t = aim ? target.closest(aim) : null;
	const c = target.closest('[data-action],[data-input]');
	const owner = c && drawn && typeof c.closest === 'function' ? c.closest(drawn) : null;   // the drawn item a control sits in
	const data = (c && c.dataset) || {};   // read defensively: an element without a dataset carries no control
	return {
		target: t ? t.id : null,
		overTarget: !!t,   // an element answered, id or not -- run mode places nothing over one
		action: data.action ? data.action : null,
		input: c && !data.action && data.input !== undefined ? Number(data.idx) : null,
		owner: owner ? owner.id : null,
		control: !!c,
		entity: drawn ? !!target.closest(drawn) : false,   // on something a part draws
	};
}

// a key typed into a field: canvas shortcuts never apply there
const typing = (target) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(target && target.tagName);

// the input layers' method for each fact; `over` and `out` are `hover`, entering or not. H26.5: `blur`, the host's focus loss (B413)
const ROUTE = { down: 'press', move: 'move', up: 'release', cancel: 'cancelDrag', double: 'double', 'key-down': 'keyDown', 'key-up': 'keyUp', blur: 'blur' };

// draw's input event from one fact -- today's form, field for field and in today's key order; H26.5: a pointer's `pointerId` (RD18)
function inputEventOf(event) {
	const pointer = event.at !== null;
	return {
		type: event.type,
		button: pointer ? event.button : 0, key: event.key, repeat: pointer ? false : event.repeat,
		shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey,
		...(pointer ? { at: event.at, on: event.hit.on, pointerId: event.pointerId } : {}),
		...(event.type === 'down' ? { region: event.hit.region } : {}),
		...(event.type === 'key-down' ? { onControl: event.focus.onControl } : {}),
		claimed: false, capture: false,
	};
}

/*
The canvas's capture, opened once a root's own listeners are in (app/src/compose-canvas.js `listen`). `sink` is the input layers' side
-- Input -- and receives only input events. C-b: `picks`, the canvas parts' (pick.js `picksOf`); C-f: `regions`, their run-mode
selectors (pick.js `regionsOf`); H26.4: `scene`, the canvas's (app/src/renderer.js `openCanvasScene`), whose `toDrawing` converts each
point. Answers a frozen `{ close }`, closing the component's capture and the menu's listener, which nothing in draw calls today; a
declaration the component refuses throws here, before any listener is added.
*/
export function captureCanvas({ svg, scene, host, sink, picks = [], regions = {} }) {
	const hitOf = hitWith(picks);
	const opened = openCapture({
		surface: svg,
		keys: host,
		toDrawing: (screen) => scene.toDrawing(screen),   // H26.4 (VECTOR-SCENE.md section 5.1): the scene's; H26.8 hands it whole
		hit: (target, event) => (event.type === 'leave' ? null : {
			on: hitOf({ target, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey }),
			region: event.type === 'down' ? regionOf(target, regions) : null,
		}),
		// the field test first, and the control test only on a key not typed into a field, as the old capture dropped the key first
		focus: (target, event) => {
			if (event.type !== 'key-down') return null;
			return typing(target) ? { typing: true, onControl: false } : { typing: false, onControl: askable(target) && !!target.closest(CONTROL) };
		},
		// H26.5 (RELEASES-0.2.md section 4): the focus loss alone; its fact is of neither family, every field null and its modifiers
		// false, and is asked neither `hit` nor `focus` (input-capture's IC5), so its input event has a key-up's form, `key` and `repeat` null
		listen: ['blur'],
		deliver: (event, reply) => {
			if (event.type === 'leave') return sink.leave();
			if (event.type === 'key-down' && event.focus.typing) return;
			const e = inputEventOf(event);
			try {
				if (event.type === 'over' || event.type === 'out') sink.hover(e, event.type === 'over');
				else sink[ROUTE[event.type]](e);
			} finally {
				// what the input layers asked before a throw is done, as it was
				if (e.claimed) reply.claim();
				if (e.capture) reply.takePointer();   // answers false when the platform refuses the pointer, as for a synthetic event
			}
		},
	});
	if (!opened.ok) throw new Error(`capture: input-capture refused the canvas -- ${opened.problems.map((p) => `${p.problem} at ${p.pointer || '""'}`).join(', ')}`);
	/*
	B75 -- suppress the browser menu everywhere EXCEPT a real affordance: cut, copy, paste and the spell-checker in a text field. The
	test is the target's nearest form field rather than a list of ids, so a field added later is covered; `contenteditable` is matched
	explicitly, since bare presence also matches `contenteditable="false"`. On the HOST, not the canvas: the right button is a gesture
	button here, so a hand is already on it when the pointer crosses onto the palette or the header.
	*/
	const menu = (evt) => { if (!(askable(evt.target) && evt.target.closest(FIELD))) evt.preventDefault(); };
	/*
	H26.3's verification (V4): a host refusing the menu's listener -- which no browser does -- leaves nothing listening, as the component
	holds its own opening (IC3, lifecycle rule 3): the menu's listener removed, harmless if it was never added, the capture closed, each
	attempted past an error, and the host's error thrown, unchanged.
	*/
	try {
		host.addEventListener('contextmenu', menu);
	} catch (refused) {
		try { host.removeEventListener('contextmenu', menu); } catch { /* attempted; the host's error is the one thrown */ }
		try { opened.capture.close(); } catch { /* likewise */ }
		throw refused;
	}
	let closed = false;
	return Object.freeze({
		// closes the component's capture and removes the menu's listener, attempting both and throwing the first error, once
		close() {
			if (closed) return undefined;
			closed = true;
			const errors = [];
			try { opened.capture.close(); } catch (e) { errors.push(e); }
			try { host.removeEventListener('contextmenu', menu); } catch (e) { errors.push(e); }
			if (errors.length) throw errors[0];
			return undefined;
		},
	});
}

// an event handed OUT to the host -- run mode's `draw:action` (W5). The platform's event API, kept here beside the boundary
export function emitToHost(host, type, detail) {
	host.dispatchEvent(new CustomEvent(type, { detail }));
}
