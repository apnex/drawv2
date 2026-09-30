# The network ruleset audit -- defects, duplication, cost, and a consolidation design (ANALYTICAL)

> **Tier 3 -- interpretation, signed and dated.** Written 2026-09-30 against `f5c36ca`.
> Every fact it relies on is in `RULESET.md` and cited from there; nothing here is cited back by it.
> Disagreement with a judgement below is legitimate; disagreement with a cited fact is a defect in `RULESET.md`.

## 1. Yield

**Audited: 123 rules in code and 87 rulings at `f5c36ca`.**
- **Confirmed defects: 4.** Two lab defects and one production defect, all new (B257, B260, B258). One production defect already registered and now reproduced (B245). B260 was added after publication (F16).
- **Records conflicts: 2.** Ruling #85 contradicts #20, and an amendment to #8 is claimed but not recorded. Five matrix rows also cite statements `dev/DECISIONS.md` does not hold.
- **Consolidation findings: 6.** These cover duplicated decisions, route computation (9-15 per edit, where 1 is enough), seams, and dead values.
- **Candidates rejected: 6** (section 5).

The consolidation design (section 6) passes its axiom audit with guardrails (section 7).\
No code moves until the director approves it.

---

## 2. Scope and independence

**In scope:** every rule deciding how links, pipes, anchors and drag gestures behave in the lab.
That covers `network/`, `lab/src/root.js`, the link-drag path of `app/src/input.js`, and link splitting and keeping in `app/src/commands.js`.\
It also covers the planner's cascade, sweep, join and stranded check in `server/txn.mjs`, the link invariants in `model/invariants.mjs`, the Model's companions, and the link appearance in `kernel/geometry.mjs`, `app/src/renderer.js` and `app/style.css`.
**Out of scope:** flows, bundles, transit and naming. They are ruled, but the lab does not build them (RULESET section 6).

**Falsifiable:** each finding below names a file and line, or a ruling line, and the defects each name a reproduction.

**Independence:** the author built most of the audited code.
The code inventory was made by an agent that did not write it, and the author reproduced every defect it pointed to.\
This is a review, not a verifier's attestation.

---

## 3. Findings

