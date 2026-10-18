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
	the code, not the visibility. Declining to mint is how you decline to be watched. A seat on a
	template is the exception, shown only to the person in it (`viewersFor` below, B384).
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
	/*
	B178 -- retire every session on a diagram this instance no longer owns.

	Scoped to the diagram rather than the whole instance: losing one document says nothing about
	the others, and retiring a session that was never affected would be a reload nobody needed.

	Deliberately a MESSAGE, not a socket close. A close is a reconnect, and a reconnect from a page
	whose JavaScript came from the superseded revision lands the same stale client on a new socket
	-- the connection refreshed and the application not. Telling the page to reload replaces both,
	and `app/src/watchdog.js` preflights before acting so it never reloads into a void.
	*/
	retire(diagramId, reason) {
		let told = 0;
		this.sessions.forEach((s) => {
			if (s.diagramId !== diagramId) return;
			try { s.send('retire', { reason }); told++; }
			catch (err) { console.warn(`[ hub ] retire send failed: ${err.message}`); }
		});
		return told;
	}

	broadcast(diagramId, cmd, body, except = null) {
		this.sessions.forEach((s) => {
			if (s.diagramId !== diagramId || s === except) return;
			// B385 (H24.15): read access checked at every send -- a session that has lost it leaves the diagram and is sent nothing of it
			if (s.store && !s.store.canRead(diagramId, s.principal)) return void s.leaveUnreadable?.();
			try {
				s.send(cmd, body);
			} catch (err) {
				console.warn(`[ hub ] session send failed: ${err.message}`);
			}
		});
	}
}

/*
B116/B114, B342 (H21.8) -- the one place agent activity and viewer presence are pushed, filtered per session.
Lives in the hub so the hub's sessions (`server/protocol.js`), the server (`server/app.js`) and REST (`server/rest.js`) all
call it without the hub importing the REST door.
*/
/*
B384 (H24.14) -- the presence one principal may be shown, the one rule the pull, the snapshot and the push all apply.

A seat on a diagram the principal can read, as B114 rules -- except a seat on a template, which is shown only to the person in
it. Every principal reads a template, so B114 alone told everyone who sat on one, by email, a first-time user among them; and
nobody works together on a template, since the first write forks a private copy, so the seat serves no one else. With
authorization off every seat is shown, as everything is. A function over `hub.viewers()`, not a method, so anything shaped
like a hub answers it.
*/
export function viewersFor(hub, store, principal) {
	return hub.viewers().filter((v) => store.canRead(v.diagram, principal)
		&& (!store.authz || !store.isTemplate(v.diagram) || v.principal === principal));
}

/*
B385 (H24.15) -- access moved. Every session on a diagram its principal can no longer read leaves it first, so its re-open asks
for where it now is; then every session is told to ask again, contentless (B94). The one call every door makes when a grant, a
workspace grant or publication changes, where each sent the signal alone.
*/
export function announceAccess(hub) {
	if (!hub) return;
	hub.sessions?.forEach((s) => {
		if (s.diagramId && s.store && !s.store.canRead(s.diagramId, s.principal)) s.leaveUnreadable?.();
	});
	hub.announce('access', {});
}

export function announceActivity(hub, store, locks) {
	if (!hub) return;
	const agents = locks ? locks.activity() : [];
	hub.announceEach('agents', (s) => ({ agents: agents.filter((a) => store.canRead(a.diagram, s.principal)) }));
	hub.announceEach('viewers', (s) => ({ viewers: viewersFor(hub, store, s.principal) }));   // B384: on each receiver's terms
}

