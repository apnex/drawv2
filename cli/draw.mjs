#!/usr/bin/env node
/*
draw -- the tool an agent drives draw through (GR18).

Runtime only. Every verb, its flags, its help and the route it reaches are declared in `verbs.mjs`,
and this file does nothing that is specific to one of them: it parses, dispatches, renders and
exits. That split is the whole point -- dispatch, help, the GR18 coverage scanner and the README
command table all read ONE manifest, so they cannot disagree. Four hand-maintained copies of a verb
list is how a CLI drifts from its server, which is exactly what happened to the shell version while
H9 built an entire write surface it never learned (B117).

Speaks only HTTP. Imports nothing from `server/`, `app/` or `model/`, so it works against any draw
server and can never accidentally test itself against in-process state.
*/
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { VERBS, byName, sweepTokens, ctxFile } from './verbs.mjs';

const RESET = '\x1b[0m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m';
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (c, s) => (tty ? `${c}${s}${RESET}` : s);

function parseArgs(argv) {
	const flags = {}; const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) { rest.push(a); continue; }
		const key = a.slice(2);
		/*
		A flag whose next token is another flag, or nothing, is a BOOLEAN.

		The first version assumed every flag took a value and special-cased two by name, so
		`--link --name web-1` set link to "--name" and left web-1 as a positional argument. The
		node was created, silently, with the wrong name -- the worst shape of bug, because the
		command appeared to succeed.
		*/
		const next = argv[i + 1];
		if (next === undefined || next.startsWith('--')) { flags[key] = true; continue; }
		/*
		A REPEATED flag accumulates; it does not overwrite.

		`flags[key] = argv[++i]` kept only the last, so `draw link a b --via 3,-2 --via 5,-2` drew
		one bend and silently dropped the other -- a command that appears to succeed and produces
		the wrong picture, which is the same shape as the boolean bug above. Found within minutes
		of `--via` existing, by using it.

		Single occurrence stays a scalar so no existing consumer changes; only repetition, which
		previously discarded data, produces an array.
		*/
		const value = argv[++i];
		if (Object.hasOwn(flags, key)) flags[key] = [].concat(flags[key], value);
		else flags[key] = value;
	}
	return { flags, rest };
}

/*
The door is chosen, never configured.

A connection code means `/connect/v1`, its absence means `/api/v1`. The operator does not select a
prefix: which door a request uses follows from whether it carries a credential, which is the
server's own rule that the prefix is a door and never a privilege.
*/
export function base(flags, env = process.env) {
	const host = flags.host || env.DRAW_HOST || 'http://localhost:8080';
	const code = flags.code || env.DRAW_CODE || null;
	return { host: host.replace(/\/$/, ''), code, prefix: code ? '/connect/v1' : '/api/v1' };
}

/*
B160 -- a throttle is waited out, not reported as a broken credential.

The agent door is deliberately not behind IAP, so it carries a rate limit (B159). Cloud Armor
answers a request over the rate with a 429 whose body is not JSON -- which used to fall into the
branch below and tell the caller to check a credential that was never the problem.

RETRIED, because the remedy is purely to wait and that is mechanical work the tool should absorb
rather than hand to an agent to reason about (A11). It is safe to retry: an edge 429 is refused at
the load balancer, so the request never reached the backend and nothing was partially applied.

BOUNDED, because A7 names the Blocked Actor -- an actor paused with no resume path -- and an
unbounded retry is exactly that wearing a helpful face. Four attempts, roughly fifteen seconds, then
a refusal that says what the limit is instead of guessing at a cause.

ANNOUNCED, because A5 asks that an agent perceive its own situation. A tool that silently sleeps for
fifteen seconds is indistinguishable from a slow one, and the difference is the whole diagnosis.

JITTERED, so that several agents throttled at once do not come back in step and re-trip it together.
*/
const THROTTLE_ATTEMPTS = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
H9.9 -- when a write forks a template, SAY SO and follow it.

