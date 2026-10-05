/*
THE BEHAVIOUR MATRIX'S RUNNER, shared by the pages it runs on (P7 X-b, H18.38; PAGE-HELD-TO-MATRIX.md, ruled L1 and L2).

Moved out of tests/lab-browser.test.js unchanged but for one seam: the page under test is `H`, which a DRIVER defines. The lab's
driver is that file's; the product page's is tests/page-matrix.test.js. One vocabulary of steps and checks, one snapshot, one
set of invariants and one corpus, so a row means the same on both pages and the product page is held to the lab's record (L1).
The one-tab CDP client and the real-input helpers move here too, so the two drivers drive Chrome the same way.
*/
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { canonical } from './gesture-corpus.mjs';   // ids by kind and first appearance, as the gesture corpus writes them

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- one tab, navigated per test (see tests/lab-browser.test.js for why one) ----
export function createTab(cdp) {
	let tab = null;
	return async function theTab() {
	if (tab) return tab;
	// `cdp` may be a function, for a file whose Chrome starts after this is made
	const t = await (await fetch(`http://127.0.0.1:${typeof cdp === 'function' ? cdp() : cdp}/json/new?about:blank`, { method: 'PUT' })).json();
	const { default: WebSocket } = await import('ws');
	const ws = new WebSocket(t.webSocketDebuggerUrl);
	let id = 0; const pending = new Map(); const thrown = []; const requests = new Map(); const timeline = []; const clock = { t0: Date.now() };
	const PATH = (u) => String(u ?? '').replace(/^https?:\/\/[^/]+/, '');
	ws.on('message', (raw) => {
		const m = JSON.parse(raw.toString());
		// FULL TIMELINE of the current navigation, for diagnosing a load that fails (dumped only then)
		if (m.method) {
			const at = Date.now() - clock.t0, p = m.params ?? {};
			if (m.method === 'Network.requestWillBeSent') timeline.push({ at, ev: 'request', id: p.requestId, url: PATH(p.request.url), type: p.type });
			else if (m.method === 'Network.responseReceived') timeline.push({ at, ev: 'response', id: p.requestId, status: p.response.status });
			else if (m.method === 'Network.loadingFinished') timeline.push({ at, ev: 'finished', id: p.requestId });
			else if (m.method === 'Network.loadingFailed') timeline.push({ at, ev: 'FAILED', id: p.requestId, url: requests.get(p.requestId), error: p.errorText, canceled: p.canceled, blocked: p.blockedReason ?? null });
			else if (m.method.startsWith('Page.') || m.method.startsWith('Target.') || m.method.startsWith('Inspector.')
				|| m.method === 'Runtime.executionContextCreated' || m.method === 'Runtime.executionContextDestroyed' || m.method === 'Runtime.exceptionThrown') {
				timeline.push({ at, ev: m.method, detail: JSON.stringify(p).slice(0, 180) });
			}
		}
		if (m.method === 'Runtime.exceptionThrown') thrown.push(String(m.params?.exceptionDetails?.exception?.description ?? m.params?.exceptionDetails?.text).slice(0, 200));
		if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') thrown.push(`console: ${m.params.entry.text.slice(0, 200)}`);
		if (m.method === 'Network.requestWillBeSent') requests.set(m.params.requestId, m.params.request.url.replace(/^https?:\/\/[^/]+/, ''));
		if (m.method === 'Network.loadingFailed' && !m.params.blockedReason) thrown.push(`request failed: ${m.params.errorText} (${requests.get(m.params.requestId) ?? '?'})`);
		if (m.method === 'Network.responseReceived' && m.params.response.status !== 200 && m.params.type !== 'Document') {
			thrown.push(`response ${m.params.response.status} (${m.params.response.url.replace(/^https?:\/\/[^/]+/, '')})`);
		}
		if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
	});
	await new Promise((r) => ws.on('open', r));
	const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
	const run = async (expression) => {
		const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
		if (res.result?.exceptionDetails) throw new Error(String(res.result.exceptionDetails.exception?.description).slice(0, 300));
		return res.result?.result?.value;
	};
	await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
	await send('Page.enable'); await send('Page.setLifecycleEventsEnabled', { enabled: true });
	// a fixed viewport, so canvas coordinates map to the same screen pixels on every run
	await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
	tab = { ws, send, run, thrown, requests, timeline, clock };
	return tab;
}
}

