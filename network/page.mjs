/*
THE NETWORK, COMPOSED INTO A PAGE -- the one way a page takes the network plugin (P5 V-b, H18.26; PAGE-COMPOSES-NETWORK.md
section 5.1). The lab and the product page both call it, so neither root wires the network itself: the lab root holds no
network orchestration (P5's exit criterion), and the page draws, judges and settles exactly as the lab does.

Two steps, because a page's canvas needs the network's input rows when it is composed and the network needs the canvas's
parts when it attaches:

  const page = createPageNetwork();
  const parts = composeCanvas({ ..., network: page.network, plugins: page.plugins });
  const net = page.attach({ model, renderer, selection, history, pipeLayer, el, say });

`network` is handed to the page's Model (where links run, which are down, what blocks them); `plugins` are its own keys and
its drag judge for Input (`g`, `x`, the network's drag grammar); `attach` returns the attached network (network/host.mjs):
`judge`, `answered`, `settled`, `refused`, `redraw`, `seed` and `paint`. The kinds stay the root's, since a page composes the
product's with the network's (`productKinds(...NETWORK_ROWS)`) and the product's are the planner's.
*/

import { createNetworkSession } from './session.mjs';
import { networkInput } from './keys.mjs';
import { attachNetwork } from './host.mjs';

export function createPageNetwork() {
	const session = createNetworkSession();
	let attached = null;
	return {
		session,
		network: session.network,
		// the drag judge is the attached network's, reached when a drag ends -- after `attach`, which follows the canvas
		plugins: [networkInput((drag) => attached.judge(drag), session)],
		attach(parts) {
			attached = attachNetwork({ session, ...parts });
			return attached;
		},
	};
}
