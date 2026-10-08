/*
Shape — the entity kinds and their per-kind field taxonomy, in ONE place.

PL-5 (dev/design/planner/PLANNER-SYSTEM.md; ruled 2026-10-01): the KIND TABLE. The five kinds were listed separately
in `model/model.mjs` (twice), `planner/validate.js` (twice), `server/rest.js` and `server/store.js`; each now derives
from `KINDS` and the table below. One literal, checked by `scan-layers` L7k to be exactly the product's kinds (four since F-c, H18.5). Two lists
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

AMENDED 2026-10-08 (O-b1, H19.19; O1): the core's kinds are two -- node and group; the zone is the zones plugin's
(zones/zone-kind.mjs), composed between them (planner/kinds.mjs `productKinds`).
AMENDED 2026-10-08 (O-c, H19.20; O3): the core's kind is the node alone; the group is the groups plugin's (groups/group-kind.mjs).
AMENDED 2026-10-04 (S-e, H18.15; G5, B280): the product's kinds are three -- node, zone and group. The link is the network
plugin's kind (network/link-kind.mjs), brought by composing the network, as every production composition does; the core
names no link. `clone` copies every nested value now, so it no longer reads this table, and a plugin's kind may nest fields.

Downstream this table is the source for: the
set-inverse absent-key rule (an inverse that must remove a key rather than restore a value uses a
whole-entity put — see planner/txn.mjs), and validateEntity's optional-field allowance.
*/

/*
THE DOCUMENT GENERATION -- one owner, read by the Model's new document, the store's meta, the server's seed and the
validator, which accepts this generation alone. Was four literals that nothing forced to agree.
2 is promotion's format batch (dev/design/unification/FORMAT-BATCH.md; ruled 2026-10-03). Every stored document became 2 at
the cutover and the migration was deleted (B291), so a schema 1 document is refused at every door, saying so.
*/
export const SCHEMA = 2;

// the core's kind; a plugin's are composed after it -- the zones plugin's (O-b1), the groups plugin's (O-c), the network's
// (S-e) -- in the order a document lists its collections
const KINDS = ['node'];

/*
  collection  the document key the kind is stored under
  selectable  whether a selection may hold it (a group never is; it is selected through its members)
  composite   fields holding a nested value -- a spread is not enough to copy one
  optional    fields that may be absent from a stored entity (pre-dates the field, or is genuinely optional)
*/
const TABLE = {
	/*
	F-c (H18.5, P-10) -- ONE ANCHOR KIND. A waypoint is a node with no `type` (model/anchors.mjs); it was a kind of its own,
	`waypoint`, stored under `waypoints`, until the format batch. So `type` is optional, and the waypoint's own fields join:

	B162's `pinned` is retired (S-d, H18.14; P-5 corrected): the network keeps no orphan beyond what its pipes hold.

	H12.5: `spawn` says this endpoint EMITS along its link. One composite field rather than four loose ones, because absent
	means "not a spawner" and that is a single fact -- four independent optional numbers would make a half-configured spawner
	representable, and it is not a state. The DIRECTION is not stored. It is derived from which end of the link this
	waypoint is: press the `src` end and movers run src to dst, press `dst` and they run the other way.

	Which of the fields a node may carry follows whether it has a type, held by the node row's cross-entity check
	(planner/kinds.mjs).

	`transit` is not the product's: the network plugin contributes it to the node (S-a, H18.11, G3; network/kinds.mjs), so a
	composition without the network refuses it.
	*/
	node:     { collection: 'nodes',     selectable: true,  composite: ['span', 'content'], optional: ['type', 'shape', 'span', 'content', 'spawn', 'order'] },
};

// the rest of the node's storage half: it is named (B187, N5), and nodes are the anchors (N2)
const STORAGE = Object.fromEntries(KINDS.map((k) => [k, { ...TABLE[k], named: true, anchor: k === 'node', references: [] }]));