// ---- real input, in canvas coordinates, through the canvas's own transform ----
export function inputOf(t) {
	const screen = (x, y) => t.run(`(() => { const m = document.getElementById('container').getScreenCTM(); return [m.a * ${x} + m.e, m.d * ${y} + m.f]; })()`);
	const mouse = async (type, x, y, buttons = 0) => {
		const [sx, sy] = await screen(x, y);
		await t.send('Input.dispatchMouseEvent', { type, x: sx, y: sy, button: 'left', buttons, clickCount: 1 });
		await sleep(20);
	};
	const key = async (k) => {
		const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
		const vk = k === 'Delete' ? 46 : k.toUpperCase().charCodeAt(0);
		for (const type of ['keyDown', 'keyUp']) {
			await t.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
		}
		await sleep(30);
	};
	// a drag from one point to another, pressing a key at each listed stop on the way
	const drag = async (from, to, hops = []) => {
		await mouse('mousePressed', from[0], from[1], 1);
		for (const [k, x, y] of hops) { await mouse('mouseMoved', x, y, 1); await key(k); }
		await mouse('mouseMoved', to[0], to[1], 1);
		await mouse('mouseReleased', to[0], to[1], 0);
		await sleep(150);
	};
	const click = async (x, y) => { await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y, 0); await sleep(60); };
	// a Shift-click, for adding to the selection: CDP's modifiers bit 8 is Shift
	const shiftClick = async (x, y) => {
		const [sx, sy] = await screen(x, y);
		for (const type of ['mousePressed', 'mouseReleased']) { await t.send('Input.dispatchMouseEvent', { type, x: sx, y: sy, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, modifiers: 8 }); await sleep(20); }
		await sleep(60);
	};
	return { mouse, key, drag, click, shiftClick };
}

// ---- the vocabulary ----
export const MATRIX = JSON.parse(fs.readFileSync(new URL('../../dev/design/unification/BEHAVIOUR-MATRIX.json', import.meta.url), 'utf8'));

// every step a row may take, each performed with real input through the canvas's own transform
const STEP = {
	click: (p, x, y) => p.click(x, y),
	shiftClick: (p, x, y) => p.shiftClick(x, y),
	move: (p, x, y) => p.mouse('mouseMoved', x, y),
	key: (p, k) => p.key(k),
	drag: (p, from, to, hops) => p.drag(from, to, hops),
	undo: (p) => p.undo(),   // the path Ctrl+Z takes -- the driver's page's history
	redo: (p) => p.redo(),   // the path Ctrl+Shift+Z takes
	settle: (p) => p.settle(),   // until the page has its answer: in the lab at once, on the product page when the server answers
};

