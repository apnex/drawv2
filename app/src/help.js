/*
help.js -- the help overlay, GENERATED from the bindings (stage 6 of the gesture system; RULES I4, invariant G6).

Every row a person performs carries its `input` -- the keystroke or press that reaches it -- in a small grammar, and the
overlay shows that input beside the label of the action the row names (app/src/actions.js). There is no hand-written
list of controls: deleting a binding removes its line, and a test turns every documented input back into an event and
checks that the row really matches it, so the overlay cannot claim a key the tables do not bind.

THE GRAMMAR
  keys       [Ctrl+][Shift+][Alt+]key   a character, or Space, Enter, Escape, Tab, Delete, Backspace, F2, Shift, Alt,
                                        Control; `Arrows` is the four arrow keys, `1-6` the six digits; `+` alone the plus
                                        key; a digit names its key's place too, `Digit<d>`, and with Shift the character a
                                        US layout makes of it -- `Shift+0` is `)` on `Digit0` (H26.6's move 10)
  presses    [mods+]left|right on K     K is node, waypoint, zone, link, canvas, handle (a zone's corner), lhandle (a
                                        link's end), or, in run mode, region:endpoint, region:ground, region:action,
                                        region:input -- several joined by |
  double     double                     a double click
  view       wheel | Ctrl+wheel | pinch     a wheel without Ctrl, with it, or a pinch (H26.6's move 9)
             [mods+]left|middle|right drag on K   a mouse's press dragged past the threshold; `Space+` a key held, not a
                                        modifier; K as a press's, or `anywhere`

A release outcome that is a control of its own -- Shift on releasing a link, a click with a type held -- is described in
words, `said`, since what reaches it is a whole gesture rather than one event.
*/
import { ACTION_LABELS, actionOf } from './actions.js';

const MODS = { Ctrl: 'ctrlKey', Shift: 'shiftKey', Alt: 'altKey', Meta: 'metaKey' };
const NAMED = { Space: [' '], Arrows: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], '1-6': ['1', '2', '3', '4', '5', '6'] };
// C-f: a press's region as capture reads it -- what a run press aims at (an endpoint), and the drawn item a control sits in
const REGIONS = {
	endpoint: { target: 'node-000001', overTarget: true },
	ground: {},
	action: { action: 'help', control: true },
	input: { input: 0, owner: 'node-000001', control: true, entity: true },
};
const blank = { target: null, overTarget: false, action: null, input: null, owner: null, control: false, entity: false };
// a `mark` is what a plugin draws for the canvas to select (app/src/pick.js, H17.22 N-c2): any kind, flagged as a mark
const hitOf = (kind) => (kind === 'canvas' ? { kind, id: null } : kind === 'handle' ? { kind, id: 'se', handle: true } : kind === 'lhandle' ? { kind, id: 'src', handle: true } : kind === 'mark' ? { kind: 'plugin', id: 'plugin-000001', mark: true } : { kind, id: `${kind}-000001` });

// every event an input names -- a key chord may name several (Arrows), a press one per kind. H26.8's capture move (NATIVE-SHAPES.md
// section 3.2, Facts): a press is a fact's shape as the rows read it, what it is on and its run-mode region both in its `hit`.
// H26.6's move 9: a wheel's fact, Ctrl held for a pinch; a drag's press is a mouse's, its `Space+` the session's held key and no field
const DRAG_BUTTONS = { left: 0, middle: 1, right: 2 };
export function eventsFor(input) {
	if (input === 'double') return [{ type: 'double' }];
	if (input === 'wheel' || input === 'Ctrl+wheel' || input === 'pinch') {
		return [{ type: 'wheel', button: 0, pointerType: null, shiftKey: false, ctrlKey: input !== 'wheel', altKey: false, metaKey: false,
			deltaX: 0, deltaY: 100, deltaZ: 0, deltaMode: 0, hit: { kind: 'canvas', id: null, region: null } }];
	}
	const drag = /^(?:(.+)\+)?(left|middle|right) drag on (.+)$/.exec(input);
	if (drag) {
		const mods = Object.fromEntries((drag[1] ? drag[1].split('+') : []).filter((m) => MODS[m]).map((m) => [MODS[m], true]));
		return drag[3].split('|').map((k) => ({ type: 'down', button: DRAG_BUTTONS[drag[2]], pointerType: 'mouse', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
			...mods, hit: k === 'anywhere' ? { kind: 'canvas', id: null, region: null } : { ...hitOf(k), region: null } }));
	}
	const press = /^(?:(.+)\+)?(left|right) on (.+)$/.exec(input);
	if (press) {
		const mods = Object.fromEntries((press[1] ? press[1].split('+') : []).map((m) => [MODS[m], true]));
		return press[3].split('|').map((k) => ({ type: 'down', button: press[2] === 'left' ? 0 : 2, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods,
			hit: k.startsWith('region:') ? { kind: 'canvas', id: null, region: { ...blank, ...REGIONS[k.slice(7)] } } : { ...hitOf(k), region: null } }));
	}
	const parts = input === '+' ? ['+'] : input.split('+');
	const key = parts.pop();
	const mods = Object.fromEntries(parts.map((m) => [MODS[m], true]));
	const self = { Shift: { shiftKey: true }, Alt: { altKey: true }, Control: { ctrlKey: true } }[key] ?? {};
	// H26.6's move 10: a digit's place, and the character Shift makes of it on a US layout
	const typed = (k) => (mods.shiftKey && /^\d$/.test(k) ? ')!@#$%^&*('[Number(k)] : k);
	return (NAMED[key] ?? [key]).map((k) => ({ type: 'key-down', key: typed(k), ...(/^\d$/.test(k) ? { code: `Digit${k}` } : {}),
		shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...mods, ...self }));
}

