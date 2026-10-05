# Animation quality brief — "What if…" 3D simulation shorts

The current render looks cheap: bare boxes, objects that pop in/out, nothing reacts. Rebuild the
visuals to the standard below. Reference accounts (studied all 13 videos with 400K+ views):
@pov.what.if0, @moon2animation, @then.what.animation. Style = stylized low-poly, but DENSE,
DETAILED and ALIVE. Low-poly is not an excuse for low effort.

## 1. Build every asset from parts (no single primitives)
Make small factory functions (`makeBuilding()`, `makeCar()`, …) that assemble 5–20 meshes each,
with seeded random variation (size, colour, details) so no two look the same. Use InstancedMesh /
merged geometry for repeats so you can afford hundreds.
- **Buildings**: base + body + setbacks/stepped tops, roof ledge/parapet, rooftop AC units, water tanks,
  antennas, a few lit and unlit window grids (canvas texture or instanced quads, NOT one flat colour),
  ground-floor shopfronts/awnings, fire escapes on brick blocks, 3–5 colour palettes (brick, concrete,
  glass tower with vertical mullions). Skyline must have depth: 3 layers (near detailed, mid, far silhouettes in fog).
- **Cars**: body + cabin + glass (dark, slightly reflective) + 4 wheels with hubs + headlights/taillights
  (emissive) + bumpers. 6+ colours, sedans/taxis/buses/vans. Wheels rotate with speed. Headlight glow sprites at night.
- **Beach/coast**: sand with subtle height noise and wet/dry colour band at the waterline, foam line that
  moves, umbrellas, towels, lifeguard tower, pier with piles, palm trees, seagulls, boats that bob.
- **Water**: subdivided plane with 3–4 summed sine/Gerstner waves, fresnel-ish colour (deeper = darker),
  specular sun glitter, foam where it meets shore/objects. Never a flat static plane.
- **People**: legs/torso/arms/head as separate parts so they can WALK (swing limbs), turn their heads,
  point, run (faster swing + lean forward). Crowds of 30–100 via instancing with offset animation phase.
- **Nature**: trees with 2–3 foliage clusters, bushes, rocks, grass tufts/flowers scattered with noise,
  clouds as clustered spheres that drift.
- **Foreground framing**: railing / balcony / fence / window frame very close to the camera (every top
  video does this — it sells "you are standing here").

## 2. Lighting & render quality
- `MeshStandardMaterial` with `flatShading`, ACES tone mapping, sRGB output.
- Directional "sun" with soft shadows (PCFSoftShadowMap, tight shadow camera around the action) +
  hemisphere fill. Shadows alone make it look 3× more expensive.
- Fog that matches the sky horizon colour; distance haze for scale.
- Post: bloom on emissive lights/explosions/sun (UnrealBloomPass), SMAA/MSAA, subtle vignette,
  optional film grain. Colour grade shifts with the story (warm → cold, blue → orange).
- Night needs to stay READABLE: moon/sky fill, emissive windows, street lights with glow sprites.

## 3. Animation rules (this is where it failed)
- **Nothing pops.** Every appear/disappear/change is eased (smoothstep / ease-in-out) over ≥0.3 s.
- **Stagger.** Objects change one by one with random offsets, never all on the same frame
  (lights failing building by building, windows flickering 2–3 times before dying, people reacting in a ripple).
- **Destruction / disappearance must be physical**, pick per object:
  - Break apart: pre-split the mesh into 6–20 chunks; on impact give each chunk velocity + spin + gravity,
    spawn dust puff (expanding, fading sprites) and small debris particles.
  - Sink / collapse: building drops with a slight tilt, dust cloud rolls out at the base, top crumbles first.
  - Swept away: objects picked up by water/wind follow the flow, tumble, bump into each other.
  - Burn: emissive orange glow creeping up, smoke column (stacked sprites rising/expanding), embers.
  - Freeze: colour shifts to frost white from the edges/top down, icicles grow, motion slows to a stop.
  - Dissolve (sci-fi only): noise-threshold shader with a glowing edge.
- **Secondary motion everywhere**: trees sway, flags flutter, water bobs boats, cars brake (nose dips)
  and swerve, people look up before they run, birds scatter on loud events, debris keeps settling.
- **Anticipation → action → aftermath** for every big beat (ground trembles before the eruption,
  the sea pulls back before the wave, silence before the hit).
- Big events get **camera shake with roll** (decaying noise), a **flash** (white/orange full-screen
  fade 0.2–0.5 s) and a **sound hit** on the same frame.

## 4. Camera (the top videos are NOT static)
Keyframe the camera (position, pitch, yaw) with eased interpolation; add tiny handheld sway always.
Vocabulary seen in the winners, use 4–6 per video:
1. Locked establishing shot (0–5 s) behind a foreground railing, horizon ~45–50 % down the frame.
2. Slow push-in while tension builds.
3. Tilt/pan UP to follow the threat (wave, ash column, black hole, falling ring).
4. Shake + roll on impacts / earthquakes.
5. Drone moves: swoop down to street level, follow, crane up to a top-down view.
6. Continuous fly-through / fall / zoom across scales (growing, shrinking, falling into a black hole).
7. Climax: engulfed / pulled in / plunge → flash → dark frame where the HUD value reads **HERE**.
8. Bonus: loop endings — last frame matches the first frame so viewers rewatch.

## 5. Format to keep (from the 400K+ videos)
1080×1920, 60 fps, 60–95 s. Serif hook question centered 0–4 s. Top-left HUD: spaced-caps label,
big serif number that NEVER stops moving, small sub-line; the label changes as the story escalates.
Italic serif caption every ~5 s, 3–7 words, present tense. Black → end card: title + one true fact in tiny caps.
No voiceover; ambience → riser → silence → hit; SFX synced to every visual event.

## 6. Quality gate before the full render
- Render stills at ~12 key times, tile them into one contact sheet and review: is every frame busy,
  readable on a phone, and different from the last one?
- Render a 5-second test at 60 fps around the biggest event and check motion (no pops, no jitter,
  no z-fighting, no objects floating or clipping).
- Only then render the full video. Rendering must be deterministic: everything is a pure function of `t`
  (seeded random, no `Math.random()` at frame time, no real-time clocks).
