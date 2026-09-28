# Transit -- what an anchor does with what passes through it (PROPOSED)

---

## 1. Status

- **Written:** 2026-09-28, against drawv2 at `2a9b488` (branch `main`), from a live design conversation with the director on the same day.
- **This document proposes; it decides nothing.** Sections 3 to 6 are the proposal. Section 8 lists what is still open, and section 9 what this would amend.
- **It exists because the conversation converged and was not written down.** The same ground was re-derived three times in one session, which is the signal that a record was owed.
- **Every number cited is MEASURED and names its file.** Where something is the proposer's reading it says so.

---

## 2. What this is for

The director ruled on 2026-09-28 that no history of a link is kept: two links left on an anchor after a mutation, compatible in plane and direction, join into one, derived from the page alone.\
That ruling supplies its own remedy for the case where an author does NOT want them joined -- "some key-press on a selected anchor to cut a bend into 2 endpoints, then toggle back to a joined path".

This document specifies that key-press: what it toggles, where the value lives, and how it relates to the per-type capability tables already ruled in SD4.

---

## 3. The property

**`transit`** -- does what arrives at this anchor pass through it, or stop.

It is carried by the `routable` pack, per layer:
```
routable.links.transit     do links pass through this anchor
routable.flows.transit     do flows pass through this anchor
```

One verb, qualified by the layer it applies to.\
The layers are named by their plurals -- `pipes`, `links`, `flows` -- because the corpus already uses those words 36, 243 and 35 times against 2, 3 and 2 for conduit, cable and traffic, which appear only as glosses.\
A gloss explains; it should not also name.

`pipes` has no `transit`: an anchor IS a pipe endpoint, and nothing passes through a pipe.

---

## 4. Roles are derived, never configured

`endpoint`, `bend` and `junction` are not settings.\
They fall out of two things the page already holds: how many links terminate at the anchor, and whether transit is on.

| links at the anchor | `links.transit: true` | `links.transit: false` |
|---|---|---|
| 1 | endpoint | endpoint |
| 2, agreeing, same plane | **bend** -- one continuous path | **2 endpoints** |
| 2, opposing or planes differ | junction | 2 endpoints |
| 3 or more | **junction** -- all connected | **3+ endpoints**, drawn with a larger ring |

The first column is today's matrix (`docs/spec/ATOMICS.md:272-275`), unchanged.\
The second column is what the toggle adds.

**The uniformity is the point.**\
One property behaves the same way at every arity: transit off means what arrives stops.\
An earlier draft of this proposal claimed a bend could be toggled and a junction could not, on the reasoning that an author never chooses a junction -- they draw a third link and it is one.\
The director corrected it: turning transit off at a three-link anchor does not REFUSE the third link, it lands and terminates.\
Nothing is refused, both pages are legal, and the special case disappears.

---

## 5. Two places the value lives, one rule that reads them

|  | the type's table | the anchor's setting |
|---|---|---|
| scope | per device TYPE | per ANCHOR |
| set by | the pack author, once | the document author |
| lives in | `network/`, as code (H17 cut K6) | the stored document |
| ruled by | SD4 | the 2026-09-28 transit ruling, if made |
| nature | a PERMISSION: which values are offered | a CHOICE within what is offered |

**The table is a permission, not a default** (director, 2026-09-28).\
It states which values of `transit` a type offers.\
An author may choose among them and may never choose outside them.\
So an author's setting can only ever be as restrictive as the type allows, never more permissive -- which preserves what a type MEANS.\
A router's centre ring stays honest because no author can make a host behave like one.

The same path is used in both places, so a reader who learns it knows both:
```
# in the pack, per type -- the permitted values
routable.links.transit: [true, false]

# in the document, per anchor -- the author's choice
routable.links.transit: false
```

The derivation reads the anchor's setting when present and the type's default-permitted value otherwise, and the planner refuses a setting the table does not offer.

---

## 6. The table, worked

Against the six types the product ships (`kernel/theme.mjs:GLYPH_BB`) plus the bare anchor.\
**These contents are the proposer's reading and are not ruled.**\
They are here to show the shape.

| type | `links.transit` | `flows.transit` |
|---|---|---|
| bare anchor (today's waypoint) | `[true, false]` | `[true, false]` |
| router | `[true, false]` | `[true]` |
| firewall | `[true, false]` | `[true, false]` |
| vxlan | `[true, false]` | `[true]` |
| loadbalancer | `[false]` | `[true, false]` |
| server | `[false]` | `[false]` |
| host | `[false]` | `[false]` |

`vxlan` is the row worth reading twice: it offers a choice about links and none about flows, which is the evidence that the two columns are genuinely independent rather than one column written out twice.

---

## 7. What was considered and dropped

**A count column** (`ends`, `terminating`, `acceptsMany`) -- how many links may terminate here.\
Dropped for three reasons.\
No device was found that permits two terminations and forbids three.\
It read badly in four separate namings, which is usually a sign the concept is not real rather than that the naming is hard.\
And once transit is uniform at every arity, nothing needs refusing, so the column has no consumer.

The cost of being wrong is ASYMMETRIC and that is why it is safe to leave out: the table is code in `network/`, not stored data, so adding a column later is one module plus its reader, with no migration and no format batch.\
SD4 already names a new column as the ruled extension mechanism.\
Removing a column that rulings have been built on is the expensive direction.

**Separate packs per layer** -- `cabling` and `traffic` as two packs.\
Dropped: they are the same capability seen at two layers, and no device was found that forwards links while blocking flows in a way that would need separate composition.\
Two columns in one pack is the smaller claim, and SD4's own cost note names columns as how a pack grows.

**Two verbs** -- `forwarding` for links and `transit` for flows.\
Dropped at the director's instruction: two words for one idea, differing only in what they apply to, forces a reader to hold a translation table.\
One verb, qualified by position.

---

## 8. Open -- not settled by this document

1. **The keybind.** Which key toggles transit on a selected anchor. Free plain letters today: `a b d g h i j m n o p u v x y` (`app/src/keymap.js`).
2. **Absent or explicit.** Whether `transit` is stored only when the author sets it, as `flow` and `control` are, with absent meaning the type's permitted default. The proposer's reading is yes, for consistency with every other optional declaration.
3. **Where the field sits against SD11b.** SD11b puts the core anchor at identity and position only, with everything else in the network plugin. `transit` belongs to the plugin, not the core -- proposer's reading, not ruled.
4. **The format batch.** This is a stored-format change, so under survey F6 it lands as part of the ONE named batch, last, after the behaviour is proven.
5. **The larger ring.** The director named a larger ring for a non-transiting junction. Its appearance is a derived state and is unspecified here; it belongs with the appearance pipeline (H15.9).
6. **SD5 is untouched.** Whether an act that would make a device take a forbidden role is refused or cut stays held behind the id-prefix one-way door. This proposal needs no refusal machinery, which is why it does not disturb that hold.
7. **The table's contents.** Section 6 is illustrative. Each row is a decision the director has not made.

---

## 9. What this would amend

- **SD6** ruled a per-type yes/no column for whether a flow may pass through a device. This does not change that rule; it renames the column to `routable.flows.transit` so it sits beside its link-layer sibling under one verb. Naming only, but it is an amendment to a ruling eight days old and is flagged as one rather than folded in silently.
- **The 2026-09-26 ruling** that two separately drawn links left alone at a point join into one (`:593`) is CONFIRMED, not overturned. It is the page-derived answer, and `transit: false` is how an author departs from it deliberately.
- **Nothing in the 2026-09-28 no-history ruling changes.** This is the gesture that ruling called for.
