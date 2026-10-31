/*
editing-gestures.js -- H26.8's capture move (dev/design/components/NATIVE-SHAPES.md section 3.2, the editing gestures; NS7; GR7, GR13):
THE FIVE GENERIC GESTURES' BODIES AND THE MARQUEE, the editing duty's (B389). Until this move they were app/src/input.js's `GESTURES`
slots, each handed the whole of Input and reaching twenty of its members and four helpers of app/src/snap.js and
app/src/editing-visuals.js; each is handed a HOST now, the frozen object Input makes, holding exactly section 3.2's members:

  model, selection, scene                      the values Input holds
  hideCrosshair(), showHandles()               the overlay's crosshair hidden, the handles shown again
  showBox(patch), showLink(from, to)           the readout's box and link
  setState(id, cls, on)                        the editing states
  factsOf(word), handleOf(word), holding()     what a hit word is, the handle a word names, the held tool
  anchorAt(pos, targets), decide(table, evt, facts), act(rule, ctx)
  press(hit, pos, shift), escalate(pos, evt, table, facts, become), drag(pos, shiftHeld), retarget(target, excludeId)
                                               Input, over its CURRENT context, session and places
  endRetarget(ctx), commitMove(ctx, pos, ortho), commitClone(ctx, pos, ortho)
                                               Input, over the context it is HANDED
  cellName(pos), boxOf(p1, p2)                 draw's geometry, injected

Each phase, Input calling it on an outcome of the gesture session naming that phase (H26.2):
  start(host, hit, pos, evt, rule) -> ctx       Input keeps the answer as the gesture's context
  update(host, ctx, pos, evt)                   `ctx` Input's current one
  commit(host, ctx, pos, evt, outcome)          `ctx` the gesture's, Input's own already `{}`; `outcome` the session's, holding `trigger`
  cancel(host, ctx)                             `ctx` the gesture's

WHICH CONTEXT A VERB ACTS ON follows the phase that calls it (reading 3, o:F3): the verbs of `start` and `update` act on Input's current
context -- `press` answers the context it opens, `escalate` may replace Input's context and gesture (a move, a clone), after which the
body uses its `ctx` no more, `drag` and `retarget` read and write the current one; the verbs of `commit` and `cancel` take the phase's
context as their argument, and none reads Input's current one. tests/editing-host.test.js runs every phase of every body with a host
alone, a commit's and a cancel's host holding a current context of `{}`, so a verb reading it there fails (GR13).

Each slot declares what the session needs of it, as before: `engaged: false` for a press not yet a gesture in progress (`isGesturing`),
absent for one that is; no editing gesture declares a `button`. The bodies are the slots they were, moved, each reading its host where
it read Input; `link` and `box`, which name Input's own working data, stay in app/src/input.js.

This module imports the document (`kindOf`) and its own part's visuals alone, and reads nothing but its parameters and those imports
(GR7, GR13).
*/
import { kindOf } from '../../model/model.mjs';
import { previewRect, previewLine } from './editing-visuals.js';   // H26.4: the gestures' previews, items of the scene (section 5.3)

// H25.3 (B373): the selection rectangle's class, declared as a box row declares its preview (plugins/zones/zone-gestures.mjs), where the
// copy measure reads what a module puts on its elements (tools/copies.mjs) -- passed bare to previewRect, it read as never drawn
const MARQUEE = { preview: 'marquee' };

