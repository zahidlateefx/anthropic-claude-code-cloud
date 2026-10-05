// Combine rendered video + procedural audio into the upload file (-14 LUFS, TikTok loudness).
// Usage: node engine/mux.mjs <episode-name>
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const d = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'out', process.argv[2]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(d, 'video.mp4'), '-i', path.join(d, 'audio.wav'),
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
  '-shortest', '-movflags', '+faststart', path.join(d, 'final.mp4')], { stdio: 'inherit' });
console.log('final ->', path.join(d, 'final.mp4'));
