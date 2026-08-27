# draw - Commit System

> **Status: design RATIFIED - implementation GATED at CS1.** Every ruling below is **[LOCKED]** per
> `HIERARCHY.md`'s graduation convention: settled, and changed only by a dated amendment in this file.
> The reasoning that produced each ruling is preserved separately in `docs/spec/COMMIT-AUDIT.md`. This
> file states only what will be built.
>
> **Nothing here is built.** `npm run gate` (**GR1**) must exist and be enforced by an installed
> `.git/hooks/pre-push` before the first line of **CS1**, and no milestone starts before its named gate is green.
>
> **Evidence markers.** `[V]` verified by reading the cited `file:line` - `[I]` inferred - `[A]` assumption.
> No deletion **row** may be justified by an unmarked claim - mechanized as **GR2**, which polices section 7's
> tables and `COMMIT-DELETIONS.md`, where a row *is* the authorisation to remove something. Prose
> elsewhere may discuss a deletion without authorising one.
> All measurements are against the tree at `67d229d`.

---

## Contents

| section| Section | What is settled there |
|---|---|---|
| 1 | Purpose and scope | what this governs, and what it does not |
| 2 | Target architecture | the one write function, the op vocabulary, Request/Change/Log, the commit contract, the callers |
| 3 | Decisions | D1-D30, each with its consequence |
| 4 | Correctness invariants | I1-I16, each with the milestone and the test that pins it |
| 5 | Mechanized guardrails | GR1-GR13, and the rule governing when each attaches |
| 6 | The milestone sequence | CS1 -> CS6, entry conditions, verification gates, test ledger |
| 7 | What is deleted | the deletion tables, the deletion-consequence contract, three demonstrated traces |
| 8 | Non-goals | N1-N12 |
| 9 | Recorded deviations | X1-X5 |
| 10 | Backlog seed | B1-B9, `docs/BACKLOG.md` at CS1 |

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
The stated deployment is a single-instance Cloud Run that scales to zero; an in-memory log means "an agent wrote, the instance recycled, Ctrl+Z is gone" - retiring the headline feature in the exact deployment it is for.\
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
Today's builders dodge this by fabricating the default (`app/src/input.js:1333-1334`, `app/src/input.js:521`, `app/src/commands.js:197` `[V]`); a mechanical projection cannot.\
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
Mandatory `expect` would break trivial `curl` one-liners for no gain - forward writes are additive, attributable, arbitrated by the lock, and each names its target in the URL.\
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
| **GR1** | Promotion to trunk is gated by a deterministic proof, not a habit. | `npm run gate` = `node --test tests/*.test.js` **+** `node tools/scan-claims.mjs docs/spec/COMMIT.md#7 docs/spec/COMMIT-DELETIONS.md` (GR2) **+** `test -f docs/spec/COMMIT.md` **+** `test -f docs/BACKLOG.md`; from the end of CS1's first commit it also runs `node tools/scan-writers.mjs` (GR3). `npm run gate:install` writes `.git/hooks/pre-push`; `tests/gate.test.js` asserts that hook exists and is executable. | any failing test; any scanner hit; a missing `COMMIT.md`/`BACKLOG.md`; an uninstalled hook. Today `package.json` scripts are `start` and `test` only, there is no CI directory, and `.git/hooks` holds `.sample` files only `[V]` - **so every other guardrail here is advisory until GR1 lands.** | **before CS1** |
| **GR2** | No deletion is justified by an unmarked claim. | `tools/scan-claims.mjs`, over exactly two scopes: **section 7 of this file** and **all of `docs/spec/COMMIT-DELETIONS.md`**. The unit is a **deletion-table row**: every data row whose first cell names a symbol or path (contains a backtick) is a deletion by construction, so every such row must carry a `[V]`/`[I]`/`[A]` marker, and a `[V]` must be accompanied by a `path:line` token or an explicit `measured`/`exhaustive`/`counted` form. A scoped scan matching **zero** rows fails loudly rather than reporting a vacuous pass. | any deletion row without evidence; a scope that matches nothing (the section moved or was renamed). The rest of `docs/spec/` is deliberately out of scope - those files predate the rule. | CS1, standing |
| **GR3** | I2 as an executable scan, extended to `.load(`. | `tools/scan-writers.mjs` over `server/**/*.{js,mjs}` **and** `document/**/*.mjs` - the scan root must be able to see the allow-list it names, and the allow-listed site lives in `model/ops.mjs`, outside `server/`. Fail on `/model\.(put\|set\|del)\s*\(/` outside that single site (`model/ops.mjs#applyOps`), **and** on `/model\.load\s*\(/` outside `Store.install` - `install()`'s whole-document write bypasses `applyOps` entirely. **`Store.adopt` is NOT allow-listed: it is folded into `install()` at CS1**, and so is `loadInto`. Plus a runtime assertion inside `install()` that the entry's `Log` is replaced in the same call. The allow-list is a data file and is the durable record of any future exception. | any second writer. The property holds today - server-side `model.put/set/del` exists only at `server/store.js:104-106`, and `model.load(` only at `:156` (`adopt`) and `:226` (`loadInto`) `[V, exhaustive grep]`, both folded into `install()` in CS1's own commit - so the scan is trivial then and forensic later. | **end of CS1's first commit**, standing |
| **GR4** | Crash, race and durability tests are runnable **at all**. | `new Store(dataDir, { flushMs, writeDoc, now })`, with `writeDoc(file, text)` wrapping `server/store.js:319-320`. | today `FLUSH_MS` is a module const (`server/store.js:16`), `fs` is a direct import, and the constructor takes one argument (`:111`) `[V]` - so **I9, I10, I12-across-restart and GR6 fault (iii) are unwritable by construction**. Precedents to author from: `new Locks({ttlMs, now})` (`tests/locks.test.js:41` `[V]`) and the injectable Slides transport (`server/slides/sync.js:6`; faults at `tests/slides.test.js:265`, `:277`, `:291` `[V]`). Same seam N3 wants for GCS. | CS1 |
| **GR5** | A deleted reference implementation is replaced only against a green differential. | `tests/diff-plan.test.js`: seeded-random doc + >=1000 random single-op mutations; assert the new `plan()`'s op list == `planMutation()`'s (`server/store.js:65-99` `[V]`). `tests/diff-inverse.test.js`: the same against the browser inverse builders - and it must cover **all 23 `history.commit(` transaction shapes**, not only the builders: **8 of `app/src/input.js`'s 23 sites build their `entries` inline and never touch a builder** (`:519, :546, :651, :876, :907, :972, :1321, :1352` `[V, counted`]), so a builder-only oracle covers ~15 of 23 and misses the link-`closed` toggle, star/chain, route creation, node-type re-hand, link-endpoint re-attach and both resize paths. **The reference implementation is frozen into `tests/fixtures/` in the same commit that deletes it** (`tests/fixtures/` already exists `[V]`), so the oracle outlives the deletion. | any divergence on any seed; and any commit that removes the old code without its differential test green in that same commit. The opportunity is destroyed permanently once the old code is gone. | CS1 (planner) / CS3 (inverses), standing post-freeze |
| **GR6** | Two viewers and the store agree at quiescence, under injected faults. | `tests/convergence.test.js`: two ws clients + one REST writer on one diagram; **seeded, deterministic** interleaving of >=200 mixed transactions including `del node` with attached links, group member-steal, `del waypoint` used as a `via`, undo and redo; assert `origin.toJSON()` == `viewer.toJSON()` == `store.get(id).toJSON()`. Three injected faults: (i) drop one `change` to B -> B detects `from > V` and repairs (`from < V` -> **ignore**); (ii) deliver a change while B has `input.mode !== null` **targeting the entity B is dragging** - the ordering race where the version arithmetic still lines up and the gap detector never fires; (iii) B disconnects mid-transaction, reconnects and replays, and no request is silently dropped. | any inequality at quiescence; an unrepaired gap; a silently dropped request. | CS3, standing |
| **GR7** | The user's data is never rewritten by an unproven transform, and the backup outlives the arc. | `tools/migrate-version.mjs`, **committed** - the five-step procedure is specified at section 6, CS5. `tests/migration.test.js` runs it over old-shape fixtures. | a live server on the port; a count mismatch; any entity-level difference - a count-only assertion passes a `jq` typo that mangles every coordinate. | CS5; **`diagrams.bak` retained until CS6 closes** |
| **GR8** | The store never fabricates success - pins **I15**, implements **D17**. | `Store.init` tracks a `failed` count across the load loop (`server/store.js:120-141` `[V]`) and seeds at `:142` only when `failed === 0`; otherwise it logs every per-file rejection reason and exits non-zero. ~4 lines. | a data dir where candidates were present and none loaded. Free today: `tests/server.test.js:601-616` keeps one good file among three, so `size === 1` and it still passes `[V]`. | CS1, standing |
| **GR9** | `version` and `seq` monotonic across restarts - pins **I12**. | `Log.toJSON()` emits `version`; `Log.from(json, fallback = 0)` reads it back; a runtime post-condition inside `flush()` asserts **`log.records.every(r => r.seq <= log.version)`** from CS1 (the two watermarks deliberately diverge on undo per **D3**, so equality would be false after the first undo and would throw on an empty log), together with an append-time assertion that **`change.seq === log.version`**, and additionally **`meta.version === log.version`** from CS5 - it therefore fires on every existing test and every new one. CS5's migration seeds `meta.version` from the persisted `log.version`. | any restart that re-mints a live `seq`; any path that moves one watermark without the other. | assertion CS1, load-bearing CS2, extended CS5 |
| **GR10** | `docs/spec/SCOPE.md` never asserts the opposite of the running wire for longer than one milestone. | Each milestone amends the lines it falsifies **in the same commit**, in the file's existing dated-amendment form (section 6.2). `tests/spec.test.js` asserts (a) a dated amendment exists against each reversed locked decision - `SCOPE.md:149-150`, `:210-211`, `:217`, `:223-224`, `:225` `[V]` - and (b) no `push`/`apply`/`rev` wire token survives in `SCOPE.md` after CS5 (`:113`, `:135`, `:136` `[V]`). | a milestone that ships without its amendment. | CS1 / CS3 / CS4 / CS5 / CS6 |
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

