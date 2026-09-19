# draw -- the transaction contract

Every write against a diagram, and what one is.\
A browser gesture, a keyboard nudge, a palette stamp, a label edit, a rename, a REST verb, a CLI verb, an undo, a redo and a whole-document entry all arrive here: **one write function, one log and one version per diagram, one on-disk file format.**

> **Status: BUILT.** Shipped through CS5; `tests/migration.test.js` carries the CS5 gates -- a
> migrated corpus boots with every entity deep-equal, and an unmigrated file is a named boot
> failure rather than a silent reseed.\
> Every ruling is **[LOCKED]**: settled, and changed only by a dated amendment in this file.
>
> **Evidence markers.** `[V]` verified by reading the cited `file:line` -- `[I]` inferred --
> `[A]` assumption.
>
> Split from `TRANSACTIONS.md` on 2026-09-19. That document was 1218 lines and three things at once: this
> contract, the plan that delivered it, and the gate artifacts that plan produced. The delivery half
> is `dev/COMMIT-DELIVERY.md` -- the CS1-CS6 sequence, the deletion tables, the recorded deviations
> and the backlog seed. A reader wanting to know what a write IS should not have to read the
> schedule by which it was built.

---

## Contents

| section | Section | What is settled there |
|---|---|---|
| 1 | Purpose and scope | what this governs, and what it does not |
| 2 | Target architecture | the one write function, the op vocabulary, Request/Change/Log, the commit contract, the callers |
| 3 | Decisions | D1-D30, each with its consequence |
| 3b | Durability | what is actually guaranteed, and what is not |
| 4 | Correctness invariants | I1-I16, each with the milestone and the test that pins it |
| 5 | Mechanized guardrails | GR1-GR18 (GR14 has no row here -- B154), and the rule governing when each attaches |
| 6 | Non-goals | N1-N12 |

**Sibling records.**\
`dev/COMMIT-DELIVERY.md` holds the delivery plan and the deletion ledger.\
`docs/history/COMMIT-AUDIT.md` preserves the axiom-alignment audit run against the design before any of it was implemented.

---

## 1. Purpose and scope

This document governs **every write against a diagram**: browser gesture, keyboard nudge, palette stamp, label edit, rename, REST entity verb, CLI verb, undo, redo, and whole-document entry.\
One write function, one log and one version per diagram, one on-disk file format.

| In scope | Out of scope |
|---|---|
| the op vocabulary and the transaction shape | rendering, geometry, the grid grammar (`HIERARCHY.md`, `ATOMICS.md`) |
| validation, cascade, inverse, narrowing | the Slides *projection* - except the one write it implies (D19) |
| the Log, `version`, undo/redo authority | reads (`GET /api/v1/...`) except `history` |
| the wire shapes carrying a change | auth, identity, multi-instance (section 8) |

---

## 2. Target architecture

### 2.1 The one write function

There is exactly **one** write.\
It takes a **request** (an ordered array of intent ops), runs a **pure planner** that validates each op against a scratch projection, expands the server cascade, narrows patches to real changes, and emits the **inverse for free**; then it applies the planned ops, appends one **Change** to the diagram's **Log**, and mints one **version**.\
Every other writer is a caller that builds a request.

### 2.2 Op - the wire vocabulary - `model/ops.mjs`

New, sovereign, already reachable in the browser: `model/` is mounted at `/model` (`server/app.js:150`, dir resolved at `:112`) `[V]`.

| op | shape | note |
|---|---|---|
| `put` | `{op:'put', kind, entity}` | whole entity value; clones on apply (I8) |
| `set` | `{op:'set', kind, id, patch}` | **only** the keys that actually change |
| `del` | `{op:'del', kind, id}` | by id; the entity lives in the inverse |
| `meta` | `{op:'meta', patch}` | `{name?, slides:{url?}}` - config meta only (D15) |

`del` drops the `{entity:{id}}` wrapper the current wire mutation carries (`server/validate.js:118-122` `[V]`).\
Request shape and op shape become the same shape.

`model/ops.mjs` exports `applyOps(model, ops)` and `clone(entity)`, and is loaded by both peers.

### 2.3 Request - Change - Log

```js
Request  { ops: Op[], label?: string, expect?: number }
Change   { seq, from, at, by:'client'|'server', actor, label, ops: Op[], inverse: Op[] }
```

`inverse` is stored **pre-reversed**, so undo is `applyOps(model, change.inverse)` - the same function as redo, with no `[...entries].reverse()` (`app/src/commands.js:64` `[V]`).\
Forward and backward are one code path and cannot disagree.\
`actor` is minted server-side (D20).

```js
// server/log.mjs - split out of txn.mjs so I14 is testable without constructing a transaction
class Log { version, records:[Change], cursor, evicted, bytes,
            append(c), canUndo(), canRedo(), toJSON(), static from(json, fallback = 0) }
```

Per diagram, persisted in the diagram file, owned by the Store - **not** by the Model (D1).\
`toJSON()` emits `{version, cursor, evicted, records}`; `from()` reads its own persisted `version`.

### 2.4 The primitive - `server/txn.mjs`

```js
export function plan(model, ops)
//  PURE. Reads a projection, writes nothing.
//  -> { ok:true, ops: Op[], inverse: Op[] } | { ok:false, error, at }

export function commit(model, log, request, by, actor)
//  THE ONE WRITE. No I/O, no timers, no broadcast, no flush.
//  -> { ok:true,  change: Change|null, version }
//  -> { ok:false, error, at?, version }

export function undo(model, log, to?)   // -> { ok, ops, version }  cursor moves, NO record appended
export function redo(model, log)        // -> { ok, ops, version }
```

`commit`, in execution order - **this is the contract**:

1. **Shape gate.** `Array.isArray(request.ops) && 1 <= ops.length <= 2000` - the **request** cap. Distinct from the **per-kind 2000-entity collection cap** carried over from `server/store.js:77` (`${kind} collection limit reached`, asserted by `tests/server.test.js:632-633` `[V]`), which `plan()` enforces per op; `label` matches
   `/^[a-z0-9 -]{0,32}$/`. Else reject. `label` is wire input stored in a persisted ring and rendered in
   an undo UI, so it is length- and charset-capped like every other wire string
   (`server/validate.js:17` `[V]`). It is **not** enumerated: the live label set already includes
   `create <kind>`, `resize`, `close path`/`open path`, `star`/`chain`
   (`app/src/commands.js:77`, `app/src/input.js:973`, `:520`, `:547` `[V]`).
2. **Precondition.** `request.expect != null && request.expect !== log.version` ->
   `{ok:false, error:'version conflict'}`. Nothing written. REST -> 409. Mandatory on `undo`/`redo` (D14).
3. **Plan.** `plan(projection(model), ops)`. On failure -> `{ok:false, error, at}`. **Nothing has been
   written** - atomicity by purity, no rollback; exactly the guarantee `server/store.js:231-236` claims
   today `[V]`, extended from 1 op to N. A `del` inverse looks its entity up against the projection: the
   wire payload for a `del` carries only `{id}` (`server/store.js:96` `[V]`).
4. **No-op gate.** `plannedOps.length === 0` -> `{ok:true, change:null}` - *success*, version unchanged,
   nothing appended, nothing dirtied.
5. **Apply.** `applyOps(model, plannedOps)` - the sole mutation point in the system (I2).
6. **Mint + append.** `const seq = ++log.version; log.append(change)` - same synchronous turn, no `await`,
   no timer between 5 and 6 (I9). **From CS5, `commit` also assigns `meta.version = seq`.** Before CS5 the
   counter lives only in `log.version`, because `validateDoc` whitelists `doc.meta` keys to
   `id|name|rev|slides|grid` (`server/validate.js:166-168` `[V]`) and every flushed file must pass it.

### 2.5 The store surface - `server/store.js`

```js
commit(id, request, by, actor)              // the ONE write
undo(id, to?) / redo(id)                    // cursor moves, version bumps, no record appended
install(id|null, doc, log = new Log(0))     // whole-doc entry: boot + create-with-content ONLY. Not a commit.
setSelection(id, ids)                       // STATUS: persisted, not logged, no version bump
bindSlides(id, {presentationId, pageId})    // STATUS: same
```

`markDirty` moves out of `model.onChange` and into the commit return.\
The store stops subscribing to the Model (`server/store.js:160`, `:179` deleted `[V]`).\
Only an accepted Change, a selection write or a Slides-binding write dirties a diagram.

The browser's entire history state becomes **two booleans and a label** - `canUndo`, `canRedo`, `undoLabel` - delivered on every `ack` and every `change`.

### 2.6 Who calls it

