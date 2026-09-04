# docs/design/sim -- SUPERSEDED by the sovereign `kernel/`

> **Status: historical exploration record only (marked by CL6 of the cleanliness arc).** This
> sandbox's core (schema / engine / renderer / router / grc) **graduated into the top-level
> `kernel/`**, which is now the authoritative geometry core. `docs/design/sim` is NOT consumed by
> production, tests, or scripts -- the one in-repo reference is a comment in `kernel/engine.mjs`.
> Do **not** build on it; if it ever diverges from `kernel/`, the kernel wins, and new geometry
> work goes in `kernel/`. Everything below is the original bootstrap write-up, kept for lineage.

The **headless, programmable geometry engine** prototype for draw.\
Built test-first as design scaffolding; its CORE (schema / engine / renderer / router / grc) became the **sovereign `kernel/`** (the bootstrap -- HANDOVER section 8).\
The interactive tool is now a thin UI over the kernel.

Run: `node docs/design/sim/run.mjs` -> console scorecard + `/tmp/draw-preview.{html,png}` gallery.

## Pipeline
```
schema -> engine.resolve() -> scene (px primitives) -> renderer -> SVG
                                                       \  grc      -> rule pass/fail
```
One schema -> one deterministic scene.\
The same scene feeds the renderer and the DRC, so the stress-test is objective.

## Modules (each sovereign, pure where possible)
- **geometry.mjs** -- variant params (`STD`, locked) + `derive()` (the ladder) + cell<->px grid
+ element constructors (`node/zone/group/port/link/junction/path`) + `bboxOf` + glyph bboxes.
- **router.mjs** -- *lifted from prism `NPath`*: waypoints -> rounded-corner SVG `d`. Pure,
headless, per-corner radius clamping.\
Integer grid waypoints + axis-aligned + integer radius => integer output (determinism).\
Hand-routed now; an auto-router later fills the SAME waypoints.
- **realizers.mjs** -- connection MECHANISMS (the walk's styles): `ports / hybrid / nodeAligned /
edgeNode / gatewayCell / bus`. Each `realize(spec) -> {els, made}`.\
Survivors: nodeAligned, gatewayCell.
- **engine.mjs** -- `resolve(schema) -> {V, L, scene, byId, realized}`. Places containers from
CELL coords, drives realizers for mechanism-relations, routes hand-routed paths.
- **renderer.mjs** -- `renderScene(scene)` -> SVG (+ `path` via router) + `sharedDefs`.
- **grc.mjs** -- the DRC: `grid-snap / clearance / attachment / reserve / ortho / obstacle`
(+ `crossings` metric).\
Nodes are solid (obstacle-checked); zones are permeable space.
- **fixtures.mjs** -- named scenarios in the schema: `container-*` (engine<->realizer parity),
`route-*` (hand-routed turns + a negative obstacle case), `clover` (the routing acceptance proof).
- **run.mjs** -- the runner: all fixtures -> engine -> render + GRC -> gallery + report; verifies
negative fixtures against their `expect`.

## Schema (the "one source")
```js
{
variant: 'standard',
entities: [
    { id, kind:'node',  cell:[cx,cy], frame?, glyph?, sel? },
    { id, kind:'zone',  span:{cols:[c0,c1], rows:[r0,r1]} },   // node-cell span -> ladder hull
    { id, kind:'group', members:[ids] },                        // hugs its members
],
relations: [
    { from:id, to:id, style:'nodeAligned', count:n },           // mechanism between two containers
    { route:{ from:id|[x,y], to:id|[x,y], via:[[x,y],...], radius? } },  // hand-routed path (px)
],
}
```
Entities are CELL coords (logical grid); route `via` waypoints are PX (precise hand-routing, so they land on sub-grid edges/gutters).\
The engine snaps routes to the sub-grid; GRC validates.

## Status / next
- **Done (this sweep):** kernel module split; prism `NPath` lifted + proven (L/Z/clover); fractal
Clover signature reproduced as the routing acceptance fixture; obstacle rule + crossings metric.
- **Walk history retained** in `docs/design/walk/` (the stylexrung science, `FINDINGS.md`) -- unchanged.
- **Next:** richer routing rungs (offset / pass-through / fan-out at scale) and side/port assignment;
horizontal-facing `specBetween`; the deferred `cell-align` (+/-29 vs +/-30) consideration; then Phase 2 -- graduate `schema + engine` into drawv2's doc model.