/*
H17.22 N-a -- A COMPOSITION BRINGS ITS KINDS (ruled 2026-10-02, "Plugins bring their own kinds"; B273).

Every kind is a ROW of one shape, whoever brings it -- the product's three or a plugin's own, the network's `link` and `pipe`:

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
  refers      its cross-entity check, `(entity, access, patch, before) -> error | null`, `before` the stored entity or
              null -- the planner's half too
  cap         the most of it one document may hold -- the planner's half too
  drawnBy     the Model reads that draw it -- `['pathOf', ...]` -- answered only by a network the Model is given; a Model
              composed with such a kind and no network is refused (V-e, H18.29; ruled J2: no Model draws links straight)
  invariants  the properties every document holds about it, `(model, report)` -> calls `report(sentence, key, measure)` for each
              breach: checked on a transaction's result and reported at boot (model/invariants.mjs) -- the planner's half
              too. Added at S-e (H18.15) for the link's straight-pair rule, which the core had held for it.

This module is CORE, so it holds the mechanism and the product rows' STORAGE half, and treats checks as opaque. The
product's full rows -- checks, cross-entity checks, caps -- are the planner's (`planner/kinds.mjs`); the link's are the
network's (`network/link-kind.mjs`, S-e). `new Model()` takes `CORE_KINDS`; the planner takes the composition it is handed
-- required since S-f -- and refuses a model composed with different kinds.

Built when a page or a server is composed, never registered at runtime; no registry, no discovery (mission-kit P4).
*/
/*
O-a (H19.18; KINDS-AS-PLUGINS.md) -- A ROW MAY CARRY ITS TENANT: `{ owner, reactions }`, the planner's rules that maintain the
kind, as the group's steal and trim maintain a group. The planner runs the composition's tenants -- these, after the link
tenant it is passed -- and appends none of its own, so a kind and its rules are composed together or not at all.
*/
/*
O-c (H19.20) -- A ROW MAY GATHER: `gathers` names one of its list fields, and the entity listing an id is the id's gatherer
-- found by the Model (`gathererOf`), and selecting the id selects the whole list. It is how the core does for a group what it
did by name -- the 2026-10-02 ruling's "a group's membership is stated in those terms, not by naming kinds".
*/
const ROW_KEYS = ['kind', 'owner', 'collection', 'selectable', 'named', 'anchor', 'composite', 'optional', 'references', 'fields', 'refers', 'cap', 'invariants', 'drawnBy', 'tenant', 'gathers'];
/*
S-a (H18.11; ruled 2026-10-03, G3) -- A PLUGIN MAY CONTRIBUTE FIELDS TO A KIND IT DOES NOT OWN. A field's meaning belongs to
whoever reads it: the network's `transit` is stored on a node, the product's kind, but only the network gives it meaning.
An EXTENSION row says so -- `{ kind, owner, extends: true, fields, optional }`: the kind it adds to, who adds, and a check for
each field, every one optional, since a document written without the plugin must still be valid with it. Merged into the
owner's row when the composition is built, so a reader sees one row; refused when the kind is not composed, when a field is
already the owner's or another plugin's (both named), when a field is not optional, or when it carries anything else.
*/
const EXTENSION_KEYS = ['kind', 'owner', 'extends', 'fields', 'optional'];
const DOCUMENT_KINDS = ['diagram', 'template'];   // document-level ids (planner/validate.js DOCUMENT_ID), never an entity kind

