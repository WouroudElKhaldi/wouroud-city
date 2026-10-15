"""
Generates the city's outdoor PBR textures (color + normal maps) procedurally, so every texture is
original work with no license strings attached. Seamless (tileable) noise throughout.

Run:  python3 -I tools/textures/make_textures.py public/textures
Needs numpy + Pillow. Output is 1024 px WebP (512 for small ones), a few hundred KB in total.
"""

import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/textures"
os.makedirs(OUT, exist_ok=True)
N = 1024
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- noise helpers

def lattice(size, period, seed):
    """Tileable value noise: a random grid of `period` cells, smoothly interpolated with wrap."""
    r = np.random.default_rng(seed)
    g = r.random((period, period))
    t = np.arange(size) * period / size
    i0 = np.floor(t).astype(int)
    f = t - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % period
    a = g[np.ix_(i0, i0)]
    b = g[np.ix_(i0, i1)]
    c = g[np.ix_(i1, i0)]
    d = g[np.ix_(i1, i1)]
    fx = f[None, :]
    fy = f[:, None]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(size, base=4, octaves=6, seed=0, gain=0.5):
    out = np.zeros((size, size))
    amp, total = 1.0, 0.0
    p = base
    for o in range(octaves):
        if p > size:
            break
        out += lattice(size, p, seed + o * 31) * amp
        total += amp
        amp *= gain
        p *= 2
    return out / total


def speckle(size, density, seed):
    r = np.random.default_rng(seed)
    return (r.random((size, size)) < density).astype(float)


def blur(a, radius):
    img = Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255))
    # Tile 3x3 so the blur wraps around the edges.
    big = Image.new("L", (img.width * 3, img.height * 3))
    for y in range(3):
        for x in range(3):
            big.paste(img, (x * img.width, y * img.height))
    big = big.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(big.crop((img.width, img.height, img.width * 2, img.height * 2))) / 255.0


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def save_rgb(name, rgb, size=None, q=82):
    img = Image.fromarray(np.uint8(np.clip(rgb, 0, 1) * 255))
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(OUT, name + ".webp"), quality=q, method=6)


def save_rgba(name, rgba, q=85):
    img = Image.fromarray(np.uint8(np.clip(rgba, 0, 1) * 255), "RGBA")
    img.save(os.path.join(OUT, name + ".webp"), quality=q, method=6)


def tint(gray, color):
    return gray[..., None] * np.array(color)[None, None, :]


# ---------------------------------------------------------------- asphalt (covers 4 m)

def asphalt():
    n1 = fbm(N, 8, 7, 1)
    grit = np.random.default_rng(2).random((N, N))
    stones = blur(speckle(N, 0.03, 3), 0.9)
    light_stones = blur(speckle(N, 0.02, 4), 1.0)
    patches = fbm(N, 3, 3, 5)
    base = 0.3 + (n1 - 0.5) * 0.12 + (grit - 0.5) * 0.08 + (patches - 0.5) * 0.08
    base = base - stones * 0.07 + light_stones * 0.18
    # A couple of fine cracks.
    crack = np.zeros((N, N))
    img = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(9)
    for _ in range(5):
        x, y = r.random() * N, r.random() * N
        a = r.random() * math.tau
        pts = [(x, y)]
        for _ in range(40):
            a += (r.random() - 0.5) * 0.9
            x += math.cos(a) * 9
            y += math.sin(a) * 9
            pts.append((x % N, y % N))
        for p0, p1 in zip(pts, pts[1:]):
            if abs(p0[0] - p1[0]) < 50 and abs(p0[1] - p1[1]) < 50:
                d.line([p0, p1], fill=255, width=2)
    crack = np.asarray(img) / 255.0
    base = base * (1 - crack * 0.45)
    rgb = tint(base, (1.0, 0.99, 1.02))
    save_rgb("asphalt_c", rgb)
    h = n1 * 0.4 + grit * 0.5 + stones * 0.6 + light_stones * 0.5 - crack * 1.2
    save_rgb("asphalt_n", normal_from_height(h, 2.2), 512, 70)


# ---------------------------------------------------------------- slabs helper

