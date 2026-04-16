import AvatarDisplay from './AvatarDisplay';
import PLAYERS from '../../data/players';

/** Compact card for a player, used in selection grids */
export default function PlayerCard({ player, selected, onClick, showFtPct = true, isThreePoint = false }) {
  // Fall back to static data for threePct in case Firestore player lacks the field
  const staticPlayer = PLAYERS.find((p) => p.id === player.id);
  const threePct = player.threePct ?? staticPlayer?.threePct ?? null;

  // Tier colouring based on the relevant stat for the current game mode
  const pct = isThreePoint ? (threePct ?? 0) : player.ftPct;
  const ftTier = isThreePoint
    ? (pct >= 38 ? 'elite' : pct >= 32 ? 'good' : pct >= 27 ? 'average' : 'poor')
    : (pct >= 88 ? 'elite' : pct >= 79 ? 'good' : pct >= 70 ? 'average' : 'poor');

  return (
    <div
      className={`player-card player-card--${ftTier} ${selected ? 'player-card--selected' : ''}`}
      onClick={() => onClick?.(player)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(player)}
      aria-pressed={selected}
    >
      <AvatarDisplay player={player} size="sm" />
      <div className="player-card__info">
        <div className="player-card__name">{player.name}</div>
        {showFtPct && (
          <div className={`player-card__ft player-card__ft--${ftTier}`}>
            {isThreePoint
              ? `${threePct ?? '?'}% 3PT`
              : `${player.ftPct}% FT`}
          </div>
        )}
      </div>
      {selected && <div className="player-card__check">✓</div>}
    </div>
  );
}
