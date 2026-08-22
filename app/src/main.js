/*
draw·next boot — the thin UI over the kernel. Wires the (ported) document model, command
history, selection, input gesture machine, palette, label editor, readout, data-view, and
server sync to a KERNEL-SOURCED renderer. The kernel owns every geometry number + the glyph art.
*/

import { sharedDefs, cellOf } from '../../kernel/index.mjs';
import { el, crosshair } from './painter.js';
import { nodePoints, zonePoints, CANVAS, GAP } from './snap.js';
import { Model } from '../../model/index.mjs';
import { attachRelations } from '../../engine/index.mjs';
import { Changes } from './changes.js';
import { Renderer } from './renderer.js';
import { Selection } from './selection.js';
import { Input } from './input.js';
import { Palette } from './palette.js';
import { Net, wsUrl } from './net.js';
import { Sync, bindGestureDefer } from './sync.js';
import { LabelEditor } from './labeledit.js';
import { Readout } from './readout.js';
import { DataView } from './dataview.js';

const svg = document.getElementById('container');

// kernel glyph + frame defs (the kernel owns the look)
document.getElementById('kdefs').innerHTML = sharedDefs();

// subtle grid dots: node grid always on, zone grid revealed while Shift held (CSS)
const gridNodes = svg.querySelector('#grid-nodes');
nodePoints().forEach((p) => el('circle', { cx: p.x, cy: p.y, r: 2 }, gridNodes));
const gridZones = svg.querySelector('#grid-zones');
zonePoints().forEach((p) => el('circle', { cx: p.x, cy: p.y, r: 5 }, gridZones));

const model = new Model();
attachRelations(model, { cellOf }); // R3 maintained reverse indices (first IVM) backing linksOf/linksAt/linkBetween/groupOf + R5 atCell; cellOf injected here (composition root) so engine/ imports no kernel; registered before other subscribers so they see a fresh index
const history = new Changes(model);   // the commit boundary; Sync subscribes to it, not to the model
const renderer = new Renderer(model, svg);
const selection = new Selection(model);
selection.subscribe(() => renderer.reflectSelection(selection.list())); // renderer owns the 'selected' visual reflection
const labels = new LabelEditor({ svg, model, history });
const readout = new Readout({ model, selection, elements: [document.getElementById('readout-bottom')] });
const dataview = new DataView({ model, svg });
readout.onUnitsChanged = (units) => dataview.setUnits(units);
// B36 — one crosshair on #snaplayer, owned here and shared. Overlay and Palette each built their
// own, which is two owners of one layer; the composition root is where that gets decided.
const snap = crosshair(svg.querySelector('#snaplayer'), CANVAS, GAP);
const palette = new Palette({ container: document.getElementById('palette'), svg, model, history, selection, snap });

// help overlay: header button + click-outside-to-close. Resolved HERE and injected — Input used to
// look the same element up for itself, so the id had two owners (B45).
const helpBtn = document.getElementById('help-btn');
const help = document.getElementById('help');
const input = new Input({ svg, model, history, selection, renderer, labels, readout, palette, dataview, host: window, help, snap });
if (helpBtn && help) {
	helpBtn.addEventListener('click', () => { help.hidden = !help.hidden; helpBtn.blur(); });
	help.addEventListener('click', (e) => { if (e.target === help) help.hidden = true; });
}

// W5 — diagram-as-UI: a clickable panel region fires 'draw:action' in run mode; the HOST wires it. This is
// the self-hosting interface — the diagram emits actions, the app maps them to behaviour. 'help' is wired
// real; the rest show a transient banner toast (safe — real destructive wiring is out of this slice's scope).
window.addEventListener('draw:action', (e) => {
	const action = e && e.detail && e.detail.action;
	if (action === 'help') { if (help) help.hidden = false; return; }
	const banner = document.getElementById('banner');
	if (banner) banner.textContent = `▶ ${action}`;   // overwritten by the next sync status update (transient)
});

