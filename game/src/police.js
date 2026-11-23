// Wanted level and SBPD dispatch: stars rise with crimes, police units are
// spawned by name and role, the heat fades when the player breaks line of
// sight. The panel data this module exposes feeds the HUD directly.
import { POLICE_UNITS, WANTED_LABELS } from './config.js';
import { PoliceCar, Heli } from './vehicles.js';
import { snapToRoad } from './city.js';

export class PoliceDispatch {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0; // 0..5 stars
    this.heat = 0; // 0..100, drives star changes
    this.units = []; // active PoliceCar instances
    this.unitInfo = []; // { callsign, role, dist } for the HUD panel
    this.heli = null;
    this.nextSpawn = 0;
    this.hideTimer = 0;
    this.airDeployed = false;
  }

  addHeat(amount, reason) {
    if (this.wanted >= 5 && this.heat >= 100) return;
    this.heat = Math.min(100, this.heat + amount);
    const stars = this.heat < 12 ? 0 : this.heat < 30 ? 1 : this.heat < 50 ? 2 : this.heat < 70 ? 3 : this.heat < 88 ? 4 : 5;
    if (stars !== this.wanted) {
      this.wanted = stars;
      this.onStarsChanged && this.onStarsChanged(stars, reason);
    }
  }

  commitCrime(kind) {
    const table = { steal: 18, ram: 6, shoot: 22, kill: 30, speed: 2, race: 8 };
    this.addHeat(table[kind] || 5, kind);
  }

  // Spawn the full complement of units at once (used by screenshot presets
  // and by high-heat moments, so the street is full immediately).
  deploy(wanted, playerPos) {
    this.wanted = wanted;
    this.heat = [0, 15, 32, 52, 72, 95][wanted] || 0;
    const want = wanted === 0 ? 0 : wanted + 1;
    for (let i = this.units.length; i < want; i++) {
      const def = POLICE_UNITS[i % POLICE_UNITS.length];
      const a = (i / want) * Math.PI * 2 + 0.6;
      const spawn = snapToRoad(playerPos.x + Math.cos(a) * 45, playerPos.z + Math.sin(a) * 45);
      this.units.push(new PoliceCar(this.scene, def.callsign, def.role, spawn.x, spawn.z));
    }
    if (wanted >= 3 && !this.heli) {
      this.heli = new Heli(this.scene);
      this.airDeployed = true;
    }
  }

  // Spawn the right number of units for the current wanted level.
  update(dt, player, playerPos) {
    const want = this.wanted === 0 ? 0 : this.wanted + 1;
    // Despawn extras when the heat drops.
    while (this.units.length > want) {
      const u = this.units.pop();
      this.scene.remove(u.mesh);
    }
    this.nextSpawn -= dt;
    if (this.units.length < want && this.nextSpawn <= 0) {
      this.nextSpawn = 1.2;
      const def = POLICE_UNITS[this.units.length % POLICE_UNITS.length];
      const a = Math.random() * Math.PI * 2;
      const spawn = snapToRoad(playerPos.x + Math.cos(a) * 55, playerPos.z + Math.sin(a) * 55);
      const car = new PoliceCar(this.scene, def.callsign, def.role, spawn.x, spawn.z);
      this.units.push(car);
    }
    // AIR-1 deploys at 3 stars and above.
    if (this.wanted >= 3 && !this.heli) {
      this.heli = new Heli(this.scene);
      this.airDeployed = true;
    }
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli.mesh);
      this.heli = null;
      this.airDeployed = false;
    }
    // Update units and build the HUD panel rows.
    this.unitInfo = [];
    for (const u of this.units) {
      const dist = u.update(dt, playerPos, player.speed || 0);
      this.unitInfo.push({ callsign: u.callsign, role: u.role, dist: Math.round(dist) });
    }
    this.unitInfo.sort((a, b) => a.dist - b.dist);
    if (this.heli) this.heli.update(dt, playerPos);
    // Heat fades when the player is far from every unit and out of sight.
    const nearest = this.unitInfo.length ? this.unitInfo[0].dist : 999;
    if (this.wanted > 0 && nearest > 60) {
      this.hideTimer += dt;
      if (this.hideTimer > 4) {
        this.heat = Math.max(0, this.heat - dt * 9);
        const stars = this.heat < 12 ? 0 : this.heat < 30 ? 1 : this.heat < 50 ? 2 : this.heat < 70 ? 3 : this.heat < 88 ? 4 : 5;
        if (stars !== this.wanted) this.wanted = stars;
      }
    } else {
      this.hideTimer = 0;
    }
    return this.wanted;
  }

  get label() { return WANTED_LABELS[this.wanted] || ''; }

  // Crew ability: Swap Plates — drop one star at once.
  swapPlates() {
    if (this.wanted === 0) return false;
    this.heat = Math.max(0, this.heat - 20);
    const stars = this.heat < 12 ? 0 : this.heat < 30 ? 1 : this.heat < 50 ? 2 : this.heat < 70 ? 3 : this.heat < 88 ? 4 : 5;
    this.wanted = stars;
    return true;
  }

  reset() {
    for (const u of this.units) this.scene.remove(u.mesh);
    this.units = [];
    if (this.heli) this.scene.remove(this.heli.mesh);
    this.heli = null;
    this.wanted = 0; this.heat = 0; this.airDeployed = false;
  }
}
