/**
 * Game mechanics for Free Throw Legends.
 *
 * Core design:
 *   Bad shooter (Shaq 52%)  → FAST bar + narrow zone → hard to score
 *   Good shooter (Curry 91%) → SLOW bar + wider zone  → easier to score
 *
 * Make zone is intentionally narrow — you must stop near the center.
 * Being far from center = MISS, regardless of player.
 */

/**
 * Difficulty levels.
 * speedMult > 1 → slower bar (easier); < 1 → faster bar (harder)
 * zoneMult  > 1 → wider zone (easier); < 1 → narrower zone (harder)
 *
 * Pro = current baseline (multipliers of 1.0).
 */
export const DIFFICULTIES = [
  { id: 'rookie',  label: 'Rookie',   speedMult: 1.5,  zoneMult: 1.3  },
  { id: 'pro',     label: 'Pro',       speedMult: 1.0,  zoneMult: 1.0  },
  { id: 'allstar', label: 'All-Star',  speedMult: 0.75, zoneMult: 0.85 },
  { id: 'legend',  label: 'Legend',    speedMult: 0.55, zoneMult: 0.7  },
];

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

/**
 * Bar oscillation period in ms (one full sweep 0→100→0).
 * INVERSE of FT%: worse shooter = faster, scarier bar.
 * speedMult scales the period (1.5 = 50% slower, 0.55 = 45% faster).
 *
 * At Pro (1.0x): Shaq 52% → 650ms, Curry 91% → 2200ms
 */
export function getBarPeriodMs(ftPct, speedMult = 1.0) {
  const minPeriod = 650;
  const maxPeriod = 2200;
  const t = Math.min(1, Math.max(0, (ftPct - 50) / 45));
  return Math.round((minPeriod + t * (maxPeriod - minPeriod)) * speedMult);
}

/**
 * Zone radii on the 0–100 bar scale (center = 50).
 * zoneMult scales both zones (1.3 = 30% wider, 0.7 = 30% narrower).
 */
export function getZoneRadii(ftPct, zoneMult = 1.0) {
  const t = Math.min(1, Math.max(0, (ftPct - 50) / 45));
  const makeRadius    = (9 + t * 8) * zoneMult;
  const perfectRadius = 3.5 * Math.max(0.75, zoneMult);
  return { makeRadius, perfectRadius };
}

/**
 * Current bar position (0–100) given elapsed ms and period.
 * Triangle wave: 0 → 100 in first half, 100 → 0 in second half.
 */
export function getBarPosition(elapsedMs, periodMs) {
  const t = (elapsedMs % periodMs) / periodMs;
  const triangle = t < 0.5 ? t * 2 : (1 - t) * 2;
  return triangle * 100;
}

/**
 * Calculate shot result from stop positions.
 * @param {number} hStop  0–100
 * @param {number} vStop  0–100
 * @param {number} ftPct  0–100
 */
export function calculateShotResult(hStop, vStop, ftPct, zoneMult = 1.0) {
  const hDev = Math.abs(hStop - 50);
  const vDev = Math.abs(vStop - 50);
  const { makeRadius, perfectRadius } = getZoneRadii(ftPct, zoneMult);

  const hInZone = hDev <= makeRadius;
  const vInZone = vDev <= makeRadius;
  const hPerfect = hDev <= perfectRadius;
  const vPerfect = vDev <= perfectRadius;

  let result;
  if (hPerfect && vPerfect) {
    result = 'perfect';
  } else if (hInZone && vInZone) {
    result = 'good';
  } else {
    result = 'miss';
  }

  return { result, hDev, vDev, madeShot: result !== 'miss' };
}

/**
 * CPU shot simulation.
 * CPU "aims" near the center but with realistic variance based on FT%.
 * Better FT% = tighter grouping around center.
 */
export function simulateCpuShot(ftPct, zoneMult = 1.0) {
  const { makeRadius } = getZoneRadii(ftPct, zoneMult);
  // Use a normal-ish distribution: most stops near center, some outliers
  const sampleDev = () => {
    // Box-Muller approximation with capped sigma
    const sigma = makeRadius * 0.85; // aim inside zone most of the time
    let s = 0;
    for (let i = 0; i < 4; i++) s += Math.random() - 0.5;
    return s * sigma;
  };
  const hStop = Math.min(99, Math.max(1, 50 + sampleDev()));
  const vStop = Math.min(99, Math.max(1, 50 + sampleDev()));
  return { hStop, vStop };
}

/** Fisher-Yates shuffle */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
