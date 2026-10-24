#!/usr/bin/env node
/*
scan-layers -- H17 K0 (G13). The layer boundaries, as a gate rather than a diagram.

The layers and every list this scanner reads are DATA in `tools/layers.mjs` (the manifest). This
file owns the rules and nothing else, so a boundary moves by editing the manifest in the commit that
moves the code, and a reviewer sees both in one diff. The rules are those of the H17 plan
(`dev/design/h17/PLAN.md` section 3):

  L1   each module belongs to exactly one layer, no module sits outside every scanned folder, and
       every edge that lands in the tree lands on a module the scan reads, whatever its extension
  L2   imports follow the layer direction (ALLOWED); `import()` and `export ... from` are edges like
       any other. An edge nobody can read is refused: a non-literal specifier, and a specifier the
       scan cannot place (an absolute path, a URL, a path out of the repository, a package nobody
       declared). In the shipped and lab layers every other way to load code is refused too, and
       so is a literal holding import-shaped text
  L3   C9: `kernel/` and `model/` import nothing from each other
  L4   no barrel imports. A barrel is defined by STRUCTURE -- any module with a top-level
       `export ... from` or `export *` -- so a renamed or a new barrel is still a barrel
  L5   core exports no network name from the fixed list          PROXY: names, not meaning
  L5p  core exports no name matching the network pattern         PROXY: names, not meaning
  L6   each entry's closure equals its declared module list, and each page's scripts are exactly
       its entry's roots, with no inline code but the one import map inside its generated region (H26.1)
  L7   no batch module is reachable from a product root
  L7k  the product's kind lists equal exactly the five kinds, and so does the whole id grammar
       (C3); every other line naming all five kinds is a recorded consumer  PROXY: one line at a time
  L8   `lab/` is composition only: nothing imports it, it exports nothing, declares no class, and
       stays within its line budget
  L9   browser imports of rule primitives                         PROXY: an import, not a re-typing
  L10  export-level minimality per entry (H17-D9, specified by C2)  PROXY: a moved symbol is known
       by its name
  L11  no host read (`window`, `globalThis`, `self`, `global`) in core, network or planner; the
       canvas is a ratchet                                        PROXY: `top`, `parent`, `frames`
                                                                  are not read (see HOST)
  L12  H26.1: a component (COMPONENTS) is imported only by the parts that may, the package and its
       subpaths alike, never by a dynamic import (D7), and every @apnex/ dependency is a component

HOW EDGES ARE JUDGED. A specifier is resolved as the loaders resolve it: a query or fragment
(`./x.mjs?v`) names the same file, so it is dropped. L2 resolves an import THROUGH a barrel to the
module that defines each name, so a canvas module reaching the simulation through `engine/index.mjs`
is judged as the canvas reaching the simulation. Judging the barrel instead would call every barrel
import a direction violation and hide the real ones among them. The barrel's own re-exports are
edges too, judged the same way: a core barrel forwarding network code is core reaching the network.

RATCHETS. Where today's tree violates a rule the manifest records the violation per site, and the
record must EQUAL the measurement. A rise fails, and so does a fall that the manifest has not
recorded -- progress is written down in the commit that makes it, or it did not happen. Keyed by
site (`from -> to`, `file:name`), not by total, because a total holds still when one violation is
fixed and another added. A record may never sit above RATCHET_CEILING, the records as K0 froze them
(its hash is pinned in the tests), so a violation cannot be excused by raising its record. The hard
rules (L1, L3, L6, L7, L7k's lists, L8, L11 outside the canvas, L12, and the refused edges) have no
ratchet at all: the only way to excuse one is to edit this file.

NO PARSER DEPENDENCY. The repository ships no parser among its dependencies (`ws`, and since H26.1 its
components), so modules are read with the small tokenizer below rather than a vendored parser. Its
answers were compared with acorn 8 over every module in the tree -- static and dynamic edges, imported names, exports, re-exports, global
reads and kind lists -- and every difference traced to the comparison's own text matching, none to
the tokenizer. It decodes escapes in strings and identifiers as the language does, and tells a regex
from a division after `)` and `}` by what the bracket closed. What it does not do is parse: a
construct it has not seen could still mislead it, which is why an import-shaped literal in a shipped
module is refused rather than trusted, and why the check for the rest is to re-run the comparison,
not to trust this paragraph. What it cannot see at all is code that loads code at run time from a
string it builds (a Worker, a script element made in the DOM, a computed property name): those are
outside what a static scan reads.

Usage: node tools/scan-layers.mjs [--verbose] [--root <dir>] [--manifest <file.json>]
  --root      scan another tree (a fixture); the default is this repository
  --manifest  read the manifest from a JSON file of the same shape instead of tools/layers.mjs
*/

import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { execFileSync } from 'node:child_process';
import {
	ALLOWED, FOLDERS, UNSCANNED, LAYER, ENTRIES, PAGES, PRODUCT_LAYERS, RULES, RATCHETS, RATCHET_CEILING, UNUSED_EXPORTS, SCANNER_ROOTS,
	RATCHET_REASONS, COPIES, PARTS, COMPONENTS, MOVED,
} from './layers.mjs';
import { exceptionFaults } from './exceptions.mjs';
import { movedTo } from './records.mjs';   // H26.7: where a path the frozen K0 closure keeps is now
import { markersOf } from './regions.mjs';   // H26.1: the import map's generated region, the one place L6 admits an inline script
import { lex, isP, isId } from './js-tokens.mjs';   // the tokenizer, shared with tools/code-split.mjs

const argOf = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };
const verbose = process.argv.includes('--verbose');
const ROOT = argOf('--root') ? path.resolve(argOf('--root')) : path.resolve(import.meta.dirname, '..');
const manifestFile = argOf('--manifest');
const J = manifestFile ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
// a fixture manifest states only what its case needs; everything it omits is empty
const M = J ? {
	ALLOWED: J.ALLOWED ?? {}, FOLDERS: J.FOLDERS ?? [], UNSCANNED: J.UNSCANNED ?? {}, LAYER: J.LAYER ?? {},
	ENTRIES: J.ENTRIES ?? {}, PAGES: J.PAGES ?? {}, PRODUCT_LAYERS: J.PRODUCT_LAYERS ?? [], RULES: J.RULES ?? {}, RATCHETS: J.RATCHETS ?? {},
	RATCHET_CEILING: J.RATCHET_CEILING, UNUSED_EXPORTS: J.UNUSED_EXPORTS ?? {}, SCANNER_ROOTS: J.SCANNER_ROOTS ?? {},
	COPIES: J.COPIES ?? {}, PARTS: J.PARTS ?? {}, COMPONENTS: J.COMPONENTS ?? {}, MOVED: J.MOVED ?? {},
} : { ALLOWED, FOLDERS, UNSCANNED, LAYER, ENTRIES, PAGES, PRODUCT_LAYERS, RULES, RATCHETS, RATCHET_CEILING, UNUSED_EXPORTS, SCANNER_ROOTS, COPIES, PARTS, COMPONENTS, MOVED };
const R = M.RULES;

const literalOf = (t) => (t?.type === 'str' ? t.value : t?.type === 'tpl' && t.head && t.tail ? t.cooked : null);
const PAIR = { '(': ')', '[': ']', '{': '}', ')': '(', ']': '[', '}': '{' };
// the index of the bracket matching T[i], searching forward from an opener or back from a closer
function match(T, i) {
	const a = T[i].value, b = PAIR[a], step = '([{'.includes(a) ? 1 : -1;
	let d = 0;
	for (let k = i; k >= 0 && k < T.length; k += step) {
		if (T[k].type !== 'p') continue;
		if (T[k].value === a) d++;
		else if (T[k].value === b && --d === 0) return k;
	}
	return step > 0 ? T.length - 1 : 0;
}
// the keys a destructuring pattern `{ a, b: c, d = 1 }` reads; null when a rest element reads all
function patternKeys(T, o, c) {
	const keys = [];
	let d = 0;
	for (let k = o + 1; k < c; k++) {
		const t = T[k];
		if (t.type === 'p' && '([{'.includes(t.value)) { d++; continue; }
		if (t.type === 'p' && ')]}'.includes(t.value)) { d--; continue; }
		if (d !== 0) continue;
		if (isP(t, '...')) return null;
		if ((t.type === 'id' || t.type === 'str') && (isP(T[k - 1], '{') || isP(T[k - 1], ','))) keys.push(t.value);
	}
	return keys;
}
// the names a destructuring declaration binds
function bindingNames(T, o, c) {
	const out = [];
	for (let k = o + 1; k < c; k++) {
		const t = T[k], nx = T[k + 1];
		if (t.type !== 'id' || isP(T[k - 1], '.') || isP(T[k - 1], '=')) continue;
		if (nx?.type === 'p' && [',', '}', ']', '='].includes(nx.value)) out.push(t.value);
	}
	return out;
}

