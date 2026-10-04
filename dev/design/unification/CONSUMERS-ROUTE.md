# Every path consumer routes -- promotion's P4 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-04 against `e3f1440`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> AMENDED 2026-10-04: H1 ruled as recommended; H2 ruled against the recommendation -- the SVG download never draws pipes (section 9).
> AMENDED 2026-10-04: H2 refined -- the SVG download draws what run mode (`r`) shows (section 9).

## 1. Status

- **Asked for:** the director, 2026-10-04, approving H18.17 -- P4's design before any code ("approved for next").
- **Is:** stage P4 of `PROMOTION.md` section 6: "the SVG export, REST paths, `draw movers` and `draw combat` compose the network through one shared function; spawners skip down links", proven when "the five consumers of section 3.3 draw the route the tab draws, asserted per consumer on one board".
- **Judged against the target state** the director stated (`dev/DECISIONS.md`, "Promotion's target state"): clean, deduplicated, modular, in step with the lab. Each stopgap below is named with the stage that removes it.
- **Found while measuring:**
  - P3 already gave the store's planner the network (S-b), so of section 3.3's five consumers, four remain: the export, the two REST path answers, and the CLI's two verbs (section 2);
  - the network is composed by hand in five places, two of them differently (section 5.1);
  - a down link is drawn along its intent and looks down on the canvas, and no other door can say it is down (section 5.2);
  - `draw about <link>` prints its path as `undefined,undefined -> undefined,undefined` today, on every link (B292, section 5.3).

---

## 2. From-state -> to-state

**From** (measured at `e3f1440`):
- **The store's Models hold no network.** They plan with it (`server/store.js:46-48`, `PLAN`) but are built `new Model({ kinds: KINDS })` (`:674`, `:818`, `:867`), so `pathOf` falls back to `straightPath` (`model/model.mjs:232-236`) and `isLinkDown` answers false (`:244-246`).
- **REST answers the straight polyline** as a link's `path`, in `context/<link>` (`server/rest.js:97`) and `links/<link>/path` (`:664`), and says nothing about whether it is down.
- **The SVG export draws each link through its stops.** `GET /diagrams/<id>.svg` renders `model.toJSON()` (`server/app.js:254`) through `docToSchema` (`kernel/adapt.mjs:67`), which hands the kernel each link's `src`, `via` and `dst`; the kernel threads those (`kernel/engine.mjs:128-141`). It draws no pipe and no down look (`kernel/svg-scene.mjs:79` asks `linkAppearance` with no `down`).
- **`draw combat` and `draw movers` load the document into a Model with the network's kinds and no network** (`cli/verbs.mjs:400-405`, S-e), so movers run along the straight polyline.
- **Spawners arm a down link.** `spawnersOf` takes `pathOf` (`engine/spawners.mjs:40`), and a down link's `pathOf` is its intent (`network/resolve.mjs:55`), so movers would run on a link the canvas shows as down.
- **The lab draws routes, down links and pipes:** a link along its route over pipes; a down link along its intent, dotted (`network/resolve.mjs:12-17`, `kernel/network-appearance.mjs` `down`); and every pipe no up link runs over, a link's dashed and a hand pipe solid (`network/host.mjs:51-62`, `network/appearance.mjs:20`).

**To** (at the end of P4):
- **One function composes the network for any reader:** given a document, a Model that draws with it.
- **The store's Models draw with the network,** so every answer REST gives about a path is the route the lab draws.
- **REST and the CLI say when a link is down,** and which anchors its route runs through.
- **The SVG export draws what the lab canvas draws:** routes, down links as down, and the pipes no up link runs over.\
  CORRECTED 2026-10-04 by H2: the export draws links only -- routes, and down links as down -- and never a pipe.\
  CORRECTED again 2026-10-04 by H2 refined: the export draws what run mode shows -- routes, down links as down, no pipe, no waypoint anchor ring, no bend dot.
- **Movers run along routes and never along a down link,** in `draw movers`, `draw combat` and every page.

---

## 3. The fence

