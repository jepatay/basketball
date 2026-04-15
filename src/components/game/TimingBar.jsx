import { useEffect, useRef, useState, useCallback } from 'react';
import { getBarPosition, getBarPeriodMs, getZoneRadii } from '../../utils/gameUtils';

/**
 * Animated timing bar component.
 *
 * Props:
 *   orientation: 'horizontal' | 'vertical'
 *   ftPct:       player's free throw percentage (0-100)
 *   isActive:    whether the bar is currently animating
 *   stoppedAt:   null (animating) or 0-100 (stopped)
 *   onStop:      callback(position: 0-100)
 */
export default function TimingBar({ orientation = 'horizontal', ftPct = 75, isActive = false, stoppedAt = null, onStop }) {
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const positionRef = useRef(50);
  const [displayPos, setDisplayPos] = useState(50);

  const periodMs = getBarPeriodMs(ftPct);
  const { makeRadius, perfectRadius } = getZoneRadii(ftPct);

  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const pos = getBarPosition(elapsed, periodMs);
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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, stoppedAt, animate]);

  const handleTap = useCallback(() => {
    if (!isActive || stoppedAt !== null) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onStop?.(positionRef.current);
  }, [isActive, stoppedAt, onStop]);

  const currentPos = stoppedAt !== null ? stoppedAt : displayPos;
  const isHoriz = orientation === 'horizontal';

  // Zone boundaries as percentages of the bar
  const makeStart = ((50 - makeRadius) / 100) * 100; // as % of bar
  const makeEnd = ((50 + makeRadius) / 100) * 100;
  const perfectStart = ((50 - perfectRadius) / 100) * 100;
  const perfectEnd = ((50 + perfectRadius) / 100) * 100;

  const indicatorStyle = isHoriz
    ? { left: `${currentPos}%`, transform: 'translateX(-50%)' }
    : { top: `${currentPos}%`, transform: 'translateY(-50%)' };

  return (
    <div
      className={`timing-bar timing-bar--${orientation} ${isActive ? 'timing-bar--active' : ''} ${stoppedAt !== null ? 'timing-bar--stopped' : ''}`}
      onClick={handleTap}
      onTouchEnd={(e) => { e.preventDefault(); handleTap(); }}
      role="button"
      aria-label={`${orientation} timing bar`}
    >
      {/* Miss zones (outer, red) */}
      <div className="timing-bar__zone timing-bar__zone--miss" />

      {/* Make zone (green) */}
      <div
        className="timing-bar__zone timing-bar__zone--make"
        style={isHoriz
          ? { left: `${makeStart}%`, width: `${makeEnd - makeStart}%` }
          : { top: `${makeStart}%`, height: `${makeEnd - makeStart}%` }}
      />

      {/* Perfect zone (gold) */}
      <div
        className="timing-bar__zone timing-bar__zone--perfect"
        style={isHoriz
          ? { left: `${perfectStart}%`, width: `${perfectEnd - perfectStart}%` }
          : { top: `${perfectStart}%`, height: `${perfectEnd - perfectStart}%` }}
      />

      {/* Center marker */}
      <div className="timing-bar__center" />

      {/* Moving indicator */}
      <div
        className={`timing-bar__indicator ${stoppedAt !== null ? 'timing-bar__indicator--stopped' : ''}`}
        style={indicatorStyle}
      />

      {/* Label */}
      <div className="timing-bar__label">
        {orientation === 'horizontal' ? '← TAP →' : '↕ TAP'}
      </div>
    </div>
  );
}
