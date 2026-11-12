# drawv2 to zorg: one more question from draw's cases, Q9 -- an undo refused for putting back a breach its edit repaired

**Status: draft, for the director's decision.**
**From:** drawv2, following `drawv2-entity-graph-m4-review-request.md` section 3 and `drawv2-entity-graph-undo-ruling.md`.\
**Read against:** entity-graph `d0ad2ca` (`main`, M5 merged); draw's dry run of its planner cases after M5, `drawv2-eval-runs/h31-reuse/draw-cases/RUN-2-PREP-AFTER-M5.md`, against entity-graph `d0ad2ca` and draw `daac188`.

---

## Where draw's cases stand after M5

With M4's resolver and M5's undo, all 1,044 of draw's planner cases now run, none waiting.\
408 match draw step for step, reversal for reversal and sentence for sentence; 376 give the same verdict and resulting document, and every accepted one of them undoes to exactly the document draw's undo restores; 260 differ, each with a stated cause.\
No defect in entity-graph was found, and the largest undo record is 2,342 bytes.

Two of our earlier questions change:
- **Q6 is withdrawn.** Draw's resolver now leaves out a write that changes nothing, as draw's planner does, so no accepted case carries such a step.
- **Q8** is answered by D29, which you accepted.

---

## Q9: an undo that puts back a breach its edit repaired

An undo is judged as any edit is (D8), and judging is introduce-or-worsen against the state the undo finds.\
So undoing an edit that repaired a breach, in part or whole, is refused for raising that breach back to the measure it had before the edit.\
Draw's undo restores the document the edit found, breaches included.

In 63 of draw's cases the document arrived holding more straight links between one pair of points than draw allows, and the edit removed some; entity-graph accepts the edit and then refuses its undo (`condition-broken`, `link.straight-pair`).\
A person who tidies something and presses undo would be refused, though the undo only returns what they found.

**Should an undo be refused for returning a breach to the measure it had when the undone edit found it, or judged only for breaches beyond the state its record restores?**

Draw's view: the second.\
An undo's purpose is to restore what the edit found, and D8 already ties an undo to the state its record was taken from (D37 refuses it where that state is gone); judging it against the measures it restores, rather than against the state the edit left, keeps every rule held for anything new while letting undo do its job.\
A redo would be judged alike, against the measures the edit itself reached.
