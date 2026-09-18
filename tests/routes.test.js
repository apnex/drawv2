/*
B119 -- the declared surface is PROVEN, not asserted.

`server/routes.mjs` says what the REST surface answers, because methods could not be inferred from
the router honestly: two attempts are recorded in tools/routes.mjs, and the second reported
`diagrams` as write-only. A declaration that nothing checks is a wish, so this issues every declared
pair against a live server and fails on 404 or 405 -- a route that is not there, or a method the
router does not take.

Any other status is a pass, deliberately. 422 for a deliberately empty body, 423 for a missing lock
and 403 for a refused principal all mean the route EXISTS and the request reached its handler, which
is the only thing being claimed here. What the handler then decides is every other test in the suite.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeApp } from './fixtures/app.mjs';
import { ROUTES, families } from '../server/routes.mjs';
import { inventory } from '../tools/routes.mjs';

test('B119: every declared route and method is answered by the running server', async () => {
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-routes-'));
	const app = await makeApp({ dataDir, secretsDir: dataDir, port: 0 });
	const base = `http://127.0.0.1:${app.port}/api/v1`;
	try {
		const list = await (await fetch(`${base}/diagrams`)).json();
		const id = list[0].id;
		const doc = await (await fetch(`${base}/diagrams/${id}`)).json();
		const lock = await (await fetch(`${base}/diagrams/${id}/lock`, { method: 'POST' })).json();
		/*
		A real code, because `:code` has to name one.

		Under authorization this probe reaches the handler, and revoking a code that does not exist
		is an honest 404. It used to stop one line earlier -- with authz off the principal was null
		and the workspace family answered 403 to everything, which is not 404 and so counted as
		"answered". The route was never actually exercised. H9.17.
		*/
		const minted = await (await fetch(`${base}/workspace/codes`, {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent: 'agent:probe' }),
		})).json();

		const fill = (p) => p
			.replace(':id', id)
			.replace(':entity', doc.nodes[0]?.id || 'node-aaaaaa')
			.replace(':zone', doc.zones[0]?.id || 'zone-aaaaaa')
			.replace(':link', doc.links[0]?.id || 'link-aaaaaa')
			.replace(':name', 'node')
			.replace(':principal', encodeURIComponent('agent:probe'))
			.replace(':code', encodeURIComponent(minted.id || 'c-probe'));

		const missing = [];
		for (const route of ROUTES) {
			for (const method of route.methods) {
				// `diagrams/:id` DELETE would remove the diagram every other probe needs
				if (route.path === 'diagrams/:id' && method === 'DELETE') continue;
				// B132: no exception for `health` any more. It needed one because ROUTES declared a
				// path this file says is relative to the version prefix, and that one was at the
				// root -- so the prover proved a different route from the one declared, for exactly
				// one entry, which is how `draw health` never worked and nothing noticed.
				const url = `${base}/${fill(route.path)}`;
				const res = await fetch(url, {
					method,
					headers: { 'Content-Type': 'application/json', 'X-Draw-Lock': lock.token },
					body: ['GET', 'DELETE'].includes(method) ? undefined : '{}',
				});
				/*
				A 404 is ambiguous, and telling the two apart is the point of this prover.

				"No such route" and "no such resource" share a status. The router's own miss answers
				a bare `{ error: 'not found' }`; a handler that ran and found nothing answers with a
				`code`, because every refusal in this API names its reason. So a 404 CARRYING a code
				is a route that answered, and one without is a route that does not exist.

				B109 forced the distinction: `POST diagrams/deleted/:id/restore` is the one route
				whose subject is absent by definition -- there is nothing in a fresh store's delete
				window -- so it can only ever 404 here, and reading that as "missing" would have made
				the route unprovable rather than unproven.
				*/
				const answered = res.status === 404 && !!(await res.clone().json().catch(() => null))?.code;
				if ((res.status === 404 && !answered) || res.status === 405) {
					missing.push(`${method} ${route.path} -> ${res.status}`);
				}
			}
		}
		assert.deepEqual(missing, [],
			`declared but not answered:\n  ${missing.join('\n  ')}`);
	} finally {
		await app.close();
		fs.rmSync(dataDir, { recursive: true, force: true });
	}
});

test('B119: the declaration covers every route family the router is seen to answer', () => {
	/*
	The other direction, and the one a behavioural prover cannot give: a family added to the router
	and forgotten here would simply never be probed. tools/routes.mjs derives the names
	independently from the source, so the two lists have to agree.
	*/
	const seen = inventory();
	const declared = new Set(families());
	const undeclared = seen.filter((r) => !declared.has(r));
	assert.deepEqual(undeclared, [],
		`the router answers these and server/routes.mjs does not declare them: ${undeclared.join(', ')}`);
});

/*
B152/H11.27 -- the server may not emit a character an agent cannot type back.

S13 holds every DOCUMENT to typeable characters, on the reasoning that a reader who must reproduce
a string needs to be able to enter it. The wire was exempt and had the same problem one layer closer
to the consumer: `draw` prints a server string verbatim, so an agent reading an error sees a
character it cannot reproduce in a grep, a test assertion or a bug report.

Asserted as a RULE over the source rather than as three fixed strings. Three is what exists today;
the fourth is the one that matters, and a test naming the current three would pass the day someone
adds it. Comments are exempt -- they are not emitted -- which is the same line S13 draws between
using a character and merely writing one down.
*/
test('B152: no agent-facing string carries a character an agent cannot type', () => {
	/*
	The CLIENT is held to this too. B152 was filed against the server because that is where it was
	found, but the rule is about what a reader can type back -- and `app/src/main.js` writes the
	banner, the tooltips and the lock messages a person actually sees. An em dash reached a tooltip
	and the director had to report it by eye, which is the check this replaces.
	*/
	const files = ['server/rest.js', 'server/protocol.js', 'server/validate.js', 'server/store.js',
		'server/txn.mjs', 'server/locks.js', 'server/app.js', 'app/src/main.js'];
	const offenders = [];
	for (const f of files) {
		const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').split('\n');
		let inBlock = false;
		src.forEach((line, i) => {
			const t = line.trim();
			// a block comment may span lines; a line comment ends at the newline
			if (inBlock) { if (t.includes('*/')) inBlock = false; return; }
			if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; return; }
			if (t.startsWith('//') || t.startsWith('*')) return;
			const code = line.split('//')[0];
			for (const m of code.matchAll(/[`'"]([^`'"]*)[`'"]/g)) {
				/*
				Standalone GLYPHS are exempt, and only those: a play mark, an undo arrow, a cross.
				The character is the content rather than punctuation inside a sentence, and nobody
				retypes an icon -- which is the S13 distinction between using a character and
				writing one down. An em dash between two words is not this.
				*/
				const bad = [...m[1]].filter((c) => c.charCodeAt(0) > 127 && !'\u25b6\u21b6\u2717\u00d7'.includes(c));
				if (bad.length) offenders.push(`${f}:${i + 1}  ${JSON.stringify(bad.join(''))}  ${m[1].slice(0, 60)}`);
			}
		});
	}
	assert.deepEqual(offenders, [], `these reach an agent and cannot be typed back:\n  ${offenders.join('\n  ')}`);
});