| Writer | Entry | Path |
|---|---|---|
| browser gesture, nudge, stamp, label edit, rename | `Changes.commit(request)` (`app/src/changes.js`, new) | ws `commit` -> `Session` -> `Store.commit` |
| browser Ctrl+Z / Ctrl+Y | `Changes.undo/redo` | ws `undo`/`redo` -> `Store.undo/redo` |
| agent / CLI, entity verbs | `POST\|PATCH\|DELETE /api/v1/diagrams/:id/{nodes\|links\|zones\|groups}` | `commitTxn` -> lock verify -> `Store.commit` -> `store.flush` before ack |
| agent / CLI, whole request | `POST /api/v1/diagrams/:id/commit` | same |
| agent / CLI, reversal | `POST .../undo\|redo {expect}` | same; `expect` mandatory (D14) |
| boot, create-with-content | `Store.install(id\|null, doc, log)` | **not a commit** - truncates history, id server-minted |
| selection | ws `select`, `POST .../selection` | `Store.setSelection` - status: persisted, not logged, no version bump |
| Slides binding | `handleSlidesPush` -> `store.patchMeta` (CS1) -> `store.bindSlides` (CS3) - D19 | status: same |

### 2.7 Convergence - every writer reaches one function

```
  BROWSER                                    AGENT / CLI
  ───────                                    ───────────
  gesture end     ─┐                         POST /<coll>        ─┐
  nudge (600ms)   ─┤                         PATCH /<coll>/:id   ─┤
  palette stamp   ─┤                         DELETE /<coll>/:id  ─┤
  label edit      ─┤                         POST .../commit     ─┤
  rename          ─┤                         POST .../undo|redo  ─┤   (expect MANDATORY, D14)
  Ctrl+Z / Ctrl+Y ─┤                                              │
                   │                                              │
       Changes.commit(request)                            commitTxn(...)
                   │                                              │
        ws 'commit' / 'undo' / 'redo'                   lock verify + flush
                   │                                              │
                   └──────────────────┬───────────────────────────┘
                                      v
                    Store.commit(id, request, by, actor)
                                      │
                          server/txn.mjs - commit()
                          ┌───────────┴────────────┐
                          │ 1 shape gate           │
                          │ 2 expect precondition  │
                          │ 3 plan(projection)  <── PURE: validate per op, cascade,
                          │      v                  group-steal, narrow, invert.
                          │   {ops, inverse}        Writes nothing.
                          │ 4 no-op gate -> ok,null │
                          │ 5 applyOps(model,ops) <─ THE ONLY WRITE IN THE SYSTEM
                          │ 6 ++log.version;       │
                          │   log.append(change)   │
                          └───────────┬────────────┘
                        ┌─────────────┴──────────────┐
                        v                            v
              markDirty -> flush(id)          hub.broadcast(id,'change',changeBody(c))
                        │                    per-session try/catch (GR12)
             server/docfile.mjs (D18)        + ack = {...changeBody(c), acked: txnId}
        serialize(doc, log) -> ONE file        ops included - inverse NEVER on the wire
          tmp + renameSync (atomic)              (origin excluded from fanout)
```

Every arrow into `Store.commit` is a *caller*.\
**There is no second write path.**\
`install()` is the one whole-document entry and is not a commit - it is fenced by the same source scan (**GR3**, which extends the I2 scanner to `.load(`).

### 2.8 Duplication removed - the target state

| concern | today | after |
|---|---|---|
| delete cascade | `server/store.js:70-97` **and** `app/src/commands.js:98-155` `[V]` | `plan()` only |
| group member-steal | `app/src/commands.js:157-175` only - the server has none `[V]` | `plan()` only |
| inverse computation | `app/src/commands.js:24-32` + ten exported builders, browser-only `[V]` | `plan()` only |
| the write | `applyOps` + `loadInto` + `patchMeta` direct-assign + `History.applyEntry` `[V]` | `applyOps` only |
| set-coalescing | `app/src/sync.js:40-55` **and** `app/src/input.js:1276-1288`, `:1311-1321`, `:1342-1352` `[V]` | `plan()` narrowing + one client pre-commit window |
| versioning | `Model.emit`'s `rev++` + `cleanMeta`'s adoption of the client's value `[V]` | `commit()` only |
| validation | `planMutation` per-op **and** `validateDoc` on push `[V]` | `plan()` per-op; `validateDoc` only at `install()` |
| broadcast payload | full snapshot (`server/rest.js:56`, `:70`), with `store.list()` riding along `[V]` | the Change |

---

## 3. Decisions

Thirty rulings, each with the consequence it accepts.

### D1 - Durable log, in the diagram file, store-owned [LOCKED]

The log is **durable**.\
The stated deployment is a single-instance Cloud Run that scales to zero; an in-memory log means "an agent wrote, the instance recycled, Ctrl+Z is gone" - retiring the headline feature in the exact deployment it is for.
**In the same file, not a sidecar:** `flush()` already rewrites the entire document on every debounce tick (`server/store.js:319-320` `[V]`), so an in-doc log adds bytes to a write that already happens.\
**Store-owned, not in `Model.toJSON()`** - putting it in the Model leaks it into `GET /api/v1/diagrams/:id` (`server/rest.js:117`), into the Slides push payload (`server/rest.js:223`), into every snapshot, and into the browser's Model `[V]`.

**Consequence:** file size - the largest diagram goes from 6912 B to a ~39.7 KB ceiling `[V, measured: diagrams/diagram-000001.json is 6912 B / 65 entities, + the 32 KiB log cap]`, and the data dir from 31,541 B today to a ~589 KB ceiling across all 17 `[V, measured: du -cb diagrams/*.json = 31,541`; `17 x 32,768]`.\
And a new top-level key that must be shape-validated as **tolerate-and-drop** - a corrupt log must never make a diagram vanish at boot (I13).

### D2 - Global undo - one log, one cursor, per diagram [LOCKED]

Ctrl+Z undoes *the last change to this diagram*, whoever made it.\
Global undo ships **only** with all four mitigations: `actor` (D20), mandatory `expect` on undo/redo (D14), an unraceable reclaim hold (D22), and `undo {to: seq}` (D21).\
**Three of the four are in place before the verb goes live**: `actor` at CS1, mandatory `expect` and the reclaim hold at **CS3**, the milestone that ships global undo.\
Only `undo {to: seq}` follows at CS6, because it bounds no hazard - it is bulk ergonomics.\
Per-actor undo means *selective* undo - rebasing inverses over intervening changes - which is unsound without OT/CRDT and produces a document state that never existed (N6).

**Consequence:** an agent holding the lock can undo a human's change, a second browser tab can undo the first tab's, and from CS3 a tab can reverse work it never saw being made.\
The answer is attribution + compare-and-swap, **not** partition: every Change **held in the ring** carries `by` and `actor`, `GET .../history` exposes both, and `reclaim` (`server/locks.js:69-71`, under the rationale at `:67-68`, *"the human owns the tool and can always take the wheel back"* `[V]`) does not touch the log - so reclaim, then Ctrl+Z, unwinds the agent's changes newest first.\
**The answer claims nothing beyond the ring.**\
Attribution is bounded by the ring's own depth (`LOG_MAX = 100` / `LOG_BYTES = 32 KiB`, D23); past that depth the system keeps no record of who changed what - a declared non-goal (**N12**), with **B9** carrying its revival trigger.

### D3 - Undo appends no record - the cursor moves, the version bumps [LOCKED]

Undo bumps `version` because the config changed and the file is rewritten.\
It appends nothing because `Log.append` truncates the redo tail (mirroring `app/src/commands.js:46-47` `[V]`), so appending an inverse would destroy the redo it just created.

**Consequence:** you cannot "undo an undo" except by redo; the log is a timeline with a position, not an append-only journal.\
This is why version cannot be log length (D6).

### D4 - Sync subscribes to the commit boundary, never to the Model [LOCKED]

`app/src/sync.js:34` subscribes to `model.onChange`, which is the *render* signal - six other subscribers legitimately want preview frames (`app/src/renderer.js:85`, `app/src/selection.js:17`, `app/src/input.js:93`, `app/src/readout.js:30`, `app/src/dataview.js:22`, `engine/store.mjs:15` `[V]`).\
Only Sync should not be there.\
The browser already has a transaction boundary: 26 `history.commit(...)` sites (`app/src/input.js` x23, `app/src/labeledit.js` x2, `app/src/palette.js` x1 `[V, counted]`).\
Invert the dependency - `changes.onCommit((request) => sync.submit(request))` - rather than wrapping 26 call sites.

**Consequence:** the property "after any gesture ends, the model equals base + the committed ops" becomes load-bearing and unenforced at runtime.\
Pinned instead by I7 - *client model == server model at quiescence*.

### D5 - `server/commit.mjs` is deleted [LOCKED]

A 6-line port combinator with exactly two consumers, each cancelling a *different* axis of its genericity: `apply`'s validate is vacuous (`server/store.js:242`), `replace`'s load is vacuous (`server/store.js:261`) `[V]`.\
Its only importer is `server/store.js:14` `[V]`.\
Its load->plan->validate->save discipline survives as the body of `server/txn.mjs`.

**Consequence:** the prism lineage transfer and the *"graph walk, FSM stepper had no consumer here"* record live nowhere else in the tree `[V, exhaustive grep; docs/ holds docs/spec/ only]` - `server/commit.mjs:1-9` is transplanted verbatim into `server/txn.mjs`'s header as a `Provenance:` block.\
The deletion lands only in the commit whose differential test against `planMutation` is green (**GR5**).

