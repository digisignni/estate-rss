"""Contact sheet of rendered frames for review.  usage: sheet.py <frames_dir> <out.jpg> [cols] [thumb_w]"""
import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 270
files = sorted(f for f in glob.glob(os.path.join(d, "*.png")) if "_" not in os.path.basename(f))
th = tw * 16 // 9
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 22)), (20, 20, 20))
dr = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * (th + 22)
    sheet.paste(im, (x, y))
    n = int(os.path.basename(f)[:5])
    dr.text((x + 6, y + th + 4), f"f{n}  {n/30:.2f}s", fill=(255, 255, 255))
sheet.save(out, quality=88)
print(out, sheet.size)
