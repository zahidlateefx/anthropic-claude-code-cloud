import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { setupOverlay, updateOverlay, smooth, clamp } from '/engine/overlay.js';
import { KENNEY, preload, instance, fit } from '/engine/assets.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- timeline (seconds) — keep in sync with audio.py ----------
const T = {
  dur: 88, sunOut: 22, moonOut: 24, cityOn: [34, 38], plantsDie: [40.6, 50], snow: 44,
  gridFail: [48, 56], freeze: [53, 61], frost: [55, 66], airFreeze: 67, dive: [72.6, 76.2],
  under: 76.2, black: [79.6, 81], end: 81.4,
};
window.DURATION = T.dur;

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = a => a[Math.floor(rnd() * a.length)];
const lerp = (a, b, x) => a + (b - a) * x;
const C = h => new THREE.Color(h);
const mixC = (a, b, x) => a.clone().lerp(b, clamp(x));
const D2R = THREE.MathUtils.degToRad;

// ---------- renderer, post ----------
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('stage'), antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc9d8e6, 120, 1100);
const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 6000);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.5, 0.55, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader); fxaa.material.uniforms.resolution.value.set(1 / W, 1 / H); composer.addPass(fxaa);

// ---------- world layout ----------
// Camera stands on a waterfront promenade behind a railing, looking north (-z) across a bay.
// Left (x < -8): quay road with traffic, street lights, trees, a street of shops. Right: the bay,
// a dock with people and boats; downtown skyline across the water.
const PROM_Y = 1.2, EYE = PROM_Y + 1.65;
const dirFrom = (az, el) => new THREE.Vector3(Math.sin(D2R(az)) * Math.cos(D2R(el)), Math.sin(D2R(el)), -Math.cos(D2R(az)) * Math.cos(D2R(el)));
const sunDir = dirFrom(15, 16), moonDir = dirFrom(-14, 21);

// shared "season" uniforms patched into every lit material: plants brown, snow settles on up-facing
// surfaces, window texels glow at night with a per-building switch.
const G = { uDead: { value: 0 }, uFrost: { value: 0 }, uCityOn: { value: 0 }, uGF: { value: -1 }, uTime: { value: 0 } };
// PBR shading is ~3x slower per pixel in software WebGL; the flat low-poly look is identical with Lambert.
const lambertOf = new Map();
function toLambert(m) {
  if (!m.isMeshStandardMaterial) return m;
  if (!lambertOf.has(m.uuid)) lambertOf.set(m.uuid, new THREE.MeshLambertMaterial({ map: m.map, color: m.color, emissive: m.emissive, emissiveMap: m.emissiveMap, transparent: m.transparent, opacity: m.opacity, side: m.side, vertexColors: m.vertexColors, alphaTest: m.alphaTest, name: m.name }));
  return lambertOf.get(m.uuid);
}
function patch(mat, extra = {}) {
  mat = toLambert(mat);
  if (mat.userData.patched || !(mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return mat;
  mat.userData.patched = true;
  const U = { ...G, uWin: { value: extra.windows ? 1 : 0 } };
  mat.userData.U = U;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN; varying vec3 vWP; attribute float aK; varying float vK;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWN = normalize(mat3(modelMatrix) * objectNormal); vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vK = aK;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN; varying vec3 vWP; varying float vK; uniform float uDead, uFrost, uWin, uCityOn, uGF, uTime;\nfloat h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 c0 = diffuseColor.rgb;
        float green = smoothstep(0.02, 0.10, c0.g - max(c0.r, c0.b));
        vec3 dead = vec3(dot(c0, vec3(.45,.45,.1))) * vec3(1.25, 1.0, 0.62);
        diffuseColor.rgb = mix(c0, dead, green * uDead);
        float up = smoothstep(0.25, 0.75, vWN.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.90, 0.95), uFrost * (0.25 + 0.75 * up));
        float winMask = uWin * smoothstep(0.06, 0.16, c0.b - c0.r) * smoothstep(0.45, 0.6, c0.b) * (1.0 - up);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // each building (vK) switches on with the city, then fails at its own moment after a short flicker
        float gx = uGF - vK * 0.95;
        float fl = (gx > -0.03 && gx < 0.0) ? (sin(uTime * 60.0 + vK * 99.0) > 0.0 ? 1.0 : 0.2) : 1.0;
        float lit = uCityOn * (gx < 0.0 ? fl : 0.0) * (0.85 + 0.15 * sin(uTime * 0.7 + vK * 40.0)) * 0.85;
        float cell = h31(floor(vWP * vec3(0.55, 0.4, 0.55)) + vK * 100.0);
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * winMask * lit * step(0.45, cell) * (0.5 + 0.7 * cell);`);
  };
  mat.customProgramCacheKey = () => 'season-v2';
  return mat;
}
const patchAll = (o, extra) => o.traverse(m => { if (m.isMesh) m.material = patch(m.material, extra); });
// static objects are baked into a handful of merged meshes (one per material) to cut draw calls
const addStatic = (o, cast = true, k = 0) => { o.userData.static = { cast, k }; scene.add(o); return o; };
function mergeStatic() {
  const groups = new Map(), roots = [];
  scene.children.forEach(o => o.userData.static && roots.push(o));
  for (const r of roots) {
    r.updateMatrixWorld(true);
    r.traverse(m => {
      if (!m.isMesh) return;
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      const n = g.attributes.position.count, keep = new THREE.BufferGeometry();
      keep.setAttribute('position', g.attributes.position);
      keep.setAttribute('normal', g.attributes.normal || g.computeVertexNormals() || g.attributes.normal);
      keep.setAttribute('uv', g.attributes.uv || new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      keep.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n).fill(r.userData.static.k), 1));
      g.computeBoundingBox(); const ctr = g.boundingBox.getCenter(new THREE.Vector3());
      const key = m.material.uuid + (r.userData.static.cast ? 'c' : '') + '@' + Math.floor(ctr.x / 120) + ',' + Math.floor(ctr.z / 120);   // tiles so frustum culling still works
      if (!groups.has(key)) groups.set(key, { mat: m.material, cast: r.userData.static.cast, geos: [] });
      groups.get(key).geos.push(keep);
    });
    scene.remove(r);
  }
  for (const { mat, cast, geos } of groups.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat); mesh.castShadow = cast; mesh.receiveShadow = true; scene.add(mesh);
  }
}

// ---------- sky ----------
const skyU = {
  uTop: { value: C(0x3a78cf) }, uHor: { value: C(0xf3d9b0) }, uSunDir: { value: sunDir }, uSun: { value: 1 },
  uSunCol: { value: C(0xfff0d0) }, uMW: { value: 0 }, uMWn: { value: new THREE.Vector3() },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 uTop,uHor,uSunDir,uSunCol,uMWn; uniform float uSun,uMW; varying vec3 vD;
    float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
    void main(){ vec3 d=normalize(vD); float h=clamp(d.y,0.,1.);
      vec3 c=mix(uHor,uTop,pow(h,0.45));
      float s=dot(d,normalize(uSunDir));
      c=mix(c, vec3(1.0,0.88,0.66), pow(max(s,0.),60.)*0.45*uSun);
      float disk=smoothstep(0.99955,0.99968,s);
      c+=uSunCol*(disk*6.+pow(max(s,0.),1200.)*2.+pow(max(s,0.),90.)*0.4)*uSun;
      float b=dot(d,uMWn); float band=exp(-b*b/0.012)*(0.75+0.25*sin(d.x*23.+d.z*17.)*sin(d.y*19.-d.x*11.))+exp(-b*b/0.0015)*0.5;
      c+=vec3(0.55,0.6,0.8)*band*uMW*0.16*smoothstep(-0.05,0.25,d.y);
      if(d.y<0.) c=uHor;
      gl_FragColor=vec4(c,1.); }`,
}));
sky.renderOrder = -2; scene.add(sky);

