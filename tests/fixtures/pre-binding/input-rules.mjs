/*
input-rules.mjs -- what an input MEANS, decided by rows that tenants bring. The neutral core of the Rules system
(dev/RULES.md section 11, step T3 of the ruleset audit).

ONE CONCERN: given an input, a situation and the guard state, find the one row that input means. Everything a row is
about -- its keys, its conditions, what it does -- belongs to the tenant that brought it. The product brings its table;
a plugin brings its own, about capabilities nothing else knows exist. This file names none of them, and a test reads
its whole text to keep it that way (P4: the core owns the mechanism, the tenant owns the semantics).

A ROW is plain data:

	id              unique across every tenant composed together
	owner           stamped by `composeRules`: which tenant brought it
	on(input)       whether this row is about this input at all -- the binding
	when(s)         whether the input means this row in situation `s` -- the condition; absent means always
	run             what to do: a name or a function, the host's to interpret -- this file never calls it
	mutates         does it author a change? inert while writes are refused. Defaults TRUE, the safe side
	duringHelp      meaningful while help is open? defaults false
	duringGesture   meaningful mid-gesture? defaults false
	whileReadOnly   admitted ONLY while writes are refused -- a fallback a locked client gets where a writer gets an
	                authoring row. Defaults false
	prevent         false when the host must not claim the input on the row's behalf

GUARD AGAINST CONDITION, the distinction the whole design rests on (dev/RULES.md section 3). A guard is about
AUTHORITY -- may this run at all -- and is applied here, uniformly, to every row. A condition is about SUBJECT -- does
this input mean this thing right now -- and is the row's own. Mixing the two is what once put a write-refusal check at
a line number and let three defects through.

NO SILENT PRECEDENCE (ruled 2026-09-30, Q3). Two rows matching one situation are never resolved by which is listed
first: nothing runs, and `overlapsIn` finds the pair so the gate fails before it ships. Order is decoration.

A CLAIM IS THE BINDING'S. An input is claimed when a row's `on` matches and its guards pass, whatever the situation
says: bind a key and you own it (B47), and what it means is the condition's to decide. An input no row means in this
situation does nothing and changes nothing (I6).

THE SITUATION IS OPAQUE HERE. It is plain data (Q4), built by the host, read only by conditions. The engine passes it
through and never looks inside.
*/

const DEFAULTS = { mutates: true, duringHelp: false, duringGesture: false, whileReadOnly: false };

// join tenants' rows into one table; an id taken twice is refused, naming both owners
export function composeRules(...tenants) {
	const table = [], taken = new Map();
	for (const { owner, rules } of tenants) {
		for (const r of rules) {
			if (taken.has(r.id)) throw new Error(`input rule '${r.id}' is brought by both ${taken.get(r.id)} and ${owner} -- an id names one row`);
			taken.set(r.id, owner);
			table.push({ ...DEFAULTS, ...r, owner });
		}
	}
	return table;
}

// may this row run at all, given the guard state -- the same test for every row
const admitted = (r, { readOnly = false, helpOpen = false, gesturing = false } = {}) =>
	!(r.mutates && readOnly) && !(r.whileReadOnly && !readOnly) && !(helpOpen && !r.duringHelp) && !(gesturing && !r.duringGesture);

// every row the input means in this situation -- one is an answer, two are an overlap, none is nothing
function matching(table, input, situation, guards) {
	const bound = table.filter((r) => admitted(r, guards) && r.on(input));
	return { bound, hits: bound.filter((r) => !r.when || r.when(situation)) };
}

// the ONE row this input means, and whether the input is claimed
export function resolveInput(table, input, situation, guards) {
	const { bound, hits } = matching(table, input, situation, guards);
	return { rule: hits.length === 1 ? hits[0] : null, claimed: bound.some((r) => r.prevent !== false) };
}

// every input, situation and guard state in which more than one row matches -- the gate asserts there are none
export function overlapsIn(table, inputs, situations, guardStates) {
	const found = [];
	for (const guards of guardStates) for (const situation of situations) for (const input of inputs) {
		const { hits } = matching(table, input, situation, guards);
		if (hits.length > 1) found.push({ input, situation, guards, ids: hits.map((r) => r.id) });
	}
	return found;
}
