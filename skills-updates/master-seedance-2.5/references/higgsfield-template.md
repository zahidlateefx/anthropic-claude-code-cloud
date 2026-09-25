# Higgsfield official Seedance 2.5 prompt template (adopted 2026-09-24)

Source: Higgsfield, "Seedance 2.5: Complete Prompting Guide (Full Prompt Library)",
https://higgsfield.ai/blog/seedance-2-5-prompting-guide (read 2026-09-24). Extend wording from
Morphic, https://morphic.com/resources/how-to/seedance-2-5-guide. Failure modes cross-checked
against https://www.heyuan110.com/posts/ai/2026-07-11-seedance-2-prompt-guide/.
This is now the house template for every Seedance 2.5 clip. The owner asked for it after the
home-grown structure kept failing (2026-09-24).

## Section order (all ten, in this order, one continuous block, labelled)

```
GLOBAL STYLE: genre, colour grade, film stock/grain, aspect, duration, exclusions.
SCENE: one-line logline — what happens, where, the mood.
CHARACTERS: every character, identity locked to its reference ("@image N, identity and wardrobe
  locked to the reference, ignore the reference backdrop"); which reference is which; "exactly N
  characters, never N+1".
LOCATION: the space and props, separate from people; no readable text.
FIRST FRAME AND BLOCKING: camera position, every character's starting position and facing,
  screen direction ("THE MAN always screen-LEFT, THE WOMAN always screen-RIGHT, they never swap").
Shot 1 (0.0s to 3.0s): shot type, camera, action in order, timing to the tenth of a second. Hard cut.
Shot 2 (3.0s to 7.2s): ... Hard cut.
...
OPTICS: field of view per shot, camera height, dolly/locked/handheld per shot.
PHYSICS: how dust, cloth, smoke, bodies, doors, liquids actually move; real mass and inertia.
LIGHTING: the sources, their number, direction and quality; what stays dark.
AUDIO: ambience, foley with visible sources, dialogue language, timing; what must not appear
  ("No music, no narration").
POSITIVE LOCKS: everything restated as a rule — member count, same face/wardrobe/state across all
  shots "zero drift", geography hold, screen direction, who is hit and stays down, no blood, no
  attached image as a still frame.
```

Rules the guide states outright:
- Timestamps on every shot, to the tenth of a second; "Hard cut" closes every shot.
- Vague location = the most common cause of drift between cuts. Blocking must be exact.
- Screen direction must be stated and held.
- Say what must NOT appear (negative locks) and say it again in POSITIVE LOCKS.
- State the member count as "exactly N, never N+1".
- One continuous block; skipping a section fails in a predictable way.
- Fewer, deliberate references beat a cluttered set; every reference gets an explicit job.

## Extend prompts (Morphic / Higgsfield wording)

Open with the boundary, not with a cut:

```
Extend @Video 1 forward by <N> seconds. The first frame continues directly from the last frame of
@Video 1: same shot, same camera, <who is where, facing which way, what the light is>. Hold this
shot for <2-3> seconds, then Hard cut.
```
The seam only works if the first new shot IS the last old shot continuing. A hard cut on the first
frame throws the continuity away. Then the ten sections as above; CHARACTERS and LOCATION may be
short ("as in @Video 1, locked") but the blocking is restated in full.

## Failure modes (heyuan110), kept because they match our renders
- Instruction overflow: too many demands, half honoured at random -> prioritise, trim.
- Naked references: an untasked reference bleeds its framing/light into the shot -> give each a job.
- Stacked camera moves in one shot -> one move per shot.
- Scene cramming -> scale complexity to duration.
