/*
The map evaluation's scoring (H28.3, B440): the board read from the store's file, each task's answer derived from it, and each
outcome scored from the agent's answer.txt, the server's state when the session ended, and the shim's log. Pure functions;
hooks/score.mjs reads the snapshot and calls them, tools/generate.mjs derives data/answers.json with them, test/ holds them to cases.
*/
export const SIZES = Object.freeze({ a: [31, 17], b: [17, 17] });
export const mod = (a, n) => ((a % n) + n) % n;
// at least two cells inside its chunk's edges, at every size the arms use
export const edgeClear = (cx, cy, sizes = Object.values(SIZES)) => sizes.every(([w, h]) => {
	const lx = mod(cx + (w - 1) / 2, w), ly = mod(cy + (h - 1) / 2, h);
	return lx >= 2 && lx <= w - 3 && ly >= 2 && ly <= h - 3;
});

export const T6_AREA = Object.freeze([20, -20, 70, 10]);
export const KINDS = ['nodes', 'links', 'zones', 'groups', 'pipes', 'layouts'];
// the verbs that tell where things are without the map
export const POSITION_VERBS = new Set(['get', 'show', 'dump', 'about', 'links', 'holds', 'peers', 'near', 'anchor nearest', 'anchor free',
	'zone contents', 'link path', 'render', 'parity', 'history', 'focus', 'sessions']);

// the board: devices (nodes with a type) and waypoints (nodes without) by cell, from the store's file
export function boardOf(doc) {
	const pitch = doc.layouts?.[0]?.pitch ?? 60;
	const nodes = (doc.nodes || []).map((n) => ({ ...n, cell: [n.x / pitch, n.y / pitch] }));
	const byName = new Map(nodes.map((n) => [n.name, n]));
	return { pitch, nodes, devices: nodes.filter((n) => n.type), waypoints: nodes.filter((n) => !n.type), byName, links: doc.links || [] };
}
const cellOf = (b, name) => { const n = b.byName.get(name); if (!n) throw new Error(`no ${name} on the board`); return n.cell; };
const free = (b, [cx, cy]) => !b.nodes.some((n) => n.cell[0] === cx && n.cell[1] === cy);
export const inArea = ([cx, cy], [x0, y0, x1, y1] = T6_AREA) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;

// each task's answer, read from the board; throws where the board does not hold the task as written
export function answersOf(doc) {
	const b = boardOf(doc);
	const gw = b.byName.get('edge-gw');
	const east = b.links.filter((l) => l.src === gw.id || l.dst === gw.id).map((l) => b.nodes.find((n) => n.id === (l.src === gw.id ? l.dst : l.src))).filter((n) => n.cell[0] > gw.cell[0]);
	if (east.length !== 1) throw new Error(`edge-gw has ${east.length} links eastward`);
	const fw = cellOf(b, 'fw-north-3');
	const beside = [[fw[0] + 1, fw[1]], [fw[0] - 1, fw[1]], [fw[0], fw[1] + 1], [fw[0], fw[1] - 1]].filter((c) => free(b, c));
	const [db, app] = [b.byName.get('db-west-2'), b.byName.get('app-east-5')];
	if (b.links.some((l) => [l.src, l.dst].sort().join() === [db.id, app.id].sort().join())) throw new Error('db-west-2 and app-east-5 are already linked');
	const vx = b.devices.filter((n) => n.type === 'vxlan');
	if (vx.length !== 1) throw new Error(`${vx.length} vxlan devices`);
	const west = [vx[0].cell[0] - 1, vx[0].cell[1]];
	if (!free(b, west)) throw new Error('the cell west of the vxlan is taken');
	const area = T6_AREA;
	return {
		diagram: doc.meta.id,
		't1-find': { name: 'vault-7', cell: cellOf(b, 'vault-7'), targets: [cellOf(b, 'vault-7')] },
		't2-trace': { from: 'edge-gw', name: east[0].name, cell: east[0].cell, targets: [gw.cell, east[0].cell] },
		't3-place': { beside: 'fw-north-3', at: fw, free: beside, name: 'sw-new', type: 'server', targets: [fw] },
		't4-wire': { a: 'db-west-2', b: 'app-east-5', targets: [db.cell, app.cell] },
		't5-hunt': { name: vx[0].name, cell: vx[0].cell, place: west, host: 'h-west', type: 'host', targets: [vx[0].cell] },
		't6-count': { area, count: b.devices.filter((n) => inArea(n.cell, area)).length, targets: 'area' },
	};
}

// ---- the answer: its first non-empty line; a cell is its first two whole numbers once every word (a name like vault-7) is taken out
export const firstLine = (text) => String(text ?? '').split('\n').map((s) => s.trim()).find(Boolean) ?? '';
export const cellIn = (line) => { const n = line.replace(/[A-Za-z][\w-]*/g, ' ').match(/-?\d+/g); return n && n.length >= 2 ? [Number(n[0]), Number(n[1])] : null; };
export const numberIn = (line) => { const n = line.replace(/[A-Za-z][\w-]*/g, ' ').match(/-?\d+/g); return n ? Number(n[0]) : null; };
export const names = (line, name) => new RegExp(`(^|[^A-Za-z0-9-])${name.replace(/[-]/g, '\\-')}($|[^A-Za-z0-9-])`).test(line);
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];

