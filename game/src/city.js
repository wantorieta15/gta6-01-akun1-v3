// Solmar Bay city builder: ground, roads, blocks, towers, palms, beach,
// pier, street props and the sunset sky. Everything is original geometry
// built from boxes, cylinders and planes — no borrowed assets.
import * as THREE from 'three';
import { BLOCK, ROAD_WIDE, GRID_COLS, GRID_ROWS, WORLD_W, WORLD_H, BEACH_W, DISTRICTS } from './config.js';
import { mulberry32, range, pick } from './random.js';

const PALETTE = {
  road: 0x4a4450, roadLine: 0xf5c542, sidewalk: 0x9a917e,
  blockBase: 0x3a3f4a, grass: 0x5d8a55, sand: 0xe8cf9a, sea: 0x1e6f8e,
  building: [0xd8a06a, 0xc97b5a, 0x8fa3b8, 0xe0b56a, 0x9a7fb8, 0x6a8f7a, 0xb85c5c, 0x7a9ab8],
  glass: 0x2a3f55, roof: 0x4a4038, palm: 0x2f8f5b, trunk: 0x8a6a4a,
  neon: [0xff5a7a, 0x4dd0e1, 0xffd24d, 0x9dff57, 0xff8a3d],
};

// A small library of shared geometries/materials, so the city stays cheap.
export function makeMaterials() {
  const m = {};
  m.road = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  m.sidewalk = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  m.grass = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
  m.sand = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  m.sea = new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 });
  m.glass = new THREE.MeshLambertMaterial({ color: PALETTE.glass });
  m.roof = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
  m.trunk = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
  m.palm = new THREE.MeshLambertMaterial({ color: PALETTE.palm });
  m.building = PALETTE.building.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  m.neon = PALETTE.neon.map((c) => new THREE.MeshBasicMaterial({ color: c }));
  m.line = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  m.white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  return m;
}

