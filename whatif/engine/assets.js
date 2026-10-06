// GLB asset helpers: cached loading, cloning, and scaling models to real-world sizes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

export const KENNEY = {
  commercial: n => `/assets/kenney/city-kit-commercial/Models/GLB format/${n}.glb`,
  suburban: n => `/assets/kenney/city-kit-suburban/Models/GLB format/${n}.glb`,
  roads: n => `/assets/kenney/city-kit-roads/Models/GLB format/${n}.glb`,
  cars: n => `/assets/kenney/car-kit/Models/GLB format/${n}.glb`,
  people: n => `/assets/kenney/blocky-characters/Models/GLB format/${n}.glb`,
  nature: n => `/assets/kenney/nature-kit/Models/GLTF format/${n}.glb`,
};

export async function preload(urls) {
  await Promise.all(urls.map(u => cache.has(u) ? null : loader.loadAsync(u).then(g => cache.set(u, g))));
}

// Deep clone; materials are shared unless `ownMaterials` is set.
export function instance(url, { ownMaterials = false, shadows = true } = {}) {
  const g = cache.get(url);
  if (!g) throw new Error('not preloaded: ' + url);
  const o = g.scene.clone(true);
  o.traverse(m => {
    if (!m.isMesh) return;
    if (ownMaterials) m.material = m.material.clone();
    m.castShadow = shadows; m.receiveShadow = true;
  });
  o.userData.animations = g.animations;
  return o;
}

export function size(o) { return new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); }

// Scale uniformly so one dimension matches a target (metres), and sit the model on y=0.
export function fit(o, { height, length, width }) {
  o.updateMatrixWorld(true);
  const s = size(o);
  const k = height ? height / s.y : length ? length / Math.max(s.x, s.z) : width / s.x;
  o.scale.multiplyScalar(k);
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o);
  o.position.y -= b.min.y;
  const wrap = new THREE.Group(); wrap.add(o);
  return wrap;
}
