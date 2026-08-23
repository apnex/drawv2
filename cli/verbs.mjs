/*
The verb manifest -- the single declaration of what `draw` can do (GR18, CLI.md).

Four consumers read this and nothing else: dispatch in `draw.mjs`, `draw help`, the GR18 coverage
scanner, and the README command table. That is the reason it exists as DATA rather than as a case
statement: the shell version kept the verb list, the help text and the route list in three places
and they drifted, silently, through an entire release that added a write surface (B117).

Every entry declares `route` -- the API path it reaches -- because the scanner compares those
against the routes `server/rest.js` actually answers, so a new endpoint fails the gate until a verb
can drive it. It is also printed in `draw help <verb>`, so an agent meeting a refusal the tool does
not explain can go to API.md rather than guess who said no.

`summary` and `example` are mandatory; a verb without them fails the gate rather than shipping as a
rough edge.
*/
import { request, table, die } from './draw.mjs';

const ctxFile = () => `${process.env.HOME}/.config/draw/context`;

async function activeId(ctx, flags) {
	const want = flags.diagram || ctx.flags?.diagram;
	const { body, ok } = await request(ctx, '/diagrams');
	if (!ok) die(`cannot list diagrams (HTTP ${body?.error || ''})`);
	const list = body;
	if (!list.length) die('no diagrams on this server');
	if (want) {
		const hit = list.find((d) => d.id === want || d.name === want);
		if (!hit) die(`no diagram named ${want}`);
		return hit.id;
	}
	const fs = await import('node:fs');
	try {
		const saved = fs.readFileSync(ctxFile(), 'utf8').trim();
		if (list.some((d) => d.id === saved)) return saved;
	} catch { /* no context yet */ }
	return list[0].id;
}

const ok = (res, what) => {
	if (!res.ok) die(`${what}: ${res.body?.error || `HTTP ${res.status}`}${res.body?.opIndex !== undefined ? ` (op ${res.body.opIndex})` : ''}`);
	return res.body;
};

export const VERBS = [
	{
		name: 'health', group: 'Context', usage: 'draw health', route: '/health',
		summary: "the server's own report", example: 'draw health',
		async run(ctx) {
			const b = ok(await request(ctx, '/health'), 'health');
			return { json: b, text: table([[b.status, b.diagrams, b.flushFailures, b.invariantFailures]],
				['STATUS', 'DIAGRAMS', 'FLUSH-FAIL', 'INVARIANT-FAIL']) };
		},
	},
	{
		name: 'diagrams', group: 'Context', usage: 'draw diagrams', route: '/diagrams',
		summary: 'what exists', example: 'draw diagrams',
		async run(ctx) {
			const b = ok(await request(ctx, '/diagrams'), 'diagrams');
			return { json: b, text: table(b.map((d) => [d.id, d.name, d.version]), ['ID', 'NAME', 'VERSION']) };
		},
	},
	{
		name: 'context', group: 'Context', usage: 'draw context [id|name]', route: '/diagrams',
		summary: 'the default target, persisted', example: 'draw context a1-demo',
		args: [{ name: 'id|name', about: 'the diagram to target by default; omit to read the current one' }],
		async run(ctx, args) {
			const fs = await import('node:fs'), path = await import('node:path');
			if (!args[0]) { const id = await activeId(ctx, ctx.flags); return { json: { context: id }, text: id }; }
			const id = await activeId(ctx, { diagram: args[0] });
			fs.mkdirSync(path.dirname(ctxFile()), { recursive: true });
			fs.writeFileSync(ctxFile(), id);
			return { json: { context: id }, text: id };
		},
	},
	{
		name: 'status', group: 'Context', usage: 'draw status', route: '/diagrams/<id>',
		summary: 'the active diagram in summary', example: 'draw status --diagram a1-demo',
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const d = ok(await request(ctx, `/diagrams/${id}`), 'status');
			const counts = ['nodes', 'waypoints', 'links', 'zones', 'groups'].map((k) => [k, (d[k] || []).length]);
			return { json: { id, name: d.meta.name, version: d.meta.version, owner: d.meta.owner, counts: Object.fromEntries(counts) },
				text: `${d.meta.name}  ${d.meta.id}  v${d.meta.version}\n${table(counts, ['KIND', 'COUNT'])}` };
		},
	},
	{
		name: 'get', group: 'Context', usage: 'draw get <kind> [id|name]', route: '/diagrams/<id>',
		summary: 'interrogate nodes, links, zones, groups, waypoints', example: 'draw get nodes',
		args: [{ name: 'kind', about: 'nodes | links | zones | groups | waypoints (singular accepted)' },
			{ name: 'id|name', about: 'one entity; omit for all of that kind' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const kinds = { node: 'nodes', link: 'links', zone: 'zones', group: 'groups', waypoint: 'waypoints' };
			const k = args[0] && (kinds[args[0]] || (Object.values(kinds).includes(args[0]) ? args[0] : null));
			if (!k) die(`unknown kind: ${args[0]} -- one of ${Object.values(kinds).join(', ')}`);
			const id = await activeId(ctx, ctx.flags);
			const doc = ok(await request(ctx, `/diagrams/${id}`), 'get');
			let list = doc[k] || [];
			if (args[1]) list = list.filter((e) => e.id === args[1] || e.name === args[1]);
			const cols = k === 'links' ? ['id', 'src', 'dst'] : k === 'groups' ? ['id', 'name', 'members']
				: k === 'zones' ? ['id', 'name', 'x', 'y', 'w', 'h'] : ['id', 'name', 'type', 'x', 'y'];
			return { json: list, text: table(list.map((e) => cols.map((c) => (Array.isArray(e[c]) ? e[c].join(',') : e[c]))), cols.map((c) => c.toUpperCase())) };
		},
	},
	{
		name: 'history', group: 'Context', usage: 'draw history [--limit n]', route: '/diagrams/<id>/history',
		summary: 'the change log', example: 'draw history --limit 10',
		flags: [{ name: '--limit', about: 'how many records (default 50)' }, { name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/history?limit=${ctx.flags.limit || 50}`), 'history');
			const recs = b.records || [];
			return { json: b, text: table(recs.map((r) => [r.seq, r.label, r.by, r.actor]), ['SEQ', 'LABEL', 'BY', 'ACTOR']) };
		},
	},
];

export const byName = (a, b) => VERBS.find((v) => (v.sub ? v.name === `${a} ${b}` : v.name === a));
