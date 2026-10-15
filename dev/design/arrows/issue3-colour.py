"""Generates issue3-colour.html: the ruled arrowhead in every link state, under three colour rules (H24.6-3)."""
import math
BLUE, GREEN, RED, ORANGE = '#4fc3f7', '#aed581', '#e57373', '#ff9800'
FRAME, PANEL, PAGE, INK, DIM = '#aed581', '#101010', '#060606', '#e0e0e0', '#9e9e9e'
CW, CH, LW, TOP = 230, 140, 230, 160
DATA, CTRL, SW = 6, 3.6, 4
size = lambda w: max(4 * w, 18)


def hollow(tip, ang, L, colour, opacity=1.0):
    half_angle = math.atan2(L / 2, L); back = (SW / 2) / math.sin(half_angle)
    tx, ty = tip[0] - back * math.cos(ang), tip[1] - back * math.sin(ang); Li = L - SW; h = Li / 2
    c, s = math.cos(ang), math.sin(ang); bx, by = tx - Li * c, ty - Li * s; px, py = -s, c
    return f'<path d="M{tx:.1f} {ty:.1f} L{bx+px*h:.1f} {by+py*h:.1f} L{bx-px*h:.1f} {by-py*h:.1f} z" fill="none" stroke="{colour}" stroke-width="{SW}" stroke-linejoin="miter" opacity="{opacity}"/>'


def square(cx, cy):
    return f'<rect x="{cx-20}" y="{cy-20}" width="40" height="40" rx="5" fill="{PANEL}" stroke="{FRAME}" stroke-width="2.1"/><rect x="{cx-7}" y="{cy-7}" width="14" height="14" fill="none" stroke="{FRAME}" stroke-width="2"/>'


def junction(cx, cy):
    return (f'<circle cx="{cx}" cy="{cy}" r="20" fill="none" stroke="{BLUE}" stroke-width="2" opacity="0.7"/>'
            f'<circle cx="{cx}" cy="{cy}" r="7" fill="{PANEL}" stroke="{BLUE}" stroke-width="3"/><circle cx="{cx}" cy="{cy}" r="2" fill="{BLUE}"/>')


STATES = {  # line colour, dotted?, opacity
    'normal': (BLUE, False, 1.0), 'selected': (GREEN, False, 1.0), 'armed': (RED, False, 1.0),
    'down': (ORANGE, True, 1.0), 'blocking': (ORANGE, False, 1.0), 'replugging': (BLUE, False, 0.15),
}


def link_and_head(cx, cy, ang, far, w, state, rule, outline=20):
    colour, dotted, op = STATES[state]
    u = (math.cos(ang), -math.sin(ang)); fx, fy = cx + far * u[0], cy + far * u[1]
    d = outline; L = size(w)
    tip = (cx + d * u[0], cy + d * u[1]); base = (cx + (d + L) * u[0], cy + (d + L) * u[1])
    if dotted: dash = f' stroke-dasharray="0 {w*2:.1f}" stroke-linecap="round"'
    elif w == CTRL: dash = f' stroke-dasharray="{w*2:.1f} {w*1.5:.1f}"'
    else: dash = ''
    line = (f'<line x1="{fx:.1f}" y1="{fy:.1f}" x2="{base[0]:.1f}" y2="{base[1]:.1f}" stroke="{colour}" stroke-width="{w}"{dash} opacity="{op}"/>'
            f'<line x1="{tip[0]:.1f}" y1="{tip[1]:.1f}" x2="{cx}" y2="{cy}" stroke="{colour}" stroke-width="{w}"{dash} opacity="{op}"/>')
    head_colour = colour if rule == 'follow' or (rule == 'selection' and state == 'selected') else BLUE
    head_op = op if rule == 'follow' else 1.0
    return line, hollow(tip, math.atan2(-u[1], -u[0]), L, head_colour, head_op)


RULES = [('a: follows its line', 'every state', 'follow'), ('b: follows when selected', 'blue otherwise', 'selection'), ('c: always blue', 'today', 'blue')]
ROWS = [('normal', 'normal'), ('selected', 'selected'), ('armed to delete (Alt)', 'armed'), ('down: no route', 'down'),
        ('blocking a down link', 'blocking'), ('end being dragged', 'replugging')]
