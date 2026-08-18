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
