/*
SlidesSync — orchestrates the one-way push: parse the bound URL, wipe what
this push owns (the target slide fully — stale cleanup — plus this diagram's
ids on every other slide; sibling diagrams untouched), recreate on the target
slide, then best-effort connector binding and grouping. The transport is
injectable so the flow tests without Google.
*/

import { parseSlidesUrl, deletePlan, createRequests, connectRequests, groupRequests, countCreated, makeScale } from './transform.js';

const API = 'https://slides.googleapis.com/v1/presentations';

export class SlidesSync {
	constructor(auth, transport = null) {
		this.auth = auth;
		this.transport = transport || {
			get: async (presentationId) => this.call('GET', `/${presentationId}`),
			batchUpdate: async (presentationId, requests) =>
				this.call('POST', `/${presentationId}:batchUpdate`, { requests })
		};
	}

	async call(method, pathPart, body) {
		const token = await this.auth.accessToken();
		const res = await fetch(`${API}${pathPart}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				...(body ? { 'Content-Type': 'application/json' } : {})
			},
			...(body ? { body: JSON.stringify(body) } : {})
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			const message = data.error?.message || `HTTP ${res.status}`;
			const err = new Error(message);
			err.status = res.status;
			throw err;
		}
		return data;
	}

	async push(doc) {
		const url = doc.meta?.slides?.url;
		const binding = parseSlidesUrl(url);
		if (!binding) {
			const err = new Error(url
				? 'that does not look like a Google Slides link — paste the presentation URL from the address bar'
				: 'no Google Slides URL bound — paste a presentation link in the header field');
			err.code = url ? 'bad-url' : 'no-url';
			throw err;
		}
		if (binding.published) {
			const err = new Error('that is a published-to-web link — paste the editable /presentation/d/<id>/edit URL');
			err.code = 'bad-url';
			throw err;
		}

		const presentation = await this.transport.get(binding.presentationId);
		const pages = presentation.slides || [];
		if (pages.length === 0) {
			const err = new Error('presentation has no slides');
			err.code = 'no-page';
			throw err;
		}
		// URL fragment wins, then the binding remembered from the last push —
		// but only if it belongs to THIS presentation (re-binding to a new deck
		// must not chase a foreign pageId)
		const saved = doc.meta?.slides || {};
		const remembered = saved.presentationId === binding.presentationId ? saved.pageId : null;
		let page = pages[0];
		if (binding.pageId) {
			page = pages.find((p) => p.objectId === binding.pageId);
			if (!page) {
				const err = new Error(`slide id.${binding.pageId} not found in the presentation — fix the URL fragment`);
				err.code = 'no-page';
				throw err;
			}
		} else if (remembered) {
			// a remembered slide that has since been deleted falls back gracefully
			page = pages.find((p) => p.objectId === remembered) || pages[0];
		}

		// wipe this push's objects (target slide fully, this diagram's ids
		// elsewhere — sibling diagrams on other slides are untouched)
		const modelIds = new Set([
			...(doc.nodes || []).map((n) => n.id),
			...(doc.links || []).map((l) => l.id),
			...(doc.zones || []).map((z) => z.id)
		]);
		const plan = deletePlan(presentation, page.objectId, modelIds);
		const wipe = plan.requests;
		// the page's own size drives the scale: inch decks render exactly as
		// before, metric pages (e.g. 19.2x10.8cm) get decimal-exact geometry
		const scaleInfo = makeScale(presentation.pageSize);
		const create = createRequests(doc, page.objectId, scaleInfo);
		if (wipe.length > 0) await this.transport.batchUpdate(binding.presentationId, wipe);
		try {
			await this.transport.batchUpdate(binding.presentationId, create);
		} catch (err) {
			// the wipe already committed: tell the caller the slide is now bare
			err.partial = { deleted: wipe.length };
			err.message += ' (previously pushed shapes were already cleared — push again after fixing the cause)';
			throw err;
		}

		// best-effort ladder: each rung improves editability, none can undo the push
		// rung 1 — bind line ends to the center hubs
		let connected = false;
		const connect = connectRequests(doc);
		if (connect.length > 0) {
			try {
				await this.transport.batchUpdate(binding.presentationId, connect);
				connected = true;
			} catch { /* lines stay geometric — still native shapes */ }
		}
		// rung 2 — group circle+hub+label so drags in Slides move them as one
		// (and bound connectors keep tracking the hub = the center)
		let grouped = false;
		const groups = groupRequests(doc);
		if (groups.length > 0) {
			try {
				await this.transport.batchUpdate(binding.presentationId, groups);
				grouped = true;
			} catch { /* ungrouped: hubs still give center attachment at push time */ }
		}

		const counts = countCreated(create);

		return {
			presentationId: binding.presentationId,
			pageId: page.objectId,
			deleted: wipe.length,
			staleDeleted: plan.staleDeleted,
			entities: counts.entities,
			objects: counts.objects,
			linksConnected: connected,
			nodesGrouped: grouped,
			url: `https://docs.google.com/presentation/d/${binding.presentationId}/edit#slide=id.${page.objectId}`
		};
	}
}
