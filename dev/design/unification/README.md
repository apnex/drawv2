# dev/design/unification/ -- the unification programme's design input

Written 2026-09-25 at `a986fb3`.\
Nothing here is decided: these documents carry the problem space into the design phase undecided, on the director's instruction.

| File | What it is | Standing |
|---|---|---|
| `PROBLEM-SPACE.md` | The register: every open question (PS entries), all alternatives including the status quo, how each reads under the candidate frames FR0-FR3, the test that would separate them, and the captured intent that bears on each. | Register. |
| `REALITY-MAP.md` | What IS, cited to file:line: glossary, both tracks, the seam, the operation-by-door matrix, forks F1-F41, contradictions C1-C48, defects D1-D48. | Evidence. |
| `DISCUSSION-SEEDS.md` | The director's verbatim statements, leanings and questions from the design conversation (S1-S21). | Evidence. |
| `BAKEOFF-LINK.md` | The link bake-off: the evidence for what a link is, relative to anchors below it and relations and flows above it, with three judges' verdicts. | Evidence. |
| `TRANSIT.md` | Transit: what an anchor does with what passes through it. | Design. |
| `GUIDE-ANCHORS.md` | Guide anchors: how an author routes a link through a point without connecting to it (`g`). | Design. |
| `BEHAVIOUR-MATRIX.md` | Every lab gesture permutation, the rule it follows, and whether the lab does it -- generated from `BEHAVIOUR-MATRIX.json`, which the gate executes. | Generated. |
| `BEHAVIOUR-MATRIX.json` | The behaviour matrix's data, which the gate executes and `BEHAVIOUR-MATRIX.md` is generated from. | Generated. |
| `RULESET.md` | Every network and gesture rule once: its ruling, its code, its matrix rows, the seams, the cost per edit, and the decisions made in more than one place. | Descriptive. |
| `RULESET-AUDIT.md` | The audit of that ruleset: defects, duplication, cost, a consolidation design and its axiom audit. | Audit; H17.13. |
| `GESTURES.md` | The network plugin's keys and drag grammar -- what a finished drag makes and which pipe each hop lays -- generated from the rows the Rules engine reads. | Generated. |
| `PROMOTION.md` | The plan for promoting the network plugin into production as a full cutover of every existing diagram: ten stages, risks, and the decisions to rule at the start. | Plan; H18.47. |
| `NETWORK-READS-MODEL.md` | Promotion's stage P1 run in the lab: pipes become entities the network plugin brings, every pipe change an op, so undo restores pipes; four decisions before any code. | Delta; H17.22. |
| `AGENTS-LAY-PIPES.md` | Promotion's P6: agents lay and lift pipes by verb, as the browser's `g` does. | Delta; H18.30. |
| `SERVER-COMPOSES-NETWORK.md` | Promotion's P3: the server composes the network, so every door plans with it. | Delta; H18.10. |
| `CONSUMERS-ROUTE.md` | Promotion's P4: every consumer of a path routes over pipes -- REST, the CLI, the download. | Delta; H18.17. |
| `PAGE-COMPOSES-NETWORK.md` | Promotion's P5: the product page composes the network plugin. | Delta; H18.24. |
| `PAGE-HELD-TO-MATRIX.md` | Promotion's P7: the behaviour matrix runs on the product page, in the gate. | Delta; H18.36. |
| `FORMAT-BATCH.md` | Promotion's P2: the stored format batch -- schema 2, waypoints as nodes with no type, pipes stored. | Delta; H18.2. |
| `FINAL-REHEARSAL.md` | Promotion's P8: the final dry run on production's backup and the staging rehearsal. | Plan; H18.41. |
| `SYNC-HARDENING.md` | H19.5: the tab-sync fuzz ported to today's composition, then the defects it measured. | Delta; H19.5. |
| `DEVICE-JUNCTIONS.md` | H19.10: a device that passes routes may be a junction. | Delta; H19.10. |
| `KINDS-AS-PLUGINS.md` | H19.7: every kind becomes a plugin's -- zones, groups, then the node's fields; the core holds only the anchor. | Delta; H19.7. |
| `PLUGIN-QUERIES.md` | H19.26: the Model's questions to the network become the network's own functions. | Delta; H19.26. |
| `CANVAS-PLUGINS.md` | H19.23: a plugin brings its kind onto the page -- the canvas names no plugin's kind beyond a record. | Delta; H19.23. |
| `WIDE-DEVICES.md` | H19.8: a wide device is one anchor; the grids stored as layout records; schema 3. | Delta; H19.8. |
| `UNIFICATION-AUDIT.md` | The re-audit of 2026-10-11: the code against the ruled target ontology, the exceptions and held rows, the record-against-truth incidents mined to root cause, and the approach proposed (stages U0 to U5). | Audit; H21.1. |
| `RECORD-GUARDS.md` | H21.5 (U1): the guards that keep the records true -- trigger evaluation, a generated Held column, structured decoupling exceptions and rulings -- with two adversarial reviews. | Delta; H21.5. |
| `ARCHITECTURE-REVIEW.md` | H21.6 (U2): the reviews of the architecture record -- `docs/ARCHITECTURE-TARGET.md` and the generated `docs/ARCHITECTURE.md` -- each finding with its disposition. | Audit; H21.6. |
| `MISSION-KIT-ALIGNMENT.md` | H21.9: the target aligned with mission-kit -- each part compared with mission-kit's registered and proposed components, the code not migrated. | Design; H21.9. |
| `TYPE-AS-COMPOSITION.md` | H21.3 (U4, B282): one declaration per device type in the devices plugin, handed to the plugins at composition and served to the CLI. | Delta; H21.3. |

The survey envelope that captures intent is `dev/surveys/unification-survey.md`.\
Rulings stay in `dev/DECISIONS.md`; nothing here amends a ruling.\
Three of the documents above were written after this index and were missing from it until the matrix was added on 2026-09-29; an index that omits members cannot be asked whether anything is missing.\
AMENDED 2026-10-11 (H21, U0): thirteen more had gone missing -- every promotion and H19 design -- and are listed above; the index is held complete by a check at U1.\
AMENDED 2026-10-11 (H21.5): the Standing column names each member's type, and its board item where it has one -- whether the work is proposed, approved or built is the board's to say, and the column had drifted from it; `tools/scan-designs.mjs` holds the column to that form and the index to the folder.
