import * as THREE from 'three';
import { setupOverlay, updateOverlay, smooth, clamp } from '/engine/overlay.js';

// ---------- timeline (seconds) — keep in sync with audio.py ----------
const T = {
  dur: 88, sunOut: 22, moonOut: 24, cityOn: [33.5, 37], plantsDie: [40.6, 50], snow: 44,
  gridFail: [47.5, 56], freeze: [53, 61], frost: [55, 66], airFreeze: 67, dive: [72.6, 76.2],
  under: 76.2, black: [79.6, 81], end: 81.4,
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
  uSun: { value: 1 }, uSunCol: { value: C(0xfff0d0) }, uMW: { value: 0 }, uMWn: { value: new THREE.Vector3() },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 uTop,uHor,uSunDir,uSunCol,uMWn; uniform float uSun,uMW; varying vec3 vD;
    float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
    void main(){ vec3 d=normalize(vD); float h=clamp(d.y,0.,1.);
      vec3 c=mix(uHor,uTop,pow(h,0.55));
      float s=dot(d,normalize(uSunDir));
      float disk=smoothstep(0.99962,0.99972,s);
      float glow=pow(max(s,0.),900.)*1.1+pow(max(s,0.),60.)*0.35+pow(max(s,0.),6.)*0.12;
      c+=uSunCol*(disk*4.+glow)*uSun;
      float b=dot(d,uMWn); float band=exp(-b*b/0.012)*(0.55+0.45*hash(floor(d*90.)))+exp(-b*b/0.0015)*0.6;
      c+=vec3(0.55,0.6,0.8)*band*uMW*0.16*smoothstep(-0.05,0.25,d.y);
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

// milky way: a dense band of faint stars across the sky
const mwC = dirFrom(-4, 34), mwN = mwC.clone().cross(new THREE.Vector3(0.45, 1, 0)).normalize();
skyU.uMWn.value.copy(mwN);
{
  const a = mwC.clone(), b = mwN.clone().cross(a).normalize(), cnt = 9000, p = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
  for (let i = 0; i < cnt; i++) {
    const th = rnd() * Math.PI * 2;
    const v = a.clone().multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th)).addScaledVector(mwN, gauss() * 0.11).normalize().multiplyScalar(1790);
    p.set([v.x, v.y, v.z], i * 3); const w = 0.6 + rnd() * 0.4; col.set([w * (0.85 + rnd() * 0.15), w * 0.9, w], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
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
    if (lake < 1.25) y = lerp(lerp(-34, -1.2, smooth(0.2, 0.9, lake)), y, smooth(0.85, 1.25, lake));
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
const lakeM = new THREE.MeshStandardMaterial({ color: 0x3f7593, roughness: 0.12, metalness: 0.2, flatShading: true, side: THREE.DoubleSide });
const lakeGeo = new THREE.RingGeometry(0.001, 1, 72, 14).rotateX(-Math.PI / 2);
const lakeBase = lakeGeo.attributes.position.array.slice();
const lake = new THREE.Mesh(lakeGeo, lakeM);
lake.scale.set(72, 1, 38); lake.position.set(0, -0.15, -44); scene.add(lake);
// ice cracks: random-walk lines that spread across the frozen lake
const crackPts = [];
for (let k = 0; k < 18; k++) {
  let x = (rnd() - 0.5) * 70, z = -44 + (rnd() - 0.5) * 34, a = rnd() * 6.28;
  for (let j = 0; j < 14; j++) {
    const nx = x + Math.cos(a) * 3.2, nz = z + Math.sin(a) * 3.2; a += (rnd() - 0.5) * 1.1;
    if (Math.hypot(nx / 70, (nz + 44) / 36) > 0.97) break;
    crackPts.push(x, 0.02, z, nx, 0.02, nz); x = nx; z = nz;
  }
}
const crackG = new THREE.BufferGeometry(); crackG.setAttribute('position', new THREE.Float32BufferAttribute(crackPts, 3));
const crackM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
const cracks = new THREE.LineSegments(crackG, crackM); cracks.position.y = -0.15; scene.add(cracks);
const crackN = crackPts.length / 3;

// under the ice: warm hydrothermal vents and rising bubbles
const ventTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(0.3, 'rgba(255,120,40,.5)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const vents = [[-5, -32, -49], [3, -32.5, -53], [8, -31.5, -47]].map(([x, y, z]) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ventTex, color: 0xff8a40, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.set(11, 11, 1); s.position.set(x, y, z); scene.add(s);
  const pl = new THREE.PointLight(0xff8a3a, 0, 40, 1.5); pl.position.set(x, y + 1, z); scene.add(pl); s.userData.pl = pl; return s;
});
// rocky lake bed around the vents
{
  const bedM = new THREE.MeshLambertMaterial({ color: 0x3a3430, flatShading: true });
  for (let i = 0; i < 70; i++) {
    const x = (rnd() - 0.5) * 34, z = -50 + (rnd() - 0.5) * 24, s = 0.8 + rnd() * 2.6;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), bedM);
    r.scale.set(s, s * (0.5 + rnd() * 0.8), s); r.position.set(x, -33.5 + s * 0.2, z); r.rotation.set(rnd() * 3, rnd() * 3, 0); scene.add(r);
  }
  for (const [x, z] of [[-5, -49], [3, -53], [8, -47]]) {  // chimneys
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 7), bedM); c.position.set(x, -33, z); scene.add(c);
  }
}
const BN = 900, bubBase = new Float32Array(BN * 4);
for (let i = 0; i < BN; i++) { const v = vents[i % 3].position; bubBase.set([v.x + (rnd() - 0.5) * 3, v.z + (rnd() - 0.5) * 3, rnd() * 30, 1.5 + rnd() * 2.5], i * 4); }
const bubPos = new Float32Array(BN * 3), bubG = new THREE.BufferGeometry(); bubG.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));

