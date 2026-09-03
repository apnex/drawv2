/*
B182 -- what each client did, kept server-side.

WHY IT EXISTS is a failure, not a feature. During the B181 incident the agent asked the director to
read his browser console. A5 Perceptual Parity names that exact anti-pattern in its rationale --
"human supervisors are then forced to act as the agent's eyes, relaying state by hand" -- and A13
names director attention as the one irreplaceable resource. The remedy A5 gives is not to ask more
politely; it is for the agent to hold its own instrument.

The server already SAW everything needed: session identity, connect, every commit, every refusal,
every close. It kept none of it readable. Reconstructing "one session committed spawn/stop
alternately at 78 per second while sessions churned" took an hour of log greps.

These tests pin the properties that make it an instrument rather than a metric: the NARRATIVE
survives, the total survives even when the narrative is trimmed, a closed session is still readable,
and nothing grows without bound.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionLog, SESSIONS_KEPT, EVENTS_PER_SESSION } from '../server/sessionlog.mjs';

test('B182: the incident is visible in one question', () => {
	/*
	The whole point, stated as the thing that was actually hard. A session committing far faster
	than a person could must be nameable without reading logs, without a browser, and without
	knowing in advance what the loop was.
	*/
	const log = new SessionLog();
	let t = 1000;
	log.open('s-loop', 'user:a@x', t);
	for (let i = 0; i < 900; i++) { t += 13; log.note('s-loop', 'commit', { label: i % 2 ? 'spawn' : 'stop spawning' }, t); }
	log.open('s-calm', 'user:b@x', t);
	t += 4000;
	log.note('s-calm', 'commit', { label: 'move' }, t);

	const hot = log.hot(5, t);
	assert.equal(hot.length, 1, 'exactly one session is writing at machine speed');
	assert.equal(hot[0].actor, 's-loop');
	assert.ok(hot[0].commitsPerSecond > 50, `expected a high rate, got ${hot[0].commitsPerSecond}`);
});

test('B182: the total survives even though the narrative is trimmed', () => {
	/*
	The ring keeps the last N events; the COUNT keeps everything. During the incident the number
	that named the problem was "900 commits", and a bounded ring alone would have thrown it away.
	*/
	const log = new SessionLog();
	let t = 0;
	log.open('s-a', null, t);
	for (let i = 0; i < 500; i++) { t += 10; log.note('s-a', 'commit', null, t); }
	const [rec] = log.report(t);
	assert.equal(rec.counts.commit, 500, 'the total must not be lost to trimming');
	assert.equal(rec.events.length, EVENTS_PER_SESSION, 'the narrative must stay bounded');
});

test('B182: a session that vanished is still readable -- churn is the symptom', () => {
	/*
	The thing missed for hours. Sessions were being replaced, and only live ones were observable, so
	reconnect churn was invisible. A closed session must remain in the record or the most diagnostic
	pattern available cannot be seen at all.
	*/
	const log = new SessionLog();
	let t = 0;
	for (let i = 0; i < 5; i++) {
		const a = `s-${i}`;
		log.open(a, null, t);
		log.note(a, 'commit', null, t + 5);
		log.close(a, t + 10);
		t += 12;
	}
	const report = log.report(t);
	assert.equal(report.length, 5, 'every closed session is remembered');
	assert.ok(report.every((r) => !r.live), 'all closed');
	assert.equal(report[0].actor, 's-4', 'newest closed first -- the churn reads in order');
});

test('B182: the event narrative is ordered and carries its detail', () => {
	// the sequence IS the diagnosis: connect, commit, commit, refused, close
	const log = new SessionLog();
	let t = 0;
	log.open('s-a', 'user:a@x', t);
	log.note('s-a', 'open-diagram', { id: 'diagram-aa0001' }, t += 5);
	log.note('s-a', 'commit', { label: 'spawn' }, t += 5);
	log.note('s-a', 'refused', { why: 'rate-limited' }, t += 5);
	log.close('s-a', t += 5);
	const [rec] = log.report(t);
	assert.deepEqual(rec.events.map((e) => e.kind), ['open', 'open-diagram', 'commit', 'refused', 'close']);
	assert.equal(rec.events[3].detail.why, 'rate-limited');
	assert.equal(rec.counts.refused, 1);
});

test('B182: neither ring grows without bound', () => {
	// an unbounded diagnostic is a leak that only appears during the incident it was built for
	const log = new SessionLog();
	let t = 0;
	for (let i = 0; i < SESSIONS_KEPT * 3; i++) {
		const a = `s-${i}`;
		log.open(a, null, t); log.close(a, t += 1);
	}
	assert.equal(log.report(t).length, SESSIONS_KEPT, 'the session ring is bounded');
});

test('B182: a rate is not invented from a sample too short to support one', () => {
	// dividing three commits by 40ms would report 75/s and mean nothing
	const log = new SessionLog();
	log.open('s-a', null, 0);
	log.note('s-a', 'commit', null, 10);
	const [rec] = log.report(40);
	assert.equal(rec.commitsPerSecond, null, 'a sub-second session must report no rate');
	assert.equal(rec.counts.commit, 1, 'but the count is still there');
});

test('B182: observing cannot change an outcome', () => {
	// a troubleshooting instrument must never become state something depends on
	const log = new SessionLog();
	log.open('s-a', null, 0);
	log.note('s-a', 'commit', null, 5);
	const before = JSON.stringify(log.report(100));
	log.report(100); log.hot(1, 100); log.report(100);
	assert.equal(JSON.stringify(log.report(100)), before, 'reading the report mutated it');
});
