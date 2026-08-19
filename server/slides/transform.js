/*
Transform — pure functions: draw document -> Google Slides batchUpdate requests.
NATIVE SHAPES ONLY (docs/spec/SCOPE.md decision 4): rectangles, ellipses, lines, text —
individually editable in Slides afterwards. No images, ever.

Geometry: the 1920x1080 canvas maps 1:1 onto a 16:9 slide (720x405 PT),
so 1 canvas px = 0.375 PT. The dark theme travels with the diagram.
*/

import { SURFACE } from '../../document/index.mjs';

const NODE_R = 21;
const HUB_R = 3; // the center-attachment hub: a 6px dot whose every site IS the center

/*
Page-aware scaling: the push adapts to whatever page the deck has — there is
no mode and nothing stored. Model coordinates are center-origin; the page
center is the anchor, and the uniform scale fits the 1920x1080 canvas inside
the page (a 16:9 page is filled exactly; other aspects letterbox, centered).
On the default 10in page 1px = 4762.5 EMU (today's output, unchanged);
on a 19.2 x 10.8 cm page 1px = 3600 EMU — every value decimal-exact.
*/
const DEFAULT_PAGE = { width: { magnitude: 9144000, unit: 'EMU' }, height: { magnitude: 5143500, unit: 'EMU' } };
const EMU_PER_PT = 12700;

export function makeScale(pageSize) {
	const dim = (d) => !d ? 0 : (d.unit === 'PT' ? d.magnitude * EMU_PER_PT : d.magnitude);
	let w = dim(pageSize?.width);
	let h = dim(pageSize?.height);
	if (!(w > 0 && h > 0)) {
		w = DEFAULT_PAGE.width.magnitude;
		h = DEFAULT_PAGE.height.magnitude;
	}
	const scale = Math.min(w / SURFACE.w, h / SURFACE.h); // EMU per canvas px
	return {
		scale,
		cx: w / 2,
		cy: h / 2,
		// text/strokes scale with the page so the rendered look is identical
		fontFactor: scale / 4762.5
	};
}

export const DEFAULT_SCALE = makeScale(DEFAULT_PAGE);

// draw palette (style.css) -> Slides rgbColor
const COLOR = {
	background: rgb('#101010'),
	nodeFill: rgb('#101010'),
	nodeStroke: rgb('#aed581'),
	label: rgb('#ddddff'),
	link: rgb('#4fc3f7'),
	zone: rgb('#ddddff')
};

function rgb(hex) {
	return {
		red: parseInt(hex.slice(1, 3), 16) / 255,
		green: parseInt(hex.slice(3, 5), 16) / 255,
		blue: parseInt(hex.slice(5, 7), 16) / 255
	};
}

function geom(s) {
	return {
		x: (px) => Math.round(s.cx + px * s.scale),   // center-anchored, integer EMU
		y: (py) => Math.round(s.cy + py * s.scale),
		len: (px) => Math.max(1, Math.round(px * s.scale)),
		weightPt: (basePt) => Math.round(basePt * s.fontFactor * 100) / 100,
		fontPt: (basePt) => Math.max(1, Math.round(basePt * s.fontFactor * 100) / 100)
	};
}

function frame(g, x, y, w, h, pageId) {
	return {
		pageObjectId: pageId,
		size: {
			width: { magnitude: g.len(w), unit: 'EMU' },
			height: { magnitude: g.len(h), unit: 'EMU' }
		},
		transform: { scaleX: 1, scaleY: 1, translateX: g.x(x), translateY: g.y(y), unit: 'EMU' }
	};
}

// ids of objects draw owns on a slide (used to find our objects for re-sync)
export const OWNED_ID = /^(node|link|zone)-[0-9a-f]{6}(--label|--hub|--g)?$/;
const SUFFIX = /--(label|hub|g)$/;
export const baseId = (objectId) => objectId.replace(SUFFIX, '');

