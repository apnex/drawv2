/*
H26.3 (dev/design/components/INPUT-CAPTURE.md section 4, acceptance step 4) -- DRAW'S CAPTURE, OLD AND NEW, SIDE BY SIDE: what is left of
it. This was the fixture of tests/input-capture-parity.test.js, which drove the old capture, kept verbatim in tests/fixtures/pre-capture/,
and draw's adapter with the same events -- seeded streams, section 6.3's edges recorded in capture-parity-edges.json, and every event the
tests make, through a parity hook in the harness.

RETIRED at H26.5 (dev/design/components/RELEASES-0.2.md section 4; GR6), as INPUT-CAPTURE.md planned "until the copy is deleted -- when
B409 or B413 is ruled, or capture next changes", all three now: the adapter hands Input a pointer fact's `pointerId` (RD18), so the
comparison with the old copy would differ on every pointer event, and the gesture corpus replayed byte-identical stays the move's guard.
The test, the edges' record and the copy's folder are deleted, and the harness has no parity hook; this keeps `sceneOver` alone, which
tests/input-capture.test.js and tests/input-capture-move.test.js hand the adapter.
*/
import { openScene } from '@apnex/vector-scene';

/*
RESTATED at H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1; appendix B): the adapter converts each point by the canvas's scene
(`scene.toDrawing`). So a test handing it a surface hands it a scene over that surface -- the root inheriting the surface, so the scene
calls the surface's own `getScreenCTM`, at each event, as the adapter's conversion reads it on the page.
*/
const sink = () => ({ setAttribute() {}, removeAttribute() {}, appendChild() {}, insertBefore() {}, remove() {} });
export function sceneOver(surface) {
	const root = Object.create(surface, { ownerDocument: { value: { createElementNS: sink } }, appendChild: { value() {} } });
	const opened = openScene({ root, layers: [{ name: 'conversion' }] });
	if (!opened.ok) throw new Error(`capture-parity: the surface takes no scene: ${JSON.stringify(opened.problems)}`);
	return opened.scene;
}
