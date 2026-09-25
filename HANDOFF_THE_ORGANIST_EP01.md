# HANDOFF — THE ORGANIST, Episode 1: IRON SUNDAY

Source: owner's local Claude Code session "Western movie ideas" (22–25 Sep 2026, transcript
`73522ae2-e7b1-443c-9ea6-894ecd5e7f16.jsonl`). Read this first, then the two context summaries in
`archive/western-movie-ideas-chat-25Sep/` for full detail.

## Status
- **EP01 is COMPLETE** (all clips generated and edited by owner in CapCut).
- Done after the film: text title-card intro (Nano Banana image → Seedance start/end-frame animation),
  Suno organ theme (steady 104 BPM), tension underscore, 12–15 s post-fight sting (no whistle),
  YouTube title/description/tags (`films/iron-sunday/YOUTUBE_EP01.txt`), CapCut colour grade recipe
  (`films/iron-sunday/COLOR_GRADE_CAPCUT.txt`, preset name "ORGANIST LOOK").
- **Next:** Episode 2 **"THE RIBCAGE"** (open location, not an enclosed place like the church).
  Optional: YouTube chapter timestamps once owner gives final edit times.

## YouTube
- Title: `THE ORGANIST | Episode 1: Iron Sunday | Sci-Fi Western Short Film`
- Description must not name AI tools (Seedance / Nano Banana / Suno) and must not copy the
  reference channel's wording. Reference channel: Crazy Taco Man ("WANTED", "WANTED RELOADED").

## Story (EP01)
Three years ago Boss CALDERA's gang buried a man under the floor of a ruined desert church.
This Sunday a masked stranger (THE ORGANIST) is playing its organ. He kills the gang across
travelling locations: church → salt flats ambush → radio-tower town → dam. At the end the
hidden minion DRIBBLE begs "please don't kill me", says the Boss left when he knew he was coming,
and hands over a NECKLACE (option B: rusty ring chain, cracked amber with a dried flower) only the
Organist recognises. The RADIO crackles: THE VOICE (main villain, never revealed in EP01) has his
wife — her screams on the radio — "Come and get her. I'm waiting for you in The Ribcage." + laugh.
Earlier radio lines (RD-01): "Hey! Pick up the radio, you dogs!" / "Is it done or not? Answer me!" /
"So the rumors were true. You really came back from the dead." / "This time I won't bury you.
This time I'll burn you alive." → Organist blasts the radio.

## Final edit order (clip files in `films/iron-sunday/clips/`)
OP-01, OP-02, OP-03, CH-01, CH-02 (v9), INTRO/title card, RD-01 (ends shot 5), RD-01B, RD-02,
TR-01 (v5) + TR-01T, SE-01, SA-01 (shots 2–3), SA-R1, SA-03 (v4), RT-00, TR-02, RT-01A, RT-01B,
RT-02 (v3), RT-03, DM-01 … DM-06.

## Locked names (always use the unique name, never the generic word)
- **THE ORGANIST** — hero, rusty iron mask, dark brown hat (never removed), red scarf, sand duster,
  black gauntlets. Weapons: **THE TWIN PSALMS** (two sawn-off shotguns, fires both at once).
  Never pistols, no holster.
- **STRIDER** — the mount (black reptile beast). Never "horse", "mount", "reptile". Organist's is black.
- **HOVER-TRUCK** — gang vehicles. Never "truck".
- Gang (opening redo): CALDERA (boss of the church gang) + CARRION (buzzard), TUSK (boar), DUNE,
  MANGE (coyote) — 5 total; snake and rabbit removed. Later villains: VEX, BRAND, SNAP (salt flats),
  HUSK, KNUCKLE, SICKLE (radio tower), HOOK, WHISKER, PINCH (dam), DRIBBLE (ending).
- **RADIO** option A (rusty wire-wrapped brick, lying flat, never clean/new). Everything in the world
  is old, rusty, ugly.

## Owner's working rules (most important; full list in `skills-updates/` + skill SKILL.md 1–71)
- Tools: Seedance 2.5 video (`@image N` tags with spaces, prompt body ≤ 4,000 chars, **no Extend**,
  new clips joined by hard cuts), Nano Banana images (no @tags, just name attachments), Suno music
  (owner often gets music prompts from ChatGPT via `CHATGPT_MUSIC_BRIEF.md`), CapCut edit.
- Default clip 30 s (5–20 s inserts when asked). Shots labelled SHOT 1..N, no timestamps, fewer cuts.
- Every prompt comes with a **delivery card**: which scene, what happens shot by shot in plain words,
  exact ending frame, and attachments as "image N = what" only.
- Image slots: used images keep their numbers; unused removed; new fill freed slots.
- Screenshot continuity: clip ends on a locked wide; owner screenshots it; next clip uses it as
  "reference only, never a frame"; first shot continues previous angle; final wide uses a new angle.
- Tag once, then names; WHO IS WHERE list for groups; max 4 characters per clip; max 2 opponents per
  frame in gunfights.
- Literal wording, distances in metres + lens, no figures of speech, no "far away".
- YouTube-safe: no blood/gore. Not Rango-like creatures; never name films in prompts.
- Dialogue short, human, angry villain ("you dogs"); no weird names; radio voice thin, tinny,
  distorted, one emotion.
- Owner writes Roman Urdu + English; reply the same way, concise.

## Files in this repo
- `films/iron-sunday/` — bible, image index, music prompts, shotlist, clips, sheets, thumbnails,
  YouTube text, colour grade. **Rebuilt from the transcript's Write/Edit calls.** Files that were
  later changed by shell/python scripts (SERIES_BIBLE, IMAGE_INDEX, EDIT_ORDER, some sheets and a few
  clips) may be an older version here; the context summaries hold the latest state.
- `tests/blocking-ref/` — screenshot-continuity test prompts (method PASSED).
- `skills-updates/` — west-movie-director rules 9–51 as appended; Higgsfield template note.
  Rules 52–71 are summarised in `context_summary_2_25Sep.txt`.
- `archive/western-movie-ideas-chat-25Sep/` — `full_chat_readable.txt` (whole chat, text),
  two context summaries, raw skill-update commands, `original_transcript.zip` (original .jsonl).
