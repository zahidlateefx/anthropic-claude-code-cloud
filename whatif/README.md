# What If — simulation shorts

Low-poly 3D "What if…" shorts rendered fully in code: Three.js scene in headless Chromium,
deterministic frame capture, procedural sound design, ffmpeg mux. 1080×1920, 60fps.

## Make an episode
```bash
npm i
node engine/render.mjs episodes/01-sun-disappeared --stills 2,30,60   # quick look -> out/<ep>/still_*.jpg
npm run make -- episodes/01-sun-disappeared --gpu                     # audio + 60fps frames + final.mp4
```
Output: `out/<episode>/final.mp4`. Drop `--gpu` on machines without a graphics card (cloud).
The renderer prints `WebGL renderer: …` at start: with `--gpu` it should name your NVIDIA card.

## Laptop setup (Windows, NVIDIA)
1. Install **Node.js 20+** (nodejs.org), **Python 3.11+** (python.org, tick "Add to PATH"),
   **FFmpeg** (`winget install Gyan.FFmpeg`), and **Git**.
2. In a terminal:
   ```bash
   git clone <this repo> && cd <repo>/whatif
   npm i
   npx playwright install chromium
   pip install numpy scipy soundfile
   npm run make -- episodes/01-sun-disappeared --gpu --workers 2
   ```
3. If the renderer line says SwiftShader instead of NVIDIA: Windows Settings → Display → Graphics →
   add the Chromium from step 2 and set it to "High performance".

## Episode format (keep it)
- Hook title center, 0–4s: "What if …?"
- HUD top-left: spaced caps label, big serif counter that never stops moving, small sub-line.
- One continuous POV shot, foreground railing; 5–8 escalation beats.
- Italic captions every ~5s, 3–7 words, present tense.
- Black, then end card: title + one true fact in small caps.
- No voiceover; sound follows the story and cuts to silence on the end card. 60–95s.

## Layout
- `engine/overlay.js` – shared text layer (fonts in `engine/fonts`, served locally)
- `engine/render.mjs` – frame renderer; `engine/mux.sh` – final mix
- `episodes/<nn-name>/` – `scene.js` (timeline + scene), `audio.py`, `post.md`
