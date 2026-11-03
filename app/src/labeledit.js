/*
LabelEditor — inline rename for nodes and zones. An HTML input positioned over
the entity's label; Enter/blur commits an undoable rename, Escape cancels.
*/

import { kindOf } from '../../model/model.mjs';
import { NAME_MAX, CONTENT_VALUE_MAX } from '../../model/limits.mjs';

// the caps are the model's, shared with the server rather than restated here (B86)

export class LabelEditor {
	// C-e: `labelAt(entity)` -- where a kind's label sits, the parts' (plugins/devices/device-labels.mjs); null for the default, by its corner
	// C-e: and `wordOf(kind, entity)` -- the word a Tab rename run groups by, the parts' (a device or a waypoint); the kind without one
	// and `contentOf(entity, idx)` -- what reads and edits an entity's region, the parts' (a panel's, the devices plugin's), or null
	// H26.4 (dev/design/components/VECTOR-SCENE.md sections 5.1 and 5.2; the verifier's F2): `scene`, the canvas's, whose `toScreen` places
	// the editor; `svg` stays for what is draw's own -- an element by id, its box, the screen's scale. H26.6's move 7 (PAN-ZOOM.md sections
	// 3.1 and 3.7): the screen's scale is the scene's view's, so `svg` went -- an element by id and its box are the page's
	// H26.8's capture move (dev/design/components/NATIVE-SHAPES.md section 3.2, the label editor's one exception): `edits`, the two edits
	// it commits -- `setFields(label, kind, id, after)` and `rename(kind, id, before, after)`, each answering the edit -- handed by the
	// composition where it imported the canvas's commands, so the label editor imports the document and the kind contract alone (GR7)
	constructor({ scene, model, history, edits, labelAt = () => null, wordOf = () => null, contentOf = () => null }) {
		this.labelAt = labelAt;
		this.contentOf = contentOf;
		this.wordOf = (kind, e) => wordOf(kind, e) ?? kind;
		this.scene = scene;
		this.model = model;
		this.history = history;
		this.edits = edits;
		this.input = null;
		this.offView = null;   // H26.6's move 7: while open, the editor follows the view (`follow`), and stops when it closes
		/*
		The entity the user last touched DIRECTLY — a press, a stamp, a drop. "Focus" here means
		that, not DOM focus (the editor's own input is `this.input`); the name is kept because
		`focusId` is already the codebase's word for it.

		It exists because F2 needs ONE target and a selection may hold several: group expansion makes
		single selection impossible for a grouped node, so "rename the selected thing" has no answer
		without knowing which one was actually clicked. It lived on Input, which wrote it from nine
		places and read it from none — INPUT.md §8 said it belongs to label editing, and this is that.
		*/
		this.focusId = null;
	}

	// record the directly-touched entity. Never validated on write: entities die (undo, chord
	// delete) and a stale id is harmless because openFocused only trusts one still in the selection.
	setFocus(id) {
		this.focusId = id;
	}

	/*
	F2 — open the rename editor on the best target in `ids`.

	Prefers the directly-touched entity when it is still selected, else the lone selection, else
	nothing. Links and groups are not renameable here and are filtered by the caller's selection.
	*/
	openFocused(ids) {
		const target = (this.focusId && ids.includes(this.focusId)) ? this.focusId : (ids.length === 1 ? ids[0] : null);
		if (target) this.open(kindOf(target), target);
	}

	isOpen() {
		return !!this.input;
	}

	// canvas coords -> viewport CSS pixels: the scene's conversion, through the root's screen transform at the moment asked -- the
	// arithmetic `new DOMPoint(x, y).matrixTransform(svg.getScreenCTM())` did (H26.4)
	toScreen(pos) {
		return this.scene.toScreen(pos);
	}

	/*
	H26.6's move 7 (dev/design/components/PAN-ZOOM.md section 3.7, "An open label editor") -- while it is open the editor listens through the
	scene's `onView` and is placed again, its font scaled again, at every view change, neither committing nor cancelling; the listener
	goes when it closes, and a window resize still closes it.
	*/
	follow(place) {
		place();
		this.offView = this.scene.onView(place);
	}

	open(kind, id) {
		if (this.input) this.close(false);
		const entity = this.model.get(kind, id);
		if (!entity) return;
		const at = this.labelAt(entity);   // under a device, centred; else beside the corner

		const input = document.createElement('input');
		input.id = 'label-editor';
		input.maxLength = NAME_MAX;
		input.spellcheck = false;
		input.value = entity.name || '';
		const width = 160;
		input.style.width = `${width}px`;
		// placed where the label is on screen, and again as the view moves (H26.6's move 7)
		const place = () => {
			const p = at ? this.toScreen({ x: at.x, y: at.y }) : this.toScreen({ x: entity.x + 10, y: entity.y + 6 });
			input.style.left = `${at?.centred ? p.x - width / 2 : p.x}px`;
			input.style.top = `${p.y}px`;
		};

		input.addEventListener('keydown', (evt) => {
			evt.stopPropagation();
			if (evt.key === 'Enter') this.close(true);
			if (evt.key === 'Escape') this.close(false);
			if (evt.key === 'Tab') {
				// rename run: commit and advance to the next same-kind entity
				evt.preventDefault();
				const next = this.neighbor(kind, id, evt.shiftKey ? -1 : 1);
				this.close(true);
				if (next) this.open(kind, next);
			}
		});
		input.addEventListener('blur', () => this.close(true));

		this.editing = { kind, id, before: entity.name || '' };
		this.input = input;
		this.follow(place);
		this.onResize = () => this.close(true); // fixed positioning detaches on resize
		window.addEventListener('resize', this.onResize);
		document.body.appendChild(input);
		input.focus();
		input.select();
	}

