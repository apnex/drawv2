/*
Input — pointer/keyboard state machine. Two-button gestures (`dev/DECISIONS.md` decision 2):
  click             select (Shift/Ctrl+click adds/toggles)
  left-drag node    create link (whole node is the source, crosshair ring)
  right-drag        move node/zone selection (snap on release)  [v1 convention]
  Ctrl+drag         clone selection subgraph (blue arming)      [draw.io / v1 lineage]
  Alt+right-click   delete entity under cursor (red arming)     [v1 chord, resurrected]
  drag empty        marquee select (passes through zones)
  Shift             the ZONE layer: zones are inert backdrop unless Shift is
                    held — Shift+click/drag selects/moves, Shift+drag on empty
                    canvas draws a zone (zone grid doubles as layer indicator)
  drag zone handle  resize selected zone (handles stay live once selected)
  drag link endpoint  re-plug: rewire that end of a selected link onto another node
  Shift mid-drag    ortho lock: constrain a move/clone to its dominant axis
  Shift at release  (link mode) chain wiring: continue the run from the target
  Space             set datum at cursor (readout goes relative); Shift+Space clears
  1-6 / Q           stamp hand: digit arms a node type (ghost at the snapped cell,
                    click stamps, Enter stamps at the ghost); Q pipettes the type
                    under the cursor (or clears); same digit / Esc / tile click drops;
                    click a DIFFERENT-type node to retype it in place (fast-replace)
  double-click/F2   edit label (Tab inside the editor renames the next entity)
  arrows            nudge selection one cell (coalesced undo)
  Shift+arrows      resize the lone selected zone, OR grow the lone selected node's span, one cell (NW-anchored, coalesced)
  Z                 wrap the selection in a fitted zone
  C                 close/open the selected multi-hop route (loops dst→src; toggles)
  L / Shift+L       link selected nodes: chain in selection order / star from the first
  Tab               toggle the numeric data-view overlay (every node's coords, link
                    lengths, zone dims — read-only, units follow the readout)
  Ctrl+D            duplicate the selection at the remembered pitch (last move/clone)
  Delete            delete selection      Ctrl+Z / Ctrl+Shift+Z|Ctrl+Y  undo / redo
  Ctrl+G / +Shift   group / ungroup       Ctrl+A                        select all
  Escape            cancel / clear / close overlay              ?       help overlay
*/

import { pathOf } from '../../network/network-queries.mjs';   // the network's questions over a Model (Q-a)
import { linksBetween, makeLink } from '../../network/link-queries.mjs';   // which links meet an anchor: the network's (K13d)
import { Overlay } from './overlay.js';
import { pressRows, hitFactsOf, DOUBLE_CLICKS } from './recognize.js';
import { KEYMAP, KEY_RELEASES } from './keymap.js';
import { composeRules, resolveInput } from '../../kernel/input-rules.mjs';
import { occupiedAnyAt, picksOf, pointsOf, grabbedAt, takenIn } from './pick.js';
import { inFootprint } from '../../devices/device-footprint.mjs';   // a text box's double-click hit -- C-e's labels step
import { CANVAS, GAP, HALF, NODE_R, NODE_EXT, ZONE_EXT, spanExtent, orthoDelta, snappedDelta, clampDelta, snapNode, snapIn, placesOf, resolveBox, pointInBox, dist } from './snap.js';
import { el, crosshair, previewRect, previewLine, previewPath, isShown, setShown, layerOf } from './painter.js';
import { emitToHost } from './capture.js';
import { initialInputState, track } from './input-state.js';
import { DRAG_THRESHOLD, dragging, releaseTrigger } from './triggers.js';
import { LINK_RELEASES, MARQUEE_RELEASES, CTRL_CLICKS, PRESS_DRAGS, CLONE_DRAGS } from './releases.js';
import { roundedPath } from '../../kernel/router.mjs';
import { BEND_R } from '../../kernel/spec.mjs';
import { newId, kindOf } from '../../model/model.mjs';
import { pairHolders } from '../../network/link-rules.mjs';
import * as commands from './commands.js';
import { situationOf } from '../../engine/situation.mjs';
import { waypointRolesIn } from '../../network/roles.mjs';
import { BARE_KIND, ANCHOR_KINDS } from '../../model/anchors.mjs';   // the bare anchor, asked in one place (F-b)
import { bareAnchor, bareAnchors, typedNodes, isTypedEntity } from '../../devices/device-shapes.mjs';
import { makeWaypoint } from '../../devices/make-node.mjs';   // the devices plugin's factories (O-e1)
import { waypointAt } from '../../devices/occupancy.mjs';   // which waypoint is on a cell: the devices plugin's (O-e1)


const ARROW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

// A1 — the node-frame rect spanning two snapped cell-centre points: the text-box draw preview + its
// footprint (origin cell + span counts). a click (a===b) → a 1×1 frame; a drag → the spanned frame.

