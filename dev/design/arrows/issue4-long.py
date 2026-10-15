"""Generates issue4-long.html: where a long or bent link shows its direction along its length (H24.6, issue 4).

Each panel draws the same scene under one rule for marks along a link, at 60% zoom. Heads and marks are as ruled:
tip on the outline (H24.6-1), 4 line widths never under 18 px (H24.6-2), hollow at 4 px with the line broken beneath
(H24.6-2b), the line's colour (H24.6-3). The broken line is shown by filling a head's inside with the canvas colour, which
looks the same on plain canvas.
"""
import math

dist = lambda a, b: math.hypot(b[0] - a[0], b[1] - a[1])

BLUE, FRAME, CANVAS, PAGE, INK, DIM = '#4fc3f7', '#aed581', '#101010', '#060606', '#e0e0e0', '#9e9e9e'
P, SCALE, SW = 60, 0.6, 4
DATA, CTRL = 6, 3.6
size = lambda w: max(4 * w, 18)
OUT = '/home/apnex/taceng/arrows-long-mockups.html'

# the scene, in cells: (stops, line width, label)
LINKS = [
    ([(0, 0), (12, 0)], DATA, '12 cells'),
    ([(14, 0), (16, 0)], DATA, '2 cells'),
    ([(0, 2), (7, 2), (7, 4), (12, 4)], DATA, 'bent: runs of 7, 2 and 5 cells'),
    ([(0, 6), (12, 6)], CTRL, 'control link, 12 cells'),
    ([(0, 8), (12, 8)], DATA, 'two links side by side, flowing opposite ways'),
    ([(12, 9), (0, 9)], DATA, ''),
]


def hollow(centre_tip, ang, L, colour=BLUE, scale_of_head=1.0):
    """A hollow head whose outline's outer edge touches `centre_tip`, pointing along `ang`."""
    L = L * scale_of_head
    back = (SW / 2) / math.sin(math.atan2(L / 2, L))
    tx, ty = centre_tip[0] - back * math.cos(ang), centre_tip[1] - back * math.sin(ang)
    Li = L - SW; h = Li / 2; c, s = math.cos(ang), math.sin(ang)
    bx, by = tx - Li * c, ty - Li * s; px, py = -s, c
    return f'<path d="M{tx:.1f} {ty:.1f} L{bx+px*h:.1f} {by+py*h:.1f} L{bx-px*h:.1f} {by-py*h:.1f} z" fill="{CANVAS}" stroke="{colour}" stroke-width="{SW}" stroke-linejoin="miter"/>'


def chevron(centre_tip, ang, L, w):
    sw = SW; c, s = math.cos(ang), math.sin(ang); px, py = -s, c
    back = (sw / 2) / math.sin(math.atan2(L * 0.42, L * 0.8))
    tx, ty = centre_tip[0] - back * c, centre_tip[1] - back * s
    bx, by = tx - L * 0.8 * c, ty - L * 0.8 * s; h = L * 0.42
    return f'<path d="M{bx+px*h:.1f} {by+py*h:.1f} L{tx:.1f} {ty:.1f} L{bx-px*h:.1f} {by-py*h:.1f}" fill="none" stroke="{BLUE}" stroke-width="{sw}" stroke-linejoin="miter"/>'


def device(x, y):
    return (f'<rect x="{x-20}" y="{y-20}" width="40" height="40" rx="5" fill="{CANVAS}" stroke="{FRAME}" stroke-width="2.1"/>'
            f'<rect x="{x-7}" y="{y-7}" width="14" height="14" fill="none" stroke="{FRAME}" stroke-width="2"/>')


def bend(x, y):
    return f'<circle cx="{x}" cy="{y}" r="20" fill="none" stroke="{BLUE}" stroke-width="2" opacity="0.7"/><circle cx="{x}" cy="{y}" r="2" fill="{BLUE}"/>'


def geometry(stops):
    pts = [(x * P, y * P) for x, y in stops]
    segs = []
    acc = 0.0
    for a, b in zip(pts, pts[1:]):
        L = dist(a, b); segs.append((a, b, acc, acc + L)); acc += L
    return pts, segs, acc


