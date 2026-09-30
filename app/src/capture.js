/*
capture.js -- L0 of the gesture system: the only code that touches a browser event
(dev/design/input/GESTURE-SYSTEM.md, section 5.1; stage 1).

ONE CONCERN: turn DOM events into INPUT EVENTS -- plain data -- and hand them to the input layers; then do, on the
event, what those layers asked for and could not do themselves, because they never see it: claim it
(`preventDefault`) and capture the pointer. It decides nothing. No mode, no read-only, no meaning.

AN INPUT EVENT keeps the DOM's own names for what a gesture reads -- `button`, `key`, `repeat`, `shiftKey`, `ctrlKey`,
`altKey`, `metaKey` -- so the gesture handlers read it as they read an event. What it adds is what used to take the DOM
to work out:

	at        the pointer in canvas coordinates (painter.js `toCanvas`)
	on        what is under it: node, waypoint, zone (Shift only), link, a handle, or canvas (pick.js `hitOf`)
	region    on a press only: the run-mode controls under the pointer -- the waypoint, a `data-action` or `data-input`
	          region and its node, and whether any entity is there. Null when the target cannot be asked, which is
	          itself an answer: run mode places nothing then, exactly as before
	onControl on a key only: focus is in a button, link, field or tabbable element, where Tab must keep its meaning

and what the input layers set, for capture to act on:

	claimed   the event is ours: capture calls `preventDefault`
	capture   the press began a gesture: capture takes the pointer, so the drag keeps its events off the canvas

WHAT NEVER REACHES THE INPUT LAYERS. Keys typed into a field (the header's inputs, the label editor): canvas shortcuts
do not apply there. The context menu: suppressed everywhere but a field, which is the browser's question, not a
gesture's (B75).
*/
import { hitOf } from './pick.js';
import { toCanvas } from './painter.js';

const FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const CONTROL = 'button, a[href], select, input, textarea, [tabindex]';
const askable = (t) => !!t && typeof t.closest === 'function';

// the run-mode controls under a press, from the target -- null when the target cannot be asked
function regionOf(target) {
	if (!askable(target)) return null;
	const wp = target.closest('.waypoint');
	const c = target.closest('[data-action],[data-input]');
	const node = c && typeof c.closest === 'function' ? c.closest('.node') : null;
	const data = (c && c.dataset) || {};   // read defensively: an element without a dataset carries no control
	return {
		waypoint: wp ? wp.id : null,
		overWaypoint: !!wp,   // an element answered, id or not -- run mode places nothing over one
		action: data.action ? data.action : null,
		input: c && !data.action && data.input !== undefined ? Number(data.idx) : null,
		node: node ? node.id : null,
		control: !!c,
		entity: !!target.closest('.node,.zone,.link,.group'),
	};
}

// one DOM event as an input event -- plain data, and the only place a DOM event is read
function inputEvent(evt, svg, type) {
	const pointer = type !== 'key-down' && type !== 'key-up';
	return {
		type,
		button: evt.button ?? 0, key: evt.key ?? null, repeat: !!evt.repeat,   // null, never undefined: plain data survives JSON
		shiftKey: !!evt.shiftKey, ctrlKey: !!evt.ctrlKey, altKey: !!evt.altKey, metaKey: !!evt.metaKey,
		...(pointer ? { at: toCanvas(evt, svg), on: hitOf(evt) } : {}),
		...(type === 'down' ? { region: regionOf(evt.target) } : {}),
		...(type === 'key-down' ? { onControl: askable(evt.target) && !!evt.target.closest(CONTROL) } : {}),
		claimed: false, capture: false,
	};
}

// a key typed into a field: canvas shortcuts never apply there
const typing = (evt) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(evt.target && evt.target.tagName);

/*
The listeners, and the round trip: convert, hand over, then act on what came back. `sink` is the input layers' side --
Input today -- and receives only input events.
*/
export class Capture {
	constructor({ svg, host, sink }) {
		this.svg = svg; this.sink = sink;
		svg.addEventListener('pointerleave', () => sink.leave());
		svg.addEventListener('pointerdown', (e) => this.onDown(e));
		svg.addEventListener('pointermove', (e) => this.onMove(e));
		svg.addEventListener('pointerup', (e) => this.onUp(e));
		svg.addEventListener('pointercancel', (e) => this.onCancel(e));
		svg.addEventListener('pointerover', (e) => this.onHover(e, true));
		svg.addEventListener('pointerout', (e) => this.onHover(e, false));
		svg.addEventListener('dblclick', (e) => this.onDblClick(e));
		host.addEventListener('keydown', (e) => this.onKeyDown(e));
		host.addEventListener('keyup', (e) => this.onKeyUp(e));
		// B75: on the HOST, not the svg -- the right button is a gesture button here, so a hand is already on it when the
		// pointer crosses onto the palette or the header, and bound to the canvas alone the native menu opened there
		host.addEventListener('contextmenu', (e) => this.onContextMenu(e));
	}

	// hand one event over, then claim it and take the pointer if the input layers said to
	#round(evt, type, deliver) {
		const e = inputEvent(evt, this.svg, type);
		try { deliver(e); } finally {
			if (e.claimed) evt.preventDefault();
			if (e.capture) { try { this.svg.setPointerCapture(evt.pointerId); } catch { /* synthetic events */ } }
		}
	}

	onDown(evt) { this.#round(evt, 'down', (e) => this.sink.press(e)); }
	onMove(evt) { this.#round(evt, 'move', (e) => this.sink.move(e)); }
	onUp(evt) { this.#round(evt, 'up', (e) => this.sink.release(e)); }
	onCancel(evt) { this.#round(evt, 'cancel', (e) => this.sink.cancelDrag(e)); }
	onHover(evt, entering) { this.#round(evt, entering ? 'over' : 'out', (e) => this.sink.hover(e, entering)); }
	onDblClick(evt) { this.#round(evt, 'double', (e) => this.sink.double(e)); }
	onKeyDown(evt) { if (!typing(evt)) this.#round(evt, 'key-down', (e) => this.sink.keyDown(e)); }
	onKeyUp(evt) { this.#round(evt, 'key-up', (e) => this.sink.keyUp(e)); }

	/*
	B75 -- suppress the browser menu everywhere EXCEPT a real affordance: cut, copy, paste and the spell-checker in a text
	field. The test is the target's nearest form field rather than a list of ids, so a field added later is covered.
	`contenteditable` is matched explicitly, since bare presence also matches `contenteditable="false"`.
	*/
	onContextMenu(evt) {
		if (!(askable(evt.target) && evt.target.closest(FIELD))) evt.preventDefault();
	}
}

// an event handed OUT to the host -- run mode's `draw:action` (W5). The DOM event API, kept here with the rest of it
export function emitToHost(host, type, detail) {
	host.dispatchEvent(new CustomEvent(type, { detail }));
}
