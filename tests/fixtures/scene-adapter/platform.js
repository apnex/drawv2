/*
H26.4 (dev/design/components/VECTOR-SCENE.md D12, section 5.1) -- THE PLATFORM'S MEASURE AND SETTLE, which the page hands the renderer's
shadow so the reveal's trace runs as written: a path's length measured by a probe of draw's own holding the same `d`, never put on the
page; and the page's style computed by asking the root its box -- what the trace's forced layout asked of the line itself. They join
app/src/painter.js beside `el` at the move, a module that may reach the page's document.
*/
const NS = 'http://www.w3.org/2000/svg';
let probe = null;
export function pathLengthOf(d) {
	probe ??= document.createElementNS(NS, 'path');
	probe.setAttribute('d', d);
	return probe.getTotalLength();
}
export const settleOf = (root) => () => { void root.getBoundingClientRect(); };
