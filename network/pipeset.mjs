/*
The set of pipes an author has laid -- session state for the incubating network plugin.

INCUBATING (ruled 2026-09-28). A pipe will be stored in the document, and that is a stored-format
change which lands in ONE named batch, last, after the behaviour is proven (survey F6). Until then
pipes live here, in the session: the lab lays them, routes over them and draws them, and nothing is
written. So the product's documents are untouched by anything this module does, and a lab reload
starting from nothing is the correct behaviour rather than a missing feature.

WHAT IT OWNS: which pipes exist, and the two lifetimes the director ruled (2026-09-27):
  laid BY HAND        stays until the author deletes it
  laid WITH A LINK    removed once no link remains on it

It holds the set and answers questions about it. It does not route (that is `pipes.mjs`) and does
not draw (that is the lab's composition). A pipe is its pair (SD7), so the set is keyed by the pair
and a second pipe between one pair is not a second pipe -- it is the same one, laid again.

Pure data with no host object. Construct one per session; nothing is shared at module level, so two
sessions, two tests, or a lab and a future planner can each hold their own without leaking.
*/

import { pipeKey } from './pipes.mjs';

export function createPipeSet() {
	// key -> { a, b, laid: 'hand' | 'link' }
	const pipes = new Map();

	return {
		/*
		Lay a pipe between two anchors.

		Laying one that already exists is not an error and not a second pipe (SD7). But it can
		PROMOTE the lifetime: a pipe laid with a link and then laid again by hand becomes a hand pipe,
		because the author has now placed it deliberately. The reverse never happens -- a link laying
		over a hand pipe must not make it disposable, or deleting that link would remove geometry the
		author chose.
		*/
		lay(a, b, laid = 'hand') {
			if (a === b) return false;   // a pipe joins two anchors, never one to itself
			const key = pipeKey(a, b);
			const had = pipes.get(key);
			if (had) {
				if (laid === 'hand' && had.laid !== 'hand') pipes.set(key, { ...had, laid: 'hand' });
				return false;
			}
			pipes.set(key, a < b ? { a, b, laid } : { a: b, b: a, laid });
			return true;
		},

		remove(a, b) { return pipes.delete(pipeKey(a, b)); },
		has(a, b) { return pipes.has(pipeKey(a, b)); },
		list() { return [...pipes.values()]; },

		/*
		Remove every pipe laid with a link that no remaining link runs over -- the 2026-09-27 ruling,
		"They go - any pipes laid automatically with a link, will be removed when there are no links
		remaining. Only pipes manually placed remain without links."

		`routes` is the list of routes the remaining links take, each an array of anchor ids. A pipe
		is in use when some route steps across it, in either direction. Hand pipes are never swept.

		Returns the keys it removed, so a caller can say what went rather than leaving the author to
		notice conduit disappearing.
		*/
		sweep(routes) {
			const used = new Set();
			for (const r of routes) for (let i = 0; i < r.length - 1; i++) used.add(pipeKey(r[i], r[i + 1]));
			const removed = [];
			for (const [key, p] of pipes) {
				if (p.laid === 'link' && !used.has(key)) { pipes.delete(key); removed.push(key); }
			}
			return removed;
		},
	};
}
