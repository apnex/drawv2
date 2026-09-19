# draw -- how the transaction contract was delivered

The plan that built `docs/spec/TRANSACTIONS.md`, and the artifacts that plan produced.

> **Status: EXECUTED.** CS1 through CS5 shipped; this is kept because two of its sections are still
> load-bearing rather than because the schedule is interesting.
>
> **Section 2 is gated.** `npm run gate` runs `scan-claims` against it, and a deletion row without
> `[V]` evidence fails the build -- a row here *is* the authorisation to remove something, which is
> why it outlives the milestone that produced it.\
> Section 3 records where the built system deviated from what was specified, which is the only
> honest place that can live.
>
> **In `dev/` rather than `docs/`** because it is a delivery record, not the interface. A reader
> asking what a write IS wants `docs/spec/TRANSACTIONS.md`; a reader asking why a symbol is gone,
> or where the implementation departed from the design, wants this.
>
> **Evidence markers.** `[V]` verified by reading the cited `file:line` -- `[I]` inferred --
> `[A]` assumption. No deletion row may be justified by an unmarked claim (**GR2**).

---

## Contents

| section | Section | What is recorded there |
|---|---|---|
| 1 | The milestone sequence | CS1 -> CS6, entry conditions, verification gates, test ledger |
| 2 | What is deleted | the deletion tables, the deletion-consequence contract, three demonstrated traces |
| 3 | Recorded deviations | X1-X17, where the build departed from the design |
| 4 | Backlog seed | B1-B9, `dev/BACKLOG.md` as it stood at CS1 |

---

## 1. The milestone sequence - CS1 -> CS6

### 6.1 Reversibility

Two axes, tracked separately: **green-and-stoppable** (the tree is green and the product works) and **revertible** (the change can be backed out).

CS1-CS4 are code-revertible: no user file changes shape, and the CS2 `log` key is ignored by any pre-CS2 binary `[V, server/validate.js:159-221 has no top-level unknown-key loop; model/model.mjs:259-276 reads only KEY[kind], meta, selection]`.\
**CS5 is forward-only.**\
CS6 is code-revertible.

### 6.2 Amendments to locked decisions

Three locked decisions are reversed by this arc, plus the wire and schema sections.\
*(2026-09-03: `SCOPE.md` was split and removed.\
The decisions and their amendments are in `dev/DECISIONS.md`, the wire and schema in `API.md`.\
The line references below are to the file as it stood, and are kept because this table records what each milestone amended rather than where to look today.)*\
Each is amended **in the milestone that breaks it**, in the file's existing dated-amendment form (10 such blocks already exist `[V, SCOPE.md:17, :28, :33, :40, :44, :48, :52, :59, :74, :215]`).\
Pinned by **GR10**.

| lines | locked text | amended at | becomes |
|---|---|---|---|
| `SCOPE.md:17-25` (now `dev/DECISIONS.md`) (decision 1) | center-origin migration of legacy top-left docs | **CS1** | dated amendment retiring the migration, preserving the (-930, -510) transform and the clamp rule verbatim |
| `SCOPE.md:210-211` (now `dev/DECISIONS.md`) | *"Undo/redo: client-side command stack"* | **CS3** | server-side per-diagram log + cursor; the browser holds two booleans and a label |
| `SCOPE.md:149-150` (now `dev/DECISIONS.md`), `:223-224` | *"Server never pushes model changes except snapshot-on-request and acks"* / *"server->client pushes beyond hydrate/ack"* out of scope | **CS3** | the server broadcasts one `change` per accepted transaction, origin excluded |
| `SCOPE.md:135` (now `dev/DECISIONS.md`) | ws `apply` -> `ack{rev}` | **CS3** (verb), **CS5** (`rev`) | `commit`/`undo`/`redo` -> `ack{version, ...}` |
| `SCOPE.md:136` (now `dev/DECISIONS.md`), `:146-148` | `push` full-document resync, client-authoritative | **CS4** | `resume {diagram, version}` -> `sync` \| `snapshot` \| `snapshot{rewound}`; `create {name, doc}` for adopt-local-content |
| `SCOPE.md:113` (now `dev/DECISIONS.md`) | `"rev": 12` in the entity JSON | **CS5** | `"version": 12`, `"schema": 1`; `grid` gone |
| `SCOPE.md:152-161` (now `dev/DECISIONS.md`) | REST section | **CS5** | records deviation **X1**: `/api/v1` is redefined **in place** |
| `SCOPE.md:217` (now `dev/DECISIONS.md`), `:225` | *"Still strictly read-only - it adds no mutation path"* / *"a \*write\*/mutation CLI"* out of scope | **CS6** | `draw undo` / `draw redo` are write verbs - answered deliberately, or the exclusion stands and they are not built. `draw history` at CS3 needs no amendment: it is a read. |

### 6.3 Sequence at a glance

| id | milestone | green & stoppable | revertible | new user-visible capability |
|---|---|---|---|---|
| **CS1** | the primitive (server-internal, wire-invisible) | yes | yes | none by design |
| **CS2** | persist the log | yes | yes (a pre-CS2 binary ignores the key `[V]`) | none - the log is still unread |
| **CS3** | browser boundary + server undo + change broadcast | yes | yes | Ctrl+Z survives an agent write; two viewers converge; a reversal cannot be issued blind and the human's reclaim cannot be raced |
| **CS4** | kill `push` | yes | yes | offline content lands in a new diagram instead of destroying one, and survives a tab close |
| **CS5** | schema `rev`->`version`, drop `grid` | yes | **NO - POINT OF NO RETURN** | a version integer that means something |
| **CS6** | surface polish | yes | yes | `undo {to:seq}`, the eviction floor surfaced, 409 recovery records, CLI write verbs |

---

### CS1 - the primitive - server-internal, wire-invisible

#### Entry condition

Green before the first line of CS1 is written:

| # | must be true |
|---|---|
| 1 | `npm run gate` exists in its pre-CS1 form and an **installed** `.git/hooks/pre-push` enforces it (**GR1**). |
| 2 | This document is committed as `docs/spec/TRANSACTIONS.md`, rulings `[LOCKED]` per `HIERARCHY.md:8-9`. |
| 3 | `dev/COMMIT-DELETIONS.md` is committed - one row per deleted symbol in section 7.1-7.3, per the section 7.4 contract. |
| 4 | `dev/BACKLOG.md` exists, seeded with B1-B9 (section 10), each row carrying evidence and either a closing milestone or a revival trigger. |
| 5 | `tools/scan-claims.mjs` is committed and green over its two scopes. |

#### What changes

| file | change |
|---|---|
| `model/ops.mjs` | **new.** `applyOps`, `clone`, the op vocabulary. Sovereign, browser-reachable (`server/app.js:150` `[V]`). |
| `model/shape.mjs` | **new.** Declares `{composite, optional}` per kind; `server/validate.js` imports it (`server/validate.js:7` already imports `model/index.mjs` `[V]`). `clone`'s deep-copy list and D10's absent-key rule both derive from this one table - the two sets are genuinely different today `[V]`. |
| `server/txn.mjs` | **new.** `plan`, `commit`, `undo`, `redo`. Header carries the `Provenance:` block transplanted verbatim from `server/commit.mjs:1-9` `[V]`. |
| `server/log.mjs` | **new.** The bounded ring: `append/canUndo/canRedo/toJSON/from`, caps, never-evict-last, the `evicted` counter. A file split, not a design change - it makes I14 testable without constructing a transaction. |
| `server/docfile.mjs` | **new (D18), seam only.** `serialize(doc, log)` / `parse(text)`. Round-trip gate at CS2. |
| `server/store.js` | `commit/undo/redo/install` added; `Store(dataDir, {flushMs, writeDoc, now})` injection seam (**GR4**); **`Store.init` throws instead of seeding (D17, GR8, I15)**. `install(id\|null, doc, log = new Log(0))` - boot passes `Log.from(...)`, only `create` takes the default. **`adopt()` and `loadInto()` fold into `install()` in this same milestone**: they are the only other `model.load` callers in the tree (`:156`, `:226` `[V, exhaustive grep]`), `loadInto`'s sole caller `replace` becomes an `install()` adapter here, and **GR3** allow-lists exactly one whole-document entry. |
| `server/rest.js` | D19's two lines in `handleSlidesPush`: `store.patchMeta(diagramId, {slides:{presentationId, pageId}})` before the 200 at `server/rest.js:225` `[V]`. |
| `docs/spec/SCOPE.md` | decision-1 dated amendment - retires center-origin migration, preserves the transform and clamp rule verbatim. |
| `model/surface.mjs` | the 930/510 aliasing warning moves here from `server/store.js:40-41` `[V]`, beside the constants it warns about (`ZONE_EXT` at `model/surface.mjs:8` `[V]`). |
| **deleted** | `server/commit.mjs` (whole file); `planMutation` -> `plan()`; `store.applyOps` -> `model/ops.mjs`; `migrateLegacy` + **both** call sites; the boot rewrite-everything `markDirty`; both `model.onChange(() => markDirty)` subscriptions; `adopt`; `loadInto`. Full justification per symbol at section 7. |
| **kept as adapters** | `store.apply(id, mutation)` -> 3 lines over `commit`, old error string preserved; `store.replace` -> `install`. Both die at CS3/CS4. |

#### New code that is not a deletion

- **Group member-steal.** There is **no** "a node belongs to at most one group" rule anywhere on the
  server: `planMutation`'s `put` branch is a collection-limit check and one `ops.push`
  (`server/store.js:76-79`); `trimGroupsHolding` is called only from the `del` branch (`:87`, `:94`); the
  group check verifies member *existence* only (`server/validate.js:150-153`) `[V]`. Moving it from
  `app/src/commands.js:157-175` is new server code, and it closes the live `POST /groups` hole (**B1**) as a
  side effect.
- **The `set`-inverse put-fallback (D10)**, derived from `model/shape.mjs`.
- **The projection**, and the `actor` field (D20) - at CS1, not later, to avoid a second log-format
  migration after CS2.

#### Why here

Everything downstream is a caller of this.\
It is the only milestone with zero wire, zero client and zero schema change - if the planner is wrong, it is wrong in isolation.

#### Verification gate

