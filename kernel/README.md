# `kernel/` -- the geometry, palette, routing and primitive core

The deterministic, self-contained core shared by the canvas, the SVG export, the simulation and the plugins.

## Modules

| module | role |
|---|---|
| `spec.mjs` | the locked `standard` variant (`STD`, frozen), `BEND_R` and the derived `L_STD` layer ladder. Single source of px truth. |
| `geometry.mjs` | the grids, opened from `@apnex/snap-grid` (H26.1): `NODE_GRID`, the node lattice with no bounds; `nodeGridWithin`, it bounded by an extent; `latticeGrids`, any lattice record's two grids; and `anchorOn`, an anchor as the agent door and placement answer it. Beside them `gridDot` and `groupHull`. Pure, core; the grid arithmetic it held (`px`, `cellOf`, `LAYOUTS` and the rest) went with H26.1. |
| `router.mjs` | `roundedPath`, and the polyline geometry beneath it: `pathGeometry`, `pathLength`, `pointAtDistance`. Pure, integer-deterministic. |
| `palette.mjs` | the core Material colour palette: `colour`, `resolveRole`, `resolveRoles`. |
| `theme.mjs` | style tokens and roles: `TOKENS`, `CANVAS_ROLES`, `CHROME_ROLES` and `CHROME`, the chrome's roles resolved. |
| `renderer.mjs` | shared frame and label primitives (`sharedDefs`, `selBox`, `nameLabel`, `showsSockets`, `hexColor`, `evenDash`). |
| `input-rules.mjs` | draw's declaration for `@apnex/input-binding` (H26.2; its tables in the component's own form since H26.8): `TABLE_DECLARATION`, its guards, claim and gesture field declared once; `openTable`, the component's table composed with them from tenants `{ owner, rows }`, or a refusal at load naming the component's own problems; and `openGestures`, an input surface's gesture session. Every caller asks the table itself -- `matchInput` for the one row an input means and its claim, `findOverlaps` at the gate. |
| `primitives.css` | the core primitives' stylesheet (`.frame`, `.label`, `.label-pill`, `.select-box`). |

## Where each name lives

There is no barrel: every caller imports a name from the module that defines it (H17-D4, deleted at K2c).\
The design-rule checker (`grc.mjs`) was retired at K12, and the old declarative scene renderer (`adapt.mjs`, `engine.mjs`, `fixtures.mjs`, `svg-scene.mjs`) was retired at H25.5 (D4): both the live canvas and `server/svg.mjs` `svgDocument` render through `app/src/renderer.js` and the plugins' painters.

## Locked spec (`standard`)

Its values: `pitch 60, node +-20, ladder step +3, gutter 2, socket 26, frame r 5, sel arm 10, link w 6, bend r 20`.\
Budget: `pitch = node + 6 * step + gutter = 40 + 18 + 2 = 60`.
