[ .nodes as $nodes | .groups[] | . as $g
  | select(($q == "") or ($g.id | startswith($q)) or (($g.name // "") == $q))
  | { ID: $g.id, NAME: ($g.name // "-"), SIZE: ($g.members | length),
      MEMBERS: ([$g.members[] as $m | (([$nodes[] | select(.id == $m) | .name] | first) // $m)] | join(",")) } ]
