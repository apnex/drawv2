/*
REST API. Reads are always open (GET, curl/jq-friendly). WRITES require the
diagram to be Server-Locked by the caller (POST .../lock → token → X-Draw-Lock
header on every write); they funnel into the SAME validated store.commit() the
websocket uses — THE ONE WRITE — then broadcast the resulting change to the
browsers viewing that diagram. The browser path (websocket) is refused while a diagram is locked, so
exactly one side writes at a time.
*/

import { snapshotBody, changeBody, reversalBody } from './protocol.js';
import { LAYOUTS, nearestAnchor, anchorAt } from '../kernel/index.mjs';
import { NODE_EXT } from '../model/index.mjs';

const COLLECTIONS = { nodes: 'node', links: 'link', zones: 'zone', groups: 'group' };

/*
No `Access-Control-Allow-Origin` -- H9.28/B33. It used to answer `*` on every response.

Removed rather than narrowed to a reflected allow-list, because no cross-origin browser client
exists: the editor is served from this same origin, and a CLI or an agent is not a browser and does
not consult CORS at all. A reflection mechanism with no consumer is the speculative surface A3
refuses. Absent the header, a browser blocks a cross-origin read, which is the whole of the fix.
*/
/*
B112 -- who holds an anchor. A waypoint counts, because a waypoint IS a node for placement.

Resolved coordinates rather than cell indices, matching `violations()` exactly: the two agree only
while every entity is on-grid, and this must report the same occupancy the rule enforces rather
than a rounding of it.
*/
/*
B116/B114 -- the one place agent activity and viewer presence are pushed, filtered per session.

Both lists name diagrams, so both must be filtered by what the RECEIVING session may read. B105
filtered the pull and not the push, which told a session the ids of diagrams it had no grant for.
Exported so the websocket and the sweep timer push exactly what REST pushes -- three call sites, one
sentence, which is the thing that went wrong when there were three sentences.
*/
export function announceActivity(hub, store, locks) {
	if (!hub) return;
	const agents = locks ? locks.activity() : [];
	hub.announceEach('agents', (s) => ({ agents: agents.filter((a) => store.canRead(a.diagram, s.principal)) }));
	const viewers = hub.viewers();
	hub.announceEach('viewers', (s) => ({ viewers: viewers.filter((v) => store.canRead(v.diagram, s.principal)) }));
}

// which collection an id belongs to, without the caller having to say
function entityIn(model, id) {
	for (const kind of ['node', 'waypoint', 'link', 'zone', 'group']) {
		const entity = model.get(kind, id);
		if (entity) return { kind, entity };
	}
	return null;
}

const inside = (model, z) => ['node', 'waypoint'].flatMap((kind) => model.all(kind)
	.filter((e) => e.x >= z.x && e.x <= z.x + z.w && e.y >= z.y && e.y <= z.y + z.h)
	.map((e) => ({ kind, id: e.id, name: e.name, x: e.x, y: e.y })));

/*
Everything about one entity that a caller would otherwise derive.

Assembled from Model methods only. Each field answers a question an agent asks before it acts:
what connects here, what owns this, what encloses it, and what is close enough to collide with.
*/
function contextOf(model, kind, e) {
	const out = { id: e.id, kind, name: e.name ?? null };
	if (kind === 'node' || kind === 'waypoint') {
		out.at = { x: e.x, y: e.y };
		const links = kind === 'node' ? model.linksOf(e.id) : model.linksAt(e.id);
		out.links = links.map((l) => ({ id: l.id, src: l.src, dst: l.dst, routed: !!(l.via && l.via.length) }));
		out.neighbours = [...new Set(links.flatMap((l) => [l.src, l.dst]).filter((n) => n !== e.id))];
		out.group = kind === 'node' ? (model.groupOf(e.id)?.id ?? null) : null;
		out.zones = model.all('zone')
			.filter((z) => e.x >= z.x && e.x <= z.x + z.w && e.y >= z.y && e.y <= z.y + z.h)
			.map((z) => z.id);
	}
	if (kind === 'link') { out.endpoints = { src: e.src, dst: e.dst }; out.via = e.via || []; out.path = model.pathOf(e); }
	if (kind === 'zone') { out.bounds = { x: e.x, y: e.y, w: e.w, h: e.h }; out.contents = inside(model, e); }
	if (kind === 'group') {
		out.members = e.members || [];
		out.links = [...new Set((e.members || []).flatMap((m) => model.linksOf(m).map((l) => l.id)))];
	}
	return out;
}

function occupantAt(model, anchor) {
	for (const kind of ['node', 'waypoint']) {
		const hit = model.all(kind).find((e) => e.x === anchor.x && e.y === anchor.y);
		if (hit) return hit.id;
	}
	return null;
}

function json(res, code, body) {
	res.writeHead(code, {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store',
	});
	res.end(JSON.stringify(body, null, '\t') + '\n');
}

/*
Read a JSON request body — B24. Three defects lived in the five lines this replaces.

(1) On the size trip it called `req.destroy()` and resolved NOTHING. `'end'` does not fire on a
    destroyed request and `'error'` is not guaranteed, so the promise never settled: the `await` in
    handleWrite never continued and its closure leaked, permanently, per oversize request. A7's
    named `Blocked Actor` — an actor paused indefinitely with no resume path — and the router's
    `.catch()` could not save it, because nothing ever rejected.
(2) `buf += chunk` invokes the default UTF-8 decode on each Buffer independently, so a multibyte
    character split across a chunk boundary decoded to U+FFFD. A CJK name near a chunk edge landed
    silently mangled.
(3) The cap counted decoded CHARACTERS, not bytes, so it was not the limit it claimed to be.

Now: bytes accumulate as Buffers and are decoded ONCE, at the end; the cap is a byte cap; and every
terminal event settles exactly once — `'close'` is the backstop, so no transport outcome can leave
the promise pending. Oversize resolves a sentinel and the caller answers 413, because a destroyed
socket is not an actionable signal (A7): the caller cannot distinguish "too large" from "the network
died", and so cannot know whether to shrink the payload or retry it unchanged.
*/
const MAX_BODY_BYTES = 1e6;
const OVERSIZE = Symbol('body-too-large');

