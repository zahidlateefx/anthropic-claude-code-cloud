# What If — simulation shorts

Low-poly 3D "What if…" shorts rendered fully in code: Three.js scene in headless Chromium,
deterministic frame capture, procedural sound design, ffmpeg mux. 1080×1920, 60fps.

## Make an episode
```bash
npm i
node engine/render.mjs episodes/01-sun-disappeared --stills 2,30,60   # quick look -> out/<ep>/still_*.jpg
python3 episodes/01-sun-disappeared/audio.py                          # -> out/<ep>/audio.wav
node engine/render.mjs episodes/01-sun-disappeared --workers 3        # -> out/<ep>/video.mp4
engine/mux.sh 01-sun-disappeared                                      # -> out/<ep>/final.mp4
```
Needs Chromium at `/opt/pw-browsers/chromium`, ffmpeg, Python with numpy/scipy/soundfile.

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