// ---- server sync + header menu ----
const menu = {
	name: document.getElementById('diagram-name'),
	list: document.getElementById('diagram-list'),
	create: document.getElementById('diagram-new'),
	del: document.getElementById('diagram-del'),
	lock: document.getElementById('lockstate'),
	whoami: document.getElementById('whoami'),
	banner: document.getElementById('banner'),
	slidesUrl: document.getElementById('slides-url'),
	slidesPush: document.getElementById('slides-push')
};

/*
Access administration -- H9.4d/B90.

Authorization shipped enforced everywhere and administrable nowhere: `grant` and `revoke` existed
on the store with no production caller, so the only reachable state was "one person owns
everything". This is the consumer that makes the model reachable, and the browser is it because it
is already through the authentication boundary whatever that boundary turns out to be -- no service
account, no second OAuth client, nothing that ties administration to one identity provider.

Offered ONLY to the owner. The server refuses anyone else with 403, so showing the affordance to a
reader would advertise a door that is certain not to open, which is worse than no door.

Rendered from the response rather than the model. A grant does not travel over the websocket, so
`model.state.meta.grants` stays stale in this tab until the next snapshot; the POST and DELETE both
answer with the resulting grant map, which is authoritative and immediate. Peers still holding an
older belief are a UX gap and not a security one -- the server checks the grant on every write, so
a revoked peer is refused whatever its tab thinks (H10.22).
*/
const access = {
	panel: document.getElementById('access'),
	card: document.getElementById('access-card'),
	owner: document.getElementById('access-owner'),
	list: document.getElementById('access-list'),
	principal: document.getElementById('access-principal'),
	level: document.getElementById('access-level'),
	grant: document.getElementById('access-grant'),
	error: document.getElementById('access-error'),
	wsList: document.getElementById('access-ws-list'),
	wsPrincipal: document.getElementById('access-ws-principal'),
	wsLevel: document.getElementById('access-ws-level'),
	wsGrant: document.getElementById('access-ws-grant'),
};
let accessId = null;

const short = (p) => (p.startsWith('user:') ? p.slice(5) : p);

function renderAccess(owner, grants) {
	access.owner.textContent = `owned by ${short(owner)}`;
	access.list.replaceChildren();
	const entries = Object.entries(grants || {});
	if (!entries.length) {
		const row = access.list.insertRow();
		row.insertCell().textContent = 'nobody else';
		return;
	}
	for (const [who, level] of entries) {
		const row = access.list.insertRow();
		row.insertCell().textContent = short(who);
		row.insertCell().textContent = level;
		const btn = document.createElement('button');
		btn.textContent = 'revoke';
		btn.title = `revoke ${who}`;
		btn.addEventListener('click', () => sendAccess(
			`grants/${encodeURIComponent(who)}`, { method: 'DELETE' }, owner));
		row.insertCell().appendChild(btn);
	}
}

/*
The workspace half -- H9.4c. A workspace is the set of diagrams you own, including ones you have not
made yet, which is the point: otherwise a person is in the loop for every diagram an agent creates.

Always available to whoever is signed in, unlike the diagram half above. Your workspace is yours
regardless of who owns the diagram currently on screen -- and gating it on that would have been a
real limitation rather than a cosmetic one, because an agent-created diagram is owned by the agent,
so you could not have administered your own workspace from the very diagrams this feature exists to
make possible.
*/
function renderWorkspace(grants) {
	access.wsList.replaceChildren();
	const entries = Object.entries(grants || {});
	if (!entries.length) {
		access.wsList.insertRow().insertCell().textContent = 'nobody';
		return;
	}
	for (const [who, level] of entries) {
		const row = access.wsList.insertRow();
		row.insertCell().textContent = short(who);
		row.insertCell().textContent = level;
		const btn = document.createElement('button');
		btn.textContent = 'revoke';
		btn.title = `revoke ${who} from everything you own`;
		btn.addEventListener('click', () => sendWorkspace(`/${encodeURIComponent(who)}`, { method: 'DELETE' }));
		row.insertCell().appendChild(btn);
	}
}

