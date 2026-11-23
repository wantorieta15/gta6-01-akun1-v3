// Solmar Bay — game configuration: city layout, districts, story missions,
// crew, weapons, ranks, radio and police dispatch names.
// Every name, place and character here is original to this game.
export const GAME_TITLE = 'SOLMAR BAY';
export const GAME_SUBTITLE = 'Sunset Run';

// --- World layout ---------------------------------------------------------
// The city is a grid of blocks. Each block is BLOCK metres square, separated
// by roads ROAD_WIDE metres wide. The beach and sea sit east of the grid.
export const BLOCK = 44;
export const ROAD_WIDE = 14;
export const GRID_COLS = 8; // west -> east
export const GRID_ROWS = 6; // north -> south
export const WORLD_W = GRID_COLS * (BLOCK + ROAD_WIDE) + ROAD_WIDE;
export const WORLD_H = GRID_ROWS * (BLOCK + ROAD_WIDE) + ROAD_WIDE;
export const BEACH_W = 70; // sand strip east of the grid, then the sea

// Districts: name, grid rect (col,row), standing 0..100, flavour line.
export const DISTRICTS = [
  { id: 'downtown', name: 'DOWNTOWN SOLMAR', col: 2, row: 1, w: 3, h: 2, standing: 62, line: 'Glass towers and gold light' },
  { id: 'coral', name: 'CORAL ROW', col: 4, row: 3, w: 2, h: 2, standing: 58, line: 'Neon shops on the sunset strip' },
  { id: 'marina', name: 'MARINA VERDE', col: 6, row: 2, w: 2, h: 2, standing: 74, line: 'Yachts, gulls and quiet money' },
  { id: 'harbor', name: 'HARBOR', col: 0, row: 4, w: 2, h: 2, standing: 41, line: 'Cranes, crates and old debts' },
  { id: 'pasaru', name: 'OLD PASARU', col: 1, row: 2, w: 2, h: 1, standing: 74, line: 'Stilt houses and the night market' },
  { id: 'lantawa', name: 'LANTAWA CENTRE', col: 3, row: 0, w: 2, h: 1, standing: 66, line: 'Plazas, fountains, slow afternoons' },
  { id: 'banyan', name: 'BANYAN GREEN', col: 5, row: 4, w: 2, h: 1, standing: 70, line: 'Park lawns and street food' },
  { id: 'strand', name: 'KUMALA STRAND', col: 7, row: 4, w: 1, h: 2, standing: 58, line: 'Beachfront, palms and open sky' },
  { id: 'wharf', name: 'LOMBORO WHARF', col: 0, row: 0, w: 2, h: 1, standing: 49, line: 'Ferries, fish stalls, fog horns' },
];

export function districtAt(x, z) {
  let best = null, bestD = Infinity;
  for (const d of DISTRICTS) {
    const cx = ROAD_WIDE + (d.col + d.w / 2) * (BLOCK + ROAD_WIDE) - WORLD_W / 2;
    const cz = ROAD_WIDE + (d.row + d.h / 2) * (BLOCK + ROAD_WIDE) - WORLD_H / 2;
    const dd = Math.hypot(x - cx, z - cz);
    if (dd < bestD) { bestD = dd; best = d; }
    const x0 = ROAD_WIDE + d.col * (BLOCK + ROAD_WIDE) - WORLD_W / 2;
    const z0 = ROAD_WIDE + d.row * (BLOCK + ROAD_WIDE) - WORLD_H / 2;
    if (x >= x0 && x < x0 + d.w * BLOCK + (d.w - 1) * ROAD_WIDE && z >= z0 && z < z0 + d.h * BLOCK + (d.h - 1) * ROAD_WIDE) return d;
  }
  return best;
}

