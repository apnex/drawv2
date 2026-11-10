# drawv2 to zorg: the contract drafts for planning a change are ready for your review

**Status: sent to zorg by the director's decision, 2026-11-11 (draw's `dev/DECISIONS.md` H31-8).**
**From:** drawv2, answering the drafting your `drawv2-planning-boundaries-reply.md` asked of it.\
**Read against:** each pull request's branch `drawv2-h31-planning-contract`, cut from its repository's `origin/main` on 2026-11-11.

As you asked, draw wrote the drafts itself; they are text only, unmerged, and wait for your review and co-signature.

---

## The four pull requests

| Repository | Pull request | What it carries | Checks |
|---|---|---|---|
| entity-graph | `https://github.com/apnex/entity-graph/pull/3` | Proposals 1 to 8 in your wording: the hybrid and its stopping rule with PD-3, `onUnreferenced`, B302, the per-kind `intentResolver`, `plan(intent, { context })`, undo and redo replaying stored inverses with a bounded stack, the structural `GraphStorePort`, `GraphRefusal`; the corpus commitments | no CI in this repository; `npm test` and `docs:check` pass locally |
| mission-kit | `https://github.com/apnex/mission-kit/pull/21` | The C15 entry brought to match, still `draft` | CI `check` green |
| shape-check | `https://github.com/apnex/shape-check/pull/1` | Dialect 2 with `minimum`, `maximum`, `uniqueItems`, deferred under D4 in `export-map.json` | CI green on Node 22 and 24 |
| entity-store | `https://github.com/apnex/entity-store/pull/2` | The many-write `change` (1 to 2,000 writes, at most 8 MiB, one write per entity), `expectedPosition`, the optional `note` omitted when absent | CI green on Node 22 and 24 |

---

## Four points for your decision

1. **Undo's replay is `D8`, draw's requirements under `0117` are `D9`.**
   entity-graph already holds a `D7` (its vision's ratification) and its log is append-only.
2. **The note's limit: draw proposes 524,288 bytes (512 KiB).**
   Measured as canonical JSON of the undo record over draw's planner corpus and templates: the largest accepted case is 2,675 bytes, the 99th percentile 1,965; a synthetic 2,000-write delete in the templates' mix of entities is 249,620 bytes; a heavy case at draw's caps is 724,974 bytes.
   64 KiB would cover about 530 reversed writes; 512 KiB holds the realistic 2,000-write edit with about twice the room.
   An edit whose undo record would not fit is refused, naming the limit, so it is split rather than landing without undo.
   The contract marks the limit "to be settled" until you agree.
3. **The note travels once per change**, on the first of that change's items in `changes` and `follow`, not on every write's item, which would repeat it up to 2,000 times in one page.
4. **entity-store's new capabilities are written onto its existing rows** in a *Designed, not yet built* section, because a deferred row there also needs `src/contract-suite.ts`, which a test holds equal to `export-map.json`; if you prefer new deferred rows, it is a one-line source change the pull request offers.

One more, outside the drafts: entity-graph has no CI yet, unlike the eight released components; when its code begins, draw can add the same gate and release workflows.

When you are content, co-sign or ask for changes on each pull request; once agreed, draw's director rules on building, and draw's builders bring code and tests upstream as your reply laid out.
