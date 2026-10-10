/*
THE SCHEMA 3 MIGRATION (WD-b1, H19.45; dev/design/unification/WIDE-DEVICES.md sections 12.4 and 13) -- and its way back.

Schema 3 is schema 2 with the entities every document holds: the layouts plugin's two grids (layouts/layout-kind.mjs). One
pure function brings a document there, run on every path a whole document takes into the store (server/store.js `init`,
`restore`, `create`, `#seedFromExamples`, `#loadTemplates`) before it is validated, so a document stored before the change,
a deleted diagram's older generation and a tab from before the change posting its work are all admitted, completed. A
document with no `meta.schema` is read as schema 2; one in schema 3 lacking its layouts -- a tab from before the change,
whose Model drops the collection it does not know -- is completed the same way; any other schema is left as it is, for the
store's refusal to say (B291).

The way back (finding 6): a backup is no way back once users have edited, and the image before this change refuses schema 3,
so `migrateDownToSchema2` drops the layouts and stamps schema 2, keeping every edit -- run over a copy of the bucket by
tools/migrate-down-to-schema-2.mjs before an older image is deployed.

Deleted at WD-c (H19.47), both halves, once the bucket's live documents are schema 3 and its seven-day soft-delete window has
passed -- transform once, then delete the transform (B291's pattern).
*/

import { SCHEMA, completeAlwaysHeld } from '../model/shape.mjs';

const FROM = 2;
if (SCHEMA !== 3) throw new Error(`server/migrate-schema-3.mjs migrates schema ${FROM} to 3, and the format is schema ${SCHEMA} -- delete or replace it`);

const isDoc = (doc) => !!doc && typeof doc === 'object' && !Array.isArray(doc) && !!doc.meta && typeof doc.meta === 'object' && !Array.isArray(doc.meta);

// a document in schema 3, and whether that changed it -- the same object back when it did not
export function migrateToSchema3(doc, kinds) {
	if (!isDoc(doc)) return { doc, migrated: false };
	const n = doc.meta.schema;
	if (n !== undefined && n !== FROM && n !== SCHEMA) return { doc, migrated: false };
	const completed = completeAlwaysHeld(doc, kinds);
	if (n === SCHEMA && completed === doc) return { doc, migrated: false };
	return { doc: { ...completed, meta: { ...completed.meta, schema: SCHEMA } }, migrated: true };
}

// a schema 3 document as schema 2: the always-held collections dropped, every other entity kept
export function migrateDownToSchema2(doc, kinds) {
	const out = { ...doc, meta: { ...doc.meta, schema: FROM } };
	for (const kind of Object.keys(kinds.always ?? {})) delete out[kinds.collection[kind]];
	return out;
}
