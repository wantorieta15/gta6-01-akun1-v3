// HUD: every DOM panel the player sees — mission header, SBPD response,
// circular minimap, money and stars, rank, weapons, crew, dialogue,
// speedometer, radio — plus the title screen and the full pause/map screen
// with progress ring, checklist, district map, career stats and save slots.
import { CREW, WEAPONS, RADIO, DISTRICTS, MISSIONS, rankFor } from './config.js';
import { WORLD_W, WORLD_H, BEACH_W } from './config.js';

function el(id) { return document.getElementById(id); }

export class HUD {
  constructor() {
    this.minimap = el('minimap');
    this.mm = this.minimap.getContext('2d');
    this.pausemap = el('pausemap');
    this.pm = this.pausemap ? this.pausemap.getContext('2d') : null;
    this.radioIndex = 0;
    this.dialogueTimer = 0;
    this.toastTimer = 0;
    this.saveSlots = this.loadSaves();
    this.buildCrewPanel();
    this.buildWeaponSlots();
    this.buildTitleSaves();
    this.buildPauseSaves();
  }

  // --- Persistence ----------------------------------------------------------
  loadSaves() {
    try {
      const raw = localStorage.getItem('solmar-bay-saves');
      if (raw) return JSON.parse(raw);
    } catch { /* fresh install */ }
    return [null, null, null];
  }
  persistSaves() {
    try { localStorage.setItem('solmar-bay-saves', JSON.stringify(this.saveSlots)); } catch { /* private mode */ }
  }

  // --- Static panels ----------------------------------------------------------
  buildCrewPanel() {
    const wrap = el('crew-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const c of CREW) {
      const div = document.createElement('div');
      div.className = 'crew-card';
      div.innerHTML = `<span class="crew-face" style="background:${c.color}">${c.name[0]}</span>
        <span class="crew-meta"><b>${c.name}</b><i>${c.role} · ${c.ability}</i></span>
        <span class="crew-key">${c.key}</span>`;
      wrap.appendChild(div);
    }
  }

