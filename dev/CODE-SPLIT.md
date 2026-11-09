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
| 2026-11-01 | f012dda | 1,404 | 3,222 | 73 | 9,269 | 0 | 13,968 | 3,910 | 21.9% | 517 | 1,225 | 12,226 | 12.5% | 37,229 | 5,735 | 2,215 | 1,290 | 819 | 238 | 48,296 | 73,766 | 8,456 | 31,901 | 3,313 |
| 2026-11-05 | bc3cd28 | 1,406 | 3,208 | 69 | 9,924 | 0 | 14,607 | 4,141 | 22.1% | 544 | 1,241 | 12,822 | 12.2% | 40,256 | 5,799 | 2,215 | 1,290 | 846 | 238 | 51,947 | 73,856 | 8,560 | 33,057 | 3,326 |
| 2026-11-06 | bdc0bc4 | 1,421 | 3,346 | 74 | 9,958 | 0 | 14,799 | 4,141 | 21.9% | 543 | 1,314 | 12,942 | 12.5% | 40,998 | 5,942 | 2,155 | 1,290 | 846 | 241 | 52,839 | 73,857 | 8,750 | 33,120 | 3,335 |
| 2026-11-07 | ea75b43 | 1,421 | 3,346 | 74 | 9,958 | 0 | 14,799 | 4,141 | 21.9% | 542 | 1,313 | 12,944 | 12.5% | 41,159 | 5,942 | 2,155 | 1,290 | 846 | 241 | 53,040 | 73,857 | 8,751 | 33,205 | 3,335 |
| 2026-11-07 | 8e6a8b5 | 1,421 | 3,346 | 74 | 10,008 | 0 | 14,849 | 4,141 | 21.8% | 542 | 1,309 | 12,998 | 12.5% | 41,396 | 5,942 | 2,155 | 1,290 | 846 | 241 | 53,323 | 73,857 | 8,751 | 33,253 | 3,336 |
| 2026-11-09 | 934df3c | 1,421 | 3,346 | 74 | 10,115 | 0 | 14,956 | 4,141 | 21.7% | 544 | 1,310 | 13,102 | 12.4% | 41,739 | 6,680 | 2,155 | 1,290 | 846 | 241 | 53,718 | 73,857 | 8,755 | 33,307 | 3,340 |

The first row is draw before H26 (`561a2df`); the second, draw on all four components, live in production (`c6e8358`, H26.4); the third, draw on the three `0.2.0` releases, live in production (`ca492da`, H26.5), the baseline of H26.8; the fourth, H26.8 closed, live in production (`f012dda`); the fifth, H26.6's batch 1, the infinite canvas at grid size 60, live in production (`bc3cd28`); the sixth, H26.6 closed by batch 2, one grid per diagram sized 60 to 120 and schema 4, live in production (`bdc0bc4`); the seventh, H27's batch, every wheel a zoom and two press fixes, live in production (`ea75b43`), draw running unchanged in lines; the eighth, H28's batch, the hold hardened and a move's and a clone's preview drawn off the shared Model, live in production (`8e6a8b5`); the ninth, H30's fix of an edit lost across a template's fork, the CLI's named units since pushed, live in production (`934df3c`).

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

### H26.8's close -- `f012dda`, 2026-11-01, in production

