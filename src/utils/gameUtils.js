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
 * Bar oscillation period in ms (one full sweep 0→100→0).
 * INVERSE of FT%: worse shooter = faster, scarier bar.
 *
 * Shaq  52% → 650 ms  (very fast)
 * LeBron73% → 1100 ms (medium)
 * Curry  91% → 2200 ms (slow and deliberate)
 */
export function getBarPeriodMs(ftPct) {
  const minPeriod = 650;   // fastest (worst shooters ~50%)
  const maxPeriod = 2200;  // slowest (best shooters ~95%)
  const t = Math.min(1, Math.max(0, (ftPct - 50) / 45));
  return Math.round(minPeriod + t * (maxPeriod - minPeriod));
}

/**
 * Zone radii on the 0–100 bar scale (center = 50, so radius is 0–50).
 *
 * makeRadius:    how close to center you must stop to score
 * perfectRadius: inner zone for "Perfect" result + swish sound
 *
 * Both are intentionally NARROW. The speed difference creates the FT% gap.
 *   Shaq  52% → makeRadius  9 → only 18% of bar scores (both bars: ~3%)
 *   LeBron73% → makeRadius 13 → 26% of bar scores (both bars: ~7%)
 *   Curry  91% → makeRadius 17 → 34% of bar scores (both bars: ~12%)
 *
 * The actual in-game make rate is much higher because a FOCUSED human
 * can aim near the center — the fast bar just makes that harder to do.
 */
export function getZoneRadii(ftPct) {
  const t = Math.min(1, Math.max(0, (ftPct - 50) / 45));
  const makeRadius = 9 + t * 8;   // 9 for worst, 17 for best
  const perfectRadius = 3.5;       // fixed small perfect zone
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
export function calculateShotResult(hStop, vStop, ftPct) {
  const hDev = Math.abs(hStop - 50);
  const vDev = Math.abs(vStop - 50);
  const { makeRadius, perfectRadius } = getZoneRadii(ftPct);

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
export function simulateCpuShot(ftPct) {
  const { makeRadius } = getZoneRadii(ftPct);
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