// an input as a person reads it
const KIND_WORDS = { node: 'a node', waypoint: 'a waypoint', canvas: 'the canvas', handle: 'a corner handle', lhandle: 'a link end', mark: 'a plugin\'s mark',
	'region:endpoint': 'an endpoint', 'region:ground': 'open ground', 'region:action': 'a panel button', 'region:input': 'a panel input' };
export function shown(input, words = {}) {
	if (input === 'double') return 'double-click';
	if (input === 'wheel') return 'the wheel, or a two-finger scroll';
	if (input === 'Ctrl+wheel') return 'Ctrl + the wheel';
	if (input === 'pinch') return 'a pinch';
	const drag = /^(?:(.+)\+)?(left|middle|right) drag on (.+)$/.exec(input);
	if (drag) {
		const dict = { ...KIND_WORDS, anywhere: 'anywhere', ...words };
		const kinds = drag[3].split('|').map((k) => dict[k] ?? `a ${k}`);
		return `${drag[1] ? `${drag[1]} + ` : ''}${drag[2]}-drag ${kinds.join(' or ')}`;
	}
	const press = /^(?:(.+)\+)?(left|right) on (.+)$/.exec(input);
	if (!press) return input.replace('Arrows', 'arrow keys');
	const dict = { ...KIND_WORDS, ...words };
	const kinds = press[3].split('|').map((k) => dict[k] ?? `a ${k}`);
	const where = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} or ${kinds[kinds.length - 1]}` : kinds[0];
	return `${press[1] ? `${press[1]} + ` : ''}${press[2]}-press ${where}`;
}

/*
The overlay's sections, from the composed tables Input resolves: each documented row becomes a line -- its inputs, the
label of its action (or a plugin row's own `doc`), and the situation it applies in.
*/
export function helpSections(bindings) {
	const line = (row) => ({ inputs: row.input ? row.input.map((inp) => shown(inp, bindings.words)) : [row.said], label: ACTION_LABELS[actionOf(row)] ?? row.doc ?? null, context: row.context ?? null });
	const documented = (rows, field = 'input') => rows.filter((r) => r[field]).map(line);
	return [
		{ title: 'keys', lines: documented(bindings.keys) },
		{ title: 'pointer', lines: [...documented(bindings.presses), ...documented(bindings.double)] },
		{ title: 'the view', lines: documented(bindings.view ?? []) },   // H26.6's move 9: the view's rows (app/src/recognize.js VIEW_RULES)
		{ title: 'when a gesture ends', lines: documented(bindings.releases, 'said') },
		{ title: 'run mode', lines: documented(bindings.run) },
	].filter((s) => s.lines.length);
}

// the overlay itself: a heading and a table per section, drawn into `el`
export function renderHelp(el, sections) {
	const doc = el.ownerDocument;
	el.replaceChildren();
	for (const s of sections) {
		const h = doc.createElement('h3');
		h.textContent = s.title;
		const table = doc.createElement('table');
		for (const l of s.lines) {
			const tr = doc.createElement('tr');
			const input = doc.createElement('td');
			input.textContent = l.inputs.join(' / ');
			const what = doc.createElement('td');
			what.textContent = l.context ? `${l.label} (${l.context})` : l.label;
			tr.append(input, what);
			table.append(tr);
		}
		el.append(h, table);
	}
}
