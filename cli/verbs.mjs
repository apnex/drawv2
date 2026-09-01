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
/*
B167 -- the renderable node types.

DECLARED here rather than imported, and that is forced. `cli/` is a standalone deliverable: both
installers put it somewhere the rest of the tree is not, and B138 exists because it is invoked
through a symlink from such a place. An `import` of `kernel/theme.mjs` resolves in this checkout
and fails in every install -- which is exactly how it failed, on the one test that shells out.

So this is a deliberate second copy of a set the kernel owns, and the drift it invites is closed by
a gate instead: `tests/cli-tool.test.js` asserts this list equals `Object.keys(GLYPH_BB)`. Same
reasoning as B86 -- one meaning, two enforcers, and a check holding them together, except here the
two cannot share a module at all.
*/
const NODE_TYPES = ['host', 'server', 'firewall', 'router', 'loadbalancer', 'vxlan'];

/*
Both stores take the env from the CALLER -- B135.

`main(argv, env, out)` accepts an environment so the tool can be driven as a library, and these two
read `process.env.HOME` instead, which meant every test wrote into the developer's real home: 812
token files had collected in a directory no test cleaned, because no test knew it was being used.
An injected dependency that two functions quietly bypass is worse than no injection, because the
harness advertises isolation it does not have.
*/
/*
STRICT: the home comes from the injected env, with no fallback.

`main(argv, env = process.env, out)` already defaults the env, so real use is unaffected and the
fallback bought nothing. What it cost was B135 all over again: a caller passing a partial env -- a
test passing `{}` -- silently resolved to the developer's real home and swept it. A fallback that
reaches around an injected dependency is the injection failing quietly, which is the whole defect.

No HOME means no store. Every reader below treats that as "nothing held", which is true.
*/
const homeOf = (ctx) => ctx?.env?.HOME || null;
export const ctxFile = (ctx) => `${homeOf(ctx)}/.config/draw/context`;

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
	// B136: we are holding the live set, so this is the free moment to drop tokens for diagrams
	// that are gone. 835 of 837 files on the first machine to be measured were in that state.
	await pruneTokens(ctx, new Set(list.map((d) => d.id)));
	const fs = await import('node:fs');
	try {
		const saved = fs.readFileSync(ctxFile(ctx), 'utf8').trim();
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
async function resolveId(ctx, diagramId, ref, known = null) {
	if (/^(node|waypoint|link|zone|group)-[0-9a-f]{6}$/.test(ref)) return ref;
	// `known` lets a verb that has already fetched the document reuse it. `place` used to avoid the
	// second read by reimplementing the lookup inline, four times, which is how the ambiguity
	// refusal below got dropped from three of them (B143).
	const doc = known || ok(await request(ctx, `/diagrams/${diagramId}`), 'resolve');
	const hits = [];
	for (const k of ['nodes', 'zones', 'groups', 'links', 'waypoints']) {
		for (const e of doc[k] || []) if (e.name === ref) hits.push(e.id);
	}
	// the hint belongs HERE, not in each caller. B143 routed four verbs through this function and
	// they each lost their own "`draw get nodes` lists them" line on the way; one message that
	// names the way to look is better than four that disagree about it.
	if (!hits.length) die(`nothing called ${ref} in this diagram -- \`draw show\` lists every entity, \`draw map\` shows where they are`);
	if (hits.length > 1) die(`${ref} is ambiguous: ${hits.join(', ')} -- name it by id`);
	return hits[0];
}

/*
Server refusals are re-said in the tool's own vocabulary before they reach a caller.

The server answers a lost write slot with *"not server-locked -- POST /api/v1/diagrams/:id/lock
first"*, which is correct for an HTTP client and exactly wrong here: it tells an agent driving
`draw` to go around `draw`. GR18 says an agent that cannot do a thing through the tool extends the
tool or raises it, and a tool whose own error message recommends `curl` has already lost that
argument. This was hit four times in one session before anyone read it as a defect rather than as
noise.

Translated, not suppressed: the status and the server's sentence still appear under `--json`, and
only the human-facing line is re-said. A refusal that names a verb the caller has is worth more
than a refusal that names a route they should not be calling.
*/
const RESAID = [
	[/not server-locked/i, (what) => `${what} needs the write slot -- run \`draw lock\` first (it frees after about a minute)`],
	[/server-locked|held by another/i, (what) => `${what} is blocked: another controller holds the write slot -- \`draw lock status\` says who and until when`],
];
/*
Naming, on the way OUT -- B144.

`resolveId` turns a name into an id on the way in; this is its mirror. A relation answered as
`node-97e437` makes the reader do the lookup the contextual verbs exist to remove, in the other
direction. Ids stay in `--json`, which is what composes.
*/
const naming = (doc) => {
	const m = new Map();
	for (const k of ['nodes', 'waypoints', 'zones', 'groups', 'links']) {
		for (const e of doc[k] || []) m.set(e.id, e.name || e.id);
	}
	return (ref) => m.get(ref) || ref;
};
// a link reads as its journey, since that is the only thing anyone wants from one
const linkLabel = (l, nm) => `${nm(l.src)}->${nm(l.dst)}${l.routed ? '*' : ''}`;

const ok = (res, what) => {
	if (res.ok) return res.body;
	const said = String(res.body?.error || '');
	for (const [pattern, say] of RESAID) if (pattern.test(said)) die(say(what));
	die(`${what}: ${said || `HTTP ${res.status}`}${res.body?.opIndex !== undefined ? ` (op ${res.body.opIndex})` : ''}`);
	return null;
};

/*
`route` is the verb's PRIMARY reach -- the one printed in help, because it is the request that does
the thing. `also` lists the others a composite verb makes on the way.

Contextual and placement verbs read before they write: `place` fetches the document, asks which
anchors are free, then commits. Declaring only the commit made the coverage gate believe those
reads were unreached, and declaring only the first read made it believe nothing was written. Both
are wrong in a way that matters, because the gate is what says whether the tool covers the API.

Held by a test: every `request()` a handler issues must appear in `route` or `also`.
*/
export const VERBS = [
	{
		name: 'health', group: 'Context', usage: 'draw health', route: '/health', method: 'GET',
		summary: "the server's own report", example: 'draw health',
		async run(ctx) {
			const b = ok(await request(ctx, '/health'), 'health');
			return { json: b, text: table([[b.status, b.diagrams, b.flushFailures, b.invariantFailures]],
				['STATUS', 'DIAGRAMS', 'FLUSH-FAIL', 'INVARIANT-FAIL']) };
		},
	},
	{
		name: 'diagrams', group: 'Context', usage: 'draw diagrams [--counts]', route: '/diagrams', method: 'GET',
		also: ['GET /diagrams/<id>'],
		summary: 'what exists', example: 'draw diagrams',
		flags: [{ name: '--counts', about: 'entity counts per diagram -- one call each, so slower' }],
		async run(ctx) {
			const b = ok(await request(ctx, '/diagrams'), 'diagrams');
			// B136: the rule is "whenever we learn the live set, prune", and this verb learns it
			// without going through activeId. Putting the call in one of the two places and calling
			// the rule general is how the store grew to 837 files in the first place.
			await pruneTokens(ctx, new Set(b.map((d) => d.id)));
			if (!ctx.flags.counts) {
				return { json: b, text: table(b.map((d) => [d.id, d.name, d.version]), ['ID', 'NAME', 'VERSION']) };
			}
			/*
			B139: comparing the composition of two diagrams took a shell `for` loop over `status`,
			because the list carried no counts and `status` answers about one target. Opt-in, since
			it costs a fetch per diagram and the plain list is what most calls want.
			*/
			const KINDS = ['nodes', 'waypoints', 'links', 'zones', 'groups'];
			const rows = [];
			for (const d of b) {
				const doc = ok(await request(ctx, `/diagrams/${d.id}`), 'diagrams');
				rows.push([d.id, d.name, d.version, ...KINDS.map((k) => (doc[k] || []).length)]);
				d.counts = Object.fromEntries(KINDS.map((k) => [k, (doc[k] || []).length]));
			}
			return { json: b, text: table(rows, ['ID', 'NAME', 'VER', 'NODES', 'WAYPT', 'LINKS', 'ZONES', 'GROUPS']) };
		},
	},
	{
		name: 'context', group: 'Context', usage: 'draw context [id|name]', route: '/diagrams', method: 'GET',
		summary: 'the default target, persisted', example: 'draw context a1-demo',
		args: [{ name: 'id|name', about: 'the diagram to target by default; omit to read the current one' }],
		flags: [{ name: '--diagram', about: 'read the id of this diagram instead of the saved one' }],
		async run(ctx, args) {
			const fs = await import('node:fs'), path = await import('node:path');
			if (!args[0]) { const id = await activeId(ctx, ctx.flags); return { json: { context: id }, text: id }; }
			const id = await activeId(ctx, { diagram: args[0] });
			fs.mkdirSync(path.dirname(ctxFile(ctx)), { recursive: true });
			fs.writeFileSync(ctxFile(ctx), id);
			return { json: { context: id }, text: id };
		},
	},
	{
		name: 'status', group: 'Context', usage: 'draw status', route: '/diagrams/<id>', method: 'GET',
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
		name: 'get', group: 'Context', usage: 'draw get <kind> [id|name]', route: '/diagrams/<id>', method: 'GET',
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
			/*
			References print as NAMES -- B139.

			A link listed as `link-41b65f  node-a0ba87  node-019130` makes a reader cross-reference
			two ids against the node table before it means anything, and cross-referencing by hand is
			the shell reach this verb should remove. The id is still what `--json` carries and what
			every other verb accepts, so nothing that composes is lost.
			*/
			const named = new Map();
			for (const kk of ['nodes', 'waypoints', 'zones', 'groups', 'links']) {
				for (const e of doc[kk] || []) named.set(e.id, e.name || e.id);
			}
			const show = (v) => (Array.isArray(v) ? v.map((x) => named.get(x) || x).join(',') : (named.get(v) || v));
			const cols = k === 'links' ? ['id', 'src', 'dst', 'via'] : k === 'groups' ? ['id', 'name', 'members']
				: k === 'zones' ? ['id', 'name', 'x', 'y', 'w', 'h'] : ['id', 'name', 'type', 'x', 'y'];
			const rows = list.map((e) => cols.map((c) => (e[c] === undefined ? '' : show(e[c]))));
			return { json: list, text: table(rows, cols.map((c) => c.toUpperCase())) };
		},
	},
	{
		name: 'history', group: 'Context', usage: 'draw history [--limit n]', route: '/diagrams/<id>/history', method: 'GET',
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
const tokenFile = (ctx, id) => `${homeOf(ctx)}/.config/draw/locks/${id}`;
/*
A stored token carries its own expiry -- B136.

The file used to hold the bare token and nothing removed it except an explicit `draw unlock`, which
is the one case that rarely happens: a lock LAPSES after about a minute, and a diagram gets DELETED.
Measured after four days of use: 837 files, 835 of them naming diagrams that no longer existed.

The cost was not disk. A token that outlives its lock is still presented on the next write, so the
server answers 423 and the tool relays *not server-locked* when the truth is *your lock lapsed* --
a state the tool could have known, because B102 put `expiresAt` on the lock response for exactly
this reason. Knowing it locally turns a confusing relay into `run draw lock`.

A file that does not parse is treated as lapsed and removed rather than tolerated. Every one of the
835 was in that shape, none of them could ever be valid again, and carrying a second format forever
to avoid one `draw lock` is the back-compat X1 rules out.
*/
async function readToken(ctx, id) {
	if (!homeOf(ctx)) return null;
	const fs = await import('node:fs');
	let raw;
	try { raw = fs.readFileSync(tokenFile(ctx, id), 'utf8').trim(); } catch { return null; }
	let held;
	try { held = JSON.parse(raw); } catch { held = null; }
	if (!held || typeof held.token !== 'string') { await writeToken(ctx, id, null); return null; }
	/*
	The token is handed over whatever the clock says -- B141.

	This used to discard a token whose `expiresAt` had passed, which was right in intent and wrong
	in authority. `expiresAt` is minted by the SERVER and was being compared to `Date.now()` here,
	so any skew between the two machines made the tool declare a live token dead, delete it, send
	nothing, and collect a 409 from the server that still held the lock -- reported as *another
	controller*, which is the reading least likely to be true and most likely to make an agent back
	off. Reproduced mid-authoring: renewal at 23:54:48, refusal two seconds later, slot provably
	free a minute after that.

	B140 exists so the holder can always renew. A client-side expiry guess takes that away again.
	The server is the only party that knows whether its lock is live, so the refusal comes from
	there; expiry survives for HOUSEKEEPING alone, in `sweepTokens`, on a margin that cannot race.
	*/
	return held.token;
}
async function writeToken(ctx, id, token, expiresAt = null) {
	if (!homeOf(ctx)) return;
	const fs = await import('node:fs'), path = await import('node:path');
	fs.mkdirSync(path.dirname(tokenFile(ctx, id)), { recursive: true });
	if (token) fs.writeFileSync(tokenFile(ctx, id), JSON.stringify({ token, expiresAt }), { mode: 0o600 });
	else try { fs.unlinkSync(tokenFile(ctx, id)); } catch { /* already gone */ }
}

/*
A lock file exists for the duration of its lock, and at most until the next `draw` command.

That is the strongest invariant a STATELESS tool can offer, and it is worth stating exactly because
the weaker version reads the same at a glance. Nothing here runs while the agent is idle, so a lock
that lapses at 12:00:30 cannot delete its own file at 12:00:30; what it can do is guarantee that no
`draw` invocation ever steps over a dead one.

`readToken` alone was not enough, and measuring is what showed it. It only ever looks at the token
for the diagram in hand, so a lock taken on A and left to lapse survives every future command about
B. The normal path is the lapse -- a whole session went by without `draw unlock` being called once
-- so the normal path was the one that left files behind.

Unparseable counts as dead. A file that is not `{token, expiresAt}` predates this rule and can never
be valid again.
*/
export async function sweepTokens(ctx) {
	const fs = await import('node:fs'), path = await import('node:path');
	if (!homeOf(ctx)) return 0;
	const dir = path.dirname(tokenFile(ctx, 'x'));
	let names;
	try { names = fs.readdirSync(dir); } catch { return 0; }
	let gone = 0;
	for (const name of names) {
		const file = path.join(dir, name);
		let held = null;
		try { held = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* dead by definition */ }
		/*
		A generous MARGIN, because this is housekeeping and not adjudication (B141).

		Sweeping on the exact deadline meant a clock a few seconds out could delete a token the
		server still honoured. The store only has to stop growing -- 837 files was the complaint --
		and an hour's grace achieves that while making it impossible for a sweep to race a lock
		whose whole life is a minute.
		*/
		const GRACE_MS = 60 * 60 * 1000;
		const deadline = typeof held?.expiresAt === 'number' ? held.expiresAt : Date.parse(held?.expiresAt);
		const alive = held && typeof held.token === 'string'
			&& Number.isFinite(deadline) && deadline + GRACE_MS > Date.now();
		if (alive) continue;
		try { fs.unlinkSync(file); gone++; } catch { /* not ours to remove */ }
	}
	return gone;
}

/*
Orphans go when we are already holding the answer.

`activeId` lists every diagram on almost every verb, so a token naming an id that is not in that
list can be deleted for free -- no extra request, no verb for the operator to remember, no growth.
This is the half `readToken` cannot do: a token for a DELETED diagram may be perfectly unexpired
and is still worthless.

Deliberately silent and best-effort. A caller ran `draw about`; a message about housekeeping would
be noise, and a permissions error on someone else's file must not fail their actual command.
*/
async function pruneTokens(ctx, live) {
	const fs = await import('node:fs'), path = await import('node:path');
	if (!homeOf(ctx)) return 0;
	const dir = path.dirname(tokenFile(ctx, 'x'));
	let names;
	try { names = fs.readdirSync(dir); } catch { return 0; }
	let gone = 0;
	for (const name of names) {
		if (live.has(name)) continue;
		try { fs.unlinkSync(path.join(dir, name)); gone++; } catch { /* not ours to remove */ }
	}
	return gone;
}
const held = async (ctx, id, what) => {
	const t = await readToken(ctx, id);
	if (!t) die(`${what} needs the write slot -- run \`draw lock\` first`);
	return { 'x-draw-lock': t };
};

VERBS.push(
	{
		name: 'create', group: 'Lifecycle', usage: 'draw create [name]', route: '/diagrams', method: 'POST',
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
		name: 'delete', group: 'Lifecycle', usage: 'draw delete <id|name>', route: '/diagrams/<id>', method: 'DELETE',
		summary: 'remove one; refuses unless you hold the lock', example: 'draw delete scratch',
		args: [{ name: 'id|name', about: 'the diagram to remove' }],
		async run(ctx, args) {
			if (!args[0]) die('delete needs a diagram -- naming it is deliberate, there is no default target for a destructive verb');
			const id = await activeId(ctx, { diagram: args[0] });
			const token = await readToken(ctx, id);
			const b = ok(await request(ctx, `/diagrams/${id}`, { method: 'DELETE', headers: token ? { 'x-draw-lock': token } : {} }), 'delete');
			await writeToken(ctx, id, null);
			return { json: b, text: `deleted ${b.deleted}` };
		},
	},
	{
		name: 'render', group: 'Lifecycle', usage: 'draw render [--out file.svg]', route: '/d/<id>.svg', method: 'GET',
		summary: 'the picture, as SVG', example: 'draw render --out topology.svg',
		flags: [{ name: '--out', about: 'write to a file instead of stdout' },
			{ name: '--summary', about: 'what the renderer emitted, by element -- verification without a browser' },
			{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			// the one route that is not JSON, so it bypasses the shared parser
			const url = `${ctx.host}${ctx.code ? '/connect' : ''}/d/${id}.svg`;
			const res = await fetch(url, { headers: ctx.code ? { authorization: `Bearer ${ctx.code}` } : {} });
			if (!res.ok) die(`render: HTTP ${res.status}`);
			const svg = await res.text();
			/*
			B139: `--summary` reports what the renderer EMITTED, by element.

			Confirming a render used to mean a headless browser and a regular expression over the
			SVG, which is two tools and a guess. The renderer's own output is the authority on what
			it drew, and the counts are what a caller actually checks: did every node, link and zone
			reach the picture. Deliberately counts EMITTED elements rather than re-reading the
			document -- comparing the drawing to the model is the whole point, and reading the model
			twice would compare it to itself.
			*/
			if (ctx.flags.summary) {
				const body = svg.split('</defs>').pop();
				const count = (re) => (body.match(re) || []).length;
				const emitted = {
					nodes: count(/<g id="node-[0-9a-f]{6}"/g),
					// waypoints are drawn, and were missing from the first version of this summary --
					// the map reported 27 occupied anchors and the summary 20 elements, which is the
					// kind of quiet disagreement a verification verb exists to prevent
					waypoints: count(/<g id="waypoint-[0-9a-f]{6}"/g),
					links: count(/<g id="link-[0-9a-f]{6}"/g),
					zones: count(/<g id="zone-[0-9a-f]{6}"/g),
					glyphs: count(/href="#glyph-/g),
					texts: count(/<text/g),
				};
				const box = (/viewBox="([^"]+)"/.exec(svg) || [])[1] || '?';
				const rows = Object.entries(emitted).map(([k, v]) => [k, v]);
				return { json: { ...emitted, viewBox: box, bytes: svg.length },
					text: `${table(rows, ['ELEMENT', 'EMITTED'])}\nviewBox ${box}   ${svg.length} bytes` };
			}
			if (!ctx.flags.out) return { json: { svg }, text: svg };
			(await import('node:fs')).writeFileSync(ctx.flags.out, svg);
			return { json: { out: ctx.flags.out, bytes: svg.length }, text: `${ctx.flags.out}  ${svg.length} bytes` };
		},
	},
	{
		name: 'lock', group: 'Writing', usage: 'draw lock', route: '/diagrams/<id>/lock', method: 'POST',
		summary: 'take the write slot, and remember the token', example: 'draw lock --diagram a1-demo',
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			// B140: send the token we already hold, so calling `draw lock` again RENEWS rather than
			// colliding with itself. That makes it safe before any batch, which is what an agent
			// authoring one entity at a time actually needs.
			const mine = await readToken(ctx, id);
			const b = ok(await request(ctx, `/diagrams/${id}/lock`,
				{ method: 'POST', headers: mine ? { 'x-draw-lock': mine } : {}, body: { owner: 'agent' } }), 'lock');
			// H9.9: a lock on a TEMPLATE forks and locks the fork, so the token belongs to the fork.
			// Storing it under the requested id left the caller holding a token for something that
			// was never locked, and the next write said "run draw lock" with a lock already held.
			await writeToken(ctx, b.diagram || id, b.token, b.expiresAt || b.heldUntil || null);
			return { json: { ...b, token: 'stored' }, text: `${b.renewed ? 'renewed' : 'locked'} ${b.diagram || id}  v${b.version ?? ''}  frees ${new Date(b.expiresAt).toISOString()}` };
		},
	},
	{
		name: 'unlock', group: 'Writing', usage: 'draw unlock', route: '/diagrams/<id>/lock', method: 'DELETE',
		summary: 'release the write slot', example: 'draw unlock',
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/lock`, { method: 'DELETE', headers: await held(ctx, id, 'unlock') }), 'unlock');
			await writeToken(ctx, id, null);
			return { json: b, text: `released ${id}` };
		},
	},
	{
		name: 'lock status', sub: true, group: 'Writing', usage: 'draw lock status', route: '/diagrams/<id>/lock', method: 'GET',
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
		name: 'commit', group: 'Writing', usage: 'draw commit --ops <file|->', route: '/diagrams/<id>/commit', method: 'POST',
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
		name: 'undo', group: 'Writing', usage: 'draw undo [--to seq]', route: '/diagrams/<id>/undo', method: 'POST',
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
		name: 'redo', group: 'Writing', usage: 'draw redo', route: '/diagrams/<id>/redo', method: 'POST',
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
		name: 'select', group: 'Writing', usage: 'draw select <id...>', route: '/diagrams/<id>/selection', method: 'PUT',
		summary: 'set the authoritative selection', example: 'draw select core-1 core-2',
		args: [{ name: 'ref...', about: 'entity ids or names; none clears the selection' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		also: ['GET /diagrams/<id>'],
		async run(ctx, args) {
			const id = await activeId(ctx, ctx.flags);
			/*
			Names, like every other structural verb. This took ids only, so `draw select core-1`
			answered *invalid selection id: core-1* while `draw link core-1 core-2` beside it
			resolved the same word without comment. One verb in a family behaving differently is
			read as a typo by the caller, not as a rule.
			*/
			const ids = [];
			for (const ref of args) ids.push(await resolveId(ctx, id, ref));
			const b = ok(await request(ctx, `/diagrams/${id}/selection`,
				{ method: 'PUT', headers: await held(ctx, id, 'select'), body: { ids } }), 'select');
			return { json: b, text: `${ids.length} selected` };
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
		name: 'about', group: 'Context', usage: 'draw about <entity-id>', route: '/diagrams/<id>/context/<entity>', method: 'GET', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'what surrounds an entity: links, neighbours, group, enclosing zones',
		example: 'draw about node-aa0001',
		args: [{ name: 'entity', about: 'any node, waypoint, link, zone or group, by id or name -- the kind is worked out for you' }],
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
			const doc = ok(await request(ctx, `/diagrams/${id}`), 'about');
			const b = ok(await request(ctx, `/diagrams/${id}/context/${await resolveId(ctx, id, args[0], doc)}`), 'context');
			/*
			Answered in NAMES -- B144.

			Every relation used to come back as an id, so the verb built to stop a reader
			cross-referencing made it cross-reference, one lookup per relation. B143 fixed the same
			thing on the way IN and left the mirror alone. Ids remain under `--json`, which is what
			composes.
			*/
			const nm = naming(doc);
			const rows = [];
			if (b.at) rows.push(['at', `${b.at.x},${b.at.y}`]);
			if (b.group) rows.push(['group', nm(b.group)]);
			if (b.zones?.length) rows.push(['zones', b.zones.map(nm).join(' ')]);
			if (b.neighbours?.length) rows.push(['neighbours', b.neighbours.map(nm).join(' ')]);
			if (b.links?.length) rows.push(['links', b.links.map((l) => linkLabel(l, nm)).join('  ')]);
			if (b.members?.length) rows.push(['members', b.members.map(nm).join(' ')]);
			// B169 -- whatever the entity itself carries, so a new optional field needs no change here
			for (const [k, v] of Object.entries(b.fields || {})) {
				rows.push([k, typeof v === 'object' && v !== null
					? Object.entries(v).map(([kk, vv]) => `${kk}=${vv}`).join(' ') : String(v)]);
			}
			if (b.contents?.length) rows.push(['contents', b.contents.map((c) => nm(c.id)).join(' ')]);
			if (b.path) rows.push(['path', b.path.map((p) => `${p.x},${p.y}`).join(' -> ')]);
			return { json: b, text: `${b.kind} ${b.id}${b.name ? `  ${b.name}` : ''}\n${table(rows, ['FIELD', 'VALUE'])}` };
		},
	},
	{
		name: 'near', group: 'Placement', usage: 'draw near <x> <y> [--within px]', route: '/diagrams/<id>/near', method: 'GET',
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
		name: 'zone contents', sub: true, group: 'Context', usage: 'draw zone contents <zone>', route: '/diagrams/<id>/zones/<zone>/contents', method: 'GET',
		summary: 'what falls inside a zone', example: 'draw zone contents site-a',
		args: [{ name: 'zone', about: 'the zone to look inside, by id or name' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			if (!args[0]) die('zone contents needs a zone, by id or name');
			const id = await activeId(ctx, ctx.flags);
			// B143: by NAME, like every other verb taking a reference. This took an id only, so
			// `draw zone contents site-a` failed beside `draw about a-lb` resolving the same word.
			const zid = await resolveId(ctx, id, args[0]);
			if (!zid.startsWith('zone-')) die(`${args[0]} is a ${zid.split('-')[0]}, not a zone -- \`draw about ${args[0]}\` describes it`);
			const b = ok(await request(ctx, `/diagrams/${id}/zones/${zid}/contents`), 'zone contents');
			return { json: b, text: table(b.contents.map((c) => [c.kind, c.id, c.name ?? '', `${c.x},${c.y}`]), ['KIND', 'ID', 'NAME', 'AT']) };
		},
	},
	{
		name: 'link path', sub: true, group: 'Context', usage: 'draw link path <link>', route: '/diagrams/<id>/links/<link>/path', method: 'GET',
		summary: 'the resolved route -- what the renderer would draw', example: 'draw link path link-aa00ff',
		args: [{ name: 'link', about: 'the link to resolve, by id or name' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			if (!args[0]) die('link path needs a link, by id or name');
			const id = await activeId(ctx, ctx.flags);
			// B143: resolved, not interpolated. A link rarely carries a name, but the refusal for a
			// non-link should say what the thing IS rather than 404 from the server.
			const lid = await resolveId(ctx, id, args[0]);
			if (!lid.startsWith('link-')) die(`${args[0]} is a ${lid.split('-')[0]}, not a link -- \`draw about ${args[0]}\` lists the links that touch it`);
			const b = ok(await request(ctx, `/diagrams/${id}/links/${lid}/path`), 'link path');
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
	route: '/diagrams/<id>/commit', method: 'POST', also: ['GET /diagrams', 'GET /diagrams/<id>', 'GET /diagrams/<id>/layouts/<layout>/anchors'],
	summary: 'put a node beside, inside or between things -- on a free anchor, no coordinates',
	example: 'draw place server near lb-1 --dir right --link',
	args: [{ name: 'type', about: `node type: ${NODE_TYPES.join(', ')}` },
		{ name: 'where', about: 'near | inside | between -- how the position is described' },
		{ name: 'ref', about: 'a node for near/between, a zone for inside' },
		{ name: 'ref2', about: 'the second node, for between' }],
	flags: [{ name: '--dir', about: 'right | left | up | down (default: nearest free anchor)' },
		{ name: '--name', about: 'what to call it (default: the server-minted id)' },
		{ name: '--link', about: 'also link it to the reference' },
		{ name: '--diagram', about: 'target by id or name' }],
	async run(ctx, args) {
		const [type, near, ref] = args;
		// B167 -- `place` takes a type for the same reason `add` does, and checked it just as little
		if (type && !NODE_TYPES.includes(type)) die(`${type} is not a node type. Renderable: ${NODE_TYPES.join(', ')}`);
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
		/*
		B143: one resolver, reusing the document already in hand.

		These four lookups were `find((n) => n.id === ref || n.name === ref)` written out inline,
		which is a fourth copy of `resolveId`'s rule -- and three of the copies had quietly lost its
		refusal of an ambiguous name, so two entities sharing one silently picked the first. Passing
		`doc` keeps the single read this verb already pays for.
		*/
		const refId = await resolveId(ctx, id, ref, doc);
		if (near === 'inside') {
			const zone = doc.zones.find((z) => z.id === refId);
			if (!zone) die(`${ref} is not a zone -- \`draw get zones\` lists them`);
			options = options.filter((a) => a.x >= zone.x && a.x <= zone.x + zone.w && a.y >= zone.y && a.y <= zone.y + zone.h);
			if (!options.length) die(`zone ${ref} has no free anchor -- \`draw zone contents ${zone.id}\` shows what fills it`);
			anchorNode = { id: zone.id, name: zone.name, x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
		} else if (near === 'between') {
			const other = args[3];
			if (!other) die('usage: draw place <type> between <a> <b>');
			const otherId = await resolveId(ctx, id, other, doc);
			const a = doc.nodes.find((n) => n.id === refId);
			const b2 = doc.nodes.find((n) => n.id === otherId);
			if (!a || !b2) die(`between needs two nodes that exist: ${!a ? ref : other} is not one`);
			anchorNode = { id: a.id, name: `${a.name || a.id} and ${b2.name || b2.id}`, x: (a.x + b2.x) / 2, y: (a.y + b2.y) / 2 };
			linkEnds = [a.id, b2.id];
		} else {
			anchorNode = doc.nodes.find((n) => n.id === refId);
			if (!anchorNode) die(`${ref} is not a node -- \`draw get nodes\` lists them`);
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
		name: 'who', group: 'Awareness', usage: 'draw who', route: '/workspace/agents', method: 'GET', also: ['GET /workspace/viewers', 'GET /diagrams'],
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
		name: 'viewers', group: 'Awareness', usage: 'draw viewers', route: '/workspace/viewers', method: 'GET',
		summary: 'who is looking at what', example: 'draw viewers',
		async run(ctx) {
			const b = ok(await request(ctx, '/workspace/viewers'), 'viewers');
			return { json: b, text: table(b.viewers.map((v) => [v.principal || '(unnamed)', v.diagram]), ['WHO', 'DIAGRAM']) };
		},
	},
	{
		name: 'access', group: 'Access', usage: 'draw access', route: '/diagrams/<id>', method: 'GET',
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
		name: 'grant', group: 'Access', usage: 'draw grant <principal> <read|write>', route: '/diagrams/<id>/grants', method: 'POST',
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
		name: 'revoke', group: 'Access', usage: 'draw revoke <principal>', route: '/diagrams/<id>/grants/<principal>', method: 'DELETE',
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
		route: '/workspace/grants', method: 'POST', summary: 'grant across everything you own',
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
		name: 'code mint', sub: true, group: 'Access', usage: 'draw code mint <agent>', route: '/workspace/codes', method: 'POST',
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
		name: 'code list', sub: true, group: 'Access', usage: 'draw code list', route: '/workspace/codes', method: 'GET',
		summary: 'the codes you have minted, never their secrets', example: 'draw code list',
		async run(ctx) {
			const b = ok(await request(ctx, '/workspace/codes'), 'code list');
			const list = b.codes || b;
			return { json: b, text: table(list.map((c) => [c.id, c.agent, c.created || '', c.expires || '']), ['ID', 'AGENT', 'CREATED', 'EXPIRES']) };
		},
	},
	{
		name: 'code revoke', sub: true, group: 'Access', usage: 'draw code revoke <id>', route: '/workspace/codes/<code>', method: 'DELETE',
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
/*
`spawn` -- arm an endpoint waypoint to emit movers along its link, or stop it.

H12.10. The editor gained this before the CLI did, which made the whole feature reachable only by
clicking: an agent could not arm an endpoint, and B169 meant it could not even see one that was
armed. GR18 says a gap like that is the deliverable, not a thing to work around, so it is a verb.

The direction is not an argument. It derives from WHICH end is named -- arm the src and movers run
src to dst, arm the dst and they run the other way. Storing it would be a twin of the link and
wrong the first time a route was reversed.
*/
VERBS.push({
	name: 'spawn', group: 'Writing', usage: 'draw spawn <waypoint> [--interval ms] [--speed cells] [--kind k] [--off]',
	route: '/diagrams/<id>/commit', method: 'POST', also: ['GET /diagrams/<id>'],
	summary: 'arm an endpoint waypoint to emit movers along its path, or stop it',
	example: 'draw spawn waypoint-aa0001 --interval 700 --speed 2',
	args: [{ name: 'waypoint', about: 'the ENDPOINT waypoint to arm, by id or name' }],
	flags: [{ name: '--interval', about: 'ms between departures; default 900' },
		{ name: '--speed', about: 'CELLS per second; default 1.4' },
		{ name: '--kind', about: 'what the movers are; default packet. The look is the stylesheet\'s' },
		{ name: '--off', about: 'disarm it' },
		{ name: '--diagram', about: 'target by id or name' }],
	async run(ctx, args) {
		if (!args[0]) die('usage: draw spawn <waypoint> [--off]');
		const id = await activeId(ctx, ctx.flags);
		const doc = ok(await request(ctx, `/diagrams/${id}`), 'spawn');
		const wid = await resolveId(ctx, id, args[0], doc);
		if (!wid.startsWith('waypoint-')) die(`${args[0]} is a ${wid.split('-')[0]}, not a waypoint -- only an endpoint emits`);
		const wp = (doc.waypoints || []).find((w) => w.id === wid);
		if (!wp) die(`${wid} is not in this diagram`);

		/*
		Only an ENDPOINT may be armed, and the refusal says which case this is. A bend turns a path
		and a ring has no ends -- both are legitimate waypoints that simply cannot emit, and a
		caller who picked one deserves to know which mistake they made rather than a flat no.
		*/
		const touching = (doc.links || []).filter((l) => l.src === wid || l.dst === wid || (l.via || []).includes(wid));
		const bend = touching.find((l) => (l.via || []).includes(wid));
		if (bend) die(`${wid} is a BEND on ${bend.id}, not an endpoint -- it turns the path rather than ending it`);
		const link = touching.find((l) => (l.src === wid || l.dst === wid) && !l.closed);
		if (!link) {
			const ring = touching.find((l) => l.closed);
			die(ring ? `${wid} is on the closed route ${ring.id} -- a ring has no ends, so nothing can emit from it`
				: `${wid} ends no link -- link it to something first, then arm it`);
		}

		if (ctx.flags.off) {
			if (!wp.spawn) die(`${wid} is not spawning`);
			const { spawn, ...without } = wp;
			const r = ok(await request(ctx, `/diagrams/${id}/commit`, { method: 'POST', headers: await held(ctx, id, 'spawn'),
				body: { ops: [{ op: 'put', kind: 'waypoint', entity: without }], label: 'stop spawning' } }), 'spawn');
			return { json: { id: wid, spawning: false, version: r.version }, text: `${wid} stopped  v${r.version}` };
		}
		const num = (f, d) => (ctx.flags[f] === undefined ? d : Number(ctx.flags[f]));
		const spawn = { interval: num('interval', 900), speed: num('speed', 1.4),
			kind: ctx.flags.kind || 'packet', since: Date.now() };
		for (const k of ['interval', 'speed']) {
			if (!Number.isFinite(spawn[k])) die(`--${k} takes a number, not ${ctx.flags[k]}`);
		}
		const r = ok(await request(ctx, `/diagrams/${id}/commit`, { method: 'POST', headers: await held(ctx, id, 'spawn'),
			body: { ops: [{ op: 'set', kind: 'waypoint', id: wid, patch: { spawn } }], label: 'spawn' } }), 'spawn');
		const dir = link.src === wid ? `${link.src} -> ${link.dst}` : `${link.dst} -> ${link.src}`;
		return { json: { id: wid, spawning: true, along: link.id, spawn, version: r.version },
			text: `${wid} spawning along ${link.id}  ${dir}  every ${spawn.interval}ms at ${spawn.speed} cells/s  v${r.version}` };
	},
});

VERBS.push({
	name: 'add', group: 'Placement', usage: 'draw add <type> at <cx>,<cy> [--name n] [--link ref]',
	route: '/diagrams/<id>/commit', method: 'POST', also: ['GET /diagrams', 'GET /diagrams/<id>', 'GET /diagrams/<id>/layouts/<layout>/anchors'],
	summary: 'put a node on a named anchor -- a cell, never a pixel',
	example: 'draw add server at 5,-2 --name web-1',
	args: [{ name: 'type', about: `node type: ${NODE_TYPES.join(', ')} -- or \`waypoint\`, a kind of its own` },
		{ name: 'at', about: "the literal word 'at'" },
		{ name: 'cx,cy', about: 'the CELL, not pixels -- `draw anchor nearest` converts if you have pixels' }],
	flags: [{ name: '--name', about: 'what to call it' },
		{ name: '--link', about: 'a node id or name to link it to' },
		{ name: '--shape', about: 'the outer frame: circle or square. Independent of type' },
		{ name: '--diagram', about: 'target by id or name' }],
	async run(ctx, args) {
		const [type, at, cell] = args;
		if (!type || at !== 'at' || !cell) die('usage: draw add <type> at <cx>,<cy>');
		/*
		B167 -- the type is a CLOSED set, and `waypoint` is a KIND rather than a type.

		Neither was checked. `draw add waypoint at 1,2` minted a NODE whose type was the string
		"waypoint", answered success, and left `draw get waypoint` reporting none: the caller was
		told they had made the thing they asked for, and the thing they got renders as `?` because
		no glyph answers to that name. Two failures at once, and the only way to notice was to go
		looking for what was absent.

		The server cannot catch it -- `type` validates as any lowercase string, and a node with an
		odd type is a legal node. So the refusal is local and names the set, exactly as `--shape`
		already does one screen below.
		*/
		const [cx, cy] = String(cell).split(',').map(Number);
		if (!Number.isInteger(cx) || !Number.isInteger(cy)) {
			die(`at takes a CELL like 5,-2 -- whole numbers. Pixels would let you land off the grid, which the server refuses (B110)`);
		}
		const id = await activeId(ctx, ctx.flags);
		const anchors = ok(await request(ctx, `/diagrams/${id}/layouts/node/anchors`), 'add').anchors;
		const spot = anchors.find((a) => a.cx === cx && a.cy === cy);
		// B133: the same sentence every cell-taking verb gives, from one place
		if (!spot) die(noAnchor(cx, cy, anchors, 'node'));
		if (spot.occupant) die(`cell ${cx},${cy} is taken by ${spot.occupant} -- \`draw about ${spot.occupant}\` says what it is`);

		if (type === 'waypoint') {
			const wid = mint('waypoint');
			const wops = [{ op: 'put', kind: 'waypoint', entity: { id: wid, x: spot.x, y: spot.y } }];
			const wb = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'add'), body: { ops: wops, label: 'add waypoint' } }), 'add');
			return { json: { id: wid, kind: 'waypoint', cell: { cx, cy }, at: { x: spot.x, y: spot.y }, version: wb.version },
				text: `${wid} at cell ${cx},${cy} = ${spot.x},${spot.y}  v${wb.version}` };
		}
		if (!NODE_TYPES.includes(type)) {
			die(`${type} is not a node type. Renderable: ${NODE_TYPES.join(', ')} -- or \`waypoint\`, which is a kind of its own`);
		}
		const nid = `node-${Math.random().toString(16).slice(2, 8)}`;
		const entity = { id: nid, name: ctx.flags.name || nid, type, x: spot.x, y: spot.y };
		/*
		`shape` is the outer frame and is INDEPENDENT of `type`, which is the glyph inside it. The
		server's vocabulary is two values and no more, so the refusal is local and names both --
		relaying a 422 for a closed set the tool already knows is a round trip that teaches nothing.
		*/
		if (ctx.flags.shape) {
			if (!['circle', 'square'].includes(ctx.flags.shape)) die(`--shape takes circle or square, not ${ctx.flags.shape}`);
			entity.shape = ctx.flags.shape;
		}
		const ops = [{ op: 'put', kind: 'node', entity }];
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

/*
`anchor` -- the bridge from a coordinate to a legal position.

Needed because a caller may HAVE pixels: read off a screen, carried from another tool, or printed
by an older document. `add` refuses them on purpose, so something has to convert, and that
something should be the tool rather than the caller's arithmetic -- which is the arithmetic that
produced every off-grid node before B110.

`free` is the placement counterpart: not "is this legal" but "what is available", which is what an
agent needs when it is choosing rather than checking.
*/
VERBS.push(
	{
		name: 'anchor nearest', sub: true, group: 'Placement', usage: 'draw anchor nearest <x> <y> [--layout node|zone]',
		route: '/diagrams/<id>/layouts/<name>/nearest', method: 'GET',
		summary: 'the legal anchor closest to a pixel coordinate',
		example: 'draw anchor nearest 130 60',
		args: [{ name: 'x', about: 'pixel x' }, { name: 'y', about: 'pixel y' }],
		flags: [{ name: '--layout', about: 'node (default) or zone -- zones sit on a half-offset grid' },
			{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [x, y] = args.map(Number);
			if (!Number.isFinite(x) || !Number.isFinite(y)) die('usage: draw anchor nearest <x> <y>');
			const layout = ctx.flags.layout || 'node';
			const id = await activeId(ctx, ctx.flags);
			const a = ok(await request(ctx, `/diagrams/${id}/layouts/${layout}/nearest?x=${x}&y=${y}`), 'anchor nearest');
			return { json: a, text: `cell ${a.cx},${a.cy} = ${a.x},${a.y}${a.occupant ? `  (taken by ${a.occupant})` : '  free'}` };
		},
	},
	{
		name: 'anchor free', sub: true, group: 'Placement', usage: 'draw anchor free [--layout node|zone]',
		route: '/diagrams/<id>/layouts/<name>/anchors', method: 'GET',
		summary: 'every anchor nothing occupies', example: 'draw anchor free --json',
		flags: [{ name: '--layout', about: 'node (default) or zone' }, { name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const layout = ctx.flags.layout || 'node';
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/layouts/${layout}/anchors?free=1`), 'anchor free');
			// a list of 500 cells is not a table anyone reads; the count and the corners are
			return { json: b, text: `${b.count} free on the ${b.layout} grid` };
		},
	},
);

/*
`show` -- the one verb worth carrying over from the shell tool it replaces.

Everything it prints is available from `status` and `get`, so it earns its place by being ONE call
when an agent is orienting rather than four. That is the same argument as the contextual verbs:
fewer round trips, fewer chances to assemble a picture wrongly.
*/
VERBS.push({
	name: 'show', group: 'Context', usage: 'draw show', route: '/diagrams/<id>', method: 'GET',
	summary: 'the whole diagram: summary and every entity', example: 'draw show --diagram a1-demo',
	flags: [{ name: '--diagram', about: 'target by id or name' }],
	async run(ctx) {
		const id = await activeId(ctx, ctx.flags);
		const d = ok(await request(ctx, `/diagrams/${id}`), 'show');
		const out = [`${d.meta.name}  ${d.meta.id}  v${d.meta.version}`];
		const cols = {
			nodes: ['id', 'name', 'type', 'x', 'y'], waypoints: ['id', 'x', 'y'],
			links: ['id', 'src', 'dst', 'via'], zones: ['id', 'name', 'x', 'y', 'w', 'h'],
			groups: ['id', 'name', 'members'],
		};
		for (const [k, c] of Object.entries(cols)) {
			const list = d[k] || [];
			if (!list.length) continue;
			out.push('', k.toUpperCase(), table(list.map((e) => c.map((f) => (Array.isArray(e[f]) ? e[f].join(',') : e[f] ?? ''))), c.map((f) => f.toUpperCase())));
		}
		return { json: d, text: out.join('\n') };
	},
});

/*
Three verbs CLI.md specified and I had not built, found by the coverage check once it compared
route AND method rather than route family (B119). The family-level check counted `layouts` covered
because `anchor nearest` reaches a path under it, and counted `workspace` covered because
`workspace grant` writes to it -- so a missing list and a missing revoke were both invisible.
*/
VERBS.push(
	{
		name: 'layouts', group: 'Placement', usage: 'draw layouts', route: '/diagrams/<id>/layouts', method: 'GET',
		summary: 'the named grids and their offsets', example: 'draw layouts',
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx) {
			const id = await activeId(ctx, ctx.flags);
			const b = ok(await request(ctx, `/diagrams/${id}/layouts`), 'layouts');
			return { json: b, text: table(b.layouts.map((l) => [l]), ['LAYOUT']) };
		},
	},
	{
		name: 'workspace grants', sub: true, group: 'Access', usage: 'draw workspace grants',
		route: '/workspace/grants', method: 'GET',
		summary: 'who may reach everything you own', example: 'draw workspace grants',
		async run(ctx) {
			const b = ok(await request(ctx, '/workspace/grants'), 'workspace grants');
			const rows = Object.entries(b.grants || {}).map(([who, level]) => [who, level]);
			return { json: b, text: rows.length ? table(rows, ['PRINCIPAL', 'LEVEL']) : 'no workspace grants' };
		},
	},
	{
		name: 'workspace revoke', sub: true, group: 'Access', usage: 'draw workspace revoke <principal>',
		route: '/workspace/grants/<principal>', method: 'DELETE',
		summary: 'withdraw a workspace grant', example: 'draw workspace revoke agent:planner',
		args: [{ name: 'principal', about: 'the principal to cut from your whole workspace' }],
		async run(ctx, args) {
			if (!args[0]) die('workspace revoke needs a principal -- `draw workspace grants` lists them');
			const b = ok(await request(ctx, `/workspace/grants/${encodeURIComponent(args[0])}`, { method: 'DELETE' }), 'workspace revoke');
			// a per-diagram grant may still apply, so the server says what is left rather than just "done"
            return { json: b, text: `${args[0]} now: ${b.effective || 'no workspace access'}` };
		},
	},
);

/*
Structural verbs -- B133 / H11.12.

Everything below existed only as hand-authored JSON through `commit --ops` until this landed, and
the cost was not the typing. It was that an agent building a zone had to know the zone grid sits
half a pitch off the node grid, an agent routing a link had to mint waypoint ids in a grammar
written down in `server/validate.js`, and an agent doing either had to re-derive cell-to-pixel. A
20-node topology built this way re-implemented six rules the codebase already owns, in a throwaway
script, and got two of them wrong on the first attempt.

That is B117 wearing a better disguise: not reaching past the tool to `curl`, but reaching past the
tool's vocabulary to a generic transport inside it, with the identical consequence -- the tool stays
as incapable as it was and the gap stops being visible.

These are CONTEXTUAL, not one wrapper per route. `draw link a b --via 3,-2` mints the waypoints,
because a waypoint is an implementation detail of a bend and an agent that has to mint one is an
agent doing the tool's job. `draw zone` takes the two CELLS it should enclose and owns the offset
arithmetic. The test is whether the verb makes a caller less wrong, not whether it mirrors an
endpoint -- `commit --ops` stays for genuine batches and for the regions a verb would only obscure.
*/

const CELL = /^-?\d+,-?\d+$/;
const cell = (s, what) => {
	if (!CELL.test(String(s))) {
		die(`${what} takes a CELL like 3,-2 -- whole numbers, comma separated. `
			+ 'Pixels would let you land off the grid, which the server refuses (B110); '
			+ '`draw anchor nearest <x> <y>` converts them.');
	}
	const [cx, cy] = String(s).split(',').map(Number);
	return { cx, cy };
};
// the id grammar lives in server/validate.js; minting it by hand in a caller's script is B133
const mint = (kind) => `${kind}-${Math.random().toString(16).slice(2, 8).padStart(6, '0')}`;

// cell -> pixel for BOTH grids, asked of the server rather than recomputed here. `add` already
// reads the node anchors for exactly this reason; doing the arithmetic in the CLI would put a
// second copy of `kernel/geometry.mjs` in a second language, which is the twin B111 closed.
async function anchorsOf(ctx, id, layout) {
	return ok(await request(ctx, `/diagrams/${id}/layouts/${layout}/anchors`), 'anchors').anchors;
}
/*
The one refusal for "that cell does not exist", shared by every verb that takes one.

`add` grew this first and kept it inline: the likely mistake is PIXELS, cells are small numbers, and
a caller who typed a coordinate they can see on screen deserves to be told the unit is wrong rather
than that their position is "outside". Extracted at B133 because four more verbs now need the same
sentence, and four copies of a diagnostic is how the diagnostic stops being true in three of them.
*/
function noAnchor(cx, cy, anchors, layout) {
	const looksLikePixels = Math.abs(cx) > 40 || Math.abs(cy) > 40;
	const range = anchors.length ? `cx ${anchors[0].cx}..${anchors[anchors.length - 1].cx}` : 'none';
	return `no ${layout} anchor at cell ${cx},${cy} (${range})`
		+ (looksLikePixels
			? ` -- those look like pixels, and this takes a CELL; \`draw anchor nearest ${cx} ${cy}\` converts them`
			: ` -- \`draw anchor free --layout ${layout}\` lists what is open`);
}
async function cellToPx(ctx, id, layout, { cx, cy }, what) {
	const anchors = await anchorsOf(ctx, id, layout);
	const spot = anchors.find((a) => a.cx === cx && a.cy === cy);
	if (!spot) die(noAnchor(cx, cy, anchors, layout));
	return spot;
}

VERBS.push(
	{
		name: 'link', group: 'Writing', usage: 'draw link <src> [<dst>] [--via <cx>,<cy>...] [--closed]',
		route: '/diagrams/<id>/commit', method: 'POST',
		also: ['GET /diagrams', 'GET /diagrams/<id>', 'GET /diagrams/<id>/layouts/<layout>/anchors'],
		summary: 'join two things that already exist, bending the route through cells you name',
		example: 'draw link a-edge core-1 --via -8,-7',
		args: [{ name: 'src', about: 'a node id or name' },
			{ name: 'dst', about: 'a node id or name. Omit it with --closed to loop back to src' }],
		flags: [{ name: '--via', about: 'a cell to bend through; repeat for more. Waypoints are minted for you' },
			{ name: '--closed', about: 'a ring: the route returns to src. Give --via bends and no dst' },
			{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [src, dst] = args;
			if (!src) die('usage: draw link <src> <dst> [--via <cx>,<cy>...]');
			/*
			A ring is a source and the bends that return to it -- B133.

			`closed` is a render-only property meaning "loop dst back to src", so expressing one
			needs a dst that is not the source, and in a ring that dst is a WAYPOINT the caller has
			not created yet. Requiring them to name it would put waypoint minting back on the
			caller, which is the whole defect this verb exists to close. So with `--closed` and no
			dst, the LAST bend becomes the destination and the rest are the route: `draw link
			overlay --closed --via -2,-1 --via 0,1 --via 2,-1` is a triangle hanging off `overlay`.
			*/
			const ring = !dst && ctx.flags.closed;
			if (!dst && !ring) die('usage: draw link <src> <dst> [--via <cx>,<cy>...], or --closed with bends and no dst');
			const id = await activeId(ctx, ctx.flags);
			const a = await resolveId(ctx, id, src);

			const raw = ctx.flags.via === undefined ? [] : [].concat(ctx.flags.via);
			if (ring && raw.length < 2) die('a ring needs at least two --via bends; with one it would draw a line back over itself');
			const ops = [];
			const via = [];
			for (const v of raw) {
				const spot = await cellToPx(ctx, id, 'node', cell(v, '--via'), 'link');
				// a waypoint IS a node for placement (B110/B112), so an occupied anchor refuses here
				// rather than at the server, where the message would name a cell the caller never typed
				if (spot.occupant) die(`--via ${v} is taken by ${spot.occupant} -- a waypoint needs a free anchor`);
				const w = mint('waypoint');
				ops.push({ op: 'put', kind: 'waypoint', entity: { id: w, x: spot.x, y: spot.y } });
				via.push(w);
			}
			// the ring's destination is its last bend; a plain link's is the node the caller named
			const b = ring ? via.pop() : await resolveId(ctx, id, dst);
			if (a === b) die('a link needs two different endpoints');
			const lid = mint('link');
			const entity = { id: lid, src: a, dst: b };
			if (via.length) entity.via = via;
			if (ctx.flags.closed) entity.closed = true;
			ops.push({ op: 'put', kind: 'link', entity });
			const r = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'link'), body: { ops, label: 'link' } }), 'link');
			return { json: { id: lid, src: a, dst: b, via, closed: !!ctx.flags.closed, version: r.version },
				text: `${lid}  ${a} -> ${b}${via.length ? ` via ${via.join(' ')}` : ''}${ctx.flags.closed ? ' (closed)' : ''}  v${r.version}` };
		},
	},
	{
		name: 'panel', group: 'Writing', usage: 'draw panel <name> at <cx>,<cy> --cols n --rows n [--content f.json]',
		route: '/diagrams/<id>/commit', method: 'POST',
		also: ['GET /diagrams', 'GET /diagrams/<id>/layouts/<layout>/anchors'],
		summary: 'a node that spans cells and can carry content regions',
		example: 'draw panel key at -15,-8 --cols 7 --rows 2 --content legend.json',
		args: [{ name: 'name', about: 'what to call it' },
			{ name: 'at', about: "the literal word 'at'" },
			{ name: 'cx,cy', about: 'the CELL of its top-left corner' }],
		flags: [{ name: '--cols', about: 'width in cells' }, { name: '--rows', about: 'height in cells' },
			{ name: '--content', about: 'a JSON file of content regions -- see API.md' },
			{ name: '--type', about: 'the glyph type behind the content; default host' },
			{ name: '--diagram', about: 'target by id or name' }],
		/*
		The split here is deliberate and is the answer to "why is there no --text flag".

		A panel's FRAME is geometry -- an anchor and a span in cells -- so the verb owns it, for the
		same reason `add` owns a cell: it is the part a caller can get wrong in a way the tool can
		prevent. Its CONTENT is a list of regions with a dozen optional fields each, and flattening
		that into flags would produce a command nobody can read and a parser nobody can trust.
		CLI.md's rule is that a verb earns its place by making a caller less wrong; a --text flag
		would not, and a file does, because it is reviewable and re-runnable.
		*/
		async run(ctx, args) {
			const [name, at, c] = args;
			if (!name || at !== 'at' || !c) die('usage: draw panel <name> at <cx>,<cy> --cols n --rows n');
			const cols = Number(ctx.flags.cols), rows = Number(ctx.flags.rows);
			if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
				die('--cols and --rows are whole numbers of CELLS, at least 1 each');
			}
			const id = await activeId(ctx, ctx.flags);
			const spot = await cellToPx(ctx, id, 'node', cell(c, 'at'), 'panel');
			if (spot.occupant) die(`cell ${c} is taken by ${spot.occupant} -- \`draw anchor free\` lists what is open`);
			const entity = { id: mint('node'), name, type: ctx.flags.type || 'host',
				x: spot.x, y: spot.y, span: { cols, rows } };
			if (ctx.flags.content && ctx.flags.content !== true) {
				const fs = await import('node:fs');
				let regions;
				try { regions = JSON.parse(fs.readFileSync(ctx.flags.content, 'utf8')); }
				catch (e) { die(`--content ${ctx.flags.content}: ${e.message}`); }
				// accept either a bare array or { content: [...] }, because both are what a caller writes
				regions = Array.isArray(regions) ? regions : regions.content;
                if (!Array.isArray(regions)) die('--content must be a JSON array of regions, or an object with a `content` array');
				entity.content = regions;
			}
			const r = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'panel'),
					body: { ops: [{ op: 'put', kind: 'node', entity }], label: 'panel' } }), 'panel');
			return { json: { id: entity.id, name, span: entity.span, regions: entity.content?.length || 0, version: r.version },
				text: `${name} (${entity.id}) ${cols}x${rows} at cell ${c}`
					+ `${entity.content ? `, ${entity.content.length} region(s)` : ''}  v${r.version}` };
		},
	},
	{
		name: 'zone', group: 'Writing', usage: 'draw zone <name> from <cx>,<cy> to <cx>,<cy>',
		route: '/diagrams/<id>/commit', method: 'POST',
		also: ['GET /diagrams', 'GET /diagrams/<id>/layouts/<layout>/anchors'],
		summary: 'enclose a rectangle of CELLS -- the half-pitch offset is the tool\'s problem, not yours',
		example: 'draw zone site-a from -15,-6 to -9,4',
		args: [{ name: 'name', about: 'what to call the zone' },
			{ name: 'from', about: "the literal word 'from'" },
			{ name: 'cx,cy', about: 'the first corner CELL, inclusive' },
			{ name: 'to', about: "the literal word 'to'" },
			{ name: 'cx,cy', about: 'the opposite corner CELL, inclusive' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [name, from, c0, to, c1] = args;
			if (!name || from !== 'from' || to !== 'to' || !c0 || !c1) {
				die('usage: draw zone <name> from <cx>,<cy> to <cx>,<cy>');
			}
			const A = cell(c0, 'from'), B = cell(c1, 'to');
			const id = await activeId(ctx, ctx.flags);
			// resolve both corners on the NODE grid, then let the server's zone grid own the offset:
			// a zone bounds cells, so its edges fall BETWEEN them, and that half pitch is exactly the
			// arithmetic every caller was getting wrong by hand
			const lo = await cellToPx(ctx, id, 'node', { cx: Math.min(A.cx, B.cx), cy: Math.min(A.cy, B.cy) }, 'zone');
			const hi = await cellToPx(ctx, id, 'node', { cx: Math.max(A.cx, B.cx), cy: Math.max(A.cy, B.cy) }, 'zone');
			const zid = mint('zone');
			const entity = { id: zid, name, x: lo.x - 30, y: lo.y - 30, w: hi.x - lo.x + 60, h: hi.y - lo.y + 60 };
			const r = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'zone'), body: { ops: [{ op: 'put', kind: 'zone', entity }], label: 'zone' } }), 'zone');
			return { json: { id: zid, ...entity, version: r.version },
				text: `${name} (${zid}) ${entity.w}x${entity.h} at ${entity.x},${entity.y}  v${r.version}` };
		},
	},
	{
		name: 'group', group: 'Writing', usage: 'draw group <name> <ref> <ref> [ref...]',
		route: '/diagrams/<id>/commit', method: 'POST', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'name a set of nodes as one thing',
		example: 'draw group web-tier-a a-web-1 a-web-2 a-web-3',
		args: [{ name: 'name', about: 'what to call the group' },
			{ name: 'ref...', about: 'two or more node ids or names' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [name, ...refs] = args;
			// the server enforces this too (B85); saying it here costs a round trip nobody needs
			if (!name || refs.length < 2) die('a group holds at least two members: draw group <name> <ref> <ref> [...]');
			const id = await activeId(ctx, ctx.flags);
			const members = [];
			for (const r of refs) members.push(await resolveId(ctx, id, r));
			const gid = mint('group');
			const r = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'group'),
					body: { ops: [{ op: 'put', kind: 'group', entity: { id: gid, name, members } }], label: 'group' } }), 'group');
			return { json: { id: gid, name, members, version: r.version },
				text: `${name} (${gid}) holds ${members.length}: ${members.join(' ')}  v${r.version}` };
		},
	},
	{
		name: 'move', group: 'Writing', usage: 'draw move <ref> to <cx>,<cy>',
		route: '/diagrams/<id>/commit', method: 'POST',
		also: ['GET /diagrams', 'GET /diagrams/<id>', 'GET /diagrams/<id>/layouts/<layout>/anchors'],
		summary: 'put an existing node or waypoint on a different anchor',
		example: 'draw move a-web-1 to -14,1',
		args: [{ name: 'ref', about: 'a node or waypoint, by id or name' },
			{ name: 'to', about: "the literal word 'to'" },
			{ name: 'cx,cy', about: 'the destination CELL' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [ref, to, c] = args;
			if (!ref || to !== 'to' || !c) die('usage: draw move <ref> to <cx>,<cy>');
			const id = await activeId(ctx, ctx.flags);
			const eid = await resolveId(ctx, id, ref);
			const kind = eid.split('-')[0];
			if (kind !== 'node' && kind !== 'waypoint') die(`${ref} is a ${kind}; only a node or a waypoint sits on an anchor`);
			const spot = await cellToPx(ctx, id, 'node', cell(c, 'to'), 'move');
			if (spot.occupant && spot.occupant !== eid) {
				die(`cell ${c} is taken by ${spot.occupant} -- \`draw anchor free\` lists what is open`);
			}
			const r = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'move'),
					body: { ops: [{ op: 'set', kind, id: eid, patch: { x: spot.x, y: spot.y } }], label: 'move' } }), 'move');
			return { json: { id: eid, at: { x: spot.x, y: spot.y }, version: r.version },
				text: `${eid} -> cell ${c} = ${spot.x},${spot.y}  v${r.version}` };
		},
	},
	{
		name: 'rename', group: 'Writing', usage: 'draw rename <ref> <name>',
		route: '/diagrams/<id>/commit', method: 'POST', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'change what something is called',
		example: 'draw rename node-019130 web-1',
		args: [{ name: 'ref', about: 'a node, zone or group, by id or name' },
			{ name: 'name', about: 'the new name' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [ref, name] = args;
			if (!ref || !name) die('usage: draw rename <ref> <name>');
			const id = await activeId(ctx, ctx.flags);
			const eid = await resolveId(ctx, id, ref);
			const kind = eid.split('-')[0];
			// a waypoint has no name field at all, and a link's name would be invented
			if (!['node', 'zone', 'group'].includes(kind)) die(`a ${kind} has no name -- only a node, zone or group carries one`);
			const r = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'rename'),
					body: { ops: [{ op: 'set', kind, id: eid, patch: { name } }], label: 'rename' } }), 'rename');
			return { json: { id: eid, name, version: r.version }, text: `${eid} is now ${name}  v${r.version}` };
		},
	},
);