export function composeKinds(given, who = 'a composition') {
	if (!Array.isArray(given) || !given.length) throw new Error(`${who}: a composition is a list of kind rows`);
	const extensions = given.filter((r) => r?.extends === true);
	const rows = given.filter((r) => r?.extends !== true);
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
		if (row.drawnBy !== undefined && !(Array.isArray(row.drawnBy) && row.drawnBy.length && row.drawnBy.every((r) => typeof r === 'string'))) throw new Error(`${who}: kind ${row.kind}: drawnBy names the Model reads that draw it`);
		if (row.invariants !== undefined && typeof row.invariants !== 'function') throw new Error(`${who}: kind ${row.kind}: its invariants are a function, (model, report)`);
		if (row.tenant !== undefined && !(typeof row.tenant?.owner === 'string' && Array.isArray(row.tenant.reactions))) throw new Error(`${who}: kind ${row.kind}: its tenant is { owner, reactions } (O-a)`);
		if (row.gathers !== undefined && !(row.composite ?? []).includes(row.gathers)) throw new Error(`${who}: kind ${row.kind} gathers ${row.gathers}, which is not one of its list fields (O-c)`);
		byName.set(row.kind, row);
		byCollection.set(row.collection, row.kind);
	}
	for (const row of rows) {
		const missing = (row.references ?? []).filter((k) => !byName.has(k));
		if (missing.length) throw new Error(`${who}: kind ${row.kind} references ${missing.join(', ')}, which this composition does not include`);
	}
	// the extensions, merged into the rows they extend (S-a)
	const contributedBy = new Map();   // `kind.field` -> owner
	for (const ext of extensions) {
		const stray = Object.keys(ext).filter((k) => !EXTENSION_KEYS.includes(k));
		if (stray.length) throw new Error(`${who}: ${ext.owner}'s fields for ${ext.kind}: unknown key ${stray.join(', ')} -- an extension is { ${EXTENSION_KEYS.join(', ')} }`);
		const base = byName.get(ext.kind);
		if (!base) throw new Error(`${who}: ${ext.owner} adds fields to ${ext.kind}, which this composition does not include`);
		const names = Object.keys(ext.fields ?? {});
		if (!names.length) throw new Error(`${who}: ${ext.owner} adds no fields to ${ext.kind}`);
		const unchecked = names.filter((f) => typeof ext.fields[f] !== 'function');
		if (unchecked.length) throw new Error(`${who}: ${ext.owner}'s field ${unchecked.join(', ')} for ${ext.kind} has no check`);
		const required = names.filter((f) => !(ext.optional ?? []).includes(f));
		if (required.length) throw new Error(`${who}: ${ext.owner}'s field ${required.join(', ')} for ${ext.kind} must be optional -- a document written without ${ext.owner} is still valid with it`);
		for (const f of names) {
			const claimed = contributedBy.get(`${ext.kind}.${f}`) ?? ((base.fields && f in base.fields) || (base.optional ?? []).includes(f) ? base.owner : null);
			if (claimed) throw new Error(`${who}: field ${ext.kind}.${f} is claimed by ${claimed} and by ${ext.owner} -- one owner brings a field`);
			contributedBy.set(`${ext.kind}.${f}`, ext.owner);
		}
		byName.set(ext.kind, { ...base, ...(base.fields ? { fields: { ...base.fields, ...ext.fields } } : {}), optional: [...(base.optional ?? []), ...names] });
	}
	const list = rows.map((r) => r.kind);
	const of = (fact) => Object.fromEntries(rows.map((r) => [r.kind, fact(byName.get(r.kind))]));   // the rows as merged (S-a)
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
		// the kinds that gather, and the list field each gathers by (O-c)
		gathers: Object.fromEntries(rows.filter((r) => r.gathers).map((r) => [r.kind, r.gathers])),
		// the tenants the rows bring, in the composition's order -- what the planner runs after the link tenant (O-a)
		tenants: rows.filter((r) => r.tenant).map((r) => r.tenant),
		// who brought a field another owner's kind carries (S-a): `kind.field` -> owner
		contributed: (kind, field) => contributedBy.get(`${kind}.${field}`) ?? null,
	});
}

// the three rows' storage half, as the core knows them; the planner adds each one's checks (planner/kinds.mjs)
export const CORE_ROWS = KINDS.map((kind) => ({ kind, owner: 'the product', ...STORAGE[kind] }));
// what `new Model()` is composed with when nothing else is passed: the product's three, so no links (S-e)
export const CORE_KINDS = composeKinds(CORE_ROWS, 'the core');
