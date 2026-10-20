/*
H26.1 (dev/design/components/SNAP-GRID.md section 4, acceptance step 4) -- THE OLD ANSWERS, READ FROM THE OLD FUNCTIONS WHILE THEY EXIST.

Every question of the side-by-side sweep (tests/fixtures/grid-parity.mjs) asked of draw's own grid arithmetic as it stood before
H26.1 moved it: the kernel's `cellOf`, `snapLayout`, `cellOn`, `pxOn`, `nearestAnchor`, `anchorAt`, `spanExtent` and `LAYOUTS`, the
canvas's `snapNode` and `snapIn`, the zones plugin's `snapZone` (quoted from its file, which keeps it inside a closure), its corner
step and its wrap, the layouts plugin's drawn grid, the text box's frame, a device's size step and its surface check, the anchors'
field checks and the placement part's walk. `--write` records those answers, and the differences the replacements make with each
one's 6.3 class, in tests/fixtures/grid-parity-record.json; `OLD` is exported so tests/grid-parity.test.js can show the record is
these functions' answers while they exist.

Usage: node tests/fixtures/grid-parity-record.mjs --write | --check
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cellOf, snapLayout, cellOn, pxOn, nearestAnchor, anchorAt, spanExtent, LAYOUTS } from '../../kernel/geometry.mjs';
import { snapNode, snapIn, placesOf } from '../../app/src/snap.js';
import { PRODUCT_CANVAS } from '../../product/canvas.mjs';
import { productKinds } from '../../product/kinds.mjs';
import { ZONE_HANDLE_SPECS } from '../../zones/zone-gestures.mjs';
import { ZONE_KEYS } from '../../zones/zone-keys.mjs';
import { ZONE_EXT } from '../../layouts/layout-table.mjs';
import { LAYOUTS_CANVAS } from '../../layouts/layout-canvas.mjs';
import { DEVICE_PRESSES } from '../../devices/device-gestures.mjs';
import { DEVICE_SIZE_STEP } from '../../devices/device-size.mjs';
import { DEVICE_FIELDS } from '../../devices/device-fields.mjs';
import { resolveAnchor } from '../../server/anchor.mjs';
import { SWEEP, QUESTIONS, REPLACEMENTS, answersOf, differences, classOf, enc } from './grid-parity.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const RECORD = path.join(ROOT, 'tests/fixtures/grid-parity-record.json');
const K = productKinds(), anchorField = K.row('node').fields, zoneField = K.row('zone').fields;
const places = placesOf(PRODUCT_CANVAS);
// the zones plugin's point on its grid, inside a closure of zones/zone-gestures.mjs, quoted from the file as it is
const quoted = /\nfunction snapZone\(pos\) \{\n[\s\S]*?\n\}\n/.exec(fs.readFileSync(path.join(ROOT, 'zones/zone-gestures.mjs'), 'utf8'))?.[0];
if (!quoted) throw new Error('zones/zone-gestures.mjs holds no snapZone to quote');
const snapZone = new Function('snapLayout', 'LAYOUTS', 'ZONE_EXT', `${quoted}\nreturn snapZone;`)(snapLayout, LAYOUTS, ZONE_EXT);
const STUB = { freshId: () => 'zone-000001', nextName: () => 'z', nextOrder: () => 1 };   // what the zone factory asks of a Model
const boardModel = (b) => ({ all: (kind) => (kind === 'node' ? b.nodes : kind === 'zone' ? b.zones : []) });
const fakeModel = (record) => ({ get: (kind, id) => (kind === 'layout' ? { id, ...record } : undefined) });
// the REST nearest route's answer for a layout the question names: refused for a coordinate that is not finite, else the anchor
const rest = (L, p) => (!Number.isFinite(p.x) || !Number.isFinite(p.y) ? 'refused' : ((a) => (a.layout === L.name ? [a.cx, a.cy, a.x, a.y] : a))(nearestAnchor(L, p.x, p.y)));

export const OLD = {
	'cellOf': (v) => cellOf(v),
	'snapLayout.node': (v) => snapLayout(LAYOUTS.node, v),
	'snapLayout.zone': (v) => snapLayout(LAYOUTS.zone, v),
	'cellOn.node': (v) => cellOn(LAYOUTS.node, v),
	'cellOn.zone': (v) => cellOn(LAYOUTS.zone, v),
	'pxOn.node': (c) => pxOn(LAYOUTS.node, c),
	'pxOn.zone': (c) => pxOn(LAYOUTS.zone, c),
	'anchor.x': (v) => anchorField.x(v),
	'anchor.y': (v) => anchorField.y(v),
	'zone.x': (v) => zoneField.x(v),
	'zone.y': (v) => zoneField.y(v),
	'zone.w': (v) => zoneField.w(v),
	'zone.h': (v) => zoneField.h(v),
	'nearestAnchor.node': (p) => rest(LAYOUTS.node, p),
	'nearestAnchor.zone': (p) => rest(LAYOUTS.zone, p),
	'anchorAt.node': ({ cx, cy }) => ((a) => [a.layout, a.cx, a.cy, a.x, a.y])(anchorAt(LAYOUTS.node, cx, cy)),
	'anchorAt.zone': ({ cx, cy }) => ((a) => [a.layout, a.cx, a.cy, a.x, a.y])(anchorAt(LAYOUTS.zone, cx, cy)),
	'spanExtent': (span) => ((e) => [e.sw, e.sh])(spanExtent(span)),
	'snapNode': (p) => ((a) => [a.x, a.y])(snapNode(p)),
	'snapIn.node': (p) => ((a) => [a.x, a.y])(snapIn(places.get('node'), p)),
	'snapIn.zone': (p) => ((a) => [a.x, a.y])(snapIn(places.get('zone'), p)),
	'snapZone': (p) => ((a) => [a.x, a.y])(snapZone(p)),
	'zoneResize': ({ fixed, pos }) => ((b) => [b.x, b.y, b.w, b.h])(ZONE_HANDLE_SPECS[0].at({ fixedCorner: fixed }, pos)),
	'zoneWrap': (b) => {
		let box = null;
		ZONE_KEYS.find((k) => k.id === 'wrap').run({ selectionBounds: () => b, create: (kind, make) => { box = make(STUB); }, flash: () => {}, dims: () => '' });
		return box && [box.x, box.y, box.w, box.h];
	},
	'latticePoints': (record) => LAYOUTS_CANVAS.grids.find((g) => g.layout === record.name).points(fakeModel(record)).flatMap((p) => [p.x, p.y]),
	'frameSpan': ([a, b]) => ((f) => [f.x, f.y, f.w, f.h, f.origin.x, f.origin.y, f.cols, f.rows])(DEVICE_PRESSES.find((r) => r.id === 'tool').box.frame(a, b)),
	'deviceSizeStep': ({ node, dx, dy }) => ((s) => (s ? [s.span.cols, s.span.rows] : null))(DEVICE_SIZE_STEP.step(node, dx, dy)),
	'deviceWithinSurface': (n) => DEVICE_FIELDS.refers(n, null, n, null),
	'resolveAnchor': ({ board, at }) => ((r) => (r.ok ? [r.layout, r.cx, r.cy, r.x, r.y] : r.error))(resolveAnchor(boardModel(SWEEP.boards[board]), at)),
	'layoutNamed': (name) => (LAYOUTS[name] ? LAYOUTS[name].name : null),
};

// the record: the commit the old answers were read at, a hash of the inputs they answer, the old answers, and each difference
export function record() {
	const inputs = crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(QUESTIONS).map(([q, d]) => [q, enc(d.inputs())])))).digest('hex');
	const old = answersOf(OLD), now = answersOf(REPLACEMENTS);
	const changed = differences(old, now).map((d) => ({ ...d, input: enc(QUESTIONS[d.question].inputs()[d.index]), class: classOf(d) }));
	const unclassed = changed.filter((d) => !d.class);
	if (unclassed.length) throw new Error(`differences no class of section 6.3 holds:\n${unclassed.slice(0, 20).map((d) => JSON.stringify(d)).join('\n')}\n... ${unclassed.length} in all`);
	return { inputs, old, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
	const mode = process.argv[2];
	const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
	const r = record();
	if (mode === '--write') {
		const doc = { about: 'H26.1: the side-by-side sweep\'s old answers, read from draw\'s old grid arithmetic (tests/fixtures/grid-parity-record.mjs), and each difference its replacement makes, with both answers and its section 6.3 class. A -0 is "-0"; NaN and the infinities are named. Never written by hand.', readAt: commit, ...r };
		fs.writeFileSync(RECORD, `${JSON.stringify(doc)}\n`);
		console.log(`grid-parity: wrote ${path.relative(ROOT, RECORD)} -- ${Object.values(r.old).reduce((n, a) => n + a.length, 0)} answers, ${r.changed.length} difference(s)`);
	} else if (mode === '--check') {
		const doc = JSON.parse(fs.readFileSync(RECORD, 'utf8'));
		const same = doc.inputs === r.inputs && JSON.stringify(doc.old) === JSON.stringify(r.old) && JSON.stringify(doc.changed) === JSON.stringify(r.changed);
		console.log(same ? 'grid-parity: the record is the old functions\' answers' : 'grid-parity: the record differs from the old functions\' answers');
		process.exit(same ? 0 : 1);
	} else { console.error('usage: node tests/fixtures/grid-parity-record.mjs --write | --check'); process.exit(2); }
}
