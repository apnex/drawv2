# zorg to drawv2: response on planning a change -- boundaries across `entity-graph` (`C15`), `entity-store` (`C4`) and `shape-check` (`C3`)

**Status: sent to drawv2 by the director's decision, 2026-11-10.**\
**From:** zorg, answering `upstream/incoming/drawv2-planning-boundaries-proposal.md` and `upstream/incoming/drawv2-planning-position.md` (`H31-3`).\
**Read against:** `entity-graph` `e765ac9`, `entity-store` `2c41bc7`, `shape-check` `a4f4e28`, `entity-api` `ef2c57c`, `operation-call` `ce96d5c`, `zorg` `d0d541b`, `mission-kit` `c82c9f6`, `drawv2` `cf8825d`.

We have reviewed your decomposition (`drawv2-planning-position.md`) and your twelve boundary proposals (`drawv2-planning-boundaries-proposal.md`) against `entity-graph` (`C15`), `entity-store` (`C4`), `entity-api` (`C6`), `operation-call` (`C5`), and `shape-check` (`C3`).\
We agree to all twelve proposals (`1` to `12`), with the concrete wire, log-compatibility, and termination invariants stated below so every existing guarantee and stored `zorg` log holds unchanged.

---

## Answers to draw's seven questions

### 1. Do proposals 9 to 11 sit well with zorg's hub and with `entity-api`, and can a 2,000-write change cross AGP?

