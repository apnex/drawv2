/*
A DEVICE TYPE IS A COMPOSITION -- ONE DECLARATION PER TYPE (H21.3, U4, B282; ruled U4-1, U4-2, U4-3).

Each device type is declared once here, in the palette's digit order (H17-D6):
  map        the single-letter symbol `draw map` prints for it (U4-2)
  box        its glyph's bounding box `[bx, by, bw, bh]`, fitted into the socket square (B205, B318)
  routing    which routing pack from the network plugin (`network/transit-offers.mjs`) it includes (U4-1)
  behaviour  which run-mode behaviour pack from the simulation (`engine/kinds.mjs`) it includes, or null (U4-3)
  favicon    whether its glyph is the product's browser tab icon (B197, B204)
  svg        its `<g id="glyph-<type>" class="icon">` inner paths, moved from `kernel/theme.mjs` (B338)

`product/` hands the routing slice (`TYPE_ROUTING`) to the network plugin and the behaviour slice (`TYPE_BEHAVIOUR`) to the
simulation at composition (`U4-1`), and the server serves `deviceTypeRecords()` at `GET /api/v1/types` so the CLI asks for the
types and their map letters rather than keeping a copy (`U4-2`).
*/

import { STD, L_STD } from '../kernel/spec.mjs';
import { KERNEL_CSS } from '../kernel/theme.mjs';

export const DEVICE_TYPES = Object.freeze({
	host: Object.freeze({
		map: 'h', defsOrder: 1,
		box: Object.freeze([-11.6, -11.6, 22.5, 22.5]),
		routing: 'endpoint',
		behaviour: null,
		svg: `\t\t<g transform="translate(-38.5,-38.5)" class="solid" style="stroke-width:4">
\t\t\t<path d="M3 0 L72 0 Q75 0 75 3 L75 52 Q75 55 72 55 L48 55 Q45 55 45 58 L45 62 Q45 65 48 65 L72 65 Q75 65 75 68 L75 72 Q75 75 72 75 L3 75 Q0 75 0 72 L0 68 Q0 65 3 65 L27 65 Q30 65 30 62 L30 58 Q30 55 27 55 L3 55 Q0 55 0 52 L0 3 Q0 0 3 0 Z"/>
\t\t\t<path d="M8 5 L67 5 Q70 5 70 8 L70 47 Q70 50 67 50 L8 50 Q5 50 5 47 L5 8 Q5 5 8 5 Z" class="hollow"/>
\t\t</g>`,
	}),
	server: Object.freeze({
		map: 's', defsOrder: 6,
		box: Object.freeze([-11.1, -11.1, 22.2, 22.2]),
		routing: 'endpoint',
		behaviour: null,
		svg: `\t\t<rect class="hollow" style="stroke-width:7" x="-24" y="-24" width="48" height="48" rx="4px"/>
\t\t<rect class="solid" x="-12" y="-12" width="24" height="24" rx="4px"/>
\t\t<g id="legs" transform="translate(0, 0)" class="hollow" style="stroke-width:7">
\t\t\t<line x1="24" y1="-12" x2="37" y2="-12"/>
\t\t\t<line x1="24" y1="0" x2="37" y2="0"/>
\t\t\t<line x1="24" y1="12" x2="37" y2="12"/>
\t\t</g>
\t\t<use href="#legs" transform="rotate(90 0 0)"/>
\t\t<use href="#legs" transform="rotate(180 0 0)"/>
\t\t<use href="#legs" transform="rotate(270 0 0)"/>`,
	}),
	loadbalancer: Object.freeze({
		map: 'l', defsOrder: 5,
		box: Object.freeze([-15.0, -13.0, 30.0, 26.0]),
		routing: 'endpoint',
		behaviour: 'tower',
		svg: `\t\t<g transform="translate(-5,-12)" class="solid" style="stroke-width:2">
\t\t\t<path id="arrow" d="M2 8 L38 8 Q40 8 40 6 L40 2 Q40 0 42 1 L54 11 Q56 12 54 13 L42 23 Q40 24 40 22 L40 18 Q40 16 38 16 L2 16 Q0 16 0 14 L0 10 Q0 8 2 8 Z"/>
\t\t\t<use href="#arrow" transform="rotate(45 5 12)"/>
\t\t\t<use href="#arrow" transform="rotate(-45 5 12)"/>
\t\t</g>
\t\t<line class="hollow" style="stroke-width:10" x1="-40" y1="0" x2="0" y2="0"/>
\t\t<circle class="hollow" style="stroke-width:5" r="15"/>
\t\t<circle class="solid" style="stroke-width:2" r="10" cx="-40"/>`,
	}),
	firewall: Object.freeze({
		map: 'f', defsOrder: 4,
		box: Object.freeze([-13.5, -10.5, 27.0, 21.0]),
		routing: 'transit',
		behaviour: null,
		svg: `\t\t<g transform="translate(-45,-35)" class="solid" style="stroke-width:2">
\t\t\t<rect class="solid" style="rx:4px" x="0" y="0" width="20" height="20"/>
\t\t\t<rect class="solid" style="rx:4px" x="25" y="0" width="40" height="20"/>
\t\t\t<rect class="solid" style="rx:4px" x="70" y="0" width="20" height="20"/>
\t\t\t<rect class="solid" style="rx:4px" x="0" y="25" width="42" height="20"/>
\t\t\t<rect class="solid" style="rx:4px" x="48" y="25" width="42" height="20"/>
\t\t\t<rect class="solid" style="rx:4px" x="0" y="50" width="20" height="20"/>
\t\t\t<rect class="solid" style="rx:4px" x="25" y="50" width="40" height="20"/>
\t\t\t<rect class="solid" style="rx:4px" x="70" y="50" width="20" height="20"/>
\t\t</g>`,
	}),
	vxlan: Object.freeze({
		map: 'v', defsOrder: 2,
		box: Object.freeze([-12.3, -10.1, 24.6, 20.3]),
		routing: 'transit',
		behaviour: null,
		svg: `\t\t<g transform="translate(-14,-34.5)" class="solid" style="stroke-width:2">
\t\t\t<path id="arrow1" d="M2 8 L38 8 Q40 8 40 6 L40 2 Q40 0 42 1 L54 11 Q56 12 54 13 L42 23 Q40 24 40 22 L40 18 Q40 16 38 16 L2 16 Q0 16 0 14 L0 10 Q0 8 2 8 Z"/>
\t\t\t<use href="#arrow1" y="30"/>
\t\t\t<use href="#arrow1" transform="rotate(180 0 12)" x="-28" y="-15"/>
\t\t\t<use href="#arrow1" transform="rotate(180 0 12)" x="-28" y="-45"/>
\t\t</g>`,
	}),
	router: Object.freeze({
		map: 'r', defsOrder: 3,
		box: Object.freeze([-15.0, -15.0, 30.0, 30.0]),
		routing: 'transit',
		behaviour: null,
		favicon: true,
		svg: `\t\t<g transform="translate(-5,-12)" class="solid" style="stroke-width:2">
\t\t\t<path id="arrow2" d="M2 8 L38 8 Q40 8 40 6 L40 2 Q40 0 42 1 L54 11 Q56 12 54 13 L42 23 Q40 24 40 22 L40 18 Q40 16 38 16 L2 16 Q0 16 0 14 L0 10 Q0 8 2 8 Z"/>
\t\t\t<use href="#arrow2" transform="rotate(90 5 12)"/>
\t\t\t<use href="#arrow2" transform="rotate(180 5 12)"/>
\t\t\t<use href="#arrow2" transform="rotate(270 5 12)"/>
\t\t</g>
\t\t<g class="hollow" style="stroke-width:5">
\t\t\t<ellipse transform="rotate(45 0 0)" rx="35" ry="10"/>
\t\t\t<ellipse transform="rotate(-45 0 0)" rx="35" ry="10"/>
\t\t\t<circle r="15"/>
\t\t</g>`,
	}),
});

