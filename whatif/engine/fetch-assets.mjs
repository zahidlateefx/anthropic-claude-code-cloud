// Downloads the CC0 Kenney asset packs used by the episodes into assets/kenney (not committed: ~90 MB).
// Usage: node engine/fetch-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'kenney');
const packs = ['city-kit-commercial', 'city-kit-suburban', 'car-kit', 'blocky-characters', 'nature-kit', 'city-kit-roads'];
fs.mkdirSync(dir, { recursive: true });
for (const p of packs) {
  if (fs.existsSync(path.join(dir, p))) { console.log('have', p); continue; }
  const html = await (await fetch(`https://kenney.nl/assets/${p}`)).text();
  const url = html.match(/id='donate-text' href='([^']+\.zip)'/)?.[1];
  if (!url) throw new Error('no download link for ' + p);
  const zip = path.join(dir, p + '.zip');
  fs.writeFileSync(zip, Buffer.from(await (await fetch(url)).arrayBuffer()));
  fs.mkdirSync(path.join(dir, p), { recursive: true });
  execFileSync(process.platform === 'win32' ? 'tar' : 'unzip', process.platform === 'win32' ? ['-xf', zip, '-C', path.join(dir, p)] : ['-q', '-o', zip, '-d', path.join(dir, p)], { stdio: 'inherit' });
  fs.rmSync(zip); console.log('got', p);
}