/*
Sensemaking verbs -- B139 / H11.18.

Authoring the reference topology took eleven departures from this tool, and the deepest was not a
missing write verb. Every verb answered with a TABLE, so an agent extending a diagram had to rebuild
its geometry from coordinates before it could choose where the next entity went. `near`, `about` and
`anchor free` each answer one local question well, and none of them lets a caller LOOK at the thing
being edited.

`map` is that. It is written for an agent reading a terminal, which changes several defaults away
from what a person would want:

  - Absolute labels on both axes. Counting characters to recover a coordinate is the single easiest
    mistake to make here, so the map never requires it.
  - Two terminal columns per cell. The canvas is 31 cells wide and fixed, so the widest possible map
    is 62 columns plus a 5-column gutter -- inside 80, always, whatever the diagram holds. One
    column per cell would fit more and be unreadable; three would wrap, and a wrapped grid is worse
    than no grid because it still looks correct.
  - Cropped to content by default. Most diagrams use a fraction of 527 cells and empty rows cost
    attention. Labels are absolute, so cropping changes nothing about how a coordinate reads.
  - The legend prints WITH the map, every time. There is no hovering and no remembered glyph table.
  - The key is one entity per line. Columns are shorter and harder to parse than lines.
*/

const GLYPH = { router: 'r', firewall: 'f', loadbalancer: 'l', server: 's', host: 'h', vxlan: 'v' };
const LEGEND = {
	r: 'router', f: 'firewall', l: 'loadbalancer', s: 'server', h: 'host', v: 'vxlan',
	'+': 'waypoint', '#': 'panel (spans cells)', '?': 'node of an unknown type',
};

