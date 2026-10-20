#!/usr/bin/env node
/*
components -- H26.1 (dev/design/components/SNAP-GRID.md section 7). The components draw installs, read from what is installed and
nothing else: draw's `@apnex/` dependencies in package.json (H26-2: each component is the public repository apnex/<name>, its
package @apnex/<name>), and for each the installed package's name, version and exports (node_modules/@apnex/<name>/package.json).

The import map's generator (tools/import-map.mjs) and the region the copy measure trusts (tools/page-regions.mjs) write the pages'
map from this. The vendor mount (server/static.mjs sendVendored) reads the same two files for itself, because a server module may
import no tool.

  importMapOf(root)          -> { imports, components, problems }
                                one entry per export, never a trailing-slash prefix, each at /vendor/<name>@<version>/<file>;
                                each component { name, version, dir, exports: [{ specifier, file }] }

WHAT IS REFUSED, rather than guessed (section 7.6): a component not installed, or installed under another name; a version that is
not one an address can carry; an `exports` that is not a string, a { types, default } pair or a map of subpaths to either -- a
condition other than `types` and `default`, a pattern, a folder, a target outside dist/ or missing from it; and a vendored file
that imports a package the map does not name, an address outside the vendor mount, or a relative file outside dist/ or not there.
*/
import fs from 'node:fs';
import path from 'node:path';

const SCOPE = '@apnex/';   // H26-2
const VENDOR = '/vendor/';   // the mount both servers serve the components' built files under (server/static.mjs)

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function componentNames(root) {
	const pkg = readJson(path.join(root, 'package.json'));
	return Object.keys(pkg.dependencies ?? {}).filter((n) => n.startsWith(SCOPE)).sort();
}

// the entry points a package's `exports` names, each { subpath, file } with `file` relative to dist/, or the problems it has
function exportEntries(name, exp) {
	if (typeof exp !== 'string' && !plain(exp)) return { entries: [], problems: [`${name} declares its exports as ${JSON.stringify(exp) ?? 'nothing'} -- the map supports a string, a { types, default } pair, or a map of subpaths to either`] };
	const keys = typeof exp === 'string' ? [] : Object.keys(exp);
	const dotted = keys.filter((k) => k.startsWith('.'));
	if (dotted.length && dotted.length !== keys.length) return { entries: [], problems: [`${name}'s exports mixes subpaths and conditions, which Node refuses too`] };
	const entries = [], problems = [];
	for (const [subpath, target] of Object.entries(dotted.length ? exp : { '.': exp })) {
		const at = `${name} exports ${subpath === '.' ? 'its root' : subpath}`;
		if (subpath.includes('*') || (typeof target === 'string' && target.includes('*'))) { problems.push(`${at} as a pattern, which one entry per export cannot name`); continue; }
		if (subpath !== '.' && (!subpath.startsWith('./') || subpath.endsWith('/'))) { problems.push(`${at} -- a subpath is ./<name>, never a folder`); continue; }
		let file = target;
		if (plain(target)) {
			const other = Object.keys(target).filter((c) => c !== 'types' && c !== 'default');
			if (other.length) { problems.push(`${at} under the condition(s) ${other.join(', ')} -- the map supports types and default alone`); continue; }
			file = target.default;
		}
		if (typeof file !== 'string') { problems.push(`${at} with no default target`); continue; }
		const rel = path.posix.normalize(file);
		if (!file.startsWith('./') || !rel.startsWith('dist/') || rel.length === 'dist/'.length || rel.endsWith('/')) { problems.push(`${at} as ${file}, outside dist/`); continue; }
		entries.push({ subpath, file: rel.slice('dist/'.length) });
	}
	return { entries, problems };
}

function installedComponents(root) {
	const components = [], problems = [];
	let names;
	try { names = componentNames(root); } catch (e) { return { components, problems: [`package.json could not be read: ${e.message}`] }; }
	for (const name of names) {
		const dir = path.join(root, 'node_modules', ...name.split('/'));
		let pkg;
		try { pkg = readJson(path.join(dir, 'package.json')); } catch { problems.push(`${name} is a dependency and is not installed -- run npm ci`); continue; }
		if (pkg.name !== name) { problems.push(`node_modules/${name} holds ${pkg.name}, not ${name}`); continue; }
		if (typeof pkg.version !== 'string' || !VERSION.test(pkg.version)) { problems.push(`${name}'s version ${JSON.stringify(pkg.version)} is not one an address can carry`); continue; }
		const { entries, problems: found } = exportEntries(name, pkg.exports);
		problems.push(...found);
		for (const e of entries) if (!fs.statSync(path.join(dir, 'dist', e.file), { throwIfNoEntry: false })?.isFile()) problems.push(`${name} exports ${e.subpath} as ./dist/${e.file}, which it does not hold`);
		components.push({ name, version: pkg.version, dir, exports: entries.map((e) => ({ specifier: e.subpath === '.' ? name : `${name}/${e.subpath.slice(2)}`, file: e.file })) });
	}
	return { components, problems };
}

// every file under a folder, as paths relative to it, in name order
function filesUnder(dir, rel = '') {
	const at = path.join(dir, rel);
	if (!fs.existsSync(at)) return [];
	return fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
		.flatMap((e) => (e.isDirectory() ? filesUnder(dir, path.posix.join(rel, e.name)) : [path.posix.join(rel, e.name)]));
}

/*
The specifiers a built module imports: `import ... from`, `export ... from`, a bare `import '...'`, each opening its line, and a
literal `import('...')`. Read from compiler output, whose statements open their lines and whose comments never do -- a JSDoc
example ` * import { x } from "y"` is not an import -- so text is enough, as tools/generate-architecture.mjs reads draw's own.
*/
const SPECIFIERS = [/^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*(['"])([^'"\n]+)\1/gm, /^[ \t]*import\s*(['"])([^'"\n]+)\1/gm, /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g];
const specifiersOf = (src) => [...new Set(SPECIFIERS.flatMap((re) => [...src.matchAll(re)].map((m) => m[2])))];

function vendoredImportProblems(components, imports) {
	const problems = [];
	for (const c of components) {
		const dist = path.join(c.dir, 'dist');
		for (const file of filesUnder(dist).filter((f) => /\.m?js$/.test(f))) {
			for (const spec of specifiersOf(fs.readFileSync(path.join(dist, file), 'utf8'))) {
				const where = `${c.name}'s dist/${file} imports '${spec}'`;
				if (spec.startsWith('./') || spec.startsWith('../')) {
					const to = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec.replace(/[?#][\s\S]*$/, '')));
					if (to === '..' || to.startsWith('../')) problems.push(`${where}, outside dist/, which the vendor mount does not serve`);
					else if (!fs.statSync(path.join(dist, to), { throwIfNoEntry: false })?.isFile()) problems.push(`${where}, which dist/ does not hold`);
				} else if (spec.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(spec)) problems.push(`${where} -- an address the import map does not resolve, outside the vendor mount`);
				else if (!Object.hasOwn(imports, spec)) problems.push(`${where}, a package the import map does not name`);
			}
		}
	}
	return problems;
}

export function importMapOf(root) {
	const { components, problems } = installedComponents(root);
	const imports = {};
	for (const c of components) for (const e of c.exports) imports[e.specifier] = `${VENDOR}${c.name}@${c.version}/${e.file}`;
	problems.push(...vendoredImportProblems(components, imports));
	return { imports, components, problems };
}
