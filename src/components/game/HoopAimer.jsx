import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getBarPosition } from '../../utils/gameUtils';

/**
 * HoopAimer — radial 3rd-dimension timing for 3-point shots.
 *
 * The ball indicator oscillates radially (center ↔ rim) for scoring,
 * AND simultaneously whips around in a chaotic 360° angular walk.
 *
 * Chaos features:
 *  - Large continuous random velocity kicks
 *  - Occasional "burst" events that suddenly reverse or spike velocity
 *  - Variable radial period (jitter on in/out speed)
 *  - Minimum spin so it never slows to a crawl
 *
 * Score = radial distance from center when player taps (0 = perfect, 100 = miss).
 * The angle at the moment of stopping does NOT affect the score.
 */
const HoopAimer = forwardRef(function HoopAimer(
  { zoneMult = 1.0, isActive = false, stoppedAt = null, onStop },
  ref
) {
  const rafRef          = useRef(null);
  const startTimeRef    = useRef(null);
  const prevTsRef       = useRef(null);
  const positionRef     = useRef(0);
  const angleRef        = useRef(Math.random() * Math.PI * 2);
  const angleVelRef     = useRef((Math.random() - 0.5) * 10);
  const stopAngleRef    = useRef(0);
  const periodJitterRef = useRef(0);
  const nextBurstRef    = useRef(0.4 + Math.random() * 0.8);

  const [displayPos, setDisplayPos] = useState(0);
  const [displayAngle, setDisplayAngle] = useState(() => Math.random() * Math.PI * 2);

  const basePeriodMs = 900;

  const animate = useCallback((ts) => {
    if (!startTimeRef.current) {
      startTimeRef.current = ts;
      prevTsRef.current = ts;
    }

    const dt = Math.min((ts - prevTsRef.current) / 1000, 0.05);
    prevTsRef.current = ts;

    // ── Radial position with jittered period ────────────────────────────────
    if (Math.random() < 0.008) {
      periodJitterRef.current = (Math.random() - 0.5) * 500;
    }
    const effectivePeriod = Math.max(550, basePeriodMs + periodJitterRef.current);
    const pos = getBarPosition(ts - startTimeRef.current, effectivePeriod);
    positionRef.current = pos;

    // ── Angular chaos ────────────────────────────────────────────────────────
    angleVelRef.current += (Math.random() - 0.5) * 40 * dt;

    // Countdown to next chaos burst
    nextBurstRef.current -= dt;
    if (nextBurstRef.current <= 0) {
      const burstType = Math.random();
      if (burstType < 0.4) {
        // Direction reversal with speed boost
        angleVelRef.current = -angleVelRef.current * (1.2 + Math.random() * 0.8);
      } else if (burstType < 0.7) {
        // Large random spike
        angleVelRef.current += (Math.random() - 0.5) * 18;
      } else {
        // Sudden stop + restart in random direction
        angleVelRef.current = (Math.random() < 0.5 ? 1 : -1) * (4 + Math.random() * 8);
      }
      nextBurstRef.current = 0.3 + Math.random() * 0.9;
    }

    // Cap at ±14 rad/s
    angleVelRef.current = Math.max(-14, Math.min(14, angleVelRef.current));

    // Never stall
    if (Math.abs(angleVelRef.current) < 2.5) {
      angleVelRef.current += Math.sign(angleVelRef.current || 1) * 4 * dt;
    }

    angleRef.current += angleVelRef.current * dt;

    setDisplayPos(pos);
    setDisplayAngle(angleRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isActive && stoppedAt === null) {
      startTimeRef.current = null;
      prevTsRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, stoppedAt, animate]);

  const doStop = useCallback(() => {
    if (!isActive || stoppedAt !== null) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stopAngleRef.current = angleRef.current;
    onStop?.(positionRef.current);
  }, [isActive, stoppedAt, onStop]);

  useImperativeHandle(ref, () => ({ stop: doStop }), [doStop]);

  const currentPos   = stoppedAt !== null ? stoppedAt : displayPos;
  const currentAngle = stoppedAt !== null ? stopAngleRef.current : displayAngle;

  // SVG geometry
  const cx = 100, cy = 100, maxR = 80;
  const makeR    = maxR * 0.28 * zoneMult;
  const perfectR = maxR * 0.10 * zoneMult;

  const indicatorR = (currentPos / 100) * maxR;
  const ix = cx + indicatorR * Math.cos(currentAngle);
  const iy = cy + indicatorR * Math.sin(currentAngle);

  const inPerfect = currentPos <= (perfectR / maxR) * 100;
  const inMake    = currentPos <= (makeR / maxR) * 100;
  const indColor  = inPerfect ? '#FFD700' : inMake ? '#00CC66' : '#FF3352';

  return (
    <div
      className={`hoop-aimer${isActive ? ' hoop-aimer--active' : ''}${stoppedAt !== null ? ' hoop-aimer--stopped' : ''}`}
      onClick={doStop}
      onTouchEnd={(e) => { e.preventDefault(); doStop(); }}
      role="button"
      aria-label="hoop aimer — tap to stop"
    >
      <svg viewBox="0 0 200 200" width="180" height="180" xmlns="http://www.w3.org/2000/svg">
        {/* Miss zone — full circle */}
        <circle cx={cx} cy={cy} r={maxR} fill="rgba(255,51,82,0.12)" stroke="none" />

        {/* Make zone */}
        <circle cx={cx} cy={cy} r={makeR} fill="rgba(0,204,102,0.22)" stroke="none" />

        {/* Perfect zone */}
        <circle cx={cx} cy={cy} r={perfectR} fill="rgba(255,215,0,0.32)" stroke="none" />

        {/* Hoop rim ring */}
        <circle cx={cx} cy={cy} r={maxR}
          fill="none" stroke="#FF6B00" strokeWidth="3.5" />

        {/* Inner make-zone ring */}
        <circle cx={cx} cy={cy} r={makeR}
          fill="none" stroke="rgba(0,204,102,0.45)" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* Center crosshair */}
        <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

        {/* Net lines (decorative, bottom) */}
        {[-20, -10, 0, 10, 20].map((x) => (
          <line key={x}
            x1={cx + x} y1={cy + maxR - 4}
            x2={cx + x * 0.5} y2={cy + maxR + 22}
            stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        ))}
        <path d={`M${cx - 20},${cy + maxR + 22} Q${cx},${cy + maxR + 28} ${cx + 20},${cy + maxR + 22}`}
          fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

        {/* Moving indicator */}
        <circle
          cx={ix} cy={iy}
          r={stoppedAt !== null ? 9 : 8}
          fill={indColor}
          stroke={stoppedAt !== null ? '#fff' : 'rgba(255,255,255,0.4)'}
          strokeWidth="1.5"
          style={{ filter: isActive ? `drop-shadow(0 0 8px ${indColor})` : 'none' }}
        />
      </svg>

      <div className="hoop-aimer__label">🏀 ARC 🏀</div>
    </div>
  );
});

export default HoopAimer;
