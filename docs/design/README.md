# docs/design/ -- pre-kernel exploration sandbox (mostly DEFUNCT / historical)

This is the geometry **exploration** the sovereign `kernel/` graduated from.\
With the `client/` editor retired (CL5), the pre-kernel sandbox tooling here is **non-runnable**: the `sim/`, `walk/`, `build.mjs`, and `preview.mjs` scripts read the now-deleted `client/style.css` and `client/index.html` (glyph `<defs>`) at load and throw `ENOENT`.\
They are historical lineage only -- **superseded by `kernel/`**; the CSS + glyph artwork they needed are vendored in `kernel/theme.mjs` (`KERNEL_CSS`) and the kernel's `sharedDefs()`.

**Live tools that DO work here:**
- `docs/design/view.mjs` -- the kernel spec/reference viewer (`node docs/design/view.mjs` -> `kernel/out/spec.{html,png}`),
moved here in CL6.\
Imports `kernel/` + `docs/design/shot.mjs`; no `client/` dependency.
- `docs/design/shot.mjs` -- the headless screenshot helper.

Recorded cleanliness gap (see `../docs/spec/CLEANLINESS.md` -> Known gaps): the sandbox's `client/`-asset reads are left non-runnable rather than resurrected (superseded tooling -- repoint to `kernel/theme.mjs` only if the historical sandbox is ever needed again).\
New geometry work goes in `kernel/`.