// plaza + railing in the foreground (the signature "you are standing here" frame)
const TER = 3.5; // terrace height
const plazaM = new THREE.MeshLambertMaterial({ color: 0x9a968f });
const plaza = new THREE.Mesh(new THREE.BoxGeometry(14, TER, 8), plazaM);
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
let dockM;
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.25, 'rgba(255,190,110,.45)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
// wooden dock reaching into the lake
const DOCK = { x: 5.4, w: 3.4, z0: -4, z1: -36, y: 0.6 };
{
  const woodM = new THREE.MeshLambertMaterial({ color: 0x7a5a3c, flatShading: true });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(DOCK.w, 0.25, DOCK.z0 - DOCK.z1), woodM);
  deck.position.set(DOCK.x, DOCK.y, (DOCK.z0 + DOCK.z1) / 2); scene.add(deck);
  for (let z = DOCK.z0 - 2; z > DOCK.z1; z -= 4) for (const dx of [-1.5, 1.5]) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), woodM); pile.position.set(DOCK.x + dx, -0.8, z); scene.add(pile);
  }
  dockM = woodM;
}
for (const [x, z] of [[DOCK.x - 1.55, -12], [DOCK.x + 1.55, -20], [DOCK.x - 1.55, -28], [DOCK.x + 1.55, -35]]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), metalM); post.position.set(x, DOCK.y + 1.6, z); scene.add(post);
  const bulbM = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), bulbM); bulb.position.set(x, DOCK.y + 3.3, z); scene.add(bulb);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.scale.set(3.6, 3.6, 1); sp.position.copy(bulb.position); scene.add(sp);
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

