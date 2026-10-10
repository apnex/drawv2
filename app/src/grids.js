/*
THE GRIDS ON THE PAGE (WD-b2, H19.46; dev/design/unification/WIDE-DEVICES.md section 12.4).

Each grid a part declares and some part places on (snap.js `gridsOf`), its dots drawn into the page layer it names, from the
open diagram -- a grid's `points` reads the Model, the layouts plugin's from the diagram's layout records -- and drawn again when
a diagram is loaded, never on an edit: a grid is a diagram's, and an edit cannot change one (WD7). The canvas names no kind here;
what a grid is and where its dots fall are its part's.
*/
import { el } from './painter.js';
import { gridsOf } from './snap.js';

export class Grids {
	constructor({ svg, parts, model }) {
		this.model = model;
		this.drawn = gridsOf(parts).map((g) => {
			const layer = svg.querySelector(`#${g.layer}`);
			if (!layer) throw new Error(`Grids: the ${g.layout} grid draws into #${g.layer}, which this page does not have`);
			return { g, layer };
		});
		this.draw();
		model.onChange((action) => { if (action === 'load') this.draw(); });
	}

	draw() {
		for (const { g, layer } of this.drawn) {
			const points = g.points(this.model);   // first, so a grid that cannot be read leaves the page as it was
			layer.replaceChildren();
			for (const pt of points) el('circle', { cx: pt.x, cy: pt.y, r: g.r }, layer);
		}
	}
}
