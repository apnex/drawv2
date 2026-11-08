/*
The fixture of draw's map evaluation (H28.3, B440): what each scenario's workspace starts as, how it is built, and how a run checks it.

A workspace holds `./draw` (the shim's door) and `.draw/` -- the shim, the task's verb policy, the server's data gzipped, the CLI's
home with the diagram selected, and `runtime/`, draw's tree at the pinned revision with the four packages it imports. The runtime is
built, never committed (`fixtures/` is ignored); the diagram (`data/diagram.json`), the answers (`data/answers.json`, never in a
workspace) and the policies (`data/policies.json`) are. `.draw/REVISION` records the revision and a digest of every other file, so
the arms' transform (hooks/arm-cli.mjs) refuses a run over a fixture built at another revision, from other data, or changed since.
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

export const PACK = path.resolve(import.meta.dirname, '..');
export const HOST = 'http://localhost:8080';
// draw's tree the shim runs: the server and everything it imports, the CLI, and the client folder createApp names
export const TREE = ['cli', 'server', 'model', 'kernel', 'planner', 'plugins', 'product', 'engine', 'app', 'package.json'];
export const PACKAGES = ['ws', '@apnex/snap-grid', '@apnex/input-binding', '@apnex/vector-scene', '@apnex/input-capture'];
export const DOOR = "#!/usr/bin/env node\n// draw, as this folder runs it: draw's own CLI answered by draw's own server in this process (.draw/shim.mjs)\nimport('./.draw/shim.mjs').then((m) => m.cli(process.argv.slice(2)));\n";

const read = (...p) => fs.readFileSync(path.join(PACK, ...p), 'utf8');
export const readPack = () => JSON.parse(read('pack.json'));
export const readJson = (...p) => JSON.parse(read(...p));

// the one revision every variant and the runtime are built at
export function pinnedRevision(pack = readPack()) {
	const revs = [...new Set(pack.variants.map((v) => v.revision))];
	if (revs.length !== 1 || !/^[0-9a-f]{40}$/.test(revs[0] ?? '')) throw new Error(`the variants must share one full revision, not ${revs.join(', ')}`);
	return revs[0];
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function filesUnder(dir, base = dir, out = []) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) filesUnder(p, base, out);
		else if (e.isFile()) out.push(path.relative(base, p));
		else throw new Error(`${p} is neither a file nor a folder`);
	}
	return out;
}
// every file of a fixture but REVISION, by path and content
export function digestOf(dir) {
	const h = crypto.createHash('sha256');
	for (const f of filesUnder(dir)) if (f !== path.join('.draw', 'REVISION')) h.update(`${f}\0${sha(fs.readFileSync(path.join(dir, f)))}\n`);
	return h.digest('hex');
}

export function buildRuntime(repo, revision, out) {
	fs.rmSync(out, { recursive: true, force: true });
	fs.mkdirSync(out, { recursive: true });
	const tar = execFileSync('git', ['-C', repo, 'archive', '--format=tar', revision, ...TREE], { maxBuffer: 1 << 28 });
	execFileSync('tar', ['-x', '-C', out], { input: tar });
	for (const p of PACKAGES) fs.cpSync(path.join(repo, 'node_modules', p), path.join(out, 'node_modules', p), { recursive: true });
}

export const stateOf = (diagram) => zlib.gzipSync(JSON.stringify({ files: { [`${diagram.meta.id}.json`]: JSON.stringify(diagram) } }), { level: 9 });

export function composeFixture(dir, { runtime, scenario, revision }) {
	const diagram = readJson('data', 'diagram.json');
	const policies = readJson('data', 'policies.json');
	if (!(scenario in policies)) throw new Error(`no policy for ${scenario} in data/policies.json`);
	fs.rmSync(dir, { recursive: true, force: true });
	fs.mkdirSync(path.join(dir, '.draw', 'home', '.config', 'draw'), { recursive: true });
	fs.writeFileSync(path.join(dir, 'draw'), DOOR, { mode: 0o755 });
	fs.chmodSync(path.join(dir, 'draw'), 0o755);
	fs.copyFileSync(path.join(PACK, 'fixture', 'shim.mjs'), path.join(dir, '.draw', 'shim.mjs'));
	fs.writeFileSync(path.join(dir, '.draw', 'policy.json'), `${JSON.stringify({ allow: policies[scenario] })}\n`);
	fs.writeFileSync(path.join(dir, '.draw', 'state.json.gz'), stateOf(diagram));
	fs.writeFileSync(path.join(dir, '.draw', 'home', '.config', 'draw', 'context'), `${JSON.stringify({ [HOST]: diagram.meta.id }, null, '\t')}\n`);
	fs.cpSync(runtime, path.join(dir, '.draw', 'runtime'), { recursive: true });
	fs.writeFileSync(path.join(dir, '.draw', 'REVISION'), `${JSON.stringify({ revision, digest: digestOf(dir) })}\n`);
}

// the scenarios and their fixture folders, from the pack itself
export function scenarioFixtures(pack = readPack()) {
	const ids = new Set();
	for (const e of pack.experiments) for (const s of readJson(e).scenarios) ids.add(s);
	return [...ids].sort().map((s) => { const sc = readJson(s); return { id: sc.id, fixture: sc.fixture }; });
}

/*
What scores a run beyond the files context-lab hashes into an experiment's record (its scenarios and the hooks pack.json names): the
modules the hooks import, the shim, and the data. Their digest is stamped into every experiment's notes (`build-fixture.mjs --stamp`),
so recording an experiment pins them too, and a change to any of them refuses the run until it is stamped -- and the experiment
recorded -- again.
*/
export const SCORED = ['hooks/scoring.mjs', 'tools/fixture-lib.mjs', 'fixture/shim.mjs', 'data/diagram.json', 'data/answers.json', 'data/policies.json'];
export const packDigest = () => { const h = crypto.createHash('sha256'); for (const f of SCORED) h.update(`${f}\0${sha(fs.readFileSync(path.join(PACK, f)))}\n`); return h.digest('hex'); };
export const STAMP = /pack digest [0-9a-f]{64}/;

