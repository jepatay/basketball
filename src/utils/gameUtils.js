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
 *
 * Layer 1 — Exponential zone sizing:
 *   makeRadius = 22 * (ftPct/100)³ * zoneMult
 *
 * This creates a dramatic exponential difference between players:
 *   Curry  91%: ~16.6  (window ~330 ms at Rookie)
 *   Jordan 84%: ~13.1
 *   LeBron 73%: ~8.6   (window ~170 ms at Rookie)
 *   Shaq   52%: ~3.1   (window ~62 ms at Rookie)
 *
 * A player at 91% has ~2× the zone of a player at 73% (3× the area).
 */
export function getZoneRadii(ftPct, zoneMult = 1.0) {
  const p = Math.min(1, Math.max(0, ftPct / 100));
  const makeRadius    = 22 * Math.pow(p, 3) * zoneMult;
  const perfectRadius = Math.max(1.5, 7 * Math.pow(p, 3) * zoneMult);
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
 *   Perfect hit: miss with probability (1 − ftPct/100)
 *   Good hit:    miss with probability min(0.94, (1 − ftPct/100) × 2)
 *   Zone miss:   always miss
 *
 * This means even Curry misses ~9% of perfect shots; LeBron misses ~27%.
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
  } else if (applyVariance) {
    const missChance = 1 - ftPct / 100;
    madeShot = aimZone === 'perfect'
      ? Math.random() >= missChance
      : Math.random() >= Math.min(0.94, missChance * 2);
  } else {
    madeShot = true;
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
  } else if (applyVariance) {
    const missChance = 1 - shotPct / 100;
    madeShot = aimZone === 'perfect'
      ? Math.random() >= missChance
      : Math.random() >= Math.min(0.94, missChance * 2);
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
