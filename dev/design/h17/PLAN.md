# H17 plan: the lab canvas, and the cuts that make it minimal

**Status:** the plan of record for milestone H17 on `dev/BOARD.md`. It takes the place of the unversioned bench as the source a cut is built from.\
The director's direction and the twelve H17 rulings are in `dev/DECISIONS.md` ("The lab canvas" and "H17 lab decisions"). This file carries the cut plan, the guardrails and the conditions those rulings were made on, so that nothing a cut depends on lives only outside the repository.

**Where the evidence lives.** The measurements, the design, the independent review and both axiom alignment passes are in the lab-design bench, outside this repository. Its path is `/home/apnex/taceng/drawv2-archive/lab-design`, and the bench is durable but unversioned.
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
| G12 | Lab evidence is never cited as production proof | held, subject to follow-up F-GR6 |
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

**As built at K0 (2026-09-27), where the scanner goes beyond the wording above.** The K0 attack found 11 holes in the first build, and the fix pass closed them. So the rules now also:
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

The K0 counts on the real tree: L2 4 edges; L4 123 sites and 94 re-exported names; L5 19; L5p 15; L7k 17 recorded consumers; L9 2; L10 153 listed; L11 canvas 3. The rest are 0. The entry closures match section 1: page 50 modules, planner 31.

## 4. The cuts, in order

Every cut ships with a test proven RED plus a mutant, and ships to production as it lands (H17-D2), unless marked otherwise.

| Cut | What | Conditions and notes |
|---|---|---|
| K0 | The layer manifest and scanner (section 3) | C1, C2 and C3 met first (section 5). DONE 2026-09-27: 40 tests, 36 fixture trees, 43 mutants, 11 attack defects fixed |
| K1 | B242: the tab applies the server's planned ops that are not identical to what it sent, then replays its unanswered ops (H17-D3) | C4: tests assert convergence AND that no own edit regresses (the mutant "full answer, no replay" is killed only by the second); add the live-drag case; state whether undo and redo acks replay pending |
| K2a | The planner imports each name from its defining module | |
| K2b | Canvas, server, CLI and test files import from defining modules (125 sites) | |
| K2c | Delete the three barrels (H17-D4); the mount check becomes "the folder exists"; `render` moves to `server/svg.mjs` | RED: GET one module per mounted folder |
| K3 | `plan()` and `commit()` take the anchor resolver by injection | updates `tests/anchor-resolve.test.js` |
| K4 | `planner/` served whole: `txn.mjs`, `log.mjs`, `validate.js`, `policy.mjs` (H17-D5) | RED: `server/store.js`, `identity.mjs` and `anchor.mjs` stay 404 |
| K5 | Input takes its run-mode rules from the composition root | |
| K6 | One device table in `network/`, in the palette's order (H17-D6) | C5: the Dockerfile gains `COPY network/`; the image job GETs one module per served folder; a drift test for the CLI's glyph map |
| K7 | Stamp hand, text tool and ghost move to a Tools module | equivalence tests (tile highlight, read-only) |
| K8 | `composeCanvas` takes over the canvas half of `main.js` | equivalence tests (DOM snapshot, Escape during a sidebar drag) |
| K9 | One static responder for the product and the lab | C6: extend `tests/server.test.js`'s HTTP tests with `/d/<template id>`, one module per mount (MIME, no-store) and the exact traversal status |
| K10 | The lab: `lab/` with its page, root and local server (H17-D1, D7, D8); never deployed | C7: the refusal test enters through `Changes.commit` and the door, and asserts on the notice |
| K11 | `kernel/renderer.mjs` splits frame primitives from the SVG scene | |
| K12 | Remove dead code made visible by K2c | C11: `waypointRole` is MOVED by K13a, not deleted by K12 |
| K13a | `kernel/geometry.mjs` splits into grid, pure network roles and network appearance | moves the scan-twins allow entry in the same commit |
| K13b | `model/invariants.mjs` and `model/referential.mjs` move to `network/`; the `facing` twin merges | |
| K13c | The sweep and collapse post-pass moves to the network rules | C12: its RED names the `tests/txn.test.js` tests that already kill skip-sweep and skip-collapse mutants (B162, B215-B217, B222, B239-B241) |
| K13d | The Model's link methods move to the network layer | waits for the rebuild |
| K14a | B244: the ring sweep reads the role derivation | needs K13a |
| K14b | B245: the planner clears the pin when a committed link threads a pinned waypoint | needs K1 |
| K15 | B246: one derivation order by id | C8: the comparator is stated; no server-stamped sequence (that is batch shape); the parity test covers `linksOf`, `linksAt`, `linkBetween`, `linksBetween` and `spawnersOf` |
| K16 | The B176 guard reads the manifest's closure | |
| K17 | Kind and shape tables by injection; the product passes exactly its five kinds | C3's id-grammar extension |
| K18a | SD2's rule half: every door cuts a landing (B243) | C9 (section 5) |
| K18b | SD2's browser preview | waits for the rebuild (H17-D11) |

## 5. Conditions of the second M7 pass, with their gates

The second pass's verdict is PASS WITH CONDITIONS (pass-with-guardrails). The independent check confirms that verdict, with amendments that are included here.
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
- **F-SKIP:** CI fails when the test report shows `# skipped` above 0, so the lab's browser tests cannot silently disappear. Held in `dev/BACKLOG.md`.
- **FU-10**, for mission-kit, not drawv2:
  - M7 has no rule for which system's applies-to tags govern when an organisation audits a product or its lab;
  - the director's 2026-09-01 abstraction rule may be the second "axiom-laundered wrong conclusion" that fires MREQ-1's revival trigger. That classification is INFERRED.
- **FU-9** (gesture scope) is settled by H17-D7.
- **FU-7** (the T6 mechanism) is K17 with L7 and L7k.