// a zone's bounds in CELLS. The zone grid sits half a pitch off, so its edges fall between cells --
// which is exactly why this is derivable rather than approximate.
const zoneCells = (z) => ({
	x0: Math.round((z.x + 30) / 60), y0: Math.round((z.y + 30) / 60),
	x1: Math.round((z.x + z.w - 30) / 60), y1: Math.round((z.y + z.h - 30) / 60),
});

VERBS.push({
	name: 'map', group: 'Context', usage: 'draw map [--full] [--zone <ref>] [--around <ref>] [--radius n] [--layout node|zone]',
	// <layout> is a placeholder, not a literal: --layout picks the grid at call time, so declaring
	// `node` would name one of the two routes this verb actually reaches
	route: '/diagrams/<id>/layouts/<layout>/anchors', method: 'GET',
	also: ['GET /diagrams', 'GET /diagrams/<id>'],
	summary: 'look at the canvas -- occupancy as a grid, so placement is seen rather than derived',
	example: 'draw map --zone site-a',
	flags: [{ name: '--full', about: 'the whole canvas, not just the part in use' },
		{ name: '--zone', about: 'only what falls inside this zone, by id or name' },
		{ name: '--around', about: 'centre on an entity, by id or name' },
		{ name: '--radius', about: 'cells either side of --around; default 4' },
		{ name: '--layout', about: 'node (default) or zone -- the zone grid shows legal zone corners' },
		{ name: '--no-zones', about: 'leave the zone boxes off' },
		{ name: '--diagram', about: 'target by id or name' }],
	async run(ctx) {
		const id = await activeId(ctx, ctx.flags);
		const layout = ctx.flags.layout && ctx.flags.layout !== true ? ctx.flags.layout : 'node';
		if (!['node', 'zone'].includes(layout)) die(`--layout takes node or zone, not ${layout}`);
		const doc = ok(await request(ctx, `/diagrams/${id}`), 'map');
		const anchors = ok(await request(ctx, `/diagrams/${id}/layouts/${layout}/anchors`), 'map').anchors;

		const byId = new Map();
		for (const k of ['nodes', 'waypoints', 'zones', 'groups', 'links']) for (const e of doc[k] || []) byId.set(e.id, e);
		const glyphFor = (occ) => {
			const e = byId.get(occ);
			if (!e) return '?';
			if (occ.startsWith('waypoint-')) return '+';
			if (e.span) return '#';
			return GLYPH[e.type] || '?';
		};

		// ---- the window, from whichever scope the caller named
		const all = { x0: Math.min(...anchors.map((a) => a.cx)), x1: Math.max(...anchors.map((a) => a.cx)),
			y0: Math.min(...anchors.map((a) => a.cy)), y1: Math.max(...anchors.map((a) => a.cy)) };
		let win = all, scope = 'canvas';
		const used = anchors.filter((a) => a.occupant);
		if (ctx.flags.zone && ctx.flags.zone !== true) {
			const zid = await resolveId(ctx, id, ctx.flags.zone);
			const z = byId.get(zid);
			if (!z || !zid.startsWith('zone-')) die(`--zone names ${ctx.flags.zone}, which is not a zone here`);
			win = zoneCells(z); scope = `zone ${z.name}`;
		} else if (ctx.flags.around && ctx.flags.around !== true) {
			const rid = await resolveId(ctx, id, ctx.flags.around);
			const hit = anchors.find((a) => a.occupant === rid);
			if (!hit) die(`--around names ${ctx.flags.around}, which does not sit on an anchor`);
			const r = Number(ctx.flags.radius ?? 4);
			if (!Number.isInteger(r) || r < 1) die('--radius is a whole number of cells, at least 1');
			win = { x0: hit.cx - r, x1: hit.cx + r, y0: hit.cy - r, y1: hit.cy + r };
			scope = `${r} cells around ${byId.get(rid)?.name || rid}`;
		} else if (!ctx.flags.full && used.length) {
			// content plus one cell of margin: enough to see that an edge IS an edge
			win = { x0: Math.min(...used.map((a) => a.cx)) - 1, x1: Math.max(...used.map((a) => a.cx)) + 1,
				y0: Math.min(...used.map((a) => a.cy)) - 1, y1: Math.max(...used.map((a) => a.cy)) + 1 };
			scope = 'in use';
		}
		win = { x0: Math.max(win.x0, all.x0), x1: Math.min(win.x1, all.x1),
			y0: Math.max(win.y0, all.y0), y1: Math.min(win.y1, all.y1) };

		const cell = new Map();
		for (const a of anchors) if (a.occupant) cell.set(`${a.cx},${a.cy}`, a.occupant);

		/*
		---- the grid. Two columns per cell, ticks every five, labels on both axes.

		Zone borders are drawn in the GUTTERS, and that is not a compromise -- it is exact. The zone
		grid sits half a pitch off the node grid, so a zone's edge falls precisely between two cells,
		which is where the gutter already is. A border therefore never overwrites a glyph and never
		shifts a column: measured on the reference topology, all six vertical edges of three zones
		land on gutter columns.

		Horizontally there is no such gap, so a border ROW is inserted -- but only where a zone
		actually starts or ends, never between every pair of cells. Three zones in a thirteen-row map
		cost four extra lines instead of thirteen, and the vertical runs stay visually continuous
		because consecutive cell rows put their `|` in the same column.
		*/
		const pad = 5;
		const W = pad + (win.x1 - win.x0 + 1) * 2;
		const colOf = (cx) => pad + (cx - win.x0) * 2;
		const blank = () => Array(W).fill(' ');
		const put = (a, i, ch) => { if (i >= 0 && i < W) a[i] = ch; };
		const boxes = ctx.flags['no-zones'] ? []
			: (doc.zones || []).map((z) => ({ ...zoneCells(z), name: z.name }))
				.filter((z) => z.x1 >= win.x0 && z.x0 <= win.x1 && z.y1 >= win.y0 && z.y0 <= win.y1);

		const lines = [];
		let ruler = ' '.repeat(pad), ticks = ' '.repeat(pad);
		for (let cx = win.x0; cx <= win.x1; cx++) {
			const on = cx % 5 === 0;
			ticks += on ? '| ' : '  ';
			if (on) { const s = String(cx); ruler = ruler.padEnd(colOf(cx)) + s; }
		}
		lines.push(ruler.trimEnd(), ticks.trimEnd());

		// a zone's side is drawn only if that side is INSIDE the window; one running off the edge
		// gets no corner there, which is how a reader can tell it continues
		const leftIn = (z) => z.x0 >= win.x0;
		const rightIn = (z) => z.x1 <= win.x1;
		const border = (k) => {
			const tops = boxes.filter((z) => z.y0 === k);
			const bots = boxes.filter((z) => z.y1 + 1 === k);
			if (!tops.length && !bots.length) return null;
			const a = blank();
			for (const z of boxes) {                       // zones merely passing through this line
				if (z.y0 < k && k <= z.y1) {
					if (leftIn(z)) put(a, colOf(z.x0) - 1, '\u2502');
					if (rightIn(z)) put(a, colOf(z.x1) + 1, '\u2502');
				}
			}
			const edge = (z, top) => {
				const L = Math.max(colOf(z.x0) - 1, 0), R = Math.min(colOf(z.x1) + 1, W - 1);
				for (let i = L; i <= R; i++) a[i] = '\u2500';
				if (leftIn(z)) put(a, L, top ? '\u250c' : '\u2514');
				if (rightIn(z)) put(a, R, top ? '\u2510' : '\u2518');
				// the name rides the top edge, which is where a reader looks for it -- but only if
				// the box is wide enough that it does not swallow the corners
				if (top) {
					const label = ` ${z.name} `;
					if (R - L - 1 >= label.length + 1) for (let i = 0; i < label.length; i++) put(a, L + 2 + i, label[i]);
				}
			};
			for (const z of bots) edge(z, false);
			for (const z of tops) edge(z, true);
			return a.join('').trimEnd();
		};

		const seen = new Set();
		for (let cy = win.y0; cy <= win.y1; cy++) {
			const b = border(cy);
			if (b) lines.push(b);
			const a = blank();
			const label = String(cy).padStart(pad - 2);
			for (let i = 0; i < label.length; i++) a[i] = label[i];
			for (const z of boxes) {
				if (z.y0 <= cy && cy <= z.y1) {
					if (leftIn(z)) put(a, colOf(z.x0) - 1, '\u2502');
					if (rightIn(z)) put(a, colOf(z.x1) + 1, '\u2502');
				}
			}
			for (let cx = win.x0; cx <= win.x1; cx++) {
				const occ = cell.get(`${cx},${cy}`);
				const g = occ ? glyphFor(occ) : '.';
				if (occ) seen.add(g);
				a[colOf(cx)] = g;
			}
			lines.push(a.join('').trimEnd());
		}
		const closing = border(win.y1 + 1);
		if (closing) lines.push(closing);

		const legend = [...seen].sort().map((g) => `${g} ${LEGEND[g]}`).join('   ');
		const inWin = (a) => a.cx >= win.x0 && a.cx <= win.x1 && a.cy >= win.y0 && a.cy <= win.y1;
		const key = used.filter(inWin)
			.sort((a, b) => a.cy - b.cy || a.cx - b.cx)
			.map((a) => `  ${`${a.cx},${a.cy}`.padEnd(8)}${glyphFor(a.occupant)}  ${byId.get(a.occupant)?.name || a.occupant}`);
		const zones = (doc.zones || []).map((z) => {
			const c = zoneCells(z);
			return `  ${z.name.padEnd(12)}cells ${c.x0},${c.y0} .. ${c.x1},${c.y1}`;
		});

		const text = [
			`${doc.meta.name}  ${scope}  (${layout} grid, ${used.length} occupied of ${anchors.length})`,
			'',
			...lines,
			'',
			`  ${legend || '(nothing placed)'}   . free${boxes.length ? '   \u2502\u2500 zone bounds' : ''}`,
			...(key.length ? ['', ...key] : []),
			...(zones.length && layout === 'node' ? ['', 'zones:', ...zones] : []),
		].join('\n');
		return { json: { diagram: id, layout, window: win, scope,
			occupied: used.filter(inWin).map((a) => ({ cx: a.cx, cy: a.cy, id: a.occupant, name: byId.get(a.occupant)?.name })),
			zones: (doc.zones || []).map((z) => ({ id: z.id, name: z.name, cells: zoneCells(z) })) }, text };
	},
});

