/**
 * Game mechanics for Free Throw Legends.
 */

/**
 * Difficulty levels.
 *
 * speedMult: multiplier on bar period (1.0 = Rookie baseline; 0.6^n = each step 40% faster)
 * zoneMult:  multiplier on make-zone radius (Rookie=full, Legend=40%)
 * cpuSpread: extra sigma spread for CPU shots (1.0 = realistic; >1 = CPU misses more)
 */
export const DIFFICULTIES = [
  { id: 'rookie',  label: 'Rookie',   speedMult: 1.0,          zoneMult: 1.0,  cpuSpread: 0.85 },
  { id: 'pro',     label: 'Pro',       speedMult: 1000 / 1400,  zoneMult: 0.75, cpuSpread: 1.0  },
  { id: 'allstar', label: 'All-Star',  speedMult: 800  / 1400,  zoneMult: 0.60, cpuSpread: 1.15 },
  { id: 'legend',  label: 'Legend',    speedMult: 600  / 1400,  zoneMult: 0.40, cpuSpread: 1.30 },
];

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0];
}

/**
 * Bar oscillation period in ms. Scales with difficulty only — not with ftPct.
 * Zone size already differentiates players; double-penalising bad shooters
 * with a faster bar on top of a smaller zone is unfair.
 * Floor of 450ms keeps Legend playable on mobile.
 */
export function getBarPeriodMs(speedMult = 1.0) {
  const basePeriod = 1400;
  return Math.round(Math.max(basePeriod * speedMult, 450));
}

/**
 * Zone radii on 0–100 bar scale (center = 50).
 *
 * Layer 1 — Zone sizing (power 1.5 — balanced curve):
 *   makeRadius = 22 * (ftPct/100)^1.5 * zoneMult
 *
 * Curry/Shaq ratio is ~2.3× (not 5× with cubic) so bad shooters are
 * still hard but not impossible. Rookie zone widths (per bar):
 *   Curry  91%: 38.2%   Jordan 84%: 33.8%
 *   LeBron 73%: 27.4%   Shaq   52%: 16.5%
 */
export function getZoneRadii(ftPct, zoneMult = 1.0) {
  const p = Math.min(1, Math.max(0, ftPct / 100));
  const makeRadius    = 22 * Math.pow(p, 1.5) * zoneMult;
  const perfectRadius = Math.max(2, 7 * Math.pow(p, 1.5) * zoneMult);
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
 *
 * Layer 2 — Random variance (applyVariance = true for human shots only):
 *   Perfect hit: always goes in
 *   Good hit:    miss chance scales linearly with distance from perfect zone:
 *                  t = 0 (just outside gold) → 0% rimout
 *                  t = 1 (outer edge of green) → (1 − ftPct/100)% rimout
 *                A shot barely outside perfect almost never rims out;
 *                only shots near the outer edge carry real miss risk.
 *   Zone miss:   always miss
 *
 * CPU shots use applyVariance=false so their accuracy stays calibrated.
 *
 * Returns:
 *   result   — actual outcome for scoring ('perfect'|'good'|'miss')
 *   aimZone  — where the player aimed ('perfect'|'good'|'miss')
 *              differs from result when variance causes a rimout
 *   madeShot — true if the ball goes in
 */
export function calculateShotResult(hStop, vStop, ftPct, zoneMult = 1.0, applyVariance = false) {
  const hDev = Math.abs(hStop - 50);
  const vDev = Math.abs(vStop - 50);
  const { makeRadius, perfectRadius } = getZoneRadii(ftPct, zoneMult);

  let aimZone;
  if (hDev <= perfectRadius && vDev <= perfectRadius) aimZone = 'perfect';
  else if (hDev <= makeRadius && vDev <= makeRadius)  aimZone = 'good';
  else                                                 aimZone = 'miss';

  let madeShot;
  if (aimZone === 'miss') {
    madeShot = false;
  } else if (applyVariance && aimZone === 'good') {
    // t = 0 at perfect-zone boundary, 1 at make-zone boundary
    const deviation = Math.max(hDev, vDev);
    const t = (deviation - perfectRadius) / Math.max(1, makeRadius - perfectRadius);
    const missChance = (1 - ftPct / 100) * t;
    madeShot = Math.random() >= missChance;
  } else {
    madeShot = true; // perfect always goes in; CPU shots always go in
  }

  return {
    result: madeShot ? aimZone : 'miss',
    aimZone,
    hDev, vDev,
    madeShot,
  };
}

/**
 * 3-pointer result from H, V, and radial (R) stop positions.
 * R = 0 → center (perfect), R = 100 → rim (miss).
 * shotPct = game-mechanics value (use get3PTGamePct(player.threePct)) so
 * better 3PT shooters get wider H/V zones.
 * applyVariance = true for human shots (see calculateShotResult for doc).
 */
export function calculateThreePointResult(hStop, vStop, rStop, zoneMult = 1.0, shotPct = 75, applyVariance = false) {
  const hDev = Math.abs(hStop - 50);
  const vDev = Math.abs(vStop - 50);
  const rDev = rStop; // 0 = perfect, 100 = miss

  // H/V zones scale with player 3PT ability
  const { makeRadius: makeHV, perfectRadius: perfectHV } = getZoneRadii(shotPct, zoneMult);
  // Radial zone: same for all players, only difficulty scales it
  const makeR    = 28 * zoneMult;
  const perfectR = 10 * zoneMult;

  let aimZone;
  if (hDev <= perfectHV && vDev <= perfectHV && rDev <= perfectR) aimZone = 'perfect';
  else if (hDev <= makeHV && vDev <= makeHV && rDev <= makeR)     aimZone = 'good';
  else                                                              aimZone = 'miss';

  let madeShot;
  if (aimZone === 'miss') {
    madeShot = false;
  } else if (applyVariance && aimZone === 'good') {
    const hT = hDev > perfectHV ? (hDev - perfectHV) / Math.max(1, makeHV - perfectHV) : 0;
    const vT = vDev > perfectHV ? (vDev - perfectHV) / Math.max(1, makeHV - perfectHV) : 0;
    const rT = rDev > perfectR  ? (rDev - perfectR)  / Math.max(1, makeR  - perfectR)  : 0;
    const t = Math.max(hT, vT, rT); // furthest from perfect in any dimension
    const missChance = (1 - shotPct / 100) * t;
    madeShot = Math.random() >= missChance;
  } else {
    madeShot = true;
  }

  return {
    result: madeShot ? aimZone : 'miss',
    aimZone,
    hDev, vDev, rDev,
    madeShot,
  };
}

/**
 * CPU shot simulation.
 *
 * Calibrated so make rate ≈ player's real ftPct at cpuSpread=1.0.
 * The sigma formula depends only on t=(ftPct−50)/45, not on the absolute
 * makeRadius value — so it self-calibrates regardless of zone formula.
 *
 *   sigma_param = makeRadius * (1.61 − t × 0.81)
 *
 * CPU shots do NOT apply Layer 2 variance (applyVariance=false in callers).
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