function box(w, h, d, mat, x, y, z, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

// Build the whole city into `group`. Returns landmarks the game logic needs:
// spawn points, the pier, ramps, gecko spots and the beach.
export function buildCity(scene, seed = 7) {
  const rand = mulberry32(seed);
  const mats = makeMaterials();
  const group = new THREE.Group();
  group.name = 'SolmarBayCity';
  const landmarks = { garage: null, pier: null, market: null, ramps: [], geckos: [], raceGates: [] };

  const halfW = WORLD_W / 2, halfH = WORLD_H / 2;

  // --- Ground: grass base, then road strips --------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W + BEACH_W + 240, WORLD_H + 120), mats.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(BEACH_W / 2, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: one plane per vertical and horizontal street, plus centre dashes.
  for (let c = 0; c <= GRID_COLS; c++) {
    const x = -halfW + ROAD_WIDE / 2 + c * (BLOCK + ROAD_WIDE);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDE, WORLD_H), mats.road);
    road.rotation.x = -Math.PI / 2; road.position.set(x, 0, 0); road.receiveShadow = true;
    group.add(road);
    for (let z = -halfH + 8; z < halfH - 4; z += 12) {
      group.add(box(0.5, 0.06, 4, mats.line, x, 0.02, z, false));
    }
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    const z = -halfH + ROAD_WIDE / 2 + r * (BLOCK + ROAD_WIDE);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, ROAD_WIDE), mats.road);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, z); road.receiveShadow = true;
    group.add(road);
    for (let x = -halfW + 8; x < halfW - 4; x += 12) {
      group.add(box(4, 0.06, 0.5, mats.line, x, 0.02, z, false));
    }
  }

  // --- City blocks: sidewalks + buildings -----------------------------------
  const buildings = [];
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const bx = -halfW + ROAD_WIDE + c * (BLOCK + ROAD_WIDE) + BLOCK / 2;
      const bz = -halfH + ROAD_WIDE + r * (BLOCK + ROAD_WIDE) + BLOCK / 2;
      const isDowntown = c >= 2 && c <= 4 && r >= 1 && r <= 2;
      const isPark = (c === 5 && r === 4) || (c === 1 && r === 2);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), mats.sidewalk);
      walk.rotation.x = -Math.PI / 2; walk.position.set(bx, 0.01, bz); walk.receiveShadow = true;
      group.add(walk);
      if (isPark) {
        // Banyan Green park / Old Pasaru market square: trees + stalls.
        for (let i = 0; i < 6; i++) {
          const px = bx + range(rand, -16, 16), pz = bz + range(rand, -16, 16);
          group.add(makePalm(mats, px, pz, rand));
        }
        for (let i = 0; i < 3; i++) {
          const sx = bx + range(rand, -12, 12), sz = bz + range(rand, -12, 12);
          group.add(box(6, 2.2, 3, pick(rand, mats.building), sx, 1.1, sz));
          group.add(box(6.4, 0.25, 3.4, pick(rand, mats.neon), sx, 2.35, sz, false));
        }
        if (c === 1 && r === 2) landmarks.market = { x: bx, z: bz };
        continue;
      }
      // 1-4 buildings per block, heights grow downtown.
      const n = isDowntown ? 3 : 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const w = range(rand, 10, 18), d = range(rand, 10, 18);
        const h = isDowntown ? range(rand, 26, 64) : range(rand, 6, 22);
        const x = bx + range(rand, -BLOCK / 2 + w / 2 + 2, BLOCK / 2 - w / 2 - 2);
        const z = bz + range(rand, -BLOCK / 2 + d / 2 + 2, BLOCK / 2 - d / 2 - 2);
        const mat = pick(rand, mats.building);
        const tower = box(w, h, d, mat, x, h / 2, z);
        group.add(tower);
        buildings.push({ x, z, w, d, h });
        // Lit windows: warm strips on the sun-facing sides, so the towers
        // read as a city at dusk instead of dark slabs.
        const floors = Math.max(1, Math.floor(h / 6));
        for (let f = 0; f < floors; f++) {
          const wy = 2.5 + f * 6;
          if (wy > h - 1) break;
          const winMat = pick(rand, [mats.neon[2], mats.neon[2], mats.white]);
          const strip = box(w * 0.7, 1.1, 0.15, winMat, x, wy, z + d / 2 + 0.08, false);
          group.add(strip);
          if (chance(rand, 0.6)) {
            const strip2 = box(0.15, 1.1, d * 0.7, winMat, x + w / 2 + 0.08, wy, z, false);
            group.add(strip2);
          }
        }
        // Glass crown on tall towers, neon sign on some shops.
        if (h > 30) group.add(box(w * 0.7, 3, d * 0.7, mats.glass, x, h + 1.5, z));
        else if (chance(rand, 0.35)) group.add(box(w * 0.9, 0.8, 0.4, pick(rand, mats.neon), x, range(rand, 3, 5), z + d / 2 + 0.2, false));
        group.add(box(w + 0.6, 0.5, d + 0.6, mats.roof, x, h + 0.25, z));
      }
      // A palm or two on the sidewalk corners.
      if (chance(rand, 0.5)) group.add(makePalm(mats, bx - BLOCK / 2 + 3, bz - BLOCK / 2 + 3, rand));
      if (chance(rand, 0.4)) group.add(makePalm(mats, bx + BLOCK / 2 - 3, bz + BLOCK / 2 - 3, rand));
    }
  }

  // --- Beach, sea and pier (east side) ---------------------------------------
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(BEACH_W, WORLD_H + 40), mats.sand);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(halfW + BEACH_W / 2, 0.02, 0);
  beach.receiveShadow = true;
  group.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, WORLD_H + 260), mats.sea);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(halfW + BEACH_W + 130, -0.15, 0);
  group.add(sea);
  for (let i = 0; i < 14; i++) {
    const px = halfW + range(rand, 8, BEACH_W - 6);
    const pz = range(rand, -halfH, halfH);
    group.add(makePalm(mats, px, pz, rand));
  }
  // Kumala Pier: wooden deck reaching into the sea, with lamps.
  const pier = new THREE.Group();
  pier.position.set(halfW + BEACH_W + 18, 0.4, 40);
  const deck = box(10, 0.8, 90, new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), 0, 0, 0);
  pier.add(deck);
  for (let z = -40; z <= 40; z += 12) {
    pier.add(box(0.4, 5, 0.4, mats.roof, -4.5, 2.5, z, false));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    lamp.position.set(-4.5, 5.4, z);
    pier.add(lamp);
  }
  group.add(pier);
  landmarks.pier = { x: halfW + BEACH_W + 18, z: 40 };

  // Mara's Garage: a low workshop with a neon sign, on Coral Row.
  const gx = -halfW + ROAD_WIDE + 4 * (BLOCK + ROAD_WIDE) + BLOCK / 2;
  const gz = -halfH + ROAD_WIDE + 3 * (BLOCK + ROAD_WIDE) + BLOCK / 2;
  const garage = new THREE.Group();
  garage.position.set(gx, 0, gz);
  garage.add(box(20, 7, 14, mats.building[1], 0, 3.5, 0));
  garage.add(box(20.6, 1, 14.6, mats.roof, 0, 7.2, 0));
  garage.add(box(12, 1.2, 0.5, mats.neon[2], 0, 6, 7.2, false));
  garage.add(box(8, 4.5, 0.3, mats.glass, -4, 2.4, 7.1, false));
  group.add(garage);
  landmarks.garage = { x: gx, z: gz };

  // --- Stunt ramps -------------------------------------------------------------
  const rampSpots = [
    { x: -halfW + ROAD_WIDE + 2 * (BLOCK + ROAD_WIDE), z: 0 },
    { x: halfW - ROAD_WIDE - BLOCK / 2, z: -halfH + ROAD_WIDE + BLOCK / 2 },
    { x: 0, z: halfH - ROAD_WIDE - BLOCK / 2 },
    { x: -halfW + ROAD_WIDE + BLOCK / 2, z: halfH - ROAD_WIDE - BLOCK / 2 },
  ];
  for (const s of rampSpots) {
    const ramp = new THREE.Group();
    const slope = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 10), new THREE.MeshLambertMaterial({ color: 0xffd24d }));
    slope.rotation.x = -0.35; slope.position.set(0, 1.6, 0); slope.castShadow = true;
    ramp.add(slope);
    ramp.position.set(s.x, 0, s.z);
    group.add(ramp);
    landmarks.ramps.push({ x: s.x, z: s.z });
  }

  // --- Golden gecko spots (collectibles) ---------------------------------------
  for (let i = 0; i < 20; i++) {
    const c = Math.floor(rand() * GRID_COLS), r = Math.floor(rand() * GRID_ROWS);
    const x = -halfW + ROAD_WIDE + c * (BLOCK + ROAD_WIDE) + range(rand, -14, 14);
    const z = -halfH + ROAD_WIDE + r * (BLOCK + ROAD_WIDE) + range(rand, -14, 14);
    landmarks.geckos.push({ x, z });
  }

  // --- Sunset sky: gradient dome + low sun + clouds ------------------------------
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a2350) },
      mid: { value: new THREE.Color(0xe85a7a) },
      low: { value: new THREE.Color(0xff9a3d) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 32), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
  sun.position.set(-560, 110, -260);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  // A few flat sunset clouds.
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(range(rand, 120, 260), range(rand, 10, 22)),
      new THREE.MeshBasicMaterial({ color: pick(rand, [0xffb3c1, 0xffd9a0, 0xc9a0ff]), transparent: true, opacity: 0.5, fog: false }));
    cloud.position.set(range(rand, -700, 700), range(rand, 120, 260), range(rand, -700, -200));
    cloud.lookAt(0, cloud.position.y, 0);
    scene.add(cloud);
  }

  scene.add(group);
  scene.fog = new THREE.Fog(0xe88a5a, 260, 820);
  return { group, landmarks, buildings };
}

