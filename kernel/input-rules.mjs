/*
input-rules.mjs -- what an input MEANS, declared: draw's policy for `@apnex/input-binding`'s tables and sessions (H26.2;
dev/design/components/INPUT-BINDING.md section 5, D10; the Rules system, dev/RULES.md section 11).
RESTATED at H26.8's binding move (dev/design/components/NATIVE-SHAPES.md sections 3.1, 3.2 and 4.3; NS11; GR6): draw composes its
tables in the component's own form and asks them directly -- `table.matchInput(fact, context, guards).match?.row` for the one row an
input means, `table.findOverlaps` for the gate -- so this module holds draw's declaration and the two openings alone, and translates
nothing: no renamed tenant form, no renamed answer, no refusal re-worded.

ONE CONCERN: the mechanism is the component's -- composing tenants' rows into a table, the guards, the one match or none, the claim,
the overlaps, the press and its threshold, the live gesture -- and this module states only draw's policy for it, once: the four
guards, the claim and the field a press row names its gesture in. Everything a row is about -- its keys, its conditions, what it
does -- belongs to the tenant that brought it, and this file names none of them; a test reads its whole text to keep it that way
(P4: the core owns the mechanism, the tenant owns the semantics). The rules part alone imports the component (tools/layers.mjs
COMPONENTS); every other part asks the tables and sessions it opens.

A TENANT is `{ owner, rows }`, as the component takes it. A ROW is plain data, handed to the component as it is declared:

	id              unique across every tenant composed together
	on(input)       whether this row is about this input at all -- the binding
	when(s)         whether the input means this row in situation `s` -- the condition; absent means always
	run             what to do: a name or a function, the host's to interpret -- never read here
	gesture         the gesture a press this row matches opens, by name -- the field `opens` declares
	mutates         does it author a change? inert while writes are refused. Defaults TRUE, the safe side
	duringHelp      meaningful while help is open? defaults false
	duringGesture   meaningful mid-gesture? defaults false
	whileReadOnly   admitted ONLY while writes are refused -- a fallback a locked client gets where a writer gets an
	                authoring row. Defaults false
	prevent         false when the host must not claim the input on the row's behalf. Defaults true

GUARD AGAINST CONDITION, the distinction the whole design rests on (dev/RULES.md section 3). A guard is about AUTHORITY -- may
this run at all -- and is applied by the component, uniformly, to every row, as the four declared below say. A condition is about
SUBJECT -- does this input mean this thing right now -- and is the row's own.

NO SILENT PRECEDENCE (ruled 2026-09-30, Q3). Two rows matching one situation are never resolved by which is listed first: nothing
runs, and `table.findOverlaps` finds the pair so the gate fails before it ships. Order is decoration.

A CLAIM IS THE BINDING'S. An input is claimed when a row's `on` matches and its guards pass, whatever the situation says: bind a
key and you own it (B47). An input no row means in this situation does nothing and changes nothing (I6).

THE SITUATION IS OPAQUE HERE. It is plain data (Q4), built by the host, read only by conditions, handed through unread.

A REFUSED DECLARATION throws, as the composition loads, the component's own problems -- each `<pointer> <problem>`, in the component's
order (input-binding IB3, IB9) -- none of draw's being one (NS11).

What each answers:
	TABLE_DECLARATION                  draw's guards, claim and gesture field, which every table is composed with
	openTable(...{ owner, rows })      the component's table, or a loud refusal naming its problems
	openGestures({ threshold, gestures })  a session, or a loud refusal naming its problems
*/
import { composeBindingTable, openGestureSession } from '@apnex/input-binding';

// draw's guards, claim and the field a press row names its gesture in: the four guards the matcher always applied, the claim a
// row's `prevent !== false` made, and `gesture`, where press rows name what they open (INPUT-BINDING.md section 5)
export const TABLE_DECLARATION = {
	guards: [
		{ state: 'readOnly', flag: 'mutates', default: true, refuses: 'state-and-flag' },
		{ state: 'readOnly', flag: 'whileReadOnly', default: false, refuses: 'flag-without-state' },
		{ state: 'helpOpen', flag: 'duringHelp', default: false, refuses: 'state-without-flag' },
		{ state: 'gesturing', flag: 'duringGesture', default: false, refuses: 'state-without-flag' },
	],
	claim: { flag: 'prevent', default: true },
	opens: { field: 'gesture' },
};

// join tenants' rows into one table, in order; a refused declaration throws when the composition loads
export function openTable(...tenants) {
	const opened = composeBindingTable({ ...TABLE_DECLARATION, tenants });
	if (opened.ok) return opened.table;
	throw new Error(`input rules refused: ${opened.problems.map((p) => `${p.pointer || '/'} ${p.problem}`).join(', ')}`);
}

// one input surface's gesture session: its threshold and the gestures it declares, or a loud refusal naming each problem
export function openGestures(declaration) {
	const opened = openGestureSession(declaration);
	if (opened.ok) return opened.session;
	throw new Error(`gestures refused: ${opened.problems.map((p) => `${p.pointer || '/'} ${p.problem}`).join(', ')}`);
}