const STATEMENT_START = new Set(['export', 'import', 'const', 'let', 'var', 'function', 'class']);
const KIND_WORD = /^(node|waypoint|link|zone|group)s?$/;
/*
The names that reach the host object (L11). `window` and `globalThis` are the H17 plan's; `self`
and `global` are the same object under the names a worker and Node give it. `top`, `parent` and
`frames` are window aliases too, but they are also ordinary local names in this tree
(planner/log.mjs binds `top`), and the scanner does not resolve scopes: they are the proxy's gap.
*/
const HOST = new Set(['window', 'globalThis', 'self', 'global']);
/*
The ways to load code that are not `import`, `import()` or `export ... from`, each of which hides an
edge from every rule here. `createRequire` and `getBuiltinModule` are refused wherever they are
named, even as a property; `require`, `eval` and `Function` wherever they are read as bindings.
*/
const LOADER_ANYWHERE = new Set(['createRequire', 'getBuiltinModule']);
const LOADER_BINDING = new Set(['require', 'eval', 'Function']);
// text in a literal that reads as loading code: built from a string, or a line the tokenizer misread
const IMPORT_TEXT = /\bimport\s*\(|\bimport\b[^;]*?\bfrom\s*['"`]|\bexport\b[^;]*?\bfrom\s*['"`]|\brequire\s*\(/;

/*
One module, read once: its edges (static, re-export, dynamic) with the names each reads, its local
exports, its re-exports, its host reads, the loaders it names and the literals holding import-shaped
text, its top-level KINDS lists and regex constants, the lines naming all five kinds, whether it
declares a class, and how many lines carry code.
*/
function analyse(src) {
	const T = lex(src);
	const edges = [], local = [], reexports = [], globals = [], kinds = [], regexes = {}, loaders = [], texts = [];
	const kindLines = new Map();
	let depth = 0, classes = 0;
	/*
	The names a module binding `ns` reads, where `ns` is a namespace import or a module from
	`import()`, and `decl` is the token that declares it. `ns.name` reads one name; any other use --
	destructured, passed on, indexed, rebound, exported -- may read every name, so it returns null.
	Scopes are not resolved: another `const ns = ...` elsewhere is skipped, so its `ns.name` reads
	are counted here too (more names, never fewer), and any bare use of either returns null.
	*/
	const nsUses = (ns, decl) => {
		const names = new Set();
		for (let k = 0; k < T.length; k++) {
			if (k === decl || !isId(T[k], ns) || isP(T[k - 1], '.') || isP(T[k - 1], '?.')) continue;
			if (isP(T[k + 1], ':') && (isP(T[k - 1], '{') || isP(T[k - 1], ','))) continue;   // an object key spelled the same
			if (['const', 'let', 'var'].includes(T[k - 1]?.value) && isP(T[k + 1], '=')) continue;   // another binding of the name
			if ((isP(T[k + 1], '.') || isP(T[k + 1], '?.')) && T[k + 2]?.type === 'id') { names.add(T[k + 2].value); continue; }
			return null;
		}
		return [...names];
	};
	const noteKind = (t, word) => {
		const m = KIND_WORD.exec(word);
		if (!m) return;
		if (!kindLines.has(t.line)) kindLines.set(t.line, new Set());
		kindLines.get(t.line).add(m[1]);
	};
	for (let i = 0; i < T.length; i++) {
		const t = T[i];
		if (t.type === 'str' || t.type === 'id') noteKind(t, t.value);
		else if (t.type === 'tpl' && t.head && t.tail) noteKind(t, t.cooked);
		else if (t.type === 're') for (const w of t.value.match(/[a-z]+/g) || []) noteKind(t, w);
		const text = t.type === 'str' ? t.value : t.type === 'tpl' ? t.cooked : t.type === 're' ? t.value : null;
		if (text !== null && IMPORT_TEXT.test(text)) texts.push({ line: t.line, kind: { str: 'string', tpl: 'template', re: 'regex' }[t.type] });

		if (t.type === 'p') {
			if ('([{'.includes(t.value)) depth++;
			else if (')]}'.includes(t.value)) depth--;
			continue;
		}
		if (t.type !== 'id') continue;
		const prev = T[i - 1], next = T[i + 1];
		const member = isP(prev, '.') || isP(prev, '?.');
		const key = isP(next, ':') && (isP(prev, '{') || isP(prev, ','));
		/*
		`class:` as an OBJECT KEY is not a class declaration. The lab's pipe painter builds an SVG
		element with `{ class: 'pipe' }` -- the attribute, which is how every painter in this repo
		names a style -- and L8 read it as a class and refused the lab. `key` is computed on the line
		above precisely to tell `{ window: 1 }` from a read of the host; the class check simply never
		used it. Same exclusion, same reason.
		*/
		if (t.value === 'class' && !member && !key) classes++;
		// a read of the host, not a property named after it: `x.window`, `{ window: 1 }` are neither
		if (HOST.has(t.value) && !member && !key) globals.push({ name: t.value, line: t.line });
		if (LOADER_ANYWHERE.has(t.value) || (LOADER_BINDING.has(t.value) && !member && !key)) loaders.push({ name: t.value, line: t.line });

		if (t.value === 'import' && !isP(prev, '.') && isP(next, '(')) {
			const o = i + 1, c = match(T, o);
			const spec = c === o + 2 || (c > o + 2 && isP(T[o + 2], ',')) ? literalOf(T[o + 1]) : null;
			let names = null;
			let k = i - 1;
			if (isId(T[k], 'await')) k--;
			const whole = !isP(T[c + 1], '.') && !isP(T[c + 1], '?.') && !isP(T[c + 1], '[');   // the module, not a .then() of it
			if (whole && isP(T[k], '=') && isP(T[k - 1], '}')) names = patternKeys(T, match(T, k - 1), k - 1);
			else if (whole && isP(T[k], '=') && isId(T[k - 1]) && (['const', 'let', 'var'].includes(T[k - 2]?.value) || isP(T[k - 2], ','))) names = nsUses(T[k - 1].value, k - 1);
			else if (isP(T[k], '(') && isP(T[c + 1], ')') && isP(T[c + 2], '.') && T[c + 3]?.type === 'id') names = [T[c + 3].value];
			edges.push({ kind: 'dynamic', spec, expr: src.slice(T[o].end, T[c].start).trim(), line: t.line, names });
			continue;
		}
		if (depth !== 0) continue;
		if (t.value === 'import' && !isP(prev, '.') && !isP(next, '.')) {
			let j = i + 1;
			let names = [];
			if (T[j]?.type !== 'str') {
				while (j < T.length && !(isId(T[j], 'from') && T[j + 1]?.type === 'str')) {
					if (isP(T[j], '*') && isId(T[j + 1], 'as')) {
						const u = nsUses(T[j + 2].value, j + 2);
						names = u === null || names === null ? null : [...names, ...u];
						j += 3; continue;
					}
					if (isP(T[j], '{')) {
						const c = match(T, j);
						for (let k = j + 1; k < c; k++) {
							if ((T[k].type === 'id' || T[k].type === 'str') && (isP(T[k - 1], '{') || isP(T[k - 1], ','))) names?.push(T[k].value);
						}
						j = c + 1; continue;
					}
					if (T[j].type === 'id' && (isP(T[j + 1], ',') || isId(T[j + 1], 'from'))) names?.push('default');
					j++;
				}
				j++;
			}
			edges.push({ kind: 'import', spec: T[j]?.value, line: t.line, names });
			continue;
		}
		if (t.value === 'export' && !isP(prev, '.')) {
			let j = i + 1;
			if (isP(T[j], '*')) {
				let as = null;
				if (isId(T[j + 1], 'as')) { as = T[j + 2].value; j += 2; }
				const spec = T[j + 2]?.value;
				reexports.push({ exported: as || '*', imported: '*', spec, line: t.line });
				edges.push({ kind: 'reexport', spec, line: t.line, names: null });
				continue;
			}
			if (isP(T[j], '{')) {
				const c = match(T, j);
				const pairs = [];
				for (let k = j + 1; k < c; k++) {
					if ((T[k].type === 'id' || T[k].type === 'str') && (isP(T[k - 1], '{') || isP(T[k - 1], ','))) {
						pairs.push({ imported: T[k].value, exported: isId(T[k + 1], 'as') ? T[k + 2].value : T[k].value });
					}
				}
				if (isId(T[c + 1], 'from') && T[c + 2]?.type === 'str') {
					const spec = T[c + 2].value;
					for (const p of pairs) reexports.push({ ...p, spec, line: t.line });
					edges.push({ kind: 'reexport', spec, line: t.line, names: pairs.map((p) => p.imported) });
				} else local.push(...pairs.map((p) => p.exported));
				continue;
			}
			if (isId(T[j], 'default')) { local.push('default'); continue; }
			if (isId(T[j], 'async')) j++;
			if (isId(T[j], 'function') || isId(T[j], 'class')) {
				j++;
				if (isP(T[j], '*')) j++;
				if (T[j]?.type === 'id') local.push(T[j].value);
				continue;
			}
			if (['const', 'let', 'var'].includes(T[j]?.value)) {
				j++;
				while (j < T.length) {
					if (isP(T[j], '{') || isP(T[j], '[')) { const c = match(T, j); local.push(...bindingNames(T, j, c)); j = c + 1; }
					else if (T[j].type === 'id') { local.push(T[j].value); j++; }
					if (!isP(T[j], '=')) break;
					j++;
					// skip the initializer: to a `,` or `;` at its own depth, or a statement on a new line
					let d = 0, stop = false;
					for (; j < T.length; j++) {
						const u = T[j];
						if (u.type === 'p' && '([{'.includes(u.value)) d++;
						else if (u.type === 'p' && ')]}'.includes(u.value)) { if (d === 0) { stop = true; break; } d--; }
						else if (d === 0 && isP(u, ';')) { stop = true; break; }
						else if (d === 0 && isP(u, ',')) break;
						else if (d === 0 && u.type === 'id' && STATEMENT_START.has(u.value) && u.line > T[j - 1].line) { stop = true; break; }
					}
					if (stop || !isP(T[j], ',')) break;
					j++;
				}
			}
			continue;
		}
		if (['const', 'let', 'var'].includes(t.value) && T[i + 1]?.type === 'id' && isP(T[i + 2], '=')) {
			const name = T[i + 1].value, v = T[i + 3];
			if (name === 'KINDS' && isP(v, '[')) {
				const c = match(T, i + 3);
				const list = [];
				for (let k = i + 4; k < c; k++) if (!isP(T[k], ',')) list.push(literalOf(T[k]));
				kinds.push({ line: t.line, list });
			}
			if (v?.type === 're') regexes[name] = { line: t.line, body: v.value, flags: v.flags };
		}
	}
	const codeLines = new Set(T.map((t) => t.line)).size;
	const kindSites = [...kindLines].filter(([, s]) => s.size === 5).map(([l]) => l).sort((a, b) => a - b);
	return { edges, local, reexports, globals, loaders, texts, kinds, regexes, kindSites, classes, codeLines };
}

// ---------------------------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------------------------
const JS = /\.(js|mjs)$/;
const HTML = /\.html?$/i;
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
function walk(rel, out = [], skip = [], want = JS) {
	if (!exists(rel)) return out;
	for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		const p = rel ? `${rel}/${e.name}` : e.name;
		if (skip.some((s) => p === s || p.startsWith(`${s}/`))) continue;
		if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p, out, skip, want); }
		else if (want.test(e.name)) out.push(p);
	}
	return out;
}

