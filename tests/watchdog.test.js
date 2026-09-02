/*
H13.10 — the client ladder.

Every dependency is injected, so the whole state machine is exercised with no browser, no socket and
no real timer. That is the point of the shape: the rung a client is on is a decision, and a decision
should be testable as one.

The property under test throughout is that **the rungs do not collapse into each other**. A
disconnection must never reload, because a reload requires the server to be up and would replace a
working application with a browser error page at exactly the moment it cannot be fetched.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Watchdog } from '../app/src/watchdog.js';

// a watchdog with no timer of its own: tests drive `check()` directly so nothing waits on a clock
function dog({ live = 'rev-1', pinned = 'rev-1', fail = false } = {}) {
	const seen = [];
	let reloads = 0;
	const w = new Watchdog({
		probe: async () => { if (fail) throw new Error('unreachable'); return live; },
		reload: () => { reloads += 1; },
		onRung: (rung, reason) => seen.push([rung, reason]),
		pollMs: 0,
	});
	if (pinned) w.pin(pinned);
	return { w, seen, reloads: () => reloads, set: (v) => { live = v; }, breaks: (v) => { fail = v; } };
}

test('H13.10: a dropped connection goes to offline and does NOT reload', () => {
	/*
	The load-bearing test in this file. A reload needs the server, so reloading because the server
	went away is the one response guaranteed to fail as it fires.
	*/
	const d = dog();
	d.w.noteClosed();
	assert.equal(d.w.rung, 'offline');
	assert.equal(d.reloads(), 0, 'a disconnection must never reload');
});

test('H13.10: a timeout raises suspicion, and suspicion alone still does not reload', async () => {
	// checking while offline and unreachable teaches nothing, and not knowing is not evidence
	const d = dog({ fail: true });
	d.w.noteClosed();
	await d.w.check();
	await d.w.check();
	assert.equal(d.w.rung, 'offline', 'still offline -- no answer means no conclusion');
	assert.equal(d.reloads(), 0);
});

test('H13.10: reconnecting to the same revision returns the tab to live', () => {
	const d = dog();
	d.w.noteClosed();
	assert.equal(d.w.rung, 'offline');
	d.w.noteOpen();
	assert.equal(d.w.rung, 'live');
	assert.equal(d.reloads(), 0);
});

test('H13.10: a different revision is evidence, and the tab reloads', async () => {
	const d = dog({ pinned: 'rev-1' });
	d.set('rev-2');
	await d.w.check();
	assert.equal(d.w.rung, 'stale');
	assert.equal(d.reloads(), 1);
});

test('H13.10: the server retiring the session reloads it', async () => {
	const d = dog();
	await d.w.retire('a newer revision is live');
	assert.equal(d.w.rung, 'stale');
	assert.equal(d.reloads(), 1);
});

test('H13.10: an unreconcilable version gap reloads', async () => {
	const d = dog();
	await d.w.gap();
	assert.equal(d.w.rung, 'stale');
	assert.equal(d.reloads(), 1);
});

test('H13.10: a warranted reload that cannot be completed becomes unreachable, not a reload', async () => {
	/*
	Rung 3, and the reason it exists. The client has real evidence it should be replaced AND cannot
	fetch what would replace it. Reloading here destroys a working page for a browser error.
	*/
	const d = dog({ fail: true });
	await d.w.retire('the server retired this session');
	assert.equal(d.w.rung, 'unreachable');
	assert.equal(d.reloads(), 0, 'must not reload into a void');
});

test('H13.10: an unreachable tab reloads as soon as the server answers again', async () => {
	const d = dog({ fail: true });
	await d.w.retire('the server retired this session');
	assert.equal(d.w.rung, 'unreachable');
	d.breaks(false);
	await d.w.check();
	assert.equal(d.w.rung, 'stale');
	assert.equal(d.reloads(), 1, 'the warrant survives until it can be honoured');
});

test('H13.10: a reconnect does not cancel a warranted reload', async () => {
	// the socket coming back is not evidence the CODE is current -- a stale tab can reconnect happily
	const d = dog({ fail: true });
	await d.w.retire('a newer revision is live');
	d.w.noteOpen();
	assert.equal(d.w.rung, 'unreachable', 'reconnecting must not clear the warrant');
	d.breaks(false);
	await d.w.check();
	assert.equal(d.reloads(), 1);
});

test('H13.10: with no revision to compare, the revision half is inert', async () => {
	/*
	F6. A local server sets no `K_REVISION`, so `pinned` stays null and there is nothing to compare.
	The ladder must then do nothing rather than guess, or development diverges from production in
	precisely the mechanism meant to guarantee correctness.
	*/
	const d = dog({ pinned: null });
	d.set('rev-9');
	await d.w.check();
	assert.equal(d.w.rung, 'live');
	assert.equal(d.reloads(), 0);
});

test('H13.10: a rung change is announced once, not once per check', async () => {
	// the pill must not flicker, and a caller should be able to trust the callback as an edge
	const d = dog({ fail: true });
	d.w.noteClosed();
	await d.w.check();
	await d.w.check();
	await d.w.check();
	assert.deepEqual(d.seen.map((s) => s[0]), ['offline'], `announced: ${JSON.stringify(d.seen)}`);
});

test('H13.10: only reload is a side effect -- the watchdog owns no state it did not derive', async () => {
	// it must not clear an outbox, drop a model, or otherwise take a decision belonging elsewhere
	const src = (await import('node:fs')).readFileSync(new URL('../app/src/watchdog.js', import.meta.url), 'utf8');
	for (const banned of ['localStorage', 'document.', 'window.', 'location.']) {
		assert.equal(src.includes(banned), false, `the watchdog reaches for ${banned}; it should be injected`);
	}
});
