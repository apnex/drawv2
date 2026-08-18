// THEME — the kernel's visual surface, vendored so the kernel owns its look (no fs-read of the
// client app). THIS is the iterate-here module: colours, stroke widths, the bend radius, the
// waypoint style, the glyph artwork, and the minimal scene CSS all live here. Change visuals
// here; geometry numbers live in spec.mjs.

// ---- style tokens (the renderer reads these instead of hard-coding hex) ----
export const TOKENS = {
	panel: '#101010',        // canvas / opaque-centre fill
	link: '#4fc3f7',         // links + routed paths
	group: '#b388ff',        // group hull stroke
	zoneFill: '#8fa3b8', zoneFillOp: 0.13, zoneStroke: '#aab4c4', zoneStrokeOp: 0.55,
	socket: '#e0a85a',       // glyph-box guide
	port: '#aed581',         // port square / entity port
	junction: '#4fc3f7',     // connection-pad outline
	waypoint: '#4fc3f7',     // routing-pivot ring (link colour — it IS the bend)
	bendR: 20                // = spec BEND_R; the locked corner radius
};

// measured glyph bounding boxes at icon scale 0.3: [x, y, w, h] — fits any glyph into the
// socket regardless of frame shape. Canonical render data (was geometry.mjs).
export const GLYPH_BB = {
	host: [-11.6, -11.6, 22.5, 22.5], server: [-11.1, -11.1, 22.2, 22.2], firewall: [-13.5, -10.5, 27.0, 21.0],
	router: [-15.0, -15.0, 30.0, 30.0], loadbalancer: [-15.0, -13.0, 30.0, 26.0], vxlan: [-12.3, -10.1, 24.6, 20.3]
};

// minimal scene CSS — vendored from client/style.css (icon primitives + frame + node state).
// Everything the renderer's SVG output references; nothing app-specific.
export const KERNEL_CSS = `
.hollow { fill: var(--fill, #ffffff); stroke: var(--icon, #aed581); stroke-width: 2; }
.solid  { fill: var(--icon, #aed581); stroke: var(--icon, #aed581); stroke-width: 0.2; }
.frame  { fill: var(--fill, #101010); fill-opacity: var(--outer-fill-opacity, 1); stroke: var(--outer, #aed581); stroke-width: 2.1; }
.icon   { transform: scale(0.3); }
.node   { --icon:#aed581; --fill:#101010; --outer:#aed581; }
.node .select-box { display:none; fill:none; stroke:#4fc3f7; stroke-width:2; pointer-events:none; }
.node.selected .select-box { display:block; }
`;

