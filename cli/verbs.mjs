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

/*
A sub-verb wins over its bare noun, so `draw lock status` reads state and `draw lock` takes the
slot. Matching the bare name first would make the sub-verb unreachable, and the bug would look like
a broken flag rather than a broken lookup.
*/
export const byName = (a, b) => VERBS.find((v) => v.sub && v.name === `${a} ${b}`)
	|| VERBS.find((v) => !v.sub && v.name === a);

/*
The lock token has to outlive the process.

`draw lock`, `draw commit`, `draw unlock` are three invocations, and a write slot the agent cannot
carry between them is a write slot it cannot use. Kept beside the context file, one per diagram, so
holding two locks at once is representable rather than accidentally impossible.
*/
const tokenFile = (id) => `${process.env.HOME}/.config/draw/locks/${id}`;
async function readToken(id) {
	const fs = await import('node:fs');
	try { return fs.readFileSync(tokenFile(id), 'utf8').trim() || null; } catch { return null; }
}
async function writeToken(id, token) {
	const fs = await import('node:fs'), path = await import('node:path');
	fs.mkdirSync(path.dirname(tokenFile(id)), { recursive: true });
	if (token) fs.writeFileSync(tokenFile(id), token, { mode: 0o600 });
	else try { fs.unlinkSync(tokenFile(id)); } catch { /* already gone */ }
}
const held = async (ctx, id, what) => {
	const t = await readToken(id);
	if (!t) die(`${what} needs the write slot -- run \`draw lock\` first`);
	return { 'x-draw-lock': t };
};