// people strolling on the lakeside path: they stop, look up, then run
const people = [];
const skin = [0xe0b48a, 0xa8754f, 0x6b4630, 0xf0caa0];
const shirts = [0xd9534f, 0x3f7fbf, 0xf0ad4e, 0x5cb85c, 0xe8e8e8, 0x8e5bb5, 0x2f2f2f];
for (let i = 0; i < 9; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.85, 7), new THREE.MeshLambertMaterial({ color: shirts[i % shirts.length], flatShading: true })); body.position.y = 1.05;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.65, 6), new THREE.MeshLambertMaterial({ color: 0x2c3440 })); legs.position.y = 0.33;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), new THREE.MeshLambertMaterial({ color: skin[i % 4], flatShading: true })); head.position.y = 1.62;
  g.add(body, legs, head); g.scale.setScalar(1.15); scene.add(g);
  people.push({ g, head, x: DOCK.x + (rnd() - 0.5) * 2.2, z0: -9 - rnd() * 24, v: (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), k: rnd() });
}
// birds: a loose flock crossing the afternoon sky
const birdM = new THREE.MeshBasicMaterial({ color: 0x2a2f38, side: THREE.DoubleSide, fog: false });
const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, 0, 0, 0.25, 1.1, 0, 0], 3));
const birds = [];
for (let i = 0; i < 11; i++) {
  const b = new THREE.Group(), l = new THREE.Mesh(wingGeo, birdM), r = new THREE.Mesh(wingGeo, birdM); r.scale.x = -1; b.add(l, r); b.scale.setScalar(0.9);
  scene.add(b); birds.push({ b, l, r, ox: (rnd() - 0.5) * 22, oy: (rnd() - 0.5) * 7, oz: (rnd() - 0.5) * 14, k: rnd() * 6 });
}
// far-shore road with cars whose lights stay on after dark, until the cars stop
const road = new THREE.Mesh(new THREE.PlaneGeometry(900, 9).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x45484d }));
road.position.set(0, 0.6, -104); scene.add(road);
const carCols = [0xd9534f, 0xf2f2f2, 0x3f7fbf, 0x2f2f2f, 0xf0c419, 0x7a8a99];
const headTex = glowTex, cars = [];
for (let i = 0; i < 16; i++) {
  const dir = i % 2 ? 1 : -1, g = new THREE.Group();
  const bodyC = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 1.9), new THREE.MeshLambertMaterial({ color: carCols[i % 6], flatShading: true })); bodyC.position.y = 0.9;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.7), new THREE.MeshLambertMaterial({ color: 0x2a3340 })); cab.position.set(-0.2, 1.95, 0);
  g.add(bodyC, cab);
  const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, color: 0xfff4dd, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const tl = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  hl.scale.set(4, 4, 1); tl.scale.set(2.4, 2.4, 1); hl.position.set(2.2, 1, 0); tl.position.set(-2.2, 1, 0); g.add(hl, tl);
  if (dir < 0) g.rotation.y = Math.PI;
  g.position.set(0, 0.6, -104 + dir * 2.2); scene.add(g);
  cars.push({ g, hl, tl, x0: rnd() * 900, v: 9 + rnd() * 6, dir, stop: 52 + rnd() * 8 });
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
const bubM = new THREE.PointsMaterial({ map: glowDot(), alphaTest: 0.01, color: 0xcfefff, size: 0.35, transparent: true, opacity: 0, depthWrite: false });
scene.add(new THREE.Points(bubG, bubM));

