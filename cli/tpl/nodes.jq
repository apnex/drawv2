[ .nodes[]
  | select(($q == "") or (.id | startswith($q)) or (.name == $q))
  | { ID: .id, NAME: (.name // "-"), TYPE: (.type // "unknown"), X: .x, Y: .y } ]
