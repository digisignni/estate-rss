# Graph Report - estate-rss  (2026-11-20)

## Corpus Check
- 19 files · ~12,761 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 16 file(s) not represented in the graph (top: .woff2 13, .css 2, (none) 1)

## Summary
- 176 nodes · 353 edges · 17 communities (11 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd1aa270`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- quad.py
- engine.js
- timeline.js
- slides.js
- render.js
- tt
- build
- audio.py
- "STOP SCROLLING." — TikTok edit for the battery-powered digital A-board
- lp
- numpy
- data.js
- build.sh
- blip
- CLAUDE.md
- .claude/CLAUDE.md
- install-tools.sh

## God Nodes (most connected - your core abstractions)
1. `build()` - 25 edges
2. `tt()` - 20 edges
3. `fade()` - 19 edges
4. `lp()` - 9 edges
5. `bp()` - 9 edges
6. `stab()` - 9 edges
7. `bass()` - 8 edges
8. `rumble()` - 8 edges
9. `riser()` - 8 edges
10. `reverb()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `bass()` --calls--> `tt()`  [EXTRACTED]
  aboard-tiktok/tools/audio.py → aboard-tiktok/tools/audio.py  _Bridges community 5 → community 9_
- `blip()` --calls--> `tt()`  [EXTRACTED]
  aboard-tiktok/tools/audio.py → aboard-tiktok/tools/audio.py  _Bridges community 5 → community 13_
- `build()` --calls--> `tt()`  [EXTRACTED]
  aboard-tiktok/tools/audio.py → aboard-tiktok/tools/audio.py  _Bridges community 5 → community 6_
- `hat()` --calls--> `tt()`  [EXTRACTED]
  aboard-tiktok/tools/audio.py → aboard-tiktok/tools/audio.py  _Bridges community 5 → community 7_
- `riser()` --calls--> `tt()`  [EXTRACTED]
  aboard-tiktok/tools/audio.py → aboard-tiktok/tools/audio.py  _Bridges community 5 → community 10_

## Import Cycles
- None detected.

## Communities (17 total, 6 thin omitted)

### Community 0 - "quad.py"
Cohesion: 0.10
Nodes (10): detect(), intersect(), line_through(), order(), overlay(), refine(), rough_quad(), screen_mask() (+2 more)

### Community 1 - "engine.js"
Cohesion: 0.13
Nodes (15): bump(), camLerp(), capHeight(), clamp(), _ctx, E, FRAME, lerp() (+7 more)

### Community 2 - "timeline.js"
Cohesion: 0.19
Nodes (14): batteryScene(), BLUR, build(), drift(), hex2rgb(), overlaySvg(), PhotoScene, ringEl() (+6 more)

### Community 3 - "slides.js"
Cohesion: 0.19
Nodes (9): C, daypart(), emoji(), pill(), poster(), rays(), root(), Sign (+1 more)

### Community 4 - "render.js"
Cohesion: 0.12
Nodes (10): args, { chromium }, fs, http, NO_BLUR, OUT, path, ROOT (+2 more)

### Community 5 - "tt"
Cohesion: 0.33
Nodes (10): boom(), bp(), clap(), fade(), pop(), rumble(), shutter(), snare_roll_hit() (+2 more)

### Community 6 - "build"
Cohesion: 0.25
Nodes (8): build(), send(), ding(), mallet(), midi(), pad(), reverb(), sparkle()

### Community 7 - "audio.py"
Cohesion: 0.33
Nodes (5): hat(), hp(), kick(), master(), write()

### Community 8 - ""STOP SCROLLING." — TikTok edit for the battery-powered digital A-board"
Cohesion: 0.29
Nodes (6): Changing things, Layout, Posting it, "STOP SCROLLING." — TikTok edit for the battery-powered digital A-board, The idea, What was done to the photos

### Community 9 - "lp"
Cohesion: 0.33
Nodes (6): bass(), lp(), saw(), sos(), stab(), thud()

### Community 10 - "numpy"
Cohesion: 0.38
Nodes (4): place(), riser(), sweep_noise(), whoosh()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `build()` connect `build` to `tt`, `audio.py`, `lp`, `numpy`, `blip`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `quad.py` be split into smaller, more focused modules?**
  _Cohesion score 0.09915966386554621 - nodes in this community are weakly interconnected._
- **Why does `refine()` connect `quad.py` to `numpy`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `engine.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12987012987012986 - nodes in this community are weakly interconnected._
- **Why does `reverb()` connect `build` to `lp`, `numpy`, `audio.py`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `render.js` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._