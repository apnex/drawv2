# Production upgrade -- considerations register

What a production upgrade must check, gathered as the work that creates each consideration lands rather than reconstructed at deploy time.\
Read in full at a **production audit**: before production moves off the revision it runs, and again before promotion's cutover.

Production runs `2814d8d`.\
Every entry below is true of `main` and not yet of production.

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
