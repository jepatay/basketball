import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getBarPosition } from '../../utils/gameUtils';

/**
 * HoopAimer — radial 3rd-dimension timing for 3-point shots.
 *
 * Displays a hoop (circle) viewed from above.  A ball indicator oscillates
 * from the CENTER outward to the RIM and back.  Position 0 = center (perfect),
 * 100 = rim (miss).  Player must tap when the indicator is near the center.
 *
 * Props:
 *   zoneMult:   difficulty zone multiplier (affects colored zone sizes)
 *   isActive:   true while animating
 *   stoppedAt:  null (moving) | 0-100 (frozen)
 *   onStop:     callback(radialPosition: 0-100)
 */
const HoopAimer = forwardRef(function HoopAimer(
  { zoneMult = 1.0, isActive = false, stoppedAt = null, onStop },
  ref
) {
  const rafRef       = useRef(null);
  const startTimeRef = useRef(null);
  const positionRef  = useRef(0);
  const [displayPos, setDisplayPos] = useState(0);

  // 3PT hoop bar runs a bit faster than FT bars (fixed 900ms period at Rookie)
  const periodMs = 900;

  const animate = useCallback((ts) => {
    if (!startTimeRef.current) startTimeRef.current = ts;
    const pos = getBarPosition(ts - startTimeRef.current, periodMs);
    positionRef.current = pos;
    setDisplayPos(pos);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isActive && stoppedAt === null) {
      startTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, stoppedAt, animate]);

  const doStop = useCallback(() => {
    if (!isActive || stoppedAt !== null) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onStop?.(positionRef.current);
  }, [isActive, stoppedAt, onStop]);

  useImperativeHandle(ref, () => ({ stop: doStop }), [doStop]);

  const currentPos = stoppedAt !== null ? stoppedAt : displayPos;

  // SVG geometry
  const cx = 100, cy = 100, maxR = 80;
  const makeR    = maxR * 0.28 * zoneMult;
  const perfectR = maxR * 0.10 * zoneMult;
  // Indicator travels from center upward
  const indicatorR = (currentPos / 100) * maxR;
  const ix = cx;
  const iy = cy - indicatorR;

  // Color of indicator based on zone
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
        <circle cx={cx} cy={cy} r={maxR} fill="rgba(255,51,82,0.15)" stroke="none" />

        {/* Make zone */}
        <circle cx={cx} cy={cy} r={makeR} fill="rgba(0,204,102,0.25)" stroke="none" />

        {/* Perfect zone */}
        <circle cx={cx} cy={cy} r={perfectR} fill="rgba(255,215,0,0.35)" stroke="none" />

        {/* Hoop rim ring */}
        <circle cx={cx} cy={cy} r={maxR}
          fill="none" stroke="#FF6B00" strokeWidth="3.5" />

        {/* Inner make-zone ring */}
        <circle cx={cx} cy={cy} r={makeR}
          fill="none" stroke="rgba(0,204,102,0.5)" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* Center crosshair */}
        <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

        {/* Net lines (decorative) */}
        {[-20, -10, 0, 10, 20].map((x) => (
          <line key={x}
            x1={cx + x} y1={cy + maxR - 4}
            x2={cx + x * 0.5} y2={cy + maxR + 22}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        ))}
        <path d={`M${cx - 20},${cy + maxR + 22} Q${cx},${cy + maxR + 28} ${cx + 20},${cy + maxR + 22}`}
          fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

        {/* Moving indicator */}
        <circle cx={ix} cy={iy} r={stoppedAt !== null ? 8 : 7}
          fill={indColor}
          stroke={stoppedAt !== null ? '#fff' : 'none'}
          strokeWidth="2"
          style={{ filter: isActive ? `drop-shadow(0 0 6px ${indColor})` : 'none' }}
        />
      </svg>

      <div className="hoop-aimer__label">▲ ARC ▲</div>
    </div>
  );
});

export default HoopAimer;
