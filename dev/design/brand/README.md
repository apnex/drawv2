# Brand assets

The `router` glyph, taken from `kernel/theme.mjs` rather than redrawn.\
Same path data the editor renders, in the same palette: `#aed581` on `#101010`.

`router.html` is the source.\
It renders at 4x into a larger viewport, and the PNG is cropped to content and downscaled with LANCZOS -- rendering directly at 120 produces a partial paint and worse antialiasing.

| File | Ring | Use |
|---|---|---|
| `router-480.png` | 3px | **in use** -- uploaded to the IAP consent screen for `draw.apnex.io` |
| `router-120.png` | 3px | same glyph at 120x120, Google's recommended size |
| `router-120-ring2.1.png` | 2px | `theme.mjs` default, thin in isolation |
| `router-120-ring3.5.png` | 3px | identical to `router-120.png`, kept for comparison |
| `router-120-ring5.0.png` | 5px | matches the glyph's own stroke weight |

## The one deliberate divergence

`.frame` in `theme.mjs` is `stroke-width: 2.1`, and that is correct for a node among many.\
It reads thin on a standalone 120px logo, so these use `3.5`, which measures 3px at final size.\
Recorded here so the difference is not mistaken for drift.

## Z-order matters

`theme.mjs` draws the solid arrows FIRST and the hollow group SECOND.\
The `r=15` hub is filled with the node fill and stroked green, so drawing it last is what makes the centre read hollow.\
Reversing the two fills the hub solid green, which is wrong and was the first version of this asset.
