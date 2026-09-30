# The lab behaviour matrix -- every gesture permutation, the rule it follows, and whether it holds (LIVING)

## 1. Status

- **Written:** 2026-09-29, against drawv2 at `f9830c7`, on the director's instruction the same day: "Let's make sure we are durably capturing our intended rules in for each of these test permutations in a matrix somewhere, such that we can refine and iterate on behaviours in a deliberate fashion".
- **The master is `BEHAVIOUR-MATRIX.json`, beside this file.** Sections 4 to 7 are generated from it by `node tools/lab-matrix.mjs --write`, and the gate fails if they differ from what it would write. Edit the JSON, never the tables.
- **It records; it does not rule.** Rulings stay in `dev/DECISIONS.md`. Each row cites the ruling it follows, or says it is the proposer's reading, or that it is open.
- **Its status column is measured, not claimed.** The gate runs every row in real Chrome with real input (`tests/lab-browser.test.js`), so no row can say it is built while the lab does otherwise.

---

## 2. How a behaviour changes

1. The director states the intended behaviour for a permutation, or rules on an open row.
2. The row's intent and checks are written in the JSON with the ruling cited, and it is marked `todo`.
3. The gate runs it, and a `todo` row must still FAIL its intent. The day the lab meets it, the gate goes red and says to promote it, so a status can never lag the code.
4. The lab is changed until the row passes, and the row is promoted to `yes`.

So a behaviour is stated in exactly one place, and nothing can claim it holds without the gate proving it.\
Changing a rule is an edit to one row, and the test follows because it reads the row.

---

## 3. The charter

**Territory.**\
Every gesture the lab offers, applied to every board state where the rules decide something different.\
The gestures are the columns of section 5 and the states are its rows.\
Both are declared in the JSON, and a row may use no others.

**Admission.**\
A row names one state and one gesture, and gives the steps that perform the gesture with real input.\
It says what should happen twice: in words for a reader, and as checks the gate runs.\
It cites the ruling it follows.\
A state carries its own board, setup and checks, so every row on it starts from the board it claims.\
A setup that fails is reported as that, rather than letting a row pass on an empty board.

**Standing and build.**
- `ruled` means the director ruled it, `reading` means it is the proposer's reading of rulings and not itself ruled, and `open` means it waits for a ruling: it carries the question, a proposal and what happens today.
- `yes` means the lab does it and the gate proves it; `todo` means it is intended and not yet built, and the gate proves it still fails.
- An open row has no checks of its own, but its steps still run and the universal invariants must still hold on it.

**Completeness.**\
Section 5 shows every state against every gesture.\
A `.` is a permutation nobody has specified yet, and `n/a` is one the board gives nothing to act on.\
A gap is not a defect: it is the list of questions not yet asked.

**Universal invariants.**\
Section 4 lists what must hold after every row, ruled or not, whatever the row checks for itself.\
They catch a defect outside a row's own question.\
A refused drag that left the tab disagreeing with the planner was found by exactly this kind of check.

---

## 4. Universal invariants

<!-- BEGIN GENERATED: invariants. Run node tools/lab-matrix.mjs --write; do not edit by hand. -->
| id | after every row, whatever it checks for itself |
|---|---|
| I1 | The tab holds exactly what the authority holds: the same links, with the same ends and pins, and the same anchors. |
| I2 | A link is drawn dotted exactly when it is down. |
| I3 | The canvas draws exactly the links that exist, each along a path. |
| I4 | No pipe names an anchor that does not exist. |
| I5 | Nothing is thrown in the page. |
| I6 | No two links that are up are drawn along the same stretch: a pipe carries one link (2026-09-30). |
<!-- END GENERATED: invariants -->

---

## 5. The matrix -- board state by gesture