| # | must be green |
|---|---|
| 1 | All **183** existing tests pass unchanged `[V, npm test executed this session at 67d229d: tests 183 / pass 183 / fail 0]`. `store.apply`'s contract is preserved; `tests/store-atomicity.test.js`'s three `rev` assertions (`:32`, `:47`, `:64`) still hold because `Model.emit` still owns `rev` (`model/model.mjs:48`) `[V]`. This is the **adapter-fidelity control** - every one of the 183 reaches the store through single-op paths, so it proves the adapter, not the planner. |
| 2 | **GR5** differential oracle vs `planMutation`, green **in the same commit that deletes it**, and the reference frozen into `tests/fixtures/`. |
| 3 | **GR3** source scan in the gate from the end of the first commit, extended to `.load(`, plus the runtime assertion inside `install()`. |
| 4 | **Undo/redo/`Log` certified here, not at CS2/CS3.** I5 round trip + a cursor/eviction property test with the cursor mid-log. They ship at CS1; they are proven at CS1. |
| 5 | I1 plan-purity; I3 inverse round trip **iterating `model/shape.mjs`**; I4 cascade-as-one-unit x5; I6 no-op drop; I8 aliasing; batch ordering (`put` waypoint then link referencing it); group-steal incl. multi-group overlap; the 2000-op cap. |
| 6 | **GR8 / I15**: a data dir where every candidate file fails validation **refuses to boot**, non-zero, with per-file reasons. |
| 7 | **D19**: a Slides push to a URL with no `#slide=` fragment reuses the remembered `pageId` on the next push. No test covers this today - `tests/slides.test.js:237-261` tests the *fallback*, which becomes the only path if the binding writer disappears `[V]`. |
| 8 | Benchmark: `plan()` on `diagrams/diagram-000001.json` (**6912 B pretty, 65 entities** `[V, measured]`) < 1 ms. The projection is two O(doc) passes per transaction; the repo has form for this measurement (`server/store.js:231-236` cites a ~2900x figure) `[V]`. CS2 and CS3 must not regress it. |
| 9 | `Store` accepts `{flushMs, writeDoc, now}` (**GR4**); **GR9**'s `flush()` post-condition `log.records.every(r => r.seq <= log.version)` + the append-time `change.seq === log.version` installed; the `SCOPE.md` decision-1 amendment and the 930/510 warning present in the same commit as the `migrateLegacy` deletion (**GR10**). |
| 10 | No flushed file gains a `meta.version` key - the counter lives only in `log.version` until CS5 (D6, D27). |

**Expected tests: 183 -> ~214** `[I]` - ~20 planner/inverse/cascade + ~11 for the differential oracle, writer scan, claim scan, `Store.init` refusal, `actor` presence, the undo/redo/`Log` battery x3, the injection seam, the D19 regression and the benchmark.

**Safe to stop: yes.\
Revertible: yes.**\
Nothing on the wire changed; no user file changed.

---

**Ordering constraints that bind across milestones [LOCKED].**

| # | Constraint | Why |
|---|---|---|
| O1 | `app/src/sync.js:115` `history.clear()` is **not** deleted before the `server/rest.js:56`/`:70` snapshot->change replacement lands. | Deleting it first leaves surviving undo state **stale** rather than merely cleared `[V]`. |
| O2 | `model/model.mjs:48` `rev++` has a **hard floor at CS5**. | `tests/store-atomicity.test.js:32`, `:47`, `:64` are CS1's adapter-fidelity control, valid only while `Model.emit` owns `rev` `[V]`. Landing the deletion earlier destroys CS1's own entry gate. |
| O3 | `createGroup`'s browser row (`app/src/commands.js:157-175`) lands only once CS1's multi-group-overlap test is green. | The steal rule does not exist on the server today `[V, server/validate.js:150-153 checks member existence only]`. |

---

### CS2 - persist the log

#### Entry condition

CS1's gate green.\
The `server/docfile.mjs` seam and the `Log` ring exist and are certified.

#### What changes

| file | change |
|---|---|
| `server/log.mjs` | `toJSON()` emits `{version, cursor, evicted, records:[...]}` - **`version` included**. Bounds per D23: `LOG_MAX = 100` **and** `LOG_BYTES = 32 KiB`, evict oldest first, **never evict the only record**. `Log.from(json, fallback = 0)` reads its own persisted `version`. |
| `server/docfile.mjs` | the D18 seam becomes load-bearing: `serialize(doc, log)` composes `Model.toJSON()` and `log.toJSON()` into one text; `parse(text)` splits them. **No string surgery in `store.flush`.** |
| `server/store.js` | `flush()` writes through `docfile.serialize`; `install()` and `create()` both initialise `entry.log` - `create()` builds its own entry literal at `server/store.js:178` and never routes through the load path `[V]`, so both need it. **Failed flush reschedules inside the catch (`:322-324`)**: today the catch logs and leaves `dirty = true` with the timer already nulled at `:306`, so recovery waits for the next edit or SIGTERM `[V]` (**B4**). |
| `server/validate.js` | a shape-only, **tolerate-and-drop** gate on `log`, matching the `selection` precedent (`server/validate.js:216-219`, rationale `:223-226`) `[V]` (I13). |
| `server/rest.js` | a per-diagram `flushFailures` counter surfaced in `GET /health` (already returns `{status, diagrams}`, `server/rest.js:79-81` `[V]`) and in `draw status`. A non-zero counter files a row in `dev/BACKLOG.md` - the retry alone repairs the mechanism and leaves the failure unobservable. |

#### Why the log must be durable before CS3

CS3 deletes `class History` (`app/src/commands.js:34-72` `[V]`) and makes the server log the sole authority for undo.\
Landing CS3 first would leave the tool, for one milestone, **strictly worse than today**: today an agent write destroys a browser's undo (`app/src/sync.js:115` `this.history.clear()`, reached from the snapshot broadcast at `server/rest.js:56` `[V]`) but a *server restart* does not, because the stack is in the tab.\
The log must be durable before the tab's copy is deleted.

Nothing about the log serializer depends on the final `meta` shape: `validateDoc` has no top-level unknown-key check - the whitelist at `server/validate.js:166-168` is over `doc.meta` keys only - and `Model.load` reads only `KEY[kind]`, `meta`, `selection` (`model/model.mjs:259-276`) `[V]`.\
A `log` key passes today's unmodified validator.

#### Verification gate

| # | must be green |
|---|---|
| 1 | **I10**: `parse(serialize(doc, log))` deep-equals the input, **including the 10,169 B delete-all record** `[V, measured]`; flush issues exactly one `writeDoc` per publish. |
| 2 | **I5 across `new Store()`** - undo survives a **process** restart. Persistence proof only; correctness was certified at CS1. |
| 3 | **GR9 / I12**: restart -> commit -> `version === preRestart + 1`; no `seq` collision inside the ring; the `flush()` post-condition fires on all existing tests. |
| 4 | **I14** bounding, incl. *"delete-all of a 65-entity diagram is one 10 KB record that is never evicted while it is alone"*; eviction increments `evicted`, and `evicted` survives a restart. |
| 5 | **I13** corruption tolerance: a `log` key missing, malformed or truncated loads empty with a `console.warn` and **never** causes the diagram to be skipped (`server/store.js:125-128` `[V]`). |
| 6 | **I9**: `applyOps` and `log.append` in one synchronous turn; `markDirty` only *schedules* a macrotask (`server/store.js:300-310` `[V]`); an injected `writeDoc` observing every publish never sees ops without their record. |
| 7 | **B4** closed: an injected `writeDoc` failure reschedules and recovers without a further edit (uses the GR4 seam). |
| 8 | `flushFailures` observable in `/health` and `draw status`, and files a backlog row. |
| 9 | A **pre-CS2 binary** boots against a CS2-written file and lists all 17 diagrams - the reversibility proof `[V, mechanism: server/validate.js:159-221 checks no top-level keys; model/model.mjs:259-276 reads only KEY[kind]/meta/selection]`. |

**Expected tests: ~214 -> ~228** `[I]` (+14).\
**Safe to stop: yes.\
Revertible: yes** - uniquely so for a file-format change.

---

### CS3 - browser boundary + server undo + change broadcast

**Global undo goes live in this milestone - and it goes live with its safety mitigations, not after them.**\
`actor` shipped at CS1 (D20); **mandatory `expect` on undo/redo (D14)** and **the unraceable reclaim hold (D22)** land here, because this is the first milestone in which ws `undo` exists.\
The fourth mitigation, `undo {to: seq}` (D21), follows at CS6 - it is bulk ergonomics and bounds no hazard.

#### Entry condition

CS2's gate green - the server log is durable and carries its own `version`.\
Without that, deleting `class History` leaves no durable undo anywhere.

#### What changes