/*
GESTURES — one entry per mode, one uniform shape (INPUT.md §7).

	start(input, hit, pos, evt) → ctx

`start` is all H6.4 unifies. `update`, `commit` and `cancel` still dispatch through the switches in
onMove / dispatchUp / cancelDrag; folding those in is the same shape of work and is deliberately a
separate step, because rewriting four dispatchers in one commit would leave nothing to bisect if the
net went red.

The bodies are the branches they replace, moved not rewritten. `move` and `clone` delegate to the
existing startMove/startClone, which already had this shape — the design was latent in three of ten
modes and this finishes it rather than imposing it.
*/
const GESTURES = {
	move: {
		update: (i, pos, evt) => i.updateMove(pos, evt.shiftKey),
		commit: (i, ctx, pos) => {
			i.overlayUi.crosshair.hide();
			// commit with the flag of the last RENDERED frame, never re-sampled: Shift may have
			// changed state since, with the pointer stationary
			i.commitMove(ctx, pos, ctx.orthoActive);
		},
		cancel: (i, ctx) => {
			ctx.moved.forEach((m) => i.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y }));
			i.overlayUi.crosshair.hide();
		}
	},

	clone: {
		update: (i, pos, evt) => i.updateMove(pos, evt.shiftKey),
		commit: (i, ctx, pos) => {
			i.overlayUi.crosshair.hide();
			i.commitClone(ctx, pos, ctx.orthoActive);
		},
		cancel: (i, ctx) => {
			[...ctx.clones].reverse().forEach((c) => i.model.del(c.kind, c.entity.id));   // uncommitted clones vanish entirely
			i.selection.clear();
			i.overlayUi.crosshair.hide();
		}
	},

	pending: {
		/*
		B203 -- a LEFT drag never moves a waypoint. Left is the link button on a waypoint, and the
		gesture it must not turn into is a move.

		Two rules produce this gesture: `r-press` on the right button and `press` on the left. The
		left one is the click-to-select path shared with every other kind, so a waypoint cannot
		simply leave it -- dropping out of `press` would take selection with it. What is suppressed
		is the ESCALATION: the press still selects, the drag just never becomes a move.

		`link` claims a left drag on a waypoint, as it does on a node -- B211 removed the FREE
		condition so a junction can be started from a bend. Before that, a waypoint carrying a link
		fell through to here, and the escalation turned the link button into the move button for
		exactly the waypoints that are part of a route. That was the defect the director reported.
		*/
		// what the drag becomes is a row (app/src/releases.js PRESS_DRAGS): B203, links, and a locked client by the guard
		update: (i, pos, evt) => i.escalate(pos, evt, 'pressDrag',
			// D4: what the press was on, by the plugins' facts -- something not placed (a link) never moves; an anchor whose left press
			// always draws a link (a waypoint, B203) never moves on a left drag
			{ unplaced: !i.hitFacts.get(i.ctx.hit.kind)?.placed && !i.ctx.hit.mark, onMark: !!i.ctx.hit.mark,
				linksOnLeft: !!(i.hitFacts.get(i.ctx.hit.kind)?.anchor && !i.hitFacts.get(i.ctx.hit.kind)?.clones), leftPress: !!i.ctx.leftPress }, 'move'),
		start: (i, hit, pos, evt) => {
			i.beginPress(hit, pos, evt.shiftKey && i.hitFacts.get(hit.kind)?.modifier !== 'shiftKey');   // Shift is the layer key of what it picks -- a zone -- not selection-add (D4)
			i.ctx.orthoReady = !evt.shiftKey;
			i.ctx.leftPress = evt.button === 0;   // which button opened this press; only the left one is barred above
			return i.ctx;
		}
	},

	'clone-pending': {
		// Ctrl+click without drag: toggle selection (draw.io behavior) -- app/src/releases.js CTRL_CLICKS
		commit: (i, ctx, pos, evt) => i.act(i.decide('ctrlClick', evt, { exists: !!i.model.get(kindOf(ctx.hit.id), ctx.hit.id) }), ctx),
		update: (i, pos, evt) => i.escalate(pos, evt, 'cloneDrag', {}, 'clone'),
		start: (i, hit, pos, evt) => ({ hit, start: pos, orthoReady: !evt.shiftKey })
	},

	/*
	C-d (H19.32; D2) -- THE SHARED HANDLE GESTURE: drag a handle of the lone selected entity, by what the plugin that declared the
	handle says (`handles`) -- where they are, and one of two previews:
	  reshape   what a drag to a point makes of the entity, written live to the shared Model (B7) and rewound at the end -- a
	            zone's corners, the box its readout
	  retarget  a preview line from the fixed anchor to the pointer or the device under it, the dragged entity marked -- a link's
	            ends
	On release the plugin says what it found (`released`), and its release rows say what that means -- the gesture commits
	nothing itself, so a plugin's handle reaches the document through its own rows (a zone's resize, a link's re-plug).
	*/
	handle: {
		commit: (i, ctx, pos, evt) => {
			const { spec } = ctx;
			let found;
			if (spec.preview === 'reshape') {
				const after = spec.at(ctx, pos);
				i.model.set(ctx.kind, ctx.id, { ...ctx.before });   // rewind the live preview; history owns the real edit
				found = spec.released(ctx, after, i.model);
			} else {
				i.endRetarget(ctx);
				found = spec.released(ctx, i.anchorAt(pos, spec.targets), i.model);   // what the handle lands on: its words (C-e)
			}
			i.act(i.decide(`handle:${ctx.kind}`, evt, found), { id: ctx.id, ...found });
			i.overlayUi.handles();   // the handles ride the (possibly new) entity
		},
		cancel: (i, ctx) => {
			// a cancelled gesture is a no-op: a reshape rewound, a retarget's preview dropped
			if (ctx.spec.preview === 'reshape') i.model.set(ctx.kind, ctx.id, { ...ctx.before });
			else i.endRetarget(ctx);
		},
		update: (i, pos) => {
			const { spec } = i.ctx;
			if (spec.preview === 'reshape') {
				const patch = spec.at(i.ctx, pos);
				i.model.set(i.ctx.kind, i.ctx.id, patch);   // live preview writes the shared Model (B7)
				i.readout.setBox(patch);
				return;
			}
			// the fixed end is anchored; the dragged end follows the cursor or the device it hovers
			const target = i.anchorAt(pos, spec.targets);
			i.ctx.line.update(i.ctx.fixed, target || pos);
			i.retarget(target, i.ctx.fixedId);
			i.readout.setLink(i.ctx.fixed.name || '?', (target && target.id !== i.ctx.fixedId) ? (target.name || '?') : snapNode(pos));
		},
		start: (i, hit, pos) => {
			const spec = i.handleWords.get(hit.kind);
			const id = spec && i.selection.list().find((x) => kindOf(x) === spec.kind);
			const entity = id && i.model.get(spec.kind, id);
			if (!entity) return null;
			const ctx = { kind: spec.kind, id, spec, ...spec.start(entity, hit.id) };
			if (spec.preview === 'retarget') {
				ctx.fixed = i.model.endpointOf(ctx.fixedId);   // an anchor is a node OR a waypoint (B29)
				if (!ctx.fixed) return null;
				i.renderer.setState(id, spec.dragState, true);   // de-emphasize the real one while its end is dragged
				ctx.line = previewLine(i.overlay);
				ctx.target = null;
				ctx.line.update(ctx.fixed, pos);
			}
			return ctx;
		}
	},



	link: {
		// only the LEFT button drives link mode: a right-button release during a chain (chord delete,
		// stray right-click) must never commit a segment. A precondition on the release, so it has to
		// run before the common teardown — hence its own slot rather than a line inside `commit`.
		ignoreUp: (evt) => evt.button !== 0,
		commit: (i, ctx, pos, evt) => {
			ctx.path.remove();
			if (ctx.target) i.renderer.setState(ctx.target, 'hover', false);
			const target = i.anchorAt(pos);
			const srcAlive = i.model.endpointOf(ctx.src.id);
			const hasVia = !!((ctx.route ?? ctx.via)?.length);   // a guided link is no more a plain link than a pinned one
			// a valid endpoint under the cursor: a node / free waypoint, distinct from src, not a via bend
			const validTarget = srcAlive && target && target.id !== ctx.src.id && !(ctx.route ?? ctx.via ?? []).includes(target.id);
			// resolve the destination: the endpoint under the cursor, ELSE end at the LAST dropped
			// waypoint — so releasing after `w` commits the route, terminating at that waypoint
			let dst = validTarget ? target.id : null;
			/*
			`route` is every stop drawn, pins and guides, in order; `via` is the pins alone, which is what the
			link stores. Released on empty ground, the link ends at the LAST STOP -- pin or guide alike, since
			a link cannot end without ending somewhere and its end is always a termination. With no plugin
			every stop is a pin, `route` equals `via`, and this is exactly the old `dst = via.pop()`.
			*/
			const route = [...(ctx.route ?? ctx.via ?? [])];
			const via = [...(ctx.via || [])];
			if (!dst && route.length) {
				dst = route.pop();
				const k = via.indexOf(dst);
				if (k !== -1) via.splice(k, 1);
			}
			/*
			B72 -- a ROUTED link may duplicate an existing pair; a straight one may not.

			The permission is grounded in the route, not in the pair. Two links carrying different
			bends fan out and are both visible, which is the whole point of placing a waypoint
			between two nodes. A second STRAIGHT link renders exactly on top of the first: allowing
			it would trade the silent discard this row was filed for against a silent duplicate,
			which is not an improvement.

			The design end state is up to N parallel connections bounded by the column span
			(`dev/design/walk/FINDINGS.md`, rung `3-parallel3`); that is H10.7 and needs spacing this
			does not attempt. This is the editor rule only.
			*/
			// B80: the refusal is about STRAIGHT links colliding, so it must ask whether a straight
			// one already exists -- not whether anything does. Keying it on `linkBetween` meant a
			// direct link became impossible the moment a routed one was drawn, which made the
			// order a person happened to draw in decide what they could have.
			// judged on every stop DRAWN, pins and guides: with no drag judge they are the same, and with one the judge
			// decides by pins itself (network/guide.mjs) -- the one predicate either way (RULESET-AUDIT T4)
			const admitted = !pairHolders({ src: ctx.src.id, dst, via: route }, linksBetween(i.model, ctx.src.id, dst), i.model).length;
			/*
			WHAT THE RELEASE MEANS is a row of app/src/releases.js LINK_RELEASES, chosen from these facts by the Rules engine:
			commit, commit and chain, chain on, a click that retypes, toggles, selects or focuses, or discard. The actions do
			what they are named. "A click at the drag's own start": for a press the second half follows from the first; a
			chained run is ended by a press elsewhere, and only one on its anchor selects it (ruled 2026-09-30).
			*/
			const hand = i.tools.hand ?? null;
			i.act(i.decide('link', evt, {
				dst: !!dst, dstIsSrc: dst === ctx.src.id, srcAlive: !!srcAlive, validTarget: !!validTarget, hasVia, admitted, judged: !!i.judgeDrag,
				click: evt.trigger === 'click', atStart: dist(pos, ctx.start) <= DRAG_THRESHOLD,
				shift: !!evt.shiftKey, ctrl: !!evt.ctrlKey, alt: !!evt.altKey, pressShift: !!ctx.shift,
				srcIsNode: i.handSpec?.itemOf(i.model.get('node', ctx.src.id)) != null, hand, handIsSrcType: hand !== null && hand === i.handSpec?.itemOf(ctx.src), chained: !!i.state.chained,
				srcSelected: i.selection.has(ctx.src.id),
			}), { ctx, pos, dst, via, route, target, validTarget });
		},
		cancel: (i, ctx) => {
			if (ctx.path) ctx.path.remove();
			if (ctx.target) i.renderer.setState(ctx.target, 'hover', false);
			i.cleanupRoute(ctx);
		},
		update: (i, pos) => {
			const target = i.anchorAt(pos);
			i.updateLinkPreview(pos);
			i.retarget(target, i.ctx.src.id);
			i.readout.setLink(i.ctx.src.name || '?', (target && target.id !== i.ctx.src.id) ? (target.name || '?') : snapNode(pos));
		},
		start: (i, hit, pos, evt) => {
			const src = i.model.get(kindOf(hit.id), hit.id);   // a hit names what is drawn; the id names how it is stored (F-c)
			i.renderer.setState(src.id, 'hover', false);   // capture swallows the boundary pointerout
			i.overlayUi.clearHover();
			const sole = i.selection.list();
			const srcKey = i.state.armed.source === src.id && sole.length === 1 && sole[0] === src.id ? 'w' : false;
			i.ctx = i.linkDrag(src, pos, { shift: evt.shiftKey, srcKey });
			i.updateLinkPreview(pos);
			return i.ctx;
		}
	},

	/*
	C-d (H19.32; D2) -- THE SHARED BOX GESTURE: a press opens a preview rect on the grid of the kind its row places, and the
	release's meaning is the opening row's own (`box.releases`) -- a zone over it, from the zones plugin's row.
	*/
	box: {
		commit: (i, ctx, pos, evt) => {
			ctx.rect.remove();
			const box = ctx.shape(ctx.p1, snapIn(ctx.place, pos));
			i.act(i.decide(ctx.releases, evt, { area: box.w > 0 && box.h > 0 }), box);
		},
		cancel: (i, ctx) => ctx.rect.remove(),
		update: (i, pos) => {
			const box = i.ctx.shape(i.ctx.p1, snapIn(i.ctx.place, pos));
			i.ctx.rect.update(box);
			i.readout.setBox(box);
		},
		// the row's box: the grid it snaps to, its preview's class, and its shape -- the rect two points span, or the row's own
		// frame (a text box's: the cells it spans, with a frame's margin)
		start: (i, hit, pos, evt, rule) => {
			const place = i.places.get(rule.box.place);
			const p1 = snapIn(place, pos);
			const ctx = { p1, place, shape: rule.box.frame ?? resolveBox, releases: rule.id, rect: previewRect(i.overlay, rule.box.preview) };
			if (rule.box.previewOnPress !== false) ctx.rect.update(ctx.shape(p1, p1));
			return ctx;
		}
	},


	marquee: {
		commit: (i, ctx, pos, evt) => {
			ctx.rect.remove();
			const box = resolveBox(ctx.p1, pos);
			// a click stamps the held type or clears; a drag selects or adds (app/src/releases.js MARQUEE_RELEASES)
			i.act(i.decide('marquee', evt, { click: evt.trigger === 'click', hand: !!i.tools.hand, shift: !!evt.shiftKey, ctrl: !!evt.ctrlKey, alt: !!evt.altKey }), { pos, box });
		},
		cancel: (i, ctx) => ctx.rect.remove(),
		update: (i, pos) => i.ctx.rect.update(resolveBox(i.ctx.p1, pos)),
		start: (i, hit, pos) => ({ p1: pos, rect: previewRect(i.overlay, 'marquee') })
	},


};

