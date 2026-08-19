/*
REST API. Reads are always open (GET, curl/jq-friendly). WRITES require the
diagram to be Server-Locked by the caller (POST .../lock → token → X-Draw-Lock
header on every write); they funnel into the SAME validated store.commit() the
websocket uses — THE ONE WRITE — then broadcast the resulting change to the
browsers viewing that diagram. The browser path (websocket) is refused while a diagram is locked, so
exactly one side writes at a time.
*/

import { snapshotBody, changeBody } from './protocol.js';

const COLLECTIONS = { nodes: 'node', links: 'link', zones: 'zone', groups: 'group' };

function json(res, code, body) {
	res.writeHead(code, {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store',
		'Access-Control-Allow-Origin': '*'
	});
	res.end(JSON.stringify(body, null, '\t') + '\n');
}

function readJson(req) {
	return new Promise((resolve) => {
		let buf = '';
		req.on('data', (c) => { buf += c; if (buf.length > 1e6) req.destroy(); });
		req.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch { resolve(null); } });
		req.on('error', () => resolve(null));
	});
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

function commitWrite(res, store, hub, locks, id, token, mutation, extra) {
	if (!locks.verify(id, token)) return json(res, 423, { error: 'lock not held (lost during the request)' });
	const op = mutation.action === 'put' ? { op: 'put', kind: mutation.kind, entity: mutation.entity }
		: mutation.action === 'set' ? { op: 'set', kind: mutation.kind, id: mutation.entity.id, patch: mutation.entity }
		: mutation.action === 'del' ? { op: 'del', kind: mutation.kind, id: mutation.entity.id }
		: mutation;
	// A record with no label reads as a blank column in `draw history` and in the browser's undo
	// affordance — the surfaces that exist so a human can tell what an agent did. The high-level
	// verbs know their own intent, so they say it rather than leaving it to the reader.
	const label = mutation.label || (mutation.action && mutation.kind
		? `${{ put: 'create', set: 'move', del: 'delete' }[mutation.action] || mutation.action} ${mutation.kind}`
		: '');
	const result = store.commit(id, { ops: [op], label }, 'server', `rest-${token.slice(0, 8)}`);
	if (!result.ok) return json(res, 422, { error: result.error });
	// durability: a REST/agentic caller is one-shot — it has no reconnect backstop, so an acked
	// write must be on disk, not merely in the ~200ms debounce window. Flush before acking. (The ws
	// path keeps the debounce — drag writes are high-frequency and self-heal on reconnect.)
	store.flush(id);
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
function commitSelection(res, store, hub, locks, id, token, ids) {
	if (!locks.verify(id, token)) return json(res, 423, { error: 'lock not held (lost during the request)' });
	const err = store.setSelection(id, ids);
	if (err) return json(res, 422, { error: err });
	store.flush(id);
	const model = store.get(id);
	if (hub) hub.broadcast(id, 'snapshot', snapshotBody(model, store, locks));
	return json(res, 200, { version: model.state.meta.version, selection: [...model.state.selection] });
}

// returns true if the request was handled (may complete asynchronously)
export function handleRest(req, res, store, slides, locks, hub) {
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
		return json(res, 200, { status, diagrams: store.list().length, flushFailures, invariantFailures }), true;
	}
	if (parts[0] !== 'api') return false;
	if (parts[1] !== 'v1' || parts[2] !== 'diagrams') {
		return json(res, 404, { error: 'not found' }), true;
	}

	// the Slides sync action keeps its dedicated route
	if (req.method === 'POST' && parts.length === 6 && parts[4] === 'sync' && parts[5] === 'slides') {
		handleSlidesPush(req, res, store, slides, parts[3]);
		return true;
	}

	// ---- writes: lock lifecycle + model mutations (Server-Locked) ----
	// PUT is a write method ONLY for .../selection; every other PUT keeps the clean 405 below
	// (it falls to the req.method !== 'GET' branch) rather than being misrouted through the lock gate.
	if (req.method === 'POST' || (req.method === 'PUT' && parts[4] === 'selection') || req.method === 'PATCH' || req.method === 'DELETE') {
		// handleWrite is async + fire-and-forget: a throw must never become an
		// unhandled rejection (which would crash the whole server)
		handleWrite(req, res, store, locks, hub, parts).catch((err) => {
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
		return json(res, 200, store.list()), true;
	}
	const model = store.get(parts[3]);
	if (!model) return json(res, 404, { error: `unknown diagram: ${parts[3]}` }), true;
	if (parts.length === 4) {
		return json(res, 200, model.toJSON()), true;
	}

	// reads are always open (no lock): an agent must be able to see lock state and history without
	// attempting a write and reading a 423.
	if (parts[4] === 'lock' && parts.length === 5) {
		return json(res, 200, {
			owner: locks && locks.locked(parts[3]) ? 'server' : 'client',
			heldUntil: locks && locks.heldUntil ? locks.heldUntil(parts[3]) : null,
		}), true;
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

async function handleWrite(req, res, store, locks, hub, parts) {
	const id = parts[3];
	if (!store.get(id)) return json(res, 404, { error: `unknown diagram: ${id}` });

	// lock lifecycle: POST .../lock to acquire, DELETE .../lock to release
	if (parts[4] === 'lock' && parts.length === 5) {
		if (req.method === 'POST') {
			const lock = locks.acquire(id);
			if (!lock) return json(res, 409, { error: 'already server-locked by another controller' });
			// D22: the human reclaimed recently — refuse, and say for how long, so a retry loop backs
			// off instead of racing the remedy
			if (lock.held) return json(res, 409, { error: 'reclaimed by the human', code: 'reclaimed', retryAfter: lock.retryAfter });
			if (hub) hub.broadcast(id, 'lock', { owner: 'server' });
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
			if (hub) hub.broadcast(id, 'lock', { owner: 'client' });
			return json(res, 200, { released: true });
		}
		return json(res, 405, { error: 'lock: POST to acquire, DELETE to release' });
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
		if (!body || !Array.isArray(body.ids)) return json(res, 400, { error: 'expected JSON body { ids: [...] }' });
		return commitSelection(res, store, hub, locks, id, token, body.ids);
	}

	// D14/GR11 — undo/redo are the ONE pair of verbs whose target is implicit: the top of a ring
	// another writer may have moved since you read it. `expect` is therefore MANDATORY here, and
	// only here; forward writes keep it optional so a curl one-liner still works.
	if ((parts[4] === 'undo' || parts[4] === 'redo') && parts.length === 5 && req.method === 'POST') {
		if (!locks.verify(id, token)) return json(res, 423, { error: 'lock not held (lost during the request)' });
		const body = (await readJson(req)) || {};
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
		const result = parts[4] === 'undo' ? store.undo(id, body.to ?? null) : store.redo(id);
		if (!result.ok) return json(res, 422, { error: result.error, version: result.version });
		store.flush(id);
		const payload = { seq: null, from: null, at: Date.now(), by: 'server', actor: `rest-${token.slice(0, 8)}`,
			label: parts[4], ops: result.ops, version: result.version,
			// attribution: WHOSE change was reversed, so a readout can say "undid agent-1's move"
			reversed: reversing ? { seq: reversing.seq, actor: reversing.actor, label: reversing.label } : null,
			durableVersion: store.durableVersion(id),
			canUndo: !!log.canUndo(), canRedo: !!log.canRedo(), truncated: !!log.truncated,
			truncatedHuman: !!log.truncatedHuman };
		if (hub) hub.broadcast(id, 'change', payload);
		return json(res, 200, payload);
	}

	// low-level: POST .../commit  — the transaction vocabulary, matching the websocket's `commit`.
	// Renamed from .../apply (X1); the old path is gone rather than aliased, because an alias is a
	// second surface to keep true and this is a single-tenant tool with a bundled CLI.
	if (parts[4] === 'commit' && parts.length === 5 && req.method === 'POST') {
		const body = await readJson(req);
		if (!body) return json(res, 400, { error: 'invalid JSON body' });
		return commitWrite(res, store, hub, locks, id, token, body);
	}

	// high-level verbs on a collection
	const kind = COLLECTIONS[parts[4]];
	if (!kind) return json(res, 404, { error: `unknown collection: ${parts[4]}` });

	if (req.method === 'POST' && parts.length === 5) {
		const data = await readJson(req);
		if (!data) return json(res, 400, { error: 'invalid JSON body' });
		const entity = buildEntity(model, kind, data);
		if (!entity) return json(res, 422, { error: `cannot create ${kind}` });
		return commitWrite(res, store, hub, locks, id, token, { action: 'put', kind, entity }, { id: entity.id });
	}
	if (req.method === 'PATCH' && parts.length === 6) {
		const data = await readJson(req);
		if (!data) return json(res, 400, { error: 'invalid JSON body' });
		return commitWrite(res, store, hub, locks, id, token, { action: 'set', kind, entity: { ...data, id: parts[5] } });
	}
	if (req.method === 'DELETE' && parts.length === 6) {
		return commitWrite(res, store, hub, locks, id, token, { action: 'del', kind, entity: { id: parts[5] } });
	}
	return json(res, 404, { error: 'not found' });
}

async function handleSlidesPush(req, res, store, slides, diagramId) {
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
		store.bindSlides(diagramId, report.presentationId, report.pageId);
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
