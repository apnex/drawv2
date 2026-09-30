/*
help.js -- the help overlay, GENERATED from the bindings (stage 6 of the gesture system; RULES I4, invariant G6).

Every row a person performs carries its `input` -- the keystroke or press that reaches it -- in a small grammar, and the
overlay shows that input beside the label of the action the row names (app/src/actions.js). There is no hand-written
list of controls: deleting a binding removes its line, and a test turns every documented input back into an event and
checks that the row really matches it, so the overlay cannot claim a key the tables do not bind.

THE GRAMMAR
  keys       [Ctrl+][Shift+][Alt+]key   a character, or Space, Enter, Escape, Tab, Delete, Backspace, F2, Shift, Alt,
                                        Control; `Arrows` is the four arrow keys, `1-6` the six digits
  presses    [mods+]left|right on K     K is node, waypoint, zone, link, canvas, handle (a zone's corner), lhandle (a
                                        link's end), or, in run mode, region:waypoint, region:ground, region:action,
                                        region:input -- several joined by |
  double     double                     a double click

A release outcome that is a control of its own -- Shift on releasing a link, a click with a type held -- is described in
words, `said`, since what reaches it is a whole gesture rather than one event.
*/
import { ACTION_LABELS, actionOf } from './actions.js';

const MODS = { Ctrl: 'ctrlKey', Shift: 'shiftKey', Alt: 'altKey', Meta: 'metaKey' };
const NAMED = { Space: [' '], Arrows: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], '1-6': ['1', '2', '3', '4', '5', '6'] };
const REGIONS = {
	waypoint: { waypoint: 'waypoint-000001', overWaypoint: true },
	ground: {},
	action: { action: 'help', control: true },
	input: { input: 0, node: 'node-000001', control: true, entity: true },
};
const blank = { waypoint: null, overWaypoint: false, action: null, input: null, node: null, control: false, entity: false };
const hitOf = (kind) => (kind === 'canvas' ? { kind, id: null } : kind === 'handle' ? { kind, id: 'se' } : kind === 'lhandle' ? { kind, end: 'src' } : { kind, id: `${kind}-000001` });

// every event an input names -- a key chord may name several (Arrows), a press one per kind
export function eventsFor(input) {
	if (input === 'double') return [{ type: 'double' }];
	const press = /^(?:(.+)\+)?(left|right) on (.+)$/.exec(input);
	if (press) {
		const mods = Object.fromEntries((press[1] ? press[1].split('+') : []).map((m) => [MODS[m], true]));
		return press[3].split('|').map((k) => ({ type: 'down', button: press[2] === 'left' ? 0 : 2, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods,
			...(k.startsWith('region:') ? { on: { kind: 'canvas', id: null }, region: { ...blank, ...REGIONS[k.slice(7)] } } : { on: hitOf(k) }) }));
	}
	const parts = input.split('+');
	const key = parts.pop();
	const mods = Object.fromEntries(parts.map((m) => [MODS[m], true]));
	const self = { Shift: { shiftKey: true }, Alt: { altKey: true }, Control: { ctrlKey: true } }[key] ?? {};
	return (NAMED[key] ?? [key]).map((k) => ({ type: 'key-down', key: k, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...mods, ...self }));
}

// an input as a person reads it
const KIND_WORDS = { node: 'a node', waypoint: 'a waypoint', zone: 'a zone', link: 'a link', canvas: 'the canvas', handle: 'a corner handle', lhandle: 'a link end',
	'region:waypoint': 'an endpoint', 'region:ground': 'open ground', 'region:action': 'a panel button', 'region:input': 'a panel input' };
export function shown(input) {
	if (input === 'double') return 'double-click';
	const press = /^(?:(.+)\+)?(left|right) on (.+)$/.exec(input);
	if (!press) return input.replace('Arrows', 'arrow keys');
	const kinds = press[3].split('|').map((k) => KIND_WORDS[k] ?? k);
	const where = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} or ${kinds[kinds.length - 1]}` : kinds[0];
	return `${press[1] ? `${press[1]} + ` : ''}${press[2]}-press ${where}`;
}

/*
The overlay's sections, from the composed tables Input resolves: each documented row becomes a line -- its inputs, the
label of its action (or a plugin row's own `doc`), and the situation it applies in.
*/
export function helpSections(bindings) {
	const line = (row) => ({ inputs: row.input ? row.input.map(shown) : [row.said], label: ACTION_LABELS[actionOf(row)] ?? row.doc ?? null, context: row.context ?? null });
	const documented = (rows, field = 'input') => rows.filter((r) => r[field]).map(line);
	return [
		{ title: 'keys', lines: documented(bindings.keys) },
		{ title: 'pointer', lines: [...documented(bindings.presses), ...documented(bindings.double)] },
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
