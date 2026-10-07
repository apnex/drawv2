/*
The network plugin's KEYS -- its rows for the Rules engine (kernel/input-rules.mjs, dev/RULES.md section 11).

The director (2026-09-30): the Rules system is foundational to plugins, and a plugin's rules are the plugin's, "given
that it acts on capability that no other plugin would have awareness of". These are the two keystrokes that mean
something only because pipes exist. The product's table does not name them, and production composes no network
plugin, so in production neither means anything -- exactly as before, when both sat in the product's Input behind a
route hook that production never passed.

  g during a link drag        a GUIDE: the route passes this anchor and the link does not pin it. A node may be one,
                              since a pipe may end at a node (ruled 2026-09-30, "Each drag action does one thing")
  w on a node during a drag   a PIN, as on a waypoint (H19.10, Z1): a device that passes routes is a junction, and the drag
                              carries on through it; one that does not -- transit off, or a host -- is cut there by the
                              drag judge (TR-2b). Released on it, the node is the link's destination, reached with w
                              (ruled 2026-09-30)

Each run asks the host for ONE thing, the product's generic drag step: add a stop, pinned or not. The host records
which key made it; what that step MEANS for pipes and links is the network's drag grammar, read when the drag ends.

`prevent: false` for the reason the product's `w` gives: the key is claimed only on the path that acts, and the run
claims it there.

THE SITUATION TERMS are the plugin's own, over the fields the host's situation documents (engine/situation.mjs):
`gesture` and `step`. The plugin cannot import the product's predicates, and should not -- it names what it asks.
*/
import { dragFacts } from './grammar.mjs';
import { isAnchorWord } from '../model/anchor-words.mjs';   // the drawn word (F4)   // the bare anchor, asked in one place (F-b)
   // the bare anchor, asked in one place (F-b)

const plain = (e) => !e.ctrlKey && !e.metaKey && !e.altKey;
const is = (e, k) => e.key.toLowerCase() === k;
const drawingALink = (s) => s.gesture === 'link';
const overANode = (s) => s.step === 'node';

const anAnchorSelected = (s) => s.selection.kinds.some(isAnchorWord);   // the situation's words: node or waypoint (F4)

// the network's key rows; `session` is the network session the transit toggle acts on (absent where the rows are only read)
const networkKeys = (session) => [
	{ id: 'guide', input: ['g'], context: 'while drawing a link', doc: 'g during a link drag: a guide -- the route passes this anchor, placed or existing, node or waypoint, and the link does not pin it',
		prevent: false, mutates: true, duringGesture: true,
		on: (e) => is(e, 'g') && plain(e), when: drawingALink,
		run: (host, evt) => { evt.claimed = true; host.addStop({ key: 'g', pin: false, nodes: true }); } },
	{ id: 'stop-on-node', input: ['w'], context: 'over a node while drawing a link', doc: 'w on a node during a link drag: a pin, the node a junction if it passes routes, cut there if it does not; released on it, the node is the destination',
		prevent: false, mutates: true, duringGesture: true,
		on: (e) => is(e, 'w') && plain(e), when: (s) => drawingALink(s) && overANode(s),
		run: (host, evt) => { evt.claimed = true; host.addStop({ key: 'w', pin: true, nodes: true }); } },
	// TRANSIT (ruled 2026-09-28; TRANSIT.md section 12, X1): `x` flips each selected anchor's transit on its own -- `x` for
	// ergonomics, beside the wasd keys. Not during a drag: it is a declaration about anchors, not a step of a gesture
	{ id: 'transit', input: ['x'], context: 'anchors or nodes selected', doc: 'x: flip transit on each selected anchor or node -- off, links stop there and a dashed ring shows it; a host offers no choice',
		mutates: true, on: (e) => is(e, 'x') && plain(e), when: anAnchorSelected,
		run: (host) => session?.toggleTransit(host.selected()) },
];

/*
THE NETWORK, AS INPUT'S PLUGIN -- the one way to compose it into the product's Input: its keys above, and `judge` as its
judge of a finished link drag. Input hands over its record of the drag; the judge is handed the FACTS the grammar reads
(network/grammar.mjs `dragFacts`), so no composition -- the lab, or a test -- can hand it anything else.
*/
export function networkInput(judge, session = null) {
	return { owner: 'network', keys: networkKeys(session), judgeDrag: (record) => judge(dragFacts(record)) };
}