// the palette's ordered type names, the bounding-box map, the fallback fit box, and the SVG `<defs>` block, derived from a
// type table so a test can pass a table with a seventh type and prove one declaration drives every slice
export const typesFrom = (table = DEVICE_TYPES) => {
	const list = Object.freeze(Object.keys(table));
	const bb = Object.freeze(Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.box])));
	const defaultBb = table[list[0]].box;
	const defs = `<defs id="defs">\n\t<circle id="frame-circle" class="frame" r="21"/>\n\t<rect id="frame-square" class="frame" x="-21" y="-21" width="42" height="42" rx="5"/>\n${
		[...Object.entries(table)].sort(([, a], [, b]) => (a.defsOrder ?? 99) - (b.defsOrder ?? 99)).map(([k, v]) => `\t<g id="glyph-${k}" class="icon">\n${v.svg}\n\t</g>`).join('\n')
	}\n</defs>`;
	const routing = Object.freeze(Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.routing])));
	const behaviour = Object.freeze(Object.fromEntries(Object.entries(table).filter(([, v]) => v.behaviour).map(([k, v]) => [k, v.behaviour])));
	const records = () => Object.entries(table).map(([name, t]) => ({ name, map: t.map, routing: t.routing, behaviour: t.behaviour }));
	return { list, bb, defaultBb, defs, routing, behaviour, records };
};

const BUILT = typesFrom(DEVICE_TYPES);
export const DEVICE_TYPE_LIST = BUILT.list;
export const GLYPH_BB = BUILT.bb;
export const DEFAULT_GLYPH_BB = BUILT.defaultBb;
export const GLYPH_DEFS = BUILT.defs;
export const TYPE_ROUTING = BUILT.routing;
export const TYPE_BEHAVIOUR = BUILT.behaviour;
export const deviceTypeRecords = BUILT.records;

// B197/B204 -- the browser tab icon, composed from the type flagged `favicon: true` in `DEVICE_TYPES`
export function faviconSvg() {
	const [favName, fav] = Object.entries(DEVICE_TYPES).find(([, v]) => v.favicon);
	const ext = L_STD.frame.ext;
	const S = STD.socket;
	const [bx, by, bw, bh] = fav.box;
	const half = ext + 2.1;
	return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="32" height="32" viewBox="${-half} ${-half} ${half * 2} ${half * 2}">
<style>${KERNEL_CSS}</style>
${GLYPH_DEFS}
<g class="node">
\t<circle class="frame" r="${ext}"/>
\t<svg x="${-S / 2}" y="${-S / 2}" width="${S}" height="${S}" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="xMidYMid meet"><use href="#glyph-${favName}"/></svg>
</g>
</svg>
`;
}
