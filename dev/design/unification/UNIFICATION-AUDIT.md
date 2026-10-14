# The unification audit -- where the system stands against its ruled target, and why the records drift

Written 2026-10-11 at `8d7d490`, on the director's instruction: "let's make this unification.\
I'd like to re-audit the approach and any surrounding activity (compound learning) such that we are actually reaching for hardened, target state modular sovereign decoupling and perfect unification".\
An audit of a bounded surface (mission-kit W9): its scope is stated first, and every finding is bound to a file, a line, a row or a commit.\
Four read-only sweeps ran in parallel -- the code's naming of types and kinds, the recorded exceptions and held rows, the ruled target against the code, and the record-versus-truth incidents -- and the findings below were spot-checked against the files before being written down.\
MEASURED marks what was read or run; INFERRED marks a reading of the evidence.

---

## 1. Scope

**In:**
- **The code's distance from the ruled target ontology**: the anchor as the core, everything else composed onto it, and "a named type is a composition of packs rather than a kind the core understands" (`dev/DECISIONS.md`, "The universal node, staged", amended 2026-09-22).
- **Every recorded exception** to the decoupling rules -- ratchet records, layer allowances, dead-code reasons, deferrals in the arc designs -- and whether its reason and its trigger still hold.
- **Every held row bearing on unification**, its revival trigger, who set it, and whether it has fired.
- **Every incident since 2026-09-01 where the records disagreed with the truth**, mined to root cause (A14).

**Out:** the parked paths and flows (B327), production data, and any change to the code -- this audit builds nothing.

**Falsifiable:** each finding names where to look; a finding the reference does not bear out is a fault in this document.

---

## 2. Verdict

**The decoupling is built; the unification is not.**\
Every kind is a plugin's, the core holds the anchor's storage row alone, every door composes the same plugins, and the canvas names no plugin's kind beyond a record that may only fall (MEASURED: `tests/core-names-no-plugin.test.js`, `tests/canvas-names-no-plugin.test.js`, `product/kinds.mjs:101`).\
What the director ruled on 2026-09-22 beyond that -- packs, a type as a composition, one lookup per type, a type declaring the roles it permits -- has no code.

**The measurement of "done" was narrower than the target.**\
The ratchets that certify the decoupling scan the core, the planner and the canvas, and only for some words; the server, the CLI, the simulation, the lab and the kernel's export door are scanned by none of them, and nothing anywhere counts device type names (section 3.3).

**The records are a hand-kept second account of the system, and they drift.**\
Thirty-one incidents in six weeks; no scanner caught any of them; seven were still wrong at `8d7d490` (section 5).\
The root is structural: there is no target architecture to measure against, the current state is described by hand rather than derived, and triggers and reasons are prose nothing evaluates (section 6).

---

## 3. The code against the target

### 3.1 Device types are names that eight tables each key on

MEASURED.

| # | Table | Where | Used for | Owner |
|---|---|---|---|---|
| T1 | `GLYPH_BB` | `kernel/theme.mjs:90-93` | glyph boxes | the kernel (a core layer) |
| T2 | `GLYPH_DEFS` | `kernel/theme.mjs:113-162` | glyph art, `<g id="glyph-<type>">` | the kernel |
| T3 | `DEVICE_HAND.items` | `devices/device-hand.mjs:23` | palette tiles and digit order | the devices plugin |
| T4 | `OFFERS` | `network/transit-offers.mjs:18` | transit (routing) permission | the network plugin |
| T5 | `NODE_TYPES` | `cli/verbs.mjs:31` | `draw add`, `draw place` | the CLI (a deliberate standalone copy, B138, held to T1 by B167) |
| T6 | `GLYPH` | `cli/verbs.mjs:2263` | `draw map` symbol | the CLI |
| T7 | `LEGEND` | `cli/verbs.mjs:2264-2267` | `draw map` legend, T6 inverted | the CLI |
| T8 | `TOWERS` | `engine/kinds.mjs:49-51` | run-mode tower stats (`loadbalancer`) | the simulation |