The shared read composition and every consumer that builds a Model to read a document; the store's Models; REST's two path answers and the CLI verbs that print them; the SVG export's links, down look and pipes; spawners and down links; the tests that hold each consumer to the lab's derivation; the production-upgrade entries for what a reader of those doors will see.

---

## 4. The anti-scope fence

- **No change to the product page.** It draws links straight and does not draw pipes until P5 (G1); its movers keep running along its straight paths until then.
- **No pipe verbs:** an agent cannot list, lay or remove a pipe until P6. Only what REST already answers about links changes.
- **No new routing behaviour.** Every route, down link and blocker is the network's, as the lab derives it.
- **No change to the planner, the stored format or the migration.**
- **The kernel's network roles and appearance stay in `kernel/`** until P5 moves them with the canvas (PU22).
- **Production stays on `draw:2538ab8`** (F3).

---

## 5. Three findings that shape the stages

### 5.1 The network is composed by hand in five places

Each of these builds the network's kinds or its network itself:
- **the store:** `productKinds(...NETWORK_ROWS)` and `createNetwork(createTransit())` (`server/store.js:46-47`);
- **the CLI:** `composeKinds([...CORE_ROWS, ...NETWORK_ROWS])` (`cli/verbs.mjs:400-405`) -- the core's storage rows, without the product's checks, because the CLI's layer may not import the planner (`tools/layers.mjs`, `cli`);
- **the dry run:** both, again (`tools/migrate-schema.mjs:104-107`);
- **the lab:** through `createNetworkSession` (`network/session.mjs:50-53`);
- **the tests:** `tests/fixtures/composed.mjs:15-16`.

A reader needs a Model that draws; only a planner needs checked kinds.
**Recommended (judgement):** one function in `network/`, `readModel(doc)` -- the core's storage rows with the network's, a network of the Model's own, the document loaded -- used by the CLI, the export and the dry run.\
The store keeps its checked kinds, since it plans, and gives each Model a network of its own from the same constructor the function uses.\
One network per Model rather than one for the store, because the network caches one derivation per board (`network/view.mjs`, `KEEP`), and 43 diagrams sharing it would evict each other's.

### 5.2 Only the canvas can say a link is down

A down link has no route: the lab draws it along its intent, dotted, and a selected one names what blocks it (`network/resolve.mjs:12-17`, `whyDown`).\
Once the store's Models draw with the network, REST's `path` for a down link is that intent -- a polyline that looks like any other.\
An agent reading it would take a down link for a live one, which is the failure A5 names: acting on state derived rather than given.\
The same holds for the export, which would draw it solid.\
This matters before P6 in particular: until then an agent's plain `draw link a b` lays no pipe (G2), so through REST it will be down wherever no way exists, and today nothing would say so.

### 5.3 `draw about` prints a link's path as undefined

`model.pathOf` answers points as `[x, y]` pairs (`model/model.mjs:274-280`, `network/resolve.mjs:63`); `draw about` prints each as `${p.x},${p.y}` (`cli/verbs.mjs:1027`).\
Measured: a link between two hosts prints `path   undefined,undefined -> undefined,undefined`.\
`draw link path` reads the same answer correctly (`:1077`).\
Filed as B292; fixed in R-b, where that answer changes anyway.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **R-a** | **One read composition:** `readModel(doc)` in `network/`; the CLI's `combat` and `movers` and the dry run use it; the store's Models each get a network | the CLI's two verbs and the dry run unchanged in what they report on today's tests; no consumer composes the network's kinds by hand |
| **R-b** | **REST and the CLI answer routes:** `path` along the route; `route`, the anchors it runs through; `down`; the blockers of a down link; `draw about` and `draw link path` print them (B292 fixed) | on one board, each answer equals the lab's derivation; a down link reports `down` and its blockers |
| **R-c** | **The SVG export draws run mode's picture** (H2 refined): each link along its route; a down link with the canvas's down look; no pipe; no waypoint anchor ring; a bend draws nothing; an endpoint's pad and dot, a junction's mark and the transit ring kept; no socket grid | on one board, the export's link paths equal the lab's derivation; it holds no pipe, no anchor ring and no bend dot, and keeps every endpoint pad, junction and transit ring |
| **R-d** | **Spawners skip down links,** at every door | a spawner at the end of a down link emits nothing in `draw movers`, `draw combat` and the lab |
| **R-e** | **P4 closed:** the parity test over every consumer on one board; the production-upgrade register; `PROMOTION.md` amended | the four consumers and the lab's tab agree on every link of one board; every change in section 7 has a PU entry |

