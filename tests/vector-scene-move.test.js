/*
H26.4 (dev/design/components/VECTOR-SCENE.md section 4, acceptance steps 3 and 7; sections 5.1 and 5.3; D8, D9, D13; guardrails G1, G5,
G6, G9) -- DRAW'S DRAWING IS ON `@apnex/vector-scene`.

`app/src/renderer.js` writes no platform element: it opens draw's scene (`openCanvasScene`) and puts what its painters draw there through
the live shadow, so it draws whole with no root and no `document` at all. `app/src/painter.js` holds no `toCanvas` and no widget of the
canvas -- `buildPreview` alone stays, for the palette's tiles, beside `el` for the foreign layers' drawers and the trace's probe and
settle. The `editing` part's modules and `app/src/grids.js` make no element. `server/svg.mjs` swaps no `document` and builds no tree of
its own. Each page's canvas region holds no layer. `PARTS.editing` holds the modules and consumes what section 5.3 names. Of the
product's modules only the renderer's names the component, and the server and the export load it by name, the export drawing through it.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { FOLDERS, PARTS, PAGES } from '../tools/layers.mjs';
import { PAGE_REGIONS } from '../tools/page-regions.mjs';

const real = (p) => { try { return fs.realpathSync(p); } catch { return p; } };
const ROOT = real(path.resolve(import.meta.dirname, '..'));
const COMPONENT_ENTRY = pathToFileURL(real(path.join(ROOT, 'node_modules/@apnex/vector-scene/dist/index.js'))).href;
// a module's code, its comments taken out, so a word a comment names is not a call
const code = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const EDITING = ['app/src/selection.js', 'app/src/overlay.js', 'app/src/editing-visuals.js', 'app/src/editing-states.js'];   // H26.8: and its states
// what makes or reaches a platform element: the painter's builder (not the renderer's own `this.el`, which builds shadow nodes), the
// document, a lookup on the page, or a write through an element's own method
const MAKES = /(?<![.\w])el\(|\bcreateElementNS\b|\bcreateElement\b|\bdocument\b|\bownerDocument\b|\.appendChild\(|\.insertBefore\(|\.replaceChildren\(|\.innerHTML\b|\bgetElementById\b|\b(svg|layer|overlay|snapLayer)\.querySelector(All)?\(/g;

test('H26.4 step 3: app/src/renderer.js writes no platform element -- it names no builder and no document, and draws whole with neither', async () => {
	assert.deepEqual(code('app/src/renderer.js').match(MAKES) ?? [], [], 'no builder, no document, no element written through its own method');
	assert.doesNotMatch(code('app/src/renderer.js'), /from '\.\/painter\.js'/, 'it imports nothing of app/src/painter.js');
	// of the root it holds, it writes only draw's own classes -- modes and labels -- which stay draw's (section 5.3)
	assert.deepEqual([...code('app/src/renderer.js').matchAll(/this\.svg\b(\??\.\w+)*/g)].map((m) => m[0]), ['this.svg', ...Array(3).fill('this.svg?.classList.toggle')],
		'the root kept, and its classes toggled; nothing else of it read or written');
	// and in a process with no document at all, a scene with no root holds what the renderer draws -- every stored template's
	const r = spawnSync(process.execPath, ['--input-type=module', '-e', `
		delete globalThis.document;
		const { Renderer, openCanvasScene } = await import('./app/src/renderer.js');
		const { PRODUCT_CANVAS, CANVAS_SCENE } = await import('./product/canvas.mjs');
		const { COMPOSED_KINDS, readModel } = await import('./product/types.mjs');
		const fs = await import('node:fs');
		let items = 0;
		for (const f of fs.readdirSync('templates').filter((x) => x.endsWith('.json'))) {
			const scene = openCanvasScene(CANVAS_SCENE);
			const r = new Renderer(readModel(JSON.parse(fs.readFileSync('templates/' + f, 'utf8')), COMPOSED_KINDS), null, { parts: PRODUCT_CANVAS, scene });
			r.syncAll(); r.setMode('edit'); r.setMode('run'); r.toggleLabels();
			items += scene.layers.filter((l) => !l.foreign).reduce((n, l) => n + scene.items(l.name).length, 0);
		}
		console.log(items, typeof globalThis.document);
	`], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_TEST_CONTEXT: '' } });
	assert.equal(r.status, 0, r.stderr);
	const [items, doc] = r.stdout.trim().split(' ');
	assert.ok(Number(items) > 40 && doc === 'undefined', `the scene holds what the renderer drew, with no document: ${r.stdout}`);
});