## 6. The milestone sequence - CS1 -> CS6

### 6.1 Reversibility

Two axes, tracked separately: **green-and-stoppable** (the tree is green and the product works) and **revertible** (the change can be backed out).

CS1-CS4 are code-revertible: no user file changes shape, and the CS2 `log` key is ignored by any pre-CS2 binary `[V, server/validate.js:159-221 has no top-level unknown-key loop; model/model.mjs:259-276 reads only KEY[kind], meta, selection]`.\
**CS5 is forward-only.**\
CS6 is code-revertible.

### 6.2 `SCOPE.md` amendments

Three locked `SCOPE.md` decisions are reversed by this arc, plus the wire and schema sections.\
Each is amended **in the milestone that breaks it**, in the file's existing dated-amendment form (10 such blocks already exist `[V, SCOPE.md:17, :28, :33, :40, :44, :48, :52, :59, :74, :215]`).\
Pinned by **GR10**.

| lines | locked text | amended at | becomes |
|---|---|---|---|
| `SCOPE.md:17-25` (decision 1) | center-origin migration of legacy top-left docs | **CS1** | dated amendment retiring the migration, preserving the (-930, -510) transform and the clamp rule verbatim |
| `SCOPE.md:210-211` | *"Undo/redo: client-side command stack"* | **CS3** | server-side per-diagram log + cursor; the browser holds two booleans and a label |
| `SCOPE.md:149-150`, `:223-224` | *"Server never pushes model changes except snapshot-on-request and acks"* / *"server->client pushes beyond hydrate/ack"* out of scope | **CS3** | the server broadcasts one `change` per accepted transaction, origin excluded |
| `SCOPE.md:135` | ws `apply` -> `ack{rev}` | **CS3** (verb), **CS5** (`rev`) | `commit`/`undo`/`redo` -> `ack{version, ...}` |
| `SCOPE.md:136`, `:146-148` | `push` full-document resync, client-authoritative | **CS4** | `resume {diagram, version}` -> `sync` \| `snapshot` \| `snapshot{rewound}`; `create {name, doc}` for adopt-local-content |
| `SCOPE.md:113` | `"rev": 12` in the entity JSON | **CS5** | `"version": 12`, `"schema": 1`; `grid` gone |
| `SCOPE.md:152-161` | REST section | **CS5** | records deviation **X1**: `/api/v1` is redefined **in place** |
| `SCOPE.md:217`, `:225` | *"Still strictly read-only - it adds no mutation path"* / *"a \*write\*/mutation CLI"* out of scope | **CS6** | `draw undo` / `draw redo` are write verbs - answered deliberately, or the exclusion stands and they are not built. `draw history` at CS3 needs no amendment: it is a read. |

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
| 2 | This document is committed as `docs/spec/COMMIT.md`, rulings `[LOCKED]` per `HIERARCHY.md:8-9`. |
| 3 | `docs/spec/COMMIT-DELETIONS.md` is committed - one row per deleted symbol in section 7.1-7.3, per the section 7.4 contract. |
| 4 | `docs/BACKLOG.md` exists, seeded with B1-B9 (section 10), each row carrying evidence and either a closing milestone or a revival trigger. |
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
| `server/rest.js` | a per-diagram `flushFailures` counter surfaced in `GET /health` (already returns `{status, diagrams}`, `server/rest.js:79-81` `[V]`) and in `draw status`. A non-zero counter files a row in `docs/BACKLOG.md` - the retry alone repairs the mechanism and leaves the failure unobservable. |

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
| 8 | `SCOPE.md:136`, `:146-148` amended in the same commit (**GR10**). |

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
| 4 | `SCOPE.md:217`, `:225` amended - or the write-CLI question is answered *no* and the exclusion stands (**GR10**); the durability wording carried into `SCOPE.md` and the README. |
| 5 | **`diagrams.bak` may be deleted only after this gate is green** `[V, X4 / GR7 - it is the only copy of 17 untracked files, .gitignore:4]`. |
| 6 | **GR11 still green end-to-end**: D14's blind-reversal refusal and D22's reclaim hold, both live since CS3, plus D21's bulk reversal shipped here. |
| 7 | **Arc close**: every `docs/BACKLOG.md` row is closed by its named milestone or carries a live revival trigger, and **all thirteen guardrails** (GR1-GR13) run green as standing regressions. |

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

