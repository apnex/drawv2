// arm-cli - variant-transform hook: each arm's `cli/verbs.mjs`, patched, placed where the workspace's runtime reads it.
//
// The variant holds draw's `cli/verbs.mjs` at the pinned revision; this writes it to `.draw/runtime/cli/verbs.mjs`, over the fixture's
// copy, after the patch its arm names -- each replacement made exactly the number of times stated, or the arm is refused:
//   cli-a  31 by 17, the map as draw ships it (arms a and a2)
//   cli-b  17 by 17: CHUNK, the one line that sets the size
//   cli-c  31 by 17 without the senses: the map's "beyond the window:" lines, its `--json` `beyond`, and the two help phrases that
//          promise them
// It refuses, too, when a fixture is not the one the pack pins (tools/fixture-lib.mjs verifyFixtures), so no run starts over a stale one.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { verifyFixtures } from "../tools/fixture-lib.mjs";

export const PATCHES = {
	"cli-a": [],
	"cli-b": [["const CHUNK = Object.freeze({ w: 31, h: 17 });", "const CHUNK = Object.freeze({ w: 17, h: 17 });", 1]],
	"cli-c": [
		[",\n\t\t\t'beyond the window:', ...senses.beyond.map((b) => senseLine(b, command))];", "];", 1],
		[",\n\t\t\tbeyond: senses.beyond.map((b) => ({ ...b, command: command(b.chunk) })) }, text };", " }, text };", 1],
		["'look at the canvas a chunk at a time -- occupancy as a grid, and what lies beyond it each way'", "'look at the canvas a chunk at a time -- occupancy as a grid'", 1],
		["i,j -- chunk 0,0 is centred on cell 0,0; the map names its neighbours`", "i,j -- chunk 0,0 is centred on cell 0,0`", 1],
	],
};
export const DELIVERED = path.join(".draw", "runtime", "cli", "verbs.mjs");

export function patch(variant, text) {
	const steps = PATCHES[variant];
	if (!steps) throw new Error(`no patch for variant ${variant}`);
	let out = text;
	for (const [from, to, times] of steps) {
		const found = out.split(from).length - 1;
		if (found !== times) throw new Error(`${variant}: expected ${times} of ${JSON.stringify(from.slice(0, 60))}, found ${found}`);
		out = out.split(from).join(to);
	}
	return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const input = JSON.parse(fs.readFileSync(0, "utf8"));
	const faults = verifyFixtures();
	if (faults.length) { console.error(faults.join("\n")); process.exit(1); }
	const text = patch(input.variant, fs.readFileSync(path.join(input.from, "verbs.mjs"), "utf8"));
	const out = path.join(input.to, DELIVERED);
	fs.mkdirSync(path.dirname(out), { recursive: true });
	fs.writeFileSync(out, text);
	const check = spawnSync(process.execPath, ["--check", out], { encoding: "utf8" });
	if (check.status !== 0) { console.error(check.stderr); process.exit(1); }
	console.log(JSON.stringify({ variant: input.variant, delivered: DELIVERED, steps: PATCHES[input.variant].length }));
}