async function sendWorkspace(suffix, init) {
	access.error.textContent = '';
	try {
		const res = await fetch(`/api/v1/workspace/grants${suffix}`, init);
		const body = await res.json().catch(() => ({}));
		if (!res.ok) { access.error.textContent = body.error || `refused (${res.status})`; return; }
		renderWorkspace(body.grants);
		access.wsPrincipal.value = '';
	} catch (e) {
		access.error.textContent = `could not reach the server: ${e.message}`;
	}
}

async function sendAccess(path, init, owner) {
	access.error.textContent = '';
	try {
		const res = await fetch(`/api/v1/diagrams/${accessId}/${path}`, init);
		const body = await res.json().catch(() => ({}));
		// the server's sentence is shown verbatim -- it already says which rule refused, and
		// paraphrasing it here would be a second copy of the reason that drifts from the first
		if (!res.ok) { access.error.textContent = body.error || `refused (${res.status})`; return; }
		renderAccess(owner, body.grants);
		access.principal.value = '';
		// H9.4c: removing a diagram grant does not necessarily remove access — a workspace grant on
		// this diagram's owner outranks its absence. The server reports what remains; saying nothing
		// would let "the row is gone" be read as "they are out", which is the thing that is not true.
		if (body.effective) {
			access.error.textContent = `note: still has ${body.effective} access through a workspace grant`;
		}
	} catch (e) {
		access.error.textContent = `could not reach the server: ${e.message}`;
	}
}

if (access.panel) {
	access.panel.addEventListener('click', (e) => { if (e.target === access.panel) access.panel.hidden = true; });
	access.grant.addEventListener('click', () => sendAccess('grants', {
		method: 'POST',
		body: JSON.stringify({ principal: access.principal.value.trim(), level: access.level.value }),
	}, access.panel.dataset.owner));
	access.principal.addEventListener('keydown', (e) => { if (e.key === 'Enter') access.grant.click(); });
	access.wsGrant.addEventListener('click', () => sendWorkspace('', {
		method: 'POST',
		body: JSON.stringify({ principal: access.wsPrincipal.value.trim(), level: access.wsLevel.value }),
	}));
	access.wsPrincipal.addEventListener('keydown', (e) => { if (e.key === 'Enter') access.wsGrant.click(); });
}