// --- Story: 8 missions ----------------------------------------------------
export const MISSIONS = [
  {
    id: 1, name: 'FIRST LIGHT', title: 'Borrow a ride',
    brief: 'Mara Voss needs a driver. Steal a car and bring it to her garage.',
    stages: [
      { objective: 'Steal any car on Coral Row', hint: 'Walk up to a car and press E' },
      { objective: 'Drive to Mara\'s Garage', hint: 'Follow the yellow marker' },
    ],
    dialogue: { who: 'MARA VOSS', role: 'FIXER', text: 'Solmar runs on borrowed keys, kid. Take a car, bring it to my garage — and try not to scratch it.' },
    reward: 500,
  },
  {
    id: 2, name: 'THE TIDE JOB', title: 'Escape with the cash — lose the cops',
    brief: 'The Coral Row job went loud. Lose the heat before the sun sets.',
    stages: [
      { objective: 'Outrun the SBPD for 45 seconds', hint: 'Drift through corners to build speed' },
      { objective: 'Break line of sight until the heat fades', hint: 'Hide in an alley or swap plates (Z)' },
    ],
    dialogue: { who: 'NADIA CROSS', role: 'FIXER', text: 'Shake that chopper off before you roll up to my garage — swap the plates, ditch the car, whatever it takes!' },
    reward: 1200,
  },
  {
    id: 3, name: 'HOT WATER', title: 'Get Sable to Marina Verde in one piece',
    brief: 'Sable Quinn has a buyer at the marina. Keep the car above 25% condition.',
    stages: [
      { objective: 'Pick up Sable at Downtown Solmar', hint: 'Stop at the pink marker' },
      { objective: 'Reach Marina Verde — keep the car above 25%', hint: 'Avoid ramming traffic' },
    ],
    dialogue: { who: 'SABLE QUINN', role: 'WHEELWOMAN', text: 'Left! Left! They are boxing us in — punch through the gap!' },
    reward: 1500,
  },
  {
    id: 4, name: 'MARKET SQUEEZE', title: 'Clear the aisles',
    brief: 'The Kerono Boys took over the Old Pasaru night market. Take it back, on foot.',
    stages: [
      { objective: 'Take out the Kerono Boys 0/5', hint: 'Click to shoot, R to reload' },
      { objective: 'Melt away before SBPD arrives', hint: 'Reach the green marker' },
    ],
    dialogue: { who: 'MIRA KESANG', role: 'LOOKOUT', text: 'Two down the left aisle! I have got the stall side, Tomo.' },
    reward: 2000,
  },
  {
    id: 5, name: 'GOLDEN HOUR', title: 'Win the Terrace Climb race',
    brief: 'Three laps of the Terrace Climb. Beat the street kings at their own game.',
    stages: [
      { objective: 'Race the Terrace Climb — lap 1/3', hint: 'Hit the glowing gates in order' },
      { objective: 'Hold the lead to the finish', hint: 'Slipstream (X) on the straights' },
    ],
    dialogue: { who: 'KIKO VANE', role: 'LOOKOUT', text: 'Eyes out — the red coupe cuts corners. Stay wide, then dive inside at the fountain.' },
    reward: 2500,
  },
  {
    id: 6, name: 'ORU\'S FALL', title: 'Wreck the Regent',
    brief: 'Oru is running for Kumala Pier in his armoured Regent. Wreck it before it reaches the water.',
    stages: [
      { objective: 'Ram Oru\'s Regent — damage it to 0%', hint: 'PIT it into walls and traffic' },
      { objective: 'Vanish before the air unit locks on', hint: 'Break line of sight' },
    ],
    dialogue: { who: 'MIRA KESANG', role: 'LOOKOUT', text: 'He is making for Kumala Pier! Ram the Regent before it reaches the water!' },
    reward: 3200,
  },
  {
    id: 7, name: 'HARBOR LIGHTS', title: 'Run the dock orders',
    brief: 'Three sealed crates, three docks, one night. The harbor pays in cash.',
    stages: [
      { objective: 'Deliver crate 1/3 to Lomboro Wharf', hint: 'Follow the markers in order' },
      { objective: 'Deliver crates 2/3 and 3/3', hint: 'Watch the clock — sunset in 12 minutes' },
    ],
    dialogue: { who: 'MARA VOSS', role: 'FIXER', text: 'No questions, no peeking, no late deliveries. The harbor remembers who is reliable.' },
    reward: 2800,
  },
  {
    id: 8, name: 'SOLMAR NIGHTS', title: 'Survive the five-star storm',
    brief: 'The whole city is after you. Survive five stars and reach the pier at dawn.',
    stages: [
      { objective: 'Survive the 5-star chase — 90 seconds', hint: 'Use crew abilities: Z swap, X slipstream, C eyes out' },
      { objective: 'Reach Kumala Pier at dawn', hint: 'The sea is the only way out' },
    ],
    dialogue: { who: 'NADIA CROSS', role: 'FIXER', text: 'Five stars, one pier, and a boat with your name on it. Drive like the sun depends on it.' },
    reward: 5000,
  },
];

