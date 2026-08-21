#!/usr/bin/env node
/*
scan-wiring — H9.16/B70. The composition root must pass what the thing it constructs destructures.

Every other scanner in the gate reads a module in isolation. None of them reads the ONE file whose
whole job is connecting modules together, and that is where the worst defect of the cloud cutover
lived: `server.js` called

    createApp({ ..., authz: Boolean(audience), owner, domains })

and never passed `audience`. `createApp`'s own `audience = ''` default stood, identity resolution
fell through to a stub returning null, and the service ran with the grant filter ON and no request
able to carry an identity. Every list was empty and every write refused, including the owner's.

Two properties made it invisible. `Boolean(audience)` reads as though the audience is handled --
the identifier is right there in the call. And every test constructs `createApp` directly with
`principalOf` injected, so the real wiring is exercised by nothing; 481 tests passed over it.

THE RULE

  For each parameter P that the constructed function destructures, if the composition root has a
  binding named P in scope, the call must pass P as a property.

That is deliberately narrow. It does not ask whether every parameter is passed -- most are
optional and absent on purpose. It asks whether the root went to the trouble of computing a value
and then failed to hand it over, which is the shape of a wiring mistake as opposed to a choice.
`Boolean(audience)` does not count as passing `audience`: an identifier inside an expression is a
use, not an argument, and conflating the two is exactly the misreading that shipped.

WHY A SCANNER AND NOT A TEST

A behavioural test cannot see this without standing up the real composition, and the real
composition needs IAP. The defect is textual, so the check is textual. This is the A14 move of
turning a lesson into an invariant rather than a patch: the class is closed, not the instance.
*/
import fs from 'node:fs';
import path from 'node:path';

// `--root <dir>` exists so the scanner can be run against a fixture. Without it the only way to
// test that this FAILS correctly is to corrupt the real server.js and hope the restore runs, and a
// check whose failure path is untested is the thing this scanner was written to prevent.
const rootArg = process.argv.indexOf('--root');
const ROOT = rootArg > -1 ? path.resolve(process.argv[rootArg + 1]) : path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/*
The pairs to check. Adding a row here is how a new composition root joins the gate.

`root` builds, `module` defines, `fn` is the factory. Kept explicit rather than discovered: a
scanner that guesses which file is a composition root would either miss one silently or flag every
call site in the tree, and both failures are worse than a list somebody has to extend.
*/
const PAIRS = [
	{ root: 'server/server.js', module: 'server/app.js', fn: 'createApp' },
];

// the destructured parameter names of `export ... function fn({ a, b = 1, c })`
function destructuredParams(src, fn) {
	const at = src.search(new RegExp(`function\\s+${fn}\\s*\\(`));
	if (at < 0) return null;
	const open = src.indexOf('{', at);
	if (open < 0) return null;
	let depth = 0, end = -1;
	for (let i = open; i < src.length; i++) {
		if (src[i] === '{') depth++;
		else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
	}
	if (end < 0) return null;
	return src.slice(open + 1, end)
		.split(',')
		.map((s) => s.split('=')[0].trim())
		.filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
}

// the property KEYS of the object literal passed at the call site -- `x`, `x: expr`, `...spread`
function passedKeys(src, fn) {
	const at = src.search(new RegExp(`\\b${fn}\\s*\\(\\s*\\{`));
	if (at < 0) return null;
	const open = src.indexOf('{', at);
	let depth = 0, end = -1;
	for (let i = open; i < src.length; i++) {
		if (src[i] === '{') depth++;
		else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
	}
	if (end < 0) return null;
	const body = src.slice(open + 1, end);
	const keys = new Set();
	let spread = false;
	// split on top-level commas only, so `authz: Boolean(a, b)` stays one property
	let buf = '', d = 0;
	const parts = [];
	for (const ch of body) {
		if ('([{'.includes(ch)) d++;
		else if (')]}'.includes(ch)) d--;
		if (ch === ',' && d === 0) { parts.push(buf); buf = ''; continue; }
		buf += ch;
	}
	parts.push(buf);
	for (const raw of parts) {
		const p = raw.trim();
		if (!p) continue;
		if (p.startsWith('...')) { spread = true; continue; }
		const key = p.includes(':') ? p.slice(0, p.indexOf(':')).trim() : p;
		if (/^[A-Za-z_$][\w$]*$/.test(key)) keys.add(key);
	}
	return { keys, spread };
}

// a binding the root actually computed: const/let/var NAME, or a destructured one
function rootBindings(src) {
	const names = new Set();
	for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
	for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
		for (const part of m[1].split(',')) {
			const n = part.split(':').pop().split('=')[0].trim();
			if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n);
		}
	}
	return names;
}

let bad = 0;
const fail = (msg) => { console.log(`  \u2717 ${msg}`); bad++; };
let checked = 0;

for (const { root, module: mod, fn } of PAIRS) {
	const rootSrc = read(root);
	const params = destructuredParams(read(mod), fn);
	if (!params) { fail(`${mod} does not define ${fn} with a destructured options object`); continue; }
	const call = passedKeys(rootSrc, fn);
	if (!call) { fail(`${root} does not call ${fn} with an object literal`); continue; }
	// a spread could supply anything, so the check cannot speak; say so rather than pass quietly
	if (call.spread) { console.log(`  - ${root} spreads into ${fn}; wiring not checkable`); continue; }

	const bindings = rootBindings(rootSrc);
	for (const p of params) {
		checked++;
		if (call.keys.has(p)) continue;
		if (!bindings.has(p)) continue;   // the root has no such value; not passing it is a choice
		fail(`${root} computes \`${p}\` but does not pass it to ${fn}() -- `
			+ `${mod} will fall back to its own default. Mentioning it inside an expression is not passing it.`);
	}
}

console.log(`\n  scan-wiring: ${PAIRS.length} composition root(s), ${checked} parameter(s) checked`);
console.log(bad
	? `  FAIL — ${bad} parameter(s) computed at the root and dropped on the way in`
	: '  PASS — every value the root computes reaches the thing it constructs');
process.exit(bad ? 1 : 0);
