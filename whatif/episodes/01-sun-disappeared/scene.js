import * as THREE from 'three';
import { setupOverlay, updateOverlay, smooth, clamp } from '/engine/overlay.js';

// ---------- timeline (seconds) — keep in sync with audio.py ----------
const T = {
  dur: 86, sunOut: 22, moonOut: 24, cityOn: [33.5, 37], plantsDie: [40.6, 50], snow: 44,
  gridFail: [47.5, 56], freeze: [53, 61], frost: [55, 66], airFreeze: 67, tilt: [72.6, 79],
  black: [78.4, 80], end: 80.4,
};
window.DURATION = T.dur;

// ---------- deterministic randomness ----------
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const lerp = (a, b, x) => a + (b - a) * x;
const C = h => new THREE.Color(h);
const mixC = (a, b, x) => a.clone().lerp(b, clamp(x));

// ---------- renderer / camera ----------
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('stage'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbcd3e8, 90, 900);
const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 5000);

// sun & moon directions (in front of the viewer)
const dirFrom = (azDeg, elDeg) => { const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elDeg); return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); };
const sunDir = dirFrom(7, 14);
const moonDir = dirFrom(-12, 10);

// ---------- sky ----------
const skyU = {
  uTop: { value: C(0x3d7fd8) }, uHor: { value: C(0xc4dcf0) }, uSunDir: { value: sunDir },
  uSun: { value: 1 }, uSunCol: { value: C(0xfff0d0) },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 uTop,uHor,uSunDir,uSunCol; uniform float uSun; varying vec3 vD;
    void main(){ vec3 d=normalize(vD); float h=clamp(d.y,0.,1.);
      vec3 c=mix(uHor,uTop,pow(h,0.55));
      float s=dot(d,normalize(uSunDir));
      float disk=smoothstep(0.99962,0.99972,s);
      float glow=pow(max(s,0.),900.)*1.1+pow(max(s,0.),60.)*0.35+pow(max(s,0.),6.)*0.12;
      c+=uSunCol*(disk*4.+glow)*uSun;
      if(d.y<0.) c=uHor*0.85;
      gl_FragColor=vec4(c,1.); }`,
}));
sky.renderOrder = -2; scene.add(sky);

// stars: two layers of points on a far sphere
const starMats = [];
for (const [count, size] of [[4200, 1.6], [500, 3.2]]) {
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    const y = Math.abs(u) * 0.95 + 0.02; // upper hemisphere bias
    p.set([r * Math.cos(th) * 1800, y * 1800, r * Math.sin(th) * 1800], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false });
  starMats.push(m); const pts = new THREE.Points(g, m); pts.renderOrder = -1; scene.add(pts);
}

// moon: lit by a fixed light from the sun's side so it shows a phase
const moonU = { uLit: { value: 1 }, uL: { value: sunDir.clone().multiplyScalar(1400).sub(moonDir.clone().multiplyScalar(900)).normalize() }, uDay: { value: 1 } };
const moon = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 16), new THREE.ShaderMaterial({
  fog: false, transparent: true, uniforms: moonU,
  vertexShader: `varying vec3 vN; void main(){ vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 uL; uniform float uLit,uDay; varying vec3 vN;
    void main(){ float l=smoothstep(-0.05,0.25,dot(normalize(vN),uL));
      vec3 c=vec3(0.93,0.93,0.9)*l*uLit;
      float a=mix(max(l*uLit,0.04),1.,1.-uDay)*mix(0.75,1.,1.-uDay);
      gl_FragColor=vec4(c+0.012,a); }`,
}));
moon.position.copy(moonDir).multiplyScalar(900); scene.add(moon);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x5a4a30, 1.3); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xfff1d6, 2.4); sunL.position.copy(sunDir).multiplyScalar(100); scene.add(sunL);
const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-0.4, 0.6, 1); scene.add(fill);

// ---------- ground with gentle hills ----------
const gGeo = new THREE.PlaneGeometry(2400, 2400, 160, 160); gGeo.rotateX(-Math.PI / 2);
const gCol = [];
{
  const p = gGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
    let y = (Math.sin(x * 0.021) * Math.cos(z * 0.017) * 3 + Math.sin(x * 0.006 + 1) * 6) * smooth(30, 160, d);
    const lake = Math.hypot(x / 70, (z + 44) / 38); // lake basin
    if (lake < 1.25) y = lerp(-1.2, y, smooth(0.85, 1.25, lake));
    y += (rnd() - 0.5) * 0.6 * smooth(10, 40, d);
    p.setY(i, y);
    const v = 0.82 + rnd() * 0.22 + Math.sin(x * 0.05) * Math.cos(z * 0.07) * 0.06; gCol.push(v, v, v);
  }
  gGeo.setAttribute('color', new THREE.Float32BufferAttribute(gCol, 3));
  gGeo.computeVertexNormals();
}
const groundM = new THREE.MeshLambertMaterial({ color: 0x5f8f3a, flatShading: true, vertexColors: true });
scene.add(new THREE.Mesh(gGeo, groundM));

// lake (freezes later)
const lakeM = new THREE.MeshStandardMaterial({ color: 0x3f7593, roughness: 0.12, metalness: 0.2, flatShading: true });
const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), lakeM);
lake.scale.set(72, 1, 38); lake.position.set(0, -0.15, -44); scene.add(lake);
// faint warm glow under the ice for the final beat
const deepM = new THREE.MeshBasicMaterial({ color: 0x3a7fa0, transparent: true, opacity: 0, depthWrite: false, fog: false });
const deep = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), deepM);
deep.scale.set(55, 1, 26); deep.position.set(0, -0.05, -44); scene.add(deep);

// plaza + railing in the foreground (the signature "you are standing here" frame)
const TER = 3.5; // terrace height
const plaza = new THREE.Mesh(new THREE.BoxGeometry(14, TER, 8), new THREE.MeshLambertMaterial({ color: 0x9a968f }));
plaza.position.set(0, TER / 2, 0.5); scene.add(plaza);
{
  const tileM = new THREE.LineBasicMaterial({ color: 0x6f6b66 });
  const pts = [];
  for (let x = -7; x <= 7; x += 1.2) pts.push(x, TER + 0.01, -3.5, x, TER + 0.01, 4.5);
  for (let z = -3.5; z <= 4.5; z += 1.2) pts.push(-7, TER + 0.01, z, 7, TER + 0.01, z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(g, tileM));
}
const metalM = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.6 });
const rail = new THREE.Group();
const bar = (len, x, y, z, vertical) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 10), metalM); if (!vertical) m.rotation.z = Math.PI / 2; m.position.set(x, y, z); rail.add(m); };
bar(14, 0, TER + 1.08, -3.3);
for (const x of [-2.3, -0.62, 1.05, 2.7]) bar(1.08, x, TER + 0.54, -3.3, true);
scene.add(rail);

// lamp posts along the lakeside path
const lampBulbs = [];
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.25, 'rgba(255,190,110,.45)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
for (const [x, z] of [[-22, -26], [-9, -30], [9, -30], [22, -26], [-36, -20], [36, -20]]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 8), metalM); post.position.set(x, 2.1, z); scene.add(post);
  const bulbM = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), bulbM); bulb.position.set(x, 4.35, z); scene.add(bulb);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.scale.set(5, 5, 1); sp.position.copy(bulb.position); scene.add(sp);
  lampBulbs.push({ bulbM, sp, k: rnd() });
}

const glowDot = () => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); };

// scatter: bushes and rocks on the field below the terrace
const rockM = new THREE.MeshLambertMaterial({ color: 0x8a8378, flatShading: true });
const bushMs = [];
for (let i = 0; i < 260; i++) {
  const x = (rnd() - 0.5) * 220, z = -6 - rnd() * 140;
  if (Math.hypot(x / 76, (z + 44) / 41) < 1) continue;
  const rock = rnd() < 0.35, s = rock ? 0.4 + rnd() * 0.9 : 0.6 + rnd() * 1.2;
  const m = rock ? rockM : new THREE.MeshLambertMaterial({ color: 0x4a7f2c, flatShading: true });
  if (!rock) bushMs.push(m);
  const o = new THREE.Mesh(rock ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0), m);
  o.scale.set(s * (0.8 + rnd() * 0.6), s * (rock ? 0.6 : 0.8), s); o.position.set(x, s * 0.3, z); o.rotation.y = rnd() * 6; scene.add(o);
}

// trees
const leafBase = [C(0x4f8a32), C(0x5d9a3a), C(0x447a2c)];
const leafMs = leafBase.map(c => new THREE.MeshLambertMaterial({ color: c.clone(), flatShading: true }));
const trunkM = new THREE.MeshLambertMaterial({ color: 0x5b4330, flatShading: true });
const leafGeos = [new THREE.IcosahedronGeometry(1, 0), new THREE.ConeGeometry(1, 2.4, 7), new THREE.DodecahedronGeometry(1, 0)];
for (let i = 0; i < 140; i++) {
  const x = (rnd() - 0.5) * 360, z = -8 - rnd() * 230;
  if (Math.hypot(x / 82, (z + 44) / 46) < 1) continue;   // not in the lake
  if (Math.abs(x) < 30 && z > -20) continue;              // keep the view open
  const s = 2.2 + rnd() * 2.8, kind = Math.floor(rnd() * 3);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s * 0.5, 0.25 * s * 0.5, s * 1.1, 6), trunkM);
  tr.position.set(x, s * 0.55, z); scene.add(tr);
  const lf = new THREE.Mesh(leafGeos[kind], leafMs[i % 3]);
  lf.scale.setScalar(s * (kind === 1 ? 0.9 : 1.05)); lf.position.set(x, s * 1.1 + s * 0.6, z); lf.rotation.y = rnd() * 6;
  scene.add(lf);
}

// city skyline with window lights that switch on, then fail one by one
const winTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) if (rnd() > 0.55) { g.fillStyle = `rgba(255,${200 + rnd() * 40 | 0},${120 + rnd() * 60 | 0},${0.6 + rnd() * 0.4})`; g.fillRect(x, y, 4, 5); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const buildings = [];
for (let i = 0; i < 95; i++) {
  const w = 12 + rnd() * 26, d = 12 + rnd() * 20;
  const x = (rnd() - 0.5) * 900, z = -500 - rnd() * 160;
  const h = (12 + rnd() * 34) * (1 + 1.0 * Math.exp(-(((x - 40) / 170) ** 2))) * (rnd() < 0.08 ? 1.6 : 1);
  const tex = winTex.clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, w / 14 | 0), Math.max(1, h / 22 | 0)); tex.offset.set(rnd(), rnd());
  const shade = 0.75 + rnd() * 0.3;
  const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x7d8a99).multiplyScalar(shade), emissive: 0xffd08a, emissiveMap: tex, emissiveIntensity: 0, flatShading: true });
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, h / 2 - 1, z); scene.add(b);
  buildings.push({ m, k: rnd() });
}

// snow / freezing-air particles around the viewer
const SN = 7000, snowBase = new Float32Array(SN * 4);
for (let i = 0; i < SN; i++) snowBase.set([(rnd() - 0.5) * 90, rnd() * 45, -rnd() * 110 + 6, 0.6 + rnd() * 0.8], i * 4);
const snowPos = new Float32Array(SN * 3);
const snowG = new THREE.BufferGeometry(); snowG.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowM = new THREE.PointsMaterial({ map: glowDot(), alphaTest: 0.01, color: 0xe8f0ff, size: 0.07, transparent: true, opacity: 0, depthWrite: false });
scene.add(new THREE.Points(snowG, snowM));

// ---------- text ----------
const fmtCount = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const TK = [ // [t, °F, seconds since]
  [24, 68, 60], [30, 66, 3600], [36, 45, 86400], [44, 0, 7 * 86400], [52, -60, 60 * 86400],
  [60, -100, 365 * 86400], [68, -240, 1e3 * 365 * 86400], [76, -400, 1e6 * 365 * 86400],
];
const interpK = t => {
  if (t <= TK[0][0]) return [TK[0][1], TK[0][2]];
  for (let i = 0; i < TK.length - 1; i++) if (t < TK[i + 1][0]) {
    const x = (t - TK[i][0]) / (TK[i + 1][0] - TK[i][0]);
    return [lerp(TK[i][1], TK[i + 1][1], x), Math.exp(lerp(Math.log(TK[i][2]), Math.log(TK[i + 1][2]), x))];
  }
  return [TK.at(-1)[1], TK.at(-1)[2]];
};
const plural = (n, u) => `${n.toLocaleString('en-US')} ${u}${n === 1 ? '' : 'S'}`;
const fmtSince = s => {
  const d = s / 86400, y = d / 365;
  if (s < 3600) return plural(Math.max(1, Math.round(s / 60)), 'MINUTE');
  if (s < 86400 * 2) return plural(Math.round(s / 3600), 'HOUR');
  if (d < 60) return plural(Math.round(d), 'DAY');
  if (y < 2) return plural(Math.round(d / 30.4), 'MONTH');
  if (y < 1e6 - 1) return plural(Math.round(y), 'YEAR');
  return '1 MILLION YEARS';
};
const spec = {
  title: { text: 'What if the Sun disappeared?', s: -1, e: 4.2 },
  hud: t => {
    const o = Math.min(1, Math.abs(t - 23.6) / 0.35);
    if (t < 23.6) {
      const left = t < 4.5 ? 500 : Math.max(0, 500 * (1 - (t - 4.5) / (T.sunOut - 4.5)));
      return { label: 'Last sunlight arrives in', value: fmtCount(left), sub: t < T.sunOut ? 'The Sun is already gone' : 'Now', o };
    }
    const [f, s] = interpK(t);
    return { label: 'Temperature', value: `${Math.round(f)}°F`, sub: `${fmtSince(s)} without the Sun`, o: o * (1 - smooth(78.2, 78.8, t)) };
  },
  captions: [
    [4.6, 9.0, 'A normal afternoon.'],
    [9.0, 13.6, 'But the Sun is already gone.'],
    [13.6, 18.2, 'Its last light is still on the way.'],
    [18.2, 21.9, 'Eight minutes and twenty seconds.'],
    [22.4, 25.6, 'Then the sky goes black.'],
    [25.6, 30.0, 'Seconds later, the Moon goes dark.'],
    [30.0, 34.6, 'Earth drifts off in a straight line.'],
    [34.6, 40.6, 'Every light in the city comes on.'],
    [40.6, 47.0, 'Within a week, every plant is dying.'],
    [47.0, 53.0, 'One by one, the lights go out.'],
    [53.0, 60.0, 'The lakes freeze. Then the seas.'],
    [60.0, 67.0, 'The sky has never been this clear.'],
    [67.0, 72.6, 'Then the air itself starts to freeze.'],
    [72.6, 78.4, 'But deep under the ice, the ocean stays liquid.'],
  ],
  black: T.black,
  end: { s: T.end, title: 'What if the Sun disappeared?', sub: 'Sunlight is 8 minutes and 20 seconds old when it reaches you' },
  tint: t => { const f = smooth(...T.frost, t) * 0.55 + smooth(T.airFreeze, 76, t) * 0.25; return `radial-gradient(ellipse at center, rgba(200,225,255,0) 52%, rgba(200,225,255,${f}) 120%)`; },
};
const ov = setupOverlay();

// ---------- per-frame state ----------
const DAY = { top: C(0x3d7fd8), hor: C(0xc4dcf0), fog: C(0xbcd3e8) };
const NIGHT = { top: C(0x04060d), hor: C(0x111a2c), fog: C(0x141d2e) };
const GRASS = C(0x5f8f3a), DEAD = C(0x7a6a45), FROST = C(0xc9d6e2);
const LAKE = C(0x3f7593), ICE = C(0xb8cfdf);

window.renderAt = t => {
  const out = smooth(T.sunOut, T.sunOut + 0.35, t);            // sunlight cut (near instant)
  const plants = smooth(...T.plantsDie, t), frost = smooth(...T.frost, t), ice = smooth(...T.freeze, t);
  const air = smooth(T.airFreeze, 75, t);

  // sky & light
  skyU.uSun.value = 1 - out;
  skyU.uTop.value.copy(mixC(DAY.top, NIGHT.top, out));
  skyU.uHor.value.copy(mixC(DAY.hor, NIGHT.hor, out).lerp(C(0x1a2433), air * 0.6));
  scene.fog.color.copy(mixC(DAY.fog, NIGHT.fog, out).lerp(C(0x1c2635), air * 0.7));
  scene.fog.near = lerp(lerp(90, 200, out), 25, air); scene.fog.far = lerp(lerp(900, 1500, out), 260, air);
  sunL.intensity = 2.4 * (1 - out);
  hemi.intensity = lerp(1.3, 0.95, out);
  hemi.color.copy(mixC(C(0xcfe2ff), C(0x7088bb), out));
  hemi.groundColor.copy(mixC(C(0x5a4a30), C(0x262c3c), out));
  fill.intensity = lerp(0.5, 0.12, out);
  renderer.toneMappingExposure = lerp(1.0, 1.5, out);
  const starA = smooth(T.sunOut + 0.3, T.sunOut + 2.5, t) * lerp(0.75, 1, smooth(58, 66, t)) * (1 - air * 0.45);
  starMats[0].opacity = starA; starMats[1].opacity = starA;
  moonU.uDay.value = 1 - out;
  moonU.uLit.value = 1 - smooth(T.moonOut, T.moonOut + 0.6, t);

  // world
  groundM.color.copy(mixC(GRASS, DEAD, plants).lerp(FROST, frost));
  leafMs.forEach((m, i) => m.color.copy(mixC(leafBase[i], DEAD.clone().offsetHSL(0, 0, -0.05 + i * 0.03), plants).lerp(C(0xdce6ef), frost * 0.9)));
  bushMs.forEach(m => m.color.copy(mixC(C(0x4a7f2c), DEAD, plants).lerp(C(0xd5e0ea), frost)));
  trunkM.color.copy(mixC(C(0x5b4330), C(0x8a96a3), frost * 0.6));
  lakeM.color.copy(mixC(LAKE, ICE, ice)); lakeM.roughness = lerp(0.12, 0.55, ice); lakeM.metalness = lerp(0.2, 0.05, ice);
  deepM.opacity = smooth(73.5, 77.5, t) * 0.22;

  const cityOn = smooth(...T.cityOn, t);
  const gf = (t - T.gridFail[0]) / (T.gridFail[1] - T.gridFail[0]);
  for (const b of buildings) b.m.emissiveIntensity = 1.6 * cityOn * (1 - clamp((gf - b.k * 0.9) * 8)) * (0.85 + 0.15 * Math.sin(t * 0.7 + b.k * 40));
  for (const l of lampBulbs) {
    const on = smooth(32.5 + l.k, 33.2 + l.k, t) * (1 - clamp((gf - 0.25 - l.k * 0.3) * 8));
    l.sp.material.opacity = on * 0.9; l.bulbM.color.copy(mixC(C(0x2a2a2a), C(0xffe2b0), on));
  }

  // snow: starts as light flurries, becomes dense freezing air
  const snowA = smooth(T.snow, T.snow + 3, t) * lerp(0.55, 1, air);
  snowM.opacity = snowA; snowM.size = lerp(0.07, 0.1, air);
  const fall = lerp(2.2, 0.8, air);
  for (let i = 0; i < SN; i++) {
    const b = i * 4, sp = snowBase[b + 3];
    let y = (snowBase[b + 1] - t * fall * sp) % 45; if (y < 0) y += 45;
    snowPos[i * 3] = snowBase[b] + Math.sin(t * 0.6 * sp + i) * 0.8 + t * 0.3;
    snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = snowBase[b + 2];
  }
  snowG.attributes.position.needsUpdate = true;

  // camera: slow push-in, gentle handheld sway, final tilt down to the ice
  const tilt = smooth(...T.tilt, t);
  camera.position.set(Math.sin(t * 0.31) * 0.03, TER + 1.7 + Math.sin(t * 0.47) * 0.015, lerp(0, -1.4, clamp(t / 78)));
  const pitch = THREE.MathUtils.degToRad(lerp(-3, -12, tilt) + Math.sin(t * 0.23) * 0.25);
  const yaw = THREE.MathUtils.degToRad(Math.sin(t * 0.19) * 0.35);
  camera.rotation.set(pitch, yaw, Math.sin(t * 0.27) * 0.002, 'YXZ');
  sky.position.copy(camera.position);

  renderer.render(scene, camera);
  updateOverlay(ov, spec, t);
};

await document.fonts.ready;
await Promise.all(['400 70px Fraunces', 'italic 400 50px "EB Garamond"', '600 28px Inter', '500 24px Inter'].map(f => document.fonts.load(f)));
window.renderAt(0);
window.__ready = true;
