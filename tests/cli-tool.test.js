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
import { main } from '../cli/draw.mjs';
import { VERBS, byName } from '../cli/verbs.mjs';

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
		const positional = /const \[[^\]]+\] = args/.test(body) || /args\[\d\]/.test(body);
		if (positional && !(v.args || []).length) gaps.push(`${v.name}: takes positional args, declares none`);
		if (!positional && (v.args || []).length && v.name !== 'select') {
			gaps.push(`${v.name}: declares arguments it never reads`);
		}
	}
	assert.deepEqual(gaps, [], `help would omit these:\n  ${gaps.join('\n  ')}`);
});

test('GR18: --help renders the same five parts for every verb, leaf or sub', () => {
	// structure, not prose: usage, summary, flags, example, route. A verb missing a section is a
	// verb an agent has to guess at, and guessing is what the tool exists to remove.
	for (const v of VERBS) {
		const out = [];
		const argv = v.sub ? v.name.split(' ') : [v.name];
		main([...argv, '--help'], {}, (s) => out.push(s));
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

