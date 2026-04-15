import { useEffect } from 'react';
import { useGame } from '../../hooks/useGame';
import TimingBar from './TimingBar';
import ShotResult from './ShotResult';
import Scoreboard from './Scoreboard';
import AvatarDisplay from '../players/AvatarDisplay';
import { resumeAudio } from '../../utils/audioUtils';

/**
 * Main game engine component.
 *
 * Props:
 *   players:     [{ player: PlayerObj, isHuman: bool, label: string }]
 *   totalShots:  number of shots per player per game
 *   onComplete:  callback({ scores, winner, shotHistory, suddenDeath })
 *   onExit:      callback to leave game
 */
export default function GameEngine({ players, totalShots, onComplete, onExit }) {
  const game = useGame({ players, totalShots, onComplete });

  const {
    phase, currentShotNum, currentPlayerIdx, currentPlayer,
    hStop, vStop, lastResult, scores, suddenDeath, sdRound,
    startShot, stopHBar, stopVBar, advanceToVBar, takeCpuShot, ftPct,
  } = game;

  // Trigger CPU shots automatically
  useEffect(() => {
    if (phase === 'ready' && currentPlayer && !currentPlayer.isHuman) {
      const t = setTimeout(() => takeCpuShot(), 600);
      return () => clearTimeout(t);
    }
  }, [phase, currentPlayer, takeCpuShot]);

  // Auto-advance from h_done to v_bar
  useEffect(() => {
    if (phase === 'h_done') {
      const t = setTimeout(() => advanceToVBar(), 400);
      return () => clearTimeout(t);
    }
  }, [phase, advanceToVBar]);

  if (phase === 'done') return null; // parent handles done state

  const isHuman = currentPlayer?.isHuman ?? true;
  const playerLabel = currentPlayer?.label || currentPlayer?.player?.name || 'Player';

  return (
    <div className="game-engine" onClick={() => resumeAudio()}>
      {/* Header */}
      <div className="game-engine__header">
        <button className="btn btn--ghost btn--sm" onClick={onExit}>✕ Exit</button>
        <div className="game-engine__shooter-name">{playerLabel}</div>
        <div className="game-engine__player-ft">{ftPct}% FT</div>
      </div>

      {/* Scoreboard */}
      <Scoreboard
        players={players}
        scores={scores}
        currentShotNum={currentShotNum}
        totalShots={totalShots}
        suddenDeath={suddenDeath}
        sdRound={sdRound}
      />

      {/* Player avatar */}
      <div className="game-engine__avatar-wrap">
        <AvatarDisplay player={currentPlayer?.player} size="lg" />
      </div>

      {/* Shot result overlay */}
      {phase === 'result' && <ShotResult result={lastResult} />}

      {/* Ready state */}
      {phase === 'ready' && isHuman && (
        <div className="game-engine__cta" onClick={startShot} onTouchEnd={(e) => { e.preventDefault(); startShot(); }}>
          <div className="game-engine__cta-text">TAP TO SHOOT</div>
          <div className="game-engine__cta-sub">Shot {currentShotNum} / {totalShots}{suddenDeath ? ' (Sudden Death)' : ''}</div>
        </div>
      )}

      {phase === 'ready' && !isHuman && (
        <div className="game-engine__cta game-engine__cta--cpu">
          <div className="game-engine__cta-text">CPU SHOOTING…</div>
        </div>
      )}

      {/* Horizontal bar */}
      {(phase === 'h_bar' || phase === 'h_done') && (
        <div className="game-engine__bars">
          <div className="game-engine__bar-label">HORIZONTAL</div>
          <TimingBar
            orientation="horizontal"
            ftPct={ftPct}
            isActive={phase === 'h_bar'}
            stoppedAt={phase === 'h_done' ? hStop : null}
            onStop={stopHBar}
          />
        </div>
      )}

      {/* Vertical bar */}
      {phase === 'v_bar' && (
        <div className="game-engine__bars">
          <div className="game-engine__bar-label">VERTICAL</div>
          <TimingBar
            orientation="vertical"
            ftPct={ftPct}
            isActive={true}
            stoppedAt={null}
            onStop={stopVBar}
          />
          {/* Show frozen h result */}
          {hStop !== null && (
            <div className="game-engine__h-indicator">
              H: {hStop < 40 ? '◀ Left' : hStop > 60 ? 'Right ▶' : '✓ Center'}
            </div>
          )}
        </div>
      )}

      {/* Result phase — show both bar results */}
      {phase === 'result' && hStop !== null && vStop !== null && (
        <div className="game-engine__bars game-engine__bars--result">
          <TimingBar orientation="horizontal" ftPct={ftPct} isActive={false} stoppedAt={hStop} />
          <TimingBar orientation="vertical" ftPct={ftPct} isActive={false} stoppedAt={vStop} />
        </div>
      )}
    </div>
  );
}