// ---------- camera choreography ----------
// [t, x, y, z, pitchDeg, yawDeg, ease]  ease: s = smooth, i = ease-in, o = ease-out
const CAM = [
  [0, 0, 5.2, 0.6, -3, 0, 's'], [4, 0, 5.2, 0.25, -3, 0, 's'], [21.8, 0, 5.2, -0.5, 1.5, -1.5, 's'],
  [23.2, 0, 5.2, -0.55, 2, -1.5, 's'], [29, 0, 5.2, -0.6, 21, 4, 's'], [31.4, 0, 5.2, -0.6, 21, 4, 's'],
  [36.4, 0, 5.2, -0.8, -3, 0, 's'], [47, 1.9, 5.2, -1.0, -4, -3, 's'], [53, 1.9, 5.3, -1.2, -5, -3, 's'],
  [61, 0, 8.6, -1.0, -12, 0, 's'], [66, 0, 8.6, -1.0, 15, 2, 's'], [71, 0, 6.6, -1.2, -5, 0, 's'],
  [72.6, 0, 6.6, -1.4, -7, 0, 's'], [76.2, 0, -0.6, -33, -38, 0, 'i'], [81, 0, -9, -27, -40, 0, 'o'],
];
const easeF = { s: x => x * x * (3 - 2 * x), i: x => x * x * x, o: x => 1 - (1 - x) ** 3 };
function camAt(t) {
  if (t <= CAM[0][0]) return CAM[0].slice(1, 6);
  for (let i = 0; i < CAM.length - 1; i++) {
    const a = CAM[i], b = CAM[i + 1];
    if (t < b[0]) { const x = easeF[b[6]]((t - a[0]) / (b[0] - a[0])); return a.slice(1, 6).map((v, j) => lerp(v, b[j + 1], x)); }
  }
  return CAM.at(-1).slice(1, 6);
}
const n3 = (t, f) => Math.sin(t * f) * 0.5 + Math.sin(t * f * 2.31 + 1.7) * 0.3 + Math.sin(t * f * 4.7 + 0.3) * 0.2;
const hit = (t, at, amp, decay) => (t > at ? amp * Math.exp(-(t - at) * decay) : 0);
const CRACKS = [55.4, 58.1, 62.7, 69.3];

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
    if (t >= T.under) return { label: 'Under the ice', value: '35°F', sub: 'Still liquid. 1 million years later', o: Math.min(1, (t - T.under) / 0.4) * (1 - smooth(79.4, 80, t)) };
    const [f, s] = interpK(t);
    return { label: 'Temperature', value: `${Math.round(f)}°F`, sub: `${fmtSince(s)} without the Sun`, o: o * (1 - smooth(T.under - 0.5, T.under, t)) };
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
    [72.8, 76.1, 'But deep under the ice…'],
    [76.5, 79.6, 'the ocean is still liquid.'],
  ],
  black: T.black,
  end: { s: T.end, title: 'What if the Sun disappeared?', sub: 'Sunlight is 8 minutes and 20 seconds old when it reaches you' },
  tint: t => {
    const under = t >= T.under, f = under ? 0 : smooth(...T.frost, t) * 0.55 + smooth(T.airFreeze, 75, t) * 0.25;
    const layers = [`radial-gradient(ellipse at center, rgba(200,225,255,0) 52%, rgba(200,225,255,${f}) 120%)`];
    const fl = t > T.under - 0.08 ? 0.85 * Math.exp(-(t - T.under + 0.08) * 5) : 0;
    if (fl > 0.01) layers.unshift(`linear-gradient(rgba(235,250,255,${fl}),rgba(235,250,255,${fl}))`);
    if (under) layers.push(`radial-gradient(ellipse at center, rgba(0,40,50,0) 40%, rgba(0,20,30,.75) 115%)`);
    const a = t > T.sunOut ? 0.55 * Math.exp(-(t - T.sunOut) / 1.1) : 0; // retina afterimage of the Sun
    if (a > 0.005) layers.unshift(`radial-gradient(circle at ${sunScr.x}px ${sunScr.y}px, rgba(150,255,210,${a}) 0, rgba(230,90,255,${a * 0.45}) 55px, rgba(0,0,0,0) 150px)`);
    return layers.join(',');
  },
};
const ov = setupOverlay();
const sunScr = { x: 0, y: 0 };

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
  starMats[0].opacity = starA; starMats[1].opacity = starA; starMats[2].opacity = starA * 0.9;
  skyU.uMW.value = starA;
  moonU.uDay.value = 1 - out;
  moonU.uLit.value = 1 - smooth(T.moonOut, T.moonOut + 0.6, t);

  // world
  groundM.color.copy(mixC(GRASS, DEAD, plants).lerp(FROST, frost));
  leafMs.forEach((m, i) => m.color.copy(mixC(leafBase[i], DEAD.clone().offsetHSL(0, 0, -0.05 + i * 0.03), plants).lerp(C(0xdce6ef), frost * 0.9)));
  bushMs.forEach(m => m.color.copy(mixC(C(0x4a7f2c), DEAD, plants).lerp(C(0xd5e0ea), frost)));
  trunkM.color.copy(mixC(C(0x5b4330), C(0x8a96a3), frost * 0.6));
  lakeM.color.copy(mixC(LAKE, ICE, ice)); lakeM.roughness = lerp(0.12, 0.55, ice); lakeM.metalness = lerp(0.2, 0.05, ice);
  metalM.color.copy(mixC(C(0x3a3d42), C(0xdfe9f2), frost)); metalM.metalness = lerp(0.6, 0.1, frost);
  plazaM.color.copy(mixC(C(0x9a968f), C(0xd7e0e8), frost));
  const lp = lakeGeo.attributes.position, wave = (1 - ice) * 0.003;
  for (let i = 0; i < lp.count; i++) {
    const x = lakeBase[i * 3], z = lakeBase[i * 3 + 2];
    lp.array[i * 3 + 1] = (Math.sin(x * 23 + t * 1.3) + Math.sin(z * 31 - t * 1.1) + Math.sin((x + z) * 17 + t * 0.7)) * wave;
  }
  lp.needsUpdate = true;
  crackM.opacity = smooth(54.5, 56, t) * 0.75;
  crackG.setDrawRange(0, Math.floor(crackN * smooth(54.5, 64, t) / 2) * 2);

  // dock strollers: walk back and forth, freeze and look up at the cut, then run for shore
  const pingpong = (z0, v, tt) => { const span = 26, u = (((z0 + 33 + v * tt) % (2 * span)) + 2 * span) % (2 * span); return -33 + (u < span ? u : 2 * span - u); };
  for (const p of people) {
    const stopT = T.sunOut + 0.6, runT = T.sunOut + 3 + p.k * 1.8;
    let z = pingpong(p.z0, p.v, Math.min(t, stopT));
    if (t > runT) z += (t - runT) * (t - runT) * 1.6 + (t - runT) * 3;
    const walking = t < stopT || t > runT;
    p.g.position.set(p.x, DOCK.y + 0.12 + Math.abs(Math.sin(t * (t > runT ? 11 : 7) + p.k * 9)) * 0.06 * walking, z);
    p.g.rotation.x = t > runT ? -0.25 : 0;
    p.head.rotation.x = -0.5 * smooth(T.sunOut + 0.8, T.sunOut + 1.6, t) * (1 - smooth(runT, runT + 0.4, t));
    p.g.visible = z < DOCK.z0 + 1;
  }
  if (dockM) dockM.color.copy(mixC(C(0x7a5a3c), C(0xd0dae4), frost));
  for (const b of birds) {
    b.b.position.set(-70 + t * 6.5 + b.ox, 34 + b.oy + Math.sin(t * 0.8 + b.k) * 0.8, -70 + b.oz);
    const flap = Math.sin(t * 9 + b.k) * 0.55; b.l.rotation.x = 0; b.l.rotation.z = flap; b.r.rotation.z = -flap;
    b.b.visible = t < T.sunOut;
  }
  for (const c of cars) {
    const tt = Math.min(t, c.stop) - Math.max(0, Math.min(t, c.stop) - (c.stop - 2)) ** 2 / 4;
    c.g.position.x = (((c.x0 + c.dir * c.v * tt) % 900) + 900) % 900 - 450;
    const lights = smooth(T.sunOut + 0.5, T.sunOut + 2, t) * (1 - smooth(c.stop + 2, c.stop + 4, t));
    c.hl.material.opacity = lights * 0.95; c.tl.material.opacity = lights * 0.8;
  }

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

  // under the ice: dense teal water, glowing vents, bubbles
  const under = t >= T.under;
  if (under) {
    scene.fog.color.set(0x042631); scene.fog.near = 2; scene.fog.far = 40;
    hemi.color.set(0x3f8fa0); hemi.groundColor.set(0x08161c); hemi.intensity = 0.6;
    lakeM.color.set(0x9fd6e4);
    snowM.opacity = 0;
  }
  const ventA = under ? smooth(T.under, T.under + 1.5, t) * (0.85 + 0.15 * Math.sin(t * 3)) : 0;
  vents.forEach(v => { v.material.opacity = ventA; v.userData.pl.intensity = ventA * 60; });
  bubM.opacity = under ? 0.8 : 0;
  for (let i = 0; i < BN; i++) {
    const b = i * 4; const y = ((bubBase[b + 2] + t * bubBase[b + 3]) % 30);
    bubPos[i * 3] = bubBase[b] + Math.sin(t * 2 + i) * 0.3; bubPos[i * 3 + 1] = -30 + y; bubPos[i * 3 + 2] = bubBase[b + 1];
  }
  bubG.attributes.position.needsUpdate = true;

  // camera: keyframed moves + impact shakes (sun cut, ice cracks, plunge)
  const [cx, cy, cz, cp, cyaw] = camAt(t);
  let sh = hit(t, T.sunOut + 0.25, 0.9, 2.2) + hit(t, T.under, 1.4, 2.5);
  for (const c of CRACKS) sh += hit(t, c, 0.25, 4);
  const hx = Math.sin(t * 0.31) * 0.03 + n3(t, 23) * sh * 0.05, hy = Math.sin(t * 0.47) * 0.015 + n3(t + 5, 27) * sh * 0.05;
  camera.position.set(cx + hx, cy + hy, cz);
  const pitch = THREE.MathUtils.degToRad(cp + Math.sin(t * 0.23) * 0.25 + n3(t + 9, 19) * sh * 1.2);
  const yaw = THREE.MathUtils.degToRad(cyaw + Math.sin(t * 0.19) * 0.35 + n3(t + 2, 17) * sh * 1.2);
  camera.rotation.set(pitch, yaw, Math.sin(t * 0.27) * 0.002 + n3(t + 4, 21) * sh * 0.035, 'YXZ');
  sky.position.copy(camera.position);
  camera.updateMatrixWorld();
  const sp = sunDir.clone().multiplyScalar(1000).add(camera.position).project(camera);
  sunScr.x = (sp.x * 0.5 + 0.5) * W; sunScr.y = (-sp.y * 0.5 + 0.5) * H;

  renderer.render(scene, camera);
  updateOverlay(ov, spec, t);
};

await document.fonts.ready;
await Promise.all(['400 70px Fraunces', 'italic 400 50px "EB Garamond"', '600 28px Inter', '500 24px Inter'].map(f => document.fonts.load(f)));
window.renderAt(0);
window.__ready = true;