function chance(rand, p) { return rand() < p; }

export function makePalm(mats, x, z, rand) {
  const palm = new THREE.Group();
  const h = range(rand, 7, 11);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, h, 6), mats.trunk);
  trunk.position.y = h / 2; trunk.castShadow = true;
  palm.add(trunk);
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), mats.palm);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.8, h + 0.6, Math.sin(a) * 1.8);
    frond.rotation.z = Math.cos(a) * 1.1;
    frond.rotation.x = -Math.sin(a) * 1.1;
    frond.castShadow = true;
    palm.add(frond);
  }
  palm.position.set(x, 0, z);
  return palm;
}

// Clamp a position inside the drivable city (roads + beach), for traffic AI.
export function clampToCity(x, z) {
  const mx = WORLD_W / 2 + BEACH_W - 6;
  const mz = WORLD_H / 2 - 6;
  return { x: Math.max(-WORLD_W / 2 + 6, Math.min(mx, x)), z: Math.max(-mz, Math.min(mz, z)) };
}

// Nearest point on the road grid to (x,z): traffic cars snap to lanes.
export function snapToRoad(x, z) {
  const halfW = WORLD_W / 2, halfH = WORLD_H / 2;
  const step = BLOCK + ROAD_WIDE;
  const colX = Math.round((x + halfW - ROAD_WIDE / 2) / step);
  const rowZ = Math.round((z + halfH - ROAD_WIDE / 2) / step);
  const roadX = -halfW + ROAD_WIDE / 2 + colX * step;
  const roadZ = -halfH + ROAD_WIDE / 2 + rowZ * step;
  const dx = Math.abs(x - roadX), dz = Math.abs(z - roadZ);
  if (dx < dz) return { x: roadX, z, vertical: true };
  return { x, z: roadZ, vertical: false };
}