export class Input {
	/*
	`host` is the surface that owns GLOBAL key events and receives outbound host actions — `window` in
	the browser. Injected rather than reached for (B45): Input is the class H6 exists to decompose, and
	a module that grabs its own collaborators cannot be composed differently or tested without a global.
	`help` arrives the same way; main.js already had that element, and resolving it twice meant two
	owners of one node.
	*/
	constructor({ svg, model, history, selection, renderer, labels, readout, tools, host, help, snap, now, plugins = [], runRules = [], parts = [] }) {
		// C-c: the kinds placed on the grid, and how -- the canvas parts' (snap.js placesOf); C-d: their press rows and handles, below
		this.places = placesOf(parts);
		this.svg = svg;
		/*
		The route hook -- how the incubating network plugin (ruled 2026-09-28) sees a finished link drag
		before it commits. The lab passes one; production passes none, and then `g` is inert and every
		drag commits exactly as it always has (tests/guide-gesture.test.js holds that byte for byte).
		The hook is asked once per drag, for the WHOLE route: a guide is not in the link's intent, so
		whether the route passes it is a property of the whole route, not of any one leg.
		*/
		/*
		PLUGINS -- what a composition adds to the product's Input (dev/RULES.md section 11). A plugin brings its own key
		rows, owned by it and composed beside the product's, and may judge a finished link drag. Production passes none.

		Each run a plugin's row names is handed `pluginHost`, ONE generic verb -- add a stop to the drag, pinned or not --
		rather than this Input: a plugin acts through what the product declares, never through its internals. A plugin
		with anything else on it is refused, and so is a second judge: two judges of one drag would need a precedence.
		*/
		for (const p of plugins) {
			const stray = Object.keys(p).filter((k) => !['owner', 'keys', 'judgeDrag'].includes(k));
			if (typeof p.owner !== 'string' || stray.length) throw new Error(`Input: a plugin is { owner, keys, judgeDrag }${stray.length ? ` -- not ${stray.join(', ')}` : ' and names its owner'}`);
		}
		const judges = plugins.filter((p) => p.judgeDrag);
		if (judges.length > 1) throw new Error(`Input: two plugins judge the link drag (${judges.map((p) => p.owner).join(', ')}) -- one may`);
		this.judgeDrag = judges[0]?.judgeDrag ?? null;
		// the key table: the product's rows and each plugin's, through the Rules engine
		// C-e: a product row may phrase its help from the composition (`doc(parts)`, absent when it answers null); a canvas part
		// may bring key rows, as a plugin does -- the zones plugin's `z`
		const productKeys = KEYMAP.flatMap((r) => (typeof r.doc !== 'function' ? [r] : r.doc(parts) === null ? [] : [{ ...r, doc: r.doc(parts) }]));
		this.keyRules = composeRules({ owner: 'product', rules: productKeys }, ...plugins.map((p) => ({ owner: p.owner, rules: p.keys ?? [] })),
			...parts.filter((p) => p.keys).map((p) => ({ owner: p.owner, rules: p.keys })));
		// C-e: each kind's rank in a delete, its part's
		this.deleteRanks = commands.deleteRanksOf(parts);
		// C-e: what follows a clone, each part's, in rank order
		this.followers = commands.followersOf(parts);
		// C-e: what Shift+arrow makes of a lone selected entity, by kind -- each part's size step
		this.sizeSteps = new Map();
		for (const p of parts) if (p.sizeStep) {
			if (this.sizeSteps.has(p.sizeStep.kind)) throw new Error(`Input: ${p.sizeStep.kind}'s size step is brought by ${this.sizeSteps.get(p.sizeStep.kind).owner} and by ${p.owner}`);
			this.sizeSteps.set(p.sizeStep.kind, { ...p.sizeStep, owner: p.owner });
		}
		// declared verbs only, never Input: add a drag step; read the selection as plain data (id, kind, type, name)
		this.pluginHost = {
			addStop: (step) => this.addStop(step),
			// each selected entity as the model holds it, with its kind (a plugin reads the fields it owns -- the network, transit)
			selected: () => this.selection.list().map((id) => { const e = this.model.get(kindOf(id), id); return { ...(e ?? {}), id, kind: kindOf(id) }; }),
			// C-d: make an entity of a kind -- `make(model)` mints it -- commit its creation, and select it
			create: (kind, make) => { const e = make(this.model); this.history.commit(commands.createEntity(kind, e)); this.selection.set([e.id]); return e.id; },
			// C-d: set an entity's fields -- a handle's release: a zone's box, a link's ends -- as one labelled edit
			set: (label, kind, id, after) => this.history.commit(commands.setFields(label, kind, id, after)),
			// C-d: release the held tool -- the text tool, the one a press can hold -- and open the editor on a text box's frame
			releaseTool: () => this.tools.setTextTool(false),
			editFrame: (id) => this.labels.openFrame(id),
			// C-e: the bounds of the selected placed entities, each by what its place says its size is -- or null with none placed
			selectionBounds: () => this.selectionBounds(),
			// C-e: a brief receipt on the readout, and a size in its units
			flash: (text) => this.readout.flash(text),
			dims: (w, h) => this.readout.dims(w, h),
			// C-e (D5): a plugin's question over the Model, answered; an entity it made, put under its label; entities deleted
			ask: (question) => question(this.model),
			put: (label, kind, make) => this.history.commit(commands.putEntity(label, kind, make(this.model))),
			remove: (label, refs) => this.history.commit(commands.deleteEntities(label, this.model, refs)),
			// C-e (D5): several entities' fields set, as one edit -- the devices plugin's reshape
			setAll: (label, sets) => this.history.commit(commands.setFieldsAll(label, sets)),
			// C-e: the agreed instant; a point snapped to a place's grid; an entity made and committed, the selection untouched
			now: () => this.now(),
			snap: (place, pos) => snapIn(this.places.get(place), pos),
			add: (kind, make) => this.history.commit(commands.createEntity(kind, make(this.model))),
			// C-e (D5): several entities put as one edit, and the selection set -- the network's chained links
			putAll: (label, puts) => this.history.commit(commands.putEntities(label, puts)),
			select: (ids) => this.selection.set(ids),
		};
		// the pointer's tables on the same engine (stage 4): which gesture a press starts, a double click, a key release
		// C-d (H19.32): the product's press rows and each canvas part's -- a plugin's rows over the shared gestures (D2)
		// D4: what each drawn hit is -- placed, an anchor, cloned by Ctrl+left, picked under a modifier -- from the parts' picks and places
		this.hitFacts = hitFactsOf(picksOf(parts), this.places);
		// C-e: what each part's items cover at a point and in a box, in the parts' order; a link ends at an anchor
		this.points = pointsOf(parts);
		this.anchorWords = [...this.hitFacts].filter(([, f]) => f.anchor).map(([w]) => w);
		// C-e: the hand a part declares -- what can be held, how a held item stamps, what blocks it, retyping (devices/device-hand.mjs)
		const hands = parts.filter((p) => p.hand);
		if (hands.length > 1) throw new Error(`Input: a hand is brought by ${hands.map((p) => p.owner).join(' and by ')} -- one may`);
		this.handSpec = hands[0]?.hand ?? null;
		this.pressRules = composeRules({ owner: 'product', rules: pressRows(picksOf(parts), this.places) }, ...parts.map((p) => ({ owner: p.owner, rules: p.presses ?? [] })));
		this.doubleRules = composeRules({ owner: 'product', rules: DOUBLE_CLICKS });
		this.releaseRules = composeRules({ owner: 'product', rules: KEY_RELEASES });
		// K5: run mode's rows come from the composition root (app/src/run-mode.js via main.js); a composition without the
		// simulation passes none, and a run-mode press then means nothing
		this.runRules = composeRules({ owner: 'product', rules: runRules });
		// what each gesture MEANS when it ends, or when a press becomes a drag (stage 5, app/src/releases.js)
		this.meaningRules = Object.fromEntries(Object.entries({ link: LINK_RELEASES, marquee: MARQUEE_RELEASES, ctrlClick: CTRL_CLICKS,
			pressDrag: PRESS_DRAGS, cloneDrag: CLONE_DRAGS })
			.map(([name, rules]) => [name, composeRules({ owner: 'product', rules })]));
		// C-d: a plugin row opening a shared gesture brings what its release means, resolved under the row's own id
		for (const p of parts) for (const row of p.presses ?? []) {
			const releases = row.box?.releases;
			if (releases) this.meaningRules[row.id] = composeRules({ owner: p.owner, rules: releases });
		}
		// C-d: the handles a lone selected entity shows, by kind, from the canvas parts
		this.handles = new Map();
		this.handleWords = new Map();   // the hit word a press on a handle carries -> its declaration
		for (const p of parts) for (const h of p.handles ?? []) {
			if (this.handles.has(h.kind)) throw new Error(`Input: ${h.kind}'s handles are brought by ${this.handles.get(h.kind).owner} and by ${p.owner}`);
			if (!['reshape', 'retarget'].includes(h.preview)) throw new Error(`Input: ${p.owner}'s handles for ${h.kind} preview neither by reshape nor by retarget`);
			const spec = { ...h, owner: p.owner };
			this.handles.set(h.kind, spec);
			this.handleWords.set(h.word, spec);
			// what a handle's release means: the declaring plugin's rows, resolved under the kind's handle table
			this.meaningRules[`handle:${h.kind}`] = composeRules({ owner: p.owner, rules: h.releases ?? [] });
		}
		this.model = model;
		this.history = history;
		this.selection = selection;
		this.renderer = renderer;
		this.labels = labels;
		// A null object must be TOTAL or it is a trap: this one advertised that `readout` is optional
		// and then threw on `signed`/`dims`/`flash`, so Ctrl+D and the zone/box gestures were reachable
		// only with a real readout injected. Latent because main.js always passes one — found the first
		// time anything else constructed Input (the H2.1 harness). Keep in step with the call sites.
		this.readout = readout || { setCursor() {}, setDrag() {}, setBox() {}, setLink() {}, setDatum() {}, clearTransient() {}, render() {}, dims() { return ''; }, signed() { return ''; }, flash() {} };
		// the held tools (app/src/tools.js, K7) -- the stamp hand, the text tool and the hand's ghost. TOTAL, per the note
		// above, or `bare` construction throws on the first `t`; a composition that passes none holds nothing.
		this.tools = tools || { hand: null, textTool: false, readOnly: false, setHand() {}, toggleHand() {}, trackHand() {},
			hideHand() {}, setTextTool() {}, holding() { return false; }, releaseTools() {} };
		/*
		H12.4/H12.7 -- the agreed instant, injected as a FUNCTION rather than reached for.

		Input does not own a clock and must not know that one is negotiated with the server. It is
		handed `now` and asks it; the seam that makes the offset shared lives in `app/src/clock.js`
		and is wired by the composition root. Defaulting to the local clock keeps bare construction
		total, exactly as the readout and palette null objects above do -- a default that throws is
		a trap, and this tree has already paid for one.
		*/
		this.now = typeof now === 'function' ? now : () => Date.now();
		// L1: what the input has done, as one value -- the pointer, the armed `w`, a chain (app/src/input-state.js)
		this.state = initialInputState();
		this.overlay = layerOf(svg, 'overlay');
		// H6.3 — transient feedback is overlay.js's: hovered, armed, the datum marker and the
		// crosshair moved with it. Input keeps only what a GESTURE needs (mode, ctx, and the input state).
		this.overlayUi = new Overlay({ svg, model, selection, renderer, snap, handles: () => this.handles, hitFacts: () => this.hitFacts, points: () => this.points });   // C-d: the kinds' handles; D4: what each hit is
		this.mode = null; // null | pending | clone-pending | move | clone | link | zone | marquee | resize
		this.ctx = {};


		this.lastDelta = { x: GAP, y: 0 }; // remembered pitch for Ctrl+D duplicate
		this.readOnly = false; // Server-Locked: inspect + select only, no mutations
		// D12 — fires when an in-flight gesture ends, however it ends. Sync listens so inbound changes
		// deferred during the gesture replay at exactly the moment the preview stops moving (B19).
		this.onGestureEnd = () => {};
		this.help = help;

		selection.subscribe(() => {
			// a coalescing burst never spans a selection change — the window now lives in Changes
			// (D11), so the seam moved there with it rather than being dropped
			this.history.flush();
			this.overlayUi.handles();
			this.readout.render();
		});
		model.onChange((action, kind, entity) => {
			// zone resize handles + link endpoint handles track their entity's geometry
			if (this.handles.has(kind) || action === 'load') this.overlayUi.handles();   // C-d: a kind with handles -- a zone, a link
			// a gesture must not survive a document swap (chain mode has no held
			// button, so the header menu is reachable mid-gesture)
			if (action === 'load' && this.mode) this.cancelDrag();
			// hovered/armed state must die with its entity (chord delete, undo, load)
			if (action === 'del' || action === 'load') {
				if (this.overlayUi.hovered && (action === 'load' || entity.id === this.overlayUi.hovered)) {
					this.renderer.clearState(this.overlayUi.hovered, 'hover', 'linkband');
			
					this.overlayUi.disarm();
				}
				if (action === 'load' && this.labels.isOpen()) this.labels.close(false);
				if (action === 'load') {
					this.readout.setDatum(null);
					this.overlayUi.datum(null);
					this.tools.setHand(null); // the hand never survives a document swap
					this.readout.setCursor(null);
				}
			}
		});

		// the DOM listeners are capture's (app/src/capture.js, L0): this receives input events, never DOM events
		this.host = host;
	}

