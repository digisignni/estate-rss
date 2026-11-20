"""Locate the display panel (a perspective quad) in a product photo.

  quad.py detect  <img> <x0,y0,x1,y1>          -> prints TL,TR,BR,BL corners (image px)
  quad.py refine  <img> <x,y x,y x,y x,y> [r]  -> snaps a hand-estimated quad to the real edges (search radius r px)
  quad.py overlay <img> <x,y x,y x,y x,y> <out.jpg>   -> debug image with the quad drawn

The screen is found as the bright blob enclosed by the dark bezel inside the given ROI;
each side is then re-fitted as a straight line so the corners are sub-pixel accurate.
"""
import sys
import numpy as np, cv2


def order(pts):
    pts = np.array(pts, np.float64)
    s, d = pts.sum(1), pts[:, 0] - pts[:, 1]
    return np.array([pts[s.argmin()], pts[d.argmax()], pts[s.argmax()], pts[d.argmin()]])  # TL TR BR BL


def line_through(p, q):
    a, b = q[1] - p[1], p[0] - q[0]
    return a, b, -(a * p[0] + b * p[1])


def intersect(l1, l2):
    a1, b1, c1 = l1
    a2, b2, c2 = l2
    d = a1 * b2 - a2 * b1
    return np.array([(b1 * c2 - b2 * c1) / d, (a2 * c1 - a1 * c2) / d])


def screen_mask(sub):
    """Lit-screen pixels: either very bright (white artwork) or bright and saturated."""
    hsv = cv2.cvtColor(sub, cv2.COLOR_BGR2HSV)
    s, v = hsv[..., 1].astype(np.int32), hsv[..., 2].astype(np.int32)
    mask = ((v > 205) | ((s > 85) & (v > 120))).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    return cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((11, 11), np.uint8))


def rough_quad(img, roi):
    x0, y0, x1, y1 = roi
    mask = screen_mask(img[y0:y1, x0:x1])
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
    cy, cx = (y1 - y0) // 2, (x1 - x0) // 2
    k = lab[cy, cx] or (1 + int(np.argmax(stats[1:, 4])))       # blob under the ROI centre
    blob = (lab == k).astype(np.uint8)
    cnts, _ = cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hull = cv2.convexHull(max(cnts, key=cv2.contourArea))
    peri = cv2.arcLength(hull, True)
    for eps in np.linspace(0.004, 0.12, 80):
        a = cv2.approxPolyDP(hull, eps * peri, True)
        if len(a) == 4:
            return order(a.reshape(4, 2)) + np.array([x0, y0])
    raise SystemExit("could not reduce the blob to 4 corners")


def refine(img, quad, search=16, iters=3):
    """Snap each side of a rough quad to the strongest colour edge next to it."""
    f = cv2.GaussianBlur(img, (0, 0), 1.2).astype(np.float32)
    q = np.array(quad, np.float64)
    offs = np.arange(-search, search + 0.5, 0.5)
    for _ in range(iters):
        lines = []
        for i in range(4):
            a, b = q[i], q[(i + 1) % 4]
            ab = b - a
            nrm = np.array([-ab[1], ab[0]]) / np.linalg.norm(ab)
            pts = []
            for u in np.linspace(0.08, 0.92, 60):
                p = a + u * ab
                xs = (p[0] + offs * nrm[0]).astype(np.float32)[None]
                ys = (p[1] + offs * nrm[1]).astype(np.float32)[None]
                prof = cv2.remap(f, xs, ys, cv2.INTER_LINEAR)[0]
                g = np.abs(prof[4:] - prof[:-4]).sum(1) * np.exp(-0.5 * (offs[2:-2] / (search * 0.7)) ** 2)
                pts.append(p + offs[2:-2][int(g.argmax())] * nrm)
            pts = np.array(pts, np.float32)
            vx, vy, px, py = cv2.fitLine(pts, cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
            lines.append(line_through((px, py), (px + vx, py + vy)))
        q = np.array([intersect(lines[(i - 1) % 4], lines[i]) for i in range(4)])
        search = max(6, search * 0.6)
        offs = np.arange(-search, search + 0.5, 0.5)
    return q


def detect(img, roi):
    return refine(img, rough_quad(img, roi))


def overlay(img, quad, out):
    vis = img.copy()
    q = np.array(quad, np.float64)
    cv2.polylines(vis, [np.round(q).astype(np.int32)], True, (0, 255, 0), 2, cv2.LINE_AA)
    tiles = []
    for (x, y) in q:
        x, y = int(round(x)), int(round(y))
        pad = 60
        crop = cv2.copyMakeBorder(vis, pad, pad, pad, pad, cv2.BORDER_CONSTANT)[y:y + 2 * pad, x:x + 2 * pad]
        tiles.append(cv2.resize(crop, (360, 360), interpolation=cv2.INTER_NEAREST))
    xs, ys = q[:, 0], q[:, 1]
    m = 120
    bx0, by0 = max(0, int(xs.min()) - m), max(0, int(ys.min()) - m)
    bx1, by1 = min(img.shape[1], int(xs.max()) + m), min(img.shape[0], int(ys.max()) + m)
    main = vis[by0:by1, bx0:bx1]
    main = cv2.resize(main, (int(main.shape[1] * 720 / main.shape[0]), 720), interpolation=cv2.INTER_AREA)
    grid = np.vstack([np.hstack(tiles[:2]), np.hstack([tiles[3], tiles[2]])])
    canvas = np.zeros((720, main.shape[1] + 720, 3), np.uint8)
    canvas[:, :main.shape[1]] = main
    canvas[:, main.shape[1]:] = grid
    cv2.imwrite(out, canvas, [cv2.IMWRITE_JPEG_QUALITY, 90])


if __name__ == "__main__":
    cmd, path = sys.argv[1], sys.argv[2]
    img = cv2.imread(path)
    if cmd == "detect":
        c = detect(img, [int(v) for v in sys.argv[3].split(",")])
        print(" ".join(f"{x:.1f},{y:.1f}" for x, y in c))
    elif cmd == "refine":
        c = refine(img, [[float(v) for v in p.split(",")] for p in sys.argv[3].split()],
                   search=float(sys.argv[4]) if len(sys.argv) > 4 else 16)
        print(" ".join(f"{x:.1f},{y:.1f}" for x, y in c))
    else:
        quad = [[float(v) for v in p.split(",")] for p in sys.argv[3].split()]
        overlay(img, quad, sys.argv[4])