test('H26.4 step 3: app/src/painter.js holds no toCanvas and no widget of the canvas -- buildPreview alone stays, for the palette\'s tiles', async () => {
	const painter = await import('../app/src/painter.js');
	// RESTATED H26.8's trace move (dev/design/components/NATIVE-SHAPES.md section 5): the settle went with the declared trace; the probe
	// stays, handed the reveal by the page's composition
	// RESTATED H26.8's painters move: `setAttrs` the module's own, a painter setting no attribute
	assert.deepEqual(Object.keys(painter).sort(), ['buildPreview', 'el', 'isShown', 'pathLengthOf', 'setShown'],
		'el for the foreign layers\' drawers; the trace\'s probe (D12); the palette\'s builder; the help panel\'s two questions');
	const palette = code('app/src/palette.js');
	assert.match(palette, /import \{ buildPreview \} from '\.\/painter\.js';/, 'the palette builds its tiles with buildPreview, outside the canvas');
	assert.match(palette, /import \{ ghostNode \} from '\.\/editing-visuals\.js';/, 'and its dragged ghost is an editing visual');
});

test('H26.4 step 3 (G9): the editing part\'s modules and app/src/grids.js make no element; the overlay imports neither the painter nor snap.js', () => {
	for (const f of [...EDITING, 'app/src/grids.js']) assert.deepEqual(code(f).match(MAKES) ?? [], [], `${f} makes no element and reaches no document`);
	const overlay = code('app/src/overlay.js');
	assert.doesNotMatch(overlay, /from '\.\/(painter|snap)\.js'/, 'the overlay\'s hover is kept by the `near` Input hands it (section 5.3)');
	assert.deepEqual([...code('app/src/editing-visuals.js').matchAll(/^import /gm)], [], 'the editing visuals import nothing');
	assert.deepEqual([...code('app/src/selection.js').matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), [], 'the selection imports nothing');
});

// the verifier's F2 (appendix B app/src/labeledit.js:59-61; sections 5.1 and 5.2): the label editor goes the other way through the scene
test('H26.4 step 3 (F2): the label editor converts a drawing point to the screen by the scene\'s toScreen, and builds no DOMPoint', () => {
	const editor = code('app/src/labeledit.js');
	assert.doesNotMatch(editor, /\bDOMPoint\b/, 'no platform point of its own');
	assert.match(editor, /this\.scene\.toScreen\(/, 'the scene\'s conversion');
	assert.match(code('app/src/compose-canvas.js'), /new LabelEditor\(\{ svg, scene,/, 'handed the scene by the composition');
});

test('H26.4 step 3 (G6): server/svg.mjs swaps no document and builds no tree of its own -- it draws through the scene with no root', () => {
	const svg = code('server/svg.mjs');
	assert.doesNotMatch(svg, /globalThis\.document|\bdocument\s*=|createElementNS|appendChild|insertBefore|headless/, 'no document swapped, no tree built');
	assert.match(svg, /openCanvasScene\(CANVAS_SCENE\)/, 'the composition\'s scene, opened with no root');
});

test('H26.4 step 3: each page\'s canvas region holds the root, its viewBox and its ground, and no layer -- the scene appends them', () => {
	for (const page of Object.keys(PAGES)) {
		const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
		const region = html.slice(html.indexOf(PAGE_REGIONS.canvas.begin), html.indexOf(PAGE_REGIONS.canvas.end));
		assert.match(region, /<svg id="container" viewBox="-960 -540 1920 1080"/, `${page}: the root and its viewBox`);
		assert.match(region, /<rect id="canvas" /, `${page}: its ground`);
		assert.doesNotMatch(region, /<g\b/, `${page}: no layer`);
	}
});

test('H26.4 step 3 (D13, section 5.3): PARTS.editing holds the selection, the overlay and the editing visuals, and consumes the document alone', () => {
	const e = PARTS.editing;
	assert.ok(e, 'the part is declared');
	assert.deepEqual([...e.modules].sort(), [...EDITING].sort(), 'its modules at H26.4');
	assert.deepEqual(e.consumes, ['document'], 'it consumes the document alone, for kindOf');
	assert.equal(e.kind, 'host', 'a host: it names no plugin');
	assert.ok(e.by.includes('D1') && e.by.includes('H26-10'), 'by D1 and H26-10');
	assert.ok(PARTS.canvas.consumes.includes('editing'), 'the canvas consumes it, the edge one way');
	for (const f of EDITING) assert.ok(!PARTS.canvas.modules.includes(f), `${f} is no longer the canvas's`);
	const page = PARTS['product-page'].consumes;
	assert.ok(page === '*' || page.includes('editing'), 'the palette, the product page\'s, consumes it for its ghost -- a composition root consumes every part');
	// RESTATED H26.8's painters move (NATIVE-SHAPES.md section 3.3): the shadow joined the renderer at H26.4 and went with the move, the
	// editing states joining the editing part
	assert.ok(!PARTS.renderer.modules.includes('app/src/shadow.js'), 'the shadow is gone from the renderer part');
});

test('H26.4 step 3 (G5, D9): of the product\'s modules, app/src/renderer.js alone names @apnex/vector-scene, and it is a renderer module', () => {
	const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []));
	const product = FOLDERS.filter((f) => f.dir !== 'tools' && f.dir !== 'tests').flatMap((f) => walk(f.dir));
	assert.ok(product.length > 150, `the product's modules were read: ${product.length}`);
	assert.deepEqual(product.filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('@apnex/vector-scene')), ['app/src/renderer.js']);
	assert.ok(PARTS.renderer.modules.includes('app/src/renderer.js'), 'the adapter is the renderer part\'s');
});