	// the pointer left the canvas: keys must never act on a stale off-canvas position
	leave() {
		this.readout.setCursor(null);
		this.tools.hideHand();
		this.state = track(this.state, { type: 'leave' });
	}

	// ---- hit helpers ----


	// a PREDICATE returns a boolean: this used to hand back `null` when idle, which is only
	// distinguishable from `false` at a call site that compares strictly — and D12's defer rule
	// is now such a caller (bindGestureDefer).
	isGesturing() {
		return !!this.mode && this.mode !== 'pending' && this.mode !== 'clone-pending';
	}

	// ---- pointer down ----
	// Server-Locked: a server-side controller owns writes; the browser can still
	// look, select, marquee, toggle the data view — but not mutate
	setReadOnly(on) {
		if (this.readOnly === on) return;
		this.readOnly = on;
		this.tools.readOnly = on;
		if (on) {
			// Every ARMED intent dies with the lock, not just the in-flight gesture. B42: `t` was
			// gated at the keypress but the text tool, once armed, outlived the lock and authored a
			// box on the next click — the branch sits above the read-only gate in onDown. Arming the
			// hand and arming the delete chord were already cleared here; the text tool was the one
			// held tool nobody added. That asymmetry is what H6's held-tool unification removes.
			if (this.mode) this.cancelDrag();
			this.tools.releaseTools();   // B42 — every armed tool, not a list someone has to maintain
			this.overlayUi.disarm();
		}
	}

	/*
	One press → one rule → one gesture. The 167-line nest this replaces is now three things: a
	surface-mode guard, a live-gesture hook, and an ordered table (app/src/recognize.js).
	*/
	press(evt) {
		// L1 first: every press moves the pointer, hands the armed `w` over, and ends a chain (app/src/input-state.js)
		this.state = track(this.state, evt);
		// W5 — RUN mode: the diagram ACTS as UI, and is not a gesture surface at all. A guard rather
		// than a rule, because it is a mode of the whole surface (INPUT.md §4).
		if (this.renderer.mode === 'run') return this.runModePress(evt);

		// chain wiring: the live gesture CONSUMES this press. Not a rule about starting one.
		if (this.mode === 'link' && evt.button === 0) return;   // the press already ended the chain (input state)

		if (this.labels.isOpen()) this.labels.close(true);
		this.tools.hideHand();

		/*
		THE w THAT PLACED THE SOURCE -- ruled 2026-09-30: it counts as the drag's first key "if that same anchor remains
		the sole selected anchor, and the next gesture is a drag". Every press consumes it -- the input state hands it from
		`armed.placed` to `armed.source` -- and the link drag's start keeps it only if it begins on that anchor while it is
		still the sole selection.
		*/
		const hit = evt.on;
		const pos = evt.at;
		// the ONE row this press means (Rules engine): read-only is the engine's guard, and a held tool is the situation's
		const { rule } = resolveInput(this.pressRules, evt, this.situation(), { readOnly: this.readOnly });
		if (!rule) return;

		if (this.mode) this.cancelDrag(evt);   // a second press never stacks on an active gesture
		this.overlayUi.zoneGrid(evt.shiftKey, false);
		evt.capture = true;   // capture takes the pointer once this returns (app/src/capture.js)

		if (rule.run) return this[rule.run](hit, evt, pos);
		const handler = GESTURES[rule.gesture];
		this.mode = rule.gesture;
		this.ctx = handler.start(this, hit, pos, evt, rule) || {};   // C-d: the row too -- a shared gesture reads what its row declares
	}


	/*
	H12.7 -- the situation this surface is in, as a VALUE.

	Everything transient is gathered here and nothing downstream reaches back for more. That is what
	lets a decision be a predicate rather than a walk through `this`: `engine/situation.mjs` owns the
	description, the rule reads it, and neither can see a DOM.
	*/
	situation(targetId = null, gesture = null) {
		return situationOf({
			get: (kind, id) => this.model.get(kind, id),
			rolesOf: (id) => waypointRolesIn(this.model, id),   // the one role derivation (K5), its transit included (B277)
		}, {
			mode: this.renderer.mode,
			readOnly: this.readOnly,
			targetId,
			selection: this.selection.list(),
			tool: !!this.tools.textTool,
			...(gesture ? { gesture, step: this.stepUnderPointer() } : {}),
		}, this.now());
	}

	/*
	RUN MODE -- the diagram acting as UI (W5): a press means what the situation says, through the Rules engine (stage 4).

	  toggle-spawn   in read view, on an endpoint waypoint: arm or disarm it. The PILOT rule -- the same click selects that
	                 waypoint in author view, which is B163 stated as a feature
	  place-tower    in read view, on open ground: place a tower, where the cell is free. The SECOND rule, the same shape --
	                 two instances are what made a pattern of it. Placement is intent and rides the document; a tower
	                 FIRING is derived by every peer from the board and the clock, so it never travels
	  fire-action    on a `data-action` region: hand the host `draw:action` (W5). It commits nothing, so it stays live on a
	                 locked client -- run mode straddles the gate
	  open-input     on a `data-input` region: open the inline editor. It authors, so a locked client does not (B18)

	Each authoring row is refused on a locked client by the engine's guard; each handler claims the press only on the path
	that acts. The rows are app/src/run-mode.js, handed in by the composition root (K5); the handlers are here.
	*/
	runModePress(evt) {
		const { rule } = resolveInput(this.runRules, evt, this.situation(evt.region?.waypoint ?? null), { readOnly: this.readOnly });
		if (!rule) return;
		// a plugin's row -- the simulation's spawner and tower (C-e) -- acts through the host; what it changed may move occupancy
		if (typeof rule.run === 'function') { rule.run(this.pluginHost, evt); this.afterHistory(); return; }
		this[rule.run](evt);
	}

	fireActionHere(evt) {
		evt.claimed = true;
		emitToHost(this.host, 'draw:action', { action: evt.region.action, id: evt.region.node });
	}

	openInputHere(evt) {
		evt.claimed = true;
		if (evt.region.node) this.labels.openRegion(evt.region.node, evt.region.input);
	}


	deleteUnderCursor(hit) {
		if (this.isGesturing()) return;
		// B258: `deleteSelection` takes a Set -- an Array threw on `ids.has` whenever the board held a link
		this.history.commit(commands.deleteSelection(this.model, new Set([hit.id]), this.deleteRanks));
		this.afterHistory();
	}


	beginPress(hit, pos, shift) {
		this.mode = 'pending';
		this.ctx = { hit, start: pos, shift };
		this.labels.setFocus(hit.id); // F2's deterministic target within group selections
		if (shift) {
			this.selection.toggle(hit.id);
		} else if (!this.selection.has(hit.id)) {
			this.selection.set([hit.id]);
		}
	}

	startMove(pos) {
		const moved = [];
		this.selection.list().forEach((id) => {
			const kind = kindOf(id);
			if (!this.places.has(kind)) return;   // C-c: a placed kind moves
			const entity = this.model.get(kind, id);
			if (entity) moved.push({ kind, id, before: { x: entity.x, y: entity.y } });
		});
		if (moved.length === 0) { this.mode = null; return; }
		const base = this.ctx.hit;
		this.mode = 'move';
		this.ctx = { ...this.ctx, moved, baseKind: base.kind, baseId: base.id };
	}


	/*
	Clone (Ctrl+drag): materialize the subgraph copy, then drag the copies;
	commit puts the final state into history.
	*/
	startClone(pos) {
		const hit = this.ctx.hit;
		// links can't anchor a clone; the entity may also have died mid-press (undo)
		if (!this.hitFacts.get(hit.kind)?.placed || !this.model.get(kindOf(hit.id), hit.id)) {   // only what is placed anchors a clone -- not a link (D4)
			this.mode = null;
			this.ctx = {};
			return;
		}
		if (!this.selection.has(hit.id)) this.selection.set([hit.id]);
		const result = commands.cloneSubgraph(this.model, this.selection.list(), this.places, this.followers);
		if (!result) { this.mode = null; this.ctx = {}; return; }
		const { clones, idMap } = result;

		// the clones come back inert. A drag has to SHOW them, so they go into the live model here —
		// I-IN5, live preview writes the shared Model. Ctrl+D never materialises them at all.
		clones.forEach((c) => this.model.put(c.kind, c.entity));

		// B311: every positioned copy moves with the drag -- a copied bend with its link -- as Ctrl+D moves them
		const moved = clones
			.filter((c) => this.places.has(c.kind))
			.map((c) => ({ kind: c.kind, id: c.entity.id, before: { x: c.entity.x, y: c.entity.y } }));
		const picked = this.selection.list().filter((id) => this.places.has(kindOf(id))).map((id) => idMap.get(id)).filter(Boolean);
		this.mode = 'clone';
		this.ctx = { ...this.ctx, clones, moved, baseKind: hit.kind, baseId: idMap.get(hit.id) };
		this.selection.set(picked);   // the copies of what was selected
	}