Each stage is one gate and one lab deploy.
**Size, by judgement:** smaller than P3. R-c is most of it -- the kernel takes a route and a down flag per link, as data, since the kernel imports no network.

---

## 7. Behaviour that changes, stated before it is built

**For agents and anyone reading REST** (each a PU entry, reaching production at the cutover):
- **A link's `path` follows its route over pipes,** not the straight line through its stops; the two differ wherever a route takes another way between stops.
- **REST says a link is down,** with its route and its blockers; an agent's plain link with no way reports itself down (G2, until P6).
- **`draw about <link>` prints its path** (B292).

**For anyone downloading the SVG:**
- **Links follow their routes; a down link looks down;** no pipe is drawn (H2). On the estate after migration, every link runs along its stored stops (S-d), so the links change only where a link has gone down since.
- **A download shows what run mode shows** (H2 refined): no waypoint anchor ring, and nothing at a bend but the corner its route turns; endpoints keep their pads, junctions their marks, anchors their transit ring. Every download with a waypoint changes -- today's draws every anchor ring and every bend dot.

**For movers:** a spawner on a down link emits nothing.

**In the behaviour matrix:** nothing changes; the lab already draws routes. A row for a spawner on a down link, if R-d finds the lab arms one.

---

## 8. Coverage, verification, costs

**Proves:** `PROMOTION.md` section 7's criterion 4 for every consumer but the tab (P5); P4's own exit criterion; B292.\
**Defers:** the tab (P5), the Model's `network = null` default and `straightPath` fallback (P5, the page being the last Model that draws without the network), pipe verbs (P6).

**Verification targets:** one board -- a routed link, a link whose route differs from its stops, a down link with a blocker, a ring, a free hand pipe and a spawner on each of an up and a down link -- read through REST, the CLI, the export, `draw movers` and `draw combat`, each held to the lab's derivation; the estate dry run unchanged; mutants on the down flag, the export's route, the pipe visibility rule and the spawner skip.

**Named costs and non-claims (judgement):**
- **REST answers grow by three fields** on a link; nothing is removed or renamed.
- **The export draws no pipe** (H2): a download does not show a free hand pipe or the way a down link would heal onto, though the canvas does -- the screen and a download differ there, by ruling.
- **It does not change what production users see** until the cutover, and does not make the product page route: P5.

---

## 9. Decisions for the director -- one at a time

- **H1 -- how a down link is shown at every door but the canvas.** Recommended: as the lab shows it -- along its intent, marked down: REST and the CLI say `down` and name its blockers, and the export draws it with the canvas's down look. The alternative: answer no path for a down link, which every caller would have to special-case, and which the export could only draw by leaving the link out.
- **H2 -- whether the export draws pipes.** Recommended: yes, the pipes no up link runs over, as the lab canvas does and the product page will at P5 -- so a hand pipe laid with `g` and the way a down link would heal onto appear in a download. The alternative: no pipes until P5, or never; a download would then not show the diagram's free pipes at all.


AMENDED 2026-10-04 -- **H2 refined by the director:** "The SVG download should reflect READ mode "r"". Key `r` toggles run mode (`app/src/keymap.js:85`); no mode is named read, so this is taken as run mode, and the record says so.\
Run mode, measured: it hides every pipe (`network/network.css:24`), each waypoint's anchor ring (`app/style.css:453`) and a bend's centre dot (`:471`); it keeps an endpoint's pad and dot, a junction's mark and the transit ring, and shows no socket grid (`app/src/renderer.js` `renderOpts`).\
So R-c draws that picture.\
The waypoint layers are the kernel's, shared with the canvas (`kernel/network-appearance.mjs` `waypointLayers`), so the export asks for run mode's subset rather than restating it: one list of what run mode hides, read by the canvas's stylesheet rule and the export alike, is R-c's to settle.