## 7. What is deleted

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
| `case 'meta'` - **inherits Trace 1's condition verbatim [LOCKED]** | `server/protocol.js:135-142` | **CS1 gate #7 (D19: the server-side binding writer) is a hard entry condition for this deletion.** Trace 1 makes `app/src/sync.js:264-268` conditional; `{op:'meta'}` is `{name?, slides:{url?}}` - config only (section 2.2, D15) - so deleting this case unconditionally would make the kept client row send a message no case handles and no op replaces, losing the binding by the exact mechanism Trace 1 exists to prevent `[V, docs/spec/COMMIT.md section 2.2 vs section 7.1]`. -> `{op:'meta'}` inside a request `[V, server/protocol.js:135-142; producers app/src/sync.js:127, :251, :258, :267]`. The rename path (`:251`) becomes an undoable config write under D15. | CS3 |
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

**CS1 produces `docs/spec/COMMIT-DELETIONS.md` before implementation begins.**\
It carries one row per deleted symbol in section 7.1-7.3 and interrogates each removal as hard as an addition: what else touches the symbol, what capability disappears the moment the row lands, what restores that capability, and - where nothing does - the backlog row and revival trigger that admit the loss.\
A deletion table is the side that ships silently; the contract is what makes it audible.\
**GR2** runs over the file, and it is re-checked at each milestone close for the rows landing in it.

