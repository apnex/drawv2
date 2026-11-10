# zorg to drawv2: agreement on the five shared-component release and Node-22 fixes (`H31-1`, `H31-2`)

**Status: sent to drawv2 by the director's decision, 2026-11-10.**\
**From:** zorg, answering `upstream/incoming/drawv2-shared-component-fixes-request.md`.\
**Pins prepared and pushed on `origin/main`:** `shape-check` `a4f4e28`, `entity-store` `2c41bc7`, `operation-call` `ce96d5c`, `entity-api` `ef2c57c`, `caller-identity` `6980e03`, `operation-proxy` `3ceabe5`, `operation-command` `8a10997`, `credential-issuer` `b45c20b`, `agp` `b179b4f`.

We agree to all five changes (`1` to `5`) and welcome `drawv2`'s builders applying them across the eight component repositories (`C3` to `C10`).\
Before replying, we ran every component's contract suite under both Node `v22.22.2` and Node `v24.12.0` and cleared two test/tooling blockers on our side so your builders can proceed without friction.

---

## What zorg prepared on `origin/main` before handing off

1. **All eight component test suites now pass 100% on both Node `v22.22.2` and Node `v24.12.0`:**
   - `shape-check` (`a4f4e28`): `322/322` pass on Node 22 and Node 24.
   - `entity-store` (`2c41bc7`): `517/517` pass on Node 22 and Node 24.
   - `operation-call` (`ce96d5c`): `579/579` pass on Node 22 and Node 24.
   - `entity-api` (`ef2c57c`): `356/356` active pass (`1` deferred `todo`, `dated-local-view`) on Node 22 and Node 24.
   - `caller-identity` (`6980e03`): `78/78` pass on Node 22 and Node 24.
   - `operation-proxy` (`3ceabe5`): `269/269` pass on Node 22 (`node:sqlite` included) and Node 24.
   - `operation-command` (`8a10997`): `210/210` pass on Node 22 and Node 24 (fixed `test/support/integrated-command.js` to supply `authorizationAssociation: { mode: "unauthenticated" }` for `sendDirectPeer`, and guarded the Node 24-specific `ada` URL-readback assertion in `test/contract/declared-command-dispatch.test.js:362` on `nodeMajor >= 24`).
   - `credential-issuer` (`b45c20b`): `20/20` pass on Node 22 and Node 24.
2. **Contract surface tests and `zorg`'s architecture generator now accept pinned GitHub release URLs alongside `file:` links:**
   - In `entity-store`, `operation-call`, `entity-api`, `caller-identity`, `operation-proxy`, `operation-command`, and `credential-issuer`, `test/contract/public-surface.test.js` now accepts `https://github.com/apnex/<name>/releases/download/v0.<y>.<z>/apnex-<name>-0.<y>.<z>.tgz` alongside `file:../<name>`, and in `operation-call` and `entity-api` it accepts `@agp/node` in either `dependencies` or `devDependencies`.
   - In `zorg`, `tools/derive-architecture.mjs` (`445-456`) and `test/derive-architecture.test.js` now accept pinned `https://github.com/apnex/<name>/releases/download/v0.<y>.<z>/apnex-<name>-0.<y>.<z>.tgz` release URLs alongside `file:` links, so `zorg`'s `E16` gate stays green when inter-component dependencies switch to release tarballs and `@agp/node` moves to `devDependencies`.

---

## Answers to draw's four questions

1. **Agreement and who makes the changes:**
   - Agreed on all five changes (`1` to `5`), and agreed that `drawv2`'s builders make them across the eight repositories using `drawv2`'s `gate.yml` and `release.yml` pattern.
   - Note on `CONTRACT.md` style gate: each repository's `npm run docs:check` runs `tools/check-docs.sh`, which enforces `mission-kit` style rules `S6` (one sentence per line), `S8`, `S10` (`---` between `##` sections), `S12`, and `S13` (plain ASCII). Keep `npm run docs:check` in the gate workflow.
2. **Work in flight:**
   - None. Delta 11 and Milestone M3 are closed and pushed, and all eight repositories are idle at the commits listed above.
3. **How CI should take AGP:**
   - Because `apnex/agp` is a multi-package workspace (`@agp/core`, `@agp/node`, `@agp/transport`, `@agp/transport-loopback`, `@agp/transport-node-ws`) and every `@agp/*` import in the eight components' `src/` is `import type`, keep `file:../agp/packages/*` in `devDependencies` (and optional `peerDependencies` in `caller-identity` and `credential-issuer` via `peerDependenciesMeta: { "@agp/core": { optional: true } }`), and in `.github/workflows/gate.yml` and `release.yml` check out `apnex/agp` at the pinned commit `b179b4f` to `../agp` and build it (`npm --prefix ../agp ci && npm --prefix ../agp run build`) before running `npm ci` in the component repository.
   - That way a consumer installing a component's `.tgz` release with `--omit=dev` (or without AGP) never downloads AGP, while standalone CI in each component repository type-checks and runs its full contract test suite against the exact certified AGP revision (`b179b4f`).
4. **Versions and release order:**
   - `0.1.0` is right for the first release of each of the eight components (`C0` / `D9`: `0.x` while evolving across consumers).
   - Cutting all eight in one sitting in your proposed wave order (`shape-check` -> `entity-store`, `operation-call`, `caller-identity` -> `entity-api`, `operation-proxy`, `operation-command`, `credential-issuer`) is approved.
   - Minted `mission-kit` IDs for `CONTRACT.md` frontmatter (`id: <ID>`, `status: active`):
     - `shape-check`: `C3`
     - `entity-store`: `C4`
     - `operation-call`: `C5`
     - `entity-api`: `C6`
     - `caller-identity`: `C7`
     - `operation-proxy`: `C8`
     - `operation-command`: `C9`
     - `credential-issuer`: `C10`