function readJson(req) {
	return new Promise((resolve) => {
		const chunks = [];
		let bytes = 0, settled = false;
		const settle = (v) => { if (!settled) { settled = true; resolve(v); } };
		req.on('data', (c) => {
			bytes += c.length;                       // c is a Buffer: length is BYTES
			if (bytes > MAX_BODY_BYTES) { req.pause(); return settle(OVERSIZE); }
			chunks.push(c);
		});
		req.on('end', () => { try { settle(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { settle(null); } });
		req.on('error', () => settle(null));
		req.on('aborted', () => settle(null));
		req.on('close', () => settle(null));         // the backstop — destroy/abort/reset all land here
	});
}

/*
Answer for a body that could not be READ (as opposed to one that was read and is invalid).
Returns true when it has responded, so the caller returns without answering twice.

The connection MUST close. We stopped reading partway through the body, so the rest of it is still
in flight on a keep-alive socket; answering 413 and leaving the connection open desynchronises the
pipeline and the NEXT request on that socket hangs forever — which is B24's own defect, moved one
request downstream. Draining the remainder is the alternative and it is worse: it spends unbounded
bandwidth and time reading a payload we have already refused.

`Connection: close` tells the client not to reuse the socket; destroying it once the response has
flushed discards whatever is still arriving. Found by the multibyte test in tests/locks.test.js,
which began timing out the moment this path was introduced.
*/
function bodyRejected(req, res, value) {
	if (value !== OVERSIZE) return false;
	res.setHeader('Connection', 'close');
	res.once('finish', () => req.destroy());
	json(res, 413, { error: `request body exceeds ${MAX_BODY_BYTES} bytes`, code: 'body-too-large', limit: MAX_BODY_BYTES });
	return true;
}

// build a full entity from the high-level verb payload, via the model's factories
// (which mint the id/name); the planner then validates it like any other op
function buildEntity(model, kind, d) {
	if (kind === 'node') return model.makeNode(d.type, { x: d.x, y: d.y }, d.shape);
	if (kind === 'link') return model.makeLink(d.src, d.dst);
	if (kind === 'zone') return model.makeZone({ x: d.x, y: d.y, w: d.w, h: d.h });
	if (kind === 'group') return Array.isArray(d.members) ? model.makeGroup(d.members) : null;
	return null;
}

// commit one transaction, broadcast the change to viewers, respond.
// Re-verifies the token HERE — the lock gate ran before the (awaited) body read,
// so the lock may have been reclaimed/released/expired in between; the verify +
// store.commit run synchronously, so no writer can slip in between them.
// "delete · 3 nodes, 2 links" — the agent-facing gloss, derived here so every reader agrees.
// The agent-facing projection of a record. ONE definition, used by GET .../history and by the 409
// recovery body — `inverse` is absent by construction rather than by two call sites remembering.
function projectRecord(c, verbose = false) {
	return {
		seq: c.seq, at: c.at, by: c.by, actor: c.actor, label: c.label,
		summary: summarise(c.ops),
		...(verbose ? { ops: c.ops } : {}),      // `inverse` NEVER goes on the wire (GR13)
	};
}

/*
What a stale `expect` needs to know.

A bare 409 tells a caller it lost a race and nothing else, so its only recovery is to refetch the
whole document and diff. The records between what it believed and where the log actually is ARE
the answer: who moved it, when, and what they did. Capped, because a caller that is thousands
behind wants a resync, not a transcript.
*/
function recoveryRecords(log, expect, cap = 20) {
	if (!log || !Number.isInteger(expect)) return [];
	return log.records.filter((c) => c.seq > expect).slice(-cap).map((c) => projectRecord(c));
}

function summarise(ops) {
	const counts = {};
	for (const o of ops) {
		const k = `${o.op} ${o.kind || 'meta'}`;
		counts[k] = (counts[k] || 0) + 1;
	}
	return Object.entries(counts).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(', ');
}

/*
`expect` rides the X-Draw-Expect HEADER on forward writes, not the body.

A forward write's body IS an entity payload — `POST /nodes -d '{"type":"host","x":60}'` — so a
reserved `expect` key there would collide with field validation and differ per verb. The header is
uniform across /commit, POST, PATCH and DELETE, and mirrors how the lock token already travels.
undo/redo keep the body form because THEIR body is control, not payload. One statable rule: control
fields ride the body only where the body is control.

B16: this was silently DISCARDED. commitWrite built {ops, label} and dropped everything else, so an
agent believing it held a compare-and-swap held nothing (D14).
*/
const expectOf = (req) => {
	const raw = req.headers['x-draw-expect'];
	if (raw === undefined) return undefined;
	const n = Number(raw);
	return Number.isInteger(n) ? n : NaN;        // NaN => present but unusable; never silently ignored
};

/*
The one write tail for every REST forward write — B16.

It takes OPS, the same vocabulary the websocket's `commit` takes, because /commit is documented as
exactly that and was not: it accepted a single legacy `{action, kind, entity}` mutation, so the ws
shape answered 422 and MULTI-OP TRANSACTIONS were unreachable over REST. An agent had to issue N
round trips, each a window another writer could interleave — the hazard `undo {to}` exists to
mitigate. The legacy adapter is retired rather than aliased (X1: an alias is a second surface to
keep true); the high-level verbs now build ops directly, which is all the adapter ever did for them.
*/
async function commitWrite(res, store, hub, locks, id, token, ops, label, extra, expect, principal) {
	if (!locks.verify(id, token)) return json(res, 423, { error: 'lock not held (lost during the request)' });
	if (Number.isNaN(expect)) return json(res, 400, { error: 'X-Draw-Expect must be an integer version', code: 'expect-malformed' });
	const result = store.commit(id, { ops, label, ...(expect === undefined ? {} : { expect }) }, 'server', `rest-${token.slice(0, 8)}`, principal);
	if (!result.ok) {
		/*
		Three different refusals, three different codes, because an agent acts on the code -- H9.3b.

		403 says you may not, and no retry will help until a grant changes. 409 says the world moved
		under you, so re-read and try again. 422 says the request itself was malformed. Collapsing
		the first into either of the others makes a caller either retry forever or give up on a
		conflict it could have resolved.
		*/
		if (result.forbidden) return json(res, 403, { error: result.error, code: 'forbidden' });
		const conflict = /version conflict/i.test(result.error);
		// B103: the planner knows WHICH op failed; passing only the message made the agent re-derive it
		return json(res, conflict ? 409 : 422, { error: result.error,
			...(typeof result.opIndex === 'number' && result.opIndex >= 0 ? { opIndex: result.opIndex } : {}),
			...(conflict ? { code: 'version-conflict', version: result.version } : {}) });
	}
	// durability: a REST/agentic caller is one-shot — it has no reconnect backstop, so an acked
	// write must be on disk, not merely in the ~200ms debounce window. Flush before acking. (The ws
	// path keeps the debounce — drag writes are high-frequency and self-heal on reconnect.)
	await store.flush(id);
	// a value-identical write is accepted and is not a change
	if (!result.change) return json(res, 200, { version: result.version, noop: true, ...(extra || {}) });
	const body = changeBody(result.change, store, id);
	if (hub) hub.broadcast(id, 'change', body);
	return json(res, 200, { ...body, ...(extra || {}) });
}

// set the authoritative selection (model-state / status). Mirrors commitWrite: re-verify the token
// (the lock gate ran before the awaited body read), set + flush-before-ack (a one-shot agentic caller
// has no reconnect backstop), then broadcast a snapshot so every viewer reflects the agent's focus via
// the persisted doc.selection. No version bump — selection is status, not config (matches the ws 'select').
async function commitSelection(res, store, hub, locks, id, token, ids, principal) {
	if (!locks.verify(id, token)) return json(res, 423, { error: 'lock not held (lost during the request)' });
	const err = store.setSelection(id, ids, principal);
	// a forbidden selection is 403 for the same reason a forbidden commit is: no retry helps
	if (err && /^forbidden/.test(err)) return json(res, 403, { error: err, code: 'forbidden' });
	if (err) return json(res, 422, { error: err });
	await store.flush(id);
	const model = store.get(id);
	// B34 — a selection EVENT, not the whole document. Selection is the highest-frequency,
	// lowest-information write in the system: an agent sweeping focus re-transmitted the entire
	// document per step (A12 `Projection, not dump`; D7 already ruled the server broadcasts a change,
	// not a snapshot, and this was the one write path that never got the memo). `actor` rides it
	// because a viewer watching an agent work needs to know WHOSE focus moved.
	if (hub) hub.broadcast(id, 'selection', { ids: [...model.state.selection], actor: `rest-${token.slice(0, 8)}` });
	return json(res, 200, { version: model.state.meta.version, selection: [...model.state.selection] });
}

// returns true if the request was handled (may complete asynchronously)
export function handleRest(req, res, store, slides, locks, hub, principal = null) {
	const url = new URL(req.url, 'http://localhost');
	const parts = url.pathname.split('/').filter(Boolean);

	if (url.pathname === '/health') {
		// flushFailures: a retried flush repairs the mechanism but leaves the failure invisible.
		// Surfacing it is what makes B4's retry observable rather than merely survivable.
		// invariantFailures: a GR9 breach reported as ITSELF (B20). `degraded` says the environment
		// is failing us and a retry may fix it; `corrupt` says this process mis-minted a seq and no
		// retry will. They shared a counter and a status until B20, so an operator could not tell a
		// flaky disk from a bug in the log — the two need opposite responses.
		const flushFailures = store.flushFailures();
		const invariantFailures = store.invariantFailures();
		const status = invariantFailures ? 'corrupt' : flushFailures ? 'degraded' : 'ok';
		return json(res, 200, { status, diagrams: store.total(), flushFailures, invariantFailures }), true;
	}
	if (parts[0] !== 'api') return false;

	/*
	Workspace grants -- H9.4c. A workspace is the set of diagrams owned by a principal.

	No owner appears in the path, deliberately: the caller IS the owner, so `POST` grants on your own
	workspace and nothing else. That makes "who may administer another principal's workspace" an
	unrepresentable question rather than a check somebody has to remember to write.

	There IS a GET here, where the diagram grants deliberately have none, and the asymmetry is not an
	inconsistency. A diagram carries its own grants in `meta`, so `GET /diagrams/:id` already answers
	that question and a second route would be two spellings of one fact. A workspace grant lives in
	no diagram -- it is about all of them, including ones that do not exist yet -- so without this
	route there is no way to read it at all.

	Not lock-gated and not diagram-scoped, so it sits above the diagram router entirely.
	*/
	if (parts[1] === 'v1' && parts[2] === 'workspace') {
		/*
		B105 -- what every agent is doing, across the workspace rather than on one diagram.

		A read, and a poll-able one, so a client without a live socket is not blind. The websocket
		carries the same list in the snapshot and in the `agents` announcement, and all three come
		from `locks.activity()` so they cannot disagree.

		Filtered by `canRead`, which is the same predicate every other read uses, rather than by
		requiring a principal. Demanding one would make the indicator blank with authorization OFF,
		where there is no principal by definition and the single operator is exactly who it exists
		to inform. `canRead` answers true for everyone in that configuration and answers honestly in
		the other, so one line covers both instead of a branch on which mode is running.
		*/
		// B114: the mirror of `agents` -- who is WATCHING what, filtered the same way
		if (parts[3] === 'viewers' && req.method === 'GET') {
			const live = hub ? hub.viewers() : [];
			return json(res, 200, { viewers: live.filter((v) => store.canRead(v.diagram, principal)) }), true;
		}
		if (parts[3] === 'agents' && req.method === 'GET') {
			const live = locks ? locks.activity() : [];
			return json(res, 200, { agents: live.filter((a) => store.canRead(a.diagram, principal)) }), true;
		}
		if (parts[3] !== 'grants' && parts[3] !== 'codes') return json(res, 404, { error: 'not found' }), true;
		if (!principal) return json(res, 403, { error: 'forbidden: no identity', code: 'forbidden' }), true;
		handleWorkspace(req, res, store, parts, principal).catch((err) => {
			console.warn(`[ rest ] workspace grant failed: ${err && err.message}`);
			try { if (!res.headersSent) json(res, 500, { error: 'internal error' }); } catch { /* response already gone */ }
		});
		return true;
	}

	if (parts[1] !== 'v1' || parts[2] !== 'diagrams') {
		return json(res, 404, { error: 'not found' }), true;
	}

	// the Slides sync action keeps its dedicated route
	if (req.method === 'POST' && parts.length === 6 && parts[4] === 'sync' && parts[5] === 'slides') {
		handleSlidesPush(req, res, store, slides, parts[3], principal);
		return true;
	}

	/*
	Create a diagram -- H9.21. ACCESS.md: an agent may create, and owns what it creates.

	Above the lock gate and above handleWrite, because there is no diagram yet to lock and
	handleWrite's first act is to resolve `parts[3]`, which here does not exist.

	The body mirrors the websocket `create` exactly -- an optional `name`, an optional whole `doc` --
	rather than inventing a second spelling for one operation. `store.create` mints the id and
	ignores `doc.meta.id` (I11), which is what stops offline work from landing on top of whichever
	diagram the server last answered with; that overwrite was B2, and it would return the moment
	this route accepted a caller-chosen id.

	Ownership comes from the authenticated principal and never from the body. `cleanMeta`'s trusted
	flag refuses an owner off the wire (H9.1), so this is the only way ownership is established and
	it cannot be forged (B65).

	DELETE is deliberately absent and stays open as B32. X12 refused the analogous case for
	`draw undo` on the grounds that a destructive verb keeps its gates, and extending create to
	destroy is a ruling the director has not made.
	*/
	if (req.method === 'POST' && parts.length === 3) {
		if (store.authz && !principal) {
			return json(res, 403, { error: 'forbidden: no identity', code: 'forbidden' }), true;
		}
		(async () => {
			const body = await readJson(req);
			if (bodyRejected(req, res, body)) return;
			const name = typeof body?.name === 'string' ? body.name.slice(0, 64) : undefined;
			const result = store.create(name, body?.doc || null, principal);
			if (!result.ok) {
				const capped = /limit reached/.test(result.error);
				return json(res, capped ? 507 : 422, { error: result.error, code: capped ? 'diagram-cap' : 'create-rejected' });
			}
			// 201 with the whole doc: an agent needs the minted id, and handing back the document it
			// now owns saves it a round trip to discover what it just made
			return json(res, 201, { id: result.model.state.meta.id, doc: result.model.toJSON() });
		})().catch((err) => {
			console.warn(`[ rest ] create failed: ${err && err.message}`);
			try { if (!res.headersSent) json(res, 500, { error: 'internal error' }); } catch { /* response already gone */ }
		});
		return true;
	}

	// ---- writes: lock lifecycle + model mutations (Server-Locked) ----
	// PUT is a write method ONLY for .../selection; every other PUT keeps the clean 405 below
	// (it falls to the req.method !== 'GET' branch) rather than being misrouted through the lock gate.
	if (req.method === 'POST' || (req.method === 'PUT' && parts[4] === 'selection') || req.method === 'PATCH' || req.method === 'DELETE') {
		// handleWrite is async + fire-and-forget: a throw must never become an
		// unhandled rejection (which would crash the whole server)
		handleWrite(req, res, store, locks, hub, parts, principal).catch((err) => {
			console.warn(`[ rest ] write failed: ${err && err.message}`);
			try { if (!res.headersSent) json(res, 500, { error: 'internal error' }); } catch { /* response already gone */ }
		});
		return true;
	}

	if (req.method !== 'GET') {
		return json(res, 405, { error: 'method not allowed' }), true;
	}

	// ---- reads (GET) ----
	if (parts.length === 3) {
		return json(res, 200, store.list(principal)), true;
	}
	const model = store.get(parts[3]);
	if (!model) return json(res, 404, { error: `unknown diagram: ${parts[3]}` }), true;
	// B67: gated once here, covering the document AND everything below it -- lock state, history,
	// and the log all describe a diagram the caller may not be entitled to know about
	if (!store.canRead(parts[3], principal)) {
		return json(res, 403, { error: 'forbidden: no access to this diagram', code: 'forbidden' }), true;
	}
	if (parts.length === 4) {
		return json(res, 200, model.toJSON()), true;
	}

	// reads are always open (no lock): an agent must be able to see lock state and history without
	// attempting a write and reading a 423.
	/*
	B111/B112 -- anchors, so an agent never computes a coordinate.

	Two arithmetic steps produced every off-grid entity this surface exists to prevent: multiplying
	a cell by the pitch, and knowing that zones use a different origin from nodes. A caller that
	asks for an anchor does neither, and an anchor is on-grid by construction rather than by care.

	Reads, so no lock -- the same rule the rest of GET follows. `free` is the occupancy index
	projected rather than a computation: an anchor is taken when a node or waypoint resolves to it,
	which is exactly the rule `violations()` enforces.
	*/
	if (parts[4] === 'layouts' && parts.length === 5) {
		return json(res, 200, { layouts: Object.keys(LAYOUTS) }), true;
	}
	if (parts[4] === 'layouts' && parts.length >= 6) {
		const L = LAYOUTS[parts[5]];
		if (!L) return json(res, 404, { error: `unknown layout: ${parts[5]}`, code: 'unknown-layout' }), true;
		const model = store.get(parts[3]);
		if (!model) return json(res, 404, { error: `unknown diagram: ${parts[3]}` }), true;

		if (parts[6] === 'nearest' && parts.length === 7) {
			const x = Number(url.searchParams.get('x')), y = Number(url.searchParams.get('y'));
			if (!Number.isFinite(x) || !Number.isFinite(y)) {
				return json(res, 422, { error: 'nearest requires numeric x and y', code: 'bad-query' }), true;
			}
			const a = nearestAnchor(L, x, y);
			return json(res, 200, { ...a, occupant: occupantAt(model, a) }), true;
		}
		if (parts[6] === 'anchors' && parts.length === 7) {
			const wantFree = url.searchParams.get('free') === '1';
			const out = [];
			// the node extent bounds BOTH grids here: a zone anchor outside it cannot hold a node
			// anyway, and one list with one rule beats two that drift
			for (let cy = -Math.floor(NODE_EXT.y / 60); cy <= Math.floor(NODE_EXT.y / 60); cy++) {
				for (let cx = -Math.floor(NODE_EXT.x / 60); cx <= Math.floor(NODE_EXT.x / 60); cx++) {
					const a = anchorAt(L, cx, cy);
					const occupant = occupantAt(model, a);
					if (wantFree && occupant) continue;
					out.push(occupant ? { ...a, occupant } : a);
				}
			}
			return json(res, 200, { layout: L.name, count: out.length, anchors: out }), true;
		}
		return json(res, 404, { error: `unknown layout route: ${parts.slice(6).join('/')}` }), true;
	}
	if (parts[4] === 'lock' && parts.length === 5) {
		return json(res, 200, {
			owner: locks && locks.locked(parts[3]) ? 'server' : 'client',
			// two different waits, and B102 was that only one of them was visible:
			// `expiresAt` is when the holder's lock lapses, `heldUntil` is the D22 human hold
			expiresAt: locks && locks.expiresAt ? locks.expiresAt(parts[3]) : null,
			heldUntil: locks && locks.heldUntil ? locks.heldUntil(parts[3]) : null,
		}), true;
	}
	/*
	CONTEXT -- what surrounds a thing, assembled once.

	CLI.md's ruling: the tool exists to reduce agent error, not to mirror the API. Deriving this
	client-side means fetching the whole document and computing four relationships -- which links
	touch a node, which group holds it, which zone contains it, what sits nearby -- on every call,
	and each derivation is one an agent can get subtly wrong.

	Composition, never new semantics. `linksOf`, `linksAt`, `groupOf` and `pathOf` are sovereign
	methods on the Model, so this assembles what the model already knows and never restates a
	relationship in a second place. The engine's indexed versions are a browser-side optimisation
	over the same definitions, not a rival to them.
	*/
	if (parts[4] === 'context' && parts.length === 6) {
		const found = entityIn(model, parts[5]);
		if (!found) return json(res, 404, { error: `unknown entity: ${parts[5]}` }), true;
		return json(res, 200, contextOf(model, found.kind, found.entity)), true;
	}
	if (parts[4] === 'near' && parts.length === 5) {
		const x = Number(url.searchParams.get('x')), y = Number(url.searchParams.get('y'));
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			return json(res, 422, { error: 'near requires numeric x and y', code: 'bad-query' }), true;
		}
		const within = Number(url.searchParams.get('within')) || 120;
		const doc = model.toJSON();
		const hits = [];
		for (const kind of ['node', 'waypoint']) {
			for (const e of model.all(kind)) {
				const d = Math.hypot(e.x - x, e.y - y);
				if (d <= within) hits.push({ kind, id: e.id, name: e.name, x: e.x, y: e.y, distance: Math.round(d) });
			}
		}
		const zones = doc.zones.filter((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h)
			.map((z) => ({ kind: 'zone', id: z.id, name: z.name }));
		return json(res, 200, { x, y, within, occupants: hits.sort((a, b) => a.distance - b.distance), zones }), true;
	}
	if (parts[4] === 'zones' && parts[5] && parts[6] === 'contents' && parts.length === 7) {
		const z = model.get('zone', parts[5]);
		if (!z) return json(res, 404, { error: `unknown zone: ${parts[5]}` }), true;
		return json(res, 200, { zone: z.id, name: z.name, contents: inside(model, z) }), true;
	}
	if (parts[4] === 'links' && parts[5] && parts[6] === 'path' && parts.length === 7) {
		const l = model.get('link', parts[5]);
		if (!l) return json(res, 404, { error: `unknown link: ${parts[5]}` }), true;
		// pathOf resolves a ROUTE (identities) into a PATH (coordinates) -- the semantic routing
		// question an agent cannot otherwise ask: what would the renderer actually draw
		return json(res, 200, { link: l.id, src: l.src, dst: l.dst, via: l.via || [], path: model.pathOf(l) }), true;
	}
	if (parts[4] === 'history' && parts.length === 5) {
		const log = store.log(parts[3]);
		const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
		const verbose = url.searchParams.get('verbose') === '1';
		const records = (log?.records ?? []).slice(-limit).map((c) => projectRecord(c, verbose));
		return json(res, 200, {
			version: log?.version ?? 0, canUndo: !!log?.canUndo(), canRedo: !!log?.canRedo(),
			evicted: log?.evicted ?? 0, truncated: !!log?.truncated,
			evictedHuman: log?.evictedHuman ?? 0, truncatedHuman: !!log?.truncatedHuman,
			undoLabel: log?.peekUndo() ? projectRecord(log.peekUndo()) : null,
			records,
		}), true;
	}
	// model-state (status): the authoritative selection, readable like any collection
	if (parts.length === 5 && parts[4] === 'selection') {
		return json(res, 200, { selection: [...model.state.selection] }), true;
	}
	const kind = COLLECTIONS[parts[4]];
	if (!kind) return json(res, 404, { error: `unknown collection: ${parts[4]}` }), true;
	if (parts.length === 5) {
		return json(res, 200, model.all(kind)), true;
	}
	if (parts.length === 6) {
		const entity = model.get(kind, parts[5]);
		if (!entity) return json(res, 404, { error: `unknown entity: ${parts[5]}` }), true;
		return json(res, 200, entity), true;
	}
	return json(res, 404, { error: 'not found' }), true;
}

async function handleWorkspace(req, res, store, parts, principal) {
	/*
	Connection codes -- H9.5. Minting sits on the workspace, not on a diagram: a code authenticates
	an agent identity, which is not a property of any one document.

	The caller is the claimant, and never a body field. B99: the first mint takes the agent name for
	whoever minted it, and afterwards only that principal may mint against it, so a second person
	cannot obtain a credential authenticating as an identity somebody else granted access to.

	The plaintext appears in the mint response and nowhere else -- not in the list, not in the store,
	not in a log. That is the whole of "shown once", and it is why the response is worth reading
	carefully at the call site: there is no second chance to collect it.
	*/
	if (parts[3] === 'codes') {
		if (req.method === 'GET' && parts.length === 4) {
			return json(res, 200, { codes: store.listCodes(principal) });
		}
		if (req.method === 'POST' && parts.length === 4) {
			const body = await readJson(req);
			if (bodyRejected(req, res, body)) return;
			if (!body || typeof body.agent !== 'string') {
				return json(res, 400, { error: 'expected JSON body { agent, expires? }', code: 'code-malformed' });
			}
			const r = await store.mintCode(body.agent, principal, { expires: body.expires ?? null });
			if (!r.ok) return json(res, r.forbidden ? 403 : 422, { error: r.error, code: r.forbidden ? 'forbidden' : 'code-rejected' });
			// 201, and the ONE time the plaintext exists outside the caller's hands
			return json(res, 201, { id: r.id, agent: r.agent, code: r.code });
		}
		if (req.method === 'DELETE' && parts.length === 5) {
			const err = await store.revokeCode(decodeURIComponent(parts[4]), principal);
			if (err) return json(res, /^only the claimant/.test(err) ? 403 : 404, { error: err, code: 'code-rejected' });
			return json(res, 200, { codes: store.listCodes(principal) });
		}
		return json(res, 405, { error: 'codes: GET to list, POST { agent } to mint, DELETE .../codes/<id> to revoke' });
	}

	if (req.method === 'GET' && parts.length === 4) {
		return json(res, 200, { owner: principal, grants: store.workspaceGrants(principal) });
	}
	if (req.method === 'POST' && parts.length === 4) {
		const body = await readJson(req);
		if (bodyRejected(req, res, body)) return;
		if (!body || typeof body.principal !== 'string' || typeof body.level !== 'string') {
			return json(res, 400, { error: 'expected JSON body { principal, level }', code: 'grant-malformed' });
		}
		// the owner is the caller, never the body: a body-supplied owner would be a request to
		// grant on somebody else's workspace, which is the one thing this route must not allow
		const err = await store.grantOwner(principal, body.principal, body.level);
		if (err) return json(res, 422, { error: err, code: 'grant-rejected' });
		return json(res, 200, { owner: principal, grants: store.workspaceGrants(principal) });
	}
	if (req.method === 'DELETE' && parts.length === 5) {
		let target;
		try { target = decodeURIComponent(parts[4]); }
		catch { return json(res, 400, { error: 'principal is not valid percent-encoding', code: 'grant-malformed' }); }
		const err = await store.revokeOwner(principal, target);
		if (err) return json(res, 422, { error: err, code: 'grant-rejected' });
		return json(res, 200, { owner: principal, grants: store.workspaceGrants(principal) });
	}
	return json(res, 405, { error: 'workspace grants: GET to read, POST { principal, level } to grant, DELETE .../grants/<principal> to revoke' });
}

async function handleWrite(req, res, store, locks, hub, parts, principal) {
	const id = parts[3];
	if (!store.get(id)) return json(res, 404, { error: `unknown diagram: ${id}` });

	/*
	B32 -- DELETE a diagram. Ruled 2026-08-23 after being refused for a long time.

	The director's argument: an agent can already delete every entity inside a diagram, so the
	container adds no new capability. That reasoning does not survive on its own -- emptying a
	diagram is undoable in-app and instant, while deleting it destroys the undo log with it -- and
	what actually makes the verb acceptable is a GCS soft-delete policy with seven days of
	retention. That backstop is invisible in the product today, which is B109.

	WRITE, not owner, and deliberately the same gate `store.remove` already applies to the
	websocket's `delete`. The ruling's own logic sets the threshold: whoever may empty it may remove
	it, and emptying needs write. Two transports disagreeing about who may delete would be the
	divergence this codebase keeps finding.

	Refused while another controller holds the lock, mirroring the websocket rule, EXCEPT for the
	holder itself -- an agent deleting a diagram it is driving is the ordinary case, and making it
	release first would be ceremony rather than safety.

	The store never goes empty: `remove` reseeds if it would, so `first()` always answers.
	*/
	if (req.method === 'DELETE' && parts.length === 4) {
		const token = req.headers['x-draw-lock'] || '';
		if (locks && locks.locked(id) && !locks.verify(id, token)) {
			return json(res, 423, { error: 'server-locked by another controller', code: 'locked' });
		}
		const err = await store.remove(id, principal);
		if (err) {
			const denied = /forbidden|access/i.test(err);
			return json(res, denied ? 403 : 404, { error: err, code: denied ? 'forbidden' : 'unknown-diagram' });
		}
		if (locks) locks.release(id, token);
		if (hub) {
			/*
			Viewers land on a survivor built for THEIR principal, never a shared one -- which is why
			this needs a builder rather than a broadcast: a snapshot is per-principal.

			The `canRead` below is deliberately redundant. `snapshotBody` already throws for a
			principal with no grant (B67, defence in depth), and `retarget` catches, so a viewer who
			may not read the survivor is skipped either way. Removing this line changes no behaviour
			and a mutant against it correctly survives. It is kept because the alternative is a call
			site that looks like it hands every viewer the same document and relies on a throw two
			files away to not do so.
			*/
			const survivor = store.first();
			hub.retarget(id, (s) => (survivor && store.canRead(survivor.state.meta.id, s.principal)
				? snapshotBody(survivor, store, locks, s.principal) : null));
			announceActivity(hub, store, locks);
		}
		console.log(`[ rest ] deleted diagram ${id}`);
		return json(res, 200, { deleted: id });
	}

	// lock lifecycle: POST .../lock to acquire, DELETE .../lock to release
	if (parts[4] === 'lock' && parts.length === 5) {
		if (req.method === 'POST') {
			// B63: the write slot is a write capability, so a reader must not take it. Checked here
			// and not in `locks` — acquiring is not a store mutation, which is why the H9.3a sweep
			// over the seven mutating methods never reached this route.
			if (!store.canWrite(id, principal)) {
				return json(res, 403, { error: 'forbidden: no write access to this diagram', code: 'forbidden' });
			}
			const lock = locks.acquire(id, principal);
			if (!lock) return json(res, 409, { error: 'already server-locked by another controller' });
			// D22: the human reclaimed recently — refuse, and say for how long, so a retry loop backs
			// off instead of racing the remedy
			if (lock.held) return json(res, 409, { error: 'reclaimed by the human', code: 'reclaimed', retryAfter: lock.retryAfter });
			if (hub) { hub.broadcast(id, 'lock', { owner: 'server' }); announceActivity(hub, store, locks); }
			// hydrate the agent at its entry point: it should never have to ASK what the state is
			const log = store.log(id);
			return json(res, 200, { token: lock.token, expiresAt: lock.expiresAt,
				version: log?.version ?? 0, canUndo: !!log?.canUndo(), canRedo: !!log?.canRedo(),
				logDepth: log?.records.length ?? 0, truncated: !!log?.truncated });
		}
		if (req.method === 'DELETE') {
			if (!locks.release(id, req.headers['x-draw-lock'] || '')) {
				return json(res, 403, { error: 'invalid or missing lock token' });
			}
			if (hub) { hub.broadcast(id, 'lock', { owner: 'client' }); announceActivity(hub, store, locks); }
			return json(res, 200, { released: true });
		}
		return json(res, 405, { error: 'lock: POST to acquire, DELETE to release' });
	}

	/*
	Grant administration -- H9.4d/B90.

	Placed ABOVE the lock gate on purpose, alongside the lock lifecycle itself. Granting is not a
	model write: it records who may reach the diagram, not what the diagram says. Lock-gating it
	would mean an owner cannot change access while someone else is drawing, which is precisely when
	revoking is most likely to be the thing you urgently need.

	There is no GET here, and that is deliberate rather than an omission. `model.toJSON()` already
	carries `meta.owner` and `meta.grants`, so every caller entitled to read the diagram already
	receives the grant list over both REST and the websocket. A second way to read the same field
	would be two spellings of one fact.

	Authorization is not re-implemented: `store.grant` and `store.revoke` already refuse anyone but
	the owner, which is the single home for the rule. This maps their sentences onto status codes.
	*/
	if (parts[4] === 'grants') {
		if (req.method === 'POST' && parts.length === 5) {
			const body = await readJson(req);
			if (bodyRejected(req, res, body)) return;
			if (!body || typeof body.principal !== 'string' || typeof body.level !== 'string') {
				return json(res, 400, { error: 'expected JSON body { principal, level }', code: 'grant-malformed' });
			}
			const err = store.grant(id, body.principal, body.level, principal);
			if (err) return json(res, /^only the owner/.test(err) ? 403 : 422, { error: err, code: /^only the owner/.test(err) ? 'forbidden' : 'grant-rejected' });
			return json(res, 200, { grants: { ...store.get(id).state.meta.grants } });
		}
		// the principal is percent-encoded in the path: it carries a colon, and an address carries
		// an @. Decoded here rather than matched loosely, so `user%3Aa%40b.co` and `user:a@b.co`
		// are the same resource and neither is guessed at.
		if (req.method === 'DELETE' && parts.length === 6) {
			let target;
			try { target = decodeURIComponent(parts[5]); }
			catch { return json(res, 400, { error: 'principal is not valid percent-encoding', code: 'grant-malformed' }); }
			const err = store.revoke(id, target, principal);
			if (err) return json(res, /^only the owner/.test(err) ? 403 : 422, { error: err, code: /^only the owner/.test(err) ? 'forbidden' : 'grant-rejected' });
			// H9.4c: removing the diagram entry is not the same as removing access -- a workspace
			// grant on this diagram's owner survives it. Report what the principal can still do, so
			// "revoked" is never inferred from the absence of a row.
			return json(res, 200, { grants: { ...store.get(id).state.meta.grants }, effective: store.access(id, target) });
		}
		return json(res, 405, { error: 'grants: POST { principal, level } to grant, DELETE .../grants/<principal> to revoke' });
	}

	// every model write requires holding the lock
	if (!locks.locked(id)) {
		return json(res, 423, { error: 'not server-locked — POST /api/v1/diagrams/:id/lock first' });
	}
	const token = req.headers['x-draw-lock'] || '';
	if (!locks.verify(id, token)) {
		return json(res, 403, { error: 'invalid or missing lock token (X-Draw-Lock header)' });
	}
	locks.heartbeat(id, token);
	const model = store.get(id);

	// model-state (status): PUT .../selection  { ids }  — agentic authoritative selection.
	// PUT (not PATCH) because it replaces the selection wholesale; the Model expands groups,
	// reconciles to live entities, and admits only selectable kinds (same gate as the ws path).
	if (parts[4] === 'selection' && parts.length === 5) {
		if (req.method !== 'PUT') return json(res, 405, { error: 'selection: PUT to set' });
		const body = await readJson(req);
		if (bodyRejected(req, res, body)) return;
		if (!body || !Array.isArray(body.ids)) return json(res, 400, { error: 'expected JSON body { ids: [...] }' });
		return commitSelection(res, store, hub, locks, id, token, body.ids, principal);
	}

	// D14/GR11 — undo/redo are the ONE pair of verbs whose target is implicit: the top of a ring
	// another writer may have moved since you read it. `expect` is therefore MANDATORY here, and
	// only here; forward writes keep it optional so a curl one-liner still works.
	if ((parts[4] === 'undo' || parts[4] === 'redo') && parts.length === 5 && req.method === 'POST') {
		if (!locks.verify(id, token)) return json(res, 423, { error: 'lock not held (lost during the request)' });
		const raw = await readJson(req);
		if (bodyRejected(req, res, raw)) return;
		const body = raw || {};
		const log = store.log(id);
		if (body.expect == null) {
			return json(res, 400, { error: 'expect required on undo/redo', code: 'expect-required', version: log?.version ?? 0 });
		}
		if (body.expect !== log?.version) {
			return json(res, 409, {
				error: 'version conflict', code: 'version-conflict', version: log?.version ?? 0,
				// what moved under you, so the answer is reconcile rather than refetch-and-diff
				since: recoveryRecords(log, body.expect),
			});
		}
		// D21 — `to` reverses a RUN as one transaction: one version bump, one broadcast. The
		// browser offers it as "undo all N changes by <actor>"; an agent uses it to back out its
		// own batch without N round trips, each of which another writer could interleave.
		const reversing = parts[4] === 'undo' ? log.peekUndo() : log.peekRedo();
		const result = parts[4] === 'undo' ? store.undo(id, body.to ?? null, principal) : store.redo(id, principal);
		if (result.forbidden) return json(res, 403, { error: result.error, code: 'forbidden' });
		if (!result.ok) return json(res, 422, { error: result.error, version: result.version });
		await store.flush(id);
		const payload = reversalBody(store, id, result,
			{ by: 'server', actor: `rest-${token.slice(0, 8)}`, label: parts[4], reversed: reversing });
		if (hub) hub.broadcast(id, 'change', payload);
		return json(res, 200, payload);
	}

	// low-level: POST .../commit  — the transaction vocabulary, matching the websocket's `commit`.
	// Renamed from .../apply (X1); the old path is gone rather than aliased, because an alias is a
	// second surface to keep true and this is a single-tenant tool with a bundled CLI.
	if (parts[4] === 'commit' && parts.length === 5 && req.method === 'POST') {
		const body = await readJson(req);
		if (bodyRejected(req, res, body)) return;
		if (!body) return json(res, 400, { error: 'invalid JSON body' });
		if (!Array.isArray(body.ops)) {
			return json(res, 400, { error: 'commit takes { ops: [...], label? } — the transaction vocabulary the websocket uses', code: 'ops-required' });
		}
		return commitWrite(res, store, hub, locks, id, token, body.ops, body.label || '', undefined, expectOf(req), principal);
	}

	// high-level verbs on a collection
	const kind = COLLECTIONS[parts[4]];
	if (!kind) return json(res, 404, { error: `unknown collection: ${parts[4]}` });

	if (req.method === 'POST' && parts.length === 5) {
		const data = await readJson(req);
		if (bodyRejected(req, res, data)) return;
		if (!data) return json(res, 400, { error: 'invalid JSON body' });
		const entity = buildEntity(model, kind, data);
		if (!entity) return json(res, 422, { error: `cannot create ${kind}` });
		return commitWrite(res, store, hub, locks, id, token, [{ op: 'put', kind, entity }], `create ${kind}`, { id: entity.id }, expectOf(req), principal);
	}
	if (req.method === 'PATCH' && parts.length === 6) {
		const data = await readJson(req);
		if (bodyRejected(req, res, data)) return;
		if (!data) return json(res, 400, { error: 'invalid JSON body' });
		return commitWrite(res, store, hub, locks, id, token, [{ op: 'set', kind, id: parts[5], patch: { ...data, id: parts[5] } }], `move ${kind}`, undefined, expectOf(req), principal);
	}
	if (req.method === 'DELETE' && parts.length === 6) {
		return commitWrite(res, store, hub, locks, id, token, [{ op: 'del', kind, id: parts[5] }], `delete ${kind}`, undefined, expectOf(req), principal);
	}
	return json(res, 404, { error: 'not found' });
}

async function handleSlidesPush(req, res, store, slides, diagramId, principal) {
	const model = store.get(diagramId);
	if (!model) return json(res, 404, { error: `unknown diagram: ${diagramId}` });
	if (!slides || !slides.auth.configured()) {
		return json(res, 503, {
			error: 'Google credentials not configured',
			help: 'place an OAuth client JSON at <secretsDir>/google-credentials.json (see README, "Google Slides sync")'
		});
	}
	if (!slides.auth.authorized()) {
		const authUrl = slides.auth.authUrl(slides.redirectUri);
		console.log(`[ slides ] authorize at: ${authUrl}`);
		return json(res, 401, { error: 'authorization required', authUrl });
	}
	try {
		const report = await slides.sync.push(model.toJSON());
		// remember where it landed, so a re-push targets the same slide rather than pages[0].
		// Server-side because the server did the push: the CLI's `draw push` binds too, and the
		// browser needs no round trip to record something it did not do.
		store.bindSlides(diagramId, report.presentationId, report.pageId, principal);
		console.log(`[ slides ] pushed ${diagramId}: ${report.objects} objects -> ${report.presentationId}`);
		return json(res, 200, report);
	} catch (err) {
		if (err.code === 'no-url' || err.code === 'bad-url' || err.code === 'no-page') {
			return json(res, 400, { error: err.message, code: err.code });
		}
		if (err.status === 401 || err.message === 'not authorized') {
			const authUrl = slides.auth.authUrl(slides.redirectUri);
			console.log(`[ slides ] authorize at: ${authUrl}`);
			return json(res, 401, { error: 'authorization expired', authUrl });
		}
		console.warn(`[ slides ] push failed: ${err.message}`);
		return json(res, 502, {
			error: `Slides API: ${err.message}`,
			...(err.partial ? { partial: err.partial } : {})
		});
	}
}
