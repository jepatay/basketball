import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../firebase/api';
import { DIFFICULTIES } from '../utils/gameUtils';

export default function HighScores() {
  const navigate = useNavigate();
  const [activeDifficulty, setActiveDifficulty] = useState('pro');
  const [scoresByDiff, setScoresByDiff] = useState({});
  const [loading, setLoading] = useState({});

  const loadDifficulty = (diffId) => {
    if (scoresByDiff[diffId] !== undefined) return; // already loaded
    setLoading((prev) => ({ ...prev, [diffId]: true }));
    getLeaderboard('century', 50, diffId)
      .then((data) => setScoresByDiff((prev) => ({ ...prev, [diffId]: data })))
      .catch(() => setScoresByDiff((prev) => ({ ...prev, [diffId]: [] })))
      .finally(() => setLoading((prev) => ({ ...prev, [diffId]: false })));
  };

  useEffect(() => { loadDifficulty('pro'); }, []);

  const handleTabClick = (diffId) => {
    setActiveDifficulty(diffId);
    loadDifficulty(diffId);
  };

  const scores = scoresByDiff[activeDifficulty];
  const isLoading = loading[activeDifficulty];

  return (
    <div className="page page--highscores">
      <div className="page__header">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>← Back</button>
        <h1 className="page__title">🏅 High Scores</h1>
      </div>

      <div className="highscores-card">
        <div className="highscores-game-title">🎯 Century Challenge</div>

        {/* Difficulty tabs */}
        <div className="highscores-tabs">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className={`highscores-tab ${activeDifficulty === d.id ? 'highscores-tab--active' : ''}`}
              onClick={() => handleTabClick(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="leaderboard__loading">Loading…</div>
        ) : !scores || scores.length === 0 ? (
          <div className="leaderboard__loading">No scores yet for this difficulty — be the first!</div>
        ) : (
          <ol className="leaderboard__list leaderboard__list--full">
            <li className="leaderboard__entry leaderboard__entry--header">
              <span className="leaderboard__rank">#</span>
              <span className="leaderboard__user">Player</span>
              <span className="leaderboard__player-name">Character</span>
              <span className="leaderboard__lb-score">Score</span>
              <span className="leaderboard__streak">🔥</span>
              <span className="leaderboard__streak leaderboard__streak--cold">❄️</span>
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
                <span className="leaderboard__lb-score">
                  {entry.score}<span className="leaderboard__lb-total">/100</span>
                </span>
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
