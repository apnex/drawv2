# dev/design/unification/ -- the unification programme's design input

Written 2026-09-25 at `a986fb3`.\
Nothing here is decided: these documents carry the problem space into the design phase undecided, on the director's instruction.

| File | What it is | Standing |
|---|---|---|
| `PROBLEM-SPACE.md` | The register: every open question (PS entries), all alternatives including the status quo, how each reads under the candidate frames FR0-FR3, the test that would separate them, and the captured intent that bears on each. | Undecided. Audited for neutrality and completeness. |
| `REALITY-MAP.md` | What IS, cited to file:line: glossary, both tracks, the seam, the operation-by-door matrix, forks F1-F41, contradictions C1-C48, defects D1-D48. | Evidence. Its scratch probe scripts are not preserved. |
| `DISCUSSION-SEEDS.md` | The director's verbatim statements, leanings and questions from the design conversation (S1-S21). | Record of intent as spoken. Leanings are not rulings. |
| `BAKEOFF-LINK.md` | The link bake-off: the evidence for what a link is, relative to anchors below it and relations and flows above it, with three judges' verdicts. | Evidence. Adds no recommendation of its own. |
| `TRANSIT.md` | Transit: what an anchor does with what passes through it. | Proposed; the director's rulings on it are in `dev/DECISIONS.md`. |
| `GUIDE-ANCHORS.md` | Guide anchors: how an author routes a link through a point without connecting to it (`g`). | Proposed, with tentative working answers taken for lab validation. |
| `BEHAVIOUR-MATRIX.md` | Every lab gesture permutation, the rule it follows, and whether the lab does it -- generated from `BEHAVIOUR-MATRIX.json`, which the gate executes. | Living. Records rulings; makes none. |
| `RULESET.md` | Every network and gesture rule once: its ruling, its code, its matrix rows, the seams, the cost per edit, and the decisions made in more than one place. | Descriptive, pinned at a commit. Judges nothing. |
| `RULESET-AUDIT.md` | The audit of that ruleset: defects, duplication, cost, a consolidation design and its axiom audit. | Analytical. Proposes; the director decides. |
| `GESTURES.md` | The network plugin's keys and drag grammar -- what a finished drag makes and which pipe each hop lays -- generated from the rows the Rules engine reads. | Living. Generated; records, rules nothing. |
| `PROMOTION.md` | The plan for promoting the network plugin into production as a full cutover of every existing diagram: ten stages, risks, and the decisions to rule at the start. | Plan of record, held (B266). |

The survey envelope that captures intent is `dev/surveys/unification-survey.md`.\
Rulings stay in `dev/DECISIONS.md`; nothing here amends a ruling.\
Three of the documents above were written after this index and were missing from it until the matrix was added on 2026-09-29; an index that omits members cannot be asked whether anything is missing.