The tables list the types in five different orders.\
The type field itself accepts any lowercase word (`devices/device-fields.mjs:83`).

**What adding a seventh type costs:** seven tables in five files, plus the digit range in `app/src/keymap.js:106` and `app/src/help.js:23`.\
Only T5 against T1 is held by a test (`tests/cli-tool.test.js:1493`), and T3 against T1 one way (`tests/canvas-hand.test.js:89`).\
A missed routing row defaults silently to no transit (`network/transit-offers.mjs:21`); missed art draws an empty glyph; a missed map letter draws `?`.\
The ruling's "adding a glyph means deciding its routing permissions" (`dev/DECISIONS.md:248`) is enforced by nothing.

### 3.2 Ruled target statements not built, or built in part

MEASURED against the code; the ruling lines are `dev/DECISIONS.md`.

| Ruling | Statement | State | What is missing |
|---|---|---|---|
| :268-270 | "a named type is a composition of packs" | not built | no pack or composition exists in code; `type` is a free word read by the tables above |
| :272-274 | "one lookup, not two, and no per-type row free to drift" | not built | eight tables (section 3.1) |
| :237-240 | "A type DECLARES which variants it permits" -- endpoint, junction, bend | in part | only transit on or off exists (`OFFERS`); whether a device may bend or join is decided by whether it has a type (`network/link-reactions.mjs:333`, `network/link-rules.mjs:234`) -- the inference from incidental properties that :242-244 rejected |
| :251-253 | "A violation is REFUSED, in the validator" | in part | a pin through a type offering no transit is refused (`network/link-references.mjs:119`); a pin through a transit-off stop is cut (`network/network.mjs:103-108`); SD5, refuse or cut (:895), was never put to the director |
| :361-372 | appearance resolves per state: a junction's ring composes over a frame | in part | the mechanism exists (`app/src/renderer.js:384`); no appearance uses it, so a device that is a junction shows no mark (`dev/design/unification/DEVICE-JUNCTIONS.md:145`) |
| :265-266 | glyph, name, content, span and shape are not core | in part | `name` is in the core anchor row (`model/shape.mjs:81`); never re-ruled |
| :279-280 | appearance and routing are pack families | in part | glyph, frame and content are one device extension (`devices/device-fields.mjs:77-89`), not separate packs |
| SD1, :779-793 | browsers and server derive; the CLI asks | in part | REST and the CLI serve no roles; the CLI derives `combat` and `movers` itself (`cli/verbs.mjs:418-423`) and restates the endpoint and bend check (`:1631-1638`) |
| SD11b, :872-880 | the network is a plugin; "a world without connections carries no pipes" | in part | the planner refuses to plan without a link tenant (`planner/txn.mjs:251-252`); the canvas has a dedicated `network` slot (`app/src/compose-canvas.js:42`, `:65`) |
| SD12, :882-891 | each document lists the plugins it needs | not built | held as B248; deferred by `dev/design/unification/FORMAT-BATCH.md:62` |
| SD10, SD6 | flows in the document; a "flows may pass" column | not built | parked by the director (B327) |
| N1, :1574 | "the core keeps only what spans kinds" | in part | `kernel/theme.mjs`, a core-layer module, holds the device glyph tables and the zone, group, link and waypoint colour roles (`:21-40`) |

### 3.3 Where the measurement does not reach

MEASURED: the decoupling ratchets and what each scans.

| Ratchet | Scans | Misses |
|---|---|---|
| `tests/core-names-no-plugin.test.js` | the core layer and `planner/` | `layout(s)` as a kind word; `.transit` and `.glyph` as fields; the kernel's export modules (`kernel/adapt.mjs`, `kernel/engine.mjs`, `kernel/svg-scene.mjs` are layer `export`) |
| `tests/canvas-names-no-plugin.test.js` | `app/src/*.js`, kind words and plugin imports | device fields |
| `tools/layers.mjs` `RATCHETS.L7k` | product layers, lines naming all five legacy words | `lab/`; any line naming fewer than five |
| `tests/bare-anchor.test.js` | the word `waypoint`, almost everywhere | everything else |

