/*
LabelEditor — inline rename for nodes and zones. An HTML input positioned over
the entity's label; Enter/blur commits an undoable rename, Escape cancels.
*/

import { NODE_R } from './snap.js';
import * as commands from './commands.js';

const MAX_NAME = 64;

export class LabelEditor {
	constructor({ svg, model, history }) {
		this.svg = svg;
		this.model = model;
		this.history = history;
		this.input = null;
	}

	isOpen() {
		return !!this.input;
	}

	// canvas coords -> viewport CSS pixels
	toScreen(pos) {
		return new DOMPoint(pos.x, pos.y).matrixTransform(this.svg.getScreenCTM());
	}

	open(kind, id) {
		if (this.input) this.close(false);
		const entity = this.model.get(kind, id);
		if (!entity) return;

		const placement = kind === 'node'
			? this.toScreen({ x: entity.x, y: entity.y + NODE_R + 6 })
			: this.toScreen({ x: entity.x + 10, y: entity.y + 6 });

		const input = document.createElement('input');
		input.id = 'label-editor';
		input.maxLength = MAX_NAME;
		input.spellcheck = false;
		input.value = entity.name || '';
		const width = 160;
		input.style.width = `${width}px`;
		input.style.left = `${kind === 'node' ? placement.x - width / 2 : placement.x}px`;
		input.style.top = `${placement.y}px`;

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
		this.onResize = () => this.close(true); // fixed positioning detaches on resize
		window.addEventListener('resize', this.onResize);
		document.body.appendChild(input);
		input.focus();
		input.select();
	}

	// W6 — live input editing: edit a content region's value in place. Positioned over the clicked hit rect
	// (viewport coords); Enter/blur commits the new value into the node's content, Escape cancels.
	openContent(nodeId, idx, rectEl) {
		if (this.input) this.close(false);
		const node = this.model.get('node', nodeId);
		if (!node || !Array.isArray(node.content) || !node.content[idx]) return;
		const region = node.content[idx];
		const box = rectEl.getBoundingClientRect();

		const input = document.createElement('input');
		input.id = 'label-editor';
		input.maxLength = 256;
		input.spellcheck = false;
		input.value = region.value || '';
		// match the box EXACTLY so the editor doesn't appear to enlarge it: border/padding inside the rect
		// (border-box), the box's own width (no min), and the box's 15px SVG text scaled to the current zoom.
		const scale = (this.svg.getScreenCTM() || { a: 1 }).a;
		input.style.boxSizing = 'border-box';
		input.style.left = `${box.left}px`;
		input.style.top = `${box.top}px`;
		input.style.width = `${box.width}px`;
		input.style.height = `${box.height}px`;
		input.style.fontSize = `${15 * scale}px`;
		input.style.padding = '0 2px';
		input.style.textAlign = region.align || 'left';

		input.addEventListener('keydown', (evt) => {
			evt.stopPropagation();
			if (evt.key === 'Enter') this.close(true);
			if (evt.key === 'Escape') this.close(false);
		});
		input.addEventListener('blur', () => this.close(true));

		this.editing = { mode: 'content', nodeId, idx, before: region.value || '' };
		this.input = input;
		this.onResize = () => this.close(true);
		window.addEventListener('resize', this.onResize);
		document.body.appendChild(input);
		input.focus();
		input.select();
	}

	// next/previous same-kind entity in reading order (y, then x), wrapping
	neighbor(kind, id, dir) {
		const list = [...this.model.all(kind)].sort((p, q) => (p.y - q.y) || (p.x - q.x));
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
		input.remove();
		if (!commit) return;
		// W6 — content-region value edit (run mode)
		if (editing.mode === 'content') {
			const after = input.value.slice(0, 256);
			if (after === editing.before) return;
			const node = this.model.get('node', editing.nodeId);   // may have vanished (undo / diagram switch)
			if (!node || !Array.isArray(node.content) || !node.content[editing.idx]) return;
			this.history.commit(commands.setContentValue(this.model, editing.nodeId, editing.idx, after));
			return;
		}
		// rename a node / zone (Enter/blur)
		const { kind, id, before } = editing;
		const after = input.value.trim().slice(0, MAX_NAME);
		if (!after || after === before) return;
		if (!this.model.get(kind, id)) return;
		this.history.commit(commands.renameEntity(kind, id, before, after));
	}
}