def at(segs, t):
    for a, b, s0, s1 in segs:
        if s0 <= t <= s1:
            f = (t - s0) / (s1 - s0)
            return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), math.atan2(b[1] - a[1], b[0] - a[0])
    a, b, s0, s1 = segs[-1]
    return b, math.atan2(b[1] - a[1], b[0] - a[0])


def usable(segs, i, L):
    """The stretch of run i a mark may sit in: clear of a device or bend (20) and, on the last run, of the end head."""
    a, b, s0, s1 = segs[i]
    lo = s0 + 20 + 6
    hi = s1 - 20 - 6 - (L + 10 if i == len(segs) - 1 else 0)
    return lo, hi


def fits(segs, i, c, L):
    lo, hi = usable(segs, i, L)
    return c - L / 2 >= lo and c + L / 2 <= hi


def seg_of(segs, t):
    for i, (_, _, s0, s1) in enumerate(segs):
        if s0 <= t <= s1: return i
    return len(segs) - 1


def marks_for(rule, segs, total, L):
    out = []
    if rule == 'none':
        return out
    if rule == 'mid-link':
        c = total / 2; i = seg_of(segs, c); lo, hi = usable(segs, i, L)
        c = min(max(c, lo + L / 2), hi - L / 2)
        if hi - lo >= L: out.append(c)
    elif rule == 'mid-run':
        for i in range(len(segs)):
            lo, hi = usable(segs, i, L)
            if hi - lo >= L: out.append((lo + hi) / 2)
    elif rule == 'every-4':
        k = 1
        while 240 * k < total:
            c = 240 * k; i = seg_of(segs, c)
            if fits(segs, i, c, L): out.append(c)
            k += 1
    elif rule == 'long-runs':
        for i, (_, _, s0, s1) in enumerate(segs):
            if s1 - s0 >= 5 * P:
                lo, hi = usable(segs, i, L)
                out.append((lo + hi) / 2)
    return out


def path_d(pts):
    """The link's path, its corners rounded at the locked bend radius (20)."""
    d = f'M{pts[0][0]} {pts[0][1]}'
    for k in range(1, len(pts) - 1):
        p0, p1, p2 = pts[k - 1], pts[k], pts[k + 1]
        u1 = ((p1[0] - p0[0]) / dist(p0, p1), (p1[1] - p0[1]) / dist(p0, p1))
        u2 = ((p2[0] - p1[0]) / dist(p1, p2), (p2[1] - p1[1]) / dist(p1, p2))
        d += f' L{p1[0] - 20 * u1[0]:.1f} {p1[1] - 20 * u1[1]:.1f} Q{p1[0]} {p1[1]} {p1[0] + 20 * u2[0]:.1f} {p1[1] + 20 * u2[1]:.1f}'
    return d + f' L{pts[-1][0]} {pts[-1][1]}'


def scene(rule, mark='hollow', labels=False):
    lines, overlay = [], []
    for stops, w, label in LINKS:
        pts, segs, total = geometry(stops)
        L = size(w)
        dash = f' stroke-dasharray="{w*2:.1f} {w*1.5:.1f}"' if w == CTRL else ''
        lines.append(f'<path d="{path_d(pts)}" fill="none" stroke="{BLUE}" stroke-width="{w}"{dash}/>')
        for p in pts[1:-1]: overlay.append(bend(*p))
        for p in (pts[0], pts[-1]): overlay.append(device(*p))
        # the end head, tip on the destination's outline
        a, b, s0, s1 = segs[-1]
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        overlay.append(hollow((b[0] - 20 * math.cos(ang), b[1] - 20 * math.sin(ang)), ang, L))
        for c in marks_for(rule, segs, total, L):
            pos, ang = at(segs, c)
            tip = (pos[0] + L / 2 * math.cos(ang), pos[1] + L / 2 * math.sin(ang))
            overlay.append(chevron(tip, ang, L, w) if mark == 'chevron' else hollow(tip, ang, L, scale_of_head=0.75 if mark == 'small' else 1.0))
        if labels and label:
            overlay.append(f'<text x="{pts[0][0] - 20}" y="{pts[0][1] - 30}" fill="{DIM}" font-size="20">{label}</text>')
    return ''.join(lines) + ''.join(overlay)


