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
import { Clock } from './clock.js';
import { Movers } from './movers.js';
import { Input } from './input.js';
import { Palette } from './palette.js';
import { Net, wsUrl } from './net.js';
import { Sync, bindGestureDefer } from './sync.js';
import { LabelEditor } from './labeledit.js';
import { Readout } from './readout.js';

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
// B36 — one crosshair on #snaplayer, owned here and shared. Overlay and Palette each built their
// own, which is two owners of one layer; the composition root is where that gets decided.
const snap = crosshair(svg.querySelector('#snaplayer'), CANVAS, GAP);
const palette = new Palette({ container: document.getElementById('palette'), svg, model, history, selection, snap });

// help overlay: header button + click-outside-to-close. Resolved HERE and injected — Input used to
// look the same element up for itself, so the id had two owners (B45).
const helpBtn = document.getElementById('help-btn');
const help = document.getElementById('help');
/*
H12.4/H12.8 -- ONE clock, owned by the composition root and handed to whoever needs an instant.

Sync seeds it from the server's snapshot; Input stamps `since` with it when an endpoint is armed;
Movers seeds each animation from it. Constructing it here rather than inside Sync is what lets the
other two have it without reaching through Sync to get it (A3 Air-Gap), and is the shape
`scan-wiring` checks: a value the root computes must reach the thing it constructs.
*/
const clock = new Clock();
const input = new Input({ svg, model, history, selection, renderer, labels, readout, palette, host: window, help, now: () => clock.now(), snap });
/*
H12.8 -- the presentation layer for movers. Started and stopped by MODE, refreshed by CHANGE.

Both wires live here rather than inside either party: the renderer does not know movers exist, and
the movers do not listen to the renderer. The root connects them, which is the only place that
legitimately knows about both.
*/
const movers = new Movers({ model, renderer, layer: svg.querySelector('#movers'), now: () => clock.now() });
renderer.onMode = () => movers.sync();
model.onChange(() => movers.sync());

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
	undelete: document.getElementById('diagram-undelete'),
	lock: document.getElementById('lockstate'),
	agents: document.getElementById('agents'),
	whoami: document.getElementById('whoami'),
	banner: document.getElementById('banner'),
};

/*
The delete window -- B109.

`DELETE` has felt final since it shipped, and it is not: the bucket keeps a removed diagram for
seven days. A backstop nobody can reach is a backstop only in the sense that it would have worked.

The button is HIDDEN unless something is recoverable, which is the design and not an optimisation.
Permanent chrome for a rare need trains a reader to stop seeing it; a control that appears only when
it applies is discoverable at exactly the moment somebody goes looking for a diagram that is
missing, and its presence alone answers their question before the panel opens.

`window: false` is not an empty list. A deployment with no recycle bin at all -- a filesystem --
must never render a panel saying "nothing to restore", because that reads as reassurance about a
thing nobody checked. In that case the button simply never appears.
*/
const undelete = {
	panel: document.getElementById('undelete'),
	card: document.getElementById('undelete-card'),
	note: document.getElementById('undelete-note'),
	list: document.getElementById('undelete-list'),
	close: document.getElementById('undelete-close'),
};
let recoverable = [];
let unattributable = 0;

// hours, then days past two -- the number that decides whether to act now, at the precision that
// decision actually needs
function timeLeft(purgeAt) {
	const ms = Date.parse(purgeAt || '') - Date.now();
	if (!Number.isFinite(ms)) return { text: '?', urgent: false };
	if (ms <= 0) return { text: 'due', urgent: true };
	const h = Math.floor(ms / 3600000);
	return h >= 48 ? { text: `${Math.floor(h / 24)} days left`, urgent: false } : { text: `${h}h left`, urgent: true };
}

async function refreshUndelete() {
	if (!menu.undelete) return;
	try {
		const res = await fetch('/api/v1/diagrams/deleted');
		if (!res.ok) { menu.undelete.hidden = true; return; }
		const body = await res.json();
		recoverable = body.window ? (body.deleted || []) : [];
		unattributable = body.unattributable || 0;
		menu.undelete.hidden = recoverable.length === 0;
	} catch { menu.undelete.hidden = true; }
}

