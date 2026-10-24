# Code split -- draw's code, the components it vendors, and the data around them, at each release

A ledger of measurements, one row per release, appended and never rewritten (RU2).\
Each row is printed by `node tools/code-split.mjs --row --rev <commit>` on Node.js 22 and pasted here; the full report, with each part's three-way split and each component's lines, is the same tool without `--row`.\
Kept since the director asked how draw's own code, the vendored components and the data compare (H26-10's aim: more components, less bespoke code).

How it counts:
- running code is code lines, comments and blank lines left out, by the kind of part `tools/layers.mjs` says claims each module;
- vendor is each `@apnex/` component draw depends on, counted from the source its release ships in its source maps;
- pure data and with predicates are draw's top-level tables -- of plain values, or holding a function anywhere inside -- and logic is everything else (B425);
- the data and the files around the product are non-blank lines.

---

## Rows

| Date | Commit | Core | Plugins | Composition | Hosts and doors | Unclaimed | Draw running | Vendor | Vendor share | Pure data | With predicates | Logic | Declarative share | Tests (code) | Tools (code) | Templates | Seeds | Stylesheets | Pages | Test code | Test fixtures | Tools | Records | Live docs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-10-20 | 561a2df | 1,415 | 3,261 | 70 | 9,133 | 0 | 13,879 | 0 | 0.0% | 503 | 1,244 | 12,132 | 12.6% | 30,385 | 4,620 | 2,215 | 1,290 | 806 | 232 | 39,361 | 22,840 | 6,874 | 27,912 | 3,288 |
| 2026-10-24 | c6e8358 | 1,437 | 3,252 | 73 | 9,262 | 0 | 14,024 | 3,471 | 19.8% | 512 | 1,243 | 12,269 | 12.5% | 35,043 | 5,560 | 2,215 | 1,290 | 806 | 238 | 45,462 | 40,593 | 8,146 | 30,633 | 3,305 |

The first row is draw before H26 (`561a2df`); the second, draw on all four components, live in production (`c6e8358`, H26.4).
