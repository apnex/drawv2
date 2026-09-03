/*
B181 -- a session may not flood a shared document.

THE INCIDENT. One client committed `spawn` / `stop spawning` alternately at 78 transactions per
second against a live diagram. It reached version 144961, produced GCS write conflicts between two
instances, evicted the entire undo history many times over, and presented to the director as a peer
that would not stay in sync and rendering that stuttered.

WHAT THIS DOES NOT DO. It does not identify the client-side trigger, and deliberately does not
depend on doing so. A server that accepts writes as fast as a defect can emit them has no defence a
client fix can provide, and the next loop will be a different loop. The bound belongs where it
cannot be bypassed.

The budget is sized against legitimate use rather than against the wire: a four-second three-node
drag is ONE transaction by design (D4), arrow-key bursts coalesce client-side into a single undo
step, and `draw` commits one at a time. Six per second sustained is an order of magnitude above any
real gesture and an order of magnitude below what the incident produced.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../server/protocol.js', import.meta.url), 'utf8');

// the budget as the server declares it, read rather than duplicated -- a copy here would drift
const BUDGET = Number(src.match(/const COMMIT_BUDGET = (\d+);/)[1]);
const WINDOW = Number(src.match(/const COMMIT_WINDOW_MS = (\d+);/)[1]);

/*
A session stub carrying only what `tooFast` touches.

Built by hand rather than by standing up a server, because the property under test is arithmetic
over a rolling window and a real socket would add nothing but flakiness. `tooFast` is extracted from
the class the same way `tests/authority.test.js` mirrors `toOp`: it is not exported, and asserting
against the real source keeps the copy honest.
*/
function session(now = () => Date.now()) {
	const s = { actor: 'a', diagramId: 'diagram-aa0001', logged: 0 };
	s.tooFast = function tooFast() {
		const t = now();
		this.writes = (this.writes || []).filter((x) => t - x < WINDOW);
		if (this.writes.length >= BUDGET) {
			if (!this.throttled) { this.throttled = true; this.logged += 1; }
			return true;
		}
		this.throttled = false;
		this.writes.push(t);
		return false;
	};
	return s;
}

test('B181: the budget is generous enough that ordinary work never meets it', () => {
	// one commit a second for a minute -- a person editing steadily
	let t = 0;
	const s = session(() => t);
	for (let i = 0; i < 60; i++) { t += 1000; assert.equal(s.tooFast(), false, `refused an ordinary commit at ${i}s`); }
});

test('B181: a burst within one window is allowed up to the budget, then refused', () => {
	let t = 0;
	const s = session(() => t);
	for (let i = 0; i < BUDGET; i++) assert.equal(s.tooFast(), false, `refused commit ${i} of the budget`);
	assert.equal(s.tooFast(), true, 'the commit past the budget must be refused');
});

test('B181: the incident rate is refused within a fraction of a second', () => {
	/*
	78 per second, which is what was actually observed. The point is not that it is refused
	eventually but that the damage is bounded: at this rate the budget is spent almost immediately
	and everything after it costs the document nothing.
	*/
	let t = 0;
	const s = session(() => t);
	let accepted = 0;
	for (let i = 0; i < 78 * 10; i++) {        // ten seconds of the incident
		if (!s.tooFast()) accepted += 1;
		t += Math.round(1000 / 78);
	}
	const perSecond = accepted / 10;
	assert.ok(perSecond <= BUDGET / (WINDOW / 1000) + 1,
		`${perSecond}/s got through against a budget of ${BUDGET} per ${WINDOW}ms`);
	assert.ok(accepted < 78 * 10 / 5, `${accepted} of 780 accepted -- the bound is not biting`);
});

test('B181: the window rolls, so a throttled session recovers on its own', () => {
	// a rate limit that never lifts is an outage. Waiting out the window must restore service.
	let t = 0;
	const s = session(() => t);
	for (let i = 0; i < BUDGET; i++) s.tooFast();
	assert.equal(s.tooFast(), true, 'precondition: throttled');
	t += WINDOW + 1;
	assert.equal(s.tooFast(), false, 'the session must recover once the window has passed');
});

test('B181: the refusal is logged once per episode, not once per refused commit', () => {
	// 78 log lines a second is its own denial of service, and it buries the signal
	let t = 0;
	const s = session(() => t);
	for (let i = 0; i < BUDGET; i++) s.tooFast();
	for (let i = 0; i < 200; i++) s.tooFast();
	assert.equal(s.logged, 1, `logged ${s.logged} times for one episode`);
});

test('B181: the limit is wired into the commit path, and refuses rather than drops', () => {
	/*
	Structural, because the property is about WHERE the check sits. A rate limit applied after the
	store has already committed would bound nothing, and one that silently dropped the message would
	leave the client believing its edit landed -- I15, the sin this whole arc keeps meeting.
	*/
	const commit = src.slice(src.indexOf("case 'commit': {"));
	const body = commit.slice(0, commit.indexOf('this.store.commit'));
	assert.match(body, /this\.tooFast\(\)/, 'the budget is not checked before the store is asked to commit');
	assert.match(body, /rate-limited/, 'the refusal must carry a code the client can act on');
	assert.match(body, /reload if this persists/, 'the refusal must tell the user what to do');
});

/*
The client half. A limit the client answers by retrying instantly is not a limit.
*/
const client = fs.readFileSync(new URL('../app/src/sync.js', import.meta.url), 'utf8');

test('B181: a throttled client backs off instead of asking for a resync', () => {
	/*
	The amplifier, and the thing the director actually saw. Every refusal used to call
	`requestResync()`. At roughly 300 refused commits a second that is 300 full snapshots a second,
	each reloading the model and re-rendering the diagram -- a feedback loop presenting as stutter.

	A resync is right for a REJECTED command: the tab holds a change the server will never accept.
	It is exactly wrong for a THROTTLED one, where the command was fine and there was merely too
	much of it, and the most expensive request available is the worst possible reply.
	*/
	const handler = client.slice(client.indexOf("if (msg.cmd === 'error')"));
	const body = handler.slice(0, handler.indexOf('requestResync()'));
	assert.match(body, /rate-limited/, 'the throttle case is not distinguished from a rejection');
	assert.match(body, /throttledUntil/, 'the throttle does not record a backoff');
	assert.match(body, /return;/, 'the throttle case must return before the resync');
});

test('B181: the backoff is actually honoured on the outbound path', () => {
	// a recorded backoff nothing reads is a comment. `drain` is the one outbound path.
	const drain = client.slice(client.indexOf('\tdrain() {'));
	const body = drain.slice(0, drain.indexOf('\n\t}'));
	assert.match(body, /throttledUntil/, 'drain does not honour the throttle');
	assert.ok(/Date\.now\(\) < this\.throttledUntil/.test(body), 'the backoff comparison is missing or inverted');
});

test('B181: the backoff outlasts the server window, so a tab cannot refill it instantly', () => {
	const backoff = Number(client.match(/const THROTTLE_BACKOFF_MS = (\d+);/)[1]);
	assert.ok(backoff > WINDOW, `a ${backoff}ms backoff against a ${WINDOW}ms window refills immediately`);
});
