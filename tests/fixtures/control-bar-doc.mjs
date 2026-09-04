// control-bar-doc — the multi-region control-bar document used as a span/content fixture.
// Extracted from docs/design/widgets/control-bar-live.mjs when the docs/design/ generator scripts were
// retired: this is the PURE half (a plain document object). The render/screenshot half stayed
// behind with the mocks it produced. Consumed by tests/span.test.js.

const C = 60;          // pitch (cell -> px); the doc is px, center-origin
const ACT = '#4fc3f7';  // the 'active' accent used by the slides cluster

export function controlBarDoc() {
	const bar = {
		id: 'node-ba0001', name: 'control-bar', type: 'host', shape: 'circle',   // rounded panel corners (rx = circle radius)
		x: -11 * C, y: -3 * C, span: { cols: 24, rows: 1 },
		content: [
			{ at: [0, 0], content: 'text', value: 'draw', align: 'center', fill: '#aed581' },          // brand
			{ at: [1, 0], content: 'text', value: 'name', align: 'left', fill: '#9fb0c0' },             // name input: label
			{ at: [2, 0], cols: 4, content: 'text', value: 'scene-1', align: 'left', outline: true, input: true },   //             value (editable)
			{ at: [7, 0], cols: 2, content: 'text', value: 'open ▾', align: 'center', outline: true, action: 'diagram-open' }, // open list
			{ at: [9, 0], content: 'text', value: '+', align: 'center', outline: true, action: 'diagram-new' },                 // new
			{ at: [10, 0], content: 'text', value: '×', align: 'center', outline: true, action: 'diagram-del' },           // delete
			{ at: [12, 0], cols: 2, content: 'text', value: 'slides', align: 'left', fill: '#9fb0c0' },  // slides input: label
			{ at: [14, 0], cols: 4, content: 'text', value: 'docs…/d/1A', align: 'left', outline: true, accent: ACT, input: true }, // value (editable)
			{ at: [18, 0], cols: 2, content: 'text', value: '⇑ slides', align: 'center', outline: true, accent: ACT, action: 'slides-push' }, // push
			{ at: [21, 0], content: 'text', value: '?', align: 'center', outline: true, action: 'help' },                // help
			{ at: [22, 0], cols: 2, content: 'text', value: 'online', align: 'center', outline: true, bg: '#aed581', fill: '#101010', rx: 13 } // status pill
		]
	};
	// the diagram the bar controls — plain 1×1 nodes + links, on the same canvas (one substrate)
	const nodes = [bar,
		{ id: 'node-c11001', name: 'client', type: 'host', shape: 'square', x: -8 * C, y: 0 },
		{ id: 'node-d22001', name: 'router', type: 'router', shape: 'circle', x: -3 * C, y: 0 },
		{ id: 'node-e33001', name: 'server', type: 'server', shape: 'square', x: 2 * C, y: 0 }];
	const links = [
		{ id: 'link-000001', src: 'node-c11001', dst: 'node-d22001' },
		{ id: 'link-000002', src: 'node-d22001', dst: 'node-e33001' }];
	return { meta: { id: 'diagram-cba001', name: 'control-bar' }, nodes, waypoints: [], links, zones: [], groups: [] };
}
