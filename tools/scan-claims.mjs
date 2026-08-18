// scan-claims — GR2. No deletion may ship without evidence beside it.
//
// Scope (Ruling B): the deletion tables in COMMIT.md §8, and all of COMMIT-DELETIONS.md.
// A markdown table row is one line, which is why line-scoping is correct HERE and nowhere else.
//
// Rule: in a deletion table EVERY data row is a deletion by construction, so every row must carry
// evidence — not merely the rows that happen to contain a deletion verb. Evidence = a [V]/[I]/[A]
// marker, and for [V] either a file:line ANYWHERE on the row (tables put the citation in its own
// column) or an explicit measured/exhaustive form.
import { readFileSync } from 'node:fs';

const MARK     = /\[(V|I|A)\b/;
const PATHLINE = /[A-Za-z0-9_./-]+\.(js|mjs|json|md|sh|jq|yml|html|css):\d+/;
const MEASURED = /\[V,\s*(measured|plan-measured|exhaustive|counted|file present|git |npm |grep)/i;
const SEP      = /^\|[\s:|-]+\|$/;                 // |---|---| separator
const HEADER   = /^\|\s*(what|symbol|item|#|id)\b/i;

function rowsOf(file, onlySection8, sec) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let inScope = !onlySection8, out = [];
  lines.forEach((line, i) => {
    if (onlySection8) {
      if (new RegExp('^##\\s+' + sec + '\\.').test(line)) inScope = true;
      else if (/^##\s+\d+\./.test(line) && inScope) inScope = false;
    }
    const t = line.trim();
    if (!inScope || !t.startsWith('|') || SEP.test(t) || HEADER.test(t)) return;
    // A deletion row names a symbol or path in its FIRST cell (`planMutation`, `case 'apply'`,
    // `server/store.js:137`). Prose tables inside the section — e.g. the consequence contract's
    // Column/Requirement rows — do not, and are not deletions.
    const first = t.split('|')[1] || '';
    if (!/`/.test(first)) return;
    out.push([i + 1, t]);
  });
  return out;
}

// Usage: scan-claims.mjs <file>[#section] ...
//   docs/spec/COMMIT.md#8          scope to section 8 only
//   docs/spec/COMMIT-DELETIONS.md  whole file
let bad = 0, total = 0;
for (const arg of process.argv.slice(2)) {
  const [f, sec] = arg.split('#');
  const only8 = !!sec;
  const rows = rowsOf(f, only8, sec);
  const fails = rows.filter(([, t]) => {
    if (!MARK.test(t)) return true;
    if (/\[V/.test(t) && !PATHLINE.test(t) && !MEASURED.test(t)) return true;
    return false;
  });
  // A scoped scan that matches NOTHING is a false green — the section moved or was renamed.
  // Fail loudly rather than reporting a vacuous pass (the smoke.sh `exit 0` lesson).
  if (rows.length === 0) {
    console.log(`  ${f.split('/').pop()}${sec ? ' \u00a7' + sec : ''}: NO ROWS MATCHED — scope is wrong or the section moved`);
    bad++; continue;
  }
  total += rows.length; bad += fails.length;
  console.log(`  ${f.split('/').pop()}${sec ? ' §' + sec : ''}: ${rows.length} rows, ${fails.length} without evidence`);
  fails.forEach(([n, t]) => console.log(`    L${n}: ${t.slice(0, 100)}`));
}
console.log(bad === 0 ? `  PASS — ${total} deletion rows, all evidenced` : `  FAIL — ${bad}/${total} rows lack evidence`);
process.exit(bad === 0 ? 0 : 1);
