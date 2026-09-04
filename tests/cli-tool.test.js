/*
GR18 -- the tool, driven as a library rather than as a subprocess.

`main` is called directly so a verb's BEHAVIOUR is asserted rather than its formatting. A CLI tested
only by spawning it reports failures as exit codes and stdout diffs, which is how the shell version
went a whole release without anyone noticing it could not authenticate (B117).

The server here is a real one on a real port: the tool speaks only HTTP and imports nothing from
`server/`, so testing it in-process would be testing something the agent never runs.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeApp } from './fixtures/app.mjs';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { main } from '../cli/draw.mjs';
import { VERBS, byName, parityOf } from '../cli/verbs.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
let app, host, dataDir, home;

async function boot() {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-cli-'));
	home = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-home-'));
	app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	host = `http://127.0.0.1:${app.port}`;
}
const run = async (...argv) => {
	const out = [];
	await main([...argv, '--host', host], { HOME: home }, (s) => out.push(s));
	return out.join('');
};

test('GR18: every verb declares a summary, an example, and the route it reaches', () => {
	// the manifest is the source for help, dispatch, docs and the coverage scan; a verb missing any
	// of these is not a rough edge, it is a hole in three surfaces at once
	for (const v of VERBS) {
		assert.ok(v.summary, `${v.name} has no summary`);
		assert.ok(v.example, `${v.name} has no example`);
		assert.ok(v.route, `${v.name} declares no route`);
		assert.ok(v.usage.startsWith('draw '), `${v.name} usage should read as an invocation`);
		assert.equal(typeof v.run, 'function', `${v.name} has no handler`);
	}
});

test('GR18: a sub-verb beats its bare noun, so `lock status` is reachable', () => {
	// matching the bare name first would make every sub-verb unreachable, and the symptom would
	// look like a broken flag rather than a broken lookup
	assert.equal(byName('lock', 'status').name, 'lock status');
	assert.equal(byName('lock', undefined).name, 'lock');
	assert.equal(byName('lock', 'nonsense').name, 'lock', 'an unknown second word is an argument, not a sub-verb');
});

test('GR18: the door is chosen by the credential, never configured', async () => {
	const { base } = await import('../cli/draw.mjs').then((m) => ({ base: m.base }));
	assert.equal(base({}, {}).prefix, '/api/v1', 'no code, the editor door');
	assert.equal(base({}, { DRAW_CODE: 'x' }).prefix, '/connect/v1', 'a code, the agent door');
	assert.equal(base({ code: 'y' }, {}).prefix, '/connect/v1', 'the flag does it too');
	assert.equal(base({ host: 'http://h/' }, {}).host, 'http://h', 'a trailing slash never doubles');
});

test('the tool drives a diagram end to end, which is the whole of GR18', async () => {
	await boot();
	try {
		const id = (await run('create', 'cli-test')).trim();
		assert.match(id, /^diagram-[0-9a-f]{6}$/, 'create answers the minted id and nothing else');

		await run('lock', '--diagram', id);
		const commit = await run('commit', '--diagram', id, '--label', 'from the tool',
			'--ops', writeOps({ ops: [{ op: 'put', kind: 'node',
				entity: { id: 'node-c10001', name: 'from-cli', type: 'host', x: 120, y: 60 } }] }));
		assert.match(commit, /^v\d+/, 'commit answers the new version');

		const nodes = JSON.parse(await run('get', 'nodes', '--diagram', id, '--json'));
		assert.equal(nodes.length, 1);
		assert.equal(nodes[0].name, 'from-cli');

		const lock = JSON.parse(await run('lock', 'status', '--diagram', id, '--json'));
		assert.equal(lock.owner, 'server');
		assert.equal(typeof lock.expiresAt, 'number');

		await run('unlock', '--diagram', id);
		assert.equal(JSON.parse(await run('lock', 'status', '--diagram', id, '--json')).owner, 'client');

		const gone = JSON.parse(await run('delete', id, '--json'));
		assert.equal(gone.deleted, id);
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('a write without the slot is refused by the TOOL, before the server sees it', async () => {
	await boot();
	try {
		const id = (await run('create', 'no-lock')).trim();
		const err = await captureExit(() => run('commit', '--diagram', id, '--ops', writeOps({ ops: [] })));
		assert.match(err, /write slot/, 'it says which verb to run, rather than relaying a 423');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

function writeOps(obj) {
	const f = path.join(home, `ops-${Math.random().toString(36).slice(2)}.json`);
	fs.writeFileSync(f, JSON.stringify(obj));
	return f;
}
async function captureExit(fn) {
	const errs = [];
	const ew = process.stderr.write.bind(process.stderr);
	const exit = process.exit;
	process.stderr.write = (s) => { errs.push(s); return true; };
	process.exit = () => { throw new Error('__exit__'); };
	try { await fn(); } catch (e) { if (e.message !== '__exit__') throw e; }
	finally { process.stderr.write = ew; process.exit = exit; }
	return errs.join('');
}

/*
`place` -- intent in, geometry handled. The verb the tool exists for.

Two mistakes an agent actually makes: computing an off-grid coordinate, and landing on something
already there. These assert that both are removed, and that a name works where an id is expected,
because an agent thinks in names.
*/
test('place puts a node on a free anchor beside a reference, named by name', async () => {
	await boot();
	try {
		const id = (await run('create', 'place-test')).trim();
		await run('lock', '--diagram', id);
		await run('commit', '--diagram', id, '--label', 'seed', '--ops', writeOps({ ops: [{ op: 'put', kind: 'node',
			entity: { id: 'node-a00001', name: 'lb-1', type: 'loadbalancer', x: 0, y: 0 } }] }));

		const first = JSON.parse(await run('place', 'server', 'near', 'lb-1', '--dir', 'right', '--link', '--name', 'web-1', '--diagram', id, '--json'));
		assert.deepEqual(first.at, { x: 60, y: 0 }, 'one cell to the right, on the grid');
		assert.equal(first.linked, true);

		// the second must step PAST the first: an occupied anchor is not a free one
		const second = JSON.parse(await run('place', 'server', 'near', 'lb-1', '--dir', 'right', '--name', 'web-2', '--diagram', id, '--json'));
		assert.deepEqual(second.at, { x: 120, y: 0 }, 'stepped over the node it just placed');

		const nodes = JSON.parse(await run('get', 'nodes', '--diagram', id, '--json'));
		assert.deepEqual(nodes.map((n) => n.name).sort(), ['lb-1', 'web-1', 'web-2'], '--name survived flag parsing');

		// a name resolves where the route wants an id
		const about = JSON.parse(await run('about', 'lb-1', '--diagram', id, '--json'));
		assert.equal(about.id, 'node-a00001');
		assert.equal(about.neighbours.length, 1, 'only web-1 was linked');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('place refuses a direction with nothing free, rather than placing elsewhere', async () => {
	await boot();
	try {
		const id = (await run('create', 'boxed-in')).trim();
		await run('lock', '--diagram', id);
		const err = await captureExit(() => run('place', 'server', 'near', 'nonexistent', '--diagram', id));
		// B143: the refusal now comes from `resolveId`, one place for every verb that takes a
		// reference, and the hint moved with it -- four callers each carried their own and they
		// disagreed about which verb to suggest
		assert.match(err, /nothing called nonexistent/, 'the name is named');
		assert.match(err, /draw show|draw map/, 'and it says how to find the real ones');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
GR18 -- help is enforced, not remembered.

"Does every verb have a well-structured --help" should not be a question anyone has to answer by
reading. A verb that accepts a flag it does not declare is invisible in help, so an agent cannot
discover it and will never use it -- the capability exists and does not, which is the same shape as
the CLI that could not authenticate.

`--diagram` is the one most easily missed, because most verbs accept it INDIRECTLY through
`activeId(ctx, ctx.flags)` rather than by naming it. `context` did exactly that.
*/
test('GR18: every verb declares every flag it reads and every argument it takes', () => {
	const gaps = [];
	for (const v of VERBS) {
		const body = v.run.toString();
		const declared = (v.flags || []).map((f) => f.name);

		if (/activeId\(ctx, ctx\.flags\)/.test(body) && !declared.includes('--diagram')) {
			gaps.push(`${v.name}: accepts --diagram through activeId and does not declare it`);
		}
		for (const f of new Set([...body.matchAll(/ctx\.flags\.(\w+)/g)].map((m) => m[1]))) {
			if (!declared.includes(`--${f}`)) gaps.push(`${v.name}: reads --${f}, undeclared`);
		}
		/*
		"Reads its arguments" includes ITERATING them.

		This used to mean destructuring or indexing only, and exempted `select` by name because that
		verb loops. A rule with an instance carved out of it is not a rule -- the moment `rm` and
		`group` arrived with the same shape, the exemption was wrong for two more verbs and the
		check would have demanded they declare nothing. Widened to the actual question: does the
		body touch `args` at all.
		*/
		const positional = /const \[[^\]]+\] = args/.test(body)
			|| /args\[\d\]/.test(body)
			|| /\bof args\b/.test(body)
			|| /args\.length/.test(body)
			|| /\.\.\.args\b/.test(body);
		if (positional && !(v.args || []).length) gaps.push(`${v.name}: takes positional args, declares none`);
		if (!positional && (v.args || []).length) {
			gaps.push(`${v.name}: declares arguments it never reads`);
		}
	}
	assert.deepEqual(gaps, [], `help would omit these:\n  ${gaps.join('\n  ')}`);
});

test('GR18: --help renders the same five parts for every verb, leaf or sub', async () => {
	// structure, not prose: usage, summary, flags, example, route. A verb missing a section is a
	// verb an agent has to guess at, and guessing is what the tool exists to remove.
	for (const v of VERBS) {
		const out = [];
		const argv = v.sub ? v.name.split(' ') : [v.name];
		// awaited, because `main` is async and the token sweep now runs before the help branch.
		// It used to complete synchronously by accident, and this collected an empty buffer the
		// moment that stopped being true. `{}` as the env is deliberate: no HOME means no store,
		// and this must not reach the developer's real one.
		await main([...argv, '--help'], {}, (s) => out.push(s));
		const text = out.join('');
		assert.ok(text.includes(v.usage), `${v.name}: help omits its usage line`);
		assert.ok(text.includes(v.summary), `${v.name}: help omits its summary`);
		assert.ok(/\bFlags\b/.test(text), `${v.name}: help omits the Flags section`);
		assert.ok(text.includes('--json') && text.includes('--help'), `${v.name}: the universal flags are missing`);
		assert.ok(text.includes(v.example), `${v.name}: help omits its example`);
		assert.ok(text.includes(`reaches ${v.route}`), `${v.name}: help does not name the route it reaches`);
		if ((v.args || []).length) assert.ok(/\bArguments\b/.test(text), `${v.name}: has args but no Arguments section`);
	}
});

/*
`add` takes an ANCHOR, and refuses to take a pixel.

The director's distinction, and the reason `add` is safe where a coordinate wrapper would not be:
a cell index cannot be off the grid, so the class of mistake that produced every off-grid node an
agent ever drew (B110) is unrepresentable rather than merely validated.
*/
test('add places on a cell, and an occupied one names its occupant', async () => {
	await boot();
	try {
		const id = (await run('create', 'add-test')).trim();
		await run('lock', '--diagram', id);
		const first = JSON.parse(await run('add', 'server', 'at', '0,0', '--name', 'web-1', '--diagram', id, '--json'));
		assert.deepEqual(first.cell, { cx: 0, cy: 0 });
		assert.deepEqual(first.at, { x: 0, y: 0 }, 'the cell resolved to px by the kernel, not by the caller');

		const taken = await captureExit(() => run('add', 'server', 'at', '0,0', '--diagram', id));
		assert.match(taken, /is taken by node-/, 'and it says WHICH entity, so the next question is answerable');
		assert.match(taken, /draw about/, 'naming the verb that answers it');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('add refuses pixels, and says they look like pixels', async () => {
	await boot();
	try {
		const id = (await run('create', 'px-test')).trim();
		await run('lock', '--diagram', id);
		const err = await captureExit(() => run('add', 'server', 'at', '130,60', '--diagram', id));
		assert.match(err, /look like pixels/, 'the likely mistake is named rather than left as "outside the canvas"');
		assert.match(err, /anchor nearest/, 'and the verb that converts them is offered');

		const frac = await captureExit(() => run('add', 'server', 'at', '1.5,0', '--diagram', id));
		assert.match(frac, /whole numbers/, 'a fractional cell is refused before any request');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('place reads inside a zone and between two nodes, linking both ends', async () => {
	await boot();
	try {
		const id = (await run('create', 'place-modes')).trim();
		await run('lock', '--diagram', id);
		await run('commit', '--diagram', id, '--label', 'seed', '--ops', writeOps({ ops: [
			{ op: 'put', kind: 'zone', entity: { id: 'zone-a00001', name: 'core', x: -330, y: -210, w: 600, h: 420 } },
			{ op: 'put', kind: 'node', entity: { id: 'node-a00001', name: 'lb-1', type: 'loadbalancer', x: -240, y: -120 } },
			{ op: 'put', kind: 'node', entity: { id: 'node-a00002', name: 'db-1', type: 'host', x: 180, y: 180 } }] }));

		const inZone = JSON.parse(await run('place', 'server', 'inside', 'core', '--diagram', id, '--json'));
		assert.ok(inZone.at.x >= -330 && inZone.at.x <= 270, 'landed within the zone bounds');
		assert.ok(inZone.at.y >= -210 && inZone.at.y <= 210);

		await run('place', 'router', 'between', 'lb-1', 'db-1', '--link', '--name', 'spine', '--diagram', id);
		const spine = JSON.parse(await run('about', 'spine', '--diagram', id, '--json'));
		assert.equal(spine.neighbours.length, 2, 'standing between two things means linked to both');
		assert.deepEqual(spine.neighbours.sort(), ['node-a00001', 'node-a00002']);
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B120 -- every verb a message names is a verb that exists.

`add` told the caller to run `draw anchor nearest`, which did not exist. Worse than a vague
message: a reader who trusts it spends time discovering the tool lied, and then has reason to doubt
every other message it prints, including the ones that are right.

The instance is trivial to fix and the class is not. Nothing stops a rename leaving working code
pointing at a ghost, and only a human running the failing path would ever find out -- which is how
this one was found.
*/
test('B120: no message recommends a verb the tool does not have', () => {
	const src = fs.readFileSync('cli/verbs.mjs', 'utf8');
	// `help` is real but lives in the runtime rather than the manifest, so the guard must know the
	// same set of verbs a user does -- not only the ones this file happens to declare
	const names = new Set([...VERBS.map((v) => v.name), 'help']);
	const bad = [];
	// a recommendation has the shape `draw <word> <word>` inside a string literal
	for (const m of src.matchAll(/`draw ([a-z-]+)(?: ([a-z-]+))?/g)) {
		const [, one, two] = m;
		if (names.has(`${one} ${two}`) || names.has(one)) continue;
		bad.push(`draw ${one}${two ? ` ${two}` : ''}`);
	}
	assert.deepEqual([...new Set(bad)], [], 'these are named in messages and do not exist');
});

test('anchor nearest converts a pixel to the cell add will accept', async () => {
	await boot();
	try {
		const id = (await run('create', 'anchor-test')).trim();
		const a = JSON.parse(await run('anchor', 'nearest', '130', '60', '--diagram', id, '--json'));
		assert.deepEqual([a.cx, a.cy], [2, 1], '130,60 rounds to cell 2,1');
		assert.deepEqual([a.x, a.y], [120, 60], 'and back to a legal pixel');

		// the round trip the error message promises: pixels in, a cell add accepts out
		await run('lock', '--diagram', id);
		const placed = JSON.parse(await run('add', 'server', 'at', `${a.cx},${a.cy}`, '--diagram', id, '--json'));
		assert.deepEqual(placed.at, { x: a.x, y: a.y });

		// and the zone grid is a different answer for the same point, which is why --layout exists
		const z = JSON.parse(await run('anchor', 'nearest', '130', '60', '--layout', 'zone', '--diagram', id, '--json'));
		assert.notDeepEqual([z.x, z.y], [a.x, a.y], 'zones sit on the half-offset grid');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B119 -- a verb's declared method is the method it issues.

The manifest now carries `method`, and the coverage gate compares route AND method against
server/routes.mjs. A declaration that drifts from the handler would make that gate confidently
wrong -- it would report a pair covered by a verb that actually issues something else.
*/
test('B119: every request a verb issues is declared, in route or also', () => {
	/*
	A composite verb reads before it writes -- `place` fetches the document, asks which anchors are
	free, then commits -- so one route per verb was the wrong model. Declaring only the commit made
	the gate believe those reads were unreached; declaring only the first read made it believe
	nothing was written.
	*/
	const shape = (p) => String(p).replace(/^\//, '').split('?')[0]
		.replace(/\$\{[^}]+\}/g, '*').replace(/<[^>]+>|:[a-z]+/gi, '*');
	for (const v of VERBS) {
		const body = v.run.toString();
		const declared = new Set([`${v.method} ${shape(v.route)}`,
			...(v.also || []).map((a) => { const [m, p] = a.split(' '); return `${m} ${shape(p)}`; })]);
		// find the call, then read the method OUT of it -- an optional group after a lazy
		// quantifier is simply skipped, which reported every write as a GET
		/*
		A declared `*` is a WILDCARD, because that is what a placeholder means.

		Comparing it as a literal token made a verb that always uses one grid unable to satisfy both
		checks at once: `scan-cli` requires the declaration to match `server/routes.mjs`, which
		routes on `:name`, while this required it to match the issued path, which is the literal
		`node`. The declaration cannot be both strings. It can be the placeholder, and this side can
		read a placeholder as standing for whatever segment arrives -- which is the only reading
		under which the two checks are asking the same question.
		*/
		const matches = (key) => [...declared].some((d) => {
			const [dm, dp] = d.split(' ');
			const [km, kp] = key.split(' ');
			if (dm !== km) return false;
			const ds = dp.split('/'), ks = kp.split('/');
			return ds.length === ks.length && ds.every((seg, i) => seg === '*' || seg === ks[i]);
		});
		for (const m of body.matchAll(/request\(ctx, [`']([^`']+)[`']([^;]{0,200})/g)) {
			const verb = m[2].match(/method: '(POST|PUT|DELETE|PATCH)'/)?.[1] || 'GET';
			const key = `${verb} ${shape(m[1])}`;
			assert.ok(matches(key), `${v.name} issues ${key} and declares only ${[...declared].join(', ')}`);
		}
	}
});


/*
B133 -- the structural verbs, and the rules they take off the caller.

The reason these exist is not convenience. Before them, anything with a zone, a group, a routed
link or a move went through `commit --ops` as hand-authored entity JSON, which meant the CALLER
re-derived cell-to-pixel, the zone half-pitch offset, the `<kind>-<six hex>` id grammar and three
invariants. A 20-node topology built that way got two of them wrong on the first attempt. So what
is asserted here is that the TOOL owns each of those, not that the verb returns 200.
*/
test('B133: draw zone takes CELLS and owns the half-pitch offset', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'zonetest', '--json')).id;
		await run('context', id);
		await run('lock');
		const z = JSON.parse(await run('zone', 'site-a', 'from', '-15,-6', 'to', '-9,4', '--json'));
		/*
		The zone grid sits half a pitch off the node grid, so a zone bounding cells -15..-9 starts
		30 BEFORE the first cell centre and runs 60 past the last. These are the exact numbers a
		caller was computing by hand, and the reason the verb takes cells rather than a rectangle.
		*/
		assert.equal(z.x, -930, 'left edge is half a pitch before cell -15');
		assert.equal(z.y, -390, 'top edge is half a pitch before cell -6');
		assert.equal(z.w, 420, 'seven cells wide');
		assert.equal(z.h, 660, 'eleven cells tall');
		assert.match(z.id, /^zone-[0-9a-f]{6}$/, 'the id grammar is the tool\'s job');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('B133: draw link mints a waypoint per --via, and repeats accumulate', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'linktest', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'router', 'at', '-6,0', '--name', 'left');
		await run('add', 'router', 'at', '6,0', '--name', 'right');

		const one = JSON.parse(await run('link', 'left', 'right', '--via', '0,-2', '--json'));
		assert.equal(one.via.length, 1, 'one --via mints one waypoint');
		assert.match(one.via[0], /^waypoint-[0-9a-f]{6}$/);

		/*
		A REPEATED flag accumulates. `parseArgs` used to assign, so the second `--via` overwrote the
		first: the link drew one bend instead of two and reported success. Found by using the verb
		minutes after writing it, which is the argument for driving the tool rather than reading it.
		*/
		const two = JSON.parse(await run('link', 'left', 'right', '--via', '0,2', '--via', '2,2', '--json'));
		assert.equal(two.via.length, 2, 'two --via flags mint two waypoints, in order');
		assert.notEqual(two.via[0], two.via[1], 'and they are distinct waypoints');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('B133: a structural verb refuses a pixel where a cell belongs', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'celltest', '--json')).id;
		await run('context', id);
		await run('lock');
		// B110 ruled that the server REFUSES off-grid geometry rather than snapping it. The CLI's
		// job is to make the mistake unrepresentable, so the refusal names the unit, not the bound.
		// -900,-360 is a syntactically valid CELL, so the refusal cannot come from the format --
		// it comes from the anchor lookup, and it must name the UNIT rather than the bound.
		// `captureExit`, not assert.rejects: `die` exits the process, and a test that awaits a
		// rejection instead silently takes the whole FILE down with every subtest still green.
		const unit = await captureExit(() => run('zone', 'z', 'from', '-900,-360', 'to', '-540,240'));
		assert.match(unit, /look like pixels, and this takes a CELL/, 'the verb names the unit mistake, not just "outside"');
		assert.match(unit, /anchor nearest/, 'and offers the verb that converts them');

		// a malformed pair is refused on FORMAT, before any request is made
		const bad = await captureExit(() => run('zone', 'z', 'from', '1.5,2', 'to', '3,4'));
		assert.match(bad, /takes a CELL like/, 'a fractional cell never reaches the server');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
The verbs added after the first live rebuild, each because the rebuild could not proceed without it.

These are not speculative surface. Every one was written because a real attempt to reproduce a real
diagram through the tool stopped at it, which is a better specification than any amount of guessing
about what an agent might want.
*/
test('B133: draw panel owns the frame and takes content as data', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'paneltest', '--json')).id;
		await run('context', id);
		await run('lock');
		const f = path.join(home, 'regions.json');
		fs.writeFileSync(f, JSON.stringify([
			{ at: [0, 0], cols: 3, rows: 1, content: 'text', value: 'title', align: 'center' },
			{ at: [0, 1], cols: 1, rows: 1, content: 'glyph', glyph: 'router' },
		]));
		const p = JSON.parse(await run('panel', 'key', 'at', '-10,-6', '--cols', '3', '--rows', '2', '--content', f, '--json'));
		assert.deepEqual(p.span, { cols: 3, rows: 2 }, 'the frame is the verb\'s job');
		assert.equal(p.regions, 2, 'the content came from the file, unflattened');

		// the split is the point: geometry is validated by the verb, content is passed through
		const bad = await captureExit(() => run('panel', 'x', 'at', '-8,-6', '--cols', '0', '--rows', '2'));
		assert.match(bad, /at least 1/, 'a degenerate span is refused locally');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('B133: a ring is a source and the bends that return to it', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'ringtest', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'vxlan', 'at', '0,-3', '--name', 'overlay');

		/*
		`closed` means "loop dst back to src", so a ring needs a dst that is NOT the source -- and in
		a ring that dst is a waypoint the caller has not created. Requiring them to name it would put
		waypoint minting back on the caller, which is the defect this verb exists to close. So the
		last bend becomes the destination.
		*/
		const r = JSON.parse(await run('link', 'overlay', '--closed', '--via', '-2,-1', '--via', '0,1', '--via', '2,-1', '--json'));
		assert.equal(r.closed, true);
		assert.equal(r.via.length, 2, 'three bends: two are the route, the last is the destination');
		assert.match(r.dst, /^waypoint-/, 'and the destination is a minted waypoint, not a node the caller had to make');

		const thin = await captureExit(() => run('link', 'overlay', '--closed', '--via', '4,-1'));
		assert.match(thin, /at least two --via/, 'a one-bend ring would draw a line back over itself');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('GR18: a refusal names a verb the caller has, never a route to call directly', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'locktest', '--json')).id;
		await run('context', id);
		/*
		The server answers a lost write slot with "not server-locked -- POST /api/v1/.../lock first",
		which is right for an HTTP client and exactly wrong for this one: it tells an agent driving
		`draw` to go around `draw`. A tool whose own error recommends the thing GR18 forbids has lost
		that argument before the agent even reads it.
		*/
		// No token at all is the CLI's OWN check, and it already said the right thing. The path that
		// relays the server is a STALE token: one the tool holds and the server rejects. The first
		// version of this test used the no-token case, passed, and stayed green when the translation
		// was deleted -- a test that looks like it covers a rule and covers the rule next to it.
		const mine = await captureExit(() => run('add', 'server', 'at', '0,0'));
		assert.match(mine, /draw lock/, 'with no token the tool answers for itself');

		fs.mkdirSync(path.join(home, '.config/draw/locks'), { recursive: true });
		fs.writeFileSync(path.join(home, '.config/draw/locks', id), 'stale-token-that-the-server-will-refuse');
		const relayed = await captureExit(() => run('add', 'server', 'at', '0,0'));
		assert.match(relayed, /draw lock/, 'the refusal names the verb that fixes it');
		assert.doesNotMatch(relayed, /POST |curl|\/api\/v1\//,
			'and never a raw route -- the server says "POST /api/v1/.../lock first" and that must not reach an agent driving the tool');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('select resolves names, like every other structural verb', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'seltest', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'router', 'at', '-4,0', '--name', 'core-1');
		await run('add', 'router', 'at', '4,0', '--name', 'core-2');
		// it took ids only, so `draw select core-1` failed while `draw link core-1 core-2` beside it
		// resolved the same word -- one verb in a family behaving differently reads as a typo
		const out = await run('select', 'core-1', 'core-2', '--json');
		assert.equal(JSON.parse(out).selection.length, 2, 'names resolve to ids');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B135 -- the lock and context stores obey the INJECTED environment.

`main(argv, env, out)` accepts an env so the tool can be driven as a library, and `tokenFile()` and
`ctxFile()` read `process.env.HOME` instead. Every test therefore wrote into the developer's real
home: 812 token files had collected in a directory no test cleaned, because no test knew it was
being used. Isolation the harness advertised and did not have.

Asserted on the FILESYSTEM rather than on behaviour, deliberately. A behavioural test passes either
way -- the tool finds a token in whichever home it looked in and carries on -- which is exactly how
this survived. The only observable that distinguishes the two is where the bytes land.
*/
test('B135: the lock token lands under the injected HOME, not the real one', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'hometest', '--json')).id;
		await run('context', id);
		await run('lock');

		const mine = path.join(home, '.config/draw/locks', id);
		assert.ok(fs.existsSync(mine), `the token belongs under the injected HOME (${mine})`);
		assert.ok(fs.readFileSync(mine, 'utf8').trim().length > 0, 'and it is a real token, not an empty file');

		// the context file too -- same bypass, same fix
		assert.ok(fs.existsSync(path.join(home, '.config/draw/context')), 'the context store obeys it as well');

		// and nothing was written to the real home for this diagram
		const real = path.join(process.env.HOME || '/nonexistent', '.config/draw/locks', id);
		assert.equal(fs.existsSync(real), false, 'and the developer\'s home is untouched');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B136 -- the token store shrinks as well as grows.

`writeToken(.., null)` removed a file on an explicit `draw unlock`, which is the case that rarely
happens. The two that do are the lock LAPSING after about a minute and the diagram being DELETED,
and neither removed anything: 837 files had collected on the first machine to be measured, 835 of
them naming diagrams that no longer existed.

The cost was never disk. A token that outlives its lock is still sent, so the server answers 423 and
the tool relays "not server-locked" when the truth is "your lock lapsed" -- a state the tool could
have known, because the lock response has carried `expiresAt` since B102.
*/
test('B141: a token past its local deadline is still SENT -- the server adjudicates', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'ttl', '--json')).id;
		await run('context', id);
		await run('lock');

		const f = path.join(home, '.config/draw/locks', id);
		const held = JSON.parse(fs.readFileSync(f, 'utf8'));
		assert.ok(held.token, 'the token is stored');
		assert.equal(typeof held.expiresAt, 'number', 'with the epoch-millisecond deadline the server sent');

		/*
		B136 taught this to discard a token whose deadline had passed, and B141 is why that was
		wrong. `expiresAt` is minted by the SERVER and was compared against `Date.now()` here, so a
		few seconds of clock skew made the tool bin a token the server still honoured, send nothing,
		and collect a 409 reported as "another controller" -- the reading least likely to be true.

		Wind the local copy into the past. The lock on the server is untouched and still live, so
		the write must SUCCEED: the deadline is the server's business and the tool does not guess.
		*/
		fs.writeFileSync(f, JSON.stringify({ token: held.token, expiresAt: Date.now() - 60_000 }));
		const out = await run('add', 'server', 'at', '0,0', '--name', 'skewed', '--json');
		assert.match(out, /skewed|node-/, 'the write went through on a token the local clock called dead');
		assert.ok(fs.existsSync(f), 'and the token was not thrown away on the strength of a local guess');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('B141: when the server DOES refuse, the tool still answers in its own vocabulary', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'refused', '--json')).id;
		await run('context', id);
		fs.mkdirSync(path.join(home, '.config/draw/locks'), { recursive: true });
		// a token the server has never issued: the refusal is now genuinely the server's to make
		fs.writeFileSync(path.join(home, '.config/draw/locks', id),
			JSON.stringify({ token: 'never-issued', expiresAt: Date.now() + 60_000 }));
		const err = await captureExit(() => run('add', 'server', 'at', '0,0'));
		assert.match(err, /draw lock/, 'named as a verb the caller has');
		assert.doesNotMatch(err, /POST |\/api\/v1\//, 'never as a route to call directly');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('B136: a token for a deleted diagram is pruned, unexpired or not', async () => {
	await boot();
	try {
		const keep = JSON.parse(await run('create', 'keeper', '--json')).id;
		await run('context', keep);
		await run('lock');

		// a perfectly valid token for a diagram that does not exist. readToken cannot catch this --
		// it is not expired -- which is why pruning is a separate rule and not a stricter read.
		const dir = path.join(home, '.config/draw/locks');
		const ghost = path.join(dir, 'diagram-dead01');
		fs.writeFileSync(ghost, JSON.stringify({ token: 'still-valid', expiresAt: new Date(Date.now() + 600000).toISOString() }));
		assert.equal(fs.existsSync(ghost), true);

		await run('diagrams');   // any verb that lists is the free moment to prune
		assert.equal(fs.existsSync(ghost), false, 'the orphan went');
		assert.equal(fs.existsSync(path.join(dir, keep)), true, 'and the live one stayed');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B136 -- the invariant, stated exactly: a lock file exists for the duration of its lock, and at most
until the next `draw` command.

The weaker version reads identically at a glance and is what shipped. `readToken` only inspects the
token for the diagram in hand, so a lock taken on A and left to lapse survived every later command
about B -- and the lapse is the NORMAL path, because a whole session went by without `draw unlock`
being called once.

A stateless tool cannot do better than this. Nothing of ours runs while the agent is idle, so a lock
that lapses at 12:00:30 cannot delete its own file then. What it can guarantee is that no command
ever runs alongside a dead one.
*/
test('B136: a lapsed token does not survive the next command, whatever that command is', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'sweep', '--json')).id;
		await run('context', id);
		await run('lock');
		const dir = path.join(home, '.config/draw/locks');
		const f = path.join(dir, id);

		/*
		A lock on a DIFFERENT diagram, lapsed well past the housekeeping grace. `readToken` would
		never look at this one -- it only ever inspects the diagram in hand -- which is why the
		sweep exists at all.

		Past the GRACE, not merely past the deadline: B141 widened the sweep's margin because
		deleting on the exact deadline let a skewed clock race a live lock. Housekeeping only has to
		stop the store growing, so it can afford to be late and must not be early.
		*/
		const other = path.join(dir, 'diagram-other1');
		fs.writeFileSync(other, JSON.stringify({ token: 'lapsed', expiresAt: Date.now() - 2 * 60 * 60 * 1000 }));

		// and one lapsed only a moment ago SURVIVES, because that is the skew window
		const recent = path.join(dir, 'diagram-recent');
		fs.writeFileSync(recent, JSON.stringify({ token: 'just-lapsed', expiresAt: Date.now() - 1000 }));
		// and a file predating the format, which can never be valid again
		fs.writeFileSync(path.join(dir, 'diagram-legacy'), 'bare-token-from-before-the-rule');

		// `help` is the strongest case: no server, no credential, nothing to be early for. The sweep
		// sat AFTER the help branch at first, which made the guarantee "every command except the
		// ones that return early" -- the almost-true kind this codebase keeps finding under defects.
		await run('help');

		assert.equal(fs.existsSync(other), false, 'a long-lapsed token for another diagram went');
		assert.ok(fs.existsSync(recent), 'while one just past its deadline stayed -- the sweep must never race a live lock');
		assert.equal(fs.existsSync(path.join(dir, 'diagram-legacy')), false, 'and so did an unparseable one');
		assert.ok(fs.existsSync(f), 'while the LIVE lock is untouched -- the sweep judges dead, not present');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B135/B136 -- no HOME means no store, and no reaching around for one.

`homeOf` was written as `ctx?.env?.HOME || process.env.HOME`, and the fallback looks harmless: real
use always supplies an env, because `main` defaults it to `process.env`. What it actually did was
reinstate B135 for any caller passing a PARTIAL env -- a test passing `{}` resolved straight back to
the developer's real home and swept it.

Every other test here sets HOME, so none of them could see it: reintroducing the fallback left the
whole suite green. The only observable that distinguishes the two is what happens when HOME is
ABSENT, so that is what this drives.
*/
test('B135: with no HOME in the injected env, the real home is never touched', async () => {
	const canary = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-canary-'));
	const realHome = process.env.HOME;
	try {
		// point the process at a canary and plant a token the sweep WOULD delete if it looked here
		process.env.HOME = canary;
		const locks = path.join(canary, '.config/draw/locks');
		fs.mkdirSync(locks, { recursive: true });
		const dead = path.join(locks, 'diagram-canary');
		fs.writeFileSync(dead, JSON.stringify({ token: 'x', expiresAt: Date.now() - 1 }));

		const out = [];
		await main(['help'], {}, (s) => out.push(s));   // an env with no HOME at all

		assert.ok(fs.existsSync(dead),
			'a command given no HOME must not fall back to process.env.HOME and sweep it');
		assert.ok(out.join('').length > 0, 'and the command still did its job');
	} finally {
		process.env.HOME = realHome;
		fs.rmSync(canary, { recursive: true, force: true });
	}
});

/*
GR18 -- the verb list in CLI.md is DERIVED, and checked.

It drifted for two milestones with nothing to notice. The block advertised a `push` verb for Slides,
which had been purged in both phases, and an `agents` verb whose real name is `who`, while omitting
nine that existed -- `about`, `zone contents`, `link path`, `panel`, `near`, `place`, `access`,
`workspace grants`, `workspace revoke`. Three of those were written the same day the doc was last
edited.

CLI.md's own next section rules that the tool must not mirror the API, and the manifest exists so
dispatch, help, coverage and the docs read one declaration. The docs were the consumer that never
actually read it. This is that missing edge, and it is a set comparison rather than prose matching:
what the manifest declares and what the document lists must be the same names.
*/
test('GR18: CLI.md lists exactly the verbs the manifest declares', () => {
	const doc = fs.readFileSync(new URL('../docs/spec/CLI.md', import.meta.url), 'utf8');
	const section = doc.split('## The verbs')[1];
	assert.ok(section, 'CLI.md still has a verb section');
	const block = section.split('```text')[1].split('```')[0];

	// a verb line is indented; a group heading is not. The name is the longest manifest verb name
	// the line starts with, because a usage line carries arguments after it.
	const names = new Set(VERBS.map((v) => v.name));
	const listed = new Set();
	for (const line of block.split('\n')) {
		if (!/^ {2}\S/.test(line)) continue;
		const text = line.trim();
		let best = null;
		for (const n of names) if (text === n || text.startsWith(`${n} `)) { if (!best || n.length > best.length) best = n; }
		assert.ok(best, `CLI.md lists "${text.split('  ')[0]}", which is not a verb the manifest declares`);
		listed.add(best);
	}
	const missing = [...names].filter((n) => !listed.has(n)).sort();
	assert.deepEqual(missing, [], `CLI.md omits ${missing.length} verb(s) the tool has`);
	assert.equal(listed.size, VERBS.length, 'and lists no more than it has');
});

/*
B138 -- the tool is executed as a PROGRAM, through a SYMLINK, which is how it is installed.

Every other test in this file imports `main` and calls it. That is deliberate and stated at the top
-- it asserts behaviour rather than formatting -- but it means not one of them runs the file the way
a user does, and this is what that cost.

`import.meta.url === \`file://${process.argv[1]}\`` fails through a link, because argv[1] is the LINK
and import.meta.url is the TARGET. `main` was never called. The process printed nothing and exited
0, so it looked like a tool with no output rather than a tool that never ran, and `draw` had been
uninvokable by both documented installations -- README's `ln -s` and the Dockerfile's -- since the
CLI was rewritten. 594 tests were green throughout.

So this one shells out on purpose. It is the only test here that does, and the reason is that a
subprocess through a link is the only arrangement in which the defect exists.
*/
test('B138: `draw` runs when invoked through a symlink, as both installers create it', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-link-'));
	try {
		const target = path.join(root, 'cli/draw.mjs');
		const link = path.join(dir, 'draw');
		fs.symlinkSync(target, link);

		// no --host: `help` is offline, which keeps this about invocation and nothing else
		const viaLink = execFileSync(link, ['help'], { encoding: 'utf8', env: { ...process.env } });
		assert.match(viaLink, /draw <verb>/, 'the help came out -- main actually ran');
		assert.match(viaLink, /Writing/, 'and it is the real help, not a stub');

		// the direct invocation must keep working too, since that is what the tests use
		const direct = execFileSync(process.execPath, [target, 'help'], { encoding: 'utf8' });
		assert.equal(viaLink, direct, 'a link and the real path produce identical output');

		/*
		A space in the TARGET's path, not the link's -- and the distinction is the point.

		`realpathSync` resolves a link to its target, so a space in the link is irrelevant: the
		first version of this put the link under `my tools/` and passed against the naive
		`file://${path}` form, testing nothing. What breaks that form is the RESOLVED path
		containing a character a URL must encode, so the CLI has to be copied somewhere spaced.
		*/
		const spaced = path.join(dir, 'my tools', 'cli');
		fs.mkdirSync(spaced, { recursive: true });
		for (const f of ['draw.mjs', 'verbs.mjs']) fs.copyFileSync(path.join(root, 'cli', f), path.join(spaced, f));
		const spacedTarget = path.join(spaced, 'draw.mjs');
		fs.chmodSync(spacedTarget, 0o755);
		assert.match(execFileSync(spacedTarget, ['help'], { encoding: 'utf8' }), /draw <verb>/,
			'a space in the resolved path does not silence it');

		const spacedLink = path.join(dir, 'draw-spaced');
		fs.symlinkSync(spacedTarget, spacedLink);
		assert.match(execFileSync(spacedLink, ['help'], { encoding: 'utf8' }), /draw <verb>/,
			'nor does a link to a spaced path');
	} finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/*
The zone boxes are drawn in the GUTTERS, and never at the cost of a cell.

The zone grid sits half a pitch off the node grid, so a zone edge falls exactly between two cells --
which is where the two-column layout already leaves a space. That makes the borders geometrically
exact rather than approximate, and it is the whole reason they can be added without widening the
map or shifting a column.

The assertion is chosen so it does NOT restate the layout arithmetic. Recomputing which columns are
cells and which are gutters would be the same sum twice, and the second copy is the one that goes
wrong. Instead: render with and without the boxes and require that every row carries the identical
number of CELL characters. If a border ever consumed a cell, that count drops, whatever the
arithmetic happens to be.
*/
const CELLS = /[.rflshv+#]/g;

test('map: a zone box never costs a cell, and lands only in the gutters', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'boxes', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'router', 'at', '-2,-1', '--name', 'r1');
		await run('add', 'server', 'at', '2,1', '--name', 's1');
		await run('zone', 'pen', 'from', '-3,-2', 'to', '3,2');

		const withBox = (await run('map')).split('\n');
		const without = (await run('map', '--no-zones')).split('\n');

		const cellsPerRow = (lines) => lines
			.filter((l) => /^\s*-?\d+\s/.test(l))
			.map((l) => (l.match(CELLS) || []).length);
		assert.deepEqual(cellsPerRow(withBox), cellsPerRow(without),
			'the same cells are shown either way -- a border never overwrites one');
		assert.ok(cellsPerRow(withBox).length > 0, 'and there were rows to compare');

		// the box itself
		assert.ok(withBox.some((l) => l.includes('\u250c') && l.includes('pen') && l.includes('\u2510')),
			'a top edge carries the zone name between its corners');
		assert.ok(withBox.some((l) => l.includes('\u2514') && l.includes('\u2518')), 'and a bottom edge closes it');

		/*
		The members must LINE UP with the corners, and this is the assertion that earns its place.

		The cell-count check above cannot see a border drawn on a cell column, because cells are
		painted after the borders and simply overwrite one -- so a misplaced side vanishes on every
		cell row while still appearing on the border rows, and the box comes out ragged rather than
		wrong. Comparing the columns catches exactly that: a side that is not under its own corner.
		*/
		const colsOf = (line, re) => [...line].map((c, i) => (re.test(c) ? i : -1)).filter((i) => i >= 0);
		const top = withBox.find((l) => l.includes('\u250c'));
		const corners = colsOf(top, /[\u250c\u2510]/);
		assert.equal(corners.length, 2, 'the top edge has both corners');

		/*
		Count the bordered rows BEFORE comparing their columns.

		The first version iterated the rows containing a side and asserted their alignment, which
		passes trivially when there are none -- and there are none precisely in the failure being
		hunted: a side placed on a cell column is overwritten by the glyph painted after it, so it
		disappears from every cell row and the loop runs zero times. A vacuous pass, in the test
		written to catch the defect. The expected count comes from the model's own report of the
		zone's cell range, so it is read rather than recomputed.
		*/
		const zone = JSON.parse(await run('map', '--json')).zones.find((z) => z.name === 'pen');
		const rows = withBox.filter((l) => /^\s*-?\d+\s/.test(l) && l.includes('\u2502'));
		assert.equal(rows.length, zone.cells.y1 - zone.cells.y0 + 1,
			'every row the zone spans carries its sides -- none of them silently overwritten');
		for (const row of rows) {
			assert.deepEqual(colsOf(row, /\u2502/), corners,
				'and each side sits directly under a corner -- the box is square, not ragged');
		}

		// suppression is total, not partial
		assert.equal(without.join('').match(/[\u2500-\u257f]/g), null, '--no-zones leaves no box drawing at all');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('map: a zone running past the window keeps its sides and drops the corner', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'clip', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'router', 'at', '0,0', '--name', 'mid');
		await run('zone', 'big', 'from', '-6,-6', 'to', '6,6');

		// a window strictly inside the zone: the sides must still show, and neither horizontal edge
		// belongs here -- a corner drawn at the crop would claim the zone ends where the view does
		const tight = (await run('map', '--around', 'mid', '--radius', '2')).split('\n');
		assert.ok(tight.some((l) => l.includes('\u2502')), 'the sides continue through the window');
		assert.equal(tight.join('').includes('\u250c'), false, 'no top corner: the zone does not start here');
		assert.equal(tight.join('').includes('\u2518'), false, 'and no bottom corner either');

		/*
		And the case the first version of this test could not reach: clipped SIDEWAYS while a
		horizontal edge IS in view. Above, the zone's top and bottom are both outside the window, so
		no border row is emitted at all and the corner rule is never consulted -- the assertions
		passed without exercising anything. A wide, shallow zone puts its top edge inside the window
		and both vertical sides outside it, which is the only arrangement that asks the question.
		*/
		await run('zone', 'wide', 'from', '-6,-1', 'to', '6,1');
		const shallow = (await run('map', '--around', 'mid', '--radius', '2')).split('\n');
		const edge = shallow.find((l) => l.includes('\u2500') && l.includes('wide'));
		assert.ok(edge, 'the top edge of the wide zone is drawn, name and all');
		assert.equal(/[\u250c\u2510\u2514\u2518]/.test(edge), false,
			'and carries NO corner, because neither side of it is in view');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B143 -- a verb that takes an entity reference resolves NAMES.

`resolveId` exists so a caller can say `site-a` instead of `zone-629f3e`, and it was applied verb by
verb as a habit rather than as a rule. Two contextual verbs interpolated `args[0]` straight into a
URL, so `draw zone contents site-a` answered *unknown zone* while `draw about a-lb` beside it
resolved the same kind of word without comment. `place` was worse in kind: it resolved names inline
at four sites, a fourth copy of the rule, and three of those copies had lost `resolveId`'s refusal
of an ambiguous name -- two entities sharing one silently picked the first.

Static, like the flag and argument audits above it, because the point is that the NEXT verb cannot
ship id-only. A behavioural test would cover the three that exist today and nothing after them.
*/
test('GR18/B143: every verb taking an entity reference resolves it by name', () => {
	// an argument naming a thing rather than a literal, a coordinate or a value
	const REFERENCE = /^(ref|entity|zone|link|panel|node|group|waypoint)(-id)?(\.\.\.)?$/;
	/*
	Resolution counts whether it happens in the verb or in a helper the verb calls.

	The first version looked for `resolveId(` in the verb body alone, and flagged three verbs that
	resolve perfectly well one level down -- a check narrower than its own claim, which is the fault
	it exists to catch. Following one level of indirection is the fix; naming the helper as an
	exception would have been the same mistake as exempting `select` by name.
	*/
	const src = fs.readFileSync(new URL('../cli/verbs.mjs', import.meta.url), 'utf8');
	const helpers = new Map();
	for (const m of src.matchAll(/(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g)) {
		const start = m.index + m[0].length;
		let depth = 1, i = start;
		while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
		helpers.set(m[1], src.slice(start, i));
	}
	const resolves = (body, seen = new Set()) => {
		if (/resolveId\(/.test(body)) return true;
		for (const [name, source] of helpers) {
			if (seen.has(name) || !new RegExp(`\\b${name}\\s*\\(`).test(body)) continue;
			seen.add(name);
			if (resolves(source, seen)) return true;
		}
		return false;
	};
	const gaps = [];
	for (const v of VERBS) {
		const refs = (v.args || []).filter((a) => REFERENCE.test(a.name));
		if (!refs.length) continue;
		if (!resolves(v.run.toString())) {
			gaps.push(`${v.name}: takes ${refs.map((r) => r.name).join(', ')} and never reaches resolveId`);
		}
	}
	assert.deepEqual(gaps, [], `these accept ids only:\n  ${gaps.join('\n  ')}`);
});

test('B143: zone contents and link path take a name, and refuse the wrong kind by saying what it is', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'byname', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'router', 'at', '-2,-1', '--name', 'r1');
		await run('add', 'server', 'at', '2,1', '--name', 's1');
		await run('zone', 'pen', 'from', '-3,-2', 'to', '3,2');

		const inside = await run('zone', 'contents', 'pen', '--json');
		const names = JSON.parse(inside).contents.map((c) => c.name).sort();
		assert.deepEqual(names, ['r1', 's1'], 'the zone is found by NAME and reports what it holds');

		// and a reference of the wrong kind is told what it actually is, rather than 404ing
		const wrong = await captureExit(() => run('zone', 'contents', 'r1'));
		assert.match(wrong, /is a node, not a zone/, 'the refusal names the kind it got');
		assert.match(wrong, /draw about r1/, 'and offers the verb that would describe it');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
Walking: a focus, and relations read from it.

`about` answers everything at once, which is right for "tell me about this" and wrong for moving
around. A walk is a sequence of narrow questions where each answer decides the next step, and
re-naming the subject every time means carrying it between commands.

What is asserted is the property that makes the state safe rather than the convenience it buys:
every relation verb NAMES the subject it used, and the focus does not survive a change of diagram.
Hidden state answering confidently about the wrong thing is the failure this codebase keeps finding;
a focus is only worth having if it cannot do that.
*/
test('walk: relation verbs read the focus, and always say what they read', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'walk', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'loadbalancer', 'at', '0,0', '--name', 'lb');
		await run('add', 'server', 'at', '2,0', '--name', 'web-1', '--link', 'lb');
		await run('add', 'server', 'at', '4,0', '--name', 'web-2', '--link', 'lb');
		await run('group', 'tier', 'web-1', 'web-2');
		await run('zone', 'dc', 'from', '-1,-1', 'to', '5,1');

		await run('focus', 'web-1');
		const held = await run('holds');
		assert.match(held, /web-1 is held by/, 'the subject is named even though it was not passed');
		assert.match(held, /zone\s+dc/, 'containment upward -- the inverse of `zone contents`');
		assert.match(held, /group\s+tier/);

		const peers = await run('peers');
		assert.match(peers, /linked\s+lb/, 'one hop along a link');
		assert.match(peers, /grouped\s+web-2/, 'and a sibling in the same group, which is a peer too');

		const links = await run('links');
		assert.match(links, /links of web-1/);
		assert.match(links, /lb/, 'the OTHER end is what a walk wants, not the link id alone');

		// naming the entity explicitly must beat the focus, or the argument is decoration
		assert.match(await run('holds', 'lb'), /lb is held by/, 'an explicit reference wins');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('walk: a focus does not survive a change of diagram', async () => {
	await boot();
	try {
		const a = JSON.parse(await run('create', 'walk-a', '--json')).id;
		await run('context', a);
		await run('lock');
		await run('add', 'router', 'at', '0,0', '--name', 'only-in-a');
		await run('focus', 'only-in-a');
		assert.match(await run('holds'), /only-in-a/, 'the focus works where it was set');

		/*
		An entity id means nothing outside the diagram that minted it. Unscoped, this answered
		`unknown entity: node-...` on the other diagram -- a real refusal, but one that blames the
		entity instead of saying the focus does not belong here. Scoped, it simply does not apply.
		*/
		const b = JSON.parse(await run('create', 'walk-b', '--json')).id;
		const err = await captureExit(() => run('holds', '--diagram', b));
		assert.match(err, /focus in THIS diagram/, 'the refusal names the real reason');
		assert.doesNotMatch(err, /unknown entity/, 'and does not blame an entity that was never asked for');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B144 -- `about` answers in names, and a group's links have the same shape as everyone else's.
*/
test('B144: about names its relations, and a group does not print undefined', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'named', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'loadbalancer', 'at', '0,0', '--name', 'lb');
		await run('add', 'server', 'at', '2,0', '--name', 'web-1', '--link', 'lb');
		await run('add', 'server', 'at', '4,0', '--name', 'web-2', '--link', 'lb');
		await run('group', 'tier', 'web-1', 'web-2');
		await run('zone', 'dc', 'from', '-1,-1', 'to', '5,1');

		const node = await run('about', 'web-1');
		assert.match(node, /zones\s+dc/, 'a zone by name');
		assert.match(node, /group\s+tier/, 'a group by name');
		assert.match(node, /neighbours\s+lb/, 'a neighbour by name');
		// the header legitimately carries the entity's own id; the RELATION rows must not
		const relations = node.split('\n').filter((l) => /^(zones|group|neighbours|links)\s/.test(l.trim()));
		assert.ok(relations.length >= 3, 'the relations were found');
		assert.equal(relations.join(' ').match(/node-[0-9a-f]{6}/), null, 'and none of them shows a bare id');

		// the group branch returned bare ids where the node branch returned objects, so one field
		// name carried two shapes and the renderer printed `undefined` four times
		const group = await run('about', 'tier');
		assert.doesNotMatch(group, /undefined/, 'a group reports its links like anything else');
		assert.match(group, /lb/, 'and names the far end');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
A5 Perceptual Parity, measured rather than assumed -- B145.

The axiom asks for two things and this codebase had only built one. Synthetic Sensory Organs -- the
instruments an agent uses to perceive its own output -- are `map`, `render --summary` and the
walking verbs. Measured Parity is the other, and it is the one that makes the first verifiable:
"the delta is itself measured and held within an explicitly-defined bound; symmetry is a verified
property, not an aspiration".

Three views produced by three different code paths must agree. The test drives a real disagreement
rather than a clean case, because a parity check that has only ever seen parity is the same kind of
claim it exists to refute.
*/
test('A5/B145: parity holds across model, render and map -- and fails loudly when it cannot', async () => {
	await boot();
	try {
		const id = JSON.parse(await run('create', 'parity', '--json')).id;
		await run('context', id);
		await run('lock');
		await run('add', 'router', 'at', '-2,0', '--name', 'r1');
		await run('add', 'server', 'at', '2,0', '--name', 's1');
		await run('link', 'r1', 's1', '--via', '0,-2');
		await run('zone', 'z', 'from', '-3,-3', 'to', '3,3');

		const clean = JSON.parse(await run('parity', '--json'));
		assert.equal(clean.parity, true, 'a diagram the tool built agrees with itself');
		assert.deepEqual(clean.deltas, [], 'and the bound is zero, not "small"');

		// every kind is compared, or the check is a claim about a subset. `render --summary` shipped
		// omitting waypoints and reported 20 elements where the map showed 27 occupied anchors --
		// exactly the disagreement this exists to catch, and it was caught by eye.
		const compared = clean.rows.map((r) => r[0]);
		for (const kind of ['nodes', 'waypoints', 'links', 'zones', 'on an anchor']) {
			assert.ok(compared.includes(kind), `${kind} is compared, not assumed`);
		}
		const waypoints = clean.rows.find((r) => r[0] === 'waypoints');
		assert.equal(waypoints[1], 1, 'the model holds the minted waypoint');
		assert.equal(waypoints[2], 1, 'and the render drew it -- the omission that started this');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
And the rule driven from the FAILING side, which is the half the end-to-end test cannot reach.

A diagram the tool has just built agrees with itself by construction, so a test that only sees that
case stays green when either half of the comparison is deleted -- which is exactly what happened,
in a test whose own comment warned against it. `parityOf` is exported so a disagreement can be
handed to it directly.
*/
test('A5/B145: the parity rule reports a disagreement from either side', () => {
	const model = { nodes: 20, waypoints: 7, links: 20, zones: 3 };

	const agree = parityOf(model, { nodes: 20, waypoints: 7, links: 20, zones: 3 }, 27);
	assert.deepEqual(agree.deltas, [], 'three views of one diagram, agreeing');

	// the exact defect that shipped: the renderer drops waypoints and nothing notices
	const dropped = parityOf(model, { nodes: 20, waypoints: 0, links: 20, zones: 3 }, 27);
	assert.equal(dropped.deltas.length, 1, 'a render that omits a kind is a disagreement');
	assert.match(dropped.deltas[0], /waypoints: the model holds 7, the render drew 0/);

	// and the other direction: the canvas an agent places against disagrees with the document
	const stale = parityOf(model, { nodes: 20, waypoints: 7, links: 20, zones: 3 }, 25);
	assert.equal(stale.deltas.length, 1, 'a map showing fewer occupants is a disagreement too');
	assert.match(stale.deltas[0], /on an anchor: the model holds 27, the map shows 25/);

	// both at once, because a single-fault check is a claim about one fault
	const both = parityOf(model, { nodes: 19, waypoints: 7, links: 20, zones: 3 }, 25);
	assert.equal(both.deltas.length, 2, 'each disagreement is reported, not just the first');
});

/*
B132 -- `draw health` reaches a route that exists, and a verb cannot declare one that does not.

The verb had never worked in ANY configuration. It asks for `<prefix>/health` like every other verb,
`server/routes.mjs` declared `health` as prefix-relative, and the server implemented it only at the
root -- so the declaration was right, the request was right, and the route was missing. The prover
that checks every declared route papered over it by special-casing this one entry to the root, so it
proved a different route from the one declared. `scan-cli` counted the pair covered because the verb
DECLARED it: a declaration checked against a declaration, which is B119 one level up.
*/
test('B132: draw health answers through the same door as every other verb', async () => {
	await boot();
	try {
		const out = JSON.parse(await run('health', '--json'));
		assert.match(out.status, /^(ok|degraded|corrupt)$/, 'a real report, not a 404');
		assert.equal(typeof out.diagrams, 'number');
		assert.equal(typeof out.invariantFailures, 'number', 'B20 distinguishes corrupt from degraded');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('B132: the root liveness probe stays uncredentialed, and stays out of ROUTES', async () => {
	await boot();
	try {
		// Cloud Run and the Dockerfile probe the root path, so it must never start needing a
		// credential. It is deliberately absent from ROUTES, which declares prefix-relative paths.
		const root = await fetch(`${host}/health`);
		assert.equal(root.status, 200, 'the liveness contract is intact');
		assert.equal((await root.json()).status, 'ok');

		const { ROUTES } = await import('../server/routes.mjs');
		assert.equal(ROUTES.some((r) => r.path === '/health'), false,
			'and the root path is not declared as though it were part of the versioned surface');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B109 -- the delete window, and the answer a filesystem must give.

`DELETE` has felt final since H9.21 because nothing said otherwise, while the deployment's bucket
has carried seven days of retention the whole time. The distinction that matters most here is not
the list: it is that "no window at all" and "a window with nothing in it" are different facts, and
a surface that collapses them tells a person their work is gone when nobody has looked.

These run on the filesystem backend, which is the `null` case -- so what is asserted is that the
tool says so rather than reassuring.
*/
test('B109: with no delete window, the tool says so instead of reporting nothing to restore', async () => {
	await boot();
	try {
		const out = await run('deleted');
		assert.match(out, /no delete window/, 'the honest answer, not "nothing recoverable"');
		assert.doesNotMatch(out, /nothing in the delete window/, 'which would be reassurance a filesystem cannot give');

		const j = JSON.parse(await run('deleted', '--json'));
		assert.equal(j.window, false, 'and the fact is carried structurally, not only in prose');
		assert.deepEqual(j.deleted, []);
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test('B109: restore refuses a name, because a deleted diagram has none to resolve', async () => {
	await boot();
	try {
		/*
		Alone among the reference-taking verbs, this one takes an id only. `resolveId` resolves
		against a live document and every entry in the window is one that is not there. Names are
		also not unique across it -- deleting two diagrams called `scratch` is ordinary -- so
		picking one silently would be the worst available behaviour on a recovery surface.
		*/
		const err = await captureExit(() => run('restore', 'scratch'));
		assert.match(err, /diagram id like diagram-/, 'it says what shape it wants');
		assert.match(err, /two may share one/, 'and why a name will not do');
		assert.match(err, /draw deleted/, 'and where to find the ids');

		const gone = await captureExit(() => run('restore', 'diagram-aaaaaa'));
		assert.match(gone, /no delete window|nothing recoverable/, 'a well-formed id still refuses honestly here');
	} finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

/*
B160 / H10.31 -- a throttle is waited out, not reported as a broken credential.

The agent door is deliberately outside IAP, so it carries a rate limit. Cloud Armor answers a
request over the rate with a 429 whose body is not JSON, and `request()` used to read any non-JSON
body as an IAP sign-in page and die with *is a credential needed?* -- the right guess for the case
it was written for and the wrong one here. The agent was told to check a credential that was fine,
about a condition that clears by waiting.

Driven against a fake edge rather than the real one, because the property under test is what the
CLI does with a 429, and standing up Cloud Armor to find out would test Google's product instead.
*/
test('B160: an edge 429 is retried, announced, and eventually succeeds', async () => {
	const { request } = await import('../cli/draw.mjs');
	let hits = 0;
	const srv = http.createServer((req, res) => {
		hits++;
		if (hits <= 2) { res.writeHead(429, { 'content-type': 'text/html', 'retry-after': '0' }); return res.end('<html>denied</html>'); }
		res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
	});
	await new Promise((r) => srv.listen(0, r));
	const ctx = { host: `http://127.0.0.1:${srv.address().port}`, code: null, prefix: '/api/v1' };
	try {
		const res = await request(ctx, '/health');
		assert.equal(res.ok, true, 'it got through rather than dying on the first refusal');
		assert.equal(hits, 3, 'and it actually retried — twice refused, once served');
	} finally { srv.close(); }
});

test('B160: an APPLICATION 429 is returned, never retried', async () => {
	const { request } = await import('../cli/draw.mjs');
	let hits = 0;
	const srv = http.createServer((req, res) => {
		hits++;
		res.writeHead(429, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: 'slow down', code: 'app-limit' }));
	});
	await new Promise((r) => srv.listen(0, r));
	const ctx = { host: `http://127.0.0.1:${srv.address().port}`, code: null, prefix: '/api/v1' };
	try {
		/*
		The distinction is the body. The service always answers JSON, so a 429 that parses came from
		the application and means something this layer must not second-guess -- retrying it could
		replay work the backend has already seen, which an edge 429 never can because it never
		reached the backend at all.
		*/
		const res = await request(ctx, '/health');
		assert.equal(res.status, 429, 'handed back for the verb to report');
		assert.equal(hits, 1, 'and NOT retried — only the edge refusal is safe to repeat');
		assert.equal(res.body.code, 'app-limit', 'with its body intact');
	} finally { srv.close(); }
});

test('B160: a non-JSON body that is NOT a 429 still asks about the credential', async () => {
	const srv = http.createServer((req, res) => {
		res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>sign in</html>');
	});
	await new Promise((r) => srv.listen(0, r));
	const tool = path.join(root, 'cli/draw.mjs');
	try {
		/*
		Shelled out because `die()` exits the process, so the message cannot be observed in-process.

		The IAP sign-in page this branch was written for must KEEP its message. The fix narrows the
		guess to statuses that do not explain themselves rather than removing it, and a test that
		only proved the 429 path would not notice if the narrowing had swallowed the original case.
		*/
		// SPAWNED, not execFileSync: the sync variant blocks the event loop, so the server above can
		// never accept the connection and the two deadlock -- the child waits for a response the
		// parent cannot serve. Cost me a 300-second test timeout to find.
		const stderr = await new Promise((resolve) => {
			const kid = spawn(process.execPath, [tool, 'health'], {
				env: { ...process.env, DRAW_HOST: `http://127.0.0.1:${srv.address().port}`, DRAW_CODE: '' },
			});
			let err = '';
			kid.stderr.on('data', (d) => { err += d; });
			kid.on('close', () => resolve(err));
		});
		assert.match(stderr, /is a credential needed/, 'the sign-in guess survives for the case it was for');
	} finally { srv.close(); }
});

/*
H9.9 -- the CLI follows a fork, because REST has no session to rebind.

A websocket session moves to the fork and stays there. REST is stateless, so before this the CLI
kept naming the template and forked AGAIN on every write: two commands produced two diagrams both
called `arrow` with one node each, and nothing told the caller either had happened. Observed in the
shipped image rather than reasoned about.

The context file is the CLI's session, and re-pointing it is what makes a later write land beside
the first instead of starting a third copy.
*/
test('H9.9: a write to a template is announced, and the context follows the fork', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-tplcli-'));
	const hm = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-tplhome-'));
	const templatesDir = fileURLToPath(new URL('../templates', import.meta.url));
	const a = await makeApp({ dataDir: dir, secretsDir: dir, port: 0, templatesDir });
	const h = `http://127.0.0.1:${a.port}`;
	const err = [];
	const realWrite = process.stderr.write.bind(process.stderr);
	process.stderr.write = (s) => { err.push(String(s)); return true; };
	const say = [];
	const cli = (...argv) => main([...argv, '--host', h], { HOME: hm }, (s) => say.push(s));
	try {
		const tpl = [...a.store.templates.keys()].sort()[0];
		const node = a.store.get(tpl).all('node')[0].name;

		/*
		LOCK forks, and this is the case that only appears with authorization ON.

		`canWrite` is false for a template -- it has no owner and no grants -- so under authz the
		lock was refused and the REST/CLI path could never fork at all. It worked in a container with
		no identity source, which is not the configuration production runs.

		Locking the template itself was rejected as the fix: a lock SERIALISES writers, so one person
		starting from a template would block everyone else from starting from the same one. Taking
		the write slot is declaring intent to mutate, and for read-only content the only honest way
		to honour that is to hand back something the caller can mutate.
		*/
		await cli('lock', '--diagram', tpl);
		await cli('rename', node, 'renamed-by-me');

		const shouted = err.join('');
		assert.match(shouted, /\[ fork \]/, 'the caller is TOLD its write moved');
		const forkId = (shouted.match(/diagram-[0-9a-f]{6}/) || [])[0];
		assert.ok(forkId, 'and told where to');

		// the context is the CLI's session. Without this the next write names the template again
		// and forks a second time, which is exactly what the shipped image did.
		const ctx = fs.readFileSync(path.join(hm, '.config/draw/context'), 'utf8').trim();
		assert.equal(ctx, forkId, 'the context followed the fork');
		// and the TOKEN followed it too. Stored under the requested id, the caller held a token for
		// something that was never locked, and the next write said "run draw lock" with one held.
		assert.match(say.join(''), new RegExp(`locked ${forkId}`), 'the lock names what it actually locked');

		const mine = a.store.list('user:owner@example.com').filter((e) => !e.template);
		assert.equal(mine.length, 1, 'exactly one fork exists');
		assert.equal(a.store.get(forkId).all('node').some((n) => n.name === 'renamed-by-me'), true,
			'and the write is in it');
		assert.equal(a.store.get(tpl).all('node').some((n) => n.name === 'renamed-by-me'), false,
			'the template is untouched -- it is content in the image');
	} finally {
		process.stderr.write = realWrite;
		await a.close();
		fs.rmSync(dir, { recursive: true, force: true });
		fs.rmSync(hm, { recursive: true, force: true });
	}
});

/*
B167 -- the CLI's copy of the renderable node types must equal the kernel's.

`cli/` cannot import the kernel: it is installed standalone, and B138 above is the test that proves
an outside import breaks a real installation. So the list is declared twice on purpose, and this is
the check that keeps the two honest. Without it, adding a glyph would leave `draw add` refusing a
type the editor happily draws.
*/
test('B167: the CLI\'s node types are exactly the kernel\'s renderable glyphs', async () => {
	const { GLYPH_BB } = await import('../kernel/theme.mjs');
	const src = fs.readFileSync(path.join(root, 'cli/verbs.mjs'), 'utf8');
	const decl = src.match(/const NODE_TYPES = \[([^\]]*)\]/);
	assert.ok(decl, 'the declaration moved -- this assertion needs re-pointing');
	const cli = decl[1].match(/'([a-z0-9-]+)'/g).map((x) => x.slice(1, -1));
	assert.deepEqual([...cli].sort(), Object.keys(GLYPH_BB).sort(),
		'cli/verbs.mjs and kernel/theme.mjs disagree about what can be drawn');
});

/*
B161 -- an argument a verb does not understand is refused, not discarded.

`draw show diagram-a97651` used to answer about `diagram-000001` in silence: `show` takes no
positional, the id fell on the floor, and the reply named the diagram it had picked instead. Being
told something TRUE about the wrong document is worse than an error, because nothing in the answer
suggests looking again.

Checked at the dispatcher, so this asserts the manifest is what decides -- not 41 per-verb guards.
*/
test('B161: a verb refuses a positional it never declared', () => {
	/*
	Shelled out, like B138, and for the same kind of reason: the guard lives in the DISPATCHER, so
	asserting anything about the manifest would be testing a different thing than the one that
	ships. A first version of this checked that `show` declares no args -- true, and no evidence at
	all that an extra one is refused.

	No --host: the refusal happens before the verb runs, so it never reaches the network. That is
	itself part of the property -- a wrong target is rejected without a round trip.
	*/
	const draw = path.join(root, 'cli/draw.mjs');
	const run = (args) => {
		try { return { out: execFileSync(draw, args, { encoding: 'utf8', env: { ...process.env } }), code: 0 }; }
		catch (e) { return { out: (e.stdout || '') + (e.stderr || ''), code: e.status }; }
	};
	const zero = run(['show', 'diagram-a97651']);
	assert.notEqual(zero.code, 0, 'it must fail rather than answer about something else');
	assert.match(zero.out, /takes no arguments/);
	assert.match(zero.out, /--diagram/, 'and it must say how to target one');
	assert.match(zero.out, /diagram-a97651/, 'naming what it refused');

	const overfull = run(['about', 'thing', 'extra']);
	assert.notEqual(overfull.code, 0);
	assert.match(overfull.out, /takes 1 argument/);
	assert.match(overfull.out, /usage: draw about/, 'an over-full verb prints its usage');

	// and a variadic verb is untouched -- it fails for a real reason, not an arity one
	const many = run(['rm', 'a', 'b', 'c']);
	assert.doesNotMatch(many.out, /takes \d+ argument|takes no arguments/, 'rm accepts many by declaration');
});

test('B161: every verb that accepts many says so in its own usage line', () => {
	// the variadic test reads `...` off the usage string, so a variadic verb that omits it would
	// start refusing its own arguments. This is the check that the two stay in step.
	for (const v of VERBS) {
		const many = (v.args || []).some((a) => /\.\.\./.test(a.name || ''));
		if (many) assert.match(v.usage || '', /\.\.\./, `${v.name} takes many but its usage does not say so`);
	}
});

/*
B179 -- the two reports that exist because I routed around this tool rather than extending it.

`draw combat` derives from the SAME `combatAt` the browser folds, which is the property worth
guarding: if the CLI and a tab disagreed about who is being burned, one of them would be wrong, and
the parity claim says neither can be. Tested by deriving both here from one document.
*/
test('B179: draw combat derives the same answer the browser would', async () => {
	const { Model } = await import('../model/index.mjs');
	const { worldOf, combatAt } = await import('../engine/index.mjs');
	const m = new Model();
	m.put('waypoint', { id: 'waypoint-ca0001', name: 'waypoint-ca0001', x: 0, y: 0, spawn: { interval: 700, speed: 1.4, kind: 'packet', since: 1_788_300_000_000 } });
	m.put('waypoint', { id: 'waypoint-ca0002', name: 'waypoint-ca0002', x: 720, y: 0 });
	m.put('link', { id: 'link-ca0003', name: 'link-ca0003', src: 'waypoint-ca0001', dst: 'waypoint-ca0002' });
	m.put('node', { id: 'node-ca0004', type: 'loadbalancer', x: 360, y: 0 });

	const at = 1_788_300_060_000;
	const world = worldOf(m);
	const a = combatAt(world, at);
	const b = combatAt(worldOf(m), at);
	assert.equal(a.tick, b.tick, 'the same instant must yield the same tick');
	assert.deepEqual(a.alive.map((x) => x.id), b.alive.map((x) => x.id));
	assert.equal(world.towers.length, 1, 'the report has a tower to describe');
	assert.ok(world.towers[0].range > 0 && world.towers[0].beam > 0,
		'a tower reported with no range or no beam would read as broken rather than idle');
});

test('B179: the verb manifest is enumerable by a machine', () => {
	/*
	The gap that made the others hard to find. `draw help` pads and paints for a person, so an
	attempt to list the verb set returned 56 repetitions of the word `draw` and two guessed verbs
	that do not exist. Every verb must carry the fields a caller needs to choose one without
	reading prose.
	*/
	for (const v of VERBS) {
		assert.ok(v.name && v.usage && v.summary, `${v.name || '?'} is missing name, usage or summary`);
		assert.ok(v.group, `${v.name} declares no group`);
		assert.ok(Array.isArray(v.flags ?? []), `${v.name} has a non-array flags`);
	}
	const names = VERBS.map((v) => v.name);
	assert.equal(new Set(names).size, names.length, 'two verbs share a name');
	for (const needed of ['dump', 'combat', 'movers']) {
		assert.ok(names.includes(needed), `${needed} is missing -- an investigation would route around the CLI again`);
	}
});

/*
B186 -- `draw use`, and a write that refuses to guess which diagram it means.
*/

test('B186: the write verbs are derived from the manifest, not listed', () => {
	/*
	`activeId` decides read-versus-write from each verb's declared `method`. A hand-kept list of
	mutating verbs would be a twin, and the first verb added without touching it would silently get
	the read behaviour -- which is the guess this change exists to remove.
	*/
	const src = fs.readFileSync(new URL('../cli/verbs.mjs', import.meta.url), 'utf8');
	assert.match(src, /ctx\.verb\?\.method/, 'write-ness is not derived from the manifest');
	const dispatch = fs.readFileSync(new URL('../cli/draw.mjs', import.meta.url), 'utf8');
	assert.match(dispatch, /ctx\.verb = verb;/, 'the dispatcher does not tell activeId which verb is running');

	const mutating = VERBS.filter((v) => ['POST', 'DELETE', 'PUT', 'PATCH'].includes(v.method));
	assert.ok(mutating.length > 20, `only ${mutating.length} verbs declare a mutating method`);
});

test('B186: a write with no selected diagram refuses rather than defaulting', () => {
	/*
	The load-bearing half. This used to fall through to `list[0]` -- whichever diagram sorted first
	-- and that is how a rehearsal wrote fourteen nodes into `example`, colliding with a waypoint
	already standing there. Every command succeeded, against the wrong document.

	Same principle as `undo --expect`: a write surface may not choose its own target.
	*/
	const src = fs.readFileSync(new URL('../cli/verbs.mjs', import.meta.url), 'utf8');
	const fn = src.slice(src.indexOf('async function activeId'));
	const body = fn.slice(0, fn.indexOf('\n}'));
	assert.match(body, /if \(write\) \{/, 'activeId does not branch on write');
	assert.match(body, /no diagram selected/, 'the refusal does not say what is wrong');
	assert.match(body, /draw use <ref>/, 'the refusal does not say what to do about it');
	// and a READ still defaults: answering the wrong question is recoverable, writing is not
	assert.match(body, /return list\[0\]\.id;/, 'reads must keep a default');
});

test('B186: context is stored per host', () => {
	// a diagram id is only meaningful on the server holding it. A single id was ambiguous the moment
	// DRAW_HOST changed, and the failure is silent because a stale id is still well-formed.
	const src = fs.readFileSync(new URL('../cli/verbs.mjs', import.meta.url), 'utf8');
	assert.match(src, /all\[ctx\.host\] = id/, 'the context is not keyed by host');
	assert.match(src, /return \{ \[ctx\.host\]: raw \}/, 'the pre-B186 flat file is not migrated');
});

test('B186: use is named for the intent, and does not collide with an existing verb', () => {
	/*
	`ctx` was the alternative and was rejected: a `context` verb already exists in this group and
	answers something else, so the two would sit one keystroke apart meaning unrelated things.
	*/
	const names = VERBS.map((v) => v.name);
	assert.ok(names.includes('use'), 'the use verb is missing');
	assert.ok(names.includes('context'), 'context is expected to exist -- this test guards the collision');
	assert.equal(names.filter((n) => n === 'use').length, 1, 'use is declared twice');
	const use = VERBS.find((v) => v.name === 'use');
	assert.equal(use.args.length, 1, 'use takes an optional ref');
	assert.match(use.summary, /per host/, 'the summary does not say the selection is per host');
});