<!-- BEGIN GENERATED: grid. Run node tools/lab-matrix.mjs --write; do not edit by hand. -->
| state \ gesture | delete pin | delete `g` hop | delete end | delete link | draw: mouseup on end | draw: `g` bend | draw: `g` on end | draw: `w` bend | undo | select link |
|---|---|---|---|---|---|---|---|---|---|---|
| routed | n/a | DEL-01, LOOK-01 | DEL-12 | DEL-16 | CAP-01 | GST-01, GST-02 | . | DIR-01 | . | . |
| pinned | DEL-03 | n/a | DEL-11 | . | . | . | . | . | . | . |
| pinned, another way | DEL-02 | n/a | . | . | . | . | . | . | . | . |
| pinned and passed | DEL-10 | DEL-13 | . | . | . | . | . | . | . | . |
| w-chain | DEL-04, DEL-05 | n/a | DEL-06, DEL-07 | DEL-08 | . | . | . | . | UNDO-01 | . |
| pins and a g hop | DEL-14 (reading) | DEL-09 (reading) | . | . | . | . | . | . | . | . |
| down | n/a | n/a | DEL-15 | . | HEAL-03 (reading) | HEAL-01 | HEAL-02 | HEAL-04, HEAL-05 | . | . |
| blocked | n/a | . | . | CAP-04 | . | . | . | CAP-02 | CAP-06 | CAP-03, CAP-05 |
| two g paths | . | ALT-02 | . | . | ALT-01 | . | . | . | . | . |
| w path fed by g | . | . | . | WP-02 | . | . | . | . | . | WP-01 |
| two pins beside a g path | HP-01 | . | . | . | . | . | . | . | . | . |
| a pin and a g hop beside a g path | . | HP-02 | . | . | . | . | . | . | . | . |
| older beside a younger route | . | SUP-01 | . | . | . | . | . | . | . | . |

39 rows: 39 built, 0 todo, 0 open.\
A `.` is a permutation nobody has specified yet; `n/a` is one the board gives nothing to act on.

| state | board | what it is |
|---|---|---|
| routed | `?seed=cross` | Two unpinned links routed through one anchor, over pipes laid by hand. |
| pinned | `?seed=bend` | One link pinned at one anchor, with no other way. |
| pinned, another way | `?seed=detour` | One link pinned at one anchor, with another way open below it. |
| pinned and passed | `?seed=compare` | Two links pin the left centre; two only pass the right one. |
| w-chain | blank | A link drawn by hand as a chain of w anchors, S-P1-P2-P3-E. |
| pins and a g hop | blank | A link drawn by hand as S-P1-G-P2-E: two pins with a g anchor between them. |
| down | `?seed=cross` | The routed board with its centre deleted, so both links are down (DEL-01). |
| blocked | `?seed=trunk` | Two links want one hand-laid trunk; the older holds it, so the younger is down, blocked by it. |
| two g paths | blank | Anchors S and E placed with w, then two g drags between them: a four-pipe path above and a five-pipe path below. No link. |
| w path fed by g | blank | The director's case: anchors A, B, C; a w path A-P1-P2-B; a g path from C joining P1; links A-B and C-B. A-B has first call on its w pipes, so C-B waits, blocked by it. |
| two pins beside a g path | blank | Anchors S and E, a g path below them through X, and a link S to E pinned at P and Q above, on its own w pipes. |
| a pin and a g hop beside a g path | blank | Anchors S and E, a g path below them through X, and a link S to E pinned at P, passing the g anchor Y above. |
| older beside a younger route | blank | An older link A-B on a g path through x above, and a younger link C-D on a middle g path through m1 and m2; A and B also reach the middle path, a longer way. |

| gesture | what the author does |
|---|---|
| delete pin | Select an anchor a link is pinned at (a `w` anchor), and press Delete. |
| delete `g` hop | Select an anchor a link passes without pinning, and press Delete. |
| delete end | Select a link's end, a node or an anchor, and press Delete. |
| delete link | Select the link itself, and press Delete. |
| draw: mouseup on end | Drag from one end and release on the other, pressing nothing. |
| draw: `g` bend | Drag, press `g` at a point on the way, and release on the end. |
| draw: `g` on end | Drag to the end, press `g` on it, and release there. |
| draw: `w` bend | Drag, press `w` at a point on the way, and release on the end. |
| undo | Undo the gesture before. |
| select link | Click a link to select it. |
<!-- END GENERATED: grid -->

---

## 6. Every row

