# The target aligned with mission-kit (H21.9)

The director's direction (H21.9, `dev/DECISIONS.md`): "goal is to have a target state that aligns with mission-kit - however we are not going to migrate just yet".\
This design compares each part of drawv2's anchored core (`tools/layers.mjs` `PARTS`, rendered in `docs/ARCHITECTURE-TARGET.md` section 4) with mission-kit's registered components, the components proposed beside them, and the candidates zorg's investigation found, and states what the target becomes when aligned.\
The code does not move; each difference the alignment opens is a divergence the target lists, held until the director starts a migration.\
Nothing here changes the target until the director rules the decisions in section 7, one at a time, and ratifies the revised target.

**Revision 4,** after three reviews (sections 8 to 10): every mapping names the rulings it would change; the target maps each part in its register and composes no component yet; the substitutions that change drawv2's locked decisions -- a diagram kept in entity-store, the live channel over agp, how components reach the page and the CLI -- are owed designs, each with a trigger, each asked only once designed (A-0).

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

Read from each component's `CONTRACT.md`, `README.md` and `package.json`, from mission-kit's registry, and from zorg's Delta 1 record (its `DELTA-1.md`, the record of certification) on 2026-10-12; the standings move, and are read again before each decision is asked.\
None of the proposed components is in mission-kit's registry: each contract is `id: unminted`, `status: draft`.

