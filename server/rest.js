/*
REST API. Reads are always open (GET, curl/jq-friendly). WRITES require the
diagram to be Server-Locked by the caller (POST .../lock → token → X-Draw-Lock
header on every write); they funnel into the SAME validated store.apply() the
websocket uses, then broadcast a fresh snapshot to the browsers viewing that
diagram. The browser path (websocket) is refused while a diagram is locked, so
exactly one side writes at a time.
*/

import { snapshotBody } from './protocol.js';

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
// (which mint the id/name); store.apply then validates it like any other mutation
function buildEntity(model, kind, d) {
	if (kind === 'node') return model.makeNode(d.type, { x: d.x, y: d.y }, d.shape);
	if (kind === 'link') return model.makeLink(d.src, d.dst);
	if (kind === 'zone') return model.makeZone({ x: d.x, y: d.y, w: d.w, h: d.h });
	if (kind === 'group') return Array.isArray(d.members) ? model.makeGroup(d.members) : null;
	return null;
}

// apply one mutation, broadcast the new snapshot to viewers, respond.
// Re-verifies the token HERE — the lock gate ran before the (awaited) body read,
// so the lock may have been reclaimed/released/expired in between; the verify +
// store.apply run synchronously, so no writer can slip in between them.
function commitWrite(res, store, hub, locks, id, token, mutation, extra) {
	if (!locks.verify(id, token)) return json(res, 423, { error: 'lock not held (lost during the request)' });
	const err = store.apply(id, mutation);
	if (err) return json(res, 422, { error: err });
	// durability: a REST/agentic caller is one-shot — unlike the browser (which re-pushes the whole
	// doc on reconnect) it has no backstop, so an acked write must be on disk, not merely in the
	// ~200ms debounce window. Flush synchronously before acking. (The ws path keeps the debounce —
	// drag writes are high-frequency and self-heal on reconnect.)
	store.flush(id);
	const model = store.get(id);
	if (hub) hub.broadcast(id, 'snapshot', snapshotBody(model, store, locks));
	return json(res, 200, { rev: model.state.meta.rev, ...(extra || {}) });
}

// set the authoritative selection (model-state / status). Mirrors commitWrite: re-verify the token
// (the lock gate ran before the awaited body read), set + flush-before-ack (a one-shot agentic caller
// has no reconnect backstop), then broadcast a snapshot so every viewer reflects the agent's focus via
// the persisted doc.selection. No rev bump — selection is status, not config (matches the ws 'select').
function commitSelection(res, store, hub, locks, id, token, ids) {
	if (!locks.verify(id, token)) return json(res, 423, { error: 'lock not held (lost during the request)' });
	const err = store.setSelection(id, ids);
	if (err) return json(res, 422, { error: err });
	store.flush(id);
	const model = store.get(id);
	if (hub) hub.broadcast(id, 'snapshot', snapshotBody(model, store, locks));
	return json(res, 200, { rev: model.state.meta.rev, selection: [...model.state.selection] });
}

// returns true if the request was handled (may complete asynchronously)
export function handleRest(req, res, store, slides, locks, hub) {
	const url = new URL(req.url, 'http://localhost');
	const parts = url.pathname.split('/').filter(Boolean);

	if (url.pathname === '/health') {
		return json(res, 200, { status: 'ok', diagrams: store.list().length }), true;
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
			if (hub) hub.broadcast(id, 'lock', { owner: 'server' });
			return json(res, 200, { token: lock.token, expiresAt: lock.expiresAt });
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

	// low-level: POST .../apply  { action, kind, entity }  (the websocket vocabulary)
	if (parts[4] === 'apply' && parts.length === 5 && req.method === 'POST') {
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
