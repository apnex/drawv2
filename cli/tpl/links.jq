[ .nodes as $nodes | .links[] | . as $l
  | (([$nodes[] | select(.id == $l.src) | .name] | first) // $l.src) as $sn
  | (([$nodes[] | select(.id == $l.dst) | .name] | first) // $l.dst) as $dn
  | select(($q == "") or ($l.id | startswith($q)) or ($sn == $q) or ($dn == $q))
  | { ID: $l.id, SRC: $sn, DST: $dn } ]
