# H31 -- draw adopting mission-kit's shared components: the plan of record

The plan by which draw moves its general machinery onto the components mission-kit registers, and helps adjust those components so every project gains (`dev/DECISIONS.md` H31, its correction, and H31-1).\
It names each component draw would adopt, what each would take over in draw, the moves in order with the ruling each needs, what is done, and what draw keeps as its own.

**Standing:** approved by the director as H31's plan of record, 2026-11-11 (`dev/DECISIONS.md` H31-7); its status columns are kept current as each move lands.\
Its first drafts were analyses outside the repository (`~/taceng/drawv2-eval-runs/h31-reuse/`: `DRAW-SIDE.md`, `COMPONENT-SIDE.md`, `COMPARISON.md` under a correction banner, `REASSESSMENT.md`); this document carries everything a reader needs from them.

---

## 1. Why, and how progress is measured

The director's goals (H31-1):
- **Components better for all than draw found them.** Mission-kit's rule for an internal component, which every component here declares: a consumer's measured gap is pressure to adjust the component so every consumer gains, never a reason to hold (mission-kit's components charter, "Internal and external").
- **Draw's bespoke machinery moved into the right component,** draw's product-specific code reduced to declarations over unified mechanisms.

Measured by draw's code ledger (`dev/CODE-SPLIT.md`), at its latest row (`934df3c`, 2026-11-09):

| Measure | Today | Direction |
|---|---:|---|
| Draw's own running code | 14,956 lines | down |
| Vendored component code draw runs | 4,141 lines, 21.7% of what runs | up |
| Draw's declarative share (data, not logic) | 12.4% | up |

Each adoption adds a ledger row, so the change is measured, not claimed.

---

## 2. How the work is run (H31-1)

- **Shared fixes first:** what every component needs to be taken by any project, before any component-specific change.
- **Component changes negotiated with the zorg agent,** which maintains these components, through the two projects' `upstream/` folders (draw's `upstream/README.md`): a letter drafted, ruled by the director, placed in the other project's `upstream/incoming/`, answered on the record.
- **Boundaries are negotiable.** A component's vision, duty or scope may move when draw can argue the move makes the component more valuable; knock-on changes in other components or in zorg's own code are part of the negotiation.
- **One draw capability at a time,** the components that bear on it reasoned together, since they pull against each other. The first is planning a change.
- **One ruling per move.** Each repository records its change in its own decision log and cites the ruling it acts under.
- **Adoption into draw needs a design of record and the director's ruling** (H26-3), and lands lab first, production on the director's approval, as every draw change does.
- **Draw's builders make agreed changes** in the component repositories (H31-1, amended), with zorg's agreement each time.

---

## 3. The components

| ID | Component | What it would take over in draw | Draw's code there today | Component status | Move |
|---|---|---|---|---|---|
| C15 | entity-graph | Working out a change: references between things, side effects, checks across several things, undo | the planner, about 560 engine lines plus the plugins' rules | draft, no code; boundaries agreed with zorg | 2, 7 |
| C4 | entity-store | First, under entity-graph: the order of changes, the conflict check, undo's stored records. Later: where diagrams are kept | part of the planner; then `server/store.js` and its files, about 1,000 lines | released 0.2.0 | 2, 8 |
| C3 | shape-check | Checks that a single thing is well formed: types, lengths, ranges, required fields, as data | `planner/validate.js` and the rows' field checks, about 300 lines | released 0.2.0 | 2, 4 |
| C9 | operation-command | The command-line tool's command handling: options, help, exit codes that say why a command failed | `cli/draw.mjs`, about 160 lines | released 0.1.0 | 5 |
| C5 | operation-call | Matching a request to its reply, with time limits; beneath operation-command, and later beneath live updates | the `txnId` and `ack` pairing in `app/src/sync.js` | released 0.1.0 | 5, 9 |
| C7 | caller-identity | Who a request comes from: a person through Google sign-in, an agent through a code | `server/identity.mjs`, about 110 lines | released 0.1.0 | 6 |
| C6 | entity-api | Live updates between the server and the pages watching a diagram | `server/protocol.js`, `server/hub.js`, `app/src/sync.js`, about 1,850 lines with REST | released 0.1.0 | 9 |
| C10 | credential-issuer | Agents' connection codes, single use per connection | `server/codes.mjs` and the store's code methods | released 0.1.0 | 10 |
| -- | a cloud-bucket component, proposed | Keeping files in a cloud bucket: writes that refuse to overwrite a newer version, retries, paging, recovering a deleted file | `server/files.mjs`, 168 lines | not yet proposed to zorg | 8 |