  buildWeaponSlots() {
    const wrap = el('weapon-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const div = document.createElement('div');
      div.className = 'weapon-slot' + (w.locked ? ' locked' : '');
      div.id = `weapon-${i}`;
      div.innerHTML = `<span class="w-num">${i + 1}</span><span class="w-name">${w.name}</span>
        <span class="w-ammo">${w.locked ? 'LOCKED' : (w.ammo === Infinity ? '∞' : w.ammo + '/' + w.reserve)}</span>`;
      wrap.appendChild(div);
    });
  }

  setWeapon(index) {
    WEAPONS.forEach((w, i) => {
      const div = el(`weapon-${i}`);
      if (div) div.classList.toggle('active', i === index);
    });
  }

  setWeaponAmmo(index, ammo, reserve) {
    const div = el(`weapon-${index}`);
    if (!div) return;
    const span = div.querySelector('.w-ammo');
    if (span) span.textContent = ammo === Infinity ? '∞' : `${ammo}/${reserve}`;
  }

  unlockWeapon(index) {
    const w = WEAPONS[index];
    if (!w || !w.locked) return;
    w.locked = false;
    const div = el(`weapon-${index}`);
    if (div) {
      div.classList.remove('locked');
      div.querySelector('.w-ammo').textContent = `${w.ammo}/${w.reserve}`;
    }
  }

  // --- Mission header ----------------------------------------------------------
  setMission(mission, stageIndex) {
    const box = el('mission-box');
    if (!box || !mission) return;
    const stage = mission.stages[stageIndex];
    box.innerHTML = `
      <div class="mission-kicker">MISSION ${mission.id}/8 · ${mission.name}</div>
      <div class="mission-title">STAGE ${stageIndex + 1}/${mission.stages.length} · ${mission.title}</div>
      <div class="mission-objective">${stage.objective}</div>
      <div class="mission-next">NEXT ▸ ${stage.hint}</div>`;
  }

  setMissionProgress(text) {
    const bar = el('mission-progress');
    if (bar) bar.textContent = text;
  }

  // --- Dialogue ------------------------------------------------------------------
  showDialogue(who, role, text, seconds = 6) {
    const box = el('dialogue');
    if (!box) return;
    box.querySelector('.dlg-name').textContent = `${who} · ${role}`;
    box.querySelector('.dlg-text').textContent = text;
    const face = box.querySelector('.dlg-face');
    face.textContent = who[0];
    face.style.background = { 'MARA VOSS': '#ff8a3d', 'NADIA CROSS': '#ff5a5a', 'SABLE QUINN': '#b388ff', 'KIKO VANE': '#4dd0e1', 'MIRA KESANG': '#7ac74f' }[who] || '#8fa3b8';
    box.classList.add('show');
    this.dialogueTimer = seconds;
  }

  // --- Toasts (DRIFT x3, MISSION COMPLETE, GECKO FOUND...) ----------------------
  toast(text, seconds = 2.5) {
    const t = el('toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    this.toastTimer = seconds;
  }

  // --- Police panel ---------------------------------------------------------------
  setPolice(units, wanted, airDeployed) {
    const panel = el('police-list');
    if (!panel) return;
    const label = ['NO HEAT', 'PETTY THEFT', 'GRAND THEFT', 'ARMED ROBBERY', 'FELONY CHASE', 'CITYWIDE MANHUNT'][wanted] || '';
    el('police-title').textContent = `SBPD RESPONSE · ${wanted === 0 ? 'CLEAR' : label}`;
    if (!units.length) {
      panel.innerHTML = '<div class="police-none">No units on you. Stay clean.</div>';
    } else {
      panel.innerHTML = units.slice(0, 6).map((u) =>
        `<div class="police-row"><span class="p-call">${u.callsign}</span><span class="p-role ${u.role.toLowerCase()}">${u.role}</span><span class="p-dist">${u.dist} m</span></div>`).join('')
        + (units.length > 6 ? `<div class="police-more">+${units.length - 6} more</div>` : '');
    }
    el('air-banner').style.display = airDeployed ? 'block' : 'none';
  }

  // --- Money, stars, rank ------------------------------------------------------------
  setMoney(amount) { const e = el('money'); if (e) e.textContent = '$' + amount.toLocaleString('en-US'); }

  setStars(wanted) {
    const e = el('stars');
    if (!e) return;
    e.innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="${i < wanted ? 'star on' : 'star'}">★</span>`).join('');
    e.classList.toggle('hot', wanted >= 3);
  }

  setRank(rp) {
    const { current, next } = rankFor(rp);
    const rankEl = el('rank-name');
    if (rankEl) rankEl.textContent = `RANK ${current.name}`;
    const bar = el('rank-bar');
    if (bar && next) bar.style.width = `${Math.min(100, ((rp - current.rp) / (next.rp - current.rp)) * 100)}%`;
    const sub = el('rank-sub');
    if (sub) sub.textContent = next ? `${rp.toLocaleString('en-US')} / ${next.rp.toLocaleString('en-US')} RP` : 'MAX RANK';
  }

  // --- Vitals + district ----------------------------------------------------------------
  setVitals(hp, armour, rep) {
    const set = (id, v) => { const e = el(id); if (e) e.style.width = `${Math.max(0, Math.min(100, v))}%`; };
    set('hp-bar', hp); set('armour-bar', armour); set('rep-bar', rep);
    const hpT = el('hp-num'); if (hpT) hpT.textContent = Math.round(hp);
  }

  setDistrict(district) {
    const name = el('district-name'); if (name) name.textContent = district.name;
    const sub = el('district-sub'); if (sub) sub.textContent = district.line;
    const bar = el('district-bar'); if (bar) bar.style.width = `${district.standing}%`;
    const lab = el('district-stand'); if (lab) lab.textContent = district.standing >= 70 ? 'FRIENDLY' : district.standing >= 50 ? 'NEUTRAL' : 'WARY';
    if (lab) lab.className = district.standing >= 70 ? 'friendly' : district.standing >= 50 ? 'neutral' : 'wary';
  }

  // --- Speedometer + radio ----------------------------------------------------------------
  setSpeed(kmh, carName, condition) {
    const s = el('speed-num'); if (s) s.textContent = Math.round(kmh);
    const n = el('car-name'); if (n) n.textContent = carName || '';
    const c = el('car-cond'); if (c) c.style.width = `${Math.max(0, condition)}%`;
  }

  setRadio(index) {
    this.radioIndex = index;
    const r = RADIO[index % RADIO.length];
    const e = el('radio-line');
    if (e) e.textContent = `♪ ${r.freq} · ${r.name} — ${r.track}`;
  }

  cycleRadio() { this.setRadio(this.radioIndex + 1); }

  setClock(day, timeLabel, sunsetIn) {
    const e = el('clock');
    if (e) e.textContent = `DAY ${day} · ${timeLabel} · ${sunsetIn}`;
  }

  // --- Minimap ------------------------------------------------------------------------------
  drawMinimap(player, police, marker, rivals, geckosLeft) {
    const ctx = this.mm, S = 200;
    const scale = S / (WORLD_W + BEACH_W + 40);
    const toX = (x) => (x + WORLD_W / 2 + 20) * scale;
    const toZ = (z) => (z + WORLD_H / 2 + 20) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20242e'; ctx.fillRect(0, 0, S, S);
    // District blocks.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.standing >= 70 ? '#3d6b4f' : d.standing >= 50 ? '#4a4a55' : '#5a3a3a';
      ctx.fillRect(toX(-WORLD_W / 2 + 14 + d.col * 58), toZ(-WORLD_H / 2 + 14 + d.row * 58), d.w * 58 - 16, d.h * 58 - 16);
    }
    // Roads.
    ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 2;
    for (let c = 0; c <= 8; c++) {
      const x = toX(-WORLD_W / 2 + 7 + c * 58);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
    for (let r = 0; r <= 6; r++) {
      const z = toZ(-WORLD_H / 2 + 7 + r * 58);
      ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
    }
    // Sea.
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(toX(WORLD_W / 2), 0, S - toX(WORLD_W / 2), S);
    const dot = (x, z, color, r = 4) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(toX(x), toZ(z), r, 0, Math.PI * 2); ctx.fill();
    };
    if (marker) dot(marker.x, marker.z, '#ffd24d', 6);
    for (const u of police) dot(u.x, u.z, '#ff3b30', 3.5);
    for (const r of rivals || []) dot(r.x, r.z, '#ff2222', 3.5);
    dot(player.x, player.z, '#ffffff', 5);
    // Player heading arrow.
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toX(player.x), toZ(player.z));
    ctx.lineTo(toX(player.x) + Math.sin(player.heading || 0) * 10, toZ(player.z) + Math.cos(player.heading || 0) * 10);
    ctx.stroke();
  }

  // --- Pause / map screen ---------------------------------------------------------------------
  openPause(state) {
    const p = el('pause');
    if (!p) return;
    p.classList.remove('hidden');
    this.renderPause(state);
  }
  closePause() { el('pause')?.classList.add('hidden'); }

  renderPause(state) {
    // Progress ring.
    const total = state.missionsDone / 8 * 0.6 + state.geckos / 20 * 0.15 + state.racesWon / 3 * 0.1 + state.jumps / 8 * 0.05 + state.crew / 3 * 0.1;
    const pct = Math.min(100, Math.round(total * 100));
    const ring = el('progress-num'); if (ring) ring.textContent = pct + '%';
    const ringEl = el('progress-ring');
    if (ringEl) ringEl.style.setProperty('--p', pct);
    // Checklist.
    const rows = [
      ['Story missions', state.missionsDone, 8], ['Street races won', state.racesWon, 3],
      ['Stunt jumps', state.jumps, 8], ['Golden Geckos', state.geckos, 20],
      ['Export list', state.exports, 5], ['District jobs', state.jobs, 7],
      ['Districts FRIENDLY', state.friendly, 7], ['Crew recruited', state.crew, 3],
      ['Gold mission ratings', state.goldRatings, 8],
    ];
    const list = el('checklist');
    if (list) list.innerHTML = rows.map(([label, v, max]) =>
      `<div class="check-row"><span>${label}</span><span class="check-bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></span><b>${v}/${max}</b></div>`).join('');
    // Career stats.
    const stats = [
      [state.carsStolen, 'CARS STOLEN'], [state.copsEscaped, 'COPS ESCAPED'],
      [state.topStars, 'HIGHEST WANTED'], [state.distanceKm, 'DISTANCE DRIVEN'],
      [state.takenOut, 'PEOPLE TAKEN OUT'], [state.longestJump, 'LONGEST JUMP'],
      [state.abilities, 'CREW ABILITIES'], [state.hidden, 'HIDDEN BY LOCALS'],
    ];
    const grid = el('career-grid');
    if (grid) grid.innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    // Mission ratings.
    const ratings = el('mission-ratings');
    if (ratings) ratings.innerHTML = MISSIONS.map((m) =>
      `<span class="rating ${state.ratings[m.id] ? 'got' : ''}">${state.ratings[m.id] || m.id}</span>`).join('');
    // District map.
    if (this.pm) this.drawPauseMap(state);
  }

  drawPauseMap(state) {
    const ctx = this.pm, W = 640, H = 460;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#232833'; ctx.fillRect(0, 0, W, H);
    const scale = Math.min(W / (WORLD_W + BEACH_W + 40), H / (WORLD_H + 40));
    const toX = (x) => (x + WORLD_W / 2 + 20) * scale + 10;
    const toZ = (z) => (z + WORLD_H / 2 + 20) * scale + 10;
    // Sea first, so district labels at the beach are never painted over.
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(toX(WORLD_W / 2), 0, W - toX(WORLD_W / 2), H);
    for (const d of DISTRICTS) {
      const x = toX(-WORLD_W / 2 + 14 + d.col * 58), z = toZ(-WORLD_H / 2 + 14 + d.row * 58);
      ctx.fillStyle = d.standing >= 70 ? '#3d6b4f' : d.standing >= 50 ? '#4a4a55' : '#5a3a3a';
      ctx.fillRect(x, z, (d.w * 58 - 16) * scale, (d.h * 58 - 16) * scale);
      ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(d.name, x + 6, z + 20);
      ctx.fillStyle = '#ffd24d'; ctx.font = '11px sans-serif';
      ctx.fillText((d.standing >= 70 ? 'FRIENDLY' : d.standing >= 50 ? 'NEUTRAL' : 'WARY') + ' · ' + d.standing, x + 6, z + 36);
    }
    // Player marker.
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(toX(state.player.x), toZ(state.player.z), 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText('YOU', toX(state.player.x) + 10, toZ(state.player.z) + 4);
    if (state.marker) {
      ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(toX(state.marker.x), toZ(state.marker.z), 10, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // --- Title screen -----------------------------------------------------------------------------
  buildTitleSaves() {
    const wrap = el('title-saves');
    if (!wrap) return;
    wrap.innerHTML = '';
    this.saveSlots.forEach((s, i) => {
      const div = document.createElement('button');
      div.className = 'save-slot';
      div.innerHTML = s
        ? `<b>${i + 1} · ${s.percent}% · ${s.district}</b><span>${s.missions} missions · ${s.time}</span>`
        : `<b>${i + 1} · EMPTY SLOT</b><span>Start a new run</span>`;
      div.onclick = () => { this.onTitleSave && this.onTitleSave(i); };
      wrap.appendChild(div);
    });
  }

  buildPauseSaves() {
    const wrap = el('pause-saves');
    if (!wrap) return;
    wrap.innerHTML = '';
    this.saveSlots.forEach((s, i) => {
      const div = document.createElement('div');
      div.className = 'save-slot small';
      div.innerHTML = s
        ? `<b>${i + 1} · ${s.percent}% · ${s.district}</b><span>${s.missions} missions · ${s.time}</span>`
        : `<b>${i + 1} · EMPTY</b><span>—</span>`;
      const btn = document.createElement('button');
      btn.textContent = 'SAVE';
      btn.onclick = () => { this.onPauseSave && this.onPauseSave(i); };
      div.appendChild(btn);
      wrap.appendChild(div);
    });
  }

  saveGame(slot, data) {
    this.saveSlots[slot] = data;
    this.persistSaves();
    this.buildTitleSaves();
    this.buildPauseSaves();
  }

  showTitle() {
    el('title')?.classList.remove('hidden');
    el('hud')?.classList.add('hidden');
  }
  hideTitle() {
    el('title')?.classList.add('hidden');
    el('hud')?.classList.remove('hidden');
  }

  // --- Per-frame housekeeping --------------------------------------------------------------------
  tick(dt) {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) el('dialogue')?.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) el('toast')?.classList.remove('show');
    }
  }
}