// --- Crew -----------------------------------------------------------------
export const CREW = [
  { id: 'nadia', name: 'NADIA CROSS', role: 'FIXER', ability: 'SWAP PLATES', key: 'Z', color: '#ff5a5a', desc: 'Instantly drops one wanted star' },
  { id: 'sable', name: 'SABLE QUINN', role: 'WHEELWOMAN', ability: 'SLIPSTREAM', key: 'X', color: '#b388ff', desc: 'Short nitro burst, no heat gain' },
  { id: 'kiko', name: 'KIKO VANE', role: 'LOOKOUT', ability: 'EYES OUT', key: 'C', color: '#4dd0e1', desc: 'Reveals all police units on the map' },
];

// --- Weapons ---------------------------------------------------------------
export const WEAPONS = [
  { id: 'fists', name: 'FISTS', ammo: Infinity, reserve: Infinity, locked: false },
  { id: 'pistol', name: 'PISTOL', ammo: 12, reserve: 48, locked: false },
  { id: 'smg', name: 'SMG', ammo: 30, reserve: 90, locked: true, unlockRank: 'C' },
  { id: 'shotgun', name: 'SHOTGUN', ammo: 6, reserve: 24, locked: true, unlockRank: 'B' },
];

// --- Ranks: RP thresholds ---------------------------------------------------
export const RANKS = [
  { name: 'D', rp: 0 }, { name: 'C', rp: 1500 }, { name: 'B', rp: 4000 },
  { name: 'A', rp: 8000 }, { name: 'S', rp: 14000 },
];
export function rankFor(rp) {
  let r = RANKS[0];
  for (const cand of RANKS) if (rp >= cand.rp) r = cand;
  const idx = RANKS.indexOf(r);
  const next = RANKS[idx + 1] || null;
  return { current: r, next };
}

// --- Radio ------------------------------------------------------------------
export const RADIO = [
  { freq: 'SOL 98.7', name: 'Sunset FM', track: "'Neon Tide' — The Glass Palms" },
  { freq: 'KORAL 101.2', name: 'Island Pop', track: "'Salt Air' — Ombo" },
  { freq: 'VICE 88.5', name: 'Night Drive', track: "'Harbor Lights' — Marlow" },
];

// --- Police dispatch ---------------------------------------------------------
export const POLICE_UNITS = [
  { callsign: 'GULL-1', role: 'PURSUIT' }, { callsign: 'MARLIN-11', role: 'RAMMING' },
  { callsign: 'SNAPPER-25', role: 'SEARCHING' }, { callsign: 'TARPON-18', role: 'PURSUIT' },
  { callsign: 'HARBOR-7', role: 'RAMMING' }, { callsign: 'REEF-3', role: 'RAMMING' },
  { callsign: 'CORAL-9', role: 'ROADBLOCK' }, { callsign: 'PIER-4', role: 'ROADBLOCK' },
  { callsign: 'AIR-1', role: 'SEARCHLIGHT' },
];
export const WANTED_LABELS = ['', 'PETTY THEFT', 'GRAND THEFT', 'ARMED ROBBERY', 'FELONY CHASE', 'CITYWIDE MANHUNT'];

// --- Collectibles / side activities ------------------------------------------
export const GECKO_COUNT = 20; // golden geckos hidden around the city
export const RACE_GATES = 8; // gates per lap of the Terrace Climb
export const STUNT_RAMPS = 4;
