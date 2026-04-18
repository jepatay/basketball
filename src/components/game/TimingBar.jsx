import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getBarPosition, getBarPeriodMs, getZoneRadii } from '../../utils/gameUtils';

/**
 * Animated timing bar.
 *
 * Exposes a `stop()` imperative method via ref so the PARENT (or a
 * full-screen overlay) can trigger the stop from anywhere on the page.
 *
 * Props:
 *   orientation: 'horizontal' | 'vertical'
 *   ftPct:       player FT% (0-100)
 *   isActive:    true while bar is moving
 *   stoppedAt:   null (moving) or 0-100 (frozen)
 *   onStop:      callback(position: 0-100)
 */
const TimingBar = forwardRef(function TimingBar(
  { orientation = 'horizontal', ftPct = 75, speedMult = 1.0, zoneMult = 1.0, isActive = false, stoppedAt = null, onStop },
  ref
) {
  const rafRef      = useRef(null);
  const startTimeRef = useRef(null);
  const positionRef  = useRef(50);
  const [displayPos, setDisplayPos] = useState(50);

  const periodMs = getBarPeriodMs(speedMult);
  const { makeRadius, perfectRadius } = getZoneRadii(ftPct, zoneMult);

  // ── Animation loop ──────────────────────────────────────────────────────
  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const pos = getBarPosition(timestamp - startTimeRef.current, periodMs);
    positionRef.current = pos;
    setDisplayPos(pos);
    rafRef.current = requestAnimationFrame(animate);
  }, [periodMs]);

  useEffect(() => {
    if (isActive && stoppedAt === null) {
      startTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, stoppedAt, animate]);

  // ── Imperative stop() — called by the parent tap handler ───────────────
  const doStop = useCallback(() => {
    if (!isActive || stoppedAt !== null) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onStop?.(positionRef.current);
  }, [isActive, stoppedAt, onStop]);

  useImperativeHandle(ref, () => ({ stop: doStop }), [doStop]);

  // ── Local tap handler (backup — tapping the bar itself also works) ──────
  const handleTap = useCallback((e) => {
    e.stopPropagation();
    doStop();
  }, [doStop]);

  const currentPos = stoppedAt !== null ? stoppedAt : displayPos;
  const isHoriz    = orientation === 'horizontal';

  // Zone positions as % of bar length
  const makeStart    = ((50 - makeRadius)    / 100) * 100;
  const makeEnd      = ((50 + makeRadius)    / 100) * 100;
  const perfectStart = ((50 - perfectRadius) / 100) * 100;
  const perfectEnd   = ((50 + perfectRadius) / 100) * 100;

  const indicatorStyle = isHoriz
    ? { left: `${currentPos}%`, transform: 'translateX(-50%)' }
    : { top:  `${currentPos}%`, transform: 'translateY(-50%)' };

  return (
    <div
      className={`timing-bar timing-bar--${orientation}${isActive ? ' timing-bar--active' : ''}${stoppedAt !== null ? ' timing-bar--stopped' : ''}`}
      onClick={handleTap}
      onTouchEnd={(e) => { e.preventDefault(); handleTap(e); }}
      role="button"
      aria-label={`${orientation} timing bar — tap to stop`}
    >
      {/* Miss zone (full background, red tint) */}
      <div className="timing-bar__zone timing-bar__zone--miss" />

      {/* Make zone (green) */}
      <div
        className="timing-bar__zone timing-bar__zone--make"
        style={isHoriz
          ? { left: `${makeStart}%`,    width:  `${makeEnd - makeStart}%` }
          : { top:  `${makeStart}%`,    height: `${makeEnd - makeStart}%` }}
      />

      {/* Perfect zone (gold) */}
      <div
        className="timing-bar__zone timing-bar__zone--perfect"
        style={isHoriz
          ? { left: `${perfectStart}%`,  width:  `${perfectEnd - perfectStart}%` }
          : { top:  `${perfectStart}%`,  height: `${perfectEnd - perfectStart}%` }}
      />

      {/* Center line */}
      <div className="timing-bar__center" />

      {/* Moving indicator */}
      <div
        className={`timing-bar__indicator${stoppedAt !== null ? ' timing-bar__indicator--stopped' : ''}`}
        style={indicatorStyle}
      />
    </div>
  );
});

export default TimingBar;