PANELS = [
    ('A: today', 'a head at the end only', 'none'),
    ('B: the middle of the link', 'one mark, wherever its middle falls', 'mid-link'),
    ('C: the middle of every run', 'one mark per straight run, however short', 'mid-run'),
    ('D: every 4 cells', 'repeating marks, where a run has room', 'every-4'),
    ('E: the middle of long runs', 'one mark per run of 5 cells or more', 'long-runs'),
]
PW, PH = 680, 480       # a panel, in page pixels
SX, SY = 30, 70         # where the scene's (0, 0) cell sits in a panel, before scaling


def panel(ox, oy, title, sub, rule, labels=False):
    g = [f'<rect x="{ox}" y="{oy}" width="{PW-16}" height="{PH-16}" rx="8" fill="{CANVAS}"/>',
         f'<text x="{ox+16}" y="{oy+26}" fill="{INK}" font-size="14">{title}</text>',
         f'<text x="{ox+16}" y="{oy+44}" fill="{FRAME}" font-size="11">{sub}</text>',
         f'<g transform="translate({ox + SX + 20} {oy + SY + 30}) scale({SCALE})" font-family="monospace">{scene(rule, labels=labels)}</g>']
    return ''.join(g)


def style_panel(ox, oy):
    g = [f'<rect x="{ox}" y="{oy}" width="{PW-16}" height="{PH-16}" rx="8" fill="{CANVAS}"/>',
         f'<text x="{ox+16}" y="{oy+26}" fill="{INK}" font-size="14">What a mark along the line looks like</text>',
         f'<text x="{ox+16}" y="{oy+44}" fill="{FRAME}" font-size="11">an 8-cell link, its mark at the middle</text>']
    rows = [('hollow, the end head\'s size', 'hollow'), ('hollow, three-quarters size', 'small'), ('open chevron, the line through it', 'chevron')]
    for k, (label, mark) in enumerate(rows):
        y0 = oy + 90 + k * 110
        g.append(f'<text x="{ox+16}" y="{y0}" fill="{DIM}" font-size="12">{label}</text>')
        stops, w = [(0, 0), (8, 0)], DATA
        pts, segs, total = geometry(stops); L = size(w)
        body = [f'<path d="{path_d(pts)}" fill="none" stroke="{BLUE}" stroke-width="{w}"/>', device(*pts[0]), device(*pts[1])]
        body.append(hollow((pts[1][0] - 20, 0), 0.0, L))
        c = total / 2; tip = (c + L / 2, 0)
        body.append(chevron(tip, 0.0, L, w) if mark == 'chevron' else hollow(tip, 0.0, L, scale_of_head=0.75 if mark == 'small' else 1.0))
        g.append(f'<g transform="translate({ox + 60} {y0 + 45}) scale({SCALE})">{"".join(body)}</g>')
    return ''.join(g)


W, H = 2 * PW + 40, 140 + 3 * PH
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="monospace"><rect width="{W}" height="{H}" fill="{PAGE}"/>',
       f'<text x="20" y="34" fill="{INK}" font-size="20">Direction along a long link -- mockups for H24.6, issue 4 (B356)</text>',
       f'<text x="20" y="58" fill="{DIM}" font-size="12">Drawn at 60% zoom, as when taking in a larger diagram. Heads and marks as ruled: tip on the outline, 4 line widths never under 18 px,</text>',
       f'<text x="20" y="76" fill="{DIM}" font-size="12">hollow at 4 px with the line broken beneath, the line\'s colour. A mark keeps clear of devices, bends and the end head.</text>']
for n, (title, sub, rule) in enumerate(PANELS):
    out.append(panel(20 + (n % 2) * PW, 110 + (n // 2) * PH, title, sub, rule, labels=(n == 0)))
out.append(style_panel(20 + PW, 110 + 2 * PH))
out.append('</svg>')
open(OUT, 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><title>direction along long links</title></head><body style="margin:0;background:{PAGE}">' + '\n'.join(out) + '</body></html>')
print(W, H)
