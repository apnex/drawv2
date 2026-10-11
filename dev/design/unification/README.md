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
| `NETWORK-READS-MODEL.md` | Promotion's stage P1 run in the lab: pipes become entities the network plugin brings, every pipe change an op, so undo restores pipes; four decisions before any code. | Delta, proposed. |
| `AGENTS-LAY-PIPES.md` | Promotion's P6: agents lay and lift pipes by verb, as the browser's `g` does. | Delta, approved 2026-10-04; built. |
| `SERVER-COMPOSES-NETWORK.md` | Promotion's P3: the server composes the network, so every door plans with it. | Delta, approved 2026-10-03; built. |
| `CONSUMERS-ROUTE.md` | Promotion's P4: every consumer of a path routes over pipes -- REST, the CLI, the download. | Delta, approved; built. |
| `PAGE-COMPOSES-NETWORK.md` | Promotion's P5: the product page composes the network plugin. | Delta, approved 2026-10-04; built. |
| `PAGE-HELD-TO-MATRIX.md` | Promotion's P7: the behaviour matrix runs on the product page, in the gate. | Delta, approved 2026-10-04; built. |
| `FORMAT-BATCH.md` | Promotion's P2: the stored format batch -- schema 2, waypoints as nodes with no type, pipes stored. | Delta, approved 2026-10-03; built and deployed at the cutover. |
| `FINAL-REHEARSAL.md` | Promotion's P8: the final dry run on production's backup and the staging rehearsal. | Plan, approved 2026-10-06; executed. |
| `SYNC-HARDENING.md` | H19.5: the tab-sync fuzz ported to today's composition, then the defects it measured. | Delta, approved 2026-10-07; built (H19.13 to H19.17). |
| `DEVICE-JUNCTIONS.md` | H19.10: a device that passes routes may be a junction. | Delta, approved 2026-10-07; built; its role drawing is B331. |
| `KINDS-AS-PLUGINS.md` | H19.7: every kind becomes a plugin's -- zones, groups, then the node's fields; the core holds only the anchor. | Delta, approved; built (O-a to O-e). |
| `PLUGIN-QUERIES.md` | H19.26: the Model's questions to the network become the network's own functions. | Delta, approved (Q1); built. |
| `CANVAS-PLUGINS.md` | H19.23: a plugin brings its kind onto the page -- the canvas names no plugin's kind beyond a record. | Delta, approved; built (C-a to C-f); its carried items are B328 to B330. |
| `WIDE-DEVICES.md` | H19.8: a wide device is one anchor; the grids stored as layout records; schema 3. | Delta, approved 2026-10-10; built (WD-a to WD-c). |
| `UNIFICATION-AUDIT.md` | The re-audit of 2026-10-11: the code against the ruled target ontology, the exceptions and held rows, the record-against-truth incidents mined to root cause, and the approach proposed (stages U0 to U5). | Evidence and a proposal; the director rules the approach (H21.2). |

The survey envelope that captures intent is `dev/surveys/unification-survey.md`.\
Rulings stay in `dev/DECISIONS.md`; nothing here amends a ruling.\
Three of the documents above were written after this index and were missing from it until the matrix was added on 2026-09-29; an index that omits members cannot be asked whether anything is missing.\
AMENDED 2026-10-11 (H21, U0): thirteen more had gone missing -- every promotion and H19 design -- and are listed above; the index is held complete by a check at U1.
