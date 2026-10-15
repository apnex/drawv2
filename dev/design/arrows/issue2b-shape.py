import math
LINK, FRAME, PANEL, PAGE, GROUP, INK, DIM = '#4fc3f7', '#aed581', '#101010', '#060606', '#b388ff', '#e0e0e0', '#9e9e9e'
CW, CH, LW, TOP = 165, 140, 210, 150
DATA, CTRL = 6, 3.6
size = lambda w: max(4 * w, 18)   # H24.6-2
OUTLINE_W = 2                      # a hollow head's outline, the weight of a device frame
def pts(tip, ang, L, half_w, notch=0.0):
    tx, ty = tip; c, s = math.cos(ang), math.sin(ang); px, py = -s, c
    bx, by = tx - L * c, ty - L * s
    a = (bx + px * half_w, by + py * half_w); b = (bx - px * half_w, by - py * half_w)
    n = (tx - (L - notch * L) * c, ty - (L - notch * L) * s)
    return (tx, ty), a, b, n
def inset_tip(tip, ang, L, half_w, stroke):
    # move the tip back so a stroke's outer edge, not its centre line, touches the outline
    half_angle = math.atan2(half_w, L)
    back = (stroke / 2) / math.sin(half_angle)
    return (tip[0] - back * math.cos(ang), tip[1] - back * math.sin(ang))
def shape(kind, tip, ang, w):
    L = size(w)
    if kind == 'filled':
        t, a, b, _ = pts(tip, ang, L, L / 2)
        return f'<path d="M{t[0]:.1f} {t[1]:.1f} L{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f} z" fill="{LINK}"/>'
    if kind.startswith('hollow') or kind.startswith('see-through'):
        sw = 4 if kind.endswith('4') else 2
        t, a, b, _ = pts(inset_tip(tip, ang, L, L / 2, sw), ang, L - sw, (L - sw) / 2)
        fill = PANEL if kind.startswith('hollow') else 'none'
        return f'<path d="M{t[0]:.1f} {t[1]:.1f} L{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f} z" fill="{fill}" stroke="{LINK}" stroke-width="{sw}" stroke-linejoin="miter"/>'
    if kind == 'chevron':
        sw = max(w * 0.6, 2.4)
        t, a, b, _ = pts(inset_tip(tip, ang, L, L / 2, sw), ang, L * 0.8, L * 0.42)
        return f'<path d="M{a[0]:.1f} {a[1]:.1f} L{t[0]:.1f} {t[1]:.1f} L{b[0]:.1f} {b[1]:.1f}" fill="none" stroke="{LINK}" stroke-width="{sw:.1f}" stroke-linejoin="miter" stroke-linecap="butt"/>'
    if kind == 'narrow':
        t, a, b, _ = pts(tip, ang, L, L * 0.33)
        return f'<path d="M{t[0]:.1f} {t[1]:.1f} L{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f} z" fill="{LINK}"/>'
    if kind == 'notched':
        t, a, b, n = pts(tip, ang, L, L / 2, notch=0.3)
        return f'<path d="M{t[0]:.1f} {t[1]:.1f} L{a[0]:.1f} {a[1]:.1f} L{n[0]:.1f} {n[1]:.1f} L{b[0]:.1f} {b[1]:.1f} z" fill="{LINK}"/>'
SHAPES = [('filled', 'today\'s shape, F size'), ('hollow 2', '2 px, opaque inside'), ('hollow 4', '4 px, opaque inside'), ('see-through 4', '4 px, line to the tip'),
          ('chevron', 'open, no base'), ('narrow', 'filled, two-thirds wide'), ('notched', 'filled, swept back')]
def square(cx, cy, selected=False, grouped=False):
    s = f'<rect x="{cx-26}" y="{cy-26}" width="52" height="52" rx="11" fill="none" stroke="{GROUP}" stroke-width="1.5" opacity="0.85"/>' if grouped else ''
    s += f'<rect x="{cx-20}" y="{cy-20}" width="40" height="40" rx="5" fill="{PANEL}" stroke="{FRAME}" stroke-width="2.1"/><rect x="{cx-7}" y="{cy-7}" width="14" height="14" fill="none" stroke="{FRAME}" stroke-width="2"/>'
    if selected:
        for sx in (-1, 1):
            for sy in (-1, 1):
                x0, y0 = cx + sx * 23, cy + sy * 23
                s += f'<path d="M{x0} {y0-sy*10} L{x0} {y0} L{x0-sx*10} {y0}" fill="none" stroke="{LINK}" stroke-width="2"/>'
    return s
def waypoint(cx, cy, role):
    s = f'<circle cx="{cx}" cy="{cy}" r="20" fill="none" stroke="{LINK}" stroke-width="2" opacity="0.7"/>'
    if role == 'endpoint': s += f'<circle cx="{cx}" cy="{cy}" r="14" fill="{PANEL}" stroke="{LINK}" stroke-width="5"/>'
    if role == 'junction': s += f'<circle cx="{cx}" cy="{cy}" r="7" fill="{PANEL}" stroke="{LINK}" stroke-width="3"/>'
    return s + f'<circle cx="{cx}" cy="{cy}" r="2" fill="{LINK}"/>'