| Component | Standing | Duty, verbatim | State |
|---|---|---|---|
| `agp` | registered, `C1` | Route messages between named application endpoints across a topology no one centrally administers | ratified v1, tested; Node only as built -- the browser not established (agp's B50) |
| `context-lab` | registered, `C2` | Run experiments on the context language-model agents are given, and report what each experiment showed | first slice built; a tool run over a pack, not a library |
| `operation-call` | proposed, zorg | Give every invocation of a named operation exactly one honest ending, within a bound its caller chose | certified, Delta 1 stage 4, attempt 3 |
| `entity-store` | proposed, zorg | Keep typed, tagged entities in a single order of changes that every read can be dated against | certified, stage 2, attempt 3; `changes-since-position` and `follow-narrowed-set` deferred under zorg's D15, "Subscriptions are parked" |
| `shape-check` | proposed, zorg | Judge whether a value fits a shape declared as data | certified, stage 1, attempt 1 (its README still says awaiting) |
| `caller-identity` | proposed, zorg | Establish the principal each request comes from, from the evidence its caller presented and the host's rules | certified, stage 4b, attempt 6; its evidence is an agp session (its CI3); `verified-principal`, which drawv2's sign-in and codes need, deferred (zorg's D37) |
| `entity-api` | proposed, zorg | Make an entity store reachable by name, so a remote caller can rely on exactly what a local one can | failed its first and second verifications, stage 5; its follow rows deferred under D15 |
| `operation-proxy` | proposed, zorg | Let short-lived processes invoke named operations through one long-lived caller they share, each invocation still ending honestly | failed its first and second verifications, stage 4a -- among the first's findings, a short-lived command that never exited by itself; Linux only; its browser adapter deferred |
| `operation-command` | proposed, zorg | Run one declared invocation from a command line, reporting its ending through the exit status | failed its first and second verifications, stage 4c; `command-reference`, which drawv2's generated help needs, deferred |
| `credential-issuer` | proposed, zorg (D38, D39) | Issue the credentials a caller presents to reach a hub, from authority the host accepts | no code; D39 moves the minting, storing and revoking of drawv2's connection codes into it |

Every proposed component is TypeScript compiled to ESM, Node 24 or later, `private`, unpublished, and depended on by `file:` links to a checkout beside the consumer; zorg records that they "cannot be published as packages while AGP ... is not".

The ruling D38 in zorg's record says: "Every client of a hub - a signed-in person in a browser, a person's command line, an unattended agent, and drawv2's agent door - reaches it through one peer model", each connection admitted with a key that "lasts about a minute, works once and names one hub", fetched by the identity's proxy -- on a machine a local process, in a browser a shared worker.\
It names drawv2's agent door in zorg's record; whether it binds drawv2 is the director's to say, and the owed design OD-2 asks it.

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
All three proposals compose drawv2's diagram as an `entity-store` served by `entity-api` over `agp`, checked by `shape-check`; all three keep REST as drawv2's own door; for the command line, one composes it on `operation-command` and `operation-proxy`, one on `entity-api`, `operation-proxy` and `agp`, and one keeps it a REST consumer.

### 2.3 drawv2's own mechanisms, against D35's question

D35's question -- "what would it take to make this free of project-specific content?" -- asked of drawv2's modules that look generic.\
A screen, MEASURED on 2026-10-12: each module's relative imports, and how many times its code, comments removed, names a thing of drawv2's own (node, link, zone, group, pipe, waypoint, device, diagram, anchor, glyph, router, svg).

| Module | Imports | drawv2's words | Reading |
|---|---|---|---|
| `kernel/input-rules.mjs` | none | 0 | free of content: input-binding's resolution |
| `app/src/input-state.js`, `app/src/triggers.js` | none | 0 | free of content: input-binding |
| `app/src/recognize.js` | the core's anchor kinds | 12 | carries drawv2's content since `11a38d9` (2026-10-09) -- B274's measurement of 2026-10-01, which found it free, is stale, and B274 is amended |
| `app/src/releases.js` | none | 18 | carries drawv2's content (links, nodes, zones), as B274 records |
| `app/src/capture.js` | drawv2's hit testing and painter | 15, every one "svg" | imports drawv2's hit testing: "input capture" in D35's steer |
| `engine/ivm.mjs` | none | 0 | free of content: a maintained reverse index; no component or candidate holds one |
| `app/src/clock.js` | none | 0 | free of content: minority 3's estimate of the authority's time |
| `app/src/paintloop.js`, `app/src/watchdog.js`, `app/src/net.js` | none | 0 | free of content; no candidate holds a timer floor, a reload watchdog or a connection status |
| `planner/log.mjs` | none | 0 | free of content: change undo's ring |
| `server/locks.js`, `server/static.mjs`, `server/codes.mjs`, `server/identity.mjs`, `server/origin.mjs`, `server/sessionlog.mjs`, `server/files.mjs` | none | 1 to 4, read by eye as `node:` modules and messages | near free of content: resource lease, static host, credential-issuer, caller-identity, the storage port |

The screen is a word count, not a proof; a module it reads as free is a candidate for D35's question, not an answer to it.

---

## 3. Each part, aligned

Every part of the ratified target (H21.6), with what it aligns to, the standing of that, the rulings the alignment would change, and the work D35's question names -- the mapping the target's register holds, not structure it states.\
"--" in the rulings column means the alignment changes no ruling; OD-1 to OD-3 are the owed designs of section 7.

| Part | Aligned as | Standing | Rulings it changes | Fit gap, or the work named |
|---|---|---|---|---|
| `lattice` | drawv2 part | -- | -- | grid semantics are drawv2's content |
| `kind-contract` | drawv2 part; `shape-check` for the shapes of field values | certified | composing it: the target's section 4.3, "the core consumes the core alone", and its gate (`tools/layers.mjs` `KIND_MAY_CONSUME`) | the row contract requires each field check to be a function (`model/shape.mjs`), called by the planner's validation, so the fit is undefined until a design says which fields shape-check judges and who calls it; its dialect 1 has no numeric bounds, which drawv2's checks need -- dialect 2, an adjustment ruled in shape-check's record; it counts a string's length in code points, drawv2 in UTF-16 units (INFERRED); the kind contract runs in the page and the lab, so composing it waits on OD-3 |
| `document` | drawv2 part keeping the anchor capability (O1, O4), the one name namespace across named kinds (N5) and the drawing order; over `entity-store` for the diagram's changes if OD-1 so designs it | certified | if OD-1 adopts entity-store: see OD-1's list | see OD-1 |
| `relations` | drawv2 part | -- | -- | `engine/ivm.mjs` is free of content (section 2.3); no component holds a maintained index -- a finding for the registry |
| `colours` | drawv2 part | -- | -- | the palette is drawv2's |
| `primitives` | within `vector-scene` | candidate, D35 steer | -- | free of drawv2's kinds once B338 moves the device art out |
| `rules` | `input-binding`, its resolution | candidate, D35 steer | -- | none for resolution (section 2.3); D35's steer names capture, which imports drawv2's hit testing; B274's trigger, "a second app needs gesture input", is the reading D35 set aside in zorg's record; when the target's register names input-binding against this part, B274 is amended to point at it |
| `planner` | `change-planner` for deriving a change | candidate, D35 steer | -- for deriving; the log, undo and redo are OD-1's | the planner names the network's tenant and its kinds (`planner/txn.mjs`) -- B332's work |
| `layouts`, `devices`, `network`, `zones`, `groups`, `simulation` | drawv2 parts | -- | -- | the plugins are drawv2's domain; the unification's later stages act inside them |
| `product` | drawv2 part | -- | -- | drawv2's composition |
| `canvas` | drawv2 part, consuming `input-binding` | candidate | -- | the gesture rows are drawv2's; `app/src/recognize.js` and `app/src/releases.js` carry drawv2's content |
| `renderer` | `vector-scene` | candidate, D35 steer | -- (H2's one rendering holds) | the renderer imports grid geometry (`app/src/renderer.js`); the painters stay in the plugins |
| `sync` | `entity-view` and `write-outbox`, if OD-2 so designs it | candidates | if OD-2 moves tabs onto agp: see OD-2's list | see OD-2 |
| `product-page`, `lab`, `server` | composition roots; the static responder within `server` (`server/static.mjs`) aligns to `static-host` | candidate; minority 5 keeps it drawv2's | -- | -- |
| `access` | drawv2's access ruling -- owners and grants, the grants aligning to the access-grants candidate (BL20); `caller-identity` and `credential-issuer` if OD-2 moves a client onto agp | certified; no code; candidate | if OD-2 moves a client onto agp: see OD-2's list | caller-identity establishes a principal from an agp session (CI3), so nobody for an IAP-signed request or a bearer code over HTTP; `verified-principal` unbuilt (D37); the duties are close, not identical, and the overlapping capability exists today only in drawv2 |
| `placement` | drawv2 part | -- | -- | choosing a free anchor is drawv2's geometry |
| `store` | drawv2 part -- the catalog of diagrams (templates, retention, caps) and the GCS adapter; supplying `entity-store`'s storage port if OD-1 so designs it | certified | if OD-1 adopts entity-store: see OD-1's list | see OD-1 |
| `hub` | `entity-api` over `agp` if OD-2 so designs it; the locks to `resource-lease` | failed two verifications; `C1`; candidate | if OD-2 moves tabs onto agp: see OD-2's list | see OD-2 |
| `rest` | drawv2 part, calling the planner as today; `operation-http` is minority 4 | -- | -- | -- |
| `cli` | drawv2 part, a plain HTTP client (SD1); its verbs and exit statuses through `operation-command` if OD-3 so designs it | failed two verifications | through operation-command: the CLI's exit statuses (0 and 1 today, 0 to 4 under its OC4) and its `--json` shape; over agp: SD1's transport clause and the target's section 4.3 -- OD-2, OD-3 | operation-command runs through "an object the application supplies", its endings operation-call's four, so an HTTP client mapping its answers onto them could serve (INFERRED); it needs operation-call, which depends on agp at run time; `command-reference` deferred |
| `export` | drawv2 part drawing through `vector-scene` | candidate | -- (H2) | -- |

**Findings for mission-kit's registry** (C0: one duty duplicated across projects with no component is a finding):
- drawv2's `access` and caller-identity hold close duties, and the overlapping capability -- a verified principal from a credential -- exists today only in drawv2.
- drawv2 holds content-free mechanisms no component or candidate covers: a maintained reverse index (`engine/ivm.mjs`), a timer floor, a reload watchdog (section 2.3).
- drawv2 is in zorg's D32 union of duties but in no mission-kit record; C0's territory, "the union of anchored cores across the architectures this organisation holds", is not computed anywhere (mission-kit's B57).
- Which of drawv2's parts become shared components, reasoned together with agp's and zorg's own, is held by the director's word as B343; this mapping is its input, not its answer.

---

## 4. What the target states, by decision

Each decision of section 7 changes the target as below; nothing is stated until it is ruled.
- **A-0:** the target's anchored core composes no component yet, and states only what is built or ruled; its register holds the mapping of section 3 -- each part's component or candidate, the standing of that, the rulings composing it would change -- and the owed designs OD-1 to OD-3, each with its trigger; D38's and D39's clauses naming drawv2 stay open until OD-2; the checkable form is held until the first component composes, and the records' paths stay a divergence.
- **A-5:** the target's sections 2 and 3 name the axioms in force by traits, weighed by M7.
- **An owed design, once ruled:** the target states what it composes, under zorg's headings if the checkable form is then adopted, each component cited from its contract, and each part it changes becomes its own divergence row, carried by its own held backlog row, its trigger the director starting a migration (H21.9).

---

## 5. Axiom alignment, by traits

**Traits** (mission-kit `traits/`): stateful (T1) -- the server owns the diagrams; multi-agent (T3) -- people and agents write one diagram; autonomous (T4, INFERRED) -- the server sweeps expired locks and runs unattended, as step 2 of D32 read drawv2's traits.\
Not declarative (T2): nothing reconciles toward a declared end state; derivation is not reconciliation.\
Not llm-in-the-loop (T5): no model is on drawv2's critical path.

**In force:** the floor -- A3, A4, A8, A9, A14 -- with A1 (T1), and A5, A6, A7, A10, A13 (T3, T4).\
**Not in force:** A2 (declarative), A11 and A12 (llm-in-the-loop).

**A correction to the ratified target:** its section 2 lists A2 and A11 among the axioms in force and leaves out A4, A6, A9 and A10; its section 3 weighs A2 and A11 load-bearing -- by mission-kit's rule, the ungated adoption.\
What drawv2 values in them is partly held by the outcome axes: AX5, conceptual economy, holds A11's "few kinds to learn"; AX2, parity at every door, holds less than A2 -- a copy kept equal by a test satisfies parity, where A2 counts two lists of one fact as drift.
**What re-weighs:** the target's section 9.1 costs two owed questions partly by A2 -- how the CLI learns the device types, and whether behaviour is a pack family -- and its section 3's A2 row ties the one-declaration question to A2; with A2 not in force, those costs are restated against AX2 and A3.

| Axiom | Weight for the aligned target | How the alignment stands |
|---|---|---|
| A3 Sovereign Composition | load-bearing | the alignment is A3's mandate: capability assembled from sovereign components, drawv2 the last mile |
| A1 Sovereign State Transparency | load-bearing | a diagram's changes and their log held in one place, as drawv2 holds them, or as OD-1 designs |
| A5 Perceptual Parity | load-bearing | tabs and agents read what the server derives (SD1) |
| A7 Resilient Agentic Operations | load-bearing | a link whose way is gone is shown down at every door; honest call endings where operation-call is composed |
| A8 Gated Recursive Integrity | load-bearing | each component carries its contract tests; drawv2's gate holds its own parts |
| A14 Compounding Learning | load-bearing | the fit census measures what drawv2 uses of each component |
| A6 Frictionless Agentic Collaboration | supporting | agents reach the same operations as tabs |
| A13 Director Intent Amplification | supporting | rulings recorded with the director's words |
| A4, A9, A10 | supporting | records append-only; deploys gated and rehearsed; the system revises itself only through rulings |

---

## 6. Costs

- **Of the decisions asked now (A-0, A-5):** the target's sections 2, 3 and 9 are revised, its register gains the mapping and the owed designs, and held backlog rows carry each owed design; nothing in the code or in production changes.
- **Of the owed designs, when designed:** each lists, in section 7, the rulings it would change; designing one costs a design of record and its adversarial reviews, as each stage of the unification has.
- **Of the components themselves:** they are TypeScript compiled to `dist/`, uncommitted, unpublished, linked as sibling checkouts, Node 24 or later, where production runs Node 22 (`Dockerfile`); drawv2 sets no Content-Security-Policy today, and were it to set `script-src 'self'`, agp's shared packages fail to load (agp's verification record).
- **Adjustments upstream,** each pressure on the component and ruled in its own record (C0), named in the owed design that needs it.

---

## 7. Decisions owed -- one at a time, each with a recommendation

### 7.1 Asked now, in this order

| # | Question | Options and their costs | Recommendation |
|---|---|---|---|
| A-0 | How far does the aligned target go now? | **What every option gives:** each of the 28 parts mapped, in the target's register, to the component or candidate it would take, with its standing and the rulings composing it would change (section 3) -- the mapping asked about at H21.6; the anchored core composes no component yet, so the store, the hub, the sync, access and the CLI stay drawv2's, their locked decisions intact; D38's and D39's clauses naming drawv2 stay open until OD-2; the checkable form is held until the first component composes (zorg's checker needs consumes lines to read), and the records' paths stay a divergence. **(a) The owed designs wait on their triggers** (section 7.2). Cost: the target's centre is not stated aligned until a trigger fires and a design is ruled; the next work is drawv2's own unification, U3 to U5. **(b) Design OD-1 next,** a diagram kept in entity-store, asked on its own once reviewed; OD-2 and OD-3 wait on their triggers. Cost: a design of record and its reviews before U3 resumes, against an AX6 door -- one-way doors few, named and last -- that the director may then decline; entity-store's adjustments are pressure on another system's record. **Not offered: stating the centre now** -- two reviews showed it changes locked decisions that only a design can name | (b) -- OD-1 is the one owed design whose component is certified (entity-store, Delta 1 stage 2), so it can be designed against a contract that is not moving; OD-2 and OD-3 depend on entity-api, operation-proxy and operation-command, each failed two verifications, on follows parked under zorg's D15, and on credential-issuer, which has no code; and OD-1 is what would let the target state its centre aligned, the goal H21.9 sets |
| A-5 | Are the target's axioms named by traits? | **Yes:** A2 and A11 leave sections 2 and 3, A4, A6, A9 and A10 join; the questions of section 5 are re-costed. **No:** keep them, a recorded deviation from mission-kit's rule | yes -- it is mission-kit's own rule, and the goal is alignment |

**Ruled:** A-0, option (a) -- the owed designs wait on their triggers -- recorded as A-0 in `dev/DECISIONS.md`; the target's section 9.3 holds the mapping and the owed designs, carried by B344 to B346; A-5 is asked next.

**Withdrawn from earlier revisions, with their reasons:** A-1, which components compose -- under A-0 none composes yet, and the one it would have composed, shape-check, needs OD-3 and changes the target's section 4.3 (Review 3); A-6, the checkable form, and A-7, the records' paths -- held, as A-0 states.

### 7.2 Owed designs -- each designed and asked on its own, in this order, each depending on the one before

Each lists its trigger, the rulings it would change and what a design must answer, read from drawv2's records on 2026-10-12; the list is where a design starts, not its answer.

**OD-1 -- is a diagram kept in an entity-store?**\
(`document`, `store`, the log; every D32 proposal composes the diagram so, the gpt seat noting it "requires an explicit latency and format migration decision")
- **Trigger:** the director selecting it (A-0), or a ruling in entity-store's record on the adjustments it needs -- an asynchronous durable port, names optional per kind.
- **Rulings it would change:** D1, the log living in the diagram file, owned by the store; D13, an acknowledgement meaning "accepted and ordered", not durable -- locked on the evidence of the shutdown window -- which a port durable before `append` returns would change unless the port buffers (INFERRED), a storage round trip on the commit path being a latency the director declined twice for another mechanism, verifying the lease (`docs/spec/AUTHORITY.md`, section 5); D23 and N12, the bounded ring of 100 records and 32 KiB that never evicts the only record, where entity-store bounds history by time alone; D3 and D21, undo moving a cursor and appending no record, redo, and undo to a sequence; N2 and H17-D10, ids minted identically by every peer, where entity-store mints its own; N5, names a kind opts into and unique across kinds, where entity-store requires a name on every entity, unique within its kind, matching `^[a-z0-9][a-z0-9-]{0,62}$`, narrower than drawv2's names; `docs/spec/ACCESS.md`'s ACL in `meta`, if status moves to a store of its own; WD9's schema-3 document, migrated once more -- an AX6 one-way door, where the survey's F6 records that how much one-way risk the programme may spend was never asked.
- **What it must answer:** where selection, controllers, owner, grants and presence live, and what a selection costs if it becomes a durable write; what an undo and a redo are, including the variant the gpt seat composed, an undo taking a new position while a ring cursor keeps redo; the history bound kept; the adjustments entity-store owes -- an asynchronous durable storage port (B59: GCS has no synchronous call), names optional per kind, drawv2's name rule, cross-kind uniqueness, identities a writer chooses, a store per document, a check against the whole store's position, a hook for the application's rules inside the single order, positioned snapshots, before-images -- and what a refused adjustment does; templates, retention and restore; the backup runbook; REST and the export reading a diagram.

**OD-2 -- do clients reach the server over agp?**\
(`hub`, `sync`, `access`, `cli`; needs OD-1's answer, because entity-api serves an entity-store)
- **Trigger:** OD-1 ruled, entity-api certified, and its follows unparked (zorg's D15).
- **Rulings it would change:** SD2, the server's planner running a tab's write, where entity-api serves the store's own operations and "never decides"; H17-B251 and B304, how a tab reconciles; the websocket protocol of `docs/spec/API.md`; the watchdog's revision pin, which rides the socket; the origin check (`server/origin.mjs`), where agp's listener takes the upgrade itself (INFERRED); for agents, `docs/spec/ACCESS.md`'s bearer code at the REST door, and SD1's "The CLI stays a plain HTTP client" with the target's section 4.3.
- **Zorg's rulings that name drawv2:** D38 puts "drawv2's agent door" in one peer model, each connection admitted with a short-lived key; D39 moves "the minting, hashing, storing and revoking of drawv2's codes" into credential-issuer, on the premise that a static code's only use is obtaining keys -- whether they bind drawv2 is the director's to say.
- **What it must answer:** whether a tab writes raw store operations or calls a drawv2 operation that runs the planner; how a tab is admitted -- agp's admission sees only the transport's evidence, verified for TLS-PSK alone, so either path needs an admission capability agp lacks, and credential-issuer's own contract depends on agp capabilities it has asked for; where undo, redo, reclaim, open, create, delete and list go; how a REST caller's identity crosses into operations (BL21); follows, parked under zorg's D15; the lab, which has no server.
- **Not argued from:** the seams D32's "Why" names -- transactions unreachable, an expected-version check discarded, changes not reaching a second viewer -- were restored in drawv2 in 2026-08 (`docs/spec/API.md`: H4, B39, CS1 and CS3); the case for agp is alignment, not a defect.

**OD-3 -- how do components reach the page and the installed CLI?**\
(needed before any component runs in a browser or the CLI)
- **Trigger:** the first ruling that puts a component in the page, the lab or the CLI.
- **Rulings it would change:** H17-D12, no build step, if a build step is chosen -- its reason was A2's parity over built code, not in force if A-5 is yes, and P3's generated-and-gated holds parity; B138's standalone CLI, installed by symlink with no package, if it gains dependencies.
- **What it must answer:** published packages through an import map, a build step, or compiled components vendored as generated source held by a gate; that operation-command needs operation-call, which depends on agp at run time, so even an HTTP CLI installs agp; the runtime -- Node 24 for the components, Node 22 in production; that compiled ESM free of runtime-specific modules loads in a browser through an import map -- entity-store's `node:fs` is only in its file adapter, shape-check imports nothing, operation-call uses only globals, agp's node package imports `node:crypto` (MEASURED by Review 2).

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

---

## 9. Review 2 -- 2026-10-12, of revision 2 at `0afe86c`

A second agent, fresh, asked to verify Review 1's dispositions and attack the decisions above all.
**Verdict:** "not ready" -- 2 blockers, 7 majors, 6 minors; it found Review 1's findings 1, 6, 7, 8, 10, 11 and 13 fixed only in part.\
Its reasoning, in its words: "ruled as recommended, both decisions would change rulings the director made without the decision saying so."\
Each fact it cited was read again at its source before this revision.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | blocker | A-3 (a), a diagram as an entity-store, changed LOCKED decisions it did not name -- D23 and N12, D1, D13 with the director's two refusals (`docs/spec/AUTHORITY.md`, 5a), N2 and H17-D10 -- and credited the acknowledgement change to WD9, which says nothing of it | **Re-scoped.** A-3, A-3a and A-3b are withdrawn as decisions; the substitution is the owed design OD-1, whose list names every ruling the review found, the acknowledgement change credited to D13 and 5a, and the adjustments entity-store owes, a refused one to be answered by the design |
| 2 | blocker | A-2 (b)'s "changes no ruling" was not shown: where the planner runs for a tab's write (SD2), how a tab reconciles (H17-B251, B304), duties with no home, the watchdog's revision pin, the origin check | **Re-scoped.** A-2 is withdrawn as a decision; the substitution is the owed design OD-2, whose list names each of these as what it must answer or the ruling it would change; "changes no ruling" is gone |
| 3 | major | A-2 (b) understated its departure from zorg's D38 and D39, which name drawv2's agent door and codes | **Fixed.** OD-2 quotes both and asks whether they bind drawv2 |
| 4 | major | tab admission unchosen, and neither path works with today's agp | **Fixed.** OD-2 must answer it, with the admission capability agp lacks named |
| 5 | major | A-2 depends on A-3 but was asked first | **Fixed.** The owed designs are ordered OD-1, then OD-2, each depending on the one before |
| 6 | major | undo's option left redo unstated and omitted the variant that keeps redo | **Fixed.** OD-1 must answer redo, with the gpt seat's variant named |
| 7 | major | A-1 (a) was argued from mission-kit's 0087, which as written excludes every proposed component; credential-issuer has no code; the checker omits it | **Fixed.** A-1 (a) composes components with a contract and code, argued from S3 and C0, each marked with its certification; 0087 is named as the stricter bar none yet meets; credential-issuer goes to the register; A-6 notes the checker's default set |
| 8 | major | A-3a (i) moved owner and grants out of `meta` (`docs/spec/ACCESS.md`), gave the lock two homes, left presence homeless, and costed no selection write | **Re-scoped** into OD-1's list: the ACL's place is a ruling it would change; selection, controllers, owner, grants and presence, and a selection's write cost, are what it must answer |
| 9 | major | the costs and the recommendation presented seams drawv2 restored in 2026-08 as open defects | **Fixed.** OD-2 says the seams D32 names were restored (`docs/spec/API.md`: H4, B39, CS1, CS3), and that the case for agp is alignment, not a defect |
| 10 | minor | the command-line split across the D32 seats was misstated | **Fixed** in section 2.2 |
| 11 | minor | `releases.js` was already drawv2's content in B274; only `recognize.js` is stale; `capture.js`'s words are all "svg" | **Fixed** in section 2.3; B274 amended with the measurement, its trigger restated unchanged |
| 12 | minor | A-5 named the wrong pair of owed questions | **Fixed.** Section 5 names the CLI's types and the behaviour family, and the one-declaration question through the target's section 3 |
| 13 | minor | entity-store's name rule is narrower than drawv2's names | **Fixed** in OD-1's list |
| 14 | minor | A-3's appeal to AX6 should cite the survey's F6 | **Fixed** in OD-1's list |
| 15 | minor | A-4 (a)'s CLI costs: the CLI installs by symlink with no package; operation-call depends on agp; exit statuses and `--json` change | **Fixed.** A-4 is withdrawn as a decision into OD-3, whose list names each; the `cli` row names the exit statuses and `--json` shape |

**The standings moved during the review:** entity-api, operation-proxy and operation-command each failed a second verification, recorded in zorg after `0afe86c`; section 2.1 is updated, and the standings are read again before each decision is asked.

---

## 10. Review 3 -- 2026-10-12, of A-0 and A-1 at `dbb4b2a`

A third agent, fresh, asked only whether A-0 and A-1 were honest questions, whether ruling them as recommended changed anything unnamed, and whether A-0's recommendation delivers the goal H21.9 sets.
**Verdict:** A-0 "ready after the changes above"; A-1 "not ready".\
It found no drawv2 ruling or ratified section that A-0 alone changes.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | blocker | A-1's one concrete effect, shape-check composed into the kind contract, needs OD-3, which A-0 defers: the kind contract runs in the page and the lab | **Fixed.** A-1 is withdrawn; under A-0 nothing composes yet, and the `kind-contract` row names the OD-3 dependency |
| 2 | major | composing shape-check into a core part breaks the ratified section 4.3, "the core consumes the core alone", and its gate, unnamed | **Fixed.** The `kind-contract` row names section 4.3 and `KIND_MAY_CONSUME` among the rulings composing it would change |
| 3 | major | shape-check's fit is undefined: field checks are functions, dialect 1 has no numeric bounds, lengths are counted differently | **Fixed.** All three in the `kind-contract` row's fit gap, the dialect-2 adjustment named as shape-check's record's to rule |
| 4 | major | A-0's grounds did not separate its options, and "not to migrate yet" misread H21.9, which rules out migrating, not designing | **Fixed.** The recommendation is argued from the record that does separate them -- OD-1's component is certified, OD-2's and OD-3's are not -- and from H21.9's goal; "not to migrate yet" is no longer a ground |
| 5 | major | "two of them latency the director declined twice (AUTHORITY.md, 5a)" misstated count, citation and mechanism | **Fixed.** OD-1 cites `docs/spec/AUTHORITY.md` section 5: a commit-path round trip the director declined twice for verifying the lease; D13 locked on the evidence of the shutdown window; a buffering port might keep it (INFERRED). Review 2's finding 1 quoted the same "5a"; this corrects its copy here |
| 6 | major | the options were incomplete -- the middle option missing, (b) bundling every ruling together -- and the owed designs had no triggers (RU3) | **Fixed.** A-0's options are: the owed designs waiting on their triggers, or OD-1 designed next with OD-2 and OD-3 on theirs; why stating the centre now is not offered is said; OD-1, OD-2 and OD-3 each carry an observable trigger |
| 7 | major | the director was not told what A-0 yields: a mapping, and no component composed | **Fixed.** A-0 opens with what every option gives -- the mapping, in the register; no component composed; the centre drawv2's, its locked decisions intact |
| 8 | minor | D38's and D39's clauses naming drawv2 were not mentioned in A-0 | **Fixed.** A-0 says they stay open until OD-2, and that this is part of what it rules |

**Not reviewed:** A-0's recommendation moved from (a) to (b) in this revision, on the reviewer's own observation that the components the owed designs depend on are moving at different speeds; it is put to the director with that said.