// ---- the state: what the session added, removed and changed, by kind and id (an entity's `order` aside)
export function diffDocs(before, after) {
	const out = { added: {}, removed: {}, changed: {} };
	const norm = (e) => { const { order, ...r } = e; return JSON.stringify(r); };
	for (const k of KINDS) {
		const a = new Map((before[k] || []).map((e) => [e.id, e])), b = new Map((after[k] || []).map((e) => [e.id, e]));
		out.added[k] = [...b.values()].filter((e) => !a.has(e.id));
		out.removed[k] = [...a.values()].filter((e) => !b.has(e.id));
		out.changed[k] = [...b.values()].filter((e) => a.has(e.id) && norm(a.get(e.id)) !== norm(e));
	}
	return out;
}
const none = (d, kinds, except = {}) => kinds.every((k) => d.added[k].length === (except[k] ?? 0)) && KINDS.every((k) => !d.removed[k].length && !d.changed[k].length);

// ---- the task scores, each 0 or 1
export function taskScores(scenario, { answer, before, after, answers }) {
	const ans = answers[scenario], line = firstLine(answer), d = diffDocs(before, after), pitch = boardOf(after).pitch;
	const cell = (n) => [n.x / pitch, n.y / pitch];
	switch (scenario) {
	case 't1-find': return { success: same(cellIn(line), ans.cell) ? 1 : 0 };
	case 't2-trace': return { success: names(line, ans.name) && same(cellIn(line), ans.cell) ? 1 : 0 };
	case 't6-count': return { success: numberIn(line) === ans.count ? 1 : 0 };
	case 't3-place': {
		const [n] = d.added.nodes;
		const ok = none(d, KINDS, { nodes: 1 }) && n.name === ans.name && n.type === ans.type && ans.free.some((c) => same(cell(n), c));
		return { success: ok ? 1 : 0 };
	}
	case 't4-wire': {
		const before_ = new Map((before.nodes || []).map((n) => [n.name, n.id]));
		const [l] = d.added.links;
		const ok = d.added.links.length === 1 && [l.src, l.dst].sort().join() === [before_.get(ans.a), before_.get(ans.b)].sort().join()
			&& d.added.nodes.every((n) => !n.type && (l.via || []).includes(n.id))
			&& none(d, KINDS.filter((k) => k !== 'nodes' && k !== 'links'), {});
		return { success: ok ? 1 : 0 };
	}
	case 't5-hunt': {
		const found = names(line, ans.name) && same(cellIn(line), ans.cell);
		const [n] = d.added.nodes;
		const placed = none(d, KINDS, { nodes: 1 }) && n.name === ans.host && n.type === ans.type && same(cell(n), ans.place);
		return { found: found ? 1 : 0, placed: placed ? 1 : 0, success: found && placed ? 1 : 0 };
	}
	default: throw new Error(`no scenario ${scenario}`);
	}
}

// ---- the measures, from the shim's log
const chebyshev = ([cx, cy], w) => Math.max(Math.max(w.x0 - cx, 0, cx - w.x1), Math.max(w.y0 - cy, 0, cy - w.y1));
const flag = (argv, name) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
export function targetCells(scenario, answers) {
	const t = answers[scenario].targets;
	if (t !== 'area') return t;
	const [x0, y0, x1, y1] = answers[scenario].area, out = [];
	for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
	return out;
}
/*
A map read is useful when it shows a target cell not yet shown, or comes nearer (Chebyshev distance in cells, from the window) to the
nearest target not yet shown than any read before it; a read before every target is shown that does neither is a wrong-chunk read.
For T6 the targets are the area's cells, so a read adding no new part of the area is wrong. A read whose `--chunk` an earlier map
printed as a sense command followed the senses; `followed-content` counts those whose sense named something there.
*/
export function measures(scenario, log, answers) {
	const targets = targetCells(scenario, answers);
	const key = (c) => `${c[0]},${c[1]}`;
	const unseen = new Map(targets.map((c) => [key(c), c]));
	let best = Infinity, wrong = 0, toTarget = 0, targetReads = 0, followed = 0, followedContent = 0;
	const printed = new Map();
	const maps = log.filter((e) => e.verb === 'map' && e.map && e.exit === 0);
	for (const e of maps) {
		const w = e.map.window;
		const shown = [...unseen.values()].filter((c) => chebyshev(c, w) === 0);
		if (targets.some((c) => chebyshev(c, w) === 0)) targetReads++;
		const asked = flag(e.argv, 'chunk');
		if (asked !== null && printed.has(asked)) { followed++; if (printed.get(asked)) followedContent++; }
		for (const s of e.map.senses) { const k = s.chunk.join(','); printed.set(k, (printed.get(k) ?? false) || s.n > 0); }
		if (!unseen.size) continue;
		toTarget++;
		const d = Math.min(...[...unseen.values()].map((c) => chebyshev(c, w)));
		if (shown.length) {
			for (const c of shown) unseen.delete(key(c));
			best = unseen.size ? Math.min(...[...unseen.values()].map((c) => chebyshev(c, w))) : 0;
		} else if (d < best) best = d;
		else wrong++;
	}
	const ok = (e) => e.exit === 0;
	return {
		'draw-calls': log.length,
		'map-calls': maps.length,
		'wrong-reads': wrong,
		'reads-to-target': toTarget,
		'target-reads': targetReads,
		'saw-targets': unseen.size ? 0 : 1,
		'senses-followed': followed,
		'followed-content': followedContent,
		'other-reads': log.filter((e) => ok(e) && POSITION_VERBS.has(e.verb)).length,
		refused: log.filter((e) => e.allowed === false).length,
	};
}
