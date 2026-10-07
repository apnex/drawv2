# A device that passes routes may be a junction -- H19.10 (DELTA, proposed)

> **Tier 3 -- a design of record, proposed.** Written 2026-10-07 against `3b21b6b`.
> Facts about today's code are measured and cited by file and line; judgements are marked as such.
> Proposes; decides nothing. Section 9 lists what only the director can settle, one at a time.
> AMENDED 2026-10-07: approved; Z1 ruled as recommended, transit rules only (section 9).

## 1. Status

- **Asked for:** the director, 2026-10-07: "In my model a device can be either an endpoint OR a junction - depending on capabilities imported from the network plugin. Junction requires transit enabled." Confirmed: "Yes this seems to match" (`dev/DECISIONS.md`, "A device is an endpoint or a junction, by what the network plugin gives it").
- **Is:** board item H19.10 (B301), and the first slice of B282, a type as a composition of capabilities: whether a node may be passed is decided by a capability the network plugin gives it, transit, not by whether it has a type.
- **Found by:** the director's test of the ring fixes on production (B299 to B301).

---

## 2. From-state -> to-state

**From** (measured at `3b21b6b`):
- **A pinned stop must be a bare waypoint.** The validator refuses any other node in `via` (`network/link-references.mjs:109`, `hasWaypoint`).
- **Transit's cut skips devices.** Turning a router's transit off changes its setting and cuts nothing (`network/transit.mjs:89`, `bareAnchor`).
- **A ring opens only if every stop is a waypoint** (`network/link-rules.mjs:234`), the B301 safeguard. Two production rings pass through a device and do not open: `multi-site` through a vxlan, `castle` through a router.
- **Rejoining when transit returns considers waypoints only** (`network/link-reactions.mjs:296`, `:300`).
- **Routes already pass devices whose transit is on.** `w` on such a router routes the link through it over the pipes the `w` lays, without storing it as a pin (matrix row TRN-43).
- **Whether a type can pass routes** is the transit module's table -- router, firewall and vxlan offer transit; load balancer, server and host do not (`network/transit.mjs:19`) -- and nothing outside the module can ask it.

**To:**
- **A pinned stop is a node whose type offers transit:** a bare waypoint, or a device of such a type. One predicate, stated once in the transit module and read by every rule that asks.
- **Transit off at a device cuts the links pinned through it,** and transit back on rejoins them, exactly as at a waypoint (TR-2).
- **A ring opens wherever transit goes off,** the safeguard reading the same predicate; `multi-site` and `castle` open like the arrow.
- **Decided by Z1 (section 9):** whether `w` on a transiting device stores it as a pin, and whether a device pin follows the waypoint-pin rules that are not transit's.

---

## 3. The fence

The pinned-stop rule; transit's cut and rejoin at devices; the ring opening's safeguard; `w` on a transiting device, as Z1 rules; the matrix rows that hold them; the register.

---

## 4. The anti-scope fence

- **No change to how a device is drawn.** A device keeps its glyph; no endpoint or junction mark is added to it. Showing a device's role is a separate question, recorded in section 8.
- **No change to which types offer transit.** The table is configuration the network plugin brings; a load balancer offering transit is the director's to configure, not this delta's.
- **No change to a link that ends at a device.** A link ending at a router stays ending there; this delta adds a way to pass a device, and takes none away.
- **No migration.** No stored document pins a device today, so nothing stored changes.

---

## 5. Findings that shape the design

### 5.1 One question, asked in four places as "is it a bare waypoint?"

The validator, the transit cut, the ring safeguard and the rejoin each ask whether a node is bare (section 2).\
The director's model asks something else: whether the node passes routes.
**Recommended (judgement):** the transit module states that once -- `offersTransit(node)`, true for a bare waypoint and for a device whose type offers transit -- and each of the four reads it, so the rule cannot be stated twice and drift (A2).

### 5.2 "Offers transit", not "transit is on"

A pin's validity is judged on what its type offers, not on its current setting.\
The setting is the cut's to keep true, not the validator's: turning transit off cuts the links pinned there in the same edit (TR-2), and a drag that presses `w` on such an anchor cuts there (TR-2b).\
Judging devices on what their type offers keeps the validator's rule exact for waypoints and extends it unchanged to devices.

