"""
probe/ink.py -- where the text actually PAINTS, per control.

Reads the screenshot `measure.mjs` wrote and finds, for each control, the first and last row
containing ink. Controls whose ink spans agree are on one line; controls that differ are not,
however carefully their boxes are aligned.

The OFF column is the ink midpoint against the control's own centre. Do not chase it to zero: a
13px glyph box centred in a 26px control leaves 6.5px either side and a browser rounds that to a
device pixel, so a lone -0.5 is arithmetic rather than a defect. What matters is whether the
controls AGREE with each other.

  node tools/probe/measure.mjs && python3 tools/probe/ink.py
"""
import json, os, struct, sys, zlib
from collections import Counter

OUT = os.environ.get('PROBE_OUT') or os.path.join('/tmp', 'draw-probe')
png = os.path.join(OUT, 'bar.png')
if not os.path.exists(png):
    sys.exit(f'no screenshot at {png} -- run: node tools/probe/measure.mjs')
boxes = json.load(open(os.path.join(OUT, 'boxes.json')))

d = open(png, 'rb').read()
pos, idat = 8, b''
while pos < len(d):
    ln = struct.unpack('>I', d[pos:pos + 4])[0]
    typ = d[pos + 4:pos + 8]
    body = d[pos + 8:pos + 8 + ln]
    if typ == b'IHDR':
        w, h, bd, ct = struct.unpack('>IIBB', body[:10])
    if typ == b'IDAT':
        idat += body
    pos += 12 + ln

raw = zlib.decompress(idat)
ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
stride = w * ch
rows, prev, i = [], bytearray(stride), 0
for y in range(h):
    f = raw[i]; i += 1
    line = bytearray(raw[i:i + stride]); i += stride
    for x in range(stride):
        a = line[x - ch] if x >= ch else 0
        b = prev[x]
        c = prev[x - ch] if x >= ch else 0
        if f == 1: line[x] = (line[x] + a) & 255
        elif f == 2: line[x] = (line[x] + b) & 255
        elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
        elif f == 4:
            p = a + b - c
            pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            line[x] = (line[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 255
    rows.append(bytes(line)); prev = line


def ink(box):
    x0, y0, wid, hgt = box['x'], box['y'], box['w'], box['h']
    if wid < 20 or hgt < 8:
        return None
    # the control's own background is the modal colour of its INTERIOR, away from rounded corners
    cnt = Counter()
    for y in range(y0 + 3, y0 + hgt - 3):
        for x in range(x0 + 8, x0 + wid - 8):
            o = x * ch
            cnt[rows[y][o:o + 3]] += 1
    if not cnt:
        return None
    bg = cnt.most_common(1)[0][0]
    first = last = None
    for y in range(y0, y0 + hgt):
        for x in range(x0 + 8, x0 + wid - 8):
            o = x * ch
            px = rows[y][o:o + 3]
            if sum(abs(px[k] - bg[k]) for k in range(3)) > 100:
                if first is None:
                    first = y
                last = y
                break
    return None if first is None else (first, last)


print(f'  {"control":12} {"ink rows":>10}  {"mid":>6}  {"centre":>6}  {"off":>6}')
spans = {}
for b in boxes:
    got = ink(b)
    if not got:
        continue
    first, last = got
    mid = (first + last) / 2
    centre = b['y'] + b['h'] / 2
    spans[b['id']] = (first, last)
    print(f'  {b["id"]:12} {f"{first}..{last}":>10}  {mid:>6.1f}  {centre:>6.1f}  {mid - centre:>+6.1f}')

# Compared among controls that share a FONT SIZE. `#help-btn` is the 17px icon and `#banner` is
# right-aligned status text; neither is expected to share a baseline with the 11px labels, and a
# verdict that lumped them in reported DISAGREE on a bar that was correct.
PEERS = [b['id'] for b in boxes if b['id'] in ('agents', 'whoami', 'lockstate')]
tops = {spans[i][0] for i in PEERS if i in spans}
print()
if len(tops) == 1:
    print(f'  AGREE -- {", ".join(PEERS)} all start on row {tops.pop()}')
else:
    print(f'  DISAGREE -- {", ".join(PEERS)} start on rows {sorted(tops)}')
    sys.exit(1)