The websocket rebinds its session, so a browser writing to a template lands on the fork and stays
there. REST has no session, and without this the CLI kept naming the template and forked AGAIN on
every write: two commands produced two diagrams both called `arrow`, one node in each, and nothing
told the caller that either had happened.

Two things, and the second is what was actually broken. It PRINTS, because an agent whose work moved
to a different id and was not told cannot reason about anything it does next (A5). And it RE-POINTS
the context, which is the CLI's equivalent of the session rebind, so the next command without an
explicit `--diagram` goes to the fork rather than starting a third copy.

HERE rather than in `ok()`, because this needs `ctx` and the verbs do not pass it -- putting it
there meant every write verb had to remember, which is the shape of defect this whole feature was
careful to avoid one layer down.

An explicit `--diagram template-x` still forks again, and that is right: naming the template is
asking to start from it. What was wrong was doing it in silence.
*/
function followFork(ctx, res) {
	const to = res.body?.forkedTo;
	if (!to) return;
	// neutral wording on purpose: this fires for a LOCK as well as a write, and 'your write
	// landed on' is a lie when nothing has been written yet
	process.stderr.write(`${paint(DIM, '[ fork ]')} a template is read-only -- you now have your own copy: ${to}\n`);
	try {
		fs.mkdirSync(path.dirname(ctxFile(ctx)), { recursive: true });
		fs.writeFileSync(ctxFile(ctx), to);
	} catch { /* a context we cannot write is a smaller problem than not reporting the fork */ }
}

export async function request(ctx, path, opts = {}) {
	for (let attempt = 0; ; attempt++) {
		const res = await requestOnce(ctx, path, opts);
		/*
		Only an EDGE 429 is retried. The application always answers JSON, so a 429 carrying a parsed
		body came from the service itself and means something this function has no business
		second-guessing -- it is returned for the verb to report.
		*/
		if (res.status !== 429 || res.body !== null) { followFork(ctx, res); return res; }
		if (attempt >= THROTTLE_ATTEMPTS - 1) {
			die(`rate limited by the agent door after ${THROTTLE_ATTEMPTS} attempts`
				+ ' -- it allows a burst and then paces you. Slow down, or space the run out.');
		}
		// honour Retry-After when the edge sends one, otherwise 1s, 2s, 4s with up to 50% jitter
		const after = Number(res.retryAfter) * 1000;
		const wait = Number.isFinite(after) && after > 0 ? after : 2 ** attempt * 1000 * (1 + Math.random() / 2);
		process.stderr.write(`${paint(DIM, '[ wait ]')} rate limited, retrying in ${(wait / 1000).toFixed(1)}s`
			+ ` (attempt ${attempt + 2} of ${THROTTLE_ATTEMPTS})\n`);
		await sleep(wait);
	}
}

async function requestOnce(ctx, path, { method = 'GET', body = null, headers = {} } = {}) {
	const url = `${ctx.host}${path.startsWith('/d/') ? '' : ctx.prefix}${path}`;
	const h = { ...headers };
	if (ctx.code) h.authorization = `Bearer ${ctx.code}`;
	if (body !== null) h['content-type'] = 'application/json';
	let res;
	try {
		res = await fetch(url, { method, headers: h, body: body === null ? undefined : JSON.stringify(body) });
	} catch (err) {
		die(`server unreachable at ${ctx.host} (${err.message})`);
	}
	const text = await res.text();
	let parsed = null;
	try { parsed = text ? JSON.parse(text) : null; } catch { /* not json */ }
	// a 429 from the edge is not JSON either, and must reach the retry above rather than be read as
	// a sign-in page -- so the credential guess is made only when the status does not explain itself
	if (parsed === null && text && res.status !== 429) {
		// an IAP sign-in page is the classic case, and "unexpected token <" helps nobody
		die(`non-JSON response from ${url} (HTTP ${res.status}) -- is a credential needed?`);
	}
	return { status: res.status, body: parsed, ok: res.status >= 200 && res.status < 300,
		retryAfter: res.headers.get('retry-after') };
}