| file | change |
|---|---|
| `app/src/changes.js` | **new.** `Changes`: `commit/undo/redo/canUndo/canRedo/setCounts` + the D11 client-side coalesce window (`NUDGE_COALESCE_MS = 600`, `app/src/input.js:43` `[V]`). |
| `app/src/commands.js` | 231 lines `[V, wc]` -> ~=90 pure request builders. Deletions per section 7.3. `clone` **moves** to `model/ops.mjs`; the `engine/` import (`:11`) goes with the cascade. |
| `app/src/main.js` | one new line: `changes.onCommit((request) => sync.submit(request))`. D4 inverts the dependency instead of wrapping 26 `history.commit(` call sites `[V, counted]` - there is then no way to forward an uncommitted change. |
| `app/src/sync.js` | deletions per section 7.3. **Added**: `submit(request)`, the outbox, inbound `change`/`ack` handling with the mid-gesture defer rule (D12). |
| `server/protocol.js` | `case 'apply'` (`:112-119`) -> `case 'commit'`; `case 'meta'` (`:135-142`) -> `{op:'meta'}`; `case 'select'` keeps status semantics but stops acking `{rev}`; `rejectIfLocked` (`:70-76`) folds into one gate at the commit entry. `changeBody()` / `ackBody()` exported beside the existing `snapshotBody()` (`:27-33`, which exists *"so the wire shape has one definition"* - `:24-25` `[V]`); the ack is literally `{...changeBody(change), acked: txnId}` - **`ops` included, `inverse` excluded**. **D14**: ws `undo`/`redo` from a session that did not originate the top record are refused without `expect`, as a typed `error {code:'expect-required', version}` (**GR11**). |
| `server/hub.js` | `broadcast` gains origin exclusion and a per-session `try/catch` - it is a bare `forEach` today (`server/hub.js:25-29` `[V]`). Standing as **GR12**. |
| `server/rest.js` | `commitWrite` + `commitSelection` (`:46-58`, `:64-72`) -> `commitTxn` + `commitStatus`; `POST .../apply` (`:180-184`) -> `POST .../commit`; the two snapshot broadcasts (`:56`, `:70`) -> `change` and `selection`. `GET /api/v1/diagrams/:id/history?limit=` - unlocked (reads are always open, `server/rest.js:2` `[V]`), projected per D26. `POST .../lock` 200 body (`:146`) becomes `{token, expiresAt, version, canUndo, canRedo, logDepth, truncated}`; add `GET .../lock -> {owner, expiresAt}` - today it falls through to `unknown collection` (`:124` `[V]` - `:188` is the *write* path's fall-through, which a GET never reaches: `:96` routes only POST / PUT-selection / PATCH / DELETE), so an agent can discover lock state only by attempting a write and reading a 423. **D14**: `POST .../undo\|redo` without `expect` -> `400 {code:'expect-required', version}` (**GR11**). |
| `server/locks.js` | **D22**: `reclaim(id)` records `heldUntil = now + HOLD_MS` (30 s, or cleared by the first client commit), and `acquire` returns `null` with `{error:'reclaimed by the human', retryAfter}` inside the hold. Today `reclaim` is `this.map.delete(id)` (`:69-71`) and `acquire` re-succeeds immediately (`:38-44`) `[V]`. |
| `cli/` | `draw history` + `cli/tpl/history.jq`, matching the six templates that already exist `[V, ls cli/tpl]`. A **read** verb - no `SCOPE.md` amendment needed. `draw status` surfaces `version`, `canUndo`, lock owner. |
| `store.patchMeta` | splits (D15): `meta.name` / `meta.slides.url` -> `{op:'meta'}` inside a transaction; `meta.slides.presentationId/pageId` -> `store.bindSlides(id, ...)` (status). `handleSlidesPush` switches from `patchMeta` to `bindSlides` in the same commit. |

#### Why here

It must land before anything that makes commits expensive, and immediately after CS2 so the projection's two O(doc) passes never run at preview rate.\
Today one 4-second 3-node drag produces ~60 server transactions (`app/src/sync.js:12` `PULSE_MS = 200`, one message per queued mutation `[V]`); after CS3, exactly 1.\
It also delivers the headline fix: an agent write no longer destroys the human's undo.

#### Verification gate

| # | must be green |
|---|---|
| 1 | A synthetic 3-node drag produces **exactly one** ws message. |
| 2 | `tests/undo.test.js`: agent writes via REST -> human reclaims -> ws `undo` reverses the agent's change. |
| 3 | **GR6** `tests/convergence.test.js` live, with all three injected faults, as a **standing regression**. |
| 4 | **Two vacuous greens must be rewritten here, not discovered later:** `tests/sync.test.js:15`'s `clearInterval(sync.pulse)` becomes `clearInterval(undefined)` - a silent no-op - so all three tests keep passing while testing nothing their comments claim `[V]`; and `tests/server.test.js:401`'s `await c.expect('ack')` **times out** at 3000 ms (`tests/server.test.js:42` `[V]`) once the `select` ack goes. **GR5** differential oracle vs the browser inverse builders (`app/src/commands.js:24-32` + the ten exported builders), green **in the commit that deletes them**. |
| 5 | The ack field list pinned in `server/protocol.js` as a single exported shape carrying `ops`; **I7** asserted as client == server at quiescence. |
| 6 | A session whose `send` throws does not prevent other sessions receiving the change, **and the REST caller still gets 200** - **GR12**, standing from here. |
| 7 | **I16**; and `from < V` is ignored and does not trigger `model.load()` (D7). |
| 8 | `GET .../history` live with the D26 projection, <= 16 KiB at cap, `inverse` absent under every query - **GR13**, standing from here; `cli/tpl/history.jq` ships. |
| 9 | Lock 200 body carries `{version, canUndo, canRedo, logDepth, truncated}`; `GET .../lock` returns owner + expiry. |
| 10 | `durableVersion` on every `ack` and `change`; the client prunes the outbox at `durableVersion`, **not at `ack`** - the store already knows the answer (`entry.dirty`, `server/store.js:300-310` `[V]`). |
| 11 | `tests/server.test.js:424` (REST selection broadcast) rewritten to expect `{cmd:'selection'}` instead of `snapshot` `[V]`. Inbound changes defer while `input.mode !== null`, tested (D12). |
| 12 | **B9's design question is ruled; the row remains open as N12's revival trigger.** Attribution lives **inside** the ring - the `actor` field on every Change (D20) - and nowhere else. Gate: `GET .../history` carries `actor` on every record the ring holds, D2's justification claims nothing past it, and section 8 carries **N12**. |
| 13 | Two `SCOPE.md` amendments committed in the same commit (`:210-211`, `:149-150`/`:223-224`) - **GR10**. |
| 14 | **D14 / GR11 - the verb cannot go live without its precondition**: `POST .../undo\|redo` without `expect` -> `400 {code:'expect-required', version}`, and a ws `undo`/`redo` from a session that did not originate the top record is refused the same way. |
| 15 | **D22 / GR11 - the remedy cannot be raced**: reclaim installs `heldUntil`; an agent's re-`acquire` inside `HOLD_MS` is refused with `retryAfter`; the human's Ctrl+Z then succeeds. |

**Expected tests: ~228 -> ~260** `[I]` (`tests/commands.test.js` 12 -> ~10, `tests/sync.test.js` 3 -> ~6, +31 new).\
**Safe to stop: yes.\
Revertible: yes.**

---

### CS4 - kill `push`

#### Entry condition

CS3's gate green.\
The outbox, the change broadcast and `durableVersion` exist - `push`'s replacement depends on all three.

#### What changes

| file | change |
|---|---|
| `server/protocol.js` | **deleted** `case 'push'` (`:120-134`). New `resume {diagram, version}` -> `sync {version}` \| `snapshot{doc, diagrams, locked, version, canUndo, canRedo}` \| `error {code:'unknown-diagram'}` \| **`snapshot{..., rewound:{from,to}}`** (D29). `create {name, doc}` -> `store.install(null, doc)`, server-minted id, `doc.meta.id` ignored. |
| `server/store.js` | **deleted** `replace` (`:257-274`) - see section 7.1. `loadInto` (`:225-229`) is already gone: it folded into `install()` at CS1 with its sole caller `[V, server/store.js:226, :268]`. |
| `app/src/sync.js` | **deleted** adopt-local-content (`:87-111`, the push at `:107`) and the reconnect push (`:201`) `[V]`. Outbox replay on `resume`; the outbox is persisted to `localStorage` on enqueue and drained on `resume` (D30). |

#### Verification gate

| # | must be green |
|---|---|
| 1 | `tests/server.test.js:168` (*"push replaces the document"*) and `:314` (*"REGRESSION: push as the FIRST message on a fresh socket"*) rewritten as resume+outbox tests `[V, both present]`. |
| 2 | `tests/server.test.js:545` and `:585` (validateDoc rejections via push) move to `create {doc}`, the surviving bulk-ingest path `[V]`. |
| 3 | **The data-loss fix (B2)**: offline drawing lands in a **NEW** diagram and does not touch the previously-open one `[V, app/src/sync.js:87-111]`. |
| 4 | `clientVersion > serverVersion` -> `{rewound}` surfaced in the readout, asserted (D29). |
| 5 | A tab close with unsent work, then reopen -> the outbox drains (D30). |
| 6 | Kill the server mid-debounce: the acked gesture is either present or **reported** - I16 plus the rewind reply; never silently reverted. |
| 7 | **I11** gated. |
| 8 | `SCOPE.md:136` (now `dev/DECISIONS.md`), `:146-148` amended in the same commit (**GR10**). |

**Expected tests: ~260 -> ~267** `[I]` (four rewrites, +7 new).\
**Safe to stop: yes.\
Revertible: yes.**

---

### CS5 - schema `rev` -> `version`, drop `grid` - POINT OF NO RETURN

> **The only irreversible milestone in the arc.** Approved as a named gate (**X4**) on two binding terms: a
> committed dry-run-and-verify migration script, and `diagrams.bak` retained until CS6 closes.

#### What makes it irreversible - exactly

1. **It rewrites 17 files git does not track.** `.gitignore:4` is `diagrams/*.json` `[V]`. `git checkout`
   restores nothing. All 17 are live user data `[V, ls diagrams/*.json | wc -l = 17]`.
2. **The old binary cannot read the new files.** `validateDoc` whitelists `doc.meta` keys to
   `id|name|rev|slides|grid` (`server/validate.js:166-168` `[V]`); a `version` or `schema` key returns
   `unknown meta key` -> the file is skipped (`server/store.js:125-128` `[V]`) -> the store reseeds when it
   empties (`:142` `[V]`).
3. **D17 changes the failure mode; it does not restore reversibility.** With `Store.init` throwing since
   CS1, that rollback is a named non-zero exit with per-file reasons - an outage instead of a silent data
   disappearance. Reversibility comes from `diagrams.bak` alone, which is why it is retained until CS6
   closes and not deleted in this milestone's own gate.

#### Entry condition

CS4's gate green; `tools/migrate-version.mjs` and `tests/migration.test.js` committed; `diagrams.bak` taken; no server answering `/health` on `$PORT`.

#### What changes

| file | change |
|---|---|
| `model/model.mjs` | `emit()`'s `rev++` **deleted** (`:48`) - a Model is a value container; versioning is a property of a transaction. `meta.grid` removed, including the deliberate non-defaulting at `:266-270` `[V]`. |
| schema surface | `meta.rev` -> `meta.version` at `server/store.js:25`, `:199`, `server/validate.js:167`, `:170`, `server/seed.js:37`, `kernel/adapt.mjs:63`, `model/model.mjs:31`, `cli/draw.sh:242`, `:261`, `cli/tpl/diagrams.jq:1`, `docs/spec/SCOPE.md:113`, `:135` `[V, all]`. `meta.grid` removed at `server/seed.js:38`, `server/store.js:26`, `server/validate.js:167`, `:169`, `kernel/adapt.mjs:63`, `model/model.mjs:31`, `:270` `[V]`. |
| `server/validate.js` | whitelist becomes `id\|name\|version\|schema\|slides`; **`meta.schema: 1`** minted in `cleanMeta`, restoring the generation-discriminator role `meta.grid` is losing (D8). |
| `server/txn.mjs` | `commit` begins assigning `meta.version = seq` alongside `++log.version` (D6, section 2.4 step 6). |
| `tools/migrate-version.mjs` | **new, committed** (**GR7**). |
| `docs/spec/SCOPE.md` | `:113`, `:135` amendments; the X1 REST-redefinition ruling recorded in the REST section. |

#### The migration - mechanized, not a shell one-liner

`tools/migrate-version.mjs`, committed, which:

1. **refuses to run if `/health` answers on `$PORT`** (`server/rest.js:79-81` `[V]`) - no writer interlock
   exists today, and a live `flushAll()` on SIGTERM (`server/server.js:32-37` -> `server/store.js:327-333`
   `[V]`) would silently revert migrated files;
2. selects with the store's own filename regex `^diagram-[0-9a-f]{6}\.json$` (`server/store.js:121` `[V]`;
   17 matches today `[V, counted]`), not `diagrams/*.json`;
