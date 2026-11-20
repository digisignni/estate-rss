"""Side-by-side strip of chosen frames.  usage: strip.py <frames_dir> <out.jpg> <scale> f1 f2 ..."""
import sys, os
from PIL import Image
d, out, sc = sys.argv[1], sys.argv[2], float(sys.argv[3])
ims = [Image.open(os.path.join(d, f"{int(f):05d}.png")).convert("RGB") for f in sys.argv[4:]]
w, h = int(ims[0].width * sc), int(ims[0].height * sc)
strip = Image.new("RGB", (w * len(ims) + 8 * (len(ims) - 1), h), (30, 30, 30))
for i, im in enumerate(ims):
    strip.paste(im.resize((w, h), Image.LANCZOS), (i * (w + 8), 0))
strip.save(out, quality=90)
