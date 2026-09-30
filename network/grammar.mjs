/*
The network's DRAG GRAMMAR, as data -- step T3 of the ruleset audit (dev/RULES.md section 11; RULESET G5-G7).

The director's rule of 2026-09-30, "Each drag action does one thing": a left drag from an anchor is undefined intent,
and the keys pressed during it decide what it is. What each key places is the network's key rows (network/keys.mjs);
what the finished drag MAKES, and which pipe each hop LAYS, is here -- two tables the Rules engine reads
(kernel/input-rules.mjs), so the grammar is held to what every rule table is held to: exactly one row per case, never
chosen by position (Q3), and a row per sentence of the ruling.

`docs/` is not where this is described: the gesture table in dev/design/unification/GESTURES.md is GENERATED from these
rows by `tools/gesture-table.mjs` (P3), and the gate fails if it differs.

THE FACTS come from the product's record of the drag, not from flags. Input records each key that acted and the stop
it made, and how the drag was released (app/src/input.js `linkDrag`, `addStop`); `dragFacts` reads, from that, what
the grammar asks: which stops are guides, which keys were pressed, how the end was reached. Before T3 the product's
Input worked these out itself, which put routing notions in a product module.
*/
import { composeRules, resolveInput } from '../kernel/input-rules.mjs';

/*
The facts of a finished drag, from Input's record. `pins` and `route` arrive as the drag left them, the destination
already taken off the route; `release` is 'anchor' when the drag was released ON an anchor, and 'stop' when it ended at
the last stop a key made.
*/
export function dragFacts({ src, dst, pins, route, placed, steps, release, srcKey }) {
	const guided = new Set(steps.filter((t) => t.key === 'g').map((t) => t.stop));
	return {
		src, dst, pins, placed, srcKey,
		guides: [...guided].filter((g) => g !== dst),
		stops: [src, ...route, dst],
		pressed: { w: steps.some((t) => t.key === 'w'), g: steps.some((t) => t.key === 'g') },
		// how the end was reached: released on an anchor with no key, or at a stop a key made
		endPressed: release === 'anchor' ? false : guided.has(dst) ? 'g' : 'w',
	};
}

/*
WHAT A DRAG MAKES (G5), from which keys were pressed during it. The source `w` is not a key pressed DURING the drag, so
it never makes a pipes-only drag a link ("A g in the drag cancels it", 2026-09-30); it matters only to the pipes.
*/
export const DRAG_KINDS = [
	{ id: 'pinned-link', doc: 'any w during the drag: a link, pinned at each w anchor, routing between pins over the pipes',
		on: (f) => f.pressed.w, run: { makes: 'link' } },
	{ id: 'pipes-only', doc: 'g and no w: anchors and pipes laid by hand, and no link -- a g also cancels the source w',
		on: (f) => !f.pressed.w && f.pressed.g, run: { makes: 'pipes' } },
	{ id: 'plain-link', doc: 'no key during the drag: a link over the pipes already there',
		on: (f) => !f.pressed.w && !f.pressed.g, run: { makes: 'link' } },
];

/*
WHICH PIPE A HOP LAYS (G6, G7). A hop is one step of the drawn route, from stop `a` to stop `b`; `count` is how many
stops the route has, ends included, and `dst` its destination.

Each key lays the pipe into its own stop, and the release lays the final pipe whenever a key made a hop before it --
"If penultimate hop was a key (g or w) - final pipe is laid. Direct links without a key lay no pipe" (2026-09-30).
A pipe touching a g anchor is laid by hand and outlives any link (GUIDE-ANCHORS T4); every other pipe a link drag lays
goes with its link (2026-09-27).
*/
const oneAnchor = (h) => h.a === h.b;
const keyless = (h) => h.b === h.dst && !h.endPressed && h.count === 2 && !h.srcW;
const none = (h) => oneAnchor(h) || keyless(h);
const byHand = (h) => h.pipesOnly || h.guidedA || h.guidedB || (h.b === h.dst && h.endPressed === 'g');

export const LEGS = [
	{ id: 'no-pipe', doc: 'the only hop of a drag that pressed no key -- none during it, none at its end, not the source w -- lays no pipe; nor does a hop from an anchor to itself',
		on: none, run: { pipe: null } },
	{ id: 'hand-pipe', doc: 'a hop in a pipes-only drag, a hop touching a g anchor, or the hop into an end reached with g: a pipe laid by hand, which outlives any link',
		on: (h) => !none(h) && byHand(h), run: { pipe: 'hand' } },
	{ id: 'link-pipe', doc: 'any other hop of a drag that pressed a key: a pipe laid with the link, which goes when no link is on it',
		on: (h) => !none(h) && !byHand(h), run: { pipe: 'link' } },
];

// ---- the interpreter: the Rules engine, asked for the ONE row a case is ----

const KINDS = composeRules({ owner: 'network', rules: DRAG_KINDS });
const HOPS = composeRules({ owner: 'network', rules: LEGS });

const theRow = (table, what, input) => {
	const { rule } = resolveInput(table, input, null, {});
	if (!rule) throw new Error(`the drag grammar has no single row for this ${what}: ${JSON.stringify(input)}`);
	return rule.run;
};

// what a drag with these keys makes: { makes: 'link' | 'pipes' }
export const kindOf = ({ pressed }) => theRow(KINDS, 'drag', { pressed });

// the pipe a hop lays: 'link', 'hand', or null for none
export const pipeFor = (hop) => theRow(HOPS, 'hop', hop).pipe;