export function die(message) {
	process.stderr.write(`${paint(RED, '[ ERROR ]')} ${message}\n`);
	process.exit(1);
}

// a table without `column`: measure, then pad
export function table(rows, headers) {
	if (!rows.length) return paint(DIM, '(none)');
	const cols = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
	const line = (cells, bold) => cells.map((c, i) => {
		const s = String(c ?? '').padEnd(cols[i]);
		return bold ? paint(BOLD, s) : s;
	}).join('  ').trimEnd();
	return [line(headers, true), ...rows.map((r) => line(r))].join('\n');
}

function helpAll() {
	const groups = [];
	for (const v of VERBS) {
		let g = groups.find((x) => x.name === v.group);
		if (!g) groups.push((g = { name: v.group, verbs: [] }));
		g.verbs.push(v);
	}
	const out = ['draw <verb> [args] [flags]', ''];
	for (const g of groups) {
		out.push(paint(BOLD, g.name));
		const w = Math.max(...g.verbs.map((v) => v.usage.length));
		for (const v of g.verbs) out.push(`  ${v.usage.padEnd(w)}  ${paint(DIM, v.summary)}`);
		out.push('');
	}
	out.push(paint(DIM, 'draw help <verb>   arguments, flags, an example, and the route it reaches'));
	return out.join('\n');
}

function helpVerb(v) {
	const out = [paint(BOLD, v.usage), '', `  ${v.summary}`, ''];
	if (v.args?.length) { out.push(paint(BOLD, 'Arguments')); for (const a of v.args) out.push(`  ${a.name.padEnd(16)}  ${a.about}`); out.push(''); }
	const flags = [...(v.flags || []), { name: '--json', about: 'machine output' }, { name: '--help', about: 'this text' }];
	out.push(paint(BOLD, 'Flags'));
	for (const f of flags) out.push(`  ${f.name.padEnd(16)}  ${f.about}`);
	out.push('', paint(BOLD, 'Example'), `  ${v.example}`, '');
	// naming the route is deliberate: an agent meeting an unexplained refusal can go to API.md
	// instead of guessing whether the tool or the server said no
	out.push(paint(DIM, `reaches ${v.route}`));
	return out.join('\n');
}