| Part | Kind | Modules | Code lines | Pure data | With predicates | Logic | Declarative share |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lattice | core | 4 | 156 | 22 | 0 | 134 | 14.1% |
| kind-contract | core | 2 | 121 | 17 | 0 | 104 | 14.0% |
| document | core | 5 | 210 | 1 | 0 | 209 | 0.5% |
| relations | core | 3 | 106 | 0 | 0 | 106 | 0.0% |
| colours | core | 2 | 87 | 71 | 0 | 16 | 81.6% |
| primitives | core | 1 | 27 | 0 | 0 | 27 | 0.0% |
| rules | core | 1 | 23 | 10 | 0 | 13 | 43.5% |
| planner | core | 5 | 674 | 5 | 22 | 647 | 4.0% |
| layouts | plugin | 4 | 68 | 7 | 30 | 31 | 54.4% |
| devices | plugin | 15 | 531 | 92 | 190 | 249 | 53.1% |
| network | plugin | 35 | 1,691 | 48 | 311 | 1,332 | 21.2% |
| zones | plugin | 7 | 163 | 6 | 100 | 57 | 65.0% |
| groups | plugin | 7 | 159 | 6 | 97 | 56 | 64.8% |
| simulation | plugin | 11 | 610 | 19 | 67 | 524 | 14.1% |
| product | composition | 3 | 73 | 17 | 9 | 47 | 35.6% |
| canvas | host | 14 | 1,832 | 17 | 131 | 1,684 | 8.1% |
| label-editor | host | 1 | 141 | 0 | 0 | 141 | 0.0% |
| help | host | 2 | 102 | 47 | 0 | 55 | 46.1% |
| grids | host | 1 | 19 | 0 | 0 | 19 | 0.0% |
| editing | host | 5 | 323 | 3 | 102 | 218 | 32.5% |
| renderer | host | 2 | 360 | 3 | 0 | 357 | 0.8% |
| sync | host | 4 | 587 | 8 | 0 | 579 | 1.4% |
| product-page | composition root | 4 | 631 | 8 | 0 | 623 | 1.3% |
| lab | composition root | 2 | 105 | 11 | 0 | 94 | 10.5% |
| server | composition root | 3 | 329 | 18 | 4 | 307 | 6.7% |
| access | door | 3 | 141 | 6 | 0 | 135 | 4.3% |
| placement | door | 1 | 76 | 4 | 0 | 72 | 5.3% |
| store | door | 5 | 934 | 8 | 0 | 926 | 0.9% |
| hub | door | 4 | 544 | 5 | 0 | 539 | 0.9% |
| rest | door | 2 | 661 | 45 | 0 | 616 | 6.8% |
| cli | door | 2 | 2,177 | 13 | 162 | 2,002 | 8.0% |
| export | door | 2 | 307 | 0 | 0 | 307 | 0.0% |

Against the baseline and `dev/design/components/NATIVE-SHAPES.md` section 6's estimates:
- **Draw, running:** 14,049 to 13,968, 81 lines and 0.6% smaller, where section 6 estimated about 250 and 1.8%; the declarative share flat at 12.5%, as estimated.
- **The parts the moves aimed at:** `renderer` 479 to 360, 25% smaller (estimated 39%); `rules` 55 to 23, 58% smaller (estimated 64%), its share 18.2% to 43.5%; `canvas` 2,182 to 1,832, 16% smaller (estimated 18%), its share 13.3% to 8.1%, the gesture table having left it.
- **Where duties went:** `editing` 179 to 323, its share 1.1% to 32.5% (estimated 310 at 33.5%); `label-editor`, `help` and `grids`, new parts out of `canvas`, 262 lines together (estimated 261).
- **Larger than estimated:** `simulation` 572 to 610, estimated flat, most of it the trace's lifecycle and end; `export` 265 to 307, estimated 293.
- **Tests:** 35,533 to 37,229 code lines, where section 6 estimated about 500 fewer; by raw lines the largest additions are the record and its comparator (`tests/fixtures/native-record.mjs`, 1,425 added, and its tests), the trace's record and the new guards (`tests/native-shapes.test.js`, `tests/editing-host.test.js`), against the copies and old sides deleted (`tests/fixtures/scene-parity.mjs` 518 fewer, `tests/fixtures/pre-scene/` and `tests/fixtures/pre-export/` among them).

### H26.6's close -- `bdc0bc4`, 2026-11-06, in production