// what the page shows, gathered once: the authority, the tab, the canvas as COMPUTED, and the notice
/*
P7 X-b (H18.38) -- `H` is the page under test, defined by the driver's PRELUDE: its tab model, its authority, its network, its
input and its notice. The lab's reads `window.lab`; the product page's reads `window.draw`, the authority from the server's
document through REST, and the notice from the header banner (ruled L1: the page's own nature, named here and only here).
*/
const snapshot = (prelude) => `(async () => {
	${prelude}
	const drawn = (el) => {
		const cs = getComputedStyle(el);
		const dash = cs.strokeDasharray === 'none' ? [] : cs.strokeDasharray.split(/[ ,]+/).map(parseFloat);
		// a zero-length dash with a round cap is a DOT; without the round cap it draws nothing at all
		return { d: el.getAttribute('d') || '', stroke: cs.stroke, dotted: dash.length >= 2 && dash[0] === 0 && dash[1] > 0 && cs.strokeLinecap === 'round' };
	};
	const shape = (l) => ({ id: l.id, src: l.src, dst: l.dst, via: l.via ?? [] });
	return {
		notice: H.notice(),
		links: H.authority.all('link').map((l) => ({ ...shape(l), down: H.model.isLinkDown(l) })),
		// how many links are control links (B284: a cut keeps the plane)
		controls: H.authority.all('link').filter((l) => l.control).length,
		tabLinks: H.model.all('link').map(shape),
		anchors: H.authority.all('node').filter((n) => !n.type).map((w) => ({ id: w.id, x: w.x, y: w.y })),
		tabAnchors: H.model.all('node').filter((n) => !n.type).map((w) => w.id),
		alive: H.authority.all('node').map((e) => e.id),   // every anchor, typed or not (F-c)
		// pipes are entities in both models since N-c: what the planner holds, and whether the tab holds the same (I1)
		pipes: H.authority.all('pipe').map(({ a, b, laid }) => ({ a, b, laid })),
		// whether the tab holds exactly the authority's pipes -- a verdict, not the ids, which carry minted anchors' random hex
		// the pipes drawn, and the pipes an up link runs over -- from the network's own routes (2026-10-02: one is never the other)
		// SEEN, not merely present: a pipe under a link stays in the page, hidden (2026-10-02)
		// Chrome's checkVisibility() does not look up through a hidden SVG group, so the ancestors are walked here
		drawnPipes: [...document.querySelectorAll('#pipes line.pipe')].filter((l) => { for (let n = l; n && n.id !== 'container'; n = n.parentElement) if (getComputedStyle(n).display === 'none') return false; return true; }).map((l) => l.id).sort(),
		pipeElements: [...document.querySelectorAll('#pipes .pipe-of')].map((g) => g.getAttribute('data-pipe')).sort(),
		underLinks: (() => { const v = H.network.view.of(H.model), on = new Set();
			for (const l of H.model.all('link')) { const r = v.route(l.id); if (r) for (let i = 0; i < r.length - 1; i++) on.add([r[i], r[i + 1]].sort().join('|')); }
			return H.model.all('pipe').filter((p) => on.has([p.a, p.b].sort().join('|'))).map((p) => p.id).sort(); })(),
		allPipes: H.model.all('pipe').map((p) => p.id).sort(),
		pipesAgree: JSON.stringify(H.model.all('pipe').map((p) => p.id).sort()) === JSON.stringify(H.authority.all('pipe').map((p) => p.id).sort()),
		tabPipeCount: H.model.all('pipe').length,
		// a selected pipe spelled by its two ends (N-c2): its id is made of a minted anchor's random hex, which the corpus's
		// canonical numbering cannot see, while the ends are anchor ids it numbers like any other
		selected: H.input.selection.list().map((id) => { const p = id.startsWith('pipe-') && H.model.get('pipe', id); return p ? \`pipe:\${p.a}:\${p.b}\` : id; }),
		// what declares transit off on the canvas: each drawn transit ring, by the anchor or node it marks, and how it looks
		rings: [...document.querySelectorAll('.wp-transit')].map((c) => { const cs = getComputedStyle(c); return { id: c.closest('g[id]').id, stroke: cs.stroke, dashed: cs.strokeDasharray !== 'none', fitted: Number(c.getAttribute('pathLength')) || null }; }),
		// what each waypoint IS (B277): its roles as drawn -- the class and the rings -- and as Input judges it, the two readers
		waypointRoles: [...document.querySelectorAll('#waypoints g.waypoint')].map((g) => ({ id: g.id,
			drawn: [...g.classList].filter((c) => c === 'endpoint' || c === 'junction'), junctionRing: !!g.querySelector('.wp-junction'),
			endpointRing: !!g.querySelector('.wp-ring'), transitOff: !!g.querySelector('.wp-transit'), judged: H.input.situation(g.id).target?.roles ?? null })),
		// every stretch an UP link is drawn along, as the pair of points it joins -- from what is drawn, not from the assignment
		stretches: H.model.all('link').filter((l) => !H.model.isLinkDown(l)).map((l) => {
			const pts = H.model.pathOf(l) ?? [];
			return { id: l.id, keys: pts.slice(1).map((q, i) => [pts[i].join(','), q.join(',')].sort().join('|')) };
		}),
		paths: Object.fromEntries([...document.querySelectorAll('#links path.link')].map((el) => [el.id, drawn(el)])),
	};
})()`;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byId = (xs) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));
const ids = (xs) => xs.map((x) => x.id ?? x).join(',') || 'none';

