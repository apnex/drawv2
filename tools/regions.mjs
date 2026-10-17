#!/usr/bin/env node
/*
regions -- H25.4 (B376). A page's generated regions: the lines between a BEGIN and an END GENERATED marker, written from a
declaration and checked against it (mission-kit P3: one master, the copies generated, the round trip gated). tools/stylesheets.mjs
writes the stylesheet list a page loads, tools/canvas-layout.mjs the canvas it lays out. tools/copies.mjs leaves a generated
region out of its copied-lines measure, so two pages holding the same region repeat nothing typed.

  markersOf(name, tool, source)  -> { begin, end }   the two marker comments, naming the tool that writes and what it reads
  withRegion(html, markers, lines) -> html | null     the page with its region holding the lines, each at the begin marker's
                                                      indent; null when the page has no such region; a page holding it twice
                                                      is refused, since only one is written and the copy measure skips one
*/
export const markersOf = (name, tool, source) => ({
	begin: `<!-- BEGIN GENERATED: ${name}. Run node ${tool} --write; do not edit by hand (${source}). -->`,
	end: `<!-- END GENERATED: ${name} -->`,
});

export function withRegion(html, { begin, end }, lines) {
	const at = html.indexOf(begin), stop = html.indexOf(end);
	if (at < 0 || stop < at) return null;
	if (html.indexOf(begin, at + 1) >= 0) throw new Error(`holds the region "${begin.slice(5, 60)}..." twice -- one is written from the declaration, so the other is typed`);
	const indent = html.slice(html.lastIndexOf('\n', at) + 1, at);
	return html.slice(0, at) + [begin, ...lines, end].join(`\n${indent}`) + html.slice(stop + end.length);
}
