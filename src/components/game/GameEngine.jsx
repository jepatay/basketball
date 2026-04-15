import { useEffect, useCallback, useRef } from 'react';
import { useGame } from '../../hooks/useGame';
import TimingBar from './TimingBar';
import ShotResult from './ShotResult';
import Scoreboard from './Scoreboard';
import AvatarDisplay from '../players/AvatarDisplay';
import CourtBackground from './CourtBackground';
import { resumeAudio } from '../../utils/audioUtils';
import { getZoneRadii } from '../../utils/gameUtils';

export default function GameEngine({ players, totalShots, onComplete, onExit, difficulty = 'pro' }) {
  const game = useGame({ players, totalShots, onComplete, difficulty });

  const {
    phase, currentShotNum, currentPlayerIdx, currentPlayer,
    hStop, vStop, lastResult, scores, shotHistory, suddenDeath, sdRound,
    startShot, stopHBar, stopVBar, advanceToVBar, takeCpuShot, ftPct,
    speedMult, zoneMult,
  } = game;

  const hBarRef    = useRef(null);
  const vBarRef    = useRef(null);
  // Prevents the same physical tap from triggering two actions
  // (e.g. startShot AND stopBar in the same gesture).
  const tapLockRef = useRef(false);

  // ── CPU auto-shot ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'ready' && currentPlayer && !currentPlayer.isHuman) {
      const t = setTimeout(() => takeCpuShot(), 700);
      return () => clearTimeout(t);
    }
  }, [phase, currentPlayer, takeCpuShot]);

  // ── Auto h_done → v_bar ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'h_done') {
      const t = setTimeout(() => advanceToVBar(), 350);
      return () => clearTimeout(t);
    }
  }, [phase, advanceToVBar]);

  if (phase === 'done') return null;

  const isHuman     = currentPlayer?.isHuman ?? true;
  const playerLabel = currentPlayer?.label || currentPlayer?.player?.name || 'Player';

  // ── Single master tap handler ─────────────────────────────────────────────
  // onPointerDown fires exactly ONCE per gesture (touch OR mouse),
  // eliminating the onTouchStart + onClick double-fire problem.
  const handlePointer = useCallback((e) => {
    e.preventDefault();
    resumeAudio();

    if (!isHuman || tapLockRef.current) return;

    if (phase === 'ready') {
      // Lock for 350 ms so the same gesture can't also stop the bar
      tapLockRef.current = true;
      setTimeout(() => { tapLockRef.current = false; }, 350);
      startShot();
      return;
    }
    if (phase === 'h_bar') { hBarRef.current?.stop(); return; }
    if (phase === 'v_bar') { vBarRef.current?.stop(); return; }
  }, [phase, isHuman, startShot]);

  // ── H-bar result badge ────────────────────────────────────────────────────
  const { makeRadius, perfectRadius } = getZoneRadii(ftPct, zoneMult);
  const hDev = hStop !== null ? Math.abs(hStop - 50) : null;
  const hBadge = hDev === null ? null
    : hDev <= perfectRadius ? 'perfect'
    : hDev <= makeRadius    ? 'good'
    : 'miss';

  return (
    <div
      className="game-engine"
      onPointerDown={handlePointer}
      style={{ touchAction: 'none' }} // prevent browser scroll interference
    >
      <CourtBackground />

      <div
        className="game-engine__ui"
        onPointerDown={(e) => e.stopPropagation()} // UI elements don't bubble to screen tap
      >
        {/* Header */}
        <div className="game-engine__header">
          <button
            className="btn btn--ghost btn--sm"
            onPointerDown={(e) => { e.stopPropagation(); onExit(); }}
          >✕ Exit</button>
          <div className="game-engine__shooter-name">{playerLabel}</div>
          <div className="game-engine__player-ft">{ftPct}% FT</div>
        </div>

        {/* Scoreboard */}
        <Scoreboard
          players={players}
          scores={scores}
          shotHistory={shotHistory}
          currentShotNum={currentShotNum}
          totalShots={totalShots}
          suddenDeath={suddenDeath}
          sdRound={sdRound}
        />

        {/* Avatar */}
        <div className="game-engine__avatar-wrap">
          <AvatarDisplay player={currentPlayer?.player} size="lg" />
          <div className="game-engine__avatar-info">
            <span className="game-engine__avatar-name">{currentPlayer?.player?.name}</span>
          </div>
        </div>

        {/* Shot result overlay */}
        {phase === 'result' && <ShotResult result={lastResult} />}

        {/* Timing bars */}
        <div className="game-engine__bars-area">
          {(phase === 'h_bar' || phase === 'h_done') && (
            <div className="game-engine__bar-wrap">
              <div className="game-engine__bar-label">◀ LEFT / RIGHT ▶</div>
              <TimingBar
                ref={hBarRef}
                orientation="horizontal"
                ftPct={ftPct}
                speedMult={speedMult}
                zoneMult={zoneMult}
                isActive={phase === 'h_bar'}
                stoppedAt={phase === 'h_done' ? hStop : null}
                onStop={stopHBar}
              />
            </div>
          )}

          {phase === 'v_bar' && (
            <div className="game-engine__bar-wrap">
              <div className="game-engine__bar-label">▲ UP / DOWN ▼</div>
              <div className="game-engine__v-row">
                <TimingBar
                  ref={vBarRef}
                  orientation="vertical"
                  ftPct={ftPct}
                  speedMult={speedMult}
                  zoneMult={zoneMult}
                  isActive={true}
                  stoppedAt={null}
                  onStop={stopVBar}
                />
                {hBadge && (
                  <div className={`game-engine__h-badge game-engine__h-badge--${hBadge}`}>
                    {hBadge === 'perfect' ? '🔥' : hBadge === 'good' ? '✓' : '✗'} H
                  </div>
                )}
              </div>
            </div>
          )}

          {phase === 'result' && hStop !== null && vStop !== null && (
            <div className="game-engine__bar-wrap game-engine__bars--result">
              <TimingBar orientation="horizontal" ftPct={ftPct} speedMult={speedMult} zoneMult={zoneMult} isActive={false} stoppedAt={hStop} />
              <TimingBar orientation="vertical"   ftPct={ftPct} speedMult={speedMult} zoneMult={zoneMult} isActive={false} stoppedAt={vStop} />
            </div>
          )}
        </div>
      </div>

      {/* Basketball tap button — lives outside the UI stopPropagation zone */}
      <div className="game-engine__bottom">
        {isHuman && phase !== 'done' && (
          <>
            <div className={`game-engine__tap-hint ${['h_bar','v_bar'].includes(phase) ? 'game-engine__tap-hint--go' : ''}`}>
              {phase === 'ready'  && 'TAP ANYWHERE TO SHOOT'}
              {phase === 'h_bar'  && '⚡ TAP TO STOP! ⚡'}
              {phase === 'v_bar'  && '⚡ TAP TO STOP! ⚡'}
              {phase === 'result' && '— NEXT SHOT —'}
            </div>
            {/* The 🏀 button is purely visual — the whole screen is already
                the tap target via onPointerDown on .game-engine */}
            <div
              className={`basketball-tap-btn ${['ready','h_bar','v_bar'].includes(phase) ? 'basketball-tap-btn--active' : 'basketball-tap-btn--dim'}`}
              aria-hidden="true"
            >
              🏀
            </div>
          </>
        )}
        {(!isHuman || phase === 'done') && (
          <div className="basketball-tap-btn basketball-tap-btn--cpu">🏀</div>
        )}
      </div>
    </div>
  );
}
