// People: the player on foot, pedestrians, and rival gang members.
// A person is a small articulated figure — box torso, sphere head, limbs.
import * as THREE from 'three';
import { mulberry32, range, pick } from './random.js';
import { clampToCity, snapToRoad } from './city.js';

const SKIN = [0xf2c89b, 0xc98d5f, 0x8a5a3b, 0xf5d7b0];
const SHIRTS = [0xff5a7a, 0x4dd0e1, 0xffd24d, 0x9dff57, 0xff8a3d, 0xb388ff, 0xffffff, 0x3a3a3a];

export function buildPersonMesh(shirtColor, skinColor, scale = 1) {
  const person = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f45 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.34), shirt);
  torso.position.y = 1.15; torso.castShadow = true;
  person.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.78; head.castShadow = true;
  person.add(head);
  const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.17, 0.38, 0); person.add(legL);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.17, 0.38, 0); person.add(legR);
  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.42, 1.15, 0); person.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.42, 1.15, 0); person.add(armR);
  person.scale.setScalar(scale);
  person.userData.limbs = { legL, legR, armL, armR };
  return person;
}

// Walk-cycle swing, so people do not glide.
export function animateWalk(person, phase, speed) {
  const l = person.userData.limbs;
  if (!l) return;
  const swing = Math.sin(phase) * 0.55 * Math.min(1, speed / 5);
  l.legL.rotation.x = swing; l.legR.rotation.x = -swing;
  l.armL.rotation.x = -swing * 0.8; l.armR.rotation.x = swing * 0.8;
}

// --- The player on foot --------------------------------------------------------
// WASD to move, mouse to aim (pointer lock optional — a fixed over-shoulder
// camera keeps the mouse free), click to shoot, E to enter a nearby car.
export class PlayerOnFoot {
  constructor(scene, x, z) {
    this.mesh = buildPersonMesh(0xffd24d, 0xf2c89b, 1.05);
    this.mesh.position.set(x, 0, z);
    this.heading = 0;
    this.walkPhase = 0;
    this.speed = 0;
    this.hp = 100;
    this.aimX = 0; this.aimZ = -1;
    scene.add(this.mesh);
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  update(dt, keys, cameraYaw) {
    let mx = 0, mz = 0;
    if (keys.has('KeyW')) mz -= 1;
    if (keys.has('KeyS')) mz += 1;
    if (keys.has('KeyA')) mx -= 1;
    if (keys.has('KeyD')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const target = moving ? (run ? 8.5 : 5) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 8);
    if (moving) {
      // Movement is relative to the camera yaw.
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      const wx = (mx * cos - mz * sin) * this.speed * dt;
      const wz = (mx * sin + mz * cos) * this.speed * dt;
      const c = clampToCity(this.x + wx, this.z + wz);
      this.mesh.position.x = c.x; this.mesh.position.z = c.z;
      this.heading = Math.atan2(wx, wz);
      this.walkPhase += dt * this.speed * 1.6;
    }
    this.mesh.rotation.y = this.heading;
    animateWalk(this.mesh, this.walkPhase, this.speed);
  }
  aimAt(worldX, worldZ) {
    this.aimX = worldX - this.x;
    this.aimZ = worldZ - this.z;
    const len = Math.hypot(this.aimX, this.aimZ) || 1;
    this.aimX /= len; this.aimZ /= len;
  }
}

// --- Pedestrians ---------------------------------------------------------------
export class Pedestrian {
  constructor(scene, rand, x, z) {
    this.mesh = buildPersonMesh(pick(rand, SHIRTS), pick(rand, SKIN), range(rand, 0.92, 1.08));
    this.mesh.position.set(x, 0, z);
    this.rand = rand;
    this.speed = range(rand, 1.2, 2.4);
    this.heading = rand() * Math.PI * 2;
    this.walkPhase = rand() * 10;
    this.fleeing = false;
    scene.add(this.mesh);
  }
  update(dt, danger) {
    // Flee from gunfire or a speeding car.
    if (danger) {
      const dx = this.mesh.position.x - danger.x, dz = this.mesh.position.z - danger.z;
      const d = Math.hypot(dx, dz);
      if (d < 18) {
        this.fleeing = true;
        this.heading = Math.atan2(dx, dz);
        this.speed = 6;
      }
    }
    if (!this.fleeing && this.rand() < dt * 0.1) this.heading += range(this.rand, -1.2, 1.2);
    if (this.fleeing) this.speed = Math.max(2, this.speed - dt * 0.8);
    const nx = this.mesh.position.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.mesh.position.z + Math.cos(this.heading) * this.speed * dt;
    const c = clampToCity(nx, nz);
    // Keep pedestrians on sidewalks: nudge them off the road centre.
    const snapped = snapToRoad(c.x, c.z);
    let fx = c.x, fz = c.z;
    if (Math.abs(c.x - snapped.x) < 4) fx = snapped.x + (c.x >= snapped.x ? 5 : -5);
    if (Math.abs(c.z - snapped.z) < 4) fz = snapped.z + (c.z >= snapped.z ? 5 : -5);
    this.mesh.position.x = fx; this.mesh.position.z = fz;
    this.mesh.rotation.y = this.heading;
    this.walkPhase += dt * this.speed * 1.6;
    animateWalk(this.mesh, this.walkPhase, this.speed);
  }
}

// --- Rival gang member (mission 4) ---------------------------------------------
export class Rival {
  constructor(scene, x, z, hp = 3) {
    this.mesh = buildPersonMesh(0xff2a2a, 0xc98d5f, 1.05);
    this.mesh.position.set(x, 0, z);
    this.hp = hp;
    this.alive = true;
    this.shootTimer = 1 + Math.random() * 2;
    this.walkPhase = Math.random() * 10;
    // A floating red marker, so rivals read as enemies at a glance.
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    marker.position.y = 2.5;
    this.mesh.add(marker);
    this.marker = marker;
    scene.add(this.mesh);
  }
  hit(damage = 1) {
    this.hp -= damage;
    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      return true;
    }
    return false;
  }
  update(dt, playerPos, onShoot) {
    if (!this.alive) return;
    const dx = playerPos.x - this.mesh.position.x;
    const dz = playerPos.z - this.mesh.position.z;
    const d = Math.hypot(dx, dz);
    // Strafe at mid range, hold ground when close, shoot on a timer.
    if (d > 14) {
      this.mesh.position.x += (dx / d) * 3.2 * dt;
      this.mesh.position.z += (dz / d) * 3.2 * dt;
      this.walkPhase += dt * 5;
      animateWalk(this.mesh, this.walkPhase, 3.2);
    }
    this.mesh.rotation.y = Math.atan2(dx, dz);
    if (this.marker) {
      this.marker.rotation.y += dt * 3;
      this.marker.position.y = 2.5 + Math.sin(this.walkPhase * 2) * 0.12;
    }
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && d < 26) {
      this.shootTimer = 1.4 + Math.random() * 1.2;
      onShoot(this.mesh.position.x, this.mesh.position.z, Math.atan2(dx, dz));
    }
  }
}
