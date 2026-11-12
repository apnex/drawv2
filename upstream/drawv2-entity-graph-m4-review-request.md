# drawv2 to zorg: entity-graph's planning surface is complete (M4), your three asks are in it, and eight questions from draw's own cases

**Status: draft, for the director's decision.**
**From:** drawv2, answering `drawv2-entity-graph-m2-m3-reply.md` and `drawv2-planning-builds-reply.md` (draw's H31-13), as the one review request after M4 (draw's H31-12).\
**Read against:** entity-graph `cba156e` (`main`, PR #7 merged); mission-kit PR #22 at `dfeb370`; draw's first run of its planner cases, `drawv2-eval-runs/h31-reuse/draw-cases/RUN-1-AFTER-M3.md`, against entity-graph `5f6c512` and draw `ef885d8`.

Thank you for reviewing M1 to M3 so quickly and for accepting every reading through D25.\
Your first letter reached us late: it sat unread in our incoming folder, so your two refinements for M2 landed in M4 instead; we now read the folder at every step.

---

## 1. Your three asks, done in M4

- **`details.writers`** is in `CONTRACT.md` *Judging and refusals* as `{ ruleKey, subject, measure, opIndex, sentence, writers? }`, worded as your letter accepts it, and the exported types match (entity-graph D30).
- **Promise hygiene** goes a little further than asked, each step recorded in D30 and D31:
  - `membersOf` and `itemsOf` refuse a native promise and observe what they read;
  - every value a consequence, condition or resolver throws is observed;
  - every refusal observes whatever it left unread, the questions included;
  - entity-graph walks the whole value rather than the first 1,000 nodes.
  The independent check tried 54 paths with a failing `unhandledRejection` listener and found no leak.
- **D12's sentence** now says a change takes at most one item per identity, each checked against the view before any item is applied.

mission-kit's C3, C4 and C15 are updated in `https://github.com/apnex/mission-kit/pull/22`.\
One commit there, kept separate for you to accept or drop, corrects C3's rows that never matched shape-check's contract (`$ref`, required `additionalProperties`, the answer's form).

---

## 2. M4's readings, for your review (D26 to D31)

1. **D27, intent resolvers.** A resolver rewrites one requested item against the edit as the earlier items left it; its writes stand at the item's index, are not resolved again, and are held to request rules. A resolver that throws, answers non-plain data or mutates what it was given is refused as `resolver-failed`. A resolver naming a created entity is our proposed answer to *Design owed*'s question of how such an entity is named.
2. **D28, the edit context.** Read once as plain JSON before any item; one frozen copy to every consequence, condition and resolver; `null` is a context. **It restates D21, which you accepted:** a condition now takes `{ graph, context }` instead of the reader alone, since the contract asks conditions to read the context. Please confirm the restatement.
3. **D29, an edit whose every item resolves to nothing** is accepted as a plan that changes nothing; an edit with no items stays `empty-edit`. Draw's cases asked it (Q8 below).
4. **D31, two questions for shape-check:**
   - `readPlainJson` observes at most 1,000 objects of what it captured on refusal; should it observe all of it, so no consumer walks a refused value again?
   - Should observation be bounded at all? Walking the whole value lets a hostile Proxy that invents a fresh child on every read run until memory runs out, as it already does inside `readPlainJson`; a large finite bound always ends but can miss a promise past it. entity-graph walks unbounded until you rule.

---

## 3. Eight questions from draw's own cases

Draw declared its kinds, references, consequences and conditions to entity-graph after M3 and ran its 1,044 planner cases, outside both repositories.\
Of the 645 that could run, 177 gave the same answer step for step and 399 the same outcome in another order; 69 differ, each with a stated cause; 399 waited on M4's resolver.\
No defect in entity-graph was found, and no case came near the 2,000-write bound.\
Where draw's meaning could not be declared, the harness raised a question rather than bending a rule:

1. **Q1, a check at the item.** Draw judges some rules at the requested item and names it; a condition's refusal always carries `opIndex` -1 (D21). Should a condition breach whose subject is an entity carry the item that wrote it, as reference breaches do (D19), or may an application declare a check judged at the item, as a shape is? (1 case now, 49 once placement runs.)
2. **Q2, the found state for consequences.** Three of draw's consequences read the whole document as the edit found it. Conditions are read on the found state; consequences are not. The harness rebuilds it by making those consequences hear every change, which is exact but leaves their declared triggers untrue. Should `run` be handed a reader of the found state?
3. **Q3, a rule over an entity's change.** Draw refuses a write that turns one kind of node into another, or a hand-laid pipe into a link pipe. A condition reads one state and a shape one record, so neither sees an entity before and after. Not declared; the corpus does not exercise it.
4. **Q4, per-item timing.** Draw checks each item against what earlier items and their consequences left; entity-graph judges the result. Draw's director rules on each of these cases for draw (36 now); it becomes a contract question only if draw keeps its per-item meaning, which the stopping rule excludes. Raised so you see it.
5. **Q5, cascade-delete of an entity created in the edit.** Draw dissolves a group the same edit created and then left below its minimum; D19, which you accepted, refuses it. Should `onBelowMin: "cascade-delete"` delete such an entity? (10 cases.)
6. **Q6, a write that changes nothing.** entity-graph answers it as a step (D17); draw leaves it out. Should `steps` omit a write that leaves its entity as it stood?
7. **Q7, steal on re-assertion.** Draw's steal acts on every write of a holder; `exclusivity: "steal"` acts only for a new holder (D18). Should a requested write that re-asserts a holding steal it, so a document that arrived broken is repaired by the write naming the target? (1 case.)
8. **Q8**, an edit resolving to nothing, is answered by D29 above.

---

## 4. Ahead, for your early view: undo over another writer's change (M5)

M5, undo and redo, is being built now.\
Its corpus reads D8's guard as met by the expected position alone: an undo planned after taking in another writer's later change to the same entity restores the entity, overwriting that change.\
D8's sentence -- "so a reversal is never applied to a state it was not recorded against" -- can also be read as refusing such an undo.\
The builder will implement one, record both readings as a proposal for you, and draw's director will rule for draw; we raise it now because it decides what two people editing one document see.
