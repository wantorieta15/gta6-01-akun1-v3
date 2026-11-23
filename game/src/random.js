// Seeded random numbers, so screenshot presets and replays are deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

export function range(rand, min, max) { return min + rand() * (max - min); }

export function chance(rand, p) { return rand() < p; }
