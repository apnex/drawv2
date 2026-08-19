# `kernel/` — the sovereign .next geometry kernel

The deterministic, self-contained geometry core that becomes drawv2's next-version engine.
One declarative **schema** → one resolved **scene** (px primitives) → **SVG** (renderer) **+**
pass/fail (the **GRC** rule check). No client-app coupling: glyph artwork, styles, and colours
are vendored into `theme.mjs`.

> The exploration sandbox lives in `design/sim/` (mockups, the routing-strategy walk, showcase).
> `kernel/` is the curated, locked core; iterate visuals here.

## Modules

| module          | role |
|-----------------|------|
| `spec.mjs`      | the **LOCKED** `standard` variant (frozen) + the `derive()` ladder. Single source of px truth. |
| `geometry.mjs`  | grid (`cell↔px`, `cellCenter`) + element constructors (incl. `waypoint`) + `bboxOf`. Pure. |
| `router.mjs`    | `roundedPath` (lifted prism NPath) + `gridSnap` + segment/corner helpers. Pure, integer-deterministic. |
| `theme.mjs`     | **the visual-iterate surface**: style tokens, vendored glyph `<defs>`, `GLYPH_BB`, scene CSS. |
| `renderer.mjs`  | scene → SVG (consumes `theme`; renders the waypoint). No layout decisions. |
| `engine.mjs`    | `resolve(schema)` → scene. Places containers from cells; threads routes through cell-centre anchors. |
| `grc.mjs`       | the DRC: 7 rules (grid-snap · clearance · attachment · reserve · ortho · obstacle · overlap) + crossings metric. |
| `index.mjs`     | **the public API** — import from here only. |
| `fixtures.mjs`  | canonical scenes in the schema (reference · routing · clover). |
| `view.mjs`      | the spec/reference viewer → `kernel/out/spec.{html,png}` + a console self-check. |

## Public API (`index.mjs`)

```js
import { resolve, render, check, STD, L_STD, derive, BEND_R } from './kernel/index.mjs';

resolve(schema)  // → { V, L, scene, byId }   the deterministic core
render(schema)   // → SVG string               (resolve → renderer)
check(schema)    // → [{ rule, pass, why }]     (resolve → GRC)
```

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