// every refusal a fixture earns, or none
export function verifyFixtures(pack = readPack()) {
	const faults = [];
	const revision = pinnedRevision(pack);
	const diagram = readJson('data', 'diagram.json');
	const policies = readJson('data', 'policies.json');
	const shim = read('fixture', 'shim.mjs');
	const stamp = `pack digest ${packDigest()}`;
	for (const e of pack.experiments) if (!(readJson(e).notes ?? '').includes(stamp)) faults.push(`${e} is not stamped with this pack's ${stamp} -- run tools/build-fixture.mjs --stamp, then record it again`);
	for (const { id, fixture } of scenarioFixtures(pack)) {
		const dir = path.join(PACK, fixture);
		const at = (...p) => path.join(dir, ...p);
		if (!fs.existsSync(at('.draw', 'REVISION'))) { faults.push(`${fixture} is not built -- run node evals/context-lab/tools/build-fixture.mjs`); continue; }
		const rec = JSON.parse(fs.readFileSync(at('.draw', 'REVISION'), 'utf8'));
		if (rec.revision !== revision) faults.push(`${fixture} was built at ${rec.revision}, the pack pins ${revision}`);
		if (digestOf(dir) !== rec.digest) faults.push(`${fixture} has changed since it was built`);
		if (fs.readFileSync(at('.draw', 'shim.mjs'), 'utf8') !== shim) faults.push(`${fixture}'s shim is not fixture/shim.mjs`);
		if (fs.readFileSync(at('draw'), 'utf8') !== DOOR) faults.push(`${fixture}'s ./draw is not the door`);
		if (JSON.stringify(JSON.parse(fs.readFileSync(at('.draw', 'policy.json'), 'utf8')).allow) !== JSON.stringify(policies[id])) faults.push(`${fixture}'s policy is not ${id}'s`);
		const files = JSON.parse(zlib.gunzipSync(fs.readFileSync(at('.draw', 'state.json.gz'))).toString('utf8')).files;
		if (JSON.stringify(Object.keys(files)) !== JSON.stringify([`${diagram.meta.id}.json`]) || files[`${diagram.meta.id}.json`] !== JSON.stringify(diagram)) faults.push(`${fixture}'s data is not data/diagram.json`);
	}
	return faults;
}