Unscanned and holding plugin names (MEASURED): `kernel/adapt.mjs` (device fields at `:36`, `:48`, `:50-51`, `:62`; kinds at `:58`, `:63`, `:93`, `:96`, `:98`), `kernel/engine.mjs` and `kernel/svg-scene.mjs` (zone, group, transit, content), `engine/relations.mjs` and `engine/situation.mjs` (`'link'`, `spawn`), `server/rest.js` (kinds at `:107-114`, `:212-218`, `:679-688`), `server/seed.js`, `cli/verbs.mjs` (about 85 kind words and 30 device-field reads), `lab/src/root.js:50-51`, `:204`.\
Cross-plugin reads are measured by nothing: `groups/group-painter.mjs:21` reads a device's `span`; the network reads `.type` at `network/link-references.mjs:119`, `network/resolve.mjs:114`, `network/session.mjs:72`, `network/transit.mjs:131`.\
None of the regexes see a double-quoted or template string, an object key, or a property such as `doc.zones`.

---

## 4. Recorded exceptions and held rows

### 4.1 Exceptions whose reason is stale or whose trigger is missing

MEASURED.

| Where | What it allows | The fault |
|---|---|---|
| `tests/canvas-names-no-plugin.test.js:45` | `app/src/commands.js` imports two plugin modules, for the clone's naming | cites B187, CLOSED; no trigger; the import also builds the generic `create` label (`commands.js:35`) |
| `tests/canvas-names-no-plugin.test.js:46-48` | the composition roots' imports (`main.js`, `run-mode.js`, `compose-canvas.js`) | no trigger (permanent by design, unstated as such) |
| `tests/core-names-no-plugin.test.js:10-13` (header) | -- | still says "the canvas's half of B280, which B308 designs"; both CLOSED |
| `tests/core-names-no-plugin.test.js:42` `DEVICE_RECORD` | three device-field reads in `kernel/renderer.mjs` | its devices-plugin half (`devices/device-appearance.mjs:14` imports them) has no trigger |
| `tools/layers.mjs:110` | -- | "network debt that K13d moves at the rebuild"; K13d is done |
| `tools/layers.mjs:144` | -- | "L2 debt that K6 removes"; the edge is gone and `RATCHETS.L2` is empty |
| `tools/layers.mjs:462` `L5p` | `kernel/router.mjs:routeGeometry` | no reason row, no trigger |
| `tools/layers.mjs:467-468` `L7k` | `cli/verbs.mjs` 7, `kernel/adapt.mjs` 2 | no stated reason, no trigger |
| `tools/layers.mjs:667` `rebuild-debt` | unused exports including `group`, `zone`, `node`, `groupHull`, `spanExtent` | "paid by ... K13d"; K13d is done |
| `tools/scan-dead.mjs:63` | `network/roles.mjs:waypointRole` | "until then" names K13a, done |
| `tools/scan-cli.mjs:44`, `:48`, `:50` | -- | "DELETE has NO verb ... (B133 remainder)"; `draw rm` exists (`cli/verbs.mjs:2554`) and B133 is CLOSED |
| `dev/design/unification/KINDS-AS-PLUGINS.md:181` | the network's tenant passed as `links` | "O-e's or O-d's to settle"; never settled (`planner/txn.mjs:235`) |
| `dev/design/unification/KINDS-AS-PLUGINS.md:367` | "Deferred, each with its trigger" | every trigger named there is spent |
| `dev/design/unification/CANVAS-PLUGINS.md:399` | carried items | the anchor's canvas part was answered (WD4, WD6, WD-b2) and is not marked spent; none of the carried items has a row |
| `dev/design/unification/DEVICE-JUNCTIONS.md:152` | device-role drawing deferred | says "recorded with a revival trigger (RU3)"; none exists |
| `dev/BACKLOG.md` B126 | link capacity as a per-kind property | OPEN with no trigger, while its item H10.11 has been `DONE` since 2026-09-01 (`dev/BOARD.md:594`) |

