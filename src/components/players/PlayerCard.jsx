import AvatarDisplay from './AvatarDisplay';

/** Compact card for a player, used in selection grids */
export default function PlayerCard({ player, selected, onClick, showFtPct = true }) {
  const ftTier =
    player.ftPct >= 88 ? 'elite' :
    player.ftPct >= 79 ? 'good' :
    player.ftPct >= 70 ? 'average' : 'poor';

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
            {player.ftPct}% FT
          </div>
        )}
      </div>
      {selected && <div className="player-card__check">✓</div>}
    </div>
  );
}