function renderUndelete() {
	// the count of entries that cannot be attributed is said out loud: a shorter list than the
	// window actually holds, with no explanation, reads as a promise nobody made
	const aside = unattributable
		? ` ${unattributable} older ${unattributable === 1 ? 'entry predates' : 'entries predate'} ownership tagging and cannot be shown.`
		: '';
	undelete.note.textContent = (recoverable.length === 1
		? 'One diagram is still recoverable. After the window closes it is gone for good.'
		: `${recoverable.length} diagrams are still recoverable. After the window closes they are gone for good.`) + aside;
	undelete.list.innerHTML = '';
	for (const d of recoverable) {
		const left = timeLeft(d.purgeAt);
		const tr = document.createElement('tr');
		const cell = (cls, text) => { const td = document.createElement('td'); td.className = cls; td.textContent = text; tr.appendChild(td); return td; };
		cell(`left${left.urgent ? '' : ' roomy'}`, left.text);
		cell('name', d.name || '(unreadable)');
		cell('id', d.id);
		const act = document.createElement('td');
		const btn = document.createElement('button');
		btn.textContent = 'restore';
		btn.onclick = async () => {
			btn.disabled = true;
			btn.textContent = 'restoring';
			const res = await fetch(`/api/v1/diagrams/deleted/${d.id}/restore`, { method: 'POST' });
			if (!res.ok) {
				// D28/I16: a refusal is shown where the action was taken, not swallowed
				btn.textContent = 'refused';
				undelete.note.textContent = (await res.json().catch(() => ({}))).error || 'restore refused';
				return;
			}
			await refreshUndelete();
			if (!recoverable.length) undelete.panel.hidden = true; else renderUndelete();
			// the restored diagram is live now, so the picker must learn about it
			location.reload();
		};
		act.appendChild(btn);
		tr.appendChild(act);
		undelete.list.appendChild(tr);
	}
}

if (menu.undelete) {
	/*
	Refreshed before it is READ, and when the tab is looked at again.

	The button's visibility used to be recomputed only when a snapshot carrying a diagram list
	arrived, and a delete notifies just the people watching the deleted diagram -- so a tab sitting
	on anything else never learned the window had changed and needed a reload to show the control.
	That is the same shape as B94: a tab confidently believing something the server has since
	changed.

	Two cheap moments instead of polling. Opening the panel refetches, so a list is never stale at
	the instant somebody acts on it. And `visibilitychange` catches coming back to the tab, which is
	when a person looks -- a timer would spend requests continuously to be right at the one moment
	that already announces itself.
	*/
	menu.undelete.onclick = async () => { await refreshUndelete(); renderUndelete(); undelete.panel.hidden = false; };
	undelete.close.onclick = () => { undelete.panel.hidden = true; };
	// the same dismissal idiom as #access and #help: the backdrop closes, the card does not
	undelete.panel.onclick = (e) => { if (e.target === undelete.panel) undelete.panel.hidden = true; };
	document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshUndelete(); });
}


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
	codesList: document.getElementById('access-codes-list'),
	codeAgent: document.getElementById('access-code-agent'),
	codeMint: document.getElementById('access-code-mint'),
	codeNew: document.getElementById('access-code-new'),
	codeValue: document.getElementById('access-code-value'),
	codeCopy: document.getElementById('access-code-copy'),
	codeDone: document.getElementById('access-code-done'),
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

/*
Connection codes -- H9.29. A grant says what an agent may do; a code is how it proves who it is.

The plaintext exists once, in the response to the mint that created it, and this is the only place
it is ever displayed. It is held on screen until dismissed rather than fading or being cleared by
the next render, because there is no way to recover it: a code that scrolls away is a code that has
to be revoked and reminted. The list beneath shows ids, never the secret.
*/
function renderCodes(codes) {
	access.codesList.replaceChildren();
	if (!codes || !codes.length) {
		access.codesList.insertRow().insertCell().textContent = 'none';
		return;
	}
	for (const c of codes) {
		const row = access.codesList.insertRow();
		row.insertCell().textContent = short(c.agent);
		row.insertCell().textContent = c.created ? c.created.slice(0, 10) : '';
		row.insertCell().textContent = c.expires ? `expires ${c.expires.slice(0, 10)}` : 'no expiry';
		const btn = document.createElement('button');
		btn.textContent = 'revoke';
		btn.title = `revoke this code for ${c.agent}`;
		btn.addEventListener('click', () => sendCodes(`/${encodeURIComponent(c.id)}`, { method: 'DELETE' }));
		row.insertCell().appendChild(btn);
	}
}