### 4.2 Held rows bearing on unification -- who set each trigger, and whether it fired

MEASURED unless marked.

| Row | Trigger | Set by | Fired? |
|---|---|---|---|
| B282 (pack half) | "the second pack that composes" | an agent: written at `3a47f3a` (2026-10-03) from a caution an agent wrote into a ruling entry (`46b1871`, `dev/DECISIONS.md:289`); no director quote | yes, INFERRED: three plugins compose fields onto the anchor since `c4b2667` (devices, network `transit`, simulation `spawn`); not recorded |
| B248 | "a client that lacks a plugin a document uses is put to use outside the tests" | an agent (`e6f0131`); the director's SD12 choice was "Yes, listed now" (`dev/DECISIONS.md:883`) | no |
| B256 | "concurrent links on one pipe are designed" | the director (`dev/DECISIONS.md:1247`) | no |
| B262 | a binding must shadow another, disjoint conditions measurably worse | an agent's wording of the director's "We may allow for ovverides later" (`:1418`) | INFERRED relevant: the product's `w` is hand-kept disjoint from the network's (`app/src/keymap.js:29`, `:101`) |
| B274 | "a second app needs gesture input" | an agent (`f7673ec`) | no |
| B289, B325 | the infinite canvas designed | the director's words (`:1646`, `:1885`), agents' trigger text | no |
| B310 | an agent misreading "anchor", or the next change to the grid routes | an agent (`4727711`) | no |
| B327 | the director reopens paths and flows, among others | the director's first clause (`dev/BOARD.md:1376`) | no |

---

## 5. Record against truth -- the incidents

MEASURED: thirty-one incidents from 2026-09-01 to 2026-10-11, two of them clusters of same-day corrections.\
How they surfaced: the director's question (4), a director-ordered re-triage (6), building or review (9), an agent's own reconcile (7), and this audit (5).\
**No scanner caught one.**

| Class | Count | Incidents |
|---|---|---|
| (c) a revival trigger nobody re-evaluates | 8 | B164 (fired from 2026-09-08, three flakes recorded only in commit messages: `eb21f59`, `339971d`, `3ee0b29`); B27 (fired 2026-08-22, `f2a53e0`); B248 (fired three hours after it was written, `aa91ba0` then `c20ad2a`); B250; B243 (fired 48 minutes after, `dc877ea`); B7 (named work never scheduled); B88 (fired 2026-10-02 when B279 entered Decisions required, `35edef3`; still unrecorded); H15.2 and H15.9 |
| (f) an agent asserting from memory | 7 | the CLI's list called H17.3's remainder (`de6a8f7`); B138 cited unread (`3b9309f`); the atomic apply already built (`e3ef7b8`); "I MISLED THE DIRECTOR" (`1751492`); two circles, not one (`339971d`); D3's options presented as new (`e686659`); a cluster of design claims about code (`KINDS-AS-PLUGINS.md:62`, `:280`, `PLUGIN-QUERIES.md:29`, B323's review finding 7, others) |
| (e) a reason citing a closed row or landed work | 5 | B248's revival in error (`8ea822e`); the kernel ratchet reasons citing B308; the scan-docrefs reason in B79; `tools/scan-cli.mjs` (still wrong); `tools/layers.mjs:110`, `:144` (still wrong) |
| (b) a status in a secondary document | 4 | `dev/design/h17/PLAN.md` cut statuses (twice); the WRITES, AUTHORITY and COMMIT headers saying "no code"; `dev/design/input/GESTURE-SYSTEM.md:1` "awaiting approval" (still wrong) |
| (d) an agent's wording treated as the director's | 3 | B282's trigger (above); "H10.30 is the director's call" (`dev/BOARD.md:230`, `dev/PRODUCTION-UPGRADE.md:166`, `:194`, still wrong); a cluster of CORRECTED lines in `dev/DECISIONS.md` (`:938`, `:960`, `:990`, `:1225`, `:1296`, `:1603`, `:1663`), `:952` still wrong |
| (a) external state no check reads | 1 | H10.30 and B159: Cloud Armor live from 2026-08-27, recorded as missing for 44 days, the change made by `gcloud` with no commit |
| (g) other | 3 | B181, B182, B186 shipped with no rows; RULES.md's acceptance case overtaken by H15.6; B238 closed on one green run |