let onStateLastId = null;
const net = new Net(wsUrl(location));   // B60 -- wss: on an https page, ws: on http
// D4 — the inversion. Sync subscribes to the COMMIT boundary, never to the model. There is then
// no way to forward an uncommitted change, because uncommitted changes never pass through Changes.
// A 4-second 3-node drag went from ~60 server transactions to exactly one.
const sync = new Sync({
	model, net, history, selection,
	onState({ status, meta, diagrams, locked, mayWrite, principal, error, rewound }) {
		// H9.3c: read-only is tested BEFORE locked, because the locked branch offers "click to
		// take back" and reclaim is itself a write capability (B64). A reader shown that would
		// be offered the one remedy the server is certain to refuse.
		if (status !== 'open') { menu.lock.className = 'lock-offline'; menu.lock.textContent = 'offline'; menu.lock.title = 'no server connection'; }
		else if (!mayWrite) { menu.lock.className = 'lock-readonly'; menu.lock.textContent = 'read-only'; menu.lock.title = 'you have view access to this diagram'; }
		else if (locked) { menu.lock.className = 'lock-locked'; menu.lock.textContent = 'locked'; menu.lock.title = 'server has control — click to take back'; }
		else { menu.lock.className = 'lock-unlocked'; menu.lock.textContent = 'unlocked'; menu.lock.title = 'you have control'; }
		/*
		B76 -- the signed-in identity, top right, immediately left of the authority pill.

		Placement was a real choice. Top left is where branding conventionally lives, and putting
		an address there reads as though the application is called `aobersnel@apnex.com.au`. Every
		mainstream tool puts identity top RIGHT, and `#lockstate` -- which answers what may I do --
		is already there, so identity beside it pairs the two questions a person actually has on
		arriving: who am I, and what can I do here.

		The address is shown in full rather than abbreviated. In a tool where one account may see
		a diagram and another may not, being certain WHICH account you are in is the whole value of
		the element, and initials or a first name do not deliver it. The `user:` prefix is stripped
		because it is protocol vocabulary; the untouched principal stays in the tooltip.

		Hidden entirely when there is no principal. "anonymous" would name a state that does not
		exist in a single-tenant run.
		*/
		if (principal) {
			menu.whoami.hidden = false;
			menu.whoami.textContent = principal.startsWith('user:') ? principal.slice(5) : principal;
			menu.whoami.title = principal;
		} else {
			menu.whoami.hidden = true;
			menu.whoami.textContent = '';
		}
		// H9.4d: identity and the access it confers are the same question, so the affordance hangs
		// off the element that already answers "who am I" rather than earning a button of its own.
		const isOwner = !!principal && !!meta.owner && meta.owner === principal;
		accessId = meta.id;
		// H9.4c: the panel opens for anyone signed in, not only the diagram's owner, because the
		// workspace half is always theirs. The diagram half is hidden by CSS when they do not own
		// what is on screen — the server would refuse those calls, and offering a door certain not
		// to open is worse than offering none.
		menu.whoami.classList.toggle('can-admin', !!principal);
		menu.whoami.title = principal
			? `${principal} — click to manage who can reach ${isOwner ? 'this diagram, and everything you own' : 'everything you own'}`
			: '';
		menu.whoami.onclick = principal ? () => {
			access.panel.dataset.owner = meta.owner;
			access.error.textContent = '';
			access.card.classList.toggle('not-owner', !isOwner);
			if (isOwner) renderAccess(meta.owner, meta.grants);
			renderWorkspace({});
			access.panel.hidden = false;
			// the workspace grants live in no diagram, so unlike meta.grants they must be fetched
			sendWorkspace('', { method: 'GET' });
		} : null;
		const readOnly = !mayWrite || !!locked;
		input.setReadOnly(readOnly);
		menu.name.disabled = readOnly;
		menu.slidesUrl.disabled = readOnly;
		if (onStateLastId && onStateLastId !== meta.id) disarmDelete();
		onStateLastId = meta.id;
		if (document.activeElement !== menu.name) menu.name.value = meta.name;
		if (document.activeElement !== menu.slidesUrl) menu.slidesUrl.value = meta.slides.url || '';
		document.title = `draw·next — ${meta.name}`;
		menu.banner.textContent = `${model.all('node').length} nodes · ${model.all('link').length} links · ${model.all('zone').length} zones`;
		// D29 — the server came back holding LESS than we do: it restarted before flushing changes
		// it had already acked. Say so. The alternative is reverting the user's work in silence.
		if (rewound) {
			const n = rewound.from - rewound.to;
			menu.banner.textContent = `⚠ server restarted — ${n} change${n === 1 ? '' : 's'} were not saved`;
		}
		/*
		I14/D21 — the undo affordance.

		Two things the user cannot otherwise know: that someone ELSE is on top of the undo stack
		(so Ctrl+Z will reverse their work, not yours), and that the ring dropped a change you
		made. A bounded, designed loss that no actor can perceive is not a bounded loss.
		*/
		const run = history.foreignRun && history.foreignRun();
		if (run) {
			menu.banner.textContent = `↶ Ctrl+Shift+Backspace undoes ${run.run} change${run.run === 1 ? '' : 's'} by ${run.actor}`;
			menu.banner.title = `top of the log: "${run.label || run.by}" by ${run.actor}`;
		} else {
			menu.banner.title = '';
		}
		if (history.state && history.state.truncatedHuman) {
			menu.banner.textContent = '⚠ undo history is full — your oldest changes are no longer undoable';
		}
		// D28/I16 — no submitted request is discarded without a user-visible notice.
		if (error) menu.banner.textContent = `✗ ${error}`;
		if (diagrams) {
			menu.list.innerHTML = '';
			diagrams.forEach((d) => { const o = document.createElement('option'); o.value = d.id; o.textContent = d.name; menu.list.appendChild(o); });
		}
		menu.list.value = meta.id;
		const current = menu.list.querySelector(`option[value="${meta.id}"]`);
		if (current) current.textContent = meta.name;
	}
});
history.onCommit((request) => sync.submit(request));
// D12 — a remote change must not land under a live drag preview (B19)
bindGestureDefer(input, sync);


