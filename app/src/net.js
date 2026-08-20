/*
Net — dumb websocket pipe (graph's NetworkManager lineage): connect, reconnect
on a flat delay, fan parsed messages out to subscribers. No protocol knowledge.
The editor must work standalone when no server answers — failures are silent.

Ported verbatim from client/src/net.js — the wire protocol is unchanged across the migration.
*/

const RETRY_MS = 3000;

/*
The websocket URL, derived from the page rather than asserted -- B60.

`main.js` hardcoded `ws://`, which is correct on `http://localhost` and fatal on HTTPS: the browser
blocks the mixed-content connection, `hello` never completes, and the editor renders an empty canvas
against a server holding the documents perfectly well. The scheme is not a constant, it is a
function of how the page itself was served.

Pure, and exported, so the rule can be tested without a DOM -- the defect it replaces was invisible
precisely because nothing could reach it.
*/
export function wsUrl({ protocol, host }) {
	return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/ws`;
}

export class Net {
	constructor(url) {
		this.url = url;
		this.ws = null;
		this.subs = [];
		this.statusSubs = [];
		this.status = 'closed';
	}

	subscribe(fn) { this.subs.push(fn); }
	onStatus(fn) { this.statusSubs.push(fn); }

	setStatus(status) {
		this.status = status;
		this.statusSubs.forEach((fn) => fn(status));
	}

	isOpen() {
		return this.ws && this.ws.readyState === 1;
	}

	init() {
		this.setStatus('connecting');
		try {
			this.ws = new WebSocket(this.url);
		} catch {
			return this.retry();
		}
		this.ws.addEventListener('open', () => this.setStatus('open'));
		this.ws.addEventListener('close', () => {
			this.setStatus('closed');
			this.retry();
		});
		this.ws.addEventListener('error', () => {});
		this.ws.addEventListener('message', (evt) => {
			let msg;
			try {
				msg = JSON.parse(evt.data);
			} catch {
				return;
			}
			this.subs.forEach((fn) => fn(msg));
		});
	}

	retry() {
		if (this.timer) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			this.init();
		}, RETRY_MS);
	}

	send(cmd, body) {
		if (!this.isOpen()) return false;
		this.ws.send(JSON.stringify({ cmd, body }));
		return true;
	}
}