const starMats = [];
const starLayer = (count, size, gen) => {
  const p = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { const v = gen(); p.set([v.x * 3800, v.y * 3800, v.z * 3800], i * 3); const w = 0.55 + rnd() * 0.45; col.set([w * (0.85 + rnd() * 0.15), w * 0.92, w], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
  starMats.push(m); const pts = new THREE.Points(g, m); pts.renderOrder = -1; scene.add(pts);
};
const sphereDir = () => { const u = rnd() * 2 - 1, th = rnd() * 6.283, r = Math.sqrt(1 - u * u); return new THREE.Vector3(r * Math.cos(th), Math.abs(u) * 0.97 + 0.02, r * Math.sin(th)).normalize(); };
starLayer(4500, 1.6, sphereDir); starLayer(500, 3.0, sphereDir);
const mwC = dirFrom(-12, 34), mwN = mwC.clone().cross(new THREE.Vector3(0.45, 1, 0)).normalize();
skyU.uMWn.value.copy(mwN);
{
  const a = mwC.clone(), b = mwN.clone().cross(a).normalize(), gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
  starLayer(9000, 1.3, () => { const th = rnd() * 6.283; return a.clone().multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th)).addScaledVector(mwN, gauss() * 0.11).normalize(); });
}

const moonU = { uFade: { value: 1 }, uLit: { value: 1 }, uL: { value: sunDir.clone().multiplyScalar(1600).sub(moonDir.clone().multiplyScalar(1000)).normalize() }, uDay: { value: 1 } };
const moon = new THREE.Mesh(new THREE.SphereGeometry(17, 32, 16), new THREE.ShaderMaterial({
  fog: false, transparent: true, uniforms: moonU,
  vertexShader: `varying vec3 vN; void main(){ vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 uL; uniform float uLit,uDay,uFade; varying vec3 vN;
    void main(){ float l=smoothstep(-0.05,0.25,dot(normalize(vN),uL)); vec3 c=vec3(1.1,1.08,1.0)*l*uLit;
      float a=mix(max(l*uLit,0.04),1.,1.-uDay)*mix(0.7,1.,1.-uDay); gl_FragColor=vec4(c+0.012,a*uFade); }`,
}));
moon.position.copy(moonDir).multiplyScalar(1000); scene.add(moon);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6b5a40, 1.1); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xffe2b8, 3.2);
sunL.castShadow = true; sunL.shadow.intensity = 0.55; sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.03;
Object.assign(sunL.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 400 });
sunL.target.position.set(-2, 0, -38); scene.add(sunL, sunL.target);
sunL.position.copy(sunDir).multiplyScalar(200).add(sunL.target.position);
const nightL = new THREE.DirectionalLight(0x8fa6d8, 0); nightL.position.set(-60, 120, 80); scene.add(nightL);

const texL = new THREE.TextureLoader();