| id | sev | finding | refs | disposition |
|---|---|---|---|---|
| F1 | S2 | The sweep and the planner's reference check work routes out in id order, while drawing uses age order. Since #83 lets any link use a free `w` pipe, the sweep can delete pipes a link is drawn on. MEASURED on a constructed board: a link drawn over C-x-y-D; the sweep removed all three pipes; the link was then down. | RULESET 4; network/guide.mjs:195; lab/src/root.js:169, 214; network/resolve.mjs:41 | **fix now**, B257. Cause: age was removed from `routesOf` as inert in `8ed3076`, and #83 later made it matter. Closed structurally by T2 |
| F2 | S2 | Alt+right-click delete throws `ids.has is not a function` whenever the board holds a link. Production is affected. MEASURED through the product harness. | app/src/input.js:723; app/src/commands.js:77; app/src/recognize.js:50 | **fix now**, B258. It reaches production only at the director's deploy |
| F3 | S3 | Threading a pinned waypoint with `w` unpins it on the tab only; the request carries no unpin. MEASURED: tab `pinned:false`, request `[put link]`. | RULESET A4; app/src/input.js:999 | already registered as B245 (H17.5); confirmed |
| F4 | -- | #85 (never the same pipe twice) contradicts #20 (A-u-B-w-B allowed, which runs B-w twice); neither mentions the other. | RULESET 6; DECISIONS 574, 1347 | **director:** confirm that #85 reverses #20 for the same-pipe case, then add an AMENDED line to #20 |
| F5 | -- | HEAL-05 says #83 amends #8 ("draw-then-delete leaves no trace"); #83 records the accepted cost, but #8 carries no AMENDED line. | DECISIONS 464, 1338 | **record** the line on #8 |
| F6 | -- | LOOK-01, HEAL-01, HEAL-02, HEAL-04 and CAP-05 cite director statements that are not in `dev/DECISIONS.md`. | RULESET 6 | **record** them verbatim as a late record of the 2026-09-29 review |
| F7 | S3 | "A pair takes one unpinned link" is decided in six places under three definitions of unpinned: no `via` in the invariant, no pins in `judgeDrag`, and no route stop in Input. | RULESET 5 | **consolidate**, T4 |
| F8 | S3 | Whole-board assignment runs about 3L+3 times per delete (MEASURED 9-15), in two orders, over two pipe lists. | RULESET 4 | **consolidate**, T2 |
| F9 | S3 | Seven injection points in the Model and planner, route-hook branches inside the product's Input, and drag flags all serve one consumer with one concern. | RULESET 3 | **consolidate**, T1 and T3 |
| F10 | S4 | A route naming an anchor the tab lacks is drawn straight while down is reported false. The window is transient, before the prune. | network/resolve.mjs:55-58, 87 | closed by T2 (one fact); no separate patch |
| F11 | S4 | After `w` on a node mid-drag, the live preview stops following the cursor, because `straightPath` returns null for a node stop. | network/resolve.mjs:42, 50; model/model.mjs:242-248 | within T3 |
| F12 | S4 | `keptOnRefusal` returns `placedKept`, which `judgeDrag` never passes on; `heals` in a link verdict has no consumer. | network/guide.mjs:215, 94, 115 | remove, within T3 |
| F13 | S4 | #70 (a refused `g` drag keeps its anchors) is held by a unit test only. | RULESET 6 | accept, as a declared gap (X4) |
| F14 | S4 | The lab root is at 176 of its 180-line budget, because the settle and pending-legs orchestration live there. | lab/src/root.js:160-185 | T5 |
| F15 | S3 | The drag grammar (RULESET G2-G13) lives in imperative flags in Input and conditions in `judgeDrag`, outside `RECOGNIZE`, `KEYMAP` and the Rules system. The Rules system's rule table was left unbuilt "because nothing has needed it". | RULESET 7; dev/RULES.md section 3 | T3, gated on the Rules system's owed rulings |
| F16 | S2 | Added 2026-09-30 after publication, found while writing B257's test: a request the planner refuses stays applied in the tab, because the lab's door returns on a refusal where production resynchronises. The code inventory had recorded the behaviour (its rule 99), and this audit missed it on first writing. | lab/src/root.js (`if (!answer.ok)`); app/src/sync.js (`requestResync`) | **fixed**, B260: the tab reloads from the planner |

---

## 4. What the findings have in common

F1, F7, F8 and F10 are one defect family: **one fact computed in more than one place.**\
F1 shows the cost.\
Two computations of "which pipes are in use" agreed until a later ruling changed a premise that only one of them encoded.\
The aggregate view makes this visible where defect-by-defect work could not: each rule was added correctly against the rules of its day, and the duplication accrued between them.\
T2 removes the family rather than its members.

---

## 5. Candidates rejected (default-reject)

| id | candidate | why rejected |
|---|---|---|
| X1 | unify the three pair-key functions | They sit in different layers, network and model, which do not import each other. Each is one line, and no defect follows from the copies. |
| X2 | merge `facing` and `linkFacing` | Already allowed in `tools/scan-twins.mjs`, with a recorded reason: kernel and model stay independent. |
| X3 | correct `dev/DECISIONS.md`'s internal line references (":455" for #8 at 464, ":593" for #23 at 598) | They sit in frozen entries, and readers find the heading by its text. |
| X4 | a matrix row for #70 | Staging a would-move refusal by gestures depends on id order and would be flaky; the unit test is exact. |
| X5 | unify the client and server delete cascades | This belongs to SD2's browser preview, which reaches the product at the rebuild (H17-D11). It is scheduled, not found here. |
| X6 | a general rules framework | This would be A11 mechanism against no measured need. T3 builds only the table the drag grammar needs, in the Rules system's chosen shape. |

