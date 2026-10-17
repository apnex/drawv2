# `kernel/` -- the geometry, palette, routing and primitive core

The deterministic, self-contained core shared by the canvas, the SVG export, the simulation and the plugins.

## Modules

| module | role |
|---|---|
| `spec.mjs` | the locked `standard` variant (`STD`, frozen), `BEND_R` and the derived `L_STD` layer ladder. Single source of px truth. |
| `geometry.mjs` | grid (`px`, `cellOf`, `LAYOUTS`, `onLayout`, `snapLayout`, `cellOn`, `pxOn`, `nearestAnchor`, `anchorAt`), `gridDot`, `spanExtent`, `groupHull`. Pure, core. |
| `router.mjs` | `roundedPath` and polyline geometry helpers. Pure, integer-deterministic. |
| `palette.mjs` | the core Material colour palette and `resolveRoles`. |
| `theme.mjs` | style tokens (`TOKENS`, `CANVAS_ROLES`) and `SHARED_GLYPH_DEFS`. |
| `renderer.mjs` | shared frame and label primitives (`sharedDefs`, `selBox`, `nameLabel`, `showsSockets`, `hexColor`, `evenDash`). |
| `input-rules.mjs` | declarative input-row matcher (`resolveInput`, `overlapsIn`). |
| `primitives.css` | the core primitives' stylesheet (`.frame`, `.label`, `.label-pill`, `.select-box`). |

## Where each name lives

There is no barrel: every caller imports a name from the module that defines it (H17-D4, deleted at K2c).
The design-rule checker (`grc.mjs`) was retired at K12, and the old declarative scene renderer (`adapt.mjs`, `engine.mjs`, `fixtures.mjs`, `svg-scene.mjs`) was retired at H25.5 (D4): both the live canvas and `server/svg.mjs` `svgDocument` render through `app/src/renderer.js` and the plugins' painters.

## Locked spec (`standard`)

`pitch 60, node +-20, ladder step +3, gutter 2, socket 26, frame r 5, sel arm 10, link w 6, bend r 20`
Budget: `pitch = node + 6 * step + gutter = 40 + 18 + 2 = 60`.
