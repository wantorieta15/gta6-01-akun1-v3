// Vehicles: the player's car, traffic cars, police cruisers and the AIR-1
// helicopter. All cars are built from boxes and cylinders — original models.
import * as THREE from 'three';
import { WORLD_W, WORLD_H, BEACH_W } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { snapToRoad, clampToCity } from './city.js';

const CAR_COLORS = [0xe84a4a, 0x4a90e8, 0xf5c542, 0x7ac74f, 0xb388ff, 0xe8e8e8, 0x3a3a3a, 0xff8a3d, 0x4dd0e1, 0xc9d6df];
const CAR_NAMES = ['FALCO GT', 'MARLIN S', 'RUKAN PELO GT', 'CORAL CRUISER', 'VICE COUPE', 'PALM RUNNER', 'SUNSET SEDAN', 'TIDE PICKUP'];

// Build one low-poly car mesh. `police` adds a light bar; `heli` is separate.
export function buildCarMesh(color, police = false, name = '') {
  const car = new THREE.Group();
  // A touch of emissive keeps the paint readable at dusk.
  const paint = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x4a6a8a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65; body.castShadow = true; body.receiveShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), glass);
  cabin.position.set(0, 1.3, -0.2); cabin.castShadow = true;
  car.add(cabin);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.5), dark);
  spoiler.position.set(0, 1.15, -2.1); car.add(spoiler);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.42, wz); wheel.castShadow = true;
    car.add(wheel);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  head.position.set(0, 0.7, 2.21); car.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.15), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  tail.position.set(0, 0.7, -2.21); car.add(tail);
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.75, -0.2); car.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.45, 1.76, -0.2); car.add(bar2);
    car.userData.lightBar = bar;
  }
  car.userData.carName = name;
  car.userData.paint = paint;
  return car;
}

export function buildHeliMesh() {
  const heli = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x22303e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 4.6), bodyMat);
  body.castShadow = true; heli.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.4), new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }));
  glass.position.set(0, 0.3, 1.8); heli.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.4; heli.add(rotor);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), bodyMat);
  tail.position.set(0, 0.4, -4.2); heli.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.2), bodyMat);
  fin.position.set(0, 1.0, -6.2); heli.add(fin);
  // Searchlight cone + ground spot.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -15; cone.rotation.x = Math.PI;
  heli.add(cone);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.35, depthWrite: false }));
  spot.rotation.x = -Math.PI / 2; spot.position.y = -29.8;
  heli.add(spot);
  heli.userData.rotor = rotor;
  heli.userData.cone = cone;
  heli.userData.spot = spot;
  return heli;
}

