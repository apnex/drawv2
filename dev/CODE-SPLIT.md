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
| 2026-10-25 | ca492da | 1,437 | 3,252 | 73 | 9,287 | 0 | 14,049 | 3,910 | 21.8% | 512 | 1,243 | 12,294 | 12.5% | 35,533 | 5,861 | 2,215 | 1,290 | 806 | 238 | 46,022 | 39,411 | 8,529 | 31,244 | 3,305 |

The first row is draw before H26 (`561a2df`); the second, draw on all four components, live in production (`c6e8358`, H26.4); the third, draw on the three `0.2.0` releases, live in production (`ca492da`, H26.5), the baseline of H26.8.

---

## By part

`node tools/code-split.mjs --parts --rev <commit>` gives each part `tools/layers.mjs` declares, its modules' code lines and their three-way split.\
A table is kept here at each baseline a change is measured from, and again when the change closes, so a duty moved between parts, or out of draw into a component, shows as figures (H26-16).

### H26.8's baseline -- `ca492da`, 2026-10-25, in production

| Part | Kind | Modules | Code lines | Pure data | With predicates | Logic | Declarative share |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lattice | core | 4 | 156 | 22 | 0 | 134 | 14.1% |
| kind-contract | core | 2 | 121 | 17 | 0 | 104 | 14.0% |
| document | core | 5 | 210 | 1 | 0 | 209 | 0.5% |
| relations | core | 3 | 106 | 0 | 0 | 106 | 0.0% |
| colours | core | 2 | 87 | 71 | 0 | 16 | 81.6% |
| primitives | core | 1 | 28 | 0 | 0 | 28 | 0.0% |
| rules | core | 1 | 55 | 10 | 0 | 45 | 18.2% |
| planner | core | 5 | 674 | 5 | 22 | 647 | 4.0% |
| layouts | plugin | 4 | 69 | 7 | 29 | 33 | 52.2% |
| devices | plugin | 15 | 552 | 92 | 198 | 262 | 52.5% |
| network | plugin | 34 | 1,719 | 48 | 318 | 1,353 | 21.3% |
| zones | plugin | 7 | 171 | 6 | 103 | 62 | 63.7% |
| groups | plugin | 7 | 169 | 7 | 105 | 57 | 66.3% |
| simulation | plugin | 11 | 572 | 19 | 62 | 491 | 14.2% |
| product | composition | 3 | 73 | 17 | 9 | 47 | 35.6% |
| canvas | host | 18 | 2,182 | 59 | 231 | 1,892 | 13.3% |
| editing | host | 3 | 179 | 2 | 0 | 177 | 1.1% |
| renderer | host | 3 | 479 | 3 | 0 | 476 | 0.6% |
| sync | host | 4 | 587 | 8 | 0 | 579 | 1.4% |
| product-page | composition root | 4 | 627 | 8 | 0 | 619 | 1.3% |
| lab | composition root | 2 | 106 | 11 | 0 | 95 | 10.4% |
| server | composition root | 3 | 329 | 18 | 4 | 307 | 6.7% |
| access | door | 3 | 141 | 6 | 0 | 135 | 4.3% |
| placement | door | 1 | 76 | 4 | 0 | 72 | 5.3% |
| store | door | 5 | 934 | 8 | 0 | 926 | 0.9% |
| hub | door | 4 | 544 | 5 | 0 | 539 | 0.9% |
| rest | door | 2 | 661 | 45 | 0 | 616 | 6.8% |
| cli | door | 2 | 2,177 | 13 | 162 | 2,002 | 8.0% |
| export | door | 2 | 265 | 0 | 0 | 265 | 0.0% |
