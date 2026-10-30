/*
H26.2 (dev/design/components/INPUT-BINDING.md section 4, acceptance step 4; section 6) -- DRAW'S GESTURE LIFECYCLE AND ITS HELP, AS THE
CODE BEFORE THE MOVE ONTO INPUT-BINDING RAN AND WROTE THEM. The fixture of tests/input-binding-parity.test.js.

  the lifecycle  over every scenario of the gesture corpus, which gesture body ran for each input and which gesture was live after
                 it, recorded from the code before the move in binding-parity-lifecycle.json and replayed on every gate since
  the help       the help overlay's sections on the product page's composition and the lab's, recorded in binding-parity-help.json

RESTATED at H26.8's binding move (dev/design/components/NATIVE-SHAPES.md sections 4.2 and 4.3, NS10; appendix A): it keeps the
lifecycle and the help alone. The two comparisons that ran the old code beside the new -- the matcher, every table answered through
the old matcher and the adapter, and the press, the old press and the session's over generated streams -- went with that code,
tests/fixtures/pre-binding/, and the press's record, binding-parity-press.json: draw composes its tables in input-binding's own form
now, and the adapter they compared with is retired. The two records are the move's guard (section 4.1), each byte-identical.
*/
import { makeInput, pointer, GROUND } from './client-harness.mjs';
import { makeNode } from '../../plugins/devices/make-node.mjs';
import { record } from './gesture-corpus.mjs';
import { Input, GESTURES } from '../../app/src/input.js';

export const READ_AT = '8793699';   // the last commit holding draw's matcher, press and lifecycle whole: where the lifecycle record was read

// the product page's Input and the lab's, as the harness composes them: the lab is the page with no run mode (lab/src/root.js)
export const COMPOSITIONS = [['page', {}], ['lab', { runRules: [] }]];
export function withInput(opts, fn) {
	const h = makeInput(opts);
	try { return fn(h); } finally { h.restore(); }
}

// a key event as capture makes one (app/src/capture.js `inputEventOf`): the one liveGesture hands Input
const keyEvent = (type, key, m, repeat = false) => ({ type, button: 0, key, repeat, shiftKey: !!m.shiftKey, ctrlKey: !!m.ctrlKey, altKey: !!m.altKey, metaKey: !!m.metaKey,
	...(type === 'key-down' ? { onControl: false } : {}), claimed: false, capture: false });

// ---- the lifecycle ----

// which gesture is live: the name Input hands its key rows as the situation's gesture, read off one key no row binds
export function liveGesture(h) {
	let seen;
	const real = Input.prototype.situation;
	Input.prototype.situation = function (targetId, gesture) { seen = gesture ?? null; return real.call(this, targetId, gesture); };
	try { h.input.keyDown(keyEvent('key-down', '\u0000', {})); } finally { Input.prototype.situation = real; }
	return seen;
}
// every gesture body, and each of Input's methods that starts a chain or becomes a gesture, logged as it runs
function spied(log) {
	const undo = [];
	for (const [name, slot] of Object.entries(GESTURES)) for (const phase of ['start', 'update', 'commit', 'cancel']) {
		const f = slot[phase];
		if (typeof f !== 'function') continue;
		slot[phase] = function (...a) { log.push(`${name}.${phase}`); return f.apply(this, a); };
		undo.push(() => { slot[phase] = f; });
	}
	for (const m of ['chainFrom', 'startMove', 'startClone']) {
		const f = Input.prototype[m];
		Input.prototype[m] = function (...a) { log.push(m); return f.apply(this, a); };
		undo.push(() => { Input.prototype[m] = f; });
	}
	return () => undo.reverse().forEach((u) => u());
}
// a scenario's lifecycle: for each step, the bodies that ran and the gesture live after it, `ran>live`
export function lifecycleOf(scenario) {
	const log = [], steps = [];
	const restore = spied(log);
	try { record(scenario, { afterStep: (h) => { steps.push(`${log.splice(0).join(',')}>${liveGesture(h) ?? '-'}`); } }); } finally { restore(); }
	return steps;
}