### 5.2a B303 -- a link written pinned through an anchor whose transit is off comes up passing it

Measured while writing this: a link put through REST or the CLI, pinned at a waypoint whose transit is off, is accepted and comes up UP, drawn through an anchor where what arrives stops -- TR-2 broken.\
The cut runs only when transit changes, and the drag cuts for itself; no rule cuts a link that arrives already pinned there.
**Recommended (judgement), within TR-2b's ruling:** the cut also runs on a link written pinned through a node whose transit is off, from any door, leaving the links ending there as a drag would -- as every door came to cut a landing (B243).
It is built in Z-b, for waypoints and devices at once.

### 5.3 Two waypoint-pin rules are not transit's

Two rules act on pins and are not about transit:
- **The landing cut** (`junction-cut`, `network/network.mjs:103`): a link made with an end on another link's bend cuts that link there, so both end there (R1, B243).
- **The join on delete** (`link-join`): two links left alone at a waypoint by a delete become one, bending there.

For a waypoint each is right: a waypoint carries nothing of its own, so where links meet it is a bend or a meeting of ends.\
For a device the join on delete would change existing diagrams: a router with three links ending at it, one deleted, would see the other two become one link passing through it -- every router in the estate with two links would collapse the first time a third goes.\
This is decision Z1.

### 5.4 The guard holds the build

Every entity a reaction writes is held to the requested-write rules (B302, H19.11), so a mistake in this delta's cut or rejoin is refused, naming the rule, rather than saved.

---

## 6. Build order -- each stage provable before the next depends on it

| stage | what lands | proven by |
|---|---|---|
| **Z-a** | **The predicate and the format:** `offersTransit` in the transit module; the validator accepts a pinned stop that offers transit and refuses one that does not | unit tests: a link pinned through a router, a firewall and a vxlan is valid; through a host, a server or a load balancer it is refused, saying so; every corpus unchanged |
| **Z-b** | **Transit at a device, and at every door:** the cut, the rejoin and the ring safeguard read `offersTransit`; the cut also runs on a link written pinned through a node whose transit is off (B303) | unit tests: a link put through REST pinned at an anchor whose transit is off arrives cut there; matrix row TRN-42 promoted and green on both pages; new rows: transit off at a router a link is pinned through cuts it, and back on rejoins it; a ring through a router opens and closes; production's two such rings checked on copies |
| **Z-c** | **`w` on a transiting device,** as Z1 rules | matrix row TRN-43 restated to Z1's ruling, green on both pages |
| **Z-d** | **Closed:** the register, the specs, B301 closed | the gate; the lab and production deployed and checked |

Each stage is one gate and one lab deploy; production deploys at Z-d.

---

## 7. Invariants and acceptance tests

**Invariants** -- each must hold after every edit, on every document:
1. A link's pinned stop is a node whose type offers transit.
2. No link is pinned through a node whose transit is off: such a node is only ever a link's end.
3. A loop's end is its only repeated stop, and the loop is open and runs round two or more other stops (B299).
4. No edit's automatic consequences leave an entity that fails invariant 1 or 3 (B302).

**Acceptance tests** -- each true or false:
1. A link pinned through a router is valid, and drawn through it.
2. A link pinned through a host is refused, and the refusal names the host.
3. Transit off at a router a link is pinned through leaves two links ending at it; back on, one link through it again; undo restores it exactly.
4. Transit off at a waypoint of a ring through a router opens the ring there, the router a pin of the loop; back on, the ring is whole.
5. `multi-site` and `castle`, on copies of production, open and close at a waypoint, drawn where they were.
6. A link written through REST pinned at an anchor whose transit is off arrives as links ending there, never passing it (B303).
7. `w` on a router whose transit is on does what Z1 rules.
8. Every corpus differs only where this delta's rows say it should.

---

## 8. Coverage, verification, costs

