"""Generates device-junction-mark.html: how a device that passes routes shows it is a junction (B362).

Every picture is the product's own drawing: the board below is drawn by the export (`server/svg.mjs` `svgDocument`, which
draws what view mode draws since H24.8). Each option is then the same drawing with the device's junction mark changed, so the
glyphs, frames, links and heads are exact.

Run from the repository root: `python3 dev/design/junctions/device-junction-mark.py [PUBLISHED_SVG_ADDRESS] [OUTPUT]`.
Given a published diagram's address, the page also shows every junction device in that diagram. The address is an argument,
never written here, because this repository is public and a published diagram's address is the whole of its access (B363).
"""
import json, re, subprocess, sys, urllib.request

PAGE, INK, DIM, GREEN, BLUE, PANEL = '#060606', '#e0e0e0', '#9e9e9e', '#aed581', '#4fc3f7', '#101010'
LIVE = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else None
OUT = sys.argv[2] if len(sys.argv) > 2 else '/home/apnex/taceng/device-junction-mark-mockups.html'
SCALE, HW, TOP_Y, BOTTOM_Y = 1.3, 125, -95, 70   # a cell: 250 x 165 canvas units around its device, shown 1.3 times

# the board: each case at its own place, far apart; the far ends of its links lie outside the cell
BOARD = r"""
import { svgDocument } from './server/svg.mjs';
import { pipeEntity } from './network/pipe-kind.mjs';
import { heldLayouts } from './tests/fixtures/composed.mjs';
const nodes = [], links = [], pipes = [];
let n = 0;
const node = (name, type, x, y, shape = 'square') => { const id = `node-${(0xa00 + ++n).toString(16).padStart(6, '0')}`; nodes.push({ id, name, ...(type ? { type, shape } : {}), x, y }); return id; };
const link = (src, dst, via = []) => {
	links.push({ id: `link-${(0xb00 + links.length + 1).toString(16).padStart(6, '0')}`, name: `l${links.length + 1}`, src, dst, ...(via.length ? { via } : {}), direction: 'forward' });
	const stops = [src, ...via, dst];
	for (let i = 1; i < stops.length; i++) pipes.push(pipeEntity(stops[i - 1], stops[i], 'link'));
};
const meet = (name, type, shape, x, y) => {   // two links arrive, one leaves: three end here, a junction
	const d = node(name, type, x, y, shape);
	link(node('w', 'host', x - 300, y), d); link(node('n', 'host', x, y - 240), d); link(d, node('e', 'host', x + 300, y));
};
meet('firewall-1', 'firewall', 'square', 0, 0);
const p = node('rtr-pinned', 'router', 0, 600, 'square');   // a link pinned through a router: a junction too
link(node('w', 'host', -300, 600), node('e', 'host', 300, 600), [p]);
link(node('w', 'host', -300, 1200), node('rtr-edge', 'router', 0, 1200, 'circle'));   // one link ends here: an endpoint
const wp = node('', null, 0, 1800);   // a waypoint where three links end
link(node('w', 'host', -300, 1800), wp); link(node('n', 'host', 0, 1560), wp); link(wp, node('e', 'host', 300, 1800));
const doc = { meta: { id: '00000000000000a1', name: 'board', version: 1, schema: 3 }, layouts: heldLayouts(), nodes, links, pipes, zones: [], groups: [], selection: [] };
console.log(JSON.stringify(svgDocument(doc)));
"""

NODE_GROUP = re.compile(r'(<g id="node-[0-9a-f]{6}" class="node" transform="translate\(([-\d.]+),([-\d.]+)\)">)((?:(?!<g[ >]).)*?)(</g>)', re.S)
RING = re.compile(r'<circle class="wp-junction"[^>]*/>')


def change(svg, option):
    """The same drawing with every junction device's mark as `option` draws it; a device that is no junction is untouched."""
    def one(m):
        head, inner, tail = m.group(1), m.group(4), m.group(5)
        ring = RING.search(inner)
        if not ring:
            return m.group(0)
        inner = inner.replace(ring.group(0), '')
        round_ = 'href="#m-circle"' in inner
        if option == 'today':
            inner = inner[:ring.start()] + ring.group(0) + inner[ring.start():]
        elif option == 'beneath':
            frame = re.search(r'<use data-layer="frame"[^>]*/>', inner)
            inner = inner[:frame.end()] + ring.group(0) + inner[frame.end():]
        elif option == 'outline':
            mark = (f'<circle r="16.5" fill="none" stroke="{BLUE}" stroke-width="2"/>' if round_
                    else f'<rect x="-16.5" y="-16.5" width="33" height="33" rx="3" fill="none" stroke="{BLUE}" stroke-width="2"/>')
            at = inner.index('</svg>') + len('</svg>')
            inner = inner[:at] + mark + inner[at:]
        elif option == 'badge':
            cx = 14.1 if round_ else 20
            mark = f'<circle cx="{cx}" cy="{-cx}" r="5" fill="{PANEL}" stroke="{BLUE}" stroke-width="2"/>'
            at = inner.index('<rect class="label-pill"')
            inner = inner[:at] + mark + inner[at:]
        return head + inner + tail
    return NODE_GROUP.sub(one, svg)