3. **dry-runs into a temp copy** - migrate, boot a `Store` against the copy, assert 17 diagrams **and**
   per-id `toJSON()` deep-equality modulo `meta.rev`/`grid`/`version`/`schema`;
4. seeds `meta.version` from the file's own persisted `log.version` (0 when absent);
5. only then swaps; and **never deletes `diagrams.bak`**.

A count-only assertion would pass a `jq` typo that mangled every coordinate.\
That is why step 3 is per-entity, not per-file.

#### Verification gate

| # | must be green |
|---|---|
| 1 | Dry-run passes: `store.list().length === 17` **and** per-id deep-equality modulo the changed keys. |
| 2 | `diagrams.bak` **still present** at milestone close. |
| 3 | `tools/migrate-version.mjs` and `tests/migration.test.js` (over old-shape fixtures) committed. |
| 4 | A synthetic legacy doc (top-left coords, `grid` absent) produces a **named, actionable** boot failure - never a reseed. Guaranteed by GR8 since CS1. |
| 5 | Version monotonicity across the migration; **GR9**'s extended post-condition `meta.version === log.version` holds on every migrated file. |
| 6 | Rewrites: `tests/server.test.js:574` (`/invalid meta.rev/`) `[V]` and `:601-616` (disk fixture carrying `rev: 0` at `:606`) `[V]`; `tests/cli.test.js:55` (`/ID\s+NAME\s+REV/`) -> `VERSION` `[V]`; `tests/store-atomicity.test.js:32`, `:47`, `:64` `rev` -> `version` `[V]`, and its `store.apply` calls -> `store.commit`. |
| 7 | **GR10**: `tests/spec.test.js` asserts `SCOPE.md` carries no `push`/`apply`/`rev` wire token; `:113`, `:135`, `:152-161` amended in the same commit. |
| 8 | The `migrateLegacy` rationale, the decision-1 amendment and the 930/510 aliasing warning are all still in the tree `[V, grep]` - they landed at CS1; this is the re-assertion. |

**Expected tests: ~267 -> ~275** `[I]` (mostly in-place rewrites, +8 new).\
**Safe to stop: yes (the tree is green and the product works).\
Revertible: NO.**

---

### CS6 - surface polish

Carries the last of the four mitigations that condition global undo - `undo {to: seq}` (D21), the one that bounds no hazard and may therefore land after the verb.\
The other three were in place before global undo went live: `actor` at CS1, mandatory `expect` (D14) and the reclaim hold (D22) at CS3, where **GR11** has asserted them on every push since.

#### Entry condition

CS5's gate green; `diagrams.bak` still present.

#### What changes

| item | detail |
|---|---|
| **D21 - `undo {to: seq}`** | Both transports. One transaction, one version bump, one broadcast. The browser offers *"undo all N changes by `<actor>`"* when the top run is not the human's - readable only because `actor` shipped at CS1. ~25 lines reusing the primitive in a bounded loop. |
| **Durability wording into `SCOPE.md` and the README** | *"Undo survives a **process** restart; a machine-level kill can lose the last 200 ms of ws work - doc and log together, consistent, never corrupt."* There is no `fsync` anywhere in the server `[V, exhaustive grep: 0 hits across server/, document/, engine/, kernel/, app/, cli/]`; CS2's gate wording is what would otherwise reach the README as a stronger claim than the code makes (**X2**, **B6**). |
| **Eviction floor** | Never evict below the newest human-authored record, subject to the hard ceiling; when the ceiling forces it, `truncated` is set **and surfaced in the browser undo affordance**, not only in the API (I14). |
| rest | `expect` -> 409 with the recovery records in the body; undo/redo labels with attribution in the readout (*"undid `<actor>`'s move"*); CLI `draw undo` / `draw redo`. |

#### Verification gate

| # | must be green |
|---|---|
| 1 | `undo {to: seq}` reverses a run in one action, one version bump, one broadcast (**GR11**). |
| 2 | **I14** eviction floor active and `truncated` surfaced in the browser undo affordance. |
| 3 | CAS 409 on a moved top; the 409 body carries the recovery records. `GET .../history` attribution end-to-end. |
| 4 | `SCOPE.md:217` (now `dev/DECISIONS.md`), `:225` amended - or the write-CLI question is answered *no* and the exclusion stands (**GR10**); the durability wording carried into `SCOPE.md` and the README. |
| 5 | **`diagrams.bak` may be deleted only after this gate is green** `[V, X4 / GR7 - it is the only copy of 17 untracked files, .gitignore:4]`. |
| 6 | **GR11 still green end-to-end**: D14's blind-reversal refusal and D22's reclaim hold, both live since CS3, plus D21's bulk reversal shipped here. |
| 7 | **Arc close**: every `dev/BACKLOG.md` row is closed by its named milestone or carries a live revival trigger, and **all thirteen guardrails** (GR1-GR13) run green as standing regressions. |

**Expected tests: ~275 -> ~283** `[I]` (+8).\
**Safe to stop: yes.\
Revertible: yes.**

---

### 6.4 Test-count ledger

| milestone | in | out | net | basis |
|---|---|---|---|---|
| baseline | - | **183** | - | `[V, npm test at 67d229d: tests 183 / pass 183 / fail 0]` |
| CS1 | 183 | ~214 | +31 | ~20 planner/inverse/cascade + ~11 gate-mandated |
| CS2 | ~214 | ~228 | +14 | persistence, bounding, monotonicity, observability |
| CS3 | ~228 | ~260 | +32 | -2 builders, +3 sync, +31 boundary/broadcast/convergence, incl. D14 + D22 |
| CS4 | ~260 | ~267 | +7 | resume/outbox/rewind/I11 |
| CS5 | ~267 | ~275 | +8 | migration + legacy-failure + spec scan |
| CS6 | ~275 | ~283 | +8 | D21 + the eviction floor + 409 + CLI |

**Actual, at the milestones observed:** CS3c **239**, CS4 **253**, CS5 **270**, CS6 **280** `[V, npm test at a6adb7d, d3a717a, 6d6477f, and HEAD]`.\
The arc estimated 283 and delivered 280.\
That is a coincidence and not a validation - the per-milestone figures drifted in both directions, and no gate here was ever satisfied by hitting a number.\
The row exists to make the estimate falsifiable, not to be met.

Only 183 is verified.\
Every forward figure is `[I]` - an estimate, not a commitment, and no gate is satisfied by hitting a number.

---

## 2. What is deleted

Removal is work this arc intends to do.\
Every row is a **deletion with a milestone**, not a rename, and every row carries its `[V]`-marked justification - **GR2** fails the gate on a deletion row without one.

### 7.1 Server