/*
H26.5 (dev/design/components/RELEASES-0.2.md section 4, GR7; RD14, RD18) -- THE CHORD AND TWO-POINTER SEQUENCES, LISTED APART.

input-binding 0.2.0 changes a lifecycle in two kinds of sequence, both outside the corpus, whose facts name one pointer and whose
releases name the button that began the press: a chord, whose last release names another button (B427), and two pointers, whose
moves and releases the facts' `pointerId` tells apart (RD18). Each is driven through the product's Input on three devices, n0, n1 and
n2, and recorded as the corpus's lifecycles are -- for each input, the bodies that ran and the gesture live after it -- with both
answers: `before` read from the code with input-binding 0.1.0 installed, at the commit before the move; `after` what 0.2.0 makes of
it. A step is [type, x, y, device or null, the event's own fields].
*/
const T = { pointerId: 2, pointerType: 'touch' }, M = { pointerId: 1, pointerType: 'mouse' };
export const LISTED_APART = [
	{ id: 'chord-link-left-released-first', kind: 'chord', why: 'B427: the release names 2, the press began with 0, the link declares 0',
		steps: [['down', 0, 0, 0, { button: 0, buttons: 1 }], ['move', 120, 0, 0, { button: -1, buttons: 1 }], ['move', 360, 0, 1, { button: 2, buttons: 3 }],
			['move', 360, 0, 1, { button: 0, buttons: 2 }], ['up', 360, 0, 1, { button: 2, buttons: 0 }]],
		before: ['link.start>link', 'link.update>link', 'link.update>link', 'link.update>link', '>link'],
		after: ['link.start>link', 'link.update>link', 'link.update>link', 'link.update>link', 'link.commit>-'] },
	{ id: 'two-pointer-link-mouse-released', kind: 'two-pointer', why: 'o:F4: a touch opens a link; the mouse, pressed beyond the canvas, moves and is released over it',
		steps: [['down', 0, 0, 0, T], ['move', 120, 120, 0, T], ['move', 360, 0, 1, M], ['up', 360, 0, 1, { ...M, buttons: 0 }], ['move', 0, 360, 2, T], ['up', 0, 360, 2, { ...T, buttons: 0 }]],
		before: ['link.start>link', 'link.update>link', 'link.update>link', 'link.commit>-', '>-', '>-'],
		after: ['link.start>link', 'link.update>link', '>link', '>link', 'link.update>link', 'link.commit>-'] },
	{ id: 'two-pointer-move-touch-lifted', kind: 'two-pointer', why: 'a right drag moves n0; a touch begun beyond the canvas moves and lifts over it -- the move gesture declares no button',
		steps: [['down', 0, 0, 0, { ...M, button: 2, buttons: 2 }], ['move', 120, 0, 0, { ...M, button: -1, buttons: 2 }], ['move', 360, 360, null, T], ['up', 360, 360, null, { ...T, buttons: 0 }],
			['move', 240, 0, 0, { ...M, button: -1, buttons: 2 }], ['up', 240, 0, 0, { ...M, button: 2, buttons: 0 }]],
		before: ['pending.start>pending', 'pending.update,startMove>move', 'move.update>move', 'move.commit>-', '>-', '>-'],
		after: ['pending.start>pending', 'pending.update,startMove>move', '>move', '>move', 'move.update>move', 'move.commit>-'] },
];
/*
And one scenario of the corpus itself: `link-right-button-release-ignored` presses the left button on n0, drags to n1, and releases
the right button before the left -- a release naming 2 while the press that began with 0 is held. A browser sends no such pointerup
unless the left was released first, as a move: it is B427's chord without its moves. Under 0.1.0 that release committed nothing and the
left's committed the link; under 0.2.0 the right's commits it, a step earlier -- the same link, so the corpus's record, which keeps what
a scenario ends with, is byte-identical (GR6), and its lifecycle, which keeps each step, is listed apart here: `before` is the record's.
*/
export const CORPUS_LISTED_APART = {
	'link-right-button-release-ignored': { kind: 'chord', why: 'B427: a release naming 2 commits the link a press of 0 began',
		after: ['link.start>link', 'link.update>link', 'link.commit>-', '>-'] },
};
export function lifecycleOfSteps(steps) {
	const log = [], out = [];
	const restore = spied(log);
	const h = makeInput();
	try {
		const devices = [[0, 0], [360, 0], [0, 360]].map(([x, y]) => { const n = makeNode(h.model, 'host', { x, y }); h.model.put('node', n); return n.id; });
		for (const [type, x, y, on, fields] of steps) {
			// RESTATED at H26.8's picks move: on the device's element the harness's renderer drew (`h.at`), open ground otherwise
			const target = on === null ? GROUND : h.at(devices[on]);
			h.capture[{ down: 'onDown', move: 'onMove', up: 'onUp' }[type]](pointer(x, y, { target, ...fields }));
			out.push(`${log.splice(0).join(',')}>${liveGesture(h) ?? '-'}`);
		}
	} finally { h.restore(); restore(); }
	return out;
}

export const LIFECYCLE_RECORD = new URL('./binding-parity-lifecycle.json', import.meta.url);
export const HELP_RECORD = new URL('./binding-parity-help.json', import.meta.url);