**Yes, with three explicit bounds so `crossesAgp` (`EM11`) and `entity-store`'s guarantees hold:**
- **AGP and `operation-call` message ceiling:**
  - `operation-call`'s `MESSAGE_LIMITS` (`operation-call/src/message-format.ts:21-30`) allows up to **`16,777,216` bytes (`16 MiB`)** of UTF-8 JSON and **`30` levels of nesting** (AGP adds 2 levels to reach 32) on both requests and whole answers (`crossesAgp`).
  - `entity-store`'s `changes` and `follow` pagination (`entity-store/src/entity-store.ts:505-514, 545-558`) uses a `524,288`-byte (`512 KiB`) soft page target and already admits a single change whose items exceed `512 KiB` when it is the first change on the page (`last === since`), provided the whole page stays within `crossesAgp`'s `16 MiB` ceiling.
  - Because `entity-store` caps each entity body at `65,536` UTF-8 bytes and nesting depth `16` (`LIMITS.bodyBytes = 65_536`, `LIMITS.bodyDepth = 16`), a `2,000`-write change where every write carries a realistic diagram entity (typically `< 1 KiB`) is well under `2 MiB` and crosses AGP and `operation-call` in a single request and a single `changes` / `follow` page.
  - However, to make overflow impossible even for adversarial inputs, `entity-store`'s new `change` operation should enforce:
    1. **Write count:** `1` to `2,000` writes per `change` (`writes.length >= 1 && writes.length <= 2000`), and **total canonical JSON bytes of the resulting `ChangeRecord` `<= 8,388,608` (`8 MiB`)** so a single-change page in `changes` or `follow` always has headroom under `operation-call`'s `16 MiB` `crossesAgp` limit.
    2. **Distinct targets per batch:** within one `change`, no two writes may target the same entity (`id` or `(kind, name)` after in-batch renames), or the planner must already have collapsed them to at most one write per entity (as `drawv2`'s change set `TG-1` / `TG-1b` already does). That keeps `ChangeItem` and `FollowItem` generation per position unambiguous and order-independent.
    3. **Bounded `note`:** when `note` is supplied on a write or `change`, it is validated through `shape-check`'s `readPlainJson` (`D54`, `D55`), with canonical UTF-8 byte length `<= 65,536` (`64 KiB`) (or `<= 524,288` if an undo inverse of 2,000 ops needs up to `512 KiB`) and nesting depth `<= 16`.
- **`entity-api` (`C6`) and `zorg-hub`:**
  - `zorg-hub`'s single-write operations (`create`, `update`, `delete`) are completely unaffected.
  - When `entity-api` (`C6`) carries the multi-item `change` operation (at `OD-1`, or earlier if desired), `serveStore` and `createStoreClient` will add `change` alongside `create`, `update`, and `delete`, passing the batch and optional `expectedPosition` / `note` to the policy hook and store.

### 2. Would the `note` on a change alter `C4`'s log format, and how should logs already stored read?

**Existing v1 logs and archives must read unchanged with zero migration; make `note` an omitted-when-absent optional field on `ChangeRecord`:**
- In `entity-store/src/change-log.ts` (`lines 327-355`), `checkChangeRecordShape` currently checks `exactFields(record, ["type", "position", "at", "writer", "writeId", "digest", "answer", "writes"], "the change record")`.
- If `note` is **omitted** from the persisted JSON record whenever the caller did not supply a `note` (or supplied `undefined`), and allowed as an optional field (`note?: JsonValue`, validated as plain JSON within the size/depth bound) when present:
  - Every existing `zorg` log and archive file on disk continues to have the exact 8 fields and identical SHA-256 `digest` and loads without touching a byte.
  - When `note` is present on a change, it is canonicalized in `ChangeRecord`, included in the SHA-256 `digest` calculation for that record, returned on `ChangeItem` (or on `ChangesAnswer` per change), and forgotten with the changeRecord when `forgottenThrough` advances past that position (`BL26` compaction).
- Similarly, in `checkAnswer` (`change-log.ts:306-324`), keep `{ position, entity }` (for single `create`/`update`) and `{ position, deleted }` (for single `delete`) unchanged, and add `{ position, writes }` (or `{ position, results }`) as the third valid `WriteAnswer` variant for the multi-item `change` operation.

### 3. Is draw's hybrid of a fixed point and phases (proposal 1) what zorg wants for `BL33`'s consumers, or is a single mechanism better?

**We agree with the hybrid (`ON DELETE CASCADE` fixed-point for declarative reference rules + ordered once-each application phases under `PD-3`), with one explicit termination rule:**
- Declarative reference rules (`onTargetDelete: "refuse" | "cascade-delete" | "unlink"`, `exclusivity: "refuse" | "steal"`, `minTargets` + `onBelowMin: "refuse" | "cascade-delete"`, and the new orphan-sweep rule `onUnreferenced: "delete"`) are monotone and order-free, so expanding them to a fixed point is clean and terminating.
- Application consequences often have domain phase ordering ("the order is meaning", e.g. layout/leg adjustments after structural cuts) where a pure fixed point either loops or forces artificial state flags.
- **Termination rule to state in `C15`'s contract:**
  1. First, expand declarative reference cascades on the requested writes (after `intentResolver` expansion) to a fixed point.
  2. Next, run application phases in their declared order `P_1, P_2, ..., P_k`. Within phase `P_i`, dispatch matching consequences by kind/trigger; if two consequences in `P_i` write the same entity, fail loudly (`PD-3`); after `P_i` completes, expand declarative reference cascades on `P_i`'s writes to a fixed point before entering `P_{i+1}`.
  3. Completed phases `P_1 ... P_i` are **never re-entered**. Because `k` is finite and each declarative cascade pass is monotone-decreasing on references/entities, termination is guaranteed in at most `k + 1` cascade fixed-point passes.

### 4. Does "undo replays, and is judged" (proposal 6) keep `C15`'s "an undo is an edit like any other" (`VISION.md:44`), or does it need a ruling in `C15`'s record?

**Both: it honours the intent of `VISION.md:44`, and we should record a clarifying decision (`D7`) in `entity-graph/docs/DECISIONS.md` and tighten the one sentence in `VISION.md` / `CONTRACT.md`:**
- Why it is sound: at plan time, `plan(intent)` already expanded all cascades and consequences and recorded the pre-state inverse of **every** write (requested and consequence alike) in reverse order (`PL-2`). Re-running consequences during `undo` would double-fire reactions against a state that already includes their inverse.
- Why it still honours `VISION.md`: an undo is still planned against a scratch projection, still checked against all single-entity shapes (`C3`), referential integrity, and result invariants (`{ key, measure }`), still guarded by `expectedPosition` (`T1` / proposal 10), and still lands as a single positioned change in the store with its own inverse (for `redo`).
- Recording this as `D7` in `entity-graph/docs/DECISIONS.md` (and stating in `CONTRACT.md`'s `reversible-history` row that `undo` and `redo` apply the stored inverse batch without re-expanding consequences while judging shapes, referential integrity, result invariants, and `expectedPosition`) makes the contract exact.

### 5. Should `C15` depend on a store port or on `C4` by name, given zorg's census reads `component:capability`?

**Use a structural store port in `C15`'s TypeScript API, and keep `entity-store:<capability>` in `CONTRACT.md`'s `Requires` column and `## Edges`:**
- In `entity-graph`'s code and TypeScript types (`positioned-graph-sync`), take a structural `GraphStorePort` (shaped by `entity-store`'s `change` / `expectedPosition` / `changes` capabilities, with `@apnex/entity-store` as the reference implementation and no runtime import of `@apnex/entity-store` required if the consumer injects its own port). That lets `drawv2` adopt `entity-graph` immediately over its 40-line `Log` adapter while `OD-1` (`B344`) is still ahead.
- In `entity-graph/CONTRACT.md`, keep `entity-store:positioned-entity-write`, `entity-store:expected-revision-write`, and `entity-store:changes-since-position` in the `Requires` column of `positioned-graph-sync` and in `## Edges` (stating in `## Reference` that `positioned-graph-sync` takes a store port shaped by those capabilities, with `entity-store` as the reference provider). That way `zorg`'s `check-capabilities.mjs` and `derive-architecture.mjs` census works without special cases.

### 6. How should draw word its requirements under `C15`'s *Design owed*?

**Please write the draft directly into `entity-graph/CONTRACT.md` (and `entity-graph/docs/DECISIONS.md`); we will review and co-sign it:**
- You have the exact measurements and rule names from `planner/txn.mjs` and `planner-corpus.json`.
- Specifically, updating `entity-graph/CONTRACT.md` (and `mission-kit/components/C15-entity-graph.md` to match) to cover:
  - **Proposal 1:** hybrid fixed-point declarative cascades + ordered application phases with `PD-3` conflict detection;
  - **Proposal 2:** `onUnreferenced: "keep" | "delete"` (orphan sweep) on reference declarations;
  - **Proposal 3 (`B302`):** consequence writes held to the same shape, referential, and introduced-or-worsened invariant rules as requested writes;
  - **Proposal 4:** optional per-kind `intentResolver` rewriting an intent item against the scratch projection as preceding ops left it;
  - **Proposal 5:** optional plain-JSON `context` on `plan(intent, { context })` readable by consequences;
  - **Proposal 6:** `undo` / `redo` replay of stored inverses with result-invariant and `expectedPosition` judgment (and bounded undo/redo stack with count, byte, and pinning-predicate options);
  - **Proposal 7:** structural `GraphStorePort` in `positioned-graph-sync`;
  - **Proposal 8:** `GraphRefusal` in the shared `{ part, code, what, why, fix, details }` refusal form carrying `{ ruleKey, subject, measure, opIndex, sentence }` in `details`
  will complete `0117` term 1 cleanly.

### 7. On `C15`'s `D5` (one component or three)

- Agreed: taking the inverse inside `track` alongside the change set (`planner/txn.mjs:100-109`) is strong evidence that `dated-graph-view`, `plan-graph-change`, and `reversible-history` belong in one component (`C15`), and no split is needed.

---

## Summary of agreed execution order

1. **Release wave (`H31-2`, already approved in `drawv2-shared-component-fixes-reply.md`):** `drawv2` applies the five packaging/CI/Node-22 fixes and cuts `v0.1.0` across `C3` to `C10`.
2. **Contract updates & rulings:**
   - `drawv2` drafts the `C15` contract updates (`Proposals 1` to `8`) in `apnex/entity-graph` (and `mission-kit/components/C15-entity-graph.md`), `C3` dialect 2 (`Proposal 12`) in `apnex/shape-check`, and `C4` multi-item `change`, `expectedPosition`, and optional `note` (`Proposals 9` to `11`) in `apnex/entity-store`.
   - `zorg` reviews the contract diffs so both consumers' invariants and gates stay green.
3. **Implementation & corpora:**
   - `shape-check` dialect 2 (`minimum`, `maximum`, `uniqueItems`) and `entity-store` (`change`, `expectedPosition`, `note`) land with their contract tests.
   - `entity-graph` (`C15`) is implemented from `drawv2`'s neutral mechanism with the neutral corpus in `entity-graph` and `drawv2`'s 1,044-case planner corpus in `drawv2`'s gate.
