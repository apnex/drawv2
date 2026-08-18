# draw — backlog

Defects, deferrals and known gaps. Every row carries an evidence citation and either the milestone that
closes it or a **revival trigger**. Explicit deferral is permitted; silence is not.

Seeded at CS1 from `docs/spec/COMMIT.md` §10. Rows B1–B9 were discovered during the commit-system design
and had nowhere else to live — this repo had one commit and no defect register.

At arc close, every row is either closed by its named milestone or carries a live trigger.

| # | Row | Evidence | Closes / Trigger |
|---|---|---|---|
| **B1** | **`POST /groups` admits a node to two groups.** `server/rest.js:38` calls `model.makeGroup(d.members)` directly; `document/model.mjs:206-212` performs no steal; `server/validate.js:150-153` checks member *existence* only. The "at most one group" rule exists **only** in the browser (`app/src/commands.js:157-175`). | `[V, all four sites read]` | **Closed CS1** — the steal rule moves into `plan()` with its own inverse and a multi-group-overlap test. |
| **B2** | **Adopt-local-content destroys a real diagram.** On a snapshot arriving after the user has drawn, the client adopts *whatever diagram the server answered with* and pushes its own content over the top. | `[V, app/src/sync.js:87-107; the push at :107]` | **Closed CS4** — `create {name, doc}` → `install()` with a server-minted id. Gate: "offline drawing lands in a NEW diagram and does not touch the previously-open one". |
| **B3** | **Server rejections are silently dropped; the browser diverges permanently.** A rejection is a bare string that only `console.warn`s; anything sent while the socket is closed is dropped with a `false` return and no queue. | `[V, app/src/sync.js:139; app/src/net.js:64-67]` | **Closed CS3/CS4** — typed `error {code, txnId}` lands **with** the outbox (D28); **I16**. |
| **B4** | **A failed flush reschedules nothing.** `flush`'s catch logs and returns, leaving `entry.dirty = true` while `markDirty` already nulled the timer — recovery waits for the next edit or SIGTERM. On a backend where `renameSync` fails transiently, a session's final transaction **and its inverse** can sit in memory indefinitely. | `[V, server/store.js:322-324 vs :306]` | **Closed CS2** — reschedule inside the catch, **plus** a per-diagram `flushFailures` counter in `GET /health` (`server/rest.js:79-81` `[V]`) and `draw status`. |
| **B5** | **`Store.init` fabricates success.** A file failing `validateDoc` is skipped with a `console.warn` (`server/store.js:125-128`); if the store empties, it reseeds (`:142`); `/health` then answers 200 with a plausible, complete, wrong store, and `Dockerfile:43-44` asserts HTTP 200 only. `diagrams/*.json` is gitignored — the 17 files are untracked. | `[V, server/store.js:120-142; .gitignore:4; 17 files counted]` | **Closed CS1** — D17 / **GR8** / **I15**. Permanently retires the data-disappearance class for every future schema change. |
| **B6** | **No `fsync` anywhere.** `writeFileSync` + `renameSync` without `fsync` can lose the last write on a machine kill. Unchanged by this arc, but "undo survives a restart" will be read as a stronger claim than the code makes. | `[V, exhaustive grep: 0 hits; server/store.js:319-320]` | **Open. REVIVAL TRIGGER: any multi-instance or GCS-backed deployment.** Confirm the `[A]` gcsfuse claims against a real bucket **before** relying on them. Until then N5's wording is the guarantee (**X2**). |
| **B7** | **Preview writes to the shared Model.** `app/src/input.js:769-773` writes into the live model once per pointer-move frame; a remote change landing mid-gesture fights the live preview. Mitigated by D12's defer rule, not fixed. | `[V, app/src/input.js:768-773]` | **Open. REVIVAL TRIGGER: the renderer-overlay arc.** The fix duplicates a geometry pipeline across four files (N7). |
| **B8** | **Eviction is invisible at every surface.** The ring evicts at 100 records / 32 KiB; a bounded, designed loss no actor can perceive is not a bounded loss. | `[V, D23 caps; I14 reporting requirement]` | **Closed CS2/CS3, floor at CS6** — persisted `evicted`; `truncated: evicted > 0` on `history`, `snapshot`, `change`; surfaced in the browser undo affordance (**I14**). |
| **B9** | **The accountability record and the undo ring are the same object.** An undo ring must be bounded, destructive and redo-truncating; an accountability record must not be. D2's authority answer rests on attribution the ring can evict. | `[V, server/store.js:319 — the entire document is rewritten every debounce tick, so a 10k-row trail is ~600 KB per 200 ms]` | **Ruled CS2/CS3** — the ring stays bounded (D23, `[LOCKED]`); attribution is scoped to the ring via `actor`; the absence beyond it is declared as **N12**, and D2's justification no longer leans on attribution that outlives the ring. **The row stays open as N12's revival trigger: any requirement for a durable audit trail — compliance, a multi-tenant deployment, or an incident review needing history older than the ring.** |

## Adding a row

A row is required whenever a deletion removes a capability that nothing restores
(`docs/spec/COMMIT.md` §7.4 column (d)), whenever a design decision defers work, or whenever a defect is
found and not fixed in the same commit. Cite evidence as `[V, file:line]` or `[V, grep]`. If the row is
deferred rather than closed, the trigger must name an observable condition — not "later".
