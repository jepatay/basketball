/**
 * Game mechanics for Free Throw Legends.
 */

/**
 * Difficulty levels.
 *
 * speedMult: multiplier on bar period (1.0 = Rookie baseline; 0.6^n = each step 40% faster)
 * zoneMult:  multiplier on make-zone radius (Rookie=full, Legend=40%)
 * cpuSpread: extra sigma spread for CPU shots (1.0 = realistic; >1 = CPU misses more)
 *
 * Zone widths relative to Rookie:
 *   Rookie 2 units → Pro 1.5 → All-Star 1.2 → Legend 0.8
 */
export const DIFFICULTIES = [
  { id: 'rookie',  label: 'Rookie',   speedMult: 1.0,   zoneMult: 1.0,  cpuSpread: 0.85 },
  { id: 'pro',     label: 'Pro',       speedMult: 0.6,   zoneMult: 0.75, cpuSpread: 1.0  },
  { id: 'allstar', label: 'All-Star',  speedMult: 0.36,  zoneMult: 0.60, cpuSpread: 1.15 },
  { id: 'legend',  label: 'Legend',    speedMult: 0.216, zoneMult: 0.40, cpuSpread: 1.30 },
];

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0];
}

/**
 * Bar oscillation period in ms. Bad shooters get faster bars.
 * speedMult < 1 = faster (harder).
 * Floor of 450ms keeps Legend playable on mobile.
 */
export function getBarPeriodMs(ftPct, speedMult = 1.0) {
  const minPeriod = 650;
  const maxPeriod = 2200;
  const t = Math.min(1, Math.max(0, (ftPct - 50) / 45));
  const raw = (minPeriod + t * (maxPeriod - minPeriod)) * speedMult;
  return Math.round(Math.max(raw, 450));
}

/**
 * Zone radii on 0–100 bar scale (center = 50).
 */
export function getZoneRadii(ftPct, zoneMult = 1.0) {
  const t = Math.min(1, Math.max(0, (ftPct - 50) / 45));
  const makeRadius    = (9 + t * 8) * zoneMult;
  const perfectRadius = Math.max(2.5, 3.5 * zoneMult);
  return { makeRadius, perfectRadius };
}

/**
 * Map a player's real career 3-point % (roughly 5–43%) to the game-mechanics
 * scale (50–95) that drives timing-bar speed and zone sizing.
 * A 43% shooter (Curry) → 95 (easiest), a 5% shooter (Shaq) → 50 (hardest).
 */
export function get3PTGamePct(threePct) {
  const t = Math.min(1, Math.max(0, (threePct - 5) / 38));
  return Math.round(50 + t * 45);
}

/**
 * Triangle-wave position 0–100 for elapsed time.
 */
export function getBarPosition(elapsedMs, periodMs) {
  const t = (elapsedMs % periodMs) / periodMs;
  return (t < 0.5 ? t * 2 : (1 - t) * 2) * 100;
}

/**
 * Free-throw shot result from H and V stop positions.
 */
export function calculateShotResult(hStop, vStop, ftPct, zoneMult = 1.0) {
  const hDev = Math.abs(hStop - 50);
  const vDev = Math.abs(vStop - 50);
  const { makeRadius, perfectRadius } = getZoneRadii(ftPct, zoneMult);

  let result;
  if (hDev <= perfectRadius && vDev <= perfectRadius) result = 'perfect';
  else if (hDev <= makeRadius && vDev <= makeRadius) result = 'good';
  else result = 'miss';

  return { result, hDev, vDev, madeShot: result !== 'miss' };
}

/**
 * 3-pointer result from H, V, and radial (R) stop positions.
 * R = 0 → center (perfect), R = 100 → rim (miss).
 * shotPct = game-mechanics value (use get3PTGamePct(player.threePct)) so
 * better 3PT shooters get wider H/V zones, matching their real ability.
 */
export function calculateThreePointResult(hStop, vStop, rStop, zoneMult = 1.0, shotPct = 75) {
  const hDev = Math.abs(hStop - 50);
  const vDev = Math.abs(vStop - 50);
  const rDev = rStop; // 0 = perfect, 100 = miss

  // H/V zones scale with player 3PT ability (same as FT zones)
  const { makeRadius: makeHV, perfectRadius: perfectHV } = getZoneRadii(shotPct, zoneMult);
  // Radial zone: same for all players, only difficulty (zoneMult) scales it
  const makeR    = 28 * zoneMult;
  const perfectR = 10 * zoneMult;

  let result;
  if (hDev <= perfectHV && vDev <= perfectHV && rDev <= perfectR) result = 'perfect';
  else if (hDev <= makeHV && vDev <= makeHV && rDev <= makeR)     result = 'good';
  else result = 'miss';

  return { result, hDev, vDev, rDev, madeShot: result !== 'miss' };
}

/**
 * CPU shot simulation.
 *
 * Calibrated so make rate ≈ player's real ftPct at cpuSpread=1.0.
 *
 * The key fix over previous version: the Box-Muller sum of 4 uniforms has
 * std-dev 0.577, not 1.0.  sigma is divided by 0.577 to give the correct
 * actual standard deviation.
 *
 *   sigma_target = makeRadius * (0.93 − t × 0.47)
 *   sigma_param  = sigma_target / 0.577  = makeRadius * (1.61 − t × 0.81)
 *
 * cpuSpread > 1 makes the CPU less accurate (harder difficulty).
 */
export function simulateCpuShot(ftPct, zoneMult = 1.0, cpuSpread = 1.0) {
  const { makeRadius } = getZoneRadii(ftPct, zoneMult);
  const t = Math.min(1, Math.max(0, (ftPct - 50) / 45));
  const sigma = makeRadius * (1.61 - t * 0.81) * cpuSpread;

  const sampleDev = () => {
    let s = 0;
    for (let i = 0; i < 4; i++) s += Math.random() - 0.5;
    return s * sigma;
  };
  return {
    hStop: Math.min(99, Math.max(1, 50 + sampleDev())),
    vStop: Math.min(99, Math.max(1, 50 + sampleDev())),
  };
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
