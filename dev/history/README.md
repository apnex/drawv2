# history

Documents that are neither current state nor target state.

`docs/` holds what is TRUE NOW or what is DESIGNED AND NOT YET BUILT.\
A document that describes a state the system has passed through belongs here instead, because a reader who takes it literally would be misled and the only way to know is to have been present.

Nothing here is edited.\
Each file is preserved as it was written, which is the whole reason it is not in `docs/`: correcting it would destroy the record it exists to keep, and leaving it in place would make it look like documentation.

## What is here

- **`COMMIT-AUDIT.md`** -- an axiom-alignment audit run on 2026-08-18 against the COMMIT design PLAN, before any of it was implemented.
  Its milestone ids are the plan's original `M1`-`M6`, which no longer exist.
  It is cited by `docs/spec/TRANSACTIONS.md` as the reasoning behind rulings that document carries, so it is reachable rather than deleted.

- **`DESIGN.md`** -- a UI design panel report from 2026-06-12: four independent lenses, 23 proposals deduplicated to 18.
  Every item in it is marked SHIPPED with a June date and none is open, so it records a decision round rather than a plan or a state.
  `dev/INPUT.md` quotes its framing line, which is why it is kept rather than deleted.

## What is not here

The ledgers stay in `docs/`: `BOARD.md`, `BACKLOG.md` and `DECISIONS.md` are current by construction, even though every row records something that happened.\
A ledger is a live index of state, not a narrative of it.

`dev/surveys/` and `dev/design/` also stay.\
A survey is a ratified record of intent captured on a day, and **M4** protects it from being rewritten to match what was later built -- that is a different thing from a document that has gone stale.
