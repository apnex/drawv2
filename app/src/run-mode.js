/*
RUN MODE'S PRESSES -- the diagram acting as UI (W5), as rows of the Rules engine. See \`runModePress\` in app/src/input.js
for what each means; the handlers they name stay there, beside the press they act on.

K5 (dev/design/h17/PLAN.md): the rows moved here from Input, and the production composition root (app/src/main.js) hands
them in as \`runRules\`. Run mode is the product's feature -- spawners and towers, the simulation's -- so the canvas holds
no run-mode rows of its own, and a composition without the simulation passes none: the lab passes none, as ruled
(dev/DECISIONS.md, the lab's absent bindings).
*/
import { inReadView, onEndpoint, onOpenGround } from '../../engine/situation.mjs';

export const RUN_PRESSES = [
	{ id: 'toggle-spawn', input: ['left on region:waypoint'], context: 'in run mode, on an endpoint', mutates: true,  prevent: false, on: (e) => e.button === 0 && !!e.region?.waypoint, when: (s) => inReadView(s) && onEndpoint(s), run: 'toggleSpawnHere' },
	{ id: 'place-tower', input: ['left on region:ground'], context: 'in run mode, where the cell is free',  mutates: true,  prevent: false, on: (e) => e.button === 0 && !!e.region && !e.region.control && !e.region.overWaypoint && !e.region.entity,
		when: (s) => inReadView(s) && onOpenGround(s), run: 'placeTowerHere' },
	{ id: 'fire-action', input: ['left on region:action'],  mutates: false, prevent: false, on: (e) => e.button === 0 && !!e.region?.action, run: 'fireActionHere' },
	{ id: 'open-input', input: ['left on region:input'],   mutates: true,  prevent: false, on: (e) => e.button === 0 && !!e.region && e.region.input !== null && !e.region.action, run: 'openInputHere' },
];
