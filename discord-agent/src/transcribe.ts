import { execFile } from "node:child_process";
import path from "node:path";

export interface TranscriptResult {
  text?: string;
  missing?: boolean; // faster-whisper not installed
  error?: string;
}

/**
 * Transcribe an audio file to text via the local faster-whisper script.
 * Returns { missing: true } if the dependency isn't installed so the caller
 * can tell the owner to run `friday voice`.
 */
export function transcribeAudio(file: string): Promise<TranscriptResult> {
  const script = path.resolve("scripts/transcribe.py");
  return new Promise((resolve) => {
    execFile(
      "python3",
      [script, file],
      { timeout: 240000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (!err) {
          resolve({ text: stdout.trim() });
          return;
        }
        if ((stderr || "").includes("FASTER_WHISPER_MISSING")) {
          resolve({ missing: true });
          return;
        }
        resolve({ error: (stderr || err.message || "").split("\n").slice(-3).join(" ").slice(0, 300) });
      },
    );
  });
}
