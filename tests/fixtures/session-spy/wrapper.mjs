// the component itself, its session's every operation logging the phase it answers and the gesture it concerns, name and row
import * as real from '@apnex/input-binding';   // by name: the hook answers the adapter's import alone, so this one is the package

export const composeBindingTable = real.composeBindingTable;
// RESTATED at H26.5 (dev/design/components/RELEASES-0.2.md section 4, a:F1): and input-binding 0.2.0's four, in the session's order --
// resolvePress logged by the outcome it answers, the calls it makes inside being the session's own, which no wrapper sees
const OPERATIONS = ['pointerDown', 'pressMatched', 'pointerMove', 'pointerUp', 'pointerLost', 'startGesture', 'becomeGesture', 'cancelGesture',
	'resolvePress', 'keyDown', 'keyUp', 'keysLost'];
export function openGestureSession(declaration) {
	const opened = real.openGestureSession(declaration);
	if (!opened.ok) return opened;
	const session = opened.session;
	const logged = (op) => (...args) => {
		const out = session[op](...args);
		(globalThis.__sessionLog ??= []).push({ op, phase: out.phase, gesture: out.gesture && { name: out.gesture.name, row: out.gesture.row } });
		return out;
	};
	return { ok: true, session: Object.freeze({ declaration: session.declaration, get state() { return session.state; }, ...Object.fromEntries(OPERATIONS.map((op) => [op, logged(op)])) }) };
}