### D6 - Version is a counter, not log length and not a digest [LOCKED]

`version` is a per-diagram monotonic integer minted server-side inside `commit`, +1 per accepted transaction **including undo and redo**, persisted, never client-supplied, never decremented, never derived.\
**The counter is `log.version`**, persisted in the diagram file from CS2; **`meta.version` is its doc-visible projection from CS5**, seeded by CS5's migration from the file's own `log.version` and pinned thereafter by **GR9**.\
Log length is not monotonic (the ring evicts, `append` truncates the redo tail, undo changes the document without lengthening the log).\
A content fingerprint cannot **order** two states, so it can back neither `expect` nor a viewer's gap rule (D25).

**Consequence:** one persisted integer, and `version` is not derivable from the log.\
`change.seq === version-after-that-change`; the two deliberately diverge on undo.

### D7 - The server broadcasts a Change, not a snapshot [LOCKED]

Snapshot survives for hydration and repair only.\
The reason is not bytes.\
A snapshot destroys receiver state that is not in the doc: today literally `history.clear()` (`app/src/sync.js:115` `[V]`), and `model.load()` emits `'load'`, which cascades through `app/src/input.js:93-114` - cancelling an in-flight gesture, closing an open label editor, clearing the palette hand - and forces a full renderer rebuild (`app/src/renderer.js:85`) `[V]`.\
**An agent creating one node must not cancel the human's drag.**\
Fanout excludes the origin session; the origin gets the same information on its `ack`.\
Selection keeps its own message, `{cmd:'selection', body:{ids}}` - status, no version bump, no log entry.

**The gap rule is asymmetric [LOCKED]:** `from > V` -> request a repair snapshot; `from < V` -> **ignore**.\
A duplicate would otherwise trigger `model.load()` and cancel the live gesture - the exact harm this decision exists to remove.

**Consequence:** viewers must be able to apply ops, and a viewer that misses one must detect the gap.

### D8 - `meta.grid` is deleted; `meta.schema: 1` takes over the generation-discriminator role [LOCKED]

