# The records stay true -- guards against the drift classes -- H21.5 (DELTA)

Written 2026-10-11 and re-issued twice the same day: the first version failed an adversarial review (Appendix A), the second was found "ratifiable after the changes above" by a second, independent review (Appendix B), and this third carries those changes and the seven small ones the same reviewer's re-check asked for (Appendix C).\
Asked for: the director, approving the re-audit's order ("continue", `dev/DECISIONS.md` H21), then a design before building U1 ("continue"), then this narrower one ("continue").\
Evidence: the re-audit (`dev/design/unification/UNIFICATION-AUDIT.md`, sections 5 and 6) and a measurement of every held trigger (section 2), checked by the second review; MEASURED marks what was read or run, INFERRED a reading of it.

---

## 1. From-state

- **Thirty-one record-against-truth incidents** in six weeks, in seven classes, none caught by a scanner (the audit, section 5).
- **The board checker's thirteen rules** hold the board and the register to each other (`tools/scan-board.mjs:12-29`); none reads whether a trigger has fired, whether an exception's reason cites a closed row, or whose words a ruling carries.
- **A trigger lives in two places,** the row and the Held table, and they differ: 19 of 28 Held cells differ from their rows' text; B188's and B194's triggers live only on the board; four rows carry several trigger clauses (MEASURED, Appendix A, finding 3).
- **The register already marks a current trigger** where one replaced another -- `REVIVAL TRIGGER now:` (B7, B248, B310) -- or leaves the old one after `Was:` (B127, B324, B108) (MEASURED, Appendix B, finding 9).

---

## 2. The measurement

Every held row's trigger (28 rows), read from the row and the Held cell, against the vocabulary of section 3.1 (MEASURED; corrected by Appendix B, finding 2):

| | Rows | Count |
|---|---|---|
| **A machine can decide the whole trigger** | B127 (`row B256 planned`), B329 (`absent app/src/movers.js and absent app/src/reveal.js`) | 2 |
| **A machine can decide one half** | B126 and B327 (`row B256 planned`), B79 (`row B127 planned`), B328 (`count /judgeDrag:/ in */keys.mjs >= 2`), B108 (`count /mutate/ in package.json >= 1`); and B7, B253, B310, whose decidable half is "a file changed" on files changed several times a week | 8 |
| **Judgement** | B33, B175, B178, B180, B188, B194, B248, B254, B256, B262, B264, B265, B274, B289, B324, B325, B326, B330 | 18 |

**What it means:** B7's, B253's and B310's file-change halves would fire on every few commits -- noise, not a trigger -- so they stay judgement.\
**Seven rows carry a machine trigger**, three of them the one predicate `row B256 planned`; with B88's (section 3.5), eight.\
Twenty-one stay judgement.\
The design is small on purpose: an evaluator for the eight, a prompt for the rest, and no check pretending otherwise.

---

## 3. To-state

### 3.1 G1 -- a trigger's decidable half is evaluated, and the gate says when it fires (class c)

- **A held row's current trigger** is the text after its last `REVIVAL TRIGGER now:`, or, where it has none, after its last `REVIVAL TRIGGER:` outside a `Was:` span -- the label matched without regard to case, with an optional parenthetical before its colon (`REVIVAL TRIGGER (CANVAS-PLUGINS.md:399):`); it ends at the next `AMENDED`, `Was:` or `WHEN:`, or at the end of the cell.
- **A held row with no current trigger fails the gate** (RU3: the trigger is a required field, refused as a malformed record is).
- **No old text is relabelled or rewritten** (RU2): a row whose trigger is unlabelled, or has text after it, gains an appended `AMENDED <date>: REVIVAL TRIGGER now: <prose>` clause, restating it, with nothing after it but its `WHEN`. Sixteen rows need one today (MEASURED by the second review): with no labelled trigger, B33, B175, B178, B180, B188, B194, B328 and B330; with history or notes after it, B79, B108, B127, B274, B289, B324, B325 and B327.
- **Its decidable half, where it has one, follows as** `` WHEN: `<expression>` ``: predicates joined by `and`, which binds tighter, and `or`, without parentheses.

| Predicate | True when |
|---|---|
| `row B<n> planned` | a board item not `DONE` or `DROPPED` cites the row |
| `absent <path>` | the path is not in `git ls-files` |
| `count /<regex>/ in <glob> >= <n>` | the matching lines across the tracked files the glob names reach the bound -- the glob a git pathspec with glob magic, where `*` does not cross `/` and `**` does; a pipe in the regex is written `\x7c`, so the table cell is not split |

- **Predicates are added when a held row needs one** (A11): each of the three above has a user among the eight rows; `changed`, `ruled`, `trigger`, `item done`, `row closed` and `exists` were cut for having none (Appendix B, findings 3, 4 and 11; Appendix C, N7).
- **A malformed expression fails the gate**, naming the row -- the writer's error, caught when written.
- **An expression that cannot be evaluated counts as fired** -- a row id that does not exist, a `count` whose glob names no file -- so a moved file shows itself without failing an unrelated commit.
- **Every gate run prints each fired trigger**, naming the row and the predicate.
- **A fired trigger blocks a milestone's close, locally:** when a milestone heading is `DONE` in the working tree and was not at the base -- the merge base with `origin/main`, else `HEAD` -- the gate fails while any `WHEN` is true. It fires in the gate run before the closing commit and in the pre-push gate; CI, which checks pushed commits of `main` alone, never sees a close in progress and does not enforce it. Between closes, a fired trigger is printed, not enforced.
- **At a milestone's close the gate prints every judgement trigger**, a prompt to re-read them (section 3.6).
- **The tool is its own** (A3): a trigger scanner in `tools/`, beside `scan-board`; the verdict list and the item-state parsing both read are one module, extracted from `scan-board`, not a second copy. An item that writes its state at the start of a cell, as H6's do, is read as `scan-board` reads it today.