| Symbol | Where | Justification | Lands |
|---|---|---|---|
| `commit(port, mutate)` - whole file | `server/commit.mjs:11-18` | D5. Two consumers, each cancelling a different axis (`server/store.js:242` vacuous validate, `:261` vacuous load) `[V]`; its own header concedes *"rejection safety comes from PURITY, not rollback"* (`server/commit.mjs:2-3` `[V]`); sole importer `server/store.js:14` `[V]`. Replaced by the verbatim `Provenance:` transplant into `server/txn.mjs`. | CS1 |
| `planMutation` | `server/store.js:65-99` | -> `plan()`, generalised 1->N ops `[V, server/store.js:65-99 read in full; sole caller server/store.js:245]`. **Gated by GR5**: deleted only in the commit that lands the green differential oracle. | CS1 |
| `applyOps` | `server/store.js:102-108` | -> `model/ops.mjs`, shared with the browser; clones on `put` (I8). Today `model.put(kind, op.entity)` aliases the wire object into the live model (`server/store.js:104`) `[V]`. | CS1 |
| `migrateLegacy` + **both** call sites - **conditional [LOCKED]** | `server/store.js:38-58`, `:123`, `:270` | **Deleted only in the commit that lands an absent-generation-marker REJECTION in `validateDoc`.** Today the grid check is guarded on `'grid' in doc.meta` (`server/validate.js:169` `[V]`) and coordinates bound to +/-960/+/-540 (`model/surface.mjs:6` `[V]`), while legacy top-left points run 30...1890 / 30...1050 - so a legacy doc confined to the **top-left quadrant validates clean and loads displaced by exactly (+930, +510)**, one-way, because `cleanMeta` stamps `grid:'center'` unconditionally (`server/store.js:26` `[V]`). Without the rejection the deletion is **silent, not loud**, and **GR8** is false as written. All 17 live files carry `meta.grid:'center'` `[V, measured]`; `server/store.js:39` returns early for every one. Its three surviving records land in the same commit - see Trace 2. | CS1 |
| The boot rewrite-everything `markDirty` | `server/store.js:137` | Existed because `migrateLegacy`+`cleanMeta` could alter the doc on load `[V, server/store.js:123, :136-137]`. With `migrateLegacy` gone and `cleanMeta` idempotent over a `validateDoc`-passed doc, boot rewrites nothing. **Keep exactly one targeted `markDirty`** for the filename-canonicalisation case at `:133-135`. | CS1 |
| The two `model.onChange(() => markDirty)` subscriptions | `server/store.js:160`, `:179` | Dirt is produced by `commit`/`setSelection`/`bindSlides` alone. `adopt()` (`:154`) and `create()` (`:165`) each install their own - both must go `[V]`. | CS1 |
| `adopt(doc, file)` | `server/store.js:154-163` | **`install()` must carry the `file` argument.** `entry.file` (`server/store.js:159` `[V]`) is the original filename of a doc whose name != `meta.id`; `remove()` unlinks it at `:212` before the canonical unlink at `:213`, both inside one try (`:211-217` `[V]`). Drop it and `path.join(this.dir, undefined)` throws, the catch swallows it, `${id}.json` is never deleted, `remove` returns success, and **the diagram resurrects at the next boot**. No test writes a mismatched filename `[V, exhaustive grep of tests/]`. -> `install(id, doc, log)`. The boot loader's whole-document entry - `model.load(doc)` at `:156`, `cleanMeta` at `:158`, its own `markDirty` subscription at `:160` - which is precisely what `install()` does, with a `Log` attached `[V, server/store.js:154-163; callers :136 (boot loop) and :149 (seed)]`. **Folded, not allow-listed**: after CS1, `install` is the only `model.load` caller in the tree (**GR3**, **I2**). | CS1 |
| `loadInto` | `server/store.js:225-229` | Sole caller is `replace` (`server/store.js:268`) `[V]`, and `replace` becomes an `install()` adapter in the same milestone - so it is dead the moment CS1 lands. -> `install()`. It is one of only two `model.load` call sites and **GR3** allow-lists exactly one `[V, exhaustive grep: model.load( at server/store.js:156 and :226 only]`. | CS1 |
| `apply(id, mutation)` | `server/store.js:237-249` | -> `commit(id, request, by, actor)` `[V, server/store.js:237-249; callers server/protocol.js:116, server/rest.js:48]`. Becomes a 3-line adapter at CS1 (contract preserved so all 183 pass); the adapter dies with its last caller. | adapter CS1, deleted CS3 |
| `patchMeta` | `server/store.js:276-285` | Assigns meta directly and never calls `emit()` - which is exactly why **a rename has never moved `rev`** `[V, server/store.js:281-283]`. Splits in two (D15): config meta -> `{op:'meta'}` inside a transaction; the Slides binding -> `store.bindSlides` (status). `bindSlides` is load-bearing, not bookkeeping - Trace 1. | CS3 |
| `case 'apply'` | `server/protocol.js:112-119` | -> `case 'commit'` `[V, server/protocol.js:112-119]`. | CS3 |
| `case 'meta'` - **inherits Trace 1's condition verbatim [LOCKED]** | `server/protocol.js:135-142` | **CS1 gate #7 (D19: the server-side binding writer) is a hard entry condition for this deletion.** Trace 1 makes `app/src/sync.js:264-268` conditional; `{op:'meta'}` is `{name?, slides:{url?}}` - config only (section 2.2, D15) - so deleting this case unconditionally would make the kept client row send a message no case handles and no op replaces, losing the binding by the exact mechanism Trace 1 exists to prevent `[V, docs/spec/TRANSACTIONS.md section 2.2 vs section 7.1]`. -> `{op:'meta'}` inside a request `[V, server/protocol.js:135-142; producers app/src/sync.js:127, :251, :258, :267]`. The rename path (`:251`) becomes an undoable config write under D15. | CS3 |
| `case 'select'`'s `ack {rev}` | `server/protocol.js:150` | The **verb survives** as a status verb; only the `{rev}` ack goes -> `{cmd:'selection'}` broadcast `[V, server/protocol.js:150]`. | CS3 |
| `rejectIfLocked` as a per-case call | `server/protocol.js:70-76` | Folded into one gate inside the commit entry `[V, server/protocol.js:70-76; called at :115, :130, :138, :147]`. **The `case 'push'` call site (`:130`) is NOT folded at CS3 - it survives with its host until CS4.** Its guard is annotated *"a reconnect must NEVER overwrite a server-side controller's work"* (`server/protocol.js:129` `[V]`), and the client self-censor (`app/src/sync.js:195-198` `[V]`) reads `this.locked` - a belief that goes **stale across a disconnect**, which is exactly when an agent takes the lock. `commitStatus` is lock-aware. **No test exercises any of the four ws lock gates today** `[V, exhaustive grep: `tests/locks.test.js` never opens a websocket]` - CS3 adds one. | CS3 (`apply`) / CS4 (`push`) |
| `commitWrite` + `commitSelection` | `server/rest.js:46-58`, `:64-72` | -> one `commitTxn` + a small `commitStatus` `[V, server/rest.js:46-58, :64-72]`. | CS3 |
| The two snapshot broadcasts (`hub.broadcast`) | `server/rest.js:56`, `:70` | -> `change` / `selection` messages. A snapshot destroys receiver state not in the doc - `app/src/sync.js:115` `history.clear()`, and `model.load()` emits `'load'` which cascades through `app/src/input.js:93-114` cancelling a live gesture `[V]` (D7). | CS3 |
| `POST .../apply` | `server/rest.js:180-184` | -> `POST .../commit` taking a whole request `[V, server/rest.js:180-184; consumer README.md:149-150]`. Recorded deviation **X1**. | CS3 |
| `case 'push'` | `server/protocol.js:120-134` | Two unrelated features under one command; both replaced - resume+outbox, and `create {name, doc}` -> `install` `[V, server/protocol.js:120-134]` (D9). | CS4 |
| `replace(id, doc)` | `server/store.js:257-274` | Client-authoritative whole-doc clobber; adopts the browser's `rev` verbatim, including backwards, via `loadInto`->`cleanMeta` (`server/store.js:227`, `:25`) `[V]`. Cannot be expressed as a Change without an O(doc) inverse. Becomes an `install()` adapter at CS1. | adapter CS1, deleted CS4 |
| `rev: 0` in the seed | `server/seed.js:37` | With `meta.rev` gone `[V, server/seed.js:37]`. | CS5 |

### 7.2 Document / schema

| Symbol | Where | Justification | Lands |
|---|---|---|---|
| `this.state.meta.rev++` in `emit()` | `model/model.mjs:48` `[V]` | A Model is a value container; versioning is a property of a transaction. Today it counts **preview frames** - `app/src/input.js:769-773` writes into the shared Model once per pointer-move `[V]`, and `diagrams/diagram-000001.json` carries `rev: 11052` for a 65-entity document `[V, measured]`. | CS5 |
| `meta.rev` - the field | `model/model.mjs:31`, `server/store.js:25`, `:199`, `server/validate.js:167`, `:170`, `server/seed.js:37`, `kernel/adapt.mjs:63`, `server/protocol.js:118`, `:133`, `:141`, `:150`, `server/rest.js:57`, `:71`, `cli/draw.sh:242`, `:261`, `cli/tpl/diagrams.jq:1`, `tests/cli.test.js:55`, `docs/spec/SCOPE.md:113`, `:135` `[V, exhaustive grep]` | Nothing in the tree ever **compares** `rev` - it is only echoed. Replaced by `meta.version`, minted server-side inside `commit`. The wire carries `version` from `log.version` at CS3; `meta.version` does not exist in a file before CS5, and there is no dual mint (D27). `rev` stays in the file, frozen, until CS5. | wire CS3, field deleted CS5 |
| `meta.grid` | `model/model.mjs:31`, `:270`, `server/store.js:26`, `server/validate.js:167`, `:169`, `server/seed.js:38`, `kernel/adapt.mjs:63`, **`cli/draw.sh:262`** `[V]` | **`cli/draw.sh:262` reads it** - `jq -r '.meta.grid // "legacy"'`, printed by `draw status`; because the fallback is the literal string `legacy`, deleting the key does not blank the line, it **inverts** it (every healthy doc reports `Grid: legacy`). Caught by `tests/cli.test.js:117` `[V]`, so it fails loudly - but **CS5's rewrite list must name it, and the seven assertions the whitelist change breaks: `tests/validate.test.js:28` (fails on an earlier error - `:167` returns before `:217`), `tests/span.test.js:169`, `:207`, `:317` via `tests/fixtures/control-bar-doc.mjs:35`** `[V]`. Otherwise the value has two readers - `server/store.js:39` (`migrateLegacy`'s detector) and `model/model.mjs:270`, which exists *"so the server can detect it on push"* (`:268-269`, verbatim) `[V]`. Both die at CS1/CS4; after that `grid` is written at four sites, validated at `server/validate.js:169`, and read by nothing `[V, exhaustive grep]`. `meta.schema: 1` restores the discriminator role. | CS5 |

### 7.3 Browser

