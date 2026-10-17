# `kernel/` — the sovereign .next geometry kernel

The deterministic, self-contained geometry core that becomes drawv2's next-version engine.
One declarative **schema** → one resolved **scene** (px primitives) → **SVG** (renderer) **+**
pass/fail (the **GRC** rule check). No client-app coupling: glyph artwork, styles, and colours
are vendored into `theme.mjs`.

> The exploration sandbox lives in `dev/design/sim/` (mockups, the routing-strategy walk, showcase).
> `kernel/` is the curated, locked core; iterate visuals here.

## Modules

| module          | role |
|-----------------|------|
| `spec.mjs`      | the **LOCKED** `standard` variant (frozen) + the `derive()` ladder. Single source of px truth. |
| `geometry.mjs`  | grid (`cell↔px`), layouts and anchors, `gridDot`, `spanExtent`, `groupHull`. Pure, core. |
| `router.mjs`    | `roundedPath` (lifted prism NPath) + segment/corner helpers. Pure, integer-deterministic. |
| `theme.mjs`     | **the visual-iterate surface**: style tokens and `CANVAS_ROLES`. |
| `renderer.mjs`  | shared frame primitives (`sharedDefs`, `selBox`, `nameLabel`, `showsSockets`, `evenDash`). |
| `view.mjs`      | the spec/reference viewer → `kernel/out/spec.{html,png}` + a console self-check. |

## Where each name lives

There is no barrel: every caller imports a name from the module that defines it (H17-D4, deleted at K2c).
The design-rule checker, `grc.mjs`, was deleted at K12 by the director's ruling: nothing called it.
The old declarative scene renderer (`adapt.mjs`, `engine.mjs`, `fixtures.mjs`, `svg-scene.mjs`) was retired at H25.5 (D4): both the canvas and `server/svg.mjs` `svgDocument` render through `app/src/renderer.js` and the plugins' painters.

## Schema

```js
{
  variant: 'standard',                                 // optional (only `standard` for now)
  entities: [
    { id, kind:'node',     cell:[cx,cy], frame?, glyph?, sel? },
    { id, kind:'waypoint', cell:[cx,cy] },             // a placeable 40px-circle routing pivot
    { id, kind:'zone',     span:{cols:[c0,c1], rows:[r0,r1]} },
    { id, kind:'group',    members:[ids] },
  ],
  relations: [
    { route:{ from:ref, to:ref, via:[ref,…], radius?, close? } },   // hand-routed path
  ],
}
```

A route `ref` is an **entity id** (node/waypoint → its cell centre) or a **cell coord `[cx,cy]`**
(→ that cell's centre). **One anchor per cell = the centre.** Bends land on cell centres; a
placed waypoint makes a bend visible and inscribes the locked **r=20** turn in its 40px circle.

## Locked spec (`standard`)

`pitch 60 · node ±20 · ladder step +3 · gutter 2 · socket 26 · frame r 5 · sel arm 10 · link w 6 · bend r 20`
Budget: `pitch = node + 6·step + gutter = 40 + 18 + 2 = 60`.

## Out of this cut (deferred)

Parallel / multi-port realizers (the **additive routing layer**) · auto-routing ·
crossing-tunnel + junction-pad render polish (atomics locked in `../docs/spec/ATOMICS.md`) ·
labels & direction · sub-cell bend offsets.

## Run

```
node kernel/view.mjs     # → kernel/out/spec.{html,png}; prints the fixtures self-check
```
