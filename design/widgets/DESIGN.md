# widgets / diagram-as-UI arc — decision record

> **Status: CANDIDATE — authored, mocking examples before execution.** The arc is in the substrate
> (`model/arc-catalog.json` + `arc.sysml`, summit `S_diagramAsUI`); no production code yet.
> Companions: `preview.html` (the 4-option comparison) · `rationale.json` (per-approach detail).

## The goal
Make **text, input fields, and panels first-class diagram entities** placed on cells, so a control
panel is *itself a diagram* — the same primitives for UI as for content. This is prism's unreached
**self-hosting / diagram-as-UI** summit. (Diagrams can then become the UI for an external app.)

## Chosen approach — D, unified: a panel IS a node
Winner of the multi-option preview (workflow `wf_6aa402cd-297`), refined by the Director to one
unified primitive (see `examples.html`):
- **A panel IS a node** — any span. The existing node is the **1×1 panel**. No separate "panel"
  primitive and no leaf-vs-container split: one entity, the node/panel.
- **The interior is a per-cell grid of 26px sockets** — one socket per cell (1×1 → one socket; N×M →
  N×M sockets). The 7px socket padding (`frame.ext 20 − socket.ext 13`) makes a 1×1 panel **identical
  to today's node** (40px frame, 26px socket).
- **Content sits IN the sockets, as regions.** Select one-or-more sockets → **merge** into a content
  region → place **content** (`text` — optional outline — or `glyph`) → configure **alignment**
  (left/centre/right). **label == text** (no outline); an **input / button = text + outline** (box on
  the socket border). So `content ∈ {text | glyph}`; an **input is a composition** (a text *label*
  region + a text-with-outline *value* region) and a **form** is one panel with several content regions.
  The merge+align is the author action (editing UI, deferred); the data is `{ merged-span, content,
  align, outline }`. See `socket-merge.html`. A **text node** = a panel with **all** sockets merged into
  one text region: a single merged cell → a one-line label; a 2×2 / N×M all-merged region → the text
  **wraps as a paragraph** filling the area. A content box may also take a **solid fill + larger radius**
  (a **pill** — e.g. the connection-state indicator: socket border + green fill + dark text).
- **No recursive nesting (Director call).** A panel == a node with a **single hull**; interior content
  (text/input/glyph) aligns to the per-cell socket grid with **no new hull**. A form / control-bar is ONE
  panel whose sockets hold content items — NOT nested sub-panels. **The top control bar is ONE panel**
  (Director call; see `control-bar.html` — the full `#menu` bar, file/slides/status clusters as content
  regions separated by socket gaps; a zone-of-3-panels is reserved for genuinely separate widgets). (Recursion — panels-in-panels — would
  require making *grids* first-class entities, grids-on-grids, which supersedes the panel concept and is
  **out of scope**; prism attempted recursion and it breaks the uniformity of a fixed engineered grid.)
  Text content may carry an optional outline, aligned to the socket grid the same way an input is.
- **`clickable` / "button" is an ORTHOGONAL behavior, not a content type** — any node/panel can be clickable;
  **deferred** (needs view/edit/run mode). `content` stays an extensible object so behavior fields are additive.

## The atomic (what W1–W2 build)
`node` (= panel) gains **two optional fields** — both absent ⇒ **byte-identical to today's node**:
- **`span` = {cols, rows}** in whole cells (default `1×1`). Multi-cell footprint, **author-dragged**
  (author-set span — NOT auto-grow; no text-measurement; content fills/clips to the socket grid).