export function parseSlidesUrl(url) {
	if (/\/presentation\/d\/e\//.test(url || '')) return { published: true };
	const presentation = /\/presentation\/d\/([a-zA-Z0-9_-]+)/.exec(url || '');
	if (!presentation) return null;
	const slide = /[#&]slide=id\.([a-zA-Z0-9_:-]+)/.exec(url);
	return { presentationId: presentation[1], pageId: slide ? slide[1] : null };
}

/*
Requests that delete what THIS push owns — two-tiered, because several
diagrams may be pushed to different slides of one presentation:
 - on the TARGET slide: every draw-shaped id (stale cleanup, since deleted
   entities are no longer in the model)
 - on every OTHER slide: only ids belonging to this diagram's entities
   (handles re-binding the URL to a different slide without touching
   sibling diagrams' pushes)
A group whose members are all ours is deleted as one object (deleting children
one-by-one can auto-dissolve the group mid-batch and void the batch).
*/
export function deletePlan(presentation, targetPageId, modelIds) {
	const ids = [];
	let staleDeleted = 0;
	const isStale = (objectId) => !modelIds || !modelIds.has(baseId(objectId));
	const owns = (objectId, onTarget) => {
		if (!OWNED_ID.test(objectId)) return false;
		if (onTarget) return true;
		return !!modelIds && modelIds.has(baseId(objectId));
	};
	const ownedDeep = (el, onTarget) => {
		if (el.elementGroup) {
			const children = el.elementGroup.children || [];
			return children.length > 0 && children.every((c) => ownedDeep(c, onTarget));
		}
		return owns(el.objectId, onTarget);
	};
	// staleness is judged on LEAVES (a user's wrapper group has no model identity)
	const countStaleLeaves = (el) => {
		if (el.elementGroup) {
			(el.elementGroup.children || []).forEach(countStaleLeaves);
		} else if (OWNED_ID.test(el.objectId) && isStale(el.objectId)) {
			staleDeleted++;
		}
	};
	const walk = (elements, onTarget) => {
		for (const el of elements || []) {
			if (el.elementGroup) {
				if (ownedDeep(el, onTarget)) {
					ids.push(el.objectId);
					countStaleLeaves(el);
				} else {
					walk(el.elementGroup.children, onTarget);
				}
			} else if (owns(el.objectId, onTarget)) {
				ids.push(el.objectId);
				countStaleLeaves(el);
			}
		}
	};
	(presentation.slides || []).forEach((slide) =>
		walk(slide.pageElements, slide.objectId === targetPageId));
	return { requests: ids.map((objectId) => ({ deleteObject: { objectId } })), staleDeleted };
}

/*
Create requests for the whole document. Z-order = creation order:
background, zones (labels inline), links, nodes, node labels.
*/
export function createRequests(doc, pageId, scaleInfo = DEFAULT_SCALE) {
	const g = geom(scaleInfo);
	const requests = [];

	// the dark stage travels with the diagram
	requests.push({
		updatePageProperties: {
			objectId: pageId,
			pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: COLOR.background } } } },
			fields: 'pageBackgroundFill.solidFill.color'
		}
	});

	(doc.zones || []).forEach((zone) => {
		requests.push({
			createShape: {
				objectId: zone.id,
				// sharp corners: the Slides API exposes no corner-radius adjustment,
				// and ROUND_RECTANGLE's default (~1/6 of the short side) is far
				// rounder than the source rx 6px (= 2.25 PT); RECTANGLE is closest
				shapeType: 'RECTANGLE',
				elementProperties: frame(g, zone.x, zone.y, zone.w, zone.h, pageId)
			}
		});
		requests.push({
			updateShapeProperties: {
				objectId: zone.id,
				shapeProperties: {
					shapeBackgroundFill: { solidFill: { color: { rgbColor: COLOR.zone }, alpha: 0.3 } },
					outline: {
						outlineFill: { solidFill: { color: { rgbColor: COLOR.zone } } },
						weight: { magnitude: g.weightPt(1.13), unit: 'PT' }
					},
					contentAlignment: 'TOP'
				},
				fields: 'shapeBackgroundFill.solidFill,outline.outlineFill.solidFill.color,outline.weight,contentAlignment'
			}
		});
		// zone label lives INSIDE the shape: it moves and resizes with the zone
		if (zone.name) {
			requests.push({ insertText: { objectId: zone.id, text: zone.name } });
			requests.push(...textStyling(zone.id, 'START', g));
		}
	});

	const nodeById = Object.fromEntries((doc.nodes || []).map((n) => [n.id, n]));
	(doc.links || []).forEach((link) => {
		const src = nodeById[link.src];
		const dst = nodeById[link.dst];
		if (!src || !dst) return;
		// line spans ring edge to ring edge along the link direction
		const len = Math.hypot(dst.x - src.x, dst.y - src.y) || 1;
		const ux = (dst.x - src.x) / len;
		const uy = (dst.y - src.y) / len;
		const x1 = src.x + ux * NODE_R, y1 = src.y + uy * NODE_R;
		const x2 = dst.x - ux * NODE_R, y2 = dst.y - uy * NODE_R;
		requests.push({
			createLine: {
				objectId: link.id,
				lineCategory: 'STRAIGHT',
				elementProperties: {
					pageObjectId: pageId,
					size: {
						width: { magnitude: g.len(Math.abs(x2 - x1)), unit: 'EMU' },
						height: { magnitude: g.len(Math.abs(y2 - y1)), unit: 'EMU' }
					},
					transform: {
						scaleX: x2 >= x1 ? 1 : -1,
						scaleY: y2 >= y1 ? 1 : -1,
						translateX: g.x(x1),
						translateY: g.y(y1),
						unit: 'EMU'
					}
				}
			}
		});
		requests.push({
			updateLineProperties: {
				objectId: link.id,
				lineProperties: {
					lineFill: { solidFill: { color: { rgbColor: COLOR.link } } },
					weight: { magnitude: g.weightPt(3), unit: 'PT' }
				},
				fields: 'lineFill.solidFill.color,weight'
			}
		});
	});

	(doc.nodes || []).forEach((node) => {
		requests.push({
			createShape: {
				objectId: node.id,
				// every node is a circle, faithful to the canvas icons; with ellipses,
				// rerouteLine's nearest-site choice always points lines at the center,
				// matching the source's center-to-center links. Per-type shapes /
				// inner icons are a deliberate future discussion.
				shapeType: 'ELLIPSE',
				elementProperties: frame(g, node.x - NODE_R, node.y - NODE_R, NODE_R * 2, NODE_R * 2, pageId)
			}
		});
		requests.push({
			updateShapeProperties: {
				objectId: node.id,
				shapeProperties: {
					// alpha is explicit: the broad mask would reset it to transparent
					shapeBackgroundFill: { solidFill: { color: { rgbColor: COLOR.nodeFill }, alpha: 1 } },
					outline: {
						outlineFill: { solidFill: { color: { rgbColor: COLOR.nodeStroke } } },
						// canvas ring is 7 defs-units at 0.3 icon scale = 2.1px rendered,
						// not 7px: 1pt (~2.7px) is the faithful weight at default scale
						weight: { magnitude: g.weightPt(1), unit: 'PT' }
					}
				},
				fields: 'shapeBackgroundFill.solidFill,outline.outlineFill.solidFill.color,outline.weight'
			}
		});
		/*
		The hub: a small visible dot at the node's center. Connectors bind to
		it — a 6px ellipse's connection sites are all effectively the center,
		so lines attach center-out from every angle (no 45-degree site
		quantization) and track the center when the grouped node is dragged.
		*/
		requests.push({
			createShape: {
				objectId: `${node.id}--hub`,
				shapeType: 'ELLIPSE',
				elementProperties: frame(g, node.x - HUB_R, node.y - HUB_R, HUB_R * 2, HUB_R * 2, pageId)
			}
		});
		requests.push({
			updateShapeProperties: {
				objectId: `${node.id}--hub`,
				shapeProperties: {
					shapeBackgroundFill: { solidFill: { color: { rgbColor: COLOR.nodeStroke }, alpha: 1 } },
					outline: {
						outlineFill: { solidFill: { color: { rgbColor: COLOR.nodeStroke } } },
						weight: { magnitude: g.weightPt(0.38), unit: 'PT' }
					}
				},
				fields: 'shapeBackgroundFill.solidFill,outline.outlineFill.solidFill.color,outline.weight'
			}
		});
		// node labels: TEXT_BOX below the ring (v1 look); grouped with the node
		// so it travels when the node is moved in Slides
		if (node.name) {
			/*
			Wrap-proof width: the API exposes no inset/padding control, so the box
			is sized to its text instead — 6pt Courier advances ~3.6pt (9.6px) per
			char, plus the fixed ~14.4pt (38.4px) of built-in side insets.
			The box stays centered on the node; invisible boxes cost nothing.
			*/
			// CJK/fullwidth glyphs advance a full em; everything else a half
			const advance = [...node.name].reduce((sum, ch) =>
				sum + (ch.codePointAt(0) > 0x2e7f ? 16 : 9.6), 0);
			const labelW = Math.min(1280, Math.max(160, advance + 48));
			requests.push({
				createShape: {
					objectId: `${node.id}--label`,
					shapeType: 'TEXT_BOX',
					// box CENTER sits where the canvas centers the label text
					elementProperties: frame(g, node.x - labelW / 2, node.y + NODE_R + 1, labelW, 22, pageId)
				}
			});
			/*
			The API exposes no text-inset control, so "padding: 0" is expressed
			geometrically: MIDDLE content alignment cancels the default top/bottom
			insets exactly as CENTER paragraph alignment cancels left/right —
			the text lands at the box's geometric center, matching the canvas.
			*/
			requests.push({
				updateShapeProperties: {
					objectId: `${node.id}--label`,
					shapeProperties: { contentAlignment: 'MIDDLE' },
					fields: 'contentAlignment'
				}
			});
			requests.push({ insertText: { objectId: `${node.id}--label`, text: node.name } });
			requests.push(...textStyling(`${node.id}--label`, 'CENTER', g));
		}
	});

	return requests;
}

