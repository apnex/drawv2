/*
H26.6's move 15 (dev/design/components/PAN-ZOOM.md section 3.5, step 5; appendix A's second move 15 row) -- THE NOTICE OF A SIZE CHANGE:
the new size, and that every anchor and zone kept its square, the diagram scaled by the new size over the old -- computed from the model
before and the committed change, `{ size, from, factor, message }`, or null for a change that set no new grid. The REST commit route
answers it as `notice` beside the change (server/rest.js), the page flashes its message from its own commit (app/src/main.js), and the
CLI prints the route's (`draw grid`), so each door says the same. Outside the planner's entry, which runs the change itself
(plugins/layouts/size-change.mjs).
*/
import { LAYOUT_ROWS } from './layout-kind.mjs';

const GRID_ID = LAYOUT_ROWS[0].always[0].id;   // the row's one record, `layout-000001`
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// the grid size a change sets: its last op on the grid record carrying a pitch, a `set` or a `put`
const sizeSet = (change) => {
	const sets = (change?.ops ?? []).filter((o) => o?.kind === 'layout' && (o.op === 'set' ? o.id === GRID_ID && 'pitch' in (o.patch ?? {}) : o.op === 'put' && o.entity?.id === GRID_ID));
	const last = sets.at(-1);
	return last ? (last.op === 'set' ? last.patch.pitch : last.entity.pitch) : null;
};

export function sizeChangeNotice(before, change) {
	const size = sizeSet(change), from = before?.get?.('layout', GRID_ID)?.pitch;
	if (!Number.isInteger(size) || !Number.isInteger(from) || size === from) return null;
	const g = gcd(size, from), factor = `${size / g}/${from / g}`;
	return { size, from, factor, message: `grid ${size}: every device, waypoint and zone kept its square -- the diagram scaled by ${size}/${from}${factor === `${size}/${from}` ? '' : ` (${factor})`}, each device its own size` };
}

// the sizes a diagram's grid may take, as the row's own check says (PZ21: even, 60 to 120) -- what the page's grid field offers
const GRID_SIZES = Object.freeze(Array.from({ length: 240 }, (_, i) => i + 1).filter((pitch) => LAYOUT_ROWS[0].refers({ id: GRID_ID, name: 'grid', pitch }) === null));
// the ops that set a diagram's grid size: what the page's grid field and the CLI's `grid` verb commit (PZ29)
const setGridOps = (size) => [{ op: 'set', kind: 'layout', id: GRID_ID, patch: { pitch: size } }];
// the same, as the page's history takes an edit (app/src/changes.js: a `set` entry carries what it sets as `after`)
const gridEdit = (size) => ({ label: `grid ${size}`, entries: setGridOps(size).map(({ patch, ...op }) => ({ ...op, after: patch })) });
// a diagram's grid size, from its record
const gridSizeOf = (model) => model.get('layout', GRID_ID)?.pitch ?? null;

/*
THE GRID FIELD (PZ29: "a field in the header's menu"), wired once for each page that shows one -- the product page's header and the
lab's footer: its options the sizes the row admits, its value the diagram's size as the model holds it, a choice committed as the page's
own edit (`commit`, the page's history) and its notice handed to `flash`. Given the element; it reads no global.
*/
export function attachGridField(select, { model, commit, flash }) {
	for (const size of GRID_SIZES) select.append(Object.assign(select.ownerDocument.createElement('option'), { value: String(size), textContent: `grid ${size}` }));
	const show = () => { if (select.ownerDocument.activeElement !== select) select.value = String(gridSizeOf(model)); };
	show();
	model.onChange(show);
	select.addEventListener('change', () => {
		const size = Number(select.value), notice = sizeChangeNotice(model, { ops: setGridOps(size) });
		const applied = commit(gridEdit(size));
		if (notice && applied?.length) flash(notice.message);
		select.blur();
		show();
	});
}