| Part | Kind | Modules | Code lines | Pure data | With predicates | Logic | Declarative share |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lattice | core | 4 | 164 | 20 | 0 | 144 | 12.2% |
| kind-contract | core | 2 | 124 | 20 | 0 | 104 | 16.1% |
| document | core | 5 | 210 | 1 | 0 | 209 | 0.5% |
| relations | core | 3 | 109 | 0 | 0 | 109 | 0.0% |
| colours | core | 2 | 87 | 71 | 0 | 16 | 81.6% |
| primitives | core | 1 | 27 | 0 | 0 | 27 | 0.0% |
| rules | core | 1 | 23 | 10 | 0 | 13 | 43.5% |
| planner | core | 5 | 677 | 5 | 22 | 650 | 4.0% |
| layouts | plugin | 5 | 201 | 6 | 100 | 95 | 52.7% |
| devices | plugin | 15 | 520 | 92 | 189 | 239 | 54.0% |
| network | plugin | 35 | 1,691 | 48 | 311 | 1,332 | 21.2% |
| zones | plugin | 7 | 166 | 6 | 101 | 59 | 64.5% |
| groups | plugin | 7 | 159 | 6 | 97 | 56 | 64.8% |
| simulation | plugin | 11 | 609 | 19 | 67 | 523 | 14.1% |
| product | composition | 3 | 74 | 16 | 9 | 49 | 33.8% |
| canvas | host | 14 | 1,962 | 18 | 145 | 1,799 | 8.3% |
| label-editor | host | 1 | 151 | 0 | 0 | 151 | 0.0% |
| help | host | 2 | 133 | 56 | 0 | 77 | 42.1% |
| grids | host | 1 | 66 | 2 | 0 | 64 | 3.0% |
| view | host | 1 | 224 | 10 | 0 | 214 | 4.5% |
| editing | host | 5 | 334 | 3 | 102 | 229 | 31.4% |
| renderer | host | 2 | 363 | 3 | 0 | 360 | 0.8% |
| sync | host | 4 | 592 | 8 | 0 | 584 | 1.4% |
| product-page | composition root | 4 | 650 | 8 | 4 | 638 | 1.8% |
| lab | composition root | 2 | 120 | 11 | 0 | 109 | 9.2% |
| server | composition root | 3 | 329 | 18 | 4 | 307 | 6.7% |
| access | door | 3 | 141 | 6 | 0 | 135 | 4.3% |
| placement | door | 1 | 82 | 3 | 1 | 78 | 4.9% |
| store | door | 5 | 934 | 8 | 0 | 926 | 0.9% |
| hub | door | 4 | 544 | 5 | 0 | 539 | 0.9% |
| rest | door | 2 | 701 | 46 | 0 | 655 | 6.6% |
| cli | door | 2 | 2,325 | 18 | 162 | 2,145 | 7.7% |
| export | door | 2 | 307 | 0 | 0 | 307 | 0.0% |

Against `dev/design/components/PAN-ZOOM.md` section 6, its before measured at `a4a90b3` and its after estimated:
- **Draw, running:** 13,979 to 14,799, 820 lines and 5.9% larger, where section 6 estimated about 340 and 2.4%; the declarative share flat at 12.5%, as estimated.
- **Larger than estimated:** `layouts` 68 to 201 (estimated 95), the size change by lattice index and its refusals (`plugins/layouts/size-change.mjs`) and its notice (`size-notice.mjs`) new; `view`, new, 224 (estimated 115), the view's levels, home, fit, the store per diagram and the frame queue in `app/src/view.js`; `canvas` 1,832 to 1,962 (estimated 1,883); `cli` 2,177 to 2,325 (estimated 2,258), the map in chunks and its senses; `grids` 19 to 66 (estimated 52); `help` 102 to 133, estimated unchanged, its inputs widened to the wheel, a pinch, the drags of each button and the digit keys; `rest` and `placement` 736 to 783 (estimated 760).
- **Within about 15 lines of the estimate:** `lattice` 169 to 164 (estimated 160); `devices` 531 to 520 (528); `zones` 162 to 166 (159); `product` 73 to 74 (76); `label-editor` 141 to 151 (145); `editing` and `renderer` 683 to 697 (687); `product-page` and `lab` 736 to 770 (754); every other part but `help` 6,550 to 6,563.
- **Out of draw:** the components grew by their releases, `vector-scene` `0.3.0`, `input-binding` `0.3.0` and `snap-grid` `0.1.2`, vendor 3,910 to 4,141 lines; the templates 2,215 to 2,155 lines, their two layouts made one grid record by schema 4.
- **Tests:** 37,229 code lines at H26.8's close to 40,998.