// what must hold after EVERY row, ruled or not -- each true, or a sentence saying what broke
const INVARIANT = {
	I1: (s) => (same(byId(s.links.map(({ down, ...l }) => l)), byId(s.tabLinks)) && same([...s.tabAnchors].sort(), s.anchors.map((a) => a.id).sort()) && s.pipesAgree)
		|| `the tab holds links ${ids(s.tabLinks)}, ${s.tabAnchors.length} anchors and ${s.tabPipeCount} pipes; the authority holds ${ids(s.links)}, ${s.anchors.length} and ${s.pipes.length}${s.pipesAgree ? '' : ', and the pipes differ'}`,
	I2: (s) => {
		const wrong = s.links.filter((l) => s.paths[l.id] && s.paths[l.id].dotted !== l.down);
		return !wrong.length || wrong.map((l) => `${l.id} is ${l.down ? 'down but drawn solid' : 'up but drawn dotted'}`).join('; ');
	},
	I3: (s) => (same(Object.keys(s.paths).sort(), s.links.map((l) => l.id).sort()) && Object.values(s.paths).every((p) => p.d))
		|| `the canvas draws ${ids(Object.keys(s.paths))} where ${ids(s.links)} exist`,
	I4: (s) => {
		const dangling = s.pipes.filter((x) => !s.alive.includes(x.a) || !s.alive.includes(x.b));
		return !dangling.length || `pipes to missing anchors: ${dangling.map((x) => `${x.a}-${x.b}`).join(', ')}`;
	},
	I5: (s, thrown) => !thrown.length || `the page threw: ${thrown.join('; ')}`,
	I6: (s) => {
		const on = new Map();
		for (const { id, keys } of s.stretches) for (const k of new Set(keys)) on.set(k, [...(on.get(k) ?? []), id]);
		const stacked = [...on].filter(([, ids]) => ids.length > 1);
		return !stacked.length || stacked.map(([k, ids]) => `${ids.join(' and ')} are both drawn along ${k}`).join('; ');
	},
	// 2026-10-02: a pipe is drawn exactly when no up link runs over it
	I8: (s) => {
		const want = s.allPipes.filter((id) => !s.underLinks.includes(id));
		if (!same(s.pipeElements, s.allPipes)) return `${s.pipeElements.length} pipe elements in the page for ${s.allPipes.length} pipes: one each, kept, hidden or not`;
		return same(s.drawnPipes, want) || `seen pipes ${s.drawnPipes.length}, where the pipes no up link runs over are ${want.length}`;
	},
	// B277: transit off admits endpoints only -- no junction class, no junction ring, and Input never judges one
	I7: (s) => {
		const wrong = s.waypointRoles.filter((w) => w.transitOff && (w.junctionRing || w.drawn.includes('junction') || (w.judged ?? []).includes('junction')));
		return !wrong.length || wrong.map((w) => `${w.id} declares transit off and is a junction: ${JSON.stringify(w)}`).join('; ');
	},
};

// a link a check names: its id, or "only" when exactly one link exists
const select = (s, sel) => (sel === 'only' ? (s.links.length === 1 ? s.links[0] : null) : s.links.find((l) => l.id === sel) ?? null);
const laid = (s, kind) => s.pipes.filter((x) => x.laid === kind).length;
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
// a point in a drawn path, as a whole number pair: "240 300" must not match inside "-240 300"
const passes = (d, [x, y]) => new RegExp(`(^|[A-Za-z ])${x} ${y}(?![\\d.])`).test(d);
const fateOf = (s, id) => { const l = s.links.find((x) => x.id === id); return !l ? 'gone' : l.down ? 'down' : 'up'; };