**Proves:** the director's device model for pins, transit and rings; B301 and B303 closed; the first slice of B282.\
**Defers:** how a device shows its role -- endpoint or junction -- on the canvas, if at all; which further types offer transit (configuration, the director's); the rest of B282 (H19.8).

**Verification targets:** unit tests per stage; matrix rows on the lab and the product page; copies of production's two rings through a device; the B302 guard on every edit.

**Named costs and non-claims (judgement):**
- **A link may now pass a device as a stored pin**, so deleting a device's pipe can leave a link pinned through it down, as at a waypoint, where a link routed through it would find another way.
- **It does not show a device's role.** A device that is a junction looks as it did.

---

## 9. Decisions for the director -- one at a time

- **Z1 -- which waypoint-pin rules a device pin follows.** Recommended: **transit's only** -- a device pin is cut when its transit goes off and rejoined when it comes back, a ring through it opens like any ring, and `w` on a transiting device stores it as a pin, as `w` on a waypoint does; but a link that ENDS at a device stays ending there: a delete never joins two links at a device, and a link landing on a device never cuts one passing it. Cost: a device and a waypoint differ in two rules, by what each is. The alternative: **every waypoint-pin rule** -- one rule for any pin whatever its kind, but deleting one of three links at a router joins the other two through it, and a link landing on a router cuts any link passing it, changing how existing diagrams respond.

---

## 10. Axiom alignment audit (M7)

| axiom | weight | how the delta holds it |
|---|---|---|
| A3 Sovereign Composition | load-bearing | whether a node passes routes is the transit module's one concern, asked through one predicate; the validator, the cut, the rejoin and the ring stop asking whether a node is bare, so a capability decides, not a kind |
| A2 Isomorphic Specification | load-bearing | one statement of the rule, read in four places that each restated it; the matrix holds the behaviour on both pages |
| A8 Gated Recursive Integrity | load-bearing | each stage gated before the next; the B302 guard refuses any reaction result the rules refuse |
| A1, A5 State transparency, perceptual parity | tension, named | a device that is a junction is not drawn as one (section 4); the state is true and readable, the canvas does not show the role -- deferred, section 8 |
| A13 Director Intent Amplification | supporting | one decision, Z1, asked alone; the model itself was the director's |
| A9 Chaos-Validated Deployment | not materially implicated | no new path between peers; the edits plan on every peer as before |
| A4, A6, A7, A10-A12, A14 | not materially implicated | |

**Layered application:** at the format layer, invariant 1; at the planner layer, the cut, the rejoin and the ring read one predicate and the guard holds their results; at the canvas, nothing changes but where a link may be pinned.\
**Guardrails for the build:** no rule asks "is it bare?" where the question is whether a node passes routes; no stored document changes; a link ending at a device keeps ending there unless Z1 rules otherwise.\
**Closeout hooks:** acceptance tests 1 to 8; the deferred role drawing recorded with a revival trigger (RU3).

**Verdict: pass-with-guardrails** -- Z1 ruled before Z-a; the drawing tension recorded, not hidden.

AMENDED 2026-10-07 -- **Z-a and Z-b done.**
**Z-a:** what each type offers is the plugin's capability table in its own module, `network/transit-offers.mjs` (`nodeOffersTransit`); the validator accepts a pin that offers transit and refuses one that does not, naming it.\
**Z-b:** the cut at a device, the rejoin of its cut's pieces only (Z1, told by lineage, `areCutPieces`), and the ring opening all read the one predicate; deleting a device takes the links pinned through it (P-7); a link written pinned through a stop whose transit is off is cut there from any door (B303).\
**Found on the way:** placing B303's cut in transit's reaction made two reactions cut one link in one phase (PD-3), so it lives in the landing reaction, which now owns every cut a link meets on arriving; and the corpora's naming took any id in a `via` for a waypoint, which a router pin now contradicts -- the matrix's corpus form tells it which nodes are typed.\
**Proven:** 12 unit tests, failing 5 of 12 on the code before Z-b; five mutants killed; matrix rows TRN-42 promoted and TRN-44 to TRN-46 new, green on the lab and the product page; the planner corpus's 37 changes each the B303 cut alone.