| Symbol | Where | Justification | Lands |
|---|---|---|---|
| `class History` | `app/src/commands.js:34-72` `[V]` | -> server Log + `Changes` (two booleans and a label). **Blocked until CS2 has landed**: between deleting `History` and persisting the server log there is no durable undo anywhere, which is strictly worse than today. | CS3, gated on CS2 |
| `applyEntry` | `app/src/commands.js:24-32` | -> `applyOps` in `model/ops.mjs` `[V, app/src/commands.js:24-32; sole callers :45, :64, :70]`. **Gated by GR5**: deleted only against a green differential test versus the ten exported builders. | CS3 |
| `clone` | `app/src/commands.js:15-22` | **Moves** to `model/ops.mjs` at CS1; the browser copy goes at CS3. Its rationale comment (`app/src/commands.js:13-14`) migrates to I8 `[V]`. | moved CS1, deleted CS3 |
| The `deleteSelection` cascade closure - **split row [LOCKED]: the inverse-building half only** | `app/src/commands.js:98-155` (~=50 of 58 lines) | Duplicates `planMutation`'s cascade (`server/store.js:70-97`) `[V]`. The server owns it and now owns its inverse (D12). The ordering constraint documented at `app/src/commands.js:131-133` migrates to I4. | CS3 |
| `createGroup`'s member-stealing | `app/src/commands.js:157-175` `[V]` | Moves server-side, **where it has never existed** (`model/model.mjs:206-212`, `server/rest.js:38`, `server/validate.js:150-153` `[V]`). **New server code presented as a deletion**; closes **B1** as a side effect. | rule CS1, deletion CS3 |
| All `before:` computation | 7 sites in `app/src/commands.js` (`:86, :126, :141, :171, :190, :198, :206`) + **14** in `app/src/input.js` (`:271, :287, :357, :426, :445, :521, :879, :910, :969, :993, :1269, :1289, :1302, :1334`) `[V, grep + read]` - `:969`, `:1302`, `:1334` use ES6 shorthand (`const before = ...`) and are **invisible to a `before:` grep** | Server-derived. **Three** fabricate a default to dodge the absent-optional case - `app/src/input.js:521`, `:1333`, `app/src/commands.js:197` `[V, all three read]` - the pattern D10's put-fallback retires. | CS3 |
| `ungroup(model, groupId)` | `app/src/commands.js:219-221` | Dead code: only caller is `tests/commands.test.js:102` `[V, grep]`. `ungroupAll` survives. | CS3 |
| `Sync.onChange` + `this.queue` + coalescing | `app/src/sync.js:34`, `:40-55`, the queue half of `:65-77` | `app/src/sync.js:34` subscribes to the **render** signal, which six other subscribers legitimately want `[V]`. Replaced by `changes.onCommit(...)` (D4). | CS3 |
| `this.history.clear()` | `app/src/sync.js:115` | The reported bug. Nothing to clear once history is server-side `[V, app/src/sync.js:115]`. | CS3 |
| `PULSE_MS` / `this.pulse` interval | `app/src/sync.js:12`, `:36` | Commits are user-action-rate; send immediately. Selection keeps a dirty flag + a trailing 16 ms flush (`Selection.changed()` fires per `del` during a cascade, `app/src/selection.js:17-18`) `[V]`. | CS3 |
| `net.send('meta', {slides:{presentationId,pageId}})` | `app/src/sync.js:264-268` | The only writer of `meta.slides.presentationId`/`pageId` today `[V, app/src/sync.js:264-268, called from app/src/main.js:153]`. **Conditional deletion** - see Trace 1. | CS3, **conditional** |
| The `engine/` import | `app/src/commands.js:11` `[V]` | Goes with the cascade and the member-steal. `groupAfterRemoval` stays sovereign at `engine/policy.mjs:14`; `server/txn.mjs` imports it as `server/store.js:13` already does (D16). | CS3 |
| `push` on reconnect + adopt-local-content | `app/src/sync.js:87-111` (the push at `:107`), `:201` `[V]` | Two features under one command. (b) is a live data-loss bug (**B2**) `[V, app/src/sync.js:94-107]`. | CS4 |

### 7.4 The deletion-consequence contract  [LOCKED]

**CS1 produces `dev/COMMIT-DELETIONS.md` before implementation begins.**\
It carries one row per deleted symbol in section 7.1-7.3 and interrogates each removal as hard as an addition: what else touches the symbol, what capability disappears the moment the row lands, what restores that capability, and - where nothing does - the backlog row and revival trigger that admit the loss.\
A deletion table is the side that ships silently; the contract is what makes it audible.\
**GR2** runs over the file, and it is re-checked at each milestone close for the rows landing in it.

Four columns, no blanks:

| Column | Requirement |
|---|---|
| **(a) Readers / writers** | Every other site that reads or writes the symbol, `[V, grep]`, with `file:line`. An exhaustive grep, not a sample. A symbol with zero other sites states `[V, exhaustive grep: no other reference]`. |
| **(b) Capability lost** | What a user or an agent can do today and cannot do the moment the row lands. "Nothing" is legal only when (a) is empty. |
| **(c) Restored by** | The invariant, guardrail, or milestone that restores it, named - `I4`, `GR7`, `CS3`, not "the planner". |
| **(d) Not restored** | If (b) is non-empty and (c) is empty: an explicit row in `dev/BACKLOG.md` with a revival trigger. Silence is a gate failure. |

The three highest-risk rows are demonstrated below; the remaining rows are the artifact.

#### Trace 1 - `app/src/sync.js:264-268` - the Slides page binding

**(a) Readers / writers `[V, exhaustive grep]`.**\
Writer chain, traced in full: `app/src/main.js:153` `sync.setSlidesBinding(...)` -> `app/src/sync.js:264-268` (`Object.assign(meta.slides, ...)` + `net.send('meta', ...)`) -> `server/protocol.js:139` `store.patchMeta` -> `server/store.js:282` `Object.assign(model.state.meta.slides, patch.slides)`.\
This is the **only** writer of `meta.slides.presentationId`/`pageId`.\
Reader: `server/slides/sync.js:69-70` - `const saved = doc.meta?.slides || {}; const remembered = saved.presentationId === binding.presentationId ? saved.pageId : null;` - consumed at `:79` under the rationale at `:66-68` `[V]`.

**(b) Capability lost.**\
Deleting the row on its own: every re-push to a Slides URL **without** a `#slide=` fragment permanently reverts to `pages[0]`.\
A user who pushed to slide 7, then re-pushes from the pasted deck URL, silently overwrites slide 1.\
And **no test would catch it** - `tests/` mentions `presentationId` ten times, none asserting a store write; `tests/slides.test.js:237-261` exercises the fallback, which under the deletion becomes the only path `[V, exhaustive grep of tests/]`.

**(c) Restored by.**\
The deletion is **conditional [LOCKED]**: `app/src/sync.js:264-268` may be deleted **only in the same commit** that lands `store.bindSlides(diagramId, {presentationId, pageId})` in `handleSlidesPush` before `server/rest.js:225` responds - status per D15 - **and** a test asserting the binding survives the round trip and a second push targets the remembered page.\
The server-side producer itself lands earlier, at **CS1** (D19).\
If that commit does not land at CS3, the row is not deleted.

#### Trace 2 - `server/store.js:38-58` - `migrateLegacy`

**(a) Readers / writers `[V, exhaustive grep]`.**\
Two call sites: `server/store.js:123` (every candidate file, every boot) and `:270` (inside `replace`, guarding *"a stale pre-upgrade tab may reconnect-push top-left coords"*).\
Its detector reads `doc.meta.grid` (`:39`); its writer sets it (`:55`).\
The only other reader of that value is `model/model.mjs:270`, whose comment states the coupling: *"the grid marker mirrors the DOCUMENT: a legacy doc must not inherit 'center' from the defaults, or the server cannot detect it on push"* `[V]`.

**(b) Capability lost - three distinct things, not one.**
1. **Capability**: a top-left-coordinate document loaded from disk or pushed by a stale tab is no longer
   translated. All 17 live files are already `center` `[V, measured]`, so no current file is affected - but
   the transform for any file the user restores from an old backup disappears.
2. **Detector**: `meta.grid` stops discriminating document generations. Nothing else in the tree performs
   that role `[V]`.
3. **Record**: `server/store.js:40-41` verbatim - *"930/510 here are the legacy top-left->center OFFSET
   (= hw-HALF), NOT the usable extent - numerically equal to `ZONE_EXT` today but semantically distinct, so
   they stay literal (do not alias)"*. `ZONE_EXT = {x: 930, y: 510}` lives at `model/surface.mjs:8`
   `[V]`. The warning exists **nowhere else in the tree** `[V, exhaustive grep for 930/510]` - and it warns
   about a mistake a future author is invited to make by the numeric coincidence.

Ordering consequence: `migrateLegacy` dies at **CS1** while `replace` survives to **CS4**, so the `:270` stale-tab guard is gone for three milestones before its host is.

**(c) Restored by - all three in the CS1 commit that deletes it.**\
`SCOPE.md` decision #1 gains a dated amendment retiring center-origin migration and preserving the (-930, -510) transform and the clamp rule verbatim; the 930/510 aliasing warning moves into `model/surface.mjs` beside the constants it warns about; **GR8** guarantees a synthetic legacy doc produces a **named, actionable** boot failure and never a reseed.\
`meta.schema: 1` takes over the generation-discriminator role at CS5, where the whole set is re-asserted by grep.

#### Trace 3 - `case 'push'` + `store.replace` + `store.loadInto` + `app/src/sync.js:87-111`, `:201`

**(a) Readers / writers `[V]`.**\
`server/protocol.js:120-134` -> `store.replace` (`server/store.js:257-274`) -> `store.loadInto` (`:225-229` - folded into `install()` at **CS1**, ahead of its host) -> `Model.load` + `cleanMeta`.\
Client side: `app/src/sync.js:201` (reconnect resync) and `:107` (adopt-local-content).\
Tests: `tests/server.test.js:168`, `:314`, `:545`, `:585`.

**(b) Capability lost.**\
Today a reconnect repairs **any** divergence in the client's favour, whatever caused it.\
After deletion the only repair is the outbox - and the outbox is genuinely new code, not a rename of `sync.js`'s queue: `app/src/net.js:64-67` `send()` returns `false` and **drops** anything sent while the socket is closed `[V]`, and a server rejection is a bare string that `app/src/sync.js:139` only `console.warn`s `[V]`.\
Second loss: `push {doc}` is also the only verb that repairs `clientVersion > serverVersion` - a server restarted from an older file.\
The outbox cannot cover that case, because it holds only **unacked** requests.

**(c) Restored by.**\
CS4's gate: offline-then-reconnect replay; `create {name, doc}` -> `install()` with a server-minted id (the previously-open diagram untouched); the four rewritten push tests.\
Plus three mechanisms at CS3/CS4: typed `error {code, txnId}` reaching the readout (**I16**, D28); `durableVersion` on every ack and change so the client prunes on durability, not on ack; and the `resume` **rewind reply** `{rewound:{from,to}}` (D29).\
Without the rewind reply the deletion converts a repaired divergence into a **silent** revert.

---

## 3. Recorded deviations [LOCKED]

Departures from a stated rule, knowingly accepted.\
Each is recorded here **and** in `docs/spec/SCOPE.md` in that file's existing dated-amendment form - not left to pass silently.