/*
`out` and `fail` are injected rather than reaching for process.stdout directly.

A test that patches `process.stdout.write` also captures the test runner's own protocol, which
arrives as binary noise in the failure message -- the first version of the CLI tests did exactly
that. Injecting the sink means a verb's OUTPUT can be asserted without the harness fighting the
runner for the same stream.
*/
export async function main(argv, env = process.env, out = (s) => process.stdout.write(s)) {
	const { flags, rest } = parseArgs(argv);
	/*
	Every invocation steps over the lock store first -- B136.

	A stateless tool cannot delete a token at the instant its lock lapses, because nothing of ours is
	running then. What it can promise is that no `draw` command ever runs alongside a dead one, which
	makes the file ephemeral in the only sense available: it exists for its lock, and at most until
	the next command.

	BEFORE the help branch, and that placement is the rule rather than a detail. Sitting after it
	made the guarantee "every command except the ones that return early", which is the kind of
	almost-true statement this codebase keeps finding at the bottom of a defect. It needs no server
	and no credential, so there is nothing for it to be early for. Best-effort and silent: a caller
	ran a verb, and housekeeping is not their business.
	*/
	await sweepTokens({ env }).catch(() => 0);
	if (!rest.length || rest[0] === 'help') {
		/*
		B179 -- `draw help --json` answers the agent this CLI exists for.

		The human form pads usage lines into columns and paints them, which is right for a person and
		useless to a parser: an attempt to list the verb set from it returned 56 repetitions of the
		word `draw`, and two verbs were guessed that do not exist. A surface an agent cannot enumerate
		is friction at the front door of an agent-first tool.
		*/
		if (flags.json) {
			const target = rest[1] && byName(rest[1], rest[2]);
			const shape = (v) => ({ name: v.name, group: v.group, usage: v.usage, summary: v.summary,
				route: v.route ?? null, method: v.method ?? null, example: v.example ?? null,
				args: (v.args || []).map((a) => (typeof a === 'string' ? { name: a } : a)),
				flags: (v.flags || []).map((f) => ({ name: f.name, about: f.about ?? null })) });
			out(`${JSON.stringify(target ? shape(target) : VERBS.map(shape), null, 2)}\n`);
			return 0;
		}
		const target = rest[1] && byName(rest[1], rest[2]);
		out(`${target ? helpVerb(target) : helpAll()}\n`);
		return 0;
	}
	const verb = byName(rest[0], rest[1]);
	if (!verb) die(`unknown verb: ${rest.join(' ')}\nrun \`draw help\` for the verb list`);
	if (flags.help) { out(`${helpVerb(verb)}\n`); return 0; }

	const ctx = { ...base(flags, env), flags, json: !!flags.json, env };
	const args = rest.slice(verb.sub ? 2 : 1);
	/*
	B161 -- an argument the verb does not understand is REFUSED, never discarded.

	`draw show diagram-a97651` answered about `diagram-000001` and said nothing about it: `show`
	takes no positional, so the id fell on the floor, `activeId` used the saved focus instead, and
	the output named the diagram it had chosen -- which reads like an answer. The caller is told
	something true about the wrong document, which is worse than an error, because nothing about
	the reply suggests looking again. It was found while exporting templates, one step away from
	shipping the wrong file.

	Checked HERE rather than in each verb because there are 41 of them and the manifest already
	holds the answer: `args` declares what a verb accepts. A per-verb guard is 41 chances to forget,
	and forgetting is silent.

	Variadic verbs are read off their own usage line -- `<id...>` and `[ref...]` are how they
	already say so, and the alternative is a second declaration that can disagree with the first.
	*/
	const variadic = /\.\.\./.test(verb.usage || '');
	const declared = (verb.args || []).length;
	if (!variadic && args.length > declared) {
		const extra = args.slice(declared);
		die(declared === 0
			? `${verb.name} takes no arguments, and got ${extra.join(' ')} -- target another diagram with --diagram, not a positional`
			: `${verb.name} takes ${declared} argument${declared === 1 ? '' : 's'}, and got ${args.length}: ${extra.join(' ')} is extra\nusage: ${verb.usage}`);
	}
	const res = await verb.run(ctx, args);
	if (res === undefined || res === null) return 0;
	const rendered = ctx.json ? JSON.stringify(res.json ?? res, null, 2) : (res.text ?? res);
	out(`${rendered}\n`);
	return 0;
}

/*
Run as a program, or import as a library -- and the test must survive a SYMLINK.

`import.meta.url === \`file://${process.argv[1]}\`` was wrong twice over, and it failed in the worst
possible way: exit 0, no output, no error. Through a link `argv[1]` is the LINK and `import.meta.url`
is the TARGET, so the comparison failed and `main` was simply never called. A symlink is not an edge
case here, it is the only documented installation -- `cli/README.md` tells a user to make one and
`Dockerfile` makes one -- so `draw` had been uninvokable by every real installation since the CLI
was rewritten Node-first, and 594 tests could not see it because every one of them imports `main`
rather than executing the file.

`realpathSync` resolves the link. `pathToFileURL` is the second fix: string-concatenating `file://`
onto a path is not how a path becomes a URL, and a space or a non-ASCII character in the install
directory broke it independently of any link.
*/
const invokedAs = process.argv[1]
	? pathToFileURL(realpathSync(process.argv[1])).href
	: null;
if (invokedAs && import.meta.url === invokedAs) {
	main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => die(e.message));
}
