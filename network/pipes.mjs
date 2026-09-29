/*
Pipes, and the route a link takes over them -- the first incubated module of the network plugin.

INCUBATING (ruled 2026-09-28). Production does not import this folder; the lab composes it, and a
test holds that boundary. It is promoted into production once the lab has proven it, by production
starting to import it -- not by copying it anywhere. So it is written as the permanent module from
its first line: pure, portable, and owning nothing it does not have to.

WHAT IT OWNS, and nothing else:
  the pipe          SD7  at most one pipe joins any two anchors; a pipe is named by its pair
  the pipe's shape  SD8  a straight line between any two anchors, diagonals included
  the route         SD9  between consecutive pins, the path taking the FEWEST PIPES

WHAT IT DOES NOT OWN, deliberately:
  anchors           core. This module takes positions by injection and never reads a Model.
  links             their identity, names and intent are the link layer's; this only answers
                    "which way would a route go".
  storage           nothing here is stored. Pipes will be, and that stored-format change lands in
                    the one named batch, last (survey F6). Until then pipes live in the lab's
                    session and the product's documents are untouched.

PURE BY CONSTRUCTION. Every function takes what it needs and returns a value. No host object, no
module state, no clock -- `scan-layers` L11 holds the network layer to reading no window or global,
and this is written so that rule has nothing to catch. That is what makes it portable: the same code
runs in the lab page, in a test, on the server's planner, and in production once promoted.
*/

/*
A pipe's KEY is its two anchor ids, sorted.

SD7 makes a pipe the pair, not an entity with an id of its own -- "a wire's spec is just its two
anchors". Sorting makes the key independent of which end was drawn first, so A-B and B-A are the
same pipe and a second one cannot be laid between them. That is the whole of SD7 in one line.
*/
export const pipeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/*
The adjacency a router walks, built from a list of pipes.

Returned as a Map from anchor id to the ids it is piped to. Built fresh per call rather than kept,
because the pipe set changes with every edit and a cached index is exactly the kind of second
authority the relation index already exists to own.
*/
function adjacency(pipes) {
	const adj = new Map();
	const link = (x, y) => { if (!adj.has(x)) adj.set(x, []); adj.get(x).push(y); };
	for (const { a, b } of pipes) { link(a, b); link(b, a); }
	for (const list of adj.values()) list.sort();   // deterministic neighbour order, so ties resolve alike everywhere
	return adj;
}

/*
The route between two anchors: the path taking the FEWEST PIPES (SD9), or null if none exists.

Breadth-first, because "fewest pipes" is unweighted shortest path and BFS finds it exactly. Not
Dijkstra over lengths: SD9 ruled pipe COUNT, against the proposer's recommendation, and a router that
quietly minimised length instead would be implementing a ruling the director did not make.

TIES ARE RESOLVED DETERMINISTICALLY. Neighbours are visited in sorted id order, so two peers holding
the same pipes find the same route without exchanging anything -- the property every derivation in
this system has held so far, and the one A5 depends on. A tie broken by insertion order would let
two browsers disagree about where a link runs while agreeing about every stored fact.
*/
export function route(pipes, from, to) {
	if (from === to) return [from];
	const adj = adjacency(pipes);
	const prev = new Map([[from, null]]);
	const queue = [from];
	while (queue.length) {
		const at = queue.shift();
		for (const next of adj.get(at) ?? []) {
			if (prev.has(next)) continue;
			prev.set(next, at);
			if (next === to) {
				const path = [to];
				for (let p = at; p !== null; p = prev.get(p)) path.unshift(p);
				return path;
			}
			queue.push(next);
		}
	}
	return null;
}

/*
A link's whole route: its ends, through its pins in order, each leg the fewest pipes.

A link's intent is its ends plus its pinned vias (ruled 2026-09-26), and between consecutive pins
the route is derived. So this routes leg by leg and joins the legs. If any leg has no route the link
is DOWN -- ruled 2026-09-25, "down, and heals" -- which is reported as null rather than a partial
path, because a route that stops halfway is not a smaller route, it is no route.
*/
export function routeLink(pipes, { src, dst, via = [] }) {
	const stops = [src, ...via, dst];
	const whole = [src];
	for (let i = 0; i < stops.length - 1; i++) {
		const leg = route(pipes, stops[i], stops[i + 1]);
		if (!leg) return null;
		whole.push(...leg.slice(1));
	}
	return whole;
}
