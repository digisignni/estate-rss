"""4x AI upscale of the source photos with Real-ESRGAN (ncnn, CPU, tiled).

usage: upscale.py <models_dir> <out_dir> <photo> [<photo> ...]
"""
import sys, time, os
import numpy as np, cv2, ncnn

SCALE, TILE, PAD = 4, 160, 16

def load(models_dir, name="realesrgan-x4plus"):
    net = ncnn.Net()
    net.opt.use_vulkan_compute = False
    net.opt.num_threads = os.cpu_count() or 4
    net.load_param(os.path.join(models_dir, name + ".param"))
    net.load_model(os.path.join(models_dir, name + ".bin"))
    return net

def upscale(img_bgr, net):
    h, w = img_bgr.shape[:2]
    out = np.zeros((h * SCALE, w * SCALE, 3), np.float32)
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    rgbp = cv2.copyMakeBorder(rgb, PAD, PAD, PAD, PAD, cv2.BORDER_REFLECT_101)
    for y in range(0, h, TILE):
        for x in range(0, w, TILE):
            th, tw = min(TILE, h - y), min(TILE, w - x)
            patch = np.ascontiguousarray(rgbp[y:y + th + 2 * PAD, x:x + tw + 2 * PAD].transpose(2, 0, 1))
            ex = net.create_extractor()
            ex.input("data", ncnn.Mat(patch))
            _, o = ex.extract("output")
            o = np.array(o).transpose(1, 2, 0)
            out[y * SCALE:(y + th) * SCALE, x * SCALE:(x + tw) * SCALE] = \
                o[PAD * SCALE:(PAD + th) * SCALE, PAD * SCALE:(PAD + tw) * SCALE]
    return cv2.cvtColor(np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)

if __name__ == "__main__":
    models_dir, out_dir, photos = sys.argv[1], sys.argv[2], sys.argv[3:]
    net = load(models_dir)
    os.makedirs(out_dir, exist_ok=True)
    for p in photos:
        t = time.time()
        img = cv2.imread(p)
        up = upscale(img, net)
        dst = os.path.join(out_dir, os.path.splitext(os.path.basename(p))[0] + ".png")
        cv2.imwrite(dst, up)
        print(f"{os.path.basename(p)} {img.shape[1]}x{img.shape[0]} -> {up.shape[1]}x{up.shape[0]} in {time.time()-t:.1f}s", flush=True)