menu.name.addEventListener('change', () => { sync.rename(menu.name.value); menu.name.blur(); menu.name.value = model.state.meta.name; });
menu.list.addEventListener('change', () => { sync.openDiagram(menu.list.value); menu.list.blur(); });
menu.lock.addEventListener('click', () => { if (sync.locked && sync.mayWrite) sync.reclaim(); menu.lock.blur(); });
menu.create.addEventListener('click', () => { sync.createDiagram(); menu.create.blur(); });

// deleting a diagram is the one destructive, non-undoable action: arm then confirm
function disarmDelete() {
	clearTimeout(disarmDelete.timer);
	menu.del.classList.remove('armed');
	menu.del.textContent = '×';
}
menu.del.addEventListener('click', () => {
	menu.del.blur();
	if (!menu.del.classList.contains('armed')) {
		menu.del.classList.add('armed');
		menu.del.textContent = 'sure?';
		menu.del.dataset.target = model.state.meta.id;
		disarmDelete.timer = setTimeout(disarmDelete, 3000);
		return;
	}
	const target = menu.del.dataset.target;
	disarmDelete();
	if (target !== model.state.meta.id) return;
	sync.deleteDiagram();
});

// ---- Slides binding + push ----
menu.slidesUrl.addEventListener('change', () => { sync.setSlidesUrl(menu.slidesUrl.value); menu.slidesUrl.blur(); menu.slidesUrl.value = model.state.meta.slides.url; });

function flashPush(cls, label, ms = 2500) {
	menu.slidesPush.className = cls;
	menu.slidesPush.textContent = label;
	clearTimeout(flashPush.timer);
	if (ms > 0) flashPush.timer = setTimeout(() => { menu.slidesPush.className = ''; menu.slidesPush.textContent = '⇑ slides'; }, ms);
}
menu.slidesPush.addEventListener('click', async () => {
	if (menu.slidesPush.disabled) return;
	menu.slidesPush.blur();
	menu.slidesPush.disabled = true;
	flashPush('busy', '⇑ pushing…', 0);
	const pushedId = model.state.meta.id;
	try {
		const res = await fetch(`/api/v1/diagrams/${pushedId}/sync/slides`, { method: 'POST' });
		const body = await res.json();
		if (res.status === 401 && body.authUrl) {
			const tab = window.open(body.authUrl, '_blank');
			flashPush(tab ? 'busy' : 'err', tab ? '⇑ authorize, then push again' : '✗ popup blocked — see console', tab ? 8000 : 6000);
			if (!tab) console.warn('[ slides ] popup blocked — authorize at:', body.authUrl);
		} else if (res.ok) {
			menu.slidesPush.title = `pushed to ${body.url}`;
			flashPush('ok', `✓ ${body.entities} entities`);
		} else {
			console.warn('[ slides ]', body.error, body.help || '');
			const reason = res.status === 503 ? 'no credentials (see README)' : body.code === 'no-url' ? 'no URL bound' : (body.code === 'bad-url' || body.code === 'no-page') ? 'bad URL' : body.partial ? 'failed — push again' : 'failed';
			menu.slidesPush.title = body.error;
			flashPush('err', `✗ ${reason}`, 5000);
		}
	} catch (err) {
		console.warn('[ slides ]', err);
		flashPush('err', '✗ failed', 4000);
	} finally {
		menu.slidesPush.disabled = false;
	}
});

net.init();

window.draw = { model, history, renderer, selection, input, palette, labels, readout, dataview, net, sync };
