import { useEffect, useCallback, useRef } from 'react';
import { useGame } from '../../hooks/useGame';
import TimingBar from './TimingBar';
import ShotResult from './ShotResult';
import Scoreboard from './Scoreboard';
import AvatarDisplay from '../players/AvatarDisplay';
import CourtBackground from './CourtBackground';
import { resumeAudio } from '../../utils/audioUtils';
import { getZoneRadii } from '../../utils/gameUtils';

export default function GameEngine({ players, totalShots, onComplete, onExit }) {
  const game = useGame({ players, totalShots, onComplete });

  const {
    phase, currentShotNum, currentPlayerIdx, currentPlayer,
    hStop, vStop, lastResult, scores, shotHistory, suddenDeath, sdRound,
    startShot, stopHBar, stopVBar, advanceToVBar, takeCpuShot, ftPct,
  } = game;

  // Refs to imperatively call stop() from anywhere on screen
  const hBarRef = useRef(null);
  const vBarRef = useRef(null);

  // Auto-trigger CPU shots
  useEffect(() => {
    if (phase === 'ready' && currentPlayer && !currentPlayer.isHuman) {
      const t = setTimeout(() => takeCpuShot(), 700);
      return () => clearTimeout(t);
    }
  }, [phase, currentPlayer, takeCpuShot]);

  // Auto-advance h_done → v_bar
  useEffect(() => {
    if (phase === 'h_done') {
      const t = setTimeout(() => advanceToVBar(), 350);
      return () => clearTimeout(t);
    }
  }, [phase, advanceToVBar]);

  if (phase === 'done') return null;

  const isHuman     = currentPlayer?.isHuman ?? true;
  const playerLabel = currentPlayer?.label || currentPlayer?.player?.name || 'Player';

  // ── Master tap handler — fires on ANY touch/click anywhere on the screen ──
  const handleScreenTap = useCallback(() => {
    resumeAudio();
    if (!isHuman) return;
    if (phase === 'ready')  { startShot(); return; }
    if (phase === 'h_bar')  { hBarRef.current?.stop(); return; }
    if (phase === 'v_bar')  { vBarRef.current?.stop(); return; }
  }, [phase, isHuman, startShot]);

  // ── Derive H-bar result badge ───────────────────────────────────────────
  const { makeRadius, perfectRadius } = getZoneRadii(ftPct);
  const hDev = hStop !== null ? Math.abs(hStop - 50) : null;
  const hBadge = hDev === null ? null
    : hDev <= perfectRadius ? 'perfect'
    : hDev <= makeRadius    ? 'good'
    : 'miss';

  return (
    <div
      className="game-engine"
      onClick={handleScreenTap}
      onTouchStart={(e) => { e.preventDefault(); handleScreenTap(); }}
    >
      {/* ── Court background fills entire screen ── */}
      <CourtBackground />

      {/* ── All UI sits on top of the court ── */}
      <div className="game-engine__ui" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="game-engine__header">
          <button className="btn btn--ghost btn--sm"
            onClick={(e) => { e.stopPropagation(); onExit(); }}>✕ Exit</button>
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
              <TimingBar orientation="horizontal" ftPct={ftPct} isActive={false} stoppedAt={hStop} />
              <TimingBar orientation="vertical"   ftPct={ftPct} isActive={false} stoppedAt={vStop} />
            </div>
          )}
        </div>
      </div>

      {/* ── Basketball tap button — BIG, bottom center, outside stopPropagation ── */}
      <div className="game-engine__bottom">
        {isHuman && phase !== 'done' && (
          <>
            <div className={`game-engine__tap-hint ${['h_bar','v_bar'].includes(phase) ? 'game-engine__tap-hint--go' : ''}`}>
              {phase === 'ready'  && 'TAP ANYWHERE TO SHOOT'}
              {phase === 'h_bar'  && '⚡ TAP TO STOP! ⚡'}
              {phase === 'v_bar'  && '⚡ TAP TO STOP! ⚡'}
              {phase === 'result' && '— NEXT SHOT —'}
              {phase === 'h_done' && ''}
            </div>
            <button
              className={`basketball-tap-btn ${['ready','h_bar','v_bar'].includes(phase) ? 'basketball-tap-btn--active' : 'basketball-tap-btn--dim'}`}
              onClick={(e) => { e.stopPropagation(); handleScreenTap(); }}
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleScreenTap(); }}
              aria-label="Tap to shoot"
            >
              🏀
            </button>
          </>
        )}
        {(!isHuman || phase === 'done') && (
          <div className="basketball-tap-btn basketball-tap-btn--cpu">🏀</div>
        )}
      </div>
    </div>
  );
}