// ---------- water + sea bed ----------
const waterNormals = texL.load('/assets/tex/waternormals.jpg');
waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping; waterNormals.repeat.set(70, 70);
const waterM = new THREE.MeshStandardMaterial({ color: 0x23566f, roughness: 0.3, metalness: 0.05, normalMap: waterNormals, normalScale: new THREE.Vector2(0.65, 0.65), side: THREE.DoubleSide });
const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), waterM);
water.position.set(692, 0, -698); water.receiveShadow = true; scene.add(water);
const shoreDist = (x, z) => Math.min(x + 8, -1.8 - z);
{
  const g = new THREE.PlaneGeometry(1400, 1400, 140, 140).rotateX(-Math.PI / 2); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 692, z = p.getZ(i) - 698; p.setY(i, -1.5 - 29 * smooth(0, 28, shoreDist(x, z)) + (rnd() - 0.5) * 0.8); }
  g.computeVertexNormals();
  const bed = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x5c5346, flatShading: true })); bed.position.set(692, 0, -698); scene.add(bed);
}
const crackPts = [];
for (let k = 0; k < 26; k++) {
  let x = 4 + rnd() * 70, z = -8 - rnd() * 80, a = rnd() * 6.28;
  for (let j = 0; j < 16; j++) { const nx = x + Math.cos(a) * 3.4, nz = z + Math.sin(a) * 3.4; a += (rnd() - 0.5) * 1.1; if (shoreDist(nx, nz) < 1) break; crackPts.push(x, 0.03, z, nx, 0.03, nz); x = nx; z = nz; }
}
const crackG = new THREE.BufferGeometry(); crackG.setAttribute('position', new THREE.Float32BufferAttribute(crackPts, 3));
const crackM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
scene.add(new THREE.LineSegments(crackG, crackM)); const crackN = crackPts.length / 3;

// ---------- land: promenade, quay road, street ----------
const concreteM = patch(new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.9 }));
const asphaltM = patch(new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.85 }));
const grassM = patch(new THREE.MeshStandardMaterial({ color: 0x5d8f3c, roughness: 1 }));
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.receiveShadow = true; o.castShadow = true; scene.add(o); return o; };
box(60, PROM_Y + 2, 12, concreteM, 21, PROM_Y / 2 - 1, 4.2);
box(400, PROM_Y + 2, 1600, concreteM, -208, PROM_Y / 2 - 1, -700);
box(9, 0.04, 1600, asphaltM, -14.5, PROM_Y + 0.02, -700);
box(3.5, 0.18, 1600, concreteM, -8.9, PROM_Y + 0.09, -700);
box(4, 0.06, 1600, grassM, -21, PROM_Y + 0.03, -700);
box(4, 0.2, 1600, concreteM, -25, PROM_Y + 0.1, -700);
{
  const mk = new THREE.MeshBasicMaterial({ color: 0xe8e2c8 });
  for (let z = 10; z > -900; z -= 9) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 4).rotateX(-Math.PI / 2), mk); d.position.set(-14.5, PROM_Y + 0.05, z); addStatic(d, false); }
  const pts = []; for (let x = -8; x <= 50; x += 1.5) pts.push(x, PROM_Y + 0.011, -1.8, x, PROM_Y + 0.011, 10); for (let z = -1.8; z <= 10; z += 1.5) pts.push(-8, PROM_Y + 0.011, z, 50, PROM_Y + 0.011, z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8f887d })));
}
const railM = patch(new THREE.MeshStandardMaterial({ color: 0x2f3237, roughness: 0.45, metalness: 0.7 }));
const rod = (len, x, y, z, rotZ = 0, rotY = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 10), railM); m.rotation.set(0, rotY, rotZ); m.position.set(x, y, z); addStatic(m); };
rod(60, 21, PROM_Y + 1.1, -1.55, Math.PI / 2); rod(60, 21, PROM_Y + 0.55, -1.55, Math.PI / 2);
for (let x = -7.6; x < 50; x += 1.8) if (Math.abs(x - 9) > 2.2) rod(1.1, x, PROM_Y + 0.55, -1.55);
rod(130, -7.4, PROM_Y + 1.1, -66, Math.PI / 2, Math.PI / 2);
for (let z = -2; z > -130; z -= 2.2) rod(1.1, -7.4, PROM_Y + 0.55, z);

// ---------- assets ----------
const shops = 'abcdefghijklmn'.split('').map(c => KENNEY.commercial('building-' + c));
const towers = 'abcde'.split('').map(c => KENNEY.commercial('building-skyscraper-' + c));
const lowB = 'abcdefghijklmn'.split('').map(c => KENNEY.commercial('low-detail-building-' + c)).concat([KENNEY.commercial('low-detail-building-wide-a'), KENNEY.commercial('low-detail-building-wide-b')]);
const awnings = [KENNEY.commercial('detail-awning'), KENNEY.commercial('detail-awning-wide'), KENNEY.commercial('detail-parasol-a'), KENNEY.commercial('detail-parasol-b')];
const carNames = ['sedan', 'taxi', 'suv', 'van', 'police', 'hatchback-sports', 'delivery', 'sedan-sports', 'suv-luxury', 'truck', 'ambulance', 'garbage-truck'];
const cars = carNames.map(KENNEY.cars);
const peopleU = 'abcdefghijklmnopqr'.split('').map(c => KENNEY.people('character-' + c));
const treesU = ['tree_default', 'tree_oak', 'tree_detailed', 'tree_fat', 'tree_default_dark', 'tree_oak_dark'].map(KENNEY.nature);
const bushU = ['plant_bush', 'plant_bushLarge', 'plant_bushDetailed'].map(KENNEY.nature);
const lampU = KENNEY.roads('light-curved'), canoeU = KENNEY.nature('canoe');
const rockU = ['rock_largeA', 'rock_largeB', 'rock_largeC'].map(KENNEY.nature);
await preload([...shops, ...towers, ...lowB, ...awnings, ...cars, ...peopleU, ...treesU, ...bushU, lampU, canoeU, ...rockU]);

