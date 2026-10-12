# The target aligned with mission-kit (H21.9)

The director's direction (H21.9, `dev/DECISIONS.md`): "goal is to have a target state that aligns with mission-kit - however we are not going to migrate just yet".\
This design compares each part of drawv2's anchored core (`tools/layers.mjs` `PARTS`, rendered in `docs/ARCHITECTURE-TARGET.md` section 4) with mission-kit's registered components, the components proposed beside them, and the candidates zorg's investigation found, and states what the target becomes when aligned.\
The code does not move; each difference the alignment opens is a divergence the target lists, held until the director starts a migration.\
Nothing here changes the target until the director rules the decisions in section 7 and ratifies the revised target.

---

## 1. What mission-kit asks of a system's target architecture

Read from mission-kit's own text on 2026-10-12; each item cited there.
- **One-duty components, each with what it exposes and what it consumes** -- the load-bearing section, no duty needing "and" (AR1, "The anchored core"; E6).
  mission-kit prescribes no column set, no kind vocabulary and no format for consumes lines, and holds no tool that checks them.
- **The peer's convention:** zorg's target names each part's kind -- `registered component (C1)`, `proposed component`, or a system part -- writes its consumes at capability level as `- \`consumer\` from \`provider\`: \`capability\``, and checks them with zorg's capability checker, which also runs the fit census: per component, which offered capabilities the system uses and which it leaves unused.
  mission-kit records this convention only as an open row (its B84).
  Run against drawv2's target today, zorg's checker finds "no parts table" and "no consumes lines".
- **Use before build:** assemble from the registry; a component that almost fits is adjusted, not forked; a miss is a finding about the index (C0, "Use before build", "Adjustment over replacement").
  No mission-kit method holds the comparison yet (C0, "Neighbours").
- **Cite, do not restate:** an architecture cites a component and links its contract (mission-kit style S3, rule 2).
- **Axioms by traits:** an axiom binds a system only if the system has a trait its `applies-to` names, or it is on the floor; claiming one otherwise is "the ungated adoption" (mission-kit's axioms charter, "Faults", and its traits charter).
- **The target tracks the ratified rulings** (AR1, "Purpose": the target is "the current architecture plus every ratified decision not yet built"), so a component enters drawv2's target by the director's ruling, not by this design.
- **Instance paths:** mission-kit's ruling 0076 puts a system's board, backlog, decisions and deltas in its `docs/` folder; drawv2 keeps the first three under `dev/`.
- **Patterns that already describe drawv2:** P4, a domain-neutral core programmed by tenants -- drawv2's core and plugins; P5, every surface driven from one manifest -- drawv2's CLI and REST; P3, a master representation with the other generated and a parity gate -- drawv2's generated architecture.

---

## 2. The evidence

### 2.1 Components with standing

Read from each component's `CONTRACT.md`, `README.md` and `package.json`, and from mission-kit's registry, on 2026-10-12.

| Component | Standing | Duty, verbatim | State |
|---|---|---|---|
| `agp` | registered, `C1` | Route messages between named application endpoints across a topology no one centrally administers | ratified v1, tested; Node only as built -- the browser not established (its B50) |
| `context-lab` | registered, `C2` | Run experiments on the context language-model agents are given, and report what each experiment showed | first slice built; a tool, not a library |
| `operation-call` | proposed, zorg | Give every invocation of a named operation exactly one honest ending, within a bound its caller chose | certified at zorg's Delta 1 |
| `entity-store` | proposed, zorg | Keep typed, tagged entities in a single order of changes that every read can be dated against | certified at zorg's Delta 1 |
| `shape-check` | proposed, zorg | Judge whether a value fits a shape declared as data | certified at zorg's Delta 1 |
| `caller-identity` | proposed, zorg | Establish the principal each request comes from, from the evidence its caller presented and the host's rules | certified at zorg's Delta 1; `verified-principal`, which drawv2's sign-in and codes need, deferred |
| `entity-api` | proposed, zorg | Make an entity store reachable by name, so a remote caller can rely on exactly what a local one can | built, awaiting verification |
| `operation-proxy` | proposed, zorg | Let short-lived processes invoke named operations through one long-lived caller they share, each invocation still ending honestly | built, awaiting verification; Linux only |
| `operation-command` | proposed, zorg | Run one declared invocation from a command line, reporting its ending through the exit status | built, awaiting verification; `command-reference`, which drawv2's generated help needs, deferred |
| `credential-issuer` | proposed, zorg (D38, D39) | Issue the credentials a caller presents to reach a hub, from authority the host accepts | no code; D39 moves drawv2's connection codes into it |

Every proposed component is TypeScript, ESM, Node 24 or later, `private`, unpublished, and depended on by `file:` links to a checkout beside the consumer.

### 2.2 Candidates

zorg's D32 investigated the component set against zorg and drawv2: three model families each proposed a set and composed drawv2 from it at `2eae703`, and judges from other families synthesised the proposals (the investigation's record is kept outside both repositories, as `component-set-investigation-2026-10-10`).\
D32's ruling names drawv2 "the future refactor target the shared components are designed against, and the second consumer".\
D35 rules that "a mechanism that holds nothing particular to one application is a sovereign component even while only one application needs it", with the director's steers: "a change planner is a modular, sovereign, decoupled component"; "input capture is a component"; "identity is a component, unifying what drawv2 does, what AGP's evidence supplies and what zorg's hub needs"; "a vector scene is a component".

