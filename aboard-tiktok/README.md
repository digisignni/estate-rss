# "STOP SCROLLING." — TikTok edit for the battery-powered digital A-board

A 16-second, 1080x1920, seamlessly looping TikTok built from the 11 supplied product photos.

| File | What it is |
|---|---|
| `out/digital_aboard_stop_scrolling.mp4` | The finished video with its own original beat and sound design |
| `out/digital_aboard_stop_scrolling_sfx_only.mp4` | Same picture, sound effects only — use this one if you add a trending sound in TikTok |
| `out/digital_aboard_stop_scrolling_cover.jpg` | Cover frame (also the first frame of the video) |

## The idea

An A-board's screen is portrait, exactly like a phone. So the video opens with the viewer's phone *being*
the sign — a full-screen STOP sign reading "STOP SCROLLING." — then the camera pulls back to show it is a
pavement sign that just stopped their scroll: "MADE YOU LOOK. IT'S LITERALLY MY JOB."

From there the sign is the character. Everything is said on its own screen, in its own cheeky voice, which
keeps the viewer's eyes on the product for all 16 seconds. The last shot dives back into the screen and lands
on the first frame, so the video loops without a visible join.

| Time | On screen | Selling point |
|---|---|---|
| 0.0 | Full-frame STOP sign: "STOP SCROLLING. / YES, YOU." | Hook |
| 0.9 | Camera pulls back — it is an A-board on a pavement | The reveal |
| 2.0 | "MADE YOU LOOK." → "IT'S LITERALLY MY JOB." | It grabs attention |
| 4.0 | PLUG SOCKET? → "NEVER HEARD OF HER." → spins round: battery light | Battery powered, no cables |
| 6.0 | WHEELS? → rolls into frame → "BORN TO ROLL." | Wheel it out, wheel it in |
| 8.0 | "SUN'S OUT." → "SO AM I." | High-brightness outdoor screen |
| 10.0 | 8AM coffee → 12PM meal deal → 5PM happy hour → "CHANGE ME IN SECONDS. NO CHALK. NO REPRINTS." | Change the message any time |
| 12.5 | Bakery → event → estate agent artwork, three locations | Works for any business |
| 14.0 | "WHAT WOULD YOU PUT ON ME? 👇 COMMENT IT" → STOP sign → dive into the screen | Comments, then the loop |

## Posting it

**Caption (pick one):**

1. POV: a pavement sign just stopped your scroll 👀 Battery powered, on wheels, bright enough for daylight. What would YOU put on it? 👇
2. It has no plug, it has wheels, and it has opinions. Meet the digital A-board. What should it say outside your shop? 👇
3. Chalkboards are shaking. 🔋 Battery-powered digital A-board — change the message in seconds. Tell us what yours would say 👇

**Hashtags (4-6 is plenty):** `#digitalsignage #aboard #pavementsign #smallbusinessuk #shoplocal #cafeowner #estateagent #eventprofs #marketingtips` — plus your town or region.

**Tips**

- The video asks a question, so answer the comments. Best move: reply *with a video* showing the commenter's
  message on the sign. Any wording can be dropped onto the screen with this project (see "Changing things").
- Pin a comment such as "Best answer goes on a real sign 👀".
- Want a trending sound? Upload the `_sfx_only` file, add the sound in TikTok, and keep "original sound" at
  roughly 60-80% so the whooshes and pops still land. Business accounts must pick from the Commercial Music Library.
- Leave the cover on the first frame — the STOP sign is the thumbnail.
- Nothing important sits under TikTok's buttons or caption area, so no extra cropping is needed.

## What was done to the photos

- All photos were 800 px wide, so each was upscaled 4x with Real-ESRGAN before use (`tools/upscale.py`).
- The artwork on every screen was replaced with new animated artwork, pinned to the exact perspective of the
  panel in each photo (`tools/quad.py` finds the panel corners). The original demo artwork carried third-party
  names, so none of it appears in the video.
- Three studio shots were lifted off their white background, keeping the soft floor shadows (`tools/cutout.py`).
- The video makes no numerical claims (battery hours, brightness in nits, IP rating). Add them only with the
  real figures for the model you sell.

## Changing things

Everything is code, so edits are quick:

- **Wording, colours, emoji:** `src/slides.js` (each `SLIDES.name` is one screen of artwork).
- **Timing and order of scenes:** `src/timeline.js` (`build()` lists the scenes; `cues` say which artwork shows when).
- **Music and sound effects:** `tools/audio.py`.

Rebuild:

```bash
pip install numpy scipy opencv-python-headless pillow      # once
./build.sh                                                 # renders frames, mixes audio, writes out/*.mp4
```

Needs Node with Playwright (Chromium) and ffmpeg. A full build takes about two minutes.
Preview single frames without a full build:

```bash
node tools/render.js --out /tmp/preview --no-blur --frames 0,60,150,300
```

Re-doing the photo prep (only needed for new photos) additionally needs `pip install ncnn` and the
`realesrgan-x4plus` ncnn model from the Real-ESRGAN releases page:

```bash
python tools/upscale.py <models_dir> <upscaled_dir> photos/*.jpg
python tools/quad.py refine <upscaled.png> "x,y x,y x,y x,y"       # panel corners -> src/data.js
python tools/cutout.py <upscaled.png> assets/img/cut_name.webp     # studio shots only
python tools/pack_images.py <upscaled_dir> assets/img
```

## Layout

```
photos/        the 11 photos as supplied
assets/img/    upscaled photos and cut-outs used by the edit
assets/fonts/  Anton and Noto Color Emoji (both SIL Open Font License)
src/           the edit: engine.js (maths + animation), slides.js (screen artwork), timeline.js (scenes), data.js
tools/         render.js, blend.py, audio.py and the photo-prep scripts
out/           finished files
```

Third-party pieces: Anton and Noto Color Emoji fonts (SIL OFL 1.1); Real-ESRGAN (BSD 3-Clause) was used for
upscaling. The soundtrack is generated by `tools/audio.py` — no samples, nothing to license.
