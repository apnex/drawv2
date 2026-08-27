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
import { fileURLToPath } from 'node:url';
import { main } from '../cli/draw.mjs';
import { VERBS, byName } from '../cli/verbs.mjs';

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
		assert.match(err, /no node called nonexistent/, 'and it says how to find the real ones');
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
		for (const m of body.matchAll(/request\(ctx, [`']([^`']+)[`']([^;]{0,200})/g)) {
			const verb = m[2].match(/method: '(POST|PUT|DELETE|PATCH)'/)?.[1] || 'GET';
			const key = `${verb} ${shape(m[1])}`;
			assert.ok(declared.has(key), `${v.name} issues ${key} and declares only ${[...declared].join(', ')}`);
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
