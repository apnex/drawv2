# H17 plan: the lab canvas, and the cuts that make it minimal

**Status:** the plan of record for milestone H17 on `dev/BOARD.md`. It takes the place of the unversioned bench as the source a cut is built from.\
The director's direction and the twelve H17 rulings are in `dev/DECISIONS.md` ("The lab canvas" and "H17 lab decisions").\
This file carries the cut plan, the guardrails and the conditions those rulings were made on, so that nothing a cut depends on lives only outside the repository.

**Where the evidence lives.**\
The measurements, the design, the independent review and both axiom alignment passes are in the lab-design bench, outside this repository.\
Its path is `/home/apnex/taceng/drawv2-archive/lab-design`, and the bench is durable but unversioned.
- The first M7 pass is the bench file named measure2.
- The second M7 pass is the report under m7-pass2/audit, with its sha256.
- The independent check of the second pass is the file named m7-check.

Figures below are MEASURED in those files unless marked INFERRED.

## 1. Baseline and target

- **Today:** the canvas page loads 50 modules and 515,781 bytes of JavaScript (10,396 lines, of which 57% of the bytes are comments), in 55 requests.
- **The planner:** loads 31 modules to use 15, mostly through the three barrel files.
- **Lab v1:** after K0-K10, 35 modules and 405,856 bytes, with the real planner in the page (H17-D8).
- **The end of H17:** after K11-K17 and K18a:
  - the lab is 38 modules and 390,495 bytes, 24% under today's page;
  - the planner is 15 modules and 142,913 bytes, loading neither the theme nor the renderer;
  - the production page is 49 modules and 479,065 bytes.

That the real cuts produce these numbers is INFERRED from the import graph.

## 2. Guardrails (first M7 pass, as re-rated by the second pass and its check)

