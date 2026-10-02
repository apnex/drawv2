/*
Shape — the entity kinds and their per-kind field taxonomy, in ONE place.

PL-5 (dev/design/planner/PLANNER-SYSTEM.md; ruled 2026-10-01): the KIND TABLE. The five kinds were listed separately
in `model/model.mjs` (twice), `planner/validate.js` (twice), `server/rest.js` and `server/store.js`; each now derives
from `KINDS` and the table below. One literal, checked by `scan-layers` L7k to be exactly the product's five. Two lists
stay where they are on purpose: the id grammar in `planner/validate.js` is a literal C3 pins, and each kind's field
CHECKS stay at the trust boundary, which sources its facts and keeps its checks local. Injecting the table into a
composition -- so the lab could add a kind production does not have -- was held for promotion's format batch (B273), and
is built now: see `composeKinds` below (H17.22 N-a).

Two facts about every entity kind that were previously encoded in two separate hand-maintained
lists, in two different layers, that nothing forced to agree:

  COMPOSITE  fields holding a nested array/object, so a copy must go deeper than a spread.
             Was: the `if (copy.x)` ladder in app/src/commands.js clone().
  OPTIONAL   fields that may be absent from a stored entity — documents written before the
             field existed must still load. Absent means "the renderer's default", never null.
             Was: the OPTIONAL map in planner/validate.js.

The two sets are genuinely different and that is not an accident: `link.closed` is optional but
scalar, `group.members` is composite but mandatory, `node.shape` is optional but scalar. A single
merged list would be wrong in both directions.

Per kind, the table also holds the collection a document stores it under and whether it can be selected.

Downstream this table is the source for: clone()'s deep-copy walk (model/ops.mjs), the
set-inverse absent-key rule (an inverse that must remove a key rather than restore a value uses a
whole-entity put — see planner/txn.mjs), and validateEntity's optional-field allowance.
*/

// the product's kinds, in the order a document lists its collections
const KINDS = ['node', 'waypoint', 'link', 'zone', 'group'];

/*
  collection  the document key the kind is stored under
  selectable  whether a selection may hold it (a group never is; it is selected through its members)
  composite   fields holding a nested value -- a spread is not enough to copy one
  optional    fields that may be absent from a stored entity (pre-dates the field, or is genuinely optional)
*/
const TABLE = {
	node:     { collection: 'nodes',     selectable: true,  composite: ['span', 'content'], optional: ['shape', 'span', 'content'] },
	waypoint: {
		collection: 'waypoints', selectable: true, composite: [],
		/*
		B162: `pinned` says the author placed this waypoint deliberately, with no link to derive a
		role from. Optional because almost none carry it -- a bend never does.

		H12.5: `spawn` says this endpoint EMITS along its link. One composite field rather than four
		loose ones, because absent means "not a spawner" and that is a single fact -- four independent
		optional numbers would make a half-configured spawner representable, and it is not a state.

		The DIRECTION is not stored. It is derived from which end of the link this waypoint is: press
		the `src` end and movers run src to dst, press `dst` and they run the other way. Storing it
		would be a twin of the link, wrong the first time a route was reversed.
		*/
		optional: ['pinned', 'spawn'],
	},
	link:     { collection: 'links',     selectable: true,  composite: ['via'],             optional: ['via', 'closed', 'flow', 'control'] },
	zone:     { collection: 'zones',     selectable: true,  composite: [],                  optional: [] },
	group:    { collection: 'groups',    selectable: false, composite: ['members'],         optional: [] },
};

// the rest of each of the five's storage half: every one is named (B187, N5), nodes and waypoints are the anchors (N2),
// and links and groups point at anchors
const REFERENCES = { link: ['node', 'waypoint'], group: ['node', 'waypoint'] };
const STORAGE = Object.fromEntries(KINDS.map((k) => [k, { ...TABLE[k], named: true, anchor: k === 'node' || k === 'waypoint', references: REFERENCES[k] ?? [] }]));

/*
H17.22 N-a -- A COMPOSITION BRINGS ITS KINDS (ruled 2026-10-02, "Plugins bring their own kinds"; B273).

Every kind is a ROW of one shape, whoever brings it -- the product's five or a plugin's own, the network's `pipe`:

  kind        the id prefix, and the name the planner and the Model know it by
  owner       who brings it, named when two claim one kind
  collection  the document key it is stored under
  selectable  whether a selection may hold it
  named       whether it joins the one name namespace (N5): required name, given one, found by name
  anchor      whether it is an anchor -- its 6-hex part is unique across every anchor kind (N2), so a pipe's id,
              made of its two anchors' hex, names one pair
  composite   fields holding a nested value -- a spread is not enough to copy one
  optional    fields a stored entity may lack
  references  the kinds its entities point at; a composition without one of them is refused
  fields      a check for every field, `id` included -- the planner's half, absent from the core's default
  refers      its cross-entity check, `(entity, access, patch) -> error | null` -- the planner's half too
  cap         the most of it one document may hold -- the planner's half too

This module is CORE, so it holds the mechanism and the five rows' STORAGE half, and treats checks as opaque. The
product's full rows -- checks, cross-entity checks, caps -- are the planner's (`planner/kinds.mjs`), because the link's
cross-entity check is network-layer code the core may not import. `new Model()` takes `CORE_KINDS`, the planner takes
`PRODUCT_KINDS`, and the planner refuses a model composed with different kinds.

Built when a page or a server is composed, never registered at runtime; no registry, no discovery (mission-kit P4).
*/
const ROW_KEYS = ['kind', 'owner', 'collection', 'selectable', 'named', 'anchor', 'composite', 'optional', 'references', 'fields', 'refers', 'cap'];
const DOCUMENT_KINDS = ['diagram', 'template'];   // document-level ids (planner/validate.js DOCUMENT_ID), never an entity kind

