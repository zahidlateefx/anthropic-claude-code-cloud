// One command for a whole episode: audio -> frames -> final mp4.
// Usage: node engine/make.mjs episodes/01-sun-disappeared [--gpu] [--workers 2]
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [ep, ...rest] = process.argv.slice(2);
const run = (cmd, a) => execFileSync(cmd, a, { stdio: 'inherit' });
const py = process.platform === 'win32' ? 'python' : 'python3';
run(py, [path.join(ep, 'audio.py')]);
run(process.execPath, ['engine/render.mjs', ep, ...rest]);
run(process.execPath, ['engine/mux.mjs', path.basename(ep)]);