### 3.2 G2 -- the Held table's triggers are generated from the rows (class c)

- **The trigger column is generated** from each held row's current trigger prose (section 3.1, without its `WHEN` part) by a tool; the gate fails when the column differs from what the tool would write (P3).
- **The first generation rewrites the column**: at least nineteen cells change, and B188's and B194's triggers, which live only on the board today, are first appended to their rows.
- **A deviation from AR3, recorded:** the row set, the severity and the label stay typed on the board, because a register row carries no score field; moving scores onto the rows changes the register's format, and is held as a row of its own (section 4).

### 3.3 G3 -- the decoupling exceptions are structured, and their citations resolve (class e)

- **Six records** -- `KIND_RECORD` and `IMPORT_RECORD` in `tests/canvas-names-no-plugin.test.js`, `RECORD` and `DEVICE_RECORD` in `tests/core-names-no-plugin.test.js`, the `L5p` and `L7k` entries in `tools/layers.mjs` -- become entries of one shape: a count, a reason, the ids it cites, and a trigger (`permanent`, a `WHEN` expression, or judgement prose).
- **A cited id is one of three kinds, and resolves:**
  - a `B` row: live, unless written `from B<n>`, the origin of a standing constraint;
  - a board item `H<n>.<m>`, with any letters after: present on the board;
  - a ruling id: found in a bold paragraph of `dev/DECISIONS.md` in one of the two forms rulings are written in -- at its head, in the id list before its `--` or `:` (`**D1, D2 --`, `**H17-D7:`, `**WD9 --`), or at its tail, in the brackets after `-- ruled <date>` or `-- <date>` (`-- ruled 2026-09-27 (SD2)`) -- an id holding at least one digit; an id mentioned elsewhere, in a held question or a correction, does not count.
