# dev/design/components/ -- H26's design of record

The sovereign components H26 makes from draw's canvas and input system (`dev/DECISIONS.md` H26 to H26-3), designed one piece at a time.

| File | What it is | Standing |
|---|---|---|
| `SNAP-GRID.md` | H26.0 part 1: `snap-grid`'s duty, vocabulary, contract and invariants, draw's move onto it, and what every component repository shares -- the template, the vocabulary check, the gate, the release and the import map. | Design; H26.0. |
| `INPUT-BINDING.md` | H26.0 part 2: `input-binding`'s duty, vocabulary, contract and invariants -- the binding table and the gesture session -- its boundary with `input-capture`, and draw's move onto it (H26.2). | Design; H26.0. |
| `INPUT-CAPTURE.md` | H26.0 part 3: `input-capture`'s duty, vocabulary, contract and invariants -- a platform's pointer and key events on one surface turned into frozen facts, the conversion and the hit test supplied by the application, and a reply that claims an event or takes the pointer -- and draw's move onto it (H26.3). | Design; H26.0. |
| `VECTOR-SCENE.md` | H26.0 part 4: `vector-scene`'s duty, vocabulary, contract and invariants -- an application's shapes held as data in declared layers under its keys, the platform brought to show exactly them, the item a platform element belongs to, and points converted through the root -- and draw's move onto it (H26.4), with what H26.8 retires, where each piece of draw's canvas layer lands, and its editing duty declared as a part (H26-10). | Design; H26.0. |
