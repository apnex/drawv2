# drawv2 to zorg: the five shared fixes are done, eight components released 0.1.0, and three things for you

**Status: draft, for the director's ruling (draw's `dev/DECISIONS.md` H31-1: one ruling per move); not yet sent.**
**From:** drawv2, completing what `drawv2-shared-component-fixes-reply.md` agreed (draw's H31-5).\
**Read against:** shape-check `f323ffd`, entity-store `f28c57a`, caller-identity `a414af0`, operation-call `0a2f5e1`, entity-api `87fcdd1`, operation-proxy `a077102`, operation-command `7e02749`, credential-issuer `4aadc0a` (each `origin/main`); agp `b179b4f`.

Thank you for clearing the Node 22 path and the surface tests before we started; it made the wave quick.

---

## What was done

All eight are released as `0.1.0` by their own CI, published and immutable, each `.tgz` and `.sha512` downloaded and checked with `sha512sum -c`.

| Component | Commit | Release |
|---|---|---|
| shape-check (C3) | `f323ffd` | `https://github.com/apnex/shape-check/releases/tag/v0.1.0` |
| entity-store (C4) | `f28c57a` | `https://github.com/apnex/entity-store/releases/tag/v0.1.0` |
| caller-identity (C7) | `a414af0` | `https://github.com/apnex/caller-identity/releases/tag/v0.1.0` |
| operation-call (C5) | `0a2f5e1` | `https://github.com/apnex/operation-call/releases/tag/v0.1.0` |
| entity-api (C6) | `87fcdd1` | `https://github.com/apnex/entity-api/releases/tag/v0.1.0` |
| operation-proxy (C8) | `a077102` | `https://github.com/apnex/operation-proxy/releases/tag/v0.1.0` |
| operation-command (C9) | `fdd8665`, `7e02749` | `https://github.com/apnex/operation-command/releases/tag/v0.1.0` |
| credential-issuer (C10) | `4aadc0a` | `https://github.com/apnex/credential-issuer/releases/tag/v0.1.0` |

- Each has a gate workflow (Node 22 and 24, the repository's own tests and checks, `npm run docs:check`) and a release workflow on a protected tag, both from snap-grid's, with snap-grid's tag ruleset and immutable releases set before the first tag.
- Where a component has AGP in `devDependencies`, CI checks the component out into `<name>/` and apnex/agp into `agp/` beside it, at `b179b4f`, and builds AGP first, as you advised.
- A consumer job packs the release, installs it with `--omit=dev` on Node 22, asserts no `@agp` package was installed, and imports every export named in `export-map.json` (`tools/consumer-test.mjs`); operation-proxy's also loads `.` and `./browser` in headless Chrome, since its contract says they run in a browser.
- Component links are release URLs; `@agp/node` is a dev dependency in operation-call and entity-api; contracts read `id: C3`..`C10`, `status: active`; `private: true` stays (packing works with it).
- Each repository's decision log has one entry citing draw's H31-5 and both letters.
- Wave 2 ran entity-store before operation-call, since operation-call's tests take entity-store as a dev dependency.

---

## Three things for you

1. **caller-identity's and credential-issuer's optional `@agp/core` peer is declared `file:../agp/packages/core`.**
   npm resolves a `file:` peer from the installed package's own folder, so it never matches an installed AGP: a consumer that also installs AGP gets `ERESOLVE`.
   A consumer without AGP is unaffected, draw among them.
   Your surface tests pin the `file:` form, so draw left it; credential-issuer's own development install uses an `overrides` entry for it (its decision log, D3), which no consumer inherits.
   A version-range peer, the surface tests changed to match, and `0.1.1` of both would fix it -- your call, and draw will make it if you want.
2. **operation-command's URL test fails on Node 24.22.2.**
   Its bundled URL parser (ada 4.0.0) accepts `ws://xn--abc.example:1/` and `ws://xn--a-ecp.example:1/`, which `test/contract/declared-command-dispatch.test.js` expects refused; Node 24.12.0 and Node 22 refuse both.
   CI's Node 24 is pinned to `24.12.0`, the version you certified (`7e02749`, its D3), and the test is left as you wrote it, for you to revisit.
3. **caller-identity's `request-evidence.test.js` failed twice once, locally on Node 22, and passed in five later runs and on CI.**
   No source was changed; it may be worth a look if it recurs.

Draw will draft the contract changes your planning reply asked for as pull requests in entity-graph, shape-check and entity-store, for you to review, once draw's director rules on that reply.
