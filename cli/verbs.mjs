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

/*
An id, from an id or a name. Names are what a person and an agent both actually use.

Deliberately checks entities in the order a caller is most likely to mean, and refuses ambiguity
rather than guessing: two things sharing a name is a diagram problem, and silently picking one
would turn it into a mystery about which one moved.
*/
async function resolveId(ctx, diagramId, ref) {
	if (/^(node|waypoint|link|zone|group)-[0-9a-f]{6}$/.test(ref)) return ref;
	const doc = ok(await request(ctx, `/diagrams/${diagramId}`), 'resolve');
	const hits = [];
	for (const k of ['nodes', 'zones', 'groups', 'links', 'waypoints']) {
		for (const e of doc[k] || []) if (e.name === ref) hits.push(e.id);
	}
	if (!hits.length) die(`nothing called ${ref} in this diagram`);
	if (hits.length > 1) die(`${ref} is ambiguous: ${hits.join(', ')} -- name it by id`);
	return hits[0];
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
		flags: [{ name: '--diagram', about: 'read the id of this diagram instead of the saved one' }],
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

/*
Context verbs -- the reason the tool exists rather than a wrapper round curl (CLI.md).

Each answers a question an agent asks BEFORE it acts, in one call, from facts the model already
owns. Deriving any of them locally would mean re-implementing a relationship the server can be
asked for, which is the twin problem this codebase keeps finding.
*/
VERBS.push(
	{
		name: 'about', group: 'Context', usage: 'draw about <entity-id>', route: '/diagrams/<id>/context/<entity>',
		summary: 'what surrounds an entity: links, neighbours, group, enclosing zones',
		example: 'draw about node-aa0001',
		args: [{ name: 'entity-id', about: 'any node, waypoint, link, zone or group id -- the kind is worked out for you' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			if (!args[0]) die('about needs an entity id or name');
			const id = await activeId(ctx, ctx.flags);
			/*
			A name is resolved to an id before asking.

			An agent thinks in names -- `lb-1`, not `node-a00001` -- and the first version passed the
			argument straight through, so `draw about lb-1` answered "unknown entity" about a node
			that was plainly there. The route takes an id because ids are what the model keys on; the
			TOOL is where that gap gets closed, which is the whole reason it exists.
			*/
			const b = ok(await request(ctx, `/diagrams/${id}/context/${await resolveId(ctx, id, args[0])}`), 'context');
			const rows = [];
			if (b.at) rows.push(['at', `${b.at.x},${b.at.y}`]);
			if (b.group) rows.push(['group', b.group]);
			if (b.zones?.length) rows.push(['zones', b.zones.join(' ')]);
			if (b.neighbours?.length) rows.push(['neighbours', b.neighbours.join(' ')]);
			if (b.links?.length) rows.push(['links', b.links.map((l) => l.id + (l.routed ? '*' : '')).join(' ')]);
			if (b.members?.length) rows.push(['members', b.members.join(' ')]);
			if (b.contents?.length) rows.push(['contents', b.contents.map((c) => c.id).join(' ')]);
			if (b.path) rows.push(['path', JSON.stringify(b.path)]);
			return { json: b, text: `${b.kind} ${b.id}${b.name ? `  ${b.name}` : ''}\n${table(rows, ['FIELD', 'VALUE'])}` };
		},
	},
	{
		name: 'near', group: 'Placement', usage: 'draw near <x> <y> [--within px]', route: '/diagrams/<id>/near',
		summary: 'what is already around a point, so you do not draw on top of it',
		example: 'draw near 120 60 --within 180',
		args: [{ name: 'x', about: 'canvas x' }, { name: 'y', about: 'canvas y' }],
		flags: [{ name: '--within', about: 'radius in px (default 120)' }, { name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [x, y] = args.map(Number);
			if (!Number.isFinite(x) || !Number.isFinite(y)) die('near needs numeric x and y');
			const id = await activeId(ctx, ctx.flags);
			const q = `x=${x}&y=${y}${ctx.flags.within ? `&within=${ctx.flags.within}` : ''}`;
			const b = ok(await request(ctx, `/diagrams/${id}/near?${q}`), 'near');
			const rows = b.occupants.map((o) => [o.kind, o.id, o.name ?? '', `${o.x},${o.y}`, o.distance]);
			return { json: b, text: `${table(rows, ['KIND', 'ID', 'NAME', 'AT', 'DIST'])}${b.zones.length ? `\nwithin zones: ${b.zones.map((z) => z.id).join(' ')}` : ''}` };
		},
	},
	{
		name: 'zone contents', sub: true, group: 'Context', usage: 'draw zone contents <zone-id>', route: '/diagrams/<id>/zones/<zone>/contents',
		summary: 'what falls inside a zone', example: 'draw zone contents zone-aa0001',
		args: [{ name: 'zone-id', about: 'the zone to look inside' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			if (!args[0]) die('zone contents needs a zone id');
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/zones/${args[0]}/contents`), 'zone contents');
			return { json: b, text: table(b.contents.map((c) => [c.kind, c.id, c.name ?? '', `${c.x},${c.y}`]), ['KIND', 'ID', 'NAME', 'AT']) };
		},
	},
	{
		name: 'link path', sub: true, group: 'Context', usage: 'draw link path <link-id>', route: '/diagrams/<id>/links/<link>/path',
		summary: 'the resolved route -- what the renderer would draw', example: 'draw link path link-aa00ff',
		args: [{ name: 'link-id', about: 'the link to resolve' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			if (!args[0]) die('link path needs a link id');
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/links/${args[0]}/path`), 'link path');
			if (!b.path) die(`link ${b.link} does not resolve -- a dangling endpoint or a missing bend`);
			return { json: b, text: `${b.src} -> ${b.dst}${b.via.length ? ` via ${b.via.join(' ')}` : ''}\n${b.path.map((p) => p.join(',')).join('  ')}` };
		},
	},
);

/*
`place` -- the verb the whole exercise was for.

Everything else in this file names an operation the API already has. This one names an INTENT: put
a server next to lb-1. The agent supplies meaning, the tool supplies geometry, and the two mistakes
it removes are the two an agent actually makes -- computing an off-grid coordinate, and landing on
something already there.

Composition, not a layout engine. It reads the reference's context, asks which anchors are free,
picks one, and commits an ordinary transaction; every step is a route that exists, and nothing here
decides anything the server would not have accepted from a caller that did the arithmetic itself.
`--link` is included because "next to" almost always means "and connected to", and making that a
second invocation invites the agent to forget it.
*/
const DIRS = {
	right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1],
	above: [0, -1], below: [0, 1],
};

VERBS.push({
	name: 'place', group: 'Placement', usage: 'draw place <type> near|inside|between <ref> [--link]',
	route: '/diagrams/<id>/commit',
	summary: 'put a node beside, inside or between things -- on a free anchor, no coordinates',
	example: 'draw place server near lb-1 --dir right --link',
	args: [{ name: 'type', about: 'node type: host, server, router, loadbalancer, vxlan, text' },
		{ name: 'where', about: 'near | inside | between -- how the position is described' },
		{ name: 'ref', about: 'a node for near/between, a zone for inside' },
		{ name: 'ref2', about: 'the second node, for between' }],
	flags: [{ name: '--dir', about: 'right | left | up | down (default: nearest free anchor)' },
		{ name: '--name', about: 'what to call it (default: the server-minted id)' },
		{ name: '--link', about: 'also link it to the reference' },
		{ name: '--diagram', about: 'target by id or name' }],
	async run(ctx, args) {
		const [type, near, ref] = args;
		if (!type || !['near', 'inside', 'between'].includes(near) || !ref) {
			die('usage: draw place <type> near <ref> | inside <zone> | between <a> <b>');
		}
		if (ctx.flags.dir && !DIRS[ctx.flags.dir]) die(`--dir must be one of ${Object.keys(DIRS).join(', ')}`);
		const id = await activeId(ctx, ctx.flags);

		const doc = ok(await request(ctx, `/diagrams/${id}`), 'place');
		const free = ok(await request(ctx, `/diagrams/${id}/layouts/node/anchors?free=1`), 'place');
		let options = free.anchors;
		if (!options.length) die('the canvas is full: every anchor is occupied');

		/*
		Three ways to say WHERE, all resolving to a free anchor.

		`inside` and `between` are the same idea as `near` and most of the same code: the agent
		names a relationship it can see in the diagram, and the tool turns that into a legal
		position. Only the candidate set differs.
		*/
		let anchorNode = null;
		// who a --link should attach to; internal, so NOT smuggled through ctx.flags -- the help
		// audit rightly reads anything there as a flag the user can pass, and it is not one
		let linkEnds = null;
		if (near === 'inside') {
			const zone = doc.zones.find((z) => z.id === ref || z.name === ref);
			if (!zone) die(`no zone called ${ref} -- \`draw get zones\` lists them`);
			options = options.filter((a) => a.x >= zone.x && a.x <= zone.x + zone.w && a.y >= zone.y && a.y <= zone.y + zone.h);
			if (!options.length) die(`zone ${ref} has no free anchor -- \`draw zone contents ${zone.id}\` shows what fills it`);
			anchorNode = { id: zone.id, name: zone.name, x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
		} else if (near === 'between') {
			const other = args[3];
			if (!other) die('usage: draw place <type> between <a> <b>');
			const a = doc.nodes.find((n) => n.id === ref || n.name === ref);
			const b2 = doc.nodes.find((n) => n.id === other || n.name === other);
			if (!a || !b2) die(`between needs two nodes that exist: ${!a ? ref : other} is not one`);
			anchorNode = { id: a.id, name: `${a.name || a.id} and ${b2.name || b2.id}`, x: (a.x + b2.x) / 2, y: (a.y + b2.y) / 2 };
			linkEnds = [a.id, b2.id];
		} else {
			anchorNode = doc.nodes.find((n) => n.id === ref || n.name === ref);
			if (!anchorNode) die(`no node called ${ref} -- \`draw get nodes\` lists them`);
		}

		let target;
		if (ctx.flags.dir && near === 'near') {
			const [dx, dy] = DIRS[ctx.flags.dir];
			// step outward in that direction until an anchor is free, so "right" means right
			for (let step = 1; step <= 16 && !target; step++) {
				const x = anchorNode.x + dx * 60 * step, y = anchorNode.y + dy * 60 * step;
				target = options.find((a) => a.x === x && a.y === y);
			}
			if (!target) die(`nothing free to the ${ctx.flags.dir} of ${ref} -- try another direction, or \`draw near\` to see why`);
		} else {
			target = options.reduce((best, a) => {
				const d = Math.hypot(a.x - anchorNode.x, a.y - anchorNode.y);
				return !best || d < best.d ? { ...a, d } : best;
			}, null);
		}

		const nid = `node-${Math.random().toString(16).slice(2, 8)}`;
		const ops = [{ op: 'put', kind: 'node',
			entity: { id: nid, name: ctx.flags.name || nid, type, x: target.x, y: target.y } }];
		// `between` links BOTH ends, because that is what standing between two things means
		const linkTo = ctx.flags.link ? (linkEnds || [anchorNode.id]) : [];
		for (const src of linkTo) {
			ops.push({ op: 'put', kind: 'link', entity: { id: `link-${Math.random().toString(16).slice(2, 8)}`, src, dst: nid } });
		}
		const b = ok(await request(ctx, `/diagrams/${id}/commit`,
			{ method: 'POST', headers: await held(ctx, id, 'place'),
				body: { ops, label: `place ${type} near ${anchorNode.name || anchorNode.id}` } }), 'place');
		return { json: { id: nid, at: { x: target.x, y: target.y }, cell: { cx: target.cx, cy: target.cy }, linked: !!ctx.flags.link, version: b.version },
			text: `${ctx.flags.name || nid} (${nid}) at ${target.x},${target.y}${ctx.flags.link ? ` linked to ${anchorNode.name || anchorNode.id}` : ''}  v${b.version}` };
	},
});

/*
Awareness and Access, shaped as questions rather than as routes.

`who` and `access` each fold several endpoints into the thing an agent actually needs to know
before it acts: is anyone else touching this, and who can reach it. The underlying lists stay
reachable through --json for anything that wants them raw.
*/
VERBS.push(
	{
		name: 'who', group: 'Awareness', usage: 'draw who', route: '/workspace/agents',
		summary: 'who else is here: agents driving, people watching',
		example: 'draw who',
		async run(ctx) {
			const agents = ok(await request(ctx, '/workspace/agents'), 'who').agents;
			const viewers = ok(await request(ctx, '/workspace/viewers'), 'who').viewers;
			const names = Object.fromEntries(ok(await request(ctx, '/diagrams'), 'who').map((d) => [d.id, d.name]));
			const rows = [
				...agents.map((a) => ['driving', a.principal || '(unnamed)', names[a.diagram] || a.diagram]),
				...viewers.map((v) => ['watching', v.principal || '(unnamed)', names[v.diagram] || v.diagram]),
			];
			return { json: { agents, viewers }, text: rows.length ? table(rows, ['DOING', 'WHO', 'WHERE']) : 'nobody else is here' };
		},
	},
	{
		name: 'viewers', group: 'Awareness', usage: 'draw viewers', route: '/workspace/viewers',
		summary: 'who is looking at what', example: 'draw viewers',
		async run(ctx) {
			const b = ok(await request(ctx, '/workspace/viewers'), 'viewers');
			return { json: b, text: table(b.viewers.map((v) => [v.principal || '(unnamed)', v.diagram]), ['WHO', 'DIAGRAM']) };
		},
	},
	{
		name: 'access', group: 'Access', usage: 'draw access', route: '/diagrams/<id>',
		summary: 'who can reach this diagram, and at what level',
		example: 'draw access --diagram a1-demo',
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			// owner and grants ride the document already, so this needs no second read (API.md)
			const d = ok(await request(ctx, `/diagrams/${id}`), 'access');
			const rows = [['owner', d.meta.owner || '(none)', 'owner']];
			for (const [who, level] of Object.entries(d.meta.grants || {})) rows.push(['grant', who, level]);
			return { json: { owner: d.meta.owner, grants: d.meta.grants || {} }, text: table(rows, ['VIA', 'PRINCIPAL', 'LEVEL']) };
		},
	},
	{
		name: 'grant', group: 'Access', usage: 'draw grant <principal> <read|write>', route: '/diagrams/<id>/grants',
		summary: 'let a principal reach this diagram', example: 'draw grant agent:planner write',
		args: [{ name: 'principal', about: 'user:<email> or agent:<name>' }, { name: 'level', about: 'read or write' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [principal, level] = args;
			if (!principal || !['read', 'write'].includes(level)) die('usage: draw grant <principal> <read|write>');
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/grants`, { method: 'POST', body: { principal, level } }), 'grant');
			return { json: b, text: `${principal} ${level}` };
		},
	},
	{
		name: 'revoke', group: 'Access', usage: 'draw revoke <principal>', route: '/diagrams/<id>/grants',
		summary: 'withdraw a grant; says what access remains', example: 'draw revoke agent:planner',
		args: [{ name: 'principal', about: 'the principal to cut' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			if (!args[0]) die('revoke needs a principal');
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/grants/${encodeURIComponent(args[0])}`, { method: 'DELETE' }), 'revoke');
			// the server reports what REMAINS, because a workspace grant may still apply (H9.4c)
			return { json: b, text: `${args[0]} now: ${b.effective || 'no access'}` };
		},
	},
	{
		name: 'workspace grant', sub: true, group: 'Access', usage: 'draw workspace grant <principal> <read|write>',
		route: '/workspace/grants', summary: 'grant across everything you own',
		example: 'draw workspace grant agent:planner write',
		args: [{ name: 'principal', about: 'user:<email> or agent:<name>' }, { name: 'level', about: 'read or write' }],
		async run(ctx, args) {
			const [principal, level] = args;
			if (!principal || !['read', 'write'].includes(level)) die('usage: draw workspace grant <principal> <read|write>');
			const b = ok(await request(ctx, '/workspace/grants', { method: 'POST', body: { principal, level } }), 'workspace grant');
			return { json: b, text: `${principal} ${level} across your workspace` };
		},
	},
	{
		name: 'code mint', sub: true, group: 'Access', usage: 'draw code mint <agent>', route: '/workspace/codes',
		summary: 'mint a connection code; shown once, never again',
		example: 'draw code mint agent:planner',
		args: [{ name: 'agent', about: 'agent:<name> -- lowercase, DNS-label shaped' }],
		async run(ctx, args) {
			if (!args[0]) die('code mint needs an agent name, like agent:planner');
			const b = ok(await request(ctx, '/workspace/codes', { method: 'POST', body: { agent: args[0] } }), 'code mint');
			// the plaintext exists here and nowhere else, which is what "shown once" means
			return { json: b, text: `${b.code}\n(shown once -- it is hashed on the server and cannot be recovered)` };
		},
	},
	{
		name: 'code list', sub: true, group: 'Access', usage: 'draw code list', route: '/workspace/codes',
		summary: 'the codes you have minted, never their secrets', example: 'draw code list',
		async run(ctx) {
			const b = ok(await request(ctx, '/workspace/codes'), 'code list');
			const list = b.codes || b;
			return { json: b, text: table(list.map((c) => [c.id, c.agent, c.created || '', c.expires || '']), ['ID', 'AGENT', 'CREATED', 'EXPIRES']) };
		},
	},
	{
		name: 'code revoke', sub: true, group: 'Access', usage: 'draw code revoke <id>', route: '/workspace/codes',
		summary: 'retire a code; the agent claim survives it', example: 'draw code revoke c-1a2b',
		args: [{ name: 'id', about: 'the code id from `draw code list`' }],
		async run(ctx, args) {
			if (!args[0]) die('code revoke needs a code id -- `draw code list` shows them');
			const b = ok(await request(ctx, `/workspace/codes/${encodeURIComponent(args[0])}`, { method: 'DELETE' }), 'code revoke');
			return { json: b, text: `revoked ${args[0]}` };
		},
	},
);