---

## 6. Consolidation design

Each step preserves behaviour: the 42-row matrix and every test must stay green with no expected outcome edited.\
Each step is one commit, with the gate green.

**T1 -- one network interface.**\
The Model and the planner each take a single injected `network` object with a declared contract, in place of seven options.\
The contract is: the route of a link; whether it is down; its blockers; the links routed through an anchor; the anchors a model's pipes reference; whether an orphan is kept; and whether a link that lost a pin is stranded.\
Production passes none, and one test holds that it behaves exactly as today.

**T2 -- one derivation per board state.**\
A network view derived from (pipes, links, link ages) holds routes, holders, callers, down, blockers, dependents and pipes in use.\
It is computed once when any of the three changes, and every consumer reads it: drawing, down, blockers, dependents, the sweep, the planner's reference check, and the notices.\
`judgeDrag` derives its hypothetical view the same way.\
This is the level-triggered `(world) -> facts` shape the Rules system already chose (`engine/rules.mjs`).\
It closes F1 by construction, and F8 and F10.\
Target: one assignment per board state, plus two per drag judged.

**T3 -- the drag grammar as data, in the Rules system.**\
Input records the action sequence: the press on the source, each key with the kind of stop it hit, and the release target.\
The lab's rule table maps action and situation to effect: whether it pins, whether it lays a pipe and of which kind, and whether it makes a link.\
One interpreter reads the table.\
The gesture table in the design docs is generated from it (P3).\
The route-hook branches and drag flags leave Input, and F11 and F12 are closed.\
This waits for the Rules system's owed rulings, because the source-`w` rule reads the selection.

**T4 -- one home for pair capacity.**\
One predicate exported from `model/invariants.mjs`, the planner's authority, is asked by Input's release and replug gates and by `judgeDrag`.\
The strip-to-straight sites keep their delete behaviour and ask the same predicate.

**T5 -- a network session.**\
One object in `network/` owns pipes, ages, pending legs and settle.\
The lab root wires it and goes back to wiring only.

