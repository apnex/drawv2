/*
THE NETWORK'S LINK KEYS -- C-e, step seven (H19.33; dev/design/unification/CANVAS-PLUGINS.md; D5: a plugin's edits are data).

Five statements about links, each handed to the host's generic verbs:
  c        close or open the lone selected bent link -- a straight one would double back, so `c` on it says why instead
  f        cycle the lone selected link's declared direction: undeclared, forward, reverse, undeclared (H15.6)
  k        toggle the lone selected link between the control plane and the data plane (H15.15)
  l        link the selected devices in a chain, in selection order; Shift+L as a star from the first -- existing pairs
           skipped, including this batch's, the new links selected
RETURNING TO ABSENT REMOVES THE KEY: undeclared and the data plane are a link without `direction` or `control`, so clearing is
a whole-entity put of the link without the key -- a set carrying undefined would be refused by the schema and repaired by the
next reload (B220's shape). The selection line carries the direction and the plane, and redraws when the selected link
changes. These were app/src/keymap.js rows, app/src/input.js `toggleClosePath`, `cycleLinkDirection`, `toggleLinkPlane` and
`linkSelectedNodes`, and app/src/commands.js `toggleClosed`, `cycleDirection`, `toggleControl` and `linkNodes`.
*/

import { projection } from '../model/model.mjs';
import { isTypedEntity } from '../devices/device-shapes.mjs';
import { linkBetween, makeLink } from './link-queries.mjs';

const plain = (e) => !e.ctrlKey && !e.metaKey && !e.altKey;
const is = (e, k) => e.key.toLowerCase() === k;
const oneLink = (s) => s.selection.size === 1 && s.selection.kinds[0] === 'link';
// the lone selected link as the Model holds it, or null
const loneLink = (host) => {
	const sel = host.selected();
	return sel.length === 1 && sel[0].kind === 'link' ? host.ask((model) => model.get('link', sel[0].id)) ?? null : null;
};

// the link without one key -- how a declaration returns to absent (a whole-entity put)
const without = (link, key) => { const { [key]: _gone, ...rest } = link; return rest; };

// L / Shift+L: the new links, against a projection so the batch sees itself -- [a, b, a] links a and b once
const linksFor = (model, ids, star) => {
	const scratch = projection(model);
	const pairs = star ? ids.slice(1).map((n) => [ids[0], n]) : ids.slice(0, -1).map((n, i) => [n, ids[i + 1]]);
	const made = [];
	for (const [a, b] of pairs) {
		if (a === b || linkBetween(scratch, a, b)) continue;
		const link = makeLink(scratch, a, b);
		scratch.put('link', link);
		made.push(link);
	}
	return made;
};

const linkTheSelected = (star) => (host) => {
	const ids = host.selected().filter((e) => e.kind === 'node' && isTypedEntity('node', e)).map((e) => e.id);
	if (ids.length < 2) return;
	const made = host.ask((model) => linksFor(model, ids, star));
	if (!made.length) return;
	host.putAll(star ? 'star' : 'chain', made.map((entity) => ({ kind: 'link', entity })));
	host.select(made.map((l) => l.id));
	host.flash(`+${made.length} link${made.length > 1 ? 's' : ''}`);
};

export const LINK_KEYS = [
	{ id: 'close', input: ['c'], context: 'one link with a bend selected', mutates: true, doc: 'close or open the selected route',
		on: (e) => is(e, 'c') && plain(e), when: (s) => oneLink(s) && s.selection.bends > 0,
		run: (host) => {
			const link = loneLink(host);
			const closed = !link.closed;
			host.set(closed ? 'close path' : 'open path', 'link', link.id, { closed });
			host.flash(closed ? 'path closed' : 'path open');
		} },
	{ id: 'close-refused', input: ['c'], context: 'one link without a bend selected', mutates: true, doc: 'say why a straight link cannot close',
		on: (e) => is(e, 'c') && plain(e), when: (s) => oneLink(s) && s.selection.bends === 0,
		run: (host) => host.flash('\u2717 close needs a multi-hop route') },
	{ id: 'direction', input: ['f'], mutates: true, doc: 'cycle the selected link\'s direction: forward, reverse, none',
		on: (e) => is(e, 'f') && plain(e),
		run: (host) => {
			const link = loneLink(host);
			if (!link) return;
			if (link.direction !== 'forward' && link.direction !== 'reverse') host.set('direction forward', 'link', link.id, { direction: 'forward' });
			else if (link.direction === 'forward') host.set('direction reverse', 'link', link.id, { direction: 'reverse' });
			else host.put('direction cleared', 'link', () => without(link, 'direction'));
		} },
	{ id: 'plane', input: ['k'], mutates: true, doc: 'toggle the selected link\'s control plane (dashed; carries no data)',
		on: (e) => is(e, 'k') && plain(e),
		run: (host) => {
			const link = loneLink(host);
			if (!link) return;
			if (link.control) host.put('data plane', 'link', () => without(link, 'control'));
			else host.set('control plane', 'link', link.id, { control: true });
		} },
	{ id: 'chain', input: ['l'], mutates: true, doc: 'link the selected nodes in a chain',
		on: (e) => is(e, 'l') && plain(e) && !e.shiftKey, run: linkTheSelected(false) },
	{ id: 'star', input: ['Shift+L'], mutates: true, doc: 'link the selected nodes as a star',
		on: (e) => is(e, 'l') && plain(e) && e.shiftKey, run: linkTheSelected(true) },
];
