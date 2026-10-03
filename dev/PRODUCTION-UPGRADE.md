# Production upgrade -- considerations register

What a production upgrade must check, gathered as the work that creates each consideration lands rather than reconstructed at deploy time.\
Read in full at a **production audit**: before production moves off the revision it runs, and again before promotion's cutover.

Production runs `2814d8d`.\
Every entry below is true of `main` and not yet of production.\
AMENDED 2026-10-02: production runs `d58816c` (`draw-00154-cfn`), deployed after the audit at the end of this file; entries PU1 to PU16 and PU24 to PU29 are now true of production, PU17 to PU23 still wait for promotion's cutover. The register continues: an entry is added for each change production does not yet have, and it is read again before the cutover.

## How to use it

An entry is added in the commit that creates the consideration -- a changed behaviour a user or an agent would notice, a new or removed public path, a change to a stored or wire shape, an operational step, or something deferred to the upgrade.\
Each entry names its source, and what the audit checks.\
At the audit, each entry is marked CHECKED with the evidence, or carried forward with its reason; an entry is never deleted (M4).\
The held backlog row B276 is this register's trigger: it fires when the director schedules a production deploy or audit.

---

## 1. Behaviour a user or an agent will notice

| # | Consideration | Source | The audit checks |
|---|---|---|---|
| PU1 | Deleting a closed ring now removes its end waypoints too; production left them behind as stray anchors. | B244, `bca4dcf` | a ring deleted in production leaves no waypoint |
| PU2 | A paced commit reveals only the entities it created; a beat that renames an entity no longer hides it until its turn. | B272, `f4bb143` | a paced rename shows the entity throughout |
| PU3 | A commit refused for an over-long caption no longer leaves the edit applied with no record. | B270, `2ebb619` | a refused REST commit changes nothing and leaves no undo |
| PU4 | Removing one of several duplicate straight links is accepted; production refused a partial repair. | B271, `2ebb619` | a diagram with three straight links on a pair can drop to two |
| PU5 | Every peer lists links in id order, so a spawner arms the same link everywhere; a cascade's ops may arrive in a different order, leaving the same document. | B246, `4f0fd80` | two tabs on one diagram animate the same link from an armed endpoint |
| PU6 | A downloaded SVG names nodes and zones in the canvas's label colour (`#ddddff`), not `#e6e9ee`. | B275, `14f357b` | a fresh download matches the canvas |
| PU24 | Colours moved to the nearest Material palette colour, all slightly: canvas labels and page text `#ddddff` to Indigo 50 `#e8eaf6`; zone fill and stroke to Blue Grey 300 and 200; the beam to Red A200; the beat caption and two greys to Grey 300 and 500; three dark status colours (undelete's restore button, whoami's hover) to Blue Grey 900, 800 and Grey 800, so the restore button loses its green tint. The full list is the 2026-10-01 palette ruling in `dev/DECISIONS.md`. | palette, 2026-10-01 | the deployed page compared with a screenshot of the old, the undelete card among it |
| PU26 | A link drawn to another link's bend splits it into halves that both keep its control plane and its direction; production made both halves plain data links with no direction. | B284, H17.24 | a control link with a direction, landed on at a bend in production, leaves two dashed, arrowed halves |
| PU27 | Two links meeting at a waypoint join into one when an edit to one of them makes their plane and direction compatible (`k`, `f`, or the REST/CLI equivalents); production joined only when a third link left. A second link drawn to a point still never joins. | B285, H17.25; B286, H17.26 (a cleared direction too) | a control and a data link meeting at a waypoint, the data one made control in production, become one link bending there |
| PU28 | A selected link that a join absorbs hands its selection to the link it joined into, in the tab's own answers and another writer's changes alike; production left nothing selected. | B288, H17.27 | in production, two links joined by a change to the selected one leave the joined link selected |
| PU7 | `draw place` sends the relationship every time and reads the position from the server's answer; it no longer resolves an anchor itself. Production's planner already resolves place ops (B189), so an updated CLI works against either server. | PL-4, `73e2d9e` | `draw place ... --dir right` lands where it did before the upgrade |

---

## 2. Public paths and what the server serves