	/*
	Ctrl+D — duplicate the selected subgraph at the remembered pitch (the last
	committed move/clone delta this session, default one cell right). Clamps to
	the canvas; if both axes clamp to zero it refuses rather than overlap.
	*/
	duplicateSelection() {
		const seeds = this.selection.list().filter((id) => this.places.has(kindOf(id)));   // B30
		if (seeds.length === 0) return;
		// clamp the pitch against the ORIGINALS (clones start at the same spots)
		const refs = seeds.map((id) => {
			const kind = kindOf(id);
			const e = this.model.get(kind, id);
			return { kind, id, before: { x: e.x, y: e.y } };
		});
		const delta = clampDelta(this.model, refs, { ...this.lastDelta }, this.places);
		const cells = (v) => this.readout.signed(v / GAP);
		if (delta.x === 0 && delta.y === 0) {
			this.readout.flash(`✗ no room Δ[${cells(this.lastDelta.x)}, ${cells(this.lastDelta.y)}]`);
			return;
		}
		const result = commands.cloneSubgraph(this.model, seeds, this.places, this.followers);
		if (!result) return;

		// the clones are inert objects, so the pitch is applied to them directly. This used to put
		// them live, model.set each one, then read every position back out — three steps to do what
		// the commit does anyway.
		/*
		B311 -- EVERY POSITIONED COPY MOVES BY THE PITCH: an anchor with or without a device, and a zone. Only devices and zones
		did -- a filter from before waypoints were nodes (F-c) -- so a waypoint's copy, a bend's among them, stayed on its
		original's cell, the planner refused two anchors on one cell (B112), and nothing was copied while the readout said it was.
		*/
		result.clones.forEach((c) => {
			if (this.places.has(c.kind)) { c.entity.x += delta.x; c.entity.y += delta.y; }
		});
		const ops = this.history.commit(commands.cloneEntities(result.clones));
		if (!ops || ops.length === 0) { this.readout.flash(`✗ duplicate refused Δ[${cells(delta.x)}, ${cells(delta.y)}]`); return; }   // B311: a refusal is not a copy
		// the copies of what was selected
		const placed = seeds.map((id) => result.idMap.get(id)).filter(Boolean).map((id) => ({ entity: { id } }));
		this.selection.set(placed.map((c) => c.entity.id));
		this.afterHistory();
		this.lastDelta = delta; // tap-tap-tap repeats the same pitch
		this.readout.flash(`+${placed.length} cloned Δ[${cells(delta.x)}, ${cells(delta.y)}]`);
	}

	// the bounds of the selected placed entities -- a zone's box, a device's span (C-c places' `size`) -- or null with none (C-e)
	selectionBounds() {
		let x = Infinity, y = Infinity, x2 = -Infinity, y2 = -Infinity, boxed = 0;
		for (const id of this.selection.list()) {
			const kind = kindOf(id), place = this.places.get(kind), e = place && this.model.get(kind, id);
			if (!e) continue;
			const { w, h } = place.size(e);
			x = Math.min(x, e.x); y = Math.min(y, e.y); x2 = Math.max(x2, e.x + w); y2 = Math.max(y2, e.y + h);
			boxed++;
		}
		return boxed ? { x, y, x2, y2 } : null;
	}
	// ---- pointer move ----
	// a node already on this exact grid point (a stamp must never overlap) — engine occupancy index (R13)

	// stamp the held type at the snapped cell; refuses occupied cells
	// C-e: the held item stamped on its grid where it is not blocked, by the hand's declaration (devices/device-hand.mjs)
	stampAt(pos, item = this.tools.hand) {   // the held item -- or a palette tile's, dropped (C-e)
		const spec = this.handSpec;
		if (!item || !spec) return false;
		const cell = snapIn(this.places.get(spec.place), pos);
		if (spec.blocked(this.model, cell)) return false;
		const { kind, entity } = spec.stamp(this.model, item, cell);
		this.history.commit(commands.createEntity(kind, entity));
		this.selection.set([entity.id]); // the hand stays armed; selection follows
		this.labels.setFocus(entity.id);
		return true;
	}

	// a cell already holding a node OR a waypoint (a waypoint must not stack on either) — index (R13)

	// a waypoint with no link referencing it (endpoint or via) — free to become a link end / bend

	// a valid link endpoint under the cursor: a node, or a FREE waypoint (occupied ones can't take a link)

	// the held item cannot stamp on this cell -- the hand's own rule (a device stands there)
	handBlocked(snapped) {
		if (!this.tools.hand || !this.handSpec) return false;
		return this.handSpec.blocked(this.model, snapped);
	}

	// 'w' when idle: drop a standalone waypoint at the snapped cursor cell (empty cells only)
	placeWaypoint() {
		if (!this.state.pointer.at) return false;
		const snapped = snapNode(this.state.pointer.at);
		if (occupiedAnyAt(this.model, snapped)) return false;
		// a waypoint with no link: the sweep takes only what an edit orphaned, so it stays until deleted (`pinned`, B162, is
		// retired -- S-d, H18.14)
		const wp = makeWaypoint(this.model, snapped);
		this.history.commit(commands.createEntity(BARE_KIND, wp));
		this.state = track(this.state, { type: 'armed', id: wp.id });   // may count as the next drag's first key (see press)
		this.selection.set([wp.id]);
		this.labels.setFocus(wp.id);
		return true;
	}

	/*
	A link drag's context -- ONE shape, whichever way the drag began (B261: a chained drag lacked `route`, and `w` threw).

	`via` is what the link will STORE, its pins; `route` is every stop in drawn order, pinned or not, for the preview
	and a drag judge; `placed` holds the waypoints the drag put on the tab, committed on release or cleaned up. `steps`
	is the drag as it happened: each key that acted, and the stop it made -- what a plugin reads to know how its stops
	came to be, instead of flags set along the way. With no plugin every stop is a pin, so `route` is `via`.
	*/
	linkDrag(src, pos, { shift = false, srcKey = false } = {}) {
		return { src, path: previewPath(this.overlay), target: null, start: pos, shift, srcKey,
			via: [], route: [], placed: [], steps: [] };
	}

	/*
	A DRAG STEP -- the one verb a key uses to add a stop to the link being drawn: the product's `w`, and a plugin's
	keys through `pluginHost` (network/keys.mjs). What the step MEANS is not decided here; this places or threads an
	anchor and records which key made it.

	  key     the key that made the step, recorded in `steps`
	  pin     whether the stop joins `via` -- the link connects there -- or only the route it passes
	  nodes   whether a node may be the stop -- a pin may be one since H19.10: a device that passes routes is a junction, and
	          the plugin's judge cuts the drag at one that does not (TR-2b)

	An EXISTING anchor at the step is threaded; an empty cell gets a new waypoint, live so it renders, committed on
	release; a cell a node occupies is refused.
	*/
	addStop({ key, pin, nodes = false }) {
		if (!this.state.pointer.at) return;
		const ctx = this.ctx;
		const snapped = snapNode(this.state.pointer.at);
		const existing = waypointAt(this.model, snapped) ?? (nodes ? this.anchorAt(this.state.pointer.at) : null);   // occupancy index (R13)
		if (existing && pin) {
			if (existing.id === ctx.src.id) return;        // don't thread the source itself
			/*
			B210 -- an OCCUPIED waypoint may be threaded, and that is how a junction is made. Nothing splits here: the
			waypoint joins `via` like any other and the route carries on, so several bends in one drag still work. The
			split is computed on RELEASE, in commitRoute, because until the button comes up there is no link to make a
			junction with.
			*/
			if (!ctx.via.includes(existing.id)) { ctx.via.push(existing.id); ctx.route.push(existing.id); }
		} else if (existing) {
			if (existing.id === ctx.src.id || ctx.route.includes(existing.id)) return;
			ctx.route.push(existing.id);
		} else {
			if (occupiedAnyAt(this.model, snapped)) return;     // a taken cell -- refuse (no waypoint is on it, above: a device's)
			const wp = makeWaypoint(this.model, snapped);
			this.model.put(BARE_KIND, wp);            // live (visible); committed on release
			if (pin) ctx.via.push(wp.id);
			ctx.route.push(wp.id);
			ctx.placed.push(wp);
		}
		ctx.steps.push({ key, stop: existing ? existing.id : ctx.route[ctx.route.length - 1] });
		this.updateLinkPreview(this.state.pointer.at);
	}

	// the live route preview: a rounded polyline through src → threaded waypoints → cursor/target
	updateLinkPreview(pos) {
		const target = this.anchorAt(pos);
		const end = target ? { x: target.x, y: target.y } : snapNode(pos);
		// the cursor is a free ANCHOR — pathOf resolves the rest of the route around it
		// through every stop drawn so far, guides included, so the author sees the route they are drawing
		const path = pathOf(this.model, { src: this.ctx.src, via: this.ctx.route ?? this.ctx.via, dst: end });
		if (path) this.ctx.path.update(roundedPath(path, BEND_R));
	}

	/*
	Commit a finished route: the materialised waypoints + the link (with via) as ONE undo step.

	No eager put. This one made a single link, so it never had the batch-allocation problem the clone
	and chain paths had — it was writing the link live a line before `history.commit` re-put it
	through `applyOps` anyway. Verified redundant by removing it against a real route gesture (H6.11).
	*/
	// `extra`: the entries a drag judge adds (N-c), after the drag's own
	commitRoute(ctx, dstId, via, extra = []) {
		const link = { ...makeLink(this.model, ctx.src.id, dstId), ...(via && via.length ? { via: [...via] } : {}) };
		this.history.commit(commands.withJudged(commands.routeLink(ctx.placed, link), extra));
		this.selection.set([link.id]);
	}

	/*
	B210 -- a link landing on another's bend was cut here, by the browser's own copy of a planner rule (H17-D11). Deleted at
	V-c (H18.27): the planner's `junction-cut` (network/network.mjs) cuts at every door, each piece's id derived from the cut.
	*/

	// abandon an in-progress route: drop any waypoints placed during this draw
	cleanupRoute(ctx) {
		[...(ctx.placed || [])].reverse().forEach((wp) => this.model.del(BARE_KIND, wp.id));
	}

	/*
	One move → the live gesture's own `update`. The mode switch this replaces was eight branches
	deep; each is now the entry that owns the rest of that gesture's lifecycle.
	*/
	move(evt) {
		this.state = track(this.state, evt);
		const moving = this.mode === 'move' || this.mode === 'clone';
		this.overlayUi.zoneGrid(evt.shiftKey, moving);
		const pos = evt.at;

		if (!this.mode) {
			// idle: the stamp ghost rides the snapped cell and the readout states the landing
			const snapped = snapNode(pos);
			const blocked = this.handBlocked(snapped);
			this.tools.trackHand(snapped, blocked);
			this.readout.setCursor(snapped, this.tools.hand, blocked);
			return this.idleAffordance(evt);
		}
		GESTURES[this.mode].update?.(this, pos, evt);
	}

