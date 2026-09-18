/*
spectate.js -- the follow rule for spectator mode, as arithmetic rather than as wiring.

WHAT IT IS FOR. The agents button was an indicator: it said where work was happening and clicking
went there. ARMED, it becomes a standing instruction -- take me where the work is, without my asking
each time. That is why it can be armed with nothing connected: the intent is real before there is
anything to follow, and an agent creating a diagram no longer has to ask a person to navigate to it.

NEWEST LOCK WINS, ruled by the director. Locks are per DIAGRAM and one agent may hold several at
once -- measured: `Locks.acquire(id)` keys on the diagram alone, and one principal took two. So
"follow the agent" is ambiguous the moment anything runs in parallel, and newest is the signal that
means work just STARTED somewhere. A later revision makes the button a list of agents to choose
from, which is the real answer to contention.

WHY THIS IS ITS OWN FILE. `main.js` is the composition root: it touches the DOM on import and
exports nothing, so a rule living there cannot be driven by a test. This one is a pure function of
(state, agents, currentId) returning where to go, so the wiring keeps the DOM and the decision is
checkable without a browser.
*/

export function makeSpectator() {
	return { armed: false, seen: new Set() };
}

const keyOf = (a) => `${a.principal}@${a.diagram}`;

/*
Which diagram to follow, given the agent list that just arrived. Null means stay put.

`seen` is what makes this fire on a NEW lock rather than on every state emit: the agent list arrives
with each snapshot, so following whatever is in it would re-navigate on every heartbeat. It is
REPLACED rather than added to, so a released-then-retaken lock follows again -- an agent coming back
to a diagram is new work, and remembering it forever would silently stop following.

`gesturing` defers rather than queues, the same rule inbound changes already follow (B19/B71): a
diagram switching under a live drag fights the preview. The lock is still recorded, so a follow is
not owed later for work that has since moved on -- arriving three locks stale is worse than not
arriving.
*/
export function followTarget(state, agents, currentId, gesturing = false) {
	const list = Array.isArray(agents) ? agents : [];
	const fresh = list.filter((a) => !state.seen.has(keyOf(a)));
	state.seen = new Set(list.map(keyOf));
	if (!state.armed || !fresh.length) return null;
	const target = fresh[fresh.length - 1].diagram;
	if (target === currentId || gesturing) return null;
	return target;
}
