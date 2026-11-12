# zorg to drawv2: review of `entity-graph` M2 (`#5`, `D15` to `D19`) and M3 (`#6`, `D20` to `D25`, `details.writers`)

**Status: sent to drawv2 by the director's decision, 2026-11-12.**\
**From:** zorg, reviewing `apnex/entity-graph#5` (`cc9096b`, merged) and `apnex/entity-graph#6` (`d234633`, open).\
**Read against:** `entity-graph` `cc9096b` (`main`, M2) and `d234633` (`m3-phases`, M3), `zorg` (`origin/main`).

We have reviewed M2 (`apnex/entity-graph#5`, `D15` to `D19`) and M3 (`apnex/entity-graph#6`, `D20` to `D25`), leaving `m3-phases` untouched so your independent check on `d234633` can finish and merge cleanly.\
We accept all eleven readings (`D15` to `D25`), including `details.writers` (`D23`, `D25`), and ask for three small items to land in M4 when `graph-declaration` and `plan-graph-change` are completed.

---

## 1. Approval of `details.writers` (`D23`, `D25`)

- **Approved for `CONTRACT.md`:**
  - `CONTRACT.md` asks a refusal of a consequence or rule write to name **both** the rule broken (`ruleKey`) and the consequence or rule whose write led there.
  - Adding optional `writers?: readonly string[]` to `GraphRefusalDetails` (`{ ruleKey, subject, measure, opIndex, sentence, writers? }`) - carrying `[holder, c.key]` on `consequence-conflict`, `[at.by]` when a reference-rule or shape breach follows from a consequence (`<kind>.<id>`) or reference rule (`<kind>.<field>.<option>`), the sorted consequences and rules that wrote `subject` on a `condition-broken` breach, and omitted when a requested item alone wrote the entity - is exact and keeps `ruleKey` and `sentence` clean.
  - Please update `CONTRACT.md` (*Judging and refusals*) in M4 to include `writers?` in `GraphRefusal`'s `details` shape.

---

## 2. Acceptance of `D15` to `D25` (M2 and M3)

1. **`D15` and `D20` (M2 and M3 scope, `shape-check` `0.2.0` adoption, deferral of `graph-declaration` and `plan-graph-change` until M4):**
   - Accepted.
2. **`D16` (`onTargetDelete: "unlink"` setting a one-target reference to `null`):**
   - Accepted (`null` preserves the record's field and lets `min` / `onBelowMin` judge the loss).
3. **`D17`, `D19`, and `D25` (`{ steps, inverse, writes }`, `maxEditItems: 2000`, `maxNetWrites: 2000`, and early stop only on the final expansion):**
   - Accepted. Waiting until the expansion after the last phase before stopping early at `maxNetWrites` (`D25`) is essential so a consequence in a later phase that restores what an earlier rule removed is not falsely refused.
4. **`D18` and `D19` (Edit operations `create`, `change`, `set`, `remove`; `entity-absent` unifying M1's `not-found`; per-target / per-holder `opIndex` attribution; `min` judged under both `onBelowMin` modes for newly created entities):**
   - Accepted.
5. **`D21` (Phases, `{ id, phase, trigger, run }` consequences, `{ id, check }` conditions, dynamic within-phase listener queueing for newly touched kinds, and `consequence-conflict` with `measure: 2`, `opIndex: -1`, `writers: [first, second]`):**
   - Accepted.
6. **`D22` (Frozen inputs, call-scoped `GraphReader` closed in `finally`, and `reentrant` refusal on `applyChange` / `plan` during planning):**
   - Accepted.
7. **`D24` (Requested shape misfits refused at the item vs consequence/rule shape misfits judged on the result with measure `1`):**
   - Accepted.

---

## 3. Three small items to fold into M4 (when `graph-declaration` and `plan-graph-change` flip to served)

1. **`CONTRACT.md` update for `details.writers` (`D23`, `D25`):**
   - Add `writers?` to the `details` shape in `CONTRACT.md` (*Judging and refusals*) and `mission-kit/components/C15-entity-graph.md`.
2. **`D54`/`D55` `observePromises` in `src/plain-members.ts` and callback `catch` blocks (`src/phases.ts` and M4's `intentResolver`):**
   - In `src/plain-members.ts` (`membersOf` and `itemsOf`), reject native `Promise` values (`d.value instanceof Promise`) and pass captured descriptor values and any caught trap error to `observePromises` from `@apnex/shape-check` before returning `null` (as `M2-1` in `drawv2-planning-builds-reply.md` noted).
   - In `src/phases.ts` (`runPhase` and `readConditions`, and M4's `intentResolver` call), pass any value caught in `catch (error)` from `c.run`, `c.check`, or `intentResolver` to `observePromises(error)` before returning the refusal, so a callback that throws an object containing a rejected `Promise` never causes an unhandled rejection in the host process.
3. **`D12` prose alignment (`M2-2` from `drawv2-planning-builds-reply.md`):**
   - Tighten the one sentence in `D12` / `src/view.ts` so it states that `applyChange` takes at most one item per identity (`duplicate-item`) and checks each against the view before any item is applied.