Four columns, no blanks:

| Column | Requirement |
|---|---|
| **(a) Readers / writers** | Every other site that reads or writes the symbol, `[V, grep]`, with `file:line`. An exhaustive grep, not a sample. A symbol with zero other sites states `[V, exhaustive grep: no other reference]`. |
| **(b) Capability lost** | What a user or an agent can do today and cannot do the moment the row lands. "Nothing" is legal only when (a) is empty. |
| **(c) Restored by** | The invariant, guardrail, or milestone that restores it, named - `I4`, `GR7`, `CS3`, not "the planner". |
| **(d) Not restored** | If (b) is non-empty and (c) is empty: an explicit row in `docs/BACKLOG.md` with a revival trigger. Silence is a gate failure. |

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

## 8. Non-goals [LOCKED]

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

## 9. Recorded deviations [LOCKED]

Departures from a stated rule, knowingly accepted.\
Each is recorded here **and** in `docs/spec/SCOPE.md` in that file's existing dated-amendment form - not left to pass silently.

| # | Deviation | Rule departed from | Trigger / condition |
|---|---|---|---|
| **X1** | **`/api/v1` is redefined in place. The record lands at CS3 for the route rename and at CS5 for `rev`->`version` - two surfaces, two milestones, not one.** `POST .../apply` -> `.../commit`; `meta.rev` -> `meta.version`. Out-of-repo consumers detect only a 404: `cli/draw.sh:78, :176, :213, :236, :255, :273`; `README.md:134-137, :147-155`; `docs/spec/SCOPE.md:154-156` `[V]`. | A versioned API surface is additive within its version. | **Accepted** for a single-tenant tool with a bundled CLI. **Condition:** recorded in `SCOPE.md`'s REST section in the same commit that changes the surface (CS5). **Revival trigger: any out-of-repo or third-party consumer of `/api/v1`** - the next change then goes to `/api/v2`. |
| **X2** | **No `fsync`.** Durability is asserted at process granularity only. | "Undo survives a restart" reads as machine-crash durability; the code makes no such claim `[V, exhaustive grep: 0 fsync/fdatasync]`. | **Accepted.** **Condition:** the guarantee is carried into `SCOPE.md` and the README in exactly N5's wording; CS2's gate says "process restart", never "restart". Backlog **B6** carries the revival trigger. |
| **X3** | **Cloud Run revision overlap.** Two processes over one mount during a deploy, each running `flushAll()` on SIGTERM (`server/server.js:32-37` -> `server/store.js:327-333` `[V]`), last writer taking the whole file - **including the other's log and its inverses**. | Single-writer ownership assumes one process. | **Accepted.** Rests on `[A]` external Cloud Run drain behaviour; the deployment is scoped single-instance, so it is not load-bearing today. **Revival trigger: min-instances > 1, any revision-overlap deploy setting, or any shared-mount deployment.** The remedy if triggered is a data-dir advisory owner file written at boot, not coordination. |
| **X4** | **The CS5 schema migration rewrites 17 untracked user files.** | Nothing before CS5 is code-revertible past this point. | **CLOSED 2026-08-18** - the gate ran green (286/286), all 17 files were verified identical to the backup entity-by-entity, and `diagrams.bak` was released on the owner's instruction. The arc is now irreversible in fact, not only in principle. Original terms, all met: **Approved as a named gate**, on these terms and no others: the committed `tools/migrate-version.mjs` with the five-step procedure at section 6 CS5 - health-port interlock, the store's own filename regex, dry-run-and-verify into a temp copy with per-id deep-equality, swap only then, and **never delete `diagrams.bak` - retained until CS6 closes** - plus `tests/migration.test.js` over old-shape fixtures. |
| **X5** | **Three locked `SCOPE.md` decisions are reversed.** Undo moves server-side (`SCOPE.md:210-211`); the server pushes model changes to browsers (`:223-224`); the CLI gains write verbs (`:217`, `:225` - admitted 2026-06-13 only on the condition that it *"adds no mutation path"*) `[V]`. | `SCOPE.md` decisions are locked. | **Approved:** amended deliberately, each in the milestone that breaks it, with a dated amendment in the same commit - never a milestone later. **CS3** -> `:149-150`, `:210-211`, `:223-224`. **CS6** -> `:217`, `:225`, or the write-CLI question is answered *no* and the exclusion stands. Pinned by **GR10**. Note two of the three lines are **not** in the wire section `[V]` - the amendment targets the lines, not the section. |
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

---

## 10. Backlog seed - `docs/BACKLOG.md` at CS1 [LOCKED]

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