const findings = [];                       // { rule, text, lines: [] }
const fail = (rule, text, lines = []) => findings.push({ rule, text, lines });
const measured = {};                       // rule -> Map(key -> [site texts]) for the ratcheted rules
const note = (rule, key, site) => {
	measured[rule] ??= new Map();
	if (!measured[rule].has(key)) measured[rule].set(key, []);
	measured[rule].get(key).push(site);
};
const report = [];                         // verbose lines

const layerOf = {};                        // module -> layer
const folderOf = {};                       // module -> the FOLDERS entry that holds it
const skipped = M.FOLDERS.flatMap((f) => f.skip ?? []);
// LAYER is { layer: [modules] }; a module listed under two layers is kept at its first and reported by L1
const listedLayer = {}, listedTwice = [];
for (const [layer, files] of Object.entries(M.LAYER)) {
	for (const file of files) {
		if (listedLayer[file]) listedTwice.push(`${file} is listed in LAYER under both ${listedLayer[file]} and ${layer}`);
		else listedLayer[file] = layer;
	}
}
for (const f of M.FOLDERS) {
	for (const file of walk(f.dir, [], f.skip ?? [])) {
		if (folderOf[file]) continue;       // a folder listed inside another is read once
		folderOf[file] = f;
	}
}
const modules = Object.keys(folderOf).sort();
const A = {};
for (const file of modules) A[file] = analyse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