// every check a row or state may make -- each true, or a sentence saying what the page shows instead
const CHECK = {
	links: (s, n) => s.links.length === n || `${s.links.length} links, not ${n}`,
	anchors: (s, n) => s.anchors.length === n || `${s.anchors.length} anchors, not ${n}`,
	down: (s, n) => s.links.filter((l) => l.down).length === n || `${s.links.filter((l) => l.down).length} links down, not ${n}`,
	pipes: (s, want) => (typeof want === 'number'
		? s.pipes.length === want || `${s.pipes.length} pipes, not ${want}`
		: (laid(s, 'hand') === want.hand && laid(s, 'link') === want.link)
			|| `${laid(s, 'hand')} pipes by hand and ${laid(s, 'link')} with a link, not ${want.hand} and ${want.link}`),
	linkState: (s, want) => {
		const wrong = Object.entries(want).filter(([id, fate]) => fateOf(s, id) !== fate);
		return !wrong.length || wrong.map(([id, fate]) => `${id} is ${fateOf(s, id)}, not ${fate}`).join('; ');
	},
	pins: (s, want) => {
		const wrong = Object.entries(want).filter(([sel, n]) => select(s, sel)?.via.length !== n);
		return !wrong.length || wrong.map(([sel, n]) => `${sel} pins ${select(s, sel)?.via.length ?? 'nothing -- no such link'}, not ${n}`).join('; ');
	},
	straight: (s, want) => {
		const wrong = Object.entries(want).filter(([sel, d]) => s.paths[select(s, sel)?.id]?.d !== d);
		return !wrong.length || wrong.map(([sel, d]) => `${sel} is drawn "${s.paths[select(s, sel)?.id]?.d}", not "${d}"`).join('; ');
	},
	through: (s, want) => {
		const wrong = Object.entries(want).filter(([sel, pts]) => { const d = s.paths[select(s, sel)?.id]?.d ?? ''; return !pts.every((pt) => passes(d, pt)); });
		return !wrong.length || wrong.map(([sel, pts]) => `${sel} is drawn "${s.paths[select(s, sel)?.id]?.d}", which does not pass ${JSON.stringify(pts)}`).join('; ');
	},
	linksBetween: (s, want) => {
		const n = (a, b) => s.links.filter((l) => (l.src === a && l.dst === b) || (l.src === b && l.dst === a)).length;
		const wrong = Object.entries(want).filter(([pair, k]) => n(...pair.split('|')) !== k);
		return !wrong.length || wrong.map(([pair, k]) => `${n(...pair.split('|'))} links join ${pair}, not ${k}`).join('; ');
	},
	keptAt: (s, pts) => pts.every(([x, y]) => s.anchors.some((a) => a.x === x && a.y === y))
		|| `no anchor at ${JSON.stringify(pts.filter(([x, y]) => !s.anchors.some((a) => a.x === x && a.y === y)))}`,
	notice: (s, re) => new RegExp(re).test(s.notice) || `the notice says "${s.notice}", which does not match /${re}/`,
	noticeNot: (s, re) => !new RegExp(re).test(s.notice) || `the notice says "${s.notice}", which must not match /${re}/`,
	refused: (s, want) => /refused/.test(s.notice) === want || `the notice says "${s.notice}", which is ${want ? 'not ' : ''}a refusal`,
	stroke: (s, want) => {
		const wrong = Object.entries(want).filter(([id, hex]) => s.paths[id]?.stroke !== rgb(hex));
		return !wrong.length || wrong.map(([id, hex]) => `${id} is stroked ${s.paths[id]?.stroke ?? '(not drawn)'}, not ${hex}`).join('; ');
	},
	rings: (s, ids) => same(s.rings.map((r) => r.id).sort(), [...ids].sort()) || `the rings mark ${s.rings.map((r) => r.id).join(',') || 'nothing'}, not ${ids.join(',') || 'nothing'}`,
	// what a waypoint is, the same as drawn and as judged; an endpoint carries the endpoint ring, a junction the junction ring
	roles: (s, want) => {
		const wrong = Object.entries(want).filter(([id, roles]) => {
			const w = s.waypointRoles.find((x) => x.id === id);
			return !w || !same(w.drawn, roles) || !same(w.judged, roles)
				|| w.endpointRing !== roles.includes('endpoint') || w.junctionRing !== roles.includes('junction');
		});
		return !wrong.length || wrong.map(([id, roles]) => `${id} is ${JSON.stringify(s.waypointRoles.find((x) => x.id === id) ?? 'not drawn')}, not ${roles.join(' and ')}`).join('; ');
	},
	// dashed, light red (Red 200), on the junction's rung -- ruled 2026-10-02; it was light orange until then
	ringLook: (s) => (s.rings.length > 0 && s.rings.every((r) => r.stroke === rgb('#ef9a9a') && r.dashed && r.fitted)) || `the rings are drawn ${JSON.stringify(s.rings)}, not dashed in #ef9a9a and fitted to the ring`,
	// the selection is exactly the one down link -- for a board whose links are drawn by gestures, so their ids are not known
	selectedDown: (s, want) => { const down = s.links.filter((l) => l.down).map((l) => l.id); return (down.length === 1 && same([...s.selected], down)) === want || `the selection is ${s.selected.join(',') || 'empty'}, and the down links are ${down.join(',') || 'none'}`; },
	// the kinds of what is selected -- for an id the gesture minted, which a row cannot name (H17.22 N-c2)
	selectedKinds: (s, kinds) => same(s.selected.map((id) => id.split(/[-:]/)[0]).sort(), [...kinds].sort()) || `the selection is ${s.selected.join(',') || 'empty'}, not of kinds ${kinds.join(',')}`,
	controls: (s, n) => s.controls === n || `${s.controls} control links, not ${n}`,
	selected: (s, ids) => same([...s.selected].sort(), [...ids].sort()) || `the selection is ${ids.length ? s.selected.join(',') || 'empty' : s.selected.join(',')}, not ${ids.join(',')}`,
	downStroke: (s, hex) => {
		const down = s.links.filter((l) => l.down);
		const wrong = down.filter((l) => s.paths[l.id]?.stroke !== rgb(hex));
		return (down.length > 0 && !wrong.length) || (down.length ? `down links are stroked ${wrong.map((l) => s.paths[l.id]?.stroke).join(', ')}, not ${hex}` : 'no link is down to show the colour');
	},
};