sq = lambda a: 20 / max(abs(math.cos(a)), abs(math.sin(a)))
CASES = [
  ('data link', lambda c: square(*c), sq, [(math.pi, True, 120, DATA)], (115, 70), 1.0),
  ('control link', lambda c: square(*c), sq, [(math.pi, True, 120, CTRL)], (115, 70), 1.0),
  ('data and control,\none device', lambda c: square(*c), sq, [(math.pi, True, 110, DATA), (math.pi / 2, True, 60, CTRL)], (115, 85), 1.0),
  ('selected and grouped', lambda c: square(*c, True, True), sq, [(math.pi, True, 120, DATA)], (115, 70), 1.0),
  ('junction: data in,\ncontrol in, data out', lambda c: waypoint(*c, 'junction'), lambda a: 20,
     [(math.radians(150), True, 95, DATA), (math.radians(210), True, 95, CTRL), (0.0, False, 80, DATA)], (85, 70), 1.0),
  ('endpoint waypoint', lambda c: waypoint(*c, 'endpoint'), lambda a: 20, [(math.pi, True, 120, DATA)], (115, 70), 1.0),
  ('diagonal', lambda c: square(*c), sq, [(math.pi - math.atan2(1, 2), True, 130, DATA)], (125, 90), 1.0),
  ('half zoom: data and\ncontrol, one device', lambda c: square(*c), sq, [(math.pi, True, 110, DATA), (math.pi / 2, True, 60, CTRL)], (90, 75), 0.5),
]
def cell(case, kind, ox, oy):
    label, draw, outline, links, (dx, dy), scale = case
    cx, cy = ox + dx, oy + dy; lines, heads = [], []
    for ang, arrives, far, w in links:
        u = (math.cos(ang), -math.sin(ang)); fx, fy = cx + far * u[0], cy + far * u[1]
        dash = f' stroke-dasharray="{w*2:.1f} {w*1.5:.1f}"' if w == CTRL else ''
        lines.append(f'<line x1="{fx:.1f}" y1="{fy:.1f}" x2="{cx}" y2="{cy}" stroke="{LINK}" stroke-width="{w}"{dash}/>')
        if arrives:
            d = outline(ang); heads.append(shape(kind, (cx + d * u[0], cy + d * u[1]), math.atan2(-u[1], -u[0]), w))
    body = ''.join(lines) + draw((cx, cy)) + ''.join(heads)
    return f'<g transform="translate({cx} {cy}) scale({scale}) translate({-cx} {-cy})">{body}</g>' if scale != 1.0 else body
W = LW + CW * len(SHAPES) + 20; H = TOP + CH * len(CASES) + 30
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="monospace"><rect width="{W}" height="{H}" fill="{PAGE}"/>',
       f'<text x="20" y="32" fill="{INK}" font-size="20">Arrowhead shape -- mockups for H24.6 (B356)</text>',
       f'<text x="20" y="56" fill="{DIM}" font-size="12">Placement (H24.6-1): lines run to the centre, the tip on the outline. Size (H24.6-2): 4 line widths, never under 18 px -- 24 on data, 18 on control.</text>',
       f'<text x="20" y="74" fill="{DIM}" font-size="12">Hollow heads outlined at 2 px (a device frame\'s weight) or 4 px; the outline\'s outer edge, not its centre, touches the anchor\'s outline.</text>']
for j, (k, sub) in enumerate(SHAPES):
    x = LW + j * CW
    out.append(f'<rect x="{x+4}" y="{TOP-52}" width="{CW-8}" height="44" rx="6" fill="#161616"/><text x="{x+12}" y="{TOP-34}" fill="{INK}" font-size="13">{k}</text><text x="{x+12}" y="{TOP-16}" fill="{FRAME}" font-size="11">{sub}</text>')
for r, case in enumerate(CASES):
    oy = TOP + r * CH
    out.append(f'<line x1="20" y1="{oy}" x2="{W-20}" y2="{oy}" stroke="#1c1c1c"/>')
    for k, part in enumerate(case[0].split('\n')):
        out.append(f'<text x="20" y="{oy+64+k*16}" fill="{INK}" font-size="12">{part}</text>')
    for j, (kind, _) in enumerate(SHAPES):
        ox = LW + j * CW
        out.append(f'<g clip-path="url(#s{r}_{j})"><clipPath id="s{r}_{j}"><rect x="{ox}" y="{oy}" width="{CW}" height="{CH}"/></clipPath>{cell(case, kind, ox, oy)}</g>')
for j in range(1, len(SHAPES)):
    out.append(f'<line x1="{LW + j*CW}" y1="{TOP-4}" x2="{LW + j*CW}" y2="{H-30}" stroke="#1c1c1c"/>')
out.append('</svg>')
open('/home/apnex/taceng/arrows-shape-mockups.html', 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><title>arrowhead shape mockups</title></head><body style="margin:0;background:{PAGE}">' + '\n'.join(out) + '</body></html>')
print(W, H)
