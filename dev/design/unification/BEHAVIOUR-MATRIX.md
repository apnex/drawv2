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
| I1 | The tab holds exactly what the authority holds: the same links, with the same ends and pins, the same anchors, and the same pipes (since H17.22 N-c, when pipes became entities in both). |
| I2 | A link is drawn dotted exactly when it is down. |
| I3 | The canvas draws exactly the links that exist, each along a path. |
| I4 | No pipe names an anchor that does not exist. |
| I5 | Nothing is thrown in the page. |
| I6 | No two links that are up are drawn along the same stretch: a pipe carries one link (2026-09-30). |
| I7 | An anchor whose transit is off is never a junction, drawn or judged: what arrives there stops, so it is an endpoint (2026-10-02, B277). |
| I8 | Every pipe has one element in the page, kept whether shown or hidden, and it is seen exactly when no link that is up runs over it: the link is drawn along it (2026-10-02). |
<!-- END GENERATED: invariants -->

---

## 5. The matrix -- board state by gesture

<!-- BEGIN GENERATED: grid. Run node tools/lab-matrix.mjs --write; do not edit by hand. -->
| state \ gesture | delete pin | delete `g` hop | delete end | delete link | draw: mouseup on end | draw: `g` bend | draw: `g` on end | draw: `w` bend | undo | select link | transit `x` | draw: `w` on a non-transiting anchor | draw: `g` on a non-transiting anchor | select pipe | delete pipe | close `c` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| routed | n/a | DEL-01, LOOK-01 | DEL-12 | DEL-16 | CAP-01 | GST-01, GST-02 | . | DIR-01 | UNDO-02, UNDO-03 | . | . | . | . | PIPE-01, PIPE-02 | PIPE-03, PIPE-04, PIPE-05 | . |
| pinned | DEL-03 | n/a | DEL-11 | . | . | . | . | RFS-01 | RING-03 | . | . | . | . | . | . | RING-01, RING-02 |
| pinned, another way | DEL-02 | n/a | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| pinned and passed | DEL-10 | DEL-13 | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| w-chain | DEL-04, DEL-05 | n/a | DEL-06, DEL-07 | DEL-08 | SRC-01, SRC-02 | SRC-03 | . | . | UNDO-01 | . | TRN-23, TRN-24, TRN-25, TRN-26, TRN-27, TRN-28 | . | . | . | . | . |
| pins and a g hop | DEL-14 | DEL-09 | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| down | n/a | n/a | DEL-15 | . | HEAL-03 | HEAL-01 | HEAL-02 | HEAL-04, HEAL-05 | . | . | . | . | . | . | . | . |
| blocked | n/a | . | . | CAP-04 | . | . | . | CAP-02 | CAP-06 | CAP-03, CAP-05 | . | . | . | . | . | . |
| two g paths | . | ALT-02 | . | . | ALT-01 | . | . | . | . | . | . | . | . | . | . | . |
| w path fed by g | . | . | . | WP-02 | . | . | . | . | . | WP-01 | . | . | . | . | . | . |
| two pins beside a g path | HP-01 | . | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| a pin and a g hop beside a g path | . | HP-02 | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| older beside a younger route | . | SUP-01 | . | . | . | . | . | . | . | . | . | . | . | . | . | . |
| transit board | . | . | . | . | . | . | . | . | . | TRN-08 | TRN-01, TRN-02, TRN-03, TRN-04, TRN-05, TRN-06, TRN-07 | TRN-14, TRN-15 | TRN-16 | . | . | . |
| transit detour | . | . | . | . | . | . | . | . | . | . | TRN-09, TRN-10, TRN-11 | . | . | . | . | . |
| transit pin | . | . | . | . | . | . | . | . | TRN-35, TRN-36 | . | TRN-12, TRN-13, TRN-29, TRN-30, TRN-31, TRN-32, TRN-33, TRN-34, TRN-42 (todo) | . | . | . | . | . |
| transit two pins | . | . | . | . | . | . | . | . | . | . | TRN-17, TRN-18 | . | . | . | . | . |
| transit junction | . | . | . | TRN-19, TRN-20 | . | . | . | . | . | . | TRN-21, TRN-22 | . | . | . | . | . |
| transit ring | . | . | . | . | . | . | . | . | TRN-39 | . | TRN-37, TRN-38, TRN-40, TRN-41 | . | . | . | . | . |