def slabs(cols, rows, gap_px, running, seed):
    """Returns (id map, edge distance map) for a grid of slabs, optionally running bond."""
    yy, xx = np.mgrid[0:N, 0:N]
    cw, ch = N / cols, N / rows
    row = (yy // ch).astype(int)
    off = np.where(row % 2 == 1, cw / 2, 0) if running else 0
    xs = (xx + off) % N
    col = (xs // cw).astype(int)
    fx = xs - col * cw
    fy = yy - row * ch
    edge = np.minimum(np.minimum(fx, cw - fx), np.minimum(fy, ch - fy))
    ids = row * 97 + col
    return ids, edge


def per_id(ids, seed, lo, hi):
    r = np.random.default_rng(seed)
    table = r.uniform(lo, hi, ids.max() + 1)
    return table[ids]


# ---------------------------------------------------------------- sidewalk pavers (covers 2.4 m, 4x4 slabs)

def pavers():
    ids, edge = slabs(4, 4, 6, False, 11)
    shade = per_id(ids, 12, -0.05, 0.05)
    n1 = fbm(N, 16, 6, 13)
    grit = np.random.default_rng(14).random((N, N))
    pits = blur(speckle(N, 0.004, 15), 0.7)
    stain = fbm(N, 4, 4, 16)
    joint = np.clip(1 - (edge - 3) / 4, 0, 1)
    bevel = np.clip(1 - (edge - 3) / 10, 0, 1)
    base = 0.68 + shade + (n1 - 0.5) * 0.1 + (grit - 0.5) * 0.06 - pits * 0.12 - (stain - 0.5) * 0.08
    base = base * (1 - joint * 0.55) * (1 - bevel * 0.08)
    rgb = tint(base, (1.0, 0.97, 0.92))
    save_rgb("pavers_c", rgb)
    h = n1 * 0.3 + grit * 0.25 - pits * 0.6 - joint * 1.4 - bevel * 0.4
    save_rgb("pavers_n", normal_from_height(h, 2.5), 512, 70)


# ---------------------------------------------------------------- plaza stone (travertine, covers 4.8 m)

def plaza_stone():
    ids, edge = slabs(4, 8, 4, True, 21)
    shade = per_id(ids, 22, -0.06, 0.05)
    hue = per_id(ids, 23, -0.03, 0.03)
    yy, xx = np.mgrid[0:N, 0:N]
    # Travertine banding: stretched noise along x.
    band = lattice(N, 64, 24)[:, :]
    band = np.roll(fbm(N, 3, 3, 25), 0, 1)
    veins = np.abs(np.sin((yy / N * 40 + fbm(N, 4, 5, 26) * 12) * math.pi))
    veins = 1 - np.clip(veins * 6, 0, 1)
    holes = blur(speckle(N, 0.0025, 27), 1.2)
    n1 = fbm(N, 16, 6, 28)
    joint = np.clip(1 - (edge - 2) / 3, 0, 1)
    base = 0.82 + shade + (n1 - 0.5) * 0.08 - veins * 0.05 - holes * 0.25 + (band - 0.5) * 0.06
    base = base * (1 - joint * 0.45)
    r = base * (1.0 + hue)
    g = base * 0.95
    b = base * (0.86 - hue)
    save_rgb("stone_c", np.stack([r, g, b], -1))
    h = n1 * 0.2 - holes * 0.8 - joint * 1.2
    save_rgb("stone_n", normal_from_height(h, 2.0), 512, 70)


# ---------------------------------------------------------------- grass ground (covers 6 m)

def grass_ground():
    n_big = fbm(N, 4, 4, 31)
    n_mid = fbm(N, 16, 5, 32)
    yy, xx = np.mgrid[0:N, 0:N]
    # Thousands of short strokes: blades seen from above.
    img = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(33)
    for _ in range(26000):
        x, y = r.random() * N, r.random() * N
        a = r.random() * math.tau
        ln = 4 + r.random() * 10
        v = int(120 + r.random() * 135)
        d.line([(x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln)], fill=v, width=1)
    blades = np.asarray(img) / 255.0
    # Wrap the strokes that fell off the edge back in by tiling with a blur-free roll average.
    blades = np.maximum(blades, np.roll(np.roll(blades, N // 2, 0), N // 2, 1) * 0.0)
    soil = np.clip((n_big - 0.62) * 4, 0, 1) * (1 - blades)
    g = 0.38 + (n_mid - 0.5) * 0.25 + blades * 0.3
    rgb = np.stack([g * 0.42 + n_big * 0.1, g * 0.68, g * 0.24], -1)
    dirt = np.stack([0.36 + n_mid * 0.1, 0.29 + n_mid * 0.08, 0.2 + n_mid * 0.05], -1)
    rgb = rgb * (1 - soil[..., None] * 0.7) + dirt * soil[..., None] * 0.7
    save_rgb("grass_c", rgb)
    save_rgb("grass_n", normal_from_height(blades * 0.8 + n_mid * 0.3, 2.0), 512, 70)


# ---------------------------------------------------------------- granite (curbs, plinths; covers 1 m)

def granite():
    s = 512
    n1 = fbm(s, 32, 5, 41)
    r = np.random.default_rng(42)
    grain = r.random((s, s))
    dark = blur((r.random((s, s)) < 0.08).astype(float), 0.6)
    light = blur((r.random((s, s)) < 0.05).astype(float), 0.5)
    base = 0.6 + (n1 - 0.5) * 0.1 + (grain - 0.5) * 0.12 - dark * 0.35 + light * 0.2
    rgb = tint(base, (0.98, 0.97, 0.96))
    save_rgb("granite_c", rgb, None)
    save_rgb("granite_n", normal_from_height(grain * 0.3 + dark * 0.3, 1.5), 256)


# ---------------------------------------------------------------- wood (bench slats; grain along x)

def wood():
    s = 512
    yy, xx = np.mgrid[0:s, 0:s]
    warp = fbm(s, 4, 5, 51) * 30
    rings = np.sin((yy / s * 10 + warp / 14) * math.pi * 2) * 0.5 + 0.5
    fibers = lattice(s, 256, 52)
    fibers = np.repeat(fibers[:, :1], s, 1) * 0.5 + fbm(s, 64, 3, 53) * 0.5
    base = 0.55 + rings * 0.12 + (fibers - 0.5) * 0.18
    rgb = np.stack([base * 0.78, base * 0.5, base * 0.3], -1)
    save_rgb("wood_c", rgb)
    save_rgb("wood_n", normal_from_height(rings * 0.4 + fibers * 0.6, 1.5), 256)


# ---------------------------------------------------------------- leaf atlas (alpha cards)

def leaf_shape(d, cx, cy, length, width, angle, fill):
    pts = []
    for k in range(25):
        t = k / 24
        w = math.sin(t * math.pi) ** 0.8 * width * (1 - 0.3 * t)
        pts.append((t * length, w))
    pts += [(t, -w) for t, w in reversed(pts)]
    ca, sa = math.cos(angle), math.sin(angle)
    d.polygon([(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts], fill=fill)


def leaves():
    """A 2x2 atlas of leafy twigs. Leaves are near-white so instance colors tint them."""
    s = N
    color = Image.new("RGB", (s, s), (0, 0, 0))
    alpha = Image.new("L", (s, s), 0)
    dc = ImageDraw.Draw(color)
    da = ImageDraw.Draw(alpha)
    r = np.random.default_rng(61)
    half = s // 2
    for cell in range(4):
        ox, oy = (cell % 2) * half, (cell // 2) * half
        cx, cy = ox + half / 2, oy + half / 2
        for _ in range(70 + cell * 6):
            a = r.random() * math.tau
            dist = r.random() ** 0.6 * half * 0.34
            x = cx + math.cos(a) * dist
            y = cy + math.sin(a) * dist
            ln = half * (0.11 + r.random() * 0.06)
            ang = a + (r.random() - 0.5) * 1.2
            v = int(150 + r.random() * 105)
            g = int(v * (0.92 + r.random() * 0.08))
            fill = (v, g, int(v * 0.86))
            leaf_shape(dc, x, y, ln, ln * 0.33, ang, fill)
            leaf_shape(da, x, y, ln, ln * 0.33, ang, 255)
            # Midrib.
            ex, ey = x + math.cos(ang) * ln * 0.9, y + math.sin(ang) * ln * 0.9
            dc.line([(x, y), (ex, ey)], fill=(int(v * 0.7), int(g * 0.7), int(v * 0.55)), width=2)
    rgb = np.asarray(color) / 255.0
    # Darken toward the inside of each cluster (self-shadowing) and add speckle.
    yy, xx = np.mgrid[0:s, 0:s]
    cxm = (xx % half) - half / 2
    cym = (yy % half) - half / 2
    inner = np.clip(1 - np.hypot(cxm, cym) / (half * 0.42), 0, 1)
    rgb = rgb * (1 - inner[..., None] * 0.35) * (0.9 + fbm(s, 32, 3, 62)[..., None] * 0.2)
    a = np.asarray(alpha) / 255.0
    save_rgba("leaves", np.dstack([rgb, a]))


def needles():
    """A pine twig: a stem with thin needles on both sides."""
    s = 512
    color = Image.new("RGB", (s, s), (0, 0, 0))
    alpha = Image.new("L", (s, s), 0)
    dc, da = ImageDraw.Draw(color), ImageDraw.Draw(alpha)
    r = np.random.default_rng(71)
    for stem in range(3):
        x0 = s * (0.2 + stem * 0.3)
        for k in range(70):
            t = k / 70
            y = s * (0.95 - t * 0.9)
            ln = s * (0.08 + 0.1 * math.sin(t * math.pi))
            for side in (-1, 1):
                a = -math.pi / 2 + side * (0.9 + r.random() * 0.3)
                v = int(170 + r.random() * 80)
                seg = [(x0, y), (x0 + math.cos(a) * ln, y + math.sin(a) * ln)]
                dc.line(seg, fill=(v, v, int(v * 0.85)), width=3)
                da.line(seg, fill=255, width=3)
        dc.line([(x0, s * 0.97), (x0, s * 0.04)], fill=(110, 90, 70), width=5)
        da.line([(x0, s * 0.97), (x0, s * 0.04)], fill=255, width=5)
    rgb = np.asarray(color) / 255.0
    save_rgba("needles", np.dstack([rgb, np.asarray(alpha) / 255.0]))


def frond():
    """A palm frond seen from above: a rachis with long leaflets."""
    s = 512
    color = Image.new("RGB", (s, s), (0, 0, 0))
    alpha = Image.new("L", (s, s), 0)
    dc, da = ImageDraw.Draw(color), ImageDraw.Draw(alpha)
    r = np.random.default_rng(81)
    cx = s / 2
    for k in range(34):
        t = k / 34
        y = s * (0.98 - t * 0.95)
        ln = s * 0.46 * math.sin(min(1, t * 1.15) * math.pi) ** 0.6
        for side in (-1, 1):
            ang = -0.95 if side > 0 else math.pi + 0.95
            v = int(170 + r.random() * 70)
            leaf_shape(dc, cx, y, ln, ln * 0.045, ang, (v, v, int(v * 0.85)))
            leaf_shape(da, cx, y, ln, ln * 0.045, ang, 255)
    dc.line([(cx, s), (cx, s * 0.02)], fill=(150, 140, 100), width=6)
    da.line([(cx, s), (cx, s * 0.02)], fill=255, width=6)
    rgb = np.asarray(color) / 255.0
    save_rgba("frond", np.dstack([rgb, np.asarray(alpha) / 255.0]))


def petals():
    """Flower heads (4 in a 2x2 atlas): daisy, tulip cup, rose-like, cluster. White, tinted per instance."""
    s = 512
    color = Image.new("RGB", (s, s), (0, 0, 0))
    alpha = Image.new("L", (s, s), 0)
    dc, da = ImageDraw.Draw(color), ImageDraw.Draw(alpha)
    half = s // 2
    r = np.random.default_rng(91)
    for cell in range(4):
        ox, oy = (cell % 2) * half, (cell // 2) * half
        cx, cy = ox + half / 2, oy + half / 2
        petals_n = [12, 6, 18, 9][cell]
        for k in range(petals_n):
            a = k / petals_n * math.tau + r.random() * 0.2
            ln = half * (0.42 if cell != 2 else 0.3 + 0.12 * (k % 2))
            v = int(225 + r.random() * 30)
            leaf_shape(dc, cx, cy, ln, ln * (0.22 if cell == 0 else 0.42), a, (v, v, v))
            leaf_shape(da, cx, cy, ln, ln * (0.22 if cell == 0 else 0.42), a, 255)
        rc = half * 0.09
        dc.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=(250, 200, 60))
        da.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=255)
    rgb = np.asarray(color) / 255.0
    yy, xx = np.mgrid[0:s, 0:s]
    d = np.hypot((xx % half) - half / 2, (yy % half) - half / 2) / (half / 2)
    rgb = rgb * (0.75 + 0.25 * np.clip(d * 1.6, 0, 1))[..., None]
    save_rgba("petals", np.dstack([rgb, np.asarray(alpha) / 255.0]))


asphalt()
pavers()
plaza_stone()
grass_ground()
granite()
wood()
leaves()
needles()
frond()
petals()
print("done")
