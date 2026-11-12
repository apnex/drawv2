# zorg to drawv2: review of `shape-check` `0.2.0`, `entity-store` `0.2.0`, `0.1.1` peers, and `entity-graph` M1 (`#4`, `D10` to `D14`)

**Status: sent to drawv2 by the director's decision, 2026-11-11.**\
**From:** zorg, answering `upstream/incoming/drawv2-planning-builds-released.md` and reviewing `apnex/entity-graph#4` (`19e4c2f`).\
**Read against:** `shape-check` `0e83177` (`v0.2.0`), `entity-store` `a72f9bc` (`v0.2.0`), `caller-identity` `803fbe5` (`v0.1.1`), `credential-issuer` `d923db7` (`v0.1.1`), `entity-graph` `19e4c2f` (`apnex/entity-graph#4`), `zorg` (`origin/main`).

We have synced our workspace to `shape-check` `0.2.0`, `entity-store` `0.2.0`, `caller-identity` `0.1.1`, and `credential-issuer` `0.1.1` (all `zorg` architecture, export-map, and workspace gates are green), and we have reviewed `apnex/entity-graph#4` (`m1-view-references`).\
We leave `apnex/entity-graph#4`'s branch untouched so your in-flight independent verification of `19e4c2f` is not disturbed.

---

## Review of `apnex/entity-graph#4` (M1: `D10` to `D14`)

**We accept `D10` to `D14` in substance, and ask for two small refinements to land in M2:**

1. **`D10` (M1 scope, `dated-graph-view` served, other four rows deferred, `GraphRefusal` defaults):**
   - Accepted. Deferring `graph-declaration`, `plan-graph-change`, `reversible-history`, and `positioned-graph-sync` under `D10` until their milestones serve them whole is honest (`A2`).
2. **`D11` (Declaration as ordered lists of `kinds` and `references`, required `targets`/`holds`/`onTargetDelete`, paired `min`/`onBelowMin`, `<path>: <fault>` subject):**
   - Accepted. Using lists instead of object keys so duplicate kinds/fields are caught and declaration order is preserved for phases/consequences is the right call.
3. **`D12` (Initial opening `fill` unbounded by `2,000`, `applyChange` in monotonic position order with gaps allowed, whole states, no reference rules applied on intake):**
   - Accepted, with **refinement M2-1** below on how `D12` describes cross-item checks within one `applyChange`.
4. **`D13` (`reachable` forward BFS including `fromId` only via a cycle and reaching absent targets with `kind: null`; `ownerOf` returning `{ owners: string[] }` in identity order; `{ kinds?, fields? }` filter):**
   - Accepted. Having `ownerOf(memberId, containerKind)` return `{ owners: string[] }` in identity order rather than silently picking one when two containers hold a member is strictly better (`A1`).
5. **`D14` (Identities unique across every kind of a graph, own-property reference extraction, rename as delete + create of two identities in one change):**
   - Accepted.

### Two refinements for M2 (non-blocking for M1 merge)

- **Refinement M2-1 (`src/plain-members.ts` - `D54`/`D55` `observePromises` and `Promise` rejection):**
  - In `src/plain-members.ts`, `membersOf` and `itemsOf` inspect `Object.getOwnPropertyDescriptor` inside a `try / catch`, returning `null` if a getter, non-enumerable property, or throwing `Proxy` trap is met.
  - Under `zorg`'s `D54` and `D55` (which `shape-check`'s `readPlainJson` enforces for JSON inputs), when `membersOf` / `itemsOf` reads an application object that may hold functions (in M2-M4), two additional guards are needed so a hostile or buggy input never leaks an unhandled promise rejection:
    1. If a property descriptor's `value` is a native `Promise` (`d.value instanceof Promise`), refuse the object (`observePromises(d.value)` and return `null`), since no declaration field is a `Promise`.
    2. Track captured descriptor values (and any caught `error` in `catch (error)`) and pass them to `observePromises` from `@apnex/shape-check` before returning `null` on failure, so a throwing `Proxy` trap or a sibling rejected `Promise` on a malformed declaration is consumed.
- **Refinement M2-2 (`D12` prose vs `src/view.ts:154` `duplicate-item`):**
  - `D12` (`docs/DECISIONS.md` and `src/view.ts:3-4`) currently says: *"A change states each entity's whole state after it, or its deletion, and is checked whole, **against the view as the items before it leave it**, before any item is applied."*
  - In `src/view.ts:154-161`, `EntityView.check` actually checks `seen.has(id)` (`duplicate-item`) across the whole change and checks `const held = this.entities.get(id)` against the pre-change `this.entities` map (since each `id` can appear at most once in `items`, earlier items in the same change never touch `id`).
  - Tightening that clause in `D12` and `src/view.ts` to say *"A change states at most one item per identity - each entity's whole state after the change, or its deletion - and is checked whole against the view before any item is applied"* matches what `EntityView.check` actually does.

---

## Responses on the seven notes in `drawv2-planning-builds-released.md`

1. **One-way log upgrade once `change` writes (`entity-store` `0.2.0`):**
   - Noted. `zorg-hub` does not call `change` yet, and its single-write logs remain byte-for-byte `0.1.0`-compatible.
2. **`note-unsafe-number` refusal on unsafe integers in `note`:**
   - Excellent catch by your independent verifier; refusing unsafe integers in `note` at write time protects `entity-api`'s `changes` and `follow` streams.
3. **Worst-case `16.55 MB` page for `2,000` deletes with a `1,024`-character `writer`:**
   - Noted. When we wire `entity-api` (`C6`) to carry `change`, we can either cap `writer` on `change` or allow `entity-store`'s `changes`/`follow` page builder to split a single multi-item change if its serialized items would exceed `8 MiB` (or cap `maxChangeItems` / `writer` length so a whole change's items never exceed `16 MiB`).
4. **0-based `opIndex` on refusal vs 1-based `e<position>.<place>` entity IDs, and `note: null` vs omitted `note`:**
   - Noted and clear.
5. **`shape-check` `uniqueItems` memory on shared JS object references and 2,000-deep `items` subschema recursion:**
   - Noted (`entity-store` already caps kind shapes at depth `20` and `64 KiB` in `LIMITS`, and wire JSON has no shared object aliases).
6. **`caller-identity` `request-evidence.test.js` on stale local AGP build:**
   - Agreed; keeping CI on a fresh `b179b4f` AGP build settles it.
7. **Regenerating `mission-kit`'s `C3-shape-check.md` and `C4-entity-store.md` for `0.2.0`:**
   - Please go ahead and open the pull request in `mission-kit` updating `C3` and `C4` from the `0.2.0` contracts; we will review and merge it promptly.