| Candidate | Duty, as the synthesis words it | Judges | Standing |
|---|---|---|---|
| change planner | Derive the complete change a requested intent implies against a snapshot of a store | three | D35 steer |
| input binding | Resolve each input to the one declared action it means in its context | three | D35 steer ("input capture") |
| vector scene | Draw supplied visual descriptions as a vector scene | three | D35 steer |
| entity view | Keep a local view of a remote store current, dated by the position it reflects | three | proposal, unruled |
| change undo | Reverse a store's most recent retained changes, last in first out | two | proposal, unruled |
| write outbox | Retain each sent write whose outcome is unconfirmed until its outcome is known | two | proposal, unruled |
| resource lease | Grant one holder at a time temporary exclusive control of a named resource | two | proposal, unruled |
| static host | Serve files only from declared folders, or dispatch HTTP through declared mounts | two | proposal, unruled |

The synthesis keeps minority positions -- durable storage apart from entity-store, input capture apart from binding, an estimate of the authority's time (drawv2's `app/src/clock.js`), an HTTP door for named operations -- and decides no names and no timing.\
All three seats compose drawv2's live channel over `agp`, a diagram as an `entity-store`, served by `entity-api`, checked by `shape-check`, its operations through `operation-call`; all three keep REST as drawv2's own door.

---

## 3. Each part, aligned

Every part of the ratified target (H21.6), with what it becomes when aligned, the standing of what it aligns to, and the work D35's question names -- "what would it take to make this free of project-specific content?".