	// pending → move / clone-pending → clone: the escalation, and the SECOND gate point. A press is
	// not yet a mutation (INPUT.md §4), so `press` is mutates:false and the drag is where the
	// read-only decision actually has to be made.
	// highlight the entity a drag would land on, and un-highlight the one it left. Identical in the
	// link and replug updates, so it lives once.
	// the end of a retarget's preview: its line dropped, the hovered target and the dragged entity unmarked (C-d)
	endRetarget(ctx) {
		ctx.line.remove();
		if (ctx.target) this.renderer.setState(ctx.target, 'hover', false);
		this.renderer.setState(ctx.id, ctx.spec.dragState, false);
	}

	retarget(target, excludeId) {
		if (this.ctx.target && (!target || target.id !== this.ctx.target)) {
			this.renderer.setState(this.ctx.target, 'hover', false);
			this.ctx.target = null;
		}
		if (target && target.id !== excludeId) {
			this.ctx.target = target.id;
			this.renderer.setState(target.id, 'hover', true);
		}
	}

	escalate(pos, evt, table, facts, become) {
		if (!dragging(this.state)) return;   // not a drag yet: the one rule (triggers.js)
		const rule = this.decide(table, evt, facts);   // what the drag becomes, if anything (app/src/releases.js)
		if (!rule) return;
		this[rule.run](pos);
		if (this.mode === become) {
			// re-evaluate the layer indicator and render the first frame NOW, not on the next event
			this.overlayUi.zoneGrid(evt.shiftKey, true);
			this.updateMove(pos, evt.shiftKey);
		}
	}

	updateMove(pos, shiftHeld) {
		if (!shiftHeld) this.ctx.orthoReady = true;
		const ortho = !!shiftHeld && !!this.ctx.orthoReady;
		this.ctx.orthoActive = ortho;
		const rawDelta = orthoDelta(
			{ x: pos.x - this.ctx.start.x, y: pos.y - this.ctx.start.y }, ortho);
		// clamp live: out-of-bounds coordinates must never reach the model
		const delta = clampDelta(this.model, this.ctx.moved, rawDelta, this.places);
		this.ctx.moved.forEach((m) => {
			this.model.set(m.kind, m.id, {
				x: m.before.x + delta.x,
				y: m.before.y + delta.y
			});
		});
		const base = this.ctx.moved.find((m) => m.id === this.ctx.baseId) || this.ctx.moved[0];
		const raw = { x: base.before.x + delta.x, y: base.before.y + delta.y };
		const target = snapIn(this.places.get(base.kind), raw);   // C-c: on the base's own grid
		this.overlayUi.crosshair.show(target);
		this.readout.setDrag(target, {
			x: (target.x - base.before.x) / GAP,
			y: (target.y - base.before.y) / GAP
		});
	}


	// crosshair cursor + ring emphasis when idle over a node: left-drag draws a link
	idleAffordance(evt) {
		const hit = evt.on;
		if (hit.kind !== 'node') return;
		this.renderer.setState(hit.id, 'linkband', !evt.ctrlKey && !evt.altKey);
	}

	// ---- pointer up ----
	/*
	`onUp` returns early on almost every path — one per gesture mode — so a hook at the bottom fires
	for a marquee and nothing else. D12's release has to run however the gesture ended, so it is a
	wrapper rather than a line at the end, and it runs in a `finally`: a throwing commit handler must
	not strand the deferred queue forever, which would be a worse failure than the one it replaced.

	It fires AFTER dispatch, not before: a deferred remote change must land after this gesture's own
	commit, or the two arrive out of order.
	*/
	release(evt) {
		const wasGesturing = this.isGesturing();
		evt.trigger = releaseTrigger(this.state);   // L2: a click or a drop, from the press the input state tracked
		try { this.dispatchUp(evt); } finally {
			this.state = track(this.state, evt);   // the press is over
			if (wasGesturing) this.onGestureEnd();
		}
	}

	/*
	One release → the live gesture's own `commit`. The 168-line mode ladder this replaces ended with
	a trailing `onGestureEnd()` that only `resize` could reach, because every other branch returned
	early (B43). `onUp`'s `finally` is now the single owner of that hook, so it fires exactly once per
	gesture BY CONSTRUCTION rather than by fourteen branches each remembering to return. (`onUp` is `release` since
	stage 1 of the gesture system: capture hands it an input event.)
	*/
	dispatchUp(evt) {
		if (!this.mode) return;
		const g = GESTURES[this.mode];
		if (g.ignoreUp?.(evt)) return;   // a release this gesture does not accept: stay live
		const pos = evt.at;
		const ctx = this.ctx;
		this.mode = null;
		this.ctx = {};
		this.readout.clearTransient();
		this.overlayUi.refreshHover(pos);
		this.overlayUi.zoneGrid(evt.shiftKey, false);   // gesture over: the layer indicator follows Shift again
		g.commit?.(this, ctx, pos, evt);
	}

	/*
	THE ONE ROW a gesture's facts mean, from the named table (app/src/releases.js) -- read-only is the engine's guard, and
	nothing else here tests it. `act` runs the action the row names on the gesture's data; a release no row means does
	nothing (I6).
	*/
	// the composed tables, for what documents them (app/src/help.js): keys, presses, double clicks, run mode, and the
	// release outcomes that are controls of their own -- the help overlay is generated from exactly what is resolved
	bindings() {
		const m = this.meaningRules;
		return { keys: this.keyRules, presses: this.pressRules, double: this.doubleRules, run: this.runRules,
			releases: [...m.link, ...m.marquee, ...m.ctrlClick] };
	}

	decide(table, evt, facts) {
		return resolveInput(this.meaningRules[table], evt, facts, { readOnly: this.readOnly }).rule;
	}

	act(rule, data) {
		if (!rule) return;
		if (typeof rule.run === 'function') rule.run(this.pluginHost, data);   // a plugin's row acts through the host (C-d)
		else this[rule.run](data);
	}

	// ---- the actions a release names. Each does what it is named; the row decided that it applies. ----

	/*
	Commit the drawn link -- subject to the plugin's judge, when a plugin judges drags. The judge is handed the RECORD of
	the drag, as it happened; what it means is the judge's (network/grammar.mjs reads its facts from it). `release` says
	whether it was released ON an anchor or ended at the last stop a key made; `route` and `pins` are as the drag leaves
	them, the destination taken off. A refusal may name anchors to KEEP: they reach the planner in one commit, and
	everything else the drag placed is cleaned up, as a cancelled drag's is -- the director's report was a refused `g` drag
	throwing away the `g` anchor, geometry placed deliberately. True when the link was committed.

	H17.22 N-c -- A JUDGE MAY ADD ENTRIES to the commit it judges (`verdict.entries`): they ride after the drag's own, in its
	one undo step -- the network's pipes, laid with the link they belong to -- and with no commit of the drag's own (a
	refused drag that keeps nothing) they are committed alone. What the entries are is the judge's; Input names no kind.
	*/
	commitDrawnLink({ ctx, dst, via, route, validTarget }) {
		let verdict = null;
		if (this.judgeDrag) {
			verdict = this.judgeDrag({ src: ctx.src.id, dst, pins: via, route, placed: ctx.placed.map((w) => w.id),
				steps: ctx.steps, release: validTarget ? 'anchor' : 'stop', srcKey: ctx.srcKey ?? false });
			if (!verdict?.ok) {
				const keep = new Set(verdict?.keep ?? []);
				const kept = ctx.placed.filter((w) => keep.has(w.id));
				this.cleanupRoute({ placed: ctx.placed.filter((w) => !keep.has(w.id)) });
				const command = commands.withJudged(kept.length ? commands.keepAnchors(kept.map((w) => bareAnchor(this.model, w.id) ?? w)) : null, verdict?.entries);
				if (command) this.history.commit(command);
				return false;
			}
		}
		const extra = verdict?.entries ?? [];
		// the judge may cut the drawn link at stops it names (transit, TR-2b): the pieces, one undo step
		if (this.judgeDrag && verdict?.cutAt?.length) this.commitPieces(ctx, dst, via, route, verdict.cutAt, extra);
		else this.commitRoute(ctx, dst, via, extra);     // placed waypoints + the link, one undo step
		return true;
	}

	/*
	The drawn link as PIECES, cut at the stops a drag judge named: each piece runs from one cut (or an end) to the next,
	pinned at the drag's pins between them. One command, so one undo step; each piece's ends make their junction splits.
	*/
	commitPieces(ctx, dst, via, route, cutAt, extra = []) {
		const stops = [ctx.src.id, ...route, dst];
		const cuts = new Set(cutAt);
		const bounds = stops.map((id, i) => (i === 0 || i === stops.length - 1 || cuts.has(id) ? i : -1)).filter((i) => i >= 0);
		const links = [];
		for (let k = 0; k < bounds.length - 1; k++) {
			const inner = new Set(stops.slice(bounds[k] + 1, bounds[k + 1]));
			const pins = via.filter((p) => inner.has(p));
			const a = stops[bounds[k]], b = stops[bounds[k + 1]];
			links.push({ ...makeLink(this.model, a, b), id: newId('link', { ...this.model.collection('link'), ...Object.fromEntries(links.map((l) => [l.id, l])) }), ...(pins.length ? { via: pins } : {}) });
		}
		this.history.commit(commands.withJudged(commands.routeLinks(ctx.placed, links), extra));
		this.selection.set(links.map((l) => l.id));
	}

	// ...and carry the run on from the anchor it landed on, when it was committed (Shift, a plain link)
	commitDrawnLinkAndChain(d) {
		if (this.commitDrawnLink(d)) this.chainFrom(d.target, d.pos);
	}

	chainOnFromTarget({ target, pos }) { this.chainFrom(target, pos); }

	retypeClicked({ ctx }) {
		const r = this.handSpec.retype(this.tools.hand);   // the hand's own edit (C-e)
		this.history.commit(commands.setFields(r.label, r.kind, ctx.src.id, r.after));
		this.selection.set([ctx.src.id]);
		this.labels.setFocus(ctx.src.id);
	}

	toggleClicked({ ctx }) { this.labels.setFocus(ctx.src.id); this.selection.toggle(ctx.src.id); }
	selectClicked({ ctx }) { this.labels.setFocus(ctx.src.id); this.selection.set([ctx.src.id]); }
	focusClicked({ ctx }) { this.labels.setFocus(ctx.src.id); }
	discardDrawnLink({ ctx }) { this.cleanupRoute(ctx); }

