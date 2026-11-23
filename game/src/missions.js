// Story missions: 8 jobs, each with 2 stages, a waypoint marker, a timer
// and a dialogue line. The engine tracks progress, ratings and rewards,
// and drives the mission header and dialogue box on the HUD.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { WORLD_W, WORLD_H, BEACH_W } from './config.js';

// Where each mission stage happens, in world coordinates.
function stageTarget(missionId, stageIndex, landmarks) {
  const g = landmarks.garage, p = landmarks.pier, m = landmarks.market;
  switch (missionId) {
    case 1: return stageIndex === 0 ? { x: 40, z: -30, radius: 14 } : { x: g.x, z: g.z, radius: 12 };
    case 2: return { x: 0, z: 0, radius: 0 }; // timed escape, no waypoint
    case 3: return stageIndex === 0 ? { x: -20, z: 60, radius: 10 } : { x: WORLD_W / 2 + 20, z: -40, radius: 12 };
    case 4: return { x: m.x, z: m.z, radius: 16 };
    case 5: return { x: 0, z: -WORLD_H / 2 + 40, radius: 12 };
    case 6: return { x: WORLD_W / 2 + BEACH_W - 10, z: 40, radius: 18 };
    case 7: return stageIndex === 0
      ? { x: -WORLD_W / 2 + 30, z: -WORLD_H / 2 + 30, radius: 10 }
      : { x: WORLD_W / 2 - 30, z: WORLD_H / 2 - 30, radius: 10 };
    case 8: return { x: p.x, z: p.z, radius: 16 };
    default: return { x: 0, z: 0, radius: 10 };
  }
}

export class MissionEngine {
  constructor(scene, landmarks, callbacks) {
    this.scene = scene;
    this.landmarks = landmarks;
    this.cb = callbacks; // { onDialogue, onStage, onComplete, onFail }
    this.missionIndex = 0; // 0-based into MISSIONS
    this.stageIndex = 0;
    this.state = 'idle'; // idle | active | done
    this.timer = 0;
    this.stageTimer = 0;
    this.kills = 0;
    this.damageTaken = 0;
    this.ratings = {}; // missionId -> 'S' | 'A' | 'B' | 'C'
    this.completed = new Set();
    this.marker = this.makeMarker();
    scene.add(this.marker);
    this.marker.visible = false;
  }

  makeMarker() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.45, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd24d }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 2.4, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 13;
    group.add(beam);
    return group;
  }

  get mission() { return MISSIONS[this.missionIndex]; }
  get stage() { return this.mission ? this.mission.stages[this.stageIndex] : null; }

  get progressText() {
    if (!this.mission) return '';
    return `MISSION ${this.mission.id}/8 · ${this.mission.name}`;
  }

  startMission(index) {
    this.missionIndex = index;
    this.stageIndex = 0;
    this.state = 'active';
    this.timer = 0;
    this.stageTimer = 0;
    this.kills = 0;
    this.damageTaken = 0;
    const m = this.mission;
    this.cb.onDialogue && this.cb.onDialogue(m.dialogue.who, m.dialogue.role, m.dialogue.text);
    this.placeMarker();
    this.cb.onStage && this.cb.onStage(m, 0);
  }

  placeMarker() {
    const t = stageTarget(this.mission.id, this.stageIndex, this.landmarks);
    this.target = t;
    if (t.radius > 0) {
      this.marker.position.set(t.x, 0.4, t.z);
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }
  }

  advanceStage() {
    this.stageIndex += 1;
    this.stageTimer = 0;
    if (this.stageIndex >= this.mission.stages.length) {
      this.completeMission();
      return;
    }
    this.placeMarker();
    this.cb.onStage && this.cb.onStage(this.mission, this.stageIndex);
  }

  completeMission() {
    const m = this.mission;
    // Rating: fast + little damage = S, slow or battered = C.
    const t = this.timer;
    let rating = 'C';
    if (t < 150 && this.damageTaken < 20) rating = 'S';
    else if (t < 220 && this.damageTaken < 45) rating = 'A';
    else if (t < 320) rating = 'B';
    this.ratings[m.id] = rating;
    this.completed.add(m.id);
    this.state = 'done';
    this.marker.visible = false;
    this.cb.onComplete && this.cb.onComplete(m, rating);
    if (this.missionIndex + 1 < MISSIONS.length) {
      this.startMission(this.missionIndex + 1);
    }
  }

  failMission(reason) {
    this.state = 'idle';
    this.marker.visible = false;
    this.cb.onFail && this.cb.onFail(this.mission, reason);
    // Restart the same mission after a beat.
    this.startMission(this.missionIndex);
  }

  // Per-frame update: timers, waypoint arrival, timed stages.
  update(dt, playerPos, context) {
    if (this.state !== 'active' || !this.mission) return;
    this.timer += dt;
    this.stageTimer += dt;
    const m = this.mission;
    // Timed escape stages (mission 2 stage 0, mission 8 stage 0).
    if ((m.id === 2 && this.stageIndex === 0 && this.stageTimer > 45)
      || (m.id === 8 && this.stageIndex === 0 && this.stageTimer > 90)) {
      this.advanceStage();
      return;
    }
    // Waypoint arrival.
    if (this.target && this.target.radius > 0) {
      const d = Math.hypot(playerPos.x - this.target.x, playerPos.z - this.target.z);
      if (d < this.target.radius) {
        // Mission 5 is a race: the gates handle progression, not the marker.
        if (m.id === 5) return;
        this.advanceStage();
      }
    }
    // Mission 4: kill counter drives the stage.
    if (m.id === 4 && this.stageIndex === 0 && this.kills >= 5) this.advanceStage();
    // Mission 6: the target car's health is tracked in context.
    if (m.id === 6 && this.stageIndex === 0 && context && context.targetWrecked) this.advanceStage();
    // Mission 7: crate deliveries counted in context.
    if (m.id === 7 && context && context.crates >= (this.stageIndex === 0 ? 1 : 3)) this.advanceStage();
    // Mission 3: car condition fails the job.
    if (m.id === 3 && context && context.carCondition <= 25 && this.stageIndex === 1) {
      this.failMission('The car fell apart — Sable walked away.');
    }
  }

  get completedCount() { return this.completed.size; }
  get percentComplete() {
    // Missions + side activities feed the pause-screen completion ring.
    return this.completedCount / MISSIONS.length;
  }
}
