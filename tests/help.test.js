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
import { RECOGNIZE, DOUBLE_CLICKS } from '../app/src/recognize.js';
import { LINK_RELEASES, MARQUEE_RELEASES, CTRL_CLICKS } from '../app/src/releases.js';
import { RUN_PRESSES } from '../app/src/run-mode.js';
import { networkInput } from '../network/keys.mjs';
import { ACTION_LABELS, actionOf } from '../app/src/actions.js';
import { eventsFor, shown, helpSections } from '../app/src/help.js';
import { makeInput } from './fixtures/client-harness.mjs';

const NETWORK_KEYS = networkInput(() => ({})).keys;
const PERFORMED = { keys: [...KEYMAP, ...NETWORK_KEYS], presses: RECOGNIZE.filter((r) => !r.whileReadOnly), double: DOUBLE_CLICKS, run: RUN_PRESSES };

test('every documented input, turned back into an event, is matched by its row', () => {
	const wrong = [];
	for (const rows of Object.values(PERFORMED)) for (const r of rows) for (const input of r.input ?? []) {
		const events = eventsFor(input);
		assert.ok(events.length > 0, `${r.id}: "${input}" names no event`);
		for (const e of events) if (!r.on(e)) wrong.push(`${r.id}: "${input}" -> ${JSON.stringify(e)} does not match`);
	}
	assert.deepEqual(wrong, []);
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
