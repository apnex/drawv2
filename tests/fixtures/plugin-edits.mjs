/*
A PLUGIN'S EDIT, RUN AS ITS ROW RUNS IT -- C-e (H19.33; D5: a plugin's edits are data, the canvas's generic builders build the
command).

The builders that left app/src/commands.js for a plugin's key row are run here through the row itself, against a host that
records what it is handed and builds the command with the generic builder Input would -- so a test that held a moved builder
still holds the product's decision, not a copy of it.
*/
import { setFieldsAll, setFields, putEntity, putEntities } from '../../app/src/commands.js';
import { DEVICE_KEYS } from '../../devices/device-keys.mjs';
import { LINK_KEYS } from '../../network/link-keys.mjs';
import { SPAWN_RUNS } from '../../engine/spawn-runs.mjs';
import { DEVICE_LABELS as DEVICE_LABELS_FOR_EDITS } from '../../devices/device-labels.mjs';
import { kindOf } from '../../model/model.mjs';

// `s` on these ids: the devices plugin's reshape, as the command Input would send (empty when nothing is a device)
export function reshapeCommand(model, ids) {
	let sent = { label: 'reshape', entries: [] };
	const selected = () => ids.map((id) => ({ ...(model.get(kindOf(id), id) ?? {}), id, kind: kindOf(id) }));
	DEVICE_KEYS.find((r) => r.id === 'reshape').run({ selected, setAll: (label, sets) => { sent = setFieldsAll(label, sets); } });
	return sent;
}

// a network link row run on a model with these selected, as the command Input would send (empty when the row sends nothing)
function runLinkKey(model, id, selected) {
	let sent = { label: id, entries: [] };
	const host = {
		selected: () => selected,
		ask: (question) => question(model),
		set: (label, kind, eid, after) => { sent = setFields(label, kind, eid, after); },
		put: (label, kind, make) => { sent = putEntity(label, kind, make(model)); },
		putAll: (label, puts) => { sent = putEntities(label, puts); },
		select: () => {}, flash: () => {},
	};
	LINK_KEYS.find((r) => r.id === id).run(host);
	return sent;
}
// a model holding only this link -- the old builders took the link itself, which a test may build outside any model
const holding = (link) => ({ get: (kind, eid) => (kind === 'link' && eid === link.id ? link : undefined) });
const asSelected = (link) => [{ ...link, kind: 'link' }];

// `c`, `f`, `k` on this lone link; `l` (or Shift+L, `star`) on these ids -- the network's rows (C-e step seven)
export const closeCommand = (link) => runLinkKey(holding(link), 'close', asSelected(link));
export const directionCommand = (link) => runLinkKey(holding(link), 'direction', asSelected(link));
export const planeCommand = (link) => runLinkKey(holding(link), 'plane', asSelected(link));
export const linkCommand = (model, ids, star) => runLinkKey(model, star ? 'star' : 'chain',
	ids.map((id) => ({ ...(model.get(kindOf(id), id) ?? {}), id, kind: kindOf(id) })));

// a press on this endpoint in run mode, at the agreed instant `now`: the simulation's row, as the command Input would send -- or
// null when the row sends nothing (a waypoint that does not exist)
export function spawnCommand(model, id, now) {
	let sent = null;
	const host = {
		ask: (question) => question(model), now: () => now,
		set: (label, kind, eid, after) => { sent = setFields(label, kind, eid, after); },
		put: (label, kind, make) => { sent = putEntity(label, kind, make(model)); },
	};
	SPAWN_RUNS.find((r) => r.id === 'toggle-spawn').run(host, { region: { waypoint: id } });
	return sent;
}

// a panel input's value set, as the label editor commits it: the devices plugin's edit through the one builder (C-e step twelve)
// -- empty when the device has no such region
export function contentCommand(model, id, idx, value) {
	const kind = kindOf(id), n = model.get(kind, id);
	const c = DEVICE_LABELS_FOR_EDITS.content;
	if (!n || c.valueOf(n, idx) == null) return { label: 'edit', entries: [] };
	const e = c.edit(n, idx, value);
	return setFields(e.label, kind, id, e.after);
}