| # | Consideration | Source | The audit checks |
|---|---|---|---|
| PU8 | The planner moved to `planner/`, served whole at `/planner/`; nothing in `server/` is served, by the product or the lab. | K4, `7630d73` | `/planner/txn.mjs` is 200; `/server/store.js`, `/server/identity.mjs`, `/server/anchor.mjs` are 404 |
| PU9 | The three barrels are deleted, so `/kernel/index.mjs`, `/engine/index.mjs` and `/model/index.mjs` are 404; folders are mounted because they exist. | K2c, `f7673ec` | nothing outside the repository imports a barrel; each folder serves a module |
| PU10 | A path that walks out of a served folder is answered 404, where production answers 403. | K9, `1a364fe` | traversal requests answer 404, and no monitor keys on the old 403 |
| PU11 | The page loads `/tokens.css`, the generated colour registry, before `/style.css`. | H15.23, `72ac4aa` | the deployed page's colours match the canvas in the lab |
| PU12 | The product page loads 51 modules where production loads 57, and imports no barrel or export-only module. | K2b, `743e1aa` | the page boots and its network panel shows no 404 |

---

## 3. Stored and wire shapes

| # | Consideration | Source | The audit checks |
|---|---|---|---|
| PU25 | Validation is restructured, accepting what it accepted: each kind is a row carrying its field checks, its cross-entity check and its cap (`planner/kinds.mjs`), the id grammar is built from the rows instead of a literal, and the planner refuses a model composed with other kinds. New node and waypoint ids no longer share their 6-hex part across the two kinds -- still the old format. | H17.22 N-a | the production planner corpus, the gesture corpus and the validator's tests pass unchanged on the deployed revision, and a document saved before the upgrade loads after it |
| PU29 | The planner keeps a change set per transaction and calls reactions by declared trigger instead of each scanning the edit (H17.28, built in stages). Behaviour identical -- every planner, gesture and matrix corpus unchanged at each stage. | B287, H17.28 | the planner corpus and gesture corpus pass unchanged on the deployed revision |
| PU13 | No stored-format change since `2814d8d`: templates, examples and the validator's fields are unchanged, and change records keep the reveal under the same field names. A rollback to `2814d8d` reads every document written after the upgrade. | measured 2026-10-01 | `git diff 2814d8d -- templates examples` is empty and a document saved after the upgrade loads on the old image |

---

## 4. Operations

| # | Consideration | Source | The audit checks |
|---|---|---|---|
| PU14 | The image copies `planner/` (Dockerfile). | K4, `7630d73` | the built image serves `/planner/txn.mjs` |
| PU15 | CI fails a run that skips any test, so a browser suite cannot stop silently. | B250, `7f1c366` | CI's last run reports `skipped 0` and `scan-skips: PASS` |
| PU16 | The agent door has no Cloud Armor; deliberately IAP-free and still unthrottled. | H10.30 | carried: the director's call, independent of this upgrade |

---

## 5. Deferred to promotion's cutover

Ruled to land with promotion (`dev/design/unification/PROMOTION.md`), so each is a cutover consideration rather than a deploy one.

| # | Consideration | Source |
|---|---|---|
| PU17 | Stored drawing order for every item, newest on top for every peer; undo restores an item to its place. | B249, B10 |
| PU18 | Link ages and pipes stored in the document, one migration with PU17. | B259, P2 |
| PU19 | The kind table injected into a composition, so `pipe` is a sixth kind. | B273, PL-5 |
| PU20 | The browser previews with the planner itself; its three rule copies are deleted. | PD-5, PL-6, B221 |
| PU21 | A link landing on a bend is cut at every door, not only in the browser. | B243, K18a |
| PU22 | The network plugin's colour roles move from the network layer's kernel-side module into `network/`, beside the rest of the plugin. | the palette design, 2026-10-01 |
| PU23 | One device table in `network/`, replacing the `NODE_TYPES` literal the held tools carry. | K6 |

AMENDED 2026-10-02: PU19's mechanism is built (H17.22 N-a, PU25), and `pipe` is the network plugin's kind rather than a sixth core kind (N1); what remains for the cutover is the stored format.

---

## Audit 2026-10-02 -- production `2814d8d` to `d58816c`

At the director's word, approving the re-triage's step 2 and to proceed as recommended, read in full before the deploy.\
Production ran `draw-00153-4sj` on `draw:2814d8d`; the bucket `gs://diagrams.apnex.io` was copied first, 45 objects, 1,110,578 bytes, matching, into the private archive (`drawv2-archive/backups/2026-10-02-pre-d58816c/`).\
CI's gate passed on `d58816c`; the local gate passed 1716 of 1716.\
Production sits behind IAP, which a headless browser cannot sign into, so an entry whose check is looking at the page is marked for the director's eye after the deploy.

