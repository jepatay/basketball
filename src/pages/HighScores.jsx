import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../firebase/api';

export default function HighScores() {
  const navigate = useNavigate();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard('century', 50)
      .then(setScores)
      .catch(() => setScores([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page page--highscores">
      <div className="page__header">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
        <h1 className="page__title">🏅 High Scores</h1>
      </div>

      <div className="highscores-card">
        <div className="highscores-game-title">🎯 Century Challenge — Global Leaderboard</div>

        {loading ? (
          <div className="leaderboard__loading">Loading…</div>
        ) : scores.length === 0 ? (
          <div className="leaderboard__loading">No scores yet — be the first!</div>
        ) : (
          <ol className="leaderboard__list leaderboard__list--full">
            <li className="leaderboard__entry leaderboard__entry--header">
              <span className="leaderboard__rank">#</span>
              <span className="leaderboard__user">Player</span>
              <span className="leaderboard__player-name">Character</span>
              <span className="leaderboard__lb-score">Score</span>
              <span className="leaderboard__streak">🔥 Best</span>
              <span className="leaderboard__streak leaderboard__streak--cold">❄️ Worst</span>
            </li>
            {scores.map((entry, i) => (
              <li
                key={entry.id}
                className={`leaderboard__entry ${i === 0 ? 'leaderboard__entry--gold' : i === 1 ? 'leaderboard__entry--silver' : i === 2 ? 'leaderboard__entry--bronze' : ''}`}
              >
                <span className="leaderboard__rank">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="leaderboard__user">{entry.username}</span>
                <span className="leaderboard__player-name">{entry.playerId?.replace(/-/g, ' ')}</span>
                <span className="leaderboard__lb-score">{entry.score}<span className="leaderboard__lb-total">/100</span></span>
                <span className="leaderboard__streak">{entry.bestStreak ?? '—'}</span>
                <span className="leaderboard__streak leaderboard__streak--cold">{entry.worstStreak ?? '—'}</span>
              </li>
            ))}
          </ol>
        )}

        <button className="btn btn--primary" onClick={() => navigate('/century')}>
          🎯 Play Century Challenge
        </button>
      </div>
    </div>
  );
}
