# The network ruleset in aggregate -- every rule once, where it is ruled, where it is built, what tests it (DESCRIPTIVE)

## 1. Status

- **Written:** 2026-09-30, against drawv2 at `f5c36ca` (branch `main`), on the director's instruction: "determine the rule seams, perform a dedupe pass, and actually reason with the entire ruleset in aggregate to ensure that it is clean and efficiently implemented in code".
- **This document describes; it judges nothing.** Every row is a fact about the code or the record at `f5c36ca`. The judgement -- defects, duplication, cost, the target design and its axiom audit -- is in `RULESET-AUDIT.md`, which cites this file and is not cited by it.
- **Sources.** Rulings are numbered as in the inventory of `dev/DECISIONS.md` from line 420 to the end (#1-#87), cited by heading line. Code is cited as `file:line`. Matrix rows are ids in `BEHAVIOUR-MATRIX.json`.
- **How it was made.** Two inventories ran independently: one of the code, by an agent that did not write it, and one of the rulings and matrix. The author cross-checked both against source and reproduced the defects listed in the audit.

---

## 2. The ruleset, by concern

### 2.1 Pipes

| # | rule | ruling | code | matrix |
|---|---|---|---|---|
| P1 | a pipe is its unordered pair of anchors; at most one pipe joins a pair | #43 (822) | network/pipes.mjs:35; network/pipeset.mjs:40-46 | -- |
| P2 | a pipe is a straight line between any two anchors | #44 (834) | network/appearance.mjs:24-33 (drawn); lab/src/root.js:121-128 | -- |
| P3 | re-laying a pipe adds nothing; `hand` over `link` promotes it to `hand`, never the reverse | #31 (691) | network/pipeset.mjs:41-45 | -- |
| P4 | a pipe with an end that no longer exists is removed, `hand` included | #43 | network/pipeset.mjs:58-62; lab/src/root.js:168 | DEL-02, HP-01 |
| P5 | a `link` pipe no link is routed over is swept after an ordinary edit; `hand` pipes are never swept | #31, #83 (1331) | network/pipeset.mjs:77-85; lab/src/root.js:169 | DEL-04, HEAL-05, WP-02 |
| P6 | a down link's own legs count as in use, so they are not swept | #38 (761) | network/guide.mjs:196 | UNDO-01 |
| P7 | no gesture deletes a pipe; `pipeset.remove` has no caller in `lab/` or `network/` | -- | network/pipeset.mjs:50 | -- |

### 2.2 Routing

| # | rule | ruling | code | matrix |
|---|---|---|---|---|
| R1 | a link's intent is its ends plus ordered pins; between pins its route is the fewest pipes, ties broken by sorted id | #14 (499), #45 (843) | network/pipes.mjs:44-50, 64-83, 93-110 | ALT-01 |
| R2 | a leg with no route makes the whole link routeless | #14 | network/pipes.mjs:103 | DEL-01 |
| R3 | a link never runs the same pipe twice: each leg is routed without the pipes its earlier legs used | #85 (1347) | network/pipes.mjs:102-106 | HP-01, HP-02 |
| R4 | a pipe carries at most one link | #77 (1240) | network/pipes.mjs:132-134, 159-162 | CAP-01..06 |
| R5 | a link has first call on the `link` pipes joining its own consecutive stops, the oldest such link first; `hand` pipes are never called | #83 | network/pipes.mjs:137-140, 156-157 | HEAL-04, WP-01 |
| R6 | links are routed oldest first; each takes its fewest way over pipes not full and not called by another, and holds it | #77, #86 (1356) | network/pipes.mjs:143, 158-169 | SUP-01, CAP-06 |
| R7 | age is recorded per link in the order first noted, never forgotten; an unnoted link is the newest | #77 | network/order.mjs:19-21; lab/src/root.js:240, 289 | CAP-06 |
| R8 | the preferred route is the fewest way over all pipes, ignoring holders and callers | #78 (1275) | network/pipes.mjs:177 | WP-01 |
| R9 | a link the tab holds is routed as part of the whole board; one it does not hold (the drag preview) by R8 | #77 | network/resolve.mjs:40-42 | -- |

### 2.3 Link states

| # | rule | ruling | code | matrix |
|---|---|---|---|---|
| S1 | a link with no route is down: drawn along its intent (ends and pins), dotted, and it heals when a route returns | #7 (458), #73 (1197) | network/resolve.mjs:50, 86-88; kernel/geometry.mjs:483-494 | DEL-01, DEL-13 |
| S2 | a down link's blockers are the links holding or calling a pipe of its preferred route; none when it has no preferred route | #78 | network/pipes.mjs:184-196; network/resolve.mjs:95-97 | CAP-03, WP-01 |
| S3 | a link whose source or destination is deleted is deleted | #73 | server/txn.mjs:532-538, 557-560 | DEL-06, DEL-11, DEL-15 |
| S4 | a link that loses a deleted pin is deleted whole when no preferred route remains over pipes with both ends alive; otherwise it stays, re-routed or down | #28 (647), #74 (1215), reading 1271 | server/txn.mjs:142-150; network/guide.mjs:171-179 | DEL-02..05, DEL-10, HP-01 |
| S5 | a link that loses a hop it merely passed stays, re-routed or down | #3 (433), #73 | (derived by S1 on the next read) | DEL-09, HP-02, SUP-01 |

### 2.4 Anchors

| # | rule | ruling | code | matrix |
|---|---|---|---|---|
| A1 | a waypoint referenced before an edit and not after is swept, unless `keepsOrphan` keeps it; nodes are never swept | #71 (1178) | server/txn.mjs:217-222 | DEL-04..08 |
| A2 | production keeps a pinned or terminal orphan (B162, B216); the lab keeps none | #71 | server/txn.mjs:98, 195-205; network/guide.mjs:232 | DEL-06, DEL-07 |
| A3 | in the lab a pipe references its anchors while both ends exist and it is `hand` or carried by a route | #71, #83 | network/guide.mjs:143-154; lab/src/root.js:214 | DEL-14, WP-02 |
| A4 | threading a pinned waypoint with `w` clears `pinned` on the tab model only; the request carries no unpin (registered as B245) | B162 (as built) | app/src/input.js:999 | -- |

### 2.5 The drag grammar

| # | rule | ruling | code | matrix |
|---|---|---|---|---|
| G1 | a link drag starts on a left press on a node or waypoint | -- | app/src/recognize.js:58 | -- |
| G2 | the `w` that placed the source counts as the drag's first key while that anchor is the sole selection; every press consumes it | #87 (1363) | app/src/input.js:603, 969, 335 | SRC-01, SRC-02 |
| G3 | `w` on an empty cell places an anchor and pins it; on an existing waypoint it pins it; on a node (lab only) it adds a stop, never a pin | #80 (1296), #84 (1340), reading 1344 | app/src/input.js:981-1023 | DIR-01, w-chain |
| G4 | `g` (lab only) on an empty cell places an anchor, on an existing waypoint or node adds it, never as a pin | #80, reading 1309 | app/src/input.js:1044-1062, 1503-1505 | GST-01 |
| G5 | a drag with any `w` hop, or the source `w` with no `g`, makes a link; `g` without `w` lays pipes only; neither makes a plain link | #80, #87 | network/guide.mjs:60-61 | GST-01, SRC-03, CAP-01 |
| G6 | each key lays the pipe into its own stop from the previous one; the release lays the final pipe after any key, or after the source `w`; a plain drag lays none | #82 (1322), #87 | network/guide.mjs:63-68 | HEAL-04, GST-02, SRC-01 |
| G7 | a pipe is laid `hand` in a pipes-only drag, when it touches a `g` anchor, or when its end was reached with `g`; otherwise `link` | #70 (1168), #80 | network/guide.mjs:69-70 | GST-01, HEAL-02 |
| G8 | a released link with no pins whose pair an unpinned link already joins is refused, with a notice | reading 1310, B72 | network/guide.mjs:85-86; app/src/input.js:261-263 | HEAL-03 |
| G9 | a link drag that would move an existing up link is refused; its `g` anchors and hand pipes are kept, its `w` anchors go | #70, #77 | network/guide.mjs:97-102, 211-216 | -- |
| G10 | the drawn link is ranked newest, so it routes over what existing links leave free | #77 | network/guide.mjs:89-92 | CAP-01 |
| G11 | a released link with no free way is made down | #80 | network/guide.mjs:108 | CAP-01, CAP-02 |
| G12 | a `g` hop a link's route skips does not refuse; the notice says why | #79 (1281) | network/guide.mjs:114-120 | (unit tests only) |
| G13 | pipes a drag lays wait for the planner to accept what they belong to; with nothing to commit they are laid at once | #70 | lab/src/root.js:182-183, 219-222 | GST-01, HEAL-02 |

### 2.6 Topology edits

| # | rule | ruling | code | matrix |
|---|---|---|---|---|
| T1 | a new link ending at a waypoint another link pins cuts that link there; the src half keeps its id | #1 (425), #9 (469), #61 (1010) | app/src/input.js:1102-1150; model/invariants.mjs:194-202 | SRC-01 |
| T2 | a landing does not cut a link that only passes the point | #11 (478), #15 (517) | app/src/input.js:1132 | -- |
| T3 | two compatible links left alone at a waypoint after a removal join; loop, plane, direction, VLAN and closed links refuse | #2 (429), #21-#23, #33, #34, #66 (1060) | server/txn.mjs:270-363; model/invariants.mjs:152-191 | -- |
| T4 | a pair takes one unpinned (straight) link | B72 | model/invariants.mjs:40-42, 260-275; server/txn.mjs:378-390 | HEAL-03 |
| T5 | stripping a waypoint that would leave a link straight on a pair already holding one deletes it instead (B81) | B81 | server/txn.mjs:561-583; app/src/commands.js:94-109 | -- |

### 2.7 Feedback

| # | rule | ruling | code | matrix |
|---|---|---|---|---|
| F1 | a down link is dotted: zero dash, gap of two widths, round cap, its own width, marked `data-down` | #73 | kernel/geometry.mjs:483-494 | DEL-01 |
| F2 | down and blocking links are `#ff9800`; selection and the delete arm win | #78 | app/style.css:393-402 | LOOK-01, CAP-05 |
| F3 | selecting a down link marks its blockers `blocking`; refreshed after every settle | #78 | app/src/renderer.js:159, 171-178; lab/src/root.js:172 | CAP-03, CAP-06 |
| F4 | a selected down link says why: held by named links, or no way | #78 | network/resolve.mjs:105-111; lab/src/root.js:135 | CAP-03, WP-01 |
| F5 | notices name pipes laid, heals (pipes-only drags), refusals and skipped hops | #79-#82 | network/guide.mjs:81, 86, 101, 116-120 | GST-01, HEAL-01, HEAL-03 |
| F6 | pipes are `#8b949e`, width 3; dashed when laid with a link, solid by hand | #31 | network/appearance.mjs:24-33 | -- |

### 2.8 Session state and undo

| # | rule | ruling | code | matrix |
|---|---|---|---|---|
| U1 | pipes and link ages are session state in the lab, stored only in the format batch | #50 (895), #77 | network/pipeset.mjs:1-20; network/order.mjs:1-20 | -- |
| U2 | undo and redo replay recorded ops; no stranded check, sweep or join re-runs, and pipes are not restored | #74 (1222) | server/txn.mjs:712-762; lab/src/root.js:241 | UNDO-01 |
| U3 | the lab applies only the planner's ops that are not echoes of its own | #54 (952) | lab/src/root.js:236-238; app/src/changes.js:66-84 | -- |

---

## 3. Seams -- where the network plugin enters product modules

| seam | declared | supplied | asked |
|---|---|---|---|
| `resolvePath` | model/model.mjs:66, 212 | lab/src/root.js:87 | a link's polyline |
| `routedThrough` | model/model.mjs:77, 217 | lab/src/root.js:87 | links routed through a moved anchor |
| `linkDown` | model/model.mjs:87, 222 | lab/src/root.js:87 | is a link down |
| `blockedBy` | model/model.mjs:94, 227 | lab/src/root.js:87 | which links block a down link |
| `alsoReferenced` | server/txn.mjs:111, 173 | lab/src/root.js:214 | which anchors a model's pipes reference |
| `keepsOrphan` | server/txn.mjs:98, 222 | lab/src/root.js:215 | keep this orphaned waypoint |
| `isStranded` | server/txn.mjs:109, 145 | lab/src/root.js:217 | has a link that lost a pin no way left |
| `routeHook` | app/src/input.js:429, 273 | lab/src/root.js:179-188 | verdict on a finished drag |
| `routeHook` presence | app/src/input.js:263, 270, 1009, 1504 | lab/src/root.js:188 | B72 bypass; `w` on a node; `g` acts |
| drag flags | app/src/input.js:335, 603, 969, 1001, 1013, 1023, 1054, 1062 | read through `routeHook` | `pressed`, `endPressed`, `srcKey` |
| `down` appearance | kernel/geometry.mjs:485 | via `linkDown` | the dotted look |
| CSS states | app/style.css:398 | `data-down`, `blocking` | the orange |

---

## 4. Route computation per edit

A whole-board assignment (`assign` in network/pipes.mjs) is run by: every `pathOf` and `isLinkDown` of a link the tab holds (network/resolve.mjs:41, 87), every `blockersOf` (network/pipes.mjs:186), the sweep (network/guide.mjs:195 via lab/src/root.js:169), the planner's reference check before and after the edit (network/guide.mjs:146 via server/txn.mjs:217-218), `downSummary` per link (network/resolve.mjs:115), and `judgeDrag` twice per drag (network/guide.mjs:91-92).\
For a delete, the count is about 3L+3 plus terms in the selection size (L links).\
MEASURED at `f5c36ca`, one anchor deleted: 9 assignments on a two-link board, 15 on a four-link board, 6 on the two-link trunk board.\
The sweep and the reference check call `routesOf`, which assigns in id order; drawing and down assign in age order (network/guide.mjs:195 against network/resolve.mjs:41).

---

## 5. Decisions made in more than one place

| decision | places | how they differ |
|---|---|---|
| a pair takes one unpinned link (B72) | model/invariants.mjs:260-275; network/guide.mjs:85; app/src/input.js:261-263, 176-179; server/txn.mjs:561-583; app/src/commands.js:94-109 | the invariant exempts a link with any `via`; `judgeDrag` exempts only pins; Input exempts any route stop and is bypassed by a route hook; replug excludes itself; the two strip sites handle one or all deleted waypoints |
| whole-board assignment | network/resolve.mjs:41, 74, 96; network/guide.mjs:79, 91-92, 108, 195 | tab links and age order; authority links and age order with the drawn link newest; `routesOf` in id order, over unfiltered pipes in `pipeAnchors` and pruned pipes in the sweep |
| down = no route | network/resolve.mjs:50, 87; network/guide.mjs:108, 196; app/src/renderer.js:175; network/resolve.mjs:106 | resolve.mjs:55-58 draws straight while reporting up when a route names an anchor the tab lacks |
| the pair key | network/pipes.mjs:35; model/invariants.mjs:56; model/referential.mjs:125 | separators `\|` and `\u0000`; arguments (a, b) or a link |
| a link's stops | network/pipes.mjs:94, 138; network/guide.mjs:196; model/model.mjs:242-248 | ids or positions; `straightPath` returns null for a node in `via` |
| pipe survives with both ends alive | network/pipeset.mjs:58-62; network/guide.mjs:141, 149, 178; lab/src/root.js:125 | judged against the authority, a handed model, or the tab |
| delete cascade | app/src/commands.js:63-136; server/txn.mjs:526-589 | the client builds it in one pass; the server op by op; stranded, sweep and join only on the server |
| direction at a point | model/invariants.mjs:136-143; kernel/geometry.mjs:425-432 | identical bodies; recorded as allowed in tools/scan-twins.mjs |

---

## 6. Coverage

- **Rulings no matrix row cites:** #1-#6, #9-#27, #29, #30, #32-#70, #72, #76. Among the gesture and deletion rulings from 2026-09-29 on, only #70 (a refused `g` drag keeps its anchors) has no row; it is held by a unit test (tests/network-guide.test.js, "a refused link drag keeps its g anchors").
- **Landing cuts and crossings (T1, T2)** are held by tests outside the matrix (tests/lab-browser.test.js, "compare: a landing CUTS", "compare: a landing CROSSES"); the matrix's section 8 names them.
- **Matrix citations not found in `dev/DECISIONS.md`:** LOOK-01 ("we need to make the dots a different color - orange?"), HEAL-01 ("the director's report on the g bend"), HEAL-02 (the question on `g` against a mouseup), HEAL-04 ("w pins and draws an entirely new link in addition to the broken one"), HEAL-05 (that #83 amends #8), CAP-05 (orange because down), and the paraphrases in DEL-12, DEL-16, CAP-04 and ALT-02.
- **Ruling #20 (574)** allows a route that passes a point twice with the example A-u-B-w-B, which runs B-w twice; ruling #85 (1347) forbids a link running a pipe twice; neither mentions the other.

---

## 7. Rule mechanisms already in the tree

| mechanism | what it decides | where |
|---|---|---|
| `RECOGNIZE` | which gesture a press starts: an ordered table of 11 rules, filtered by `mutates` | app/src/recognize.js |
| `KEYMAP` | what a key does: 31 rows, filtered by three guards, each with a `when` over the event | app/src/keymap.js |
| engine rules | level-triggered: `(world, tick) -> facts`, announcing nothing | engine/rules.mjs |
| the Rules system design | the situation vocabulary rules may ask, the guard/condition split, a candidate rule table unbuilt "because nothing has needed it"; Q1, Q3 and Q4 owed | dev/RULES.md; B163, H10.34 |
| the behaviour matrix | expected outcomes as data, executed by the gate | dev/design/unification/BEHAVIOUR-MATRIX.json |