**Order:** fix F1 and F2 first, as small separate commits. Then T2, then T1 (T1 exposes T2's view), then T4, then T5, then T3 once its rulings are in.

---

## 7. Axiom alignment audit (M7)

**Identity:** this audit, `RULESET.md`, and the plan T1-T5 at `f5c36ca`, measured against the mission-kit axioms A1-A14.

**Verdict:** `pass-with-guardrails`.

| axiom | weight | how the design meets it |
|---|---|---|
| A3 Sovereign Composition | load-bearing | T1 gives one declared contract in place of seven hooks; T4 gives one home for one rule; T5 leaves the composition root as wiring only |
| A5 Perceptual Parity | load-bearing | T2: what is drawn, what is swept and what blocks come from one derivation; F1 is exactly two authorities for one fact |
| A11 Cognitive Minimalism | load-bearing | T2 cuts 9-15 computations per edit to 1; X6 declines a framework |
| A2 Isomorphic Specification | supporting | T3 turns the grammar into data the docs are generated from; the matrix already executes outcomes |
| A8 Gated Recursive Integrity | supporting | every step is gated by the matrix and the gate |
| A4 Zero-Loss Knowledge | supporting | F4-F6 put the record back in step with the rulings |
| A14 Compounding Learning | supporting | F1's cause, a rule judged inert and not revisited when a later ruling changed its premise, becomes structurally impossible under T2 |
| A1, A6, A7, A9, A10, A12, A13 | not materially implicated | A13 is met by routing D1-D4 to the director |

**Tensions.**
- **A3's Earned Exposure against T1.** T1 declares an interface with one consumer. It exposes less than the seven hooks it replaces, and it is not promoted to a stable surface, so it is allowed.
- **P4's promote-by-evidence against T3.** The evidence now exists: the Rules system left its table unbuilt for want of instances, and the drag grammar has more than a dozen. T3 is still gated on the Rules system's owed rulings.

**Guardrails.**
1. T1, T2, T4 and T5 change no behaviour: every matrix row and test stays green without any expected outcome edited.
2. Production is unchanged: the production-unchanged tests stay, and each new seam gets one.
3. The view in T2 is invalidated by every change to pipes, links or ages. A test mutates each and checks that the view follows.
4. T3 waits for the Rules system's Q1 (hover or selection only), Q3 (overlapping rules) and Q4 (a model-level, serialisable situation).
5. Every new test is proven RED by mutation.

**Closeout hooks.**
- After T2, re-measure assignments per edit. The target is one per board state, plus two per drag judged.
- Re-run the duplicates list in RULESET section 5; each consolidated row must be gone.

---

## 8. Decisions required

| # | decision | why it needs the director |
|---|---|---|
| D1 | approve T1-T5 and their order | it restructures the plugin and three product modules |
| D2 | confirm that #85 reverses #20 for a route running a pipe twice | #20 was ruled "Allow it"; #85 was ruled without it in view |
| D3 | the Rules system's Q1, Q3 and Q4 | T3 depends on them, and they are already owed (dev/RULES.md section 10) |
| D4 | register storing link ages in the format batch as a held row | #77 says ages are stored at promotion, but nothing tracks it |

---

## 9. Progress

**T2 landed, 2026-09-30 -- approved by the director ("Approved for T2").**
- **What changed.** `deriveNetwork` in `network/pipes.mjs` works a board out once, and `createNetworkView` in `network/view.mjs` keeps one derivation per board state. The key is built from every input the derivation reads, so a stale answer cannot survive a change. Drawing, down, blockers, dependents, the sweep and the planner's reference check all read it, and `routesOf` is retired.
- **Closeout hook 1 -- re-measured.** One anchor deleted costs 1 whole-board assignment on each board, against 9, 15 and 6 before (the cross, compare and trunk boards). Selecting an anchor costs 0, against 3. A drag judged still costs 2, as designed.
- **Closeout hook 2 -- duplicates.** The "whole-board assignment" and "down = no route" rows of RULESET section 5 are gone: one derivation answers both, and it reads only pipes whose ends the model holds.
- **Guardrails.** Behaviour is unchanged: 60 of 60 browser tests pass, and the matrix file is untouched. The derivation follows every change -- a pipe laid, removed or re-laid, an anchor gone, a link added, re-pinned or re-ended, an age noted -- and each property is held by a test that six mutants each fail.
- **Findings closed:** F1 (structurally, beyond B257's fix), F8 and F10.
- **One test changed its setup, not its expectation.** It routed over pipes between anchors its model did not hold; under F10 such pipes are no way, so the anchors were added to the model.

**T1 landed, 2026-09-30 -- approved by the director ("Approved for T1").**
- **What changed.** The seven hooks are one `network` object.
  The Model reads four of its methods, each under the Model's own method name: `pathOf`, `linksRoutedThrough`, `isLinkDown` and `blockersOf`.
  The planner reads three: `alsoReferenced`, `keepsOrphan` and `isStranded`.
  Each consumer declares what it reads, beside where it asks (`model/model.mjs`, `server/txn.mjs`).
  `createNetwork` in `network/network.mjs` builds the one object, and the lab hands the same object to its Model and to the planner.
- **Guardrail 1 -- production unchanged.** With no network, the Model and the planner answer exactly as before; the production tests beside each interface pass unedited.
- **Guardrail 2 -- no silent half-plugin.** A network missing a method its consumer reads is refused at construction, naming the method.
  So is a retired hook name, or any option a consumer does not read.
  `commit()` checks its network before it judges the request, so a refusal cannot hide a composition error.
- **Mutation proof.** Seven mutants, each caught: the method check removed, stray options ignored, `commit()` not checking first, `pathOf` ignoring the network, the planner ignoring `isStranded`, the factory dropping `keepsOrphan`, and the lab's planner handed no network (12 browser tests fail).
- **Behaviour.** The gate passes 1276 of 1276, with the matrix file untouched and no expected outcome edited.
  Four test files changed their setup to pass one object in place of separate hooks, not their expectations.
  One mutation test's needle was re-pointed, because its instructions name the planner's import line and T1 changed it.
- **Side effect.** The lab root fell from 178 to 174 of its 180 code lines (F14 eased, not closed).
- **Findings closed:** F9 in its injection half; the route-hook branches and drag flags in Input remain, for T3.

**T4 landed, 2026-09-30 -- approved by the director ("approved for T4").**
- **What changed.** One question decides B72 before a link exists: `pairHolders(link, among, model)` in `model/invariants.mjs`, beside the invariant and the capacity it reads.
  It returns the straight links holding the pair against a link, and is empty when there is room.
  Input's release and replug gates, `judgeDrag`, and the two cascades that strip a link's last bend (`server/txn.mjs`, `app/src/commands.js`) all ask it.
  Before, only the invariant read `straightCapacity`; the other five each assumed a capacity of one in their own way.
- **The three definitions of unpinned.** They reduce to one predicate asked of the link each site proposes.
  The planner and `judgeDrag` propose the link as it is stored, whose `via` is its pins.
  Input proposes every stop drawn, which is the same link in production; in the lab the route hook judges by pins itself, so behaviour is unchanged.
- **Guard.** `tests/pair-capacity.test.js` copies the tree, raises `straightCapacity` to 2 in the copy, and drives all six sites; each must then admit a second straight link.
  Before T4 it failed on five of the six, and only the invariant followed.
- **Mutation proof.** Each of the six sites put back on its own capacity-1 rule is caught by the guard, which names that site.
  The predicate made off by one fails 9 behaviour tests.
- **Coverage added.** The replug gate had no test that drove it; three now do, through the real gesture.
- **Behaviour.** The gate passes 1285 of 1285, with the matrix file untouched and no expected outcome edited.
  The B72, B80 and B81 tests of each site pass unedited.
- **Vocabulary.** `isStraight` and `pairKey` are private again: every caller used them to decide the pair rule, and scan-layers L10 refused them as exports the planner no longer uses.
  The undo label in `commands.js` tests `via` itself, because it names the entry rather than deciding the rule.
- **Remaining.** `model/referential.mjs` keeps its own pair key for the duplicate-bend check (RULESET section 5, "the pair key"); it compares pairs for equality only, and is outside T4.
- **Findings closed:** F7.

**T5 landed, 2026-09-30 -- approved by the director ("approved for T5").**
- **What changed.** `createNetworkSession` in `network/session.mjs` owns the network's session state: the pipe set, the link ages, the one network object over both, the legs a drag lays while the planner's answer is awaited, and that drag's notice.
  It also owns the order one edit changes them in: `judge` for the route hook, `answered` for the planner's answer, `tidy` for the prune and sweep, `takeNotice`, and `seed` for the fixed boards.
  It knows no DOM; the lab root still draws pipes and links and says the notice.
- **The lab root is wiring again.** It fell from 174 to 162 of its 180 code lines, and no network state or ordering remains in it.
- **Held in Node for the first time.** Eight tests hold the session's behaviour, which before could be reached only by driving the page: legs wait for acceptance and are dropped on refusal, legs are laid before the tab applies an answer and ages are noted after, a drag with nothing to commit lays at once, the notice is said once, the prune and the sweep.
- **Mutation proof.** Seven mutants, each caught: legs laid after the apply, legs kept after a refusal, legs laid before the answer, the notice said twice, the sweep run after undo, ages noted before the apply, and the root skipping the settle after a pipes-only drag (2 browser tests fail).
- **Behaviour.** The gate passes 1293 of 1293, with the matrix file untouched and no expected outcome edited; the browser suite passes 60 of 60.
- **Findings closed:** F14.

**T3 landed, 2026-09-30, in three commits -- approved by the director ("Proceed as recommended").**
- **The rulings it rests on.** Q1, Q3 and Q4 of `dev/RULES.md`, as recommended; the director's statement that a plugin's rules are the plugin's; and `c` in place of fill as the second example, since fill does not exist. All are recorded in `dev/DECISIONS.md`, and the design in `dev/RULES.md` section 11.
- **T3.1 -- the engine.** `kernel/input-rules.mjs` is a neutral core: it joins tenants' rows, applies the guards uniformly, and returns the one row an input means, or none.
  Two rows matching one situation is never resolved by position; `overlapsIn` is the gate's instrument, and a test reads the engine's whole text for tenant words.
  The product's key table runs on it: the one overlap the old table resolved by order, Ctrl+Shift+Backspace, is disjoint now, and `c` is two rows over the situation, with handlers that ask nothing.
- **T3.2 -- the plugin's keys.** `network/keys.mjs` brings `g` during a link drag and `w` on a node during one; the product's table names neither, and production composes no plugin.
  Input takes `plugins` in place of `routeHook`, refuses a malformed plugin or a second judge, and hands a plugin's row one declared verb, `addStop`.
  The drag is recorded as steps, so `pressedW`, `pressedG`, the separate guide list, `dropGuideWaypoint`, the node branch and `onGuideKey` are gone from Input.
- **T3.3 -- the grammar as data.** `network/grammar.mjs` holds what a finished drag makes and which pipe each hop lays, as rows the engine reads; `judgeDrag` asks them.
  `dragFacts` reads the facts from Input's record in the plugin, so routing notions left the product module.
  The pre-T3 formula is kept in a test as an oracle, and the rows give its answer for all 720 hops enumerated.
  `dev/design/unification/GESTURES.md` is generated from the rows by `tools/gesture-table.mjs`, whose `--check` is in the gate (P3).
- **F11 fixed.** After `w` on a node mid-drag the preview froze: the network resolves a preview's stops as anchors when it has no way, and production's straight polyline is untouched. Held in Node and in real Chrome, each failing without the fix.
- **F12 fixed.** `heals` left every verdict, since nothing read it; a test holds that a verdict carries only what a consumer reads. `placedKept` never left `keptOnRefusal`, so no test could observe it; it was removed without one.
- **B261 found and fixed (H10.36).** `w` during a chained link drag threw, leaving an uncommitted waypoint in the tab, since `845b18b`. Production (`2814d8d`) predates it, but the pending B258 deploy would have shipped it.
- **Mutation proof.** 28 mutants across the three commits, each caught.
- **Behaviour.** The gate passes 1328 of 1328, with the matrix file untouched and every matrix row passing in real Chrome.
  Test expectations changed only where a row changed owner or the Q3 ruling changed what is asserted: `g` no longer resolves in the product table, the opt-out list lost `guide`, and the overlap test now asserts none where it asserted one.
- **Not in T3.** I4, the generated help overlay, stays with B163 and H10.34; `RECOGNIZE` keeps its own dispatcher.
- **Findings closed:** F9 (its Input half), F11, F12 and F15.

**D2 settled, and a ruling that followed, 2026-09-30.**
- **F4 closed:** the director confirmed that ruling #85 ("never the same pipe twice") replaces #20 for a route that would run one pipe out and back; #20 carries the AMENDED line.
- **A pinned link lives and dies with its pins.** Asked about a proposer's reading -- a link whose pin is deleted, and whose only remaining way an older link holds -- the director ruled that deleting any pin deletes the link, whatever ways remain. The network's `isStranded` now answers yes for every link that lost a pin, and the route search behind the old answer is gone. Matrix row DEL-02 is reversed; DEL-09, DEL-14 and HEAL-03 are confirmed and ruled.

