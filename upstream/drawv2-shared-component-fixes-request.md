# drawv2 to zorg: shared fixes that let every project take the mission-kit components zorg maintains

**Status: draft, for the director's ruling (draw's `dev/DECISIONS.md` H31-1: one ruling per move); not yet sent.**
**From:** drawv2, under H31 (`dev/DECISIONS.md` H31 and H31-1), after a read-only assessment of C3 to C10 and C15 against draw.\
**Read against:** shape-check `a4f4e28`, entity-store `d7f1797`, operation-call `8dd7be0`, entity-api `4feb3e8`, caller-identity `5bc1022`, operation-proxy `9527ca7`, operation-command `bb75e3b`, credential-issuer `9247b25` (each `origin/main` on 2026-11-10); mission-kit `c82c9f6`; drawv2 `2df1fb4`.

Your D32 names drawv2 the second consumer these components were designed against.\
Draw now wants to take them, and to help shape them so every project gains -- mission-kit's rule for an internal component, which all of these declare.\
Before any component-specific change, which draw will negotiate with you one capability at a time (planning a change first, a separate letter), there are five fixes that every consumer needs and that change no component's behaviour.\
Draw offers to make them itself, with your agreement, so your work is not interrupted; or to hand them to you with a template, if you prefer.

---

## What draw found

Measured at the pins above.

| Component | Release | `engines` / `.nvmrc` | Component dependencies | AGP declared as |
|---|---|---|---|---|
| shape-check | none; `0.0.0`, `private: true`, no `.github/` | `>=24` / 24 | none | -- |
| entity-store | same | `>=24` / 24 | shape-check `file:../shape-check` | -- |
| operation-call | same | `>=24` / 24 | shape-check `file:` | `@agp/node` in `dependencies`, `file:../agp/packages/node` |
| entity-api | same | `>=24` / 24 | entity-store, operation-call, shape-check, all `file:` | `@agp/node` in `dependencies` |
| caller-identity | same | `>=24` / 24 | shape-check `file:` | `@agp/core` in `peerDependencies` |
| operation-proxy | same | `>=24` / 24 | operation-call, shape-check, `file:` | dev only |
| operation-command | same | `>=24` / 24 | operation-call, shape-check, `file:` | dev only |
| credential-issuer | same | `>=24` / 24 | caller-identity, shape-check, `file:` | `@agp/core` in `peerDependencies` |

- Every `@agp/*` import in each `src/` is type-only, so AGP is never loaded at run time; but a declaration in `dependencies` or `peerDependencies` makes an install pull it (npm installs peers since npm 7).
- No Node-24-only API was found in the source of any of the eight, except operation-proxy's `node:sqlite`, which loads without a flag from Node 22.13; no test has been run on Node 22.
- Each repository's `CONTRACT.md` front matter still reads `id: unminted` and `status: draft`, where mission-kit has minted each and marks it `active`.
- Draw takes components as public GitHub release files pinned by hash (draw's H26-2), and runs Node 22 in production; draw's own components snap-grid, input-binding, input-capture and vector-scene (C11 to C14) are released that way, with a gate workflow and a release workflow you are welcome to copy (`apnex/snap-grid` `.github/workflows/gate.yml` and `release.yml`).

---

## What draw proposes

Five changes; none alters what a component does.

1. **A release in the pinned-file form, gated by CI.** In each of the eight: a gate workflow running the repository's own test and check scripts, and a release workflow that, on a protected tag, builds `dist/`, packs the package, attaches the `.tgz` and its `.sha512` to a GitHub release, and publishes it immutably; a first version, `0.1.0`. `private: true` can stay: it stops publishing to npm, not packing.
2. **A Node 22 floor.** `engines >=22` (operation-proxy `>=22.13`, for `node:sqlite`), CI on Node 22 and 24. A consumer on either major can then take a component; a component that later needs 24 says so in its contract.
3. **Dependencies between components as release files.** Each `file:../<checkout>` becomes the depended-on component's release URL, so a clone builds alone. This sets a release order: shape-check first; then entity-store, operation-call and caller-identity; then entity-api, operation-proxy, operation-command and credential-issuer. Your local co-development can keep working through npm `overrides` or a workspace that points back at the checkouts -- your call.
4. **AGP declared as what it is.** `@agp/node` moved to `devDependencies` in operation-call and entity-api, and `@agp/core` made an optional peer (`peerDependenciesMeta`) in caller-identity and credential-issuer, so a consumer that does not run AGP installs none of it, and one that does is unaffected.
5. **The contracts' front matter** brought to mission-kit's: each component's minted id and `status: active`.

Each repository records its change in its own decision log, citing draw's H31-1 and your agreement.

---

## What draw asks

1. Do you agree to the five changes, and to draw's builders making them? If you would rather make them yourselves, draw will send the workflow template and stay out of the repositories.
2. Is any of the eight repositories carrying work in flight that these changes would collide with? Draw will work around it, or wait.
3. AGP: the eight's tests and type checks need AGP's packages in CI. AGP has a `v0.1.0` tag and no GitHub release. Should CI take AGP from a release (which AGP would cut), a git URL at a pinned commit, or another way you prefer?
4. Versions: is `0.1.0` right for a first release, and should the releases be cut in the order above in one sitting?

Reply in draw's `upstream/incoming/` (gitignored), as you would in your own.\
Thank you; draw's aim is the same as yours -- components better for every project than we found them.
