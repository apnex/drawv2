#!/usr/bin/env node
/*
regions -- H25.4 (B376). A page's generated regions: the lines between a BEGIN and an END GENERATED marker, written from a
declaration and checked against it (mission-kit P3: one master, the copies generated, the round trip gated). tools/stylesheets.mjs
writes the stylesheet list a page loads, tools/canvas-layout.mjs the canvas it lays out; tools/layers.mjs `COPIES.generated` names
each region with the tool that writes it and what it reads, so the generators and the copy measure build the same markers.

  markersOf(name, { tool, source })  -> { begin, end }  the two marker comments, exactly
  withRegion(html, markers, lines, where) -> html | null the page with its region holding the lines, each at the begin marker's
                                                         indent; null when it has no such region; one holding it twice is refused
  withoutRegions(text, markers)      -> text             each region left out, its first only, matched exactly -- for the copy
                                                         measure, which compares what is typed
  strayMarkers(text, markers)        -> [marker]         every GENERATED marker that is not exactly one of these: a region no
                                                         generator writes, or a near copy of one, would hide typed lines

CORRECTED twice by H25.4's verifiers: the copy measure first left out any marked region, then any whose marker began with an owned
name, so lines typed in a made-up region, or one opened by a near copy of a real marker, hid from it.
*/
export const markersOf = (name, { tool, source }) => ({
	begin: `<!-- BEGIN GENERATED: ${name}. Run node ${tool} --write; do not edit by hand (${source}). -->`,
	end: `<!-- END GENERATED: ${name} -->`,
});

export function withRegion(html, { begin, end }, lines, where = 'the page') {
	const at = html.indexOf(begin), stop = html.indexOf(end, at);
	if (at < 0 || stop < 0) return null;
	if (html.indexOf(begin, at + 1) >= 0) throw new Error(`${where} holds the region "${begin.slice(5, 60)}..." twice -- one is written from its declaration, so the other is typed`);
	const indent = html.slice(html.lastIndexOf('\n', at) + 1, at);
	return html.slice(0, at) + [begin, ...lines, end].join(`\n${indent}`) + html.slice(stop + end.length);
}

export function withoutRegions(text, markers) {
	let out = text;
	for (const { begin, end } of markers) {
		const at = out.indexOf(begin), stop = out.indexOf(end, at);
		if (at >= 0 && stop >= 0) out = out.slice(0, at) + out.slice(stop + end.length);
	}
	return out;
}

export function strayMarkers(text, markers) {
	const exact = new Set(markers.flatMap((m) => [m.begin, m.end]));
	return [...text.matchAll(/<!--\s*(?:BEGIN|END)\s+GENERATED\b[\s\S]*?-->/gi)].map((m) => m[0]).filter((m) => !exact.has(m));
}