/*
`rm` -- the other half of every create verb (B134).

The tool could add a node, a link, a zone, a group and a waypoint, and remove none of them, so
tidying up a probe meant `commit --ops` with a hand-written `{op:'del'}` and an id looked up by
hand. That is the escape hatch B133 exists to stop being mandatory.

The CASCADE is the interesting half, not the op. Deleting a node takes the links that touched it and
a waypoint's removal reroutes or drops its link, and a caller who discovers that in the next render
has been surprised by their own edit. So this reports what ELSE went.

Read the document before and after rather than predicting. Predicting means restating the cascade
rule in a second place and being wrong about it later, which is the twin this codebase keeps
finding; two extra reads buy a report that is true by construction.
*/
const census = (doc) => {
	const m = new Map();
	for (const k of ['nodes', 'waypoints', 'links', 'zones', 'groups']) {
		for (const e of doc[k] || []) m.set(e.id, e.name || e.id);
	}
	return m;
};

VERBS.push(
	{
		name: 'rm', group: 'Writing', usage: 'draw rm <ref> [ref...]',
		route: '/diagrams/<id>/commit', method: 'POST', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'remove entities, and say what the cascade took with them',
		example: 'draw rm probe-node',
		args: [{ name: 'ref...', about: 'entities by id or name' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			if (!args.length) die('usage: draw rm <ref> [ref...]');
			const id = await activeId(ctx, ctx.flags);
			const before = ok(await request(ctx, `/diagrams/${id}`), 'rm');
			const was = census(before);
			const ops = [];
			for (const ref of args) {
				const eid = await resolveId(ctx, id, ref);
				const kind = eid.split('-')[0];
				ops.push({ op: 'del', kind, id: eid });
			}
			const r = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'rm'), body: { ops, label: 'rm' } }), 'rm');
			const after = census(ok(await request(ctx, `/diagrams/${id}`), 'rm'));
			const asked = new Set(ops.map((o) => o.id));
			const gone = [...was.keys()].filter((k) => !after.has(k));
			const extra = gone.filter((g) => !asked.has(g));
			return { json: { removed: gone, asked: [...asked], cascade: extra, version: r.version },
				text: [`removed ${asked.size}: ${[...asked].map((a) => was.get(a) || a).join(' ')}`,
					...(extra.length ? [`cascade also took ${extra.length}: ${extra.map((e) => was.get(e) || e).join(' ')}`] : []),
					`${gone.length} gone in total  v${r.version}`].join('\n') };
		},
	},
	/*
	`set` -- change a property without dropping to `commit --ops`.

	`rename` covers the common case and nothing covered the rest, so changing a shape after placing
	a node meant hand-writing a `set` op. The field list is CLOSED and checked here: the server
	would refuse an unknown one, but a round trip to learn a name the tool already knows teaches
	nobody anything, and the refusal can name the alternatives.
	*/
	{
		name: 'set', group: 'Writing', usage: 'draw set <ref> <field> <value>',
		route: '/diagrams/<id>/commit', method: 'POST', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'change one property of one entity',
		example: 'draw set a-fw shape square',
		args: [{ name: 'ref', about: 'the entity, by id or name' },
			{ name: 'field', about: 'name, type, shape, cols or rows' },
			{ name: 'value', about: 'the new value' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [ref, field, value] = args;
			if (!ref || !field || value === undefined) die('usage: draw set <ref> <field> <value>');
			const FIELDS = ['name', 'type', 'shape', 'cols', 'rows'];
			if (!FIELDS.includes(field)) die(`set takes ${FIELDS.join(', ')} -- not ${field}. Position is \`draw move\`.`);
			if (field === 'shape' && !['circle', 'square'].includes(value)) die(`shape is circle or square, not ${value}`);
			const id = await activeId(ctx, ctx.flags);
			const eid = await resolveId(ctx, id, ref);
			const kind = eid.split('-')[0];
			let patch;
			if (field === 'cols' || field === 'rows') {
				// span is one field, so changing half of it needs the other half read first
				const doc = ok(await request(ctx, `/diagrams/${id}`), 'set');
				const node = (doc.nodes || []).find((n) => n.id === eid);
				if (!node) die(`${ref} is not a node, and only a node spans cells`);
				const span = { cols: 1, rows: 1, ...(node.span || {}) };
				const n = Number(value);
				if (!Number.isInteger(n) || n < 1) die(`${field} is a whole number of cells, at least 1`);
				patch = { span: { ...span, [field]: n } };
			} else patch = { [field]: value };
			const r = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'set'),
					body: { ops: [{ op: 'set', kind, id: eid, patch }], label: `set ${field}` } }), 'set');
			return { json: { id: eid, field, value, version: r.version }, text: `${eid} ${field} = ${value}  v${r.version}` };
		},
	},
	/*
	`region` -- panel content, one region at a time.

	`panel --content f.json` takes a file, which is right for a whole layout and wrong for the way a
	diagram actually gets built: a region at a time, looking at the result. Writing a JSON file per
	edit is the shell reach B139 counted twice.

	Appends. A region's `at` is its own coordinate inside the panel, so the server rejects an
	overlap and the order of the array is not a layout decision.
	*/
	{
		name: 'region', group: 'Writing', usage: 'draw region <panel> at <col>,<row> [--text s | --glyph g] [flags]',
		route: '/diagrams/<id>/commit', method: 'POST', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'add one content region to a panel, in place',
		example: 'draw region key at 0,0 --cols 7 --text "multi-site topology" --align center --outline',
		args: [{ name: 'panel', about: 'a spanning node, by id or name' },
			{ name: 'at', about: "the literal word 'at'" },
			{ name: 'col,row', about: 'the region origin INSIDE the panel, from 0,0' }],
		flags: [{ name: '--cols', about: 'width in panel cells; default 1' }, { name: '--rows', about: 'height; default 1' },
			{ name: '--text', about: 'the text to show' }, { name: '--glyph', about: 'a glyph name instead of text' },
			{ name: '--align', about: 'left, center or right' }, { name: '--bg', about: 'background, #hex' },
			{ name: '--accent', about: 'accent colour, #hex' }, { name: '--fill', about: 'text colour, #hex' },
			{ name: '--outline', about: 'draw a border' }, { name: '--rx', about: 'corner radius, 0-30' },
			{ name: '--action', about: 'make it a button with this action id' },
			{ name: '--input', about: 'make it editable in run mode' },
			{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const [ref, at, cr] = args;
			if (!ref || at !== 'at' || !cr) die('usage: draw region <panel> at <col>,<row>');
			if (!/^\d+,\d+$/.test(cr)) die('the region origin is col,row inside the panel -- whole numbers from 0,0');
			const [col, row] = cr.split(',').map(Number);
			const f = ctx.flags;
			if (!f.text && !f.glyph) die('a region shows --text or a --glyph; give one');
			if (f.text && f.glyph) die('a region shows --text or a --glyph, not both');
			const id = await activeId(ctx, ctx.flags);
			const eid = await resolveId(ctx, id, ref);
			const doc = ok(await request(ctx, `/diagrams/${id}`), 'region');
			const node = (doc.nodes || []).find((n) => n.id === eid);
			if (!node) die(`${ref} is not a node`);
			if (!node.span) die(`${ref} does not span cells -- \`draw set ${ref} cols 3\` first, or create it with \`draw panel\``);

			const r = { at: [col, row], cols: Number(f.cols ?? 1), rows: Number(f.rows ?? 1) };
			if (f.text) { r.content = 'text'; r.value = String(f.text); } else { r.content = 'glyph'; r.glyph = String(f.glyph); }
			for (const [flag, key] of [['align', 'align'], ['bg', 'bg'], ['accent', 'accent'], ['fill', 'fill'], ['action', 'action']]) {
				if (f[flag] && f[flag] !== true) r[key] = String(f[flag]);
			}
			if (f.outline) r.outline = true;
			if (f.input) r.input = true;
			if (f.rx !== undefined && f.rx !== true) r.rx = Number(f.rx);
			const content = [...(node.content || []), r];
			const res = ok(await request(ctx, `/diagrams/${id}/commit`,
				{ method: 'POST', headers: await held(ctx, id, 'region'),
					body: { ops: [{ op: 'set', kind: 'node', id: eid, patch: { content } }], label: 'region' } }), 'region');
			return { json: { panel: eid, region: r, regions: content.length, version: res.version },
				text: `${node.name} region ${content.length} at ${col},${row}  ${r.value || r.glyph}  v${res.version}` };
		},
	},
);

