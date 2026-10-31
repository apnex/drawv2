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
	hit         what is under the pointer, by the parts' picks (pick.js `hitWith`) -- `{ kind, id, handle?, mark? }` -- and its
	            `region`: on a press, run mode's controls under it -- the waypoint, a `data-action` or `data-input` region and its node,
	            whether any entity is there (pick.js `regionWith`) -- else null. Both read the item the scene made the target for, never
	            the target's ancestors (H26.8's picks move, NATIVE-SHAPES.md section 3.2). Null on a `leave`
	focus       on a key-down alone: a key typed into a field (the header's inputs, the label editor), which canvas shortcuts never
	            see; otherwise whether focus is on a button, link, field or tabbable element, where Tab must keep its meaning
	deliver     the round trip: each fact handed to the input layers WHOLE, with its reply -- `sink[method](fact, reply)` -- which they
	            ask at once to claim the event (preventDefault) and to take the pointer (input-capture's IC8)
	listen      `blur` alone (H26.5, dev/design/components/RELEASES-0.2.md section 4): the host's focus loss, after which no release of
	            a key held is promised to arrive, handed to Input's `blur` (B413). Neither the wheel, which waits for pan and zoom
	            (H26.6), nor the context menu, which draw's own listener on the host covers beyond the surface (B75)

H26.8's capture move (dev/design/components/NATIVE-SHAPES.md section 3.2, Facts; GR5) -- THE FACT ITSELF. Until this move each fact was
made here into draw's own INPUT EVENT, a mutable copy in the old capture's form, with `on`, `region` and `onControl` lifted out of `hit`
and `focus`, and `claimed` and `capture` written back by the input layers for a `finally` to act on (T1). Input takes input-capture's
fact now, frozen and never written -- `fact.hit` where it read `on`, `fact.hit.region` where it read `region`, `fact.focus.onControl`
where it read `onControl` -- and its reply, asked at once; the release's `trigger` is the gesture session's outcome, handed to a
gesture's commit. The fact carries a pointer's `pointerId`, which input-binding's session reads (RD18) and no code of draw's does
(tests/input-capture.test.js G1 holds app/src/input.js to that).

WHAT NEVER REACHES THE INPUT LAYERS. Keys typed into a field: canvas shortcuts do not apply there. The context menu: suppressed
everywhere but a field, which is the browser's question, not a gesture's (B75) -- draw's own listener, on the host, after the keys,
since the component makes no menu fact (D5, B412).

KEPT, registered (section 6.3): one press for every pointer -- draw's event carried no `pointerId`, so a second pointer replaced the
first's press (B409). RESTATED at H26.5: the fact carries it, and B409 held until draw was on input-binding 0.2.0, which reads it
(RD18) -- and then narrowed, a second pointer's press still replacing the first's, as it is since H26.5's input-binding move. And a key
released while the page lacks focus still makes no key-up, but the focus loss before it is now heard and handed to Input's `blur`,
which clears what Shift, Alt and Control left (B413, RELEASES-0.2.md section 4).
*/
import { openCapture } from '@apnex/input-capture';
import { hitWith, regionWith } from './pick.js';

const FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const CONTROL = 'button, a[href], select, input, textarea, [tabindex]';
const askable = (t) => !!t && typeof t.closest === 'function';

/*
H26.8's picks move (NATIVE-SHAPES.md sections 3.2 and 4.7): the run-mode controls under a press were read here from the target by the
parts' selectors (`regionOf`), and what it landed on by picks walking up from it; both are app/src/pick.js's now, by the item the scene
made the target for. The target reaches only `hit`, `focus` and the menu (GR8).
*/

// a key typed into a field: canvas shortcuts never apply there
const typing = (target) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(target && target.tagName);

// the input layers' method for each fact; `over` and `out` are `hover`, which reads which from the fact's type. H26.5: `blur`, the
// host's focus loss (B413)
const ROUTE = { down: 'press', move: 'move', up: 'release', cancel: 'cancelDrag', over: 'hover', out: 'hover', leave: 'leave', double: 'double',
	'key-down': 'keyDown', 'key-up': 'keyUp', blur: 'blur' };

/*
The canvas's capture, opened once a root's own listeners are in (app/src/compose-canvas.js `listen`). `sink` is the input layers' side
-- Input -- and receives each fact whole, with its reply. C-b: `picks`, the canvas parts' (pick.js `picksOf`); H26.4: `scene`, the canvas's
(app/src/renderer.js `openCanvasScene`), whose `toDrawing` converts each point; H26.8's picks move: and `drawerOf`, the renderer's, which
names the drawer of each item the scene made -- what a pick and a run region are read from (pick.js `hitWith`, `regionWith`). Answers a frozen `{ close }`, closing the component's capture and the menu's listener, which nothing in draw calls today; a
declaration the component refuses throws here, before any listener is added.
*/
export function captureCanvas({ svg, scene, host, sink, picks = [], drawerOf = () => null }) {
	const hitOf = hitWith(picks, { scene, drawerOf }), regionOf = regionWith({ scene, drawerOf });
	const opened = openCapture({
		surface: svg,
		keys: host,
		toDrawing: (screen) => scene.toDrawing(screen),   // H26.4 (VECTOR-SCENE.md section 5.1): the scene's; H26.8 hands it whole
		// H26.8's capture move: what the press is on, and its region on a press -- the one answer the fact carries (section 3.2, Facts)
		hit: (target, event) => (event.type === 'leave' ? null : {
			...hitOf({ target, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey }),
			region: event.type === 'down' ? regionOf(target) : null,
		}),
		// the field test first, and the control test only on a key not typed into a field, as the old capture dropped the key first
		focus: (target, event) => {
			if (event.type !== 'key-down') return null;
			return typing(target) ? { typing: true, onControl: false } : { typing: false, onControl: askable(target) && !!target.closest(CONTROL) };
		},
		// H26.5 (RELEASES-0.2.md section 4): the focus loss alone; its fact is of neither family, every field null and its modifiers
		// false, and is asked neither `hit` nor `focus` (input-capture's IC5), so `hit`, `focus`, `key` and `repeat` are null
		listen: ['blur'],
		// H26.8's capture move: the fact and its reply handed whole (GR5); what the input layers ask of the reply is done at once (IC8), so
		// what they asked before a throw is done, as it was
		deliver: (event, reply) => {
			if (event.type === 'key-down' && event.focus.typing) return;
			sink[ROUTE[event.type]](event, reply);   // the fact itself, `event` as every fact is named here
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
