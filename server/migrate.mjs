/*
THE SCHEMA 2 MIGRATION -- promotion's stored format batch, as one function (dev/design/unification/FORMAT-BATCH.md
section 5; ruled 2026-10-03, F1 to F4).

Every change to the stored format lands as one named batch, applied once to the estate (`dev/DECISIONS.md`, "One named
batch, last"). This is that batch: a list of STEPS, each keyed on the shape it repairs rather than on the schema number,
so every step is idempotent -- a repaired document passes through unchanged, and a step added by a later stage (the
pipes, at P3, by F2) repairs a document an earlier stage already stamped 2. It is the loader's own pattern
(`migrateNames`, `migrateSpawn` in server/store.js), grown into a list.

PURE. It returns a new document and log and never touches its input or the disk, so the dry run
(tools/migrate-schema.mjs) and the store transform identically by construction -- the property
tools/migrate-version.mjs was built on.

RUN ON EVERY PATH INTO THE STORE, before validation: boot, examples, `create` (an open tab from before the cutover posts
its old document), templates and restore (server/store.js `admit`). The validator accepts the current generation alone, so
a schema 1 document enters only through here.

DELETED AFTER THE CUTOVER, with the dry-run tool, under "transform once, then delete the transform"; the trigger is every
stored document, the rollback backups included, being schema 2.
*/

// The generation this migration lands documents in. STATED, not imported from model/shape.mjs: a migration repairs to the
// shape as it was ruled, not as it may later become -- the reason tools/migrate-version.mjs restates the store's file rule.
// tests/migrate.test.js holds it equal to `SCHEMA` while the two are the same generation.
export const MIGRATION_TARGET = 2;

/*
The steps, in order. Each is `{ id, run(doc, log) -> log | undefined, needs(doc, log) }`: `needs` says whether the shape it
repairs is present, and `run` repairs the (already copied) document in place, returning a new log when it changes the log.
*/
const STEPS = [
	/*
	F1 -- `link.flow` becomes `direction`, stored as `forward` or `reverse`, absent meaning none: the words the CLI and the
	help already used for it, and a stored value that says what it means. Frees `flow` for stored flows (SD10).

	Only a boolean is converted. A `flow` holding anything else was never a valid document, and is left for the validator
	to refuse -- a repair that guessed would turn a corrupt field into a declaration nobody made.
	*/
	{
		id: 'direction',
		needs: (doc) => (doc.links || []).some((l) => l && typeof l.flow === 'boolean' && !('direction' in l)),
		run: (doc) => {
			for (const l of doc.links || []) {
				if (!l || typeof l.flow !== 'boolean' || 'direction' in l) continue;
				l.direction = l.flow ? 'forward' : 'reverse';
				delete l.flow;
			}
		},
	},
	/*
	P-6 -- undo history starts at the cutover. A stored inverse predates every step above, and undo replays it without
	the planner, so a record kept across the batch would restore the old shape -- `flow` here, a waypoint at F-c.

	Keyed on the generation, the one step that is: nothing else in a log says which shape its records were written in.
	The version is kept -- the high-water mark of the recorded version and the top record's seq, as `Log.from` takes it --
	so the next commit mints the next number and a client's `expect` still means what it meant.
	*/
	{
		id: 'history',
		needs: (doc, log) => doc.meta?.schema !== MIGRATION_TARGET && !!log && Array.isArray(log.records) && log.records.length > 0,
		run: (doc, log) => {
			const top = log.records[log.records.length - 1]?.seq;
			const version = Math.max(Number.isInteger(log.version) ? log.version : 0, Number.isInteger(top) ? top : 0);
			return { version, cursor: 0, evicted: 0, evictedHuman: 0, records: [] };
		},
	},
	// the generation, stamped last, once every step before it has repaired what it keys on
	{
		id: 'schema',
		needs: (doc) => doc.meta?.schema !== MIGRATION_TARGET,
		run: (doc) => { doc.meta = { ...(doc.meta || {}), schema: MIGRATION_TARGET }; },
	},
];

/*
`migrateFormatBatch(doc, log)` -> `{ doc, log, steps }`: the migrated document, its log (the same object when no step changed it,
null when there was none), and the ids of the steps that ran, in order -- empty for a document already migrated.
*/
export function migrateFormatBatch(doc, log = null) {
	let out = structuredClone(doc);
	let outLog = log;
	const steps = [];
	for (const step of STEPS) {
		if (!step.needs(out, outLog)) continue;
		const next = step.run(out, outLog);
		if (next !== undefined) outLog = next;
		steps.push(step.id);
	}
	return { doc: out, log: outLog, steps };
}

// the step ids, in order -- what the dry run reports against
export const MIGRATION_STEPS = STEPS.map((s) => s.id);
