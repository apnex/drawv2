# A type is a composition -- the U4 delta (H21.3, B282)

The transition from eight per-type tables in five files to one declaration per device type in `devices/device-types.mjs`, handed to the other plugins at composition (`U4-1`), served by the server so the CLI asks rather than keeping a copy (`U4-2`), with run-mode behaviour as the third pack family (`U4-3`), and the bend and join rules reading a type's routing pack rather than whether a node has a type (`2026-09-22`, `2026-09-28`, `Z1`, `SD5`).

---

## 1. From-state and to-state

- **From-state:** `docs/ARCHITECTURE.md` at `c429162`, and `tests/core-names-no-plugin.test.js` `TYPE_NAME_RECORD` (11 files, 83 hits across the eight per-type tables T1 to T8 of `dev/design/unification/UNIFICATION-AUDIT.md` section 3.1).
- **To-state:** `docs/ARCHITECTURE-TARGET.md` section 5 ("A type is a composition", settled by `U4-1`, `SD5`, `U4-2`, `U4-3`), closing rows 1 and 2 of section 8.2 (`B282`'s pack half; `B282` stays `PART-CLOSED` on its held `WD1` wide-device-anchors remainder).

---

## 2. The fence

What this delta changes, and what stays outside it.
- **In fence:**
  1. **One device-type declaration (`devices/device-types.mjs`, `U4-1`, `U4-2`, `U4-3`):**
     `DEVICE_TYPES` declares the six device types in palette order (`host`, `server`, `loadbalancer`, `firewall`, `vxlan`, `router`), each with its `map` letter, glyph `box`, glyph `svg` art, `routing` pack name (`'endpoint'` or `'transit'`), and `behaviour` pack name (`'tower'` or `null`).
     `typesFrom(table)` derives `DEVICE_TYPE_LIST`, `GLYPH_BB`, `DEFAULT_GLYPH_BB`, `GLYPH_DEFS`, `TYPE_ROUTING`, `TYPE_BEHAVIOUR` and `deviceTypeRecords`, and `faviconSvg()` composes the type marked `favicon: true`.
     `GLYPH_BB`, `GLYPH_DEFS` and `faviconSvg` leave `kernel/theme.mjs` (closing the glyph-art half of `B338` and the `colours -> lattice` part-divergence in `tools/layers.mjs` `PARTS.colours.carried`); `DEVICES_CANVAS` (`devices/device-appearance.mjs`) contributes `defs: GLYPH_DEFS` to `app/src/compose-canvas.js`, which passes the parts' `defs` to `sharedDefs` (`kernel/renderer.mjs`), and the export door (`server/svg.mjs`, `kernel/svg-scene.mjs`) reads `GLYPH_DEFS`, `GLYPH_BB` and `DEFAULT_GLYPH_BB` from `devices/device-types.mjs` (`ALLOWED.export` and `PARTS.export.carried` in `tools/layers.mjs`, carried by `B330`).
     `devices/device-types.mjs` joins `ENTRIES.page.modules` and `ENTRIES.lab.modules` in `tools/layers.mjs` and is not imported by `devices/device-fields.mjs`, so `ENTRIES.planner` is unchanged.
  2. **The routing pack family (`network/transit-offers.mjs`, `network/link-reactions.mjs`, `network/network.mjs`, `U4-1`, `SD5`):**
     `ROUTING_PACKS` defines the network's packs (`unrestricted` for a bare anchor, permitting `endpoint`, `junction` and `bend` with `[true, false]`; `transit`, permitting `endpoint` and `junction` with `[true, false]`; `endpoint`, permitting `endpoint` alone with `[false]`).
     `composeRouting(TYPE_ROUTING)` is called at module evaluation in `product/canvas.mjs`, `server/store.js` and `tests/fixtures/composed.mjs`; `T4` (`OFFERS` keyed by type name in `network/transit-offers.mjs`) is deleted.
     `nodePermitsBend(entity)` reads whether the entity's routing pack permits `bend`; `linkJoin` in `network/link-reactions.mjs` (at its candidate collection and at its `Z1` cut-piece guard, keeping `&& !areCutPieces(src, other, w)`) and `junction-cut` in `network/network.mjs` read `nodePermitsBend` instead of `bareAnchor`.
  3. **The behaviour pack family (`engine/kinds.mjs`, `engine/spawn-runs.mjs`, `U4-1`, `U4-3`):**
     `BEHAVIOUR_PACKS` defines `{ tower: { range: 3, beam: 10, cooldown: 10, damage: 1 } }`.
     `composeBehaviour(TYPE_BEHAVIOUR)` populates `TOWERS` at module evaluation in `product/canvas.mjs`, `server/store.js` and `tests/fixtures/composed.mjs`; `T8` (`loadbalancer:` in `engine/kinds.mjs`) and the literal `'loadbalancer'` in `engine/spawn-runs.mjs` are replaced by the composed behaviour table and `towerType()`.
  4. **The server types route and the CLI (`server/routes.mjs`, `server/rest.js`, `cli/verbs.mjs`, `docs/spec/API.md`, `docs/spec/CLI.md`, `U4-2`):**
     `GET /api/v1/types` answers `{ types: [{ name, map, routing, behaviour }, ...] }` from `deviceTypeRecords()`, documented in `docs/spec/API.md` (`GR10`).
     `draw types` (`docs/spec/CLI.md`, `GR18`) lists them; `draw add`, `draw place`, `draw panel` and `draw map` declare `'GET /types'` in `also` (`B119`) and ask `/types` after syntactic argument checks instead of keeping `NODE_TYPES` (`T5`), `GLYPH` (`T6`), `LEGEND` (`T7`) or the default `'host'` literal in `cli/verbs.mjs`.
  5. **Tests, ratchets and generated docs:**
     `tests/browser.test.js`, `tests/canvas-hand.test.js` and `tests/renderer.test.js` import `GLYPH_BB` and `faviconSvg` from `devices/device-types.mjs`; `tests/device-junctions.test.js` hoists its `tests/fixtures/composed.mjs` import; `B167` in `tests/cli-tool.test.js` is restated for `GET /api/v1/types` and `draw types`; `TYPE_NAME_RECORD` in `tests/core-names-no-plugin.test.js` is lowered; a falsifier test adds a seventh type in one declaration and proves it works across appearance, routing, behaviour and `deviceTypeRecords`; `docs/ARCHITECTURE.md` is regenerated by `tools/generate-architecture.mjs`.
- **Out of fence:**
  - Anchors along a wide device (`B282`'s wide-device-anchors remainder, held until a wide device needs links at more than one point, `WD1`).
  - Stage 6 (`H21.8` / U5): `B331`, `B332`, `B338`'s colour-roles half, `B339`, `B340`, `B341`, `B342`, `B348`.

---

## 3. Axiom alignment (M7)

Weighed over the axioms in force (`A-5`):
- **A3 Sovereign Composition (load-bearing):** each plugin defines its own family's packs (`devices/` appearance, `network/` routing, `engine/` behaviour), `devices/device-types.mjs` declares each type once, and `product/` hands each plugin its slice at composition (`U4-1`).
- **A8 Gated Recursive Integrity (load-bearing):** the U3 ratchets (`TYPE_NAME_RECORD` in `tests/core-names-no-plugin.test.js`) fall in the same commit that removes each table, and a falsifier test proves adding a seventh type in one declaration drives appearance, routing, behaviour and `/api/v1/types`.
- **A5 Perceptual Parity (supporting):** agents and the CLI read the declared device types and map letters from `/api/v1/types` (`U4-2`).
- **AX2 & AX5 (outcome axes):** eight per-type tables collapse to one declaration (`devices/device-types.mjs`), with no stored-document format change (`AX6`, `P-10`).

---

## 4. Exit criteria (binary)

1. `devices/device-types.mjs` is the only product module declaring the six device types' names, boxes, art, map letters, routing pack names and behaviour pack names; `T1` to `T8` outside it are gone.
2. `TYPE_NAME_RECORD` in `tests/core-names-no-plugin.test.js` drops from 11 files (83 hits) to 4 files: `devices/device-types.mjs` (the declaration itself, 6 keys), `kernel/fixtures.mjs` (reference scenes), `server/seed.js` (seed data) and `kernel/geometry.mjs` (1 export fallback, `B330`).
3. `nodePermitsBend` decides whether an anchor may bend or join from its routing pack's `roles`, not from `bareAnchor`.
4. `GET /api/v1/types` and `draw types` serve the declared types, and `cli/verbs.mjs` holds 0 device type names.
5. A falsifier test adds a seventh type in one declaration (`typesFrom`) and proves its appearance, routing, behaviour and `/types` record work without editing any other table.
6. `npm run gate` passes.

---

## 5. Adversarial review and dispositions

Reviewed by an independent agent (`W10`) before implementation; verdict: "ready after fixes above" (6 blockers, 3 majors, 2 minors).

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | blocker | `export -> devices` breaks `scan-layers` L2 and `PARTS.export` unless declared in `tools/layers.mjs` | **Fixed in fence (2.1):** `ALLOWED.export` gains `'devices'`, `PARTS.export.carried` gains `devices: 'B330'`, `PARTS.colours.carried` drops `lattice: 'B338'`, and `docs/ARCHITECTURE.md` is regenerated |
| 2 | blocker | `devices/device-types.mjs` must be in `ENTRIES.page.modules` and `ENTRIES.lab.modules` (L6) and kept out of `devices/device-fields.mjs` (`ENTRIES.planner`) | **Fixed in fence (2.1)** |
| 3 | blocker | unit tests importing `network/` or `engine/` must have `composeRouting` and `composeBehaviour` called (`tests/fixtures/composed.mjs`, `tests/device-junctions.test.js`) | **Fixed in fence (2.2, 2.3, 2.5):** `product/canvas.mjs`, `server/store.js` and `tests/fixtures/composed.mjs` compose both at module evaluation, and `tests/device-junctions.test.js` hoists its `composed.mjs` import |
| 4 | blocker | `UNIFICATION-AUDIT.md` section 7 U4 exit requires a falsifier test adding a seventh type in one declaration | **Fixed in fence (2.5, 4.5):** `typesFrom(table)` in `devices/device-types.mjs` supports the falsifier test |
| 5 | blocker | `TOWERS` in `tests/rules.test.js` and `tests/place-rule.test.js`, `B167` in `tests/cli-tool.test.js`, and `GLYPH_BB`/`faviconSvg` imports in 3 test files | **Fixed in fence (2.3, 2.5):** `composeBehaviour` populates the exported `TOWERS` object in place; the 4 test files are updated |
| 6 | major | exact record changes in `tests/core-names-no-plugin.test.js`, and avoiding extra `router` hits in `faviconSvg` | **Fixed:** `faviconSvg` selects the entry with `favicon: true`, so `devices/device-types.mjs` has exactly 6 hits in `TYPE_NAME_RECORD` |
| 7 | major | `sharedDefs` must preserve `#m-circle`, `#m-square` and `arrowDefs()` while injecting `GLYPH_DEFS` in `composeCanvas` and `server/svg.mjs` | **Fixed in fence (2.1):** `sharedDefs(V, L, extraDefs)` takes `extraDefs`, passed by `composeCanvas` from `parts.map((p) => p.defs)` and by `server/svg.mjs` from `GLYPH_DEFS` |
| 8 | major | `add`, `place`, `panel` and `map` must declare `'GET /types'` in `also` (`B119`), fetch `/types` after local syntax checks, and update `API.md` (`GR10`) and `CLI.md` (`GR18`) | **Fixed in fence (2.4)** |
| 9 | minor | `B282` stays `PART-CLOSED` on its held `WD1` remainder and remaining `network -> devices` imports | **Fixed in 1 and 2** |
| 10 | blocker | `linkJoin` in `network/link-reactions.mjs` must keep `&& !areCutPieces(src, other, w)` at line 333 for `Z1`, and `B282` must stay `PART-CLOSED` so `PARTS.network.carried.devices` resolves | **Fixed in 1 and 2.2** |
| 11 | minor | regenerate `docs/ARCHITECTURE.md` (and `REACTIONS.md` if any reaction `doc` changes) | **Fixed in 2.5** |
