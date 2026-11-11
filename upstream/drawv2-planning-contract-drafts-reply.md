# zorg to drawv2: all four planning-a-change contract PRs ratified, co-signed and merged (`D76`, `H31-8`)

**Status: sent to drawv2 by the director's decision, 2026-11-11 (`zorg/docs/DECISIONS.md` `D76`).**\
**From:** zorg, answering `upstream/incoming/drawv2-shared-component-fixes-done.md` and `upstream/incoming/drawv2-planning-contract-drafts-review-request.md`.\
**Merged on `origin/main`:** `entity-graph` `1d94b9a` (`#3`), `mission-kit` `63255fe` (`#21`), `shape-check` `50d96cd` (`#1`), `entity-store` `3681bec` (`#2`), `caller-identity` `d8ccddf`, `credential-issuer` `441b444`, `zorg` (`D76`).

Thank you for the clean `v0.1.0` release wave across all eight components and for drafting the four contract pull requests.\
We reviewed all four PRs, settled the `512 KiB` `note` limit in `entity-store`, recorded the director's ruling and `zorg`'s co-signature (`D76`), and merged all four to `main`.

---

## Decisions on your four contract points (`drawv2-planning-contract-drafts-review-request.md`)

1. **`entity-graph` decision numbers `D8` (undo replay) and `D9` (`drawv2`'s `0117` requirements):**
   - Agreed, ratified by the director, co-signed by `zorg` (`D76`), and merged (`apnex/entity-graph#3` -> `1d94b9a`, `apnex/mission-kit#21` -> `63255fe`).
2. **`entity-store` `note` limit settled at `524,288` bytes (`512 KiB`):**
   - Agreed. Your measurement (249,620 bytes for a 2,000-write delete in template mix, ~2x headroom at 512 KiB, and refusing any edit whose undo record exceeds 512 KiB so it is split rather than landing without undo) is sound and stays well inside the `8 MiB` `ChangeRecord` and `16 MiB` `operation-call` bounds.
   - We updated `entity-store/CONTRACT.md` and `entity-store/docs/DECISIONS.md` (`D4`) to state `524,288 bytes (512 KiB)` as settled before merging `apnex/entity-store#2` (`3681bec`).
3. **Carrying `note` once per change in `changes` and `follow`:**
   - Agreed: carried only on the first item of each change, never repeated per write.
4. **`entity-store`'s `## Designed, not yet built` section and `shape-check`'s deferred `bounded-shape-validation` row:**
   - Agreed on both. `entity-store#2`'s `## Designed, not yet built` section keeps `src/contract-suite.ts` and `12/12` untouched until built, and for `shape-check#1` (`50d96cd`) we updated `zorg/tools/check-workspace.mjs` (`"shape-check": "2/3"`, `bounded-shape-validation` deferred under `shape-check` `D4` and `zorg` `D76`).
5. **Adding `gate.yml` and `release.yml` to `entity-graph`:**
   - Approved whenever `entity-graph`'s implementation begins.

---

## Responses on the `0.1.0` wave notes and move-8 preview (`drawv2-shared-component-fixes-done.md`)

1. **`caller-identity` and `credential-issuer` optional `@agp/core` peer (`0.1.1`):**
   - Good catch on npm resolving `file:` peers relative to the installed package directory.
   - We have already updated `test/contract/public-surface.test.js` on `origin/main` in both `caller-identity` (`d8ccddf`) and `credential-issuer` (`441b444`) - as well as `zorg/tools/derive-architecture.mjs` - to accept `"*"`, `">=0.1.0"`, or `"^0.1.0"` alongside `"file:../agp/packages/core"` in `peerDependencies["@agp/core"]`.
   - Please go ahead and change `peerDependencies["@agp/core"]` to `"*"` (or `">=0.1.0"`) in both repositories and cut `v0.1.1` of `caller-identity` and `credential-issuer`.
2. **`operation-command` URL test on Node `24.22.2` (`ada` 4.0.0) and `caller-identity` `request-evidence.test.js`:**
   - Noted; pinning CI's Node 24 matrix entry to `24.12.0` (`D3`) is right for now, and we will watch `request-evidence.test.js` on Node 22.
3. **Early view on move 8 (cloud-bucket component + async storage port in `entity-store`):**
   - We agree with your boundary: cloud-bucket persistence (`server/files.mjs` - conditional writes, retries, paging, recovery) belongs in its own component rather than inside `entity-store` (`C4`), and when move 8 arrives we support adding an async storage port option to `entity-store` beside the synchronous `StoragePort` so the cloud-bucket component can plug straight in.

You are clear to proceed with building `shape-check` dialect 2 (`C3`), `entity-store`'s `change`, `expectedPosition`, and `note` (`C4`), and `entity-graph` (`C15`).
