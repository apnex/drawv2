/*
THE GRIDS ON THE PAGE (WD-b2, H19.46; dev/design/unification/WIDE-DEVICES.md section 12.4).

Each grid a part declares and some part places on (snap.js `gridsOf`), its dots drawn into the page layer it names, from the
open diagram -- a grid's lattice is opened from the Model's layout record, the layouts plugin's -- and drawn again when a diagram is
loaded. The canvas names no kind here; what a grid is and where its dots fall are its part's.

H26.4 (dev/design/components/VECTOR-SCENE.md section 5.1): each grid is one item of the scene's layer it names, keyed by its layout, removed
and put afresh as `replaceChildren` made its dots afresh, made by the scene -- a circle per point until H26.6's move 8, one path per tier
since (below). It makes no element.

H26.8's grid move (dev/design/components/NATIVE-SHAPES.md sections 3.1 to 3.3; B415): the `grids` part, its own duty, handed the grids it
draws -- `gridsOf(parts)`, the composition's to ask -- where it asked the canvas's places for them, so it imports nothing (GR7).

H26.6's move 8 (dev/design/components/PAN-ZOOM.md section 3.7, "The grid at each level"; PZ24, PZ13, GR2) -- EACH GRID DRAWN FROM THE VIEW.
Every lattice position the canvas shows is drawn, at every level, over the area in view grown by a margin of screen pixels on each
side, where every point within the old extent was drawn once at load. The composition hands `look()`, the view part's values for its
level, read at each draw: `tiers`, coarsest first, each `{ every, opacity }`; `dotScale`, the screen pixels a dot's drawing radius is
shown at -- the default scale over the level its radius is shown at, so a dot keeps on screen the size it has at 1x at every level,
or null where no view is laid out, a dot then drawn at its drawing radius; and `margin`, in screen pixels. Each grid lists one
lattice, the finest tier's kept -- `every` times its pitch through its own origin, so it holds every coarser tier's points -- and a point
takes the first tier whose `every` divides both its indices, counted from the lattice's own index 0, the origin on the device grid
and the zone grid's first corner half a square from it. No tier is left out by spacing; a faded tier is left out only where listing it
over the area drawn would pass `LISTING_MOST`, the finest first, its count found before it is listed as the product of its two axes'
-- each snap-grid's own count over a strip one row high -- and the full tier never: where it alone would pass, snap-grid doubles its
stride, anchored at the origin. Each tier is one path of round zero-length strokes, a stroke at each point (`dotsPath`), that does not
scale with the view (app/canvas.css): its width the dot's diameter on screen, twice the part's radius times `dotScale`, its opacity its
tier's where that is not full -- so at 1x each dot stands the size and place the circle drawn before the move did, its anti-aliased edge
alone rasterised otherwise. Circles whose radius followed the level were measured first and drew some twenty times slower at 3x
(PAN-ZOOM.md appendix B, move 8).

Drawn again only when what it showed would be wrong: the level's tiers, the dot's scale or the scene's scale changed, the diagram
loaded or its grid's size changed, or the area in view left the area drawn. The scene tells its view through `onView`, while it may
not be written (vector-scene VS17), so a redraw is asked of `schedule`, the composition's -- once a frame on a page, or at once when the
view part has set the view and the scene has finished telling it (app/src/compose-canvas.js, the move's verifier, L2) -- and runs once
however many views were told before it.
*/
const LISTING_MOST = 10000;   // PZ13, GR2: the most positions any listing of draw's holds
const ONE_FULL_TIER = Object.freeze([Object.freeze({ every: 1, opacity: 1 })]);
// with no view part composed: every dot full, at its drawing radius, over what is visible
const NO_VIEW = () => ({ tiers: ONE_FULL_TIER, dotScale: null, margin: 0 });

