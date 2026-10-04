# Production upgrade -- considerations register

What a production upgrade must check, gathered as the work that creates each consideration lands rather than reconstructed at deploy time.\
Read in full at a **production audit**: before production moves off the revision it runs, and again before promotion's cutover.

Production runs `2814d8d`.\
Every entry below is true of `main` and not yet of production.\
AMENDED 2026-10-02: production runs `d58816c` (`draw-00154-cfn`), deployed after the audit at the end of this file; entries PU1 to PU16 and PU24 to PU29 are now true of production, PU17 to PU23 still wait for promotion's cutover.\
The register continues: an entry is added for each change production does not yet have, and it is read again before the cutover.

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
| PU30 | A tab reconnecting to a template is answered (at version 0) instead of the server throwing on every reconnect -- the error production logged every five minutes; and a reconnect to a diagram the caller may not read is refused, typed `forbidden`, where it threw and the client heard nothing. | B290, H17.29 | no "internal error handling resume" in the deployed revision's logs |
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
| PU31 | Production is frozen on `draw:2538ab8` from the format batch's first stage (H18.3) until the cutover: `main` then writes schema 2, which that image refuses. A fix production needs is built on a branch from `2538ab8`, deployed from there, and landed on `main`. | F3, H18.2 | production serves `2538ab8` or a commit on its fix branch, until P9 |

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
| PU40 | A waypoint goes with its last link, ends included (ruled 2026-09-29), where production keeps a link's end and a pinned waypoint (B162, B216); and two links left at a waypoint join only where its transit passes (TR-5). Both reach production with P3. | 2026-09-29, TR-5, H18.10 |
| PU41 | An agent's link with bends gets a pipe for each leg that has no way; a plain `draw link a b` lays none, and comes up down where no way exists, until P6 gives agents pipe verbs (G2). `pinned` leaves `draw set` and the stored document. | G2, P-5, H18.10 |
| PU53 | Pipes appear wherever an agent reads a diagram: `draw get pipes` (or `get pipe <anchor>` for the pipes at one), a PIPES table in `show`, a list beneath `map`'s grid, and a pipe count in `dump`, `status` and `diagrams --counts` -- each pipe's ends by name, how it was laid, and the links that run over it. | P6 W-c, H18.33 |
| PU52 | `draw pipe <a> <b>` lays a pipe by hand between two anchors and says which links came up over it; `draw pipe <a> <b> --off` removes it and says which went down; `draw rm` takes a pipe by its id, and its report of what a deletion took names pipes too. | P6 W-b, H18.32 |
| PU51 | REST serves `/pipes` like any collection: `GET` lists and reads them, `POST {a, b}` lays a pipe by hand between two anchors (its id the one its ends make), `DELETE` removes one. REST's collections are read from what the server composes, so a request to an unknown collection is still `404`. | P6 W-a, H18.31 |
| PU50 | The page shows an edit's whole consequence at once: it previews each commit with the server's planner, so deleting a pin takes its link, deleting a link shows a join, and a sweep or a cut shows, before the server answers (B221). The browser sends only what the author did -- a delete of the selected entities, a group's put -- so log records and undo labels are unchanged in shape but carry fewer ops; an edit the planner refuses shows nothing rather than appearing and snapping back. | P5 V-d, H18.28, PL-6 |
| PU49 | A link landing on another link's bend cuts that link there through REST and the CLI, as a drag on the page always did (B243): the cut link keeps its id and its declarations, and its new piece takes an id derived from the cut. A request landing a straight link on a bend whose pair already holds a straight link is refused, where it was accepted with the other link left bending through. | P5 V-c, H18.27, B243 |
| PU48 | The product page draws what the lab draws: each link along its route over pipes, pipes no up link runs over (a link's dashed, a hand pipe solid), and a down link dotted and orange. `g` lays a hand pipe, `x` turns an anchor's transit off and on, and a drag lays its link's pipes with it. The header banner says what the network says -- a selected down link and why, what an edit left down, what a transit toggle cut or joined -- until the next status. | P5 V-b, H18.26, J3 |
| PU47 | A spawner on a down link emits nothing until the link heals -- in `draw movers`, `draw combat` and, from P5, the page; production's page has no down links until then. | P4 R-d, H18.22 |
| PU46 | A downloaded SVG is what run mode shows (H2, refined): no waypoint anchor ring, nothing at a bend but the corner its route turns, no pipe; endpoints keep their pads, junctions their marks, anchors their transit ring. Every download with a waypoint changes. Links follow their routes, and a down link is drawn dotted and orange as on the canvas. Run mode itself draws, rather than hides, the same picture -- the same look. | P4 R-c, H18.21 |
| PU45 | REST's link answers grow three fields, in `context/<link>` and `links/<link>/path`: `route`, the anchor ids its route runs through; `down`; and `blockers`, the links holding a down link's way (H1). `draw link path` says whether the link is down and what holds it, and `draw about` prints a link's route or that it is down -- and its path, which it printed as `undefined,undefined -> ...` (B292). Nothing is removed or renamed. | P4 R-b, H18.20, B292 |
| PU44 | REST's `path` for a link, in `context/<link>` and `links/<link>/path`, and `draw movers` and `draw combat`, follow the link's route over pipes where they followed the straight line through its stops; the two differ only where a route takes another way between stops, which no estate link does after migration. A down link's path is its intent, as before. | P4 R-a, H18.19 |
| PU43 | The link is the network plugin's kind (`network/link-kind.mjs`), not the product's: the product's own kinds are node, zone and group, and every composition production runs -- the store, the product page, the CLI's `combat` and `movers` -- adds the link with the network. Behaviour identical: the planner, gesture and matrix corpora are unchanged, and the stored format does not change. A caller that validates or builds a Model with the product's kinds alone now refuses a link; nothing in production does. | G5, B280, H18.15 |
| PU42 | Every existing link gets its pipes at the cutover: one per leg, a ring's closing leg and a plain link included -- 783 in the estate, so every link comes up along exactly the stops it has. A younger link sharing a leg with an older one would be split into a junction at the leg's ends (P-4); the estate has none. `pinned` is dropped from every waypoint -- 104 -- and `w` no longer stores it; a waypoint placed with no link still stays until deleted. The shipped templates carry their pipes. | F2, P-3, P-4, P-5, H18.14 |
| PU39 | Deleting a pin deletes its link, in existing diagrams as in new work (P-7): every bend in the estate becomes a pin -- 302 bends on 90 links -- so deleting a waypoint a link bends at removes that link whole, where production strips the bend and keeps the link. Reaches production with P3, which composes the network's tenant on the server. Recorded at H18.9: the P-7 ruling named this register and no entry had been made. | P-7, H18.9 |
| PU32 | A link's declared direction is stored as `direction`, `forward` or `reverse`, where it was `flow`, `true` or `false`; `set`, `show`, `get`, REST and the CLI's flag name it so. | F1, P-9 |
| PU34 | Undo history from before the cutover is dropped, each diagram keeping its version, so the next edit continues the numbering (P-6); the stored format is `meta.schema` 2, which images before it refuse, so the rollback is the backup (P-8). Every document entering the store -- boot, `create`, templates, examples, restore -- passes through one migration first, so a tab open across the cutover that posts its old document is migrated rather than refused. | P-6, P-8, H18.3 |
| PU33 | Every waypoint id becomes a node id with the same hex (`waypoint-1a2b3c` becomes `node-1a2b3c`), 3 renumbered; names are unchanged and still resolve. People and agents still call a node with no type a waypoint (F4). | P-10, F4 |
| PU36 | Stacking is the same for everyone and survives undo: every node, link and zone stores `order`, newest on top; a deleted item brought back by undo returns to its place, not the top. An agent's or the CLI's creation gets its order from the server, which answers with a `set` of `order` after the put it sent -- so a commit's answer carries that extra op. Links' ages, which decide who keeps a contested pipe, are the same order. | B249, B10, B259, H18.6 |
| PU37 | Transit is part of the document (TR-7): a node stores `transit` where its author chose other than its type's default, and every peer, the export and undo read it. In the lab `x` is now an edit: it is undone and redone with the links it cut or joined, and it bumps the version. Agents set it with `draw set <ref> transit on|off|default` or any commit; the network refuses a value a type does not offer (a host never passes routes). The downloaded SVG draws a waypoint whose transit is off as the canvas does -- endpoints only, with the transit ring. Production reads the field as nothing until P3 composes the network. | TR-7, B277, H18.7 |
| PU38 | A ring's closing leg is a route like any other leg (P-3): closing a link lays a pipe from its end back to its start in the same edit, so the ring can be down there, held there by another link, and undone with its pipe; opening it sweeps that pipe. The 17 rings in the estate get their closing pipes from the migration's pipe step at P3. | P-3, H18.8 |
| PU35 | The stored document has four kinds: `waypoints` is gone and a waypoint is a node with no `type` (P-10). REST answers `/nodes` with both shapes and has no `/waypoints`; a commit names `kind: 'node'` for a waypoint; `draw get waypoints`, `draw map` and `draw parity` still say waypoints, read off the nodes with no type; `draw` given an old `waypoint-` id says which `node-` id it became. Whether a node has a type is fixed when it is made, as the two kinds were. | P-10, F4, H18.5 |

AMENDED 2026-10-04: P5 is built on `main` (H18.24 to H18.29) as PU22, PU48, PU49 and PU50, reaching production at the cutover under PU31. V-e changes nothing a user sees: every Model production builds already drew with the network; a caller building one that holds links without it is refused.\
AMENDED 2026-10-04: PU22 is built on `main` (H18.25, V-a): the network's colour roles and appearance are in `network/`; `network/tokens.css` is generated from there, unchanged.\
AMENDED 2026-10-04: P4 is built on `main` (H18.17 to H18.23) as PU44 to PU47, reaching production at the cutover under PU31. Measured on the migrated estate: 464 links, none down, so a download's links do not move at the cutover; its waypoints change to the run picture (PU46).\
AMENDED 2026-10-04: PU43 is built on `main` (H18.15); with it, since H18.16, the planner and the validator take no default composition: a caller passes its kinds -- the store, the lab and the CLI already did -- and one that does not is refused by name, where it was given the product's kinds and, for a document, passed its links unread. Every change P3's design listed (`SERVER-COMPOSES-NETWORK.md` section 7) has its entry: PU39, PU40, PU41, PU42 and PU43; P3 changes nothing a production user sees until the cutover (PU31).\
AMENDED 2026-10-04: PU18's stored pipes are built on `main` (H18.14) as PU42, with PU41's `pinned` retirement; both reach production at the cutover under PU31.\
AMENDED 2026-10-03: PU37 is built on `main` (H18.7), reaching production with PU31's cutover.\
AMENDED 2026-10-03: PU17 and PU18's link ages are built on `main` (H18.6) as PU36; PU18's stored pipes wait for P3 (F2).\
AMENDED 2026-10-03: PU33 and PU35 are built on `main` (H18.5), and reach production at the cutover under PU31.\
AMENDED 2026-10-03: PU32 and PU34 are built on `main` (H18.3) and reach production at the cutover under PU31; with PU32, the edit labels and notices read `direction forward`, `direction reverse` and `direction cleared` where they read `flow ...`, and the `f` key's help line says direction.\
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

**Deployed 2026-10-03:** `draw-00155-hfx` serving `draw:2538ab8` -- the B290 fix (PU30), at the director's word, on top of `d58816c`.\
Booted against the bucket with the same 43 diagrams and 4 templates; the edge unchanged (`/` 302, `/about` 200).\
PU30 CHECKED by its tests (tests/resume.test.js "B290"), not by the logs: none of the error in the new revision's first ten minutes, but none in the previous revision's last two hours either -- its last occurrence was 2026-10-02 07:22 UTC, so the tab that met it had already closed, and production could not have shown the fix.\
Rollback: redeploy `draw:d58816c`.
