import { getRoundName } from '../../utils/bracketUtils';

/** Full tournament bracket visualization */
export default function BracketView({ bracket, humanPlayerIds = [], onMatchClick }) {
  if (!bracket) return null;

  return (
    <div className="bracket">
      <div className="bracket__rounds">
        {bracket.matchesByRound.map((round, rIdx) => (
          <div key={rIdx} className="bracket__round">
            <div className="bracket__round-label">
              {getRoundName(rIdx, bracket.size)}
            </div>
            <div className="bracket__matches">
              {round.map((match, mIdx) => (
                <BracketMatch
                  key={match.id}
                  match={match}
                  humanPlayerIds={humanPlayerIds}
                  onClick={() => onMatchClick?.(rIdx, mIdx, match)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({ match, humanPlayerIds, onClick }) {
  const p1 = match.player1;
  const p2 = match.player2;
  const isHumanMatch =
    (p1 && humanPlayerIds.includes(p1.id)) ||
    (p2 && humanPlayerIds.includes(p2.id));

  return (
    <div
      className={`bracket-match ${match.complete ? 'bracket-match--complete' : ''} ${isHumanMatch && !match.complete && p1 && p2 ? 'bracket-match--your-turn' : ''}`}
      onClick={isHumanMatch && !match.complete && p1 && p2 ? onClick : undefined}
      role={isHumanMatch && !match.complete && p1 && p2 ? 'button' : undefined}
    >
      <BracketSlot player={p1} score={match.score1} isWinner={match.winner?.id === p1?.id} />
      <div className="bracket-match__vs">vs</div>
      <BracketSlot player={p2} score={match.score2} isWinner={match.winner?.id === p2?.id} />
      {isHumanMatch && !match.complete && p1 && p2 && (
        <div className="bracket-match__your-turn">YOUR MATCH ▶</div>
      )}
    </div>
  );
}

function BracketSlot({ player, score, isWinner }) {
  if (!player) {
    return <div className="bracket-slot bracket-slot--empty">TBD</div>;
  }
  return (
    <div className={`bracket-slot ${isWinner ? 'bracket-slot--winner' : ''}`}>
      <span className="bracket-slot__name">{player.name}</span>
      {score !== undefined && score !== 0 && (
        <span className="bracket-slot__score">{score}</span>
      )}
      {isWinner && <span className="bracket-slot__trophy">🏆</span>}
    </div>
  );
}