- **A `B` id always resolves as a row**, never as a ruling, though a few rows' ids also head rulings (B249, B275, B304).
- **Anything else is refused**, naming the entry: a closed row cited bare, an id of no kind above (today's `R3`, `F4`, `U4` and `U5`), or an entry with no trigger. Restructuring rewrites those reasons; a reason in a test or a tool is code, not a frozen record.

### 3.4 G4 -- smaller checks, each decidable

Four checks, each run in `npm run gate`, and one edit:
- **A design folder's index lists its members:** each entry directly in `dev/design/unification/`, `dev/design/sim/` and `dev/design/brand/` -- a file or a folder, other than the `README.md` itself -- is named in that folder's `README.md`. `dev/design/README.md` is excluded, recorded as defunct (`tools/scan-docrefs.mjs:39`). Today `dev/design/sim/explore/` is unnamed; this delta names it.
- **A title's status word carries a banner:** a file under `dev/design/` or `docs/spec/` whose first heading closes with a parenthetical holding `proposed`, `awaiting`, `draft` or `held` carries, within three lines below it, the banner `AMENDED <date>: this title's status is as written; the standing is its board item's`. Eighteen do today (MEASURED by Appendix B), `dev/design/unification/PROMOTION.md` among them; titles are not rewritten (RU2).
- **The unification index's Standing column follows a positive grammar** -- `<type>[; <board items>].`, the type one of `Delta`, `Plan`, `Design`, `Register`, `Evidence`, `Descriptive`, `Generated`, `Audit` -- so no cell carries a state; it read "proposed" and "held" for work long done (Appendix B, finding 12). This delta rewrites the column to the grammar.
- **The edit:** the lab plan's status column is marked frozen by an appended `AMENDED` line (`dev/design/h17/PLAN.md`); no check reads it.
- **What is recorded after a marker is structured:** a marker line closes the old form in `dev/DECISIONS.md`, and after it every paragraph that opens in bold is one of two things, or the gate fails naming it:
  - a ruling block -- a bold id head, as G3 reads one, then a `Director: "<the director's words, verbatim>"` line, a `Shown: <document>@<commit>` line naming what the director was shown, and a `Recorder:` line holding the proposer's account;
  - an `AMENDED` or `CORRECTED` line, which names the ruling it amends.
  An amendment to an earlier ruling is written after the marker, citing that ruling, not inserted beside it -- the decision record has had amendments inserted mid-file (`dev/DECISIONS.md:261`, `:301`, `:937`), which this ends. A bold paragraph with no id, such as `**Scope discipline.**` (`:287`), where the caution that became B282's trigger was written, is refused after the marker. The check sees structure, not truth: a quote can be typed falsely, but analysis can no longer sit unmarked among a ruling's words.

### 3.5 B88 -- held again, watched by the evaluator

B88's finding -- prose can say finished work is blocked -- has no subject today: no board item is `BLOCKED` (MEASURED), and H15.2, its motivating case, cited its own open row (Appendix B, finding 8).\
It is held again, with the evaluator watching for its subject: `` WHEN: `count /\x60BLOCKED\x60 \x7c$/ in dev/BOARD.md >= 1` `` -- an item in the `BLOCKED` state -- which also tests the evaluator on a row of its own.

### 3.6 Practices -- judgement, written where agents read it

In `dev/README.md`, under one heading:
- **At a milestone's close, re-read every judgement trigger the gate prints**, and re-triage any that has fired.
- **A trigger the director set is held again only with the director's words**, and a row records who set its trigger.
- **Read before asserting:** a claim about code, a landing or a record carries `[V, file:line]` or is marked INFERRED.
- **A correction finds its copies:** whoever corrects a false phrase searches the records for it and corrects each copy, or says why a copy stands (root cause 4; an exact-phrase check was cut, Appendix B, finding 7).
- **An infrastructure claim cites the date it was read** from the cloud, `[read YYYY-MM-DD]`; the reading's configuration stays in the private `deploy/`.
- **A retry past a red gate names the failing test on a row** first.

---

## 4. The fence

**In:** G1 to G4, B88 held again, the practices; the trigger scanner, the Held-column generator, the shared verdict module; the appended trigger clauses that reconcile the 28 rows; the six records restructured; the eighteen banners; the index entries and the Standing column; the frozen-column line in the lab plan; the marker in `dev/DECISIONS.md`; each guard's test; and five rows filed, each held with a trigger, for what this delta defers:
- the flake ledger -- revived when a flake is filed after H20.2;
- the infrastructure probe -- revived when an infrastructure claim is found false again;
- G3's rule over the other allow lists (`tools/scan-dead.mjs`, `tools/scan-cli.mjs`, the `rebuild-debt` tags) -- revived when a reason in one is found citing finished work;
- the specifications' status banners (`docs/spec/ACCESS.md`, `AUTHORITY.md`, `TRANSACTIONS.md`, `WRITES.md`, `LAYOUT.md`) -- revived when one is found stale again;
- scores on the register's rows, AR3's form -- revived when the triage scale is next changed, or a Held score is found disagreeing with its row.

**Two record edits the close needs:** H21.5's `Cites` cell changes from **B88** to `feature`, with an `AMENDED` line, since B88 is held again rather than closed -- its opening names H10, so the board's rule that a `DONE` item's row is closed would otherwise fail the closing commit (Appendix C, N1); and each of the five deferred rows' openings names no milestone.

**Anti-scope:**
- No record written before approval is rewritten to pass a guard (RU2): reconciliation appends; titles, old corrections and old rulings keep their form.
- No judgement is dressed as a check.
- No flake ledger, no probe tool, no CI change.
- No product change.

---

## 5. Build order

| Stage | What lands | Proven by |
|---|---|---|
| **R-a** | G1 and G2: the scanner, the verdict module, the generator; the 28 rows reconciled by appended clauses; the eight `WHEN` expressions | a fixture git repository (`--root` skips git) with each predicate true and false; a malformed expression; an unevaluable one; a milestone closed with and without a fired trigger; a hand-edited Held cell |
| **R-b** | G3: the six records structured | fixture entries citing a closed row bare, `from` a closed row, an unknown id, a ruling id named only in a held question, and none |
| **R-c** | G4 and B88: the indexes, the banners, the Standing column, the lab plan's line, the marker and the ruling check | a fixture index missing a member; a title with a status word and no banner, and one with the word used descriptively; a Standing cell with a status word; a ruling after the marker without `Director:` |
| **R-d** | the practices; the five deferred rows | the heading present; each row held with its trigger |

---

## 6. Exit criteria

Each true or false at the commit that closes H21.5, on a fresh checkout, checked by an agent other than the builder.

1. `npm run gate` runs the trigger scanner and the Held-column round trip, and passes on the real repository.
2. Every held row has exactly one current trigger by section 3.1's rule, and it is the last clause of its cell.
3. The eight rows of sections 2 and 3.5 carry a `WHEN` that evaluates, and none has fired.
4. Each predicate has a fixture case true and a case false; a malformed expression fails the scan; an unevaluable one is reported fired.
5. In the fixture repository, closing a milestone with a fired trigger fails the gate, and closing it without one passes.
6. Editing a Held trigger cell by hand fails the gate.
7. The six records are in the structured shape and pass; each fixture entry of R-b fails.
8. Each of section 3.4's four checks runs in `npm run gate`, fails on its fixture and passes on the real repository; a held row with no current trigger fails the scanner on a fixture.
9. `dev/README.md` holds the practices of section 3.6 under one heading.
10. The five deferred rows exist, each held with its trigger; B88 is held with its `WHEN`; H21.5 cites `feature`, and `node tools/scan-board.mjs` passes with H21.5 `DONE`.

---

## 7. Verification targets

- The trigger scanner, driven over a temporary git repository holding a board, a register and files, so `exists`, `absent` and the milestone base are exercised, not skipped.
- The Held-column generator's round trip, over the real board and register, and over a fixture with one cell changed by hand.
- G3's citation check, over the six real records and the fixture entries of R-b.
- G4's checks, over the real repository and their fixtures.
- Each check proven by a planted instance before it counts (the board's contract rule 5).

---

## 8. Coverage map

The ruled U1 (`dev/DECISIONS.md` H21; the audit's section 7), each part proven or deferred:

| Ruled | Proven here | Deferred, with its trigger |
|---|---|---|
| a trigger is a machine check the gate evaluates | the eight rows that have a decidable half (G1) | the 21 judgement rows: none can be one, measured |
| or a judgement re-evaluated at every milestone close | the gate prints them at the close | the re-reading itself: a practice -- a dated check forced a date edit, not a re-read (Appendix A, finding 2) |
| a reason citing a `B` or `K` id is failed when the row is closed | the six decoupling records (G3) | the other allow lists: a row of their own |
| a ruling's director words are quoted and agent prose marked | everything recorded after the marker: a ruling block with its fields, or a named amendment (G4) | past rulings stand with their corrections (RU2) |
| status lives on the board alone | banners, the Standing column, complete indexes, the lab plan marked frozen (G4) | the specifications' banners: a row of their own |
| an infrastructure claim cites a dated probe | -- | a practice now; the probe: a row of its own |
| a flake ledger | -- | a practice now; the ledger: a row of its own |

**Root causes** (the audit, section 6): 1, work under another id -- not addressed by a machine: the predicates that would watch code were noise or cut; a practice only. 2, triggers and reasons as prose -- G1 for the eight, G3 for the decoupling records. 3, no target and a hand-kept current state -- U2's, not this delta's. 4, corrections stay local -- a practice. 5, provenance unmarked -- G4's ruling structure, going forward. 6, infrastructure unread -- a practice.

**Yield, honestly** (each incident against the vocabulary as written; Appendix B, finding 5; Appendix C, N7): of the thirty-one, G3 would have failed the kernel ratchet's reasons citing closed B308; B88's own trigger, "a second blocked entry appears", would have shown on 2026-09-08 (`7440cc9`, two items `BLOCKED` on the board, then kept under `docs/`, MEASURED) and again on 2026-09-22 (`27c7eb2`) -- earlier than the audit dated it; and B248's "a second plugin" might have shown had its writer guessed a counting pattern (INFERRED) -- **about three**.\
The return is forward-looking, not retrospective: eight held rows a machine watches, one current trigger per row that the board cannot misquote, decoupling exceptions whose citations cannot rot, and rulings whose provenance is structural.

---

## 9. Costs and non-claims

- **A fired trigger blocks a milestone's close, locally only**; CI does not enforce it, and between closes it is printed, not enforced -- a trigger can sit fired for as long as a milestone stays open.
- **A regex in a `count` can drift** while its files survive; the evaluator catches files gone, not a stale pattern.
- **The ruling structure** checks that `Director:` exists, not that it is true.
- **Twenty-one held rows** stay judgement, re-read by practice.
- **The Held table's severity stays typed**, a recorded deviation from AR3.
- **Not claimed:** that the records are true; that root causes 1, 3, 4 and 6 are mechanized; or a retrospective yield beyond about three.

---

## 10. Decisions for the director

Built as recommended unless ruled otherwise.

1. **A fired trigger blocks a milestone's close and is printed every run**, rather than failing every commit. Recommended -- the close is where work is reviewed anyway.
2. **The ruling structure binds rulings after a marker**, past rulings untouched. Recommended (RU2).
3. **What this delta defers is filed as five held rows with triggers**, rather than built now. Recommended (A11).

---

## 11. Axiom alignment audit (M7)

**Identity:** a delta to the records' tooling and practice, domain D6 (`knowledge-methodology`), no product change.

| Layer | Axiom | Weight | How it holds -- or the tension |
|---|---|---|---|
| Self-evolution | A14 | load-bearing | each measured drift class gets its decidable part checked (signal 6); what is judgement is written as practice, not left in conversation (signal 2) |
| Specification | A11 | load-bearing | a vocabulary of three predicates, each with a user among the eight rows; six cut for having none; no check pretends to decide judgement |
| Integrity | A8 | load-bearing | every check proven by a planted instance; **tension:** the milestone block is local, so A8's "nothing ascends over an unproven layer" holds at the close, not in CI -- named in section 9 |
| State and truth | A1, A7 | supporting | whether a held condition holds is computed and printed every run; no per-machine state |
| Specification | A2 | supporting | the Held column generated from its master; **deviation:** severity stays typed (section 3.2) |
| Composition | A3 | supporting | one scanner owns triggers, one module the verdicts, one generator the column, each ratchet its records; **tension:** the scanner reads the board, the register and git -- accepted, as `scan-board` reads two |
| Perception, context | A5, A12 | supporting | fired triggers printed without searching; one current trigger per row, appended, so an agent parses less of a long disposition |
| Director attention | A13 | supporting | re-triage at closes, not at random; **tension:** a director-set trigger that fires holds a close until the director speaks |
| Knowledge | A4 | supporting | nothing past rewritten; both earlier versions and both reviews kept whole |
| -- | A6, A9, A10 | not materially implicated | no agent seam, deployment or self-modifying loop changes |

**Deltas the audit made:** none beyond the second review's (Appendix B).\
**Verdict: pass, with guardrails** -- no judgement dressed as a check; nothing written before approval rewritten to pass; every check proven by a planted instance, over a git fixture where it reads git; an unevaluable predicate reported, never silently passed; the closing commit checked against section 6 by an agent other than the builder.
**Closeout hooks:** section 6, checked by another agent; the five deferred rows present and held.

---

## 12. Adversarial review

Two reviews, by two agents that did not draft it: the first broke the first version (Appendix A); the second found the second version "ratifiable after the changes above" (Appendix B), and every one of its findings is carried here.\
The second reviewer re-checked this version: 13 of its 14 findings carried, one mostly, and seven new findings, two major -- "ratifiable after small changes", all text edits, now made (Appendix C).

---

## Appendix A. The first version, and the review that broke it

Kept whole, as its review's disposition said (A4).

Written 2026-10-11 at `bc0c5b8`, for the director's approval before any code.\
Asked for: the director, approving the re-audit's order ("continue", `dev/DECISIONS.md` H21), and then this design before building U1 ("continue").\
Its evidence is the re-audit (`dev/design/unification/UNIFICATION-AUDIT.md`, sections 5 and 6); MEASURED marks what was read or run, INFERRED a reading of it.

---

### 1. From-state

- **Thirty-one record-against-truth incidents** from 2026-09-01 to 2026-10-11, in seven classes; seven were still wrong when the audit ran (the audit, section 5).
- **No scanner caught one.** The board checker holds thirteen rules (`tools/scan-board.mjs:12-29`), all about the board and the register agreeing with each other; none reads whether a trigger has fired, whether a reason cites a closed row, whose words a ruling quotes, or whether a status written outside the board is true. Its header says trigger judgement is "deliberately NOT faked here" (`:31-34`).
- **A trigger lives in two places** -- the row's disposition and the board's Held table -- and the two are free to differ: B164's trigger lived only in the Held table (MEASURED, the audit's incident 3).
- **The root causes** (the audit, section 6): work lands under another id, so nothing maps it back to the condition it met; triggers and reasons are prose nothing evaluates; corrections stay where the error was seen; provenance is unmarked; infrastructure leaves no record a check can read.

---

### 2. To-state

Each guard names the drift class it holds (the audit's letters), and whether a machine decides it or a person does.\
A guard a machine can decide is a check in the gate; a class no machine can decide is said to be judgement, with the practice that holds it -- a check that cannot decide is worse than none.

### G1. A revival trigger is a check the gate runs, or a judgement re-read at every milestone close (class c; machine)

- **Every live held row's trigger carries a machine form or a judgement mark**, after its prose, in its disposition:
  - `WHEN: <predicate>` -- one or more predicates joined by `or`, from a closed vocabulary;
  - `JUDGEMENT (re-read YYYY-MM-DD)` -- a condition no file holds, such as "the director reopens it".
- **The vocabulary is closed and small** (A11), each predicate decidable from the repository:

| Predicate | Fires when |
|---|---|
| `row B<n> closed` | the row's verdict is a closed one |
| `item H<n>.<m> done` | the board item is `DONE` or `DROPPED` |
| `ruled <id>` | `dev/DECISIONS.md` holds a ruling headed with that id |
| `exists <path>` / `absent <path>` | the path is, or is not, in `git ls-files` |
| `count /<regex>/ in <path> <op> <n>` | the count of matching lines in the file meets the bound |
| `flaked <test file> >= <n>` | the flake ledger (G6) records that many flakes of the file |

- **A trigger that fires fails the gate**, naming the row and the predicate: "B<n>'s trigger fired (<predicate>) -- re-triage it: plan it, or hold it again with a trigger not yet true". A trigger already true when written fails at once, which is the audit's incidents 5b and 11.
- **A predicate cannot go silently vacuous:** a `count` predicate names a file that must exist, and the check fails if it does not -- a refactor that moves the code fails the gate rather than leaving a trigger that can never fire.
- **A judgement trigger is re-read at every milestone close:** its re-read date must be on or after the date the board last marked a milestone `DONE` (read from git: the newest commit that set a milestone heading to `DONE`), or the gate fails naming it. Closing a milestone therefore re-reads every judgement trigger -- the re-triage the director has had to order, made the system's.

### G2. One trigger, one place (class c; machine)

The Held table's trigger column must equal the row's trigger prose, word for word after whitespace is normalised; a difference fails the gate naming both.\
The row is the record and the board reads it (mission-kit AR3: "a score typed on the board is a second copy, free to disagree").

### G3. A reason cites live work, or says it is permanent (class e; machine)

- **Where:** the exception records -- the ratchet records in `tests/canvas-names-no-plugin.test.js` and `tests/core-names-no-plugin.test.js`, the reasons and tags in `tools/layers.mjs`, the allow list in `tools/scan-dead.mjs`, the pending and allow lists in `tools/scan-cli.mjs`.
- **The rule:** every reason cites a live row (`OPEN`, `HELD`, `DEFERRED`, or a `PART-CLOSED` remainder), a ruling id that `dev/DECISIONS.md` holds, or the word `permanent`; a closed row may be cited only as the origin of a standing constraint, written `(from B<n>)`. A reason citing a closed row bare fails the gate, naming the record and the row.

### G4. Status lives on the board (class b; machine)

- **A design's or a specification's title carries its type and its board item, never a status:** the parenthetical closing the first heading of every file under `dev/design/` and `docs/spec/` -- where a status has been written -- holds none of `proposed`, `approved`, `awaiting`, `built`, `draft`, `done`. Nineteen titles carry one, sixteen of them "proposed" for designs long approved, and one this audit's own correction wrote (`dev/design/input/GESTURE-SYSTEM.md`) (MEASURED); this stage corrects them. A status word elsewhere in a title is description, not status (`dev/design/unification/RULESET.md`: "where it is built").
- **A table in a plan carries no status column:** the lab plan's (`dev/design/h17/PLAN.md`) is marked frozen as written, its statuses read from the board (RU2: a record made before the rule is not rewritten).
- **A design folder's index lists every member** (`dev/design/unification/README.md`); a file the index omits fails the gate.

### G5. The director's words are quoted (class d; machine for new rulings)

- **A ruling recorded from today** -- a heading in `dev/DECISIONS.md` dated on or after this design's approval -- holds the director's words in quotation marks, attributed ("the director answered", "said", "ruled" or "chose"), and marks any proposer's analysis inside it as `Recorder:`. A new ruling without a quoted director statement fails the gate.
- **A claim of the director's authority elsewhere** -- "the director's call", "ruled by the director" -- in a line of `dev/BOARD.md` or `dev/BACKLOG.md` written from today cites a ruling id or carries the quote, or fails the gate.
- **Rulings recorded before today are not rewritten** (RU2); the audit's CORRECTED lines stand for them.

### G6. A flake is recorded by the gate itself (class g; machine)

- **The test step records every run**: the tree it ran on (the commit and a hash of its uncommitted changes), the result, and each failing test file, in an untracked history (`.gate-history.jsonl`).
- **A flake is a test file that failed and then passed on the same tree.** When the gate passes, every flake in the history must be named on a backlog row by its file, or the gate fails naming it: "tests/<file> flaked on <tree> -- name it on a flake row". The ledger is the history, so `flaked <file> >= <n>` (G1) counts it.

### G7. Infrastructure claims are read, not remembered (class a; judgement, with a tool)

- **A probe reads the live configuration** (a probe in `tools/`): each service's serving revision, image and ingress, the security policies attached to each backend with their rules, and the bucket's soft-delete window -- read with `gcloud`, writing nothing.
- **It runs at every deploy**, and a record that asserts infrastructure state cites the probe's date, `[probe YYYY-MM-DD]`.
- **Judgement:** the gate cannot run `gcloud`, so no check decides whether a claim matches the cloud; the probe makes the true answer one command away, which is what H10.30 lacked for 44 days.

### G8. A claim about code is read before it is written (class f; judgement)

- **A practice, not a check:** before a record states what code does, what landed, or what a row says, the writer reads it, and the claim carries `[V, file:line]` or is marked INFERRED. This is the BACKLOG's own row contract, extended to the board's amendments, the designs and a re-triage.
- **Judgement:** prose is not decidable; seven incidents were this class, and the remedy that worked each time was reading the source (A5), or an adversarial review.

---

### 3. The fence

**In:** G1 to G8 as stated; converting every live held row's trigger to a machine form or a judgement mark; the nineteen titles; the lab plan's table marked frozen; each guard's test.

**Anti-scope -- what must not creep in:**
- No record written before the rule is rewritten to satisfy it (RU2): the guards bind what is written from their approval, and the audit's corrections stand for the past.
- No check that a model or a person would have to judge is dressed as a machine check (A11; the scanner's own header).
- No new infrastructure, service or continuous-integration change; the probe reads, and the gate runs where it runs now.
- No change to the product.

---

### 4. Build order

Each stage is gated and proven before the next.

| Stage | What lands | Proven by |
|---|---|---|
| **R-a** | G1 and G2: the trigger forms, the evaluator, the judgement cadence, the Held equality; every live trigger converted | a fixture per predicate firing and not firing; a trigger true when written; a vacuous `count`; a stale judgement; a Held column differing from its row |
| **R-b** | G3 and G4: reasons, the nineteen titles, the plan table, the index | a fixture reason citing a closed row bare, and `(from ...)`; a title whose parenthetical carries a status word, and one whose body uses the word as description; an index missing a file |
| **R-c** | G6: the history and the flake check | a fixture history with a fail then a pass on one tree, unnamed and named |
| **R-d** | G5, G7 and G8: the quoting rule, the probe, and the practice written where agents read it (`dev/README.md`) | a fixture ruling without a quote; the probe run against production, its output in the private runbook |

---

### 5. Exit criteria

1. Every live held row's trigger carries `WHEN:` or `JUDGEMENT`, and the gate passes with none fired.
2. Each guard's check fails on its planted instance and passes on its control, in its test.
3. No exception record cites a closed row bare; no title under `dev/design/` or `docs/spec/` carries a status word; every design index lists every member.
4. A flake on one tree fails the gate until a row names it.
5. A ruling added after approval without a quoted director statement fails the gate.
6. The probe runs and reports production's serving revision and the agent door's throttle.

---

### 6. Coverage and yield

Reported honestly (RU1): what each class gets, measured against the audit's thirty-one incidents.

| Class | Incidents | Guard | Machine-held | Would have caught |
|---|---|---|---|---|
| (c) triggers | 8 | G1, G2 | yes | 7 of 8, INFERRED -- B7's named work nobody scheduled is judgement |
| (e) stale reasons | 5 | G3 | yes, in the exception records | 3 of 5 -- the two in design prose are not in the records G3 reads |
| (b) secondary status | 4 | G4 | yes, for titles, tables and indexes | 3 of 4 -- WRITES.md's "no code" header was prose under a title |
| (d) agent as director | 3 | G5 | for new rulings | the class going forward; none of the three retroactively (RU2) |
| (g) other | 3 | G6 | flakes only | 0 of 3 (none was a flake; the flakes were in class c) |
| (a) external state | 1 | G7 | no | judgement, the answer one command away |
| (f) from memory | 7 | G8 | no | judgement |

**Net, INFERRED:** about thirteen of the thirty-one would have failed the gate the day they began; the classes left to judgement are named, with their practice.

---

### 7. Costs and non-claims

- **A fired trigger fails the gate for an unrelated commit.** Re-triage is one row's edit; the cost is accepted because a fired trigger left silent is what the audit measured.
- **A `count` predicate is a regex**, fragile by nature; G1 makes it fail loudly when its file goes, not when its pattern stops matching -- a pattern can still drift, which the judgement cadence does not catch.
- **The flake history is per machine and untracked**; a flake on another machine is not recorded.
- **G5 binds new rulings only**; past ones stay as written, with their corrections.
- **Not claimed:** that the records are true -- only that the classes the audit measured cannot recur unseen where a machine can see them.

---

### 8. Decisions for the director

Each with a recommendation; the design is built as recommended unless ruled otherwise.

1. **A fired trigger fails the gate**, rather than being reported and passing. Recommended: fail -- a report nothing has to read is the state the audit found.
2. **The quoting rule binds rulings from its approval**, rather than marking every past ruling. Recommended: from approval (RU2) -- the past has its CORRECTED lines.
3. **The gate records flakes automatically**, rather than an agent filing them by hand. Recommended: automatically -- B164's trigger fired three times while filing was by hand.

---

### 9. Axiom alignment audit (M7)

| Axiom | Weight | How it holds -- or the tension |
|---|---|---|
| A14 Compounding Learning | load-bearing | each drift class mined to root cause becomes a check before more is built (success signal 6); recurrence of a captured failure mode fails the gate (signal 3) |
| A11 Cognitive Minimalism | load-bearing | deterministic predicates in a closed vocabulary replace an agent remembering to re-read; what no machine can decide is named judgement, not faked |
| A8 Gated Recursive Integrity | load-bearing | a fired trigger or a stale reason is a binary failure, not a note; **tension:** an unrelated commit is blocked until one row is re-triaged -- accepted (section 7) |
| A1 Sovereign State Transparency | load-bearing | whether a held row's condition holds is computed from the repository, not inferred by reading prose |
| A2 Isomorphic Specification | supporting | the Held table and the row cannot disagree (G2); a title cannot claim a status the board contradicts (G4) |
| A13 Director Intent Amplification | supporting | the director stops being the one who notices a stale record ("I thought we already had cloud armor"); the director's words are quoted, so an agent's cannot pass for them |
| A7 Resilient Agentic Operations | supporting | a flake is recorded, not retried past in silence |
| A4 Zero-Loss Knowledge | supporting | no past record is rewritten (RU2); the guards bind forward |
| the rest | not materially implicated | no product, agent seam or context assembly changes |

**Verdict: pass, with guardrails** --
1. no guard decides by judgement dressed as a check;
2. no record written before approval is rewritten to pass a guard;
3. every guard is proven by a planted instance before it counts (contract rule 5);
4. a `count` predicate names a file that must exist.

---

### 10. Adversarial review (of the first version)

**Reviewer:** an independent agent that did not draft this, given the design, the audit, the code and the mission-kit entries it claims, and told to break it; read only.\
**Its verdict: not ratifiable** -- "the audit's diagnosis is sound ... but the main mechanisms fail on the repository as it stands"; it asks for a narrower delta, re-measured, not edits.
**Its measurement:** of 28 held triggers, about 2 convert to G1's vocabulary, both with loss; about 14 are judgement; about 10 are decidable from the repository but not in the vocabulary -- "the next change to X", "row B<n> is planned", "row B<n>'s trigger fires", any flake in a window.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | blocker | G1's vocabulary fits almost no real trigger, and a row may choose `JUDGEMENT` to stay green, so the machine guarantee is optional | accepted -- the vocabulary is re-specified against all 28 triggers, with `changed <path> since <rev>`, `row B<n> planned`, `trigger B<n>`, and a row may carry a decidable half and a judgement half |
| 2 | blocker | the judgement cadence forces a date edit, not a re-read; undefined in CI's shallow clone; the closing commit passes and the next fails | accepted -- the dated cadence is dropped; re-reading a judgement trigger is a practice at milestone close, said to be one |
| 3 | major | G2 cannot locate "the row's trigger": 19 of 28 Held cells differ from their rows; four rows carry several trigger clauses; B188's and B194's triggers live only on the board | accepted -- the Held table loses its trigger column (read from the row); every live row carries exactly one current `REVIVAL TRIGGER:`, history relabelled; the 28 rows reconciled inside the fence |
| 4 | major | G3 does not fit what it reads: about 35 reasons cite nothing and 41 cite closed rows bare on day one; K ids dropped against the ruled U1; U0's own `rebuild-debt` note is false (`tools/layers.mjs:674-675`) | accepted -- the decoupling exception records become structured data (count, reason, cited ids, trigger), ids resolved against the register and the board; the false note corrected; the other allow lists measured before a rule binds them |
| 5 | major | G6 decides the gate from an untracked file per machine, is already satisfied for half the test files, and works per file, not per test; no flake rate has been measured since H20.2 | accepted -- G6 is dropped until a flake rate is measured (A11); a retry past a red gate names or files a row, as a practice |
| 6 | major | G5's checkable part passes the very pattern of class (d); rulings are bold paragraphs, not headings; ids collide | accepted -- a ruling recorded after approval is a structured block whose fields are checked: the director's words, verbatim, and a recorder's field for the proposer's analysis |
| 7 | major | G4 misses live stale status (PROMOTION.md, specs' banners, the index's Standing column) and rewriting frozen titles breaks RU2; "nineteen" is eighteen | accepted -- titles stay as written; a status banner is added where a frozen title or banner misleads (RU2's remedy); the index's Standing column names type and board item only; the count corrected |
| 8 | major | the yield is overstated (about 9 or 10, not 13) and cites incident numbers the audit does not contain | accepted -- recomputed per incident against the final vocabulary; citations name the incident, not a number |
| 9 | major | root causes 1 (work under another id) and 4 (corrections stay local) are not addressed; the design extends the convention behind cause 4 | accepted -- `changed <path> since` lets a trigger fire whatever id the work carries; a correction names the false phrase, and the gate finds its uncorrected copies |
| 10 | major | B88, the row H21.5 cites, is never mentioned; closing H21.5 would close it undelivered | accepted -- B88 is in the coverage: a `BLOCKED` item names the open row or item that blocks it, checked |
| 11 | major | a fired trigger blocks unrelated commits and pulls the director in at random (A13); re-holding invites raising thresholds | accepted -- a fired trigger is listed in the gate's output and blocks only a milestone's close; a trigger records who set it, and one the director set is re-held only with the director's words |
| 12 | major | not an AR2 delta or an M7 audit in full: coverage by class, not by ruled decision; exits not falsifiable; tensions A1, A3, A12, A13, A5 missing | accepted -- the re-issued delta maps the ruled U1 decisions, writes each exit as a falsifier, and audits the missing axioms |
| 13 | minor | predicate grammar, escaping and fixtures unspecified; `--root` skips git | accepted -- a grammar, an escaping rule and a fixture repository |
| 14 | minor | a tracked probe needs ids `.gitignore` keeps out on purpose | accepted -- the probe's configuration lives in the private `deploy/`; the probe is a practice |

**Disposition of the whole: re-issued, narrower and re-measured, before the director is asked to approve** -- this version is kept as the record of what the review broke.

---

## Appendix B. The second review, and its dispositions

**Reviewer:** a second independent agent, neither the drafter nor the first reviewer, told to break the second version; read only.\
**Its verdict: ratifiable after the changes above** -- "the right shape ... its defects are in the specification and the claims, not the direction"; "a short re-check of only the edited sections would be enough".

| # | Sev | Finding | Disposition in this version |
|---|---|---|---|
| 1 | blocker | the exits could be met with no `WHEN` on any real row; G4 (corrections) had no exit; exit 1's scope was every live row, not every held row | exits 1 to 3 now require the gate to pass on the real repository, every held row to carry one current trigger, and the eight measured rows to carry an evaluating `WHEN` (section 6) |
| 2 | major | the measurement was 2 whole / 8 half / 18 judgement, not 2 / 6 / 20; three decidable halves were `changed` on files changed several times a week -- noise | section 2 corrected; the three noise halves stay judgement; seven rows carry a machine trigger, eight with B88's |
| 3 | major | `changed` brings back the date-edit failure, its revision form breaks after a history rewrite, and a vanished path would fail every commit | `changed` cut; an unevaluable predicate counts as fired, never failing an unrelated commit (section 3.1) |
| 4 | major | `ruled <id>` false-fires on held questions and corrections and misses ranges; G3 inherits it | `ruled` cut from triggers; G3 resolves a ruling id only at the head of a bold paragraph, in its id list (section 3.3) |
| 5 | major | the yield was overstated again: about two or three of thirty-one, not eight -- B27's path did not exist when written, K10 was a cut, not an item, `count` cannot scope to one table | restated as about two, with the return named as forward-looking (section 8) |
| 6 | major | the milestone block never fires in CI and waits as long as a milestone lives | said plainly: local only, printed between closes (sections 3.1 and 9; the A8 tension in section 11) |
| 7 | major | the correction check misses paraphrased copies and fails legitimate quotations | cut; root cause 4 kept as a practice (section 3.6) |
| 8 | major | the blocked-item check has no subject today, would not have caught H15.2, and would close B88 undelivered | cut; B88 held again with a `WHEN` the evaluator watches (section 3.5) |
| 9 | major | relabelling old triggers `Was trigger:` rewrites records to pass a guard, against the design's own anti-scope | dropped; the current trigger is read from the register's existing marks, and reconciliation appends (section 3.1) |
| 10 | major | G2 departed from AR3 unrecorded, with no terminator for the trigger's prose, and did not say it rewrites the column | the deviation recorded and held as a row; the trigger ends at `WHEN:` or the cell's end; the one-time rewrite stated (section 3.2) |
| 11 | major | half the vocabulary had no current user (A11) | the vocabulary cut to four predicates, each with a user; others added when a row needs them (section 3.1) |
| 12 | minor | the first review's finding 7 disposition (the Standing column, PROMOTION.md, the specifications' banners) was not carried; deferrals had no rows | the Standing column and PROMOTION.md carried (section 3.4); the specifications' banners and every deferral filed as held rows inside the fence (section 4) |
| 13 | minor | terms undefined: globs, escaping, verdict list copy, index members, ruling paragraph, empty director quotes | globs over tracked files; a pipe as `\x7c`; the verdict list one shared module; members defined; a ruling paragraph as G3 reads one; a `Shown:` line (sections 3.1, 3.3, 3.4) |
| 14 | minor | AR2's verification targets missing; "in part" coverage neither proven nor deferred; M7 without weights, identity, deltas or closeout hooks | a verification targets section (7); the coverage map split into proven and deferred (8); the M7 table completed (11) |

---

## Appendix C. The second reviewer's re-check, and its dispositions

**Its verdict: ratifiable after small changes** -- "the design is now coherent and close to honest.\
Of these, only N1 would visibly break the closing commit, and only N2 undercuts a stated guarantee."

| # | Sev | Finding | Disposition |
|---|---|---|---|
| N1 | major | closing H21.5 while B88 stays held fails the board's rule that a `DONE` item's row is closed, since B88's opening names H10 -- demonstrated on a copy | H21.5 cites `feature`, with an `AMENDED` line; the five new rows' openings name no milestone (section 4; exit 10) |
| N2 | major | the ruling check let through bold paragraphs with no id -- `**Scope discipline.**`, where B282's trigger was born -- tail-form rulings, and amendments inserted mid-file | after the marker every bold paragraph is a ruling block or a named amendment; amendments land after the marker (section 3.4) |
| N3 | minor | G3's ruling ids missed the tail form (SD1 to SD12, N1 to N6 and others); some `B` ids also head rulings; `U4` and `U5` unlisted | both forms resolved; a `B` id always a row; `U4` and `U5` listed as refused (section 3.3) |
| N4 | minor | RU3 enforced only at the exit | the scanner fails a held row with no current trigger (section 3.1; exit 8) |
| N5 | minor | the Standing check undefined, so exit 8 not binary | a positive grammar with a closed list of types; the four checks named and run in the gate, the lab plan's line an edit (section 3.4) |
| N6 | minor | labels' case and parentheticals unspecified; sixteen rows need an appended clause, not five; notes after a trigger would join it; H6's state at a cell's start | labels matched without case, with an optional parenthetical; the trigger ends at the next `AMENDED` or `Was:`; the sixteen named; H6's form read as `scan-board` reads it (section 3.1) |
| N7 | minor | "four" was three; "each with a user" false; the yield about three counting B88, whose first firing the record misdates | corrected; the vocabulary cut to the three predicates the eight rows use; yield about three; B88's row and the audit corrected for the date |
