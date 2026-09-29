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

/*
PIPES CARRY ONE LINK EACH, FOR NOW -- ruled 2026-09-30 (dev/DECISIONS.md, "Pipes carry one link each, for now").

The director: "only a single link is permitted across a single pipe for now. A single anchor can have multiple
links bending and crossing however." Two links sharing a pipe are drawn on top of each other -- the cost SD7
recorded -- and there is no way yet to draw them apart. Three rules, each measured before it was ruled:
  1. a pipe carries at most one link (`pipeCapacity`)
  2. a pipe laid with a link carries only the link whose ends and pins it joins -- without this, a deleted
     link's leftover pipes were taken over by a down link, and draw-then-delete left a trace (MEASURED)
  3. the older link keeps a contested hand-laid pipe
So a link's route now depends on the other links, and this is the ONE place the pipes are shared out. Where a
link is drawn, whether it is down, and what blocks it are all read from it, so they cannot disagree.
*/

/*
How many links one pipe may carry. A FUNCTION rather than a constant, for the reason `straightCapacity`
(model/invariants.mjs) gives: when links can be drawn side by side over one pipe, raising the limit is a change
to this body and nowhere else. Taking the pipe leaves room for the limit to depend on it.
*/
function pipeCapacity(_pipe) {
	return 1;
}

/*
The pipes a link MAY run over, whoever holds them: pipes laid by hand, and pipes laid with a link that join two
of its own consecutive stops (rule 2). A pipe laid for another link's pins is not a way for this one at all.
*/
function usableBy(link) {
	const stops = [link.src, ...(link.via ?? []), link.dst];
	const own = new Set();
	for (let i = 0; i < stops.length - 1; i++) own.add(pipeKey(stops[i], stops[i + 1]));
	return (p) => p.laid === 'hand' || own.has(pipeKey(p.a, p.b));
}

// oldest first (rule 3); a link with no rank is the newest, and equal ranks fall back to sorted id so peers agree
const byAge = (rankOf) => (x, y) => (rankOf(x.id) - rankOf(y.id)) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

/*
Share the pipes out: oldest link first, each takes its fewest-pipes way over the pipes it may use that are not
already full, and holds what it takes. A link that finds no way is down and holds nothing.
*/
function assign(pipes, links, { rankOf = () => 0, capacity = pipeCapacity } = {}) {
	const held = new Map();   // pipe key -> the ids of the links it carries
	const routes = new Map();
	for (const link of [...links].sort(byAge(rankOf))) {
		const may = usableBy(link);
		const open = pipes.filter((p) => {
			const on = held.get(pipeKey(p.a, p.b)) ?? [];
			return may(p) && (on.length < capacity(p) || on.includes(link.id));
		});
		const r = routeLink(open, { src: link.src, dst: link.dst, via: link.via ?? [] });
		routes.set(link.id, r);
		if (r) for (let i = 0; i < r.length - 1; i++) {
			const k = pipeKey(r[i], r[i + 1]), on = held.get(k) ?? [];
			if (!on.includes(link.id)) held.set(k, [...on, link.id]);
		}
	}
	return { routes, held };
}

// every link's route (null when down), with the pipes shared out as ruled. `rankOf(id)` says how old a link is.
export const assignRoutes = (pipes, links, opts) => assign(pipes, links, opts).routes;

// the way a link WOULD take if no other link held any pipe -- the "preferred path" a blocked link is kept from
export const preferredRoute = (pipes, link) => routeLink(pipes.filter(usableBy(link)), { src: link.src, dst: link.dst, via: link.via ?? [] });

/*
The links blocking a down link: those holding a pipe on its preferred path -- ruled 2026-09-30, "select a
down/broken link that cannot be healed due to another link occupying my preferred path, also highlight that
blocking link". Empty for a link that is up, and for one down because no way exists at all.
*/
export function blockersOf(pipes, links, id, opts) {
	const link = links.find((l) => l.id === id);
	const { routes, held } = assign(pipes, links, opts);
	const want = link && !routes.get(id) && preferredRoute(pipes, link);
	if (!want) return [];
	const by = new Set();
	for (let i = 0; i < want.length - 1; i++) for (const other of held.get(pipeKey(want[i], want[i + 1])) ?? []) if (other !== id) by.add(other);
	return [...by].sort();
}
