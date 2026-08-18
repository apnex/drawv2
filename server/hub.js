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

	// fan a message out to every session currently viewing this diagram
	broadcast(diagramId, cmd, body) {
		this.sessions.forEach((s) => {
			if (s.diagramId === diagramId) s.send(cmd, body);
		});
	}
}
