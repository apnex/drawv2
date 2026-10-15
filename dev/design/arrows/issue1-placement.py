import math
LINK, FRAME, PANEL, PAGE, GROUP, TRANSIT, INK, DIM = '#4fc3f7', '#aed581', '#101010', '#060606', '#b388ff', '#ef9a9a', '#e0e0e0', '#9e9e9e'
CW, CH, LW, TOP = 150, 130, 200, 380
COLS = [('i', 0), ('i', 3), ('i', 6), ('ii', 0), ('ii', 3), ('iii', 0), ('iii', 3), ('iii', 6)]
GROUPS = [('i: plain lines run in to the centre;', 'arrowed lines stop at the head', 0, 3),
          ('ii: every line runs in;', 'heads sit on their lines', 3, 2),
          ('iii: every line ends at the outline;', 'arrowed lines stop at the head', 5, 3)]

def head(tip, ang, w):
    L = 5 * w; h = L / 2; tx, ty = tip
    bx, by = tx - L * math.cos(ang), ty - L * math.sin(ang); px, py = -math.sin(ang), math.cos(ang)
    return f'<path d="M{tx:.1f} {ty:.1f} L{bx+px*h:.1f} {by+py*h:.1f} L{bx-px*h:.1f} {by-py*h:.1f} z" fill="{LINK}"/>'

def square(cx, cy, selected=False, grouped=False):
    s = f'<rect x="{cx-26}" y="{cy-26}" width="52" height="52" rx="11" fill="none" stroke="{GROUP}" stroke-width="1.5" opacity="0.85"/>' if grouped else ''
    s += f'<rect x="{cx-20}" y="{cy-20}" width="40" height="40" rx="5" fill="{PANEL}" stroke="{FRAME}" stroke-width="2.1"/>'
    s += f'<rect x="{cx-7}" y="{cy-7}" width="14" height="14" fill="none" stroke="{FRAME}" stroke-width="2"/>'
    if selected:
        for sx in (-1, 1):
            for sy in (-1, 1):
                x0, y0 = cx + sx * 23, cy + sy * 23
                s += f'<path d="M{x0} {y0-sy*10} L{x0} {y0} L{x0-sx*10} {y0}" fill="none" stroke="{LINK}" stroke-width="2"/>'
    return s

def roundd(cx, cy):
    return (f'<circle cx="{cx}" cy="{cy}" r="20" fill="{PANEL}" stroke="{FRAME}" stroke-width="2.1"/>'
            f'<rect x="{cx-7}" y="{cy-7}" width="14" height="14" fill="none" stroke="{FRAME}" stroke-width="2"/>')

def wide(ax, ay):
    return (f'<rect x="{ax-20}" y="{ay-20}" width="160" height="100" rx="5" fill="{PANEL}" stroke="{FRAME}" stroke-width="2.1"/>'
            f'<rect x="{ax-7}" y="{ay-7}" width="14" height="14" fill="none" stroke="{FRAME}" stroke-width="2"/>')

def waypoint(cx, cy, role):
    s = f'<circle cx="{cx}" cy="{cy}" r="20" fill="none" stroke="{LINK}" stroke-width="2" opacity="0.7"/>'
    if role in ('endpoint', 'transit'):
        s += f'<circle cx="{cx}" cy="{cy}" r="14" fill="{PANEL}" stroke="{LINK}" stroke-width="5"/>'
    if role == 'junction':
        s += f'<circle cx="{cx}" cy="{cy}" r="7" fill="{PANEL}" stroke="{LINK}" stroke-width="3"/>'
    if role == 'transit':
        circ = 2 * math.pi * 7; n = round(circ / 6); seg = circ / n
        s += f'<circle cx="{cx}" cy="{cy}" r="7" fill="none" stroke="{TRANSIT}" stroke-width="3" stroke-dasharray="{seg*4/6:.2f} {seg*2/6:.2f}"/>'
    s += f'<circle cx="{cx}" cy="{cy}" r="2" fill="{LINK}"/>'
    return s