// glyph artwork + frame templates — vendored verbatim from client/index.html <defs id="defs">.
// The renderer's sharedDefs() appends the variant-sized #m-circle / #m-square frames.
export const GLYPH_DEFS = `<defs id="defs">
	<circle id="frame-circle" class="frame" r="21"/>
	<rect id="frame-square" class="frame" x="-21" y="-21" width="42" height="42" rx="5"/>
	<g id="glyph-host" class="icon">
		<g transform="translate(-38.5,-38.5)" class="solid" style="stroke-width:4">
			<path d="M3 0 L72 0 Q75 0 75 3 L75 52 Q75 55 72 55 L48 55 Q45 55 45 58 L45 62 Q45 65 48 65 L72 65 Q75 65 75 68 L75 72 Q75 75 72 75 L3 75 Q0 75 0 72 L0 68 Q0 65 3 65 L27 65 Q30 65 30 62 L30 58 Q30 55 27 55 L3 55 Q0 55 0 52 L0 3 Q0 0 3 0 Z"/>
			<path d="M8 5 L67 5 Q70 5 70 8 L70 47 Q70 50 67 50 L8 50 Q5 50 5 47 L5 8 Q5 5 8 5 Z" class="hollow"/>
		</g>
	</g>
	<g id="glyph-vxlan" class="icon">
		<g transform="translate(-14,-34.5)" class="solid" style="stroke-width:2">
			<path id="arrow1" d="M2 8 L38 8 Q40 8 40 6 L40 2 Q40 0 42 1 L54 11 Q56 12 54 13 L42 23 Q40 24 40 22 L40 18 Q40 16 38 16 L2 16 Q0 16 0 14 L0 10 Q0 8 2 8 Z"/>
			<use href="#arrow1" y="30"/>
			<use href="#arrow1" transform="rotate(180 0 12)" x="-28" y="-15"/>
			<use href="#arrow1" transform="rotate(180 0 12)" x="-28" y="-45"/>
		</g>
	</g>
	<g id="glyph-router" class="icon">
		<g transform="translate(-5,-12)" class="solid" style="stroke-width:2">
			<path id="arrow2" d="M2 8 L38 8 Q40 8 40 6 L40 2 Q40 0 42 1 L54 11 Q56 12 54 13 L42 23 Q40 24 40 22 L40 18 Q40 16 38 16 L2 16 Q0 16 0 14 L0 10 Q0 8 2 8 Z"/>
			<use href="#arrow2" transform="rotate(90 5 12)"/>
			<use href="#arrow2" transform="rotate(180 5 12)"/>
			<use href="#arrow2" transform="rotate(270 5 12)"/>
		</g>
		<g class="hollow" style="stroke-width:5">
			<ellipse transform="rotate(45 0 0)" rx="35" ry="10"/>
			<ellipse transform="rotate(-45 0 0)" rx="35" ry="10"/>
			<circle r="15"/>
		</g>
	</g>
	<g id="glyph-firewall" class="icon">
		<g transform="translate(-45,-35)" class="solid" style="stroke-width:2">
			<rect class="solid" style="rx:4px" x="0" y="0" width="20" height="20"/>
			<rect class="solid" style="rx:4px" x="25" y="0" width="40" height="20"/>
			<rect class="solid" style="rx:4px" x="70" y="0" width="20" height="20"/>
			<rect class="solid" style="rx:4px" x="0" y="25" width="42" height="20"/>
			<rect class="solid" style="rx:4px" x="48" y="25" width="42" height="20"/>
			<rect class="solid" style="rx:4px" x="0" y="50" width="20" height="20"/>
			<rect class="solid" style="rx:4px" x="25" y="50" width="40" height="20"/>
			<rect class="solid" style="rx:4px" x="70" y="50" width="20" height="20"/>
		</g>
	</g>
	<g id="glyph-loadbalancer" class="icon">
		<g transform="translate(-5,-12)" class="solid" style="stroke-width:2">
			<path id="arrow" d="M2 8 L38 8 Q40 8 40 6 L40 2 Q40 0 42 1 L54 11 Q56 12 54 13 L42 23 Q40 24 40 22 L40 18 Q40 16 38 16 L2 16 Q0 16 0 14 L0 10 Q0 8 2 8 Z"/>
			<use href="#arrow" transform="rotate(45 5 12)"/>
			<use href="#arrow" transform="rotate(-45 5 12)"/>
		</g>
		<line class="hollow" style="stroke-width:10" x1="-40" y1="0" x2="0" y2="0"/>
		<circle class="hollow" style="stroke-width:5" r="15"/>
		<circle class="solid" style="stroke-width:2" r="10" cx="-40"/>
	</g>
	<g id="glyph-server" class="icon">
		<rect class="hollow" style="stroke-width:7" x="-24" y="-24" width="48" height="48" rx="4px"/>
		<rect class="solid" x="-12" y="-12" width="24" height="24" rx="4px"/>
		<g id="legs" transform="translate(0, 0)" class="hollow" style="stroke-width:7">
			<line x1="24" y1="-12" x2="37" y2="-12"/>
			<line x1="24" y1="0" x2="37" y2="0"/>
			<line x1="24" y1="12" x2="37" y2="12"/>
		</g>
		<use href="#legs" transform="rotate(90 0 0)"/>
		<use href="#legs" transform="rotate(180 0 0)"/>
		<use href="#legs" transform="rotate(270 0 0)"/>
	</g>
</defs>`;