SPRITES = {}   # each drawing, as changed by an option, held once in the page; a cell shows a window onto it


def cell(svg, key, x, y):
    if (id(svg), key) not in SPRITES:
        body = re.sub(r'^\s*<svg[^>]*>|</svg>\s*$', '', change(svg, key))
        SPRITES[(id(svg), key)] = (f'd{len(SPRITES)}', body)
    sid = SPRITES[(id(svg), key)][0]
    w, h = 2 * HW, BOTTOM_Y - TOP_Y
    return f'<svg width="{w * SCALE:.0f}" height="{h * SCALE:.0f}" viewBox="{x - HW} {y + TOP_Y} {w} {h}"><use href="#{sid}"/></svg>'


board = json.loads(subprocess.run(['node', '--input-type=module', '-e', BOARD], capture_output=True, text=True, check=True).stdout)
live = None
if LIVE:
    try:
        live = urllib.request.urlopen(LIVE, timeout=20).read().decode()
    except Exception as e:
        print('the published diagram could not be read, so its rows are left out:', e)


def junction_devices(svg):
    """Each device in a drawing that draws a junction ring today: its place, its name and its glyph's type."""
    out = []
    for m in NODE_GROUP.finditer(svg):
        inner = m.group(4)
        if RING.search(inner):
            name = re.search(r'<text class="label"[^>]*>([^<]*)</text>', inner)
            glyph = re.search(r'href="#glyph-([\w-]+)"', inner)
            shape = 'round' if 'href="#m-circle"' in inner else 'square'
            out.append((float(m.group(2)), float(m.group(3)), name.group(1) if name else '', f'{glyph.group(1) if glyph else "device"}, {shape}'))
    return out

OPTIONS = [
    ('today', 'Today', 'the ring over the glyph'),
    ('none', 'A. No mark on a device', 'the glyph alone, as for an endpoint'),
    ('beneath', 'B. The ring beneath the glyph', 'drawn after the frame, before the glyph'),
    ('outline', 'C. A blue inner outline', 'inside the frame, around the glyph'),
    ('badge', 'D. A small mark at a corner', 'on the frame, top right'),
]
ROWS = []
if live:
    ROWS += [(live, x, y, name, f'{what}: a junction', 'your published diagram') for x, y, name, what in junction_devices(live)]
ROWS += [(board, 0, 0, 'firewall', 'square: three links end here', 'test board'),
         (board, 0, 600, 'router, pinned through', 'one link passes through it (w while drawing)', 'test board'),
         (board, 0, 1200, 'control: router, one link', 'an endpoint: no mark in any option', 'test board'),
         (board, 0, 1800, 'reference: a waypoint', 'a junction on a bare anchor: unchanged', 'test board')]

LABEL_W = 230
cw = int(2 * HW * SCALE)
html = [f'<!doctype html><html><head><meta charset="utf-8"><title>a device junction mark -- mockups (B362)</title>',
        f'<style>body{{margin:0;background:{PAGE};color:{INK};font-family:monospace}} .wrap{{padding:18px 20px}}'
        f' table{{border-collapse:collapse}} td,th{{padding:6px;vertical-align:middle;border-top:1px solid #1c1c1c}}'
        f' th{{text-align:left;font-weight:normal;background:#161616}} .sub{{color:{GREEN};font-size:11px}} .dim{{color:{DIM};font-size:12px}}'
        f' .rec{{outline:2px solid {GREEN};outline-offset:-2px}}</style></head><body><div class="wrap">',
        f'<div style="font-size:20px">How a device shows it is a junction -- mockups (B362)</div>',
        f'<p class="dim" style="max-width:1500px;line-height:1.5">A router, firewall or vxlan passes routes, so it becomes a junction when three or more links end at it, or when a link is pinned through it.'
        f' Today the network draws its junction ring -- the same light-blue ring a waypoint junction draws -- over the middle of the device\'s glyph.'
        f' Every picture here is the product\'s own drawing (view mode, which the published SVG now matches); each column changes only the junction mark.'
        f' A device with one link (an endpoint) and a waypoint junction are shown as controls: no option changes them.</p>',
        f'<table><tr><th style="width:{LABEL_W}px"></th>']
for key, title, sub in OPTIONS:
    html.append(f'<th style="width:{cw}px"{" class=rec" if key == "none" else ""}>{title}<br><span class="sub">{sub}</span></th>')
html.append('</tr>')
for svg, x, y, name, what, source in ROWS:
    html.append(f'<tr><td style="width:{LABEL_W}px">{name}<br><span class="dim">{what}</span><br><span class="sub">{source}</span></td>')
    for key, _, _ in OPTIONS:
        html.append(f'<td>{cell(svg, key, x, y)}</td>')
    html.append('</tr>')
html.append('</table><p class="dim">Outlined in green: the recommendation (A). Generated by dev/design/junctions/device-junction-mark.py.</p></div>')
for sid, body in SPRITES.values():
    html.append(f'<svg width="0" height="0" style="position:absolute"><g id="{sid}">{body}</g></svg>')
html.append('</body></html>')
open(OUT, 'w').write('\n'.join(html))
print('rows', len(ROWS), 'options', len(OPTIONS))