Once `migrateLegacy` (`server/store.js:38-58`, called at `:123` and `:270` `[V]`) is gone, `grid` is a constant that is written, validated and never varies.\
All 17 live files carry `meta.grid:'center'` `[V, measured]`.\
The value has exactly two readers - `server/store.js:39` (`migrateLegacy`'s detector) and `model/model.mjs:270`, whose deliberate non-defaulting exists *"so the server can detect it on push"* (`:268-269`, verbatim) `[V]` - and both die with `migrateLegacy` and `push`.

**Consequence:** the tree loses its **generation discriminator**.\
After CS5, `grid` is off the meta whitelist (`server/validate.js:166-168` `[V]`), so a legacy top-left document is no longer convertible *or* detectable - it fails `validateDoc` and, under D17, **refuses the boot with a named reason** instead of vanishing.\
The role is restored explicitly by `meta.schema: 1` in the whitelist and minted in `cleanMeta`.\
Two records must survive the deletion - the (-930, -510) transform and clamp rule as a dated amendment to `SCOPE.md` decision #1, and the 930/510 aliasing warning at `server/store.js:40-41` `[V]`.\
Both land in the **CS1** commit that removes `migrateLegacy`; full trace at section 7.4, Trace 2.

### D9 - `push` is deleted, and split into the two things it actually was [LOCKED]

**(a) Reconnect resync** (`app/src/sync.js:201` `[V]`) is fundamentally a **READ**; it is a write only because the client can describe what it *was*, never what it *did*.\
Replaced by `resume {diagram, version}` -> `sync` | `snapshot` | `error`, then an outbox replay of the unacked **requests**, each independently planned against current server state.\
**(b) Adopt-local-content** (`app/src/sync.js:87-111`, the push at `:107` `[V]`) is a **CREATE**, and expressing it as an overwrite is how it became a live data-loss bug - the client adopts whatever diagram the server answered with and pushes its own content over the top (**B2**).\
Replaced by `create {name, doc}` -> `store.install(null, doc)`, id server-minted, `doc.meta.id` ignored.

**Consequence:** the whole-document reconnect backstop is gone - the largest behavioural change here.\
The outbox replays only what passed through `Changes`, and `Net.send` returns `false` and **drops** anything sent while closed (`app/src/net.js:64-67` `[V]`), so the outbox is genuinely new code.\
Three additions follow and are not optional: typed `error {code, txnId}` landing *with* the outbox (D28, I16); `durableVersion` on ack and change so the client prunes on durability, not on ack; and a `resume` rewind reply when `clientVersion > serverVersion` (D29) - the case `push` used to repair.

### D10 - The inverse of a `set` that ADDS a key is a whole-entity `put` [LOCKED]

`Model.set` is `Object.assign` (`model/model.mjs:75` `[V]`) - a merge with **no unset**.\
Five fields are legitimately absent (`OPTIONAL` at `server/validate.js:90`: `node.shape/span/content`, `link.via/closed` `[V]`).\
A key-projected inverse of "add `span`" yields `{span: undefined}`, which `validateEntity` rejects and `JSON.stringify` silently drops - so the persisted inverse would be `{}` and Ctrl+Z on a Shift+arrow resize would be a silent no-op forever.\
Today's builders dodge this by fabricating the default (`app/src/input.js:1333-1334`, `app/src/input.js:521`, `app/src/commands.js:197` `[V]`); a mechanical projection cannot.
**Rule:** every key of the narrowed patch already present on the pre-entity -> the inverse is a projected `set`; **any** key being added -> the inverse is `{op:'put', entity: clone(pre)}`, because `put` replaces the whole entity object (`model/model.mjs:67` `[V]`).

**Consequence:** a few hundred bytes in the log for `span`/`shape`/`content`/`closed`/`via` first-writes.

### D11 - Nudge/resize amend is a client-side pre-commit window - no `amend` flag on the primitive [LOCKED]

Three sites today mutate the already-committed top-of-stack command in place (`app/src/input.js:1276-1288` nudge, `:1311-1321` zone resize, `:1342-1352` node resize `[V]`), reading `this.history.stack[this.history.index-1]` and comparing object identity - which does not exist once the log is server-side.\
A server-side `{amend:true}` would need a second write mode and, in a *shared* log, would let a human's arrow-key burst amend **an agent's change**.

**Consequence:** a nudge burst reaches the server up to `NUDGE_COALESCE_MS = 600` (`app/src/input.js:43` `[V]`) after the first keypress.\
In exchange, log granularity equals undo granularity 1:1 everywhere, and server-side change compaction is unnecessary (N8).

### D12 - The server computes the cascade; the browser sends intent [LOCKED]

The delete cascade is duplicated today - `server/store.js:70-97` and `app/src/commands.js:98-155` `[V]`.\
The browser applies its own request's ops locally (for most gestures a no-op, because the gesture already materialised them), then applies the server's **expanded** change when it echoes back.

**Consequence:** between the two applications the browser's model is transiently incomplete - a link whose endpoint was deleted locally renders as nothing, because `linkPath` returns `null` for a missing endpoint (`app/src/renderer.js:135-138` `[V]`), which is what the cascade is about to do anyway.\
The transient is invisible.\
The real cost is a **new queue in the browser**: inbound changes apply immediately **except while `input.mode !== null`**, where they queue and apply on gesture end - otherwise a remote change lands under a live drag preview.\
Preview writes still hit the shared Model (`app/src/input.js:769-773`, per pointer-move frame `[V]`); moving them into a render overlay is a separate arc (N7, **B7**).

### D13 - ws durability - the 200 ms debounce stays; `ack` means "accepted and ordered", not "durable" [LOCKED]

REST keeps flush-before-ack (`server/rest.js:54` `[V]`).\
A deferred-ack `durable(id, cb)` is rejected on evidence: `flushAll()` clears the timer *without running callbacks* (`server/store.js:327-333`) and `app.close()` calls it (`server/app.js:181` `[V]`), so any commit inside the shutdown window would abandon a held-open HTTP response.

**Consequence:** up to 200 ms of ws work is lost on a hard crash - as today.\
The claim at `server/rest.js:50-53` that the ws path is safe *"because the browser re-pushes the whole doc on reconnect"* `[V]` dies with D9; its replacement is the outbox plus the fact that an unflushed change is lost from the doc **and** its log together - consistent, never corrupt (N5, X2).

### D14 - `expect` - optional on forward writes, MANDATORY on undo and redo [LOCKED]

**Forward writes:** `expect` is optional; present -> 409 on mismatch.\
Mandatory `expect` would break trivial `curl` one-liners for no gain - forward writes are additive, attributable, arbitrated by the lock, and each names its target in the URL.
**Undo and redo:** `expect` is **mandatory**.\
Absent -> `400 {error:'expect required', code:'expect-required', version:<current>}` on `POST .../undo|redo`, and on the ws `undo`/`redo` when the sender did not originate the top record.\
**Undo is the one verb whose target is implicit**, over a cursor that `reclaim` does not touch and that `rejectIfLocked` does not arbitrate between tabs (`server/protocol.js:70-76` `[V]`).

**Consequence:** two forward writers can interleave without either noticing.\
An agent cannot issue a blind reversal, and `draw undo` costs one extra read - already paid for, because `POST .../lock` returns `version` at acquire from CS3.\
The alternative is "agents should send `expect` on undo" living in a prompt, which is prompt-only enforcement.\
Lands at **CS3**, so the verb never goes live without its precondition (**GR11**).

### D15 - What is config and what is status - one rule [LOCKED]

| Class | Members | Logged | Versioned | Undoable |
|---|---|---|---|---|
| **Config** | every entity op, `meta.name`, `meta.slides.url` | yes | yes | yes |
| **Status** | `selection`, `meta.slides.presentationId/pageId` | no | no | no |

`version` is a **config** watermark, not a file-bytes watermark: status writes change the file without moving it, by design.\
A rename **is** undoable - and routing it through a transaction fixes the defect that a rename has never moved `rev`, because `patchMeta` assigns meta directly and never calls `emit()` (`server/store.js:276-285` `[V]`).

**Consequence:** Ctrl+Z immediately after pasting a Slides URL clears the field.\
Accepted: `onKeyDown` returns early for `INPUT`/`TEXTAREA`/`SELECT` (`app/src/input.js:1365-1366` `[V]`), so a focused header field keeps its own undo - pinned by a test rather than left as an accident.

### D16 - Module placement - no sovereignty changes [LOCKED]

`groupAfterRemoval` stays at `engine/policy.mjs:14`, exported from `engine/index.mjs:4`; `server/store.js:13` already imports it `[V]` and `server/txn.mjs` will too.\
`server/validate.js` stays put.\
Only `applyOps`, `clone` and the op vocabulary are shared with the browser, in `model/ops.mjs` - a new peer of `model.mjs` inside a substrate the browser already loads over HTTP.\
The planner is server-only, because *authority* is what must not be duplicated.\
`app/src/commands.js` loses its `engine/` import (`app/src/commands.js:11` `[V]`).

**Consequence:** `model/` may import nothing, yet two of its rules derive from facts declared in `server/validate.js` - `clone`'s deep-copy list (`app/src/commands.js:15-22` `[V]`) and D10's absent-key rule (`OPTIONAL`, `server/validate.js:90` `[V]`).\
The fact moves **inward, not outward**: `model/shape.mjs` declares `{composite, optional}` per kind and `server/validate.js` imports it - the server->document direction is already legal and in use (`server/validate.js:7` imports `SURFACE` from `model/index.mjs` `[V]`).\
The two sets are genuinely **different** - `clone` copies `members/via/span/content`, `OPTIONAL` is `shape/span/content/via/closed` `[V]` - which is itself the argument for one declared table.\
I3 iterates that table instead of a hardcoded five-field list.

### D17 - `Store.init` THROWS, never seeds, when candidate files were present and none loaded [LOCKED]

Today the boot loop skips a rejecting file (`server/store.js:125-128`) and `if (this.diagrams.size === 0) this.seed();` (`server/store.js:142`) `[V]` - so a schema change that misses one field makes all 17 diagrams disappear into a fresh "example" and the server answers **HTTP 200 with a fabricated store**.\
Track a `failed` count across the load loop at `server/store.js:120-141`; at `:142`, seed only when `failed === 0`, else log every per-file rejection reason and exit non-zero. ~4 lines.\
This **permanently retires the data-disappearance class** for every future schema change and replaces a manual "assert 17" gate at CS5.\
It fixes the healthcheck for free: `Dockerfile:43-44` asserts HTTP 200 only, and `/health` returns `{status:'ok', diagrams:N}` at any N (`server/rest.js:79-81`) `[V]`.\
The repo has already learned this lesson and mechanized it for the *lesser* hazard - `server/validate.js:223-226`, verbatim: *"rejecting the doc for that would make the diagram vanish on boot"* `[V]`.

**Consequence:** a single corrupt file in an otherwise-good data dir still boots (verified free: `tests/server.test.js:601-616` has one good file among three, so `size === 1` and it still passes `[V]`); a wholly-bad data dir refuses to start rather than lying.\
Lands at **CS1**, permanent (I15, **GR8**, **B5**).

### D18 - One module owns the on-disk file format, read and write - `server/docfile.mjs` [LOCKED]

`serialize(doc, log) -> text`, `parse(text) -> {doc, log}`.\
`Log` exposes a plain `toJSON()`.\
**No string surgery in `store.flush`** - a slice-and-splice composition makes `server/store.js` depend on the indent argument, on `toJSON`'s byte tail, and on `Log.serialize` hardcoding a matching tab depth: four modules co-owning one format.\
D1's actual requirement (the log stays out of `Model.toJSON()`) is satisfied by composing at the store instead.

**Consequence:** one more module, and one seam that must round-trip the 10,169 B delete-all record `[V, measured: one `del` per entity + one `put` inverse per entity over the 65-entity diagram]`.\
In exchange the GCS adapter point exists for free - the two `fs` calls at `server/store.js:319-320` `[V]` become one `writeDoc(file, text)`, which is also the injection seam the chaos tests need (**GR4**).\
Seam at **CS1**, round-trip gate at **CS2**.

### D19 - The server writes the Slides binding [LOCKED]

`handleSlidesPush` calls `store.patchMeta(diagramId, {slides:{presentationId, pageId}})` before responding (two lines), becoming `store.bindSlides(...)` when `patchMeta` splits at CS3.\
D15 classifies the binding as *status*: no version bump, no log record.\
Today `handleSlidesPush` (`server/rest.js:208-241`, read in full) calls `slides.sync.push(model.toJSON())` - on a **copy** - and returns `json(res, 200, report)` at `:225`; it performs no meta write `[V]`.\
The consumer survives with its rationale intact: `server/slides/sync.js:66-70` - *"URL fragment wins, then the binding remembered from the last push - but only if it belongs to THIS presentation"* `[V]`.\
Retaining the browser round-trip instead is rejected: it keeps the browser's last meta write path alive purely to feed server bookkeeping, which is the coupling this arc exists to remove.

**Consequence:** the Slides push path gains a write where today it only reads, so `handleSlidesPush` must be lock-aware in the same way `commitStatus` is.\
Without this ruling, CS3 removes the producer while the consumer and the whitelist entries (`server/store.js:27`, `server/validate.js:175` `[V]`) survive - the field is never written again, and **every push to a URL without a `#slide=` fragment silently reverts to `pages[0]`, forever**.\
The existing suite would not catch it: `tests/slides.test.js:237-261` exercises the consumer with a hand-built doc `[V]`.\
**Lands at CS1**, with a producer test; the client deletion at CS3 is conditional on it (section 7.4, Trace 1).

### D20 - A per-writer `actor`, minted server-side at CS1 [LOCKED]

Keep `by:'client'|'server'` as the coarse enum; add an opaque `actor` string taken from the hub session or the lock token - both already identify the writer (`server/locks.js:38-44` `[V]`; `Session` has no id today, `server/protocol.js:35` `[V]`, so one `crypto.randomUUID()` in the constructor).

**Consequence:** 47 B per record `[V, measured: `,"actor":"<36-char uuid>"`]` - ~4.7 KB at the 100-record cap, ~14% of the 32 KiB ring.\
Mandatory at **CS1**, not later, to avoid a second log-format migration after CS2.\
Without it, D2's promised readout ("undid *agent*'s move") is unrenderable for the tab-vs-tab case it exists to mitigate - both tabs are `'client'` - and the IAP story is aspirational, whereas with it `actor` is the field a principal drops into unchanged (N4).

### D21 - `undo {to: seq}` - bulk reversal on both transports [LOCKED]

Reverse every record above `seq` as one transaction, one version bump, one broadcast.\
The browser offers "undo all N changes by *agent*" when the top run is not the human's - readable only because of D20.

**Consequence:** ~25 lines reusing the primitive in a bounded loop, and one more shape on the wire.\
It replaces an unbounded N-keystroke manual handoff: a 40-write agent script is otherwise 40 keystrokes, with `canUndo` a boolean and the label describing only the top record.\
**Lands at CS6 - deliberately, and it is the one mitigation that lands after the hazard.**\
D14 and D22 bound what a blind or raced reversal can do, so they ship with global undo at CS3; `undo {to: seq}` bounds nothing - it makes an already-safe reversal cheaper to issue in bulk.\
The split is *safety before the verb, ergonomics after it*; **GR11**.

### D22 - Reclaim installs a human-hold an agent cannot race [LOCKED]

`Locks.reclaim(id)` records `heldUntil = now + HOLD_MS` (30 s, or cleared by the first client commit), during which `acquire` returns `null` with `{error:'reclaimed by the human', retryAfter}`.\
Today `reclaim` is `this.map.delete(id)` (`server/locks.js:69-71`) and `acquire` immediately re-succeeds (`server/locks.js:38-44`) `[V]`, while Ctrl+Z is `readOnly`-gated (`app/src/input.js:1440` `if (this.readOnly) return;`, inside `onKeyDown` `:1363-1576`, above the Ctrl chord block at `:1533` `[V]`)
- so an agent's polling loop can re-lock and render the human's remedy inert.

**Consequence:** a legitimate agent retry is refused for up to 30 s and must honour `retryAfter`.\
The race exists today; what is new is that **D2 designates this exact path as the remedy for agent damage**, which makes an existing nuisance a load-bearing failure.\
**Lands at CS3**, in the same milestone as the hazard it bounds; **GR11**.

### D23 - Log depth - `LOG_MAX = 100` records and `LOG_BYTES = 32 KiB`, evict oldest first, never evict the only record [LOCKED]

Measured record sizes against `diagrams/diagram-000001.json` `[V, measured: framing = a Change with empty ops/inverse, `actor` included]`: framing 137 B, move-1-node 274 B, create-node 287 B, move-3-nodes 562 B, delete-everything-65-entities 10,169 B. So 32 KiB is **58-119** transactions at those sizes - 562 B -> 58, 287 B -> 114, 274 B -> 119 - **capped at `LOG_MAX = 100`**, which is where the two caps visibly interact: the record cap binds for ordinary edits, the byte cap only at the large end.\
Comparable to today's `History(limit=100)` (`app/src/commands.js:35` `[V]`).\
The never-evict-the-last rule exists so that select-all-delete, the single most destructive action, can never be the one thing you cannot undo.

**The ring stays bounded, and there is no separate accountability trail [LOCKED].**\
The alternative is an unbounded one-line-per-change trail, and `flush()` rewrites the *entire* document on every debounce tick (`server/store.js:319` `[V]`) - a 10k-change trail is ~600 KB rewritten every 200 ms, which destroys the ~39.7 KB ceiling D1 traded for.\
The consequence is declared as **N12**.

**Consequence:** a 50-write agent script fills the ring, and eviction is a *designed, bounded loss* - which is permitted only if it is visible.\
So: `Log` carries a monotonic persisted **`evicted`** counter; `GET .../history`, `snapshot` and `change` carry `truncated: evicted > 0`; I14 requires eviction to increment `evicted` and `evicted` to survive a restart; CS6 adds the eviction floor and surfaces `truncated` in the browser undo affordance.\
The caps are a one-line dial, to be re-set from real use.

### D24 - Reconnect answers `sync | snapshot | error` - no `catchup` reply [LOCKED]

A `catchup {changes, version}` middle case replaying the missing Changes from the ring is ~20 lines of pure optimisation; a 7 KB snapshot is always correct and cheap at this scale (6912 B `[V, measured]`).\
Not built
- not at CS6, not later, unless a measured cost justifies it (N10).

**Consequence:** a viewer that misses one change pays a full snapshot, which under D7 is the disruptive path.\
Two rules bound the harm, both mandatory: only `from > V` repairs - `from < V` is ignored (D7) - and `resume` answers `snapshot {rewound:{from,to}}` when `clientVersion > serverVersion` (D29).

### D25 - No content fingerprint on `version` [LOCKED]

`{version, digest}` would make `resume`'s `sync` reply assert *identity*, not merely *order*.\
Rejected: with the log persisted in the same atomic write (D1, I10), `version` and content cannot disagree across a restart - the failure requires a hand-restored file.\
A fingerprint is also O(doc) per write and cannot order two states, which is D6's disproof.

**Consequence:** the hand-restored-file case is uncovered by design.\
Two cheaper mechanisms carry what the digest was reaching for: `Log.toJSON()` emits `version` and `Log.from(json, fallback = 0)` reads it back from CS2 - without which a restarted server mints `seq = 1` over a ring already holding higher `seq` values, duplicating `seq`, breaking `change.seq === version-after`, and making `expect` CAS unsound; and `meta.schema: 1` as the generation discriminator (D8).\
I12 is therefore *monotonic per diagram **across restarts***.

### D26 - `GET .../history` is a projection [LOCKED]

`{version, canUndo, canRedo, evicted, truncated, records:[{seq, at, by, actor, label, summary}]}`.\
**`ops` excluded by default, `inverse` never on the wire**; `?verbose=1` adds `ops` only.\
`summary` is server-derived (`"delete - 3 nodes, 2 links"`).\
Budget: **<= 16 KiB at the 100-record cap**, asserted - standing as **GR13**.

**Consequence:** an agent that wants the ops pays a second, explicit request.\
The stored record carries both `ops` and `inverse` and a delete-all record is 10,169 B `[V, measured]`, so an unprojected default is a 32 KiB raw dump into the one actor the projection discipline exists to protect.\
Lands at **CS3**.

### D27 - The wire carries `version` from `log.version` at CS3 - no dual mint [LOCKED]

Because CS2 already persists `log.version`, the wire gains `version` at CS3 **from the log**, with no schema change.\
`meta.rev` stays in the file, frozen and ignored, until CS5; `meta.version` does not exist in any file before CS5, because `validateDoc` whitelists `doc.meta` to `id|name|rev|slides|grid` (`server/validate.js:166-168` `[V]`).

**Consequence:** there is no window in which an agent must be told not to use `expect`, and no window in which two counters are minted.\
`meta.rev` is dead weight in the file for two milestones.

### D28 - No submitted request is discarded without a user-visible notice [LOCKED]

`error {code, txnId}` is typed and lands **with** the outbox at CS3, not later.\
A rejected commit, a send on a closed socket, and a dropped replay all reach the readout.\
Today a rejection is a bare string that is only `console.warn`ed (`app/src/sync.js:139` `[V]`) and `Net.send` returns `false` and drops silently (`app/src/net.js:64-67` `[V]`) - so a rejected write is lost and the browser diverges permanently.

**Consequence:** every rejection path needs a readout string and a test.\
Pinned by **I16** and by **GR6**'s fault (iii).

### D29 - `resume` answers with a rewind reply when the client is ahead [LOCKED]

When `clientVersion > serverVersion`, the answer is `snapshot` **with** `{rewound:{from,to}}`; the client raises it in the readout (*"server restarted - your last N change(s) were not saved"*) and replays any retained requests above the server's version before clearing.

**Consequence:** one more reply shape.\
Today `push {doc}` (`app/src/sync.js:201` `[V]`) repairs this case, and CS4 deletes it; the outbox cannot cover it, because the outbox holds only **unacked** requests.\
Without the rewind reply the deletion converts a repaired divergence into a **silent** revert.\
Lands at **CS4**.

### D30 - The outbox is persisted [LOCKED]

Persist on enqueue to `localStorage`, drain on `resume` (~15 lines).\
The app already uses `localStorage` (`app/src/sync.js:14` is the key constant; calls at `:108`, `:130`, `:191` `[V]`).

**Consequence:** offline work survives a tab close, not merely a disconnect. ~15 lines and one more persisted client key.\
Lands at **CS4**, with the deletion of `push`-on-reconnect that made it necessary.

---

## 3b. Durability - what is actually guaranteed

*(Moved 2026-09-03 from `SCOPE.md`, which was superseded in premise.\
The guarantee is a property of what a commit promises, and belongs beside the transaction contract rather than beside a scope statement.)*

**Undo survives a *process* restart.\
A machine-level kill can lose the last 200 ms of websocket work - document and log together, consistent, never corrupt.**

Stated at exactly the strength the code makes, and no more.\
There is no `fsync` anywhere in the server: a write is `writeFileSync` + `renameSync`, which is atomic against a process dying but not against a kernel that has not yet flushed its page cache.\
The document and its change log are ONE file, so a lost write loses both together and never leaves a log describing a document that does not exist.

REST writes are stronger, deliberately: an agentic caller is one-shot and has no reconnect backstop, so a REST 200 means flushed, not merely accepted.\
The 200 ms debounce applies to websocket work only, where a browser reconnects and replays its outbox.

Recorded as deviation **X2**; `docs/BACKLOG.md` **B6** carries the revival trigger (any multi-instance or GCS-backed deployment - confirm the gcsfuse assumptions against a real bucket before relying on them).

---

## 4. Correctness invariants  [LOCKED]

Sixteen.\
Every row names the milestone it lands in and the test that pins it.\
**Zero unassigned** - an invariant with no named test is not an invariant, it is a hope.

| # | Property | Lands | Test that pins it |
|---|---|---|---|
| **I1** | **Reject writes nothing.** Any request failing the shape gate, the `expect` precondition, or any op's validation leaves `toJSON()` deep-equal, `version` unchanged, the Log unchanged, and the flushed file byte-identical. Holds by purity: the planner runs on a projection, `applyOps` is never reached. | CS1 | `tests/store-atomicity.test.js` - *"commit: a 5-op request failing on op 4 writes NOTHING - model, log, version and flushed file byte-identical"* (extends the 1-op case at `tests/store-atomicity.test.js:20` `[V]`) |
| **I2** | **One writer.** No module other than `model/ops.mjs#applyOps` calls `model.put/set/del` on the server, and no module other than `Store.install` calls `model.load` - `Store.adopt` (`server/store.js:154`) and `Store.loadInto` (`:225`), today's only other callers `[V, exhaustive grep]`, are **folded into `install()` at CS1**, not allow-listed. Inverses are applied **without revalidation**; an out-of-band write corrupts every stored inverse below it with no error at the time of corruption. | CS1, standing | `tests/gate.test.js` - *"source scan: no writer outside the allow-list"* - runs `tools/scan-writers.mjs` (**GR3**), plus the runtime assertion inside `install()` |
| **I3** | **Inverse correctness, per op - table-driven.** Iterates `model/shape.mjs`'s `{composite, optional}` table; never a hardcoded field list, so a sixth optional field added later fails the test by construction. For every kind x every field, `applyOps(m, ops); applyOps(m, inverse)` is deep-equal to pre-state, including each optional field absent-then-added. | CS1 | `tests/txn.test.js` - *"inverse: every kind x every field in shape.mjs round-trips, including each optional absent-then-added"* |
| **I4** | **Inverse correctness, cascades, as one unit.** `del node` with links, group trim, group dissolve, `del waypoint` as endpoint, `del waypoint` as `via` - each is ONE Change whose inverse restores deep-equal, with referential validity at every intermediate step (dependents deleted first => restored last; the constraint `app/src/commands.js:131-133` documents `[V]`). | CS1 | `tests/txn.test.js` - *"cascade: five shapes, one change each, inverse restores deep-equal"* |
| **I5** | **Round trip.** N random valid transactions -> N undos = start; N redos = end. | CS1 (certified where it ships); re-run at CS2 as the persistence proof | `tests/undo.test.js` - *"N random transactions, N undos, N redos"*; `tests/persist.test.js` + `tests/history.test.js` - *"...across `new Store()`"* |
| **I6** | **Idempotence / no-op.** A narrowed plan of length 0 -> `{ok:true, change:null}`: no record, no version bump, no `markDirty`, no broadcast. `DELETE` of a missing entity is already idempotent today (`server/validate.js:118-122`; `model/model.mjs:80-82` `[V]`). | CS1 (primitive) / CS3 (surface) | `tests/txn.test.js` - *"a set to identical values plans zero ops"*; `tests/server.test.js` - *"PATCH to identical coordinates -> 200 `{changed:false}`, version unchanged, no broadcast"* |
| **I7** | **Client model == server model at quiescence.** The server's cascade expansion must appear on both sides of the equation, which forces the ack and the broadcast to carry it. | CS3 | `tests/convergence.test.js` - *"at quiescence origin == viewer == `store.get(id)`"* (**GR6**) |
| **I8** | **No aliasing.** No object reachable from a stored Change is reachable from the live model. `applyOps` clones on `put`; `plan` clones every entity captured into an inverse. The hazard is documented in-tree (`app/src/commands.js:13-14` `[V]`) and the existing server-side shallow `members` copy is not sufficient. | CS1 | `tests/txn.test.js` - *"mutating a live entity after commit does not alter the stored inverse"* |
| **I9** | **Crash consistency.** `applyOps` and `log.append` occur in one synchronous turn; `markDirty` only schedules a macrotask (`server/store.js:300-310` `[V]`). Every flush observes (pre-ops, pre-record) or (post-ops, post-record). **(post-ops, pre-record) is unreachable.** | CS1 (structure) / CS2 (fault test) | `tests/store-atomicity.test.js` - *"an injected `writeDoc` observing every publish never sees ops without their record"* - requires the **GR4** seam |
| **I10** | **One file, nothing to order.** Doc and log are published by a single `writeFileSync(tmp)` + `renameSync` (`server/store.js:319-320` `[V]`) through one format seam. No second file, no ordering rule, no tear window. | CS2 | `tests/persist.test.js` - *"`parse(serialize(doc, log))` deep-equal incl. the 10,169 B delete-all record; flush issues exactly one `writeDoc` per publish"* |
| **I11** | **No client authority over identity or version.** `version` is never read from the wire; `meta.id` is never read from a `create {doc}` payload; a client-supplied `version` in any body is ignored - only `expect` is honoured, and only as a precondition. | CS4 | `tests/server.test.js` - CS4: *"`create {doc}`: client-supplied `meta.id` ignored, server mints the id"* and *"a body `version` is ignored; only `expect` is honoured"*. CS5 adds *"a client-supplied `meta.version` is "ignored"* - the key cannot appear in a file before CS5 (**D27**) |
| **I12** | **`version` and `seq` are monotonic per diagram across restarts.** +1 per accepted non-empty transaction, undo and redo; unchanged on reject, empty plan, selection write and slides-binding write; never decremented, never derived from log length. | CS2 (log carries `version`) / CS5 (`meta.version`) | `tests/persist.test.js` + `tests/history.test.js` - *"restart -> commit -> `version === preRestart + 1`, no `seq` collision in the ring"*; plus the `flush()` post-condition (**GR9**) |
| **I13** | **Log tolerance.** A `log` key that is missing, malformed or truncated loads as an empty log with a `console.warn`, and **never** causes the diagram to be skipped. One step stronger than the in-tree `selection` precedent, whose rationale is explicit: *"rejecting the doc for that would make the diagram vanish on boot"* (`server/validate.js:223-226` `[V]`). | CS2 | `tests/persist.test.js` + `tests/history.test.js` - *"a corrupt / truncated / absent log key loads empty and the diagram still boots"* |
| **I14** | **Bounding, and eviction is reported.** `records.length <= 100` and `bytes <= 32768` unless `records.length === 1`; eviction decrements `cursor` **and increments a persisted `evicted` counter that survives restart**; `truncated: evicted > 0` rides `history`, `snapshot` and `change`. A cap hit never blocks a write. `evicted` is persisted because a restart must not reset the only evidence that history was cut. | CS1 (ring) / CS2 (persistence) / CS6 (floor + surfaced) | `tests/persist.test.js` + `tests/history.test.js` - *"caps hold; never evict the only record; eviction moves `cursor` and `evicted`"*; *"`evicted` survives a restart"* |
| **I15** | **The store never fabricates success.** If candidate files were present and none loaded, the process exits non-zero with per-file reasons - it does not reseed. | CS1, permanent | `tests/server.test.js` - *"a data dir in which every candidate diagram file fails validation refuses to boot"* (**GR8**) |
| **I16** | **No submitted request is discarded without a user-visible notice.** A rejected commit, a send on a closed socket, and a dropped replay all reach the readout (D28). | CS3 | `tests/sync.test.js` - *"a rejected commit and a send on a closed socket both reach the readout"*; `tests/convergence.test.js` fault (iii) |

---

## 5. Mechanized guardrails  [LOCKED]

Every row below is a test, a scanner, a runtime assertion or a boot condition.\
None is left for an actor to remember.

**The attachment rule [LOCKED].**\
A guardrail attaches at the **END** of the milestone that creates what it guards - never before.\
A scanner whose allow-list names a module that does not yet exist, and a differential test whose reference implementation is still the only implementation, are red by construction until their milestone lands.\
`npm run gate` therefore has two forms: a **pre-CS1 form** (the test run, `scan-claims`, the file-existence checks, the installed hook) and a **post-CS1 form** that adds `scan-writers` from the end of CS1's first commit.\
Each row's **Attaches** column names the milestone at whose close it becomes load-bearing.

| # | Guardrail | Mechanism - exactly what runs | Fails on | Attaches |
|---|---|---|---|---|
| **GR1** | Promotion to trunk is gated by a deterministic proof, not a habit. | `npm run gate` = `node --test tests/*.test.js` **+** `node tools/scan-claims.mjs docs/spec/dev/COMMIT-DELIVERY.md#2 docs/spec/COMMIT-DELETIONS.md` (GR2) **+** `test -f docs/spec/TRANSACTIONS.md` **+** `test -f docs/BACKLOG.md`; from the end of CS1's first commit it also runs `node tools/scan-writers.mjs` (GR3). `npm run gate:install` writes `.git/hooks/pre-push`; `tests/gate.test.js` asserts that hook exists and is executable. | any failing test; any scanner hit; a missing `TRANSACTIONS.md`/`BACKLOG.md`; an uninstalled hook. Today `package.json` scripts are `start` and `test` only, there is no CI directory, and `.git/hooks` holds `.sample` files only `[V]` - **so every other guardrail here is advisory until GR1 lands.** | **before CS1** |
| **GR2** | No deletion is justified by an unmarked claim. | `tools/scan-claims.mjs`, over exactly two scopes: **section 7 of this file** and **all of `docs/spec/COMMIT-DELETIONS.md`**. The unit is a **deletion-table row**: every data row whose first cell names a symbol or path (contains a backtick) is a deletion by construction, so every such row must carry a `[V]`/`[I]`/`[A]` marker, and a `[V]` must be accompanied by a `path:line` token or an explicit `measured`/`exhaustive`/`counted` form. A scoped scan matching **zero** rows fails loudly rather than reporting a vacuous pass. | any deletion row without evidence; a scope that matches nothing (the section moved or was renamed). The rest of `docs/spec/` is deliberately out of scope - those files predate the rule. | CS1, standing |
| **GR3** | I2 as an executable scan, extended to `.load(`. | `tools/scan-writers.mjs` over `server/**/*.{js,mjs}` **and** `document/**/*.mjs` - the scan root must be able to see the allow-list it names, and the allow-listed site lives in `model/ops.mjs`, outside `server/`. Fail on `/model\.(put\|set\|del)\s*\(/` outside that single site (`model/ops.mjs#applyOps`), **and** on `/model\.load\s*\(/` outside `Store.install` - `install()`'s whole-document write bypasses `applyOps` entirely. **`Store.adopt` is NOT allow-listed: it is folded into `install()` at CS1**, and so is `loadInto`. Plus a runtime assertion inside `install()` that the entry's `Log` is replaced in the same call. The allow-list is a data file and is the durable record of any future exception. | any second writer. The property holds today - server-side `model.put/set/del` exists only at `server/store.js:104-106`, and `model.load(` only at `:156` (`adopt`) and `:226` (`loadInto`) `[V, exhaustive grep]`, both folded into `install()` in CS1's own commit - so the scan is trivial then and forensic later. | **end of CS1's first commit**, standing |
| **GR4** | Crash, race and durability tests are runnable **at all**. | `new Store(dataDir, { flushMs, writeDoc, now })`, with `writeDoc(file, text)` wrapping `server/store.js:319-320`. | today `FLUSH_MS` is a module const (`server/store.js:16`), `fs` is a direct import, and the constructor takes one argument (`:111`) `[V]` - so **I9, I10, I12-across-restart and GR6 fault (iii) are unwritable by construction**. Precedents to author from: `new Locks({ttlMs, now})` (`tests/locks.test.js:41` `[V]`) and the injectable Slides transport (`server/slides/sync.js:6`; faults at `tests/slides.test.js:265`, `:277`, `:291` `[V]`). Same seam N3 wants for GCS. | CS1 |
| **GR5** | A deleted reference implementation is replaced only against a green differential. | `tests/diff-plan.test.js`: seeded-random doc + >=1000 random single-op mutations; assert the new `plan()`'s op list == `planMutation()`'s (`server/store.js:65-99` `[V]`). `tests/diff-inverse.test.js`: the same against the browser inverse builders - and it must cover **all 23 `history.commit(` transaction shapes**, not only the builders: **8 of `app/src/input.js`'s 23 sites build their `entries` inline and never touch a builder** (`:519, :546, :651, :876, :907, :972, :1321, :1352` `[V, counted`]), so a builder-only oracle covers ~15 of 23 and misses the link-`closed` toggle, star/chain, route creation, node-type re-hand, link-endpoint re-attach and both resize paths. **The reference implementation is frozen into `tests/fixtures/` in the same commit that deletes it** (`tests/fixtures/` already exists `[V]`), so the oracle outlives the deletion. | any divergence on any seed; and any commit that removes the old code without its differential test green in that same commit. The opportunity is destroyed permanently once the old code is gone. | CS1 (planner) / CS3 (inverses), standing post-freeze |
| **GR6** | Two viewers and the store agree at quiescence, under injected faults. | `tests/convergence.test.js`: two ws clients + one REST writer on one diagram; **seeded, deterministic** interleaving of >=200 mixed transactions including `del node` with attached links, group member-steal, `del waypoint` used as a `via`, undo and redo; assert `origin.toJSON()` == `viewer.toJSON()` == `store.get(id).toJSON()`. Three injected faults: (i) drop one `change` to B -> B detects `from > V` and repairs (`from < V` -> **ignore**); (ii) deliver a change while B has `input.mode !== null` **targeting the entity B is dragging** - the ordering race where the version arithmetic still lines up and the gap detector never fires; (iii) B disconnects mid-transaction, reconnects and replays, and no request is silently dropped. | any inequality at quiescence; an unrepaired gap; a silently dropped request. | CS3, standing |
| **GR7** | The user's data is never rewritten by an unproven transform, and the backup outlives the arc. | `tools/migrate-version.mjs`, **committed** - the five-step procedure is specified at section 6, CS5. `tests/migration.test.js` runs it over old-shape fixtures. | a live server on the port; a count mismatch; any entity-level difference - a count-only assertion passes a `jq` typo that mangles every coordinate. | CS5; **`diagrams.bak` retained until CS6 closes** |
| **GR8** | The store never fabricates success - pins **I15**, implements **D17**. | `Store.init` tracks a `failed` count across the load loop (`server/store.js:120-141` `[V]`) and seeds at `:142` only when `failed === 0`; otherwise it logs every per-file rejection reason and exits non-zero. ~4 lines. | a data dir where candidates were present and none loaded. Free today: `tests/server.test.js:601-616` keeps one good file among three, so `size === 1` and it still passes `[V]`. | CS1, standing |
| **GR9** | `version` and `seq` monotonic across restarts - pins **I12**. | `Log.toJSON()` emits `version`; `Log.from(json, fallback = 0)` reads it back; a runtime post-condition inside `flush()` asserts **`log.records.every(r => r.seq <= log.version)`** from CS1 (the two watermarks deliberately diverge on undo per **D3**, so equality would be false after the first undo and would throw on an empty log), together with an append-time assertion that **`change.seq === log.version`**, and additionally **`meta.version === log.version`** from CS5 - it therefore fires on every existing test and every new one. CS5's migration seeds `meta.version` from the persisted `log.version`. | any restart that re-mints a live `seq`; any path that moves one watermark without the other. | assertion CS1, load-bearing CS2, extended CS5 |
| **GR10** | the interface record never asserts the opposite of the running wire for longer than one milestone. | Each milestone amends the lines it falsifies **in the same commit**, in the file's existing dated-amendment form (section 6.2). `tests/spec.test.js` asserts (a) a dated amendment exists against each reversed locked decision - `SCOPE.md:149-150` (now `../DECISIONS.md`), `:210-211`, `:217`, `:223-224`, `:225` `[V]` - and (b) no `push`/`apply`/`rev` wire token survives in `SCOPE.md` after CS5 (`:113`, `:135`, `:136` `[V]`). | a milestone that ships without its amendment. | CS1 / CS3 / CS4 / CS5 / CS6 |
| **GR11** | The destructive verb cannot be issued blind, and the human's remedy cannot be raced away. | `POST .../undo\|redo` without `expect` -> `400 {code:'expect-required', version}`, and the ws `undo`/`redo` likewise when the sender did not originate the top record. `undo {to: seq}` reverses a run as one transaction, one version bump, one broadcast. `Locks.reclaim(id)` records `heldUntil = now + HOLD_MS`, during which `acquire` returns `null` with `{error:'reclaimed by the human', retryAfter}`. `actor` is minted server-side at CS1. | a blind undo; an agent re-locking inside the hold. `tests/undo.test.js` - *"undo without `expect` -> 400"*, *"`undo {to: seq}` reverses a run in one action"*, *"reclaim -> agent re-lock refused -> Ctrl+Z succeeds"*. | `actor` **CS1**; mandatory `expect` (D14) and the reclaim hold (D22) **CS3 - with the hazard**; `undo {to: seq}` (D21) **CS6**. Standing from CS3 |
| **GR12** | A fanout failure can never fail the primary transaction. | `Hub.broadcast` wraps **each** session send in its own `try/catch` and logs the offending session, so one throwing socket can neither abort the loop nor propagate into the caller's response. `tests/server.test.js` - *"a session whose `send` throws does not prevent other sessions receiving the change, and the REST caller still gets 200"*. | any fanout error reaching the transaction path; a 500 returned for a transaction already applied, logged and flushed. Today `broadcast` is a bare `forEach` (`server/hub.js:25-29` `[V]`), `server/rest.js:56` broadcasts *before* `:57` responds, and `handleWrite(...).catch` at `:99-102` finds `!res.headersSent` `[V]` - cosmetic today, load-bearing once D7 makes the fanout the sole channel by which a viewer learns anything. | CS3, standing |
| **GR13** | The agent-facing payload stays inside its budget, and `inverse` never reaches the wire. | `tests/server.test.js` asserts `GET /api/v1/diagrams/:id/history` is <= **16 KiB** at the 100-record cap `[V, measured: a projected record is 146 B; x100 + envelope = 14,787 B]`, and that no response under **any** query - `?verbose=1` included - carries an `inverse` key. | any history response over budget; any `inverse` on the wire. | CS3, standing |
| **GR15** | **Hygiene does not accumulate: dead exports, twin functions and broken path references are detected, not noticed.** | Three scanners in `npm run gate`, each with an ALLOW list that is the durable record of every judged exception and each proven to bite by injection. `tools/scan-dead.mjs` - every exported symbol counted against its PRODUCTION consumers, reporting DEAD / TEST-ONLY / LIVE separately, because collapsing TEST-ONLY into either would delete the injection seams the suite is built on or hide code whose last real caller is gone (A3 *Earned Exposure*). `tools/scan-twins.mjs` - all-pairs Jaccard over normalised function line-sets; a contiguous-window detector finds **nothing** in this tree because the duplication is interleaved through legitimately different emission code, which is why the obvious detector was the wrong one. `tools/scan-docrefs.mjs` - every `path.ext` cited in a doc **or a code comment** must resolve, with historical records (deletion tables, superseded sandboxes) exempt because naming the dead is their job (A4). | an export with no production consumer and no recorded reason; an undeclared pair >=25% similar; a citation that points at nothing. Calibrated at H5: 182 exports -> 0 unexplained, 204 functions -> 1 declared pair, 772 references -> 0 unexplained. | **H5**, standing |
| **GR16** | **The command boundary is a boundary: every committed action is built by its builder.** | Two rules added to `tools/scan-writers.mjs`, which already owns the one-writer argument at the layer below. A `{ label, entries }` literal anywhere in `app/src/` outside `commands.js` fails - including the SHORTHAND `{ label, entries }` form, which the first draft of the pattern missed and which was exactly how `commitRoute` had escaped notice. Separately, an ENTRY carrying `before` in `commands.js` fails - scoped by brace-matching out to the literal holding the `op:`, after the original file-wide form produced its first false positive at H6.9 on a legitimate local pre-state (`clampDelta`'s parameter contract). A regex pairing the two keys cannot do this: an entry's `before` value is itself an object, so the pattern breaks on the real shape - found by injecting both key orders and watching one pass: `changes.js#toOp` discards it and the server re-derives the inverse from its own pre-state (`server/txn.mjs`), so an entry carrying one is stating something untrue. Both proven by injection; the first also counted against pre-fix HEAD, which it flagged at 8 + 3 - matching the hand count. | a hand-built command in any client module; a `before` key in the builder file; zero builders found (broken-scan floor). | **H6.2 Tier B** (B44), standing |
| **GR17** | **A layer that does not touch the page keeps not touching it, and Input's gesture state stays Input's.** | Two rules in `tools/scan-writers.mjs`. A bare `document.`/`window.` outside `main.js`, `painter.js`, `palette.js`, `labeledit.js` fails - allowed by FILE, not by count, unlike the model rules, because the hazard is a LAYER losing purity rather than a discrete write: `palette.js` building its ninth element is no new risk, `snap.js` building its first is. Reaching an INJECTED element is explicitly fine, which is why `renderer.js` counts as clean despite being built entirely on DOM. The second rule extends the existing `input.mode`/`input.ctx` ban from `tests/` to `app/src/`, since a peer reading gesture state rebuilds the God Object by reference. Calibrated at H6.5: **14 of 18 client modules reach zero DOM globals**, including every unit H6 extracted. | a DOM global in a sealed module; a peer reading `input.mode`/`input.ctx`; zero reaches among the four owners (broken-scan floor). | **H6.5** (B45), standing |
| **GR18** | **An agent drives draw through the TOOL, and the tool can do everything the API can.** Ruled 2026-08-23. Agentic interaction is via `cli/draw.mjs`, not raw HTTP: the CLI is the surface an agent is expected to hold, and it is the precursor to registering draw as an MCP tool -- a shape that cannot exist until one program can perform every operation. The rule is therefore two-sided. An agent that needs an operation the CLI lacks EXTENDS THE CLI rather than reaching past it, and the coverage is mechanically checked so it cannot drift the way it silently did before. The evidence for the rule is behavioural: across the session that built B100 through B117, the agent drove the live estate entirely with `curl` and never once reached for the tool written for it -- and could not have, since the CLI had no authentication and spoke only the IAP-fronted `/api/v1` (**B117**). A tool nobody can use is indistinguishable from one that does not exist. **No fallback.** An agent that cannot do a thing through `draw` EXTENDS `draw`, or HALTS and raises it -- reaching for `curl` is not the third option, because every time it is taken the tool stays exactly as incapable as it was and the gap stops being visible. That is precisely how B117 accumulated: the work got done, so nothing ever reported the tool could not do it. | `tools/scan-cli.mjs`: every REST route the server answers has a CLI verb that reaches it, or a recorded exemption with a reason. The route inventory is derived from `server/rest.js` rather than restated, so a new endpoint fails the gate until the tool can drive it. | a route the CLI cannot reach; an exemption without a reason; a CLI verb naming a route that no longer exists. | standing |

**All thirteen are standing.**\
Each runs on every push from its attachment milestone for the life of the repo.\
Two carry a closing condition rather than a closing date: **GR7**'s `diagrams.bak` retention ends when CS6's gate is green (the test itself stays), and **GR5** counts post-freeze - its two reference implementations are frozen into `tests/fixtures/` in the same commits that remove the originals `[V, server/store.js:65-99 and app/src/commands.js:24-32 are the two frozen subjects]`, so the oracle outlives its subject.\
**CS6's arc-close gate re-asserts all thirteen.**\
A guardrail that stops running when its milestone closes was a checklist item, not a guardrail.

---

## 6. Non-goals [LOCKED]

Not deferred work unless a backlog row names a revival trigger.

| # | Not built | Why, and what the boundary actually is |
|---|---|---|
| **N1** | **Multi-instance coordination** | One log, one cursor, one in-process `Hub` (`server/hub.js:13` is a `Set`) and one in-process `Locks` map (`server/locks.js:19`) `[V]`. Single-instance. No leader election, no distributed lock, no cross-instance fanout. Deviation **X3** (Cloud Run revision overlap) is recorded, not waved off. |
| **N2** | **Conflict-resolution UX** | No OT, no CRDT, no merge, no three-way diff. `expect` returns 409 and the caller re-reads. Two browser tabs are not arbitrated today either - ws `apply` acks `{rev}` and broadcasts nothing (`server/protocol.js:112-119` `[V]`), so today they diverge and the last to reconnect-`push` wins. The change broadcast makes them **converge for the first time**. What is genuinely new is that tab A's Ctrl+Z can reverse tab B's last gesture - accepted under D2 with all four mitigations. |
| **N3** | **A GCS storage adapter** | Not written. What is guaranteed is that it stays **possible**: exactly one file written per transaction, ever. The seam is `server/docfile.mjs` (D18) plus `new Store(dataDir, {flushMs, writeDoc, now})` (**GR4**) - both at CS1, as guardrails, not with the adapter. The gcsfuse claims (rename = copy+delete on flat buckets, atomic on HNS, no cheap append) are `[A]` external knowledge and **must be confirmed against a real bucket before anyone relies on them** (**B6**). |
| **N4** | **IAP / SSO / authentication / authorization** | No identity beyond `by:'client'\|'server'` and the opaque `actor` minted at CS1 from the hub session id or the lock token. `actor` is where a principal goes when IAP lands; nothing else changes. `actor` is **not** an identity claim and must not be rendered as one. |
| **N5** | **Machine-crash durability** | **There is no `fsync` or `fdatasync` anywhere in the server** `[V, exhaustive grep: 0 hits across server/, document/, engine/, kernel/, app/, cli/]`. The guarantee, in the wording that must reach `SCOPE.md` and the README: **undo survives a *process* restart; a machine-level kill can lose the last 200 ms of ws work - doc and log together, consistent, never corrupt.** An acked REST write is on disk (`server/rest.js:54` flushes before acking `[V]`); an acked ws write is accepted and ordered, and lands within 200 ms (D13, **X2**). |
| **N6** | **Selective / per-actor undo** | Ruled out permanently in D2, not deferred. Reversing change #7 while #8 and #9 stand requires rebasing inverses over intervening changes - unsound without OT/CRDT, and it produces a document state that never existed. |
| **N7** | **Preview as a render overlay** | `app/src/input.js:769-773` keeps writing into the shared Model once per pointer-move frame `[V]`. Moving it out duplicates the geometry pipeline (link routes `app/src/renderer.js:135-141`, group hulls `:145-149`, span-aware select boxes, `via` routes, plus `dataview`/`readout`). Separate arc - **B7**. |
| **N8** | **Server-side change compaction** | Adjacent same-entity `set` records are not merged in the log. D11's client-side pre-commit window makes it unnecessary - log granularity equals undo granularity 1:1. |
| **N9** | **A content fingerprint beside `version`** | Ruled in D25. Its one real job (*did anything change?*) is done better and for free by the planner's narrowing, which also names the field (I6, `changed:false`). |
| **N10** | **A `catchup` middle reply on `resume`** | Ruled in D24. `resume` answers `sync` or `snapshot` (plus the `{rewound}` case). Not built, and no revival trigger - revisit only if a measured snapshot cost appears. |
| **N11** | **Selection is not inverted** | `Model.del` reconciles the deleted id out of the selection (`model/model.mjs:88`); the inverse `put` does not restore it `[V]`. Undo brings the entity back **unselected**. Documented, not fixed - putting selection in the log would make Ctrl+Z undo a click. |
| **N12** | **A durable accountability record beyond the ring** | Attribution exists **inside** the 100-record / 32 KiB ring and nowhere else: every Change carries `by` and `actor` (D20), `GET .../history` exposes both, and eviction is itself reported (`evicted`, `truncated: evicted > 0`, I14). Beyond that depth the system keeps **no durable record of who changed what**. There is no separate accountability trail and none is built (D23): `flush()` rewrites the entire document on every debounce tick (`server/store.js:319` `[V]`), so an unbounded trail costs the ~39.7 KB file ceiling D1 traded for. D2's authority answer is scoped to match - it claims attribution only where the ring holds it. **Revival trigger: backlog row B9.** |

---
