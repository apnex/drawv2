[ .zones[]
  | select(($q == "") or (.id | startswith($q)) or (.name == $q))
  | { ID: .id, NAME: (.name // "-"), X: .x, Y: .y, W: .w, H: .h } ]