/*
H26.4 step 7 (D8) -- the pages load vector-scene through their import map (tests/import-map-browser.test.js); the server and the export
load it by name, since the export draws through it. Each module graph is loaded in a process of its own whose every resolution is logged
(tests/fixtures/resolve-log/): the server's app, and the export drawing a diagram, resolve the component's entry.
*/
test('H26.4 step 7 (D8): the server and the export load vector-scene by name, the export drawing a diagram through it', () => {
	const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-log-')), 'log');
	try {
		const loads = (source) => {
			fs.writeFileSync(log, '');
			const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT')), RESOLVE_LOG: log };
			const r = spawnSync(process.execPath, ['--import', './tests/fixtures/resolve-log/register.mjs', '--input-type=module', '-e', source], { cwd: ROOT, env, encoding: 'utf8' });
			assert.equal(r.status, 0, r.stderr);
			return { resolved: fs.readFileSync(log, 'utf8').split('\n').filter(Boolean), out: r.stdout };
		};
		const server = loads("await import('./server/app.js');");
		assert.ok(server.resolved.length > 100, `the server's graph was logged: ${server.resolved.length} resolution(s)`);
		assert.ok(server.resolved.includes(COMPONENT_ENTRY), 'the server loads it by name, through the export it serves');
		const drawn = loads("const { svgDocument } = await import('./server/svg.mjs'); const { parityBoard } = await import('./tools/probe/boards.mjs'); console.log(svgDocument(parityBoard()).length);");
		assert.ok(drawn.resolved.includes(COMPONENT_ENTRY) && Number(drawn.out) > 1000, 'the export resolves it, and draws through it');
	} finally { fs.rmSync(path.dirname(log), { recursive: true, force: true }); }
});

