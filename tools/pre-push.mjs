#!/usr/bin/env node
/*
pre-push -- GR1 / B21, AMENDED H31-6 (dev/DECISIONS.md). What the installed pre-push hook runs (tools/install-hook.sh installs a hook that
calls this and nothing else, so what a push is checked by is versioned here and reviewable).

Git hands the hook one line per ref pushed on stdin -- `<local ref> <local sha> <remote ref> <remote sha>`. Each range, the remote's sha to
the local one, is decided by the one decider CI uses too (tools/push-scope.mjs): when every range is `records` -- every changed path a
record or document -- the records gate runs (`npm run gate:records`); any range `full`, any line it cannot read, or no line at all runs
the full gate (`npm run gate`). The gate's exit status is the hook's, so a failing gate refuses the push.
*/
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { scopeBetween } from './push-scope.mjs';

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch { /* no stdin: no range, so the full gate */ }
const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
const decisions = lines.map((line) => {
	const [, local, , remote] = line.split(/\s+/);
	return { line, ...scopeBetween(remote, local) };
});
for (const d of decisions) console.log(`pre-push: ${d.line.split(/\s+/)[0]}: ${d.scope} -- ${d.why}`);
const records = decisions.length > 0 && decisions.every((d) => d.scope === 'records');
const script = records ? 'gate:records' : 'gate';
console.log(`pre-push: npm run ${script}${decisions.length ? '' : ' -- no range read, so the full gate'}`);
const run = spawnSync('npm', ['run', script], { stdio: 'inherit' });
process.exit(run.status ?? 1);
