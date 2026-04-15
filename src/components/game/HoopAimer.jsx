import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getBarPosition } from '../../utils/gameUtils';

/**
 * HoopAimer — radial 3rd-dimension timing for 3-point shots.
 *
 * The ball indicator oscillates radially (center ↔ rim) for scoring,
 * AND simultaneously drifts in a random direction that keeps changing
 * smoothly — 360° unpredictable movement.
 *
 * Score = radial distance from center when player taps (0 = perfect, 100 = miss).
 * The angle at the moment of stopping does NOT affect the score, only the radius does.
 */
const HoopAimer = forwardRef(function HoopAimer(
  { zoneMult = 1.0, isActive = false, stoppedAt = null, onStop },
  ref
) {
  const rafRef          = useRef(null);
  const startTimeRef    = useRef(null);
  const prevTsRef       = useRef(null);
  const positionRef     = useRef(0);
  const angleRef        = useRef(Math.random() * Math.PI * 2); // random start angle
  const angleVelRef     = useRef((Math.random() - 0.5) * 4);   // rad/s, random initial spin
  const stopAngleRef    = useRef(0);                            // angle frozen at stop

  const [displayPos, setDisplayPos] = useState(0);
  const [displayAngle, setDisplayAngle] = useState(() => Math.random() * Math.PI * 2);

  const periodMs = 900;

  const animate = useCallback((ts) => {
    if (!startTimeRef.current) {
      startTimeRef.current = ts;
      prevTsRef.current = ts;
    }

    const dt = Math.min((ts - prevTsRef.current) / 1000, 0.05); // seconds, capped at 50ms
    prevTsRef.current = ts;

    // Radial position: triangle wave 0→100→0
    const pos = getBarPosition(ts - startTimeRef.current, periodMs);
    positionRef.current = pos;

    // Angular random walk: velocity drifts randomly each frame
    // Add a random nudge, then clamp velocity so it stays lively but not insane
    angleVelRef.current += (Math.random() - 0.5) * 12 * dt;
    angleVelRef.current = Math.max(-7, Math.min(7, angleVelRef.current));
    // Bias back toward non-zero speed so it never fully stops spinning
    if (Math.abs(angleVelRef.current) < 1.5) {
      angleVelRef.current += Math.sign(angleVelRef.current || 1) * 1.5 * dt;
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

  // Indicator position in polar → cartesian
  const indicatorR = (currentPos / 100) * maxR;
  const ix = cx + indicatorR * Math.cos(currentAngle);
  const iy = cy + indicatorR * Math.sin(currentAngle);

  // Trailing ghost dots to show recent path (visual only)
  const trailCount = 4;

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
