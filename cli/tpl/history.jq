[ .records
  | reverse
  | .[]
  | { SEQ: .seq,
      WHEN: (.at / 1000 | strftime("%H:%M:%S")),
      WHO: (if .by == "client" then "browser" else "agent" end + " " + (.actor // "?")),
      CHANGE: (.label // "-"),
      WHAT: .summary } ]