| Part | Aligned as | Standing | Fit gap, or the work named |
|---|---|---|---|
| `lattice` | drawv2 part | -- | grid semantics are drawv2's content |
| `kind-contract` | drawv2 part, consuming `shape-check` for field shapes | proposed | shape-check's dialect 2 (`minimum`, `maximum`, `multipleOf`), per the synthesis |
| `document` | `entity-store`, adjusted | proposed | a store per document, identities a writer chooses, a check against the whole store's position, the application's rules inside the single order, before-images (synthesis); names unique across every named kind (N5), where entity-store keeps them unique per kind |
| `relations` | drawv2 part | -- | derivation over drawv2's kinds |
| `colours` | drawv2 part | -- | the palette is drawv2's |
| `primitives` | within `vector-scene` | candidate, D35 steer | the shapes painters compose, free of drawv2's kinds once B338 moves the device art out |
| `rules` | `input-binding` | candidate, D35 steer | none for resolution: `kernel/input-rules.mjs` is already free of drawv2's content (synthesis) |
| `planner` | `change-planner`, drawv2's invariants and tenants supplied to it | candidate, D35 steer | the planner names the network's tenant and its kinds (`planner/txn.mjs`) -- B332's work |
| `layouts`, `devices`, `network`, `zones`, `groups`, `simulation` | drawv2 parts | -- | the plugins are drawv2's domain; the unification's later stages act inside them |
| `product` | drawv2 part | -- | drawv2's composition |
| `canvas` | drawv2 part, consuming `input-binding` | candidate | the gesture rows are drawv2's; their resolution is the component's |
| `renderer` | `vector-scene` | candidate, D35 steer | the renderer imports grid geometry (`app/src/renderer.js`); the painters stay in drawv2's plugins |
| `sync` | `entity-view` and `write-outbox` | candidates, unruled | the view and the outbox are drawv2's websocket protocol today; the clock is a minority candidate |
| `product-page`, `lab`, `server` | drawv2 composition roots | -- | the static responder within `server` aligns to `static-host`, a candidate, unruled |
| `access` | `caller-identity`, with drawv2's access ruling a drawv2 part and its codes `credential-issuer`'s | proposed | `verified-principal` and credential-issuer are unbuilt; the ruling -- owners, grants -- stays drawv2's |
| `placement` | drawv2 part | -- | choosing a free anchor is drawv2's geometry |
| `store` | `entity-store`'s storage port, with a drawv2 catalog of diagrams | proposed | templates, retention and the diagram caps stay drawv2's |
| `hub` | `entity-api` over `agp`; locks to `resource-lease` | proposed; `C1`; candidate | entity-api serving a set of stores (synthesis); agp in the browser, unestablished |
| `rest` | drawv2 part, invoking operations through `operation-call` | proposed | the HTTP door is drawv2's in every seat; an HTTP-door component is a minority candidate |
| `cli` | drawv2 part over `operation-command` and `operation-proxy` | proposed | `command-reference` for drawv2's generated help, deferred; operation-proxy is Linux only |
| `export` | drawv2 part drawing through `vector-scene` | candidate | H2's one rendering |

