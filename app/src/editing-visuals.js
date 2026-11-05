/*
H26.4 (dev/design/components/VECTOR-SCENE.md sections 5.1 and 5.3; D7, D13) -- THE EDITING VISUALS, NATIVE: the crosshair, the stamp
ghost and the preview rect, line and path, each an item of the scene it is handed, keyed by what it is. Moved out of app/src/painter.js,
where each built elements into a layer element it was handed; the `editing` part's, and importing nothing -- the scene, the canvas's
extent and the snap box's size arrive as values, as the hand's preview does.

  crosshair    two `line.gridline` and one `rect.snapbox` in `snaplayer`, one item: put on the first show, kept and patched as it
               moves, removed on hide -- one owner still, the composition's (B36)
  ghostNode    the held item's preview, the hand's shapes as given, in a `g.node.ghost` of `overlay`: put last when made, patched as it
               follows the pointer and as the cell under it is blocked or free, removed when done (C-e, B318)
  previewRect, previewLine, previewPath    a gesture's preview in `overlay`: put last when made, patched as it follows, removed when done

Each preview is keyed by its kind and a serial, so the held tool's ghost, the palette's dragged tile and a gesture's preview never
share an item. Each element is made with its attributes in the order the old builders wrote them, and an attribute first written later
is added last, as the platform orders a kept element's, so the page's elements are what they were. Each class is written under a
`class` key, where the copy measure reads what a module draws (tools/copies.mjs, B373). Once removed, a visual writes nothing more, as
the old builders' writes landed on an element no longer in the page.
*/
let serial = 0;
const keyOf = (kind) => `${kind}/${++serial}`;

// v1's crosshair and cell-box snap feedback, on the snap layer
// H26.6's move 8 (dev/design/components/PAN-ZOOM.md sections 3.7 and 3.8): the lines span what the canvas shows, `visible()`'s region, where
// they spanned the old 1920 by 1080 surface -- the region kept from each view the scene tells, so a pointer's move reads no layout, and a
// crosshair shown put again for a new view, asked of `schedule` since the scene is not written while it tells (vector-scene VS17)
// H26.6's move 13 (3.9, "the crosshair's box, a square wide"): `gap` a number, or a function answering the diagram's square at each put
export function crosshair(scene, gap, { schedule = (fn) => queueMicrotask(fn) } = {}) {
	let at = null, pending = false, region = scene.visible().region;
	const square = typeof gap === 'function' ? gap : () => gap;
	const put = () => {
		const gap = square();
		scene.put('snaplayer', 'crosshair', [
			{ tag: 'line', attrs: { class: 'gridline', x1: at.x, y1: region.y, x2: at.x, y2: region.y + region.h } },
			{ tag: 'line', attrs: { class: 'gridline', x1: region.x, y1: at.y, x2: region.x + region.w, y2: at.y } },
			{ tag: 'rect', attrs: { class: 'snapbox', width: gap, height: gap, x: at.x - gap / 2, y: at.y - gap / 2 } },
		]);
	};
	scene.onView((visible) => {
		region = visible.region;
		if (!at || pending) return;
		pending = true;
		schedule(() => { pending = false; if (at) put(); });
	});
	return {
		show(pos) {
			at = pos;
			put();
		},
		hide() {
			if (at) scene.remove('snaplayer', 'crosshair');
			at = null;
		},
	};
}

/*
THE STAMP GHOST draws the held item's preview, the hand's (C-e, H19.33): what will be stamped, drawn from the numbers the device is
drawn with (B318). The preview is already shapes -- `{ tag, attrs, children }`, as app/src/painter.js `buildPreview` builds a palette
tile from the same declaration -- so it is the group's children as given.
*/
export function ghostNode(scene, preview) {
	const key = keyOf('ghost');
	let at = null, blocked = false, gone = false;
	const put = () => scene.put('overlay', key, [{ tag: 'g', attrs: { class: blocked ? 'node ghost blocked' : 'node ghost', ...(at ? { transform: at } : {}) }, children: preview }]);
	put();
	return {
		moveTo(pos) { if (gone) return; at = `translate(${pos.x},${pos.y})`; put(); },
		setBlocked(on) { if (gone) return; blocked = !!on; put(); },
		remove() { gone = true; scene.remove('overlay', key); },
	};
}

// a preview of one element in the overlay: made with `attrs`, each update writing what `write` answers over them
function preview(scene, kind, tag, attrs, write) {
	const key = keyOf(kind);
	let now = { ...attrs }, gone = false;
	scene.put('overlay', key, [{ tag, attrs: now }]);
	return {
		update(...args) { if (gone) return; now = { ...now, ...write(...args) }; scene.put('overlay', key, [{ tag, attrs: now }]); },
		remove() { gone = true; scene.remove('overlay', key); },
	};
}
export const previewRect = (scene, cls) => preview(scene, 'rect', 'rect', { class: cls, x: 0, y: 0, width: 0, height: 0 }, (box) => ({ x: box.x, y: box.y, width: box.w, height: box.h }));
export const previewLine = (scene) => preview(scene, 'line', 'line', { class: 'link-live' }, (p1, p2) => ({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }));
// a multi-segment route preview: an SVG path `d`, which the caller builds by the kernel's router so the preview matches the route
export const previewPath = (scene) => preview(scene, 'path', 'path', { class: 'link-live', fill: 'none' }, (d) => ({ d }));