- **content regions** — a list of `{ span (merged sockets), content:'text'|'glyph', value/glyph, align, outline?, bg?, rx? }`.
  `content ∈ {text|glyph}` (label/input/button/pill = text compositions: text + optional outline/fill/radius).
  A 1×1 node = one glyph region (today's node).

The socket is **invariant 26px per cell** (NOT scale-dependent); the interior socket grid is the content
region. Verified geometry: frame inset `g = pitch/2 − node = 10`; at `1×1`, `x = c0·P−20, w = 40` + one
26px socket — pixel-identical to today's node. So `1×1`/glyph is provably the degenerate case.

**Content spatial rule (settled).** A text/input box outline may render **up to / ON the socket border**
but **never beyond it**, and never into the hull→socket padding — so content never touches the panel hull.
Levels: **hull** (frame) → **socket(s)** (dotted, frame inset 7) → **content box** (≤ the socket region; its
border may coincide with the socket border). **Continuous boxes are fine**: multi-cell content spans the
socket-grid union as one box (bridging the inter-socket gaps) — that sub-question is resolved.

**Panel hull radius (settled).** A panel (content node) rounds its hull to the **circle radius**
(`rx = frame.ext = 20`), not the small frame radius (5) — so a 1×1 panel == the single-cell circle, a
1-row panel reads as a pill, and N×M panels carry the same corner curvature. Plain icon nodes
(circle / square) are unchanged; a span node with no content keeps the frame radius.

## Scope split (the mode line)
> **Rung reframe (rebaseline `dRebaseWidgets`).** The design proved input/button/pill are *not* distinct
> content types but **compositions of text** (text + outline/fill), so the old W2(text)+W3(input) collapse
> into one **content-region** rung. Renumbered: 7 rungs → 6 (catalog + arc.sysml in parity).

**In scope — entity/content/geometry layer (mode-independent; renders identically in any mode):**
- **W1** multi-cell `span` foundation — rect frame + **rectangular `selBox`** + **span-aware occupancy**
  (nodes were always 1-cell — this is the one genuinely new mechanic). Content stays glyph. *Keystone.*
- **W2** **content-region** — merge sockets → a region carrying `content ∈ {text|glyph}` with **align** and an
  optional **outline/fill/radius**; label/input/button/pill are all text compositions. Text in a slot
  **reverses "kernel defers labels"** — the one load-bearing decision. (Subsumes the old text + input rungs.)
- **W3** panel / control-bar rendered **as a diagram** (static) — the visual diagram-as-UI proof.

**Interaction/mode layer — `renderer.mode` ∈ {view, edit, run} (client/session, ephemeral):**
- **W4 SHIPPED — view/edit mode.** Edit mode (`e`) shows the per-cell socket grid on content panels (an
  alignment aid); the clean view hides it. The kernel grid is gated behind a render opt
  (`renderScene/renderElement(… {sockets:true})`, default off → clean exports); the live app gates it on
  `renderer.mode === 'edit'`. Rides the modelState **spec(config)/status(state)/session(view)** split.
- **W5 SHIPPED — run mode + clickable buttons.** Run mode (`r`) makes a content region with an **`action`**
  ACT: a click fires a **`draw:action`** CustomEvent that the HOST app wires (the self-hosting interface —
  the diagram emits actions, the app maps them to behaviour; `help` wired real, the rest a safe banner toast).
  A transparent hit rect (`.clickable[data-action]`) captures only in run mode (CSS), so view/edit clicks
  still drive normal gestures. The control-bar buttons (open/+/×/⇑slides/?) carry actions.
- **W6 SHIPPED — live input editing.** A content region marked **`input: true`** is editable: in run mode,
  clicking it opens an inline editor (positioned over the region's hit rect) pre-filled with its value;
  Enter/blur commits the new value back into the node's content (`setContentValue`, undoable + persisted),
  Escape cancels. The control-bar's name/slides values are editable inputs. Reuses the `LabelEditor`.

*Why this can't preclude mode:* W1–W3 are pure geometry/render; mode is an `input.js` interaction branch.
Nothing built now touches it. The one guardrail: `content` stays an extensible object.

## Seams each rung threads (for execution)
`model/model.mjs` (KINDS/makeX + the optional fields) · `kernel/adapt.mjs` (docToSchema) ·
`kernel/spec.mjs`/`kernel/renderer.mjs`/`kernel/engine.mjs` (rect frame, content render, span resolve) ·
`kernel/geometry.mjs` (`bboxOf`) · `server/validate.js` (KINDS/FIELDS/OPTIONAL/SELECTABLE/EXT — in lockstep,
or reload 400s) · `app/src/commands.js` (span-aware occupancy) · `app/src/input.js` (author drag-to-span; mode later).

## Build order
W1 (keystone, parity-safe behind the absent-field default) → W2 (content-region) → W3 (panel/control-bar).
Then, only if the interaction layer is committed, revive W4 (mode) → W5/W6.
