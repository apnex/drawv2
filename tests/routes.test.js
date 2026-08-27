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
				if (res.status === 404 || res.status === 405) missing.push(`${method} ${route.path} -> ${res.status}`);
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