/*
`add` -- explicit placement, by ANCHOR rather than by pixel.

The director's distinction, and it is the one that matters: `--at 5,-2` is a cell index and cannot
be off the grid, where `--x 130` can and silently was for every node an agent drew before B110. The
tool refuses to accept a coordinate at all, so the class of mistake is unrepresentable rather than
merely validated.

`place` says where by relationship, `add` says where exactly. Same sentence shape on purpose --
`draw add server at 5,-2` beside `draw place server near lb-1` -- so the pair reads as one idea.
*/
VERBS.push({
	name: 'add', group: 'Placement', usage: 'draw add <type> at <cx>,<cy> [--name n] [--link ref]',
	route: '/diagrams/<id>/commit',
	summary: 'put a node on a named anchor -- a cell, never a pixel',
	example: 'draw add server at 5,-2 --name web-1',
	args: [{ name: 'type', about: 'node type: host, server, router, loadbalancer, vxlan, text' },
		{ name: 'at', about: "the literal word 'at'" },
		{ name: 'cx,cy', about: 'the CELL, not pixels -- `draw anchor nearest` converts if you have pixels' }],
	flags: [{ name: '--name', about: 'what to call it' },
		{ name: '--link', about: 'a node id or name to link it to' },
		{ name: '--diagram', about: 'target by id or name' }],
	async run(ctx, args) {
		const [type, at, cell] = args;
		if (!type || at !== 'at' || !cell) die('usage: draw add <type> at <cx>,<cy>');
		const [cx, cy] = String(cell).split(',').map(Number);
		if (!Number.isInteger(cx) || !Number.isInteger(cy)) {
			die(`at takes a CELL like 5,-2 -- whole numbers. Pixels would let you land off the grid, which the server refuses (B110)`);
		}
		const id = await activeId(ctx, ctx.flags);
		const anchors = ok(await request(ctx, `/diagrams/${id}/layouts/node/anchors`), 'add').anchors;
		const spot = anchors.find((a) => a.cx === cx && a.cy === cy);
		if (!spot) {
			// the likely mistake is pixels, and cells are small numbers -- say so rather than
			// leaving the caller to wonder why a coordinate they can see on screen is "outside"
			const looksLikePixels = Math.abs(cx) > 40 || Math.abs(cy) > 40;
			const range = `cx ${anchors[0].cx}..${anchors[anchors.length - 1].cx}`;
			die(`no anchor at cell ${cx},${cy} (${range})`
				+ (looksLikePixels ? ` -- those look like pixels; \`draw anchor nearest ${cx} ${cy}\` converts them` : ''));
		}
		if (spot.occupant) die(`cell ${cx},${cy} is taken by ${spot.occupant} -- \`draw about ${spot.occupant}\` says what it is`);

		const nid = `node-${Math.random().toString(16).slice(2, 8)}`;
		const ops = [{ op: 'put', kind: 'node', entity: { id: nid, name: ctx.flags.name || nid, type, x: spot.x, y: spot.y } }];
		if (ctx.flags.link && ctx.flags.link !== true) {
			const doc = ok(await request(ctx, `/diagrams/${id}`), 'add');
			const peer = doc.nodes.find((n) => n.id === ctx.flags.link || n.name === ctx.flags.link);
			if (!peer) die(`--link names ${ctx.flags.link}, which is not a node here`);
			ops.push({ op: 'put', kind: 'link', entity: { id: `link-${Math.random().toString(16).slice(2, 8)}`, src: peer.id, dst: nid } });
		}
		const b = ok(await request(ctx, `/diagrams/${id}/commit`,
			{ method: 'POST', headers: await held(ctx, id, 'add'), body: { ops, label: `add ${type}` } }), 'add');
		return { json: { id: nid, cell: { cx, cy }, at: { x: spot.x, y: spot.y }, version: b.version },
			text: `${ctx.flags.name || nid} (${nid}) at cell ${cx},${cy} = ${spot.x},${spot.y}  v${b.version}` };
	},
});
