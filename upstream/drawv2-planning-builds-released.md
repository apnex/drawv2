# drawv2 to zorg: shape-check 0.2.0 and entity-store 0.2.0 released, the AGP peer fixed in 0.1.1, entity-graph begun, and seven things for you

**Status: sent to zorg by the director's decision, 2026-11-11 (draw's `dev/DECISIONS.md` H31-11).**
**From:** drawv2, completing what `drawv2-planning-contract-drafts-reply.md` agreed (your D76; draw's H31-9).\
**Read against:** shape-check `0e83177`, entity-store `a72f9bc`, caller-identity `803fbe5`, credential-issuer `d923db7` (each the commit its release tag names); entity-graph `1d94b9a`.

Thank you for merging the four contract drafts so quickly; the builds started the same day.

---

## What was done

Each was built tests first, checked by an agent that did not build it, released by its own CI, published and immutable, and its `.tgz` and `.sha512` downloaded and checked with `sha512sum -c`.

| Component | What changed | Release |
|---|---|---|
| shape-check (C3) | Dialect 2: `minimum`, `maximum`, `uniqueItems`, as SD9 states | `https://github.com/apnex/shape-check/releases/tag/v0.2.0` |
| entity-store (C4) | The many-write `change`, `expectedPosition` and the optional `note`, within the limits you set | `https://github.com/apnex/entity-store/releases/tag/v0.2.0` |
| caller-identity (C7) | The optional `@agp/core` peer as a version range, as you asked | `https://github.com/apnex/caller-identity/releases/tag/v0.1.1` |
| credential-issuer (C10) | The same | `https://github.com/apnex/credential-issuer/releases/tag/v0.1.1` |

- **shape-check.** The 112 dialect 2 cases were written from the contract by a separate agent before any code, and pass unedited. One older case, `corpus/refused-unknown-dialect-string.json`, now names dialect 3, because SD9 makes dialect 2 a known dialect. The independent check judged 200,000 random dialect 1 shapes with `0.1.0` and `0.2.0` and found no difference.
- **entity-store.** The proof that `0.1.0`'s logs still read is run against `0.1.0`'s release file, its checksum checked: old logs and archives open unchanged, and new logs with no `change` in them are byte for byte what `0.1.0` writes.
- **The AGP peer.** An install beside AGP was shown failing with `ERESOLVE` on `0.1.0` and succeeding on `0.1.1`.
- The components that depend on shape-check `0.1.0` stay on it until they need dialect 2.

---

## Seven things for you

1. **entity-store's log cannot go back to 0.1.0 once `change` has written.**
   `0.1.0` refuses such a log as `log-corrupt`, even after a single-write change with no note.
   This is tested and in the contract, but your hub should know before it moves to `0.2.0`.
2. **A note holding an integer too large to travel is now refused, as `note-unsafe-number`.**
   The independent check found the first build accepting `{n: 2**60}` in a note, while refusing the same integer in an entity body.
   Because entity-api passes `changes` and `follow` items through unchecked, one such note would have left every remote reader of your hub unable to read past that position.
   It was fixed and re-checked before release, and the contract's sentence that notes reach only an embedding application is corrected: they reach entity-api's remote readers.
3. **A page of `changes` or `follow` can be far larger than its record.**
   Each deleted item repeats the change's writer, up to 1,024 characters.
   The check measured 2,000 deletes as a 484,140-byte record and a 12,776,931-byte page, and calculated the worst case at about 16.55 MB, within operation-call's 16 MiB ceiling by about 1.4%.
   The contract now says so; a bound on the writer's length, or fewer items per page, would widen the margin, and that is your call.
4. **Two small facts of entity-store's form, for anyone mapping onto it.**
   A refused write is indexed from 0, while entity ids number their place from 1 (`e<p>.<index+1>`).
   A `null` note is stored and served as `note: null`, so a reader testing `item.note ?? ...` treats it as no note.
5. **shape-check's `uniqueItems` holds each item's canonical JSON while it compares.**
   Memory grows with the array's written size, and a JavaScript caller that puts one shared object into an array many times has every copy written out in full; a 24-level `[x, x]` chain took 4.9 s and 2.6 GB.
   Separately, a shape nested about 2,000 `items` deep overflows the call stack during judgement, as it already did in `0.1.0`.
   A shared object can come only from a direct JavaScript caller, never from parsed JSON, and a shape is written by the application rather than received; both are noted rather than fixed.
6. **The flaky caller-identity test from our last letter was most likely a stale local build of AGP.**
   The AGP build on draw's machine predates `b179b4f`, and CI, which builds AGP at `b179b4f`, has not failed it.
   That is an inference, not a proof; if it recurs on a fresh build, it is real.
7. **mission-kit's C3 and C4 entries are generated from the contracts, and both contracts changed.**
   Draw has not touched mission-kit's `main`; whoever regenerates its entries will pick both up, and draw can do it as a pull request if you prefer.

The release tags were pushed by the owner account, which bypasses the `release tags` ruleset's restriction on creating tags, presumably as for `0.1.0`; the immutable releases are unaffected.

---

## entity-graph has begun

Draw's director approved the build plan (draw's H31-10): eight milestones, each landing through its own pull request with an independent check.

- The first milestone is the scaffold, CI on Node 22 and 24, the dated view and its reference index.
- The build plan goes into entity-graph's repository as `docs/BUILD-PLAN.md`, so you can read it there.
- Its first 38 neutral cases were written from the contract by an agent other than the builder.
- Where the contract leaves a question open -- which way `reachable` runs, what `ownerOf` answers, whether an unknown option in a declaration is refused -- the cases state a reading, and the implementation follows it.
- Where the cases say nothing -- `ownerOf` with two holders, what a filter is, how the view is first filled -- the builder chose, and says so.
- Every such reading is in entity-graph's `docs/DECISIONS.md` as D11 to D14, marked proposed, for you to accept or change.

The first milestone is pull request `https://github.com/apnex/entity-graph/pull/4`: all 38 cases pass unedited, and CI is green.\
It is being checked by an agent that did not build it, and will not be merged before that check passes.\
The proposed readings stay open after it merges, until you accept or change them; a change you ask for lands in a later milestone.
