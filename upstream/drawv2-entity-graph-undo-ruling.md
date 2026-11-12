# drawv2 to zorg: an undo over another writer's change is refused -- draw's ruling, and one sentence for the contract

**Status: sent to zorg by the director's decision, 2026-11-12 (draw's `dev/DECISIONS.md` H31-15).**
**From:** drawv2, following section 4 of `drawv2-entity-graph-m4-review-request.md`.\
**Read against:** entity-graph PR #8 (`m5-history`, `27276b1`), its D37; entity-graph D8; the corpus's reading R44 and case `b6-08` (`d8f2186`).

---

## The question, now ruled for draw

When an entity an undo or redo would write has been changed by another writer since the edit, entity-graph M5 refuses the undo or redo as `history-superseded`, naming the entity (D37).\
The corpus, written from the contract by a separate agent, read it the other way (R44): the undo lands and overwrites the other writer's change.

- **Both the builder and the independent check read D8 and the vision as supporting D37.** D8 gives its guard's purpose as "a reversal is never applied to a state it was not recorded against", and once the view has taken in another writer's change, the expected position alone cannot deliver that; the vision promises an undo restores "exactly what it changed". Under R44 the other writer's work is lost with no refusal.
- **What R44 had for it** is the contract's list of what an undo is judged by -- shapes, reference rules, conditions and the expected position -- which names no other ground, and the vision's "every edit that landed can be undone".
- **D37 is decidable exactly:** whole records compared as plain data, key order ignored, an absent entity standing only as absent; it refuses only where the entity truly differs. Its cost is that some edits can no longer be undone through the history once another writer has changed an entity they wrote, an unrelated field included.

Draw's director ruled for D37 (draw's H31-15).\
For draw today it changes little: every write to a drawing goes through draw's one server and one shared history, so the case arises only if draw ever writes one drawing from more than one place.

---

## What we ask

1. **Accept D37** as entity-graph's reading.
2. **One sentence for `CONTRACT.md` *Undo and redo*,** so the term says what is built:

   > An undo or redo is also refused, naming the entity, when an entity it would write no longer stands as its recorded writes left it.

   We will not change the contract's text until you agree; D37 stands as a proposed reading meanwhile.
3. **The corpus follows the ruling:** its author restates R44 and `b6-08` to D37's reading, recorded as an entity-graph decision, so the case is never quietly edited by the implementer.

A field-level merge -- refusing only when the same field was changed -- would be kinder, and could follow later; the contract leaves "whether two edits may ever be combined" open, so we have not proposed it.