**Still wrong at `8d7d490`:** B88's trigger; `tools/scan-cli.mjs:44-50`; `tools/layers.mjs:110`, `:144`; "the director's call" at `dev/BOARD.md:230` and `dev/PRODUCTION-UPGRADE.md:166`, `:194`; `dev/design/input/GESTURE-SYSTEM.md:1`; the header of `tests/core-names-no-plugin.test.js`; and B282's trigger (corrected with this audit).

---

## 6. Root causes

INFERRED from section 5, each pattern seen in several classes.

1. **Work lands under another id.** A condition is met by work carrying a different identifier -- S-a and O-e2 met B282's, the zones plugin met B248's, the agent door met B27's, `gcloud` did H10.30, four programmes did the lab plan's cuts -- and each landing edits only its own row. Nothing maps landed work back to the conditions it satisfies.
2. **Triggers and reasons are prose.** No check evaluates a trigger, tests whether it was already true when written, or reads a reason's cited row; the scanner's header says trigger judgement is "deliberately NOT faked" (`tools/scan-board.mjs:31-34`). Only a re-triage the director orders evaluates them, and re-triages erred three times.
3. **The current state is hand-written, and the target is unwritten.** `VISION.md:159-161` says so itself: "There is no architecture record yet." The survey planned "a target architecture and deltas" (`dev/surveys/unification-survey.md:307`); it was never written. So "how close are we?" is answered by reading prose, which is how "the programme is complete?" needed an investigation.
4. **Corrections stay where the error was seen.** H10.30 was fixed on two lines and left on three; the frozen-history convention keeps a table cell false under an AMENDED line by design (`dev/design/h17/PLAN.md:110-126`).
5. **Provenance is not marked.** Agent prose inside a section headed "ruled by the director" reads as the director's, and later agents cite it as such.
6. **Infrastructure has no record a check can read.** A change made with `gcloud` leaves no commit, and `deploy/` is skipped by name (`tools/scan-docrefs.mjs:330`).

---

## 7. The approach proposed -- reaching the target, and staying true on the way

Ordered by the board's rule, the higher of impact and principle breach: the record fixes and guards first, since every later stage leans on a true record (A8, A14); then the destination written down, so progress is measured rather than reported (AR1); then the measurement widened to it; then the build.\
Sizes are judgement.