**Set aside: operation-proxy (C8).**\
It shares one long-lived connection among short-lived command-line runs; draw's tool makes one web request per command, so it has none to share.\
It returns if the command-line tool comes to hold a connection.

**The cloud bucket is its own component, not part of entity-store** (the director, 2026-11-11: "I presume then that "cloud-bucket" could be drafted as a separation component, and not jamming the code into entity-store?").\
The vision of entity-store says it is not a network service, and today it stores in memory or a local file; cloud code inside it would ride along to every project that uses it.\
The bucket's job -- files kept safely in a cloud bucket -- is one of its own, useful without entity-store, and draw's `server/files.mjs` is a working, tested start.\
What it needs of entity-store: a storage connection that can wait on a slow save (it is synchronous today), which the bucket component then serves.

---

## 4. The moves

| # | Move | Depends on | Ruling | Status |
|---|---|---|---|---|
| 1 | **Shared fixes** across C3 to C10: a release in the pinned-file form with CI on Node 22 and 24, links between components as releases, AGP for development only, contracts minted | -- | H31-2 (request), H31-5 (done) | **Done** 2026-11-10: all eight released `0.1.0`, published, immutable, verified |
| 2 | **Planning a change, the boundaries:** entity-graph, entity-store and shape-check (section 5) | -- | H31-3 (sent), H31-8 (ruled), H31-9 (building) | **Boundaries agreed and ruled** 2026-11-11; the four contracts merged by zorg (its D76); shape-check `0.2.0` (dialect 2) and entity-store `0.2.0` (the many-write change, expected position, note) released 2026-11-11; entity-graph being built (move 7) |
| 3 | **Draw's word check** takes a shared component's ordinary words by allowances held in draw | -- | H31-4 | **Done** 2026-11-10 (`98b6ccf`) |
| 4 | Draw takes shape-check for its field checks; the command-line tool learns the kinds from the server | 1, 2 | design of record, ruling | not started |
| 5 | Draw's command-line tool on operation-command and operation-call; REST writes take a request identity | 1 | design of record, ruling | not started |
| 6 | Draw's identity checks on caller-identity, which learns ordinary web request evidence | 1 | design of record, ruling | not started |
| 7 | entity-graph built and passing draw's 1,044 planner cases; draw's planner moves onto it, over draw's own storage | 2, 4 | build plan approved (H31-10); draw's adoption a design of record and ruling | **entity-graph's build begun** 2026-11-11: M1 of eight, about 32 agent-days in all; draw unchanged until its design is ruled |
| 8 | Storage: entity-store's waiting storage connection, the cloud-bucket component, draw's diagrams moved in, production migrated in a freeze | 7 | design of record, ruling | not started |
| 9 | Live updates: operation-call's web-page and HTTP delivery, entity-api's local view, draw's hub and sync moved onto entity-api | 5, 8 | design of record, ruling | not started |
| 10 | Agents' codes on credential-issuer | 6, 9 | design of record, ruling | not started |

Each move is useful on its own; the order puts the dependency first (shape-check is beneath every other component), the small adoptions before the large, and the riskiest data move after the planner is proven by its cases.

---

## 5. Planning a change: the boundaries agreed with zorg

Proposed in `upstream/drawv2-planning-boundaries-proposal.md`, with the analysis in `upstream/drawv2-planning-position.md`; zorg agreed all twelve, with the limits below (`upstream/drawv2-planning-boundaries-reply.md`), and the director ruled them (H31-8).

