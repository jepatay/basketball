/**
 * Game mechanics utilities for Free Throw Legends.
 *
 * Two-bar model:
 *   Each bar oscillates from 0→100→0. Center = 50.
 *   Deviation from center: |pos - 50|  (0 = perfect, 50 = worst)
 *
 * Make-zone calibration:
 *   singleBarRadius = sqrt(ftPct/100) * 50
 *   Expected P(make) = P(h in zone) * P(v in zone) ≈ ftPct/100
 *
 * Result tiers:
 *   Perfect  — both bars within innermost 8% of bar (deviation ≤ 4)
 *   Good     — both bars within make zone
 *   Miss     — either bar outside make zone
 */

/** Returns zone radii (deviation threshold) for a player's FT% */
export function getZoneRadii(ftPct) {
  const fraction = ftPct / 100;
  const makeRadius = Math.sqrt(fraction) * 50; // 0–50
  const perfectRadius = 4; // absolute: ≤ 4 deviation on each bar
  return { makeRadius, perfectRadius };
}

/** Bar oscillation speed (pixels/ms equivalent, frames per second scale)
 *  Returns period in ms for a full oscillation (0→100→0).
 *  Better shooters → slightly faster bars.
 */
export function getBarPeriodMs(ftPct) {
  const base = 2200; // ms for a full cycle at 70%
  const factor = 1 + (ftPct - 70) / 100; // 0.5–1.7 range
  return Math.max(1000, base / factor);
}

/**
 * Calculate shot result given stop positions of both bars.
 * @param {number} hStop  0–100
 * @param {number} vStop  0–100
 * @param {number} ftPct  0–100
 * @returns {{ result: 'perfect'|'good'|'miss', hDev: number, vDev: number, madeShot: boolean }}
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

/** Current bar position (0–100) given elapsed ms and period */
export function getBarPosition(elapsedMs, periodMs) {
  const t = (elapsedMs % periodMs) / periodMs; // 0–1
  // Triangle wave: 0→1 in first half, 1→0 in second half
  const triangle = t < 0.5 ? t * 2 : (1 - t) * 2;
  return triangle * 100;
}

/** Simulate a CPU shot with human-like variance around the center */
export function simulateCpuShot(ftPct) {
  // CPU accuracy modelled as gaussian-ish: mostly within zone, sometimes outside
  const { makeRadius } = getZoneRadii(ftPct);
  const spread = makeRadius * 1.1; // slightly beyond zone for realism
  const randomDev = () => (Math.random() + Math.random() - 1) * spread; // triangular distribution
  const hStop = Math.min(100, Math.max(0, 50 + randomDev()));
  const vStop = Math.min(100, Math.max(0, 50 + randomDev()));
  return { hStop, vStop };
}

/** Shuffle array in place (Fisher-Yates) */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