async function sendCodes(suffix, init) {
	access.error.textContent = '';
	try {
		const res = await fetch(`/api/v1/workspace/codes${suffix}`, init);
		const body = await res.json().catch(() => ({}));
		if (!res.ok) { access.error.textContent = body.error || `refused (${res.status})`; return null; }
		if (body.codes) renderCodes(body.codes);
		return body;
	} catch (e) {
		access.error.textContent = `could not reach the server: ${e.message}`;
		return null;
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

	access.codeMint.addEventListener('click', async () => {
		const body = await sendCodes('', {
			method: 'POST',
			body: JSON.stringify({ agent: access.codeAgent.value.trim() }),
		});
		if (!body || !body.code) return;
		// the one appearance. Revealed before the list refreshes, so a failure to re-list cannot
		// take the plaintext with it.
		access.codeValue.textContent = body.code;
		access.codeNew.hidden = false;
		access.codeAgent.value = '';
		sendCodes('', { method: 'GET' });
	});
	access.codeAgent.addEventListener('keydown', (e) => { if (e.key === 'Enter') access.codeMint.click(); });
	access.codeDone.addEventListener('click', () => { access.codeNew.hidden = true; access.codeValue.textContent = ''; });
	access.codeCopy.addEventListener('click', async () => {
		// clipboard access can be refused (permissions, insecure context). Selecting the text is the
		// fallback that always works, and saying which happened beats a button that silently does
		// nothing with a secret the user cannot get back.
		try {
			await navigator.clipboard.writeText(access.codeValue.textContent);
			access.codeCopy.textContent = 'copied';
			setTimeout(() => { access.codeCopy.textContent = 'copy'; }, 1500);
		} catch {
			const r = document.createRange();
			r.selectNodeContents(access.codeValue);
			const sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(r);
			access.error.textContent = 'could not reach the clipboard — the code is selected, copy it by hand';
		}
	});
}

/*
B105 -- the agent indicator. A second axis, and the only clickable one.

The pill says what may I do HERE; this says what is happening ANYWHERE, and the two co-occur, which
is the test that says they cannot share an element. Hidden when nothing is running, so a still
workspace has a still header rather than a box announcing that nothing is happening.

It reports the diagram by NAME, not by id. An id names something the operator cannot picture, and
the entire value of the element is telling them where work they are not watching is going on. The
name comes from the diagram list the same state carries, so no extra fetch and no second source.

Clicking opens that diagram, which is the whole affordance: the element names somewhere else to be,
so it should take you there. Clicking is suppressed when the work is on the diagram already in view,
because there is nowhere to go and a control that does nothing is worse than none.
*/
let agentTarget = null;
function renderAgents(agents, currentId, diagrams) {
	const list = Array.isArray(agents) ? agents : [];
	/*
	B155: a RESTING state, never hidden. Appearing is motion, and motion in the header shoves the
	neighbouring indicators sideways at the exact moment the operator is reading them. `no agents`
	is a true answer to what this element asks, and `#lockstate` has always answered `offline` the
	same way rather than vanishing.
	*/
	if (!list.length) {
		menu.agents.className = 'agents-none';
		menu.agents.textContent = 'no agents';
		menu.agents.title = 'no agent is working in this workspace';
		agentTarget = null;
		return;
	}

	const nameOf = (id) => (diagrams || []).find((d) => d.id === id)?.name || id;
	const here = list.find((a) => a.diagram === currentId);
	const a = here || list[0];
	const who = a.principal ? a.principal.replace(/^agent:/, '') : 'an agent';
	const extra = list.length > 1 ? ` +${list.length - 1}` : '';

	menu.agents.className = here ? 'agents-here' : 'agents-idle';
	menu.agents.textContent = here ? `${who} is driving${extra}` : `${who}: ${nameOf(a.diagram)}${extra}`;
	menu.agents.title = here
		? `${who} holds the write lock on this diagram`
		: `${who} is working on ${nameOf(a.diagram)} — click to open it`;
	agentTarget = here ? null : a.diagram;
}
menu.agents.addEventListener('click', () => { if (agentTarget) sync.openDiagram(agentTarget); });

let onStateLastId = null;
const net = new Net(wsUrl(location));   // B60 -- wss: on an https page, ws: on http
// D4 — the inversion. Sync subscribes to the COMMIT boundary, never to the model. There is then
// no way to forward an uncommitted change, because uncommitted changes never pass through Changes.
// A 4-second 3-node drag went from ~60 server transactions to exactly one.
const sync = new Sync({
	model, net, history, selection, clock,
	onState({ status, meta, diagrams, locked, mayWrite, principal, agents, error, rewound }) {
		// H9.3c: read-only is tested BEFORE locked, because the locked branch offers "click to
		// take back" and reclaim is itself a write capability (B64). A reader shown that would
		// be offered the one remedy the server is certain to refuse.
		if (status !== 'open') { menu.lock.className = 'lock-offline'; menu.lock.textContent = 'offline'; menu.lock.title = 'no server connection'; }
		else if (!mayWrite) { menu.lock.className = 'lock-readonly'; menu.lock.textContent = 'read-only'; menu.lock.title = 'you have view access to this diagram'; }
		else if (locked) { menu.lock.className = 'lock-locked'; menu.lock.textContent = 'locked'; menu.lock.title = 'server has control — click to take back'; }
		else { menu.lock.className = 'lock-unlocked'; menu.lock.textContent = 'unlocked'; menu.lock.title = 'you have control'; }
		renderAgents(agents, meta && meta.id, diagrams);
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
		/*
		B155: `local` at rest, never hidden.

		The prior reasoning was that "anonymous would name a state that does not exist in a
		single-tenant run", and that is right about `anonymous` and wrong about the conclusion. The
		state DOES exist and has a name: no identity source is configured, which is also why
		`server/server.js` leaves authorization off. So the resting text reports something true
		rather than reserving blank space.
		*/
		if (principal) {
			menu.whoami.className = '';
			menu.whoami.textContent = principal.startsWith('user:') ? principal.slice(5) : principal;
			menu.whoami.title = principal;
		} else {
			menu.whoami.className = 'whoami-local';
			menu.whoami.textContent = 'local';
			menu.whoami.title = 'no identity source is configured, so authorization is off';
		}
		// H9.4d: identity and the access it confers are the same question, so the affordance hangs
		// off the element that already answers "who am I" rather than earning a button of its own.
		const isOwner = !!principal && !!meta.owner && meta.owner === principal;
		accessId = meta.id;
		// H9.4c: the panel opens for anyone signed in, not only the diagram's owner, because the
		// workspace half is always theirs. The diagram half is hidden by CSS when they do not own
		// what is on screen — the server would refuse those calls, and offering a door certain not
		// to open is worse than offering none.
		if (principal) menu.whoami.classList.add('can-admin');
		menu.whoami.title = principal
			? `${principal} — click to manage who can reach ${isOwner ? 'this diagram, and everything you own' : 'everything you own'}`
			: '';
		menu.whoami.onclick = principal ? () => {
			access.panel.dataset.owner = meta.owner;
			access.error.textContent = '';
			access.card.classList.toggle('not-owner', !isOwner);
			if (isOwner) renderAccess(meta.owner, meta.grants);
			renderWorkspace({});
			renderCodes([]);
			access.codeNew.hidden = true;
			access.panel.hidden = false;
			// neither workspace grants nor codes live in a diagram, so unlike meta.grants they are fetched
			sendWorkspace('', { method: 'GET' });
			sendCodes('', { method: 'GET' });
		} : null;
		const readOnly = !mayWrite || !!locked;
		input.setReadOnly(readOnly);
		menu.name.disabled = readOnly;
		if (onStateLastId && onStateLastId !== meta.id) disarmDelete();
		onStateLastId = meta.id;
		if (document.activeElement !== menu.name) menu.name.value = meta.name;
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
			/*
			H9.9: a template is marked in the picker, because the picker is the one surface that
			shows a name and nothing else.

			Everywhere else the id disambiguates -- `template-3acaca arrow` beside `diagram-c1f6cc
			arrow` is unambiguous in the CLI and in the payload. Here the id is the option's VALUE
			and only the name is drawn, so a forked `arrow` and the `arrow` it came from looked
			identical. The class carries what the option text cannot.
			*/
			diagrams.forEach((d) => {
				const o = document.createElement('option');
				o.value = d.id;
				o.textContent = d.name;
				if (d.template) o.className = 'tpl';
				menu.list.appendChild(o);
			});
			// B109: the list changed, so what is recoverable may have too -- a delete is the most
			// likely reason this branch ran at all
			refreshUndelete();
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

net.init();

window.draw = { model, history, renderer, selection, input, palette, labels, readout, net, sync };