// the editing gestures' bodies, one slot per gesture, each phase handed the host Input makes (above); read by Input alone
export const EDITING_GESTURES = {
	move: {
		update: (host, ctx, pos, evt) => host.drag(pos, evt.shiftKey),
		commit: (host, ctx, pos) => {
			host.hideCrosshair();
			// commit with the flag of the last RENDERED frame, never re-sampled: Shift may have
			// changed state since, with the pointer stationary
			host.commitMove(ctx, pos, ctx.orthoActive);
		},
		cancel: (host, ctx) => {
			ctx.moved.forEach((m) => host.model.set(m.kind, m.id, { x: m.before.x, y: m.before.y }));
			host.hideCrosshair();
		}
	},

	clone: {
		update: (host, ctx, pos, evt) => host.drag(pos, evt.shiftKey),
		commit: (host, ctx, pos) => {
			host.hideCrosshair();
			host.commitClone(ctx, pos, ctx.orthoActive);
		},
		cancel: (host, ctx) => {
			[...ctx.clones].reverse().forEach((c) => host.model.del(c.kind, c.entity.id));   // uncommitted clones vanish entirely
			host.selection.clear();
			host.hideCrosshair();
		}
	},

	pending: {
		engaged: false,   // a press, not yet a gesture in progress: no guard sees it until it becomes a move (H26.2)
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
		update: (host, ctx, pos, evt) => host.escalate(pos, evt, 'pressDrag',
			// D4: what the press was on, by the plugins' facts -- something not placed (a link) never moves; an anchor whose left press
			// always draws a link (a waypoint, B203) never moves on a left drag
			{ unplaced: !host.factsOf(ctx.hit.kind)?.placed && !ctx.hit.mark, onMark: !!ctx.hit.mark,
				linksOnLeft: !!(host.factsOf(ctx.hit.kind)?.anchor && !host.factsOf(ctx.hit.kind)?.clones), leftPress: !!ctx.leftPress }, 'move'),
		start: (host, hit, pos, evt) => {
			const ctx = host.press(hit, pos, evt.shiftKey && host.factsOf(hit.kind)?.modifier !== 'shiftKey');   // Shift is the layer key of what it picks -- a zone -- not selection-add (D4)
			ctx.orthoReady = !evt.shiftKey;
			ctx.leftPress = evt.button === 0;   // which button opened this press; only the left one is barred above
			return ctx;
		}
	},

	'clone-pending': {
		engaged: false,   // a press, not yet a gesture in progress, until it becomes a clone (H26.2)
		// Ctrl+click without drag: toggle selection (draw.io behavior) -- app/src/releases.js CTRL_CLICKS
		commit: (host, ctx, pos, evt) => host.act(host.decide('ctrlClick', evt, { exists: !!host.model.get(kindOf(ctx.hit.id), ctx.hit.id) }), ctx),
		update: (host, ctx, pos, evt) => host.escalate(pos, evt, 'cloneDrag', {}, 'clone'),
		start: (host, hit, pos, evt) => ({ hit, start: pos, orthoReady: !evt.shiftKey })
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
		commit: (host, ctx, pos, evt) => {
			const { spec } = ctx;
			let found;
			if (spec.preview === 'reshape') {
				const after = spec.at(ctx, pos);
				host.model.set(ctx.kind, ctx.id, { ...ctx.before });   // rewind the live preview; history owns the real edit
				found = spec.released(ctx, after, host.model);
			} else {
				host.endRetarget(ctx);
				found = spec.released(ctx, host.anchorAt(pos, spec.targets), host.model);   // what the handle lands on: its words (C-e)
			}
			host.act(host.decide(`handle:${ctx.kind}`, evt, found), { id: ctx.id, ...found });
			host.showHandles();   // the handles ride the (possibly new) entity
		},
		cancel: (host, ctx) => {
			// a cancelled gesture is a no-op: a reshape rewound, a retarget's preview dropped
			if (ctx.spec.preview === 'reshape') host.model.set(ctx.kind, ctx.id, { ...ctx.before });
			else host.endRetarget(ctx);
		},
		update: (host, ctx, pos) => {
			const { spec } = ctx;
			if (spec.preview === 'reshape') {
				const patch = spec.at(ctx, pos);
				host.model.set(ctx.kind, ctx.id, patch);   // live preview writes the shared Model (B7)
				host.showBox(patch);
				return;
			}
			// the fixed end is anchored; the dragged end follows the cursor or the device it hovers
			const target = host.anchorAt(pos, spec.targets);
			ctx.line.update(ctx.fixed, target || pos);
			host.retarget(target, ctx.fixedId);
			host.showLink(ctx.fixed.name || '?', (target && target.id !== ctx.fixedId) ? (target.name || '?') : host.cellName(pos));
		},
		start: (host, hit, pos) => {
			const spec = host.handleOf(hit.kind);
			const id = spec && host.selection.list().find((x) => kindOf(x) === spec.kind);
			const entity = id && host.model.get(spec.kind, id);
			if (!entity) return null;
			const ctx = { kind: spec.kind, id, spec, ...spec.start(entity, hit.id) };
			if (spec.preview === 'retarget') {
				ctx.fixed = host.model.endpointOf(ctx.fixedId);   // an anchor is a node OR a waypoint (B29)
				if (!ctx.fixed) return null;
				host.setState(id, spec.dragState, true);   // de-emphasize the real one while its end is dragged
				ctx.line = previewLine(host.scene);
				ctx.target = null;
				ctx.line.update(ctx.fixed, pos);
			}
			return ctx;
		}
	},

	marquee: {
		commit: (host, ctx, pos, evt, outcome) => {
			ctx.rect.remove();
			const box = host.boxOf(ctx.p1, pos);
			// a click stamps the held type or clears; a drag selects or adds (app/src/releases.js MARQUEE_RELEASES)
			host.act(host.decide('marquee', evt, { click: outcome.trigger === 'click', hand: !!host.holding(), shift: !!evt.shiftKey, ctrl: !!evt.ctrlKey, alt: !!evt.altKey }), { pos, box });
		},
		cancel: (host, ctx) => ctx.rect.remove(),
		update: (host, ctx, pos) => ctx.rect.update(host.boxOf(ctx.p1, pos)),
		start: (host, hit, pos) => ({ p1: pos, rect: previewRect(host.scene, MARQUEE.preview) })
	},
};