/*
Resolve a specifier to { to } (a repository-relative path), { external } (a builtin, or a package
package.json declares), or { refused } with the reason. Every specifier is one of the three: one the
scan cannot place is refused, because an edge it cannot place is an edge no rule judges.

A query or fragment is dropped before resolving: Node loads `./x.mjs?v` and the server serves it by
its pathname, so it is the same module. A relative path that climbs out of the repository is refused
rather than ignored, because a browser clamps `..` at the site root and the path can still land in a
served folder. An absolute path, a URL and a package subpath import (`#x`) are refused, not mapped.
*/
const PACKAGE = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')); } catch { return {}; } })();
const DEPENDENCIES = new Set(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].flatMap((k) => Object.keys(PACKAGE[k] ?? {})));
const CODE_LOADING_BUILTINS = new Set(['module', 'vm']);   // createRequire, register(), runInThisContext: loading outside import
function resolveSpec(from, spec) {
	if (/^\.{1,2}\//.test(spec)) {
		const p = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec.replace(/[?#][\s\S]*$/, '')));
		return p === '..' || p.startsWith('../') ? { refused: 'a relative path that climbs out of the repository' } : { to: p };
	}
	if (spec.startsWith('/')) return { refused: 'an absolute path, which the scan does not map to a folder' };
	if (spec.startsWith('#')) return { refused: 'a package subpath import, which the scan does not map to a folder' };
	if (/^[a-z][a-z0-9+.-]*:/i.test(spec) && !spec.startsWith('node:')) return { refused: 'a URL' };
	const bare = spec.replace(/^node:/, '');
	const pkg = bare.startsWith('@') ? bare.split('/').slice(0, 2).join('/') : bare.split('/')[0];
	if (spec.startsWith('node:') || builtinModules.includes(pkg)) {
		return CODE_LOADING_BUILTINS.has(pkg) ? { external: true, loader: `node:${pkg}` } : { external: true };
	}
	// H26.1: a component is resolved as every declared package is, the package and its subpaths alike, and judged by L12
	if (DEPENDENCIES.has(pkg)) return M.COMPONENTS[pkg] ? { external: true, component: pkg } : { external: true };
	return { refused: 'neither a builtin nor a package that package.json declares' };
}
for (const file of modules) {
	for (const x of [...A[file].edges, ...A[file].reexports]) {
		if (typeof x.spec !== 'string') { x.to = null; continue; }
		const r = resolveSpec(file, x.spec);
		x.to = r.to ?? null;
		if (r.refused) x.refused = r.refused;
		if (r.loader) x.loader = r.loader;
		if (r.component) x.component = r.component;
	}
}

const isBarrel = (f) => A[f] && A[f].reexports.length > 0;
const exportsCache = {};
function exportsOf(f, seen = new Set()) {
	if (exportsCache[f]) return exportsCache[f];
	if (!A[f] || seen.has(f)) return new Set();
	seen.add(f);
	const out = new Set(A[f].local);
	for (const r of A[f].reexports) {
		if (r.exported !== '*') out.add(r.exported);
		else if (r.to) for (const n of exportsOf(r.to, seen)) if (n !== 'default') out.add(n);
	}
	return (exportsCache[f] = out);
}
// the module that DEFINES `name` as exported by `f`, following re-exports
function definer(f, name, seen = new Set()) {
	if (!A[f] || seen.has(f)) return f;
	seen.add(f);
	if (A[f].local.includes(name)) return f;
	for (const r of A[f].reexports) {
		if (r.exported === name && r.imported !== '*') return r.to ? definer(r.to, r.imported, seen) : f;
		if (r.exported === name && r.imported === '*') return r.to ?? f;
	}
	for (const r of A[f].reexports) if (r.exported === '*' && r.to && exportsOf(r.to).has(name)) return definer(r.to, name, seen);
	return f;
}
// the modules an import site actually depends on: through a barrel to each name's definer
function targetsOf(e) {
	if (!isBarrel(e.to)) return [e.to];
	const names = e.names === null ? [...exportsOf(e.to)] : e.names;
	if (!names.length) return [e.to];
	return [...new Set(names.map((n) => definer(e.to, n)))];
}
const site = (file, e) => `${file}:${e.line} ${e.kind === 'dynamic' ? `import(${e.spec === null ? e.expr : `'${e.spec}'`})` : e.kind === 'reexport' ? `export from '${e.spec}'` : `import '${e.spec}'`}`;

// ---------------------------------------------------------------------------------------------
// The rules. Each is one function, so a rule can be switched off in one place to prove its test.
// ---------------------------------------------------------------------------------------------
const RATCHETED = ['L2', 'L4', 'L5', 'L5p', 'L7k', 'L9', 'L11'];
// H26.1: the part each product module is in (tools/layers.mjs PARTS; a module path ending in `/` names every module under it)
const partOfModule = (file) => Object.entries(M.PARTS).find(([, p]) => p.modules.some((s) => (s.endsWith('/') ? file.startsWith(s) : file === s)))?.[0] ?? null;
const rules = {
	L1: () => {
		// the manifest may name only layers it defines, or a typo silently switches a rule off
		const known = new Set(Object.keys(M.ALLOWED));
		const named = [...Object.entries(M.ALLOWED).map(([l, to]) => [`ALLOWED.${l}`, to]), ['PRODUCT_LAYERS', M.PRODUCT_LAYERS],
			['RULES.L5.layers', R.L5?.layers], ['RULES.L9.layers', R.L9?.layers], ['RULES.L10.doors', R.L10?.doors],
			['RULES.L11.hard', R.L11?.hard], ['RULES.L11.ratchet', R.L11?.ratchet], ['RULES.L2.plain', R.L2?.plain],
			['LAYER', Object.keys(M.LAYER)],
			...Object.entries(M.ENTRIES).map(([id, e]) => [`ENTRIES.${id}.layers`, e.layers])];
		for (const [where, list] of named) for (const x of list ?? []) if (!known.has(x)) fail('L1', `${where} names '${x}', which is not a layer`);
		for (const k of Object.keys(M.RATCHETS)) if (!RATCHETED.includes(k)) fail('L1', `RATCHETS.${k} is not a ratcheted rule (${RATCHETED.join(' ')})`);
		for (const k of Object.keys(M.RATCHET_CEILING ?? {})) if (!RATCHETED.includes(k)) fail('L1', `RATCHET_CEILING.${k} is not a ratcheted rule (${RATCHETED.join(' ')})`);
		if (!M.RATCHET_CEILING && Object.values(M.RATCHETS).some((r) => Object.keys(r).length)) {
			fail('L1', 'RATCHETS records violations and RATCHET_CEILING is not declared -- without the frozen ceiling a record can be raised to excuse a new violation');
		}
		for (const text of listedTwice) fail('L1', text);
		for (const file of modules) {
			const byFolder = folderOf[file].layer;
			const byFile = listedLayer[file];
			if (byFolder && byFile) fail('L1', `${file} has two layers: ${byFolder} by its folder and ${byFile} by LAYER`);
			const layer = byFolder ?? byFile;
			if (!layer) { fail('L1', `${file} has no layer -- add it to LAYER in the manifest, with a reason if the placement is not obvious`); continue; }
			if (!M.ALLOWED[layer]) fail('L1', `${file} is in layer '${layer}', which ALLOWED does not define`);
			layerOf[file] = layer;
		}
		for (const file of Object.keys(listedLayer)) if (!A[file]) fail('L1', `LAYER names ${file}, which is not a module in any scanned folder -- a stale entry, or a folder missing from FOLDERS`);
		// a module outside every scanned folder is judged by nothing; say so rather than skip it
		const unscanned = Object.keys(M.UNSCANNED);
		for (const file of walk('', [], [...unscanned, ...skipped])) {
			if (!folderOf[file]) fail('L1', `${file} is outside every folder in FOLDERS -- add its folder, or record it in UNSCANNED with the reason`);
		}
		/*
		H26.7 (the verifier's V2): MOVED says where a moved path is now, and L10 and scan-designs read a recorded path through it. A key
		at a live path would make L10 read a module the closure still holds as departed -- the verifier's `'model/limits.mjs':
		'app/src/main.js'` let a refused listing through -- so each key is gone from the tree, each value is in it, a folder moves to
		a folder and a file to a file of its own name, and no key is a module the planner loads.
		RESTATED at H26.7's second verification (R2-2): "the tree" is what git tracks, as scan-docrefs reads it, so an untracked
		leftover at an old place (an editor's `network/.view.mjs.swp`) is not a path still there. Where there is no git -- a copy of
		the tree, as the mutants below run in -- the files on disk stand in for it, as scan-board skips its git question there.
		*/
		const tracked = trackedFiles();
		const inTree = (rel) => (tracked ? tracked.files.has(rel) || tracked.dirs.has(rel) : exists(rel));
		const isDir = (rel) => (tracked ? tracked.dirs.has(rel) : exists(rel) && fs.statSync(path.join(ROOT, rel)).isDirectory());
		for (const [k, v] of Object.entries(M.MOVED ?? {})) {
			const folder = k.endsWith('/');
			if (inTree(k.replace(/\/$/, ''))) fail('L1', `MOVED names ${k}, which is in the tree -- a moved path is gone from its old place`);
			if (!inTree(v.replace(/\/$/, ''))) fail('L1', `MOVED moves ${k} to ${v}, which is not in the tree`);
			else if (folder !== v.endsWith('/') || folder !== isDir(v.replace(/\/$/, ''))) fail('L1', `MOVED moves ${k} to ${v} -- a folder moves to a folder, a file to a file`);
			if (!folder && path.posix.basename(k) !== path.posix.basename(v)) fail('L1', `MOVED moves ${k} to ${v}, another file name -- a move keeps the name`);
			const loaded = (M.ENTRIES.planner?.modules ?? []).filter((m) => m === k || (folder && m.startsWith(k)));
			if (loaded.length) fail('L1', `MOVED names ${k}, which the planner loads (${loaded.join(', ')}) -- L10 would read a module its closure holds as departed`);
		}
		/*
		H26.7, RESTATED at its second verification (R2-1): a scanner's list names folders in FOLDERS, and still reaches every path MOVED
		took out of a folder it names -- a listed folder or module holds it -- so a move cannot quietly take a module out of a scan (V1(b)
		was scan-writers losing model/'s reveal module). scan-writers' list may also name a module, its walk reading a file root, but
		only one MOVED took out of a folder the list names: its modules are its folders' moved files, exactly, so a module entry cannot
		narrow a folder to one file (`'model/ops.mjs'` for `'model'`, which origin/main refused).
		*/
		const isFolder = (d) => M.FOLDERS.some((f) => f.dir === d);
		for (const [scanner, dirs] of Object.entries(M.SCANNER_ROOTS)) {
			const folders = dirs.filter(isFolder);
			const owed = Object.entries(M.MOVED ?? {}).filter(([k]) => folders.some((f) => k.startsWith(`${f}/`))).map(([, v]) => v.replace(/\/$/, ''));
			for (const d of dirs) {
				if (isFolder(d) || (scanner === 'writers' && folderOf[d] && owed.includes(d))) continue;
				fail('L1', `SCANNER_ROOTS.${scanner} names ${d}, which is not a folder in FOLDERS${scanner === 'writers' ? ', nor a module MOVED took out of a folder the list names' : ''}`);
			}
			for (const o of owed) if (!dirs.some((d) => o === d || o.startsWith(`${d}/`))) fail('L1', `SCANNER_ROOTS.${scanner} no longer reaches ${o}, which MOVED took out of a folder it names -- name it, or the folder it is in`);
		}
		if (M.SCANNER_ROOTS.dead) {
			for (const f of M.FOLDERS) {
				if (f.layer === 'tests' || M.SCANNER_ROOTS.dead.includes(f.dir)) continue;
				fail('L1', `${f.dir} is a scanned folder that scan-dead does not read (SCANNER_ROOTS.dead) -- its exports would be judged by nothing`);
			}
		}
		// whatever the extension: a `.cjs`, `.json` or `.ts` target is code (or data) no rule here reads
		for (const file of modules) for (const e of A[file].edges) {
			if (e.to && !A[e.to]) fail('L1', `${site(file, e)} reaches ${e.to}, which is ${!exists(e.to) ? 'not on disk' : JS.test(e.to) ? 'outside every scanned folder' : 'not a module the scan reads'}`);
		}
	},

	/*
	The direction, and the edges nobody can judge. A re-export is an edge like an import: a core
	barrel that re-exports network code is core reaching the network (the attack's A5), whoever
	imports it. A refused specifier, a loader other than import, and a literal holding import-shaped
	text are refused outright -- the last because it is either code built from a string or a line
	the tokenizer misread, and in both cases an import the rules cannot see.
	*/
	L2: () => {
		const plain = R.L2?.plain ?? [];
		for (const file of modules) {
			const from = layerOf[file];
			const strict = plain.includes(from);
			for (const e of A[file].edges) {
				if (e.kind === 'dynamic' && e.spec === null) { fail('L2', `${site(file, e)} -- a non-literal specifier is an edge nobody can judge; import a literal path`); continue; }
				if (e.refused) { fail('L2', `${site(file, e)} -- '${e.spec}' is ${e.refused}: an edge nobody can judge; import a relative path to the module`); continue; }
				if (e.loader && strict) { fail('L2', `${site(file, e)} -- ${e.loader} loads code outside import: an edge nobody can judge`); continue; }
				if (!e.to || !A[e.to]) continue;
				for (const t of targetsOf(e)) {
					const to = layerOf[t];
					if (from && to && !M.ALLOWED[from]?.includes(to)) note('L2', `${file} -> ${t}`, `${site(file, e)} (${from} -> ${to})`);
				}
			}
			if (!strict) continue;
			for (const x of A[file].loaders) fail('L2', `${file}:${x.line} names ${x.name}, which loads code outside import -- an edge nobody can judge`);
			for (const x of A[file].texts) fail('L2', `${file}:${x.line} a ${x.kind} literal holds import-shaped text -- code built from a string, or a line the scan misread; either way an edge nobody can judge`);
		}
	},

	L3: () => {
		// H26.7: a side is a top-level folder, or a list of it and the modules that left it and stay held (plugins/simulation/reveal.mjs)
		const [a, b] = (R.L3?.folders ?? []).map((s) => [].concat(s));
		if (!a) return;
		const on = (f, side) => f.split('/')[0] === side[0] || side.slice(1).includes(f);
		const name = (side) => `${side[0]}/${side.length > 1 ? ` (with ${side.slice(1).join(', ')})` : ''}`;
		for (const file of modules) for (const e of A[file].edges) {
			if (!e.to) continue;
			if ((on(file, a) && on(e.to, b)) || (on(file, b) && on(e.to, a))) fail('L3', `${site(file, e)} -- ${name(a)} and ${name(b)} import nothing from each other (C9)`);
		}
	},

	L4: () => {
		/*
		H26.3's verification (V6): the one named exception, RULES.L4.verbatim -- a copy kept verbatim and the shims answering its imports,
		each held to its form, then left uncounted: a shim's re-exports, and its copy's imports of it. Nothing else is excused.
		*/
		const SHIM = /^(?:export\s*\{\s*[\w$]+(?:\s+as\s+[\w$]+)?(?:\s*,\s*[\w$]+(?:\s+as\s+[\w$]+)?)*\s*\}\s*from\s*(['"])[^'"\n]+\1\s*;\s*)+$/;
		const shimOf = new Map();   // an admitted shim -> its copy
		for (const v of R.L4?.verbatim ?? []) {
			const where = `RULES.L4.verbatim ${v.copy}`;
			const shims = v.shims ?? [];
			if (!shims.length) fail('L4', `${where} names no shim`);
			let named = true;
			for (const f of [v.copy, ...shims]) {
				if (!A[f]) { fail('L4', `${where} names ${f}, which is not a module in the scan`); named = false; continue; }
				if (layerOf[f] !== 'tests') { fail('L4', `${where} names ${f}, a module of layer ${layerOf[f]} -- a verbatim copy and its shims are tests' alone`); named = false; }
			}
			if (!named) continue;
			for (const s of shims) {
				const text = fs.readFileSync(path.join(ROOT, s), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
				if (!SHIM.test(text)) { fail('L4', `${where}: ${s} is no shim -- a shim holds re-exports by name and nothing else, declaring and importing nothing`); continue; }
				if (!A[v.copy].edges.some((e) => e.to === s)) { fail('L4', `${where}: ${v.copy} imports no ${s} -- a stale shim`); continue; }
				shimOf.set(s, v.copy);
			}
		}
		for (const file of modules) {
			// one count per re-exported name (or `*`), so a barrel that grows is a rise, not the same barrel
			if (isBarrel(file) && !shimOf.has(file)) for (const r of A[file].reexports) note('L4', `barrel ${file}`, `${file}:${r.line} export ${r.imported === '*' ? (r.exported === '*' ? '*' : `* as ${r.exported}`) : r.imported === r.exported ? r.exported : `${r.imported} as ${r.exported}`} from '${r.spec}'`);
			for (const e of A[file].edges) if (e.to && isBarrel(e.to) && shimOf.get(e.to) !== file) note('L4', `${file} -> ${e.to}`, site(file, e));
		}
	},

	L5: () => {
		const layers = R.L5?.layers ?? [];
		const names = new Set(R.L5?.names ?? []);
		const pattern = R.L5?.pattern ? new RegExp(R.L5.pattern, 'i') : null;
		for (const file of modules) {
			if (!layers.includes(layerOf[file])) continue;
			for (const n of exportsOf(file)) {
				if (names.has(n)) note('L5', `${file}:${n}`, `${file} exports ${n}`);
				if (pattern?.test(n)) note('L5p', `${file}:${n}`, `${file} exports ${n}`);
			}
		}
	},

	L6: () => {
		for (const [id, entry] of Object.entries(M.ENTRIES)) {
			const got = closure(entry.roots);
			const want = new Set(entry.modules ?? []);
			for (const m of entry.roots) if (!A[m]) fail('L6', `entry ${id}: root ${m} is not a scanned module`);
			for (const m of [...got].sort()) if (!want.has(m)) fail('L6', `entry ${id} loads ${m}, which its declared list does not name`);
			for (const m of [...want].sort()) if (!got.has(m)) fail('L6', `entry ${id} declares ${m}, which it no longer loads -- remove it from the list`);
			if (entry.layers) for (const m of got) if (!entry.layers.includes(layerOf[m])) fail('L6', `entry ${id} loads ${m} (${layerOf[m]}), a layer it may not load`);
			report.push(`  L6 entry ${id}: ${got.size} module(s) from ${entry.roots.join(' + ')}`);
		}
		/*
		A page's scripts are its entry's roots, so they are declared too. Every HTML file in the tree is
		read: an inline script, an inline event handler or a `javascript:` URL is code no entry
		declares (the attack's A17), and a script tag loads exactly what PAGES says -- the entry's
		roots, found from each `src` against the folder the page's site root serves (`base`).
		*/
		const pages = walk('', [], [...Object.keys(M.UNSCANNED), ...skipped], HTML);
		for (const page of Object.keys(M.PAGES)) if (!pages.includes(page)) fail('L6', `PAGES declares ${page}, which is not a page in the tree`);
		/*
		H26.1 (SNAP-GRID.md section 7.6) -- ONE inline script is admitted: a declared page's `<script type="importmap">`, inside the region
		tools/import-map.mjs writes, the first there. L6 holds where it is; the generator's --check holds what it says. Every other import
		map -- a second one, one outside the region, one whose region's markers are gone -- is refused, and so is every other inline script.
		*/
		const mapRegion = M.COPIES.generated?.importmap ? markersOf('importmap', M.COPIES.generated.importmap) : null;
		for (const page of pages) {
			const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
			const lineAt = (i) => html.slice(0, i).split('\n').length;
			const srcs = [];
			const begin = mapRegion && M.PAGES[page] ? html.indexOf(mapRegion.begin) : -1;
			const end = begin >= 0 ? html.indexOf(mapRegion.end, begin) : -1;
			let admitted = false;
			for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)(?:<\/script\s*>|$)/gi)) {
				const src = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(` ${m[1]}`);
				if (src) { srcs.push({ src: src[1] ?? src[2] ?? src[3], line: lineAt(m.index) }); continue; }
				if (/\btype\s*=\s*["']?importmap\b/i.test(m[1])) {
					const inRegion = end > begin && m.index > begin && m.index + m[0].length <= end;
					if (inRegion && !admitted && m[1].trim() === 'type="importmap"') { admitted = true; continue; }
					fail('L6', `${page}:${lineAt(m.index)} an import map outside the generated region, or a second one -- a page holds one, written by node tools/import-map.mjs`);
					continue;
				}
				if (m[2].trim()) fail('L6', `${page}:${lineAt(m.index)} an inline <script> is code no entry declares -- move it into a module the page's entry loads`);
			}
			for (const m of html.matchAll(/<[a-z][^>]*?\son[a-z]+\s*=/gi)) fail('L6', `${page}:${lineAt(m.index)} an inline event handler is code no entry declares`);
			for (const m of html.matchAll(/javascript:/gi)) fail('L6', `${page}:${lineAt(m.index)} a javascript: URL is code no entry declares`);
			const decl = M.PAGES[page];
			if (!decl) { for (const s of srcs) fail('L6', `${page}:${s.line} loads ${s.src}, and PAGES does not declare the page`); continue; }
			const got = srcs.map((s) => s.src);
			if (JSON.stringify(got) !== JSON.stringify(decl.scripts ?? [])) fail('L6', `${page} loads ${JSON.stringify(got)}, not the ${JSON.stringify(decl.scripts ?? [])} PAGES declares`);
			const entry = M.ENTRIES[decl.entry];
			if (!entry) { fail('L6', `PAGES['${page}'] names entry ${decl.entry}, which ENTRIES does not declare`); continue; }
			const roots = [...new Set(got.map((s) => path.posix.join(s.startsWith('/') ? decl.base ?? '' : path.posix.dirname(page), s.replace(/[?#][\s\S]*$/, ''))))].sort();
			if (JSON.stringify(roots) !== JSON.stringify([...entry.roots].sort())) fail('L6', `${page} loads ${roots.join(' + ')}, and entry ${decl.entry}'s roots are ${entry.roots.join(' + ')}`);
		}
	},

	L7: () => {
		const batch = R.L7?.batch ?? [];
		for (const b of batch) if (!A[b]) fail('L7', `batch module ${b} is not a scanned module`);
		for (const root of R.L7?.roots ?? []) {
			if (!A[root]) { fail('L7', `product root ${root} is not a scanned module`); continue; }
			const reach = closure([root]);
			for (const b of batch) if (reach.has(b)) fail('L7', `batch module ${b} is reachable from the product root ${root}`);
		}
	},

	L7k: () => {
		const five = R.L7k?.kinds ?? [];
		const checked = new Set();
		for (const file of modules) {
			if (!M.PRODUCT_LAYERS.includes(layerOf[file]) && layerOf[file] !== 'lab') continue;
			for (const k of A[file].kinds) {
				checked.add(`${file}:${k.line}`);
				if (JSON.stringify(k.list) !== JSON.stringify(five)) fail('L7k', `${file}:${k.line} KINDS = ${JSON.stringify(k.list)}, not exactly ${JSON.stringify(five)}`);
			}
		}
		for (const g of R.L7k?.grammar ?? []) {
			const re = A[g.file]?.regexes[g.name];
			if (!re) { fail('L7k', `${g.file} has no top-level regex ${g.name} -- the id grammar moved; move this check with it`); continue; }
			checked.add(`${g.file}:${re.line}`);
			/*
			The WHOLE grammar, not its first group: `^(kinds)-[0-9a-f]{6}$|^pipe-[0-9a-f]{6}$` has the
			right first group and accepts a sixth kind (the attack's A6c). So the pattern must be
			exactly `^(` + the alternation + `)` + the declared rest, with the declared flags.
			*/
			const shape = /^\^\(([^()]*)\)([\s\S]*)$/.exec(re.body);
			const words = shape ? shape[1].split('|').sort() : [];
			const want = [...five, ...(g.others ?? [])].sort();
			if (!shape || shape[2] !== (g.rest ?? '') || (re.flags ?? '') !== (g.flags ?? '')) {
				fail('L7k', `${g.file}:${re.line} ${g.name} is /${re.body}/${re.flags ?? ''}, not exactly /^(<alternation>)${g.rest ?? ''}/${g.flags ?? ''} -- the grammar accepts its alternation and nothing beside it`);
			}
			if (JSON.stringify(words) !== JSON.stringify(want)) fail('L7k', `${g.file}:${re.line} ${g.name} accepts ${JSON.stringify(words)}, not exactly the kinds plus ${JSON.stringify(g.others ?? [])}`);
		}
		// U3 (H21.7): the lab's composition is scanned by L7k too, not only PRODUCT_LAYERS
		for (const file of modules) {
			if (!M.PRODUCT_LAYERS.includes(layerOf[file]) && layerOf[file] !== 'lab') continue;
			for (const l of A[file].kindSites) if (!checked.has(`${file}:${l}`)) note('L7k', file, `${file}:${l}`);
		}
	},

	L8: () => {
		const dir = R.L8?.dir;
		if (!dir) return;
		const inLab = (f) => f === dir || f.startsWith(`${dir}/`);
		const lab = modules.filter(inLab);
		let lines = 0;
		for (const file of modules) for (const e of A[file].edges) {
			if (e.to && inLab(e.to)) fail('L8', `${site(file, e)} imports the lab -- nothing imports a composition root`);
		}
		for (const file of lab) {
			const ex = exportsOf(file);
			if (ex.size) fail('L8', `${file} exports ${[...ex].join(', ')} -- the lab composes, it defines nothing`);
			if (A[file].classes) fail('L8', `${file} declares a class -- the lab composes, it defines nothing`);
			lines += A[file].codeLines;
		}
		if (lab.length && R.L8.budget == null) fail('L8', `${dir}/ holds ${lab.length} module(s) and RULES.L8.budget is not declared`);
		else if (lab.length && lines > R.L8.budget) fail('L8', `${dir}/ carries ${lines} code line(s), over its budget of ${R.L8.budget}`);
		report.push(`  L8 ${dir}/: ${lab.length} module(s), ${lines} code line(s)${R.L8.budget == null ? '' : ` of ${R.L8.budget}`}`);
	},

	L9: () => {
		const prim = R.L9?.primitives ?? {};
		for (const file of modules) {
			if (!(R.L9?.layers ?? []).includes(layerOf[file])) continue;
			for (const e of A[file].edges) {
				if (!e.to || !A[e.to] || e.kind === 'reexport') continue;
				const names = e.names === null ? [...exportsOf(e.to)] : e.names;
				for (const n of names) if (prim[n] && definer(e.to, n) === prim[n]) note('L9', `${file}:${n}`, `${site(file, e)} {${n}}`);
			}
		}
	},

	L10: () => {
		for (const [id, rec] of Object.entries(M.UNUSED_EXPORTS)) {
			const entry = M.ENTRIES[id];
			if (!entry) { fail('L10', `UNUSED_EXPORTS names entry ${id}, which ENTRIES does not declare`); continue; }
			const C = closure(entry.roots);
			const used = new Map([...C].map((m) => [m, new Set()]));
			const all = new Set();
			for (const m of C) for (const e of A[m].edges) {
				if (e.kind === 'reexport' || !used.has(e.to)) continue;
				if (e.names === null) all.add(e.to); else e.names.forEach((n) => used.get(e.to).add(n));
			}
			for (const [m, names] of Object.entries(entry.surface ?? {})) names.forEach((n) => used.get(m)?.add(n));
			// a re-export is used only when the name it forwards is used, so forward to a fixpoint
			for (let changed = true; changed;) {
				changed = false;
				for (const m of C) for (const r of A[m].reexports) {
					if (!used.has(r.to)) continue;
					const forward = (n) => { if (!used.get(r.to).has(n)) { used.get(r.to).add(n); changed = true; } };
					if (r.imported === '*' && r.exported !== '*') { if ((all.has(m) || used.get(m).has(r.exported)) && !all.has(r.to)) { all.add(r.to); changed = true; } }
					else if (r.imported === '*') { for (const n of exportsOf(r.to)) if (all.has(m) || used.get(m).has(n)) forward(n); }
					else if (all.has(m) || used.get(m).has(r.exported)) forward(r.imported);
				}
			}
			const unused = new Set();
			for (const m of C) if (!all.has(m)) for (const n of exportsOf(m)) if (!used.get(m).has(n)) unused.add(`${m}:${n}`);
			const listed = new Map();
			for (const [m, byTag] of Object.entries(rec.list ?? {})) for (const [tag, names] of Object.entries(byTag)) for (const n of names) listed.set(`${m}:${n}`, tag);
			const baseline = new Set(Object.entries(rec.baseline ?? {}).flatMap(([m, ns]) => ns.map((n) => `${m}:${n}`)));
			const nameOf = (k) => k.slice(k.lastIndexOf(':') + 1), modOf = (k) => k.slice(0, k.lastIndexOf(':'));
			/*
			C2(c), "or move with its symbol". A symbol is known here by its name (a PROXY), so a move is
			counted: each baseline entry whose module no longer exports that name has VACATED one place,
			and the listed entries outside the baseline may claim at most that many places per name. A
			new export that merely shares a baseline spelling (`check`, `render`) claims a place nobody
			vacated, and fails (the attack's A14).
			*/
			const vacated = new Map(), claimed = new Map();
			// a RETIRED name was deleted, not moved: it vacates nothing (UNUSED_EXPORTS.<entry>.retired, K12)
			const retired = new Set(rec.retired ?? []);
			for (const k of baseline) if (!exportsOf(modOf(k)).has(nameOf(k)) && !retired.has(nameOf(k))) vacated.set(nameOf(k), (vacated.get(nameOf(k)) ?? 0) + 1);
			/*
			K2c -- A VACATED PLACE IS TAKEN BY THE NAME'S REAL HOME, wherever in the product that is. Deleting the three
			barrels vacated every name they re-exported, about ninety, though they DEFINED only two (`render` and `check`,
			which moved). Counted against listed entries alone, each vacancy stood open, and any new export reusing one of
			those spellings was admitted -- A14 got through. So each product module that exports the name now, outside the
			baseline, claims a place: `cellOf`'s is taken by kernel/geometry.mjs, `render`'s by server/svg.mjs, `check`'s
			by kernel/grc.mjs, and nothing is left over for a borrowed spelling. A tightening: it admits nothing new.
			*/
			const homes = new Set();
			for (const m of Object.keys(layerOf)) if (M.PRODUCT_LAYERS.includes(layerOf[m])) for (const n of exportsOf(m)) if (vacated.has(n) && !baseline.has(`${m}:${n}`)) homes.add(`${m}:${n}`);
			for (const k of new Set([...homes, ...[...listed.keys()].filter((x) => !baseline.has(x))])) claimed.set(nameOf(k), (claimed.get(nameOf(k)) ?? 0) + 1);
			/*
			C2(c) EXTENDED, ruled by the director at K2a: A CONSUMER LEAVING THE CLOSURE ALSO VACATES.

			The original wording admitted a name two ways -- it was in the frozen baseline, or it moved
			with its symbol. K2a found a third. Seven names became unused because the modules that
			CALLED them left the planner closure while the modules that EXPORT them stayed. The name did
			not drift in; the cut removed its user. Every cut from K2b to K18 shrinks a closure, so this
			recurs by construction and is ruled once rather than excepted each time.

			WHY THIS NEEDS A FROZEN CLOSURE. "A consumer left" is a statement about a TRANSITION, and
			the manifest holds one state. Four attempts to judge it from the current tree all failed the
			same way: once the cut lands there is no record that `engine/` was ever in this closure, so
			the justification cannot be re-derived on the next run. Two of those attempts passed the
			scan while proving nothing -- one by reading the entry's own post-cut module list, which
			asks the manifest whether the manifest is right.

			So `k0closure` is frozen beside the baseline, written once at K0 and never edited, exactly
			as RATCHET_CEILING is. DEPARTED is then derivable forever: the K0 closure minus the current
			one. It is a weaker claim than "left at cut K7" -- it only says "left since K0" -- and that
			is the honest limit of what one frozen artifact can support.

			The clause is narrow on purpose. A departed module must IMPORT THIS NAME FROM THIS MODULE,
			which is checkable rather than inferred: the departed module is still on disk and its import
			is still readable. That is what refuses mutant A14, whose `check` is a new export no
			departed module ever imported -- a module-level test ("its module was in the baseline") let
			A14 through, which is the borrowed-spelling hole C2(c) exists to close.
			*/
			const k0 = new Set(rec.k0closure ?? []);
			// H26.7: the frozen list keeps the paths K0 knew (RU2); a module that moved is judged and read where it is now (MOVED)
			const departed = [...k0].map((m) => movedTo(m, M.MOVED)).filter((m) => !C.has(m));
			const byDeparture = (k) => departed.some((m) => (A[m]?.edges ?? []).some((e) =>
				e.kind !== 'reexport' && e.to === modOf(k) && (e.names === null || e.names.includes(nameOf(k)))));
			const tags = R.L10?.tags ?? [];
			for (const k of [...unused].sort()) {
				if (listed.has(k)) continue;
				const may = baseline.has(k) || (vacated.get(nameOf(k)) ?? 0) > (claimed.get(nameOf(k)) ?? 0) || byDeparture(k);
				fail('L10', `entry ${id}: ${k} is exported and unused inside the entry -- ${may ? 'list it (it is in the frozen K0 baseline, or a baseline symbol of that name left its module, or a baseline consumer left the closure), or give it a consumer' : 'give it a consumer or stop exporting it; it may not join the list, which grows only from the frozen K0 baseline (C2)'}`);
			}
			for (const [k, tag] of [...listed].sort()) {
				if (!unused.has(k)) fail('L10', `entry ${id}: ${k} is listed as unused and is not any more -- remove it from the list in this commit (C2)`);
				const n = nameOf(k), free = vacated.get(n) ?? 0, taken = claimed.get(n) ?? 0;
				if (!baseline.has(k) && taken > free && !byDeparture(k)) fail('L10', `entry ${id}: ${k} is listed but is not in the frozen K0 baseline, no baseline symbol of that name left its module for it (${free} vacated, ${taken} claimed), and its module is not one the closure dropped (C2)`);
				if (!tags.includes(tag)) fail('L10', `entry ${id}: ${k} is tagged '${tag}', not one of ${tags.join(', ')} (C2)`);
				if (tag === 'serves-a-server-door' && !servesDoor(modOf(k), nameOf(k))) fail('L10', `entry ${id}: ${k} is tagged serves-a-server-door and no ${(R.L10?.doors ?? []).join('/')} module imports it`);
			}
			report.push(`  L10 entry ${id}: ${C.size} module(s), ${[...C].reduce((s, m) => s + exportsOf(m).size, 0)} export(s), ${unused.size} unused inside the entry, ${listed.size} listed, frozen baseline ${baseline.size}`);
			measured.L10 ??= new Map();
			for (const k of unused) measured.L10.set(`${id} ${k}`, [listed.get(k) ?? 'UNLISTED']);
		}
	},

	L11: () => {
		const hard = R.L11?.hard ?? [], counted = R.L11?.ratchet ?? [];
		for (const file of modules) {
			const g = A[file].globals;
			if (!g.length) continue;
			if (hard.includes(layerOf[file])) for (const x of g) fail('L11', `${file}:${x.line} reads ${x.name} -- a ${layerOf[file]} module takes its host by injection`);
			if (counted.includes(layerOf[file])) for (const x of g) note('L11', file, `${file}:${x.line} ${x.name}`);
		}
	},

	/*
	H26.1 (SNAP-GRID.md section 7.7, D7) -- the components draw composes. A product module imports one only from a part COMPONENTS lets
	import it, the package and every subpath alike; the tools and the tests, which are no part, may import it, as they may import any
	layer. A dynamic import of one is refused everywhere: draw imports components only statically, so the whole of a component's graph
	loads with the page, and a page kept across a deploy never asks for a version the deploy removed (D7's second condition). And every
	@apnex/ dependency is declared here, so a component cannot be installed without saying who may import it.
	*/
	L12: () => {
		for (const [pkg, c] of Object.entries(M.COMPONENTS)) {
			if (!DEPENDENCIES.has(pkg)) fail('L12', `COMPONENTS declares ${pkg}, which package.json does not depend on`);
			for (const p of c.parts ?? []) if (!M.PARTS[p]) fail('L12', `COMPONENTS.${pkg} lets part ${p} import it, and PARTS holds no such part`);
		}
		for (const pkg of DEPENDENCIES) if (pkg.startsWith('@apnex/') && !M.COMPONENTS[pkg]) fail('L12', `package.json depends on ${pkg}, which COMPONENTS does not declare -- name the parts that may import it and the ruling that admits it`);
		for (const file of modules) for (const e of A[file].edges) {
			if (!e.component) continue;
			if (e.kind === 'dynamic') { fail('L12', `${site(file, e)} -- a component is imported statically (D7), so its whole graph loads with the page`); continue; }
			const part = partOfModule(file);
			if (part ? M.COMPONENTS[e.component].parts?.includes(part) : !M.PRODUCT_LAYERS.includes(layerOf[file]) && layerOf[file] !== 'lab') continue;
			fail('L12', `${site(file, e)} -- ${part ? `part ${part}` : `${file}, in no part,`} may not import the component ${e.component}; COMPONENTS lets ${(M.COMPONENTS[e.component].parts ?? []).join(', ') || 'no part'} import it`);
		}
	},
};

// H26.7 (R2-2): the files git tracks under ROOT, and their folders; null where there is no git (a copy of the tree), which is no fault
function trackedFiles() {
	try {
		const files = new Set(execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }).split('\0').filter(Boolean));
		const dirs = new Set([...files].flatMap((f) => f.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))));
		return { files, dirs };
	} catch (e) {
		if (/not a git repository|ENOENT/i.test(`${e.message} ${e.stderr ?? ''}`)) return null;
		fail('L1', `git ls-files could not run: ${e.message.split('\n')[0]}`);
		return null;
	}
}

function closure(roots) {
	const seen = new Set();
	const q = roots.filter((r) => A[r]);
	while (q.length) {
		const m = q.shift();
		if (seen.has(m)) continue;
		seen.add(m);
		for (const e of A[m].edges) if (e.to && A[e.to]) q.push(e.to);
	}
	return seen;
}
function servesDoor(m, name) {
	const doors = R.L10?.doors ?? [];
	for (const file of modules) {
		if (!doors.includes(layerOf[file])) continue;
		for (const e of A[file].edges) {
			if (!e.to || !A[e.to] || e.kind === 'reexport') continue;
			const names = e.names === null ? [...exportsOf(e.to)] : e.names;
			if (names.some((n) => n === name && definer(e.to, n) === definer(m, name))) return true;
		}
	}
	return false;
}

for (const fn of Object.values(rules)) fn();

// ---------------------------------------------------------------------------------------------
// Ratchets: the measurement must EQUAL the record, key by key
// ---------------------------------------------------------------------------------------------
const WHY = {
	L7k: { rise: 'a new line naming all five kinds -- read the kinds from the checked list, or record it as a consumer', fall: 'a consumer is gone -- remove it from RATCHETS.L7k' },
};
const totals = {};
for (const rule of RATCHETED) {
	const got = measured[rule] ?? new Map();
	const rec = M.RATCHETS[rule] ?? {};
	totals[rule] = [...got.values()].reduce((s, v) => s + v.length, 0);
	for (const key of [...new Set([...got.keys(), ...Object.keys(rec)])].sort()) {
		const n = got.get(key)?.length ?? 0, r = rec[key] ?? 0;
		if (n > r) fail(rule, `${key}: ${n}, recorded ${r} -- RISE: ${WHY[rule]?.rise ?? 'a ratchet may only fall'}`, got.get(key));
		else if (n < r) fail(rule, `${key}: ${n}, recorded ${r} -- FALL: ${WHY[rule]?.fall ?? `lower RATCHETS.${rule} in the manifest in this commit, so the progress is recorded`}`, got.get(key) ?? []);
		else if (verbose) report.push(`  ${rule.padEnd(4)} ${key}: ${n} (recorded)${n ? `\n${got.get(key).map((s) => `         ${s}`).join('\n')}` : ''}`);
	}
	/*
	A record that equals its measurement proves only that someone wrote both. RATCHET_CEILING is the
	record as K0 froze it, and tests/scan-layers.test.js pins its hash, so a record may only sit AT or
	BELOW it: raising a record to excuse a new violation (the attack's A9) fails here, and raising the
	ceiling as well means editing that test in the same diff.
	*/
	if (M.RATCHET_CEILING) {
		for (const [key, r] of Object.entries(rec)) {
			const c = M.RATCHET_CEILING[rule]?.[key];
			if (c === undefined) fail(rule, `${key}: recorded ${r}, a key the frozen K0 ceiling does not hold -- RAISED: a ratchet may only fall (RATCHET_CEILING)`);
			else if (r > c) fail(rule, `${key}: recorded ${r}, above its frozen K0 ceiling of ${c} -- RAISED: a ratchet may only fall (RATCHET_CEILING)`);
		}
	}
}

/*
H21.5 (R-b) -- the decoupling ratchets' reasons: a key of RATCHETS.L5p or L7k has one in RATCHET_REASONS and a reason has one in
RATCHETS, and every cited id resolves (tools/exceptions.mjs). Read for the real manifest over a tree holding the records; a fixture
manifest states counts, and a copy of the code without dev/ has no records to resolve against.
*/
if (!J && fs.existsSync(path.join(ROOT, 'dev/BACKLOG.md'))) {
	for (const rule of ['L5p', 'L7k']) {
		const counts = Object.keys(M.RATCHETS[rule] ?? {}), reasons = Object.keys(RATCHET_REASONS[rule] ?? {});
		for (const k of counts) if (!reasons.includes(k)) fail(rule, `${k}: recorded in RATCHETS.${rule} with no reason in RATCHET_REASONS -- say why it holds and when it ends`);
		for (const k of reasons) if (!counts.includes(k)) fail(rule, `${k}: a reason in RATCHET_REASONS.${rule} for a key RATCHETS no longer records -- remove it`);
		for (const f of exceptionFaults(Object.entries(RATCHET_REASONS[rule] ?? {}).map(([k, e]) => ({ where: `RATCHET_REASONS.${rule} ${k}`, ...e })), ROOT)) fail(rule, f);
	}
	// H26.3's verification (V6): and L4's named exception, its cites and its trigger
	for (const f of exceptionFaults((R.L4?.verbatim ?? []).map((v) => ({ where: `RULES.L4.verbatim ${v.copy}`, ...v })), ROOT)) fail('L4', f);
}

const count = (rule) => findings.filter((f) => f.rule === rule).length;
const barrelKeys = [...(measured.L4 ?? new Map()).entries()].filter(([k]) => k.startsWith('barrel '));
const barrels = barrelKeys.length, barrelReexports = barrelKeys.reduce((s, [, v]) => s + v.length, 0);
const layers = new Set(Object.values(layerOf)).size;
if (verbose) {
	for (const line of report) console.log(line);
	if (measured.L10) for (const [k, [tag]] of [...measured.L10].sort()) console.log(`  L10  ${k} [${tag}]`);
}
for (const f of findings) {
	console.log(`  \u2717 ${f.rule} ${f.text}`);
	for (const l of f.lines) console.log(`      ${l}`);
}
if (modules.length === 0) {
	console.log('  \u2717 NO modules found at all -- the scan is broken, not the tree clean');
	process.exit(1);
}
const l10 = measured.L10 ? measured.L10.size : 0;
console.log(`  scan-layers: ${modules.length} module(s) in ${layers} layer(s). Ratcheted: `
	+ `L2 ${totals.L2} edge(s), L4 ${totals.L4 - barrelReexports} barrel import(s) of ${barrels} barrel(s) (${barrelReexports} re-export(s)), L5 ${totals.L5}, L5p ${totals.L5p}, `
	+ `L7k ${totals.L7k} consumer line(s), L9 ${totals.L9}, L11 ${totals.L11} canvas read(s). Listed: L10 ${l10} unused export(s). `
	+ 'Hard, with no ratchet: L1, L3, L6, L7, L8, the L7k lists, L11 outside the canvas, L12, the refused edges');
if (findings.length) {
	const by = [...new Set(findings.map((f) => f.rule))].map((r) => `${r} ${count(r)}`).join(', ');
	console.log(`\n  FAIL -- ${findings.length} finding(s): ${by}. The manifest is ${manifestFile ?? 'tools/layers.mjs'}; a ratchet is lowered there in the commit that earns it.\n`);
	process.exit(1);
}
console.log('  PASS -- every module has one layer and every edge, export and global read is where the manifest says\n');
