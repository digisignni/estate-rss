"""Average motion-blur sub-frames (<frame>_<k>.png) into one frame each, in linear light.

usage: blend.py <frames_dir>
"""
import sys, os, glob, re
from collections import defaultdict
import numpy as np, cv2

d = sys.argv[1]
groups = defaultdict(list)
for f in glob.glob(os.path.join(d, "*_*.png")):
    groups[re.match(r"(\d+)_\d+\.png", os.path.basename(f)).group(1)].append(f)
lut = (np.arange(256) / 255.0) ** 2.2
for frame, files in sorted(groups.items()):
    acc = None
    for f in files:
        lin = lut[cv2.imread(f)]
        acc = lin if acc is None else acc + lin
    out = np.clip((acc / len(files)) ** (1 / 2.2) * 255.0 + 0.5, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(d, frame + ".png"), out)
    for f in files:
        os.remove(f)
print(f"blended {len(groups)} motion-blurred frames")