**Findings for mission-kit's registry** (C0: one duty duplicated across projects with no component is a finding):
- drawv2's `access` duty is caller-identity's, word for word, built twice.
- `kernel/input-rules.mjs` is a content-free mechanism held in one application -- D35's test passes today.
- drawv2 is in zorg's D32 union of anchored cores but in no mission-kit record; C0's territory, "the union of anchored cores across the architectures this organisation holds", is not computed anywhere (mission-kit's B57).

---

## 4. What the target becomes

Stated as the target would state it, present tense; no build order.
- **The anchored core is written in the peer's form,** so zorg's checker and fit census read it: a parts table whose kind is `registered component (C1)`, `proposed component`, `candidate component` or `drawv2 part`; what drawv2's own parts expose, as capabilities; and the consumes, one line per use at capability level, each component's capabilities cited from its contract, not restated.
- **drawv2 is assembled from the components** of section 3, drawv2's own parts the last mile: its grid, its plugins and their kinds, its rules and painters, its doors' wording, its catalog of diagrams.
- **The live channel runs over `agp`:** a tab reaches the server through `entity-api`, keeps its diagram in an `entity-view` and its unconfirmed edits in a `write-outbox`; REST is drawv2's own door, invoking the same named operations through `operation-call`, as every seat composes it.
- **A diagram is an `entity-store`,** adjusted as section 3 names, its durability through the store's port; drawv2's catalog holds which diagrams exist.
- **The unification inside drawv2's parts is unchanged:** the anchor core, the plugins, a type as a composition, the ratchets.
- **The divergence is one held row:** every component the target composes is implemented today by drawv2's own modules, listed by the generator part by part, and carried by one backlog row whose trigger is the director starting the migration (H21.9).

---

## 5. Axiom alignment, by traits (M7)

**Traits** (mission-kit `traits/`): stateful (T1) -- the server owns the diagrams; multi-agent (T3) -- people and agents write one diagram; autonomous (T4, INFERRED) -- the server sweeps expired locks and runs unattended, as the D32 seats read it.\
Not declarative (T2): nothing reconciles toward a declared end state; derivation is not reconciliation.\
Not llm-in-the-loop (T5): no model is on drawv2's critical path.

**In force:** the floor -- A3, A4, A8, A9, A14 -- with A1 (T1), A5, A6, A7, A10, A13 (T3, T4).\
**Not in force:** A2 (declarative), A11 and A12 (llm-in-the-loop).

**A correction to the ratified target:** its section 3 (H21.6) names A2 and A11 load-bearing and A4, A6, A9 and A10 "supporting or not materially implicated" -- weights, not traits; by mission-kit's rule that is the ungated adoption.
What drawv2 values in A2 and A11 -- one declaration every door reads; few kinds to learn -- is held already by the outcome axes AX2 and AX5, which stay.

| Axiom | Weight for the aligned target | How the alignment stands |
|---|---|---|
| A3 Sovereign Composition | load-bearing | the alignment is A3's mandate: capability assembled from sovereign components, drawv2 the last mile |
| A1 Sovereign State Transparency | load-bearing | a diagram's changes in one dated order (entity-store) |
| A5 Perceptual Parity | load-bearing | agents and tabs read one store's view, dated by the position it reflects |
| A7 Resilient Agentic Operations | load-bearing | honest call endings (operation-call); the outbox replays unconfirmed writes |
| A8 Gated Recursive Integrity | load-bearing | each component carries its contract tests; drawv2's gate holds its own parts |
| A14 Compounding Learning | load-bearing | the fit census measures what drawv2 uses of each component |
| A6 Frictionless Agentic Collaboration | supporting | the CLI over one shared caller per identity (operation-proxy) |
| A13 Director Intent Amplification | supporting | rulings recorded with the director's words |
| A4, A9, A10 | supporting | records append-only; deploys gated and rehearsed; the system revises itself only through rulings |

**Tensions, left open:** the components need a build step (TypeScript), where drawv2 has none by H17-D12, "revisited at the rebuild"; agp's browser use is unestablished, and the live channel needs it.

---

## 6. Costs

- **A build step:** the components are TypeScript compiled to `dist/`; drawv2 serves its source as written (H17-D12) and declares Node 18 or later, the components Node 24 or later.
- **Packaging:** the components are unpublished and linked as sibling checkouts; drawv2's image is built in Cloud Build from its own repository alone.
- **Unbuilt and uncertified pieces:** agp in the browser; entity-api, operation-proxy and operation-command awaiting verification; credential-issuer and every candidate unbuilt.
- **Adjustments upstream:** entity-store, shape-check, entity-api, caller-identity and operation-command each owe the adjustment section 3 names; under C0 each is pressure on the component, ruled in its own record.
- **The target's section 4 is rewritten** in the peer's form, and the generator renders the capability lines from a declaration; the axiom section is rewritten by traits.
- **Nothing in production changes,** and nothing is deployed.

---

## 7. Decisions owed -- one at a time, each with a recommendation

| # | Question | Options | Recommendation |
|---|---|---|---|
| A-1 | Which components does the aligned target compose? | **(a)** those with standing only -- agp and zorg's proposed set; **(b)** and the three candidates the director steered in D35 -- change planner, input binding, vector scene; **(c)** and every candidate all or two of the judges admitted -- entity view, write outbox, change undo, resource lease, static host -- each marked a candidate | **(c)** -- D35 rules a content-free mechanism a component with one consumer, and the director's intent there is a registry of 40 to 50; each stays marked a candidate until the director rules it in zorg's record |
| A-2 | Does the target's live channel run over agp, through entity-api and an entity view, or keep drawv2's websocket hub as a drawv2 part? | **agp:** every D32 seat composes it; it is what aligns the hub, the sync and access with components; it needs agp in the browser, unestablished. **drawv2's hub:** no browser dependency on agp; the hub, the sync and the outbox stay drawv2's | agp -- the alignment is otherwise partial at exactly the seams drawv2's specification records as having lost guarantees (D32's "Why") |
| A-3 | Is the target's axiom section rewritten by traits, A2 and A11 leaving it? | **Yes:** mission-kit's rule; AX2 and AX5 keep what drawv2 values in them. **No:** keep the weights, a recorded deviation from mission-kit | yes -- the director's goal is alignment, and this is mission-kit's own rule |
| A-4 | Is the anchored core written in zorg's checkable form? | **Yes:** zorg's checker and fit census measure drawv2 as they measure zorg. **No:** keep drawv2's own form, which mission-kit permits | yes -- it is the peer form (PC1), and the census is the measure C0's territory needs |
| A-5 | Are drawv2's records moved to mission-kit's paths (`docs/`)? | **Hold as a divergence:** no migration (H21.9). **Move now:** a records change, not code | hold -- the direction is not to migrate yet, and the move touches every tool that reads `dev/` |

The minority positions of section 2.2 stay open in the target's register.