const addBuilding = (url, width, x, z, rotY, shadows) => {
  const o = fit(instance(url, { shadows }), { width });
  o.rotation.y = rotY; o.position.set(x, PROM_Y, z); addStatic(o, shadows, 0.02 + rnd() * 0.98);
  patchAll(o, { windows: true }); return o;
};
for (let z = -18; z > -700;) { const w = 15 + rnd() * 7; addBuilding(pick(z > -200 ? shops : lowB), w, -27.5 - w / 2, z - w / 2, -Math.PI / 2, z > -160); z -= w + 1 + rnd() * 2; }
for (let z = -40; z > -700; z -= 30) addBuilding(pick(z > -220 ? towers : lowB), 16 + rnd() * 6, -62 - rnd() * 20, z, -Math.PI / 2, false);
for (let i = 0; i < 34; i++) {
  const x = -60 + i * 13 + (rnd() - 0.5) * 8, z = -470 - rnd() * 80, near = i % 4 === 1;   // a few hero towers, the rest low-detail
  const o = addBuilding(near ? pick(towers) : pick(lowB), near ? 14 + rnd() * 8 : 14 + rnd() * 6, x, z, rnd() < 0.5 ? 0 : Math.PI, false);
  o.scale.y *= near ? 0.55 + rnd() * 0.45 : 0.4 + rnd() * 0.5;
}
for (let i = 0; i < 40; i++) { const o = addBuilding(pick(lowB), 18 + rnd() * 14, -120 + i * 13 + (rnd() - 0.5) * 8, -620 - rnd() * 120, 0, false); o.scale.y *= 0.4 + rnd() * 0.6; }
for (let z = -22; z > -150; z -= 11 + rnd() * 8) { const o = fit(instance(pick(awnings.slice(0, 2))), { width: 5 }); o.rotation.y = -Math.PI / 2; o.position.set(-27.2, PROM_Y + 2.6, z); patchAll(o); addStatic(o); }

const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(0.22, 'rgba(255,200,130,.5)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const lamps = [];
for (let z = -6; z > -600; z -= 24) {
  const o = fit(instance(lampU), { height: 7.5 }); o.rotation.y = Math.PI; o.position.set(-10.2, PROM_Y, z); patchAll(o); addStatic(o, z > -120);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.set(3.2, 3.2, 1); sp.position.set(-12.3, PROM_Y + 7.2, z); scene.add(sp); lamps.push({ sp, k: rnd() });
}
const addTree = (x, z, h) => { const o = fit(instance(pick(treesU)), { height: h }); o.position.set(x, PROM_Y, z); o.rotation.y = rnd() * 6.28; patchAll(o); addStatic(o, z > -150); };
for (let z = -18; z > -600; z -= 24) addTree(-21 + (rnd() - 0.5), z, 7 + rnd() * 3);
for (const [x, z] of [[-4, 8], [36, 6], [46, 3], [-6, 3]]) addTree(x, z, 6 + rnd() * 2);
for (let z = -4; z > -300; z -= 7 + rnd() * 6) { const o = fit(instance(pick(bushU)), { height: 1 + rnd() * 0.8 }); o.position.set(-21 + (rnd() - 0.5) * 3, PROM_Y, z); patchAll(o); addStatic(o, z > -100); }

// dock
const DOCK = { x: 9, w: 3.6, z0: -1.8, z1: -48, y: PROM_Y - 0.2 };
const woodM = patch(new THREE.MeshStandardMaterial({ color: 0x8a6342, roughness: 0.9 }));
for (let z = DOCK.z0; z > DOCK.z1; z -= 0.62) { const p = new THREE.Mesh(new THREE.BoxGeometry(DOCK.w, 0.12, 0.55), woodM); p.position.set(DOCK.x, DOCK.y, z - 0.3); addStatic(p); }
for (let z = DOCK.z0 - 2; z > DOCK.z1; z -= 4.5) for (const dx of [-1.7, 1.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 7), woodM); p.position.set(DOCK.x + dx, DOCK.y - 1.4, z); addStatic(p); }
for (const z of [-40, -45]) for (const dx of [-0.9, 0.9]) { const o = fit(instance(pick(awnings.slice(2))), { height: 2.6 }); o.position.set(DOCK.x + dx, DOCK.y, z); patchAll(o); addStatic(o); }
const boats = [];
for (const [x, z, r] of [[12.8, -14, 0.1], [13.2, -24, -0.15], [5.2, -30, 0.2], [14, -37, 0]]) { const o = fit(instance(canoeU), { length: 4.4 }); o.position.set(x, 0, z); o.rotation.y = r; patchAll(o); scene.add(o); boats.push({ o, k: rnd() * 6 }); }

// people: each walks ONE way (no robotic U-turns), stops and looks up at the cut, then turns
// smoothly and sprints toward the shore and out past the camera.
const people = [];
const addPerson = (url, x, z0, dir, street) => {
  const o = instance(url); patchAll(o);
  const wrap = fit(o, { height: 1.72 }); scene.add(wrap);
  const mixer = new THREE.AnimationMixer(o); const clip = n => o.userData.animations.find(a => a.name === n);
  const acts = { walk: mixer.clipAction(clip('walk')), idle: mixer.clipAction(clip('idle')), sprint: mixer.clipAction(clip('sprint')) };
  Object.values(acts).forEach(a => a.play());
  let head; o.traverse(n => { if (n.name === 'head') head = n; });
  people.push({ wrap, mixer, acts, head, street, x, z0, dir, v: 1.15 + rnd() * 0.35, k: rnd() });
};
for (let i = 0; i < 12; i++) { const out = i % 2 === 0; addPerson(peopleU[i % peopleU.length], DOCK.x + (rnd() - 0.5) * 2.4, out ? -3 - rnd() * 14 : -30 - rnd() * 16, out ? -1 : 1, false); }
for (let i = 0; i < 12; i++) { const out = i % 2 === 0; addPerson(peopleU[(i + 6) % peopleU.length], -25 + (rnd() - 0.5) * 2.2, out ? -10 - rnd() * 60 : -60 - rnd() * 90, out ? -1 : 1, true); }

