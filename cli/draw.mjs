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
import { VERBS, byName, sweepTokens } from './verbs.mjs';

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

export async function request(ctx, path, { method = 'GET', body = null, headers = {} } = {}) {
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
	if (parsed === null && text) {
		// an IAP sign-in page is the classic case, and "unexpected token <" helps nobody
		die(`non-JSON response from ${url} (HTTP ${res.status}) -- is a credential needed?`);
	}
	return { status: res.status, body: parsed, ok: res.status >= 200 && res.status < 300 };
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
		const target = rest[1] && byName(rest[1], rest[2]);
		out(`${target ? helpVerb(target) : helpAll()}\n`);
		return 0;
	}
	const verb = byName(rest[0], rest[1]);
	if (!verb) die(`unknown verb: ${rest.join(' ')}\nrun \`draw help\` for the verb list`);
	if (flags.help) { out(`${helpVerb(verb)}\n`); return 0; }

	const ctx = { ...base(flags, env), flags, json: !!flags.json, env };
	const args = rest.slice(verb.sub ? 2 : 1);
	const res = await verb.run(ctx, args);
	if (res === undefined || res === null) return 0;
	const rendered = ctx.json ? JSON.stringify(res.json ?? res, null, 2) : (res.text ?? res);
	out(`${rendered}\n`);
	return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => die(e.message));
}
