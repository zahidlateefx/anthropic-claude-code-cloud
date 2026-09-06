#!/usr/bin/env python3
# Transcribe an audio file to text using faster-whisper (local, CPU).
# Usage: python3 transcribe.py <audio-file>
# Prints the transcript to stdout. Exits 2 if faster-whisper isn't installed.
import os
import sys

try:
    from faster_whisper import WhisperModel
except Exception:
    sys.stderr.write("FASTER_WHISPER_MISSING\n")
    sys.exit(2)

if len(sys.argv) < 2:
    sys.stderr.write("usage: transcribe.py <file>\n")
    sys.exit(1)

model_size = os.environ.get("WHISPER_MODEL", "base")
# int8 keeps it light enough for a small ARM VM; model is cached after first use.
model = WhisperModel(model_size, device="cpu", compute_type="int8")
segments, _info = model.transcribe(sys.argv[1], beam_size=1, vad_filter=True)
text = "".join(seg.text for seg in segments).strip()
sys.stdout.write(text)