export function composeKinds(rows, who = 'a composition') {
	if (!Array.isArray(rows) || !rows.length) throw new Error(`${who}: a composition is a list of kind rows`);
	const byName = new Map(), byCollection = new Map();
	for (const row of rows) {
		const stray = Object.keys(row ?? {}).filter((k) => !ROW_KEYS.includes(k));
		if (stray.length) throw new Error(`${who}: kind ${row?.kind}: unknown row key ${stray.join(', ')} -- a row is { ${ROW_KEYS.join(', ')} }`);
		if (typeof row.kind !== 'string' || !/^[a-z]+$/.test(row.kind)) throw new Error(`${who}: a kind is named in lowercase letters, not ${JSON.stringify(row.kind)}`);
		if (DOCUMENT_KINDS.includes(row.kind)) throw new Error(`${who}: ${row.kind} is a document id, not a kind an entity may take`);
		if (byName.has(row.kind)) throw new Error(`${who}: kind ${row.kind} is claimed by ${byName.get(row.kind).owner} and by ${row.owner} -- one owner brings a kind`);
		if (typeof row.collection !== 'string' || !row.collection) throw new Error(`${who}: kind ${row.kind} names no collection`);
		if (byCollection.has(row.collection)) throw new Error(`${who}: kinds ${byCollection.get(row.collection)} and ${row.kind} are both stored under ${row.collection}`);
		for (const list of ['composite', 'optional', 'references']) if (!Array.isArray(row[list] ?? [])) throw new Error(`${who}: kind ${row.kind}: ${list} is a list`);
		if (row.fields !== undefined) {
			const names = Object.keys(row.fields);
			const unchecked = names.filter((f) => typeof row.fields[f] !== 'function');
			if (unchecked.length) throw new Error(`${who}: kind ${row.kind}: field ${unchecked.join(', ')} has no check`);
			if (!names.includes('id')) throw new Error(`${who}: kind ${row.kind}: no check for its id`);
			for (const list of ['composite', 'optional']) {
				const loose = (row[list] ?? []).filter((f) => !names.includes(f));
				if (loose.length) throw new Error(`${who}: kind ${row.kind}: ${list} names ${loose.join(', ')}, which it has no check for`);
			}
			if (row.named && !names.includes('name')) throw new Error(`${who}: kind ${row.kind} is named but has no check for a name`);
		}
		// `clone` (model/ops.mjs) copies nested fields by the core's table, so a kind the core does not know may not hold one yet
		if (!Object.hasOwn(TABLE, row.kind) && (row.composite ?? []).length) throw new Error(`${who}: kind ${row.kind}: nested fields are copied by the core's table only, so a plugin kind may not declare one yet`);
		byName.set(row.kind, row);
		byCollection.set(row.collection, row.kind);
	}
	for (const row of rows) {
		const missing = (row.references ?? []).filter((k) => !byName.has(k));
		if (missing.length) throw new Error(`${who}: kind ${row.kind} references ${missing.join(', ')}, which this composition does not include`);
	}
	const list = rows.map((r) => r.kind);
	const of = (fact) => Object.fromEntries(rows.map((r) => [r.kind, fact(r)]));
	return Object.freeze({
		list,
		has: (kind) => byName.has(kind),
		row: (kind) => byName.get(kind),
		collection: of((r) => r.collection),
		selectable: list.filter((k) => byName.get(k).selectable),
		named: list.filter((k) => byName.get(k).named),
		anchors: list.filter((k) => byName.get(k).anchor),
		composite: of((r) => new Set(r.composite ?? [])),
		optional: of((r) => new Set(r.optional ?? [])),
		// whether every row carries its checks -- what the planner requires of a composition it validates against
		checked: rows.every((r) => r.fields !== undefined),
	});
}

// the five rows' storage half, as the core knows them; the planner adds each one's checks (planner/kinds.mjs)
export const CORE_ROWS = KINDS.map((kind) => ({ kind, owner: 'the product', ...STORAGE[kind] }));
// what `new Model()` is composed with when nothing else is passed: the product's five
export const CORE_KINDS = composeKinds(CORE_ROWS, 'the core');

// nested value -> a spread is not enough; what `clone` (model/ops.mjs) copies deeper, read by kind without a composition.
// The kinds' other facts are read from a composition -- `CORE_KINDS` where nothing else is composed (H17.22 N-a).
export const COMPOSITE = CORE_KINDS.composite;
