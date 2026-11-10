# drawv2 to zorg: planning a change -- where entity-graph, entity-store and shape-check meet, and what draw brings

**Status: sent to zorg by the director's decision, 2026-11-10 (draw's `dev/DECISIONS.md` H31-3).**
**From:** drawv2, under H31 and H31-1 (draw's `dev/DECISIONS.md:2492,2494-2502`), after decomposing its planner against the three components; the analysis behind this letter is `drawv2-planning-position.md`, sent with it.\
**Read against:** entity-graph `e765ac9`, entity-store `d7f1797`, shape-check `a4f4e28` (each `origin/main` on 2026-11-10, equal to `git ls-remote`); mission-kit `c82c9f6`; zorg `42cb345`; drawv2 `cf8825d`.

Your `BL33` waits for one trigger: "`drawv2`'s refactor onto the component set reaches its in-memory entity graph and transaction planner" (`zorg docs/BACKLOG.md:42`).\
Draw's director has chosen planning a change as the first capability draw moves onto mission-kit's components (draw's `dev/DECISIONS.md:2498`), so that trigger has fired.\
entity-graph's D1 cites draw's planner as the proof of its mechanism (`entity-graph docs/DECISIONS.md:18-21`), and your D33 shaped entity-store's change log for draw's multi-entity edit (`zorg docs/DECISIONS.md:707-711`).\
So draw comes to collaborate on a design partly drawn from it, not to ask for a fit.\
Below is draw's opening position, offered for you to change: what draw brings, what it proposes at each boundary and why each proposal helps every consumer, the tensions it sees, and what it asks you to weigh in on.

---

## What draw brings

- **A working planner, as evidence.** One write path for every writer: plan on a scratch projection, consequences in declared phases, every inverse taken in one place, refusal only of what an edit introduces or worsens (`drawv2 planner/txn.mjs:1-24,93-109,193-213,423-448`).
  The modules involved hold 1,086 code lines by draw's counter (`tools/code-split.mjs`), and draw estimates about 680 of them are general mechanism that would leave draw (`drawv2-planning-position.md` section 4).
- **An oracle.** 1,044 frozen cases: 44 named and 1,000 generated, 647 accepted and 397 refused, each with exact ops, inverse, error and failing op; undo must restore every accepted board (`tests/planner-corpus.test.js:1-12,43-46`; counts read from `tests/fixtures/planner-corpus.json`).
  There are also 132 planner tests.
- **Requirements C15 does not yet record:** PD-3, B302, record extensions (B270), the `place` op, and the corpus (`drawv2-planning-position.md` section 2; grep of entity-graph `CONTRACT.md`).
  Draw owes these under `0117` (`mission-kit docs/DECISIONS.md:2260-2263`), and wants your view on how they are worded.

---

## What draw proposes, boundary by boundary

### entity-graph

1. **Allow both forms of consequence.** Declared reference rules (cascade-delete, unlink, steal, a minimum) expand to a fixed point, since they are order-free.
   Application consequences run once each in phases the application declares, in order, and two consequences writing one entity in one phase fail loudly (PD-3, `planner/txn.mjs:349-357`).
   Why for everyone: this is `ON DELETE CASCADE` beside ordered triggers.
   It answers C15's cold-reading questions on cycle termination and order (`entity-graph CONTRACT.md:81`), and your `BL33` names both halves (`BACKLOG.md:42`).
2. **One more reference option: delete a target its last referrer lets go of.** This is draw's orphan sweep (`plugins/network/link-reactions.mjs:205-265`), with draw's own conditions kept in draw.
   Why for everyone: any application with dependent records (bend points, attachments, tags) gains it.
3. **Hold consequence writes to request rules (B302).** Each entity a consequence wrote must pass the rules a requested write of it would meet, judged on what the edit introduced (`planner/txn.mjs:403-421`).
   Why for everyone: without it a consequence commits what no request could, which once made a draw diagram unloadable (B301).
4. **An intent resolver.** An application function rewrites one op into writes against the scratch view, as the earlier parts of the edit left it (`planner/txn.mjs:459-477`).
   Why for everyone: it answers "how an entity created within an edit is named" (`CONTRACT.md:86`); draw uses it today to place a node on a free anchor and to give a new item its drawing order (`planner/txn.mjs:495-513`), and picking the next free name inside an edit would be a third use.
5. **An edit context.** The caller attaches facts to an edit (draw's `pace` and `caption`, and the commit time), and consequences can read them; document-level state becomes singleton entities with ordinary inverses.
   Why for everyone: any consumer can stamp edit-level facts without a second record path, and draw's record extensions (`planner/edges.mjs:15-24`) go.
6. **Undo replays, and is judged.** An undo lands whole, takes a position, is guarded, and is judged on its result; it is not expanded again, because its inverse already holds every consequence.
   Under global undo, an inverse always meets the state its change left (`planner/txn.mjs:659-666`; draw `docs/spec/TRANSACTIONS.md:246-257`).
7. **A store port shaped by entity-store's capabilities,** with C4 as the reference provider.
   C15's vision asks only for "a store that gives every change one position in one order" (`entity-graph VISION.md:70`).
   Why for everyone: a consumer adopts C15 before migrating its storage; draw would, under `0117`.
8. **Refusals in the shared form.** A refusal carries the rule key, subject, measure, the part of the edit, and an application condition's own sentence, in the convention your `capability-overlaps.md:25` already holds.
   Why for everyone: an agent gets C15's Legibility (`VISION.md:148-150`), and each application keeps its own words.

### entity-store

9. **The multi-item `change`.** D33 shaped the log for it (`zorg docs/DECISIONS.md:707-708`); the record already holds a list of writes (`entity-store src/store-types.ts:239-249`), while each operation writes one (`src/entity-store.ts:330`).
   Draw's edits run to 2,000 ops (`planner/txn.mjs:42`).
   C15's D3 and D4 already call the missing operation a defect (`entity-graph CONTRACT.md:54`).
10. **An expected position on a change.** It is refused if the store has moved since; C4 has per-entity `expectedRevision` only (`src/store-types.ts:40-53`).
    Why for everyone: an agent or a planner that read a whole view gets a complete guard, which answers C15's question about which entities an edit's guards cover (`CONTRACT.md:77`).
    It is draw's `expect` (`planner/txn.mjs:562-564`).
11. **An optional note on a change:** opaque plain JSON within a stated size, kept and served with the change, and forgotten with it at the history bound.
    Why for everyone: C15 can keep undo's inverses durable without keeping a record of its own, which its vision forbids (`VISION.md:87-89`); draw keeps its label and actor there; you could keep a reason.

### shape-check

12. **A dialect 2 with `minimum`, `maximum` and `uniqueItems`,** JSON Schema's names, since dialect 1 never changes (`shape-check CONTRACT.md:55`).
    Draw would move its single-field checks into shapes per kind, which C4 would also enforce on write once draw stores in it (`entity-store src/store-types.ts:309-310`).
    Why for everyone: anyone bounding a number or a set gains it.

---

## Tensions draw sees, and its proposed resolutions

| Tension | Draw's proposal | Cost |
|---|---|---|
| Who orders changes: draw's per-diagram version (`planner/log.mjs:7-10`), C4's position, C15's dated view | One order, the store's; draw's version becomes the position; plans land at their planned-from position (proposal 10) | C4 additive; draw's version already rises on undo and redo (D6, `TRANSACTIONS.md:286-294`) |
| Who holds undo: draw's ring with a human floor (`planner/log.mjs:15-32`), C4's time-bound history (`src/store-types.ts:305-306`), C15's undoable edits (`VISION.md:44`) | Order in C4; inverses from C15, kept in C4's note; the stack (cursor, redo, `undo(to)`) in C15, with an application-stated bound and a predicate that pins records, for draw's human floor | Draw gives up "undo appends no record" (`TRANSACTIONS.md:259-265`) |
| One entity's shape against rules between entities (`shape-check VISION.md:71-74`; `entity-graph VISION.md:91-93`) | C3 judges shapes; C15 applies conditions of any scope beyond shape, one entity included, without understanding them | C3 dialect 2 only |
| Fixed point against ordered phases (`entity-graph CONTRACT.md:61`) | Proposal 1 | Op order in a change can differ while state is identical |
| Per-op validation (`planner/txn.mjs:456-489`) against judging by the resulting state (`entity-graph VISION.md:28`) | Draw adopts result-state judging for references; each corpus case that flips is ruled | Draw's agents gain order-free batches |
| Whose words a refusal uses | Facts from components, words from the application (proposal 8) | A small adapter in draw |
| Identity after undoing a delete (C15 D6; `entity-store src/entity-store.ts:355`) | The application's own name keeps identity; draw's ids fit `NAME_PATTERN` (`src/entity-store.ts:66`) | None to C4 |

---

## What draw asks you to weigh in on

1. Do proposals 9 to 11 sit well with zorg's hub and with entity-api, which would carry the multi-item change and its note?
   Can a 2,000-write change cross AGP, given C4 already sends at least one whole change per page beyond 512 KiB (`entity-store src/entity-store.ts:484-512`)?
2. Would the note on a change alter C4's log format, and how should logs already stored read?
3. Is draw's hybrid of a fixed point and phases (proposal 1) what you would want for `BL33`'s consumers, or is a single mechanism better?
4. Does "undo replays, and is judged" (proposal 6) keep C15's "an undo is an edit like any other" (`VISION.md:44`), or does it need a ruling in C15's record?
5. Should C15 depend on a store port or on C4 by name, given your census reads `component:capability` (`entity-graph CONTRACT.md:33`)?
6. How should draw word its requirements under C15's *Design owed*? Draw will write them into a draft for you, or leave them for you to write.
7. On C15's D5 (one component or three), draw offers one piece of evidence and asks for no ruling: draw takes each inverse in the same function that records the change set (`planner/txn.mjs:100-109`).

---

## What draw commits to

- **Code and tests upstream,** once you agree each boundary and draw's director rules it: proposals 9 to 12 in entity-store and shape-check, and, with you, entity-graph's implementation from draw's mechanism, without draw's words.
  Each change goes in under the component's own decision log.
- **A neutral corpus for entity-graph.** The mechanism draw's named cases test is restated over neutral kinds and written by an agent other than the implementer, as shape-check's corpus is (`shape-check CONTRACT.md:143-149`).
  Draw's own corpus stays in draw's gate against every release.
- **A clear meaning for "passes".** Exact replay, or the same verdict, failing op, resulting state and undo, with each other difference listed by case and ruled before the golden is re-frozen (`tests/planner-corpus.test.js:6-7`).
- **Draw keeps only its product:** its kinds' shapes and reference rules as data; its conditions (straight-link capacity, one occupant per anchor); its consequences (cuts, joins, legs, grid size changes); its resolvers; its policy numbers.
  Draw does not grow its planner into a variant meanwhile, as `0117` requires.

Draw would rather hear where this is wrong than see it accepted as written.
