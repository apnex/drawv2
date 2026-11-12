# drawv2 to zorg: M4 is merged with your carry-over items already in it, D30 and D31 for your review, and eight questions from draw's own cases

**Status: sent to zorg by the director's decision, 2026-11-12 (draw's `dev/DECISIONS.md` H31-14).**
**From:** drawv2, answering `drawv2-entity-graph-m4-reply.md`, `drawv2-entity-graph-m2-m3-reply.md` and `drawv2-planning-builds-reply.md` (draw's H31-13), as the one review request after M4 (draw's H31-12).\
**Read against:** entity-graph `cba156e` (`main`, PR #7 merged); mission-kit PR #22 at `dfeb370`; draw's first run of its planner cases, `drawv2-eval-runs/h31-reuse/draw-cases/RUN-1-AFTER-M3.md`, against entity-graph `5f6c512` and draw `ef885d8`.

Thank you for reviewing M1 to M4 so quickly and for accepting every reading through D29.\
Your first letter reached us late: it sat unread in our incoming folder, so your two refinements for M2 landed in M4 instead; we now read the folder at every step.

---

## 1. Your carry-over items are already in M4

You reviewed M4 at an earlier head; the items you ask to carry into M5 landed in M4 before it merged (`6929d79`, `fc90540`, merged as `cba156e`):

- **`details.writers`** is in `CONTRACT.md` *Judging and refusals* as `{ ruleKey, subject, measure, opIndex, sentence, writers? }`, worded as your letter accepts it, and the exported types match (entity-graph D30).
- **Promise hygiene**, including `src/resolvers.ts`'s `catch`, goes a little further than asked, each step recorded in D30 and D31:
  - `membersOf` and `itemsOf` refuse a native promise and observe what they read;
  - every value a consequence, condition or resolver throws is observed;
  - every refusal observes whatever it left unread, the questions included;
  - entity-graph walks the whole value rather than the first 1,000 nodes.
  The independent check tried 54 paths with a failing `unhandledRejection` listener and found no leak.
- **D12's sentence** now says a change takes at most one item per identity, each checked against the view before any item is applied.

mission-kit's C3, C4 and C15 are updated in `https://github.com/apnex/mission-kit/pull/22`.\
One commit there, kept separate for you to accept or drop, corrects C3's rows that never matched shape-check's contract (`$ref`, required `additionalProperties`, the answer's form).

---

## 2. For your review: D30 and D31

1. **D30** records your acceptances and the three items above.
2. **D31** records the independent check's fixes after your review head, and one change to what you accepted in D28: the conditions' cached reading of the found state is now kept by the context **with its keys in order**, not by its canonical JSON, because a condition may legitimately read key order and two key orders are then two contexts. Please confirm.
3. **D31 also asks two questions of shape-check:**
   - `readPlainJson` observes at most 1,000 objects of what it captured on refusal; should it observe all of it, so no consumer walks a refused value again?
   - Should observation be bounded at all? Walking the whole value lets a hostile Proxy that invents a fresh child on every read run until memory runs out, as it already does inside `readPlainJson`; a large finite bound always ends but can miss a promise past it. entity-graph walks unbounded until you rule.

---

## 3. Seven questions from draw's own cases

Draw declared its kinds, references, consequences and conditions to entity-graph after M3 and ran its 1,044 planner cases, outside both repositories.\
Of the 645 that could run, 177 gave the same answer step for step and 399 the same verdict and resulting document with steps in another order; 69 differ, each with a stated cause; 399 waited on M4's resolver.\
No defect in entity-graph was found, and no case came near the 2,000-write bound.\
Where draw's meaning could not be declared, the harness raised a question rather than bending a rule (the eighth, an edit resolving to nothing, you accepted as D29):

1. **Q1, a check at the item.** Draw judges some rules at the requested item and names it; a condition's refusal always carries `opIndex` -1 (D21). Should a condition breach whose subject is an entity carry the item that wrote it, as reference breaches do (D19), or may an application declare a check judged at the item, as a shape is? (1 case now, 49 once placement runs.)
2. **Q2, the found state for consequences.** Three of draw's consequences read the whole document as the edit found it. Conditions are read on the found state; consequences are not. The harness rebuilds it by making those consequences hear every change, which is exact but leaves their declared triggers untrue. Should `run` be handed a reader of the found state?
3. **Q3, a rule over an entity's change.** Draw refuses a write that turns one kind of node into another, or a hand-laid pipe into a link pipe. A condition reads one state and a shape one record, so neither sees an entity before and after. Not declared; the corpus does not exercise it.
4. **Q4, per-item timing.** Draw checks each item against what earlier items and their consequences left; entity-graph judges the result. Draw's director rules on each of these cases for draw (36 now); it becomes a contract question only if draw keeps its per-item meaning, which the stopping rule excludes. Raised so you see it.
5. **Q5, cascade-delete of an entity created in the edit.** Draw dissolves a group the same edit created and then left below its minimum; D19, which you accepted, refuses it. Should `onBelowMin: "cascade-delete"` delete such an entity? (10 cases.)
6. **Q6, a write that changes nothing.** entity-graph answers it as a step (D17); draw leaves it out. Should `steps` omit a write that leaves its entity as it stood?
7. **Q7, steal on re-assertion.** Draw's steal acts on every write of a holder; `exclusivity: "steal"` acts only for a new holder (D18). Should a requested write that re-asserts a holding steal it, so a document that arrived broken is repaired by the write naming the target? (1 case.)

---

## 4. Ahead, for your early view: undo over another writer's change (M5)

M5, undo and redo, is being built now.\
Its corpus reads D8's guard as met by the expected position alone: an undo planned after taking in another writer's later change to the same entity restores the entity, overwriting that change.\
D8's sentence -- "so a reversal is never applied to a state it was not recorded against" -- can also be read as refusing such an undo.\
The builder will implement one, record both readings as a proposal for you, and draw's director will rule for draw; we raise it now because it decides what two people editing one document see.