/*
Walking the diagram -- a focus, and relations read from it.

`about` answers everything at once, which is right for "tell me about this" and wrong for moving
around. Walking is a sequence of narrow questions -- what connects to this, what contains it, what
else is in its group -- and each answer decides the next step. Bundling them means reading five
relations to use one, and re-naming the subject on every call means carrying it in working memory
between commands.

So: a persistent focus, and relation verbs that default to it.

THE FOCUS IS ALWAYS PRINTED, and that is not decoration. Hidden state is the most dangerous thing
this tool could offer an agent -- a verb silently answering about something set ten commands ago is
a confidently wrong answer, which is the failure this whole codebase keeps finding. Every verb
below names the subject it used, so the state can never be both implicit and invisible.
*/
const focusFile = (ctx) => `${homeOf(ctx)}/.config/draw/focus`;
/*
The focus is stored WITH its diagram, and ignored anywhere else.

An entity id means nothing outside the diagram that minted it, so a focus carried across a switch is
state that is both stale and invisible -- which is the hazard this whole family of verbs has to earn
its way past. Left unguarded it answered `unknown entity: node-42c3be` on the new diagram: a real
refusal, but one that blames the entity rather than saying the focus does not belong here.

Scoped, it simply does not apply: the relation verbs then ask for a reference, which is the honest
answer to "you are not standing anywhere in this diagram".
*/
async function readFocus(ctx, diagramId) {
	if (!homeOf(ctx)) return null;
	const fs = await import('node:fs');
	try {
		const held = JSON.parse(fs.readFileSync(focusFile(ctx), 'utf8'));
		return held.diagram === diagramId ? held.id : null;
	} catch { return null; }
}
async function writeFocus(ctx, diagramId, ref) {
	if (!homeOf(ctx)) return;
	const fs = await import('node:fs'), path = await import('node:path');
	fs.mkdirSync(path.dirname(focusFile(ctx)), { recursive: true });
	if (ref) fs.writeFileSync(focusFile(ctx), JSON.stringify({ diagram: diagramId, id: ref }));
	else try { fs.unlinkSync(focusFile(ctx)); } catch { /* gone */ }
}
/*
The subject of a relation verb: what was named, or the focus.

Returns the resolved id AND the document, because every caller needs both and fetching twice for
one question is the cost that made `about` feel expensive.
*/
async function subject(ctx, id, arg, what) {
	const doc = ok(await request(ctx, `/diagrams/${id}`), what);
	const ref = arg || await readFocus(ctx, id);
	if (!ref) die(`${what} needs an entity, or a focus in THIS diagram -- \`draw focus <ref>\` sets one`);
	return { doc, eid: await resolveId(ctx, id, ref, doc), nm: naming(doc) };
}

