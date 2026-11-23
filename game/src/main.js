// SOLMAR BAY — Sunset Run. A 3D open-world crime game: drive, walk, fight,
// outrun the SBPD, run 8 story missions and build a crew in a sun-soaked
// coastal city of our own. Built from scratch for the make.fun GTA 6 bounty.
import * as THREE from 'three';
import {
  GAME_TITLE, MISSIONS, CREW, WEAPONS, RADIO, RANKS, rankFor,
  districtAt, WORLD_W, WORLD_H, BEACH_W,
} from './config.js';
import { mulberry32, range } from './random.js';
import { buildCity, clampToCity, snapToRoad } from './city.js';
import { buildCarMesh, TrafficCar, PoliceCar } from './vehicles.js';
import { PlayerOnFoot, Pedestrian, Rival } from './actors.js';
import { PoliceDispatch } from './police.js';
import { MissionEngine } from './missions.js';
import { StreetRace, GeckoHunt, StuntTracker } from './activities.js';
import { HUD } from './hud.js';
import { SoundEngine } from './audio.js';
import { getShotPreset, readShotQuery } from './shots.js';

const VIEW_W = 1280, VIEW_H = 720;

class SolmarBayGame {
  constructor() {
    this.rand = mulberry32(7);
    this.keys = new Set();
    this.state = 'title'; // title | playing | paused
    this.mode = 'drive'; // drive | foot
    this.time = 0;
    this.day = 1;
    this.clockMinutes = 17 * 60 + 25;
    this.money = 18700;
    this.rp = 3900;
    this.hp = 100; this.armour = 55; this.rep = 62;
    this.weaponIndex = 1;
    this.carCondition = 100;
    this.carName = 'FALCO GT';
    this.speed = 0;
    this.steer = 0;
    this.driftScore = 0;
    this.drifting = false;
    this.abilityCooldown = { Z: 0, X: 0, C: 0 };
    this.nitroTimer = 0;
    this.stats = {
      carsStolen: 41, copsEscaped: 12, topStars: 4, distanceKm: 48.2,
      takenOut: 23, longestJump: 47, abilities: 38, hidden: 9,
      racesWon: 1, jumps: 5, exports: 3, jobs: 5, friendly: 3, goldRatings: 2,
    };
    this.context = { targetWrecked: false, crates: 0, carCondition: 100 };
    this.shotMode = false;
    this.initRenderer();
    this.initWorld();
    this.initInput();
    this.initUI();
    this.applyShotPreset();
  }