	// W6 — live input editing: edit a content region's value in place. Positioned over the clicked hit rect
	// (viewport coords); Enter/blur commits the new value into the node's content, Escape cancels.
	/*
	The element to anchor the editor on, found HERE -- the label editor owns the DOM it positions against, and the input
	layers name only what to edit (dev/design/input/GESTURE-SYSTEM.md, invariant G1).
	  openFrame(id)          a text box: its frame, or its group when it has none
	  openRegion(id, idx)    a run-mode input region of a node, by its index
	Neither opens anything when the element is not drawn.
	*/
	openFrame(nodeId) {
		const g = document.getElementById(nodeId);
		if (g) this.openContent(nodeId, 0, g.querySelector('[data-layer="frame"]') || g);
	}

	openRegion(nodeId, idx) {
		const g = document.getElementById(nodeId);
		const rect = g && g.querySelector(`[data-input][data-idx="${idx}"]`);
		if (rect) this.openContent(nodeId, idx, rect);
	}

	openContent(nodeId, idx, rectEl) {
		if (this.input) this.close(false);
		const entity = this.model.get(kindOf(nodeId), nodeId);
		const spec = entity && this.contentOf(entity, idx);
		if (!spec) return;
		const region = spec.valueOf(entity, idx);   // its value and alignment (C-e)

		const input = document.createElement('input');
		input.id = 'label-editor';
		input.maxLength = CONTENT_VALUE_MAX;
		input.spellcheck = false;
		input.value = region.value;
		// match the box EXACTLY so the editor doesn't appear to enlarge it: border/padding inside the rect
		// (border-box), the box's own width (no min), and the box's 15px SVG text scaled to the current zoom.
		// H26.6's move 7 (PAN-ZOOM.md sections 3.1 and 3.7): the zoom is the scene's view's scale, screen pixels to a drawing unit on draw's
		// root, which carries no CSS transform -- where it read the root's screen scale, which a viewBox set -- and the box and the scale
		// are read again as the view moves
		const place = () => {
			const box = rectEl.getBoundingClientRect();
			input.style.left = `${box.left}px`;
			input.style.top = `${box.top}px`;
			input.style.width = `${box.width}px`;
			input.style.height = `${box.height}px`;
			input.style.fontSize = `${15 * this.scene.view().scale}px`;
		};
		input.style.boxSizing = 'border-box';
		input.style.padding = '0 2px';
		input.style.textAlign = region.align;

		input.addEventListener('keydown', (evt) => {
			evt.stopPropagation();
			if (evt.key === 'Enter') this.close(true);
			if (evt.key === 'Escape') this.close(false);
		});
		input.addEventListener('blur', () => this.close(true));

		this.editing = { mode: 'content', nodeId, idx, before: region.value };
		this.input = input;
		this.follow(place);
		this.onResize = () => this.close(true);
		window.addEventListener('resize', this.onResize);
		document.body.appendChild(input);
		input.focus();
		input.select();
	}

	// next/previous same-kind entity in reading order (y, then x), wrapping
	neighbor(kind, id, dir) {
		const word = this.wordOf(kind, this.model.get(kind, id));
		const list = [...this.model.all(kind).filter((e) => this.wordOf(kind, e) === word)].sort((p, q) => (p.y - q.y) || (p.x - q.x));
		const i = list.findIndex((e) => e.id === id);
		if (i < 0 || list.length < 2) return null;
		return list[(i + dir + list.length) % list.length].id;
	}

	close(commit) {
		if (!this.input) return;
		// detach state BEFORE removing: removing a focused element fires blur
		// synchronously, and the blur handler re-enters close(true)
		const input = this.input;
		const editing = this.editing;
		this.input = null;
		this.editing = null;
		window.removeEventListener('resize', this.onResize);
		this.onResize = null;
		if (this.offView) { this.offView(); this.offView = null; }   // H26.6's move 7: no longer following the view
		input.remove();
		if (!commit) return;
		// W6 — content-region value edit (run mode)
		if (editing.mode === 'content') {
			const after = input.value.slice(0, 256);
			if (after === editing.before) return;
			const kind = kindOf(editing.nodeId), entity = this.model.get(kind, editing.nodeId);   // may have vanished (undo / diagram switch)
			const spec = entity && this.contentOf(entity, editing.idx);
			if (!spec) return;
			const edit = spec.edit(entity, editing.idx, after);   // the part's edit -- a copy of the regions (C-e)
			this.history.commit(this.edits.setFields(edit.label, kind, editing.nodeId, edit.after));
			return;
		}
		// rename a node / zone (Enter/blur)
		const { kind, id, before } = editing;
		const after = input.value.trim().slice(0, NAME_MAX);
		if (!after || after === before) return;
		if (!this.model.get(kind, id)) return;
		this.history.commit(this.edits.rename(kind, id, before, after));
	}
}