| # | Verdict | Evidence |
|---|---|---|
| PU1 | CHECKED, pre-deploy | tests/sweep-references.test.js B244 |
| PU2 | CHECKED, pre-deploy | tests/txn.test.js B272 |
| PU3 | CHECKED, pre-deploy | tests/txn.test.js B270 |
| PU4 | CHECKED, pre-deploy | tests/txn.test.js B271 |
| PU5 | CHECKED, pre-deploy | tests/link-order.test.js (B246) |
| PU6 | CHECKED, pre-deploy | tests/appearance.test.js (B275) |
| PU24 | DIRECTOR'S EYE, after deploy | the palette gate passes; the slight colour moves, the undelete card among them, are seen on the page |
| PU26 | CHECKED, pre-deploy | tests/input.test.js and tests/network-transit.test.js B284 |
| PU27 | CHECKED, pre-deploy | tests/txn.test.js B285 (cleared and reversed directions) |
| PU28 | CHECKED, pre-deploy | tests/apply-answer.test.js B288 |
| PU7 | CHECKED, pre-deploy | tests/cli-tool.test.js, `draw place` against the planner's placement (PL-4) |
| PU8 | CHECKED, pre-deploy | tests/static.test.js; the same image serves `/planner/txn.mjs` in the lab today |
| PU9 | CHECKED, pre-deploy | scan-layers L4: no barrel, none imported |
| PU10 | CHECKED, pre-deploy | tests/static.test.js traversal answers 404 |
| PU11 | DIRECTOR'S EYE, after deploy | tests/browser.test.js boots the page with `/tokens.css`; colours seen on the page |
| PU12 | DIRECTOR'S EYE, after deploy | tests/browser.test.js boots the product page with no 404; the deployed network panel |
| PU25 | CHECKED, pre-deploy | the planner and gesture corpora unchanged since N-a; tests/kinds.test.js |
| PU29 | CHECKED, pre-deploy | every corpus unchanged at each stage of H17.28; tests/trigger-shadow.test.js |
| PU13 | CHECKED, pre-deploy, AMENDED | templates and examples unchanged since `2814d8d`. New since it was written: the planner's join writes `into` on a delete op into the change log (TG-1b). `2814d8d`'s log reader checks a record only for `seq`, `from` and arrays of ops and inverses (`server/log.mjs` `#readable`), and its apply ignores an unknown op field, so a rollback still reads every document and log written after the upgrade |
| PU14 | CHECKED, pre-deploy | the image is the lab's, which serves `/planner/` (H17 C5's test holds the Dockerfile) |
| PU15 | CHECKED | CI run on `d58816c`: success |
| PU16 | CARRIED | the director's call, H10.30, independent of this upgrade |
| PU17 to PU23 | CARRIED | deferred to promotion's cutover by ruling; not in this deploy |

**Found while auditing, not caused by this deploy:** production logs "internal error handling resume: Cannot read properties of undefined (reading 'version')" every five minutes -- a tab resuming against a template, whose model the store holds and whose log it does not (`server/protocol.js` `resume`, `server/store.js` `log`). The code is unchanged since `2814d8d`, so the deploy carries it as it was; registered B290.

**Deployed 2026-10-02:** `draw-00154-cfn` serving `draw:d58816c` (digest `c7d7f283`), 100% of traffic; minimum and maximum one instance and CPU throttling off, as before.\
Verified, not assumed: the revision booted against `gs://diagrams.apnex.io` and loaded 43 diagrams, 4 templates, 11 workspace grants across 4 owners and the agents' connection codes; the bucket still holds 45 objects, so it reloaded rather than reseeded.\
At the edge: `/` and `/api/v1/diagrams` answer 302 to sign-in, `/about` and `/privacy` 200 -- IAP and the public pages as they were.\
No warning, error or 5xx in the new revision's logs in its first minutes.\
Rollback, held: redeploy `draw:2814d8d` (revision `draw-00153-4sj`), which reads everything written since (PU13), with the bucket's copy as the last resort.\
Owed to the director's eye: PU11, PU12 and PU24 -- the page's colours, its network panel, the undelete card.
