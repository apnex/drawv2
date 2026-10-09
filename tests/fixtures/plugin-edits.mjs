/*
A PLUGIN'S EDIT, RUN AS ITS ROW RUNS IT -- C-e (H19.33; D5: a plugin's edits are data, the canvas's generic builders build the
command).

The builders that left app/src/commands.js for a plugin's key row are run here through the row itself, against a host that
records what it is handed and builds the command with the generic builder Input would -- so a test that held a moved builder
still holds the product's decision, not a copy of it.
*/
import { setFieldsAll } from '../../app/src/commands.js';
import { DEVICE_KEYS } from '../../devices/device-keys.mjs';
import { kindOf } from '../../model/model.mjs';

// `s` on these ids: the devices plugin's reshape, as the command Input would send (empty when nothing is a device)
export function reshapeCommand(model, ids) {
	let sent = { label: 'reshape', entries: [] };
	const selected = () => ids.map((id) => ({ ...(model.get(kindOf(id), id) ?? {}), id, kind: kindOf(id) }));
	DEVICE_KEYS.find((r) => r.id === 'reshape').run({ selected, setAll: (label, sets) => { sent = setFieldsAll(label, sets); } });
	return sent;
}
