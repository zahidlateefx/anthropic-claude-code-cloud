## 9. LOCATION POLICY — owner correction 2026-09-22 (overrides the "one master wide per recurring room" habit where it conflicts)
- **Location consistency is the project's single biggest failure mode.** The owner has stated this twice. Never propose a film that stays in one location for the whole runtime: that maximises the number of clips that can be compared against each other, and every drift becomes visible.
- **Design films as travelling films.** Each location is visited ONCE, for roughly 40-90 seconds (about 10-20 clips), then abandoned for the rest of the episode. A place the audience never returns to cannot be caught drifting.
- A 6-8 minute episode should move through **6-9 distinct locations**. Scene changes every ~45 s also solve pacing: the owner wants fast, kinetic, Wanted-Reloaded-style cutting, and a static location reads as boring.
- Only genuinely recurring places (the hero's base, a series-anchor landmark) get a location reference image; one-visit places get none, per rule 12.
- Within a single visit, rule 11's editing grammar and rule 16's EXTEND chain still apply: one master wide, then mediums/close-ups/inserts, EXTEND carrying the room forward.
- Opening remains Version A, the owner's locked 45 s aerial ride with credits (owner re-confirmed 2026-09-22). A cold-open kill before the credits was proposed and NOT approved.

## 10. REFERENCE IMAGES ARE MADE ON DEMAND — owner correction 2026-09-22
- Do NOT plan or deliver a full batch of reference images up front. The owner makes each image only
  when a clip actually needs it.
- Delivery per clip stays as in section 2, but the image-prompt section contains ONLY the images that
  this clip needs and that do not exist yet. Images already made are named by number and role.
- Keep the running image-number table (per film, e.g. films/<film>/IMAGE_INDEX.md) updated with a
  status column: "to make" vs "made". Never re-issue a prompt for an image already made.
- The index still lists planned images so the owner can see what is coming, but nothing on it is a
  work order until the clip that needs it is delivered.

## 11. OPENING RIDE SHOWS THE HERO — corrected 2026-09-22
- The 45 s Version A opening ride is the MAIN CHARACTER riding, never the villains' convoy.
  R11 (character in kinetic action in the very first shot) applies to the hero specifically.
  Caught and fixed in IRON SUNDAY EP01, where ACT 0 had originally been written as the gang arriving.

## 12. IMAGE NUMBERS ARE THE TOOL'S SAVED SLOTS — owner correction 2026-09-22
- Reference images stay saved in the owner's tool under a fixed number. So image numbers are assigned
  **sequentially in the order the images are actually created**, starting at Image 1, and are NEVER
  changed afterwards.
- The first image a film needs is Image 1, the next new one Image 2, and so on. A planned-but-unmade
  image has NO number yet; it gets the next free number on the day it is made.
- Write the numbers the same way inside the image prompts and the attach list, and keep the film's
  IMAGE_INDEX.md as the single running record of number -> image -> status.
- IRON SUNDAY: Image 1 = @RIDERS, Image 2 = @DUSTHORSE, Image 3 = @TRUCK.

## 13. EVERY CLIP DELIVERY EXPLAINS THE SCENE IN PLAIN LANGUAGE — owner rule 2026-09-23
- With every clip prompt, also describe in the owner's own language (Roman Urdu + English) what
  actually happens in that scene: what the audience sees second by second, what the camera does, what
  is heard, and where the clip sits in the film. The owner should be able to ask for changes without
  reading the prompt itself.
- Keep it short and concrete (beat by beat with timecodes), and end with the specific things that are
  easy to change in this clip, so the owner knows what is on the table.
- This is in addition to the delivery format in section 2, not a replacement for it.

## 14. DEFAULT TO 30 s — owner correction 2026-09-22/23, raised twice
- **30 seconds is the default clip length.** Consecutive beats that share the same location, the same
  reference images and continuous time go into ONE 30 s clip with hard cuts at timecodes, not into
  several short clips. Every seam between clips is a place where the model can shift the light, the
  props or the positions, and seams are this project's main enemy.
- Split into a shorter clip only for a real reason: the location changes, the camera grammar changes,
  a new place is seen for the first time and deserves its own generations, or the action genuinely
  needs less time.
- A 30 s clip holds 3-5 beats in drama (6-10 s each) or up to about 15 shots of 1.5-4 s in a chase or
  a comic run. Use the whole budget.
- The cost of this is real and must be stated to the owner: if one beat inside a 30 s render fails,
  the whole 30 s is re-rendered. The continuity gain is normally worth it.

## 15. PROMPT LENGTH LIMIT 4,000 CHARACTERS — owner report 2026-09-23
- The owner's Seedance interface refuses prompts over 4,000 characters. Count the prompt body with
  Python len() BEFORE delivering, and keep it at or under about 3,800 for safety.
- The MODE / attach-order header lines are the director's notes and are NOT pasted into the tool, so
  they do not count. Count only what goes in the prompt box.
- When trimming, cut in this order: repeated Avoid items, adjectives in the Look block, restating a
  reference's details twice, redundant sound sources. Never cut: the duration line, the timecodes,
  a reference's identity-lock sentence, the dialogue, "No background music.", or the Avoid items that
  address this clip's real failure modes.

## 16. LESSONS FROM THE FAILED SD-03 EXTEND — owner report 2026-09-23
The first EXTEND render failed on two counts: the organ was still playing although the source clip
had already stopped it, and the characters stood in different places in the following fight shot.
Four standing rules come out of it.

**16.1 An extend opens from what the render ACTUALLY ends on, never from the plan.**
Before writing an extend, establish the real end state of the rendered source clip — ask the owner
what the last frame shows if there is any doubt. Better still, design every clip to END on an
unambiguous, easily described state (an action completed, a sound stopped, everyone still), so the
extend has one obvious thing to open from.

**16.2 ONE wide shot per location, for the whole film.**
A location gets a single master wide, once, and never another. Every other shot in that place is a
medium, a close-up or an insert. A second wide invites the model to re-arrange the room and the
characters, and the audience then sees the change. The "reverse wide down the aisle" in the first
SD-02 was a second wide and should never have been written.

**16.3 Frame so that position is not readable.**
In everything after the master, choose angles where the viewer cannot audit who stands where: tight
on one character with the background thrown out of focus, over-shoulder, waist-level inserts, hands,
weapons, faces. Never a framing whose whole job is to show the geometry of the room. This is what
makes EXTEND usable at all — the tool keeps the look, and the framing hides what it cannot keep.

**16.4 Every character gets their own reference image, and a name.**
Never put several distinct characters on one group sheet and expect the model to keep them apart.
One image per character, each with a name used literally in the prompt ("TUSK the boar gunman"),
so they can die one at a time instead of as an interchangeable crowd. A group sheet is only useful
as a SIZE COMPARISON reference, and should be labelled and used as exactly that.
References are cheap and up to 50 are allowed; being stingy here cost a whole render.

## 17. BLOCKING IMAGES ARE BUILT FROM THE RENDERED VIDEO — owner method 2026-09-23
The owner takes screenshots out of the clip that has already rendered and attaches them to the
blocking-image prompt, so the generated location-and-blocking reference matches what is actually on
screen rather than what the director imagined.

Standing workflow for every location from now on:
1. Render the act's master clip (the one wide, rule 16.2).
2. The owner grabs frames from that render showing the room and where each character ends up.
3. Those screenshots are attached to a LOCATION AND BLOCKING reference prompt, together with the
   character sheets. The prompt tells the model to copy the room, the light and the positions from
   the screenshots exactly, and to use the character sheets only to keep each face and costume clean.
4. That blocking image is then attached to every following clip of that location, alongside the
   individual character sheets and the EXTEND source.

Write blocking-image prompts so they defer to the screenshots: the screenshots are the authority on
geometry, light and position; the character sheets are the authority on identity; the text only
names what must not change. Never let the text contradict the screenshots — if the render put a
character somewhere other than the plan, the plan is what changes.

## 18. ANTI-DRIFT CRAFT — the techniques that actually hold a location together
Owner asked for the working methods, 2026-09-23. Apply all of these to every interior scene.
They replace the failed approach of describing the room harder.

**18.1 The 180-degree line.** Pick one side of the action and keep the camera on it for the entire
scene. State it inside the prompt in plain terms the model can obey: "in every shot the hard daylight
comes from the left of frame and the amber lamp is on the right". Screen direction flipping is what
makes an audience feel someone moved, even when nothing else changed.

**18.2 One anchor object per shot.** Every coverage shot contains one distinctive fixed thing that
was in the master — the organ case, the amber lamp, a specific bullet-holed pillar, one broken pew.
The eye reads continuity off the anchor and stops auditing the room.

**18.3 Shoot against something, never into the room.** Frame characters against the organ, a wall, a
door, another body. A shot looking down an open room is a shot asking the model to rebuild it.

**18.4 Shallow focus and dark surround.** Say it explicitly: subject sharp, background thrown well out
of focus and falling into shadow. What the audience cannot resolve, it cannot catch changing.

**18.5 Fixed light rule.** Name the light sources, their number, their direction and what stays black,
identically in every shot of the scene. Light flipping side is the single most visible continuity
break and the model does it constantly if not pinned.

**18.6 Consistent frame position.** Keep each character in the same part of the frame across cuts —
the taller one camera-right, the seated one camera-left — so eyelines match and nobody appears to
have swapped sides.

**18.7 Cut on movement.** Place every hard cut on an action, not on a still moment. A busy eye does
not audit geometry.

**18.8 Describe the room ONCE, in the same words.** Re-wording the Look block between clips of one
scene makes the model re-invent the room. Copy the block verbatim from the master clip into every
following clip of that location.

**18.9 Use the floor and ceiling sparingly.** Wide floor and ceiling area gives the model room to
invent. Keep framings chest-to-head where possible.

**18.10 If a location reference image will not generate cleanly, drop it.** Do not fight it. The one
master wide plus these rules carry the scene. (Owner dropped the blocking image for the mission nave
on 2026-09-23 for exactly this reason.)

## 19. SCENE STRATEGY — owner's method, 2026-09-23 (this governs how every scene is broken up)
The problem was never the number of clips. It is geometry: how much room and how many characters a
shot forces the model to keep straight. Build every scene from these three kinds of clip.

**A. Single-character tight clip — 10 s, NEW or EXTEND.**
One character, framed tight. No wide, no doorway, no room geometry, no other characters. Nothing in
frame that a later clip could contradict. These are cheap and safe, and are the right way to open a
scene (for example: THE ORGANIST alone at the organ, close, before anything has happened).

**B. The 30 s scene clip — the only place a wide shot is allowed.**
A location gets ONE 30 s clip that contains its wide shot, the entrance, and the whole multi-character
action from beginning to end. Hard cut in from the tight clip. Everything that involves several
characters moving around one room happens inside this single generation, where the model carries its
own continuity across the hard cuts. Never spread a fight across two generations.

**C. Extension after the 30 s clip — only if genuinely needed, and never wide.**
If the scene needs a few more seconds, extend tight: a close-up, an insert, one character. The aim is
not to need this at all.

Consequences to apply when planning:
- A 6-8 minute film is about 14 of these 30 s scene clips plus a handful of 10 s tight clips.
  30 seconds is a lot of screen time; a whole scene must fit in it. Plan scenes to that size.
- If an action will not fit in 30 s, the scene is too big. Cut the action down, do not add clips.
- One wide per location still stands (rule 16.2), and it now lives inside the 30 s clip.

## 20. GUNFIGHT GRAMMAR — owner correction 2026-09-24, after the SD-B render
The render packed the ORGANIST, CALDERA and four gunmen into one frame during the fight. Never again.

**20.1 Enemies never share a frame once guns are out.** A gunfight shot holds ONE character. Two are
allowed only if they are on the same side (two gang members behind a pew). Opposing sides are never
in the same shot, at any size, including blurred in the background.

**20.2 Fights are built as shooter / victim pairs.** SHOOTER: alone, medium or close, fires across
frame or toward the lens. HARD CUT. VICTIM: alone, hit from the direction the shooter fired, falls.
The reference channel's 1.5 s aim-at-lens portrait before each death is this pattern.

**20.3 Screen direction carries the geography.** The hero always faces and fires toward screen-right;
the gang always faces and fires toward screen-left. The audience knows who is shooting whom without
ever seeing both. Never flip it inside a scene.

**20.4 The wide happens before the fight, never during it.** The one master wide (rule 16.2) shows the
entry or the stand-off. The moment the first weapon is drawn, no shot wider than a medium single.

**20.5 Fight shots do not need one generation.** A single-character shot contains no geometry that a
later clip can contradict, so each shooter/victim pair is its own 10 s clip (two shots, one hard cut),
cheap and safe, cut together in the edit. The 30 s clip is for the SETUP of a scene (entry, walk,
faces, weapons out) and must end on the beat before the first shot.

**20.6 Do not propose storyboards, keyframes, arrows on location images or blocking images.**
Storyboard-as-reference and keyframe-as-reference were tested in SIX COFFINS and failed; the nave
blocking image would not generate. Position problems are solved by putting one character in the
frame, not by more reference pictures.

**20.7 Positions WILL drift between single-character clips; the job is to make drift invisible.**
The model never holds an exact spot across generations. Audiences do not check spots; they check four
things, and only these four must match between consecutive single-character shots:
(1) screen direction — hero faces/fires right, gang faces/fires left, never flipped;
(2) the anchor object behind each side — organ and lamp behind the hero, a pew behind a gunman;
(3) light direction — daylight from the left in every shot of the scene;
(4) shot size — cut medium to medium, close to close; never wide to medium.
Edit order rule for the owner: a victim shot always follows the shooter shot, never the wide. Keep at
least 15-20 s of tight shots between the scene's one wide and the first fight cut, so the audience's
map of the room has faded before the fight begins.

## 21. CLIP LENGTH BY COMPLEXITY + MANDATORY LOCATION IMAGE — owner decisions 2026-09-24
Supersedes rule 14 and the "drop the location image" line in 18.10.

**21.1 Length follows complexity, and the reason is credits.**
- Complicated scene (several characters, a wide, an entrance, a fight setup): **15 s clips**, two
  shots each. A failed 15 s costs half of a failed 30 s, and the owner lost real credits on 30 s
  renders that went wrong in one beat.
- Simple scene (one or two characters, tight, no geometry): 30 s is fine and saves seams.
- Fight shooter/victim pairs stay at 10 s (rule 20.5).

**21.2 A location reference image is mandatory for any location that appears in more than one clip.**
The image shows the EMPTY room — no characters, no arrows, no labels. That is what generates
reliably; the earlier failure was a blocking image with eight characters in it, which is a different
thing and stays banned (20.6).
- Generate it from a screenshot of the already-rendered master wide whenever one exists, so the
  reference and the footage are the same room.
- Attach it to every clip in that location, including tight shots, and give it a role in the text:
  "@imageN is the room; keep its walls, pews, organ, lamp and light exactly as drawn."
- IRON SUNDAY: image14 = MISSION NAVE interior, empty.

**21.3 The location image is taken standing AT the doorway, looking in.** (owner 2026-09-24)
The doors themselves are behind the camera and never in the image; the view is straight down the
room to its far end. This generates reliably where a view that includes the door did not.
Every clip in that location carries this fixed sentence in its Look block, verbatim:
"@image14 is the location reference for this room, photographed standing in the doorway looking
straight down the aisle to the organ; the doors are behind that camera position. Keep its walls,
pews, floor, organ, lamp and light exactly as drawn."
The model then knows where the reference camera stood and can place every other angle against it.

**21.4 The location image must never become the first frame.** (owner report 2026-09-24)
IN-02 rendered with the empty location reference as its opening frame, because the prompt said the
wide was "from the same position as @image14". Never describe any shot as matching the reference's
view. Two safeguards in every clip that carries a location image:
- The fixed line: "@image14 is a design reference for the room only. It is not a frame of this video
  and no shot reproduces its view."
- The scene's wide is framed deliberately differently from the reference (lower, off-axis, closer),
  and its first visible frame already contains the action and the characters — "no empty
  establishing frame". A reference that matches the first shot's description with nobody in it is an
  invitation to start the video on it.
If a wide still starts on the reference after both safeguards, drop the location image from wides
only and keep it for tight shots, where it does its real work.

## 22. OWNER CORRECTIONS 2026-09-24 (evening) — tagging, two-shots, pace, cinematic singles
**22.1 Tag every relevant attached image.** The owner attaches ALL reference images to every clip.
The model ignores untagged images, so the prompt must @tag every image that has any role in the
clip — always the size comparison (@image1) when two or more characters appear, every character
present, the prop, the location. Never be stingy with tags.

**22.2 Two opposing characters may share a frame.** Rule 20.1 is relaxed: a frame may hold at most
TWO characters from opposing sides (THE ORGANIST and CALDERA at the organ, shooter and the man he is
about to shoot in a stand-off). Never three or more mixed. Same-side groups are unlimited.

**22.3 Fights are FAST and Hollywood-professional.** THE ORGANIST is never slow in action: he pivots,
fires, breaks and reloads on the move, in 1.5-2.5 s beats. Every hit has a reaction, every action a
sound. Cuts land on the shot, the impact, the pivot. No held poses, no lingering.

**22.4 Apply the master-seedance controls in every action clip.** A physics sentence for anything
that recoils, falls, breaks or bursts (recoil kicks the barrels up, shells eject, a body of that
weight is thrown, pews splinter, dust lifts); sound with distance (close and full vs far and thin,
stone reverb tail); optics by number; the two named lights; the identity lock. Behaviour, not
emotion; timing words on every beat.

**22.5 Single-character scenes get the cinematic shots.** When only one character is in the room,
wides, slow pushes and long lenses are SAFE — there is nobody to be in the wrong place. Use them
there for the film's beauty, and save the tight framing for the moments with several characters.
A close-up-only opening reads as cheap; the master wide of a location should be the lone-character
shot whenever the story allows it.

**22.6 Tag format is `@image 14` — with a space between the word and the number** (owner 2026-09-24).
Never `@image14`. Applies to every prompt, every image, every film from now on.

**21.5 Location image: tight shots only.** (owner report 2026-09-24, second occurrence)
Both safeguards in 21.4 failed on the wide: the model still opened on the location image. So the
location image is now UNTAGGED in every wide or establishing shot (attached but ignored) and tagged
only in medium and tight shots, where it holds the organ, lamp and walls without becoming a frame.
Wides describe the room in text. Their first frame is written mid-motion (doors already half open,
a figure already in the light), so no still "room only" moment exists for the model to fill with the
reference.

## 23. FINAL: EVERY CLIP IS 30 s — owner decision 2026-09-24, closes the length question for good
No more 10 s or 15 s clips. Every clip is 30 s, 4-5 beats, hard cuts at timecodes, under 4,000
characters. Consistency inside one generation beats everything the shorter clips offered.
Everything learned still applies inside the 30 s: one wide per location (in the lone-character
opening where possible), the location image UNTAGGED in any clip that contains a wide and tagged in
tight-only clips, the first frame mid-motion, at most two opposing characters per frame, fights as
shooter/victim pairs at 2.5-5 s, physics and distance-true sound, `@image N` tags, every relevant
image tagged. Rules 14, 19, 20.5 and 21.1 are superseded where they say otherwise.

**21.6 Location image ALWAYS tagged; the wide is never a clip's first shot.** (owner 2026-09-24)
Supersedes 21.5. Untagging the location image in wides was wrong: the wide is the shot the audience
remembers, and if it comes from text alone it will not match the close-ups that use the image.
The first-frame problem only happens when the wide is shot 1. So: every interior clip opens on a
tight shot (hands, a face, a prop) and the wide comes second or later. Image 14 stays tagged in
every clip of the location, wide included.

## 24. ONE MINUTE PER STATIC LOCATION — owner correction 2026-09-24
When a location is still and several characters are in it, the whole thing is at most 60 s = two
30 s clips. The fight STARTS inside the first 30 s (first shot fired by about 25 s) and is finished,
with the exit, by the end of the second. Three 30 s clips for one room was too long. Set-up beats
(the wide, the entrance, the walk, the line, the weapons) all fit in the first 25 s; each gets
4-7 s, no more. If it does not fit, the set-up is too long, not the clip.

## 25. FINAL on the location image, the opening, and positions — owner 2026-09-24
Supersedes 21.6.
**25.1** The location image is tagged ONLY in clips made of close and medium shots. Any clip that
contains the wide leaves it untagged (attached, ignored). The wide is described in text.
**25.2** A location's first clip OPENS on the wide. Opening on a close-up "kills the fun". The
first-frame risk is handled by 25.1 (no location image tagged in that clip) and by starting the wide
mid-motion with the character already in frame.
**25.3** Define every character's position explicitly in every shot: which side of the aisle, which
pew, near or far end, facing which way, relative to the anchor object. "FANG at the second pew on the
left, facing the organ" — never "the gunmen spread out". Positions are stated once at the entrance
and then repeated by name in every later shot that uses them. This is the cheapest continuity tool
there is and it was not being used.

**25.4 State exact counts, and repeat them in every shot.** (owner 2026-09-24: a render produced three
hover-trucks where two were written once.) "Exactly two hover-trucks, exactly nine riders" goes in the
header line, in the reference line, and again inside each shot where they appear; the Avoid line
carries "no third truck, no extra riders". Counts stated once are not held across cuts.

## 26. TEST IN PROGRESS — shot labels instead of timestamps (owner 2026-09-24)
IN-01 and IN-02 are being rendered with "SHOT 1 / SHOT 2 ..." labels and no timecodes, to let the
tool pace the cuts itself. The prompt still fixes the number of shots, the cut points (on a movement,
a gunshot, an impact), a minimum of four seconds per shot, and that the clip fills 30 s; sound cues
are tied to shot numbers instead of seconds. Outcome not yet known. If pacing comes out well, this
becomes the default; if the tool rushes or drops shots, timecodes return.

## 27. CONTENT-FILTER-SAFE VIOLENCE + SINGLE-TAG CAST KEY — owner 2026-09-24
**27.1** IN-01 was blocked by the platform's content filter. The difference from clips that passed was
wound wording: "chest bursting red", "blood", "folds over the wound". Gunfire itself passes. So:
never write blood, gore, wounds, chests bursting, spray of red, or body-part injury. Write the hit as
force and result only: "the blast knocks him off his feet, he is thrown back over the pew and lies
still". Add "no gore, no visible injury" to Avoid. The colour rule for red becomes "the only red is
the scarf"; blood is not mentioned. Also say "creature-feature western with animal characters" in
the opening line so the filter reads the cast as creatures.
**27.2** Tag each image ONCE, in a "Cast key" block at the top ("@image 6 is THE ORGANIST ... Wherever
a name appears below it means that image"), then use names only in the shots. The owner should not
have to tag every mention. Under test from IN-01; if the model loses the binding, go back to
tagging every mention.

## 28. YOUTUBE-SAFE VIOLENCE — owner rule 2026-09-24, permanent
The films go on YouTube and must not be age-restricted. Violence is comic-western and stylised, as in
the reference channel: gunfire, muzzle flash, smoke, a man knocked back and lying still, splintering
wood, dust. NEVER: blood, gore, wounds, injury detail, dismemberment, torture, lingering on a corpse,
point-blank executions shown in close-up, cruelty to animals shown in detail. The colour rule is
"the only red is the scarf (and dynamite)"; blood is never mentioned. Every clip's Avoid line carries
"no gore, no visible injury". This also keeps prompts clear of the platform's content filter (27.1).

## 29. LITERAL WORDING ONLY — owner correction 2026-09-24, after the IN-02 render
The model reads every phrase literally and breaks on figurative or idiomatic ones. Banned, with the
replacement to use instead:
- "swinging open onto white glare" -> "the door is open. Bright daylight comes through the doorway."
- "shoves through it / ducks under the lintel" -> "walks through the doorway and out."
- "is gone / gone into the light" -> "he is no longer visible."
- "walks into the white glare, becomes a silhouette" -> "walks through the doorway into the daylight; from inside he is a dark shape against the bright doorway."
- "the shoulders rising on the snap" -> "the hands lift the shotguns up out of the frame."
- "cut on the doors / cut on the snap" -> "the shot ends as the doors bang open."
- "drops out of frame / folds forward" -> "falls to the floor and lies still."
- "runs for the doors" -> "runs through the main doorway and out; they are no longer visible."
General test: if a sentence needs a reader to understand a figure of speech, rewrite it as what a
camera would literally record. Nouns, verbs, positions, directions. No metaphors, no atmosphere words
standing in for actions.

## 30. TAG EVERY MENTION, LIST EVERY SHOT'S ROSTER, THE FALLEN STAY DOWN — owner 2026-09-24
Supersedes 27.2 (the single-tag cast key). The single-tag test failed: CARRION was shot in shot 1 and
then ran out at the end while also lying on the floor. So:
- Every mention of a character carries its @image tag, every time. The owner accepts the tagging
  work; credits matter more.
- Every shot states its roster in plain words: "In this shot: THE ORGANIST (@image 6) only." or
  "In this shot: DUNE (@image 12), MANGE (@image 13), SKITTER (@image 11); nobody else."
- Once a character has been shot down, every later shot in the clip says he is lying still and is
  not in the shot, and the Avoid line says "the fallen do not stand, move or appear again".
- Never put a group of same-side characters "blurred in the background" of another character's
  shot; the model cannot keep them apart at that size. Give the group its own shot.

## 31. NO UNMOTIVATED TURNS; BUILD THE GEOGRAPHY SO THE HERO NEVER REVERSES — owner 2026-09-24
"He turns back toward the organ end" was wrong and confused the render. Plan positions so the hero
faces one way for the whole scene and every target and every exit is in front of him or beside him.
If the story needs him to change direction, make it one clear action in its own shot ("he turns to
his left and faces the back door"), never a clause inside another action.

## 32. HOUSE TEMPLATE = HIGGSFIELD OFFICIAL SEEDANCE 2.5 TEMPLATE — owner 2026-09-24
The owner rejected the home-grown prompt structure after repeated failures and asked for a proven
template. Every clip from now on uses the ten-section Higgsfield structure recorded in
`master-seedance-2.5/references/higgsfield-template.md`: GLOBAL STYLE, SCENE, CHARACTERS, LOCATION,
FIRST FRAME AND BLOCKING, Shot N (timestamps to the tenth, "Hard cut"), OPTICS, PHYSICS, LIGHTING,
AUDIO, POSITIVE LOCKS. Timestamps are back (the guide requires them); rule 26's no-timestamp test is
closed.
Also from this correction:
- EXTEND opens with the boundary: "The first frame continues directly from the last frame of
  @Video 1: same shot, same camera, <positions>. Hold for 2-3 s, then Hard cut." Never a cut on the
  first frame — that is why the extends were not continuing.
- The fallen STAY VISIBLE, lying still, in later shots of the same room. Rule 30's "not in any later
  shot" was too strict and is withdrawn; the lock is "the fallen do not stand, move or reappear
  standing", not "the fallen vanish".
- Do not be stricter than the scene needs. Locks are for the things that actually broke.

## 33. OWNER CORRECTIONS 2026-09-24 (late) — no extend, tag format, director's cutting grammar
**33.1 No EXTEND, ever.** Every clip is a NEW generation; clips join by a hard cut in the edit.
Extending to buy 2-3 s of frame continuity wastes credits when the join is a hard cut anyway.
Supersedes rules 16 and the extend parts of 32.
**33.2 Tag format.** The owner cannot tag "(@image 10)" or "(image 10)". Never put a tag inside
brackets and never glue punctuation to it. Write the tag after the name with spaces on both sides:
"TUSK @image 10 lies still", "FANG @image 8 , CARRION @image 9 ,". Check every prompt with a regex
before delivery: no "(@image", no "@image N)" / "@image N," / "@image N." without a space.
**33.3 Characters in a scene never vanish.** A character present in the previous shot is accounted
for in the next: in frame, or stated where he is. When THE ORGANIST fires, CALDERA was beside him and
must still be beside him (ducking, pinned against the organ) — not silently gone.
**33.4 Action speed.** The hero is fast: both guns used together, a reload is one flick under two
seconds, a volley of kills is 1.5 s per shot. Never "opens both guns, puts in new shells, closes
them" as a slow chain; never one gun when the design is two.

**33.5 Director's cutting and continuity grammar (use in every clip):**
- CUT ON ACTION: start a movement at the end of shot A and finish it in shot B (he raises the gun —
  cut — the muzzle flash). The eye follows the motion and misses the seam.
- SHOOTER / TARGET = SHOT / REVERSE SHOT: the shooter looks and fires one way, the target is hit
  from that side in the next shot. Eyelines must point at each other across the cut.
- 180-DEGREE LINE: pick the side of the action once per scene; screen-left/right never flips.
- SCREEN DIRECTION IN CHASES: a character who exits frame-RIGHT enters the next shot from
  frame-LEFT and keeps moving left-to-right; the pursuer moves the same way. Reversing it makes the
  chase read as running toward each other.
- 30-DEGREE RULE: consecutive shots of the same subject change angle by at least 30 degrees or change
  size clearly (medium to close), otherwise the cut looks like a jump.
- MATCH THE STATE: props in hand, wounds, dust, doors open/closed, who is standing, all carry across
  the cut exactly; write the state at the top of each shot if it changed.
- INSERTS AND REACTIONS: a 1-2 s insert (hands, shells, a key object) or a reaction face lets you
  compress time and hide a position change.
- SOUND BRIDGES: let the next shot's sound start just before the picture cut (a gunshot heard on the
  shooter, landing on the target), so hard cuts feel joined.
- RE-ESTABLISH only when the geography changes (a character moves to a new place, a new room).

## 34. HOUSE FORMAT (owner final, 2026-09-24) — supersedes the Higgsfield timestamps of rule 32
The owner prefers the earlier format: shot labels with NO timestamps, FEWER shots, more freedom for
the model to pace. Structure: opening style line (duration, look, "N shots joined by hard cuts, the
model sets the timing") -> Look -> References/Cast with tags -> Positions -> SHOT 1..N each ending
in HARD CUT -> Physics -> Audio (cues tied to shot numbers, not seconds) -> Avoid.
- 4-6 shots per 30 s clip. Merge beats instead of adding shots. A volley of kills can be one shooter
  shot plus one shot per side of the room (same-team victims may share a frame).
- Everything else learned still applies: tag format with spaces (33.2), nobody vanishes (33.3), fast
  hero (33.4), cutting grammar (33.5), literal wording (29), fallen stay visible (32), YouTube-safe
  (28), no extend (33.1), under 4,000 characters.

## 35. MUSIC PROMPT STYLE — owner 2026-09-24 (ElevenLabs Music v2.5)
One dense descriptive paragraph per cue in the owner's model style: "Spaghetti western film score,
dusty analog 1960s mix with wide stereo and punchy low end; <BPM> <pulse>; instrumental; <lead
instruments and who trades with whom>; <colour instruments>; <mood>, Rango / reference-channel
mariachi and Tex-Mex swagger; ...". Pace NORMAL: 64-118 BPM, nothing frantic. Every cue must be
fade-friendly: even repeating sections, no sudden stops, no stings or final crash, ending on a long
sustained chord that fades out naturally, so the owner can end the cue wherever the scene ends.
Current cues: films/iron-sunday/MUSIC_PROMPTS.md.

## 36. CRYPT / NAME-WALL ENGINE REJECTED — owner 2026-09-24
The owner did not like the crypt scene or the twelve-names-on-a-wall device. Do not propose it again.
IRON SUNDAY's post-title scene and series engine are open; alternatives pitched: A) Caldera's
riderless horse leads to the next gang, B) a radio in Caldera's hover-truck — the boss above him
answers (recommended), C) a wanted poster with the backers' seals. Await the owner's choice, then
update SERIES_BIBLE.md section 4 (it still describes the rejected crypt wall).

Owner chose option B (the radio) 2026-09-24; bible section 4 rewritten; clip RD-01 written.

**25.5 Location image: untag only when the wide is the FIRST shot.** (owner 2026-09-24, RD-01)
Rule 25.1's reason is the first-frame problem, which only exists when the clip opens on the view the
reference shows. If the clip opens on a close-up or insert, tag the location image even though a wide
comes later — otherwise the place drifts from how it looked in earlier clips.

## 37. MAX FOUR CHARACTERS PER CLIP — owner rule 2026-09-24, permanent
A clip (one generation) contains at most FOUR characters in total, counting heroes, villains, the
dead and anyone seen in the background. The church scene with eight took hours of regenerations.
Plan every scene around this: small gangs (two or three henchmen plus a boss), and if a story needs
more people, split them across separate clips. Vehicles and mounts do not count, but keep them few.

## 38. VOICES, MASKED HEROES AND POST-TITLE OPENINGS — owner 2026-09-24 (RD-01 feedback)
- A masked hero must never be framed with a voice that could be his. If someone off-screen talks,
  show the source (speaker grille, radio) and keep the hero's hands off any mic; write "his mask never
  moves as if talking". Never give the masked hero a line he appears to answer.
- Start dialogue immediately: state that the voice begins in the first second; never leave several
  seconds of silence before a line the scene depends on.
- Villain voices are CHARACTERS: describe timbre, pace, accent, attitude, laugh ("deep, gravelly,
  rasping, slow and cold, amused and cruel, faint accent, smiles while he talks, one low chuckle")
  and give each line an emotion tag. Lines must carry story, not just "You." Two to four lines.
- After a title card or scene change, never open on a tight insert; open on a medium of the main
  character, then go close.

## 39. TEST IN PROGRESS — screenshot -> Nano Banana blocking reference (owner 2026-09-24)
Separate test project: C:\Users\Zahid\AIShortFilms\tests\blocking-ref (README, TEST-01, NANO_TEMPLATE).
Clip 1 shows a new location in several wides from different angles with everyone fixed in place;
the owner sends screenshots; the director writes a Nano Banana Pro prompt that rebuilds the room and
places each character by sheet (end-of-clip position wins; extras named and excluded; contradictions
with the next clip corrected); clip 2 tags that image. NOT a rule for the films until it passes.
If it passes, wides become allowed in every 30 s clip.

Test finding 2026-09-24: the Nano Banana composite got the room right but moved THE ORGANIST; the
rendered video (screenshots) is the authority for positions, never a regenerated image. Method B
(screenshots attached directly) runs first.

Temporary reference slots: screenshots used only for one scene are uploaded into free numbers and
deleted by the owner afterwards; mark them "temporary" in IMAGE_INDEX.md and expect the numbers to
be reused. Permanent sheets keep their numbers (rule 12).

## 40. SCREENSHOT CONTINUITY METHOD — PASSED, now standard (owner 2026-09-24)
**40.1 Workflow for every multi-clip location.** Clip 1 shows the location in two or three wides
from different angles with everyone fixed in place. The owner sends screenshots from the render.
The director writes the next clip with those screenshots attached directly as references (temporary
slots), describes what each view looks at, restates the room and every position as the screenshots
show them (the video wins over the plan), and puts a foreground element in any shot whose angle is
close to a screenshot so the screenshot cannot become the first frame. Nano Banana composites are
NOT used for positions (they moved THE ORGANIST). Wide shots are now allowed in every 30 s clip that
uses this method. From now on the owner sends screenshots after each clip and the next prompt is
written from them.

**40.2 Exits use the existing door, and the door must be in frame.** In TEST-02B CALDERA ran out
through a NEW door that appeared in the wall behind his chair instead of the plank door already in
the back wall. Cause: the exit shot was a medium of CALDERA alone; the real door was out of frame
when the shot began, and "the plank door in the back wall" matched the wall directly behind him, so
the model built a door there. Fix in every exit: (a) frame the shot so the existing door is visible
from its first frame, (b) give the door's exact place relative to fixed things and the reference
("the one plank door in the back wall, left of the table, behind the end of the bar, as in @image
15"), (c) describe the path ("he runs left across the room to it"), (d) Avoid: "no new door, no
opening in any wall other than the existing door".

**40.3 Open-ground fights are instant.** When enemies stand in the open with no cover, the hero
kills them in ONE fast burst: all enemies go for their guns at the same moment, the hero fires
left-right-left in about two seconds before any of them can fire, and they fall almost together.
Never let one enemy wait while another is shot — it makes the enemies look slow and stupid. Write it
as "they all reach for their guns at once; he is faster" and cut shooter/victim pairs at 1 s each.
If an enemy gets time to act, he must act (fire and miss, dive, run).

## 41. MANDATORY LOGIC CHECK BEFORE EVERY PROMPT — owner 2026-09-24
TEST-02B v2 had CALDERA draw a gun and never fire, and the last shot showed THE ORGANIST entering
through the door CALDERA had just escaped by. Before any prompt is delivered, walk every character
through every shot and answer, and show the owner a short logic table:
1. MOTIVE: why does he do this? Would a real person do it at this moment?
2. CONSEQUENCE: anyone who draws a gun fires it, is shot first, or visibly decides not to (drops it,
   flees). No action is started and abandoned. Rule 40.3 applies to henchmen in the open; a boss may
   instead panic and run — say so.
3. PLACE: where is he at the start and end of the shot, and does that match the previous shot?
4. DIRECTION: every walk or run is written relative to the camera and to fixed objects ("enters from
   the bottom edge of frame, back to camera, walks away from camera toward the open back door"), and
   names where he comes FROM, so the model cannot reverse it. Add "he never comes in through X" when
   a doorway could be misread.
5. EXITS AND ENTRIES: a character leaves only by a door that exists and is in frame; nobody enters
   through the door someone else just used unless the story says so.
6. What changed from a version that worked? If an earlier version's shot worked, keep its wording
   unless there is a reason to change it.

## 42. RIDER AND MOUNT TAGGED TOGETHER IN EVERY RIDING SHOT — owner 2026-09-24
Wherever a character rides, every shot names both: "THE ORGANIST @image 6 rides his black
dust-horse @image 2 ...". The mount is re-stated after every hard cut, otherwise the model swaps it
for another animal or colour. Avoid line: "no other mount than <mount> @image N in any shot".

Riding speed (owner 2026-09-24, TR-01): a travelling rider is at FULL GALLOP in every shot, towns
included; never "rides slowly", "rides past" or "walks the horse" unless the story stops him. Show
speed through the townsfolk's reactions (dust over them, jumping back). Avoid: "no slow riding, no
walking or trotting horse".

## 43. COPYRIGHT FILTER — DO NOT LOOK LIKE RANGO ON SCREEN (owner report 2026-09-24)
TR-01 v2 was blocked: "The generated video may be related to copyright restrictions." The likely
cause (the platform gives no reason): a desert town full of cute townsfolk — toad, jackrabbit mother
and child, armadillo, old vultures on a porch, a lizard child — reads as the town of Dirt in Rango.
Rango is a reference for the MUSIC and the mood only, never for what is on screen.
- Townsfolk and extras use the series' own grotesque designs: insects, arachnids, beetles, mantises,
  scorpions, tortoises, moths, gaunt carrion creatures; photoreal and ugly, never cute or cartoon.
- Avoid in crowd/extras: toads, rabbits, armadillos, mice, owls, chameleons, lizard children, and any
  small-town cast that recalls an animated film. Named gunmen from existing sheets have passed and
  may stay.
- Never write the name of a film, studio or franchise in a video prompt.
- On a copyright block: first change the most film-like element (the extras, the town, a famous
  pose), not the hero.

## 44. WRITE EVERY ENDING FOR THE NEXT CLIP — owner 2026-09-24 (TR-01)
Before writing a clip's last shot, decide how the NEXT clip opens and make the ending hand over to
it: the same time of day and light (no sunset if the next scene is daylight), the same direction of
travel, and the right speed (if the next clip opens with the character stopping or looking, slow
him down in the last few seconds). State the end state in the MODE header.

## 45. IMAGE 1 IS NOT A FULL SIZE CHART — owner 2026-09-24
Image 1 in IRON SUNDAY is the old group sheet of the nine riders only. It does NOT contain THE
ORGANIST or CALDERA. Tag it only when those gunmen are in the clip; never as "heights" for a clip
with only the hero, the boss or new characters. Before tagging any image, check what is actually in it.

## 46. DISTANCE IN NUMBERS, CLOSING GAPS, ONE OPPONENT PER SHOT — owner 2026-09-24 (SA-01)
- Never "far away", "in the distance", "close". Give the lens (field of view in degrees) and the
  distance in metres: "telephoto, 8 degree field of view, about 800 metres away, tiny on the horizon".
- In a chase or approach, state the gap in EVERY shot and make it change in one direction only
  (800 m -> 400 m -> 40 m); add "the distance never grows" to Avoid. Missing distances let the model
  put the hero next to the enemy in one shot and far away in the next.
- When two opponents both act (one fires, the other fires back), each gets his own shot joined by
  HARD CUT. Never write both actions inside one shot; the model then puts them in the same frame.

## 47. HEAD-ON IS NOT A CHASE — owner 2026-09-24 (SA-01 v2 render)
Horses + a truck + gunfire default to a CHASE in the model. SA-01 v2's shot 4 became a chase because
"bullet strikes just behind the horse's hooves" told the model the shooters were behind him; shot 6
then had him turn and fire backward because "fires toward the right" was not tied to his heading.
- State the geometry in words: "HEAD-ON CHARGE, not a chase; the enemy is always IN FRONT of him;
  nobody is ever behind him".
- Place impacts on the side the shots come from (a head-on enemy's bullets land in FRONT of the horse).
- Give firing direction relative to the rider's heading, not the screen: "fires straight ahead over
  his horse's head", "never turns in the saddle, never looks back". Avoid: "no chase, nobody behind
  him, no firing backward".

## 48. GIVE THE AFTERMATH ITS OWN CLIP — owner 2026-09-24 (SA-02)
Do not end an action peak by having the hero gallop straight off. After a big set piece, give a
breather clip (about 30 s): he stops, dismounts, walks past the dead (visible), something reaches him
(a voice, an object, a clue), and that clue points to the next location, which he then sees and rides
toward in the last 7-8 seconds. Action -> consequence -> clue -> departure.

## 49. DIALOGUE MUST SOUND HUMAN, NOT WRITTEN — owner 2026-09-24 (SA-03)
"Nobody left... You're better than Caldera said, gunman" and "my tower sees you coming" felt
AI-written: they summarise the plot and use filler address words. Rules for every line:
- Fragments, names, everyday gripes, a personal tic (THE VOICE: a few Spanish words, "hombre",
  "ain't"). Something the character would say even if no audience were listening.
- Plot information comes out sideways, inside a practical remark ("Old Mott's up that tower with his
  ears on"), never as an announcement or a compliment to the hero.
- No generic address words ("gunman", "friend", "stranger") as filler; no "you're better than X".
- Test: would an actor improvise something like this? If it reads like a trailer line, rewrite it.
- Named offhand details become story: MOTT, named by THE VOICE, is the radio-tower operator of the
  next scene.

**49.1 No invented names and no foreign words in spoken lines** (owner 2026-09-24). The model
mispronounces made-up names (Brand, Snap, Mott) and Spanish words ("Contesta, hombre"). Spoken
dialogue uses plain, easy English only: "boys", "the old man up in that tower". Character names stay
in the prompt for the model, never in the mouths of characters. The accent can stay; the words are
plain.

**49.2 Characters only know what they could know; lines are short** (owner 2026-09-24). THE VOICE
cannot tell who is at a radio from breathing. Keep him ignorant unless the story gives him a way to
know; let the hero OVERHEAR information meant for someone else ("Tower. My boys went quiet out on the
salt." / "Watch the road."). Radio and off-screen lines: one short sentence each, two to four words
where possible.

## 50. END A LOCATION'S CLIP ON A "REFERENCE WIDE" + DESCRIBE GUNFIRE VISIBLY — owner 2026-09-24
- When the next clip continues at the same place, the current clip ends on a locked wide (about 4 s,
  nobody moving) that shows every object and character in its final position — the wreck, the dead,
  the hero, the mount. The owner screenshots it and the next clip opens on a close/tracking shot with
  those screenshots attached (rule 40).
- "Firing" alone renders silent, flashless guns. Always write the visible mechanics: muzzle flashes
  from the barrel, gun smoke, casings ejecting, the gun kicking; Avoid "no gun that does not flash".

## 51. EMPTY ESTABLISHING SHOTS BECOME DRONE SHOTS — write them as a POV (owner 2026-09-24)
RT-00 v1 ("wide from the top of a rise, pushing forward over the crest, the town below") with no
character in frame rendered as an aerial drone shot. A location seen by a character is written as
HIS point of view: "a rider's point of view from the saddle, eye height about 2.5 m, telephoto lens,
15 degree field of view, locked, looking at X about one kilometre away", with heat shimmer and a
near sound (his horse snorting). Avoid: "no aerial view, no drone, no camera above the ground".

51.1 FAR LANDMARK POV (owner, RT-00 v4). When a place must read as far away, do not show the place itself.
Put it beyond the horizon: only the TOP of its tallest feature (mast, spire, dam crest) shows above the
horizon line, very small, fading in and out of blowing dust or haze. Wide lens (about 60 degrees),
rider eye height 2.5 m, 8 km or more, most of the frame empty ground and sky. Avoid-line names every
lower part that must stay hidden (buildings, lower mast). v2 at 1 km and v3 at 3 km both read too close.

53. MOUNTS AND THE WORD "HORSE" (owner 2026-09-24). Tagged creature mounts rendered as normal horses in
almost every clip. Cause: the prompts said "dust-horse", "horse's head", "hooves", and only tagged the
sheet; the word beats the image. Rules: never write horse, horseback, hooves or trotting horse for a
creature mount; give it its own name (IRON SUNDAY: the black STRIDER, image 2); every prompt repeats one
fixed description line in Cast ("a hairless black reptile mount with leathery scaled skin, no mane, a
row of bony spikes down its neck, a long lizard head and split-claw feet"); every Avoid line starts
"no ordinary horse, no mane, no hair, no hooves". Mount sheets show ONE creature in ONE colour, designed
far enough from a horse (lizard head, spikes, claws, tail) that the model cannot slide back to a horse.

54. DELIVERY CARD WITH EVERY PROMPT (owner 2026-09-24). Never deliver a bare prompt. Directly above each
prompt fence write a short card: clip code and scene name; duration; where it sits in the edit (after
which clip, before which clip); a 2-3 line plain summary of what happens; ATTACHMENTS as a numbered list
"image N = what it is" (and anything to attach when generating an image); what the owner must do after
the render (e.g. send the reference-wide screenshot). Keep films/<id>/EDIT_ORDER.md updated with every
clip in film order, its status and its attachments.

56. TAG ONCE, THEN NAMES (owner 2026-09-24; supersedes "tag every mention" in rules 29/42). TR-01 v5 put two
copies of THE ORGANIST and his mount in the town shots; the owner links it to the image tags repeated in
every sentence. Now: each image is tagged ONCE, in Cast (or in Place for a screenshot), written as
"@image N is NAME: description", followed by "From here on they are called ...". Every later mention uses
the name only. Cast states "exactly ONE rider on ONE mount, he appears only once in every shot", and
Avoid lists "no second rider, no copy or double of <hero> or <mount>". Not yet proven to be the cause;
watch the next renders.

57. THUMBNAILS (owner 2026-09-24). A thumbnail sells the STORY, not only the hero: show the hero in his
world plus visual symbols of the theme in depth layers (foreground symbol, hero, key location, the
threat/odds, the far goal), title top-left, one short tagline. Hero in the right two-thirds facing the
camera, one accent colour. Keep it readable: every layer smaller and softer the further back it is.

58. NO UNSHEETED CHARACTERS (owner 2026-09-24). Never write a character, crowd, gang or creature into
any image prompt (thumbnail, sheet, location) without naming it from an existing sheet and listing
that sheet in the attachments. A thumbnail gang written as "creature gunmen" with no sheet came out as
random strangers. If no sheet exists, leave the figures out or ask for the sheet first.

59. NANO BANANA HAS NO TAGS (owner 2026-09-24). "@image N" tags exist only in Seedance. Image prompts
for Nano Banana (sheets, thumbnails, edits) name each attachment by what it is ("the attached riders
sheet", "the attached thumbnail") and never use numbers. The delivery card lists the files to attach
by name.

60. FINAL WIDE SHOWS THE NEW STATE (owner 2026-09-24). A closing wide written "from the same angle as the
reference" made the model copy the reference, putting THE ORGANIST back in the saddle after he had jumped
off. The reference gives only the PLACE; the final wide gets its own angle and states the new state
explicitly (on foot, riderless mount, who is dead where). When a character changes state mid-clip
(dismounts, drops a weapon), say "from shot N on he is ... and never ..." in the prompt.
60.1 Physical action is written as exact mechanics: which way, which body part, where he lands, where the
shots hit (his old spot), how many shots, how fast ("within a second"). Short beats stay short: a reload
is "click, click, one shell in", not a full reload.