**entity-graph (C15):**
1. Two kinds of side effect: reference rules (delete what depends on a deleted thing, unlink, steal, keep a minimum) repeat until nothing changes; an application's own side effects run once each in phases it declares, two writing the same thing failing loudly (draw's PD-3).
2. A thing deleted once nothing refers to it any longer (draw's orphan sweep).
3. Side effects held to the rules a direct edit meets (draw's B302).
4. A resolver that works out a new item's place against the edit so far.
5. Facts attached to an edit, readable by its side effects.
6. Undo replays its stored reversal exactly and is still checked.
7. A general storage connection, with entity-store as its reference.
8. Refusals carrying facts, each application keeping its own words.

**entity-store (C4):**
9. Saving many changes in one go.
10. A conflict check on the whole store's position (draw's `expect`).
11. An optional note kept with each change, where undo's reversals are kept.

**shape-check (C3):**
12. A second version of its shape language adding minimum, maximum and no-duplicates.

**zorg's limits:**
- A many-change save holds 1 to 2,000 changes and at most 8 MiB, one change per thing (draw's planner merges several changes to one thing first).
- The note is at most 512 KiB, settled by zorg from draw's measurement (a realistic 2,000-change edit's undo record is about 244 KiB); an edit whose record would not fit is refused and split.
- zorg's stored logs read unchanged: the note is left out when absent.
- The stopping rule: reference rules to a fixed point, then each phase once in order, the reference rules again after each, a finished phase never re-entered.
- Undo's replay recorded as entity-graph's decision `D7`; entity-graph stays one component.

**Projected effect (an estimate, entity-graph having no code yet):** about 680 of the 1,086 lines involved leave draw and about 55 to 85 return as declarations and connecting code; draw's own running code falls by about 600 lines, and the vendored share rises to about 28 to 30%.

**Not yet measured:** how many of the 1,044 planner cases change -- the order of changes within an edit may differ with the same result, and judging references by an edit's result would turn some refusals into acceptances, each needing the director's ruling.

---

## 6. What draw keeps

Draw keeps what is its product, ideally as declarations:
- its kinds' shapes and reference rules, as data;
- its conditions: a straight link's capacity, one device per anchor, transit offered by type;
- its side effects: cutting and joining links, legs, a grid size change;
- its resolvers: placement, drawing order;
- its policy numbers: the undo bound and its rule that a person's last change stays undoable while agents edit, the most changes an edit may hold;
- its look, its device types, its network rules, its canvas, and the four components it made (C11 to C14).

---

## 7. Risks

| Risk | Where | Mitigation |
|---|---|---|
| entity-graph's way of resolving side effects differs from draw's ordered phases | move 7 | the agreed hybrid and stopping rule; draw's 1,044 cases as the measure, each difference ruled |
| Moving production data | move 8 | a freeze, as schema 4 was; the old files kept until a restore drill passes; the bucket's seven-day soft delete |
| Agents' exit codes change | move 5 | published in `draw help` and the agent docs in the same release |
| Agents' credentials change | move 10 | both kinds accepted for a stated window |
| A change for draw breaks zorg | every move | additive changes, existing options kept; zorg reviews each contract change |
| An allowance hides a real leak of draw's words | every adoption | one allowance per word per component, counted, citing the component's term (H31-4) |
| Cost per use in the page or on the server | moves 4, 7, 8 | measured before each ruling |
| Rulings queue on one director | every move | one ruling per move |

---

## 8. Open items

- The build report sent to zorg (H31-11): its answer on the seven things, entity-store's one-way log format first, and its review of entity-graph's proposed readings, D11 to D14.
- A query component above entity-graph, held until a project needs one (B459).
- zorg's answers to the review request sent after entity-graph's milestone 4 (H31-14): D30 and D31, two questions of shape-check, and seven contract questions from draw's own cases; zorg accepted D10 to D29 and the refusal member `writers` already (H31-13, overtaking H31-12).
- mission-kit's C3, C4 and C15 entries updated, as zorg asked (H31-13).
- zorg's agreement to entity-graph's D37, an undo over another writer's change refused, and its sentence for the contract's *Undo and redo* (H31-15).
- entity-graph's build, M1 to M8 (H31-10); entity-store's 2,000-write bound holds after consequences, so an edit past it is refused, where draw today bounds only the request.
- The cloud bucket as its own component: agreed by zorg, with an asynchronous storage port in entity-store at move 8.
- How many planner cases change under entity-graph's semantics, measured before move 7's ruling.

---

## 9. Where the record is

- Rulings: `dev/DECISIONS.md` H31 and its correction, H31-1 and its amendments, H31-2 to H31-5.
- Progress: `dev/BOARD.md`, section H31.
- Correspondence: `upstream/`.
- Draw's register of mission-kit standings: `tools/layers.mjs` `MISSION_KIT`.
- The releases: `https://github.com/apnex/<component>/releases/tag/v0.1.0`.
