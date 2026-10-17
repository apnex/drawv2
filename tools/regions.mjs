#!/usr/bin/env node
/*
regions -- H25.4 (B376). A page's generated regions: the lines between a BEGIN and an END GENERATED marker, written from a
declaration and checked against it (mission-kit P3: one master, the copies generated, the round trip gated). tools/page-regions.mjs
declares each region -- its exact markers and the lines it holds -- for the generators that write it and the copy measure that
leaves it out, so the two cannot disagree on what a region is.

A REGION is a BEGIN marker, exactly, at the start of its line after whitespace only, the first END marker after it, and the
lines between. The copy measure leaves one out of a page's typed lines only when it holds exactly the lines its generator writes,
found on the page as written; anything else is compared like any typed line, and every marker not opening or closing such a region
is a stray. The other side of every comparison is read in full (tools/copies.mjs), so a region hides nothing typed elsewhere.

  markersOf(name, { tool, source })   -> { begin, end }   the two marker comments, exactly
  withRegion(html, region, where)     -> html | null      the page with its region holding its lines at the marker's indent; null
                                                          when it has none; a page holding it twice is refused, by name
  withoutRegions(text, regions)       -> text             each region left out that holds exactly its lines, all found on the
                                                          text as given (removing one never makes another)
  strayMarkers(text, regions)         -> [marker]         every GENERATED marker that is not the begin or end of a region left out

CORRECTED by H25.4's three verifiers: the copy measure left out any marked region; then any whose marker began with an owned
name; then any exact pair, wherever it stood -- in a stylesheet, or made by removing the region before it -- so typed lines hid
from it. It now trusts a region only for holding what its generator writes.
*/
export const markersOf = (name, { tool, source }) => ({
	begin: `<!-- BEGIN GENERATED: ${name}. Run node ${tool} --write; do not edit by hand (${source}). -->`,
	end: `<!-- END GENERATED: ${name} -->`,
});

// where a page holds the region, as defined above, or null
function regionAt(text, { begin, end }) {
	const at = text.indexOf(begin);
	if (at < 0) return null;
	const stop = text.indexOf(end, at + begin.length);
	const indent = text.slice(text.lastIndexOf('\n', at) + 1, at);
	if (stop < 0 || /\S/.test(indent)) return null;
	return { at, stop, indent };
}

export function withRegion(html, region, where = 'the page') {
	const found = regionAt(html, region);
	if (!found) return null;
	if (html.indexOf(region.begin, found.at + 1) >= 0) throw new Error(`${where} holds the region "${region.begin.slice(5, 60)}..." twice -- one is written from its declaration, so the other is typed`);
	return html.slice(0, found.at) + [region.begin, ...region.lines, region.end].join(`\n${found.indent}`) + html.slice(found.stop + region.end.length);
}

// the regions a text holds exactly as their generators write them, as spans of the text given
function exactSpans(text, regions) {
	const spans = [];
	for (const r of regions) {
		const found = regionAt(text, r);
		if (!found) continue;
		const held = text.slice(found.at + r.begin.length, found.stop).split('\n').map((l) => l.trim()).filter(Boolean);
		const lines = r.lines.map((l) => l.trim()).filter(Boolean);
		if (held.length === lines.length && held.every((l, i) => l === lines[i])) spans.push({ at: found.at, stop: found.stop + r.end.length, begin: found.at, end: found.stop });
	}
	// two cannot overlap: a region trusted holds only its generator's lines, which carry no marker
	return spans.sort((a, b) => a.at - b.at);
}

export function withoutRegions(text, regions) {
	let out = '', from = 0;
	for (const s of exactSpans(text, regions)) { out += text.slice(from, s.at); from = s.stop; }
	return out + text.slice(from);
}

export function strayMarkers(text, regions) {
	const kept = new Set(exactSpans(text, regions).flatMap((s) => [s.begin, s.end]));
	return [...text.matchAll(/<!--\s*(?:BEGIN|END)\s+GENERATED\b[\s\S]*?-->|\/\*\s*(?:BEGIN|END)\s+GENERATED\b[\s\S]*?\*\//gi)].filter((m) => !kept.has(m.index)).map((m) => m[0]);
}
