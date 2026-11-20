"""Lift a product off its white studio background (keeps the soft floor shadow as translucency).

usage: cutout.py <upscaled.png> <out.webp> [x0,y0,x1,y1] [floor_y]

floor_y (image px): below this line only near-black counts as product, so the dark contact shadow
on the floor stays a shadow instead of being baked in as a solid grey patch.

The product body is forced opaque; only the backdrop and the anti-aliased silhouette go through
"white to alpha", so light details inside the product (wheel hubs, artwork) never turn see-through.
Prints the crop box that was written, for use as the sprite's offset.
"""
import sys
import numpy as np, cv2

src, dst = sys.argv[1], sys.argv[2]
img = cv2.imread(src).astype(np.float32) / 255.0
if len(sys.argv) > 3:
    x0, y0, x1, y1 = [int(v) for v in sys.argv[3].split(",")]
else:
    x0, y0, x1, y1 = 0, 0, img.shape[1], img.shape[0]
img = img[y0:y1, x0:x1]
h, w = img.shape[:2]

a = 1.0 - img.min(axis=2)                       # how far each pixel is from pure white
thr = np.full((h, 1), 0.55, np.float32)
if len(sys.argv) > 4:
    thr[max(0, int(sys.argv[4]) - y0):] = 0.82
core = (a > thr).astype(np.uint8)
core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
flood = np.zeros((h + 2, w + 2), np.uint8)      # fill enclosed holes (artwork, hubs)
inv = (1 - core).copy()
cv2.floodFill(inv, flood, (0, 0), 2)
for seed in [(w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    if inv[seed[1], seed[0]] == 1:
        cv2.floodFill(inv, flood, seed, 2)
solid = (inv != 2).astype(np.uint8)
# enclosed patches of floor (between the feet and wheels) are backdrop, not product:
# bare white ones of any real size, and big shaded ones (small grey patches are wheel hubs - keep those)
for limit, min_area in ((0.22, 500), (0.5, 6000)):
    n, lab, stats, _ = cv2.connectedComponentsWithStats(((solid == 1) & (core == 0) & (a < limit)).astype(np.uint8))
    for k in range(1, n):
        if stats[k, cv2.CC_STAT_AREA] > min_area:
            solid[lab == k] = 0
solid = cv2.erode(solid, np.ones((5, 5), np.uint8))

alpha = np.clip((a - 0.025) / (1 - 0.025), 0, 1)
rgb = np.where(alpha[..., None] > 1e-4, (img - (1 - a[..., None])) / np.maximum(a[..., None], 1e-4), 0)
rgb = np.clip(rgb, 0, 1)
m = solid[..., None].astype(np.float32)
rgb = rgb * (1 - m) + img * m
alpha = np.maximum(alpha, solid)

ys, xs = np.where(alpha > 0.02)
pad = 12
bx0, by0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
bx1, by1 = min(w, xs.max() + pad), min(h, ys.max() + pad)
out = np.dstack([rgb, alpha])[by0:by1, bx0:bx1]
cv2.imwrite(dst, (out * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 93])
print(f"{dst}: box {x0 + bx0},{y0 + by0},{x0 + bx1},{y0 + by1}  size {bx1 - bx0}x{by1 - by0}")
