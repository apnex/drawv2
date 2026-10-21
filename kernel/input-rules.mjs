/*
input-rules.mjs -- what an input MEANS, decided by rows that tenants bring: draw's adapter over `@apnex/input-binding`
(H26.2; dev/design/components/INPUT-BINDING.md section 5, D10; the Rules system, dev/RULES.md section 11).

ONE CONCERN: given an input, a situation and the guard state, find the one row that input means; and open the session that
decides when each phase of a gesture is due. The mechanism is the component's -- composing tenants' rows into a table, the
guards, the one match or none, the claim, the overlaps, the press and its threshold, the live gesture -- and this module states
only draw's policy for it, once: the four guards, the claim and the field a press row names its gesture in. Everything a row is
about -- its keys, its conditions, what it does -- belongs to the tenant that brought it, and this file names none of them; a test
reads its whole text to keep it that way (P4: the core owns the mechanism, the tenant owns the semantics). The rules part alone
imports the component (tools/layers.mjs COMPONENTS), so every call site asks it through the three functions it always had.

A ROW is plain data, handed to the component as it is declared:

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
runs, and `overlapsIn` finds the pair so the gate fails before it ships. Order is decoration.

A CLAIM IS THE BINDING'S. An input is claimed when a row's `on` matches and its guards pass, whatever the situation says: bind a
key and you own it (B47). An input no row means in this situation does nothing and changes nothing (I6).

THE SITUATION IS OPAQUE HERE. It is plain data (Q4), built by the host, read only by conditions, handed through unread.

What each function answers, its signature as it always was:
	composeRules(...{ owner, rules })                      a table, or a loud refusal at load naming each owner and row -- a duplicate id as it was
	resolveInput(table, input, situation, guards)          { rule, claimed, match }: the declared row, the claim, the component's match
	overlapsIn(table, inputs, situations, guardStates)     [{ input, situation, guards, ids }], the gate's instrument
	openGestures({ threshold, gestures })                  a session, or a loud refusal naming its problems
*/
import { composeBindingTable, openGestureSession } from '@apnex/input-binding';

// draw's guards, claim and the field a press row names its gesture in: the four guards the matcher always applied, the claim a
// row's `prevent !== false` made, and `gesture`, where press rows name what they open (INPUT-BINDING.md section 5)
const DECLARED = {
	guards: [
		{ state: 'readOnly', flag: 'mutates', default: true, refuses: 'state-and-flag' },
		{ state: 'readOnly', flag: 'whileReadOnly', default: false, refuses: 'flag-without-state' },
		{ state: 'helpOpen', flag: 'duringHelp', default: false, refuses: 'state-without-flag' },
		{ state: 'gesturing', flag: 'duringGesture', default: false, refuses: 'state-without-flag' },
	],
	claim: { flag: 'prevent', default: true },
	opens: { field: 'gesture' },
};

/*
A REFUSED DECLARATION, SAID AS DRAW NAMES ITS ROWS (F5, H26.2's verification). Each problem the component finds is named by the tenant's
owner and the row's id -- or the row's place, when it has no id to read -- read as data, never through a getter, so naming a refusal runs
no code of a tenant's. Every problem is listed, in table order; a duplicate id comes first, in the words the matcher always gave it --
the first twice in table order -- and the rest follow it.
*/
const own = (value, key) => {
	try { const d = value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, key) : undefined; return d && 'value' in d ? d.value : undefined; }
	catch { return undefined; }
};
const named = (value) => (typeof value === 'string' && value !== '' ? value : null);
function refusal(tenants, problems) {
	const place = (p) => /^\/tenants\/(\d+)(?:\/(owner|rows)(?:\/(\d+)(?:\/(.+))?)?)?$/.exec(p.pointer) ?? [];
	const ownerOf = (i) => named(own(tenants[i], 'owner')) ?? `tenant ${i}`;
	const idOf = (i, j) => named(own(own(own(tenants[i], 'rules'), j), 'id'));
	const order = (p) => { const [, i = -1, , j = -1] = place(p); return [Number(i), Number(j)]; };
	const said = (p) => {
		const [, i, field, j, rest] = place(p);
		if (i === undefined) return `the declaration${p.pointer ? ` at ${p.pointer}` : ''}: ${p.problem}`;
		if (field === undefined) return `tenant ${i}: ${p.problem}`;
		if (field === 'owner') return `tenant ${i}'s owner: ${p.problem}`;
		if (j === undefined) return `${ownerOf(i)}'s rules: ${p.problem}`;
		const id = idOf(i, j), row = id ? `${ownerOf(i)}'s row '${id}'` : `${ownerOf(i)}'s row ${j}`;
		if (p.problem !== 'duplicate-id') return `${row}: ${rest ? `${rest} ` : ''}${p.problem}`;
		// the owner that brought it first, as the matcher kept it: the first tenant holding a row of this id
		const listed = (t) => { const rules = own(t, 'rules'); return Array.isArray(rules) ? rules : []; };
		const first = tenants.findIndex((t) => listed(t).some((r) => named(own(r, 'id')) === id));
		return `input rule '${id}' is brought by both ${ownerOf(first)} and ${ownerOf(i)} -- an id names one row`;
	};
	const sorted = [...problems].sort((x, y) => { const [a, b] = [order(x), order(y)]; return a[0] - b[0] || a[1] - b[1]; });
	const twice = sorted.find((p) => p.problem === 'duplicate-id');
	if (twice) return [twice, ...sorted.filter((p) => p !== twice)].map(said).join('; ');
	return `input rules refused: ${sorted.map(said).join('; ')}`;
}

// join tenants' rows into one table, in order; a refused declaration throws when the composition loads
export function composeRules(...tenants) {
	const opened = composeBindingTable({ ...DECLARED, tenants: tenants.map(({ owner, rules }) => ({ owner, rows: rules })) });
	if (opened.ok) return opened.table;
	throw new Error(refusal(tenants, opened.problems));
}

// the ONE row this input means, and whether the input is claimed; `match` is the component's record of it
export function resolveInput(table, input, situation, guards) {
	const { match, claimed } = table.matchInput(input, situation, guards);
	return { rule: match ? match.row : null, claimed, match };
}

// every input, situation and guard state in which more than one row matches -- the gate asserts there are none
export function overlapsIn(table, inputs, situations, guardStates) {
	return table.findOverlaps(inputs, situations, guardStates).map(({ fact, context, guards, ids }) => ({ input: fact, situation: context, guards, ids }));
}

// one input surface's gesture session: its threshold and the gestures it declares, or a loud refusal naming each problem
export function openGestures(declaration) {
	const opened = openGestureSession(declaration);
	if (opened.ok) return opened.session;
	throw new Error(`gestures refused: ${opened.problems.map((p) => `${p.pointer || '/'} ${p.problem}`).join(', ')}`);
}