	stampClicked({ pos }) {
		this.stampAt(pos);
		this.refreshHand();   // the cell is occupied now: feedback must say so
	}

	clearOnClick() { this.selection.clear(); }
	selectInBox({ box }) { this.selection.set(this.pickedIn(box)); }
	addInBox({ box }) { this.selection.add(this.pickedIn(box)); }

	// what a marquee box picks: what the parts say their items cover -- devices by footprint, waypoints by position, and a link
	// when BOTH its ends are picked (C-e). Zones are not marquee-pickable (the Shift layer); they are selected directly
	pickedIn(box) {
		return takenIn(this.points, this.model, box);
	}

	// the anchor at a point, by what the parts say their items cover: of the named words, or of any anchor (C-e)
	anchorAt(pos, words = this.anchorWords) {
		return grabbedAt(this.points, this.model, pos, words);
	}

	toggleCtrlClicked(ctx) {
		this.selection.toggle(ctx.hit.id);
		this.labels.setFocus(ctx.hit.id);
	}

	chainFrom(node, pos) {
		this.mode = 'link';
		this.state = track(this.state, { type: 'chained', at: pos });   // a chain began this drag, not a press (input state)
		this.ctx = this.linkDrag(node, pos);   // B261: the same drag context as any other
		this.updateLinkPreview(pos);
		this.readout.setLink(node.name || '?', snapNode(pos));
	}