/*
Group each node's parts (circle + hub + label) into one Slides group with a
draw-owned id: dragging the group moves the hub, so bound connectors track
the center; the label rides along. Sent as its own best-effort batch.
*/
export function groupRequests(doc) {
	return (doc.nodes || []).map((node) => ({
		groupObjects: {
			groupObjectId: `${node.id}--g`,
			childrenObjectIds: [
				node.id,
				`${node.id}--hub`,
				...(node.name ? [`${node.id}--label`] : [])
			]
		}
	}));
}

function textStyling(objectId, alignment, g) {
	return [
		{
			updateTextStyle: {
				objectId,
				textRange: { type: 'ALL' },
				style: {
					foregroundColor: { opaqueColor: { rgbColor: COLOR.label } },
					fontFamily: 'Courier New',
					// scales with the page so the rendered proportion never changes
					fontSize: { magnitude: g.fontPt(6), unit: 'PT' }
				},
				fields: 'foregroundColor,fontFamily,fontSize'
			}
		},
		{
			updateParagraphStyle: {
				objectId,
				textRange: { type: 'ALL' },
				style: { alignment },
				fields: 'alignment'
			}
		}
	];
}

/*
Best-effort connector binding, sent as a SEPARATE batch after creation: each
line binds to its endpoints' center HUBS. Every connection site of a 6px hub
is effectively the center, so site 0 is always correct — no rerouteLine, no
angular quantization. If the batch is rejected, lines stay geometric.
*/
export function connectRequests(doc) {
	const nodeIds = new Set((doc.nodes || []).map((n) => n.id));
	return (doc.links || [])
		.filter((l) => nodeIds.has(l.src) && nodeIds.has(l.dst))
		.map((link) => ({
			updateLineProperties: {
				objectId: link.id,
				lineProperties: {
					startConnection: { connectedObjectId: `${link.src}--hub`, connectionSiteIndex: 0 },
					endConnection: { connectedObjectId: `${link.dst}--hub`, connectionSiteIndex: 0 }
				},
				fields: 'startConnection,endConnection'
			}
		}));
}

// honest counts for reports: entities vs total created objects
export function countCreated(requests) {
	const objects = requests.filter((r) => r.createShape || r.createLine);
	return {
		objects: objects.length,
		entities: objects.filter((r) => !SUFFIX.test((r.createShape || r.createLine).objectId)).length
	};
}
