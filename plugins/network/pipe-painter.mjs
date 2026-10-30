/*
H26.8's pipes move (dev/design/components/NATIVE-SHAPES.md section 4.6, NS3; appendix B) -- THE NETWORK'S PIPE PAINTER: how a pipe is
drawn on the page, beneath the links routed over it.

It was the network's own drawer (plugins/network/host.mjs `paint`), a map of elements beside the renderer's, repainted on every model
change, on every mode change and at every settle, with a hook for the canvas's states; a pipe is a painted kind now, under the
renderer's one schedule (rule P, 4.6). The drawing is what that drawer made, in its structure and order:
  the item       a group, `.pipe-of`, naming its pipe (`data-pipe`), marked `under` while an up link runs over the pipe, which
                 plugins/network/network.css hides, line and hit line alike -- read off the network's one derivation (`occupiedOf`)
  its line       under the pipe's own id, so it is the state target (section 3.2): a selection, hover or arming lands on it, as the
                 network wrote `selected` there; its look the plugin's own (plugins/network/appearance.mjs `pipeAttributes`)
  its hit line   a HAND pipe's alone: an invisible line naming it (`data-select`), how the canvas picks a plugin's mark (app/src/pick.js),
                 so a hand pipe can be selected and deleted (N6, B281); a pipe laid with a link follows its links and is never offered
Null in run mode, whose picture holds no pipe (R-c, `RUN_PICTURE`), and with an end gone -- the planner removes such a pipe in the
same edit. Its pick is a mark (H26.8's picks move): the hit line alone answers, carrying `data-select`; the line and its group are open
ground to a press, as they were.

What invalidates a pipe beyond its own change (rule P): a node or a link changing (`dependsOn`) asks what the pipes share once -- the
pipes an up link runs over (`shared`, `occupiedOf`), identical while the network's derivation is the cached one -- and every pipe is
described again when that differs from the last asked; else only the pipes ending at a changed node (`touches`), since a pipe reads its
ends' places and the derivation's key holds no position. A mode change describes each (`modal`).
*/

import { pipeAttributes, pipeHitAttributes, RUN_PICTURE } from './appearance.mjs';
import { occupiedOf } from './network-queries.mjs';

const endsOf = (p, q) => ({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });

const PIPE_PAINTER = {
	kind: 'pipe',
	layer: 'pipes',
	stacked: false,
	// a hand pipe's mark, named by its hit line's `data-select` -- no word: selected, never a drawn word (H26.8's picks move; o:F2)
	picks: [{ mark: true, on: 'data-select' }],
	shapes(pipe, { model, mode, shared }) {
		if (mode === 'run' && !RUN_PICTURE.pipes) return null;
		const p = model.endpointOf(pipe.a), q = model.endpointOf(pipe.b);
		if (!p || !q) return null;
		const ends = endsOf(p, q);
		const children = [{ tag: 'line', attrs: { id: pipe.id, ...pipeAttributes(pipe.laid), ...ends, class: `pipe pipe-${pipe.laid}` } }];
		if (pipe.laid === 'hand') children.push({ tag: 'line', attrs: { class: 'pipe-hit', 'data-select': pipe.id, ...pipeHitAttributes(), ...ends } });
		return [['', { tag: 'g', attrs: { class: `pipe-of${shared.includes(pipe.id) ? ' under' : ''}`, 'data-pipe': pipe.id }, children }]];
	},
	modal: true,
	dependsOn: ['node', 'link'],
	shared: occupiedOf,
	touches: (pipe, changed) => pipe.a === changed.id || pipe.b === changed.id,
};

export const PIPE_PAINTERS = [PIPE_PAINTER];
