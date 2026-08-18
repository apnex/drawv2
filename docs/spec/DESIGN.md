# draw — UI design panel report (2026-06-12)

Framing: draw is an ENGINEERING tool, not a drawing tool — strict geometric precision,
interaction language inspired by Factorio/Shapez. The shared bar for every proposal:
**zero ambiguity between intent and result — the machine states what will happen, in
numbers, before commit.**

Method: four independent design lenses (Factorio/Shapez conventions, CAD/EDA precision
tools, ergonomics audit of the current UI, keyboard-first operation) each grounded in the
actual codebase → 23 proposals → deduplicated to 18 → scope-checked against SCOPE.md.
Multi-lens convergence is recorded — independent rediscovery is the strongest signal.

## User items (SHIPPED 2026-06-12, in live test)

- **U1 — Zone layer**: zones are interactive only while Shift is held (additive layer:
  nodes keep priority and Shift+click on nodes still toggles selection). Fixes the
  marquee-inside-zones dead spot; zone grid on Shift doubles as the layer indicator.
- **U2 — Selection corner brackets**: selection is drawn AROUND the subject (RTS/Factorio
  convention), never by restyling the icon. Four corner brackets at the node footprint
  (±25 of the 60px cell), in the existing selected-blue #4fc3f7. Hover keeps the
  crosshair ring; armed states keep the icon recolor (threat may shout; selection whispers).

## Panel ranking (top tier — recommend)

1. **Stamp hand** *(SHIPPED 2026-06-13)* (3 lenses converged) — digits 1-6 hold a node type, ghost at the snapped
   cell + readout state the landing, click stamps repeatedly, Q pipettes, click on a
   different-type node fast-replaces it in place (keeps id/name/links). Esc clears.
   Right-button unaffected. The largest friction sink killed: creation stops being
   palette-drag-only. Cost M.
2. **Ortho lock** *(SHIPPED 2026-06-12)* (2 lenses) — Shift mid-move/clone constrains to the dominant axis
   (AutoCAD ORTHO); readout gains Δ-in-cells for every move. One-line delta change. Cost S.
3. **Chain wiring** *(SHIPPED 2026-06-12)* — Shift-release in link mode commits the link and re-enters from the
   target (10-node chain: 27 pointer actions → 11); also adds the missing link-mode
   readout (the one gesture with no numeric feedback today). Cost S.
4. **Datum point** *(SHIPPED 2026-06-12)* — Space sets a local origin; readout appends relative coords
   (KiCad convention). Pure readout grammar, zero model impact. Cost S.
5. **Tab-advance rename** *(SHIPPED 2026-06-12)* — Tab in the label editor commits and opens the next entity's
   label (reading order). Converts an existing dead key (Tab currently blur-commits and
   strands focus). Cost S.
6. **Ctrl+D duplicate at pitch** *(SHIPPED 2026-06-13)* (2 lenses) — clone selection at the last-used offset,
   readout receipt each tap; tap-tap-tap produces a row. Cost M.
7. **Z wraps selection in a fitted zone** *(SHIPPED 2026-06-13)* — bbox + 30px = exact zone-grid fit by
   construction. Containment becomes computed, not eyeballed. Cost S.
8. **Shift+arrows resize zone** *(SHIPPED 2026-06-13)* one cell per press (NW anchored, nudge-style undo
   coalescing). Today Shift+arrow is a pure duplicate of plain nudge. Cost S.

## Second tier (good, after the above)

9. **Belt-run drag** — with a type in hand, drag stamps an axis-locked row (ghosts on every
   cell, count in readout); Ctrl during sweep also chains links. Depends on stamp hand.
   *(DECLINED 2026-06-13 — bulk identical-row placement isn't a common move when building
   network topologies, which are heterogeneous. Revisit only if a row-heavy use case appears.)*
10. **Deconstruction marquee** — Alt+left-drag area delete with live red arming + count.
11. **Exact coordinate entry** — Enter opens a status-bar command line: absolute px,
    relative cells; live echo of snapped/clamped landing before commit.
12. **Link endpoint re-plug** *(SHIPPED 2026-06-13)* — select a link, drag an endpoint handle to rewire (one
    undoable retarget instead of delete+redraw).
13. **L links selected nodes** *(SHIPPED 2026-06-13)* pairwise; Shift+L stars from first-selected. (Caveat:
    selection order is invisible with 3+ marquee picks; unambiguous for 2 or star.)

## Held / cut by the scope judge

14. **Data view (Tab numeric overlay)** *(SHIPPED 2026-06-13)* — every entity shows live coords/dims/lengths.
    Passes the precision bar; held only because Tab is contested and cost M.
15. **Pair-distance readout** *(always-on half SHIPPED 2026-06-13)* — ship the always-on half (2 selected → Δ + length in the
    readout, near-zero code); the modal measure mode duplicates datum+pair and was cut.
16. **Directional selection traversal (Ctrl+arrows cone-walk)** — genuinely valuable but
    the largest keymap footprint right after a gesture rework; deferred.
17. **Blueprint stamp (Ctrl+C)** — CUT for now: clipboard is the on-ramp to the explicitly
    excluded diagram-to-diagram copy; Ctrl+D covers the dominant case.
18. **Selection filter rail** — CUT: persistent mode makes identical gestures pick
    different things across sessions (fails intent-equals-result). Extracted sub-feature
    worth keeping: marquee should be able to pick links (both endpoints in box) *(SHIPPED 2026-06-13)*.

## Keymap claims (to keep collisions visible)

digits 1-6 + Q = stamp hand · Space = datum · Z = wrap-zone · Ctrl+D = duplicate ·
Shift mid-drag = ortho · Shift at release (link mode) = chain · Shift+arrows = zone resize ·
Tab = contested (rename-run inside editor is free; canvas Tab held for data view) ·
Enter = contested (coordinate entry vs stamp-at-ghost) · L/Shift+L = link selected ·
Alt+left-drag = delete marquee · M = unbound (measure mode cut)