// traffic: no wrapping/teleporting. Cars enter from the far haze or drive off into it; after the
// sun goes out drivers brake hard (nose dips) and the road jams.
const traffic = [];
for (let i = 0; i < 20; i++) {
  const dir = i % 2 ? 1 : -1;                                     // +1 = toward camera (+z)
  const o = instance(cars[i % cars.length]); patchAll(o);
  const wheels = []; o.traverse(n => { if (n.name.startsWith('wheel')) wheels.push(n); });
  const big = /truck|ambulance|delivery/.test(carNames[i % cars.length]);
  const body = fit(o, { length: big ? 6.2 : 4.6 });
  const wrap = new THREE.Group(); wrap.add(body); wrap.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(wrap);
  const mk = (col, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(s, s, 1); wrap.add(sp); return sp; };
  const half = big ? 3.1 : 2.35;
  const hl = [mk(0xfff4dd, 2.6), mk(0xfff4dd, 2.6)], tl = [mk(0xff2a1a, 1.4), mk(0xff2a1a, 1.4)];
  hl[0].position.set(-0.7, 0.75, half); hl[1].position.set(0.7, 0.75, half); tl[0].position.set(-0.7, 0.8, -half); tl[1].position.set(0.7, 0.8, -half);
  const v = 12 + rnd() * 4, stop = T.sunOut + 1.5 + rnd() * 5, decel = 4 + rnd() * 2;
  const slot = Math.floor(i / 2);                                 // jam position: queue in each lane
  const zStop = dir > 0 ? -22 - slot * 14 - rnd() * 4 : -30 - slot * 15 - rnd() * 4;
  const dStop = v * stop + v * v / (2 * decel);
  traffic.push({ wrap, body, wheels, hl, tl, dir, lane: dir > 0 ? -12.6 : -16.4, v, stop, decel, zStart: zStop - dir * dStop, k: rnd() });
}
const carDist = (c, t) => {
  if (t < c.stop) return c.v * t;
  const tb = Math.min(t - c.stop, c.v / c.decel);
  return c.v * c.stop + c.v * tb - c.decel * tb * tb / 2;
};

const birdM = new THREE.MeshBasicMaterial({ color: 0x23272e, side: THREE.DoubleSide });
const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, 0, 0, 0.25, 1.1, 0, 0], 3));
const birds = [];
for (let i = 0; i < 14; i++) {
  const b = new THREE.Group(), l = new THREE.Mesh(wingGeo, birdM), r = new THREE.Mesh(wingGeo, birdM); r.scale.x = -1; b.add(l, r); b.rotation.y = -Math.PI / 2;
  scene.add(b); birds.push({ b, l, r, ox: (rnd() - 0.5) * 26, oy: (rnd() - 0.5) * 8, oz: (rnd() - 0.5) * 16, k: rnd() * 6 });
}

const glowDot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const SN = 9000, snowBase = new Float32Array(SN * 4);
for (let i = 0; i < SN; i++) snowBase.set([(rnd() - 0.5) * 100, rnd() * 50, -rnd() * 120 + 8, 0.6 + rnd() * 0.8], i * 4);
const snowPos = new Float32Array(SN * 3), snowG = new THREE.BufferGeometry(); snowG.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowM = new THREE.PointsMaterial({ map: glowDot, alphaTest: 0.01, color: 0xeef3ff, size: 0.075, transparent: true, opacity: 0, depthWrite: false });
scene.add(new THREE.Points(snowG, snowM));

const ventTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,215,150,1)'); gr.addColorStop(0.12, 'rgba(255,150,60,.6)'); gr.addColorStop(0.45, 'rgba(255,100,30,.14)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const VENT_Y = -30.5;
const vents = [[10, -58], [17, -62], [23, -55]].map(([x, z]) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ventTex, color: 0xff8a40, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.set(5.5, 5.5, 1); s.position.set(x, VENT_Y + 2.5, z); scene.add(s);
  const pl = new THREE.PointLight(0xff8a3a, 0, 28, 2); pl.position.set(x, VENT_Y + 3, z); scene.add(pl); s.userData.pl = pl;
  const ch = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.2, 7), new THREE.MeshLambertMaterial({ color: 0x3a3430, flatShading: true })); ch.position.set(x, VENT_Y + 0.6, z); scene.add(ch);
  return s;
});
for (let i = 0; i < 40; i++) { const o = fit(instance(pick(rockU), { shadows: false }), { height: 1 + rnd() * 3 }); o.position.set(4 + rnd() * 30, VENT_Y - 1, -48 - rnd() * 24); o.rotation.y = rnd() * 6; addStatic(o, false); }
const BN = 900, bubBase = new Float32Array(BN * 4);
for (let i = 0; i < BN; i++) { const v = vents[i % 3].position; bubBase.set([v.x + (rnd() - 0.5) * 3, v.z + (rnd() - 0.5) * 3, rnd() * 30, 1.5 + rnd() * 2.5], i * 4); }
const bubPos = new Float32Array(BN * 3), bubG = new THREE.BufferGeometry(); bubG.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
const bubM = new THREE.PointsMaterial({ map: glowDot, alphaTest: 0.01, color: 0xcfefff, size: 0.35, transparent: true, opacity: 0, depthWrite: false });
scene.add(new THREE.Points(bubG, bubM));