| # | Guardrail | Status |
|---|---|---|
| G1 | Mount, never fork: every change the lab needs lands in the real module, with a test | held |
| G2 | Never serve `server/` wholesale | held (K4's 404 test) |
| G3 | One apply path per Model, and no copied key filter | held (K1) |
| G4 | Preview/server divergence is impossible by construction, or a typed event, never a silent replacement | PARTIAL until the typed-correction owner is named (C9e) |
| G5 | The planner and the renderer derive in one order | PARTIAL: K15 orders the queries by id, but `all()` iteration and renderer stacking stay insertion-ordered (C8, follow-up F-ORDER) |
| G6 | The plugin boundary is enforced by a scanner, with no generic loader, registry or versioning until a second plugin exists | held |
| G7 | New stored kinds stay unreachable from production doors until the batch lands | held (K17, L7, L7k) |
| G8 | The device table has one literal and reaches its consumers by injection | DEVIATION accepted by the director (H17-D6): imported, not injected |
| G9 | The B176 guard follows the shared closure | held (K16) |
| G10 | Rule defects are found below the canvas; a visual defect gets a downward audit and a test | held |
| G11 | Planner refusals are visible in the lab canvas | held (K8 notice sink, C7) |
| G12 | Lab evidence is never cited as production proof | held, subject to follow-up F-GR6. STRENGTHENED 2026-09-28: the lab is now deployed at `lab.apnex.io`, so it is visible and citable by anyone, and the guardrail matters more rather than less |
| G13 | Every boundary rule is a gate scanner | held (K0) |
| G14 | Decisions go to the director one at a time | held |

## 3. The layer rules (K0)

These are the rules of the layer manifest and its scanner, which K0 adds to the tools folder and the gate:
- **L1:** each module belongs to one layer.
- **L2:** imports follow the layer direction. `import()` counts as an edge, and a non-literal specifier is refused.
- **L3:** C9 holds: `kernel/` and `model/` import nothing from each other.
- **L4:** no barrel imports, where a barrel is any module with a top-level `export ... from` or `export *`.
- **L5 and L5p:** core exports no network names. Both are PROXIES: they check names, not meaning (C3).
- **L6:** each entry's closure equals its declared list.
- **L7:** no batch module is reachable from a product root.
- **L7k:** the product's kind lists equal exactly node, waypoint, link, zone and group. Condition C3 extends it to the id grammar at `server/validate.js:43`; the other kind literals are consumers and are recorded as such.
- **L8:** `lab/` is composition only.
- **L9:** canvas imports of rule primitives. This is a PROXY, and it reads 2 while three restated rules remain (C10).
- **L10:** export-level minimality (H17-D9), specified by condition C2:
  - its entries are named (the lab root and the planner entry);
  - a listed name that is no longer unused fails the scan, and it leaves the list in the same commit that gives it a consumer;
  - a name may join the list only from the frozen K0 baseline, or move with its symbol;
  - each entry is tagged rebuild-debt (K13d) or serves-a-server-door.
- **L11:** no `window` or `globalThis` reads in core, network or planner. The canvas is a ratchet at 3.

`scan-dead`, `scan-docrefs`, `scan-twins`, `scan-writers` and the B176 guard read their folder lists from the manifest.

**As built at K0 (2026-09-27), where the scanner goes beyond the wording above.**\
The K0 attack found 11 holes in the first build, and the fix pass closed them.\
So the rules now also:
- **L2:** judges re-export edges. It refuses absolute, URL and out-of-repo specifiers, undeclared bare packages, and code loaders (`require`, `createRequire`, `eval`, `Function`, `node:vm`, `node:module`, and import-shaped string literals). A `?` or `#` suffix is dropped before resolving.
- **L4:** counts barrels per re-exported name as well as per import site.
- **L6:** also reads every HTML page: a page's script tags must equal its entry's roots, and inline scripts and `javascript:` URLs are refused.
- **L7k:** fixes the whole shape of the id grammar.
- **L11:** also reads `self` and `global`, with identifier escapes decoded.
- **Ratchets:** they have a frozen ceiling, whose sha256 is pinned in `tests/scan-layers.test.js`. A key that moves with its module needs the ceiling and its pinned hash edited in the same commit.

The known proxy gaps are labelled in the manifest:
- L11 does not resolve scopes, so `top`, `parent` and `frames` are not read;
- L10 knows a moved symbol only by its name;
- code built from a string at run time (a Worker, a script element made in the DOM) cannot be seen by a static scan.

The K0 counts on the real tree: L2 4 edges; L4 123 sites and 94 re-exported names; L5 19; L5p 15; L7k 17 recorded consumers; L9 2; L10 153 listed; L11 canvas 3.\
The rest are 0.\
The entry closures match section 1: page 50 modules, planner 31.

## 4. The cuts, in order

Every cut ships with a test proven RED plus a mutant, and ships to production as it lands (H17-D2), unless marked otherwise.

| Cut | What | Conditions and notes |
|---|---|---|
| K0 | The layer manifest and scanner (section 3) | C1, C2 and C3 met first (section 5). DONE 2026-09-27: 40 tests, 36 fixture trees, 43 mutants, 11 attack defects fixed |
| K1 | B242: the tab applies the server's planned ops that are not identical to what it sent, then replays its unanswered ops (H17-D3) | C4: tests assert convergence AND that no own edit regresses (the mutant "full answer, no replay" is killed only by the second); add the live-drag case; state whether undo and redo acks replay pending | DONE 2026-09-28: `derivedToApply`, one rule for acks and other writers' changes; ten further reconcile defects fixed (B242's CLOSED note); the replay is narrowed to the entities the answer wrote, which gives the same document outside a gesture and no snapback during one (the fix pass's reading of C4, INFERRED equivalent; see DECISIONS H17-D3). DEPLOYED 2026-09-28 in `draw-00153-4sj` (image tag `2814d8d`), with B239-B241. The SERVER half is verified live: a cascading delete answers with the derived ops (`rm x1` reports the sweep taking the waypoint and the link), A5 parity holds, and 23 of 23 diagrams survive a forced cold boot -- the check that matters, since B239 and B241 destroy a document at `validateDoc` on the next read, not at commit. The BROWSER half is NOT verified live: `/ws` has no agent-door entry (`AGENT_DOOR` in `server/app.js` maps two prefixes and websockets are deliberately not one), so a two-tab convergence probe cannot reach the deployed service without an IAP session. It rests on the K1 fuzz -- 91 of 300 runs diverged before, 3 after -- and those 3 are reconnect-only, ruled as B251. Open: B251-B254 |
| K2a | The planner imports each name from its defining module | DONE 2026-09-28: nine import lines in `server/txn.mjs`, `server/validate.js` and `server/anchor.mjs`; the planner closure falls 31 modules / 275,933 bytes to 15 / 175,116, the module count the plan predicted. C2(c) EXTENDED by the director: a consumer leaving the closure also vacates, judged against a frozen `k0closure` whose sha256 is pinned |
| K2b | Canvas, server, CLI and test files import from defining modules (125 sites) | DONE 2026-10-01: 115 sites in 51 files, rewritten by script and checked by `scan-layers`; the barrel imports fall from 115 to 11, every one of them a user of `render`, which `kernel/index.mjs` defines until K2c moves it. The page closure falls 57 to 51 modules and the lab's 65 to 55, the barrels and the export path (`kernel/engine.mjs`, `grc.mjs`, `adapt.mjs`) no longer loaded by either. Mutant A24b moved to `server/svg.mjs`, which still imports a barrel. |
| K2c | Delete the three barrels (H17-D4); the mount check becomes "the folder exists"; `render` moves to `server/svg.mjs` | RED: GET one module per mounted folder. DONE 2026-10-01: the test in `tests/server.test.js` went red when the barrels were deleted and green when `server/app.js` mounted each folder because it exists. `render` moved to `server/svg.mjs`; `check`, which nothing calls, moved to `kernel/grc.mjs` for K12 to judge with it. The barrels hid 30 exports with no production consumer (9 referenced nowhere, 21 by tests only), allowed under one `K12:` reason in `tools/scan-dead.mjs`. Deleting them also opened a hole in L10's borrowed-spelling rule -- about ninety re-exported names stood vacated, and mutant A14 got through -- closed by counting a name's real home as claiming its vacancy. Mutants A5, A5b and A24b now plant their own barrel. |
| K3 | `plan()` and `commit()` take the anchor resolver by injection | updates `tests/anchor-resolve.test.js`. DONE 2026-10-01 by the planner programme's PL-4 (`73e2d9e`): the store passes `place: resolveAnchor`, the planner closure lost `server/anchor.mjs`, and the CLI's own resolver went with it. |
| K4 | `planner/` served whole: `txn.mjs`, `log.mjs`, `validate.js`, `policy.mjs` (H17-D5) | RED: `server/store.js`, `identity.mjs` and `anchor.mjs` stay 404. DONE 2026-10-01: six files moved -- the four named, and `tenants.mjs` and `edges.mjs`, which PL-3 and PL-4 added to the planner since. `planner/` is a folder layer, mounted whole by the lab and by the product (the page's canvas imports the group policy from it); `server/` is served by neither. The lab's five named planner files and its `/server/` branch are deleted. RED shown against the pre-K4 tree: the lab test asking the server for `planner/txn.mjs` failed. 89 import sites re-pointed by script and 93 code references by path; doc records keep the old paths under one wildcard per file (M4). |
| K5 | Input takes its run-mode rules from the composition root | DONE 2026-10-01, in two parts, because the rows alone left the debt: Input asked `engine/situation.mjs` (simulation layer) for the situation behind every binding. (1) The situation joined the CORE layer, where its header always said it belonged ("must run in a browser AND on a server"): its one non-core import, the role derivation, is applied by the caller and handed in as `access.rolesOf`. (2) Run mode's four press rows moved to `app/src/run-mode.js` (chrome), which `main.js` hands Input as `runRules`; the lab passes none, as ruled. The L2 edge `app/src/input.js -> engine/situation.mjs` is gone; mutants M2, A2, A5b and A15 now show a canvas reaching the movers, and A9 raises the palette record. |
| K6 | One device table in `network/`, in the palette's order (H17-D6) | C5: the Dockerfile gains `COPY network/`; the image job GETs one module per served folder; a drift test for the CLI's glyph map |
| K7 | Stamp hand, text tool and ghost move to a Tools module | equivalence tests (tile highlight, read-only). DONE 2026-10-01: `app/src/tools.js` (canvas) holds the stamp hand, the text tool, the hand's ghost and their lifecycle (`releaseTools`, B42); the palette is a view of it (its tiles light from `onChange`) and Input reads it, never the palette. `NODE_TYPES` moved with the hand, since the digits index it -- K6's one device table will replace that literal -- so Input no longer imports the palette, and the product's last Input debt edge (L2) is gone. The two browser equivalence tests pass on the trees before and after; the gesture corpus changed only by its 12 `palette.*` labels becoming `tools.*`, checked mechanically. The lab passes no tools, as it passed no palette. |
| K8 | `composeCanvas` takes over the canvas half of `main.js` | equivalence tests (DOM snapshot, Escape during a sidebar drag). DONE 2026-10-01: `app/src/compose-canvas.js` composes the defs, grids, model and index, commit boundary, renderer, selection, label editor, crosshair, held tools and Input -- for BOTH roots, since the lab built the same canvas by hand; `main.js` falls 793 to 762 lines and `lab/` 147 to 135 code lines of its 180. The readout (chrome), the host and the defs element come in from the root; Capture starts only when the root calls `listen()`, after its own listeners, because the palette's Escape must be spent before Input's. Both equivalence tests pass on the trees before and after; the DOM snapshot was recorded from the code before (`tests/fixtures/k8-dom.json`), and the lab's 84 browser tests pass on the shared composition. AMENDED 2026-10-01: the readout joined the canvas layer -- it reads only the canvas's state -- and `composeCanvas` builds it from the element a root hands in, which retires the lab's import of it, the last L2 debt edge: L2's records are empty. |
| K9 | One static responder for the product and the lab | C6: extend `tests/server.test.js`'s HTTP tests with `/d/<template id>`, one module per mount (MIME, no-store) and the exact traversal status. DONE 2026-10-01: `server/static.mjs` -- one MIME table, one traversal guard (`fileWithin`), one sender -- in a new `serve` layer that both servers may import. The product's two handlers and the lab's third now use it; what each serves stays its own. The product's guard was `file.startsWith(baseDir)`, which a sibling folder sharing the prefix also passed; the shared one is separator-bounded, and a test shows the old one admitting `kernel2`. Traversal answers exactly 404 on both. The lab server had no HTTP test of what it refuses; `tests/static.test.js` now boots it and asks raw, `server/store.js` and encoded separators included. `lab/` falls from 176 to 162 code lines of its 180. |
| K10 | The lab: `lab/` with its page, root and local server (H17-D1, D7, D8); never deployed | C7: the refusal test enters through `Changes.commit` and the door, and asserts on the notice. **PULL-FORWARD CANDIDATE (2026-09-28):** the lab's stated prerequisite is the real planner in the page (H17-D8), and that is already satisfiable -- K2a left the planner at 15 modules, and `scan-layers` L11 is HARD for core, network and planner, so no host object is read and the planner is browser-safe by enforced rule rather than by hope. K2b to K9 make the lab SMALLER; they do not make it possible. The director wants the lab to validate the `w`/`g` gesture question (`dev/design/unification/GUIDE-ANCHORS.md`), which needs no stored-format change (T1), so nothing in the format batch blocks it either. The cost of pulling it forward is that the lab mounts and never forks (G1), so `g` must exist in `app/src/input.js` before it is proven -- a tentative gesture in product code, reachable only from the lab page. **DEPLOYED, amending H17-D1 (2026-09-28):** to its own Cloud Run service at `lab.apnex.io`, never a path on the product. The Dockerfile gains `COPY lab/`, and the cut now also covers the second service and its build. G12 still holds, and matters more once the lab is visible. **DONE and DEPLOYED 2026-09-29**, live at `https://lab.apnex.io` (revision `draw-lab-00001-h9c`, image `f154996`). Four pieces beside the service: NEG `neg-draw-lab`, backend `svc-draw-lab` with **IAP OFF** (the product's `svc-draw` has it on), host rule `path-draw-lab` on `map-apnex-io`, cert-map entry `e-lab-apnex-io` reusing the existing wildcard, and an A record to the same load balancer. Two defects found and fixed while deploying: the backend was created with protocol HTTP and a serverless NEG needs HTTPS (502 until corrected), and `attachRelations` was imported from the wrong module, which only a real browser saw. Verified live: the four planner files serve, and `server/store.js`, `server/app.js`, `server/identity.mjs`, `/api/v1/*`, `/connect/v1/*` and `/ws` all 404. The product is unaffected -- `draw.apnex.io` still answers 302 to IAP and lists its 21 diagrams. RECONCILED 2026-10-01: built and deployed at `lab.apnex.io` -- the never-deployed clause was amended on 2026-09-28 -- and its browser suite runs in the gate, which since B250 fails in CI if it is skipped. |
| K11 | `kernel/renderer.mjs` splits frame primitives from the SVG scene | DONE 2026-10-01, as K13a's prerequisite: K13a moves waypoint and link appearance into the network layer, and the core renderer drew both, which a frozen L2 ceiling refuses. The scene half -- labels, content regions, `renderEl`, `renderElement`, `renderScene` -- moved verbatim to `kernel/svg-scene.mjs` in the export layer; `kernel/renderer.mjs` keeps the frame primitives and `sharedDefs`, all the live canvas imports. |
| K12 | Remove dead code made visible by K2c | C11: `waypointRole` is MOVED by K13a, not deleted by K12. DONE 2026-10-01: of the 30 exports K2c exposed, the design-rule checker (`kernel/grc.mjs`: `check`, `grc`, `RULES`, `crossings`) is deleted by the director's ruling, with `kernel/router.mjs:segmentsOf`, its only helper's caller; `cellCenter` and `layoutOf` are deleted, called nowhere; `oneSelected` and `onSpawner` are deleted, their tests asserting the fields they read; `CONTROL_WEIGHT`, `DASH_ON`, `DASH_OFF`, `samePlane` and `DRAW_ORDER` are no longer exported, used only in their modules -- which also lowers L5 by four and L5p by one; and the other 18 stay as test seams, each with its own reason in `tools/scan-dead.mjs`, `waypointRole` among them for K13a. Deleting `check` outright reopened L10's borrowed-spelling hole (a deleted name left a vacancy with no home to claim it; A14 got through), closed by recording deleted names as `retired` in the manifest, which vacate nothing. |
| K13a | `kernel/geometry.mjs` splits into grid, pure network roles and network appearance | moves the scan-twins allow entry in the same commit. DONE 2026-10-01 (after K11, its prerequisite): `kernel/geometry.mjs` keeps the grid, layouts, anchors, the core elements, `bboxOf` and `gridDot`; `kernel/network-roles.mjs` holds `waypointRoles`, `waypointRole`, `linkFacing` and `samePlane`; `kernel/network-appearance.mjs` holds the network's scene elements, the ring ladder, `waypointLayers` and link appearance -- both new files in the network layer. Comments moved with their code, except two stale duplicated "junction rung RESERVED" blocks, deleted. 50 import sites repointed by script; L5 falls from 15 to 0 and L5p from 14 to 1 (`routeGeometry`); `kernel/theme.mjs` leaves the planner closure. The scan-twins entry for `linkFacing` moved with it. |
| K13b | `model/invariants.mjs` and `model/referential.mjs` move to `network/`; the `facing` twin merges | Scheduled within promotion: `dev/design/unification/PROMOTION.md`, "The link's path through promotion" (2026-10-02). |
| K13c | The sweep and collapse post-pass moves to the network rules | C12: its RED names the `tests/txn.test.js` tests that already kill skip-sweep and skip-collapse mutants (B162, B215-B217, B222, B239-B241). DONE 2026-10-01 by PL-3 (`ffe50d9`): the stranded pass, the sweep and the join are declared reactions in `model/link-reactions.mjs` (network layer), built into each link tenant; the planner corpus, not only those tests, held every result. |
| K13d | The Model's link methods move to the network layer | waits for the rebuild Scheduled within promotion: `dev/design/unification/PROMOTION.md`, "The link's path through promotion" (2026-10-02). |

AMENDED 2026-10-08 -- K13d's link methods moved (H19.25): `network/link-queries.mjs`; the Model's questions to the network by name (`MODEL_READS`) are designed at H19.26.
AMENDED 2026-10-08 -- K13d done (H19.27): the Model's questions to the network are the network's functions (`network/network-queries.mjs`); the core Model asks no plugin anything.
| K14a | B244: the ring sweep reads the role derivation | needs K13a. DONE 2026-10-01: `linkEndsAt` in kernel/network-roles.mjs states where a link ends (a ring has none) and the role derivation reads it; the sweep in model/link-reactions.mjs keeps a twin, `endsAt`, since C9 bars `model/` from importing `kernel/`, held to it by a test that drives the real derivation and the real sweep over six shapes. Only the ring clause changed behaviour: the whole role set would also have swept a declared pass-through terminus that B216 keeps. |
| K14b | B245: the planner clears the pin when a committed link threads a pinned waypoint | needs K1. DONE as H17.5 (B245 CLOSED): the unpin rides in the link's own commit. |
| K15 | B246: one derivation order by id | C8: the comparator is stated; no server-stamped sequence (that is batch shape); the parity test covers `linksOf`, `linksAt`, `linkBetween`, `linksBetween` and `spawnersOf`. DONE 2026-10-01: `byId` in `model/order.mjs`, its own core module so the planner entry uses what it exports; `tests/link-order.test.js` asks all five of four peers -- two insertion orders, with and without the relation index. 127 recorded plans reorder their ops, each leaving the identical document; the planner corpus is re-recorded. |
| K16 | The B176 guard reads the manifest's closure | DONE 2026-10-01: `tests/movers.test.js` walks the imports of the manifest's simulation layer -- 8 modules today, where the hand list named 2 -- and bans every Math function ECMAScript lets an engine approximate, and `**`, where the list banned five. A `Math.pow` planted in `kernel/spec.mjs` passed the old guard and fails the new one; `Math.exp` and `**` in `engine/rules.mjs` fail it too. |
| K17 | Kind and shape tables by injection; the product passes exactly its five kinds | C3's id-grammar extension. PARTLY DONE 2026-10-01 by PL-5 (`845e4e8`), as ruled: one kind table, `model/shape.mjs`, read by every list; the injection itself is B273, held until promotion's format batch. DONE 2026-10-02 by H17.22 N-a: the table is injected -- every kind a row (`composeKinds`, model/shape.mjs; the product's rows in planner/kinds.mjs) -- and C3's id-grammar literal is replaced by a grammar built from the rows (ruled 2026-10-02). |
| K18a | SD2's rule half: every door cuts a landing (B243) | C9 (section 5) |
| K18b | SD2's browser preview | waits for the rebuild (H17-D11) |

## 5. Conditions of the second M7 pass, with their gates

The second pass's verdict is PASS WITH CONDITIONS (pass-with-guardrails).\
The independent check confirms that verdict, with amendments that are included here.
- **C1 (before K0):** carry the guardrails and conditions into the repo. That is this file. The follow-ups below are filed in `dev/BACKLOG.md`.
- **C2 (before K0):** specify L10 fully (section 3).
- **C3 (before K0):** L7k covers the id grammar; the other kind literals are recorded as consumers; criterion 6's end-of-H17 value is stated honestly, not as "one literal".
- **C4 (before K1):** see K1. The recorder's gloss "full answer" in H17-D3 is corrected under a banner. The director's option, "Take answer, replay yours", is unchanged.
- **C5 (K6)**, **C6 (K9)**, **C7 (K10)**, **C8 (K15):** see their rows.
- **C9 (K18a):**
  - (a) derived piece ids stay inside `link-[0-9a-f]{6}`, or they are an id-grammar change and belong to the batch;
  - (b) the planner cut gives identity to the longer piece, as ruled;
  - (c) the door-parity test compares documents with piece ids excluded, and records the by-door id divergence as accepted until K18b. The browser keeps its `splitsFor` copy under H17-D11, with a named scan-twins allow entry; K13b's allow-list-size test is amended accordingly;
  - (d) K18a needs K1;
  - (e) the typed correction H17-D10 requires is owned by K18b at the rebuild, with a RED test that an id mismatch surfaces as a typed event.
- **C10 (before the H17 closeout):** record corrections, made under banners in `dev/DECISIONS.md` and `dev/BOARD.md`.
- **C11 (before K12):** see K12.
- **C12 (K13c):** see K13c.
- **C13 (before the H17 exit):** the built-size instrument D12 reports is named, and where it runs.

## 6. Follow-ups filed

- **F-GR6** (the first pass's FU-8 and H7): GR6 is extended to cover route, split, preview correction and undo, with disconnect and reorder, and must pass before the backport. Held in `dev/BACKLOG.md`.
- **F-SD12** (FU-6 and H6): an SD12 refusal fixture, a document listing an unknown plugin. It belongs to the stored-format batch. Held in `dev/BACKLOG.md`.
- **F-ORDER:** `all()` iteration and renderer stacking stay insertion-ordered after K15 (G5 PARTIAL). Held in `dev/BACKLOG.md`.
  RULED 2026-10-01 (B249): newest drawn on top, from a stored drawing order added in promotion's format batch; G5 stays PARTIAL until then.
- **F-SKIP:** CI fails when the test report shows `# skipped` above 0, so the lab's browser tests cannot silently disappear. Held in `dev/BACKLOG.md`.
- **FU-10**, for mission-kit, not drawv2:
  - M7 has no rule for which system's applies-to tags govern when an organisation audits a product or its lab;
  - the director's 2026-09-01 abstraction rule may be the second "axiom-laundered wrong conclusion" that fires MREQ-1's revival trigger. That classification is INFERRED.
- **FU-9** (gesture scope) is settled by H17-D7.
- **FU-7** (the T6 mechanism) is K17 with L7 and L7k.
