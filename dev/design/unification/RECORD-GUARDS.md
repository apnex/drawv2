# The records stay true -- guards against the drift classes -- H21.5 (DELTA)

Written 2026-10-11 at `bc0c5b8`, for the director's approval before any code.\
Asked for: the director, approving the re-audit's order ("continue", `dev/DECISIONS.md` H21), and then this design before building U1 ("continue").\
Its evidence is the re-audit (`dev/design/unification/UNIFICATION-AUDIT.md`, sections 5 and 6); MEASURED marks what was read or run, INFERRED a reading of it.

---

## 1. From-state

- **Thirty-one record-against-truth incidents** from 2026-09-01 to 2026-10-11, in seven classes; seven were still wrong when the audit ran (the audit, section 5).
- **No scanner caught one.** The board checker holds thirteen rules (`tools/scan-board.mjs:12-29`), all about the board and the register agreeing with each other; none reads whether a trigger has fired, whether a reason cites a closed row, whose words a ruling quotes, or whether a status written outside the board is true. Its header says trigger judgement is "deliberately NOT faked here" (`:31-34`).
- **A trigger lives in two places** -- the row's disposition and the board's Held table -- and the two are free to differ: B164's trigger lived only in the Held table (MEASURED, the audit's incident 3).
- **The root causes** (the audit, section 6): work lands under another id, so nothing maps it back to the condition it met; triggers and reasons are prose nothing evaluates; corrections stay where the error was seen; provenance is unmarked; infrastructure leaves no record a check can read.

---

## 2. To-state

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

## 3. The fence

**In:** G1 to G8 as stated; converting every live held row's trigger to a machine form or a judgement mark; the nineteen titles; the lab plan's table marked frozen; each guard's test.

**Anti-scope -- what must not creep in:**
- No record written before the rule is rewritten to satisfy it (RU2): the guards bind what is written from their approval, and the audit's corrections stand for the past.
- No check that a model or a person would have to judge is dressed as a machine check (A11; the scanner's own header).
- No new infrastructure, service or continuous-integration change; the probe reads, and the gate runs where it runs now.
- No change to the product.

---

## 4. Build order

Each stage is gated and proven before the next.

| Stage | What lands | Proven by |
|---|---|---|
| **R-a** | G1 and G2: the trigger forms, the evaluator, the judgement cadence, the Held equality; every live trigger converted | a fixture per predicate firing and not firing; a trigger true when written; a vacuous `count`; a stale judgement; a Held column differing from its row |
| **R-b** | G3 and G4: reasons, the nineteen titles, the plan table, the index | a fixture reason citing a closed row bare, and `(from ...)`; a title whose parenthetical carries a status word, and one whose body uses the word as description; an index missing a file |
| **R-c** | G6: the history and the flake check | a fixture history with a fail then a pass on one tree, unnamed and named |
| **R-d** | G5, G7 and G8: the quoting rule, the probe, and the practice written where agents read it (`dev/README.md`) | a fixture ruling without a quote; the probe run against production, its output in the private runbook |

---

## 5. Exit criteria

1. Every live held row's trigger carries `WHEN:` or `JUDGEMENT`, and the gate passes with none fired.
2. Each guard's check fails on its planted instance and passes on its control, in its test.
3. No exception record cites a closed row bare; no title under `dev/design/` or `docs/spec/` carries a status word; every design index lists every member.
4. A flake on one tree fails the gate until a row names it.
5. A ruling added after approval without a quoted director statement fails the gate.
6. The probe runs and reports production's serving revision and the agent door's throttle.

---

## 6. Coverage and yield

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

## 7. Costs and non-claims

- **A fired trigger fails the gate for an unrelated commit.** Re-triage is one row's edit; the cost is accepted because a fired trigger left silent is what the audit measured.
- **A `count` predicate is a regex**, fragile by nature; G1 makes it fail loudly when its file goes, not when its pattern stops matching -- a pattern can still drift, which the judgement cadence does not catch.
- **The flake history is per machine and untracked**; a flake on another machine is not recorded.
- **G5 binds new rulings only**; past ones stay as written, with their corrections.
- **Not claimed:** that the records are true -- only that the classes the audit measured cannot recur unseen where a machine can see them.

---

## 8. Decisions for the director

Each with a recommendation; the design is built as recommended unless ruled otherwise.

1. **A fired trigger fails the gate**, rather than being reported and passing. Recommended: fail -- a report nothing has to read is the state the audit found.
2. **The quoting rule binds rulings from its approval**, rather than marking every past ruling. Recommended: from approval (RU2) -- the past has its CORRECTED lines.
3. **The gate records flakes automatically**, rather than an agent filing them by hand. Recommended: automatically -- B164's trigger fired three times while filing was by hand.

---

## 9. Axiom alignment audit (M7)

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

## 10. Adversarial review

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