  // --- Setup ---------------------------------------------------------------------
  initRenderer() {
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 26, 40);
    // Sunset light: warm directional sun + soft purple ambient.
    const sun = new THREE.DirectionalLight(0xffb36b, 2.8);
    sun.position.set(-140, 90, -60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
    sun.shadow.camera.far = 420;
    this.sun = sun;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x8a7bd8, 0x5a4030, 1.25));
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initWorld() {
    const built = buildCity(this.scene, 7);
    this.city = built;
    this.buildings = built.buildings;
    this.landmarks = built.landmarks;
    // Player car: parked on the north-south road x=0, facing +z along it.
    this.car = buildCarMesh(0xe84a4a, false, 'FALCO GT');
    this.car.position.set(0, 0, -20);
    this.car.rotation.y = 0;
    this.scene.add(this.car);
    this.carHeading = 0;
    // Traffic + pedestrians.
    this.traffic = [];
    for (let i = 0; i < 12; i++) {
      this.traffic.push(new TrafficCar(this.scene, this.rand,
        range(this.rand, -WORLD_W / 2 + 20, WORLD_W / 2 + BEACH_W - 20),
        range(this.rand, -WORLD_H / 2 + 20, WORLD_H / 2 - 20)));
    }
    this.peds = [];
    for (let i = 0; i < 22; i++) {
      this.peds.push(new Pedestrian(this.scene, this.rand,
        range(this.rand, -WORLD_W / 2 + 20, WORLD_W / 2 - 20),
        range(this.rand, -WORLD_H / 2 + 20, WORLD_H / 2 - 20)));
    }
    // On-foot player (hidden until the player exits the car).
    this.onFoot = new PlayerOnFoot(this.scene, 0, -16);
    this.onFoot.mesh.visible = false;
    this.rivals = [];
    // Systems.
    this.dispatch = new PoliceDispatch(this.scene);
    this.dispatch.onStarsChanged = (stars) => {
      this.stats.topStars = Math.max(this.stats.topStars, stars);
      if (stars >= 3) this.hud.toast('AIR UNIT DEPLOYED', 2);
    };
    this.missions = new MissionEngine(this.scene, this.landmarks, {
      onDialogue: (who, role, text) => this.hud.showDialogue(who, role, text),
      onStage: (m, s) => this.hud.setMission(m, s),
      onComplete: (m, rating) => this.completeMission(m, rating),
      onFail: (m, reason) => this.hud.toast(reason, 3),
    });
    this.race = new StreetRace(this.scene);
    this.geckos = new GeckoHunt(this.scene, this.landmarks.geckos);
    this.stunts = new StuntTracker(this.landmarks.ramps);
    this.sound = new SoundEngine();
    this.hud = new HUD();
    this.hud.setRadio(0);
    this.hud.setMoney(this.money);
    this.hud.setRank(this.rp);
    this.hud.setStars(0);
    this.hud.setVitals(this.hp, this.armour, this.rep);
    this.hud.setSpeed(0, this.carName, this.carCondition);
    this.targetCar = null; // mission 6 Regent
    this.targetCarHp = 100;
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Enter' && this.state === 'title') this.startGame();
      if (e.code === 'Escape') this.togglePause();
      if (e.code === 'KeyM') this.sound.toggleMute();
      if (e.code === 'KeyT') this.hud.cycleRadio();
      if (e.code === 'KeyE') this.toggleEnterExit();
      if (e.code === 'KeyR') this.reloadWeapon();
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const idx = Number(e.code.slice(-1)) - 1;
        if (!WEAPONS[idx].locked) { this.weaponIndex = idx; this.hud.setWeapon(idx); }
      }
      if (e.code === 'KeyZ') this.useAbility('Z');
      if (e.code === 'KeyX') this.useAbility('X');
      if (e.code === 'KeyC') this.useAbility('C');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (this.state === 'playing' && this.mode === 'foot') this.shoot(e);
    });
    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing' || this.mode !== 'foot') return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const vec = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera);
      const dir = vec.sub(this.camera.position).normalize();
      const t = -this.camera.position.y / dir.y;
      if (t > 0) this.onFoot.aimAt(this.camera.position.x + dir.x * t, this.camera.position.z + dir.z * t);
    });
  }

  initUI() {
    const title = document.getElementById('title');
    title.querySelector('.start-btn').addEventListener('click', () => this.startGame());
    this.hud.onTitleSave = (slot) => this.startGame(slot);
    this.hud.onPauseSave = (slot) => this.saveToSlot(slot);
    document.getElementById('resume-btn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('quit-btn')?.addEventListener('click', () => {
      this.togglePause();
      this.state = 'title';
      this.hud.showTitle();
    });
    // Pause tabs.
    document.querySelectorAll('.pause-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.pause-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.pause-pane').forEach((p) => p.classList.add('hidden'));
        document.getElementById('pane-' + tab.dataset.tab)?.classList.remove('hidden');
      });
    });
  }

  // --- State transitions ----------------------------------------------------------
  startGame(slot) {
    this.sound.ensure();
    this.hud.hideTitle();
    this.state = 'playing';
    if (slot !== undefined && this.hud.saveSlots[slot]) {
      const s = this.hud.saveSlots[slot];
      this.money = s.money || this.money;
      this.rp = s.rp || this.rp;
      this.hud.setMoney(this.money);
      this.hud.setRank(this.rp);
      this.hud.toast(`Save ${slot + 1} loaded — welcome back to Solmar Bay`, 3);
    }
    this.missions.startMission(0);
    this.hud.setMission(this.missions.mission, 0);
  }

  togglePause() {
    if (this.state === 'title') return;
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.openPause(this.pauseState());
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.closePause();
    }
  }

  pauseState() {
    const d = districtAt(this.playerX(), this.playerZ());
    return {
      missionsDone: this.missions.completedCount,
      geckos: this.geckos.collected,
      racesWon: this.stats.racesWon,
      jumps: this.stats.jumps,
      exports: this.stats.exports,
      jobs: this.stats.jobs,
      friendly: this.stats.friendly,
      crew: 3,
      goldRatings: this.stats.goldRatings,
      ratings: this.missions.ratings,
      carsStolen: this.stats.carsStolen,
      copsEscaped: this.stats.copsEscaped,
      topStars: this.stats.topStars,
      distanceKm: this.stats.distanceKm.toFixed(1) + ' km',
      takenOut: this.stats.takenOut,
      longestJump: this.stats.longestJump + ' m',
      abilities: this.stats.abilities,
      hidden: this.stats.hidden,
      player: { x: this.playerX(), z: this.playerZ() },
      marker: this.missions.target,
      district: d,
    };
  }

  saveToSlot(slot) {
    const d = districtAt(this.playerX(), this.playerZ());
    const pct = Math.round(this.missions.percentComplete * 60 + this.geckos.collected / 20 * 15 + this.stats.racesWon / 3 * 10 + 15);
    this.hud.saveGame(slot, {
      percent: pct, district: d.name, missions: this.missions.completedCount,
      time: `DAY ${this.day} · ${this.clockLabel()}`, money: this.money, rp: this.rp,
    });
    this.hud.toast(`Saved to slot ${slot + 1}`, 2);
  }

  clockLabel() {
    const h = Math.floor(this.clockMinutes / 60) % 24;
    const m = Math.floor(this.clockMinutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  playerX() { return this.mode === 'drive' ? this.car.position.x : this.onFoot.x; }
  playerZ() { return this.mode === 'drive' ? this.car.position.z : this.onFoot.z; }

  // --- Driving ----------------------------------------------------------------------
  updateDrive(dt) {
    const k = this.keys;
    const forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 0.55 : 0);
    const steerIn = (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    const handbrake = k.has('Space');
    const nitro = this.nitroTimer > 0;
    const maxSpeed = nitro ? 46 : 34;
    const accel = forward > 0 ? 22 : 14;
    this.speed += forward * accel * dt;
    if (forward === 0) this.speed -= Math.sign(this.speed) * 10 * dt;
    if (handbrake) this.speed -= Math.sign(this.speed) * 16 * dt;
    this.speed = Math.max(-12, Math.min(maxSpeed, this.speed));
    if (Math.abs(this.speed) < 0.2 && forward === 0) this.speed = 0;
    // Steering scales with speed; handbrake widens it and starts a drift.
    const steerRate = 1.9 * Math.min(1, Math.abs(this.speed) / 12) * (handbrake ? 1.7 : 1);
    this.carHeading += steerIn * steerRate * dt * Math.sign(this.speed || 1);
    this.drifting = handbrake && Math.abs(this.speed) > 14 && steerIn !== 0;
    if (this.drifting) {
      this.driftScore += dt * Math.abs(this.speed) * 0.6;
      if (this.driftScore > 120) {
        const bonus = 50 * Math.floor(this.driftScore / 120);
        this.money += bonus;
        this.hud.toast(`DRIFT x${Math.min(5, 2 + Math.floor(this.driftScore / 120))} +$${bonus}`, 1.6);
        this.hud.setMoney(this.money);
        this.driftScore = 0;
      }
    } else {
      this.driftScore = Math.max(0, this.driftScore - dt * 40);
    }
    const nx = this.car.position.x + Math.sin(this.carHeading) * this.speed * dt;
    const nz = this.car.position.z + Math.cos(this.carHeading) * this.speed * dt;
    // Building collision: slide along the wall, chip the paint.
    const hit = this.collidesBuilding(nx, nz);
    if (hit) {
      if (Math.abs(this.speed) > 12) {
        this.carCondition = Math.max(0, this.carCondition - 4);
        this.context.carCondition = this.carCondition;
        this.missions.damageTaken += 4;
        this.sound.crash();
        this.dispatch.commitCrime('ram');
      }
      this.speed *= 0.35;
    } else {
      this.car.position.x = nx;
      this.car.position.z = nz;
    }
    const c = clampToCity(this.car.position.x, this.car.position.z);
    this.car.position.x = c.x; this.car.position.z = c.z;
    this.car.rotation.y = this.carHeading;
    // Body roll and pitch sell the speed.
    this.car.rotation.z = -steerIn * 0.05 * Math.min(1, Math.abs(this.speed) / 20);
    this.car.rotation.x = forward > 0 ? -0.02 : forward < 0 ? 0.03 : 0;
    this.stats.distanceKm += Math.abs(this.speed) * dt / 1000;
    // Bumping traffic and police costs condition and heat.
    for (const t of this.traffic) {
      const d = Math.hypot(t.mesh.position.x - this.car.position.x, t.mesh.position.z - this.car.position.z);
      if (d < 3.4 && Math.abs(this.speed) > 6) {
        this.carCondition = Math.max(0, this.carCondition - 3);
        this.context.carCondition = this.carCondition;
        this.speed *= 0.55;
        this.sound.crash();
        this.dispatch.commitCrime('ram');
      }
    }
    for (const u of this.dispatch.units) {
      const d = Math.hypot(u.mesh.position.x - this.car.position.x, u.mesh.position.z - this.car.position.z);
      if (d < 3.6 && Math.abs(this.speed) > 6) {
        this.carCondition = Math.max(0, this.carCondition - 5);
        this.context.carCondition = this.carCondition;
        this.speed *= 0.5;
        this.sound.crash();
      }
    }
    // Stunt ramps: a fast pass launches the car (visual hop + jump credit).
    const jump = this.stunts.update(dt, this.car.position, Math.abs(this.speed), true);
    if (jump) {
      this.stats.jumps = jump.jumps;
      this.stats.longestJump = Math.max(this.stats.longestJump, jump.longest);
      this.hud.toast(`STUNT JUMP ${jump.longest} m — nice air!`, 2);
      this.money += 150;
      this.hud.setMoney(this.money);
    }
    this.hud.setSpeed(Math.abs(this.speed) * 3.6, this.carName, this.carCondition);
    this.sound.setEngine(Math.abs(this.speed) / 34, true);
  }

  collidesBuilding(x, z) {
    for (const b of this.buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + 1.4 && Math.abs(z - b.z) < b.d / 2 + 1.4) return true;
    }
    return false;
  }

  // --- On foot -----------------------------------------------------------------------
  updateFoot(dt) {
    const camYaw = Math.atan2(this.camera.position.x - this.onFoot.x, this.camera.position.z - this.onFoot.z);
    this.onFoot.update(dt, this.keys, camYaw);
    // Shooting tracers fade.
    for (const t of this.tracers || []) {
      t.material.opacity -= dt * 2.4;
      if (t.material.opacity <= 0) { this.scene.remove(t); }
    }
    this.tracers = (this.tracers || []).filter((t) => t.material.opacity > 0);
    // Rivals fight back.
    for (const r of this.rivals) {
      r.update(dt, { x: this.onFoot.x, z: this.onFoot.z }, (x, z, angle) => {
        this.spawnTracer(x, 1.4, z, this.onFoot.x, 1.4, this.onFoot.z, 0xff5533);
        if (Math.random() < 0.35) {
          this.hp = Math.max(0, this.hp - 6);
          this.hud.setVitals(this.hp, this.armour, this.rep);
          if (this.hp <= 0) this.missions.failMission('You got dropped in the market. Mara sends a car.');
        }
      });
    }
    this.sound.setEngine(0, false);
  }

  shoot(e) {
    const w = WEAPONS[this.weaponIndex];
    if (w.locked) return;
    if (w.ammo !== Infinity) {
      if (w.ammo <= 0) { this.sound.blip(220, 0.08, 0.05); return; }
      w.ammo -= 1;
      this.hud.setWeaponAmmo(this.weaponIndex, w.ammo, w.reserve);
    }
    this.sound.gunshot();
    this.dispatch.commitCrime('shoot');
    // Aim: from the player through the mouse ray, onto the ground plane.
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const vec = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera);
    const dir = vec.sub(this.camera.position).normalize();
    const t = -this.camera.position.y / dir.y;
    const tx = this.camera.position.x + dir.x * (t > 0 ? t : 40);
    const tz = this.camera.position.z + dir.z * (t > 0 ? t : 40);
    this.onFoot.aimAt(tx, tz);
    this.spawnTracer(this.onFoot.x, 1.5, this.onFoot.z, tx, 1.2, tz, 0xffe9a8);
    // Hit test against rivals.
    for (const r of this.rivals) {
      if (!r.alive) continue;
      const rx = r.mesh.position.x, rz = r.mesh.position.z;
      const px = this.onFoot.x, pz = this.onFoot.z;
      const dx = tx - px, dz = tz - pz;
      const len = Math.hypot(dx, dz) || 1;
      const along = ((rx - px) * dx + (rz - pz) * dz) / len;
      const perp = Math.abs((rx - px) * dz - (rz - pz) * dx) / len;
      if (along > 0 && along < 30 && perp < 1.6) {
        if (r.hit(w.id === 'shotgun' ? 2 : 1)) {
          this.stats.takenOut += 1;
          this.missions.kills += 1;
          this.money += 120;
          this.rp += 60;
          this.hud.setMoney(this.money);
          this.hud.setRank(this.rp);
          this.hud.toast('TARGET DOWN +$120', 1.5);
          this.dispatch.commitCrime('kill');
        }
        break;
      }
    }
  }

  spawnTracer(x1, y1, z1, x2, y2, z2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers = this.tracers || [];
    this.tracers.push(line);
  }

  reloadWeapon() {
    const w = WEAPONS[this.weaponIndex];
    if (w.ammo === Infinity || w.reserve <= 0) return;
    const need = (w.id === 'pistol' ? 12 : w.id === 'smg' ? 30 : 6) - w.ammo;
    const take = Math.min(need, w.reserve);
    w.ammo += take; w.reserve -= take;
    this.hud.setWeaponAmmo(this.weaponIndex, w.ammo, w.reserve);
    this.sound.blip(660, 0.08, 0.06);
  }

  toggleEnterExit() {
    if (this.state !== 'playing') return;
    if (this.mode === 'drive') {
      // Exit the car: step out beside it.
      this.mode = 'foot';
      this.car.visible = true;
      this.onFoot.mesh.visible = true;
      this.onFoot.mesh.position.set(this.car.position.x + 2.5, 0, this.car.position.z + 1);
      this.onFoot.heading = this.carHeading;
      this.hud.setSpeed(0, 'ON FOOT', 100);
      this.hud.toast('On foot — WASD to move, click to shoot, E to get back in', 3);
    } else {
      // Enter the nearest car (own or traffic).
      let best = null, bestD = 6;
      const cars = [this.car, ...this.traffic.map((t) => t.mesh)];
      for (const c of cars) {
        const d = Math.hypot(c.position.x - this.onFoot.x, c.position.z - this.onFoot.z);
        if (d < bestD) { best = c; bestD = d; }
      }
      if (best) {
        this.mode = 'drive';
        this.onFoot.mesh.visible = false;
        if (best !== this.car) {
          // Steal it: swap the player's car to this one.
          this.scene.remove(this.car);
          this.car = best;
          this.carName = best.userData.carName || 'STOLEN RIDE';
          this.traffic = this.traffic.filter((t) => t.mesh !== best);
          this.stats.carsStolen += 1;
          this.dispatch.commitCrime('steal');
          this.hud.toast(`Stole a ${this.carName} — the SBPD noticed`, 2.5);
        }
        this.carHeading = Math.atan2(
          Math.sin(this.onFoot.heading), Math.cos(this.onFoot.heading));
        this.speed = 0;
      }
    }
  }

  // --- Crew abilities ------------------------------------------------------------------
  useAbility(key) {
    if (this.state !== 'playing' || this.abilityCooldown[key] > 0) return;
    if (key === 'Z') {
      if (this.dispatch.swapPlates()) {
        this.abilityCooldown.Z = 20;
        this.stats.abilities += 1;
        this.hud.toast('SWAP PLATES — one star gone', 2);
        this.sound.pickup();
      } else {
        this.hud.toast('No heat to lose', 1.2);
      }
    } else if (key === 'X') {
      if (this.mode === 'drive') {
        this.nitroTimer = 2.5;
        this.abilityCooldown.X = 12;
        this.stats.abilities += 1;
        this.hud.toast('SLIPSTREAM — nitro!', 1.5);
      }
    } else if (key === 'C') {
      this.abilityCooldown.C = 15;
      this.stats.abilities += 1;
      this.hud.toast('EYES OUT — all units marked on the map', 2.5);
    }
  }

  // --- Mission completion ------------------------------------------------------------------
  completeMission(m, rating) {
    this.money += m.reward;
    this.rp += 400;
    this.hud.setMoney(this.money);
    this.hud.setRank(this.rp);
    this.hud.toast(`MISSION COMPLETE — ${m.name} · RATING ${rating} · +$${m.reward}`, 4);
    this.sound.missionDone();
    if (m.id === 4) this.clearRivals();
    if (m.id === 5) { this.stats.racesWon += 1; this.race.stop(); }
    if (m.id === 6 && this.targetCar) {
      this.scene.remove(this.targetCar);
      this.targetCar = null;
    }
    // Unlock weapons by rank.
    const { current } = rankFor(this.rp);
    WEAPONS.forEach((w, i) => {
      if (w.locked && w.unlockRank && RANKS.findIndex((r) => r.name === current.name) >= RANKS.findIndex((r) => r.name === w.unlockRank)) {
        this.hud.unlockWeapon(i);
        this.hud.toast(`Unlocked the ${w.name}!`, 2);
      }
    });
    if (m.id === 8) {
      this.hud.toast('SOLMAR BAY — story complete. The city is yours.', 6);
    }
  }

  clearRivals() {
    for (const r of this.rivals) this.scene.remove(r.mesh);
    this.rivals = [];
  }

  spawnRivals() {
    this.clearRivals();
    const m = this.landmarks.market;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.rivals.push(new Rival(this.scene, m.x + Math.cos(a) * 9, m.z + Math.sin(a) * 9));
    }
  }

  spawnTargetCar() {
    if (this.targetCar) return;
    const car = buildCarMesh(0xd8b13a, false, 'ORU REGENT');
    car.position.set(WORLD_W / 2 + BEACH_W - 30, 0, 60);
    car.rotation.y = Math.PI;
    this.scene.add(car);
    this.targetCar = car;
    this.targetCarHp = 100;
  }

  updateTargetCar(dt) {
    if (!this.targetCar) return;
    // The Regent flees toward the pier.
    const p = this.targetCar.position;
    const pier = this.landmarks.pier;
    const dx = pier.x - p.x, dz = pier.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 4) {
      const a = Math.atan2(dx, dz);
      p.x += Math.sin(a) * 13 * dt;
      p.z += Math.cos(a) * 13 * dt;
      this.targetCar.rotation.y = a;
    }
    // Ramming it wrecks it.
    const pd = Math.hypot(this.car.position.x - p.x, this.car.position.z - p.z);
    if (this.mode === 'drive' && pd < 3.6 && Math.abs(this.speed) > 8) {
      this.targetCarHp -= 22;
      this.speed *= 0.5;
      this.sound.crash();
      this.hud.toast(`REGENT ${Math.max(0, Math.round(this.targetCarHp))}%`, 1);
      if (this.targetCarHp <= 0) {
        this.context.targetWrecked = true;
        this.hud.toast('REGENT WRECKED!', 2.5);
      }
    }
  }

  // --- Camera --------------------------------------------------------------------------------
  updateCamera(dt) {
    const target = this.mode === 'drive' ? this.car.position : this.onFoot.mesh.position;
    const heading = this.mode === 'drive' ? this.carHeading : this.onFoot.heading;
    const dist = this.mode === 'drive' ? 9 : 7.5;
    const height = this.mode === 'drive' ? 3.4 : 3.6;
    const backX = target.x - Math.sin(heading) * dist;
    const backZ = target.z - Math.cos(heading) * dist;
    const desired = new THREE.Vector3(backX, height, backZ);
    this.camera.position.lerp(desired, Math.min(1, dt * 4.5));
    // Keep the camera out of buildings: lift it if a tower blocks the view.
    const cam = this.camera.position;
    for (const b of this.buildings) {
      if (Math.abs(cam.x - b.x) < b.w / 2 + 1 && Math.abs(cam.z - b.z) < b.d / 2 + 1 && cam.y < b.h) {
        cam.y = b.h + 3;
      }
    }
    this.camera.lookAt(target.x + Math.sin(heading) * 6, 1.6, target.z + Math.cos(heading) * 6);
    // The sun's shadow box follows the player.
    this.sun.position.set(target.x - 140, 90, target.z - 60);
    this.sun.target.position.set(target.x, 0, target.z);
    this.sun.target.updateMatrixWorld();
  }

  // --- Screenshot presets ---------------------------------------------------------------------
  applyShotPreset() {
    const { shot } = readShotQuery();
    if (!shot) return;
    const preset = getShotPreset(shot);
    if (!preset) return;
    this.shotMode = true;
    this.hud.hideTitle();
    this.state = 'playing';
    this.mode = preset.mode || 'drive';
    this.money = 18700;
    this.rp = 3900;
    this.hud.setMoney(this.money);
    this.hud.setRank(this.rp);
    // Place the player.
    if (preset.mode === 'foot') {
      this.onFoot.mesh.visible = true;
      this.onFoot.mesh.position.set(preset.player.x, 0, preset.player.z);
      this.onFoot.heading = preset.player.heading;
      this.car.position.set(preset.player.x + 6, 0, preset.player.z + 8);
      this.car.visible = true;
      this.hud.setSpeed(0, 'ON FOOT', 100);
    } else {
      this.car.position.set(preset.player.x, 0, preset.player.z);
      this.carHeading = preset.player.heading;
      this.car.rotation.y = this.carHeading;
      if (preset.car) {
        this.car.userData.paint.color.setHex(preset.car.color);
        this.carName = preset.car.name;
        this.carCondition = preset.car.condition;
        this.context.carCondition = preset.car.condition;
      }
      this.speed = (preset.speed || 0) / 3.6;
    }
    // Traffic and pedestrians for density: put some cars on the same road
    // as the player, ahead and behind, so the street reads as busy.
    const wantTraffic = preset.traffic ?? 8;
    while (this.traffic.length > wantTraffic) {
      const t = this.traffic.pop();
      this.scene.remove(t.mesh);
    }
    if (preset.trafficOnRoad) {
      const { x, zs } = preset.trafficOnRoad;
      zs.forEach((z, i) => {
        const t = this.traffic[i];
        if (t) {
          t.mesh.position.set(x + (i % 2 === 0 ? 3 : -3), 0, z);
          t.vertical = true;
          t.dir = i % 2 === 0 ? 1 : -1;
        }
      });
    } else {
      for (let i = 0; i < (preset.traffic ?? 8); i++) {
        const t = this.traffic[i];
        if (t) {
          const a = (i / (preset.traffic ?? 8)) * Math.PI * 2;
          t.mesh.position.set(preset.player.x + Math.cos(a) * 24, 0, preset.player.z + Math.sin(a) * 24);
        }
      }
    }
    // Mission + wanted level: deploy the full police complement at once.
    this.missions.startMission((preset.mission || 1) - 1);
    if (preset.stage) {
      this.missions.stageIndex = preset.stage;
      this.missions.placeMarker();
      this.hud.setMission(this.missions.mission, preset.stage);
    }
    this.dispatch.deploy(preset.wanted || 0, { x: preset.player.x, z: preset.player.z });
    if (preset.heli && this.dispatch.heli) {
      this.dispatch.heli.angle = preset.heliAngle ?? 0;
      this.dispatch.heli.update(0, { x: preset.player.x, z: preset.player.z });
    }
    // The heli deploys on its own: dispatch.update() spawns AIR-1 at 3+ stars.
    if (preset.rivals) this.spawnRivals();
    if (preset.targetCar) {
      this.spawnTargetCar();
      // Park the Regent ahead of the player, on the same road to the pier.
      this.targetCar.position.set(preset.player.x + 42, 0, preset.player.z);
      this.targetCar.rotation.y = preset.player.heading;
    }
    if (preset.dusk) {
      // Night market at dusk: purple sky, warm lamps, still readable.
      this.scene.fog = new THREE.Fog(0x5a3a6a, 180, 640);
      this.sun.intensity = 1.5;
      this.sun.color.setHex(0xff9a7a);
    }
    if (preset.dialogue) this.hud.showDialogue(preset.dialogue.who, preset.dialogue.role, preset.dialogue.text, 999);
    if (preset.toast) this.hud.toast(preset.toast, 999);
    this.hud.setClock(1, preset.timeLabel || '17:25', preset.sunsetIn || '');
    if (preset.stageStats) {
      // Stage the pause screen as a mid-game save (5 missions done, 12 geckos).
      this.missions.completed = new Set(preset.stageStats.missionsDone);
      this.missions.ratings = { ...preset.stageStats.ratings };
      for (let i = 0; i < preset.stageStats.geckos; i++) {
        const m = this.geckos.meshes[i];
        if (m) m.visible = false;
      }
      this.geckos.collected = preset.stageStats.geckos;
    }
    if (preset.pause) {
      // Let one frame render, then open the pause screen for the shot.
      setTimeout(() => { this.state = 'paused'; this.hud.openPause(this.pauseState()); }, 600);
    }
    // Snap the camera behind the player at once, so the first frame is the shot.
    this.updateCamera(1);
    document.title = `SOLMAR BAY — shot ${shot}`;
    window.__shotReady = true;
  }

  // --- Main loop ----------------------------------------------------------------------------------
  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    if (this.state === 'playing') {
      this.clockMinutes += dt * 0.9;
      // Cooldowns and nitro.
      for (const k of ['Z', 'X', 'C']) this.abilityCooldown[k] = Math.max(0, this.abilityCooldown[k] - dt);
      if (this.nitroTimer > 0) this.nitroTimer -= dt;
      // Traffic and pedestrians always live.
      const allCars = [{ mesh: this.car }, ...this.traffic];
      for (const t of this.traffic) t.update(dt, allCars);
      const danger = this.mode === 'drive' && Math.abs(this.speed) > 10
        ? { x: this.car.position.x, z: this.car.position.z } : null;
      for (const p of this.peds) p.update(dt, danger);
      if (this.mode === 'drive') this.updateDrive(dt);
      else this.updateFoot(dt);
      this.dispatch.update(dt, { speed: Math.abs(this.speed) }, { x: this.playerX(), z: this.playerZ(), vx: Math.sin(this.carHeading) * this.speed, vz: Math.cos(this.carHeading) * this.speed });
      this.missions.update(dt, { x: this.playerX(), z: this.playerZ() }, this.context);
      const raceEvent = this.race.update(dt, { x: this.playerX(), z: this.playerZ() });
      if (raceEvent && raceEvent.finished) {
        this.hud.toast(`RACE WON — ${Math.round(raceEvent.time)}s · +$2,500`, 4);
        this.money += 2500; this.rp += 500;
        this.hud.setMoney(this.money); this.hud.setRank(this.rp);
      }
      const gecko = this.geckos.update(dt, { x: this.playerX(), z: this.playerZ() }, this.time);
      if (gecko) {
        this.hud.toast(`GOLDEN GECKO ${gecko.collected}/${gecko.total} — +$200`, 2);
        this.money += 200; this.hud.setMoney(this.money);
        this.sound.pickup();
      }
      this.updateTargetCar(dt);
      // Mission 4 staging: rivals appear when the mission starts.
      if (this.missions.mission && this.missions.mission.id === 4 && this.missions.state === 'active' && this.rivals.length === 0 && this.mode === 'foot') {
        this.spawnRivals();
      }
      if (this.missions.mission && this.missions.mission.id === 4 && this.missions.state === 'active' && this.rivals.length === 0 && this.mode === 'drive') {
        // Park the car near the market and step out for the shootout.
        const m = this.landmarks.market;
        this.car.position.set(m.x + 12, 0, m.z + 10);
      }
      // Race starts when mission 5 begins.
      if (this.missions.mission && this.missions.mission.id === 5 && this.missions.state === 'active' && !this.race.active) {
        this.race.start();
      }
      // HUD refresh.
      const d = districtAt(this.playerX(), this.playerZ());
      this.hud.setDistrict(d);
      this.hud.setStars(this.dispatch.wanted);
      this.hud.setPolice(this.dispatch.unitInfo.map((u) => {
        const car = this.dispatch.units.find((c) => c.callsign === u.callsign);
        return { ...u, x: car ? car.mesh.position.x : 0, z: car ? car.mesh.position.z : 0 };
      }), this.dispatch.wanted, this.dispatch.airDeployed);
      this.hud.setVitals(this.hp, this.armour, this.rep);
      if (!this.shotMode) {
        this.hud.setClock(this.day, this.clockLabel(), `SUNSET IN ${Math.max(0, 95 - Math.floor(this.clockMinutes - 17 * 60))}M`);
      }
      const rivals = this.rivals.filter((r) => r.alive).map((r) => ({ x: r.mesh.position.x, z: r.mesh.position.z }));
      this.hud.drawMinimap(
        { x: this.playerX(), z: this.playerZ(), heading: this.mode === 'drive' ? this.carHeading : this.onFoot.heading },
        this.dispatch.units.map((u) => ({ x: u.mesh.position.x, z: u.mesh.position.z })),
        this.missions.target && this.missions.state === 'active' ? this.missions.target : null,
        rivals, this.geckos.collected,
      );
      this.sound.setSiren(this.dispatch.wanted, dt);
      this.hud.tick(dt);
      this.updateCamera(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  run() {
    this.clock = new THREE.Clock();
    const loop = () => { requestAnimationFrame(loop); this.tick(); };
    loop();
  }
}

// Boot.
const game = new SolmarBayGame();
game.run();
