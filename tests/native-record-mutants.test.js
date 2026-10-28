/*
H26.8 (dev/design/components/NATIVE-SHAPES.md section 4.2) -- THE NATIVE RECORD CAN FAIL. Move 2's first record compared nothing in
five of its scenarios and passed; a record that cannot fail holds no move to anything. So faults are planted in the drawing code the
record answers for -- a painter's attribute dropped, a state not set, a reflection not marked, a pipe not repainted when its end moves,
a mark left on a stale element across a load, a mover drawn as another kind, an editing visual misplaced -- each in a copy of the tree
outside the repository, and the record, compared under the tree's move (tests/native-record.test.js `MOVE`), must fail -- among its
failures the group each fault belongs to, which is all it runs for each fault, the control having run every group unmutated -- and,
where one is named, the scenario written for it. Among them the seven faults the verifier found the first record did not fail.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { NATIVE_RECORD } from './fixtures/native-record.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MOVE = 'trace';   // as tests/native-record.test.js
// what the record's fixture imports, run from the copy: the product's code, the documents it loads, and the fixture itself
const TREE = ['package.json', 'app', 'plugins', 'kernel', 'model', 'engine', 'planner', 'product', 'server', 'templates', 'lab/seeds.json', 'tools/probe', 'tests/fixtures/native-record.mjs'];
const MUTANTS = [
	{ id: 'zone-rx', what: 'a painter\'s attribute dropped: a zone\'s corner radius', file: 'plugins/zones/zone-painter.mjs', needle: "el('rect', { class: 'zone-rect', rx: ZONE_R }, g);", repl: "el('rect', { class: 'zone-rect' }, g);", groups: ['loads'] },
	{ id: 'head-join', what: 'a painter\'s attribute dropped: a link head\'s line join', file: 'plugins/network/link-painter.mjs', needle: "'stroke-linejoin': 'miter', ", repl: '', groups: ['loads'] },
	{ id: 'pill-class', what: 'nameLabel\'s pill drawn without its class', file: 'kernel/renderer.mjs', needle: "el('rect', { class: 'label-pill', ...pill }, g);", repl: "el('rect', { ...pill }, g);", groups: ['loads'] },
	{ id: 'hover', what: 'a state not set: the overlay\'s hover', file: 'app/src/overlay.js', needle: "this.renderer.setState(hit.id, 'hover', on);", repl: '', groups: ['states'] },
	{ id: 'reflect', what: 'a reflection not marked: a selected link\'s path, a down link\'s blockers', file: 'app/src/renderer.js', needle: 'next.forEach((id) => this.setState(id, r.cls, true));', repl: '', groups: ['states'] },
	{ id: 'reapply', what: 'the selected look not given back to an element drawn afresh', file: 'app/src/renderer.js', needle: "if (this.selectedSet.has(id)) this.setState(id, 'selected', true);", repl: '', groups: ['states'] },
	{ id: 'pipe-ends', what: 'a pipe not repainted when its end moves', file: 'plugins/network/host.mjs', needle: '\t\t\tsetEnds(d.line, p, q);', repl: "\t\t\tif (!d.line.getAttribute('x1')) setEnds(d.line, p, q);", groups: ['pipe triggers, alone', 'pipe triggers, combined'] },
	{ id: 'pipe-selected', what: 'a pipe\'s selected look not drawn', file: 'plugins/network/host.mjs', needle: "${selected.has(id) ? ' selected' : ''}", repl: '', groups: ['pipe triggers, alone', 'pipe triggers, combined'] },
	{ id: 'pipe-under', what: 'a pipe a link runs over not hidden', file: 'plugins/network/host.mjs', needle: "${under.has(id) ? ' under' : ''}", repl: '', groups: ['loads', 'pipe triggers, alone', 'pipe triggers, combined'] },
	{ id: 'aim-stale', what: 'a mark left on a stale element across a load: the movers aim the glyph they cached', file: 'plugins/simulation/mover-painter.mjs', needle: 'if (g && g.isConnected) return g;', repl: 'if (g) return g;', groups: ['marks'] },
	{ id: 'unrevealed', what: 'the reveal\'s mark not written: a withheld entity drawn', file: 'plugins/simulation/reveal-painter.mjs', needle: "if (dom && dom.getAttribute('data-unrevealed') === null) dom.setAttribute('data-unrevealed', '');", repl: '', groups: ['marks'] },
	{ id: 'trace-style', what: 'the trace\'s length and duration not written on a show', file: 'plugins/simulation/reveal-painter.mjs', needle: "\t\t\t\tdom.setAttribute('style', traceStyle(trace));", repl: '', groups: ['marks'] },
	{ id: 'mover-kind', what: 'a mover drawn without its kind', file: 'plugins/simulation/mover-painter.mjs', needle: "class: `mover ${spawner.kind || 'packet'}`", repl: "class: 'mover'", groups: ['loads', 'marks'] },
	{ id: 'datum', what: 'an editing visual misplaced: the datum', file: 'app/src/overlay.js', needle: 'transform: `translate(${pos.x},${pos.y})`', repl: 'transform: `translate(${pos.y},${pos.x})`', groups: ['transient targets'] },
	{ id: 'ghost', what: 'the stamp ghost left where it was made', file: 'app/src/tools.js', needle: 'this.handGhost?.moveTo(pos);', repl: '', groups: ['transient targets'] },
	// the verifier's seven survivors of the first record, and its fault the transit scenario now catches itself
	{ id: 'reflect-unmark', what: 'a reflection never taken away: a selection changed leaves its old path lit and its old blockers marked', file: 'app/src/renderer.js', needle: 'prev.forEach((id) => { if (!next.has(id)) this.setState(id, r.cls, false); });', repl: '', groups: ['states'],
		scenarios: ['states: on-selected-path, let go as the selection changes, then clears', 'states: blocking, let go as the selection changes, then clears'] },
	{ id: 'idle-not-cleared', what: 'a device\'s idle ring left when the pointer leaves it', file: 'app/src/overlay.js', needle: 'if (!on && idle) this.renderer.setState(hit.id, idle, false);', repl: '', groups: ['states'], scenarios: ['states: the idle ring, let go as the pointer leaves'] },
	{ id: 'load-keeps-stale', what: 'a load keeping the items of an entity the new document lacks', file: 'app/src/renderer.js', needle: 'for (const id of [...this.drawn.keys()]) this.remove(id);', repl: 'for (const id of [...this.drawn.keys()]) if (this.model.get(kindOf(id), id)) this.remove(id);', groups: ['loads'],
		scenarios: ['loads: the record\'s board swapped for one lacking a zone, a device, a waypoint, their links and two pipes, in view, edit and run'] },
	{ id: 'ring-offset-stale', what: 'a ring\'s dash offset left when an update takes its head away', file: 'plugins/network/link-painter.mjs', needle: "if (head?.lineOffset) dom.setAttribute('stroke-dashoffset', head.lineOffset); else dom.removeAttribute('stroke-dashoffset');", repl: "if (head?.lineOffset) dom.setAttribute('stroke-dashoffset', head.lineOffset);", groups: ['changes in place'] },
	{ id: 'mover-reseed', what: 'packets left on a route that changed under them', file: 'plugins/simulation/mover-painter.mjs', needle: 'if (rec.d === paths.get(m.spawnerId)) continue;', repl: 'continue;', groups: ['changes in place'], scenarios: ['changes in place: a route changed while packets fly'] },
	{ id: 'root-run-mode', what: 'run mode not marked on the page\'s root', file: 'app/src/renderer.js', needle: "this.svg?.classList.toggle('run-mode', mode === 'run');", repl: '', groups: ['loads', 'pipe triggers, alone'] },
	{ id: 'labels-off', what: 'the labels never toggled off on the page\'s root', file: 'app/src/renderer.js', needle: "this.svg?.classList.toggle('labels-off', !this.labels);", repl: '', groups: ['changes in place'] },
	{ id: 'pipe-skip-node', what: 'the pipes not repainted on a node\'s change -- a transit toggled off', file: 'plugins/network/host.mjs', needle: '\tmodel.onChange(paint);\n', repl: "\tmodel.onChange((a, k) => { if (k !== 'node') paint(); });\n", groups: ['pipe triggers, alone'], scenarios: ['pipe triggers, alone: a transit off and on'] },
];
// in the copy: every scenario of the groups named -- all, when none is -- run and compared with the record; prints each failing one's group and name
const RUNNER = `
import fs from 'node:fs';
const [root, record, move, ...groups] = process.argv.slice(1);
const m = await import(root + '/tests/fixtures/native-record.mjs');
const rec = JSON.parse(fs.readFileSync(record, 'utf8'));
const out = [];
for (const [name, sc] of Object.entries(m.scenarios())) {
	if (groups.length && !groups.includes(sc.group)) continue;
	let p;
	try { p = m.compareScenario(sc, rec.scenarios[name], m.runScenario(sc), { move }); } catch (e) { p = ['threw: ' + e.message]; }
	if (p.length) out.push([sc.group, name]);
}
console.log(JSON.stringify(out));
`;

let copy;
before(() => {
	copy = fs.mkdtempSync(path.join(os.tmpdir(), 'native-record-mutants-'));
	for (const p of TREE) fs.cpSync(path.join(ROOT, p), path.join(copy, p), { recursive: true });
	fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(copy, 'node_modules'));
});
after(() => { if (copy) fs.rmSync(copy, { recursive: true, force: true }); });

const run = (groups = []) => {
	const r = spawnSync(process.execPath, ['--input-type=module', '-e', RUNNER, copy, NATIVE_RECORD.pathname, MOVE, ...groups], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, NODE_TEST_CONTEXT: '' } });
	assert.equal(r.status, 0, r.stderr);
	return JSON.parse(r.stdout.trim().split('\n').at(-1));
};

test('the copy of the tree draws the record, unmutated -- the control', { timeout: 120000 }, () => {
	assert.deepEqual(run(), []);
});

for (const m of MUTANTS) {
	test(`a fault planted fails the record -- ${m.what}`, { timeout: 120000 }, () => {
		const file = path.join(copy, m.file), src = fs.readFileSync(file, 'utf8');
		assert.equal(src.split(m.needle).length - 1, 1, `${m.file}: the fault's place, found once`);
		fs.writeFileSync(file, src.replace(m.needle, () => m.repl));
		try {
			// the groups the fault belongs to, alone -- the control ran every group
			const failed = run(m.groups);
			assert.ok(failed.length > 0, `the record fails in ${m.groups.join(' or ')}`);
			for (const name of m.scenarios ?? []) assert.ok(failed.some(([, n]) => n === name), `and in "${name}", the scenario for it`);
		} finally { fs.writeFileSync(file, src); }
	});
}
