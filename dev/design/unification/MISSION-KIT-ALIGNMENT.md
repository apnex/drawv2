# The target aligned with mission-kit (H21.9)

The director's direction (H21.9, `dev/DECISIONS.md`): "goal is to have a target state that aligns with mission-kit - however we are not going to migrate just yet".\
This design compares each part of drawv2's anchored core (`tools/layers.mjs` `PARTS`, rendered in `docs/ARCHITECTURE-TARGET.md` section 4) with mission-kit's registered components, the components proposed beside them, and the candidates zorg's investigation found, and states what the target becomes when aligned.\
The code does not move; each difference the alignment opens is a divergence the target lists, held until the director starts a migration.\
Nothing here changes the target until the director rules the decisions in section 7, one at a time, and ratifies the revised target.

**Revision 2,** after Review 1 found the first draft not ready (section 8): every mapping now names the rulings it would change, and each such change is a decision of its own.

---

## 1. What mission-kit asks of a system's target architecture

Read from mission-kit's own text on 2026-10-12; each item cited there.
- **One-duty components, each with what it exposes and what it consumes** -- the load-bearing section, no duty needing "and" (AR1, "Required sections"; E6).
  mission-kit prescribes no column set, no kind vocabulary and no format for consumes lines, and holds no tool that checks them.
- **The peer's convention, which is zorg's:** a kind per part -- `registered component (C1)`, `proposed component`, or a system part; consumes written at capability level as `- \`consumer\` from \`provider\`: \`capability\``, under the exact headings `### Parts`, `### What the application's own parts expose` and `### Consumes`; checked by zorg's capability checker, which also runs the fit census -- per component, which offered capabilities the system uses and which it leaves unused.
  The checker knows zorg's set unless given another directory of contracts.
  mission-kit records only the components' own contract-table form, as its open row B84; the architecture-side convention is held nowhere in mission-kit.
  Run against drawv2's target today, zorg's checker finds "no parts table" and "no consumes lines".
- **Use before build:** assemble from the registry; a component that almost fits is adjusted, not forked, the adjustment ruled in the component's own record; a miss is a finding about the index (C0, "Use before build", "Adjustment over replacement", "Internal and external").
  No mission-kit method holds the comparison yet (C0, "Neighbours").