// --- Traffic ----------------------------------------------------------------
// A traffic car drives along the road grid, turns at intersections, and
// brakes for the car ahead. Simple, cheap, and it makes the city feel alive.
export class TrafficCar {
  constructor(scene, rand, x, z) {
    this.mesh = buildCarMesh(pick(rand, CAR_COLORS), false, pick(rand, CAR_NAMES));
    this.mesh.position.set(x, 0, z);
    const snapped = snapToRoad(x, z);
    this.vertical = snapped.vertical;
    this.dir = rand() < 0.5 ? 1 : -1;
    this.speed = range(rand, 7, 13);
    this.maxSpeed = this.speed;
    this.rand = rand;
    scene.add(this.mesh);
  }
  update(dt, cars) {
    // Brake if a car is close ahead.
    let blocked = false;
    for (const other of cars) {
      if (other === this) continue;
      const dx = other.mesh.position.x - this.mesh.position.x;
      const dz = other.mesh.position.z - this.mesh.position.z;
      const ahead = this.vertical ? Math.sign(dz) === this.dir && Math.abs(dz) < 9 && Math.abs(dx) < 3
        : Math.sign(dx) === this.dir && Math.abs(dx) < 9 && Math.abs(dz) < 3;
      if (ahead) { blocked = true; break; }
    }
    const target = blocked ? 0 : this.maxSpeed;
    this.speed += (target - this.speed) * Math.min(1, dt * 3);
    const nx = this.mesh.position.x + (this.vertical ? 0 : this.dir * this.speed * dt);
    const nz = this.mesh.position.z + (this.vertical ? this.dir * this.speed * dt : 0);
    const clamped = clampToCity(nx, nz);
    this.mesh.position.x = clamped.x; this.mesh.position.z = clamped.z;
    // Turn at an intersection sometimes; bounce at the city edge.
    const atEdge = (this.vertical && (clamped.z <= -WORLD_H / 2 + 8 || clamped.z >= WORLD_H / 2 - 8))
      || (!this.vertical && (clamped.x <= -WORLD_W / 2 + 8 || clamped.x >= WORLD_W / 2 + BEACH_W - 8));
    const onJunction = Math.abs(this.mesh.position.x - snapToRoad(this.mesh.position.x, this.mesh.position.z).x) < 2
      || Math.abs(this.mesh.position.z - snapToRoad(this.mesh.position.x, this.mesh.position.z).z) < 2;
    if (atEdge || (onJunction && this.rand() < dt * 0.25)) {
      this.vertical = !this.vertical;
      this.dir = this.rand() < 0.5 ? 1 : -1;
    }
    const snapped = snapToRoad(this.mesh.position.x, this.mesh.position.z);
    if (this.vertical) this.mesh.position.x += (snapped.x - this.mesh.position.x) * Math.min(1, dt * 2);
    else this.mesh.position.z += (snapped.z - this.mesh.position.z) * Math.min(1, dt * 2);
    this.mesh.rotation.y = this.vertical ? (this.dir > 0 ? 0 : Math.PI) : (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}

// --- Police cruiser ------------------------------------------------------------
export class PoliceCar {
  constructor(scene, callsign, role, x, z) {
    this.callsign = callsign;
    this.role = role;
    this.mesh = buildCarMesh(0xf2f2f2, true, 'SBPD CRUISER');
    this.mesh.position.set(x, 0, z);
    this.speed = 0;
    this.maxSpeed = role === 'RAMMING' ? 26 : 22;
    this.state = 'chase';
    this.roadblockTimer = 0;
    scene.add(this.mesh);
  }
  update(dt, target, playerSpeed) {
    const p = this.mesh.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (this.role === 'ROADBLOCK') {
      // Sit ahead of the player, across the road.
      const aheadX = target.x + (target.vx || 0) * 1.2;
      const aheadZ = target.z + (target.vz || 0) * 1.2;
      const snapped = snapToRoad(aheadX, aheadZ);
      p.x += (snapped.x - p.x) * Math.min(1, dt * 1.5);
      p.z += (snapped.z - p.z) * Math.min(1, dt * 1.5);
      this.mesh.rotation.y = Math.atan2(dx, dz);
      return dist;
    }
    // Chase: steer toward the player, ram when close.
    const want = this.role === 'RAMMING' ? this.maxSpeed : Math.min(this.maxSpeed, 14 + dist * 0.15);
    this.speed += (want - this.speed) * Math.min(1, dt * 1.2);
    const steer = Math.atan2(dx, dz);
    let rot = this.mesh.rotation.y;
    let diff = steer - rot;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rot += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    this.mesh.rotation.y = rot;
    p.x += Math.sin(rot) * this.speed * dt;
    p.z += Math.cos(rot) * this.speed * dt;
    const c = clampToCity(p.x, p.z);
    p.x = c.x; p.z = c.z;
    // Flash the light bar.
    const bar = this.mesh.userData.lightBar;
    if (bar) bar.material.color.setHex(Math.floor(performance.now() / 260) % 2 === 0 ? 0x2244ff : 0xff2222);
    return dist;
  }
}

// --- AIR-1 helicopter -----------------------------------------------------------
export class Heli {
  constructor(scene) {
    this.mesh = buildHeliMesh();
    this.angle = 0;
    this.radius = 34;
    this.altitude = 24;
    scene.add(this.mesh);
  }
  update(dt, target) {
    this.angle += dt * 0.25;
    const p = this.mesh.position;
    p.x = target.x + Math.cos(this.angle) * this.radius;
    p.z = target.z + Math.sin(this.angle) * this.radius;
    p.y = this.altitude + Math.sin(this.angle * 2) * 2;
    this.mesh.lookAt(target.x, 0, target.z);
    this.mesh.userData.rotor.rotation.y += dt * 22;
    // The searchlight cone tracks the player.
    const cone = this.mesh.userData.cone;
    cone.lookAt(0, 0, 0);
    return Math.hypot(p.x - target.x, p.z - target.z);
  }
}