// ---------- camera choreography ----------
// [t, x, y, z, pitchDeg, yawDeg, ease]  (yaw + = look left)
const CAM = [
  [0, 0.6, EYE, 2.2, -1.5, -4, 's'], [4, 0.6, EYE, 1.6, -1.5, -4, 's'], [21.8, 0.6, EYE, 0.4, 2.5, -8, 's'],
  [23.2, 0.6, EYE, 0.35, 3, -8, 's'], [29, 0.6, EYE, 0.3, 21, 13, 's'], [31.4, 0.6, EYE, 0.3, 21, 13, 's'],
  [36.4, 0.4, EYE, 0.2, -1, 15, 's'], [42, 0.4, EYE, 0, -1.5, 13, 's'], [48, 2.4, EYE, -0.2, -3, 2, 's'],
  [53, 2.4, EYE + 0.1, -0.3, -4, -1, 's'], [61, 1.5, EYE + 7, 1.5, -15, -2, 's'], [66, 1.5, EYE + 7, 1.5, 15, 4, 's'],
  [71, 1.5, EYE + 4, 0.5, -6, -2, 's'], [72.6, 1.5, EYE + 4, 0.2, -8, -3, 's'],
  [76.2, 16, -0.6, -32, -36, -3, 'i'], [81, 16.5, -11, -38, -30, -3, 'o'],
];
const easeF = { s: x => x * x * (3 - 2 * x), i: x => x * x * x, o: x => 1 - (1 - x) ** 3 };
const camAt = t => {
  if (t <= CAM[0][0]) return CAM[0].slice(1, 6);
  for (let i = 0; i < CAM.length - 1; i++) { const a = CAM[i], b = CAM[i + 1]; if (t < b[0]) { const x = easeF[b[6]]((t - a[0]) / (b[0] - a[0])); return a.slice(1, 6).map((v, j) => lerp(v, b[j + 1], x)); } }
  return CAM.at(-1).slice(1, 6);
};
const n3 = (t, f) => Math.sin(t * f) * 0.5 + Math.sin(t * f * 2.31 + 1.7) * 0.3 + Math.sin(t * f * 4.7 + 0.3) * 0.2;
const hit = (t, at, amp, decay) => (t > at ? amp * Math.exp(-(t - at) * decay) : 0);
const CRACKS = [55.4, 58.1, 62.7, 69.3];