def sq_dist(ang):
    return 20 / max(abs(math.cos(ang)), abs(math.sin(ang)))

# a case: the anchor's centre offset in its cell, how to draw it, its outline distance by angle, and its links
# each link: (angle from centre to the far end, arrowed in?, far length, line width, dashed?)
CASES = [
  ('device', 'square', lambda c: square(*c), sq_dist, [(math.pi, True, 110, 6, False)]),
  ('device, selected and grouped', 'square', lambda c: square(*c, True, True), sq_dist, [(math.pi, True, 110, 6, False)]),
  ('round device', 'round', lambda c: roundd(*c), lambda a: 20, [(math.pi, True, 110, 6, False)]),
  ('control link (thinner)', 'square', lambda c: square(*c), sq_dist, [(math.pi, True, 110, 3.6, True)]),
  ('diagonal, selected', 'square', lambda c: square(*c, True), sq_dist, [(math.pi - math.atan2(1, 2), True, 120, 6, False)]),
  ('wide device (3 x 2)', 'wide', lambda c: wide(*c), lambda a: 20, [(math.pi, True, 60, 6, False)]),
  ('endpoint waypoint', 'wp', lambda c: waypoint(*c, 'endpoint'), lambda a: 20, [(math.pi, True, 110, 6, False)]),
  ('junction: 2 in, 1 out', 'wp', lambda c: waypoint(*c, 'junction'), lambda a: 20,
     [(math.radians(150), True, 90, 6, False), (math.radians(210), True, 90, 6, False), (0.0, False, 70, 6, False)]),
  ('two links meet, opposed', 'wp', lambda c: waypoint(*c, 'junction'), lambda a: 20,
     [(math.pi, True, 70, 6, False), (0.0, True, 70, 6, False)]),
  ('waypoint, transit off', 'wp', lambda c: waypoint(*c, 'transit'), lambda a: 20, [(math.pi, True, 110, 6, False)]),
]

def cell(case, mode, clear, ox, oy):
    label, kind, draw, outline, links = case
    cx, cy = (ox + 115, oy + 65) if kind != 'wide' else (ox + 75, oy + 45)
    if label.startswith('junction') or label.startswith('two links'): cx = ox + 80
    if label.startswith('diagonal'): cx, cy = ox + 120, oy + 85
    lines, heads = [], []
    for ang, arrowed, far, w, dashed in links:
        u = (math.cos(ang), -math.sin(ang))   # unit vector from the centre toward the far end
        fx, fy = cx + far * u[0], cy + far * u[1]
        d = outline(ang)
        L = 5 * w
        if arrowed is True:   # flow arrives here
            tip = (cx + (d + clear) * u[0], cy + (d + clear) * u[1])
            heads.append(head(tip, math.atan2(-u[1], -u[0]), w))
            base = (cx + (d + clear + L) * u[0], cy + (d + clear + L) * u[1])
            end = (cx, cy) if mode == 'ii' else base
        else:                 # plain, or flow leaving (its head is at the far end, off-cell)
            end = (cx + d * u[0], cy + d * u[1]) if mode == 'iii' else (cx, cy)
        dash = f' stroke-dasharray="{w*2:.1f} {w*1.5:.1f}"' if dashed else ''
        lines.append(f'<line x1="{fx:.1f}" y1="{fy:.1f}" x2="{end[0]:.1f}" y2="{end[1]:.1f}" stroke="{LINK}" stroke-width="{w}"{dash}/>')
    return ''.join(lines) + draw((cx, cy)) + ''.join(heads)

W = LW + CW * len(COLS) + 20
H = TOP + CH * len(CASES) + 30
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="monospace">',
       f'<rect width="{W}" height="{H}" fill="{PAGE}"/>']