95 rows: 94 built, 1 todo, 0 open.\
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
| transit board | `?seed=transit` | Two routers linked through a bare anchor by hand pipes, a lone router, and a host; no transit declared yet. |
| transit detour | `?seed=transit-detour` | The short way from A to B runs through a host, the long way over two bare anchors; no transit declared. |
| transit pin | `?seed=transit-pin` | A link from A to B pinned at P, over the pipes its w drag laid; no transit declared. |
| transit two pins | `?seed=transit-two-pins` | A link from A to B pinned at P then Q; no transit declared. |
| transit junction | `?seed=transit-junction` | Three links end at P, from A, B and C; no transit declared. |
| transit ring | `?seed=transit-ring` | A closed link through W, P, Q and V, every stop a waypoint, over the pipes of its legs; no transit declared. |

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
| transit `x` | Select anchors or nodes, and press x. |
| draw: `w` on a non-transiting anchor | Turn an anchor's transit off, then drag a link, press w on that anchor, and release beyond it. |
| draw: `g` on a non-transiting anchor | Turn an anchor's transit off, then drag a link, press g on that anchor, and release beyond it. |
| select pipe | Click a pipe to select it -- a hand pipe with no link drawn over it takes the click (H17.22 N-c2). |
| delete pipe | Select a hand pipe, and press Delete. |
| close `c` | Select a link with a bend, and press c to close it into a ring, or open it again. |
<!-- END GENERATED: grid -->

---

## 6. Every row