VERBS.push(
	{
		name: 'create', group: 'Lifecycle', usage: 'draw create [name]', route: '/diagrams',
		summary: 'mint a diagram; answers its id', example: 'draw create topology',
		args: [{ name: 'name', about: 'what to call it; the server names it if omitted' }],
		flags: [{ name: '--doc', about: 'a JSON document to install instead of an empty one' }],
		async run(ctx, args) {
			let body = args[0] ? { name: args[0] } : {};
			if (ctx.flags.doc) {
				const fs = await import('node:fs');
				body = { ...body, doc: JSON.parse(fs.readFileSync(ctx.flags.doc, 'utf8')) };
			}
			const b = ok(await request(ctx, '/diagrams', { method: 'POST', body }), 'create');
            return { json: b, text: b.id };
		},
	},
	{
		name: 'delete', group: 'Lifecycle', usage: 'draw delete <id|name>', route: '/diagrams/<id>',
		summary: 'remove one; refuses unless you hold the lock', example: 'draw delete scratch',
		args: [{ name: 'id|name', about: 'the diagram to remove' }],
		async run(ctx, args) {
			if (!args[0]) die('delete needs a diagram -- naming it is deliberate, there is no default target for a destructive verb');
			const id = await activeId(ctx, { diagram: args[0] });
			const token = await readToken(id);
			const b = ok(await request(ctx, `/diagrams/${id}`, { method: 'DELETE', headers: token ? { 'x-draw-lock': token } : {} }), 'delete');
			await writeToken(id, null);
			return { json: b, text: `deleted ${b.deleted}` };
		},
	},
	{
		name: 'render', group: 'Lifecycle', usage: 'draw render [--out file.svg]', route: '/d/<id>.svg',
		summary: 'the picture, as SVG', example: 'draw render --out topology.svg',
		flags: [{ name: '--out', about: 'write to a file instead of stdout' }, { name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			// the one route that is not JSON, so it bypasses the shared parser
			const url = `${ctx.host}${ctx.code ? '/connect' : ''}/d/${id}.svg`;
			const res = await fetch(url, { headers: ctx.code ? { authorization: `Bearer ${ctx.code}` } : {} });
			if (!res.ok) die(`render: HTTP ${res.status}`);
			const svg = await res.text();
			if (!ctx.flags.out) return { json: { svg }, text: svg };
			(await import('node:fs')).writeFileSync(ctx.flags.out, svg);
			return { json: { out: ctx.flags.out, bytes: svg.length }, text: `${ctx.flags.out}  ${svg.length} bytes` };
		},
	},
	{
		name: 'lock', group: 'Writing', usage: 'draw lock', route: '/diagrams/<id>/lock',
		summary: 'take the write slot, and remember the token', example: 'draw lock --diagram a1-demo',
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/lock`, { method: 'POST', body: { owner: 'agent' } }), 'lock');
			await writeToken(id, b.token);
			return { json: { ...b, token: 'stored' }, text: `locked ${id}  v${b.version}  frees ${new Date(b.expiresAt).toISOString()}` };
		},
	},
	{
		name: 'unlock', group: 'Writing', usage: 'draw unlock', route: '/diagrams/<id>/lock',
		summary: 'release the write slot', example: 'draw unlock',
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/lock`, { method: 'DELETE', headers: await held(ctx, id, 'unlock') }), 'unlock');
			await writeToken(id, null);
			return { json: b, text: `released ${id}` };
		},
	},
	{
		name: 'lock status', sub: true, group: 'Writing', usage: 'draw lock status', route: '/diagrams/<id>/lock',
		summary: 'who holds it, when it frees, and the human hold', example: 'draw lock status',
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/lock`), 'lock status');
			return { json: b, text: table([[b.owner, b.expiresAt ? new Date(b.expiresAt).toISOString() : '-',
				b.heldUntil ? new Date(b.heldUntil).toISOString() : '-']], ['OWNER', 'FREES', 'HUMAN-HOLD']) };
		},
	},
	{
		name: 'commit', group: 'Writing', usage: 'draw commit --ops <file|->', route: '/diagrams/<id>/commit',
		summary: 'a batch of ops as one transaction', example: "draw commit --ops ops.json --label 'add spine'",
		flags: [{ name: '--ops', about: 'JSON file of ops, or - for stdin' }, { name: '--label', about: 'undo label' },
			{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			if (!ctx.flags.ops) die('commit needs --ops <file|-> ; an ops batch is JSON, and a flag grammar for it would be a second way to say what JSON already says');
			const fs = await import('node:fs');
			const raw = ctx.flags.ops === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(ctx.flags.ops, 'utf8');
			const parsed = JSON.parse(raw);
			const ops = Array.isArray(parsed) ? parsed : parsed.ops;
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'commit'), body: { ops, label: ctx.flags.label || parsed.label || '' } }), 'commit');
			return { json: b, text: `v${b.version}` };
		},
	},
	{
		name: 'undo', group: 'Writing', usage: 'draw undo [--to seq]', route: '/diagrams/<id>/undo',
		summary: 'reverse the last change, or a run', example: 'draw undo --expect 42',
		flags: [{ name: '--expect', about: 'the version you believe is current (required by the server)' },
			{ name: '--to', about: 'reverse a run back to this seq' }, { name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const body = { expect: Number(ctx.flags.expect) };
			if (ctx.flags.to) body.to = Number(ctx.flags.to);
			if (!Number.isFinite(body.expect)) die('undo needs --expect <version>; the server refuses an implicit target (D14)');
			const b = ok(await request(ctx, `/diagrams/${id}/undo`, { method: 'POST', headers: await held(ctx, id, 'undo'), body }), 'undo');
			return { json: b, text: `v${b.version}` };
		},
	},
	{
		name: 'redo', group: 'Writing', usage: 'draw redo', route: '/diagrams/<id>/redo',
		summary: 'reapply what undo reversed', example: 'draw redo --expect 43',
		flags: [{ name: '--expect', about: 'the version you believe is current' }, { name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const expect = Number(ctx.flags.expect);
			if (!Number.isFinite(expect)) die('redo needs --expect <version>');
			const b = ok(await request(ctx, `/diagrams/${id}/redo`, { method: 'POST', headers: await held(ctx, id, 'redo'), body: { expect } }), 'redo');
			return { json: b, text: `v${b.version}` };
		},
	},
	{
		name: 'select', group: 'Writing', usage: 'draw select <id...>', route: '/diagrams/<id>/selection',
		summary: 'set the authoritative selection', example: 'draw select node-aa0001 node-aa0002',
		args: [{ name: 'id...', about: 'entity ids; none clears the selection' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/selection`,
				{ method: 'PUT', headers: await held(ctx, id, 'select'), body: { ids: args } }), 'select');
			return { json: b, text: `${args.length} selected` };
		},
	},
);
