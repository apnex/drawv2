import math
LINK, FRAME, PANEL, PAGE, GROUP, INK, DIM = '#4fc3f7', '#aed581', '#101010', '#060606', '#b388ff', '#e0e0e0', '#9e9e9e'
CW, CH, LW, TOP = 165, 140, 210, 150
DATA, CTRL = 6, 3.6
SIZES = [  # (title, sub, size(w) -> head length)
  ('A: today', '5 line widths', lambda w: 5 * w),
  ('B', '4 line widths', lambda w: 4 * w),
  ('C', '3 line widths', lambda w: 3 * w),
  ('D: one size', '24 px, every link', lambda w: 24),
  ('E: one size', '18 px, every link', lambda w: 18),
  ('F', '4 widths, at least 18', lambda w: max(4 * w, 18)),
]
def head(tip, ang, L):
    h = L / 2; tx, ty = tip; bx, by = tx - L * math.cos(ang), ty - L * math.sin(ang); px, py = -math.sin(ang), math.cos(ang)
    return f'<path d="M{tx:.1f} {ty:.1f} L{bx+px*h:.1f} {by+py*h:.1f} L{bx-px*h:.1f} {by-py*h:.1f} z" fill="{LINK}"/>'
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
# each link: (angle from centre to the far end, arrives here?, far length, line width)
CASES = [
  ('data link', lambda c: square(*c), sq, [(math.pi, True, 120, DATA)], (115, 70)),
  ('control link', lambda c: square(*c), sq, [(math.pi, True, 120, CTRL)], (115, 70)),
  ('data and control,\none device', lambda c: square(*c), sq, [(math.pi, True, 110, DATA), (math.pi / 2, True, 60, CTRL)], (115, 85)),
  ('selected and grouped', lambda c: square(*c, True, True), sq, [(math.pi, True, 120, DATA)], (115, 70)),
  ('junction: data in,\ncontrol in, data out', lambda c: waypoint(*c, 'junction'), lambda a: 20,
     [(math.radians(150), True, 95, DATA), (math.radians(210), True, 95, CTRL), (0.0, False, 80, DATA)], (85, 70)),
  ('endpoint waypoint', lambda c: waypoint(*c, 'endpoint'), lambda a: 20, [(math.pi, True, 120, DATA)], (115, 70)),
  ('two links meet:\ndata and control', lambda c: waypoint(*c, 'junction'), lambda a: 20, [(math.pi, True, 80, DATA), (0.0, True, 80, CTRL)], (82, 70)),
  ('diagonal', lambda c: square(*c), sq, [(math.pi - math.atan2(1, 2), True, 130, DATA)], (125, 90)),
]
def cell(case, size, ox, oy, scale=1.0):
    label, draw, outline, links, (dx, dy) = case
    cx, cy = ox + dx, oy + dy
    lines, heads = [], []
    for ang, arrives, far, w in links:
        u = (math.cos(ang), -math.sin(ang)); fx, fy = cx + far * u[0], cy + far * u[1]
        dash = f' stroke-dasharray="{w*2:.1f} {w*1.5:.1f}"' if w == CTRL else ''
        lines.append(f'<line x1="{fx:.1f}" y1="{fy:.1f}" x2="{cx}" y2="{cy}" stroke="{LINK}" stroke-width="{w}"{dash}/>')
        if arrives:
            d = outline(ang)
            heads.append(head((cx + d * u[0], cy + d * u[1]), math.atan2(-u[1], -u[0]), size(w)))
    body = ''.join(lines) + draw((cx, cy)) + ''.join(heads)
    if scale != 1.0:
        body = f'<g transform="translate({cx} {cy}) scale({scale}) translate({-cx} {-cy})">{body}</g>'
    return body
rows = CASES + [('half zoom: data and\ncontrol, one device', CASES[2][1], CASES[2][2], CASES[2][3], (90, 75), 0.5)]
W = LW + CW * len(SIZES) + 20; H = TOP + CH * len(rows) + 30
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="monospace"><rect width="{W}" height="{H}" fill="{PAGE}"/>',
       f'<text x="20" y="32" fill="{INK}" font-size="20">Arrowhead size -- mockups for H24.6, issue 2 (B356)</text>',
       f'<text x="20" y="56" fill="{DIM}" font-size="12">Placement as ruled (H24.6-1): every line runs to the centre; the tip sits on the outline. Data link 6 px wide; control link 3.6 px, dashed.</text>',
       f'<text x="20" y="74" fill="{DIM}" font-size="12">The head keeps today\'s shape -- as wide as it is long. Its shape can be the next question.</text>']
for j, (t, sub, _) in enumerate(SIZES):
    x = LW + j * CW
    out.append(f'<rect x="{x+4}" y="{TOP-52}" width="{CW-8}" height="44" rx="6" fill="#161616"/>')
    out.append(f'<text x="{x+12}" y="{TOP-34}" fill="{INK}" font-size="13">{t}</text><text x="{x+12}" y="{TOP-16}" fill="{FRAME}" font-size="11">{sub}</text>')
for r, row in enumerate(rows):
    oy = TOP + r * CH; label = row[0]; scale = row[5] if len(row) > 5 else 1.0
    out.append(f'<line x1="20" y1="{oy}" x2="{W-20}" y2="{oy}" stroke="#1c1c1c"/>')
    for k, part in enumerate(label.split('\n')):
        out.append(f'<text x="20" y="{oy+64+k*16}" fill="{INK}" font-size="12">{part}</text>')
    for j, (_, _, size) in enumerate(SIZES):
        ox = LW + j * CW
        out.append(f'<g clip-path="url(#k{r}_{j})"><clipPath id="k{r}_{j}"><rect x="{ox}" y="{oy}" width="{CW}" height="{CH}"/></clipPath>{cell(row[:5], size, ox, oy, scale)}</g>')
for j in range(1, len(SIZES)):
    x = LW + j * CW
    out.append(f'<line x1="{x}" y1="{TOP-4}" x2="{x}" y2="{H-30}" stroke="{"#3a3a3a" if j == 3 else "#1c1c1c"}" stroke-width="{2 if j == 3 else 1}"/>')
out.append('</svg>')
open('/home/apnex/taceng/arrows-size-mockups.html', 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><title>arrowhead size mockups</title></head><body style="margin:0;background:{PAGE}">' + '\n'.join(out) + '</body></html>')
print(W, H)