<!-- BEGIN GENERATED: rows. Run node tools/lab-matrix.mjs --write; do not edit by hand. -->
| id | state x gesture | does | intended | rule | status |
|---|---|---|---|---|---|
| DEL-01 | routed x delete `g` hop | Select the centre anchor both links pass, and press Delete. | Both links stay, DOWN: dotted and straight between their ends. No pipe is created. | DECISIONS: "A down link is not a deleted link" (2026-09-29). | ruled, built |
| DEL-02 | pinned, another way x delete pin | Select the anchor the link is pinned at, and press Delete. | The pin goes, and the link with it: a pinned link lives and dies with its pins. The hand-laid way below, and its anchors, stay. | DECISIONS: "A pinned link lives and dies with its pins" (2026-09-30), which reversed re-routing when a pin is deleted. | ruled, built |
| DEL-03 | pinned x delete pin | Select the anchor the link is pinned at, and press Delete. | No other way exists, so the whole link is deleted; its pipes go and both nodes stay. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| DEL-04 | w-chain x delete pin | Select the middle pin, P2, and press Delete. | P1 to P3 has no pipe, so the whole link goes, with every w anchor and pipe it laid. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| DEL-05 | w-chain x delete pin | Select the first pin, P1, and press Delete. | The start has no other pipe, so the whole link goes, with every w anchor and pipe it laid. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| DEL-06 | w-chain x delete end | Select the end anchor, E, and press Delete. | The link is gone with its end, permanently, and every w anchor and pipe it laid goes with it. | The director, 2026-09-29: "if either source or dest node is deleted, link is gone with it permanently". DECISIONS: "deliberate" means held by the pipes laid with g (2026-09-29). | ruled, built |
| DEL-07 | w-chain x delete end | Select the start anchor, S, and press Delete. | The link is gone with its start, permanently, and every w anchor and pipe it laid goes with it. | The director, 2026-09-29: "if either source or dest node is deleted, link is gone with it permanently". DECISIONS: "deliberate" means held by the pipes laid with g (2026-09-29). | ruled, built |
| DEL-08 | w-chain x delete link | Select the link on its first leg, and press Delete. | The link goes, with every w anchor and pipe it laid; its own dying pipes shelter nothing. | DECISIONS: "deliberate" means held by the pipes laid with g (2026-09-29). | ruled, built |
| DEL-09 | pins and a g hop x delete `g` hop | Select the g anchor between the two pins, and press Delete. | No pin is lost, so the link stays, DOWN: dotted through both its pins, with the pipes on its intent kept for it to heal onto. | DECISIONS: "Three readings of the delete and drag rules, confirmed" (2026-09-30) -- "Stays, shown down". | ruled, built |
| DEL-10 | pinned and passed x delete pin | Select the left centre, which both left links pin, and press Delete. | Both pinned links have no other way and are deleted whole; the two links passing the right centre are untouched and up. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29). | ruled, built |
| DEL-11 | pinned x delete end | Select node B, the link's end, and press Delete. | The link is gone with its end, and nothing of it remains: its pin and its pipes go too. | DECISIONS: "Seed boards give each pipe the lifetime its gesture would" (2026-09-29). | ruled, built |
| DEL-12 | routed x delete end | Select node B, and press Delete. | A-B is gone with its end; C-D still runs through the centre, and the centre and its hand pipes stay. | The director, 2026-09-29, on deleting an end. DECISIONS: pipes laid by hand stay until deleted (2026-09-27). | ruled, built |
| DEL-13 | pinned and passed x delete `g` hop | Select the right centre, which the two right links only pass, and press Delete. | No pin is lost, so both right links stay, DOWN: dotted and straight between their ends. The pinned pair on the left is untouched. | DECISIONS: "A down link is not a deleted link" (2026-09-29). | ruled, built |
| DEL-14 | pins and a g hop x delete pin | Select the first pin, P1, and press Delete. | The start has no other way, so the whole link goes. The g anchor keeps its remaining hand pipe, and that pipe keeps P2. | DECISIONS: "A pinned link lives and dies with its pins" and "Three readings of the delete and drag rules, confirmed" (2026-09-30) -- "P2 stays". | ruled, built |
| DEL-15 | down x delete end | Select node A, and press Delete. | A-B is gone with its end, permanently: a down link does not wait to heal once an end is deleted. C-D stays down. | The director, 2026-09-29: "if either source or dest node is deleted, link is gone with it permanently". | ruled, built |
| DEL-16 | routed x delete link | Select link A-B on its left leg, and press Delete. | A-B goes. C-D still runs through the centre, which its hand pipes keep, and all four hand pipes stay. | DECISIONS: pipes laid by hand stay until deleted (2026-09-27). | ruled, built |
| LOOK-01 | routed x delete `g` hop | Select the centre anchor both links pass, and press Delete. | The down links are drawn ORANGE as well as dotted, so down reads apart from a live link at a glance. | The director, 2026-09-29: "we need to make the dots a different color - orange?". The shade is the proposer's: #ff9800, apart from the transit ring #ffb74d and the packet placeholder #ffa726. | ruled, built |
| HEAL-01 | down x draw: `g` bend | Drag from A, press g above the old centre, press g on B, and release. | g lays pipes and makes no link: the g anchor and its two hand pipes are laid, and the down A-B heals over them, drawn through the new anchor. The notice says the pipes were laid and that A-B healed. | DECISIONS: "Each drag action does one thing" (2026-09-30). The director's report on the g bend, 2026-09-29. | ruled, built |
| HEAL-02 | down x draw: `g` on end | Drag from A to B, press g on B, and release there. | g on the end lays the pipe from A to B by hand, and no link is made; the down A-B heals over it. | DECISIONS: "Each drag action does one thing" (2026-09-30). The director asked, 2026-09-29, whether g on an existing anchor should differ from a plain mouseup: it does -- g lays a pipe, a mouseup makes a link. | ruled, built |
| HEAL-03 | down x draw: mouseup on end | Drag from A, and release on B. | Nothing is made, and the notice says why: a plain drag lays no pipes, and A-B already has an unpinned link, which a pair takes one of. | DECISIONS: the reading under "Each drag action does one thing", CONFIRMED 2026-09-30 -- nothing is made, and the notice says why. | ruled, built |
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
| SRC-01 | w-chain x draw: mouseup on end | Press w below to place S, then drag from S to the pin P1, and release. | S is still the sole selected anchor and the next gesture drags from it, so the w that placed it is the drag's first key: a link from S to P1 with its pipe, up. P1 becomes a junction, cutting the chain there. | The director's report, 2026-09-30: "it becomes a junction (correctly). However it didnt lay the pipes". DECISIONS: "The w that placed the source counts as the drag's first key" (2026-09-30). | ruled, built |
| SRC-02 | w-chain x draw: mouseup on end | Press w below to place S, click away, then drag from S to P1, and release. | The click away clears the w, so the drag follows the normal rules: a plain link that lays no pipe, made down; the junction is still made. | DECISIONS: "The w that placed the source counts as the drag's first key" (2026-09-30). "This eliminates the case where you click off the anchor to unselect it". | ruled, built |
| SRC-03 | w-chain x draw: `g` bend | Press w below to place S, then drag from S with g at a point and g on the end E, and release. | A g in the drag cancels the source w: two hand pipes are laid and no link is made, so the chain is untouched. | DECISIONS: "The w that placed the source counts as the drag's first key" (2026-09-30). Asked whether a g in the drag cancels it, the director chose "A g in the drag cancels it". | ruled, built |
| DIR-01 | routed x draw: `w` bend | Drag from A, press w on node C, and release there. | A direct link from A to C, with its pipe laid with it, and up: w may be pressed on a node as the last hop. | DECISIONS: "w may be pressed on a node as the last hop" (2026-09-30). | ruled, built |
| RFS-01 | pinned x draw: `w` bend | Draw the pinned link again: drag from A, press w on its pin, press w on B, and release. | The planner refuses a second link on the same pair bending at the same anchor. The notice says so, and the tab shows nothing of the refused link: it holds exactly what the planner holds. | Production resynchronises a tab whose optimistic change the server refused (app/src/sync.js, requestResync); the lab mounts the same rule (B260). | ruled, built |
| UNDO-01 | w-chain x undo | Delete the middle pin, then undo. | One undo restores the link with its three pins, all five anchors and its four pipes, so it returns up: pipes are ops in the edit since H17.22 N-c, and undo replays them. Until then pipes were session state and the link returned down. | DECISIONS: "A link that loses a pin with no other way is deleted whole" (2026-09-29), its undo as first worded -- "undo brings it back" -- now that pipes are in the document's edits (H17.22 N-c). | ruled, built |
| UNDO-02 | routed x undo | Lay pipes with g as in GST-01, then undo. | A g drag that makes no link is one edit: one undo removes the g anchor and both hand pipes it laid, and the board is as it was. | DECISIONS: "Each drag action does one thing" (2026-09-30); NETWORK-READS-MODEL.md section 6 -- a drag's pipes are ops in its own edit (H17.22 N-c). | ruled, built |
| UNDO-03 | routed x undo | Lay pipes with g as in GST-01, undo, then redo. | Redo lays them again: the g anchor and both hand pipes are back, as GST-01 left them. | DECISIONS: "Each drag action does one thing" (2026-09-30); NETWORK-READS-MODEL.md section 6 -- a drag's pipes are ops in its own edit (H17.22 N-c). | ruled, built |
| TRN-01 | transit board x transit `x` | Select the bare anchor, and press x. | The anchor's transit goes off and the ring shows it: dashed, light red, on the junction's rung -- a non-transiting anchor is never a junction (2026-10-02; it was thin, dashed and light orange until then). What that does to the link through it is TRN-06's (stage X2). | DECISIONS: "The transit gesture" and "The transit mark" (2026-09-28); "Transit with pipes" (2026-09-30), TR-6 and TR-7. The look AMENDED 2026-10-02: "a copy of the JUNCTION ring, but just very slightly thinner, and a light red color", "still dashed". | ruled, built |
| TRN-02 | transit board x transit `x` | Select the bare anchor, and press x twice. | Two states: the second press turns transit back on, and the ring goes. | DECISIONS: "The transit gesture" and "The transit mark" (2026-09-28); "Transit with pipes" (2026-09-30), TR-6 and TR-7. | ruled, built |
| TRN-03 | transit board x transit `x` | Select the lone router, and press x. | A router offers the choice, so its transit goes off and it shows the ring, drawn as on an anchor. | DECISIONS: "The transit gesture" and "The transit mark" (2026-09-28); "Transit with pipes" (2026-09-30), TR-6 and TR-7. | ruled, built |
| TRN-04 | transit board x transit `x` | Select the host, and press x. | A host offers no choice -- its transit is always off -- so nothing is declared, no ring is drawn, and the notice says why. | DECISIONS: "The transit gesture" and "The transit mark" (2026-09-28); "Transit with pipes" (2026-09-30), TR-6 and TR-7. | ruled, built |
| TRN-05 | transit board x transit `x` | Turn the anchor's transit off; then select the anchor and the lone router together, and press x. | Each selected anchor is flipped on its own: the anchor comes back on and the router goes off, rather than both being driven to one value. | DECISIONS: "The transit gesture" and "The transit mark" (2026-09-28); "Transit with pipes" (2026-09-30), TR-6 and TR-7. | ruled, built |
| TRN-06 | transit board x transit `x` | Select the bare anchor the link runs through, and press x. | No route may pass a non-transiting anchor, and the link has no other way: it goes down, its pipes kept for it to heal onto, and the notice counts it. | DECISIONS: "Transit with pipes" (2026-09-30), TR-1, TR-4 and TR-6. | ruled, built |
| TRN-07 | transit board x transit `x` | Select the bare anchor, and press x twice. | Turning transit back on heals the link over the same pipes. | DECISIONS: "Transit with pipes" (2026-09-30), TR-1, TR-4 and TR-6. | ruled, built |
| TRN-08 | transit board x select link | Turn the bare anchor's transit off, then click the link, which is down. | A selected down link says why: its way passes an anchor whose transit is off, and it heals when transit is turned back on. | DECISIONS: "Transit with pipes" (2026-09-30), TR-1, TR-4 and TR-6. | ruled, built |
| TRN-09 | transit detour x transit `x` | Select the host on the short way, and press x. | A host never passes routes, so the link already runs the long way; pressing x on the host is refused and changes nothing. | DECISIONS: "Transit with pipes" (2026-09-30), TR-1, TR-4 and TR-6. | ruled, built |
| TRN-10 | transit detour x transit `x` | Select the first anchor on the long way, and press x. | With the host blocking the short way and the anchor the long way, the link has no way left and goes down. | DECISIONS: "Transit with pipes" (2026-09-30), TR-1, TR-4 and TR-6. | ruled, built |
| TRN-11 | transit detour x transit `x` | Select the first anchor on the long way, and press x twice. | Turned back on, the link heals the long way -- never through the host. | DECISIONS: "Transit with pipes" (2026-09-30), TR-1, TR-4 and TR-6. | ruled, built |
| TRN-12 | transit pin x transit `x` | Select the pin P, and press x. | A link cannot bend where what arrives stops: it is cut at P into two links that both end there, each up over its own pipe, and the pipes stay. | DECISIONS: "Transit with pipes" (2026-09-30), TR-2, TR-2b and TR-3. | ruled, built |
| TRN-13 | transit pin x transit `x` | Select the pin P, and press x twice. | Turned back on, the two links left ending at P join into one again, pinned at P, keeping the id it was drawn with. | DECISIONS: "Transit with pipes" (2026-09-30), TR-2, TR-2b and TR-3. | ruled, built |
| TRN-14 | transit board x draw: `w` on a non-transiting anchor | Turn the bare anchor's transit off; then drag from R, press w on the anchor, and release on H. | A w on an anchor whose transit is off makes two links ending there, not one bending through it. | DECISIONS: "Transit with pipes" (2026-09-30), TR-2, TR-2b and TR-3. | ruled, built |
| TRN-15 | transit board x draw: `w` on a non-transiting anchor | Turn the lone router's transit off; then drag from A, press w on the router, and release on H. | On a node too: a w on a router whose transit is off makes two links ending at it. | DECISIONS: "Transit with pipes" (2026-09-30), TR-2, TR-2b and TR-3. | ruled, built |
| TRN-16 | transit board x draw: `g` on a non-transiting anchor | Turn the bare anchor's transit off; then drag from R, press w at an empty point, g on the anchor, and release on H. | In a link drag, a g on an anchor whose transit is off still lays its hand pipes, and no route passes the anchor: the new link has no other way past its pin, so it is made down, and, selected, says the anchor's transit is what keeps it down. | DECISIONS: "Transit with pipes" (2026-09-30), TR-2, TR-2b and TR-3. | ruled, built |
| TRN-17 | transit two pins x transit `x` | Turn P's transit off, then Q's. | Each cut leaves the other standing: three links, A to P, P to Q and Q to B -- cutting at Q must not join the two links already ending at P, whose transit is still off. | DECISIONS: "Transit with pipes" (2026-09-30), TR-2 and TR-5; the director's report of 2026-09-30 (B269). | ruled, built |
| TRN-18 | transit two pins x transit `x` | Turn P's transit off, then Q's, then P's back on. | Turning P back on joins only the two links ending at P: A to Q pinned at P, and Q to B, cut where Q's transit is still off. | DECISIONS: "Transit with pipes" (2026-09-30), TR-2 and TR-5; the director's report of 2026-09-30 (B269). | ruled, built |
| TRN-19 | transit junction x delete link | Turn P's transit off, then select the link from C and press Delete. | Two links are left ending at P, and P's transit is off, so they stay two: what arrives at P stops there. | DECISIONS: "Transit with pipes" (2026-09-30), TR-5; "Two separately drawn links left alone at a point join into one" (2026-09-26). | ruled, built |
| TRN-20 | transit junction x delete link | Select the link from C and press Delete, transit untouched. | With transit on, the two links left alone at P join into one, as ruled -- the comparison TRN-19 departs from. | DECISIONS: "Transit with pipes" (2026-09-30), TR-5; "Two separately drawn links left alone at a point join into one" (2026-09-26). | ruled, built |
| TRN-21 | transit junction x transit `x` | Select P, where three links end, and press x. | What arrives at P stops there, so P is an endpoint for each of the three links -- drawn with the endpoint ring and the transit ring, never a junction -- and the links stay three. | DECISIONS: "A non-transiting anchor has endpoints only, under one ring" (2026-10-02), B277; TRANSIT.md section 4. | ruled, built |
| TRN-22 | transit junction x transit `x` | Select P, where three links end, and press x twice. | Turned back on, the three links meet at P again: a junction, with no transit ring -- the comparison TRN-21 departs from. | DECISIONS: "A non-transiting anchor has endpoints only, under one ring" (2026-10-02), B277; TRANSIT.md section 4. | ruled, built |
| TRN-23 | w-chain x transit `x` | Select the first two pins, P1 and P2, together, and press x. | Both cuts are one edit, each made on the board the one before it leaves: the link becomes three straight pieces -- S to P1, P1 to P2, P2 to E pinned at P3 -- each up over its own pipes, and none overlaps another. | The director's report, 2026-10-02 (B283); DECISIONS: "Transit with pipes" (2026-09-30), TR-2 -- many anchors at once, each flipped on its own (2026-09-28). | ruled, built |
| TRN-24 | w-chain x transit `x` | As TRN-23, then press x again with both still selected. | Turned back on, the pieces join into the one link again, pinned at all three, up. | The director's report, 2026-10-02 (B283); DECISIONS: "Transit with pipes" (2026-09-30), TR-2 -- many anchors at once, each flipped on its own (2026-09-28). | ruled, built |
| TRN-25 | w-chain x transit `x` | Select P1 and P3, which are not neighbours, together, and press x. | Three pieces again -- S to P1, P1 to P3 pinned at P2, P3 to E -- each up, none overlapping. | The director's report, 2026-10-02 (B283); DECISIONS: "Transit with pipes" (2026-09-30), TR-2 -- many anchors at once, each flipped on its own (2026-09-28). | ruled, built |
| TRN-26 | w-chain x transit `x` | As TRN-25, then press x again with both still selected. | Turned back on, they join into the one link, pinned at all three, up. | The director's report, 2026-10-02 (B283); DECISIONS: "Transit with pipes" (2026-09-30), TR-2 -- many anchors at once, each flipped on its own (2026-09-28). | ruled, built |
| TRN-27 | w-chain x transit `x` | Make the link a control link with k, then select the middle pin P2 and press x. | Cut in two at P2, and both halves are still control links: a cut keeps the link's plane, and its direction. | The director's report, 2026-10-02 (B284); DECISIONS: "Transit with pipes" (2026-09-30), TR-2; H15.15 (a control and a data link do not join). | ruled, built |
| TRN-28 | w-chain x transit `x` | As TRN-27, then press x again. | Turned back on, the two control halves join into the one control link, pinned at all three -- a control half beside a data half never could. | The director's report, 2026-10-02 (B284); DECISIONS: "Transit with pipes" (2026-09-30), TR-2; H15.15 (a control and a data link do not join). | ruled, built |
| TRN-29 | transit pin x transit `x` | Cut at P with x, make the left half a control link with k, and turn P back on with x. | A control half and a data half do not join: P is left a junction, transit on, two links ending there. | DECISIONS: "Two links at a junction join when an edit makes them compatible" (2026-10-02), B285; the 2026-09-28 ruling, "If 2 links are remaining on an anchor post some mutation, and they are compatible types and direction, they are to be joined". | ruled, built |
| TRN-30 | transit pin x transit `x` | As TRN-29, then make the right half a control link with k too. | Now both are control links, compatible, at a junction: they join in that edit, into the one control link pinned at P -- no need to turn transit off and on. | DECISIONS: "Two links at a junction join when an edit makes them compatible" (2026-10-02), B285; the 2026-09-28 ruling, "If 2 links are remaining on an anchor post some mutation, and they are compatible types and direction, they are to be joined". | ruled, built |
| TRN-31 | transit pin x transit `x` | Make the link control, cut at P, set the left half forward and the right half reverse -- both arriving at P -- and turn P back on. | Two control links whose directions both arrive at P are not compatible: P is left a junction, transit on. | The director's report, 2026-10-02 (B286); DECISIONS: "Two links at a junction join when an edit makes them compatible" (2026-10-02). | ruled, built |
| TRN-32 | transit pin x transit `x` | As TRN-31, then press f on the right half, which clears its direction. | An undeclared link opposes nothing, so the two are compatible and join in that edit -- the clear is a declaration changed, though written as a whole-entity put. | The director's report, 2026-10-02 (B286); DECISIONS: "Two links at a junction join when an edit makes them compatible" (2026-10-02). | ruled, built |
| TRN-33 | transit pin x transit `x` | As TRN-31, then press f on the left half, which reverses it to match. | Now one leaves P and one arrives: compatible, they join in that edit. | The director's report, 2026-10-02 (B286); DECISIONS: "Two links at a junction join when an edit makes them compatible" (2026-10-02). | ruled, built |
| TRN-34 | transit pin x transit `x` | As TRN-31, then select the right half -- the one a join gives up -- and press f. | They join into the link drawn first, and the selection follows: the joined link is selected, as the half that was. | The director's report, 2026-10-02 (B288); DECISIONS: "A join keeps the earlier-drawn link's name and identity" (2026-09-26). | ruled, built |
| TRN-35 | transit pin x undo | Select the pin P, press x, and undo. | Transit is stored on the anchor, so the cut and the setting are one edit: undo turns P back on and restores the one link pinned at P, with the id it was drawn with -- the session's setting could not be undone. | DECISIONS: "Transit with pipes" (2026-09-30), TR-7 -- the setting is stored with promotion's format batch ("P2's design decisions", 2026-10-03; FORMAT-BATCH.md F-e). | ruled, built |
| TRN-36 | transit pin x undo | As TRN-35, then redo. | Redo replays the edit whole: P off again, and the link cut into the same two links ending there. | DECISIONS: "Transit with pipes" (2026-09-30), TR-7 -- the setting is stored with promotion's format batch ("P2's design decisions", 2026-10-03; FORMAT-BATCH.md F-e). | ruled, built |
| TRN-37 | transit ring x transit `x` | Select the pin P, and press x. | A ring has no ends to cut toward, so it opens at P: one link that starts at P, runs round Q, V and W, and ends at P again -- P its endpoint, never a junction, with the transit ring; drawn where it was, up over the ring's own pipes. | DECISIONS: "Transit off at a ring's pin opens the ring there" (2026-10-07), B299. | ruled, built |
| TRN-38 | transit ring x transit `x` | As TRN-37, then press x again. | Turning transit back on closes the loop into a ring again, through P. | DECISIONS: "Transit off at a ring's pin opens the ring there" (2026-10-07), B299. | ruled, built |
| TRN-39 | transit ring x undo | As TRN-37, then undo. | Undo restores the ring exactly, P's transit on again. | DECISIONS: "Transit off at a ring's pin opens the ring there" (2026-10-07), B299. | ruled, built |
| TRN-40 | transit ring x transit `x` | Turn P's transit off, then Q's; then Q's back on, then P's. | The ring opens at P and is cut at Q into two links between them; Q back on joins them into a loop still ending at P, and P back on closes it: the ring is whole again, both corners passing (B300). | DECISIONS: "Transit off at a ring's pin opens the ring there" (2026-10-07), B299; B300 -- a loop exists only while its end's transit is off. | ruled, built |
| TRN-41 | transit ring x transit `x` | As TRN-40, but turn P back on first, then Q. | In the other order the ring is whole too: P back on joins the two into a loop ending at Q, and Q back on closes it (B300). Which piece keeps its id follows the order the corners return, and is not ruled; the row holds the shape. | DECISIONS: "Transit off at a ring's pin opens the ring there" (2026-10-07), B299; B300 -- a loop exists only while its end's transit is off. | ruled, built |
| TRN-42 | transit pin x transit `x` | Close the link into a ring with c, then select the pin P and press x. | A ring through two routers whose transit is on passes through them as junctions, so it opens at P like any ring: one link that starts at P, runs round B and A -- pinned through them -- and ends at P again, P its endpoint, drawn where it was. Today: P's transit turns off and the ring is left as it was, valid: until H19.10 a pin must be a waypoint, so only a ring of waypoints opens. | DECISIONS: "A device is an endpoint or a junction, by what the network plugin gives it" (2026-10-07), B301; built at H19.10. | ruled, TODO |
| RING-01 | pinned x close `c` | Select the link on its left leg, and press c. | The ring's closing leg, from B back to A, is routed like any leg: a link pipe is laid there in the same edit, and the ring is up over it, drawn closed as before -- the drawing joins B to A itself, along that pipe. | DECISIONS: "Promotion's start-of-work decisions, P-3 to P-10" (2026-10-03), P-3 -- a ring's closing leg is routed like any leg; FORMAT-BATCH.md F-f. | ruled, built |
| RING-02 | pinned x close `c` | As RING-01, then press c again. | Opened, nothing runs over the closing pipe, so it is swept as any link pipe a link stops using is; the link is as drawn. | DECISIONS: "Promotion's start-of-work decisions, P-3 to P-10" (2026-10-03), P-3 -- a ring's closing leg is routed like any leg; FORMAT-BATCH.md F-f. | ruled, built |
| RING-03 | pinned x undo | As RING-01, then undo. | One edit closed the ring and laid its pipe, so one undo opens it and takes the pipe back. | DECISIONS: "Promotion's start-of-work decisions, P-3 to P-10" (2026-10-03), P-3 -- a ring's closing leg is routed like any leg; FORMAT-BATCH.md F-f. | ruled, built |
| PIPE-01 | routed x select pipe | Lay pipes with g as in GST-01, then click the free hand pipe from A to the g anchor. | A hand pipe with no link over it takes the click: it alone is selected. | DECISIONS: "Hand pipes can be selected and deleted; link pipes cannot" (2026-10-02, N6), building "a pipe the author placed by hand stays until the author deletes it" (2026-09-27); B281. | ruled, built |
| PIPE-02 | routed x select pipe | Click a hand pipe the upper link is drawn over, at its middle. | A pipe a link is drawn over is covered by the link, so the click takes the link, not the pipe. | DECISIONS: "Hand pipes can be selected and deleted; link pipes cannot" (2026-10-02, N6), building "a pipe the author placed by hand stays until the author deletes it" (2026-09-27); B281. | ruled, built |
| PIPE-03 | routed x delete pipe | Lay pipes with g as in GST-01, click the pipe from A to the g anchor, and press Delete. | The pipe goes, and only it: the g anchor stays, held by its other hand pipe, and the links are untouched. | DECISIONS: "Hand pipes can be selected and deleted; link pipes cannot" (2026-10-02, N6), building "a pipe the author placed by hand stays until the author deletes it" (2026-09-27); B281. | ruled, built |
| PIPE-04 | routed x delete pipe | As PIPE-03, then undo. | Deleting a pipe is an edit like any other: undo lays it back. | DECISIONS: "Hand pipes can be selected and deleted; link pipes cannot" (2026-10-02, N6), building "a pipe the author placed by hand stays until the author deletes it" (2026-09-27); B281. | ruled, built |
| PIPE-05 | routed x delete pipe | Lay pipes with g as in GST-01, then delete both of its hand pipes, one after the other. | With its last hand pipe gone the g anchor is held by nothing, so the planner sweeps it: g anchors are held by their pipes (2026-09-29). | DECISIONS: "Hand pipes can be selected and deleted; link pipes cannot" (2026-10-02, N6), building "a pipe the author placed by hand stays until the author deletes it" (2026-09-27); B281. And "in the lab only links and pipes laid by hand keep an anchor" (2026-09-29). | ruled, built |
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
