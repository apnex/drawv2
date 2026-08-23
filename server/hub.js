/*
Hub — the live websocket session registry. The server is normally silent
(it only answers requests), but a server-side write (Server-Locked) must reach
the browsers viewing that diagram. The Hub is the one place that pushes
server-originated messages out, keeping that capability isolated.

Sovereign: zero imports. It speaks a narrow duck-typed Session interface —
each session exposes `.diagramId` (which diagram it views) and `.send(cmd, body)`.
*/

export class Hub {
	constructor() {
		this.sessions = new Set();
	}

	add(session) {
		this.sessions.add(session);
	}

	remove(session) {
		this.sessions.delete(session);
	}

	/*
	B32 -- move every session viewing a diagram somewhere else, because that diagram is gone.

	`broadcast` cannot do this: it sends ONE body to many sessions, and a snapshot is per-principal
	-- what a session may be shown depends on who it is. So the caller supplies a builder and this
	supplies the sessions, which keeps the authorization decision at the caller and leaves the Hub
	a registry.

	A builder returning null means this session may not read the survivor, and it is left alone
	rather than being handed something it is not entitled to. It will discover the deletion the next
	time it asks; being stranded is better than being shown someone else's document.
	*/
	retarget(diagramId, build) {
		let moved = 0;
		this.sessions.forEach((s) => {
			if (s.diagramId !== diagramId) return;
			try {
				const body = build(s);
				if (!body) return;
				s.diagramId = body.doc.meta.id;
				s.send('snapshot', body);
				moved++;
			} catch (err) {
				console.warn(`[ hub ] session retarget failed: ${err.message}`);
			}
		});
		return moved;
	}

	/*
	B116 -- fan out to every session, with a body built for EACH.

	`announce` sends one body to many sessions, which is right only for a payload carrying no
	identity. The agent list carries diagram ids, so with authorization on it told a session about
	diagrams it may not read -- the pull filtered by `canRead` and the push did not.

	Same builder shape as `retarget`, for the same reason: what a session may be shown depends on
	who it is, so the Hub supplies the sessions and the caller supplies the policy. A builder
	returning null sends nothing to that session.
	*/
	announceEach(cmd, build) {
		this.sessions.forEach((s) => {
			try {
				const body = build(s);
				if (body) s.send(cmd, body);
			} catch (err) {
				console.warn(`[ hub ] session announceEach failed: ${err.message}`);
			}
		});
	}

	/*
	B114 -- who is looking at what, derived from the live sessions.

	The mirror of `locks.activity()`. That answers what agents are DOING; this answers what anyone
	is WATCHING, which is what lets an agent avoid taking the wheel out from under a human, or work
	somewhere they are not.

	Derived rather than tracked, so it cannot disagree with the registry, and a session that drops
	stops being reported without anything having to notice it dropped.

	A human cannot decline to be observed (ruled 2026-08-23): the control surface is the grant and
	the code, not the visibility. Declining to mint is how you decline to be watched.
	*/
	viewers() {
		const out = [];
		this.sessions.forEach((s) => {
			if (s.diagramId) out.push({ principal: s.principal ?? null, diagram: s.diagramId });
		});
		return out;
	}

	/*
	B105 -- fan out to EVERY session, whatever it is viewing.

	`broadcast` is scoped to one diagram because a change to it means nothing to anyone elsewhere.
	Agent activity is the opposite: it is worth reporting precisely to the operator who is NOT
	looking at the diagram in question, so the scoping that makes broadcast correct makes it the
	wrong instrument here.

	Same per-session isolation, for the same reason: a dead socket must not silence the others.
	*/
	announce(cmd, body) {
		this.sessions.forEach((s) => {
			try {
				s.send(cmd, body);
			} catch (err) {
				console.warn(`[ hub ] session announce failed: ${err.message}`);
			}
		});
	}

	// Fan a message out to every session currently viewing this diagram, optionally excluding the
	// one that originated it (which already applied the change locally).
	//
	// Each send is isolated: after CS3 this is the ONLY channel by which a viewer learns anything,
	// and the caller has already applied, logged and flushed the transaction. A dead socket must
	// not silence the other viewers, and must never turn a committed write into a 500.
	broadcast(diagramId, cmd, body, except = null) {
		this.sessions.forEach((s) => {
			if (s.diagramId !== diagramId || s === except) return;
			try {
				s.send(cmd, body);
			} catch (err) {
				console.warn(`[ hub ] session send failed: ${err.message}`);
			}
		});
	}
}