	commitMove(ctx, pos, ortho) {
		ctx.moved = ctx.moved.filter((m) => this.model.get(m.kind, m.id));
		if (ctx.moved.length === 0) return;
		const delta = snappedDelta(this.model, ctx, pos, ortho, this.places);
		const moves = ctx.moved.map((m) => ({
			kind: m.kind, id: m.id,
			before: m.before,
			after: { x: m.before.x + delta.x, y: m.before.y + delta.y }
		}));
		// restore originals first so the command transition is exact (live drag mutated state)
		moves.forEach((m) => this.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y }));
		if (delta.x === 0 && delta.y === 0) return;
		this.history.commit(commands.moveEntities(moves));
		this.lastDelta = delta; // the demonstrated pitch feeds Ctrl+D
	}

	commitClone(ctx, pos, ortho) {
		ctx.moved = ctx.moved.filter((m) => this.model.get(m.kind, m.id));
		const delta = ctx.moved.length ? snappedDelta(this.model, ctx, pos, ortho, this.places) : { x: 0, y: 0 };
		ctx.moved.forEach((m) => {
			this.model.set(m.kind, m.id, { x: m.before.x + delta.x, y: m.before.y + delta.y });
		});
		if (delta.x !== 0 || delta.y !== 0) this.lastDelta = delta; // pitch for Ctrl+D
		// entities now carry final positions; the command snapshots them as puts
		const clones = ctx.clones.filter((c) => this.model.get(c.kind, c.entity.id))
			.map((c) => ({ kind: c.kind, entity: { ...this.model.get(c.kind, c.entity.id) } }));
		this.history.commit(commands.cloneEntities(clones));
		// the commit re-puts the clones, rebuilding their DOM: re-apply selection visuals
		this.afterHistory();
	}

	// zero the minor axis of a delta when the ortho lock is engaged


	// clamp a delta so every moved entity stays on the canvas

	// One abort → the live gesture's own `cancel`, then the same teardown a commit does. Reached by
	// pointercancel, Escape, and a document swap mid-gesture (a chain has no held button, so the
	// header menu is live during one).
	cancelDrag(evt) {
		if (evt && evt.type === 'cancel') this.state = track(this.state, evt);   // the browser took the pointer: no press
		GESTURES[this.mode]?.cancel?.(this, this.ctx);
		this.mode = null;
		this.ctx = {};
		this.readout.clearTransient();
		this.overlayUi.refreshHover(null);
		if (evt) this.overlayUi.zoneGrid(evt.shiftKey, false);
		this.onGestureEnd();
	}

	// ---- hover + arming ----


	// Alt arms red (delete), Ctrl arms blue (clone) on the hovered entity



	// after a hand change at idle: ghost and readout reflect it immediately
	refreshHand() {
		if (this.mode || !this.state.pointer.at) return;
		const snapped = snapNode(this.state.pointer.at);
		const blocked = this.handBlocked(snapped);
		if (this.tools.hand) this.tools.trackHand(snapped, blocked);
		this.readout.setCursor(snapped, this.tools.hand, blocked);
	}

	// datum marker: a small diamond-cross on the snap layer (pointer-inert)

	// ---- handles: zone corners (resize) and link endpoints (re-plug) ----

	// ---- label editing ----
	double(evt) {
		const { rule } = resolveInput(this.doubleRules, evt, this.situation(), { readOnly: this.readOnly });
		if (rule) this[rule.run](evt);
	}

	// the `edit-label` binding: a locked client never reaches here -- the engine's guard refuses it (app/src/recognize.js)
	editUnderPointer(evt) {
		// hit GEOMETRICALLY: pointer capture (taken on every press) retargets the
		// browser-synthesized dblclick to the svg, so what capture says is under it is useless here.
		// Icon hits beat label-strip hits; nearest wins; ties go to the topmost
		// (last-rendered) — the strip is wider than a grid cell, so first-match
		// would resolve to a NEIGHBOUR for nodes one cell apart
		const pos = evt.at;
		// A1 — a TEXT BOX is hit by its whole FOOTPRINT (not just the origin cell), so double-clicking ANYWHERE
		// on the box edits its text. (A plain node / panel still routes to the name-edit / icon test below.)
		const tbs = this.model.all('node').filter((n) => Array.isArray(n.content) && n.content.length === 1 && n.content[0].content === 'text'
			&& inFootprint(n, pos, NODE_R));
		const tb = tbs[tbs.length - 1]; // topmost (last-rendered)
		if (tb) {
			if (this.mode) this.cancelDrag(evt);
			this.selection.set([tb.id]);
			this.labels.setFocus(tb.id);
			return this.labels.openFrame(tb.id);
		}
		const nodes = typedNodes(this.model);
		const best = (cands) => cands.sort((p, q) => p.d - q.d || q.i - p.i)[0];
		const icon = best(nodes.map((n, i) => ({ n, d: dist(n, pos), i }))
			.filter((c) => c.d <= NODE_R + 4));
		const strip = icon ? null : best(nodes.map((n, i) => ({ n, d: Math.abs(pos.x - n.x), i }))
			.filter((c) => c.d <= 75 && pos.y - c.n.y >= NODE_R && pos.y - c.n.y <= NODE_R + 28));
		const node = (icon || strip) && (icon || strip).n;
		let target = node ? { kind: 'node', id: node.id } : null;
		if (!target) {
			const zones = this.model.all('zone').filter((z) =>
				pointInBox(pos, { x: z.x, y: z.y, w: z.w, h: z.h }));
			const zone = zones[zones.length - 1]; // topmost
			if (zone) target = { kind: 'zone', id: zone.id };
		}
		if (!target) return;
		if (this.mode) this.cancelDrag(evt);
		// rename implies selection: handles/readout/F2 follow the edited entity
		this.selection.set([target.id]);
		this.labels.setFocus(target.id);
		this.labels.open(target.kind, target.id);   // name edit (text boxes are handled by the footprint check above)
	}




	// ---- help overlay ----
	toggleHelp(show) {
		if (!this.help) return;
		setShown(this.help, show === undefined ? !isShown(this.help) : show);
	}

	// ---- keyboard ----
	/*
	One keystroke → one entry → one handler. The 243-line ladder this replaces had three guards
	interleaved at different depths, so whether a key worked depended on which of them it happened to
	sit below (INPUT.md §4). Each entry now declares its own tolerances and the dispatcher applies
	them uniformly.
	*/
	keyDown(evt) {
		// typing contexts (header menu, label editor) never reach here: capture keeps them (app/src/capture.js)
		// the Rules engine finds the ONE row this key means in this situation (dev/RULES.md section 11)
		const { rule, claimed } = resolveInput(this.keyRules, evt, this.situation(null, this.mode), {
			readOnly: this.readOnly,
			helpOpen: !!(this.help && isShown(this.help)),
			gesturing: this.isGesturing(),
		});
		if (claimed) evt.claimed = true;   // B47 — bind a key and you own it
		if (!rule) return;
		if (typeof rule.run === 'function') rule.run(this.pluginHost, evt);   // a plugin's row acts through the host
		else this[rule.run](evt);
	}

	/*
	What the pointer is over during a gesture, as the situation's `step` -- a word, never an element.

	The order is production's own for a `w` mid-drag (`addStop`): a waypoint at the snapped cell first, then a
	node under the pointer. A node's footprint runs between grid points with a margin under half the pitch, so a pointer
	over a node always snaps to a cell that node occupies -- the cell where production's `w` already refuses -- and
	calling that step 'node' changes nothing production does (tests/rules-acceptance.test.js holds the geometry).
	*/
	stepUnderPointer() {
		if (!this.state.pointer.at) return null;
		if (waypointAt(this.model, snapNode(this.state.pointer.at))) return 'waypoint';
		return this.anchorAt(this.state.pointer.at) ? 'node' : 'ground';   // no waypoint on the cell, above: a device's
	}

	// ---- key handlers. Bodies unchanged from the ladder; only their dispatch moved. ----

	onShiftDown(evt) {
		if (this.mode === 'move' || this.mode === 'clone') {
			// re-render the drag NOW: the commit follows the last rendered frame
			if (this.state.pointer.at) this.updateMove(this.state.pointer.at, true);
		} else {
			this.overlayUi.zoneGrid(true, false);
		}
	}

	onArmingKey(evt) {
		if (evt.key === 'Alt') evt.claimed = true;   // keep Firefox's menu bar out of the delete chord
		this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	// W4/W5 — 'e' toggles EDIT (shows the socket grid), 'r' toggles RUN (content regions act).
	// Either key from its own mode returns to the clean VIEW.
	onEditMode() { this.renderer.setMode(this.renderer.mode === 'edit' ? 'view' : 'edit'); }
	onRunMode() { this.renderer.setMode(this.renderer.mode === 'run' ? 'view' : 'run'); }

	// Tab shows or hides names. It used to toggle a numeric overlay of every coordinate, which was
	// deleted rather than rebound: it was never properly useful, and carrying it forward would have
	// meant keeping an X-ray nobody read to avoid admitting that.
	onLabels(evt) {
		// claim Tab only when the canvas holds focus, so it can still traverse the toolbar. B47
		// records this as a deliberate opt-out from the dispatcher's default claim, and changing
		// the verb behind the key is no reason to change what the key does to focus.
		if (evt.onControl) return;
		evt.claimed = true;
		this.renderer.toggleLabels();
	}

	onEscape(evt) {
		// priority: close help > cancel gesture > disarm the tool > clear hand > clear selection
		if (this.help && isShown(this.help)) return this.toggleHelp(false);
		if (this.mode) this.cancelDrag(evt);
		else if (this.tools.textTool) this.tools.setTextTool(false);
		else if (this.tools.hand) {
			this.tools.setHand(null);
			this.readout.setCursor(this.state.pointer.at ? snapNode(this.state.pointer.at) : null);
		} else this.selection.clear();
	}

	onHelpKey() {
		  // keep Firefox's quick-find out of it
		this.toggleHelp();
	}

	onSelectAll() {
		this.selection.set([
			...typedNodes(this.model).map((n) => n.id),
			...this.model.all('zone').map((z) => z.id),
			...this.model.all('link').map((l) => l.id)
		]);
	}

	onDatum() {
		if (!this.state.pointer.at) return;   // pointer off-canvas: nothing to anchor
		const datum = snapNode(this.state.pointer.at);
		this.readout.setDatum(datum);
		this.overlayUi.datum(datum);
	}

	onDatumClear() {
		this.readout.setDatum(null);
		this.overlayUi.datum(null);
	}

	// 'w' drops/threads a waypoint: mid-route it adds a bend (the button is still held), idle it
	// places a standalone one. The one mutating verb that belongs DURING a gesture.
	onWaypointKey(evt) {
		if (this.mode === 'link') { evt.claimed = true; return this.addStop({ key: 'w', pin: true }); }
		if (!this.mode) { evt.claimed = true; this.placeWaypoint(); }
	}

	// A1 — tap to ARM/disarm the text tool. A toggle, not a held key; auto-repeat ignored.
	onTextTool() {
		this.tools.setTextTool(!this.tools.textTool);
	}

	// ---- the stamp hand, and mid-drag chaining. ----
	onHandDigit(evt) {
		// B146: no `7` branch. The waypoint left the palette because it is a routing anchor rather
		// than a node type, and `w` already places one in both states.
		const type = this.handSpec?.items[Number(evt.key) - 1];   // C-e: the hand's nth item
		if (!type) return;
		// B147: mid-link-drag a digit CREATES that node and carries the run through it
		if (this.mode === 'link') { evt.claimed = true; return this.chainThroughNode(type); }
		if (this.mode) return;
		this.tools.toggleHand(type);
		this.refreshHand();
	}

	/*
	B147 -- place a node mid-drag, end the segment on it, and carry the run on from it.

	A link run could already chain, but only through nodes that ALREADY existed: `chainFrom` restarts
	link mode from whatever the release landed on. So drawing `client -> firewall -> lb -> server`
	was four placements and three separate drags, when the shape is one continuous gesture.

	Deliberately NOT what `w` does. A waypoint threads into the SAME link as a bend -- it is a shape
	in one connection. A node TERMINATES the segment and starts another, because a device is a thing
	the path goes through rather than a corner it turns.

	Per-segment commit, matching `chainFrom` on Shift-release rather than inventing a second
	transaction shape: each hop is its own undo step, which is also what a person expects when they
	undo halfway along a run they are still drawing.
	*/
	chainThroughNode(type) {
		if (!this.state.pointer.at) return;
		const snapped = snapNode(this.state.pointer.at);
		// the same refusal `addStop` makes, for the same reason: a taken cell is taken
		if (!this.handSpec || this.handSpec.blocked(this.model, snapped)) return;   // the hand's rule (C-e)
		// the source can die mid-gesture (a peer deleting it), and committing onto a corpse would
		// write a link to nothing
		if (!this.model.endpointOf(this.ctx.src.id)) return;

		const { entity: node } = this.handSpec.stamp(this.model, type, snapped);   // the held item, stamped by the hand (C-e)
		this.model.put('node', node);          // live, so the preview and the next segment can see it
		const via = [...(this.ctx.via || [])];
		const link = { ...makeLink(this.model, this.ctx.src.id, node.id), ...(via.length ? { via } : {}) };
		/*
		`chainHop`, not `routeLink` -- the kinds are named rather than assumed.

		`routeLink` maps everything in `placed` to `kind: BARE_KIND`, which is correct for a route
		and wrong for a hop, because a hop lands on a NODE. Passing the node through that list built
		a `put/waypoint` carrying a node's fields: the browser applied it locally and the server
		answered `commit rejected - invalid`. B87's shape exactly -- an entry whose kind and payload
		disagree, accepted by the optimistic apply and refused at the boundary.
		*/
		this.history.commit(commands.chainHop(this.ctx.placed, node, link));
		/*
		Retire THIS hop's preview before starting the next one.

		`chainFrom` replaces `this.ctx` with a fresh `previewPath`, so the one being replaced has to
		be taken out of the overlay first or it is simply orphaned there -- the link `commit` handler
		calls `ctx.path.remove()` for exactly this reason before it chains, and this path did not.

		Two symptoms, one cause, both reported from the editor. `.link-live` is `stroke-dasharray:
		10 8`, so each abandoned preview stayed on screen as a dashed line back to the node the run
		had already left. And the overlay sits ABOVE every render layer, so those leftovers read as
		links drawn on top of the glyphs -- which is what made a z-order defect out of a leak.
		*/
		this.ctx.path.remove();
		this.chainFrom(node, this.state.pointer.at);
	}

	onPipette() {
		if (this.mode) return;
		const over = this.state.pointer.at && this.anchorAt(this.state.pointer.at);   // a waypoint is no item: itemOf answers none
		this.tools.setHand(over && this.handSpec ? this.handSpec.itemOf(over) : null);   // the item it was stamped from (C-e)
		this.refreshHand();
	}

	onStampKey(evt) {
		if (this.mode || !this.tools.hand) return;
		// mouseless chaining: stamp at the ghost, then re-evaluate the cell — it is occupied now,
		// and the feedback must say so without a mouse move
		evt.claimed = true;
		if (this.state.pointer.at) { this.stampAt(this.state.pointer.at); this.refreshHand(); }
	}

	/*
	D11 — a burst of arrow keys is ONE undo step, and the window that makes it one lives in `Changes`
	(client-side, label-keyed, 600ms). B14: this used to reach into `history.stack[history.index - 1]`
	to mutate the top of a local undo stack in place. That stack was deleted at CS3 when undo moved
	server-side, so the expression was `undefined[NaN]` and THREW — arrow-key nudge did nothing at all
	for two milestones. Each amend reads the CURRENT position, so successive ones accumulate.
	*/
	onArrowKey(evt) {
		const dir = ARROW[evt.key];
		if (dir) this.history.amend(commands.nudgeSelection(this.model, this.selection.list(), dir[0], dir[1], this.places));
	}

	// Shift+arrow: a lone selected entity steps its size by what its part says (C-e) -- a zone a cell, a device's span a cell;
	// anything else, a waypoint or a mixed selection, nothing. Amended, as a nudge is, so steps accumulate
	onResizeStep(evt) {
		const dir = ARROW[evt.key];
		const ids = this.selection.list();
		if (!dir || ids.length !== 1) return;
		const kind = kindOf(ids[0]), spec = this.sizeSteps.get(kind), e = spec && this.model.get(kind, ids[0]);
		const after = e && spec.step(e, dir[0], dir[1]);
		if (after) this.history.amend(commands.setFields(spec.label, kind, ids[0], after));
	}


	onRenameKey() {
		this.labels.openFocused(this.selection.list().filter((id) => kindOf(id) !== 'link' && kindOf(id) !== 'group'));
	}

	// D21 — reverse another writer's whole run in one action. Deliberately NOT Ctrl+Z: taking back N
	// changes you did not make is a different intent from stepping back one you did.
	onUndoRun() { this.history.undoRun(); this.afterHistory(); }
	onUndoKey() { this.history.undo(); this.afterHistory(); }
	onRedoKey() { this.history.redo(); this.afterHistory(); }
	onDuplicate() { this.duplicateSelection(); }   // claims the bookmark shortcut

	onDeleteKey(evt) {
		if (this.selection.size() === 0) return;
		evt.claimed = true;
		this.history.commit(commands.deleteSelection(this.model, new Set(this.selection.list()), this.deleteRanks));
		// selection auto-prunes on the delete's emits (selection.js)
	}

	/*
	Hover and key-up stay HERE and delegate to the overlay, which owns the state and the drawing. The DOM wiring is
	capture's since stage 1 of the gesture system (app/src/capture.js): these receive input events. (Deleted twice
	during H6 by slices that ran to `onKeyUp` — the second time is why they sit above the key handlers.)
	*/
	hover(evt, on) {
		this.overlayUi.hover(evt.on, on, evt, this.isGesturing());
		this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	syncZoneGrid(evt) {
		this.overlayUi.zoneGrid(evt.shiftKey, this.mode === 'move' || this.mode === 'clone');
	}

	// a key release: the ONE row it means (app/src/keymap.js KEY_RELEASES), through the same engine as a key press
	keyUp(evt) {
		const { rule } = resolveInput(this.releaseRules, evt, this.situation(null, this.mode), {
			readOnly: this.readOnly, helpOpen: !!(this.help && isShown(this.help)), gesturing: this.isGesturing(),
		});
		if (rule) this[rule.run](evt);
	}

	// Shift released: the zone grid goes, a move redraws with the axis lock off, and a hovered zone drops its states
	onShiftUp() {
		this.overlayUi.zoneGrid(false, false);
		if ((this.mode === 'move' || this.mode === 'clone') && this.state.pointer.at) {
			// re-render with the lock released: the commit follows the frame
			this.updateMove(this.state.pointer.at, false);
		}
		// the zone layer just went inert: a hovered zone must drop its states
		// what was picked only under Shift -- a zone -- is no longer under the pointer once Shift is up (D4)
		if (this.overlayUi.hovered && this.hitFacts.get(this.overlayUi.hoveredWord)?.modifier === 'shiftKey') {
			this.renderer.clearState(this.overlayUi.hovered, 'hover');
			this.overlayUi.disarm();
		}
	}

	// Alt or Control released: the armed affordance follows what is still held
	onArmingUp(evt) {
		this.overlayUi.arm(evt, { readOnly: this.readOnly, gesturing: this.isGesturing() });
	}

	afterHistory() {
		// selection auto-prunes on del emits (selection.js); render() re-applies 'selected' from the
		// renderer's selectedSet whenever undo/redo re-renders an entity — so no manual re-reflect here.
		this.refreshHand(); // undo/redo can change occupancy under a stationary cursor
	}
}
