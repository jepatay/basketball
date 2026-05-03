/** Live scoreboard — shows "made/attempted" and running FT% */
export default function Scoreboard({ players, scores, shotHistory, currentShotNum, totalShots, suddenDeath, sdRound }) {
  return (
    <div className="scoreboard">
      {players.map((p, i) => {
        const made     = scores[i] ?? 0;
        const attempts = shotHistory?.[i]?.length ?? 0;
        const pct      = attempts > 0 ? Math.round((made / attempts) * 100) : null;
        const isLeft   = i === 0;

        return (
          <div key={p.player.id} className={`scoreboard__player ${isLeft ? 'scoreboard__player--left' : 'scoreboard__player--right'}`}>
            <div className="scoreboard__name">{p.player.name.split(' ').slice(-1)[0].toUpperCase()}</div>
            <div className="scoreboard__score-wrap">
              <span className="scoreboard__made">{made}</span>
              <span className="scoreboard__sep">/</span>
              <span className="scoreboard__attempts">{attempts}</span>
            </div>
            {pct !== null && (
              <div className="scoreboard__pct">{pct}%</div>
            )}
          </div>
        );
      })}

      <div className="scoreboard__center">
        {suddenDeath ? (
          <div className="scoreboard__sd">⚡ SD {sdRound}</div>
        ) : (
          <>
            <div className="scoreboard__shot-num">{currentShotNum}</div>
            <div className="scoreboard__shot-of">of {totalShots}</div>
            {players.length === 1 && (() => {
              const made = scores[0] ?? 0;
              const taken = shotHistory?.[0]?.length ?? 0;
              const remaining = totalShots - taken;
              const maxScore = made + remaining;
              const maxPct = Math.round(maxScore / totalShots * 100);
              return remaining > 0 && remaining < totalShots ? (
                <div className="scoreboard__max">max {maxPct}%</div>
              ) : null;
            })()}
          </>
        )}
      </div>
    </div>
  );
}