AMENDED 2026-10-04 -- **H2 refined again by the director:** run mode and the download are one rendering, decided in one place in code; what is in and out may be adjusted later, there.\
Today they are two: run mode hides by stylesheet rules (`app/style.css:453`, `:471`; `network/network.css:24`) over elements the canvas still draws, and the export draws its own strings from the kernel's layers (`kernel/svg-scene.mjs`).\
**R-c, so:** one rule in the kernel says what a static picture holds -- which waypoint layers, whether pipes -- and both read it.\
The canvas in run mode draws that subset rather than hiding the rest, re-rendering its waypoints and pipes on a mode change as it already re-renders nodes (`app/src/renderer.js` `setMode`), and the network's painter asks the same rule.\
The export draws the same subset always.\
The three stylesheet rules are deleted, and a test holds the canvas in run mode and the export to the same layers for every waypoint role.

AMENDED 2026-10-04 -- **R-a done** (H18.19).\
`network/read-model.mjs`: `readModel(doc)`, a Model of the core's storage rows and the network's that draws with a network of its own, and `readerNetwork()`, that network's constructor.\
The CLI's `combat` and `movers` and the dry run read through it; the store's three Model constructions each take `readerNetwork()`, so every path the server answers is the network's route.\
No REST test changed: every existing test's links run along their stops, or have no pipes and are down, which `pathOf` draws along the same intent.\
Held by `tests/read-model.test.js` and a CLI test: a link whose route bends through a waypoint its stops never name is answered along that route by REST and run along it by `draw movers` -- both failing on the code before; a reader honours transit; a booted diagram draws as a created one does; and no module but the store, the lab, the product page and the reaction table composes the network -- failing before on the CLI and the dry run.\
Mutants: 4, all killed, two by tests added for them.

AMENDED 2026-10-04 -- **R-b done** (H18.20; H1; B292).\
`linkReading(model, link)` in `network/read-model.mjs` is the one answer about a link: its `path`, its `route` as anchor ids, whether it is `down`, and a down link's `blockers`.\
REST's `context/<link>` and `links/<link>/path` both answer it; `draw link path` prints the route or that the link is down and what holds it, and `draw about` prints its path, route or down state in names.\
B292 fixed: `draw about` read a point as `{x, y}`, and points are `[x, y]` pairs.\
REST imports the network, so the incubator list widens by `server/rest.js`; `docs/spec/API.md` amended.\
Held by a CLI test on one board -- an up link's route, and a younger link down, held by the older one holding its pipe -- failing on the code before; mutants 5, all killed.
---

## 10. Axiom alignment audit (M7)

**Identity:** this delta, against `e3f1440`, measured against mission-kit A1-A14 and the director's target state.\
**Verdict: pass-with-guardrails** -- H1 and H2 ruled before R-b and R-c.\
AMENDED 2026-10-04: both ruled.

| axiom | weight | how the delta holds it |
|---|---|---|
| A2 Isomorphic Specification | load-bearing | every door draws the route the network derives, through one composition, so no door draws what the rules do not say |
| A5 Perceptual Parity | load-bearing | an agent reading REST is told a link is down and why, as a person sees on the canvas (H1) |
| A3 Sovereign Composition | supporting | the kernel draws routes, down looks and pipes it is handed as data, and imports no network |
| A8 Gated Recursive Integrity | supporting | the parity test holds every consumer to one derivation before the cutover depends on it |
| A1, A4, A6, A7, A9-A14 | not materially implicated | |

**Tension:** the export showing pipes (H2) against a download that only ever showed links -- resolved by drawing only what the canvas draws, so a download and the screen agree.\
CORRECTED 2026-10-04: resolved the other way by the director (H2) -- a download shows links only, and differs from the canvas where a pipe is free; A5 is held for agents by REST (H1), which a download does not serve.\
**Guardrail:** no consumer composes the network's kinds or its network except through the shared function or the store's constructor; held by a test in R-a.