W = LW + CW * len(RULES) + 20; H = TOP + CH * (len(ROWS) + 2) + 30
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="monospace"><rect width="{W}" height="{H}" fill="{PAGE}"/>',
       f'<text x="20" y="32" fill="{INK}" font-size="20">Arrowhead colour by state -- mockups for H24.6, issue 3 (B356)</text>',
       f'<text x="20" y="56" fill="{DIM}" font-size="12">Heads as ruled: tip on the outline (H24.6-1); 4 line widths, never under 18 px (H24.6-2);</text>',
       f'<text x="20" y="72" fill="{DIM}" font-size="12">hollow at 4 px, the line broken beneath (H24.6-2b). Line colours as today: link blue, selected green,</text>',
       f'<text x="20" y="88" fill="{DIM}" font-size="12">armed red, down and blocking orange (down dotted); a link whose end is dragged fades to 15%.</text>']
for j, (t, sub, _) in enumerate(RULES):
    x = LW + j * CW
    out.append(f'<rect x="{x+4}" y="{TOP-52}" width="{CW-8}" height="44" rx="6" fill="#161616"/><text x="{x+12}" y="{TOP-34}" fill="{INK}" font-size="13">{t}</text><text x="{x+12}" y="{TOP-16}" fill="{FRAME}" font-size="11">{sub}</text>')


def row(r, label_lines, cellfn):
    oy = TOP + r * CH
    out.append(f'<line x1="20" y1="{oy}" x2="{W-20}" y2="{oy}" stroke="#1c1c1c"/>')
    for k, part in enumerate(label_lines):
        out.append(f'<text x="20" y="{oy+64+k*16}" fill="{INK}" font-size="12">{part}</text>')
    for j, (_, _, rule) in enumerate(RULES):
        ox = LW + j * CW
        out.append(f'<g clip-path="url(#q{r}_{j})"><clipPath id="q{r}_{j}"><rect x="{ox}" y="{oy}" width="{CW}" height="{CH}"/></clipPath>{cellfn(ox, oy, rule)}</g>')


for r, (label, state) in enumerate(ROWS):
    def f(ox, oy, rule, state=state):
        cx, cy = ox + 170, oy + 70
        ln, hd = link_and_head(cx, cy, math.pi, 150, DATA, state, rule)
        return ln + square(cx, cy) + hd
    row(r, [label], f)


def junction_cell(ox, oy, rule):
    cx, cy = ox + 120, oy + 70; parts_l, parts_h = [], []
    for ang, state, w in [(math.radians(150), 'selected', DATA), (math.radians(210), 'normal', CTRL)]:
        ln, hd = link_and_head(cx, cy, ang, 110, w, state, rule); parts_l.append(ln); parts_h.append(hd)
    parts_l.append(f'<line x1="{cx}" y1="{cy}" x2="{cx+110}" y2="{cy}" stroke="{BLUE}" stroke-width="{DATA}"/>')
    return ''.join(parts_l) + junction(cx, cy) + ''.join(parts_h)


def control_cell(ox, oy, rule):
    cx, cy = ox + 170, oy + 70
    ln, hd = link_and_head(cx, cy, math.pi, 150, CTRL, 'selected', rule)
    return ln + square(cx, cy) + hd


row(len(ROWS), ['junction: one link', 'selected'], junction_cell)
row(len(ROWS) + 1, ['control link,', 'selected'], control_cell)
for j in range(1, len(RULES)):
    out.append(f'<line x1="{LW + j*CW}" y1="{TOP-4}" x2="{LW + j*CW}" y2="{H-30}" stroke="#1c1c1c"/>')
out.append('</svg>')
open('/home/apnex/taceng/arrows-colour-mockups.html', 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><title>arrowhead colour mockups</title></head><body style="margin:0;background:{PAGE}">' + '\n'.join(out) + '</body></html>')
print(W, H)
