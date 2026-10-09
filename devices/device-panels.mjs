/*
RUN MODE'S PANEL ROWS, THE DEVICES PLUGIN'S -- C-e, step twelve (H19.33; dev/design/unification/CANVAS-PLUGINS.md).

A panel -- a device with content regions -- acts as UI in run mode (W5):
  fire-action   a press on a `data-action` region hands the host `draw:action` with the action and the device. It commits
                nothing, so it stays live on a locked client -- inspection, not authoring
  open-input    a press on a `data-input` region opens the inline editor on it; it authors, so a locked client does not (B18)
Handed to Input with the simulation's run rows by the product page alone (app/src/run-mode.js) -- the lab passes none (H17-D7) --
and acting through the host's `emit` and `editRegion`. They were app/src/input.js `fireActionHere` and `openInputHere`.
*/

export const PANEL_RUNS = [
	{ id: 'fire-action', input: ['left on region:action'], mutates: false, prevent: false, doc: 'press the panel button',
		on: (e) => e.button === 0 && !!e.region?.action,
		run: (host, evt) => { evt.claimed = true; host.emit('draw:action', { action: evt.region.action, id: evt.region.node }); } },
	{ id: 'open-input', input: ['left on region:input'], mutates: true, prevent: false, doc: 'edit the panel input',
		on: (e) => e.button === 0 && !!e.region && e.region.input !== null && !e.region.action,
		run: (host, evt) => { evt.claimed = true; if (evt.region.node) host.editRegion(evt.region.node, evt.region.input); } },
];