<!-- BEGIN GENERATED: rows. Run node tools/lab-matrix.mjs --write; do not edit by hand. -->
| id | state x gesture | does | intended | rule | status |
|---|---|---|---|---|---|
| DEL-01 | routed x delete `g` hop | Select the centre anchor both links pass, and press Delete. | Both links stay, DOWN: dotted and straight between their ends. No pipe is created. | DECISIONS: "A down link is not a deleted link" (2026-09-29). | ruled, built |
| DEL-02 | pinned, another way x delete pin | Select the anchor the link is pinned at, and press Delete. | The pin is dropped and the link re-routes the other way, through w6 and w7, and stays up. | DECISIONS: "Deleting a point a link bends at removes that bend from the link" (2026-09-26). | ruled, built |
| DEL-03 | pinned x delete pin | Select the anchor the link is pinned at, and press Delete. | No other way exists, so the whole link is deleted; its pipes go and both nodes stay. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| DEL-04 | w-chain x delete pin | Select the middle pin, P2, and press Delete. | P1 to P3 has no pipe, so the whole link goes, with every w anchor and pipe it laid. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| DEL-05 | w-chain x delete pin | Select the first pin, P1, and press Delete. | The start has no other pipe, so the whole link goes, with every w anchor and pipe it laid. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| DEL-06 | w-chain x delete end | Select the end anchor, E, and press Delete. | The link is gone with its end, permanently, and every w anchor and pipe it laid goes with it. | The director, 2026-09-29: "if either source or dest node is deleted, link is gone with it permanently". DECISIONS: "deliberate" means held by the pipes laid with g (2026-09-29). | ruled, built |
| DEL-07 | w-chain x delete end | Select the start anchor, S, and press Delete. | The link is gone with its start, permanently, and every w anchor and pipe it laid goes with it. | The director, 2026-09-29: "if either source or dest node is deleted, link is gone with it permanently". DECISIONS: "deliberate" means held by the pipes laid with g (2026-09-29). | ruled, built |
| DEL-08 | w-chain x delete link | Select the link on its first leg, and press Delete. | The link goes, with every w anchor and pipe it laid; its own dying pipes shelter nothing. | DECISIONS: "deliberate" means held by the pipes laid with g (2026-09-29). | ruled, built |
| DEL-09 | pins and a g hop x delete `g` hop | Select the g anchor between the two pins, and press Delete. | No pin is lost, so the link stays, DOWN: dotted through both its pins, with the pipes on its intent kept for it to heal onto. | The proposer's reading, extending the director's description of a down dynamic link to a pinned one (DECISIONS, 2026-09-29). | reading, built |
| DEL-10 | pinned and passed x delete pin | Select the left centre, which both left links pin, and press Delete. | Both pinned links have no other way and are deleted whole; the two links passing the right centre are untouched and up. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| DEL-11 | pinned x delete end | Select node B, the link's end, and press Delete. | The link is gone with its end, and nothing of it remains: its pin and its pipes go too. | DECISIONS: "Seed boards give each pipe the lifetime its gesture would" (2026-09-29). | ruled, built |
| DEL-12 | routed x delete end | Select node B, and press Delete. | A-B is gone with its end; C-D still runs through the centre, and the centre and its hand pipes stay. | The director, 2026-09-29, on deleting an end. DECISIONS: pipes laid by hand stay until deleted (2026-09-27). | ruled, built |
| DEL-13 | pinned and passed x delete `g` hop | Select the right centre, which the two right links only pass, and press Delete. | No pin is lost, so both right links stay, DOWN: dotted and straight between their ends. The pinned pair on the left is untouched. | DECISIONS: "A down link is not a deleted link" (2026-09-29). | ruled, built |
| DEL-14 | pins and a g hop x delete pin | Select the first pin, P1, and press Delete. | The start has no other way, so the whole link goes. The g anchor keeps its remaining hand pipe, and that pipe keeps P2. | The proposer's reading of two rulings together: a link that loses a pin with no other way is deleted whole, and only links and pipes laid by hand keep an anchor (DECISIONS, 2026-09-29). | reading, built |
| DEL-15 | down x delete end | Select node A, and press Delete. | A-B is gone with its end, permanently: a down link does not wait to heal once an end is deleted. C-D stays down. | The director, 2026-09-29: "if either source or dest node is deleted, link is gone with it permanently". | ruled, built |
| DEL-16 | routed x delete link | Select link A-B on its left leg, and press Delete. | A-B goes. C-D still runs through the centre, which its hand pipes keep, and all four hand pipes stay. | DECISIONS: pipes laid by hand stay until deleted (2026-09-27). | ruled, built |
| LOOK-01 | routed x delete `g` hop | Select the centre anchor both links pass, and press Delete. | The down links are drawn ORANGE as well as dotted, so down reads apart from a live link at a glance. | The director, 2026-09-29: "we need to make the dots a different color - orange?". The shade is the proposer's: #ff9800, apart from the transit ring #ffb74d and the packet placeholder #ffa726. | ruled, built |
| HEAL-01 | down x draw: `g` bend | Drag from A, press g above the old centre, press g on B, and release. | g lays pipes and makes no link: the g anchor and its two hand pipes are laid, and the down A-B heals over them, drawn through the new anchor. The notice says the pipes were laid and that A-B healed. | DECISIONS: "Each drag action does one thing" (2026-09-30). The director's report on the g bend, 2026-09-29. | ruled, built |
| HEAL-02 | down x draw: `g` on end | Drag from A to B, press g on B, and release there. | g on the end lays the pipe from A to B by hand, and no link is made; the down A-B heals over it. | DECISIONS: "Each drag action does one thing" (2026-09-30). The director asked, 2026-09-29, whether g on an existing anchor should differ from a plain mouseup: it does -- g lays a pipe, a mouseup makes a link. | ruled, built |
| HEAL-03 | down x draw: mouseup on end | Drag from A, and release on B. | Nothing is made, and the notice says why: a plain drag lays no pipes, and A-B already has an unpinned link, which a pair takes one of. | DECISIONS: "Each drag action does one thing" (2026-09-30). The proposer's reading that a pair takes one unpinned link here too (B72). | reading, built |
| HEAL-04 | down x draw: `w` bend | Drag from A, press w above the old centre, and release on B. | A new link, pinned at the new anchor, is made in addition to the down A-B, which stays down. w laid the pipe into its anchor and the release on B, after a key, laid the last one -- both with the new link and carrying only it -- so the new link is up. | The director, 2026-09-29: "w pins and draws an entirely new link in addition to the broken one". DECISIONS: "A release lays the final pipe whenever a key was pressed before it" (2026-09-30). | ruled, built |
| HEAL-05 | down x draw: `w` bend | Drag from A, press w above the old centre, release on B, then delete the new link. | A-B stays down while the w link exists, which has first call on its pipes. Deleting the w link frees them, and A-B, waiting on that way, takes them and heals: the w anchor and both pipes stay, now carrying A-B. | DECISIONS: "A w pipe goes when no link is on it or resolves onto it" (2026-09-30). The director accepted that this case leaves a trace ("Yes: nothing recorded"), amending "Draw-then-delete leaves no trace" (2026-09-25) for it. | ruled, built |
| CAP-01 | routed x draw: mouseup on end | Drag from A, and release on C. | A link from A to C is made and lays no pipes. The only way, through the centre, is held by the two links already there, so it is made down, and, selected as it is made, it says the two links hold its way. | DECISIONS: "Each drag action does one thing" (2026-09-30). DECISIONS: "Pipes carry one link each, for now" (2026-09-30). | ruled, built |
| CAP-02 | blocked x draw: `w` bend | Drag from A, press w on t1, and release on B. | The new link is made, pinned at t1, but the pipe from A to t1 already carries the upper link, and a pipe carries one link: it is made down, and, selected as it is made, it says the upper link holds its way. | DECISIONS: "Each drag action does one thing" (2026-09-30). DECISIONS: "Pipes carry one link each, for now" (2026-09-30). | ruled, built |
| CAP-03 | blocked x select link | Click the lower link, which is down. | The lower link is selected, the upper link blocking its way is highlighted orange, and the notice says the lower link is down because the upper one holds its way. | DECISIONS: "Selecting a blocked link highlights the link blocking it" (2026-09-30). | ruled, built |
| CAP-04 | blocked x delete link | Select the upper link on the trunk, and press Delete. | The trunk is free, so the lower link heals and is drawn along it; the trunk's hand pipes stay. | DECISIONS: "Pipes carry one link each, for now" (2026-09-30). DECISIONS: a down link heals when a way returns (2026-09-25). | ruled, built |
| CAP-05 | blocked x select link | Click the upper link, which is up. | Selecting a link that is up highlights nothing else: only a down link has blockers to show. | DECISIONS: "Selecting a blocked link highlights the link blocking it" (2026-09-30); the lower link is orange only because it is down (2026-09-29). | ruled, built |
| CAP-06 | blocked x undo | Delete the upper link, select the lower one (now on the trunk), then undo with it still selected. | Undo restores the upper link with its age, so it takes the trunk back and the lower link is down again. The lower link is still selected, so the upper link is highlighted as its blocker at once. | DECISIONS: "Pipes carry one link each, for now" and "Selecting a blocked link highlights the link blocking it" (2026-09-30). | ruled, built |
| GST-01 | routed x draw: `g` bend | Drag from A, press g off the existing way, press g on C, and release. | g lays pipes and makes no link: the g anchor and two hand pipes are laid, and the links already there are untouched. | DECISIONS: "Each drag action does one thing" (2026-09-30). | ruled, built |
| GST-02 | routed x draw: `g` bend | Drag from A, press g off the existing way, and release on C without a key. | The drag lays only pipes, so the release on C lays the last pipe into it: the g anchor and two hand pipes, and no link. | DECISIONS: "In a drag that lays only pipes, a release on an anchor lays the last pipe into it" (2026-09-30). | ruled, built |
| ALT-01 | two g paths x draw: mouseup on end | Drag from S, and release on E. | A link is made and lays no pipes: it runs the shorter path, the four pipes above, and the path below is its alternate. | DECISIONS: "Each drag action does one thing" (2026-09-30). DECISIONS: "A g drag with a shorter free way makes the link on that way" (2026-09-30), for the director's alternate-path case. | ruled, built |
| ALT-02 | two g paths x delete `g` hop | Make the link as in ALT-01, then delete the middle anchor of the path above. | The link moves onto the path below and stays up: that is what the alternate is for. | DECISIONS: "Each drag action does one thing" (2026-09-30). DECISIONS: a link routes on by the fewest pipes when its way breaks (2026-09-26). | ruled, built |
| WP-01 | w path fed by g x select link | Click C-B, which is down. | C-B is blocked, not wayless: its way runs over A-B's w pipes, which A-B has first call on. The notice says A-B holds its way. | DECISIONS: "A w pipe goes when no link is on it or resolves onto it" (2026-09-30). | ruled, built |
| WP-02 | w path fed by g x delete link | Select A-B on its first leg, and press Delete. | C-B takes over the freed w path and comes up, drawn through P1 and P2. The pipes it runs over, and P2, stay; A's lone pipe, which no link is on, goes with A. | The director's report, 2026-09-30: "If I delete link A-B - I would expect C-B to route over the top of the now-free path". DECISIONS: "A w pipe goes when no link is on it or resolves onto it" (2026-09-30). | ruled, built |
| HP-01 | two pins beside a g path x delete pin | Select Q, the second pin, and press Delete. | The link loses Q, and the only way left from P to E runs back over S-P and round the g path below: a hairpin, which is no way. So it has no other way and is deleted whole, with P and its w pipes; the g path stays. | DECISIONS: "A link never runs the same pipe twice" (2026-09-30). DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| HP-02 | a pin and a g hop beside a g path x delete `g` hop | Select Y, the g anchor the link passes, and press Delete. | No pin is lost, and the only way left from P to E would double back over S-P: no way, so the link is down, drawn dotted through its pin P. | DECISIONS: "A link never runs the same pipe twice" (2026-09-30). | ruled, built |
| SUP-01 | older beside a younger route x delete `g` hop | Delete x, the g anchor the older link A-B passes, then click the younger link C-D. | A-B loses its way and, being older, takes the middle path C-D is routed over; C-D is down, and says A-B holds its way. | DECISIONS: "An older link may supplant a younger link's route" (2026-09-30). | ruled, built |
| DIR-01 | routed x draw: `w` bend | Drag from A, press w on node C, and release there. | A direct link from A to C, with its pipe laid with it, and up: w may be pressed on a node as the last hop. | DECISIONS: "w may be pressed on a node as the last hop" (2026-09-30). | ruled, built |
| UNDO-01 | w-chain x undo | Delete the middle pin, then undo. | One undo restores the link with its three pins and all five anchors. Its pipes are not restored, being session state until the format batch (F6), so it returns down. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29), as CORRECTED for undo. | ruled, built |
<!-- END GENERATED: rows -->

---

## 7. Open -- waiting for a ruling

<!-- BEGIN GENERATED: open. Run node tools/lab-matrix.mjs --write; do not edit by hand. -->
Nothing is waiting for a ruling.
<!-- END GENERATED: open -->

---

## 8. Not yet in the matrix

Moving an anchor or a node, and landing a link on a pinned or a passed centre, are held by older tests in `tests/lab-browser.test.js`.\
Those tests drive the planner's door and set their boards up through handles, rather than performing the gesture with real input.\
They join the matrix when its steps can drag an anchor and its checks can read an anchor's role.\
Until then they are the one place those rules are held, which is why they are named here rather than copied.
