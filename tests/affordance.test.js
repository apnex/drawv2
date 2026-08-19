/*
The affordance surface — transient feedback, and the one part of H6 with no net.

H6 splits `input.js` into six units. Five of them are observable at the commit boundary, so the
existing net proves the decomposition preserved behaviour: picking decides what a gesture targets,
drag geometry lands in the committed delta, the keymap turns a keystroke into an intent, and the FSM
ends every gesture in a commit.

`overlay.js` is the exception. It takes `hovered`, `armed`, `datumEl` and the crosshair — roughly
112 lines that DRAW and COMMIT NOTHING — so H6.3 could relocate all of it and the suite would stay
green while hover, arming, handles and the datum silently stopped working.

These assert BEHAVIOUR, not structure, so they survive the move:
  · hover and arming go through `renderer.setState`/`clearState` — a collaborator contract that
    overlay.js will still honour, not an internal of Input
  · handles and the datum marker are asserted by what is DRAWN in a layer, via `h.drawn(...)`,
    not by which function drew it

Nothing here reads `input.mode` or `input.ctx`; `tools/scan-writers.mjs` enforces that.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, key, pointer, seedNodes } from './fixtures/client-harness.mjs';

// a pointer event whose target resolves to an entity, as the real DOM would
const over = (id, x, y, mod = {}) => pointer(x, y, { target: { tagName: 'g', closest: (sel) => (sel === '[id]' || sel === '.node' ? { id } : { id }) }, ...mod });

test('hovering an entity tells the renderer, and leaving clears it', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.input.onHover(over(a.id, 0, 0), true);
		assert.ok(h.stateCalls('renderer.setState').some(([id, cls]) => id === a.id && cls === 'hover'),
			'the hovered entity is marked, so the crosshair ring appears');

		h.input.onHover(over(a.id, 0, 0), false);
		assert.ok(h.stateCalls('renderer.setState').some(([id, cls, on]) => id === a.id && cls === 'hover' && on === false),
			'and unmarked on leave — the renderer is told, whichever unit is doing the telling');
	} finally { h.restore(); }
});

test('Alt arms the hovered entity red; Ctrl arms it clone-blue', () => {
	const h = makeInput();
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.input.onHover(over(a.id, 0, 0), true);

		h.input.updateArming({ altKey: true, ctrlKey: false });
		assert.ok(h.stateCalls('renderer.setState').some(([id, cls]) => id === a.id && cls === 'armed'),
			'Alt is the delete chord — threat may shout (DESIGN U2)');

		h.input.updateArming({ altKey: false, ctrlKey: true });
		assert.ok(h.stateCalls('renderer.setState').some(([id, cls]) => id === a.id && cls === 'armed-clone'),
			'Ctrl is the clone chord');
	} finally { h.restore(); }
});

test('arming is suppressed while Server-Locked — a locked client must not promise a mutation', () => {
	const h = makeInput({ readOnly: true });
	try {
		const [a] = seedNodes(h.model, [[0, 0]]);
		h.input.onHover(over(a.id, 0, 0), true);
		h.input.updateArming({ altKey: true, ctrlKey: false });
		assert.equal(h.stateCalls('renderer.setState').some(([, cls]) => cls === 'armed'), false,
			'arming red says "this click deletes" — while locked it does not');
	} finally { h.restore(); }
});

test('a selected link shows an endpoint handle at each end, and only while selected', () => {
	const h = makeInput();
	try {
		const [a, b] = seedNodes(h.model, [[0, 0], [120, 0]]);
		const l = h.model.makeLink(a.id, b.id);
		h.model.put('link', l);

		h.selection.set([l.id]);
		assert.equal(h.drawn('#overlay', 'handle').length, 2, 're-plug handles: one per endpoint');

		h.selection.clear();
		assert.equal(h.drawn('#overlay', 'handle').length, 0, 'and they go when the selection does');
	} finally { h.restore(); }
});

test('a selected zone shows four corner resize handles', () => {
	const h = makeInput();
	try {
		const z = h.model.makeZone({ x: -30, y: -30, w: 120, h: 120 });
		h.model.put('zone', z);
		h.selection.set([z.id]);
		assert.equal(h.drawn('#overlay', 'handle').length, 4, 'one per corner');
	} finally { h.restore(); }
});

test('Space places a datum marker; Shift+Space removes it', () => {
	const h = makeInput();
	try {
		h.input.onMove(pointer(60, 60));
		h.input.onKeyDown(key(' '));
		assert.equal(h.drawn('#snaplayer', 'datum').length, 1, 'the local origin is visible, not just numeric');

		h.input.onKeyDown(key(' ', { shiftKey: true }));
		assert.equal(h.drawn('#snaplayer', 'datum').length, 0, 'and clearing it removes the marker');
	} finally { h.restore(); }
});

test('a second datum replaces the first — markers do not accumulate', () => {
	const h = makeInput();
	try {
		h.input.onMove(pointer(60, 60));
		h.input.onKeyDown(key(' '));
		h.input.onMove(pointer(180, 180));
		h.input.onKeyDown(key(' '));
		assert.equal(h.drawn('#snaplayer', 'datum').length, 1, 'one datum, wherever it was last set');
	} finally { h.restore(); }
});

test('Shift raises the zone layer indicator, but never mid-drag', () => {
	const h = makeInput();
	try {
		h.input.syncZoneGrid({ shiftKey: true });
		assert.equal(h.svg.classList.contains('zonegrid'), true, 'Shift is the zone-layer key (DESIGN U1)');

		h.input.syncZoneGrid({ shiftKey: false });
		assert.equal(h.svg.classList.contains('zonegrid'), false);
	} finally { h.restore(); }
});
