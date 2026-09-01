/*
B74 / H10.3 -- the durable server channel.

The defect was NOT that the message was too short-lived. It was that the message was an EVENT
payload: `emitState({ error })` carried it, and the very next `emitState({})` -- from an ack, a
change, a lock, a rename, any of nine call sites -- carried no `error` key at all, so the UI had
nothing to render and a rejection vanished in milliseconds.

So the property under test is not a duration. It is that the last thing the server said is STATE:
it goes out with every emit until something replaces it. A test that waited and re-read a DOM
element would be testing a timeout, which is a different mechanism and not the one that shipped.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sync } from '../app/src/sync.js';
import { Model } from '../model/index.mjs';
import { Changes } from '../app/src/changes.js';
import { Selection } from '../app/src/selection.js';

function harness() {
	const model = new Model();
	const states = [];
	const net = { status: 'open', subscribe() {}, onStatus() {}, isOpen: () => true, send() {}, sendRaw() {} };
	const history = new Changes(model);
	const sync = new Sync({
		model, net, history, selection: new Selection(model),
		onState: (s) => states.push(s),
	});
	return { sync, states, model };
}

test('B74: a server refusal reaches the state, with its code', () => {
	const { sync, states } = harness();
	sync.onMessage({ cmd: 'error', body: { message: 'commit rejected: bad', code: 'commit-rejected' } });
	const last = states.at(-1);
	assert.equal(last.said.text, 'commit rejected: bad');
	assert.equal(last.said.code, 'commit-rejected', 'the code was plumbed and never rendered before');
	assert.equal(last.said.err, true);
});

/*
The regression itself, stated as the thing that used to happen.

Every one of these emits used to erase the message, because none of them passed an `error` key and
the renderer had nothing to write. Now each carries the same `said` forward.
*/
test('B74: the message SURVIVES the next state emit, which is what it did not do', () => {
	const { sync, states } = harness();
	sync.onMessage({ cmd: 'error', body: { message: 'refused', code: 'nope' } });
	const before = states.length;
	sync.emitState({});
	sync.emitState({});
	sync.emitState({});
	assert.ok(states.length > before, 'the emits happened');
	for (const s of states.slice(before)) {
		assert.equal(s.said?.text, 'refused', 'a bare emitState must not erase what the server said');
		assert.equal(s.said?.code, 'nope');
	}
});

test('B74: the ORDINARY case speaks too, so a blank channel is not ambiguous', () => {
	// an errors-only surface is silent exactly when things work, which leaves "fine" and "not
	// listening" looking identical -- B71 and B72 both presented as inexplicable for that reason
	const { sync, states } = harness();
	sync.onMessage({ cmd: 'ack', body: { version: 7, ops: [] } });
	assert.match(states.at(-1).said.text, /accepted v7/);
	assert.equal(states.at(-1).said.err, false, 'routine events are not refusals');
});

test('B74: a later event REPLACES an earlier one rather than accumulating', () => {
	const { sync, states } = harness();
	sync.onMessage({ cmd: 'error', body: { message: 'first', code: 'a' } });
	sync.onMessage({ cmd: 'ack', body: { version: 2, ops: [] } });
	assert.match(states.at(-1).said.text, /accepted v2/);
	assert.equal(states.at(-1).said.err, false, 'and the refusal colour clears with it');
});

test('B74: nothing said yet is null, not an empty string pretending to be a message', () => {
	const { sync, states } = harness();
	sync.emitState({});
	assert.equal(states.at(-1).said, null);
});

test('B74: every emit carries the channel, so no call site can forget it', () => {
	// the fix is that `said` is assembled in emitState from Sync's own state rather than passed by
	// each caller. This asserts the shape rather than trusting the nine call sites.
	const { sync, states } = harness();
	sync.say('hello');
	sync.emitState({ diagrams: [] });
	sync.emitState({ rewound: { from: 3, to: 1 } });
	assert.ok(states.slice(-2).every((s) => s.said?.text === 'hello'),
		'a caller passing unrelated extras must not drop the channel');
});

/*
The RENDER half, checked structurally rather than by driving a browser.

The state tests above prove Sync carries the channel. They cannot prove anything is drawn, and the
two halves failing independently is exactly how B74 happened: the `code` was plumbed all the way to
`emitState` and then dropped on the floor because `main.js` destructured only `error`. So this
asserts the consumer takes what the producer sends, and that the element it writes to exists.
*/
test('B74: the renderer takes `said` and has somewhere to put it', async () => {
	const fs = await import('node:fs');
	const main = fs.readFileSync(new URL('../app/src/main.js', import.meta.url), 'utf8');
	const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
	const css = fs.readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');

	assert.match(main, /onState\(\{[^}]*\bsaid\b/, 'main must destructure said, which is what it failed to do for `code`');
	assert.match(main, /menu\.say/, 'and write it somewhere');
	assert.match(html, /id="server-say"/, 'the element exists');
	assert.match(css, /#server-say/, 'and is styled');

	// the code is RENDERED now, not merely carried -- B74's second half
	assert.match(main, /said\.code/, 'the code reaches the surface');

	// and it is not the readout: readout.js resolves one string for all mounts, so sharing it
	// would put server messages and gesture coordinates in contention
	assert.doesNotMatch(main, /readout[^\n]*\bsaid\b/, 'the durable channel must not be routed through the readout');
});
