"""Convert the lossless 4x upscales into the web-ready images the renderer loads.

usage: pack_images.py <upscaled_png_dir> <assets_img_dir>
"""
import sys, os, glob
import cv2

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for p in sorted(glob.glob(os.path.join(src, "*.png"))):
    out = os.path.join(dst, os.path.splitext(os.path.basename(p))[0] + ".jpg")
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(p):
        continue
    cv2.imwrite(out, cv2.imread(p), [cv2.IMWRITE_JPEG_QUALITY, 93])
    print(os.path.basename(out), os.path.getsize(out) // 1024, "KB")
