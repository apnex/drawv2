/*
RUN MODE'S PRESSES -- the diagram acting as UI (W5), as rows of the Rules engine. See \`runModePress\` in app/src/input.js
for what each means; the handlers they name stay there, beside the press they act on.

K5 (dev/design/h17/PLAN.md): the rows moved here from Input, and the production composition root (app/src/main.js) hands
them in as \`runRules\`. Run mode is the product's feature -- spawners and towers, the simulation's -- so the canvas holds
no run-mode rows of its own, and a composition without the simulation passes none: the lab passes none, as ruled
(dev/DECISIONS.md, the lab's absent bindings).
*/
import { SPAWN_RUNS } from '../../engine/spawn-runs.mjs';

export const RUN_PRESSES = [
	...SPAWN_RUNS,   // C-e (H19.33): the spawner and the tower are the simulation's rows (engine/spawn-runs.mjs)
	{ id: 'fire-action', input: ['left on region:action'],  mutates: false, prevent: false, on: (e) => e.button === 0 && !!e.region?.action, run: 'fireActionHere' },
	{ id: 'open-input', input: ['left on region:input'],   mutates: true,  prevent: false, on: (e) => e.button === 0 && !!e.region && e.region.input !== null && !e.region.action, run: 'openInputHere' },
];
