/*
THE HELP OVERLAY, GENERATED -- stage 6 of the gesture system (dev/design/input/GESTURE-SYSTEM.md; RULES I4, invariant G6).

Every row a person performs carries its `input`, and the overlay shows it beside the label of the action the row names
(app/src/actions.js). These hold that the overlay can be no more wrong than the tables: every documented input, turned
back into an event, is matched by its row; every row a person performs is documented; every action is named once; and
deleting a binding removes its line (acceptance test 7).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KEYMAP } from '../app/src/keymap.js';
import { DOUBLE_CLICKS, VIEW_RULES } from '../app/src/recognize.js';
import { pressRows } from '../app/src/recognize.js';
import { picksOf } from '../app/src/pick.js';
import { placesOf } from '../app/src/snap.js';
import { PRODUCT_CANVAS as CANVAS_FOR_ROWS } from '../product/canvas.mjs';
// RESTATED at C-d step four (H19.32; D4): the product's press rows are composed from the plugins' picks and places
const RECOGNIZE = pressRows(picksOf(CANVAS_FOR_ROWS), placesOf(CANVAS_FOR_ROWS));
import { LINK_RELEASES, MARQUEE_RELEASES, CTRL_CLICKS } from '../app/src/releases.js';
import { RUN_PRESSES } from '../app/src/run-mode.js';
import { networkInput } from '../plugins/network/keys.mjs';
import { ACTION_LABELS, actionOf } from '../app/src/actions.js';
import { eventsFor, shown, helpSections } from '../app/src/help.js';
import { makeInput } from './fixtures/client-harness.mjs';

const NETWORK_KEYS = networkInput(() => ({})).keys;
const PERFORMED = { keys: [...KEYMAP, ...NETWORK_KEYS], presses: RECOGNIZE.filter((r) => !r.whileReadOnly), double: DOUBLE_CLICKS, run: RUN_PRESSES, view: VIEW_RULES };

test('every documented input, turned back into an event, is matched by its row', () => {
	const wrong = [];
	for (const rows of Object.values(PERFORMED)) for (const r of rows) for (const input of r.input ?? []) {
		const events = eventsFor(input);
		assert.ok(events.length > 0, `${r.id}: "${input}" names no event`);
		for (const e of events) if (!r.on(e)) wrong.push(`${r.id}: "${input}" -> ${JSON.stringify(e)} does not match`);
	}
	assert.deepEqual(wrong, []);
});

// H26.8's capture move (NATIVE-SHAPES.md section 3.2, Facts): an input turned back into a fact as the rows read it -- what a press is on
// and its run-mode region in its `hit`, as capture answers them; a key's no hit
test('a documented press is turned back into a fact\'s hit: what it is on, and its run-mode region; a key has none', () => {
	assert.deepEqual(eventsFor('left on node')[0].hit, { kind: 'node', id: 'node-000001', region: null });
	assert.deepEqual(eventsFor('left on region:endpoint')[0].hit,
		{ kind: 'canvas', id: null, region: { target: 'node-000001', overTarget: true, action: null, input: null, owner: null, control: false, entity: false } });
	assert.equal('hit' in eventsFor('Delete')[0], false);
	assert.equal(eventsFor('Ctrl+right on node')[0].on, undefined, 'no `on` and no `region` beside the hit: draw\'s input event is gone');
});

test('every row a person performs is documented; the locked fallbacks are not, since they repeat a writer\'s inputs', () => {
	for (const [table, rows] of Object.entries(PERFORMED)) for (const r of rows) assert.ok(r.input?.length, `${table} ${r.id} has no input, so the overlay would not show it`);
	for (const r of RECOGNIZE.filter((x) => x.whileReadOnly)) assert.equal(r.input, undefined, `${r.id}`);
});

test('every documented row has a label, and every label is an action some row names -- named once, none stale (G6)', () => {
	const documented = [...Object.values(PERFORMED).flat(), ...[...LINK_RELEASES, ...MARQUEE_RELEASES, ...CTRL_CLICKS].filter((r) => r.said)];
	for (const r of documented) assert.ok(ACTION_LABELS[actionOf(r)] ?? r.doc, `${r.id} has no label`);
	const named = new Set(documented.map(actionOf).filter(Boolean));
	assert.deepEqual(Object.keys(ACTION_LABELS).filter((a) => !named.has(a)), [], 'labels no documented row reaches');
	for (const label of Object.values(ACTION_LABELS)) assert.match(label, /^[\x20-\x7e]*$/, 'typeable characters only');
});

// H26.6's move 9 (PAN-ZOOM.md appendix A, move 9): the view's rows documented -- each a line of the overlay's own section, read as a
// person says it, and a documented drag turned back into a mouse's press, its `Space+` no field of the fact
test('H26.6 move 9: the help overlay lists every view row, in a section of its own, each read as a person would say it', () => {
	const h = makeInput();
	try {
		const view = helpSections(h.input.bindings()).find((s) => s.title === 'the view');
		assert.deepEqual(view.lines.map((l) => `${l.inputs.join(' / ')} :: ${l.label}${l.context ? ` (${l.context})` : ''}`), [
			// RESTATED at H27.5 (H27-1): every wheel zooms, in one row; nothing pans by a scroll
			'the wheel, or a two-finger scroll / Ctrl + the wheel / a pinch :: zoom one level out or in about the pointer, in every mode; a sideways scroll does nothing',
			'middle-drag anywhere :: pan the view once the press travels 4 pixels; a click does nothing',
			'right-drag the canvas :: pan the view once the press travels 4 pixels; a click does nothing (open ground: a zone without Shift among it)',
			'Space + left-drag anywhere :: pan the view once the press travels 4 pixels; a click does nothing',
		]);
		assert.deepEqual(VIEW_RULES.map((r) => r.id), h.input.bindings().view.map((r) => r.id), 'every view row, and only those');
		assert.doesNotMatch(JSON.stringify(helpSections(h.input.bindings())), /pan the view, in every mode|scroll pan|never zooms/, 'H27.5: no line says a wheel or a scroll pans');
	} finally { h.restore(); }
	assert.deepEqual(eventsFor('Space+left drag on anywhere').map((e) => [e.type, e.button, e.pointerType, e.shiftKey]), [['down', 0, 'mouse', false]]);
	assert.deepEqual(eventsFor('middle drag on anywhere')[0].hit, { kind: 'canvas', id: null, region: null });
	assert.deepEqual(eventsFor('pinch').map((e) => [e.type, e.ctrlKey]), [['wheel', true]]);
	assert.deepEqual(eventsFor('wheel').map((e) => [e.type, e.ctrlKey]), [['wheel', false]]);
});

test('an input reads as a person would say it', () => {
	assert.equal(shown('Ctrl+right on node|waypoint|zone'), 'Ctrl + right-press a node, a waypoint or a zone');
	assert.equal(shown('left on region:ground'), 'left-press open ground');
	assert.equal(shown('Shift+Arrows'), 'Shift+arrow keys');
	assert.equal(shown('double'), 'double-click');
});

test('acceptance 7: the overlay is Input\'s own tables, and deleting a binding removes its line', () => {
	const h = makeInput();
	try {
		const sections = helpSections(h.input.bindings());
		const lines = (secs) => secs.flatMap((s) => s.lines.map((l) => `${l.inputs.join(' / ')} :: ${l.label}`));
		assert.ok(lines(sections).includes('f :: cycle the selected link\'s direction: forward, reverse, none'));
		const b = h.input.bindings();
		const without = helpSections({ ...b, keys: b.keys.filter((r) => r.id !== 'direction') });
		assert.equal(lines(without).some((l) => l.startsWith('f ::')), false, 'the line went with the binding');
		assert.equal(lines(without).length, lines(sections).length - 1, 'and nothing else did');
	} finally { h.restore(); }
});

test('RULES I4: no hand-written list of controls is left in the page', () => {
	const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
	const card = html.slice(html.indexOf('<div id="help-card">'), html.indexOf('<div id="kdefs">'));
	assert.doesNotMatch(card, /<tr>|<td>/, 'the help card holds no rows of its own');
	assert.match(card, /<div id="help-rows"><\/div>/, 'only the place the generated rows go');
});