VERBS.push(
	{
		name: 'focus', group: 'Context', usage: 'draw focus [ref]',
		route: '/diagrams/<id>', method: 'GET', also: ['GET /diagrams'],
		summary: 'the entity the relation verbs read from, persisted; omit to see it',
		example: 'draw focus a-lb',
		args: [{ name: 'ref', about: 'the entity to stand on; omit to report the current one' }],
		flags: [{ name: '--clear', about: 'forget it' }, { name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const id = await activeId(ctx, ctx.flags);
			if (ctx.flags.clear) { await writeFocus(ctx, id, null); return { json: { focus: null }, text: 'focus cleared' }; }
			const doc = ok(await request(ctx, `/diagrams/${id}`), 'focus');
			const nm = naming(doc);
			if (!args[0]) {
				const cur = await readFocus(ctx, id);
				if (!cur) return { json: { focus: null }, text: 'no focus -- `draw focus <ref>` sets one' };
				return { json: { focus: cur, name: nm(cur) }, text: `${nm(cur)}  ${cur}` };
			}
			const eid = await resolveId(ctx, id, args[0], doc);
			await writeFocus(ctx, id, eid);
			return { json: { focus: eid, name: nm(eid), kind: eid.split('-')[0] },
				text: `${nm(eid)}  ${eid}  (${eid.split('-')[0]})` };
		},
	},
	{
		name: 'links', group: 'Context', usage: 'draw links [ref]',
		route: '/diagrams/<id>/context/<entity>', method: 'GET', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'what connects to a thing -- the other end named, routed marked',
		example: 'draw links a-lb',
		args: [{ name: 'ref', about: 'the entity; omit to use the focus' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const id = await activeId(ctx, ctx.flags);
			const { eid, nm } = await subject(ctx, id, args[0], 'links');
			const b = ok(await request(ctx, `/diagrams/${id}/context/${eid}`), 'links');
			const rows = (b.links || []).map((l) => {
				// the OTHER end is the useful column: a walk asks where a link goes, not what it is
				const far = l.src === eid ? l.dst : l.src;
				return [nm(l.id), nm(far), l.routed ? 'routed' : 'straight'];
			});
			return { json: { of: eid, name: nm(eid), links: b.links || [] },
				text: `links of ${nm(eid)}\n${rows.length ? table(rows, ['LINK', 'TO', 'ROUTE']) : '  (none)'}` };
		},
	},
	{
		name: 'holds', group: 'Context', usage: 'draw holds [ref]',
		route: '/diagrams/<id>/context/<entity>', method: 'GET', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'what contains a thing -- its zones and its group, upward',
		example: 'draw holds a-web-1',
		args: [{ name: 'ref', about: 'the entity; omit to use the focus' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		/*
		The INVERSE of `zone contents`, and the relation that had no verb at all.

		Containment was only ever answerable downward -- `zone contents site-a` -- or buried in
		`about`. Walking asks it upward far more often: standing on a node, what is it part of.
		*/
		async run(ctx, args) {
			const id = await activeId(ctx, ctx.flags);
			const { eid, nm } = await subject(ctx, id, args[0], 'holds');
			const b = ok(await request(ctx, `/diagrams/${id}/context/${eid}`), 'holds');
			const rows = [];
			for (const z of b.zones || []) rows.push(['zone', nm(z), z]);
			if (b.group) rows.push(['group', nm(b.group), b.group]);
			return { json: { of: eid, name: nm(eid), zones: b.zones || [], group: b.group ?? null },
				text: `${nm(eid)} is held by\n${rows.length ? table(rows, ['KIND', 'NAME', 'ID']) : '  (nothing -- it sits loose on the canvas)'}` };
		},
	},
	{
		name: 'peers', group: 'Context', usage: 'draw peers [ref]',
		route: '/diagrams/<id>/context/<entity>', method: 'GET', also: ['GET /diagrams', 'GET /diagrams/<id>'],
		summary: 'what sits one hop away -- neighbours, and the rest of its group',
		example: 'draw peers a-web-1',
		args: [{ name: 'ref', about: 'the entity; omit to use the focus' }],
		flags: [{ name: '--diagram', about: 'target by id or name' }],
		async run(ctx, args) {
			const id = await activeId(ctx, ctx.flags);
			const { doc, eid, nm } = await subject(ctx, id, args[0], 'peers');
			const b = ok(await request(ctx, `/diagrams/${id}/context/${eid}`), 'peers');
			const rows = (b.neighbours || []).map((n) => ['linked', nm(n), n]);
			// group siblings are peers in a different sense, and a walk wants both without asking twice
			if (b.group) {
				const g = (doc.groups || []).find((x) => x.id === b.group);
				for (const m of (g?.members || []).filter((m) => m !== eid)) rows.push(['grouped', nm(m), m]);
			}
			return { json: { of: eid, name: nm(eid), neighbours: b.neighbours || [] },
				text: `peers of ${nm(eid)}\n${rows.length ? table(rows, ['HOW', 'NAME', 'ID']) : '  (none)'}` };
		},
	},
);

/*
`parity` -- the delta between what the model holds, what the renderer draws, and what the map shows.

A5 Perceptual Parity requires that a human and an agent share symmetric perception of one reality,
and names Measured Parity as the mechanic: the delta is itself measured and held within a stated
bound, because "symmetry is a verified property, not an aspiration". Everything built here before
this verb was the OTHER mechanic -- Synthetic Sensory Organs, instruments for an agent to perceive
its own output. Instruments without a measurement satisfy the axiom by instinct.

Three views of one diagram already exist and are produced by three different code paths:

  MODEL    what `GET /diagrams/<id>` says the document contains
  RENDER   what the SVG actually emits -- the picture a person is looking at
  MAP      what occupies an anchor, which is what an agent places against

A disagreement between any two is a perception defect by definition: it means the human and the
agent are looking at different diagrams, or the agent is placing against a canvas that is not the
one being drawn. The bound A5 asks to be stated is therefore zero, which is the easiest bound to
state and the easiest to check.

This is not hypothetical. `render --summary` shipped this session omitting waypoints, reporting 20
elements where the map reported 27 occupied anchors, and the disagreement was noticed by eye.
*/
/*
The comparison itself, as a unit -- and it is exported because it has to be TESTED against a
disagreement.

The first version was inline, and the test that drove it only ever saw a diagram the tool had just
built, which agrees with itself by construction. Deleting either half of the comparison left that
test green: a parity check that has only seen parity is the same kind of unverified claim it exists
to refute, which the test's own comment said while failing to avoid it. Fetching three views is
plumbing; deciding whether they agree is the rule, and the rule is what needs driving from both
sides.
*/
export function parityOf(model, render, placed) {
	const rows = [
		['nodes', model.nodes, render.nodes, '-'],
		['waypoints', model.waypoints, render.waypoints, '-'],
		['links', model.links, render.links, '-'],
		['zones', model.zones, render.zones, '-'],
		// occupancy is the only figure the map contributes, and it spans two kinds
		['on an anchor', model.nodes + model.waypoints, '-', placed],
	];
	const deltas = [];
	for (const [what, held, drew, shown] of rows) {
		if (drew !== '-' && drew !== held) deltas.push(`${what}: the model holds ${held}, the render drew ${drew}`);
		if (shown !== '-' && shown !== held) deltas.push(`${what}: the model holds ${held}, the map shows ${shown}`);
	}
	return { rows, deltas };
}

VERBS.push({
	name: 'parity', group: 'Context', usage: 'draw parity',
	route: '/diagrams/<id>', method: 'GET',
	also: ['GET /diagrams', 'GET /diagrams/<id>/layouts/<layout>/anchors', 'GET /d/<id>.svg'],
	summary: 'do the model, the render and the map agree -- A5, measured rather than assumed',
	example: 'draw parity',
	flags: [{ name: '--diagram', about: 'target by id or name' }],
	async run(ctx) {
		const id = await activeId(ctx, ctx.flags);
		const doc = ok(await request(ctx, `/diagrams/${id}`), 'parity');
		const anchors = ok(await request(ctx, `/diagrams/${id}/layouts/node/anchors`), 'parity').anchors;

		// the render is fetched raw, like `draw render` does -- the one route that is not JSON
		const url = `${ctx.host}${ctx.code ? '/connect' : ''}/d/${id}.svg`;
		const res = await fetch(url, { headers: ctx.code ? { authorization: `Bearer ${ctx.code}` } : {} });
		if (!res.ok) die(`parity: the render answered HTTP ${res.status}`);
		const body = (await res.text()).split('</defs>').pop();
		const drew = (kind) => (body.match(new RegExp(`<g id="${kind}-[0-9a-f]{6}"`, 'g')) || []).length;

		const held = (k) => (doc[k] || []).length;
		const placed = anchors.filter((a) => a.occupant).length;
		const { rows, deltas } = parityOf(
			{ nodes: held('nodes'), waypoints: held('waypoints'), links: held('links'), zones: held('zones') },
			{ nodes: drew('node'), waypoints: drew('waypoint'), links: drew('link'), zones: drew('zone') },
			placed,
		);
		const text = [
			table(rows.map((r) => r.map(String)), ['WHAT', 'MODEL', 'RENDER', 'MAP']),
			'',
			deltas.length
				? `PARITY BROKEN -- ${deltas.length} disagreement(s):\n  ${deltas.join('\n  ')}`
				: 'parity holds -- the model, the picture and the canvas agree (A5, bound 0)',
		].join('\n');
		// a broken parity is a failure, not a report: an agent must not read this and carry on
		if (deltas.length && !ctx.json) die(text);
		return { json: { diagram: id, rows, deltas, parity: deltas.length === 0 }, text };
	},
});

/*
The delete window -- B109.

`DELETE` has existed since H9.21 and felt final, because nothing in the product said otherwise. It
is not: `gs://diagrams.apnex.io` carries a 604800s soft-delete retention, so seven days of removals
have been sitting there recoverable and unreachable. A backstop nobody can reach is a backstop only
in the sense that it would have worked.

Two answers that must stay apart. A backend with NO window at all -- the filesystem -- is not the
same as a window that happens to be empty, and collapsing them would tell a caller their work is
gone when the truth is that this deployment never had a recycle bin.
*/
const REMAINING = (purgeAt) => {
	if (!purgeAt) return '?';
	const ms = Date.parse(purgeAt) - Date.now();
	if (!Number.isFinite(ms)) return '?';
	if (ms <= 0) return 'due';
	const h = Math.floor(ms / 3600000);
	return h >= 48 ? `${Math.floor(h / 24)}d` : `${h}h`;
};

VERBS.push(
	{
		name: 'deleted', group: 'Lifecycle', usage: 'draw deleted',
		route: '/diagrams/deleted', method: 'GET',
		summary: 'what is still recoverable, and how long is left',
		example: 'draw deleted',
		async run(ctx) {
			const b = ok(await request(ctx, '/diagrams/deleted'), 'deleted');
			if (!b.window) {
				// NOT "nothing to restore" -- the distinction is the whole reason the seam answers null
				return { json: b, text: 'this deployment has no delete window: a removed diagram is gone' };
			}
			// an entry the tool cannot attribute is counted rather than listed, and saying so is the
			// difference between "nothing is recoverable" and "nothing I can show you is"
			const aside = b.unattributable
				? `\n${b.unattributable} more predate ownership tagging and cannot be attributed`
				: '';
			if (!b.deleted.length) {
				return { json: b, text: `nothing in the delete window${aside}` };
			}
			// LEFT first, because it is the column that decides whether to act now
			const rows = b.deleted.map((d) => [REMAINING(d.purgeAt), d.id, d.name ?? '(unreadable)',
				d.deletedAt ? d.deletedAt.replace('T', ' ').slice(0, 16) : '?']);
			return { json: b, text: `${table(rows, ['LEFT', 'ID', 'NAME', 'DELETED'])}${aside}` };
		},
	},
	{
		name: 'restore', group: 'Lifecycle', usage: 'draw restore <id>',
		route: '/diagrams/deleted/<id>/restore', method: 'POST', also: ['GET /diagrams/deleted'],
		summary: 'bring one back out of the delete window',
		example: 'draw restore diagram-a97651',
		args: [{ name: 'id', about: 'the diagram id, as `draw deleted` lists it' }],
		async run(ctx, args) {
			if (!args[0]) die('restore needs a diagram id -- `draw deleted` lists what is recoverable');
			/*
			By ID and not by name, alone among the reference-taking verbs.

			`resolveId` resolves against a LIVE document, and every entry here is one that is not
			there -- so there is nothing to resolve against. Names are also not unique across the
			window: deleting two diagrams called `scratch` is ordinary, and picking one silently
			would be the worst possible behaviour on a recovery surface.
			*/
			if (!/^diagram-[0-9a-f]{6}$/.test(args[0])) {
				die(`restore takes a diagram id like diagram-a97651, not a name -- a deleted diagram has no live name to resolve, and two may share one. \`draw deleted\` lists the ids.`);
			}
			const b = ok(await request(ctx, `/diagrams/deleted/${args[0]}/restore`, { method: 'POST' }), 'restore');
			return { json: b, text: `restored ${b.name || b.restored}  (${b.restored})` };
		},
	},
);
