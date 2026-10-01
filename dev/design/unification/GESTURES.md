# The network plugin's gestures -- generated from the rows the Rules engine reads (LIVING)

## 1. Status

- **Written:** 2026-09-30, with step T3 of the ruleset audit (`RULESET-AUDIT.md`), which the director approved the same day.
- **The master is data, not this file.** The key rows are in `network/keys.mjs` and the drag grammar in `network/grammar.mjs`; sections 3 to 5 are generated from them by `node tools/gesture-table.mjs --write`, and the gate fails if they differ from what it would write.
- **It records; it does not rule.** Rulings stay in `dev/DECISIONS.md`, and `BEHAVIOUR-MATRIX.md` holds what each gesture does on each board, checked in real Chrome.

---

## 2. How to read it

A left drag from an anchor is undefined intent until the keys pressed during it decide what it is (ruled 2026-09-30, "Each drag action does one thing").\
The product's own `w` drops a pin on the way; the network plugin brings the two keys in section 3, which production does not compose.\
When the drag ends, section 4 says what it makes and section 5 says which pipe each hop of its route lays.\
Each table has exactly one row for every case: the Rules engine reads them, and two rows matching one case fails the gate (Q3).

---

## 3. The keys the network brings

<!-- BEGIN GENERATED: keys. Run node tools/gesture-table.mjs --write; do not edit by hand. -->
| row | what it means |
|---|---|
| `guide` | g during a link drag: a guide -- the route passes this anchor, placed or existing, node or waypoint, and the link does not pin it |
| `stop-on-node` | w on a node during a link drag: a stop the link routes over, never a pin; released on it, the node is the destination |
| `transit` | x: flip transit on each selected anchor or node -- off, links stop there and a dashed ring shows it; a host offers no choice |
<!-- END GENERATED: keys -->

---

## 4. What a finished drag makes

<!-- BEGIN GENERATED: kinds. Run node tools/gesture-table.mjs --write; do not edit by hand. -->
| row | when | makes |
|---|---|---|
| `pinned-link` | any w during the drag: a link, pinned at each w anchor, routing between pins over the pipes | link |
| `pipes-only` | g and no w: anchors and pipes laid by hand, and no link -- a g also cancels the source w | pipes |
| `plain-link` | no key during the drag: a link over the pipes already there | link |
<!-- END GENERATED: kinds -->

---

## 5. Which pipe each hop lays

<!-- BEGIN GENERATED: legs. Run node tools/gesture-table.mjs --write; do not edit by hand. -->
| row | when | pipe |
|---|---|---|
| `no-pipe` | the only hop of a drag that pressed no key -- none during it, none at its end, not the source w -- lays no pipe; nor does a hop from an anchor to itself | none |
| `hand-pipe` | a hop in a pipes-only drag, a hop touching a g anchor, or the hop into an end reached with g: a pipe laid by hand, which outlives any link | hand |
| `link-pipe` | any other hop of a drag that pressed a key: a pipe laid with the link, which goes when no link is on it | link |
<!-- END GENERATED: legs -->
