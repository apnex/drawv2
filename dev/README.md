# dev

Everything the project needs to build itself, and nothing a consumer of the project needs.

`docs/` holds the product interface: what is TRUE NOW or DESIGNED AND NOT YET BUILT, stated for someone who wants to use `draw` rather than work on it.\
Everything else lives here.

The split exists so that `docs/` can be published without curation.\
A reader who opens `docs/` should find eight specifications and no drafts, no ledgers, no governance and no archive.\
If a document would make that reader ask "is this current?", it belongs in `dev/`.

## The rule

A document belongs in `docs/` if a consumer of `draw` would be misled by its absence.\
A document belongs in `dev/` if a consumer would be misled by its presence.

That is the whole test, and it cuts in places that feel arbitrary until the question is asked in that form.\
`BOARD.md` describes target state and reads like documentation, but a consumer who takes the board for a roadmap has been misled -- it is a triage surface for deciding what to do next, and its rows change faster than anything in `docs/`.

## What is here

**Staging and draft.**\
Documents that state a direction nobody has ratified.

- **`HIERARCHY.md`** -- DRAFT. The graduation convention by which a ruling becomes `[LOCKED]`, and the staging area for rulings that have not.
- **`INPUT.md`** -- the input model is DRAFT; the defect record and recognizer within it are not.
- **`RULES.md`** -- DRAFT, three rulings owed, partly superseded by a survey.

**Governance ledgers.**\
Live indexes of how the work is decided.

- **`BOARD.md`** -- the triaged set of legal next moves.
- **`BACKLOG.md`** -- what was consciously not done, each row with a revival trigger.
- **`DECISIONS.md`** -- the rulings, and what each one affects.

**Handover.**\
Where to stand before reading the ledgers.

- **`HANDOVER.md`** -- the on-ramp to the unification programme, for an agent resuming it. States the ontology, what is ruled and must not be re-litigated, the open questions, and how this codebase fails -- each failure mode carrying the defect numbers that measured it. It is the on-ramp and not the record: the ledgers above stay authoritative.

**Delivery records.**\
How something was made, as against what it is.

- **`COMMIT-DELIVERY.md`** -- the CS1-CS6 sequence that built `docs/spec/TRANSACTIONS.md`, the deletion tables, the recorded deviations, and the backlog as it stood at CS1.
- **`COMMIT-DELETIONS.md`** -- the deletion ledger. A row here IS the authorisation to remove something, which is why it outlives the milestone that produced it.

Both are gated: `npm run gate` runs `scan-claims` across them and fails on a deletion row without `[V]` evidence.

**Directories.**

- **`surveys/`** -- ratified records of intent captured on a day. **M4** protects them from being rewritten to match what was later built.
- **`design/`** -- design rounds and their proposals.
- **`history/`** -- documents describing states the system has passed through. Nothing there is edited; see its own README.

## What is not here

The eight specifications in `docs/spec/`: `ACCESS`, `API`, `AUTHORITY`, `CLI`, `HOSTING`, `LAYOUT`, `TRANSACTIONS`, `WRITES`.\
Each states what is true of the running system or what is designed and not yet built, and each is amended rather than rewritten when that changes.

`VISION.md` and `README.md` stay at the repository root.\
The vision is ratified and names what the project must never become, which a consumer has standing to read.