/*
H26.5's vector-scene move (dev/design/components/RELEASES-0.2.md sections 3.3, 4 and 8) -- DRAW'S SCENES OPEN AS BEFORE ON 0.2.0. From
0.2.0 a scene opened on a root reads the root's document's `elementsFromPoint` once as it opens: a getter that throws refuses the root,
and a value that is not a function is kept as none, the root opening and `itemAt` refusing. Draw's openings, each:
- the export's, with no root, reads no document -- the first case above draws every template in a process that has none;
- the page's and the lab's, in Chrome, read the browser's function (tests/import-map-browser.test.js asks `itemAt` there, and every
  browser test boots a page through it);
- the test harness's fake document (tests/fixtures/client-harness.mjs), the conversion's in tests/fixtures/capture-parity.mjs and the
  parity fixture's (tests/fixtures/scene-parity.mjs; the native record's since H26.8) hold none, so each opens as before, `itemAt` refusing on it;
- a document whose member counts its reads and its calls is read once as the scene opens, and neither read nor called while the
  renderer draws a board, its modes and its states -- the scene calls the function it kept only for `itemAt`, and nothing of draw's calls
  `itemAt`, not until H26.8, its picks reading a target by selector (D4).
*/
test('H26.5 (vector-scene 0.2.0): draw\'s scenes open as before -- each fake document holds no elementsFromPoint and opens, itemAt refusing; draw reads it no more', async () => {
	const { installDom, fakeEl, sceneOver } = await import('./fixtures/client-harness.mjs');
	const { sceneOver: conversionOver } = await import('./fixtures/capture-parity.mjs');
	// RESTATED H26.8's painters move: the parity fixture's fake document went with the side-by-side; the native record's is its like
	const { makeDocument } = await import('./fixtures/native-record.mjs');
	const { Renderer, openCanvasScene } = await import('../app/src/renderer.js');
	const { EditingStates } = await import('../app/src/editing-states.js');
	const { PRODUCT_CANVAS, CANVAS_SCENE } = await import('../product/canvas.mjs');
	const { COMPOSED_KINDS, readModel } = await import('../product/types.mjs');
	const NONE = /^Error: itemAt: the root's document held no elementsFromPoint function when the scene opened$/;
	const restore = installDom();
	try {
		const harness = sceneOver(fakeEl('svg', 'canvas')).scene;
		assert.equal('elementsFromPoint' in globalThis.document, false, 'the harness\'s fake document holds none');
		assert.throws(() => harness.itemAt({ x: 0, y: 0 }), NONE, 'the harness\'s scene opened; itemAt refuses on it');
		assert.throws(() => conversionOver({ getScreenCTM: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) }).itemAt({ x: 0, y: 0 }), NONE,
			'the conversion\'s scene over a surface opened; itemAt refuses on it');
		const d = makeDocument();
		assert.throws(() => openCanvasScene(CANVAS_SCENE, d.attach(d.createElementNS('', 'svg'))).itemAt({ x: 0, y: 0 }), NONE, 'the native record\'s opened; itemAt refuses on it');

		// a document whose member counts its reads and its calls, the harness's own beneath
		let reads = 0, calls = 0;
		const counted = globalThis.document;
		const elementsFromPoint = () => { calls++; return []; };
		globalThis.document = new Proxy(counted, { get: (t, k, r) => { if (k === 'elementsFromPoint') { reads++; return elementsFromPoint; } return Reflect.get(t, k, r); } });
		const svg = fakeEl('svg', 'canvas');
		const scene = sceneOver(svg).scene;
		assert.deepEqual([reads, calls], [1, 0], 'read once, as the scene opened, and not called');
		const template = fs.readdirSync(path.join(ROOT, 'templates')).find((f) => f.endsWith('.json'));
		const model = readModel(JSON.parse(fs.readFileSync(path.join(ROOT, 'templates', template), 'utf8')), COMPOSED_KINDS);
		// RESTATED H26.8's painters move: the states held in the editing states the renderer is handed, which it describes onto the entity
		const states = new EditingStates({ model, parts: PRODUCT_CANVAS });
		const r = new Renderer(model, svg, { parts: PRODUCT_CANVAS, scene, states });
		r.syncAll(); r.setMode('edit'); r.setMode('run'); r.toggleLabels();
		const [first] = model.all('node');
		states.setState(first.id, 'hover', true); states.clearState(first.id, 'hover');
		assert.ok(scene.items('nodes').length > 0, 'precondition: the renderer drew the board into the scene');
		assert.deepEqual([reads, calls], [1, 0], 'neither read again nor called while the renderer drew it, its modes and its states');
		assert.equal(scene.itemAt({ x: 0, y: 0 }), null, 'control: itemAt calls the function the scene kept --');
		assert.deepEqual([reads, calls], [1, 1], '-- so a call of draw\'s would have been counted');
	} finally { restore(); }
	const product = FOLDERS.filter((f) => f.dir !== 'tools' && f.dir !== 'tests').flatMap((f) => {
		const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.m?js$/.test(e.name) ? [path.join(dir, e.name)] : []));
		return walk(f.dir);
	});
	assert.ok(product.length > 150, `the product's modules were read: ${product.length}`);
	assert.deepEqual(product.filter((f) => /\bitemAt\s*\(/.test(code(f))), [], 'no module of draw\'s calls itemAt');
});
