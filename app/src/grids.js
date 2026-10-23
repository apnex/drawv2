/*
THE GRIDS ON THE PAGE (WD-b2, H19.46; dev/design/unification/WIDE-DEVICES.md section 12.4).

Each grid a part declares and some part places on (snap.js `gridsOf`), its dots drawn into the page layer it names, from the
open diagram -- a grid's `points` reads the Model, the layouts plugin's from the diagram's layout records -- and drawn again when
a diagram is loaded, never on an edit: a grid is a diagram's, and an edit cannot change one (WD7). The canvas names no kind here;
what a grid is and where its dots fall are its part's.

H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1): each grid is one item of the scene's layer it names, keyed by its layout, removed
and put afresh on each load as `replaceChildren` made its dots afresh -- a circle per point, made by the scene. It makes no element.
*/
import { gridsOf } from './snap.js';

export class Grids {
	constructor({ scene, parts, model }) {
		this.model = model;
		this.scene = scene;
		this.drawn = gridsOf(parts).map((g) => {
			if (!scene.layers.some((l) => l.name === g.layer && !l.foreign)) throw new Error(`Grids: the ${g.layout} grid draws into #${g.layer}, which this page does not have`);
			return { g, layer: g.layer };
		});
		this.draw();
		model.onChange((action) => { if (action === 'load') this.draw(); });
	}

	draw() {
		for (const { g, layer } of this.drawn) {
			const points = g.points(this.model);   // first, so a grid that cannot be read leaves the page as it was
			this.scene.remove(layer, g.layout);
			if (points.length) this.scene.put(layer, g.layout, points.map((pt) => ({ tag: 'circle', attrs: { cx: pt.x, cy: pt.y, r: g.r } })));
		}
	}
}
