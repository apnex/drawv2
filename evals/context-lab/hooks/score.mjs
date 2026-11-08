// score - outcome-measure hook: a map-evaluation outcome scored from its workspace snapshot (hooks/scoring.mjs).
//
// Reads the agent's answer.txt, the server's state when the session ended (.draw/state.json.gz), the shim's log (.draw/log.jsonl) and
// the shim's own files, against data/answers.json and data/diagram.json, which no workspace holds. Prints { scores } for the properties
// asked: the task's (success, and for T5 found and placed), the measures, and `intact` -- 0 when the agent changed the shim, its
// door or its policy, which would void a measure.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { taskScores, measures } from "./scoring.mjs";
import { DOOR } from "../tools/fixture-lib.mjs";

const PACK = path.resolve(import.meta.dirname, "..");
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), "utf8"));
const maybe = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };

export function scoreSnapshot(scenario, snapshot) {
	const answers = readJson(PACK, "data", "answers.json");
	const before = readJson(PACK, "data", "diagram.json");
	const policies = readJson(PACK, "data", "policies.json");
	const state = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(snapshot, ".draw", "state.json.gz"))).toString("utf8"));
	const after = JSON.parse(state.files[`${before.meta.id}.json`]);
	const log = (maybe(path.join(snapshot, ".draw", "log.jsonl")) ?? "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
	const policy = maybe(path.join(snapshot, ".draw", "policy.json"));
	const intact = maybe(path.join(snapshot, "draw")) === DOOR
		&& maybe(path.join(snapshot, ".draw", "shim.mjs")) === fs.readFileSync(path.join(PACK, "fixture", "shim.mjs"), "utf8")
		&& policy !== null && JSON.stringify(JSON.parse(policy).allow) === JSON.stringify(policies[scenario]);
	return { ...taskScores(scenario, { answer: maybe(path.join(snapshot, "answer.txt")), before, after, answers }), ...measures(scenario, log, answers), intact: intact ? 1 : 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const input = JSON.parse(fs.readFileSync(0, "utf8"));
	const all = scoreSnapshot(input.scenario, input.outcome.snapshot);
	const scores = {};
	for (const p of input.properties) scores[p] = Math.min(all[p], 1000);
	console.log(JSON.stringify({ scores }));
}
