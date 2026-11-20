'use strict';
/* Source photos (4x Real-ESRGAN upscales) and where the display panel sits in each one.
   quad = TL, TR, BR, BL corners of the lit screen, in image pixels (found with tools/quad.py). */
const IMG = '../assets/img/';
const PHOTOS = {
  street: { src: IMG + '03_street_brick_keepleft.jpg', w: 3200, h: 1800,
    quad: [[1286.9, 275.7], [1812.6, 195.9], [1741.1, 1309.4], [1177.6, 1292.9]] },
  hero: { src: IMG + '06_street_hero_sky_su.jpg', w: 3200, h: 2400,
    quad: [[1152.7, 293.0], [1954.6, 479.7], [2134.3, 1975.9], [1092.5, 1985.4]] },
  kerb: { src: IMG + '09_kerb_icecream.jpg', w: 3200, h: 1800,
    quad: [[1339.3, 216.7], [1891.2, 199.8], [1758.9, 1349.5], [1204.4, 1267.1]] },
  grassA: { src: IMG + '07_grass_coffee.jpg', w: 3200, h: 2400,
    quad: [[1366.6, 267.5], [2110.7, 241.6], [1944.2, 1674.9], [1198.8, 1553.3]] },
  grassB: { src: IMG + '10_grass_su.jpg', w: 3200, h: 1800,
    quad: [[1449.7, 236.5], [1987.4, 226.6], [1744.7, 1379.4], [1206.7, 1271.0]] },
  city: { src: IMG + '08_city_steps.jpg', w: 3200, h: 2400,
    quad: [[1153.7, 1030.4], [1435.2, 1047.9], [1475.8, 1584.7], [1172.4, 1625.0]] },
};

/* Studio shots lifted off their white backdrop (tools/cutout.py). Coordinates are local to the sprite. */
const SPRITES = {
  front: { src: IMG + 'cut_front.webp', w: 960, h: 1141,
    quad: [[382.0, 84.7], [732.1, 40.9], [596.2, 830.2], [232.2, 819.5]], cx: 500 },
  rear: { src: IMG + 'cut_rear.webp', w: 898, h: 1160, led: [458, 199], cx: 450 },
  roller: { src: IMG + 'cut_roller.webp', w: 977, h: 1155,
    quad: [[230.4, 115.1], [508.7, 45.5], [336.6, 862.8], [68.7, 815.5]], wheel: [560, 993], contact: [560, 1058], cx: 350 },
};

/* push every corner of a quad away from its centre by `px` (so new artwork fully covers the old) */
function grow(quad, px) {
  const cx = quad.reduce((a, p) => a + p[0], 0) / 4, cy = quad.reduce((a, p) => a + p[1], 0) / 4;
  return quad.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    return [x + (dx / d) * px, y + (dy / d) * px];
  });
}
