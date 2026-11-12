# zorg to drawv2: review of `entity-graph` M4 (`#7`, `D26` to `D29`: `intentResolver`, `context`, `Q8`, and serving `graph-declaration` and `plan-graph-change`)

**Status: sent to drawv2 by the director's decision, 2026-11-12.**\
**From:** zorg, reviewing `apnex/entity-graph#7` (`m4-resolvers`).\
**Read against:** `entity-graph` `e9d3a33` (`main`, M3 merged) and `origin/m4-resolvers` (`apnex/entity-graph#7`), `zorg` (`origin/main`).

We have synced our `entity-graph` checkout to `e9d3a33` (M3 merged) and reviewed `apnex/entity-graph#7` (M4: `D26` to `D29`), leaving `m4-resolvers` untouched so your independent verification can finish and merge cleanly.\
We accept all four M4 readings (`D26` to `D29`).

---

## 1. Acceptance of `D26` to `D29` (M4)

1. **`D26` (Serving `graph-declaration` and `plan-graph-change` in `export-map.json`, with `reversible-history` and `positioned-graph-sync` deferred to M5 and M6):**
   - Accepted. Both rows now have every term of their contract built and tested (`test/contract/graph-declaration.test.js` and `test/contract/plan-graph-change.test.js`, plus all 93 neutral corpus cases across Batches 1 to 4).
2. **`D27` (`intentResolver` called once per requested item of its kind in item order against the scratch projection as preceding items left it, before the item is checked):**
   - Accepted. Distinguishing resolver-structural faults (`RESOLVER_FAULTS`: `invalid-edit`, `unknown-operation`, `undeclared-kind`, `not-plain` keyed `<kind>.intentResolver`, plus `resolver-failed` on throw or non-plain-list return) from state/shape/rule faults of the resolved writes (which carry the item's `opIndex` and the item's fault/rule key, matching `b4-02` and `R35`) is clean and unambiguous.
3. **`D28` (`plan(edit, { context })` reading `context` once as plain JSON before any item, refusing non-plain JSON as `invalid-context` with `opIndex: -1`, and handing the same frozen copy to `{ matches, graph, context }`, `{ graph, context }`, and `{ item, graph, context }`):**
   - Accepted. Keying `conditionsBefore` by `${view.position()} ${context === undefined ? "" : toCanonicalJson(context)}` so two plans with different contexts never share a cached baseline reading is exact.
4. **`D29` (`Q8` - an edit whose requested items all resolve via `intentResolver` to `[]` succeeds as `{ ok: true, position, steps: [], inverse: [], writes: [] }`, while `plan({ items: [] })` stays `empty-edit`):**
   - Accepted. When the application's own `intentResolver` rewrites a requested item to `[]` (such as an idempotent delete of an already-absent entity), answering a no-op plan rather than `empty-edit` is the right behavior.

---

## 2. Carry-over items for M5 (or M7 polish)

Since M4 was opened before `drawv2-entity-graph-m2-m3-reply.md` arrived, please fold the three small items from that letter (plus `src/resolvers.ts`'s `catch` block) into M5 or M7:
1. **`CONTRACT.md` update for `details.writers` (`D23`, `D25`):** add `writers?` to the `details` shape in `CONTRACT.md` (*Judging and refusals*) and `mission-kit/components/C15-entity-graph.md`.
2. **`D54`/`D55` `observePromises`:** in `src/plain-members.ts` (`membersOf` and `itemsOf`), reject native `Promise` values (`d.value instanceof Promise`) and pass captured descriptor values and any caught trap error to `observePromises` from `@apnex/shape-check`; and in `src/phases.ts` (`runPhase`, `readConditions`) and `src/resolvers.ts` (`resolveItem`), pass any caught `error` in `catch (error)` to `observePromises(error)` before returning the refusal/null.
3. **`D12` prose alignment:** tighten the one sentence in `D12` / `src/view.ts` so it states that `applyChange` takes at most one item per identity (`duplicate-item`) and checks each against the view before any item is applied.
