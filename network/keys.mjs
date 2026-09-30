/*
The network plugin's KEYS -- its rows for the Rules engine (kernel/input-rules.mjs, dev/RULES.md section 11).

The director (2026-09-30): the Rules system is foundational to plugins, and a plugin's rules are the plugin's, "given
that it acts on capability that no other plugin would have awareness of". These are the two keystrokes that mean
something only because pipes exist. The product's table does not name them, and production composes no network
plugin, so in production neither means anything -- exactly as before, when both sat in the product's Input behind a
route hook that production never passed.

  g during a link drag        a GUIDE: the route passes this anchor and the link does not pin it. A node may be one,
                              since a pipe may end at a node (ruled 2026-09-30, "Each drag action does one thing")
  w on a node during a drag   a stop the link routes over, never a pin: a pin is always a waypoint. Released on it, the
                              node is the link's destination, reached with w (ruled 2026-09-30)

Each run asks the host for ONE thing, the product's generic drag step: add a stop, pinned or not. The host records
which key made it; what that step MEANS for pipes and links is the network's drag grammar, read when the drag ends.

`prevent: false` for the reason the product's `w` gives: the key is claimed only on the path that acts, and the run
claims it there.

THE SITUATION TERMS are the plugin's own, over the fields the host's situation documents (engine/situation.mjs):
`gesture` and `step`. The plugin cannot import the product's predicates, and should not -- it names what it asks.
*/
const plain = (e) => !e.ctrlKey && !e.metaKey && !e.altKey;
const is = (e, k) => e.key.toLowerCase() === k;
const drawingALink = (s) => s.gesture === 'link';
const overANode = (s) => s.step === 'node';

export const NETWORK_KEYS = [
	{ id: 'guide', prevent: false, mutates: true, duringGesture: true,
		on: (e) => is(e, 'g') && plain(e), when: drawingALink,
		run: (host, evt) => { evt.preventDefault(); host.addStop({ key: 'g', pin: false, nodes: true }); } },
	{ id: 'stop-on-node', prevent: false, mutates: true, duringGesture: true,
		on: (e) => is(e, 'w') && plain(e), when: (s) => drawingALink(s) && overANode(s),
		run: (host, evt) => { evt.preventDefault(); host.addStop({ key: 'w', pin: false, nodes: true }); } },
];
