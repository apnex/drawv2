/*
An app and a store built the way the deployment builds them -- H9.17 / B129.

Authorization now defaults ON, because the only deployment that exists runs it on and every test
that omitted it was exercising a configuration nobody ships. That was not a theoretical complaint.
Flipping the default turned 152 tests red and immediately surfaced two live defects that 582 green
tests could not see: B130, where deleting a diagram stranded every viewer because the survivor was
looked up with no principal, and B131, where the reseed after deleting your last diagram belonged
to nobody and so was readable by nobody.

`createApp` refuses `authz` without a `principalOf` (B70), and rightly -- authorization with no
identity source refuses every caller including the owner, which is indistinguishable at a glance
from a working service with no data. So an authorized app needs an identity, and supplying one in
seventeen files by hand is how seventeen slightly different identities happen. This is the one
shape.

A test whose SUBJECT is the ungated path passes `authz: false` explicitly. There are four, they say
so in one word, and a reader can count them -- which was the other half of the problem, because
before this the answer was "almost all of them" and nothing said it anywhere.
*/

import { createApp } from '../../server/app.js';
import { Store } from '../../server/store.js';

export const OWNER = 'user:owner@example.com';
export const GUEST = 'user:guest@example.com';

/*
An authorized app owned by `principal`.

`owner` and the resolved identity are the SAME value by default, which is what makes the seeded
diagram reachable: `owner` adopts what predates ownership at boot, so a test that writes to the
seed is writing to something its principal holds. Passing them separately is possible and is what
a test about adoption should do.

`as(principal)` exists because the identity has to be able to CHANGE inside a test. The interesting
assertions in this area are all of the form "the owner sees it and a stranger does not", and a
fixture that pinned one principal for the lifetime of the app could not express the second half.
A websocket resolves its principal once, at the upgrade, so `as()` before connecting is also how a
test gets two sockets with two different identities.
*/
export async function makeApp({ principal = OWNER, owner = principal, ...opts } = {}) {
	let who = principal;
	const app = await createApp({
		owner,
		principalOf: async () => who,
		...opts,
	});
	// Not a field: `principalOf` is already captured by the app, so the only way to change the
	// answer after construction is to change what the closure reads.
	app.as = (next) => { who = next; return app; };
	return app;
}

/*
An authorized store, opened the way `createApp` opens one.

Three steps, not one: construct, `init()`, then `adopt(owner)`. The third is the one that gets
forgotten, because in production it lives in `server/app.js` two lines after `init()` rather than
in the store itself -- so every other construction site has to remember it. Under authorization,
forgetting it means a store full of diagrams that nobody, including the owner, can read, and the
symptom is an empty list rather than an error.

Kept here rather than folded into `Store.init` deliberately: adoption is a deployment policy (the
`OWNER` environment variable), not a property of opening a file, and the composition root is where
policy belongs.
*/
export async function openStore(dataDir, { principal = OWNER, ...opts } = {}) {
	const store = new Store(dataDir, { flushMs: 3_600_000, ...opts });
	await store.init();
	if (principal) store.adopt(principal);
	return store;
}
