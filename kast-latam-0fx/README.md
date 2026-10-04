# KAST — 0% FX fees across LATAM (motion graphic)

A 22-second, 60 fps announcement video, in square (1080×1080) and 16:9 (1920×1080), for the X/Twitter post
"0% FX fees are now live across LATAM". It is built as a deterministic HTML/Canvas
timeline, rendered frame-by-frame in headless Chromium, and has its own
synthesized soundtrack and sound design, cut to the picture.

Outputs (H.264 High, yuv420p BT.709, AAC 256k, loudness -14 LUFS):

- `out/kast-latam-0fx-1080.mp4`: square 1080×1080
- `out/kast-latam-0fx-1920x1080.mp4`: 16:9 1920×1080

Both come from the same timeline. The 16:9 layout (`.wide` rules in `src/index.html`, `LAY` in
`src/main.js`) puts the map beside the headline, the card beside the purchase panel, and the full
card on the end card.

## Storyboard (120 BPM grid)

| Time | Scene | What happens |
|---|---|---|
| 0.0–2.0 | **0%** | A mint scan line opens a slot window, a digit reel spins down and slams onto **0%** (impact, shockwave, particles). Then the "NOW LIVE" chip and a typed "KAST FX FEE · LATAM". |
| 2.0–5.0 | **Across LATAM** | The 0% flies into the headline "0% FX fees / are now live / across LATAM". A dot-matrix map of Latin America (built from Natural Earth data) rises north to south, then a mint activation wave lights the region, with payment arcs and ripples. Punch-through zoom out. |
| 5.0–8.5 | **Card + purchase** | The KAST Card spins in from depth (3D, metal sheen) and taps with contactless pulses. A purchase panel rolls the **KAST FX fee** to **0%** and stamps **WAIVED**, then "Waived automatically at purchase". Whip pan. |
| 8.5–11.5 | **Nothing to do** | "Nothing to **activate.** / **claim.** / **wait for.**", each struck through on the beat, then "Waived **automatically** at purchase." |
| 11.5–15.0 | **What you need to know** | The three bullet points from the post, with drawn check marks. |
| 15.0–17.0 | **Through 2027** | "Available through 31 December" and a **2027** reel, with a progress bar from *Now* to 31.12.2027. |
| 17.0–22.0 | **End card** | Mint wipe to "Pay in local currency. **No KAST FX fee.**", the KAST logo, CTA to kast.xyz, and the legal line *"Eligibility and exclusions apply. Terms apply."* |

## Brand

`src/brand.css` holds the tokens. The palette names follow the KAST media kit
(Black, White, Grey, Grey gradient, Mint). `kast.xyz` was blocked from the render
environment, so the **hex values are close approximations**. Paste the exact
values from <https://www.kast.xyz/en/media-kit> and rebuild.

Logo: the frames use a typeset "KAST" wordmark as a stand-in. Save the official
light-on-dark SVG from the media kit as `assets/kast-logo-light.svg` and the
renderer picks it up automatically, on the card faces and on the end card.
Following the media-kit rules, the logo only sits on black or dark surfaces and
never gets a gradient.

## Build

```bash
npm install                 # fonts + map data
pip install numpy scipy     # soundtrack synthesis
npm run build               # frames -> soundtrack -> out/kast-latam-0fx-1080.mp4
npm run build:wide          # same for 16:9 -> out/kast-latam-0fx-1920x1080.mp4
```

For the motion-blurred masters (4 sub-frames blended into each frame), run
`node scripts/render.mjs --sub 4 --jpeg && npm run audio && SUB=4 EXT=jpg npm run encode`
and add `--format 16x9` / `OUT=out/kast-latam-0fx-1920x1080.mp4` for the wide one.
`--jpeg` writes q95 frames, about 5× smaller on disk than PNG.

- `npm run preview` renders a few stills to `out/stills/`.
- `node scripts/render.mjs --stills 3.2,7.1` renders specific timestamps.
- To scrub live in a browser, run `npx serve .` and open `/src/index.html?play` (or `?t=7.1` for a single frame; add `&format=16x9` for the wide layout).
- `npm run map` regenerates the LATAM dot map (`src/latam-dots.js`).

The whole timeline is in `src/main.js`. Each element is a pure function of `t`,
and the audio cue sheet (`CUES`) is exported from the same file, so retiming a
scene keeps the sound in sync.
