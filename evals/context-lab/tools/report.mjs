#!/usr/bin/env node
/*
The map evaluation's report (H28.3, B440): one run's cells, per arm, per arm and model, per arm and task, and per arm, model and task --
success, map calls, wrong-chunk reads, sense commands followed, bypass flags, tool calls, input tokens and seconds, each a mean over
the counted cells, `n` the count. A cell counts when its scores are complete. A bypass flag is a cell whose agent touched the shim's
own files (`.draw/`: the gzipped state, the log, the policy) by a tool call, or changed them (`intact` 0) -- its success is not the map's.

  node evals/context-lab/tools/report.mjs <run-dir> [--json]
*/
import fs from 'node:fs';
import path from 'node:path';

const BYPASS = /\.draw\/|state\.json|log\.jsonl|policy\.json|gunzip|zcat|zlib/;

export function cellsOf(runDir) {
	const out = [];
	for (const f of fs.readdirSync(path.join(runDir, 'cells')).filter((x) => x.endsWith('.json')).sort()) {
		const c = JSON.parse(fs.readFileSync(path.join(runDir, 'cells', f), 'utf8'));
		const [scenario, arm, member] = f.replace(/\.json$/, '').split('.');
		const scores = Object.fromEntries((c.codeScores || []).filter((s) => typeof s.value === 'number').map((s) => [s.property, s.value]));
		const attempt = (c.attempts || []).at(-1);
		const phases = attempt?.phases || [];
		const cost = (k) => { const v = phases.map((p) => p.outcome?.cost?.[k]); return v.every((x) => typeof x === 'number') && v.length ? v.reduce((a, b) => a + b, 0) : null; };
		const tools = phases.flatMap((p) => p.outcome?.tools || []);
		const touched = tools.filter((t) => BYPASS.test(JSON.stringify(t.input ?? '')) || (t.paths || []).some((p) => BYPASS.test(p))).length;
		out.push({ scenario, arm, member, complete: 'success' in scores, scores, bypass: touched > 0 || scores.intact === 0 ? 1 : 0,
			toolCalls: cost('toolCalls'), inputTokens: cost('inputTokens'), seconds: cost('seconds'), attempts: (c.attempts || []).length });
	}
	return out;
}

const COLS = [['success', (c) => c.scores.success], ['map calls', (c) => c.scores['map-calls']], ['wrong reads', (c) => c.scores['wrong-reads']],
	['senses followed', (c) => c.scores['senses-followed']], ['bypass', (c) => c.bypass], ['tool calls', (c) => c.toolCalls],
	['input tokens', (c) => c.inputTokens], ['seconds', (c) => c.seconds]];
const mean = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const fmt = (x) => (x === null ? '-' : Number.isInteger(x) ? String(x) : x >= 100 ? x.toFixed(0) : x.toFixed(2));

export function rows(cells, keys) {
	const groups = new Map();
	for (const c of cells.filter((x) => x.complete)) {
		const k = keys.map((key) => c[key]).join(' ');
		if (!groups.has(k)) groups.set(k, { key: Object.fromEntries(keys.map((key) => [key, c[key]])), cells: [] });
		groups.get(k).cells.push(c);
	}
	return [...groups.values()].sort((a, b) => JSON.stringify(a.key).localeCompare(JSON.stringify(b.key)))
		.map((g) => ({ ...g.key, n: g.cells.length, ...Object.fromEntries(COLS.map(([name, f]) => [name, mean(g.cells.map(f))])) }));
}

function table(title, keys, rs) {
	const head = [...keys, 'n', ...COLS.map(([n]) => n)];
	return [`## ${title}`, '', `| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rs.map((r) => `| ${head.map((h) => (keys.includes(h) ? r[h] : fmt(r[h]))).join(' | ')} |`), ''].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const dir = process.argv[2];
	if (!dir) { console.error('usage: node evals/context-lab/tools/report.mjs <run-dir> [--json]'); process.exit(2); }
	const cells = cellsOf(dir);
	const views = [['per arm', ['arm']], ['per arm and task', ['arm', 'scenario']], ['per arm and model', ['arm', 'member']], ['per arm, model and task', ['arm', 'member', 'scenario']]];
	if (process.argv.includes('--json')) console.log(JSON.stringify({ run: path.basename(dir), cells, views: Object.fromEntries(views.map(([t, k]) => [t, rows(cells, k)])) }, null, 2));
	else {
		const incomplete = cells.filter((c) => !c.complete);
		console.log([`# Map evaluation -- ${path.basename(dir)}`, '', `${cells.length} cells, ${cells.length - incomplete.length} counted${incomplete.length ? `; not counted: ${incomplete.map((c) => `${c.scenario}.${c.arm}.${c.member}`).join(', ')}` : ''}.`, '',
			...views.map(([t, k]) => table(t, k, rows(cells, k)))].join('\n'));
	}
}