// how many positions of `lattice` lie in `area`: the product of its two axes' counts, each over a strip one row high through the lattice's
// origin, Infinity where an axis alone holds more than a listing may (snap-grid counts before it lists, SG6)
function countIn(lattice, area) {
	const { origin } = lattice.declaration;
	const axis = (region) => { const a = lattice.inView({ region, scale: 1 }, { max: LISTING_MOST }); return a.stride === 1 ? a.positions.length : Infinity; };
	return axis({ kind: 'rect', x: area.x, y: origin.y, w: area.w, h: 0 }) * axis({ kind: 'rect', x: origin.x, y: area.y, w: 0, h: area.h });
}

// one path of a zero-length stroke at each point, drawn round by its cap: a point on the row of the one before is a short relative move
function dotsPath(points) {
	let d = '', px = NaN, py = NaN;
	for (const p of points) {
		d += p.y === py ? `m${p.x - px} 0h0` : `M${p.x} ${p.y}h0`;
		px = p.x; py = p.y;
	}
	return d;
}

export class Grids {
	constructor({ scene, grids, model, look = NO_VIEW, schedule = (fn) => queueMicrotask(fn) }) {
		this.model = model;
		this.scene = scene;
		this.look = look;
		this.schedule = schedule;
		this.pending = false;
		this.drawn = grids.map((g) => {
			if (!scene.layers.some((l) => l.name === g.layer && !l.foreign)) throw new Error(`Grids: the ${g.layout} grid draws into #${g.layer}, which this page does not have`);
			return { g, layer: g.layer, at: null };
		});
		this.draw(true);
		// a load draws afresh; a grid's size changed by an edit, which no door admits until H26.6's move 15, is caught at the next draw by its
		// lattice, another for another pitch
		model.onChange((action) => { if (action === 'load') this.draw(true); });
		scene.onView(() => this.later());
	}

	// a redraw asked after the scene has told its view, once however many views it told
	later() {
		if (this.pending) return;
		this.pending = true;
		this.schedule(() => { this.pending = false; this.draw(false); });
	}

	// each grid drawn again where what it shows would be wrong -- or every grid, `force`
	draw(force) {
		const visible = this.scene.visible(), look = this.look();
		const { region: r, scale } = visible, m = look.margin / scale;
		for (const d of this.drawn) {
			const lattice = d.g.lattice(this.model);   // first, so a grid that cannot be read leaves the page as it was
			const at = d.at;
			const within = at && r.x >= at.area.x && r.y >= at.area.y && r.x + r.w <= at.area.x + at.area.w && r.y + r.h <= at.area.y + at.area.h;
			if (!force && within && at.lattice === lattice && at.scale === scale && at.tiers === look.tiers && at.dotScale === look.dotScale) continue;
			const area = { kind: 'rect', x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
			const { tiers } = look;
			let kept = tiers.length;
			while (kept > 1 && countIn(d.g.lattice(this.model, tiers[kept - 1].every), area) > LISTING_MOST) kept--;
			const every = tiers[kept - 1].every;
			const { positions } = d.g.lattice(this.model, every).inView({ region: area, scale }, { max: LISTING_MOST });
			const byTier = tiers.slice(0, kept).map(() => []);
			for (const { position, point } of positions) {
				const col = position.col * every, row = position.row * every;
				let t = 0;
				while (t < kept - 1 && (col % tiers[t].every !== 0 || row % tiers[t].every !== 0)) t++;
				byTier[t].push(point);
			}
			// the dot's diameter on screen: its drawing radius at the dot's scale, a stroke that does not scale with the view
			const width = 2 * d.g.r * (look.dotScale ?? scale);
			const shapes = byTier.flatMap((points, t) => (points.length ? [{ tag: 'path', attrs: { d: dotsPath(points), 'stroke-width': width,
				...(tiers[t].opacity !== 1 ? { opacity: tiers[t].opacity } : {}) } }] : []));
			this.scene.remove(d.layer, d.g.layout);
			if (shapes.length) this.scene.put(d.layer, d.g.layout, shapes);
			d.at = { area, lattice, scale, tiers: look.tiers, dotScale: look.dotScale, kept, listed: positions.length };
		}
	}
}