// ---------- text ----------
const fmtCount = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const TK = [[24, 68, 60], [30, 66, 3600], [36, 45, 86400], [44, 0, 7 * 86400], [52, -60, 60 * 86400], [60, -100, 365 * 86400], [68, -240, 1e3 * 365 * 86400], [76, -400, 1e6 * 365 * 86400]];
const interpK = t => {
  if (t <= TK[0][0]) return [TK[0][1], TK[0][2]];
  for (let i = 0; i < TK.length - 1; i++) if (t < TK[i + 1][0]) { const x = (t - TK[i][0]) / (TK[i + 1][0] - TK[i][0]); return [lerp(TK[i][1], TK[i + 1][1], x), Math.exp(lerp(Math.log(TK[i][2]), Math.log(TK[i + 1][2]), x))]; }
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
const sunScr = { x: 0, y: 0 };
const spec = {
  title: { text: 'What if the Sun disappeared?', s: -1, e: 4.3 },
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
  // ~5 s each with breathing room between, like the top videos
  captions: [
    [4.8, 9.8, 'A normal afternoon.'],
    [11.6, 16.6, 'But the Sun is already gone.'],
    [17.2, 21.8, 'Its last light is still on the way.'],
    [22.8, 27.8, 'Then the sky goes black.'],
    [36.2, 41.2, 'Every light in the city comes on.'],
    [43.6, 48.6, 'Within a week, everything is dying.'],
    [50.4, 55.4, 'One by one, the lights go out.'],
    [57.4, 62.4, 'The bay freezes solid.'],
    [66.2, 71.2, 'Then the air itself freezes.'],
    [72.8, 76.1, 'But deep under the ice…'],
    [76.6, 79.5, 'the ocean is still liquid.'],
  ],
  black: T.black,
  end: { s: T.end, title: 'What if the Sun disappeared?', sub: 'Sunlight is 8 minutes and 20 seconds old when it reaches you' },
  tint: t => {
    const under = t >= T.under, f = under ? 0 : smooth(...T.frost, t) * 0.5 + smooth(T.airFreeze, 75, t) * 0.25;
    const layers = [`radial-gradient(ellipse at center, rgba(205,228,255,0) 52%, rgba(205,228,255,${f}) 120%)`];
    const fl = t > T.under - 0.08 ? 0.85 * Math.exp(-(t - T.under + 0.08) * 5) : 0;
    if (fl > 0.01) layers.unshift(`linear-gradient(rgba(235,250,255,${fl}),rgba(235,250,255,${fl}))`);
    if (under) layers.push(`radial-gradient(ellipse at center, rgba(0,40,50,0) 40%, rgba(0,20,30,.75) 115%)`);
    const a = t > T.sunOut ? 0.55 * Math.exp(-(t - T.sunOut) / 1.1) : 0;
    if (a > 0.005) layers.unshift(`radial-gradient(circle at ${sunScr.x}px ${sunScr.y}px, rgba(150,255,210,${a}) 0, rgba(230,90,255,${a * 0.45}) 55px, rgba(0,0,0,0) 150px)`);
    return layers.join(',');
  },
};
const ov = setupOverlay();

// ---------- per-frame ----------
const DAY = { top: C(0x2a62c4), hor: C(0x9fbdda), fog: C(0x9fb6cc) };
const NIGHT = { top: C(0x03050c), hor: C(0x0f1828), fog: C(0x121b2b) };
const WATER = C(0x23566f), ICE = C(0xc4d8e6);

function personAt(p, t) {
  const stopT = T.sunOut + 0.4 + p.k * 0.7, runT = T.sunOut + 3.0 + p.k * 1.8;
  // walk with ease-out into the stop; sprint with acceleration (no instant speed changes)
  const walkEnd = Math.min(t, stopT) * p.v - p.v * 0.25 * smooth(stopT - 0.5, stopT, t);
  let z = p.z0 + p.dir * walkEnd;
  const tr = Math.max(0, t - runT), acc = 3.2, vmax = 5.2, ta = vmax / acc;
  z += tr < ta ? 0.5 * acc * tr * tr : 0.5 * acc * ta * ta + vmax * (tr - ta);
  const turn = p.dir > 0 ? 0 : smooth(runT - 0.35, runT + 0.15, t);     // walkers heading away turn round
  p.wrap.rotation.y = (p.dir > 0 ? 0 : Math.PI) - Math.PI * turn;
  const walkW = 1 - smooth(stopT - 0.4, stopT + 0.1, t), sprintW = smooth(runT - 0.05, runT + 0.5, t), idleW = Math.max(0, 1 - walkW - sprintW);
  p.acts.walk.setEffectiveWeight(walkW); p.acts.idle.setEffectiveWeight(idleW); p.acts.sprint.setEffectiveWeight(sprintW);
  p.acts.walk.time = (t * p.v * 0.85 + p.k * 3) % p.acts.walk.getClip().duration;
  p.acts.idle.time = (t + p.k * 2) % p.acts.idle.getClip().duration;
  p.acts.sprint.time = (tr * 1.15 + p.k) % p.acts.sprint.getClip().duration;
  p.mixer.update(0);
  if (p.head) p.head.rotation.x -= 0.55 * smooth(stopT + 0.1, stopT + 0.9, t) * (1 - smooth(runT - 0.2, runT + 0.2, t));
  p.wrap.position.set(p.x, p.street ? PROM_Y + 0.2 : DOCK.y + 0.06, z);
  p.wrap.visible = z < 14;                                            // only ever hidden once behind the camera
}

mergeStatic();
window.__dbg = { renderer, composer, bloom, sunL, scene, camera };
window.renderAt = t => {
  const out = smooth(T.sunOut, T.sunOut + 0.35, t);
  const plants = smooth(...T.plantsDie, t), frost = smooth(...T.frost, t), ice = smooth(...T.freeze, t), air = smooth(T.airFreeze, 75, t);
  const under = t >= T.under;
  G.uDead.value = plants; G.uFrost.value = frost * 0.9 + air * 0.1;

  skyU.uSun.value = 1 - out;
  skyU.uTop.value.copy(mixC(DAY.top, NIGHT.top, out));
  skyU.uHor.value.copy(mixC(DAY.hor, NIGHT.hor, out).lerp(C(0x1b2535), air * 0.6));
  scene.fog.color.copy(mixC(DAY.fog, NIGHT.fog, out).lerp(C(0x1d2737), air * 0.7));
  scene.fog.near = lerp(lerp(260, 250, out), 40, air); scene.fog.far = lerp(lerp(1700, 1800, out), 420, air);
  sunL.intensity = 3.2 * (1 - out);
  nightL.intensity = 0.55 * out * (1 - air * 0.3);
  hemi.intensity = lerp(1.1, 0.75, out);
  hemi.color.copy(mixC(C(0xcfe0ff), C(0x6f86b8), out)); hemi.groundColor.copy(mixC(C(0x6b5a40), C(0x252b3a), out));
  renderer.toneMappingExposure = lerp(0.88, 1.45, out);
  const starA = smooth(T.sunOut + 0.3, T.sunOut + 2.5, t) * lerp(0.75, 1, smooth(58, 66, t)) * (1 - air * 0.45);
  starMats.forEach((m, i) => (m.opacity = starA * (i === 2 ? 0.9 : 1))); skyU.uMW.value = starA;
  moonU.uDay.value = 1 - out; moonU.uLit.value = 1 - smooth(T.moonOut, T.moonOut + 0.6, t); moonU.uFade.value = 1 - smooth(T.moonOut + 1, T.moonOut + 3.5, t);
  bloom.strength = lerp(0.22, 0.55, out); bloom.threshold = lerp(0.97, 0.82, out); bloom.radius = 0.4;

  waterNormals.offset.set(t * 0.012 * (1 - ice), t * 0.008 * (1 - ice));
  waterM.color.copy(mixC(WATER, ICE, ice)); waterM.roughness = lerp(0.3, 0.45, ice); waterM.normalScale.setScalar(lerp(0.65, 0.12, ice));
  crackM.opacity = smooth(54.5, 56, t) * 0.8; crackG.setDrawRange(0, Math.floor(crackN * smooth(54.5, 64, t) / 2) * 2);
  for (const b of boats) { const bob = 1 - ice; b.o.position.y = Math.sin(t * 1.3 + b.k) * 0.08 * bob - 0.05; b.o.rotation.z = Math.sin(t * 1.1 + b.k) * 0.05 * bob; b.o.rotation.x = Math.sin(t * 0.9 + b.k * 2) * 0.03 * bob; }

  const cityOn = smooth(...T.cityOn, t), gf = (t - T.gridFail[0]) / (T.gridFail[1] - T.gridFail[0]);
  G.uCityOn.value = cityOn; G.uGF.value = gf; G.uTime.value = t;
  for (const l of lamps) { const x = gf - 0.2 - l.k * 0.5; l.sp.material.opacity = smooth(32.5 + l.k, 33.3 + l.k, t) * (x < 0 ? (x > -0.03 ? (Math.sin(t * 50 + l.k * 70) > 0 ? 1 : 0.15) : 1) : 0) * 0.95; }

  for (const p of people) personAt(p, t);
  for (const c of traffic) {
    const d = carDist(c, t), vNow = t < c.stop ? c.v : Math.max(0, c.v - c.decel * (t - c.stop));
    const z = c.zStart + c.dir * d;
    c.wrap.position.set(c.lane, PROM_Y + 0.02, z);
    c.wheels.forEach(w => (w.rotation.x = d / 0.36));
    const braking = t > c.stop && vNow > 0;
    c.body.rotation.x = braking ? 0.025 * smooth(c.stop, c.stop + 0.3, t) : 0.012 * Math.exp(-Math.max(0, t - c.stop - c.v / c.decel) * 4) * (t > c.stop ? -1 : 0);
    const lights = smooth(T.sunOut + 0.4, T.sunOut + 1.4, t) * (1 - smooth(57 + c.k * 6, 58 + c.k * 6, t));
    c.hl.forEach(s => (s.material.opacity = lights * 0.95));
    const brake = t > c.stop - 0.1 ? 1 : 0;
    c.tl.forEach(s => (s.material.opacity = Math.max(lights * (brake ? 1 : 0.5), brake ? 0.8 * (1 - smooth(57 + c.k * 6, 58 + c.k * 6, t)) : 0)));
  }
  for (const b of birds) {
    b.b.position.set(-90 + t * 7 + b.ox, 34 + b.oy + Math.sin(t * 0.8 + b.k) * 0.8, -80 + b.oz);
    const flap = Math.sin(t * 9 + b.k) * 0.55; b.l.rotation.z = flap; b.r.rotation.z = -flap;
  }

  snowM.opacity = under ? 0 : smooth(T.snow, T.snow + 3, t) * lerp(0.55, 1, air); snowM.size = lerp(0.075, 0.1, air);
  const fall = lerp(2.2, 0.8, air);
  for (let i = 0; i < SN; i++) { const b = i * 4, sp = snowBase[b + 3]; let y = (snowBase[b + 1] - t * fall * sp) % 50; if (y < 0) y += 50; snowPos[i * 3] = snowBase[b] + Math.sin(t * 0.6 * sp + i) * 0.8 + t * 0.3; snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = snowBase[b + 2]; }
  snowG.attributes.position.needsUpdate = true;

  if (under) {
    scene.fog.color.set(0x042631); scene.fog.near = 2; scene.fog.far = 42;
    hemi.color.set(0x3f8fa0); hemi.groundColor.set(0x08161c); hemi.intensity = 0.6; nightL.intensity = 0.15;
    waterM.color.set(0x9fd6e4);
  }
  const ventA = under ? smooth(T.under, T.under + 1.5, t) * (0.85 + 0.15 * Math.sin(t * 3)) : 0;
  vents.forEach(v => { v.material.opacity = ventA * 0.7; v.userData.pl.intensity = ventA * 14; });
  bubM.opacity = under ? 0.8 : 0;
  for (let i = 0; i < BN; i++) { const b = i * 4, y = (bubBase[b + 2] + t * bubBase[b + 3]) % 30; bubPos[i * 3] = bubBase[b] + Math.sin(t * 2 + i) * 0.3; bubPos[i * 3 + 1] = VENT_Y + y; bubPos[i * 3 + 2] = bubBase[b + 1]; }
  bubG.attributes.position.needsUpdate = true;

  const [cx, cy, cz, cp, cyaw] = camAt(t);
  let sh = hit(t, T.sunOut + 0.25, 0.9, 2.2) + hit(t, T.under, 1.4, 2.5);
  for (const c of CRACKS) sh += hit(t, c, 0.25, 4);
  camera.position.set(cx + Math.sin(t * 0.31) * 0.03 + n3(t, 23) * sh * 0.05, cy + Math.sin(t * 0.47) * 0.015 + n3(t + 5, 27) * sh * 0.05, cz);
  camera.rotation.set(D2R(cp + Math.sin(t * 0.23) * 0.25 + n3(t + 9, 19) * sh * 1.2), D2R(cyaw + Math.sin(t * 0.19) * 0.35 + n3(t + 2, 17) * sh * 1.2), Math.sin(t * 0.27) * 0.002 + n3(t + 4, 21) * sh * 0.035, 'YXZ');
  sky.position.copy(camera.position);
  camera.updateMatrixWorld();
  const sp = sunDir.clone().multiplyScalar(1000).add(camera.position).project(camera);
  sunScr.x = (sp.x * 0.5 + 0.5) * W; sunScr.y = (-sp.y * 0.5 + 0.5) * H;

  composer.render();
  updateOverlay(ov, spec, t);
};

await document.fonts.ready;
await Promise.all(['400 86px Fraunces', 'italic 500 50px "EB Garamond"', '600 23px Inter', '500 20px Inter'].map(f => document.fonts.load(f)));
await new Promise(r => { const wait = () => (waterNormals.image ? r() : setTimeout(wait, 50)); wait(); });
window.renderAt(0);
window.__ready = true;
