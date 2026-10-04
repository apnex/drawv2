# The product page composes the network -- promotion's P5 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-04 against `ac5579f`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> AMENDED 2026-10-04: approved; J1 to J3 ruled as recommended (section 9).

## 1. Status

- **Asked for:** the director, 2026-10-04, approving H18.24 -- P5's design before any code ("approved. proceed").
- **Is:** stage P5 of `PROMOTION.md` section 6 -- "a `#pipes` layer and pipe painter in the renderer, `networkInput` in Input, `/network/` served, the page closure and the incubator boundary widened in one diff", proven when "the product page draws pipes and routed links, `g` works there, and the lab root holds no network orchestration" -- with what P3 and P4 handed it:
  - PL-6, the browser previewing with the planner, and the tab agreeing before the answer (G4; PD-5);
  - the kernel's network roles and appearance moving into `network/` (G5's second half; PU22);
  - the Model's `network = null` default, the last production Model drawing without the network (`CONSUMERS-ROUTE.md`, P4 closed).
- **Judged against the target state** the director stated (`dev/DECISIONS.md`, "Promotion's target state"): clean, deduplicated, modular, in step with the lab. P5 removes three of the named stopgaps (G1, PL-6's copies, the null default) and adds none.
- **Found while measuring:**
  - the lab's network choreography is already the plugin's (`network/host.mjs` `attachNetwork`), so the page attaches it as the lab does; what differs is where an answer arrives (section 5.1);
  - transit's cut already mints its pieces' ids from the cut (`network/transit.mjs:79`, H17-D10), so one preview needs that rule in one more place only: the junction split, which is browser-only today (section 5.2);
  - the kernel's export and the canvas both read the network's look from `kernel/`, so moving it puts `network/` under the export door and most of the page -- the incubator boundary stops meaning anything (section 5.3).

---

## 2. From-state -> to-state

**From** (measured at `ac5579f`):
- **The page holds the network's kinds and nothing else of it.** It composes `productKinds(...NETWORK_ROWS)` (`app/src/main.js:51`) and a Model with no network (`app/src/compose-canvas.js:63`), so links are drawn straight through their stops and none is ever down; it has no `#pipes` layer (`app/index.html:118-130`) and loads neither network stylesheet (`app/index.html:7`, against `lab/index.html:28-30`).
- **The page has no `g`, no `x`, and no drag judge:** `networkInput` is passed by the lab alone (`lab/src/root.js:79`), so a drag commits a link with no pipes, which the server's `link-legs` lays only when it has pins (G2).
- **The lab attaches the network** -- its painter, judge, transit edits and settle (`network/host.mjs`) -- around its own in-page planner (`lab/src/root.js:106-157`).
- **The browser keeps three copies of planner rules:** the delete cascade and the group trim (`app/src/commands.js:76-170`) and the junction split (`app/src/input.js:955`, `splitsFor`). It sends their consequences as ops, and reconciles the server's answer by applying the planned ops it did not send (`app/src/changes.js` `derivedToApply`).
- **The junction split is the browser's alone:** a link drawn through REST or the CLI to another link's bend does not cut it (B243, held for promotion).
- **The network's roles and appearance live in `kernel/`** (`kernel/network-roles.mjs`, `kernel/network-appearance.mjs`), read by the canvas, the export and the network's own modules.
- **`new Model()` takes no network and draws links straight** (`model/model.mjs:111`, `:232-236`).

**To** (at the end of P5):
- **The page composes the network as the lab does:** a Model that draws with it, its pipe painter and drag judge attached, `g` and `x` working, every answer settled through it.
- **The browser previews with the planner:** it sends only what the author did, plans its own view with `plan()` and the same composition, and corrects to the server's answer where they differ. The three copies are deleted.
- **A link landing on another link's bend is cut there at every door,** by a planner reaction, its piece's id derived from the cut.
- **The network's look is in `network/`,** and `network/` is a product folder like any other.
- **A Model that holds links draws with the network.**

---

## 3. The fence

The product page's composition and its stylesheets and layers; the shared attach of the network to a page; how an answer and another writer's change are settled on the page; the browser preview and the requests it sends; the three rule copies; the junction split as a reaction; the network's roles and appearance and their importers; the incubator boundary; the Model's network default; the tests, corpora and records that move with them.

---

## 4. The anti-scope fence

- **No pipe verbs** in the CLI or REST: P6.
- **The behaviour matrix stays on the lab** until P7 runs it on the product page.
- **No new routing behaviour.** Every rule is the network's as the lab runs it; what changes is the page running it.
- **No change to the stored format, the migration or the server's planner** beyond the junction split, which every door already should run (B243).
- **The core Model's link methods stay** until the rebuild moves them (K13d), and with them `MODEL_READS`.
- **Production stays on `draw:2538ab8`** (F3); the page changes on `main` and in tests until the cutover.

---

## 5. Three findings that shape the stages

### 5.1 The page attaches the network as the lab does; only the answer's door differs

`attachNetwork` (`network/host.mjs:33`) takes a page's model, renderer, selection, history and a pipe layer, and returns `judge`, `answered`, `refused`, `seed` and `paint`.\
The lab calls `answered` from its in-page commit (`lab/src/root.js:146`); the page's answers arrive in `Sync` (`app/src/sync.js:616`, and another writer's at `:765`), which applies them with `derivedToApply` and calls nothing of the network.\
So the page needs two hooks in `Sync` -- an accepted answer, and another writer's change -- through which the network settles the board: repaints pipes, redraws the links whose routes changed, and says what is down.
**Recommended (judgement):** one function in `network/`, `composePageNetwork({ parts, say })`, used by both roots, so the lab root holds no network wiring of its own -- P5's exit criterion -- and what the page says goes where section 9's J3 rules.

### 5.2 One preview needs derived ids in one more place

For the browser's preview and the server's answer to agree, every id the planner mints must be the same on both (H17-D10).\
Measured: the planner mints ids in one reaction today, transit's cut, and derives them (`network/transit.mjs:79`, `pieceId`); the join keeps a survivor's id; pipes are named by their ends; drawing orders are counted from the document.\
The junction split mints a piece too, and is the browser's alone (`app/src/input.js:955`) -- so as a planner reaction it takes the same `pieceId` rule, moved beside `splitAtBend` in `network/link-rules.mjs`.\
That one reaction also closes B243: a landing on a bend cuts at every door.

### 5.3 Moving the network's look puts `network/` under most of the product

`kernel/network-roles.mjs` and `kernel/network-appearance.mjs` are read by the canvas (`app/src/renderer.js`, `input.js`, `painter.js`, `readout.js`), the export (`kernel/engine.mjs`, `kernel/svg-scene.mjs`) and the network itself (`network/appearance.mjs`, `network/host.mjs`).\
In `network/` they put it under every one of those, beside the store, REST, the export door, the CLI and the page root that already import it (`tests/scan-layers.test.js` `MAY_REACH_THE_INCUBATOR`, eleven entries).\
The list was written as "widening it IS the promotion"; by the end of P5 it would name most of the product, and the layer manifest already judges every edge into the `network` layer (`tools/layers.mjs`, L2).
**Recommended (J1):** retire the incubator boundary at P5, its job done; the layer rules keep judging every edge.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **V-a** | **The network's look is the network's:** `kernel/network-roles.mjs` moved into `network/` as its roles module, `kernel/network-appearance.mjs` merged into `network/appearance.mjs`; importers re-pointed; the incubator boundary retired (J1) | every corpus unchanged; no module in `kernel/` draws a network role; the export's and the canvas's tests unchanged |
| **V-b** | **The page composes the network:** `composePageNetwork` in `network/`, used by the lab root and the page; the page's Model draws with the network; `#pipes` and the network stylesheets in `app/index.html`; `networkInput` in the page's Input; `Sync`'s accepted answers and other writers' changes settle through it; what the network says reaches the page (J3) | in Chrome against a real server: the page draws pipes and routed links, `g` lays a hand pipe, `x` toggles transit, a down link is drawn down and says why; the lab root holds no network wiring |
| **V-c** | **The junction split is a reaction:** a link landing on another link's bend cuts it there, its piece's id derived (`pieceId`); `splitsFor` deleted from Input | a REST and a CLI landing cut as the browser's drag does (B243 closed); the gesture corpus differs only where the browser's split ops become the planner's |
| **V-d** | **One preview (PL-6):** the tab plans its own view with `plan()` and the page's composition, and sends only the author's ops; `deleteSelection`'s cascade and group trim deleted; reconciliation corrects the preview to the answer where they differ; the corpus records intent only | for every planner and gesture corpus case, the preview equals the server's answer (PL6); a pin deleted on the page deletes its link before the answer arrives (G4); B221 closed |
| **V-e** | **P5 closed:** a Model that holds the link kind requires a network (J2); the register; `PROMOTION.md` amended | no production or lab Model draws without the network; the estate dry run unchanged; every change in section 7 has a PU entry |

Each stage is one gate and one lab deploy.
**Size, by judgement:** the largest stage after P3. V-d is most of it -- it changes what the browser sends, the corpus that records it, and the reconciliation every answer passes through -- and V-b is the first to change what a person on the product page sees.

---

## 7. Behaviour that changes, stated before it is built

**For people on the product page** (each a PU entry, reaching production at the cutover):
- **Links are drawn along their routes over pipes;** pipes no up link runs over are drawn -- a link's dashed, a hand pipe solid; a down link is dotted and orange, and says why when selected.
- **`g` and `x` work:** `g` lays a hand pipe as the lab does; `x` turns an anchor's transit off and on, cutting and joining links there.
- **A drag lays its link's pipes** with the link, as the lab's does.
- **Edits show their whole consequence at once:** deleting a pin deletes its link before the server answers, and a join or a sweep shows without the round trip (B221).

**For agents:** a link landing on another link's bend through REST or the CLI cuts it there, as a drag always did (B243).

**In the behaviour matrix:** nothing; P7 runs it on the page.

---

## 8. Coverage, verification, costs

**Proves:** P5's exit criteria; G4's moved half (the tab agrees before the answer); PL-6 and PL6, PL7; PU22; B243, B221; `PROMOTION.md` section 7's criterion 1 for the page, and criterion 7's last item, the `straightPath` default.\
**Defers:** the matrix on the page (P7); pipe verbs (P6); the Model's link methods and `MODEL_READS` (K13d, the rebuild).

**Verification targets:** the product page in real Chrome against a real server -- pipes, routes, `g`, `x`, a down link and its notice, a pin deleted before the answer; every planner and gesture corpus case previewed and compared with the server's answer; REST and CLI landings on a bend; the estate dry run; mutants on the settle hooks, the preview's reconciliation, the split reaction's derived id and the Model's requirement.

**Named costs and non-claims (judgement):**
- **What the browser sends changes** (V-d): log records and the gesture corpus record intent only, and an outbox written before V-d replays its old consequence ops, which the planner accepts as it does today.
- **The page loads more modules:** the network's, and the planner's in the browser for the preview.
- **It does not put the product page in production:** the cutover is P9.

---

## 9. Decisions for the director -- one at a time

- **J1 -- the incubator boundary.** Recommended: retire it at P5 -- `network/` becomes a product folder, and the layer manifest keeps judging every edge into the `network` layer. The alternative: keep widening its list, which by V-a names most of the product and stops distinguishing anything.
- **J2 -- a Model without the network.** Recommended: a Model whose composition holds the link kind must be given the network, so no Model draws links straight; `straightPath` stays only as a down link's intent, drawn by the network. The alternative: keep the null default as core behaviour, which every production Model would then simply not use.
- **J3 -- where the page says what the network says** (a down link and why, a transit cut, what an edit left down). Recommended: the header banner, where the page already says what sync says, transient as the lab's notice is. The alternatives: the readout line at the bottom, or say nothing on the page and draw it only.


AMENDED 2026-10-04 -- **J1 to J3 RULED as recommended** (`dev/DECISIONS.md`, "P5's design decisions, J1 to J3").\
The incubator boundary retires at V-a; a Model holding links requires the network from V-e; the page says what the network says in its header banner.

AMENDED 2026-10-04 -- **V-a done** (H18.25; PU22; J1).\
`kernel/network-roles.mjs` is `network/roles.mjs`; `kernel/network-appearance.mjs` is merged into `network/appearance.mjs`, the pipes' look at its end, so one module says how everything the network draws looks. Every importer is re-pointed; the canvas and the export read the network's look from `network/`.\
**The incubator boundary is retired** (J1): its test is deleted and recorded; the layer rules judge every edge into the `network` layer.\
**Three copies deleted, which the move made possible:** the link rules restated `linkFacing` as `facing`, the plane check as an inline comparison, and the orphan sweep restated `linkEndsAt`, because `kernel/` and `model/` could not share by import (C9). All three now read `network/roles.mjs`, and `scan-twins` drops the exemption it carried for the first.\
Every corpus unchanged; the export's and the canvas's tests unchanged but for the paths they read.

AMENDED 2026-10-04 -- **V-b done** (H18.26; J3).\
`network/page.mjs`, `createPageNetwork()`: the network composed into a page in two steps -- its `network` and input `plugins` for the canvas, then `attach` with the canvas's parts. The lab root and the product page both call it; the lab root holds no network wiring of its own (P5's exit criterion).\
**The page:** its Model draws with the network; Input takes its keys and drag judge, so `g` and `x` work; `app/index.html` has `#pipes` and loads the network's stylesheets; what the network says goes to the header banner (J3), after Sync's state emit so it is not overwritten at once, until the next.\
**Sync's three hooks:** `onAnswered` after an accepted answer to the tab's own request, `onChanged` after another writer's change or a snapshot, `onRefused` after a refusal; the network's host gained `settled` (an answer the page has already applied) and exposes `redraw`. Sync knows nothing of the network.\
**Held in real Chrome against a real server** (`tests/browser.test.js`, "V-b"): a link drawn along its route over pipes, its pipes under it; a link with no pipe drawn down, and saying why in the banner when selected; the lab matrix's HEAL-02 on the page -- `g` lays a hand pipe, makes no link, and the down link is drawn up again once the board settles; `x` turns an anchor's transit off through the server, and the link that ran through it is drawn down. Failing on the code before; mutants 4, all killed, two after the test was made to read the page's drawing rather than the model's answer.\
The K8 DOM snapshot differs only by the new `#pipes` layer. The test's board sorts after the harness's, since the shared tab opens the first diagram.

AMENDED 2026-10-04 -- **V-c done** (H18.27; B243; H17-D10).\
`junction-cut`, a reaction in the network's tenant (`network/network.mjs`), in the reshape phase beside transit's cut: a link made in the edit, with an end on a waypoint another link bends through, cuts that link there; a piece is cut again if it bends at the other end; a ring has no ends and cuts nothing.\
Both cuts share one shape, `cutAtBend` in `network/link-rules.mjs`: the cut link re-ended, keeping its id, order and declarations; its new piece the newest, its id derived from the link and the bend (`pieceId`, moved there from transit's cut).\
The browser's `splitsFor` is deleted, and `routeLink` and `routeLinks` send no split; L9's restatement ratchet falls to one (`groupAfterRemoval`, which goes at V-d).\
**Corpora, each change reviewed:**
- **Planner:** 56 of 1,044 cases differ. 23 accepted before and after, now with the cut's two link puts, and in 9 of them the pipe edits that follow from the pieces. 27 accepted before are refused now: the generator lands a straight link on a bend whose pair already holds one, and the cut makes the second straight link the pair may not carry (B81) -- the browser's own split, the rule being moved, refused the same. 6 refused before and after, the first reason reported differing.
- **Gesture:** one scenario, `link-to-waypoint-end`: the drag sends the link alone, the planner cuts.
- **Matrix:** SRC-01 and SRC-02 identical but for the canonical numbering of their links, which follows first appearance and moved with the derived id; every row's own check passes.
Held by a CLI test -- `draw link` to a bend cuts the link there, its piece's id the derived one, and a ring made through a bend cuts nothing -- failing on the planner before. The two input tests of the cut plan what the drag sent, as the server does. Mutants: 5, all killed, one by an assertion added for it.
---

## 10. Axiom alignment audit (M7)

**Identity:** this delta, against `ac5579f`, measured against mission-kit A1-A14 and the director's target state.\
**Verdict: pass-with-guardrails** -- J1 to J3 ruled before V-a, V-e and V-b respectively.

| axiom | weight | how the delta holds it |
|---|---|---|
| A2 Isomorphic Specification | load-bearing | one planner plans the preview and the answer, so the browser's copies of its rules go (PL-6); one split rule at every door (B243) |
| A3 Sovereign Composition | load-bearing | the page composes the network through the function the lab composes it with; the network's look lives with the network |
| A5 Perceptual Parity | supporting | a person on the page sees routes, down links and why, as an agent reads them through REST (P4) |
| A8 Gated Recursive Integrity | supporting | the preview is held to the server's answer on every corpus case before the cutover depends on it |
| A1, A4, A6, A7, A9-A14 | not materially implicated | |

**Tension:** one preview (A2) against what the browser sends today -- resolved by ruling (PD-5) and by holding every corpus case to the answer (PL6).\
**Guardrail:** no stage adds a stopgap; V-e checks that none of P3's and P4's named stopgaps due at P5 survives it.