| Stage | What lands | Exit, binary | Size |
|---|---|---|---|
| **U0. The records made true** | every still-wrong line in section 5 corrected at its source; every stale reason and missing trigger in section 4.1 fixed or recorded | each line listed in sections 4.1 and 5 reads true, cited | small |
| **U1. Guards against the drift classes** | a trigger is written as a named machine check the gate evaluates (a row closed, a file present, a plugin count, a decision heading) or as a judgement re-evaluated at every milestone close; a reason in code, tests or tools citing a `B` or `K` id is failed when that row is closed; a ruling's director words are quoted and agent prose in it marked; status lives on the board alone, plan tables carrying none; an infrastructure claim cites a dated probe; a flake ledger, so "a second flake" is countable | each guard fails on a planted instance of its class, or the class is recorded as judgement with its cadence | moderate |
| **U2. The target architecture** | a present-tense architecture of the whole system at the target instant (mission-kit AR1): the anchor core, the pack families, a type as a composition, each plugin's duty, the doors, the entity model, axiom alignment, and an owed-and-open register; and the current instant derived from the code by a tool, not written by hand | the director ratifies the target; the derived current state regenerates in the gate | moderate to large |
| **U3. The measurement widened** | the name ratchets cover every product layer -- the server, the CLI, the simulation, the lab, the kernel's export door -- every quoting form, cross-plugin reads, and device type names outside a type's declaration, each hit recorded with a reason and a trigger | no product layer is unscanned; the records equal the hits | moderate |
| **U4. A type is a composition** (B282, the delta) | each device type declared once as its composition -- appearance (art, box), routing (the roles it permits, transit), behaviour (a tower), palette place; every plugin reads its own part; the glyph art moves to its owner; the bend and join permission read from the declaration, not from "has a type"; SD5 ruled; the CLI fed by the server or held by parity | adding a type is one declaration, proven by a test that adds one; no type name outside the declarations (U3's ratchet at zero) | large |
| **U5. The rest of the target** | the network's privileged slots made a generic plugin seam (the planner's `links`, the canvas's `network`); the core's colour roles to their owners; a device's junction drawn (per-state appearance); roles served to REST and the CLI (SD1); the export door through the painters, or recorded; `name` in the core ruled | each to its own exit, under U2's target | large, several arcs |

**Decisions owed, each when its stage reaches it:** whether `name` belongs in the core (U2); SD5, refuse or cut (U4); who owns the type declarations, the devices plugin or the product (U4); how the CLI learns the types (U4); SD12's plugin list, held as B248 (U5).

AMENDED 2026-10-11 -- **the approach ruled, and U0 done** (`dev/DECISIONS.md` H21; H21.4).\
Every line section 5 lists as still wrong, and every fault in section 4.1, is corrected where it stands or recorded with a trigger: the carried and deferred items gained rows (B328, B329 and B330 held; B331 and B332 planned at H21.8), B126 is held with a trigger, B88's fired trigger is recorded and the row planned at H21.5, and the design index lists all twenty-seven of its members (twenty-six documents and the matrix's data file).\
Left for U1 by design: the lab plan's status cells (`dev/design/h17/PLAN.md`), which U1's rule -- status on the board alone -- retires rather than edits.

CORRECTED 2026-10-11 (H21.5, the guards' second review): "B88 (fired 2026-10-02 when B279 entered Decisions required" -- B88's trigger fired first on 2026-09-08 (`7440cc9`, two items `BLOCKED`) and again on 2026-09-22 (`27c7eb2`), MEASURED; 2026-10-02 was its third firing, on its second clause.

AMENDED 2026-10-14 -- **U1, U2 and U3 done** (`H21.5`, `H21.6`, `H21.9`, `N5a`, `H21.7`).\
U1 (`H21.5`): the record guards run in the gate (`tools/scan-triggers.mjs`, `tools/exceptions.mjs`, `tools/scan-designs.mjs`).\
U2 (`H21.6`, `H21.9`, `N5a`): `docs/ARCHITECTURE-TARGET.md` ratified (`H21.6`), aligned with mission-kit (`A-0`, `A-5`), the anchor's name settled (`N5a`), and `docs/ARCHITECTURE.md` generated from the code (`tools/generate-architecture.mjs`).\
U3 (`H21.7`): every product layer (`PRODUCT_LAYERS` and `lab`) is scanned by `L7k` (`tools/scan-layers.mjs`), `tests/canvas-names-no-plugin.test.js` (`KIND_RECORD`, `FIELD_RECORD`, `IMPORT_RECORD`), and `tests/core-names-no-plugin.test.js` (`RECORD`, `DEVICE_RECORD`, `PRODUCT_KIND_RECORD`, `PRODUCT_FIELD_RECORD`, `TYPE_NAME_RECORD`) across every quoting form, object keys, collection properties, cross-plugin reads and device type names, each entry checked by `tools/exceptions.mjs`.

AMENDED 2026-10-14 -- **U4 done** (`H21.3`, `U4-1`, `SD5`, `U4-2`, `U4-3`; `dev/design/unification/TYPE-AS-COMPOSITION.md`).\
Each device type is declared once in `devices/device-types.mjs` across appearance, routing and run-mode behaviour, handed to the plugins at composition (`product/types.mjs`), and served at `GET /api/v1/types` (`draw types`); `T1` to `T8` outside `devices/device-types.mjs` are gone, `nodePermitsBend` reads the routing pack's roles, and `TYPE_NAME_RECORD` fell from 11 files (83 hits) to 4 files.