| # | Deviation | Rule departed from | Trigger / condition |
|---|---|---|---|
| **X1** | **`/api/v1` is redefined in place. The record lands at CS3 for the route rename and at CS5 for `rev`->`version` - two surfaces, two milestones, not one.** `POST .../apply` -> `.../commit`; `meta.rev` -> `meta.version`. Out-of-repo consumers detect only a 404: `cli/draw.sh:78, :176, :213, :236, :255, :273`; `README.md:134-137, :147-155`; `docs/spec/SCOPE.md:154-156` `[V]`. | A versioned API surface is additive within its version. | **Accepted** for a single-tenant tool with a bundled CLI. **Condition:** recorded in `SCOPE.md`'s REST section in the same commit that changes the surface (CS5). **Revival trigger: any out-of-repo or third-party consumer of `/api/v1`** - the next change then goes to `/api/v2`. |
| **X2** | **No `fsync`.** Durability is asserted at process granularity only. | "Undo survives a restart" reads as machine-crash durability; the code makes no such claim `[V, exhaustive grep: 0 fsync/fdatasync]`. | **Accepted.** **Condition:** the guarantee is carried into `SCOPE.md` and the README in exactly N5's wording; CS2's gate says "process restart", never "restart". Backlog **B6** carries the revival trigger. |
| **X3** | **Cloud Run revision overlap.** Two processes over one mount during a deploy, each running `flushAll()` on SIGTERM (`server/server.js:32-37` -> `server/store.js:327-333` `[V]`), last writer taking the whole file - **including the other's log and its inverses**. | Single-writer ownership assumes one process. | **Accepted.** Rests on `[A]` external Cloud Run drain behaviour; the deployment is scoped single-instance, so it is not load-bearing today. **Revival trigger: min-instances > 1, any revision-overlap deploy setting, or any shared-mount deployment.** The remedy if triggered is a data-dir advisory owner file written at boot, not coordination. |
| **X4** | **The CS5 schema migration rewrites 17 untracked user files.** | Nothing before CS5 is code-revertible past this point. | **CLOSED 2026-08-18** - the gate ran green (286/286), all 17 files were verified identical to the backup entity-by-entity, and `diagrams.bak` was released on the owner's instruction. The arc is now irreversible in fact, not only in principle. Original terms, all met: **Approved as a named gate**, on these terms and no others: the committed `tools/migrate-version.mjs` with the five-step procedure at section 6 CS5 - health-port interlock, the store's own filename regex, dry-run-and-verify into a temp copy with per-id deep-equality, swap only then, and **never delete `diagrams.bak` - retained until CS6 closes** - plus `tests/migration.test.js` over old-shape fixtures. |
| **X5** | **Three locked `SCOPE.md` decisions are reversed.** Undo moves server-side (`SCOPE.md:210-211` (now `dev/DECISIONS.md`)); the server pushes model changes to browsers (`:223-224`); the CLI gains write verbs (`:217`, `:225` - admitted 2026-06-13 only on the condition that it *"adds no mutation path"*) `[V]`. | `SCOPE.md` decisions are locked. | **Approved:** amended deliberately, each in the milestone that breaks it, with a dated amendment in the same commit - never a milestone later. **CS3** -> `:149-150`, `:210-211`, `:223-224`. **CS6** -> `:217`, `:225`, or the write-CLI question is answered *no* and the exclusion stands. Pinned by **GR10**. Note two of the three lines are **not** in the wire section `[V]` - the amendment targets the lines, not the section. |
| **X6** | **`SCOPE.md` was amended three milestones late.** X5 and GR10 both require the amendment in the *same commit* as the reversal. CS1 and CS3 each shipped without one; the file had not been touched since genesis `[V, git log --oneline -- docs/spec/SCOPE.md = 1 commit]`. All of CS1-CS4's reversals are amended together at CS4. | GR10: never opposite the running wire for longer than one milestone. | **Recorded, not approved** - the rule was broken and the debt paid late. The remedy is procedural, not code: the SCOPE amendment is now written *first* in the milestone, before the deletion it describes. Nothing mechanized this, which is why nothing caught it. |
| **X7** | **`store.apply` outlived its milestone.** section 7.1 assigns the adapter's death to CS3 with its caller, but three test files still called it, so CS3 deleted `case 'apply'` and left the adapter standing with no production reader `[V, exhaustive grep after CS3: 8 call sites, all in tests/]`. Deleted at CS4, its call sites driven onto `store.commit`. | A deletion table row names the milestone the symbol dies in. | **Recorded.** The lesson generalises: an adapter kept "so the existing tests are the fidelity control" acquires the tests as its own constituency, and the tests then keep it alive past its date. A CS-scoped adapter needs its test migration scheduled in the same milestone as its deletion. |
| **X8** | **`planPut` now narrows an identical `put` to zero ops.** Not in section 3; added at CS4. `planSet` and `planDel` already narrowed (I6), `planPut` did not - so replaying an accepted `put` minted a second record and a second version bump for a document that had not moved. | The plan is specified per-op in section 2; a narrowing rule is a decision. | **Accepted, and load-bearing:** D30's outbox replay is only safe-and-free if a request the server already accepted costs a no-op. Narrowing is suppressed whenever the put also steals group members, so the "node in at most one group" repair is never skipped. Pinned by *"the replayed change planned zero ops"* in `tests/server.test.js`. |
| **X9** | **GR10 is mechanized from CS5 on.** X6 recorded that nothing checked SCOPE.md against the wire. `tests/spec.test.js` now DERIVES the command vocabulary from `server/protocol.js`'s own dispatch and compares it against the document in both directions: an undocumented `case` fails, and a documented command the server refuses fails. | - (this is X6's remedy, not a departure) | **Closed.** It found two live defects on its first run (**B11**, **B12**) - `meta` had been an unanswered command since CS3a, so renaming a diagram in the browser did nothing, and the Slides binding had no writer at all. A token grep would have found neither. |
| **X10** | **The wire section of `SCOPE.md` is REWRITTEN in place, not superseded by an amendment.** Every other reversal in this file keeps the original line and adds a dated amendment below it. | The file's established amendment form (section 6.2). | **Accepted, for reference material only.** A design decision reads as history; a wire reference reads as instructions, and a reader copies the first form they see. The dated amendment stays as the record of what changed and why - it is the line that got sent that is gone, not the account of it. Applies to the wire bullets and the entity block; the decision list keeps the superseding form. |
| **X11** | **The ring's cap is no longer 100 records / 32 KiB. It is that, OR up to 4x that when the oldest record is human-authored.** D23 locks the bound; I14's eviction floor raises it conditionally. | **D23** `[LOCKED]` - LOG_MAX / LOG_BYTES as the bound. | **Accepted, and unavoidable given the floor.** Eviction is oldest-first and must be: undo replays inverses in order, so a hole in the middle of the ring corrupts every inverse above it. There is therefore no evicting *around* the floor - the ring either drops the user's last undoable change or grows past the soft cap. It grows. `LOG_HARD_MAX`/`LOG_HARD_BYTES` (4x) bound the growth, and crossing them sets `evictedHuman`, which the browser surfaces as *"your oldest changes are no longer undoable"*. Worst case is ~128 KiB of log on one diagram whose owner has stopped typing while an agent writes 400 changes. **Revival trigger: any diagram observed at the hard ceiling in normal use** - the answer then is a smaller soft cap, not a smaller floor. |
| **X12** | **`draw undo` / `draw redo` are NOT shipped**, though section 6 CS6 lists them. `draw history` is. | section 6's CS6 row (*"CLI `draw undo` / `draw redo`"*). | **The write-CLI question is answered `no`; the exclusion stands** - the branch GR10's gate item 4 explicitly permits. The CLI was admitted in 2026-06-13 only on the condition that it *"adds no mutation path"*, and undo is the destructive verb the whole `expect`/reclaim apparatus exists to stop anyone issuing blind. A bash wrapper is one shell-history recall from reversing work nobody meant to touch, and cannot hold a lock across the two calls it needs. Agents keep `POST .../undo`, where the gates live. **Revival trigger: an operator case the REST call cannot serve.** |
| **X13** | **Two guardrails were green for the whole arc without being able to fail.** **GR12** had no test at all `[V, exhaustive grep: no test file referenced `Hub` before CS6]` - the try/catch was in the code and the claim was in the spec, and nothing connected them, so a refactor hoisting the `try` outside the loop would have shipped green. **GR5**'s differential corpus never generated a put of an entity already present, so the ONE planner behaviour CS6 changed (**X8**'s narrowing) sat outside the differential that exists to prove the planner unchanged. | GR1: promotion is gated by a deterministic proof. A check that cannot fail is not a proof. | **Recorded, and fixed at CS6.** `tests/hub.test.js` - verified to FAIL against a hoisted-try refactor, not merely to pass against the current code. `tests/diff-plan.test.js` - the corpus now reaches the narrowing ~20+ times per run and the divergence is asserted as a NAMED exception rather than accommodated by editing the frozen oracle, which would have defeated its purpose. **The general lesson: a guardrail must be shown to bite before it is counted.** Every scan added in CS5/CS6 was proven by injection for this reason; the two that predated the practice were the two that were hollow. **REOPENED 2026-08-19 - the lesson did not hold; it recurred twice more, and neither instance was caught by the CS6 sweep that declared it fixed.** (iii) **GR1 has no self-check.** Its own row states *"`tests/gate.test.js` asserts that hook exists and is executable"* - the file does not exist `[V, ls tests/]`, `.git/hooks/pre-push` is a local untracked artifact so a fresh clone is entirely ungated, and there is no CI `[V, no .github/]`. The guardrail that gates all thirteen others runs only when a human types `npm run gate` (**B21**). (iv) **GR6 fault (ii) exercises a queue that does not exist.** The fault is specified as *"deliver a change while B has `input.mode !== null`"*, but `Sync.deferInbound` is read at `app/src/sync.js:245` and **assigned nowhere** `[V, exhaustive grep: 1 occurrence, the read]`, so `this.deferred` is never populated and `releaseDeferred()` is never called - a documented chaos path that is a **fake pass** (**B19**). Both are the same failure mode as (i) and (ii): a claim in the spec with nothing connecting it to an executable check. The sweep that fixed the first two looked for hollow *scanners* and did not look for hollow *fault injections* or for the gate's own self-check. **Closes when B19 and B21 close (H2/H3), and the sweep is repeated against every GR row rather than the two already known to be hollow.** Under `mission-kit/axioms` **A14** success signal 3, recurrence of a captured lesson's failure mode is itself a fault, filed and mined - which is why this reopens rather than being filed as a new row. |
| **X14** | **The gate is enforced by a LOCAL git hook only. There is no CI, and a fresh clone is ungated silently.** GR1's mechanism is `npm run gate:install` writing a pre-push hook, plus `tests/gate.test.js` asserting that hook exists and is executable. The assertion is a **warning**, not a failure, when the hook is absent - otherwise `npm test` would fail on a fresh clone and break `SCOPE.md`'s definition of done (*fresh clone -> npm install -> tests pass*). | GR1: promotion to trunk is gated by a deterministic proof, not a habit. A warning is a habit. | **Accepted, and time-boxed.** drawv2 has **no git remote** `[V, git remote -v is empty; the repo has never been pushed]`, so there is exactly one clone, one machine, one developer - CI is not merely unbuilt, it has nowhere to run. Building it for a hypothetical second clone solves a problem that does not exist. What WAS real is the failure H2.2 already closed: a hook that existed, looked installed, and was silently never executed because a global `core.hooksPath` redirected git's lookup (**B21**). **Residual risk, accepted explicitly: a future clone that skips `npm run gate:install` is unprotected and only a console warning says so.** **CLOSING CONDITION - the owner has stated drawv2 WILL be pushed to a remote after further board items. On that push this deviation expires**: add CI running `npm run gate`, and flip `tests/gate.test.js`'s hook check from warn to assert (one line). Until then the ruling is that the local hook plus the gate self-check IS the whole gate. **EXPIRED AND DISCHARGED H7** - `apnex/drawv2` created and pushed, so the closing condition fired. `.github/workflows/gate.yml` runs `npm run gate` on every push and PR - the same command, not a re-listing of its steps, because a workflow that enumerates the scanners itself drifts from `package.json` silently. The hook check in `tests/gate.test.js` is now an assert. **It was not the one-line flip this row predicted**: asserting alone breaks SCOPE's definition of done, because a fresh clone has no hook until someone installs one. A `prepare` script makes installation part of `npm install`, which is what makes the assertion both true and honest. Verified on a real clone with the machine's global `core.hooksPath` still set - the assert fails before install, `install-hook.sh` pins a repo-local hooksPath past the redirect (B21's exact hazard), and `npm test` is green after. The residual risk this row accepted - *a future clone that skips `gate:install` is unprotected and only a console warning says so* - no longer exists.
| **X15** | **GR5's second half - `tests/diff-inverse.test.js` - is RETIRED, not built.** GR5 requires that a deleted reference implementation is replaced only against a green differential, and names two: the planner (`tests/diff-plan.test.js`, shipped) and the browser inverse builders (never written). | GR5: *"any commit that removes the old code without its differential test green in that same commit. The opportunity is destroyed permanently once the old code is gone."* | **Retired, because the check is INAPPLICABLE rather than merely unbuilt.** A differential compares two implementations of one function. The browser inverse builders were not *replaced* - they were **removed outright**: CS3 moved inverse derivation to the server's planner, and the browser now sends forward intent only (`app/src/changes.js:21` - *"the server derives the inverse from the pre-state now, so only the forward intent travels"*; `toOp` drops `before`; exhaustive grep finds **no** client code deriving an inverse). Client-side inverse building has zero implementations today, so there is no second term to differentiate against. The oracle was also never frozen: `tests/fixtures/` holds `plan-reference.mjs` only `[V, ls tests/fixtures/]`, so GR5's own escape hatch was not taken and the opportunity is, exactly as GR5 warned, gone. **What covers the risk instead is stronger than the differential would have been:** I3 and I4 test inverse correctness as a *property* - `applyOps(m, ops); applyOps(m, inverse)` deep-equals the pre-state, table-driven over `model/shape.mjs` so a new optional field fails by construction - plus the introduces-a-key case, the deep-copy/aliasing case, and the five cascade shapes (19 tests in `tests/txn.test.js`). A round-trip property proves the inverse is *correct*; a differential would only have proven it *matches the old code*, which could itself have been wrong. **Revival trigger: any future commit that REPLACES the server planner's inverse derivation with a second implementation** - at that point a differential becomes applicable again, and GR5's first half shows the shape it should take.
| **X16** | **The doc-style gate depends on a repository this one does not control, fetched at HEAD.** `tools/scan-docstyle.mjs` runs the five mission-kit enforcers rather than vendoring them, because a rule with one owner must not have two definitions that drift (S3, and the twin problem P3 exists to prevent). CI clones `apnex/mission-kit` at HEAD, so a change there can turn this repo red with no commit here. **Ruled by the director on 2026-08-27, choosing currency over insulation**, the alternative being a pinned SHA that trades a surprise red for rules that silently go stale. The deviation is bounded by three things: the scanner names its resolved tools directory on every run, so diagnosis is immediate; it EXITS NON-ZERO when the tools are absent rather than skipping, so an unreachable upstream is never a quiet pass; and `tests/gate.test.js` pins both properties against mutation. |
| **X17** | **Part of the proof runs only in CI, so `npm run gate` is no longer the whole gate.** `gate.yml` states the principle it is now breaking: the workflow ran `npm run gate` and nothing else, deliberately, so that the hook, CI and a developer's terminal could not disagree about what passing means. The `image` job builds the container, boots it, probes the liveness contract, runs the CLI the image installs, and asserts the boot guard refuses persistence without an identity source. **None of that can go in a pre-push hook** -- an image build on every push is a gate people learn to skip, and a skipped gate is worse than an absent one. So a developer running `npm run gate` locally holds the source proof and not the packaging proof, and only CI holds both. Accepted because the alternative is what B53 recorded: the artefact the README leads with being the one artefact nothing exercises, which already shipped B52 and B137. Bounded by `tests/gate.test.js`, which asserts the job exists and names the build, so the asymmetry cannot widen by deletion. |

---

## 4. Backlog seed - `dev/BACKLOG.md` at CS1 [LOCKED]

The file is created **before implementation**, not after.\
Four live defects were discovered at design time and filed nowhere; a repo with one commit and no defect register has no other place for them.\
Every row carries an evidence citation and either a closing milestone or a revival trigger - explicit deferral is permitted, silence is not.\
**GR1** asserts the file exists; at arc close every row is either closed by its named milestone or carries a live trigger.

| # | Row | Evidence | Closes / Trigger |
|---|---|---|---|
| **B1** | **`POST /groups` admits a node to two groups.** `server/rest.js:38` calls `model.makeGroup(d.members)` directly; `model/model.mjs:206-212` performs no steal; `server/validate.js:150-153` checks member *existence* only. The "at most one group" rule exists **only** in the browser (`app/src/commands.js:157-175`). | `[V, all four sites read]` | **Closed CS1** - the steal rule moves into `plan()` with its own inverse and a multi-group-overlap test. |
| **B2** | **Adopt-local-content destroys a real diagram.** On a snapshot arriving after the user has drawn, the client adopts *whatever diagram the server answered with* and pushes its own content over the top. | `[V, app/src/sync.js:87-107; the push at :107]` | **Closed CS4** - `create {name, doc}` -> `install()` with a server-minted id. Gate: "offline drawing lands in a NEW diagram and does not touch the previously-open one". |
| **B3** | **Server rejections are silently dropped; the browser diverges permanently.** A rejection is a bare string that only `console.warn`s; anything sent while the socket is closed is dropped with a `false` return and no queue. | `[V, app/src/sync.js:139; app/src/net.js:64-67]` | **Closed CS3/CS4** - typed `error {code, txnId}` lands **with** the outbox (D28); **I16**. |
| **B4** | **A failed flush reschedules nothing.** `flush`'s catch logs and returns, leaving `entry.dirty = true` while `markDirty` already nulled the timer - recovery waits for the next edit or SIGTERM. On a backend where `renameSync` fails transiently, a session's final transaction **and its inverse** can sit in memory indefinitely. | `[V, server/store.js:322-324 vs :306]` | **Closed CS2** - reschedule inside the catch, **plus** a per-diagram `flushFailures` counter in `GET /health` (`server/rest.js:79-81` `[V]`) and `draw status`. |
| **B5** | **`Store.init` fabricates success.** A file failing `validateDoc` is skipped with a `console.warn` (`server/store.js:125-128`); if the store empties, it reseeds (`:142`); `/health` then answers 200 with a plausible, complete, wrong store, and `Dockerfile:43-44` asserts HTTP 200 only. `diagrams/*.json` is gitignored - the 17 files are untracked. | `[V, server/store.js:120-142; .gitignore:4; 17 files counted]` | **Closed CS1** - D17 / **GR8** / **I15**. Permanently retires the data-disappearance class for every future schema change. |
| **B6** | **No `fsync` anywhere.** `writeFileSync` + `renameSync` without `fsync` can lose the last write on a machine kill. Unchanged by this arc, but "undo survives a restart" will be read as a stronger claim than the code makes. | `[V, exhaustive grep: 0 hits; server/store.js:319-320]` | **Open. REVIVAL TRIGGER: any multi-instance or GCS-backed deployment.** Confirm the `[A]` gcsfuse claims against a real bucket **before** relying on them. Until then N5's wording is the guarantee (**X2**). |
| **B7** | **Preview writes to the shared Model.** `app/src/input.js:769-773` writes into the live model once per pointer-move frame; a remote change landing mid-gesture fights the live preview. Mitigated by D12's defer rule, not fixed. | `[V, app/src/input.js:768-773]` | **Open. REVIVAL TRIGGER: the renderer-overlay arc.** The fix duplicates a geometry pipeline across four files (N7). |
| **B8** | **Eviction is invisible at every surface.** The ring evicts at 100 records / 32 KiB; a bounded, designed loss no actor can perceive is not a bounded loss. | `[V, D23 caps; I14 reporting requirement]` | **Closed CS2/CS3, floor at CS6** - persisted `evicted`; `truncated: evicted > 0` on `history`, `snapshot`, `change`; surfaced in the browser undo affordance (**I14**). |
| **B9** | **The accountability record and the undo ring are the same object.** An undo ring must be bounded, destructive and redo-truncating; an accountability record must not be. D2's authority answer rests on attribution the ring can evict. | `[V, server/store.js:319 - the entire document is rewritten every debounce tick, so a 10k-row trail is ~600 KB per 200 ms]` | **Ruled CS2/CS3** - the ring stays bounded (D23, `[LOCKED]`); attribution is scoped to the ring via `actor`; the absence beyond it is declared as **N12**, and D2's justification no longer leans on attribution that outlives the ring. **The row stays open as N12's revival trigger: any requirement for a durable audit trail - compliance, a multi-tenant deployment, or an incident review needing history older than the ring.** |