- **A component entry is admitted once it is usable** (mission-kit ruling 0087), and "the count alone never admits ... a member" (C0, "Vision").
- **Cite, do not restate:** an architecture cites a component and links its contract (mission-kit style S3, rule 2).
- **Axioms by traits:** an axiom binds a system only if the system has a trait its `applies-to` names, or the axiom is on the floor; claiming one otherwise is "the ungated adoption" (mission-kit's axioms charter, "Faults", and its traits charter).
  M7 then weighs the axioms in force -- load-bearing, supporting, or not materially implicated; it does not decide which are in force.
- **The target tracks the ratified rulings** (AR1, "Purpose": the target is "the current architecture plus every ratified decision not yet built"), so a component enters drawv2's target by the director's ruling, not by this design.
- **Instance paths:** mission-kit's ruling 0076 puts a system's board, backlog, decisions and deltas in its `docs/` folder; drawv2 keeps the first three under `dev/`.
- **Patterns that already describe drawv2:** P4, a domain-neutral core programmed by tenants -- drawv2's core and plugins; P5, every surface driven from one manifest -- drawv2's CLI and REST; P3, a master representation with the other generated and a parity gate -- drawv2's generated architecture.

---

## 2. The evidence

### 2.1 Components with a contract

Read from each component's `CONTRACT.md`, `README.md` and `package.json`, from mission-kit's registry, and from zorg's Delta 1 record (its `DELTA-1.md`, the record of certification) on 2026-10-12.

| Component | Standing | Duty, verbatim | State |
|---|---|---|---|
| `agp` | registered, `C1` | Route messages between named application endpoints across a topology no one centrally administers | ratified v1, tested; Node only as built -- the browser not established (agp's B50) |
| `context-lab` | registered, `C2` | Run experiments on the context language-model agents are given, and report what each experiment showed | first slice built; a tool run over a pack, not a library |
| `operation-call` | proposed, zorg | Give every invocation of a named operation exactly one honest ending, within a bound its caller chose | certified, Delta 1 stage 4, attempt 3 |
| `entity-store` | proposed, zorg | Keep typed, tagged entities in a single order of changes that every read can be dated against | certified, stage 2, attempt 3; `changes-since-position` and `follow-narrowed-set` deferred under zorg's D15, "Subscriptions are parked" |
| `shape-check` | proposed, zorg | Judge whether a value fits a shape declared as data | certified, stage 1, attempt 1 (its README still says awaiting) |
| `caller-identity` | proposed, zorg | Establish the principal each request comes from, from the evidence its caller presented and the host's rules | certified, stage 4b, attempt 6; its evidence is an agp session (its CI3); `verified-principal`, which drawv2's sign-in and codes need, deferred (zorg's D37) |
| `entity-api` | proposed, zorg | Make an entity store reachable by name, so a remote caller can rely on exactly what a local one can | failed its first verification, stage 5; revision pending; its follow rows deferred under D15 |
| `operation-proxy` | proposed, zorg | Let short-lived processes invoke named operations through one long-lived caller they share, each invocation still ending honestly | failed its first verification, stage 4a -- among the findings, a short-lived command that never exited by itself; Linux only; its browser adapter deferred |
| `operation-command` | proposed, zorg | Run one declared invocation from a command line, reporting its ending through the exit status | failed its first verification, stage 4c; `command-reference`, which drawv2's generated help needs, deferred |
| `credential-issuer` | proposed, zorg (D38, D39) | Issue the credentials a caller presents to reach a hub, from authority the host accepts | no code; D39 moves the minting, storing and revoking of drawv2's connection codes into it |

Every proposed component is TypeScript compiled to ESM, Node 24 or later, `private`, unpublished, and depended on by `file:` links to a checkout beside the consumer; zorg records that they "cannot be published as packages while AGP ... is not".

The ruling D38 in zorg's record says: "Every client of a hub - a signed-in person in a browser, a person's command line, an unattended agent, and drawv2's agent door - reaches it through one peer model", each connection admitted with a key that "lasts about a minute, works once and names one hub", fetched by the identity's proxy -- on a machine a local process, in a browser a shared worker.\
It names drawv2's agent door in zorg's record; whether it binds drawv2 is the director's to say, and A-2 asks it.

### 2.2 Candidates

The ruling D32 in zorg's record names drawv2 "the future refactor target the shared components are designed against, and the second consumer their visions' reuse dimension asks for", and investigates the component set in six steps: drawv2 described from its source; a union of the duties of zorg's command line, zorg's canvas case and drawv2; three model families each proposing a set and composing all three applications from it (drawv2 at `2eae703`); the checker measuring each; judges from other families; and each change reaching the director as a proposal.\
The step 5 synthesis was written by the convening agent, reconciling three judges, each of whom judged only other families' proposals; the record is kept outside both repositories, as `component-set-investigation-2026-10-10`.\
The ruling D35 there says that "a mechanism that holds nothing particular to one application is a sovereign component even while only one application needs it", with the director's steers: "a change planner is a modular, sovereign, decoupled component"; "input capture is a component"; "identity is a component, unifying what drawv2 does, what AGP's evidence supplies and what zorg's hub needs"; "a vector scene is a component".\
Its D36 then rules the registry's size "a bound, not a target": "tens of them, perhaps 70 to 80", because "a number taken as a target invites splitting".

| Candidate | Duty, as the synthesis words it | Judges | Standing |
|---|---|---|---|
| change planner | Derive the complete change a requested intent implies against a snapshot of a store | three | D35 steer; no contract, no agreed name |
| input binding | Resolve each input to the one declared action it means in its context | three | D35 steer ("input capture"); no contract |
| vector scene | Draw supplied visual descriptions as a vector scene | three | D35 steer; no contract |
| entity view | Keep a local view of a remote store current, dated by the position it reflects | three | proposal, unruled |
| change undo | Reverse a store's most recent retained changes, last in first out | two | proposal, unruled |
| write outbox | Retain each sent write whose outcome is unconfirmed until its outcome is known | two | proposal, unruled |
| resource lease | Grant one holder at a time temporary exclusive control of a named resource | two | proposal, unruled |
| static host | Serve files only from declared folders, or dispatch HTTP through declared mounts | two | proposal, unruled |
| access grants | A principal granted a level of access -- owner, write, read -- to one resource or to all of an owner's resources | -- | zorg's BL20, a candidate under D35, holding "no drawv2 content" |

**The synthesis's six minority positions, each kept:**
1. durable storage as its own component, behind entity-store's storage port (`record-storage`);
2. input capture apart from input binding;
3. an estimate of the authority's time, packaging drawv2's clock (`app/src/clock.js`);
4. an HTTP door for named operations (`operation-http`), for drawv2's REST;
5. undo, outbox, lease and web hosting kept as drawv2's own -- one consumer with no second in sight is not yet a shared duty, "the strictest view of the set";
6. entity-api re-asking the application's policy on each part of a follow, so a revoked grant ends it.

The synthesis decides no names and no timing.\
All three proposals compose drawv2's diagram as an `entity-store` served by `entity-api` over `agp`, checked by `shape-check`; all three keep REST as drawv2's own door; two of three move the command line onto `operation-command` and `operation-proxy`, and one keeps it a REST consumer.

### 2.3 drawv2's own mechanisms, against D35's question

D35's question -- "what would it take to make this free of project-specific content?" -- asked of drawv2's modules that look generic.\
A screen, MEASURED on 2026-10-12: each module's relative imports, and how many times its code, comments removed, names a thing of drawv2's own (node, link, zone, group, pipe, waypoint, device, diagram, anchor, glyph, router, svg).

| Module | Imports | drawv2's words | Reading |
|---|---|---|---|
| `kernel/input-rules.mjs` | none | 0 | free of content: input-binding's resolution |
| `app/src/input-state.js`, `app/src/triggers.js` | none | 0 | free of content: input-binding |
| `app/src/recognize.js` | the core's anchor kinds | 12 | carries drawv2's content -- B274's measurement of 2026-10-01, which found it free, is stale |
| `app/src/releases.js` | none | 18 | carries drawv2's content (links, nodes, zones) -- stale in B274 likewise |
| `app/src/capture.js` | drawv2's hit testing and painter | 15 | carries drawv2's content: "input capture" in D35's steer |
| `engine/ivm.mjs` | none | 0 | free of content: a maintained reverse index; no component or candidate holds one |
| `app/src/clock.js` | none | 0 | free of content: minority 3's estimate of the authority's time |
| `app/src/paintloop.js`, `app/src/watchdog.js`, `app/src/net.js` | none | 0 | free of content; no candidate holds a timer floor, a reload watchdog or a connection status |
| `planner/log.mjs` | none | 0 | free of content: change undo's ring |
| `server/locks.js`, `server/static.mjs`, `server/codes.mjs`, `server/identity.mjs`, `server/origin.mjs`, `server/sessionlog.mjs`, `server/files.mjs` | none | 1 to 4, read by eye as `node:` modules and messages | near free of content: resource lease, static host, credential-issuer, caller-identity, the storage port |

The screen is a word count, not a proof; a module it reads as free is a candidate for D35's question, not an answer to it.

---

## 3. Each part, aligned

Every part of the ratified target (H21.6), with what it aligns to, the standing of that, the rulings the alignment would change, and the work D35's question names.\
"--" in the rulings column means the alignment changes no ruling.

| Part | Aligned as | Standing | Rulings it changes | Fit gap, or the work named |
|---|---|---|---|---|
| `lattice` | drawv2 part | -- | -- | grid semantics are drawv2's content |
| `kind-contract` | drawv2 part, consuming `shape-check` for the shapes of fields | certified | -- | shape-check judges a value against a shape declared as data, a subset of JSON Schema; drawv2's field checks are functions, and its cross-field rules (G3) and invariants stay drawv2's; dialect 2 (`minimum`, `maximum`, `multipleOf`) per the synthesis |
| `document` | drawv2 part keeping the anchor capability (O1, O4), the one name namespace across named kinds (N5) and the drawing order, over `entity-store` for the diagram's changes -- A-3 | certified | WD9's schema-3 document; when a write is acknowledged; what an undo is; where selection lives -- A-3, A-3a, A-3b | entity-store requires a name on every entity, unique within its kind, where N5 leaves pipes unnamed and keeps names unique across kinds -- adjustment owed: a kind declares whether it is named, cross-kind uniqueness held by the application's rules inside the single order; and the synthesis's: a store per document, identities a writer chooses, a check against the whole store's position, before-images; entity-store is "not a graph", so relations stay drawv2's; the target's owed question on whether the anchor is named stays open either way |
| `relations` | drawv2 part | -- | -- | `engine/ivm.mjs` is free of content (section 2.3); no component holds a maintained index -- a finding for the registry |
| `colours` | drawv2 part | -- | -- | the palette is drawv2's |
| `primitives` | within `vector-scene` | candidate, D35 steer | -- | free of drawv2's kinds once B338 moves the device art out |
| `rules` | `input-binding`, its resolution | candidate, D35 steer | -- | none for resolution (section 2.3); D35's steer names capture, which carries drawv2's hit testing; B274's trigger, "a second app needs gesture input", is the reading D35 set aside in zorg's record -- A-1 reconciles it |
| `planner` | `change-planner` for deriving a change; the log and undo per A-3b | candidate, D35 steer | -- for deriving | the planner names the network's tenant and its kinds (`planner/txn.mjs`) -- B332's work |
| `layouts`, `devices`, `network`, `zones`, `groups`, `simulation` | drawv2 parts | -- | -- | the plugins are drawv2's domain; the unification's later stages act inside them |
| `product` | drawv2 part | -- | -- | drawv2's composition |
| `canvas` | drawv2 part, consuming `input-binding` | candidate | -- | the gesture rows are drawv2's; `app/src/recognize.js` and `app/src/releases.js` carry drawv2's content |
| `renderer` | `vector-scene` | candidate, D35 steer | -- (H2's one rendering holds) | the renderer imports grid geometry (`app/src/renderer.js`); the painters stay in the plugins |
| `sync` | `entity-view` and `write-outbox` -- A-2 | candidates | the websocket protocol of `docs/spec/API.md` -- A-2 | entity-view needs entity-api's follow rows, parked under D15 until "the first time an agent must react to a change without listing again"; the clock is minority 3 |
| `product-page`, `lab`, `server` | composition roots; the static responder within `server` (`server/static.mjs`) aligns to `static-host` | candidate; minority 5 keeps it drawv2's | -- | -- |
| `access` | drawv2's access ruling -- owners and grants, the grants aligning to the access-grants candidate (BL20); a principal established by `caller-identity` for a request that arrives over agp; connection codes issued by `credential-issuer` -- A-2 | certified; no code; candidate | the bearer connection code at the REST door (`docs/spec/ACCESS.md`, "Code transport") -- A-2 option (a) | caller-identity establishes a principal from an agp session (CI3), so nobody for an IAP-signed request or a bearer code over HTTP; `verified-principal` unbuilt (D37); a REST door relaying to operations through operation-call would lose its caller (CI3; zorg's BL21; INFERRED); the websocket origin check (`server/origin.mjs`) stays with drawv2's hub; the duties are close, not identical, and the overlapping capability exists today only in drawv2 |
| `placement` | drawv2 part | -- | -- | choosing a free anchor is drawv2's geometry |
| `store` | drawv2 part -- the catalog of diagrams (templates, retention, caps) and the GCS adapter -- supplying `entity-store`'s storage port -- A-3 | certified | as `document` | the port is synchronous, `append` durable before it returns, and GCS has no synchronous call (B59) -- adjustment owed: an asynchronous durable port, or minority 1's record-storage |
| `hub` | `entity-api` over `agp` for the diagram's changes -- A-2; the locks to `resource-lease`; selection, the lock handoff and presence -- A-3a | failed first verification; `C1`; candidate | the websocket protocol -- A-2 | follows parked (D15); agp in a browser not established; under D38 a tab's connection is admitted with a key from credential-issuer through a browser shared worker, both unbuilt; selection, the lock handoff and presence are not store changes, and no component carries them -- agp is "not a bus", entity-api "not a keeper of watchers" |
| `rest` | drawv2 part, calling the planner as today; `operation-http` is minority 4 | -- | -- | -- |
| `cli` | drawv2 part -- A-2: a plain HTTP client (SD1), its verbs and exit statuses through `operation-command` over a client drawv2 supplies; or over `operation-command` and `operation-proxy` on agp | failed first verification, both | over agp: SD1's "The CLI stays a plain HTTP client" and the ratified target's section 4.3 -- A-2 option (a) | operation-command runs through "an object the application supplies", its endings operation-call's four, so an HTTP client mapping its answers onto them could serve (INFERRED); `command-reference` deferred; an installed copy needs its components installed with it (B138) -- A-4 |
| `export` | drawv2 part drawing through `vector-scene` | candidate | -- (H2) | -- |

**Findings for mission-kit's registry** (C0: one duty duplicated across projects with no component is a finding):
- drawv2's `access` and caller-identity hold close duties, and the overlapping capability -- a verified principal from a credential -- exists today only in drawv2.
- drawv2 holds content-free mechanisms no component or candidate covers: a maintained reverse index (`engine/ivm.mjs`), a timer floor, a reload watchdog (section 2.3).
- drawv2 is in zorg's D32 union of duties but in no mission-kit record; C0's territory, "the union of anchored cores across the architectures this organisation holds", is not computed anywhere (mission-kit's B57).

---

## 4. What the target states, by decision

Each decision of section 7 changes the target as below; nothing is stated until it is ruled.
- **A-1:** the components composed appear in the parts table with their kind and in the consumes lines, each capability cited from its contract; the candidates appear in the register against the part each would take.
- **A-2:** the target's doors and its section 7, run time, state the transport ruled; section 4.3's CLI rule is restated if the CLI moves onto agp.
- **A-3, A-3a, A-3b:** the target's section 6, the stored document, states a diagram's changes and its status as ruled; its run time states when a write is answered and what an undo appends.
- **A-4:** the parts table's "runs in" states how each component reaches the server, the page and the installed CLI.
- **A-5:** the target's sections 2 and 3 name the axioms in force by traits, weighed by M7.
- **A-6:** section 4 is written under zorg's headings, generated from `tools/layers.mjs`.
- **A-7:** the records' paths stay a divergence.

**The divergence:** each part that aligns to a component is its own row in the target's divergence table, carried by its own held backlog row, filed when the target is revised, its trigger the director starting a migration (H21.9); the generator renders each part's alignment from its declaration.

---

## 5. Axiom alignment, by traits

**Traits** (mission-kit `traits/`): stateful (T1) -- the server owns the diagrams; multi-agent (T3) -- people and agents write one diagram; autonomous (T4, INFERRED) -- the server sweeps expired locks and runs unattended, as step 2 of D32 read drawv2's traits.\
Not declarative (T2): nothing reconciles toward a declared end state; derivation is not reconciliation.\
Not llm-in-the-loop (T5): no model is on drawv2's critical path.

**In force:** the floor -- A3, A4, A8, A9, A14 -- with A1 (T1), and A5, A6, A7, A10, A13 (T3, T4).\
**Not in force:** A2 (declarative), A11 and A12 (llm-in-the-loop).

**A correction to the ratified target:** its section 2 lists A2 and A11 among the axioms in force and leaves out A4, A6, A9 and A10; its section 3 weighs A2 and A11 load-bearing -- by mission-kit's rule, the ungated adoption.\
What drawv2 values in them is partly held by the outcome axes: AX5, conceptual economy, holds A11's "few kinds to learn"; AX2, parity at every door, holds less than A2 -- a copy kept equal by a test satisfies parity, where A2 counts two lists of one fact as drift.
**Two owed questions re-weigh:** the target's section 9.1 costs the CLI's copy of the types and a type declared in several tables partly by A2; with A2 not in force, those costs are restated against AX2 and A3.

| Axiom | Weight for the aligned target | How the alignment stands |
|---|---|---|
| A3 Sovereign Composition | load-bearing | the alignment is A3's mandate: capability assembled from sovereign components, drawv2 the last mile |
| A1 Sovereign State Transparency | load-bearing | a diagram's changes in one dated order, if A-3 is yes |
| A5 Perceptual Parity | load-bearing | tabs and agents read one store's view, dated by the position it reflects, if A-2 and A-3 are yes |
| A7 Resilient Agentic Operations | load-bearing | honest call endings where operation-call is composed; the outbox replays unconfirmed writes |
| A8 Gated Recursive Integrity | load-bearing | each component carries its contract tests; drawv2's gate holds its own parts |
| A14 Compounding Learning | load-bearing | the fit census measures what drawv2 uses of each component |
| A6 Frictionless Agentic Collaboration | supporting | agents reach the same operations as tabs |
| A13 Director Intent Amplification | supporting | rulings recorded with the director's words |
| A4, A9, A10 | supporting | records append-only; deploys gated and rehearsed; the system revises itself only through rulings |

---

## 6. Costs

- **Delivery:** the components are TypeScript compiled to `dist/`, uncommitted; drawv2 serves its source as written (H17-D12) and installs its CLI standalone (B138); they need Node 24 or later, where production runs Node 22 (`Dockerfile`) and `package.json` declares 18 -- A-4.
- **Publication:** the components are unpublished and linked as sibling checkouts; drawv2's image is built in Cloud Build from its own repository alone.
- **A browser constraint:** drawv2 sets no Content-Security-Policy today; were it to set `script-src 'self'`, agp's shared packages fail to load (agp's verification record).
- **Unbuilt and uncertified pieces:** agp in a browser; entity-api, operation-proxy and operation-command failed their first verification; follows parked (D15); credential-issuer and every candidate unbuilt.
- **Adjustments upstream,** each pressure on the component, ruled in its own record (C0): entity-store -- names optional per kind, cross-kind uniqueness through the application's rules, an asynchronous durable storage port, a store per document, identities a writer chooses, a whole-store position check, before-images; shape-check -- dialect 2; entity-api -- a set of stores; caller-identity -- `verified-principal`; operation-command -- `command-reference`.
- **Rulings changed, if the options that change them are chosen:** SD1's transport clause and the target's section 4.3 (A-2 a); the bearer code at the REST door (A-2 a); the websocket protocol (A-2 a, b); WD9's schema-3 document and its acknowledgement timing, an AX6 one-way door (A-3); what an undo appends (A-3b); H17-D12's no build step (A-4 b).
- **The target's sections 2, 3, 4, 6 and 7 are revised,** and the generator renders the parts in zorg's form.
- **Nothing in production changes,** and nothing is deployed.

---

## 7. Decisions owed -- one at a time, each with a recommendation

Asked in this order; A-3a and A-3b only if A-3 is yes.

| # | Question | Options and their costs | Recommendation |
|---|---|---|---|
| A-1 | Which components does the target compose? | **(a) Those with a contract,** cited by capability; every candidate, steered or not, named in the register against the part it would take, entering when it has a contract; B274 amended to point at the input-binding candidate. Cost: the mechanisms the director steered in D35 -- planner, input, scene -- show in the register, not in the consumes lines. **(b) And the three D35-steered candidates.** Cost: with no contract and no agreed name, their capabilities would be written by drawv2, restated (S3), and zorg's checker rejects them unless drawv2's own exposes table lists them, the census then counting them as drawv2's demand. **(c) And every judged candidate.** Cost: as (b), and minority 5 -- undo, outbox, lease and hosting kept in drawv2, one consumer with no second in sight | (a) -- a contract is what lets the target cite a component rather than restate it, and mission-kit admits a component once it is usable (its 0087) |
| A-2 | How do clients reach the server? | **(a) Every client over agp** -- tabs, agents, the CLI -- D38's one peer model, which names drawv2's agent door. Changes SD1's transport clause, the target's section 4.3, the bearer code at the REST door and the websocket protocol. Needs agp in a browser, follows unparked, credential-issuer and operation-proxy's browser adapter -- all unbuilt; and a REST caller's identity across the hop has no answer (BL21). **(b) Tabs over agp, agents and the CLI over HTTP as today.** Changes the websocket protocol only. Needs agp in a browser and follows unparked; a tab admitted either by D38's keys -- credential-issuer and the browser proxy, unbuilt -- or by drawv2 from the IAP session, a deviation from D38; two transports, against D38's one peer model. **(c) drawv2's transport stays** -- websocket hub, REST, plain-HTTP CLI -- the components consumed inside the server and the page. Changes nothing. Cost: the hub, the sync and access stay drawv2's, the seams D32's "Why" names as having lost guarantees | (b) -- it aligns the live channel, where D32 names the lost guarantees, changes no ruling the director made in drawv2, and leaves the agent door to when credential-issuer exists and a REST caller's identity can cross the hop |
| A-3 | Is a diagram kept in an entity-store? | **(a) Yes:** the diagram's changes are entity-store's single order; drawv2's `document` part keeps the anchor, the names across kinds and the drawing order. An AX6 one-way door: every stored diagram becomes a change log, migrated once as WD9 migrated schema 3; every write durable before it is answered, where a tab's write is answered before a 200 ms flush today (`README.md`); undo and selection change (A-3a, A-3b); entity-store owes seven adjustments, each ruled in its own record, and a refused one -- names optional per kind, an asynchronous port -- reopens this question. **(b) No:** drawv2's `document` and `store` stay drawv2's parts. Changes nothing. Cost: the guarantees D32 says drawv2's seams lost stay drawv2's to keep, and the target's centre stays unaligned | (a), the one-way door named here and taken last in any migration (AX6) -- every D32 proposal composes the diagram so, and the director's goal is the alignment |
| A-3a | Where do a diagram's selection and status live? | **(i) A second store per diagram,** holding selection, controllers, owner and grants: selection keeps its standing -- no diagram version bump, not undoable, a first-class event (`docs/spec/API.md`). **(ii) Broadcast only, not stored:** a reloaded tab loses the selection an agent set, which the document holds today | (i) -- it keeps selection as ruled |
| A-3b | What is an undo? | **(i) A change appended to the single order, writing the inverse:** positioned, durable and atomic with the change it reverses; changes `docs/spec/TRANSACTIONS.md`'s "cursor moves, no record appended". **(ii) The change-undo candidate over entity-store's before-images:** no contract; minority 5 keeps it drawv2's. **(iii) drawv2's ring kept beside the store:** the log and the store two records of one history, the split drawv2's store was built to avoid -- its document and log are one file (`README.md`) | (i) -- one order holds the history, and an undo is visible to every reader as a change |
| A-4 | How do components reach the browser and the installed CLI? | **(a) Published packages:** the page loads their compiled files through an import map, the CLI installs them as dependencies, drawv2 keeps no build step. Needs zorg to publish them, which it holds until agp is published; Node 24. INFERRED: compiled ESM free of runtime-specific modules loads in a browser so -- operation-call and entity-store import none outside named adapters; agp's node package imports `node:crypto`, so its browser use waits on agp. **(b) A build step in drawv2:** reverses H17-D12, whose reason was A2's parity over built code -- not in force if A-5 is yes, and P3's generated-and-gated covers it. **(c) Compiled components vendored as generated source,** pinned and held equal by a gate: no build step; a copy of each in drawv2 | (a) -- nothing copied and no build step; the dependency on publication is a cost the target names |
| A-5 | Are the target's axioms named by traits? | **Yes:** A2 and A11 leave sections 2 and 3, A4, A6, A9 and A10 join; the two owed questions are re-costed. **No:** keep them, a recorded deviation from mission-kit's rule | yes -- it is mission-kit's own rule, and the goal is alignment |
| A-6 | Is the anchored core written in zorg's checkable form? | **(a) Yes, and the checker gated:** run from drawv2's gate over the contracts drawv2 cites, as the doc-style scan runs mission-kit's tools -- a gate another repository's working tree can turn red. **(b) Yes, the checker run at each revision of the target,** its census recorded, not gated. **(c) No:** drawv2's numbered form, which mission-kit permits | (b) -- the form is the peer's and the census the measure C0's territory needs; gating on zorg's tool waits until mission-kit holds the convention (its B84) |
| A-7 | Do drawv2's records move to mission-kit's paths? | **Hold as a divergence:** no migration (H21.9). **Move now:** a records change, not code, touching every tool that reads `dev/` | hold |

The minority positions of section 2.2 stay open in the target's register.

---

## 8. Review 1 -- 2026-10-12, of the draft at `1e3524d`

An agent that did not write the draft, asked to break it against mission-kit, the components' contracts, zorg's records and drawv2's rulings.
**Verdict:** "not ready" -- 1 blocker, 10 majors, 4 minors.\
It confirmed the standings, the duty quotes, the synthesis's judge counts, the trait reading (T1, T3, T4; not T2, not T5), the axioms in force, the checker's result on today's target, and the pattern citations.\
Each fact it cited was read again at its source before this revision; one was softened -- drawv2 sets no Content-Security-Policy, so agp's failure under `script-src 'self'` is a constraint on adding one, not a fault today.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | blocker | sections 3 and 4 reversed rulings no decision asked about: the CLI's transport (SD1; the target's 4.3), the bearer code (D38, D39 against `docs/spec/ACCESS.md`), the schema-3 store and its acknowledgement timing (an AX6 door), selection's standing | **Fixed.** Section 3 has a column naming the rulings each alignment changes; each change is a decision with its options and costs: the transport (A-2), the stored format and acknowledgement timing as an AX6 door (A-3), selection and status (A-3a); section 6 lists every ruling changed and by which option |
| 2 | major | zorg's checker cannot read candidates; candidates have no contract or names; exact headings | **Fixed.** A-1 recommends composing only components with a contract, candidates held in the register; A-6 names the exact headings and offers the checker gated, run per revision, or not adopted |
| 3 | major | A-1 argued from D35's superseded figure and from a count; minorities 5 and 6 missing | **Fixed.** The count argument is gone, D36 and C0 cited; all six minority positions listed; minority 5 is the cost of option (c) |
| 4 | major | `document` to entity-store missed required names and selection; no part named to keep the anchor, names across kinds and drawing order | **Fixed.** `document` stays a drawv2 part keeping them, over entity-store; the name adjustment is owed and named; selection is A-3a; the anchor's owed name question stays open either way |
| 5 | major | entity-store's storage port is synchronous; GCS is not (B59) | **Fixed.** `store` stays a drawv2 part supplying the port; an asynchronous durable port, or minority 1, is owed, and a refusal reopens A-3 |
| 6 | major | entity-api's follows are parked; selection, lock handoff and presence have no component | **Fixed.** Both named in the `hub` and `sync` rows and in A-2's costs; A-3a gives selection and status a home |
| 7 | major | undo mapped to nothing; its meaning changes | **Fixed.** A-3b, with the change to `docs/spec/TRANSACTIONS.md` named |
| 8 | major | `access`: BL20, identity across the REST hop, `server/origin.mjs`, "word for word" wrong | **Fixed.** All four in the `access` row; the registry finding corrected; REST calls the planner as today, so no hop loses its caller unless A-2 (a) is chosen |
| 9 | major | how TypeScript components reach a no-build page and an installed CLI was not a decision | **Fixed.** A-4, with the runtime (Node 22 in production) and the browser constraint in section 6 |
| 10 | minor | A2 and A11 are claimed in force in the target's section 2; M7 says nothing on traits; A12; the re-weighing | **Fixed.** Section 5 cites the axioms charter for the gate and M7 for the weights, names A12, and says which two owed questions re-weigh |
| 11 | minor | three components failed first verification; shape-check's README stale | **Fixed** in section 2.1, from zorg's Delta 1 record |
| 12 | minor | attributions | **Fixed:** B84 is the contract table's form; D32's step 2 a union of duties; the synthesis by the convening agent; T4 from step 2; D32 quoted whole |
| 13 | minor | D35's capture steer met only for resolution; B274 not reconciled | **Fixed.** The `rules` row says so; A-1 (a) amends B274; section 2.3 finds B274's own measurement stale for two modules |
| 14 | minor | D35's question not run over drawv2's parts | **Fixed** by the screen of section 2.3, MEASURED and labelled a screen |
| 15 | minor | section 4 stated the recommendations as chosen; one held row for many substitutions | **Fixed.** Section 4 states what each decision changes; each alignment is its own divergence row, carried by its own held row |
