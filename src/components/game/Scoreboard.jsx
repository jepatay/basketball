/** Live scoreboard displayed during gameplay */
export default function Scoreboard({ players, scores, currentShotNum, totalShots, suddenDeath, sdRound }) {
  return (
    <div className="scoreboard">
      {players.map((p, i) => (
        <div key={p.player.id} className={`scoreboard__player ${i === 0 ? 'scoreboard__player--left' : 'scoreboard__player--right'}`}>
          <div className="scoreboard__name">{p.player.name.split(' ').slice(-1)[0]}</div>
          <div className="scoreboard__score">{scores[i]}</div>
        </div>
      ))}

      <div className="scoreboard__center">
        {suddenDeath ? (
          <div className="scoreboard__sd">⚡ SD {sdRound}</div>
        ) : (
          <>
            <div className="scoreboard__shot-num">{currentShotNum}</div>
            <div className="scoreboard__shot-total">/ {totalShots}</div>
          </>
        )}
      </div>
    </div>
  );
}
