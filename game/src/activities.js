// Side activities: the Terrace Climb street race (glowing gates), stunt
// ramps that launch the car, and 20 golden geckos hidden around the city.
// They feed the pause-screen checklist and the completion ring.
import * as THREE from 'three';
import { WORLD_W, WORLD_H, RACE_GATES, STUNT_RAMPS, GECKO_COUNT } from './config.js';

export class StreetRace {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.lap = 0;
    this.gateIndex = 0;
    this.time = 0;
    this.bestLap = null;
    this.gates = [];
    this.gateMeshes = [];
    // A loop of gates around the downtown blocks.
    const pts = [];
    const hw = WORLD_W / 2, hh = WORLD_H / 2;
    const ring = [
      [-hw + 60, -hh + 60], [0, -hh + 60], [hw - 60, -hh + 60], [hw - 60, 0],
      [hw - 60, hh - 60], [0, hh - 60], [-hw + 60, hh - 60], [-hw + 60, 0],
    ];
    for (let i = 0; i < RACE_GATES; i++) pts.push({ x: ring[i][0], z: ring[i][1] });
    this.points = pts;
    for (const p of pts) {
      const gate = new THREE.Mesh(
        new THREE.TorusGeometry(4.5, 0.5, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x4dd0e1 }),
      );
      gate.position.set(p.x, 3, p.z);
      gate.visible = false;
      scene.add(gate);
      this.gateMeshes.push(gate);
      this.gates.push(p);
    }
  }
  start() {
    this.active = true;
    this.lap = 1;
    this.gateIndex = 0;
    this.time = 0;
    this.showGate();
  }
  showGate() {
    this.gateMeshes.forEach((g, i) => { g.visible = i === this.gateIndex; });
  }
  get nextGate() { return this.gates[this.gateIndex]; }
  update(dt, playerPos) {
    if (!this.active) return null;
    this.time += dt;
    const g = this.nextGate;
    const d = Math.hypot(playerPos.x - g.x, playerPos.z - g.z);
    if (d < 8) {
      this.gateIndex += 1;
      if (this.gateIndex >= this.gates.length) {
        this.gateIndex = 0;
        this.lap += 1;
        if (this.lap > 3) {
          this.active = false;
          this.gateMeshes.forEach((m) => { m.visible = false; });
          return { finished: true, time: this.time };
        }
      }
      this.showGate();
      return { gate: this.gateIndex, lap: this.lap };
    }
    return null;
  }
  stop() {
    this.active = false;
    this.gateMeshes.forEach((m) => { m.visible = false; });
  }
}

export class GeckoHunt {
  constructor(scene, spots) {
    this.scene = scene;
    this.spots = spots.slice(0, GECKO_COUNT);
    this.collected = 0;
    this.meshes = [];
    for (const s of this.spots) {
      const gecko = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xffd24d, emissive: 0x664400 }));
      body.scale.set(1.4, 0.7, 0.8);
      body.position.y = 0.7;
      gecko.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 6),
        new THREE.MeshLambertMaterial({ color: 0xffd24d }));
      tail.rotation.z = Math.PI / 2.4;
      tail.position.set(-0.9, 0.55, 0);
      gecko.add(tail);
      gecko.position.set(s.x, 0, s.z);
      scene.add(gecko);
      this.meshes.push(gecko);
    }
  }
  update(dt, playerPos, time) {
    // Bob and spin so they catch the eye.
    for (const m of this.meshes) {
      if (!m.visible) continue;
      m.rotation.y += dt * 1.5;
      m.position.y = 0.15 + Math.sin(time * 2 + m.position.x) * 0.15;
    }
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i];
      if (!m.visible) continue;
      const d = Math.hypot(playerPos.x - m.position.x, playerPos.z - m.position.z);
      if (d < 3) {
        m.visible = false;
        this.collected += 1;
        return { collected: this.collected, total: this.spots.length };
      }
    }
    return null;
  }
}

export class StuntTracker {
  constructor(ramps) {
    this.ramps = ramps;
    this.jumps = 0;
    this.longest = 0;
    this.airTime = 0;
    this.airborne = false;
    this.launchPos = null;
  }
  // Call every frame with the car state; returns a jump result when landed.
  update(dt, carPos, carSpeed, onGround) {
    if (!this.airborne) {
      for (const r of this.ramps) {
        const d = Math.hypot(carPos.x - r.x, carPos.z - r.z);
        if (d < 6 && carSpeed > 16) {
          this.airborne = true;
          this.airTime = 0;
          this.launchPos = { x: carPos.x, z: carPos.z };
          break;
        }
      }
    } else {
      this.airTime += dt;
      if (onGround && this.airTime > 0.4) {
        const dist = Math.hypot(carPos.x - this.launchPos.x, carPos.z - this.launchPos.z);
        this.airborne = false;
        this.jumps += 1;
        this.longest = Math.max(this.longest, dist);
        return { jumps: this.jumps, longest: Math.round(this.longest), airTime: this.airTime };
      }
      if (this.airTime > 4) this.airborne = false;
    }
    return null;
  }
}