out.append(f'<text x="20" y="32" fill="{INK}" font-size="20">Arrowheads at every kind of anchor -- mockups for H24.6 (B356)</text>')
out.append(f'<text x="20" y="56" fill="{DIM}" font-size="12">Head drawn at today\'s size (5 line widths); size is issue 2. Columns: where lines end, and how far outside the anchor\'s outline the tip stops (0, 3 or 6 px).</text>')
out.append(f'<text x="20" y="74" fill="{DIM}" font-size="12">A link leaving an anchor carries its head at its far end, so it is drawn here as a plain line.</text>')

# reference strip: future ports on a device face, beside a head at 0 and 3 px
ry = 96
out.append(f'<text x="20" y="{ry+18}" fill="{INK}" font-size="14">For comparison: a port on a device face (ATOMICS "Attachment") beside a head at 0 and 3 px</text>')
refs = [('square port on the face', 'sq'), ('round port on the face', 'rd'), ('head, tip at 0 px', 0), ('head, tip at 3 px', 3)]
for i, (lab, k) in enumerate(refs):
    ox = 30 + i * 300; cx, cy = ox + 190, ry + 110
    if k in ('sq', 'rd'):
        out.append(f'<line x1="{ox+30}" y1="{cy}" x2="{cx}" y2="{cy}" stroke="{LINK}" stroke-width="6"/>' + square(cx, cy))
        out.append(f'<rect x="{cx-25}" y="{cy-5}" width="10" height="10" fill="{FRAME}"/>' if k == 'sq' else f'<circle cx="{cx-20}" cy="{cy}" r="5.5" fill="{FRAME}"/>')
    else:
        tip = (cx - 20 - k, cy)
        out.append(f'<line x1="{ox+30}" y1="{cy}" x2="{tip[0]-30:.1f}" y2="{cy}" stroke="{LINK}" stroke-width="6"/>' + square(cx, cy) + head(tip, 0.0, 6))
    out.append(f'<text x="{ox+30}" y="{cy+48}" fill="{DIM}" font-size="12">{lab}</text>')

# column headers
hy = TOP - 50
for title1, title2, start, span in GROUPS:
    x0 = LW + start * CW
    out.append(f'<rect x="{x0+4}" y="{hy-42}" width="{span*CW-8}" height="62" rx="6" fill="#161616"/>')
    out.append(f'<text x="{x0+12}" y="{hy-22}" fill="{INK}" font-size="12">{title1}</text>')
    out.append(f'<text x="{x0+12}" y="{hy-6}" fill="{INK}" font-size="12">{title2}</text>')
for j, (mode, clear) in enumerate(COLS):
    out.append(f'<text x="{LW + j*CW + 55}" y="{TOP-12}" fill="{FRAME}" font-size="13">{clear} px</text>')
# rows
for r, case in enumerate(CASES):
    oy = TOP + r * CH
    out.append(f'<line x1="20" y1="{oy}" x2="{W-20}" y2="{oy}" stroke="#1c1c1c" stroke-width="1"/>')
    out.append(f'<text x="20" y="{oy+70}" fill="{INK}" font-size="12">{case[0]}</text>')
    for j, (mode, clear) in enumerate(COLS):
        ox = LW + j * CW
        out.append(f'<g clip-path="url(#c{r}_{j})"><clipPath id="c{r}_{j}"><rect x="{ox}" y="{oy}" width="{CW}" height="{CH}"/></clipPath>{cell(case, mode, clear, ox, oy)}</g>')
for j in range(1, len(COLS)):
    x = LW + j * CW
    sep = '#3a3a3a' if j in (3, 5) else '#1c1c1c'
    out.append(f'<line x1="{x}" y1="{TOP-30}" x2="{x}" y2="{H-30}" stroke="{sep}" stroke-width="{2 if j in (3, 5) else 1}"/>')
out.append('</svg>')
svg = '\n'.join(out)
open('/home/apnex/taceng/arrows-mockups.html', 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><title>arrowhead mockups</title></head><body style="margin:0;background:{PAGE}">{svg}</body></html>')
print(W, H)