// every step, check and invariant the matrix names that this file does not perform
export function matrixProblems(m) {
	const out = [];
	const steps = (where, list) => { for (const [verb] of list ?? []) if (!(verb in STEP)) out.push(`${where}: there is no step "${verb}"`); };
	const checks = (where, expect) => { for (const key of Object.keys(expect ?? {})) if (!(key in CHECK)) out.push(`${where}: there is no check "${key}"`); };
	for (const [name, st] of Object.entries(m.states)) { steps(`state ${name}`, st.setup); checks(`state ${name}`, st.expect); }
	for (const r of m.rows) { steps(r.id, r.steps); checks(r.id, r.expect); }
	const declared = Object.keys(m.invariants).sort(), checked = Object.keys(INVARIANT).sort();
	if (!same(declared, checked)) out.push(`the matrix declares invariants ${declared.join(',')}; this file checks ${checked.join(',')}`);
	return out;
}


const judge = (checks, s) => Object.entries(checks).map(([key, want]) => CHECK[key](s, want)).filter((r) => r !== true);
const perform = async (p, steps) => { for (const [verb, ...args] of steps) await STEP[verb](p, ...args); };


const corpusForm = (s) => {
	// the drawn and occupied pipe lists carry pipe ids, made of minted anchors' random hex; I8 judges them, so they are counted here
	const { drawnPipes, underLinks, allPipes, pipeElements, ...rest } = s;
	const c = canonical({ ...rest, drawnPipes: drawnPipes.length });
	c.pipes = c.pipes.map((q) => { const [a, b] = [q.a, q.b].sort(); return { ...q, a, b }; });
	return c;
};


/*
EVERY ROW, as a test on one page. `driver` is the page under test:
  open(board)   the board a row's state names, opened, answering a page `p`: `run`, the real-input helpers, `undo`, `redo`,
                `settle` and `close`
  theTab()      the one tab, for what the page threw (I5)
  prelude       the expression defining `H` (above)
  corpus        the matrix corpus every page is held to (L1); `write`, an object to record into, given only by the lab
`name` prefixes each test, so a failure names the page it failed on.
*/
export function matrixTests({ test, name, skip, driver, corpus, write = null }) {
	const SNAPSHOT = snapshot(driver.prelude);
	for (const row of MATRIX.rows) {
		const state = MATRIX.states[row.state];
		const standing = row.standing === 'open' ? 'OPEN' : row.built === 'yes' ? row.standing : `TODO, ${row.standing}`;
		if (driver.only && !driver.only.includes(row.id)) continue;
		test(`${name} ${row.id} [${standing}] ${row.state} x ${row.gesture}: ${row.does}`, { skip }, async () => {
			const p = await driver.open(state.board);
			const t = await driver.theTab();
			try {
				await perform(p, [...state.setup, ['settle']]);
				const unset = judge(state.expect, await p.run(SNAPSHOT));
				if (row.built === 'todo' && unset.length) return;
				assert.deepEqual(unset, [], `the board is not in state "${row.state}" after its setup, so ${row.id} would prove nothing: ${unset.join('; ')}`);
				await perform(p, [...row.steps, ['settle']]);
				const s = await p.run(SNAPSHOT);
				const held = () => {
					if (write) { write[row.id] = corpusForm(s); return; }
					assert.deepEqual(corpusForm(s), corpus[row.id], `${row.id}: the board after its steps differs from the matrix corpus -- a change its own checks do not name`);
				};
				const broken = Object.entries(INVARIANT).map(([id, holds]) => { const r = holds(s, t.thrown); return r === true ? null : `${id}: ${r}`; }).filter(Boolean);
				if (row.standing === 'open') {
					assert.deepEqual(broken, [], `${row.id} waits for a ruling, but the universal invariants hold on every row`);
					held();
					return;
				}
				const missed = [...broken, ...judge(row.expect, s)];
				if (row.built === 'yes') assert.deepEqual(missed, [], `${row.id} does not do what the matrix intends:\n  ${missed.join('\n  ')}`);
				else assert.ok(missed.length > 0, `${row.id} now does what the matrix intends -- promote it to "built": "yes" and drop its "today"`);
				held();
			} finally { await p.close(); }
		});
	}
}
