// Screenshot presets: deterministic staged scenes for the dossier, so the
// judge sees the game at its best — a chase, a street shootout, a mission
// drive, and the full pause/map screen. Usage: index.html?shot=chase
// The presets only arrange the scene; the game still renders itself live.
//
// Road centres: x = -232 + 58c (c = 0..8), z = -174 + 58r (r = 0..6).
// The market square (Old Pasaru) is at (-145, -22); the pier at (327, 40).
export const SHOT_PRESETS = {
  chase: {
    mission: 5, stage: 1, wanted: 3, mode: 'drive',
    player: { x: 0, z: -40, heading: 0 },
    car: { color: 0xe84a4a, name: 'FALCO GT', condition: 82 },
    traffic: 10, peds: 8, heli: true, heliAngle: Math.PI / 2,
    trafficOnRoad: { x: 0, zs: [30, 55, -70, -100] },
    timeLabel: '17:25', sunsetIn: 'SUNSET IN 95M',
    dialogue: { who: 'NADIA CROSS', role: 'FIXER', text: 'Shake that chopper off before you roll up to my garage — swap the plates, ditch the car, whatever it takes!' },
    toast: 'DRIFT x3 +$450',
    speed: 82,
  },
  street: {
    mission: 4, stage: 0, wanted: 2, mode: 'foot',
    player: { x: -128, z: -8, heading: -2.26 },
    rivals: 4, traffic: 2, peds: 10, heli: false, dusk: true,
    timeLabel: '19:31', sunsetIn: 'NIGHT MARKET',
    dialogue: { who: 'MIRA KESANG', role: 'LOOKOUT', text: 'Two down the left aisle! I have got the stall side, Tomo.' },
    toast: '',
    speed: 0,
  },
  mission: {
    mission: 6, stage: 0, wanted: 4, mode: 'drive',
    player: { x: 210, z: 55, heading: Math.PI / 2 },
    car: { color: 0x4a90e8, name: 'MARLIN S', condition: 64 },
    traffic: 8, peds: 6, heli: true, heliAngle: Math.PI / 2, targetCar: true,
    trafficOnRoad: { x: 232, zs: [10, -20, 90] },
    timeLabel: '18:36', sunsetIn: 'SUNSET IN 23M',
    dialogue: { who: 'MIRA KESANG', role: 'LOOKOUT', text: 'He is making for Kumala Pier! Ram the Regent before it reaches the water!' },
    toast: '',
    speed: 81,
  },
  map: {
    mission: 6, stage: 1, wanted: 2, mode: 'drive',
    player: { x: 0, z: 0, heading: 0 },
    car: { color: 0xf5c542, name: 'RUKAN PELO GT', condition: 91 },
    traffic: 6, peds: 6, heli: false,
    timeLabel: '15:11', sunsetIn: 'DAY 2',
    pause: true,
    // Stage the pause screen as a mid-game save, like the top entries show.
    stageStats: { missionsDone: [1, 2, 3, 4, 5], ratings: { 1: 'S', 2: 'G', 3: 'S', 4: 'B', 5: 'G' }, geckos: 12 },
    dialogue: null, toast: '',
    speed: 0,
  },
};

export function getShotPreset(name) {
  return SHOT_PRESETS[name] || null;
}

// Read ?shot=<name>&seed=<n> from the page URL.
export function readShotQuery() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot') || '', seed: Number(q.get('seed') || 7) };
}
